/**
 * Getting from one hand drawing to the next (docs/HANDS_2D.md).
 *
 * ```text
 * drawing asked for ─→ HandSwap ─→ { showing, opacity, leaving, leavingOpacity }
 * ```
 *
 * The one thing between "which picture does this hand want" and "what is on
 * screen". It does **not** deform a drawing and it does not invent one: there
 * is no skew here, no perspective, no squash and no geometric interpolation
 * between two pictures. The only thing blended is opacity, and only for a
 * fraction of a second.
 *
 * Whatever a drawing does on its own — a fist closing, a thumb going up — is
 * that drawing's own rig, driven by its own parameter, and none of this
 * module's business.
 */
import { clamp, finite } from './numeric.js';

/* ── Swapping drawings ─────────────────────────────────────────────────────── */

/**
 * How a hand gets from one drawing to the next.
 *
 * * `cut` — the new drawing, this frame. Cheapest, and right for a hand that
 *   is moving fast enough that nobody reads the frame it changed on.
 * * `crossfade` — both drawings for a fraction of a second, the old one
 *   fading out by exactly as much as the new one fades in. Deliberately
 *   **short**: a long cross-fade between two hands is a double exposure, not
 *   an animation.
 * * `hidden` — the change is held until the hand is invisible or off screen,
 *   then taken instantly. A floating hand leaves the frame all the time, and
 *   a swap nobody saw is the cleanest swap there is.
 */
export const HAND_SWAP_MODES = Object.freeze(['cut', 'crossfade', 'hidden']);
export const DEFAULT_HAND_SWAP = 'crossfade';
/** Long enough to take the edge off a cut, short enough not to read as a fade. */
export const HAND_SWAP_SECONDS = 0.08;

export const handSwapMode = (value) => (HAND_SWAP_MODES.includes(value) ? value : DEFAULT_HAND_SWAP);

/**
 * The little state machine behind a swap.
 *
 * `step(drawingId, delta, { hidden })` returns what to draw: the incoming
 * drawing and its opacity, and the outgoing one and its opacity while the
 * fade lasts. Deterministic — the same deltas give the same opacities — so a
 * test can drive it frame by frame.
 */
export function createHandSwap({ mode = DEFAULT_HAND_SWAP, seconds = HAND_SWAP_SECONDS, drawing = null } = {}) {
  const how = handSwapMode(mode);
  const span = Math.max(0, finite(seconds, HAND_SWAP_SECONDS));
  let showing = drawing;    // what is on screen
  let pending = null;       // what is waiting for the hand to go away (`hidden`)
  let leaving = null;       // what is fading out
  let elapsed = span;
  return {
    get showing() { return showing; },
    get leaving() { return elapsed < span ? leaving : null; },
    /** Whether the drawing on screen is the one that was asked for. */
    get settled() { return elapsed >= span && pending === null; },
    mode: how,
    seconds: span,
    /**
     * @param {?string} next the drawing the hand wants now
     * @param {number} delta seconds since the last frame
     * @param {{hidden?: boolean}} options `hidden` is true while nothing of the hand is on screen
     */
    step(next, delta = 0, { hidden = false } = {}) {
      const dt = Math.max(0, finite(delta, 0));
      elapsed += dt;
      if (next !== showing) {
        if (how === 'hidden' && !hidden) {
          // Hold the change until the hand is out of sight, and keep holding
          // it if the hand changes its mind again on the way.
          pending = next;
        } else if (how === 'crossfade' && !hidden && showing) {
          leaving = showing; showing = next; elapsed = 0; pending = null;
        } else {
          leaving = null; showing = next; elapsed = span; pending = null;
        }
      } else if (pending !== null) {
        // The hand wants what it is already showing, so a change waiting for
        // it to hide is stale: a hand that changes its mind back never swaps.
        pending = null;
      }
      if (pending !== null && hidden) { leaving = null; showing = pending; pending = null; elapsed = span; }
      const t = span > 0 ? Math.min(1, elapsed / span) : 1;
      return {
        showing,
        opacity: showing === null ? 0 : clamp(t, 0, 1),
        leaving: t < 1 ? leaving : null,
        leavingOpacity: t < 1 ? clamp(1 - t, 0, 1) : 0,
        settled: t >= 1 && pending === null
      };
    },
    /** Forget the fade and show `next` outright: a seek, a reset, a first frame. */
    reset(next = showing) { showing = next; leaving = null; pending = null; elapsed = span; }
  };
}

/**
 * A hand off the edge of the artboard.
 *
 * A floating hand is allowed to leave — it is how a mascot brings one in, and
 * how a drawing change is hidden. `bounds` is the artboard; `radius` how big
 * the drawing is around its pivot.
 */
export function isHandOffscreen({ x = 0, y = 0 } = {}, bounds = null, radius = 0) {
  if (!bounds) return false;
  const r = Math.max(0, finite(radius, 0));
  return finite(x, 0) + r < finite(bounds.x, 0)
    || finite(y, 0) + r < finite(bounds.y, 0)
    || finite(x, 0) - r > finite(bounds.x, 0) + finite(bounds.width, 0)
    || finite(y, 0) - r > finite(bounds.y, 0) + finite(bounds.height, 0);
}
