/**
 * Every animation the Behavior workspace tunes, as a shape somebody can look at
 * (docs/BEHAVIOR_STUDIO.md §1.5).
 *
 * The whole workspace sets **shapes in time** — a transition is a curve, a
 * reaction is three segments, a blink is a pulse train, a drift is an eased
 * random walk — and not one of them was drawn. `easeInOut` and `easeOut` were
 * two words in a `<select>`; the only way to find out which is which was to
 * press Test and watch the mascot, across the window, in the column that was
 * 58 % of it.
 *
 * So each one gets a picture, and the pictures are made **here**, purely, from
 * the same maths the runtime runs:
 *
 * - the easing is `runtime/transitions.js`'s own four curves;
 * - a behaviour is sampled through `createBehaviorController`, the scheduler
 *   the exported mascot uses, with a seeded random so the same behaviour draws
 *   the same picture twice and a test can assert on it.
 *
 * Nothing here touches a document, a store or a DOM. It returns numbers and
 * path strings.
 */
import { composeBehaviorParams, createBehaviorController, normalizeBehavior } from '../../../runtime/runtime.js';

/* ── Easing ───────────────────────────────────────────────────────────────── */

/**
 * The four the runtime has, each with the sentence that says what it feels
 * like. The names alone were the problem: "Ease In Out" tells an author
 * nothing they can picture.
 */
export const EASINGS = Object.freeze([
  Object.freeze({ id: 'linear', label: 'Linear', hint: 'One speed throughout. Mechanical.' }),
  Object.freeze({ id: 'easeIn', label: 'Ease in', hint: 'Starts slowly, arrives fast. Falling.' }),
  Object.freeze({ id: 'easeOut', label: 'Ease out', hint: 'Leaves fast, settles gently. Landing.' }),
  Object.freeze({ id: 'easeInOut', label: 'Ease in-out', hint: 'Slow at both ends. Natural, and the default.' })
]);

export const EASING_IDS = Object.freeze(EASINGS.map((entry) => entry.id));
export const easingMeta = (id) => EASINGS.find((entry) => entry.id === id) || EASINGS[3];

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));

/**
 * The runtime's own easing, copied rather than imported on purpose: this is a
 * *picture* of what the runtime does, and a picture that silently followed a
 * change in the engine would stop being evidence. `mixer-transitions.test.js`
 * holds the two in step.
 */
export function easeValue(t, easing = 'easeInOut') {
  const value = clamp01(t);
  if (easing === 'linear') return value;
  if (easing === 'easeIn') return value * value;
  if (easing === 'easeOut') return 1 - (1 - value) * (1 - value);
  return value < .5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
}

const round = (value) => Math.round(value * 100) / 100;

/**
 * One easing as an SVG path, in a box `width × height`, drawn the way a curve
 * is read: time left to right, value bottom to top.
 */
export function easingPath(easing = 'easeInOut', { width = 120, height = 80, samples = 32 } = {}) {
  const points = [];
  for (let step = 0; step <= samples; step += 1) {
    const t = step / samples;
    points.push(`${round(t * width)} ${round(height - easeValue(t, easing) * height)}`);
  }
  return `M ${points.join(' L ')}`;
}

/** Where the playhead is on that curve, for the dot that runs it. */
export const easingPoint = (easing, t, { width = 120, height = 80 } = {}) =>
  ({ x: round(clamp01(t) * width), y: round(height - easeValue(clamp01(t), easing) * height) });

/* ── Duration ─────────────────────────────────────────────────────────────── */

/**
 * Named stops, because "300" is not a feeling and "Normal" is.
 *
 * The slider walks these; the number beside it stays editable, so an author
 * who wants 340 ms still has it. Every value is one the mascot can actually
 * show: below ~80 ms a cross-fade is a cut, and past ~1.2 s a transition
 * reads as a separate animation rather than a move between two poses.
 */
export const DURATION_STOPS = Object.freeze([
  Object.freeze({ ms: 0, label: 'Instant' }),
  Object.freeze({ ms: 80, label: 'Snap' }),
  Object.freeze({ ms: 120, label: 'Brisk' }),
  Object.freeze({ ms: 200, label: 'Quick' }),
  Object.freeze({ ms: 300, label: 'Normal' }),
  Object.freeze({ ms: 450, label: 'Smooth' }),
  Object.freeze({ ms: 650, label: 'Slow' }),
  Object.freeze({ ms: 900, label: 'Lazy' }),
  Object.freeze({ ms: 1200, label: 'Dreamy' })
]);

/** The stop a duration is at or nearest to, which is what the slider shows. */
export function nearestDurationStop(ms) {
  const value = Number.isFinite(Number(ms)) ? Number(ms) : 300;
  let best = 0;
  for (let index = 1; index < DURATION_STOPS.length; index += 1) {
    if (Math.abs(DURATION_STOPS[index].ms - value) < Math.abs(DURATION_STOPS[best].ms - value)) best = index;
  }
  return best;
}

/** How a duration reads: the stop's word when it is one, the number otherwise. */
export function durationLabel(ms) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  const stop = DURATION_STOPS[nearestDurationStop(value)];
  return stop.ms === value ? `${stop.label} · ${value} ms` : `${value} ms`;
}

/* ── Reaction timing ──────────────────────────────────────────────────────── */

/**
 * Attack, hold and release as three proportional segments.
 *
 * Three numbers in three fields never said that a "fast" reaction spends most
 * of its life holding; a bar does, at a glance, and it is the same three
 * numbers underneath.
 */
export function timingSegments(timing = {}) {
  const parts = [
    { key: 'attack', label: 'In', seconds: Math.max(0, Number(timing.attack) || 0) },
    { key: 'hold', label: 'Hold', seconds: Math.max(0, Number(timing.hold) || 0) },
    { key: 'release', label: 'Out', seconds: Math.max(0, Number(timing.release) || 0) }
  ];
  const total = parts.reduce((sum, part) => sum + part.seconds, 0);
  return {
    total: round(total),
    parts: parts.map((part) => ({ ...part, share: total > 0 ? round((part.seconds / total) * 100) : round(100 / 3) }))
  };
}

/* ── Behaviour waveforms ──────────────────────────────────────────────────── */

/** A seeded random, so the same behaviour draws the same picture twice. */
export function seededRandom(seed = 1) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * What a behaviour will actually do, sampled.
 *
 * Through the runtime's own controller and `composeBehaviorParams`, so the
 * picture is the mascot's movement rather than an illustration of it: a blink's
 * double-close, a drift's rest between moves and an oscillator's offset are all
 * in it, because none of them is re-implemented here.
 *
 * @param {object} behavior  a behaviour record, normalized or not
 * @param {{min?: number, max?: number, default?: number}} param the movement it moves
 * @param {{seconds?: number, samples?: number, seed?: number}} options
 * @returns {{points: number[], seconds: number, min: number, max: number, base: number}}
 */
export function behaviorTrace(behavior, param = {}, { seconds = 8, samples = 160, seed = 7 } = {}) {
  const normalized = normalizeBehavior({ ...behavior, enabled: true });
  const key = normalized.parameter;
  const base = Number.isFinite(Number(param.default)) ? Number(param.default) : 0;
  const controller = createBehaviorController({ random: seededRandom(seed) });
  const points = [];
  for (let step = 0; step <= samples; step += 1) {
    const time = (step / samples) * seconds;
    const runtime = controller.evaluate([normalized], time);
    points.push(Number(composeBehaviorParams({ [key]: base }, [normalized], time, runtime)[key]) || 0);
  }
  const low = Number.isFinite(Number(param.min)) ? Number(param.min) : Math.min(...points);
  const high = Number.isFinite(Number(param.max)) ? Number(param.max) : Math.max(...points);
  return { points, seconds, min: Math.min(low, ...points), max: Math.max(high, ...points), base };
}

/**
 * A trace as an SVG path. Kept apart from the sampling so a test asserts on
 * numbers and a view asks for a string.
 */
export function tracePath(trace, { width = 240, height = 64 } = {}) {
  const { points, min, max } = trace;
  if (!points?.length) return '';
  const span = max - min || 1;
  const at = (index) => `${round((index / (points.length - 1)) * width)} ${round(height - ((points[index] - min) / span) * height)}`;
  return `M ${points.map((_, index) => at(index)).join(' L ')}`;
}

/** Where rest sits in that box, for the dotted line a waveform is read against. */
export const traceBaseline = (trace, { height = 64 } = {}) => {
  const span = trace.max - trace.min || 1;
  return round(height - ((trace.base - trace.min) / span) * height);
};

/**
 * How long a behaviour has to be watched before it has shown what it does.
 *
 * A 0.3 Hz oscillator is three seconds of picture and a blink resting six
 * seconds between closes is twelve; one fixed window would draw a flat line
 * for one of them.
 */
export function traceWindow(behavior = {}) {
  const item = normalizeBehavior(behavior);
  if (item.type === 'oscillator') return Math.max(3, Math.min(20, 3 / Math.max(.05, item.frequency)));
  if (item.type === 'blink') return Math.max(6, Math.min(24, item.intervalMax * 2.2));
  return Math.max(6, Math.min(24, (item.intervalMax + (item.travelMax || 0)) * 2.2));
}
