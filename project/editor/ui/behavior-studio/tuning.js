/**
 * The tuning rail: one inspector for whatever is picked on the board
 * (docs/BEHAVIOR_STUDIO.md §3.4).
 *
 * Everything this workspace sets is a **shape in time**, and the audit's
 * finding was that not one of them was drawn:
 *
 * ```text
 * a transition   duration in ms + easing in a <select> of four words
 * a reaction     attack / hold / release, three numbers
 * a behaviour    intervalMin, intervalMax, amplitude, frequency, travelMin…
 * ```
 *
 * So every control here is a picture of the thing it sets. The easing is the
 * curve, with a playhead that runs it. The duration is a slider over named
 * stops. A behaviour is its own waveform, sampled through the runtime's own
 * scheduler, so what is on screen is what the mascot will do rather than an
 * illustration of it.
 *
 * And it answers for **several things at once**: picking four transitions and
 * setting them all to 200 ms is one gesture and one history step, which is the
 * edit the old one-string selection could not express at all.
 */
import { createBoardCommands } from '../../core/behavior-graph/board-commands.js';
import { createStateMachineCommands } from '../../animation-editor/state-machine/state-machine-commands.js';
import { createBehaviorCommands } from '../../animation-editor/behaviors/behavior-commands.js';
import { readTransitionKey, triggerSignature } from '../../core/behavior-graph/behavior-graph.js';
import {
  DURATION_STOPS, EASINGS, durationLabel, easingMeta, easingPath, easingPoint,
  nearestDurationStop, traceBaseline, tracePath, traceWindow, behaviorTrace
} from '../../core/behavior-graph/motion-shapes.js';
import { availableControlGroups, controlMeta } from '../control-catalog.js';
import { triggerLabel } from '../../core/reactions/reaction-model.js';
import { esc } from '../escape-html.js';

const CURVE = Object.freeze({ width: 168, height: 96 });
const THUMB = Object.freeze({ width: 44, height: 28 });
const WAVE = Object.freeze({ width: 248, height: 72 });

/**
 * The four easings, as four curves.
 *
 * A `<select>` holding the words "Ease In" and "Ease In Out" asks an author to
 * choose between two things they cannot picture; four drawings answer it
 * before anything is pressed.
 */
export function easingPicker(easing = 'easeInOut') {
  const chosen = easingMeta(easing);
  const thumb = (entry) => `<button type="button" class="easing-thumb${entry.id === chosen.id ? ' active' : ''}" data-tune-easing="${entry.id}"
    aria-pressed="${entry.id === chosen.id}" title="${esc(entry.label)} — ${esc(entry.hint)}">
    <svg viewBox="0 0 ${THUMB.width} ${THUMB.height}" aria-hidden="true"><path d="${easingPath(entry.id, { ...THUMB, samples: 20 })}"/></svg>
    <span>${esc(entry.label)}</span></button>`;
  return `<div class="easing-picker" data-tune-easing-picker="${chosen.id}">
    <figure class="easing-curve">
      <svg viewBox="0 0 ${CURVE.width} ${CURVE.height}" role="img" aria-label="${esc(chosen.label)}: ${esc(chosen.hint)}">
        <line class="easing-grid" x1="0" y1="${CURVE.height}" x2="${CURVE.width}" y2="${CURVE.height}"></line>
        <line class="easing-grid" x1="0" y1="0" x2="${CURVE.width}" y2="0"></line>
        <path class="easing-line" d="${easingPath(chosen.id, CURVE)}"></path>
        <circle class="easing-head" data-tune-playhead r="4" cx="0" cy="${CURVE.height}"></circle>
      </svg>
      <figcaption>${esc(chosen.hint)}</figcaption>
    </figure>
    <div class="easing-thumbs" role="group" aria-label="Easing">${EASINGS.map(thumb).join('')}</div>
  </div>`;
}

/**
 * Duration as a slider over named stops, because "300" is not a feeling and
 * "Normal" is. The number stays editable beside it for the author who wants
 * 340 ms.
 */
export function durationDial(ms, { label = 'How long' } = {}) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  return `<div class="duration-dial">
    <label class="duration-head">${esc(label)} <output data-tune-duration-label>${esc(durationLabel(value))}</output></label>
    <input type="range" data-tune-duration-stop min="0" max="${DURATION_STOPS.length - 1}" step="1" value="${nearestDurationStop(value)}" aria-label="${esc(label)}, in steps">
    <datalist>${DURATION_STOPS.map((stop) => `<option value="${stop.ms}" label="${esc(stop.label)}"></option>`).join('')}</datalist>
    <div class="duration-exact"><input type="number" data-tune-duration min="0" step="10" value="${value}" aria-label="${esc(label)} in milliseconds"><span class="small">ms</span></div>
  </div>`;
}

/** A behaviour's own waveform: what it will do, over as long as it takes to show it. */
export function waveformCard(behavior, param = {}) {
  const seconds = traceWindow(behavior);
  const trace = behaviorTrace(behavior, param, { seconds, samples: 220 });
  return `<figure class="wave-card" data-tune-wave="${esc(behavior.type)}">
    <svg viewBox="0 0 ${WAVE.width} ${WAVE.height}" role="img" aria-label="What ${esc(behavior.name || behavior.type)} does over ${Math.round(seconds)} seconds">
      <line class="wave-rest" x1="0" y1="${traceBaseline(trace, WAVE)}" x2="${WAVE.width}" y2="${traceBaseline(trace, WAVE)}"></line>
      <path class="wave-line" d="${tracePath(trace, WAVE)}"></path>
    </svg>
    <figcaption>${Math.round(seconds)} s of <b>${esc(controlMeta(behavior.parameter).label)}</b> · rest is the dotted line</figcaption>
  </figure>`;
}

const numberField = (label, key, value, extra = '') => `<label class="tune-field">${esc(label)}<input data-tune-behavior-field="${key}" type="number" ${extra} value="${value}"></label>`;

/** The fields one behaviour type has, and only those. */
function behaviorFields(behavior) {
  if (behavior.type === 'blink') {
    return numberField('Rest, shortest (s)', 'intervalMin', behavior.intervalMin, 'min="0" step="0.1"')
      + numberField('Rest, longest (s)', 'intervalMax', behavior.intervalMax, 'min="0" step="0.1"')
      + numberField('How long closed (s)', 'duration', behavior.duration, 'min="0.01" step="0.01"')
      + numberField('Closed value', 'closedValue', behavior.closedValue, 'step="0.01"');
  }
  if (behavior.type === 'randomIdle') {
    return numberField('Rest, shortest (s)', 'intervalMin', behavior.intervalMin, 'min="0" step="0.1"')
      + numberField('Rest, longest (s)', 'intervalMax', behavior.intervalMax, 'min="0" step="0.1"')
      + numberField('Lowest', 'min', behavior.min, 'step="0.01"')
      + numberField('Highest', 'max', behavior.max, 'step="0.01"');
  }
  if (behavior.type === 'oscillator') {
    return numberField('How far (amplitude)', 'amplitude', behavior.amplitude, 'min="0" step="0.01"')
      + numberField('Centred on (offset)', 'offset', behavior.offset, 'step="0.01"')
      + numberField('How often (Hz)', 'frequency', behavior.frequency, 'min="0" step="0.01"');
  }
  return numberField('How far (amplitude)', 'amplitude', behavior.amplitude, 'min="0" step="0.01"')
    + numberField('Move, shortest (s)', 'travelMin', behavior.travelMin, 'min="0.01" step="0.1"')
    + numberField('Move, longest (s)', 'travelMax', behavior.travelMax, 'min="0.01" step="0.1"')
    + numberField('Rest, shortest (s)', 'intervalMin', behavior.intervalMin, 'min="0" step="0.1"')
    + numberField('Rest, longest (s)', 'intervalMax', behavior.intervalMax, 'min="0" step="0.1"');
}

/**
 * The transition panel, for one edge or for twenty.
 *
 * A mixed value says so rather than showing the first one and quietly
 * overwriting the rest on the next keystroke: "Mixed" is a fact about the
 * selection, and pressing a curve is then a decision to make them all agree.
 */
export function renderTransitionTuning(document, keys) {
  const settings = keys.map((key) => document.transitionSettings?.[key] || { duration: 300, easing: 'easeInOut' });
  const durations = [...new Set(settings.map((item) => item.duration ?? 300))];
  const easings = [...new Set(settings.map((item) => item.easing || 'easeInOut'))];
  const ends = keys.map(readTransitionKey).filter(Boolean);
  const one = keys.length === 1;
  const title = one
    ? `<b>${esc(ends[0]?.from || '')}</b> → <b>${esc(ends[0]?.to || '')}</b>`
    : `<b>${keys.length} transitions</b><small>${ends.slice(0, 4).map((item) => `${esc(item.from)}→${esc(item.to)}`).join(', ')}${keys.length > 4 ? ` +${keys.length - 4}` : ''}</small>`;
  return `<section class="transition-inspector tune-panel" data-tune-kind="transition" data-tune-count="${keys.length}">
    <div class="tune-head"><h3>Transition</h3><p class="tune-subject">${title}</p></div>
    ${easings.length > 1 ? '<p class="small tune-mixed">Mixed easing — pressing one makes them all agree.</p>' : ''}
    ${easingPicker(easings.length === 1 ? easings[0] : 'easeInOut')}
    ${durations.length > 1 ? '<p class="small tune-mixed">Mixed durations.</p>' : ''}
    ${durationDial(durations.length === 1 ? durations[0] : 300)}
    <div class="tune-actions">
      <button type="button" data-tune-test>▶ Play it</button>
      <button type="button" class="danger secondary" data-tune-delete>Delete ${one ? 'transition' : `all ${keys.length}`}</button>
    </div>
    <p class="small">A transition cross-fades from the pose on screen; it never passes through rest.</p>
  </section>`;
}

/**
 * The state panel: the pose, and what can be done to the state itself.
 *
 * The pose is a slider per movement, and a mascot has twenty-six of them. All
 * of them, in every group, one per line, made this inspector **3 023 px tall**
 * in an 836 px column -- measured at 1440x900, and the tallest single panel in
 * the editor by a factor of three.
 *
 * So the groups are a strip and one group's sliders show, the same shape as
 * the capability bar, the Control Deck's bands and the preset catalogues
 * (UX-60 PR 6). Every group is named with how many of its movements this pose
 * has moved off their default, so "where did I put the eyes" is answerable
 * without opening anything.
 *
 * `group` is which one is showing; the rail keeps it across re-renders so
 * dragging a slider does not throw the author back to the first group.
 */
export function renderStateTuning(document, name, { group: picked = null } = {}) {
  const pose = document.states?.[name];
  if (!pose) return '';
  const groups = [...availableControlGroups(document.params || {})];
  const initial = name === document.activeState;
  const active = groups.some(([group]) => group === picked) ? picked : groups[0]?.[0] || null;
  // How many of a group's movements this pose actually poses: the number that
  // says "there is something of mine in here".
  const posed = (controls) => controls.filter(({ id }) => pose[id] !== undefined && pose[id] !== document.params[id]?.default).length;
  const strip = groups.length > 1
    ? `<div class="tune-groups" role="group" aria-label="Which movements">${groups.map(([group, controls]) => {
      const on = group === active, count = posed(controls);
      return `<button type="button" class="preset-chip${on ? ' chip-active' : ''}" data-tune-group="${esc(group)}" aria-pressed="${on}" title="${esc(group)}: ${count ? `${count} posed` : 'nothing posed yet'}"><b>${esc(group)}</b><small>${count || ''}</small></button>`;
    }).join('')}</div>`
    : '';
  return `<section class="state-inspector tune-panel" data-tune-kind="state" data-tune-state="${esc(name)}">
    <div class="tune-head"><h3>State</h3><p class="tune-subject"><b>${esc(name)}</b><small>${initial ? 'where the mascot starts' : `${(document.transitions?.[name] || []).length} ways out`}</small></p></div>
    <div class="tune-actions">
      <button type="button" data-tune-preview>▶ Hold this pose</button>
      <button type="button" class="secondary" data-tune-initial ${initial ? 'disabled' : ''}>Start here</button>
      <button type="button" class="secondary" data-tune-rename>Rename</button>
      <button type="button" class="secondary" data-tune-duplicate>Duplicate</button>
      <button type="button" class="danger secondary" data-tune-delete>Delete</button>
    </div>
    ${strip}
    ${groups.map(([group, controls]) => `<fieldset data-tune-group-panel="${esc(group)}"${strip && group !== active ? ' hidden' : ''}><legend>${esc(group)}</legend>${controls.map(({ id, label }) => {
      const param = document.params[id], value = pose[id] ?? param.default;
      return `<label>${esc(label)} <output>${Number(value).toFixed(2)}</output><input data-tune-state-param="${esc(id)}" type="range" min="${param.min}" max="${param.max}" step="0.01" value="${value}"></label>`;
    }).join('')}</fieldset>`).join('')}
    <button type="button" class="secondary" data-tune-reset>Reset to defaults</button>
  </section>`;
}

/** The automatic behaviour panel: its waveform first, then the numbers that shape it. */
export function renderAutomaticTuning(document, id) {
  const behavior = (document.behaviors || []).find((item) => item.id === id);
  if (!behavior) return '';
  const param = document.params?.[behavior.parameter];
  const groups = availableControlGroups(document.params || {});
  return `<section class="behavior-inspector tune-panel" data-tune-kind="automatic" data-tune-behavior="${esc(id)}">
    <div class="tune-head"><h3>By itself</h3><p class="tune-subject"><b>${esc(behavior.name)}</b><small>${esc(behavior.type)}</small></p></div>
    ${param ? waveformCard(behavior, param) : `<p class="notice error">⚠ This moves “${esc(behavior.parameter)}”, which this mascot does not have.</p>`}
    <label class="check"><input type="checkbox" data-tune-behavior-enabled ${behavior.enabled !== false ? 'checked' : ''}> Running</label>
    <label class="tune-field">Name<input data-tune-behavior-field="name" value="${esc(behavior.name)}"></label>
    <label class="tune-field">Moves<select data-tune-behavior-field="parameter">${[...groups].map(([group, items]) =>
      `<optgroup label="${esc(group)}">${items.map((item) => `<option value="${esc(item.id)}" ${behavior.parameter === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="tune-fields">${behaviorFields(behavior)}</div>
    <div class="tune-actions">
      <button type="button" data-tune-test>▶ Play it</button>
      <button type="button" class="secondary" data-tune-duplicate>Duplicate</button>
      <button type="button" class="danger secondary" data-tune-delete>Delete</button>
    </div>
  </section>`;
}

/** The trigger panel: what fires, and everything it fires. */
export function renderTriggerTuning(document, signature) {
  const fired = (document.reactions || []).filter((item) => triggerSignature(item.trigger) === signature);
  if (!fired.length) return '';
  return `<section class="tune-panel" data-tune-kind="trigger" data-tune-trigger="${esc(signature)}">
    <div class="tune-head"><h3>When</h3><p class="tune-subject"><b>${esc(triggerLabel(fired[0].trigger))}</b><small>${fired.length} reaction${fired.length === 1 ? '' : 's'}</small></p></div>
    <ul class="tune-list">${fired.map((item) => `<li><button type="button" class="link" data-tune-open-reaction="${esc(item.id)}">${esc(item.name)}</button></li>`).join('')}</ul>
    <p class="small">A trigger is a fact about the page. Change what it fires by opening a reaction; change the trigger itself in the reaction's own <b>When</b>.</p>
  </section>`;
}

const EMPTY = `<p class="small">Pick something on the board. A <b>transition</b> gives you its curve and its length; a <b>state</b> gives you its pose; something that runs <b>by itself</b> gives you the shape of what it does. Shift-click to pick several transitions and tune them together.</p>`;

/**
 * The rail, wired.
 *
 * It renders from a selection rather than from a panel's own idea of what is
 * open, which is what lets one rail answer for four kinds of thing without a
 * mode anywhere.
 */
export function createTuningRail({ host, store, history, preview = null, onStatus = () => {}, onSelectReaction = () => {}, getSelection = () => ({ nodes: [], edges: [] }) }) {
  const board = createBoardCommands(store, history);
  const states = createStateMachineCommands(store, history);
  const behaviors = createBehaviorCommands(store, history);
  let playing = null;
  const doc = () => store.getDocument();
  const behaviorIndex = (id) => (doc().behaviors || []).findIndex((item) => item.id === id);
  const guard = (fn) => { try { return fn(); } catch (error) { onStatus(error.message, 'warn'); return undefined; } };

  /** The dot that runs the curve, so "ease out" is something you watch happen. */
  function playCurve(easing, duration) {
    const head = host.querySelector('[data-tune-playhead]');
    if (!head) return;
    cancelAnimationFrame(playing);
    const span = Math.max(80, Number(duration) || 300), started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / span);
      const point = easingPoint(easing, t, CURVE);
      head.setAttribute('cx', String(point.x));
      head.setAttribute('cy', String(point.y));
      if (t < 1) playing = requestAnimationFrame(step);
    };
    playing = requestAnimationFrame(step);
  }

  const edgeSettings = (key) => doc().transitionSettings?.[key] || { duration: 300, easing: 'easeInOut' };

  function apply(patch) {
    const { edges } = getSelection();
    if (!edges.length) return;
    guard(() => board.setTransitions(edges, patch));
    render();
    const first = edgeSettings(edges[0]);
    playCurve(patch.easing || first.easing, patch.duration ?? first.duration);
  }

  function test() {
    const selection = getSelection();
    if (selection.edges.length) {
      const key = selection.edges[0], ends = readTransitionKey(key), settings = edgeSettings(key);
      playCurve(settings.easing, settings.duration);
      if (ends) preview?.testTransition({ from: ends.from, to: ends.to, duration: settings.duration, easing: settings.easing });
      return;
    }
    const primary = selection.primary;
    if (primary?.kind === 'automatic') preview?.testBehavior(primary.key);
    if (primary?.kind === 'state') preview?.previewState(primary.key);
  }

  host.addEventListener('click', (event) => {
    const chip = event.target.closest?.('[data-tune-group]');
    if (chip) {
      tuneGroup = chip.dataset.tuneGroup;
      // In place: the sliders are already rendered, and re-rendering to change
      // which fieldset shows would drop the focus of whoever pressed the chip.
      for (const button of host.querySelectorAll('[data-tune-group]')) {
        const on = button === chip;
        button.classList.toggle('chip-active', on);
        button.setAttribute('aria-pressed', String(on));
      }
      for (const panel of host.querySelectorAll('[data-tune-group-panel]')) panel.hidden = panel.dataset.tuneGroupPanel !== tuneGroup;
      return;
    }
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    const data = button.dataset, selection = getSelection(), primary = selection.primary;
    if (data.tuneEasing) return apply({ easing: data.tuneEasing });
    if (data.tuneTest !== undefined) return test();
    if (data.tuneOpenReaction) return onSelectReaction(data.tuneOpenReaction);
    if (data.tuneDelete !== undefined) {
      if (selection.edges.length) { guard(() => board.deleteTransitions(selection.edges)); return render(); }
      if (primary?.kind === 'state') { guard(() => states.delete(primary.key)); return render(); }
      if (primary?.kind === 'automatic') { guard(() => behaviors.delete(behaviorIndex(primary.key))); return render(); }
      return undefined;
    }
    if (!primary) return undefined;
    if (data.tunePreview !== undefined && primary.kind === 'state') return preview?.previewState(primary.key);
    if (data.tuneInitial !== undefined && primary.kind === 'state') { guard(() => states.setInitial(primary.key)); return render(); }
    if (data.tuneReset !== undefined && primary.kind === 'state') { guard(() => states.reset(primary.key)); return render(); }
    if (data.tuneDuplicate !== undefined) {
      if (primary.kind === 'state') guard(() => states.duplicate(primary.key));
      if (primary.kind === 'automatic') guard(() => behaviors.duplicate(behaviorIndex(primary.key)));
      return render();
    }
    if (data.tuneRename !== undefined && primary.kind === 'state') {
      const next = globalThis.prompt?.('State name', primary.key);
      if (next && next.trim() && next.trim() !== primary.key) guard(() => states.rename(primary.key, next.trim()));
      return render();
    }
    return undefined;
  });

  // A slider and a number field are dragged, so they write on `input` and the
  // history step is opened on focus and closed on blur: one drag, one undo.
  host.addEventListener('focusin', (event) => { if (event.target.matches('input[type=range],input[type=number]')) history.beginTransaction?.(); });
  host.addEventListener('focusout', (event) => { if (event.target.matches('input[type=range],input[type=number]')) history.commitTransaction?.(); });

  host.addEventListener('input', (event) => {
    const data = event.target.dataset, value = event.target.value, selection = getSelection(), primary = selection.primary;
    if (data.tuneDurationStop !== undefined) {
      const ms = DURATION_STOPS[Number(value)]?.ms ?? 300;
      const exact = host.querySelector('[data-tune-duration]'), label = host.querySelector('[data-tune-duration-label]');
      if (exact) exact.value = String(ms);
      if (label) label.value = durationLabel(ms);
      guard(() => board.setTransitions(selection.edges, { duration: ms }));
      playCurve(easingOf(selection), ms);
      return;
    }
    if (data.tuneDuration !== undefined) {
      const label = host.querySelector('[data-tune-duration-label]'), stop = host.querySelector('[data-tune-duration-stop]');
      if (label) label.value = durationLabel(value);
      if (stop) stop.value = String(nearestDurationStop(value));
      guard(() => board.setTransitions(selection.edges, { duration: Number(value) }));
      return;
    }
    if (data.tuneStateParam && primary?.kind === 'state') {
      const output = event.target.previousElementSibling;
      if (output?.tagName === 'OUTPUT') output.value = Number(value).toFixed(2);
      guard(() => states.setParameter(primary.key, data.tuneStateParam, value));
      preview?.previewState(primary.key);
    }
  });

  host.addEventListener('change', (event) => {
    const data = event.target.dataset, selection = getSelection(), primary = selection.primary;
    if (data.tuneBehaviorEnabled !== undefined && primary?.kind === 'automatic') {
      guard(() => behaviors.setEnabled(behaviorIndex(primary.key), event.target.checked));
      return render();
    }
    if (data.tuneBehaviorField && primary?.kind === 'automatic') {
      guard(() => behaviors.updateField(behaviorIndex(primary.key), data.tuneBehaviorField, event.target.value));
      return render();
    }
    return undefined;
  });

  /**
   * Which group of movements the state panel is showing.
   *
   * Session state on the rail, so a slider drag -- which re-renders -- does
   * not throw the author back to the first group. Never anything the mascot
   * is.
   */
  let tuneGroup = null;

  const easingOf = (selection) => {
    const chosen = [...new Set(selection.edges.map((key) => edgeSettings(key).easing || 'easeInOut'))];
    return chosen.length === 1 ? chosen[0] : 'easeInOut';
  };

  function render() {
    const state = doc(), selection = getSelection();
    const live = selection.edges.filter((key) => state.transitionSettings?.[key] || readTransitionKey(key));
    if (live.length) { host.innerHTML = renderTransitionTuning(state, live); host.dataset.tuneKind = 'transition'; return true; }
    const primary = selection.primary;
    const markup = primary?.kind === 'state' ? renderStateTuning(state, primary.key, { group: tuneGroup })
      : primary?.kind === 'automatic' ? renderAutomaticTuning(state, primary.key)
        : primary?.kind === 'trigger' ? renderTriggerTuning(state, primary.key)
          : '';
    host.innerHTML = markup || EMPTY;
    host.dataset.tuneKind = markup ? primary.kind : 'none';
    return Boolean(markup);
  }

  return { render, destroy() { cancelAnimationFrame(playing); host.innerHTML = ''; } };
}
