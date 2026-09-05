import { createMotionCommands } from '../core/motion/motion-commands.js';
import { findClip, motionBlend, motionSummary } from '../core/motion/motion-model.js';
import { MOTION_SETTING_LIMITS, MOTION_SHAPES, composableMovements, composedMotionId, motionAvailability, motionAvailabilityGroups } from '../core/motion/motion-presets.js';
import { createStarterKitCommands } from '../core/starter/starter-kit.js';
import { createPresetGroups, starterKitMarkup, starterKitNotice } from './preset-catalogue.js';
import { setPanelHtml } from './panel-render.js';
import { createComponent } from './component.js';
import { controlMeta } from './control-catalog.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const controlLabel = (name) => { const meta = controlMeta(name); return `${meta.group} · ${meta.label}`; };
const formatSetting = (key, value) => key === 'amplitude' ? `${Math.round(Number(value) * 100)}%` : key === 'duration' ? `${Number(value)} s` : `×${Number(value)}`;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const summaryLine = (summary) => summary.kind === 'simple' ? `${summary.presetName} · ${summary.duration} s${summary.repeats > 1 ? ` · ×${summary.repeats}` : ''}${summary.loop ? ' · loop' : ''}`
  : summary.kind === 'edited' ? `${summary.presetName} · ${plural(summary.keys, 'key')}` : `${plural(summary.tracks, 'track')} · ${plural(summary.keys, 'key')}`;
const BADGES = { simple: 'Preset', edited: 'Edited', custom: 'Timeline' };

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
/**
 * Eleven per motion, which is every value the list row and the Inspector read:
 * the id, the name, what kind of clip it has become, the preset behind it, and
 * the seven the badge line, the three settings and the loop box are made of.
 */
const clipSignature = (summaries) => summaries.flatMap((item) => [item.id, item.name, item.kind, item.presetName, item.amplitude, item.repeats, item.duration, item.loop, item.tracks, item.keys, item.controls.join(',')]).join(SEP);
/**
 * Per group its name and how many cards it holds (the summary counts both),
 * then four per card: the id — which fixes the name and description, both
 * constants — whether it can be added, the movements it would drive, and the
 * ones it would need first.
 */
const presetSignature = (groups) => groups.flatMap((entry) => [entry.group, entry.presets.length,
  ...entry.presets.flatMap((preset) => [preset.id, preset.usable, Object.values(preset.controls).join(','), preset.missing.map((item) => item.label).join(',')])]).join(SEP);
/** The kit card counts what it would add and names what it would skip. */
const kitSignature = (plan) => [plan?.added ?? 0, ...(plan?.entries || []).flatMap((item) => [item.kind, item.id, item.name, item.action])].join(SEP);

/**
 * Motion Studio: the simple entry to Animate. Presets compile to ordinary
 * animation clips (ProjectDocument.animationClips, `animation` domain) through
 * motion commands; the active clip lives in EditorSession.animationEditor and
 * playback is preview-only. The Timeline below stays the key-by-key editor.
 *
 * Behind the component lifecycle since VNX-03 step 4 (docs/VNEXT_COMPONENTS.md).
 * It has no `enter` / `leave`: Animate shares its workspace with the Timeline,
 * so nothing tells this panel it is off screen and it is never hidden. What it
 * gains is the model comparison — Animate is redrawn on every `rig` and
 * `animation` notification, and a pose changes nothing it shows.
 *
 * Three values in the model are not project data and are easy to miss:
 * `notice`, the `confirmReset` question, and whether the Timeline can be
 * opened at all. The last one is the sharp one: it comes from the layout, not
 * from the store, and `__boopLayoutChanged` calls `render()` for it — left out
 * of the model, the button would keep the disabled state of the layout before.
 */
export function createMotionStudio({ listHost, inspectorHost, store, history, preview, editorContext, onStatus = () => {}, navigate = () => {}, openTimeline = () => {}, canOpenTimeline = () => true }) {
  const commands = createMotionCommands(store, history), starterKit = createStarterKitCommands(store, history);
  let notice = null, confirmReset = null, blendOpen = false;
  // Built on mount rather than here: the groups an author opened have to
  // outlive the rebuilt list, and the listener that remembers them has to go
  // when the panel does.
  let presetGroups = () => '';
  // Kind per clip id from the previous render: a simple motion whose keys were
  // just edited in the Timeline gets one explicit conversion notice.
  let lastKinds = new Map();
  // Everything derived for the last render. The lists are rebuilt on every
  // derivation, so nothing but their signature can tell two identical passes
  // apart: they stay here and the signature goes in the model.
  let view = { hasArtwork: false, clips: [], summaries: [], groups: [], usable: false, plan: null, blend: { duration: 0, easing: 'linear' }, clip: null, summary: null };
  const doc = () => store.getDocument();
  const activeId = () => editorContext.get().animationEditor?.activeClipId || null;
  const active = () => findClip(doc(), activeId());
  const select = (id) => {
    editorContext.update({ animationEditor: { ...editorContext.get().animationEditor, activeClipId: id || null, playhead: 0 }, activeStateId: null, selectedTrackParameter: null, selectedKey: null });
    if (preview.getActiveClipId() !== (id || null)) preview.setClip(id || null);
    render();
  };
  const play = (id) => { if (id) preview.playMotion(id); };
  const fail = (error) => { notice = { tone: 'warn', text: error.message, fix: /Face Setup/.test(error.message) }; render(); };

  /**
   * What "Make your own" is set to (VNX-27). Panel state, not the document:
   * nothing is authored until Add is pressed, exactly like the catalogue above.
   */
  let composeControl = '';
  let composeShape = MOTION_SHAPES[0].id;
  let composeOpen = false;
  /**
   * The movement Add would use: what the author picked, or the first one the
   * project has. The select shows a value from the moment the section opens,
   * so the button has to mean that value and not the empty string behind it.
   */
  const composedControl = () => (view.movements.some((entry) => entry.movements.some((item) => item.id === composeControl))
    ? composeControl
    : view.movements[0]?.movements[0]?.id || '');

  function addPreset(id) {
    try {
      const clipId = commands.createFromPreset(id), clip = findClip(doc(), clipId);
      notice = { tone: 'success', text: `✓ ${clip.name} added and playing. Adjust amplitude, duration and repeats in the Inspector.` };
      select(clipId); play(clipId);
      onStatus(`Motion "${clip.name}" added.`);
    } catch (error) { fail(error); }
  }

  /** The whole kit in one press: faces, motions, reactions and automatic life, one undo step. */
  function addStarterKit() {
    try { const report = starterKit.add(); notice = starterKitNotice(report); onStatus(notice.text); render(); }
    catch (error) { fail(error); }
  }

  const component = createComponent({
    host: listHost,
    onMount: ({ listen }) => {
      presetGroups = createPresetGroups(underLifecycle(listHost, listen));

      // The panel re-renders on every edit, so the disclosure remembers it is open.
      listen(listHost, 'toggle', (event) => {
        if (event.target.dataset.motionBlend !== undefined) blendOpen = event.target.open;
        if (event.target.dataset.motionComposeSection !== undefined) composeOpen = event.target.open;
      }, true);
      listen(listHost, 'input', (event) => {
        if (event.target.dataset.motionBlendDuration === undefined) return;
        const output = listHost.querySelector('[data-motion-blend-output]');
        if (output) output.value = Number(event.target.value) ? `${event.target.value} ms` : 'instant';
      });
      listen(listHost, 'change', (event) => {
        if (event.target.dataset.motionComposeControl !== undefined) { composeControl = event.target.value; render(); return; }
        if (event.target.dataset.motionComposeShape !== undefined) { composeShape = event.target.value; render(); return; }
        const { motionBlendDuration, motionBlendEasing } = event.target.dataset;
        const patch = motionBlendDuration !== undefined ? { duration: Number(event.target.value) } : motionBlendEasing !== undefined ? { easing: event.target.value } : null;
        if (!patch) return;
        // A range reports the same value through several change events; identical values author nothing.
        const current = motionBlend(doc());
        if (Object.entries(patch).every(([key, value]) => current[key] === value)) return;
        try { commands.setBlend(patch); notice = null; } catch (error) { fail(error); return; }
        render();
      });
      listen(listHost, 'click', (event) => {
        const button = event.target.closest('button'); if (!button || !listHost.contains(button)) return;
        if (button.dataset.motionSelect) { select(button.dataset.motionSelect); return; }
        if (button.dataset.motionPreset) { addPreset(button.dataset.motionPreset); return; }
        if (button.dataset.motionCompose !== undefined) { addPreset(composedMotionId(composeShape, composedControl())); return; }
        if (button.dataset.starterKitAdd !== undefined) { addStarterKit(); return; }
        if (button.dataset.motionFixMovements !== undefined) navigate({ task: 'face-setup', focus: 'face-movements' });
      });

      listen(inspectorHost, 'click', (event) => {
        const button = event.target.closest('button'); if (!button || !inspectorHost.contains(button)) return;
        const clip = active(); if (!clip) return;
        const data = button.dataset;
        if (data.motionPlay !== undefined) { play(clip.id); return; }
        if (data.motionStop !== undefined) { preview.stopMotion(); return; }
        if (data.motionOpenTimeline !== undefined) { openTimeline(clip.id); return; }
        // The question and its two answers are panel state, so they go through
        // the model like everything else the markup swings on.
        if (data.motionReset !== undefined) { confirmReset = clip.id; render(); return; }
        if (data.motionResetCancel !== undefined) { confirmReset = null; render(); return; }
        try {
          if (data.motionResetConfirm !== undefined) { confirmReset = null; commands.reset(clip.id); notice = null; onStatus(`"${clip.name}" rebuilt from its ${findClip(doc(), clip.id)?.motion?.preset || 'preset'} settings.`); if (preview.isPlaying()) play(clip.id); return; }
          if (data.motionDetach !== undefined) { commands.detach(clip.id); onStatus(`"${clip.name}" is now a custom animation edited in the Timeline.`); return; }
          if (data.motionDuplicate !== undefined) { const id = commands.duplicate(clip.id); notice = null; select(id); onStatus(`Motion "${findClip(doc(), id)?.name}" duplicated.`); }
          if (data.motionDelete !== undefined) { preview.stopMotion(); commands.remove(clip.id); notice = { tone: 'success', text: `✓ ${clip.name} deleted.` }; select(doc().animationClips[0]?.id || null); onStatus(`Motion "${clip.name}" deleted.`); }
        } catch (error) { fail(error); }
      });

      listen(inspectorHost, 'input', (event) => {
        const key = event.target.dataset.motionSetting; if (!key) return;
        const output = inspectorHost.querySelector(`[data-motion-output="${key}"]`);
        if (output) output.value = formatSetting(key, event.target.value);
      });

      listen(inspectorHost, 'change', (event) => {
        const clip = active(); if (!clip) return;
        const { motionRename, motionSetting, motionLoop } = event.target.dataset;
        try {
          if (motionRename !== undefined) { const name = event.target.value.trim(); if (name && name !== clip.name) { commands.rename(clip.id, name); onStatus(`Motion renamed to "${name}".`); } else render(); return; }
          if (motionSetting) {
            const value = Number(event.target.value);
            // Idempotent: a range/number input can report the same value through several change events.
            if (motionSetting === 'duration' ? clip.duration === value : clip.motion?.[motionSetting] === value) return;
            commands.updateSettings(clip.id, { [motionSetting]: value });
            if (preview.isPlaying()) play(clip.id);
            return;
          }
          if (motionLoop !== undefined && Boolean(clip.loop) !== event.target.checked) commands.setLoop(clip.id, event.target.checked);
        } catch (error) { fail(error); }
      });
    },
    // The component empties its own host. The Inspector is this panel's second
    // host, so it is cleared here, while the DOM is still there.
    onDestroy: () => { inspectorHost.innerHTML = ''; },
    render: (model) => { renderList(model); renderInspector(model); }
  });

  const noticeMarkup = (model) => model.noticeText
    ? `<p class="face-pick-notice" data-tone="${model.noticeTone}"><span>${esc(model.noticeText)}</span>${model.noticeFix ? '<button type="button" class="secondary" data-motion-fix-movements>Face Setup</button>' : ''}</p>`
    : '';

  /**
   * How long one motion takes to become another. The shared motion layer reads
   * it in the preview and in the exported mascot, so this is the one place that
   * decides whether motions hand over or cut (docs/ADR_MOTION_LAYERING.md).
   */
  function blendMarkup(model) {
    if (!model.clipCount) return '';
    const curve = [['linear', 'Linear'], ['easeIn', 'Ease In'], ['easeOut', 'Ease Out'], ['easeInOut', 'Ease In Out']];
    const spoken = model.blendDuration ? `${model.blendDuration} ms` : 'instant';
    return `<details class="expression-blend" data-motion-blend data-blend-duration="${model.blendDuration}" ${model.blendOpen ? 'open' : ''}><summary>Switching between motions<small>${spoken}</small></summary>
      <label>Cross-fade <output data-motion-blend-output>${spoken}</output><input type="range" data-motion-blend-duration aria-label="Cross-fade between motions in milliseconds" min="0" max="800" step="20" value="${model.blendDuration}"></label>
      <label>Curve <select data-motion-blend-easing aria-label="Cross-fade curve">${curve.map(([value, label]) => `<option value="${value}" ${model.blendEasing === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <p class="small">Playing a motion fades out whatever is playing over this long, and a motion that reaches its end fades instead of cutting. 0 ms cuts. Applies in Preview and in the exported mascot; the Timeline below always shows the clip you are editing at full strength.</p></details>`;
  }

  /**
   * Make your own (VNX-27): any movement the mascot has, given a shape.
   *
   * The ready-made catalogue is head, eyes and face — a mascot that wiggles its
   * ears or has a hand pose its author invented finds nothing in it, and had to
   * go to the Timeline key by key. This is the same compiler with the two
   * halves chosen instead of looked up, and it is `more`, not `basic`: an
   * author who has not run out of ready-made motions should not have to read a
   * second way of making one.
   */
  function composeMarkup(model) {
    if (!model.movementCount) return '';
    const option = (value, label, selected) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
    const movements = view.movements.map((entry) =>
      `<optgroup label="${esc(entry.group)}">${entry.movements.map((item) => option(item.id, item.label, model.composeControl)).join('')}</optgroup>`).join('');
    const shapes = MOTION_SHAPES.map((form) => option(form.id, form.name, model.composeShape)).join('');
    const chosen = MOTION_SHAPES.find((form) => form.id === model.composeShape) || MOTION_SHAPES[0];
    return `<details class="motion-compose" data-motion-compose-section ${model.composeOpen ? 'open' : ''}><summary>Make your own<small>any movement, one shape</small></summary>
      <div class="motion-compose-row">
        <label>Movement <select data-motion-compose-control aria-label="Movement to animate">${movements}</select></label>
        <label>Shape <select data-motion-compose-shape aria-label="Shape of the movement">${shapes}</select></label>
        <button type="button" data-motion-compose aria-label="Add this motion">Add</button>
      </div>
      <p class="small" data-motion-compose-hint>${esc(chosen.description)} Amplitude, duration and repeats are yours to set afterwards, like any other motion.</p></details>`;
  }

  function renderList(model) {
    listHost.dataset.motionsReady = 'true';
    listHost.dataset.motionsCount = String(model.clipCount);
    if (!model.hasArtwork) { listHost.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; return; }
    const card = (preset) => `<article class="preset-card" data-motion-preset-card="${preset.id}" data-preset-usable="${preset.usable}" data-preset-missing="${preset.missing.length}"><div><b>${esc(preset.name)}</b><small>${esc(preset.description)}</small><small class="${preset.usable ? '' : 'preset-missing'}">${preset.usable ? `Uses ${Object.values(preset.controls).map((name) => esc(controlLabel(name))).join(', ')}` : `Needs ${preset.missing.map((item) => esc(item.label)).join(', ')}`}</small></div><button type="button" data-motion-preset="${preset.id}" aria-label="Add ${esc(preset.name)} motion" ${preset.usable ? '' : 'disabled'} title="${preset.usable ? 'Adds this motion with your movements' : 'Turn on the movement in Face Setup first'}">Add</button></article>`;
    const cards = presetGroups(view.groups, card, { className: 'motion-presets' });
    const gate = model.anyPresetUsable ? '' : '<p class="face-pick-notice" data-tone="warn"><span>Turn on a head movement in Face Setup: motions are made of movements.</span><button type="button" class="secondary" data-motion-fix-movements>Face Setup</button></p>';
    const items = view.summaries.map((summary) => `<li><button type="button" class="expression-item motion-item" data-motion-select="${esc(summary.id)}" data-motion-kind="${summary.kind}" aria-pressed="${summary.id === model.activeId}"><span>${esc(summary.name)}<span class="motion-badge" data-motion-badge="${summary.kind}">${BADGES[summary.kind]}</span></span><small>${esc(summaryLine(summary))}</small></button></li>`).join('');
    setPanelHtml(listHost, `<div role="status" aria-live="polite">${noticeMarkup(model)}</div>${gate}${starterKitMarkup(view.plan)}<section class="preset-catalogue" data-preset-catalogue="motions"><h3>Ready-made motions</h3>${cards}</section>${composeMarkup(model)}${blendMarkup(model)}${model.clipCount ? `<ol class="expression-list" aria-label="Motions">${items}</ol>` : '<p class="expression-empty">No motions yet. Add a preset above: a motion is a short movement over time (nod, shake…) that you can test here and play in Preview.</p>'}`);
  }

  function renderInspector(model) {
    if (!model.clipId) { inspectorHost.innerHTML = ''; delete inspectorHost.dataset.motionId; delete inspectorHost.dataset.motionKind; return; }
    const summary = view.summary, limits = MOTION_SETTING_LIMITS;
    inspectorHost.dataset.motionId = model.clipId;
    inspectorHost.dataset.motionKind = model.clipKind;
    const field = (key, type, label) => `<label>${label} <output data-motion-output="${key}">${formatSetting(key, summary[key])}</output><input type="${type}" data-motion-setting="${key}" aria-label="${label}" min="${limits[key].min}" max="${limits[key].max}" step="${limits[key].step}" value="${summary[key]}"></label>`;
    const settings = model.clipKind === 'simple' ? `<div class="motion-settings">${field('amplitude', 'range', 'Amplitude')}${field('duration', 'number', 'Duration in seconds')}${field('repeats', 'number', 'Repeats')}</div>` : '';
    const transition = model.clipKind !== 'edited' ? '' : model.confirming
      ? `<div class="motion-transition" data-motion-status="edited" role="alertdialog" aria-label="Reset ${esc(summary.name)} to its preset"><span>Discard the key edits and rebuild “${esc(summary.name)}” from its ${esc(summary.presetName)} settings?</span><div><button type="button" class="danger" data-motion-reset-confirm>Reset to preset</button><button type="button" class="secondary" data-motion-reset-cancel>Cancel</button></div></div>`
      : `<div class="motion-transition" data-motion-status="edited"><span>Edited in the Timeline: the ${esc(summary.presetName)} settings no longer drive this animation.</span><div><button type="button" class="secondary" data-motion-reset>Reset to preset</button><button type="button" class="secondary" data-motion-detach>Keep as custom</button></div><span>Or keep editing its keys below; Undo also brings the preset back.</span></div>`;
    const status = model.clipKind === 'simple' ? `<p class="small" data-motion-status="simple">${esc(summary.presetName)} preset · ${summary.controls.map((name) => esc(controlLabel(name))).join(', ')}</p>`
      : model.clipKind === 'edited' ? transition
        : `<p class="small" data-motion-status="custom">Custom animation · ${plural(summary.tracks, 'track')} · ${plural(summary.keys, 'key')}. Edit it key by key in the Timeline below.</p>`;
    const hint = model.clipKind === 'simple' ? '<p class="motion-hint">Open in Timeline to see the keys. Editing them there turns this into a custom animation (you can undo or reset).</p>' : '';
    inspectorHost.innerHTML = `<label>Motion name<input data-motion-rename aria-label="Motion name" value="${esc(summary.name)}"></label>${status}${settings}<label class="check motion-loop"><input type="checkbox" data-motion-loop aria-label="Loop motion" ${summary.loop ? 'checked' : ''}>Loop</label><p class="small">${summary.duration} s · id <code>${esc(summary.id)}</code></p>${hint}
      <div class="expression-actions"><button type="button" data-motion-play aria-label="Test ${esc(summary.name)}">▶ Test</button><button type="button" class="secondary" data-motion-stop aria-label="Stop test">■ Stop</button><button type="button" class="secondary" data-motion-open-timeline ${model.canOpenTimeline ? '' : 'disabled title="The Timeline needs a tablet or desktop; presets still work here."'}>Open in Timeline</button><button type="button" class="secondary" data-motion-duplicate aria-label="Duplicate motion">Duplicate</button><button type="button" class="danger secondary" data-motion-delete aria-label="Delete motion">Delete</button></div>`;
  }

  /** Every object the two markups read, derived once per render. */
  function derive() {
    const state = doc(), clips = state.animationClips || [], clip = active();
    return {
      hasArtwork: Boolean(state.svgMarkup), clips,
      summaries: clips.map((item) => motionSummary(state, item)),
      groups: motionAvailabilityGroups(state),
      movements: composableMovements(state),
      usable: motionAvailability(state).some((preset) => preset.usable),
      plan: starterKit.plan(), blend: motionBlend(state),
      clip, summary: clip ? motionSummary(state, clip) : null
    };
  }

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * `notice`, `confirming` and `canOpenTimeline` are not project data, and all
   * three are here for the same reason the guide bar's `expanded` is: the
   * markup swings on them, so a model without them is a panel that redraws
   * them away.
   */
  const model = () => ({
    hasArtwork: view.hasArtwork,
    clipCount: view.clips.length,            // the count attribute, the empty line, and whether there is a cross-fade to set
    activeId: activeId() || '',              // aria-pressed in the list; a stale id simply matches nothing
    clipId: view.clip?.id || '',             // what the Inspector is on, which is not the same question
    clipKind: view.summary?.kind || '',      // written to the host, and it picks the whole status block
    confirming: view.clip ? confirmReset === view.clip.id : false,
    canOpenTimeline: Boolean(canOpenTimeline()),  // the layout, not the store: `__boopLayoutChanged` renders for this
    anyPresetUsable: view.usable,
    blendOpen,
    blendDuration: view.blend.duration,
    blendEasing: view.blend.easing,
    noticeTone: notice?.tone || '',
    noticeText: notice?.text || '',
    noticeFix: Boolean(notice?.fix),
    composeControl: composedControl(),
    composeShape,
    composeOpen,
    movementCount: view.movements.reduce((total, entry) => total + entry.movements.length, 0),
    movements: view.movements.flatMap((entry) => [entry.group, ...entry.movements.map((item) => item.id)]).join(SEP),
    starterKit: kitSignature(view.plan),
    presets: presetSignature(view.groups),
    clips: clipSignature(view.summaries)
  });

  function render() {
    const state = doc(), kinds = new Map((state.animationClips || []).map((clip) => [clip.id, motionSummary(state, clip)]));
    for (const [id, summary] of kinds) if (lastKinds.get(id) === 'simple' && summary.kind === 'edited') onStatus(`"${summary.name}" is now edited by hand: its ${summary.presetName} settings no longer apply. Undo, Reset to preset, or keep it custom.`, 'warn');
    lastKinds = new Map([...kinds].map(([id, summary]) => [id, summary.kind]));
    // A confirmation belongs to the clip it was asked about; selecting another
    // one drops the question rather than carrying it over.
    if (confirmReset && confirmReset !== activeId()) confirmReset = null;
    view = derive();
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return {
    render,
    snapshot() { const state = doc(); return { activeId: activeId(), motions: (state.animationClips || []).map((clip) => motionSummary(state, clip)) }; },
    destroy: () => component.destroy(),
    counters: () => component.counters()
  };
}
