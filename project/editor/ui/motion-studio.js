import { createMotionCommands } from '../core/motion/motion-commands.js';
import { findClip, motionSummary } from '../core/motion/motion-model.js';
import { MOTION_SETTING_LIMITS, motionAvailability } from '../core/motion/motion-presets.js';
import { controlMeta } from './control-catalog.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const controlLabel = (name) => { const meta = controlMeta(name); return `${meta.group} · ${meta.label}`; };
const formatSetting = (key, value) => key === 'amplitude' ? `${Math.round(Number(value) * 100)}%` : key === 'duration' ? `${Number(value)} s` : `×${Number(value)}`;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const summaryLine = (summary) => summary.kind === 'simple' ? `${summary.presetName} · ${summary.duration} s${summary.repeats > 1 ? ` · ×${summary.repeats}` : ''}${summary.loop ? ' · loop' : ''}`
  : summary.kind === 'edited' ? `${summary.presetName} · ${plural(summary.keys, 'key')}` : `${plural(summary.tracks, 'track')} · ${plural(summary.keys, 'key')}`;
const BADGES = { simple: 'Preset', edited: 'Edited', custom: 'Timeline' };

/**
 * Motion Studio: the simple entry to Animate. Presets compile to ordinary
 * animation clips (ProjectDocument.animationClips, `animation` domain) through
 * motion commands; the active clip lives in EditorSession.animationEditor and
 * playback is preview-only. The Timeline below stays the key-by-key editor.
 */
export function createMotionStudio({ listHost, inspectorHost, store, history, preview, editorContext, onStatus = () => {}, navigate = () => {}, openTimeline = () => {}, canOpenTimeline = () => true }) {
  const commands = createMotionCommands(store, history);
  let notice = null, confirmReset = null;
  // Kind per clip id from the previous render: a simple motion whose keys were
  // just edited in the Timeline gets one explicit conversion notice.
  let lastKinds = new Map();
  const doc = () => store.getDocument();
  const activeId = () => editorContext.get().animationEditor?.activeClipId || null;
  const active = () => findClip(doc(), activeId());
  const select = (id) => {
    editorContext.update({ animationEditor: { ...editorContext.get().animationEditor, activeClipId: id || null, playhead: 0 }, activeStateId: null, selectedTrackParameter: null, selectedKey: null });
    if (preview.getActiveClipId() !== (id || null)) preview.setClip(id || null);
    render();
  };
  const play = (id) => { if (!id) return; preview.setClip(id); preview.stopClip(); preview.playClip(); };
  const fail = (error) => { notice = { tone: 'warn', text: error.message, fix: /Face Setup/.test(error.message) }; render(); };

  function addPreset(id) {
    try {
      const clipId = commands.createFromPreset(id), clip = findClip(doc(), clipId);
      notice = { tone: 'success', text: `✓ ${clip.name} added and playing. Adjust amplitude, duration and repeats in the Inspector.` };
      select(clipId); play(clipId);
      onStatus(`Motion "${clip.name}" added.`);
    } catch (error) { fail(error); }
  }

  listHost.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !listHost.contains(button)) return;
    if (button.dataset.motionSelect) { select(button.dataset.motionSelect); return; }
    if (button.dataset.motionPreset) { addPreset(button.dataset.motionPreset); return; }
    if (button.dataset.motionFixMovements !== undefined) navigate({ task: 'face-setup', focus: 'face-movements' });
  });

  inspectorHost.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !inspectorHost.contains(button)) return;
    const clip = active(); if (!clip) return;
    const data = button.dataset;
    if (data.motionPlay !== undefined) { play(clip.id); return; }
    if (data.motionStop !== undefined) { preview.stopClip(); return; }
    if (data.motionOpenTimeline !== undefined) { openTimeline(clip.id); return; }
    if (data.motionReset !== undefined) { confirmReset = clip.id; renderInspector(); return; }
    if (data.motionResetCancel !== undefined) { confirmReset = null; renderInspector(); return; }
    try {
      if (data.motionResetConfirm !== undefined) { confirmReset = null; commands.reset(clip.id); notice = null; onStatus(`"${clip.name}" rebuilt from its ${findClip(doc(), clip.id)?.motion?.preset || 'preset'} settings.`); if (preview.isPlaying()) play(clip.id); return; }
      if (data.motionDetach !== undefined) { commands.detach(clip.id); onStatus(`"${clip.name}" is now a custom animation edited in the Timeline.`); return; }
      if (data.motionDuplicate !== undefined) { const id = commands.duplicate(clip.id); notice = null; select(id); onStatus(`Motion "${findClip(doc(), id)?.name}" duplicated.`); }
      if (data.motionDelete !== undefined) { preview.stopClip(); commands.remove(clip.id); notice = { tone: 'success', text: `✓ ${clip.name} deleted.` }; select(doc().animationClips[0]?.id || null); onStatus(`Motion "${clip.name}" deleted.`); }
    } catch (error) { fail(error); }
  });

  inspectorHost.addEventListener('input', (event) => {
    const key = event.target.dataset.motionSetting; if (!key) return;
    const output = inspectorHost.querySelector(`[data-motion-output="${key}"]`);
    if (output) output.value = formatSetting(key, event.target.value);
  });

  inspectorHost.addEventListener('change', (event) => {
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

  function renderList() {
    const state = doc(), clips = state.animationClips || [], current = activeId();
    listHost.dataset.motionsReady = 'true';
    listHost.dataset.motionsCount = String(clips.length);
    if (!state.svgMarkup) { listHost.innerHTML = '<p class="small">Add artwork first: import an SVG or start from a template.</p>'; return; }
    const presets = motionAvailability(state);
    const cards = presets.map((preset) => `<article class="preset-card" data-motion-preset-card="${preset.id}" data-preset-usable="${preset.usable}" data-preset-missing="${preset.missing.length}"><div><b>${esc(preset.name)}</b><small>${esc(preset.description)}</small><small class="${preset.usable ? '' : 'preset-missing'}">${preset.usable ? `Uses ${Object.values(preset.controls).map((name) => esc(controlLabel(name))).join(', ')}` : `Needs ${preset.missing.map((item) => esc(item.label)).join(', ')}`}</small></div><button type="button" data-motion-preset="${preset.id}" aria-label="Add ${esc(preset.name)} motion" ${preset.usable ? '' : 'disabled'} title="${preset.usable ? 'Adds this motion with your movements' : 'Turn on the movement in Face Setup first'}">Add</button></article>`).join('');
    const gate = presets.some((preset) => preset.usable) ? '' : '<p class="face-pick-notice" data-tone="warn"><span>Turn on a head movement in Face Setup: motions are made of movements.</span><button type="button" class="secondary" data-motion-fix-movements>Face Setup</button></p>';
    const items = clips.map((clip) => { const summary = motionSummary(state, clip); return `<li><button type="button" class="expression-item motion-item" data-motion-select="${esc(clip.id)}" data-motion-kind="${summary.kind}" aria-pressed="${clip.id === current}"><span>${esc(clip.name)}<span class="motion-badge" data-motion-badge="${summary.kind}">${BADGES[summary.kind]}</span></span><small>${esc(summaryLine(summary))}</small></button></li>`; }).join('');
    listHost.innerHTML = `<div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}"><span>${esc(notice.text)}</span>${notice.fix ? '<button type="button" class="secondary" data-motion-fix-movements>Face Setup</button>' : ''}</p>` : ''}</div>${gate}<details class="motion-presets" open><summary>Presets</summary><div class="preset-cards">${cards}</div></details>${clips.length ? `<ol class="expression-list" aria-label="Motions">${items}</ol>` : '<p class="expression-empty">No motions yet. Add a preset above: a motion is a short movement over time (nod, shake…) that you can test here and play in Preview.</p>'}`;
  }

  function renderInspector() {
    const clip = active();
    if (!clip) { inspectorHost.innerHTML = ''; delete inspectorHost.dataset.motionId; delete inspectorHost.dataset.motionKind; return; }
    const summary = motionSummary(doc(), clip), limits = MOTION_SETTING_LIMITS;
    inspectorHost.dataset.motionId = clip.id;
    inspectorHost.dataset.motionKind = summary.kind;
    const field = (key, type, label) => `<label>${label} <output data-motion-output="${key}">${formatSetting(key, summary[key])}</output><input type="${type}" data-motion-setting="${key}" aria-label="${label}" min="${limits[key].min}" max="${limits[key].max}" step="${limits[key].step}" value="${summary[key]}"></label>`;
    const settings = summary.kind === 'simple' ? `<div class="motion-settings">${field('amplitude', 'range', 'Amplitude')}${field('duration', 'number', 'Duration in seconds')}${field('repeats', 'number', 'Repeats')}</div>` : '';
    if (confirmReset && confirmReset !== clip.id) confirmReset = null;
    const transition = summary.kind !== 'edited' ? '' : confirmReset === clip.id
      ? `<div class="motion-transition" data-motion-status="edited" role="alertdialog" aria-label="Reset ${esc(clip.name)} to its preset"><span>Discard the key edits and rebuild “${esc(clip.name)}” from its ${esc(summary.presetName)} settings?</span><div><button type="button" class="danger" data-motion-reset-confirm>Reset to preset</button><button type="button" class="secondary" data-motion-reset-cancel>Cancel</button></div></div>`
      : `<div class="motion-transition" data-motion-status="edited"><span>Edited in the Timeline: the ${esc(summary.presetName)} settings no longer drive this animation.</span><div><button type="button" class="secondary" data-motion-reset>Reset to preset</button><button type="button" class="secondary" data-motion-detach>Keep as custom</button></div><span>Or keep editing its keys below; Undo also brings the preset back.</span></div>`;
    const status = summary.kind === 'simple' ? `<p class="small" data-motion-status="simple">${esc(summary.presetName)} preset · ${summary.controls.map((name) => esc(controlLabel(name))).join(', ')}</p>`
      : summary.kind === 'edited' ? transition
        : `<p class="small" data-motion-status="custom">Custom animation · ${plural(summary.tracks, 'track')} · ${plural(summary.keys, 'key')}. Edit it key by key in the Timeline below.</p>`;
    const hint = summary.kind === 'simple' ? '<p class="motion-hint">Open in Timeline to see the keys. Editing them there turns this into a custom animation (you can undo or reset).</p>' : '';
    inspectorHost.innerHTML = `<label>Motion name<input data-motion-rename aria-label="Motion name" value="${esc(clip.name)}"></label>${status}${settings}<label class="check motion-loop"><input type="checkbox" data-motion-loop aria-label="Loop motion" ${clip.loop ? 'checked' : ''}>Loop</label><p class="small">${summary.duration} s · id <code>${esc(clip.id)}</code></p>${hint}
      <div class="expression-actions"><button type="button" data-motion-play aria-label="Test ${esc(clip.name)}">▶ Test</button><button type="button" class="secondary" data-motion-stop aria-label="Stop test">■ Stop</button><button type="button" class="secondary" data-motion-open-timeline ${canOpenTimeline() ? '' : 'disabled title="The Timeline needs a tablet or desktop; presets still work here."'}>Open in Timeline</button><button type="button" class="secondary" data-motion-duplicate aria-label="Duplicate motion">Duplicate</button><button type="button" class="danger secondary" data-motion-delete aria-label="Delete motion">Delete</button></div>`;
  }

  function render() {
    const state = doc(), kinds = new Map((state.animationClips || []).map((clip) => [clip.id, motionSummary(state, clip)]));
    for (const [id, summary] of kinds) if (lastKinds.get(id) === 'simple' && summary.kind === 'edited') onStatus(`"${summary.name}" is now edited by hand: its ${summary.presetName} settings no longer apply. Undo, Reset to preset, or keep it custom.`, 'warn');
    lastKinds = new Map([...kinds].map(([id, summary]) => [id, summary.kind]));
    renderList(); renderInspector();
  }
  return {
    render,
    snapshot() { const state = doc(); return { activeId: activeId(), motions: (state.animationClips || []).map((clip) => motionSummary(state, clip)) }; }
  };
}
