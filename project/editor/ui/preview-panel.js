import { triggerLabel } from '../core/reactions/reaction-model.js';
import { RUNS_WHEN, runsWhenLabel, runsWhenOf } from '../core/reactions/runs-when.js';
import { deriveMovementChecklist } from '../rig-editor/semantic-parts/face-movements.js';
import { UNPROMPTED_REACTION_TRIGGERS, normalizeBehaviors } from '../../runtime/runtime.js';
import { padFrame } from './pad-frame.js';
import { activePartPose, partPoseGroups } from '../core/puppet/part-poses.js';
import { handPosePresets, handStylePresets } from '../core/puppet/hand-handles.js';
import { HAND_SIDES, normalizeHand } from '../core/hands/hand-model.js';
import { handShowParameter } from '../core/sample/hand-feature.js';
import { poseChipRow } from './pose-chips.js';
import { EXPRESSION_PRESET_GROUPS, presetById as expressionPresetById } from '../core/expressions/expression-presets.js';
import { MOTION_PRESET_GROUPS, resolveMotionPreset } from '../core/motion/motion-presets.js';
import { esc } from './escape-html.js';

export const behaviorKey = (behavior, index) => behavior?.id || `behavior-${index}`;
const PADS = [
  ['lookX', 'lookY', 'Where it looks', { x: ['left', 'right'], y: ['up', 'down'] }],
  ['headX', 'headY', 'Where the head turns', { x: ['left', 'right'], y: ['up', 'down'] }]
];

/**
 * The bench got long.
 *
 * The template used to arrive with six clips and no faces or reactions at all;
 * it now ships the catalogues — thirty-odd motions, twenty-six faces, eighteen
 * reactions — and three flat rows of buttons in a 300 px column is not a test
 * bench, it is a wall. So each of the three lists is split into the groups its
 * own catalogue already declares, under a heading that says how many are in it.
 *
 * The groups open by default and nothing is hidden: this is the panel for
 * *trying* things, and a group the author has to open first is a click between
 * them and the thing they came to press. Closing one is remembered instead, so
 * an author working on faces can fold the motions away and keep them folded.
 */
const GROUP_NAMES = { expressions: [...EXPRESSION_PRESET_GROUPS, 'Yours'], animations: [...MOTION_PRESET_GROUPS, 'Yours'] };
const HAND_LABEL = { left: 'Left hand', right: 'Right hand' };

/** Which group a face is in: the preset's, or "Yours" for one the author built. */
const expressionGroupOf = (item) => (item.source === 'preset' && expressionPresetById(item.id)?.group) || 'Yours';
/** And a clip's, from the preset it was compiled from. A Timeline clip is "Yours". */
const clipGroupOf = (clip) => resolveMotionPreset(clip.motion?.preset)?.group || 'Yours';

/**
 * Reactions group by *when*, which is the thing an author is choosing between.
 *
 * The names come from `RUNS_WHEN` rather than from a copy kept here (V3-10), so
 * the bench, the reaction list and the preset catalogue cannot end up offering
 * three different sets of whens — which is exactly what happened when `idle`
 * and `gaze-follow` arrived and only one of the three had heard of them.
 */
const REACTION_GROUP_NAMES = RUNS_WHEN.map((entry) => entry.label);

/**
 * Which reaction actually answers a raw event.
 *
 * The runtime sorts the reactions listening for an event by priority and fires
 * the first that takes, so six reactions on `click` are not six things a click
 * does — five of them never run. That is invisible in a flat list of chips and
 * bites the moment somebody clicks the mascot, so the bench says it: the one
 * that answers is marked, the rest are dimmed and named their winner.
 *
 * The unprompted ones are the exception — a timer fires on its own interval and
 * an idle reaction on its own wait, so they all run and none of them is
 * competing for an event.
 *
 * @returns {Map<string, object>} event key → the reaction that answers it
 */
export function answeringReactions(reactions = []) {
  const winners = new Map();
  for (const item of reactions) {
    if (!item || item.enabled === false || UNPROMPTED_REACTION_TRIGGERS.includes(item.trigger?.type)) continue;
    const key = item.trigger?.type === 'custom' ? `custom:${item.trigger.name}` : String(item.trigger?.type || 'click');
    const held = winners.get(key);
    if (!held || Number(item.priority || 0) > Number(held.priority || 0)) winners.set(key, item);
  }
  return winners;
}
const reactionEventKey = (item) => (item.trigger?.type === 'custom' ? `custom:${item.trigger.name}` : String(item.trigger?.type || 'click'));

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
    // A pad that moves a hand brings it out from behind the head first, or the
    // drag would move something nobody can see (docs/HAND_RIGGING.md).
    for (const [name, value] of Object.entries(pad.dataset.previewHandSide ? handOut(pad.dataset.previewHandSide) : {})) preview.setLiveParam(name, value);
    pad.style.setProperty('--x', `${(ux + 1) * 50}%`); pad.style.setProperty('--y', `${(uy + 1) * 50}%`);
    setOutput(xName, x); setOutput(yName, y);
  };
  let padActive = null, customDraft = '';
  /** One press, one gesture: the live values, one key per parameter, and a redraw. */
  const applyValues = (values) => {
    for (const [name, value] of Object.entries(values)) preview.setLiveParam(name, value);
    onCommit({ ...values });
    syncPads();
    render();
  };
  /**
   * A hand that rests behind the head comes out to be looked at, here as in
   * Hand Setup: choosing a drawing for a hand nobody can see shows nothing
   * (docs/HAND_RIGGING.md, "Behind the head"). The named places carry this
   * already; a drawing is the one press that does not.
   */
  const handOut = (side) => {
    const name = handShowParameter(side);
    return doc().params?.[name] ? { [name]: 1 } : {};
  };
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
      if (pose) applyValues(pose.controls);
      return;
    }
    // A hand is posed and dressed the way every other part is: one press writes
    // parameters, through the same channel, so it keys under Auto Key and lands
    // in an expression being shaped without this knowing either (V3-11).
    if (button.dataset.handPose) {
      const [side, id] = button.dataset.handPose.split(':');
      const pose = handPosePresets(doc(), side).find((item) => item.id === id);
      if (pose) applyValues(pose.values);
      return;
    }
    if (button.dataset.previewHandStyle) {
      const [side, id] = button.dataset.previewHandStyle.split(':');
      const style = handStylePresets(doc(), side).find((item) => item.id === id);
      // Only a drawing this hand has: one the library holds and this hand has
      // not been given is drawn in Hand Setup, not pressed into being here.
      if (style?.added) applyValues({ ...style.values, ...handOut(side) });
      return;
    }
    if (button.dataset.previewReaction) { preview.fireReaction(button.dataset.previewReaction); render(); return; }
    if (button.dataset.previewEvent) { preview.triggerReaction({ type: button.dataset.previewEvent }); render(); return; }
    // A held trigger has two halves and the bench has to be able to press both:
    // a hover that can be started and never ended is not a hover (V3-09).
    if (button.dataset.previewEventEnd) { preview.releaseReaction?.(button.dataset.previewEventEnd); render(); return; }
    if (button.dataset.previewLogClear !== undefined) { preview.clearEventLog(); render(); return; }
    if (previewGo) { const model = readiness(); const target = model?.[previewGo]; if (target?.route) navigate(target.route); return; }
    if (button.dataset.previewExpression) { const id = button.dataset.previewExpression, weights = preview.getExpressionWeights(); if (weights[id]) preview.clearExpression(id); else preview.setExpression(id, Number(host.querySelector('[data-preview-intensity]')?.value ?? 1)); render(); return; }
    if (button.dataset.previewExpressionClear !== undefined) { preview.clearExpressions(); render(); }
  });
  host.addEventListener('input', (event) => { if (event.target.dataset.previewIntensity === undefined) return; const value = Number(event.target.value); for (const id of Object.keys(preview.getExpressionWeights())) preview.setExpression(id, value); const output = host.querySelector('[data-preview-intensity-output]'); if (output) output.value = `${Math.round(value * 100)}%`; });
  // Everything here is open until the author folds it, which is the opposite of
  // `rememberOpen`'s default-closed bookkeeping: what is remembered is the
  // *folding*. A section or group not in this set is open, so one that did not
  // exist when the author folded something else is open too -- which is what a
  // seeded "these were open" set gets wrong the moment a list appears later.
  const folded = new Set();
  host.addEventListener('toggle', (event) => {
    const id = event.target?.getAttribute?.('data-preview-group');
    if (!id) return;
    if (event.target.open) folded.delete(id); else folded.add(id);
  }, true);
  const openAttr = (id) => (folded.has(id) ? '' : ' open');
  /**
   * A section, foldable. The bench is a tall column — eighteen live movements
   * before the catalogues even start — and the author who came to press a
   * motion should be able to put the sliders away and keep them away.
   */
  const section = (id, title, body, { count = null } = {}) => body
    ? `<details class="preview-section" data-preview-section="${esc(id)}" data-preview-group="section:${esc(id)}"${openAttr(`section:${id}`)}><summary><h3>${esc(title)}</h3>${count === null ? '' : `<small>${count}</small>`}</summary>${body}</details>`
    : '';
  // One disclosure per group, open unless the author folded it away. Fewer than
  // two groups is not a grouping: a project with only its own faces gets the
  // plain row it had before.
  const groupBlocks = (kind, names, items, groupOf, body) => {
    const buckets = names.map((name) => ({ name, items: items.filter((item) => groupOf(item) === name) })).filter((bucket) => bucket.items.length);
    if (buckets.length < 2) return buckets.length ? body(buckets[0].items, buckets[0].name) : '';
    return buckets.map((bucket) => `<details class="preview-group" data-preview-group="${esc(kind)}:${esc(bucket.name)}"${openAttr(`${kind}:${bucket.name}`)}><summary>${esc(bucket.name)}<small>${bucket.items.length}</small></summary>${body(bucket.items, bucket.name)}</details>`).join('');
  };

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
    // One slider and its number field, for any parameter the project has. The
    // movements and the hands both come through here, so a hand's turn is the
    // same control as a brow's raise rather than a second kind of slider.
    const controlRow = (id, group, label) => {
      const param = state.params[id];
      if (!param) return '';
      const value = live[id] ?? param.default ?? 0;
      return `<label class="preview-control">${esc(group)} · ${esc(label)} <input type="number" data-preview-output="${id}" aria-label="${esc(group)} ${esc(label)} value" min="${param.min ?? -1}" max="${param.max ?? 1}" step=".01" value="${Number(value).toFixed(2)}"><input type="range" data-preview-control="${id}" aria-label="${esc(group)} ${esc(label)}" min="${param.min ?? -1}" max="${param.max ?? 1}" step=".01" value="${value}"></label>`;
    };
    const sliders = enabled.map((item) => controlRow(item.id, item.group, item.label)).join('');
    const weights = preview.getExpressionWeights(), intensity = Object.values(weights)[0] ?? 1;
    // "None" and the intensity stay outside the groups: they act on whatever is
    // showing, whichever group it came from.
    const faceChip = (item) => `<button type="button" class="chip${weights[item.id] ? ' chip-active' : ''}" data-preview-expression="${esc(item.id)}" aria-pressed="${Boolean(weights[item.id])}">${esc(item.name)}</button>`;
    const faceGroups = groupBlocks('expressions', GROUP_NAMES.expressions, state.expressions || [], expressionGroupOf, (items) => `<div class="chip-row">${items.map(faceChip).join('')}</div>`);
    const expressions = section('expressions', 'Expressions', (state.expressions || []).length
      ? `<div class="chip-row"><button type="button" class="chip${Object.keys(weights).length ? '' : ' chip-active'}" data-preview-expression-clear aria-pressed="${!Object.keys(weights).length}">None</button></div>${faceGroups}<label>Intensity <output data-preview-intensity-output>${Math.round(intensity * 100)}%</output><input type="range" data-preview-intensity aria-label="Expression intensity" min="0" max="1" step=".05" value="${intensity}"></label>`
      : '', { count: (state.expressions || []).length });
    const activeReaction = preview.getActiveReaction?.()?.id || null, log = preview.getEventLog?.() || [];
    const describeLog = (entry) => { const what = entry.type === 'custom' ? `"${entry.name}"` : entry.type === 'test' ? `Test ${entry.reactionName}` : entry.type; const outcome = entry.outcome === 'fired' ? `→ ${entry.reactionName || entry.reactionId} fired` : entry.outcome === 'blocked' ? `→ blocked${entry.blockedBy ? ` by ${entry.blockedBy}` : ''}` : entry.outcome === 'disabled' ? '→ disabled' : '→ no reaction listens'; return `${Number(entry.at).toFixed(1)} s · ${what} ${outcome}`; };
    const simulator = `<div class="event-simulator" data-preview-events><p class="small">Trigger an event</p><div class="chip-row"><button type="button" class="chip" data-preview-event="click">Click</button><button type="button" class="chip" data-preview-event="hover">Hover</button><button type="button" class="chip" data-preview-event-end="hover">Leave</button><button type="button" class="chip" data-preview-event="gaze-follow">Follow</button><button type="button" class="chip" data-preview-event-end="gaze-follow">Look away</button><form class="event-custom" data-preview-event-form><input type="text" data-preview-event-name aria-label="Custom event name" placeholder="custom event" value="${esc(customDraft)}"><button type="submit" class="chip">Fire</button></form></div><ol class="event-log" data-preview-event-log aria-label="Event log">${log.length ? log.map((entry) => `<li data-log-outcome="${esc(entry.outcome)}">${esc(describeLog(entry))}</li>`).join('') : '<li class="small" data-log-empty>No events yet. Click the mascot or trigger an event.</li>'}</ol>${log.length ? '<button type="button" class="secondary" data-preview-log-clear>Clear log</button>' : ''}</div>`;
    // Grouped by *when*, and honest about the fact that only one of them answers
    // a click: a reaction that cannot win its event is dimmed and told who did.
    const winners = answeringReactions(state.reactions || []);
    // An unprompted reaction competes with nothing — a timer has its own
    // interval and an idle reaction its own wait — so it always answers.
    const answersFor = (item) => UNPROMPTED_REACTION_TRIGGERS.includes(item.trigger?.type) ? true : winners.get(reactionEventKey(item)) === item;
    const reactionChip = (item) => {
      const answers = answersFor(item), winner = answers ? null : winners.get(reactionEventKey(item));
      const note = item.enabled === false ? 'turned off' : answers ? null : winner ? `${winner.name} answers first` : null;
      return `<button type="button" class="chip${activeReaction === item.id ? ' chip-active' : ''}${answers || item.enabled === false ? '' : ' chip-shadowed'}" data-preview-reaction="${esc(item.id)}" data-preview-answers="${answers}" aria-pressed="${activeReaction === item.id}" title="${esc(note ? `${triggerLabel(item.trigger)} — ${note}` : triggerLabel(item.trigger))}"${item.enabled === false ? ' disabled' : ''}>⚡ ${esc(item.name)}</button>`;
    };
    const reactionGroups = groupBlocks('reactions', REACTION_GROUP_NAMES, state.reactions || [], (item) => runsWhenLabel(runsWhenOf(item.trigger || { type: 'click' })) || REACTION_GROUP_NAMES[0], (items) => {
      const shadowed = items.filter((item) => item.enabled !== false && !answersFor(item)).length;
      return `${shadowed ? `<p class="small">${shadowed} of these never run on their own — the highest priority wins the event. Press one here to see it, or change its priority in Reactions.</p>` : ''}<div class="chip-row">${items.map(reactionChip).join('')}</div>`;
    });
    const reactions = section('reactions', 'Reactions',
      `${(state.reactions || []).length ? `<p class="small">Click the mascot to trigger its click reactions, or fire one here.</p>${reactionGroups}` : '<p class="small">No reactions yet. <button type="button" class="secondary" data-preview-go="reactions">Create one</button></p>'}${simulator}`,
      { count: (state.reactions || []).length || null });
    const stateNames = Object.keys(state.states || {}), activeState = preview.getSession().previewState || state.activeState;
    const poses = stateNames.length > 1
      ? section('poses', 'Poses', `<div class="chip-row">${stateNames.map((name) => `<button type="button" class="chip${name === activeState ? ' chip-active' : ''}" data-preview-state="${esc(name)}" aria-pressed="${name === activeState}">${esc(name)}</button>`).join('')}</div>`, { count: stateNames.length })
      : '';
    const clips = state.animationClips || [], playing = preview.isPlaying() ? preview.getActiveClipId() : null;
    // Two to a row, so thirty-five of them are a block rather than a scroll:
    // the name carries a title, because a long one is clipped at that width.
    const clipButton = (clip) => `<button type="button" data-preview-clip="${esc(clip.id)}" aria-pressed="${playing === clip.id}" title="${esc(clip.name)}" class="${playing === clip.id ? 'chip-active' : ''}">${playing === clip.id ? '■' : '▶'} ${esc(clip.name)}</button>`;
    const clipGroups = groupBlocks('animations', GROUP_NAMES.animations, clips, clipGroupOf, (items) => `<div class="preview-example-list">${items.map(clipButton).join('')}</div>`);
    const animations = section('animations', 'Animations', clips.length ? clipGroups : '', { count: clips.length });
    const behaviors = normalizeBehaviors(state), overrides = preview.getBehaviorOverrides();
    const automatic = section('automatic', 'Automatic', behaviors.length
      ? `${behaviors.map((behavior, index) => { const key = behaviorKey(behavior, index), on = key in overrides ? overrides[key] : behavior.enabled !== false; return `<label class="check"><input type="checkbox" data-preview-behavior="${esc(key)}" ${on ? 'checked' : ''}> ${esc(behavior.name || behavior.type)}${key in overrides ? ' <small>(preview only)</small>' : ''}</label>`; }).join('')}<p class="small">Changes here are preview-only. Edit behaviors in Animate.</p>`
      : '', { count: behaviors.length });
    // No readiness list here any more: the Publish panel directly under this one
    // shows the same seven rows, and "Reset mascot" in the project bar already clears
    // the live controls that a second "Center" button used to clear.
    const liveControls = section('live', 'Live controls', enabled.length ? `${poseRows}${pads}${sliders}` : '<p class="small">Turn on movements in Face Setup to test them live.</p>', { count: enabled.length || null });
    /**
     * The hands, on the bench (V3-11).
     *
     * Hand Setup's last step used to be "Ready. Test it from Preview" — and
     * Preview had nothing for a hand at all: the movement checklist is the face
     * parts, and `leftHand` declares no controls, so not one hand slider ever
     * reached this panel. A hand's controls come from the `hands` block
     * instead, which is the thing that actually animates one.
     *
     * Per hand, in the order an author reaches for them: where to put it, which
     * drawing it is, then the pad and the sliders that reach everywhere in
     * between.
     */
    const handBlock = (side) => {
      const hand = state.hands?.[side];
      if (!hand?.element) return '';
      const label = HAND_LABEL[side];
      const places = handPosePresets(state, side), current = activePartPose(places.map((place) => ({ id: place.id, controls: place.values })), live);
      // The drawings this hand holds. A hand that holds none gets a line rather
      // than six dead chips: the library is drawn in Hand Setup, not here.
      const drawings = handStylePresets(state, side).filter((style) => style.added);
      const showing = drawings.find((style) => Object.entries(style.values).every(([name, value]) => Math.abs(Number(live[name] ?? state.params?.[name]?.default ?? 0) - value) < 0.02));
      // Normalized, because a hand as the document stores it need not carry a
      // `parameters` block at all -- an imported rig names none, and the
      // defaults are what the runtime would read anyway.
      const { x, y, rotation, depth } = normalizeHand(hand, side).parameters;
      const pad = state.params?.[x] && state.params?.[y] ? padFrame({
        label: `${label} position`, hint: 'drag to test', x: ['in', 'out'], y: ['up', 'down'],
        pad: `<div class="xy-pad" data-preview-xy="${x}:${y}" data-preview-hand-side="${side}" role="application" tabindex="0" aria-label="${esc(label)} position pad. Use arrow keys or drag." style="--x:${(toUnit(x, padValue(x)) + 1) * 50}%;--y:${(toUnit(y, padValue(y)) + 1) * 50}%"><i></i></div>`
      }) : '';
      return `<div class="preview-hand" data-preview-hand="${side}"><h4 class="small">${esc(label)}</h4>
        ${poseChipRow({ poses: places.map((place) => ({ id: place.id, name: place.name, active: place.id === current })), attribute: 'data-hand-pose', group: side })}
        ${drawings.length
          ? poseChipRow({ poses: drawings.map((style) => ({ id: style.id, name: style.name, active: style.id === showing?.id })), attribute: 'data-preview-hand-style', group: side })
          : '<p class="small">No drawings yet — give this hand some in Face Setup → Hands, and they appear here.</p>'}
        ${pad}
        ${controlRow(rotation, label, 'Turn')}${controlRow(handShowParameter(side), label, 'Out from behind the head')}${controlRow(depth, label, 'In front')}</div>`;
    };
    const handBlocks = HAND_SIDES.map(handBlock).join('');
    const hands = section('hands', 'Hands', handBlocks, { count: HAND_SIDES.filter((side) => state.hands?.[side]?.element).length || null });
    host.innerHTML = `${liveControls}${hands}${expressions}${reactions}${poses}${animations}${automatic}`;
  }

  return { render, syncPads };
}
