/**
 * Hand rigging (docs/HAND_RIGGING.md).
 *
 * Authoring helpers for the two floating hands. Pure and immutable: every
 * function returns a new hands block, so undo keeps working by snapshot.
 *
 * The maths — reach softening, anchor drift, pose application — lives in
 * `project/runtime/hands.js` and is not duplicated here.
 */
import {
  normalizeHand, normalizeHands, normalizeHandPose, normalizeHandInertia,
  handOffset, softenReach, applyElementTransform, handPoseParameterName, HAND_SIDES, parseExpression
} from '../../../runtime/runtime.js';

export { normalizeHand, normalizeHands, normalizeHandInertia, handOffset, softenReach, HAND_SIDES };

const capital = (side) => side === 'right' ? 'R' : 'L';

/** Parameters a hand needs, created when the hand is assigned. */
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

/** The poses a mascot usually wants. None of them is mandatory. */
export const SUGGESTED_HAND_POSES = Object.freeze([
  { id: 'neutral', name: 'Neutral' }, { id: 'open', name: 'Open' }, { id: 'fist', name: 'Fist' },
  { id: 'point', name: 'Point' }, { id: 'wave', name: 'Wave' }, { id: 'peace', name: 'Peace' },
  { id: 'thumbsUp', name: 'Thumbs Up' }
]);

/** One naming rule, shared by the panel, the commands and reactions. */
export { handPoseParameterName as handPoseParameter };

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

export function addHandPose(hands, side, pose) {
  const hand = hands?.[side];
  if (!hand) return hands;
  const next = normalizeHandPose({ parameter: handPoseParameterName(side, pose?.id || ''), ...pose });
  if (!next.id) return hands;
  const poses = hand.poses.some((item) => item.id === next.id)
    ? hand.poses.map((item) => item.id === next.id ? next : item)
    : [...hand.poses, next];
  return update(hands, side, { poses });
}

export function removeHandPose(hands, side, poseId) {
  const hand = hands?.[side];
  if (!hand) return hands;
  return update(hands, side, { poses: hand.poses.filter((pose) => pose.id !== poseId) });
}

/* ── What a pose moves ───────────────────────────────────────────────────── */

const expressionUses = (expression, name) => {
  try { return parseExpression(expression).variables.includes(name); } catch { return false; }
};

/**
 * What raising this pose's parameter actually moves, or `null` when nothing.
 *
 * A pose used to be "ready" only when it carried a shape key or a piece of
 * artwork of its own. A hand made of parts (docs/HAND_REPRESENTATIONS_STUDY.md)
 * poses through keys *driven by the parameter* on several parts, through a
 * pose grid over it, or through a binding that reads it -- none of which sits on
 * the pose record. So the question is asked of the document, not of the pose.
 *
 * @returns {'shapeKey'|'variant'|'driver'|'keyform'|'binding'|null}
 */
export function handPoseDrive(document = {}, pose = {}, side = 'left') {
  if (pose?.shapeKey) return 'shapeKey';
  if (pose?.variant) return 'variant';
  const parameter = pose?.parameter || handPoseParameterName(side, pose?.id || '');
  if (!parameter) return null;
  for (const key of document?.shapeKeys || []) {
    const driver = key?.driver;
    if (!driver || driver.mode === 'none') continue;
    if (driver.mode === 'expression' ? expressionUses(driver.expression, parameter) : driver.parameter === parameter) return 'driver';
  }
  for (const keyform of document?.keyforms || []) {
    if ((keyform?.axes || []).some((axis) => axis?.parameter === parameter)) return 'keyform';
  }
  for (const element of Object.values(document?.elements || {})) {
    for (const binding of Object.values(element?.bindings || {})) {
      if (binding && binding.enabled !== false && expressionUses(binding.expression, parameter)) return 'binding';
    }
  }
  return null;
}

/* ── Reach guide ─────────────────────────────────────────────────────────── */

/**
 * The reach ellipse to draw around an anchor, in the artwork's coordinates.
 * `((x / reachX)² + (y / reachY)²) ≤ 1`, offset by the hand's rest position.
 */
export function handReachEllipse(hand, elements = {}) {
  if (!hand) return null;
  const anchor = hand.parent && elements?.[hand.parent]?.baseTransform
    ? applyElementTransform(elements[hand.parent].baseTransform, hand.anchor)
    : { ...hand.anchor };
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
 * Copy one hand onto the other side.
 *
 * Anchors and rest offsets mirror around `mirrorX` (the artwork's vertical
 * centre line), rotation reach flips sign so a "wave outwards" stays outwards,
 * and poses carry over with their own side's parameter names. Shape keys and
 * variants are only carried when the caller supplies a mapping, since the
 * mirrored hand usually has its own artwork.
 */
export function mirrorHand(hands, from, { mirrorX = 0, shapeKeys = {}, variants = {}, element = null } = {}) {
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
    poses: source.poses.map((pose) => ({
      ...pose,
      parameter: handPoseParameterName(to, pose.id),
      shapeKey: pose.shapeKey ? (shapeKeys[pose.shapeKey] ?? null) : null,
      variant: pose.variant ? (variants[pose.variant] ?? null) : null
    }))
  }, to);
  return { ...(hands || {}), [to]: mirrored };
}
