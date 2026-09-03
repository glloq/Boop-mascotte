import { createExpressionCommands } from '../core/expressions/expression-commands.js';
import { expressionBlend, findExpression, neutralValue, significantControls } from '../core/expressions/expression-model.js';
import { instantiatePreset, presetAvailabilityGroups, presetById } from '../core/expressions/expression-presets.js';
import { createStarterKitCommands } from '../core/starter/starter-kit.js';
import { presetGroupsMarkup, starterKitMarkup, starterKitNotice } from './preset-catalogue.js';
import { deriveMovementChecklist } from '../rig-editor/semantic-parts/face-movements.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * Expression Studio: the Expressions collection (left) and the Expression
 * Inspector (right). Authoring goes through expression commands; the selected
 * expression and its test intensity are transient (EditorSession + preview
 * expression layer). Slider drags preview through a live param and commit once.
 */
export function createExpressionStudio({ listHost, inspectorHost, store, history, preview, editorContext, onStatus = () => {}, navigate = () => {} }) {
  const commands = createExpressionCommands(store, history), starterKit = createStarterKitCommands(store, history);
  let intensity = 1, notice = null, draftName = '', blendOpen = false;
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

  listHost.addEventListener('submit', (event) => { if (event.target.dataset.expressionForm === undefined) return; event.preventDefault(); create(listHost.querySelector('[data-expression-name]')?.value || ''); });
  listHost.addEventListener('toggle', (event) => { if (event.target.dataset.expressionBlend !== undefined) blendOpen = event.target.open; }, true);
  listHost.addEventListener('input', (event) => {
    if (event.target.dataset.expressionName !== undefined) { draftName = event.target.value; return; }
    if (event.target.dataset.expressionBlendDuration !== undefined) {
      const output = listHost.querySelector('[data-expression-blend-output]');
      if (output) output.value = Number(event.target.value) ? `${event.target.value} ms` : 'instant';
    }
  });
  listHost.addEventListener('change', (event) => {
    const { expressionBlendDuration, expressionBlendEasing } = event.target.dataset;
    const patch = expressionBlendDuration !== undefined ? { duration: Number(event.target.value) } : expressionBlendEasing !== undefined ? { easing: event.target.value } : null;
    if (!patch) return;
    // A range reports the same value through several change events; identical values author nothing.
    const current = expressionBlend(doc());
    if (Object.entries(patch).every(([key, value]) => current[key] === value)) return;
    try { commands.setBlend(patch); notice = null; } catch (error) { notice = { tone: 'warn', text: error.message }; }
    render();
  });
  listHost.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !listHost.contains(button)) return;
    if (button.dataset.expressionSelect) { select(button.dataset.expressionSelect === activeId() ? null : button.dataset.expressionSelect); return; }
    if (button.dataset.expressionCaptureNew !== undefined) { const controls = currentFace(); if (!Object.keys(controls).length) { notice = { tone: 'warn', text: 'The face is neutral right now. Drag the mascot, or move a slider, then capture.' }; render(); return; } create(draftName || 'Captured face', { controls, source: 'capture' }); return; }
    if (button.dataset.expressionPresetSelect) { select(button.dataset.expressionPresetSelect); return; }
    if (button.dataset.expressionPreset) { addPreset(button.dataset.expressionPreset); return; }
    if (button.dataset.starterKitAdd !== undefined) { addStarterKit(); return; }
    if (button.dataset.expressionFixMovements !== undefined) { navigate({ task: 'face-setup', focus: 'face-movements' }); }
  });
  inspectorHost.addEventListener('click', (event) => { if (event.target.closest('button')?.dataset.expressionFixMovements !== undefined) navigate({ task: 'face-setup', focus: 'face-movements' }); });

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

  inspectorHost.addEventListener('input', (event) => {
    const { expressionIntensity, expressionControl } = event.target.dataset;
    if (expressionIntensity !== undefined) { intensity = Number(event.target.value); applyPreview(); const output = inspectorHost.querySelector('[data-expression-intensity-output]'); if (output) output.value = `${Math.round(intensity * 100)}%`; return; }
    if (expressionControl) {
      // Drag preview: emulate the composition for this control until the change commits.
      const value = Number(event.target.value), neutral = neutralValue(doc(), expressionControl);
      preview.setLiveParam(expressionControl, neutral + intensity * (value - neutral));
      const output = inspectorHost.querySelector(`[data-expression-output="${CSS.escape(expressionControl)}"]`); if (output) output.value = value.toFixed(2);
    }
  });
  inspectorHost.addEventListener('change', (event) => {
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
  inspectorHost.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !inspectorHost.contains(button)) return;
    const expression = active();
    const { expressionForget, expressionCapture, expressionDuplicate, expressionDelete, expressionNeutral } = button.dataset;
    if (expressionForget && expression) { commands.setControl(expression.id, expressionForget, null); applyPreview(); render(); return; }
    if (expressionCapture !== undefined && expression) {
      const face = currentFace();
      if (!Object.keys(face).length) { notice = { tone: 'warn', text: 'The face is neutral right now. Drag the mascot, or move a slider, then capture.' }; render(); return; }
      commands.capture(expression.id, face); preview.clearLiveParams(); notice = { tone: 'success', text: `✓ ${Object.keys(face).length} control${Object.keys(face).length === 1 ? '' : 's'} captured from the current face.` }; applyPreview(); render(); return;
    }
    if (expressionDuplicate !== undefined && expression) { select(commands.duplicate(expression.id)); return; }
    if (expressionDelete !== undefined && expression) { const name = expression.name; commands.remove(expression.id); notice = { tone: 'info', text: `${name} deleted.` }; select(null); onStatus(`Expression "${name}" deleted.`); return; }
    if (expressionNeutral !== undefined) { intensity = 1; applyPreview(); render(); }
  });

  /**
   * How long one expression takes to become another. The runtime and the
   * preview both read `expressionBlend`; without this control the cross-fade
   * they implement was unreachable and every project switched instantly
   * (docs/CONTINUOUS_TRANSITIONS.md).
   */
  function blendMarkup(state) {
    if (!(state.expressions || []).length) return '';
    const blend = expressionBlend(state);
    const curve = [['linear', 'Linear'], ['easeIn', 'Ease In'], ['easeOut', 'Ease Out'], ['easeInOut', 'Ease In Out']];
    return `<details class="expression-blend" data-expression-blend data-blend-duration="${blend.duration}" ${blendOpen ? 'open' : ''}><summary>Switching between expressions<small>${blend.duration ? `${blend.duration} ms` : 'instant'}</small></summary>
      <label>Cross-fade <output data-expression-blend-output>${blend.duration ? `${blend.duration} ms` : 'instant'}</output><input type="range" data-expression-blend-duration aria-label="Cross-fade between expressions in milliseconds" min="0" max="800" step="20" value="${blend.duration}"></label>
      <label>Curve <select data-expression-blend-easing aria-label="Cross-fade curve">${curve.map(([value, label]) => `<option value="${value}" ${blend.easing === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <p class="small">Happy becomes Angry over this long, starting from the face on screen — it never passes through neutral. 0 ms switches instantly. Applies in Preview and in the exported mascot.</p></details>`;
  }

  function renderList() {
    const state = doc(), list = state.expressions || [], current = activeId();
    listHost.dataset.expressionsReady = 'true';
    listHost.dataset.expressionsCount = String(list.length);
    if (!state.svgMarkup) { listHost.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; return; }
    const movements = enabledMovements();
    const gate = movements.length ? '' : '<p class="face-pick-notice" data-tone="warn">Turn on at least one movement in Face Setup: expressions are made of movements.</p>';
    const card = (preset) => { const existing = findExpression(state, preset.id); const kept = Object.keys(preset.controls).length; return `<article class="preset-card" data-expression-preset-card="${preset.id}" data-preset-usable="${preset.usable}" data-preset-missing="${preset.missing.length}"><div><b>${esc(preset.name)}</b><small>${esc(preset.description)}</small><small class="${preset.missing.length ? 'preset-missing' : ''}">${preset.usable ? `${kept} movement${kept === 1 ? '' : 's'}` : 'No matching movement yet'}${preset.missing.length ? ` · ${preset.missing.length} missing` : ''}</small></div>${existing ? `<button type="button" class="secondary" data-expression-preset-select="${esc(existing.id)}" aria-label="Select ${esc(preset.name)}">Select</button>` : `<button type="button" data-expression-preset="${preset.id}" aria-label="Add ${esc(preset.name)} preset" ${preset.usable ? '' : 'disabled'} title="${esc(preset.missing.length ? `Also uses: ${preset.missing.map((item) => item.label).join(', ')}` : 'Adds this face with your movements')}">Add</button>`}</article>`; };
    const presets = presetGroupsMarkup(presetAvailabilityGroups(state), card, { className: 'expression-presets' });
    listHost.innerHTML = `<div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}"><span>${esc(notice.text)}</span>${notice.fix ? '<button type="button" class="secondary" data-expression-fix-movements>Face Setup</button>' : ''}</p>` : ''}</div>${gate}${starterKitMarkup(starterKit.plan())}<section class="preset-catalogue" data-preset-catalogue="expressions"><h3>Ready-made faces</h3>${presets}</section><form class="expression-form" data-expression-form><label>New expression<input data-expression-name aria-label="New expression name" placeholder="Happy, Sad, Surprised…" value="${esc(draftName)}" ${movements.length ? '' : 'disabled'}></label><button type="submit" ${movements.length ? '' : 'disabled'}>Create</button></form><button type="button" class="secondary face-next" data-expression-capture-new ${movements.length ? '' : 'disabled'}>Capture current face as expression</button>${list.length ? `<ol class="expression-list" aria-label="Expressions">${list.map((item) => `<li><button type="button" class="expression-item" data-expression-select="${esc(item.id)}" aria-pressed="${item.id === current}"><span>${esc(item.name)}</span><small>${Object.keys(item.controls || {}).length} control${Object.keys(item.controls || {}).length === 1 ? '' : 's'}</small></button></li>`).join('')}</ol>` : `<p class="expression-empty">No expressions yet. An expression is a named face (Happy, Sad…) built from your movements; you can apply it at any intensity in Preview and in the exported mascot.</p>`}${blendMarkup(state)}`;
  }

  function renderInspector() {
    const state = doc(), expression = active();
    inspectorHost.dataset.expressionId = expression?.id || '';
    if (!expression) { inspectorHost.innerHTML = state.svgMarkup ? '<h2>Expressions</h2><p>Select an expression on the left, create one by name, or capture the current face.</p>' : ''; return; }
    const movements = enabledMovements();
    const controls = movements.map((item) => {
      const set = item.id in (expression.controls || {}), param = state.params[item.id], neutral = neutralValue(state, item.id), value = set ? expression.controls[item.id] : neutral;
      return `<div class="expression-control" data-expression-row="${item.id}" data-set="${set}"><header><b>${esc(item.group)} · ${esc(item.label)}</b><span><output data-expression-output="${item.id}">${Number(value).toFixed(2)}</output>${set ? `<button type="button" class="icon secondary" data-expression-forget="${item.id}" aria-label="Forget ${esc(item.label)} in this expression" title="Back to neutral for this expression">×</button>` : '<small>neutral</small>'}</span></header><input type="range" data-expression-control="${item.id}" aria-label="${esc(item.group)} ${esc(item.label)} in ${esc(expression.name)}" min="${param?.min ?? -1}" max="${param?.max ?? 1}" step=".01" value="${value}"></div>`;
    }).join('');
    const count = Object.keys(expression.controls || {}).length;
    const missing = missingFor(expression), stale = Object.keys(expression.controls || {}).filter((name) => !state.params?.[name]);
    const guidance = missing.length || stale.length ? `<p class="face-pick-notice" data-tone="warn" data-expression-guidance><span>${missing.length ? `This preset also uses ${missing.map((item) => esc(item.label)).join(', ')} — off in this project.` : ''}${stale.length ? ` Stored movements no longer exist: ${stale.map(esc).join(', ')}.` : ''}</span><button type="button" class="secondary" data-expression-fix-movements>Turn on in Face Setup</button></p>` : '';
    inspectorHost.innerHTML = `<label>Name<input data-expression-rename aria-label="Expression name" value="${esc(expression.name)}"></label>${guidance}<p class="small">id <code>${esc(expression.id)}</code> · ${count} control${count === 1 ? '' : 's'} · <code>mascot.setExpression('${esc(expression.id)}')</code></p>
      <div class="expression-intensity"><label>Test intensity <output data-expression-intensity-output>${Math.round(intensity * 100)}%</output><input type="range" data-expression-intensity aria-label="Test intensity" min="0" max="1" step=".05" value="${intensity}"></label><p class="small">Intensity is a preview setting; the expression itself stores the full-strength face.</p></div>
      <h3>Face at full intensity</h3>${movements.length ? `<div class="expression-controls">${controls}</div>` : '<p class="small">Turn on movements in Face Setup first.</p>'}
      <div class="expression-actions"><button type="button" data-expression-capture title="Use the face as it is on the canvas right now (live controls)">Capture current face</button><button type="button" class="secondary" data-expression-duplicate>Duplicate</button><button type="button" class="danger secondary" data-expression-delete>Delete</button></div>`;
  }

  function render() { renderList(); renderInspector(); }
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
    /** Entering the workspace re-applies the active expression to Preview (leave() cleared it). */
    enter() { const expression = active(); if (expression && intensity > 0 && preview.getExpressionWeights()[expression.id] === undefined) applyPreview(); },
    leave() { if (Object.keys(preview.getExpressionWeights()).length) preview.clearExpressions(); },
    snapshot() { return { activeId: activeId(), intensity, weights: preview.getExpressionWeights() }; }
  };
}
