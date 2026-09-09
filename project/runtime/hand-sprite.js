/**
 * Putting a hand on screen (docs/HAND_STYLES.md).
 *
 * ```text
 * style asked for ─→ resolveHandStyle ─→ asset + flipX
 * hand state       ─→ handSpriteTransform ─→ translate · rotate · scale · flip
 * a change of style ─→ HandSwap ─→ which asset is showing
 * ```
 *
 * The whole of what happens between "which hand does this want" and "what is
 * on screen". It does **not** deform a drawing and it does not invent one:
 * there is no skew, no perspective, no squash, no morphing and no geometric
 * interpolation between two pictures. A style is a sprite, and a change of
 * style is a sprite swap.
 *
 * Pure: no DOM, no assets, no state beyond one swap's memory of what it is
 * showing.
 */
import { finite } from './numeric.js';
import { DEFAULT_HAND_STYLE, resolveHandStyle } from './hand-vocabulary.js';

/* ── One hand, one transform ───────────────────────────────────────────────── */

/**
 * What to draw a hand's sprite with: which asset, and the transform that puts
 * it where the hand is.
 *
 * ```js
 * handSpriteTransform({ style: 'open', x: 120, y: 180, rotation: 12, scale: 1 }, 'right')
 * // { asset: 'open', visible: true, x: 120, y: 180, rotation: 12, scaleX: -1, scaleY: 1 }
 * ```
 *
 * `scaleX` carries the mirror, so a style drawn once serves both hands
 * (docs/HAND_STYLES.md, "Mirroring"): the right hand's sprite is the same file
 * with a negative x scale, around the same pivot. A hand may also be flipped
 * by hand (`flipX`), and the two flips cancel exactly as they should.
 *
 * Nothing here is per-frame geometry: a frame is a transform and a visibility,
 * and that is the entire cost of a moving hand.
 */
export function handSpriteTransform(state = {}, side = 'left') {
  const resolved = resolveHandStyle(state?.style ?? DEFAULT_HAND_STYLE, side);
  const scale = finite(state?.scale, 1);
  const mirrored = resolved.flipX !== (state?.flipX === true);
  return {
    style: resolved.id,
    asset: resolved.asset,
    visible: state?.visible !== false,
    x: finite(state?.x, 0),
    y: finite(state?.y, 0),
    rotation: finite(state?.rotation, 0),
    scaleX: mirrored ? -scale : scale,
    scaleY: scale
  };
}

/* ── Swapping styles ───────────────────────────────────────────────────────── */

/**
 * How a hand gets from one style to the next.
 *
 * * `cut` — the new drawing, this frame. A change of style is a change of
 *   picture, and a picture changes at once: put it under a fast movement, at
 *   the start of a gesture, or wherever nobody reads the frame it changed on
 *   (docs/HAND_STYLES.md, "Changing style mid-animation").
 * * `hidden` — the change is held until nobody can see the hand, then taken
 *   instantly. A floating hand is out of sight all the time — behind the head
 *   at rest, faded out, off on an errand — and a swap nobody saw is the
 *   cleanest swap there is.
 *
 * There is no third mode and no transition engine. A cross-fade between two
 * hands is a double exposure, and blending two drawings is the thing this
 * system exists to not do.
 */
export const HAND_SWAP_MODES = Object.freeze(['cut', 'hidden']);
export const DEFAULT_HAND_SWAP = 'cut';

/** A swap mode as the system knows it; the former `crossfade` reads as a cut. */
export const handSwapMode = (value) => (HAND_SWAP_MODES.includes(value) ? value : DEFAULT_HAND_SWAP);

/**
 * The little state machine behind a swap.
 *
 * `step(styleId, { hidden })` returns what to draw. Deterministic and
 * memoryless apart from what is on screen, so a test can drive it frame by
 * frame and a frame costs one comparison.
 */
export function createHandSwap({ mode = DEFAULT_HAND_SWAP, style = null } = {}) {
  const how = handSwapMode(mode);
  let showing = style;   // what is on screen
  let pending = null;    // what is waiting for the hand to go away (`hidden`)
  return {
    get showing() { return showing; },
    /** Whether the style on screen is the one that was asked for. */
    get settled() { return pending === null; },
    mode: how,
    /**
     * @param {?string} next the style the hand wants now
     * @param {{hidden?: boolean}} options `hidden` is true while nobody can see the hand
     */
    step(next, { hidden = false } = {}) {
      if (next !== showing) {
        // Held until the hand is out of sight, and kept held if the hand
        // changes its mind again on the way. Never on the first frame: a hand
        // that has shown nothing yet has nothing to hold on to, so it cuts.
        if (how === 'hidden' && !hidden && showing !== null) pending = next;
        else { showing = next; pending = null; }
      } else if (pending !== null) {
        // The hand wants what it is already showing, so a change waiting for
        // it to hide is stale: a hand that changes its mind back never swaps.
        pending = null;
      }
      if (pending !== null && hidden) { showing = pending; pending = null; }
      return { showing, visible: showing !== null, settled: pending === null };
    },
    /** Forget any held change and show `next` outright: a seek, a reset, a first frame. */
    reset(next = showing) { showing = next; pending = null; }
  };
}
