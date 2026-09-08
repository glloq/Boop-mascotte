/**
 * A hand, drawn (docs/HANDS_2D.md, PHASE 10).
 *
 * ```text
 * hand state  ─→  HandSprite  ─→  { asset, transform, opacity }
 *                     │
 *                     ├─ which drawing        (hand-assets.js)
 *                     ├─ where it goes        translate · rotate · scale · flip
 *                     └─ whether it is seen   visible · a short swap
 * ```
 *
 * The one abstraction between "what this hand is doing" and "what is on
 * screen". It selects a drawing and places it. It does **not** deform one:
 * there is no skew here, no perspective, no squash, no finger morph and no
 * geometric interpolation between two drawings — a hand that turns swaps to a
 * drawing of the turn, and everything else it does is a transform of the whole
 * thing (PHASES 11, 15).
 *
 * Pure: a sprite holds the drawing it last showed, so it can tell a swap from
 * a hold, and nothing else. No DOM, no timers, no loading.
 */
import { createHandAssetCache, EMPTY_HAND_LIBRARY, resolveHandAsset } from './hand-assets.js';
import { createHandViewSelector, selectHandView, handRotationAdvice } from './hand-view-select.js';
import { DEFAULT_HAND_VIEW_MODE } from './hand-view-select.js';
import { normalizeHandState } from './hand-vocabulary.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp01 = (value) => Math.max(0, Math.min(1, number(value, 0)));

/* ── Swapping drawings (PHASE 15) ──────────────────────────────────────────── */

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
 *   then taken instantly. A floating hand leaves the frame all the time
 *   (PHASE 14), and a swap nobody saw is the cleanest swap there is.
 *
 * Nothing here interpolates geometry. Two hands are two drawings; the only
 * thing blended is opacity.
 */
export const HAND_SWAP_MODES = Object.freeze(['cut', 'crossfade', 'hidden']);
export const DEFAULT_HAND_SWAP = 'crossfade';
/** Long enough to take the edge off a cut, short enough not to read as a fade. */
export const HAND_SWAP_SECONDS = 0.08;

export const handSwapMode = (value) => (HAND_SWAP_MODES.includes(value) ? value : DEFAULT_HAND_SWAP);

/**
 * The little state machine behind a swap.
 *
 * `step(assetId, delta, { hidden })` returns what to draw: the incoming
 * drawing and its opacity, and the outgoing one and its opacity while the
 * fade lasts. Deterministic — the same deltas give the same opacities — so a
 * test can drive it frame by frame.
 */
export function createHandSwap({ mode = DEFAULT_HAND_SWAP, seconds = HAND_SWAP_SECONDS, asset = null } = {}) {
  const how = handSwapMode(mode);
  const span = Math.max(0, number(seconds, HAND_SWAP_SECONDS));
  let showing = asset;      // what is on screen
  let pending = null;       // what is waiting for the hand to go away (`hidden`)
  let leaving = null;       // what is fading out
  let elapsed = span;
  return {
    get showing() { return showing; },
    get leaving() { return elapsed < span ? leaving : null; },
    mode: how,
    seconds: span,
    /**
     * @param {?string} next the drawing the hand wants now
     * @param {number} delta seconds since the last frame
     * @param {{hidden?: boolean}} options `hidden` is true while nothing of the hand is on screen
     */
    step(next, delta = 0, { hidden = false } = {}) {
      const dt = Math.max(0, number(delta, 0));
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
      } else if (pending === next) pending = null;
      if (pending !== null && hidden) { leaving = null; showing = pending; pending = null; elapsed = span; }
      const t = span > 0 ? Math.min(1, elapsed / span) : 1;
      return {
        showing,
        opacity: showing === null ? 0 : t,
        leaving: t < 1 ? leaving : null,
        leavingOpacity: t < 1 ? 1 - t : 0,
        settled: t >= 1 && pending === null
      };
    },
    /** Forget the fade and show `asset` outright: a seek, a reset, a first frame. */
    reset(next = showing) { showing = next; leaving = null; pending = null; elapsed = span; }
  };
}

/* ── The sprite ────────────────────────────────────────────────────────────── */

/**
 * One hand's drawing and its placement.
 *
 * Given a hand's state — pose, view, face, x, y, rotation, scale, flip,
 * visibility — it reports the drawing to show and the transform to show it
 * under. The transform is the hand's own, untouched: this is the seam PHASE 2
 * asks for, and the reason a pose change can never move a hand and a move can
 * never change a pose.
 *
 * @param {object} options
 * @param {object} options.library a hand set from `createHandAssetLibrary`
 * @param {string} options.side which hand this is
 * @param {object} options.view `{ mode, thresholds, hysteresis, sweep }`
 * @param {?(report: object) => void} options.warn told about every inexact resolution (PHASE 49)
 */
export function createHandSprite({ library = EMPTY_HAND_LIBRARY, side = 'left', view: viewOptions = {}, swap = {}, warn = null } = {}) {
  const cache = createHandAssetCache(library, { warn });
  const selector = createHandViewSelector({ thresholds: viewOptions?.thresholds, hysteresis: viewOptions?.hysteresis, view: viewOptions?.view });
  const swapper = createHandSwap(swap);
  const mode = viewOptions?.mode ?? DEFAULT_HAND_VIEW_MODE;
  const sweep = viewOptions?.sweep;
  return {
    side,
    library,
    selector,
    swap: swapper,
    /**
     * What to draw this frame.
     *
     * @param {object} state a hand state (`normalizeHandState`)
     * @param {{delta?: number, orientation?: ?number, angle?: ?number, hidden?: boolean}} frame
     * @returns {{asset, view, pose, face, flipX, transform, opacity, leaving, leavingOpacity, fallback, missing, rotationAdvice}}
     */
    resolve(state = {}, { delta = 0, orientation = null, angle = null, hidden = false } = {}) {
      const hand = normalizeHandState(state, side);
      const view = selectHandView({ mode, view: hand.view, angle, orientation, sweep, thresholds: selector.thresholds }, selector);
      const chosen = cache.resolve({ side: hand.side, pose: hand.pose, view, face: hand.face });
      const invisible = hidden || hand.visible === false;
      const step = swapper.step(chosen.asset ? chosen.asset.id : null, delta, { hidden: invisible });
      // The drawing's own mirroring and the hand's own flip compose: a
      // mirrored asset on a flipped hand is the drawing as it was drawn.
      const flipX = chosen.flipX !== (hand.flipX === true);
      return {
        asset: chosen.asset,
        pose: chosen.pose, view, face: chosen.face,
        fallback: chosen.fallback, missing: chosen.missing, exact: chosen.exact,
        flipX,
        transform: {
          x: hand.x, y: hand.y,
          rotation: hand.rotation,
          scale: hand.scale * (chosen.asset?.defaultScale ?? 1),
          flipX,
          pivot: chosen.asset?.pivot || library?.pivot || null
        },
        visible: hand.visible !== false,
        opacity: hand.visible === false ? 0 : clamp01(step.opacity),
        leaving: step.leaving,
        leavingOpacity: hand.visible === false ? 0 : clamp01(step.leavingOpacity),
        settled: step.settled,
        rotationAdvice: handRotationAdvice(hand.rotation, chosen.asset?.preferredRotation)
      };
    },
    /** Show the current drawing outright: a seek, a reset, the first frame. */
    reset(state = {}) {
      const hand = normalizeHandState(state, side);
      selector.set(hand.view);
      swapper.reset(resolveHandAsset(library, { side: hand.side, pose: hand.pose, view: hand.view, face: hand.face }).asset?.id ?? null);
    }
  };
}

/**
 * A hand off the edge of the artboard (PHASE 14).
 *
 * A floating hand is allowed to leave — it is how a mascot brings one in, and
 * how a sprite change is hidden. `bounds` is the artboard; `radius` how big
 * the drawing is around its pivot.
 */
export function isHandOffscreen({ x = 0, y = 0 } = {}, bounds = null, radius = 0) {
  if (!bounds) return false;
  const r = Math.max(0, number(radius, 0));
  return number(x, 0) + r < number(bounds.x, 0)
    || number(y, 0) + r < number(bounds.y, 0)
    || number(x, 0) - r > number(bounds.x, 0) + number(bounds.width, 0)
    || number(y, 0) - r > number(bounds.y, 0) + number(bounds.height, 0);
}
