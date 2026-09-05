import { triggerLabel } from '../core/reactions/reaction-model.js';
import { deriveMovementChecklist } from '../rig-editor/semantic-parts/face-movements.js';
import { normalizeBehaviors } from '../../runtime/runtime.js';
import { padFrame } from './pad-frame.js';
import { activePartPose, partPoseGroups } from '../core/puppet/part-poses.js';
import { poseChipRow } from './pose-chips.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const behaviorKey = (behavior, index) => behavior?.id || `behavior-${index}`;
const PADS = [
  ['lookX', 'lookY', 'Where it looks', { x: ['left', 'right'], y: ['up', 'down'] }],
  ['headX', 'headY', 'Where the head turns', { x: ['left', 'right'], y: ['up', 'down'] }]
];

/**
 * Preview test bench (right panel in Preview). Everything here is transient:
 * live params, pose/clip playback and behavior overrides live in the
 * PreviewController session; readiness rows only navigate.
 */
/**
 * `onCommit` is called once per finished gesture with everything it moved
 * (VNX-35). Posing the mascot here *is* animating it when Auto Key is on, and
 * the test bench was the surface where that silently was not true: the canvas
 * handles and the rig panel keyed, these pads and sliders did not.
 */
export function createPreviewPanel(host, store, preview, { navigate = () => {}, readiness = () => null, onCommit = () => {} } = {}) {
  const doc = () => store.getDocument();
  // The number field and the slider are two ends of one control: whichever the
  // author is using keeps its own text, the other follows.
  const setOutput = (name, value) => {
    const number = host.querySelector(`[data-preview-output="${CSS.escape(name)}"]`);
    if (number && document.activeElement !== number) number.value = Number(value).toFixed(2);
    const slider = host.querySelector(`[data-preview-control="${CSS.escape(name)}"]`);
    if (slider && document.activeElement !== slider) slider.value = String(value);
  };
  // A pad is a square; a parameter has its own range. Map between them rather
  // than assuming -1..1, so an imported rig cannot be driven out of bounds.
  const range = (name) => { const param = doc().params?.[name]; const min = Number.isFinite(Number(param?.min)) ? Number(param.min) : -1, max = Number.isFinite(Number(param?.max)) ? Number(param.max) : 1; return max > min ? { min, max } : { min: -1, max: 1 }; };
  const toValue = (name, unit) => { const { min, max } = range(name); return min + ((Math.max(-1, Math.min(1, unit)) + 1) / 2) * (max - min); };
  const toUnit = (name, value) => { const { min, max } = range(name); return Math.max(-1, Math.min(1, ((Number(value) - min) / (max - min)) * 2 - 1)); };
  const padValue = (name) => { const live = preview.getLiveParams(); return name in live ? live[name] : (doc().params?.[name]?.default ?? 0); };
  const applyPad = (pad, event) => {
    const [xName, yName] = pad.dataset.previewXy.split(':'), box = pad.getBoundingClientRect(), clamp = (v) => Math.max(-1, Math.min(1, v));
    const ux = clamp(((event.clientX - box.left) / box.width) * 2 - 1), uy = clamp(((event.clientY - box.top) / box.height) * 2 - 1);
    const x = toValue(xName, ux), y = toValue(yName, uy);
    preview.setLiveParam(xName, x); preview.setLiveParam(yName, y);
    pad.style.setProperty('--x', `${(ux + 1) * 50}%`); pad.style.setProperty('--y', `${(uy + 1) * 50}%`);
    setOutput(xName, x); setOutput(yName, y);
  };
  let padActive = null, customDraft = '';
  host.addEventListener('submit', (event) => { if (event.target.dataset.previewEventForm === undefined) return; event.preventDefault(); const name = host.querySelector('[data-preview-event-name]')?.value.trim(); if (!name) return; customDraft = name; preview.triggerReaction({ type: 'custom', name }); render(); });
  host.addEventListener('input', (event) => { if (event.target.dataset.previewEventName !== undefined) customDraft = event.target.value; });
  host.addEventListener('pointerdown', (event) => { const pad = event.target.closest('[data-preview-xy]'); if (!pad || event.button !== 0) return; event.preventDefault(); pad.setPointerCapture(event.pointerId); padActive = pad; applyPad(pad, event); });
  host.addEventListener('pointermove', (event) => { if (padActive && padActive.hasPointerCapture(event.pointerId)) applyPad(padActive, event); });
  host.addEventListener('pointerup', (event) => {
    if (!padActive) return;
    const [xName, yName] = padActive.dataset.previewXy.split(':');
    padActive.releasePointerCapture?.(event.pointerId);
    padActive = null;
    // One key per axis at the end of the drag, never one per pointermove.
    onCommit({ [xName]: padValue(xName), [yName]: padValue(yName) });
  });
  host.addEventListener('keydown', (event) => {
    const pad = event.target.closest?.('[data-preview-xy]'); if (!pad) return;
    const step = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[event.key]; if (!step) return;
    event.preventDefault();
    const [xName, yName] = pad.dataset.previewXy.split(':'), fine = event.shiftKey ? .2 : 1;
    preview.setLiveParam(xName, toValue(xName, toUnit(xName, padValue(xName)) + step[0] * fine));
    preview.setLiveParam(yName, toValue(yName, toUnit(yName, padValue(yName)) + step[1] * fine));
    onCommit({ [xName]: padValue(xName), [yName]: padValue(yName) });
    render(); host.querySelector(`[data-preview-xy="${pad.dataset.previewXy}"]`)?.focus();
  });
  host.addEventListener('input', (event) => {
    const name = event.target.dataset.previewControl || event.target.dataset.previewOutput;
    if (!name || !Number.isFinite(Number(event.target.value))) return;
    const { min, max } = range(name), value = Math.max(min, Math.min(max, Number(event.target.value)));
    preview.setLiveParam(name, value); setOutput(name, value); syncPads();
  });
  host.addEventListener('change', (event) => {
    // A slider or a number field: `input` drives the preview live, `change` is
    // the author letting go, which is the moment a key belongs at.
    const control = event.target.dataset.previewControl || event.target.dataset.previewOutput;
    if (control && Number.isFinite(Number(event.target.value))) { onCommit({ [control]: padValue(control) }); return; }
    const key = event.target.dataset.previewBehavior; if (key === undefined) return;
    preview.setBehaviorOverride(key, event.target.checked); render();
  });
  host.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
    const { previewState, previewClip, previewGo } = button.dataset;
    if (previewState) { if (!preview.setState(previewState)) preview.previewState(previewState); render(); return; }
    if (previewClip) { if (preview.isPlaying() && preview.getActiveClipId() === previewClip) preview.stopMotion(); else preview.playMotion(previewClip); render(); return; }
    if (button.dataset.poseChip) {
      const [part, id] = button.dataset.poseChip.split(':');
      const pose = partPoseGroups(doc()).find((group) => group.part === part)?.poses.find((item) => item.id === id);
      if (pose) { for (const [name, value] of Object.entries(pose.controls)) preview.setLiveParam(name, value); onCommit({ ...pose.controls }); syncPads(); render(); }
      return;
    }
    if (button.dataset.previewReaction) { preview.fireReaction(button.dataset.previewReaction); render(); return; }
    if (button.dataset.previewEvent) { preview.triggerReaction({ type: button.dataset.previewEvent }); render(); return; }
    if (button.dataset.previewLogClear !== undefined) { preview.clearEventLog(); render(); return; }
    if (previewGo) { const model = readiness(); const target = model?.[previewGo]; if (target?.route) navigate(target.route); return; }
    if (button.dataset.previewExpression) { const id = button.dataset.previewExpression, weights = preview.getExpressionWeights(); if (weights[id]) preview.clearExpression(id); else preview.setExpression(id, Number(host.querySelector('[data-preview-intensity]')?.value ?? 1)); render(); return; }
    if (button.dataset.previewExpressionClear !== undefined) { preview.clearExpressions(); render(); }
  });
  host.addEventListener('input', (event) => { if (event.target.dataset.previewIntensity === undefined) return; const value = Number(event.target.value); for (const id of Object.keys(preview.getExpressionWeights())) preview.setExpression(id, value); const output = host.querySelector('[data-preview-intensity-output]'); if (output) output.value = `${Math.round(value * 100)}%`; });
  function syncPads() { for (const pad of host.querySelectorAll('[data-preview-xy]')) { const [x, y] = pad.dataset.previewXy.split(':'); pad.style.setProperty('--x', `${(toUnit(x, padValue(x)) + 1) * 50}%`); pad.style.setProperty('--y', `${(toUnit(y, padValue(y)) + 1) * 50}%`); } }

  function render() {
    const state = doc();
    host.dataset.previewPanelReady = 'true';
    if (!state.svgMarkup) { host.innerHTML = '<p class="small">Add artwork to test a mascot here.</p>'; return; }
    const live = preview.getLiveParams(), moves = deriveMovementChecklist(state), enabled = moves.items.filter((item) => item.enabled);
    const pads = PADS.filter(([x, y]) => enabled.some((item) => item.id === x) && enabled.some((item) => item.id === y)).map(([x, y, label, axes]) => padFrame({
      label, hint: 'drag to test', x: axes.x, y: axes.y,
      pad: `<div class="xy-pad" data-preview-xy="${x}:${y}" role="application" tabindex="0" aria-label="${esc(label)} test pad. Use arrow keys or drag." style="--x:${(toUnit(x, padValue(x)) + 1) * 50}%;--y:${(toUnit(y, padValue(y)) + 1) * 50}%"><i></i></div>`
    })).join('');
    // One press per named place on a part's movements, before the sliders that
    // reach everywhere in between.
    const poseRows = partPoseGroups(state).map((group) => {
      const current = activePartPose(group.poses, live);
      return poseChipRow({
        label: group.label, group: group.part,
        poses: group.poses.map((pose) => ({ id: pose.id, name: pose.name, active: pose.id === current }))
      });
    }).join('');
    const sliders = enabled.map((item) => { const param = state.params[item.id], value = live[item.id] ?? param?.default ?? 0; return `<label class="preview-control">${esc(item.group)} · ${esc(item.label)} <input type="number" data-preview-output="${item.id}" aria-label="${esc(item.group)} ${esc(item.label)} value" min="${param?.min ?? -1}" max="${param?.max ?? 1}" step=".01" value="${Number(value).toFixed(2)}"><input type="range" data-preview-control="${item.id}" aria-label="${esc(item.group)} ${esc(item.label)}" min="${param?.min ?? -1}" max="${param?.max ?? 1}" step=".01" value="${value}"></label>`; }).join('');
    const weights = preview.getExpressionWeights(), intensity = Object.values(weights)[0] ?? 1;
    const expressions = (state.expressions || []).length ? `<section class="preview-section" data-preview-section="expressions"><h3>Expressions</h3><div class="chip-row"><button type="button" class="chip${Object.keys(weights).length ? '' : ' chip-active'}" data-preview-expression-clear aria-pressed="${!Object.keys(weights).length}">None</button>${state.expressions.map((item) => `<button type="button" class="chip${weights[item.id] ? ' chip-active' : ''}" data-preview-expression="${esc(item.id)}" aria-pressed="${Boolean(weights[item.id])}">${esc(item.name)}</button>`).join('')}</div><label>Intensity <output data-preview-intensity-output>${Math.round(intensity * 100)}%</output><input type="range" data-preview-intensity aria-label="Expression intensity" min="0" max="1" step=".05" value="${intensity}"></label></section>` : '';
    const activeReaction = preview.getActiveReaction?.()?.id || null, log = preview.getEventLog?.() || [];
    const describeLog = (entry) => { const what = entry.type === 'custom' ? `"${entry.name}"` : entry.type === 'test' ? `Test ${entry.reactionName}` : entry.type; const outcome = entry.outcome === 'fired' ? `→ ${entry.reactionName || entry.reactionId} fired` : entry.outcome === 'blocked' ? `→ blocked${entry.blockedBy ? ` by ${entry.blockedBy}` : ''}` : entry.outcome === 'disabled' ? '→ disabled' : '→ no reaction listens'; return `${Number(entry.at).toFixed(1)} s · ${what} ${outcome}`; };
    const simulator = `<div class="event-simulator" data-preview-events><p class="small">Trigger an event</p><div class="chip-row"><button type="button" class="chip" data-preview-event="click">Click</button><button type="button" class="chip" data-preview-event="hover">Hover</button><form class="event-custom" data-preview-event-form><input type="text" data-preview-event-name aria-label="Custom event name" placeholder="custom event" value="${esc(customDraft)}"><button type="submit" class="chip">Fire</button></form></div><ol class="event-log" data-preview-event-log aria-label="Event log">${log.length ? log.map((entry) => `<li data-log-outcome="${esc(entry.outcome)}">${esc(describeLog(entry))}</li>`).join('') : '<li class="small" data-log-empty>No events yet. Click the mascot or trigger an event.</li>'}</ol>${log.length ? '<button type="button" class="secondary" data-preview-log-clear>Clear log</button>' : ''}</div>`;
    const reactions = state.svgMarkup ? `<section class="preview-section" data-preview-section="reactions"><h3>Reactions</h3>${(state.reactions || []).length ? `<p class="small">Click the mascot to trigger its click reactions, or fire one here.</p><div class="chip-row">${state.reactions.map((item) => `<button type="button" class="chip${activeReaction === item.id ? ' chip-active' : ''}" data-preview-reaction="${esc(item.id)}" aria-pressed="${activeReaction === item.id}" title="${esc(triggerLabel(item.trigger))}"${item.enabled === false ? ' disabled' : ''}>⚡ ${esc(item.name)}</button>`).join('')}</div>` : '<p class="small">No reactions yet. <button type="button" class="secondary" data-preview-go="reactions">Create one</button></p>'}${simulator}</section>` : '';
    const stateNames = Object.keys(state.states || {}), activeState = preview.getSession().previewState || state.activeState;
    const poses = stateNames.length > 1 ? `<section class="preview-section" data-preview-section="poses"><h3>Poses</h3><div class="chip-row">${stateNames.map((name) => `<button type="button" class="chip${name === activeState ? ' chip-active' : ''}" data-preview-state="${esc(name)}" aria-pressed="${name === activeState}">${esc(name)}</button>`).join('')}</div></section>` : '';
    const clips = state.animationClips || [], playing = preview.isPlaying() ? preview.getActiveClipId() : null;
    const animations = clips.length ? `<section class="preview-section" data-preview-section="animations"><h3>Animations</h3><div class="preview-example-list">${clips.map((clip) => `<button type="button" data-preview-clip="${esc(clip.id)}" aria-pressed="${playing === clip.id}" class="${playing === clip.id ? 'chip-active' : ''}">${playing === clip.id ? '■' : '▶'} ${esc(clip.name)}</button>`).join('')}</div></section>` : '';
    const behaviors = normalizeBehaviors(state), overrides = preview.getBehaviorOverrides();
    const automatic = behaviors.length ? `<section class="preview-section" data-preview-section="automatic"><h3>Automatic</h3>${behaviors.map((behavior, index) => { const key = behaviorKey(behavior, index), on = key in overrides ? overrides[key] : behavior.enabled !== false; return `<label class="check"><input type="checkbox" data-preview-behavior="${esc(key)}" ${on ? 'checked' : ''}> ${esc(behavior.name || behavior.type)}${key in overrides ? ' <small>(preview only)</small>' : ''}</label>`; }).join('')}<p class="small">Changes here are preview-only. Edit behaviors in Animate.</p></section>` : '';
    // No readiness list here any more: the Publish panel directly under this one
    // shows the same seven rows, and "Reset mascot" in the header already clears
    // the live controls that a second "Center" button used to clear.
    host.innerHTML = `<section class="preview-section" data-preview-section="live"><h3>Live controls</h3>${enabled.length ? `${poseRows}${pads}${sliders}` : '<p class="small">Turn on movements in Face Setup to test them live.</p>'}</section>${expressions}${reactions}${poses}${animations}${automatic}`;
  }

  return { render, syncPads };
}
