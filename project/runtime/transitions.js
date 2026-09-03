/**
 * Continuous transitions (docs/CONTINUOUS_TRANSITIONS.md).
 *
 * The failure this module exists to prevent:
 *
 * ```text
 * Animation A → RESET NEUTRAL → Animation B
 * ```
 *
 * Every change starts from **the pose currently on screen**. Switching from
 * Happy to Angry cross-fades the two; it never passes through Neutral, and
 * never snaps.
 */
import { finite, clamp } from './numeric.js';

export const DEFAULT_TRANSITION_EASING = 'easeInOut';

function ease(t, easing) {
  const value = clamp(finite(t, 0), 0, 1);
  if (easing === 'linear') return value;
  if (easing === 'easeIn') return value * value;
  if (easing === 'easeOut') return 1 - (1 - value) * (1 - value);
  return value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
}

/**
 * Weights that ramp instead of jumping.
 *
 * `set` captures the weight that is **currently showing** as the start of the
 * ramp, so retargeting mid-transition continues from where the eye is rather
 * than restarting.
 */
export function createWeightBlender({ duration = 0, easing = DEFAULT_TRANSITION_EASING } = {}) {
  const entries = new Map();
  let clock = 0;

  const current = (entry) => {
    if (entry.duration <= 0) return entry.to;
    return entry.from + (entry.to - entry.from) * ease((clock - entry.started) / entry.duration, entry.easing);
  };

  const api = {
    /** @returns {boolean} whether anything changed */
    set(id, target, options = {}) {
      const to = clamp(finite(target, 0), 0, 1);
      const existing = entries.get(id);
      const from = existing ? current(existing) : 0;
      const span = Math.max(0, finite(options.duration, duration));
      if (existing && existing.to === to && existing.duration === span) return false;
      entries.set(id, { from, to, started: clock, duration: span, easing: options.easing || existing?.easing || easing });
      return true;
    },
    clear(id, options = {}) { return entries.has(id) ? api.set(id, 0, options) : false; },
    clearAll(options = {}) { for (const id of [...entries.keys()]) api.set(id, 0, options); },
    /**
     * Cross-fade to a single active weight. Every other weight ramps down over
     * the same span, so the two overlap and the pose never returns to neutral.
     */
    transitionTo(id, options = {}) {
      for (const other of [...entries.keys()]) if (other !== id) api.set(other, 0, options);
      if (id) api.set(id, options.weight === undefined ? 1 : options.weight, options);
    },
    /** Advance the clock. `delta` is in milliseconds. */
    advance(delta = 0) {
      clock += Math.max(0, finite(delta, 0));
      for (const [id, entry] of entries) {
        if (entry.duration > 0 && clock - entry.started < entry.duration) continue;
        if (entry.to === 0) entries.delete(id);
        else entries.set(id, { ...entry, from: entry.to, duration: 0, started: clock });
      }
      return api.values();
    },
    /** Weights as they look right now — what the renderer should use. */
    values() {
      const out = {};
      for (const [id, entry] of entries) {
        const value = current(entry);
        if (value !== 0) out[id] = value;
      }
      return out;
    },
    /** Weights that were asked for — what an API caller reads back. */
    targets() {
      const out = {};
      for (const [id, entry] of entries) if (entry.to !== 0) out[id] = entry.to;
      return out;
    },
    settled() {
      for (const entry of entries.values()) if (entry.duration > 0 && clock - entry.started < entry.duration) return false;
      return true;
    },
    reset() { entries.clear(); clock = 0; }
  };
  return api;
}

/**
 * A transition between two parameter vectors that starts from the vector on
 * screen. `from` is captured by the caller **at the moment of the change** —
 * that capture is the whole point.
 */
export function createParameterTransition(from = {}, to = {}, { duration = 300, easing = DEFAULT_TRANSITION_EASING, at = 0 } = {}) {
  const span = Math.max(0, finite(duration, 0));
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])];
  return {
    duration: span,
    done(now) { return span <= 0 || finite(now, 0) - at >= span; },
    /** @returns {Record<string, number>} the vector at `now` */
    at(now) {
      const progress = span <= 0 ? 1 : clamp((finite(now, 0) - at) / span, 0, 1);
      const eased = ease(progress, easing);
      const out = {};
      for (const key of keys) {
        const start = finite(from[key], finite(to[key], 0));
        const end = finite(to[key], start);
        out[key] = start + (end - start) * eased;
      }
      return out;
    }
  };
}
