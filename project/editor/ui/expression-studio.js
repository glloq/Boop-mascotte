import { createExpressionCommands } from '../core/expressions/expression-commands.js';
import { expressionBlend, findExpression, neutralValue, significantControls } from '../core/expressions/expression-model.js';
import { instantiatePreset, presetAvailabilityGroups, presetById } from '../core/expressions/expression-presets.js';
import { createStarterKitCommands } from '../core/starter/starter-kit.js';
import { createPresetGroups, starterKitMarkup, starterKitNotice } from './preset-catalogue.js';
import { setPanelHtml } from './panel-render.js';
import { createComponent } from './component.js';
import { deriveMovementChecklist } from '../rig-editor/semantic-parts/face-movements.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// The separator every signature joins on: a NUL cannot occur in an id, a name
// or a label, so the joined string stays one-to-one with what it came from.
const SEP = '\u0000';

/**
 * A host that registers its listeners through the component.
 *
 * `createPresetGroups` (and `rememberOpen` under it) adds a capture-phase
 * `toggle` listener to the host when it is built, and asks the host for
 * nothing else but `querySelectorAll`. Handing it this facade puts that one
 * listener under the lifecycle — removed by `destroy()` like the others —
 * without changing `panel-render.js`, which the rest of the editor shares.
 */
const underLifecycle = (host, listen) => ({
  addEventListener: (type, handler, options) => listen(host, type, handler, options),
  querySelectorAll: (selector) => host.querySelectorAll?.(selector) || []
});

// Fixed arity per item is what keeps one flat join unambiguous.
/** Three per expression: the id it is selected by, and the two things the row shows. */
const listSignature = (list) => list.flatMap((item) => [item.id, item.name, Object.keys(item.controls || {}).length]).join(SEP);
/**
 * Per group its name and how many cards it holds (the summary counts both),
 * then five per card: the id — which fixes the name and description, both
 * constants — whether it can be added, how many movements it would keep, the
 * ones it would miss, and the expression that already exists for it, which
 * turns Add into Select.
 */
const presetSignature = (groups, state) => groups.flatMap((entry) => [entry.group, entry.presets.length,
  ...entry.presets.flatMap((preset) => [preset.id, preset.usable, Object.keys(preset.controls).length, preset.missing.map((item) => item.label).join(','), findExpression(state, preset.id)?.id || ''])]).join(SEP);
/** The kit card counts what it would add and names what it would skip. */
const kitSignature = (plan) => [plan?.added ?? 0, ...(plan?.entries || []).flatMap((item) => [item.kind, item.id, item.name, item.action])].join(SEP);
/** Seven per slider: its label, the range it moves in, and where it sits. */
const rowSignature = (rows) => rows.flatMap((row) => [row.id, row.group, row.label, row.min, row.max, row.set, row.value]).join(SEP);

/**
 * Expression Studio: the Expressions collection (left) and the Expression
 * Inspector (right). Authoring goes through expression commands; the selected
 * expression and its test intensity are transient (EditorSession + preview
 * expression layer). Slider drags preview through a live param and commit once.
 *
 * Behind the component lifecycle since VNX-03 step 4 (docs/VNEXT_COMPONENTS.md).
 * Two things are worth knowing before changing it:
 *
 * - `enter()` / `leave()` are the semantic ancestors of `show()` / `hide()`, so
 *   they are wired to both. What they do to Preview is unchanged: `leave()`
 *   still disarms the live expression, `enter()` still re-arms it. The
 *   lifecycle half is what makes a workspace nobody is looking at cost a model
 *   comparison instead of two `innerHTML` rewrites per keystroke.
 * - The panel keeps four pieces of state of its own — the notice, the draft
 *   name, the test intensity and the cross-fade disclosure — and all four are
 *   in the model. The notice is the one that would bite: a warning set by a
 *   click that authors nothing ("the face is neutral right now") changes no
 *   project data at all, so left out of the model it would never reach the
 *   screen.
 */
export function createExpressionStudio({ listHost, inspectorHost, store, history, preview, editorContext, onStatus = () => {}, navigate = () => {} }) {
  const commands = createExpressionCommands(store, history), starterKit = createStarterKitCommands(store, history);
  let intensity = 1, notice = null, draftName = '', blendOpen = false;
  // Built on mount rather than here: the groups an author opened have to
  // outlive the rebuilt list, and the listener that remembers them has to go
  // when the panel does.
  let presetGroups = () => '';
  // Everything derived for the last render. The lists are rebuilt on every
  // derivation, so nothing but their signature can tell two identical passes
  // apart: they stay here and the signature goes in the model.
  let view = { state: {}, hasArtwork: false, list: [], current: null, movements: [], groups: [], plan: null, blend: { duration: 0, easing: 'linear' }, expression: null, rows: [], missing: [], stale: [] };
  const doc = () => store.getDocument();
  const activeId = () => editorContext.get().activeExpressionId;
  const active = () => findExpression(doc(), activeId());
  const enabledMovements = () => deriveMovementChecklist(doc()).items.filter((item) => item.enabled);
  const currentFace = () => { const state = doc(), effective = preview.getEffectiveParams(); return significantControls(state, Object.fromEntries(enabledMovements().map((item) => [item.id, effective[item.id]]))); };
  const applyPreview = () => { preview.clearExpressions(); const expression = active(); if (expression) preview.setExpression(expression.id, intensity); };
  const select = (id) => { editorContext.update({ activeExpressionId: id || null }); applyPreview(); render(); };

  function create(name, extra = {}) {
    try {
      const id = commands.create({ name, ...extra });
      draftName = '';
      notice = { tone: 'success', text: extra.controls ? `✓ ${name || 'Expression'} captured from the current face.` : `✓ ${name || 'Expression'} created. Move the sliders to shape it.` };
      if (extra.controls) preview.clearLiveParams();
      select(id);
      onStatus(`Expression "${findExpression(doc(), id)?.name}" created.`);
    } catch (error) { notice = { tone: 'warn', text: error.message }; render(); }
  }

  /** The whole kit in one press: faces, motions, reactions and automatic life, one undo step. */
  function addStarterKit() {
    try {
      const report = starterKit.add();
      notice = starterKitNotice(report);
      onStatus(notice.text);
      render();
    } catch (error) { notice = { tone: 'warn', text: error.message }; render(); }
  }

  function addPreset(id) {
    const preset = instantiatePreset(doc(), id);
    if (!preset.usable) { notice = { tone: 'warn', text: `${preset.name} needs movements that are off: ${preset.missing.map((item) => item.label).join(', ')}. Turn them on in Face Setup first.` }; render(); return; }
    try {
      const created = commands.create({ name: preset.name, id: preset.id, controls: preset.controls, source: 'preset' });
      const kept = Object.keys(preset.controls).length;
      notice = preset.missing.length
        ? { tone: 'warn', text: `✓ ${preset.name} added with ${kept} movement${kept === 1 ? '' : 's'}. It would also use ${preset.missing.map((item) => item.label).join(', ')}: turn them on in Face Setup for the full preset.`, fix: true }
        : { tone: 'success', text: `✓ ${preset.name} added with ${kept} movement${kept === 1 ? '' : 's'}. Adjust it if you like.` };
      select(created);
      onStatus(`Expression "${preset.name}" added from preset.`);
    } catch (error) { notice = { tone: 'warn', text: error.message }; render(); }
  }

  /** Movements a preset-based expression would use but the project does not have (yet). */
  const missingFor = (expression) => { if (!expression) return []; const preset = presetById(expression.id) || (expression.source === 'preset' ? presetById(expression.id) : null); return preset && expression.source === 'preset' ? instantiatePreset(doc(), preset).missing : []; };

  const component = createComponent({
    host: listHost,
    onMount: ({ listen }) => {
      presetGroups = createPresetGroups(underLifecycle(listHost, listen));

      listen(listHost, 'submit', (event) => { if (event.target.dataset.expressionForm === undefined) return; event.preventDefault(); create(listHost.querySelector('[data-expression-name]')?.value || ''); });
      listen(listHost, 'toggle', (event) => { if (event.target.dataset.expressionBlend !== undefined) blendOpen = event.target.open; }, true);
      listen(listHost, 'input', (event) => {
        if (event.target.dataset.expressionName !== undefined) { draftName = event.target.value; return; }
        if (event.target.dataset.expressionBlendDuration !== undefined) {
          const output = listHost.querySelector('[data-expression-blend-output]');
          if (output) output.value = Number(event.target.value) ? `${event.target.value} ms` : 'instant';
        }
      });
      listen(listHost, 'change', (event) => {
        const { expressionBlendDuration, expressionBlendEasing } = event.target.dataset;
        const patch = expressionBlendDuration !== undefined ? { duration: Number(event.target.value) } : expressionBlendEasing !== undefined ? { easing: event.target.value } : null;
        if (!patch) return;
        // A range reports the same value through several change events; identical values author nothing.
        const current = expressionBlend(doc());
        if (Object.entries(patch).every(([key, value]) => current[key] === value)) return;
        try { commands.setBlend(patch); notice = null; } catch (error) { notice = { tone: 'warn', text: error.message }; }
        render();
      });
      listen(listHost, 'click', (event) => {
        const button = event.target.closest('button'); if (!button || !listHost.contains(button)) return;
        if (button.dataset.expressionSelect) { select(button.dataset.expressionSelect === activeId() ? null : button.dataset.expressionSelect); return; }
        if (button.dataset.expressionCaptureNew !== undefined) { const controls = currentFace(); if (!Object.keys(controls).length) { notice = { tone: 'warn', text: 'The face is neutral right now. Drag the mascot, or move a slider, then capture.' }; render(); return; } create(draftName || 'Captured face', { controls, source: 'capture' }); return; }
        if (button.dataset.expressionPresetSelect) { select(button.dataset.expressionPresetSelect); return; }
        if (button.dataset.expressionPreset) { addPreset(button.dataset.expressionPreset); return; }
        if (button.dataset.starterKitAdd !== undefined) { addStarterKit(); return; }
        if (button.dataset.expressionFixMovements !== undefined) { navigate({ task: 'face-setup', focus: 'face-movements' }); }
      });

      listen(inspectorHost, 'click', (event) => { if (event.target.closest('button')?.dataset.expressionFixMovements !== undefined) navigate({ task: 'face-setup', focus: 'face-movements' }); });
      listen(inspectorHost, 'click', (event) => {
        const button = event.target.closest('button'); if (!button || !inspectorHost.contains(button)) return;
        const expression = active();
        const { expressionForget, expressionCapture, expressionDuplicate, expressionDelete } = button.dataset;
        if (expressionForget && expression) { commands.setControl(expression.id, expressionForget, null); applyPreview(); render(); return; }
        if (expressionCapture !== undefined && expression) {
          const face = currentFace();
          if (!Object.keys(face).length) { notice = { tone: 'warn', text: 'The face is neutral right now. Drag the mascot, or move a slider, then capture.' }; render(); return; }
          commands.capture(expression.id, face); preview.clearLiveParams(); notice = { tone: 'success', text: `✓ ${Object.keys(face).length} control${Object.keys(face).length === 1 ? '' : 's'} captured from the current face.` }; applyPreview(); render(); return;
        }
        if (expressionDuplicate !== undefined && expression) { select(commands.duplicate(expression.id)); return; }
        if (expressionDelete !== undefined && expression) { const name = expression.name; commands.remove(expression.id); notice = { tone: 'info', text: `${name} deleted.` }; select(null); onStatus(`Expression "${name}" deleted.`); return; }
      });
      listen(inspectorHost, 'input', (event) => {
        const { expressionIntensity, expressionControl } = event.target.dataset;
        if (expressionIntensity !== undefined) { intensity = Number(event.target.value); applyPreview(); const output = inspectorHost.querySelector('[data-expression-intensity-output]'); if (output) output.value = `${Math.round(intensity * 100)}%`; return; }
        if (expressionControl) {
          // Drag preview: emulate the composition for this control until the change commits.
          const value = Number(event.target.value), neutral = neutralValue(doc(), expressionControl);
          preview.setLiveParam(expressionControl, neutral + intensity * (value - neutral));
          const output = inspectorHost.querySelector(`[data-expression-output="${CSS.escape(expressionControl)}"]`); if (output) output.value = value.toFixed(2);
        }
      });
      listen(inspectorHost, 'change', (event) => {
        const { expressionControl, expressionRename } = event.target.dataset, expression = active();
        if (!expression) return;
        if (expressionControl) {
          preview.clearLiveParam(expressionControl);
          const value = Number(event.target.value);
          // Browsers may emit change more than once for one gesture; identical values author nothing.
          if (expression.controls?.[expressionControl] !== value) {
            try { commands.setControl(expression.id, expressionControl, value); notice = null; } catch (error) { notice = { tone: 'warn', text: error.message }; }
          }
          applyPreview(); render(); return;
        }
        if (expressionRename !== undefined) {
          try { commands.rename(expression.id, event.target.value); notice = null; } catch (error) { notice = { tone: 'warn', text: error.message }; }
          render();
        }
      });
    },
    // The component empties its own host. The Inspector is this panel's second
    // host, so it is cleared here, while the DOM is still there.
    onDestroy: () => { inspectorHost.innerHTML = ''; },
    render: (model) => { renderList(model); renderInspector(model); }
  });

  const noticeMarkup = (model) => model.noticeText
    ? `<p class="face-pick-notice" data-tone="${model.noticeTone}"><span>${esc(model.noticeText)}</span>${model.noticeFix ? '<button type="button" class="secondary" data-expression-fix-movements>Face Setup</button>' : ''}</p>`
    : '';

  /**
   * How long one expression takes to become another. The runtime and the
   * preview both read `expressionBlend`; without this control the cross-fade
   * they implement was unreachable and every project switched instantly
   * (docs/CONTINUOUS_TRANSITIONS.md).
   */
  function blendMarkup(model) {
    if (!model.expressionCount) return '';
    const curve = [['linear', 'Linear'], ['easeIn', 'Ease In'], ['easeOut', 'Ease Out'], ['easeInOut', 'Ease In Out']];
    const spoken = model.blendDuration ? `${model.blendDuration} ms` : 'instant';
    return `<details class="expression-blend" data-expression-blend data-blend-duration="${model.blendDuration}" ${model.blendOpen ? 'open' : ''}><summary>Switching between expressions<small>${spoken}</small></summary>
      <label>Cross-fade <output data-expression-blend-output>${spoken}</output><input type="range" data-expression-blend-duration aria-label="Cross-fade between expressions in milliseconds" min="0" max="800" step="20" value="${model.blendDuration}"></label>
      <label>Curve <select data-expression-blend-easing aria-label="Cross-fade curve">${curve.map(([value, label]) => `<option value="${value}" ${model.blendEasing === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <p class="small">Happy becomes Angry over this long, starting from the face on screen — it never passes through neutral. 0 ms switches instantly. Applies in Preview and in the exported mascot.</p></details>`;
  }

  function renderList(model) {
    const state = view.state;
    if (!model.hasArtwork) { listHost.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; return; }
    const enabled = model.movementCount ? '' : 'disabled';
    const gate = model.movementCount ? '' : '<p class="face-pick-notice" data-tone="warn">Turn on at least one movement in Face Setup: expressions are made of movements.</p>';
    const card = (preset) => { const existing = findExpression(state, preset.id); const kept = Object.keys(preset.controls).length; return `<article class="preset-card" data-expression-preset-card="${preset.id}" data-preset-usable="${preset.usable}" data-preset-missing="${preset.missing.length}"><div><b>${esc(preset.name)}</b><small>${esc(preset.description)}</small><small class="${preset.missing.length ? 'preset-missing' : ''}">${preset.usable ? `${kept} movement${kept === 1 ? '' : 's'}` : 'No matching movement yet'}${preset.missing.length ? ` · ${preset.missing.length} missing` : ''}</small></div>${existing ? `<button type="button" class="secondary" data-expression-preset-select="${esc(existing.id)}" aria-label="Select ${esc(preset.name)}">Select</button>` : `<button type="button" data-expression-preset="${preset.id}" aria-label="Add ${esc(preset.name)} preset" ${preset.usable ? '' : 'disabled'} title="${esc(preset.missing.length ? `Also uses: ${preset.missing.map((item) => item.label).join(', ')}` : 'Adds this face with your movements')}">Add</button>`}</article>`; };
    const presets = presetGroups(view.groups, card, { className: 'expression-presets' });
    setPanelHtml(listHost, `<div role="status" aria-live="polite">${noticeMarkup(model)}</div>${gate}${starterKitMarkup(view.plan)}<section class="preset-catalogue" data-preset-catalogue="expressions"><h3>Ready-made faces</h3>${presets}</section><form class="expression-form" data-expression-form><label>New expression<input data-expression-name aria-label="New expression name" placeholder="Happy, Sad, Surprised…" value="${esc(model.draftName)}" ${enabled}></label><button type="submit" ${enabled}>Create</button></form><button type="button" class="secondary face-next" data-expression-capture-new ${enabled}>Capture current face as expression</button>${model.expressionCount ? `<ol class="expression-list" aria-label="Expressions">${view.list.map((item) => `<li><button type="button" class="expression-item" data-expression-select="${esc(item.id)}" aria-pressed="${item.id === model.activeId}"><span>${esc(item.name)}</span><small>${Object.keys(item.controls || {}).length} control${Object.keys(item.controls || {}).length === 1 ? '' : 's'}</small></button></li>`).join('')}</ol>` : `<p class="expression-empty">No expressions yet. An expression is a named face (Happy, Sad…) built from your movements; you can apply it at any intensity in Preview and in the exported mascot.</p>`}${blendMarkup(model)}`);
  }

  function renderInspector(model) {
    inspectorHost.dataset.expressionId = model.expressionId;
    if (!model.expressionId) { inspectorHost.innerHTML = model.hasArtwork ? '<h2>Expressions</h2><p>Select an expression on the left, create one by name, or capture the current face.</p>' : ''; return; }
    const controls = view.rows.map((row) => `<div class="expression-control" data-expression-row="${row.id}" data-set="${row.set}"><header><b>${esc(row.group)} · ${esc(row.label)}</b><span><output data-expression-output="${row.id}">${Number(row.value).toFixed(2)}</output>${row.set ? `<button type="button" class="icon secondary" data-expression-forget="${row.id}" aria-label="Forget ${esc(row.label)} in this expression" title="Back to neutral for this expression">×</button>` : '<small>neutral</small>'}</span></header><input type="range" data-expression-control="${row.id}" aria-label="${esc(row.group)} ${esc(row.label)} in ${esc(model.expressionName)}" min="${row.min}" max="${row.max}" step=".01" value="${row.value}"></div>`).join('');
    const count = model.controlCount;
    const guidance = view.missing.length || view.stale.length ? `<p class="face-pick-notice" data-tone="warn" data-expression-guidance><span>${view.missing.length ? `This preset also uses ${view.missing.map((item) => esc(item.label)).join(', ')} — off in this project.` : ''}${view.stale.length ? ` Stored movements no longer exist: ${view.stale.map(esc).join(', ')}.` : ''}</span><button type="button" class="secondary" data-expression-fix-movements>Turn on in Face Setup</button></p>` : '';
    inspectorHost.innerHTML = `<label>Name<input data-expression-rename aria-label="Expression name" value="${esc(model.expressionName)}"></label>${guidance}<p class="small">id <code>${esc(model.expressionId)}</code> · ${count} control${count === 1 ? '' : 's'} · <code>mascot.setExpression('${esc(model.expressionId)}')</code></p>
      <div class="expression-intensity"><label>Test intensity <output data-expression-intensity-output>${Math.round(model.intensity * 100)}%</output><input type="range" data-expression-intensity aria-label="Test intensity" min="0" max="1" step=".05" value="${model.intensity}"></label><p class="small">Intensity is a preview setting; the expression itself stores the full-strength face.</p></div>
      <h3>Face at full intensity</h3>${model.movementCount ? `<div class="expression-controls">${controls}</div>` : '<p class="small">Turn on movements in Face Setup first.</p>'}
      <div class="expression-actions"><button type="button" data-expression-capture title="Use the face as it is on the canvas right now (live controls)">Capture current face</button><button type="button" class="secondary" data-expression-duplicate>Duplicate</button><button type="button" class="danger secondary" data-expression-delete>Delete</button></div>`;
  }

  /** Every object the two markups read, derived once per render. */
  function derive() {
    const state = doc(), expression = active(), params = state.params || {}, controls = expression?.controls || {};
    const movements = enabledMovements();
    return {
      state, hasArtwork: Boolean(state.svgMarkup), list: state.expressions || [], current: activeId() || '',
      movements, groups: presetAvailabilityGroups(state), plan: starterKit.plan(), blend: expressionBlend(state), expression,
      // One row per movement: the value the slider sits at is the expression's
      // when it has one, neutral when it does not, and the row says which.
      rows: movements.map((item) => {
        const set = item.id in controls, param = params[item.id], neutral = neutralValue(state, item.id);
        return { id: item.id, group: item.group, label: item.label, min: param?.min ?? -1, max: param?.max ?? 1, set, value: set ? controls[item.id] : neutral };
      }),
      missing: missingFor(expression),
      stale: Object.keys(controls).filter((name) => !params[name])
    };
  }

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * The four panel-owned values (`notice`, `draftName`, `intensity`,
   * `blendOpen`) are in it for the same reason the guide bar's `expanded` is:
   * they are not project data, but the markup swings on them, and a model that
   * leaves them out is a panel that redraws them away.
   */
  const model = () => ({
    hasArtwork: view.hasArtwork,
    expressionCount: view.list.length,       // the count attribute, the empty line, and whether there is a cross-fade to set
    activeId: view.current,                  // aria-pressed in the list; a stale id simply matches nothing
    expressionId: view.expression?.id || '', // what the Inspector is on, which is not the same question
    expressionName: view.expression?.name || '',
    controlCount: Object.keys(view.expression?.controls || {}).length,
    movementCount: view.movements.length,    // the gate, and every disabled attribute in the form
    intensity,
    draftName,
    blendOpen,
    blendDuration: view.blend.duration,
    blendEasing: view.blend.easing,
    noticeTone: notice?.tone || '',
    noticeText: notice?.text || '',
    noticeFix: Boolean(notice?.fix),
    starterKit: kitSignature(view.plan),
    presets: presetSignature(view.groups, view.state),
    expressions: listSignature(view.list),
    controls: rowSignature(view.rows),
    // The two lists behind the Inspector's warning, kept apart by the empty
    // field between them so one moving into the other is still a change.
    guidance: [...view.missing.map((item) => item.label), '', ...view.stale].join(SEP)
  });

  function render() {
    view = derive();
    const next = model();
    // The readout is published on every call, hidden or not. What `hide()`
    // defers is the markup -- the expensive half -- and a panel that stops
    // saying how many expressions it holds the moment the author looks at
    // another workspace is a panel that lies rather than one that saves work.
    publishReadout(next);
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  /** Cheap state, always current: two attributes, no DOM building. */
  function publishReadout(model) {
    listHost.dataset.expressionsReady = 'true';
    listHost.dataset.expressionsCount = String(model.expressionCount);
  }

  return {
    render,
    /** The expression being shaped, so a puppet drag knows where to land. */
    activeExpressionId: () => activeId(),
    /**
     * Write a handful of controls into the active expression, as one step.
     *
     * This is what a drag on the mascot commits to: the same values the
     * sliders write, through the same command.
     */
    writeControls(values) {
      const expression = active();
      if (!expression || !Object.keys(values || {}).length) return false;
      try { commands.setControls(expression.id, values); notice = null; } catch (error) { notice = { tone: 'warn', text: error.message }; }
      applyPreview();
      render();
      return true;
    },
    /**
     * Entering the workspace re-applies the active expression to Preview
     * (leave() cleared it), and shows the component again: the render deferred
     * while nobody was looking is paid here, once.
     */
    enter() {
      const expression = active();
      if (expression && intensity > 0 && preview.getExpressionWeights()[expression.id] === undefined) applyPreview();
      component.show();
    },
    /** Leaving disarms the live expression, and stops the DOM work with it. */
    leave() {
      if (Object.keys(preview.getExpressionWeights()).length) preview.clearExpressions();
      component.hide();
    },
    snapshot() { return { activeId: activeId(), intensity, weights: preview.getExpressionWeights() }; },
    destroy: () => component.destroy(),
    counters: () => component.counters()
  };
}
