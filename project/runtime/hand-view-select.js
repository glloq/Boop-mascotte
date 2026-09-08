/**
 * Choosing a view (docs/HANDS_2D.md, PHASES 16–19).
 *
 * ```text
 *  −90°        −67.5°      −22.5°       +22.5°      +67.5°       +90°
 *   ├── sideLeft ──┼── 3/4 left ──┼── front ──┼── 3/4 right ──┼── sideRight ──┤
 * ```
 *
 * A rig that already knows which way a hand is turned — the old facing axis,
 * a look-at, an author's slider — hands that number over and gets one of five
 * drawings back. The thresholds are configurable, because the interesting
 * choice is not where they sit but that they exist at all: the hand shows a
 * drawing, never a blend of two.
 *
 * **Hysteresis is the whole point of the module.** Bare thresholds turn a hand
 * hovering on a boundary into a strobe — front, 3/4, front, 3/4, once a frame —
 * which is worse than either drawing. So leaving a view costs a few more
 * degrees than entering it did (PHASE 17), and a hand that drifts across a
 * boundary and back stays where it was.
 *
 * Automatic is never compulsory (PHASE 18): in `manual` mode the chosen view
 * is simply kept, and nothing here runs.
 *
 * Pure: a selector is a small object holding which view it last returned.
 */
import { DEFAULT_HAND_VIEW, HAND_VIEWS, handViewId, handViewIndex } from './hand-vocabulary.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * The four boundaries between the five views, in degrees.
 *
 * Halfway between the angles the drawings stand for: `front` owns ±22.5°,
 * each three-quarter the 45° around its own 45°, and the sides everything
 * past 67.5°. Even bands, so no drawing is starved.
 */
export const HAND_VIEW_THRESHOLDS = Object.freeze([-67.5, -22.5, 22.5, 67.5]);

/**
 * How far past a boundary a hand must go before it changes drawing, in degrees.
 *
 * Six is about a seventh of a band: enough that a hand shaking on the boundary
 * of two views keeps one of them, small enough that a deliberate turn still
 * lands on the drawing an author expects.
 */
export const HAND_VIEW_HYSTERESIS = 6;

/** What `±1` on a normalized orientation parameter means, in degrees. */
export const HAND_VIEW_SWEEP = 90;

/** How a hand picks its view: from an orientation, or because someone said so. */
export const HAND_VIEW_MODES = Object.freeze(['auto', 'manual']);
export const DEFAULT_HAND_VIEW_MODE = 'manual';
export const handViewMode = (value) => (value === 'auto' ? 'auto' : 'manual');

/** Four ascending boundaries, whatever was configured. */
export function normalizeHandViewThresholds(source) {
  const raw = Array.isArray(source) ? source.map((value) => number(value, NaN)).filter(Number.isFinite) : [];
  if (raw.length !== HAND_VIEW_THRESHOLDS.length) return [...HAND_VIEW_THRESHOLDS];
  const sorted = [...raw].sort((a, b) => a - b);
  return sorted;
}

/** A normalized `−1 … 1` orientation as degrees. */
export const handViewAngleFromValue = (value, sweep = HAND_VIEW_SWEEP) => clamp(number(value, 0), -1, 1) * Math.abs(number(sweep, HAND_VIEW_SWEEP));

/**
 * The view an angle falls in, with no memory (PHASE 16).
 *
 * ```js
 * if (angle <= -67.5) 'sideLeft';
 * else if (angle <= -22.5) 'threeQuarterLeft';
 * else if (angle < 22.5) 'front';
 * else if (angle < 67.5) 'threeQuarterRight';
 * else 'sideRight';
 * ```
 *
 * Every band is half-open, `[low, high)`, so an angle sitting exactly on a
 * threshold belongs to the view above it — the same rule at both ends of the
 * row rather than one rule for the negatives and another for the positives.
 * It matters only when a slider snaps to a stop, and then it matters that it
 * is the same answer every time.
 */
export function viewForAngle(angle, thresholds = HAND_VIEW_THRESHOLDS) {
  const bounds = normalizeHandViewThresholds(thresholds);
  const value = number(angle, 0);
  for (let i = 0; i < bounds.length; i += 1) if (value < bounds[i]) return HAND_VIEWS[i].id;
  return HAND_VIEWS[HAND_VIEWS.length - 1].id;
}

/** The band a view owns, in degrees: `[low, high)`, open at either end of the row. */
export function handViewBand(view, thresholds = HAND_VIEW_THRESHOLDS) {
  const bounds = normalizeHandViewThresholds(thresholds);
  const at = handViewIndex(view);
  return [at === 0 ? -Infinity : bounds[at - 1], at === HAND_VIEWS.length - 1 ? Infinity : bounds[at]];
}

/**
 * A view chooser that remembers what it last said (PHASE 17).
 *
 * The current view keeps its band **widened by the hysteresis on both sides**,
 * so an angle inside the widened band changes nothing and an angle outside it
 * is classified afresh. Widening rather than counting boundary crossings means
 * a hand that jumps three views in one frame still lands on the right drawing:
 * the memory only ever holds a decision back a few degrees, it never drags one
 * along.
 */
export function createHandViewSelector({ thresholds = HAND_VIEW_THRESHOLDS, hysteresis = HAND_VIEW_HYSTERESIS, view = DEFAULT_HAND_VIEW } = {}) {
  const bounds = normalizeHandViewThresholds(thresholds);
  const margin = Math.max(0, number(hysteresis, HAND_VIEW_HYSTERESIS));
  let current = handViewId(view) || DEFAULT_HAND_VIEW;
  return {
    get view() { return current; },
    thresholds: Object.freeze([...bounds]),
    hysteresis: margin,
    /** The view for this angle, holding on to the current one while it is close. */
    select(angle) {
      const value = number(angle, 0);
      const [low, high] = handViewBand(current, bounds);
      if (value >= low - margin && value < high + margin) return current;
      current = viewForAngle(value, bounds);
      return current;
    },
    /** Put the selector on a view without consulting an angle: manual mode, or a reset. */
    set(next) {
      current = handViewId(next) || DEFAULT_HAND_VIEW;
      return current;
    }
  };
}

/* ── The view a hand is actually showing (PHASES 18–19) ────────────────────── */

/**
 * Auto or manual, in one call.
 *
 * `rotation` is deliberately **not** an input. A hand drawn front-on and
 * turned 15° is still a hand drawn front-on; coupling the two would make every
 * small animated tilt a sprite swap, which is the pop the whole refit exists
 * to remove (PHASE 19). The orientation that picks a view is its own value.
 *
 * @param {{mode?: string, view?: string, angle?: number, sweep?: number}} request
 * @param {?object} selector from `createHandViewSelector`; without one, no hysteresis
 */
export function selectHandView({ mode = DEFAULT_HAND_VIEW_MODE, view = DEFAULT_HAND_VIEW, angle = null, orientation = null, sweep = HAND_VIEW_SWEEP, thresholds = HAND_VIEW_THRESHOLDS } = {}, selector = null) {
  if (handViewMode(mode) !== 'auto') {
    const held = handViewId(view) || DEFAULT_HAND_VIEW;
    selector?.set(held);
    return held;
  }
  // `null` is "no angle given", and `Number(null)` is 0 -- so ask whether an
  // angle was supplied at all before believing the number it converts to.
  const given = angle !== null && angle !== undefined && angle !== '' && Number.isFinite(Number(angle));
  const degrees = given ? number(angle, 0) : handViewAngleFromValue(orientation, sweep);
  return selector ? selector.select(degrees) : viewForAngle(degrees, thresholds);
}

/* ── Rotation advice (PHASE 20) ────────────────────────────────────────────── */

/**
 * Whether a turn is one this drawing is meant to take, and the nearest one
 * that is.
 *
 * Advice, not a clamp: an author who wants a hand upside down gets a hand
 * upside down. What the animation system gets is a way to *know* — so a
 * generated motion can stay inside the range, and the editor can say when a
 * keyframe has left it.
 */
export function handRotationAdvice(rotation, range) {
  const [low, high] = Array.isArray(range) && range.length === 2 ? range.map((value) => number(value, 0)) : [-180, 180];
  const value = number(rotation, 0);
  return { within: value >= low && value <= high, nearest: clamp(value, low, high), range: [low, high] };
}
