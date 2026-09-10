/**
 * Hand rigging (docs/HAND_RIGGING.md, docs/HAND_STYLES.md).
 *
 * Authoring helpers for the two floating hands. Pure and immutable: every
 * function returns a new hands block, so undo keeps working by snapshot.
 *
 * The maths — reach softening, anchor drift, which style is showing — lives in
 * `project/runtime/hands.js` and is not duplicated here.
 */
import {
  normalizeHand, normalizeHands, normalizeHandInertia,
  handOffset, softenReach, applyElementTransform, HAND_SIDES
} from '../../../runtime/runtime.js';

export { normalizeHand, normalizeHands, normalizeHandInertia, handOffset, softenReach, HAND_SIDES };

const capital = (side) => side === 'right' ? 'R' : 'L';

/**
 * Parameters a hand needs, created when the hand is assigned.
 *
 * Where it is, how far it is turned, how big it is and how near
 * (docs/HAND_STYLES.md, "The model"). Which drawing it shows is the fifth, and
 * it is added with the hand's library rather than here: a hand with no
 * drawings has nothing for it to index.
 */
export function handParameters(side) {
  const c = capital(side);
  return {
    [`hand${c}X`]: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    [`hand${c}Y`]: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    [`hand${c}Rotation`]: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    [`hand${c}Scale`]: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    [`hand${c}Depth`]: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
  };
}

/** Assign artwork to a side. Returns the new hands block and the parameters to add. */
export function assignHand(hands, side, { element, parent = null, anchor = null, reach = null } = {}) {
  if (!HAND_SIDES.includes(side)) return { ok: false, reason: 'unknown-side', message: 'A hand is either left or right.' };
  if (!element) return { ok: false, reason: 'missing-artwork', message: 'Choose the artwork that draws this hand.' };
  const existing = hands?.[side];
  const hand = normalizeHand({
    ...(existing || {}), element, parent: parent ?? existing?.parent ?? null,
    anchor: anchor ?? existing?.anchor, reach: reach ?? existing?.reach
  }, side);
  return { ok: true, hands: { ...(hands || {}), [side]: hand }, parameters: handParameters(side) };
}

export function removeHand(hands, side) {
  if (!hands?.[side]) return hands;
  const next = { ...hands };
  delete next[side];
  return Object.keys(next).length ? next : null;
}

const update = (hands, side, patch) => hands?.[side]
  ? { ...hands, [side]: normalizeHand({ ...hands[side], ...patch }, side) }
  : hands;

export const setHandAnchor = (hands, side, anchor) => update(hands, side, { anchor });
export const setHandParent = (hands, side, parent) => update(hands, side, { parent });
export const setHandRestOffset = (hands, side, restOffset) => update(hands, side, { restOffset });
export const setHandReach = (hands, side, reach) => update(hands, side, { reach: { ...(hands?.[side]?.reach || {}), ...reach } });
export const setHandDepth = (hands, side, depth) => update(hands, side, { depth });
export const setHandSoftness = (hands, side, softness) => update(hands, side, { softness });
export const setHandInertia = (hands, side, inertia) => update(hands, side, { inertia: { ...(hands?.[side]?.inertia || {}), ...inertia } });

/**
 * Which style a hand rests on, and how it gets from one to the next
 * (docs/HAND_STYLES.md). A patch on the library, so a hand with no drawings is
 * left alone rather than given an empty one.
 */
export const setHandStyles = (hands, side, patch) => (hands?.[side]?.styles
  ? update(hands, side, { styles: { ...hands[side].styles, ...patch } })
  : hands);

/* ── Reach guide ─────────────────────────────────────────────────────────── */

/**
 * The reach ellipse to draw around an anchor, in the artwork's coordinates.
 * `((x / reachX)² + (y / reachY)²) ≤ 1`, offset by the hand's rest position.
 */
export function handReachEllipse(hand, elements = {}) {
  if (!hand) return null;
  // The hand rests where its drawing is: at its anchor, plus whatever the
  // artwork's own base transform moves it by (the builder's Position; a turn
  // or a resize is about the pivot and moves nothing), in the parent's space.
  const own = elements?.[hand.element]?.baseTransform;
  const local = { x: hand.anchor.x + (Number(own?.x) || 0), y: hand.anchor.y + (Number(own?.y) || 0) };
  const anchor = hand.parent && elements?.[hand.parent]?.baseTransform
    ? applyElementTransform(elements[hand.parent].baseTransform, local)
    : local;
  return {
    cx: anchor.x + hand.restOffset.x,
    cy: anchor.y + hand.restOffset.y,
    rx: hand.reach.x,
    ry: hand.reach.y,
    // How far outside the ellipse the soft limit still allows.
    overshoot: hand.softness
  };
}

/** Whether a normalized input is inside the reach, before softening. */
export function withinReach(x, y) {
  return Math.hypot(Number(x) || 0, Number(y) || 0) <= 1;
}

/* ── Mirroring ───────────────────────────────────────────────────────────── */

/**
 * Copy one hand's **placement** onto the other side.
 *
 * Anchors and rest offsets mirror around `mirrorX` (the artwork's vertical
 * centre line), and the rotation reach flips sign so a "wave outwards" stays
 * outwards. Nothing about a hand's *appearance* is copied: the two hands hold
 * their own libraries and choose their own styles, independently
 * (docs/HAND_STYLES.md, "Two hands"), and the drawings themselves are already
 * mirrored per side by the registry.
 */
export function mirrorHand(hands, from, { mirrorX = 0, element = null } = {}) {
  const source = hands?.[from];
  if (!source) return hands;
  const to = from === 'left' ? 'right' : 'left';
  const target = hands?.[to];
  const mirrored = normalizeHand({
    ...source,
    element: element || target?.element || source.element,
    parent: source.parent,
    anchor: { x: 2 * mirrorX - source.anchor.x, y: source.anchor.y },
    restOffset: { x: -source.restOffset.x, y: source.restOffset.y },
    reach: { ...source.reach, rotation: -source.reach.rotation },
    parameters: undefined,
    // The other hand keeps whatever drawings and poses it already had.
    styles: target?.styles ?? undefined,
    poses: target?.poses ?? []
  }, to);
  return { ...(hands || {}), [to]: mirrored };
}
