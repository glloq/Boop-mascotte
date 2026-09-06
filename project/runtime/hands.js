/**
 * Floating hands (docs/HAND_RIGGING.md).
 *
 * ```text
 * BODY
 *  ├─ leftHandAnchor ── LEFT HAND
 *  └─ rightHandAnchor ─ RIGHT HAND
 * ```
 *
 * There are no arms and no IK. A hand is artwork that hangs off an anchor point
 * on the body: the anchor follows whatever the body does, and the hand keeps its
 * own local animation on top. That is 80–90 % of the cartoon result for a
 * fraction of a skeleton's machinery.
 */

import { finite, clamp } from './numeric.js';
import { applyElementTransform, applyMatrix } from './transform-2d.js';
import { depthBand, clampDepth, DEFAULT_PARALLAX } from './depth.js';
export { applyElementTransform } from './transform-2d.js';

export const HAND_SIDES = Object.freeze(['left', 'right']);

const DEFAULT_REACH = Object.freeze({ x: 40, y: 30, rotation: 30, scale: 0.2 });

export function normalizeHandPose(source = {}) {
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    name: typeof source?.name === 'string' && source.name ? source.name : (source?.id || ''),
    parameter: typeof source?.parameter === 'string' ? source.parameter : '',
    // Method A: deform the neutral hand. Method B: cross-fade to other artwork.
    shapeKey: typeof source?.shapeKey === 'string' && source.shapeKey ? source.shapeKey : null,
    variant: typeof source?.variant === 'string' && source.variant ? source.variant : null,
    // The numbers a generated pose was drawn from, kept so the editor can
    // reopen it. Never read here: the runtime plays the keys they produced.
    ...(isTable(source?.table) ? { table: source.table } : {}),
    ...(isTable(source?.profileTable) ? { profileTable: source.profileTable } : {})
  };
}

const isTable = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function normalizeHand(source = {}, side = 'left') {
  const capital = side === 'right' ? 'R' : 'L';
  const parameters = {
    x: `hand${capital}X`, y: `hand${capital}Y`, rotation: `hand${capital}Rotation`,
    scale: `hand${capital}Scale`, depth: `hand${capital}Depth`,
    ...(source?.parameters && typeof source.parameters === 'object' ? source.parameters : {})
  };
  return {
    side: side === 'right' ? 'right' : 'left',
    element: typeof source?.element === 'string' ? source.element : '',
    parent: typeof source?.parent === 'string' && source.parent ? source.parent : null,
    anchor: { x: finite(source?.anchor?.x, 0), y: finite(source?.anchor?.y, 0) },
    restOffset: { x: finite(source?.restOffset?.x, 0), y: finite(source?.restOffset?.y, 0) },
    reach: {
      x: Math.abs(finite(source?.reach?.x, DEFAULT_REACH.x)),
      y: Math.abs(finite(source?.reach?.y, DEFAULT_REACH.y)),
      rotation: finite(source?.reach?.rotation, DEFAULT_REACH.rotation),
      scale: finite(source?.reach?.scale, DEFAULT_REACH.scale)
    },
    // A cartoon hand may leave its reach a little; a hard clamp reads as a wall.
    softness: Math.max(0, finite(source?.softness, 0.25)),
    depth: finite(source?.depth, 0),
    parameters,
    poses: (Array.isArray(source?.poses) ? source.poses : []).map(normalizeHandPose).filter((pose) => pose.id),
    inertia: normalizeHandInertia(source?.inertia)
  };
}

export function normalizeHandInertia(source = {}) {
  return {
    enabled: source?.enabled === true,
    stiffness: clamp(finite(source?.stiffness, 0.25), 0.01, 1),
    damping: clamp(finite(source?.damping, 0.65), 0.01, 1),
    maxOvershoot: Math.max(0, finite(source?.maxOvershoot, 0.35)),
    followAmount: clamp(finite(source?.followAmount, 1), 0, 1)
  };
}

export function normalizeHands(rig = {}) {
  const source = rig?.hands;
  if (!source || typeof source !== 'object') return null;
  const hands = {};
  for (const side of HAND_SIDES) {
    if (!source[side] || typeof source[side] !== 'object') continue;
    const hand = normalizeHand(source[side], side);
    if (hand.element) hands[side] = hand;
  }
  return Object.keys(hands).length ? hands : null;
}

/**
 * The parameter that brings a hand out from behind the head, matching what
 * the hand panel writes (`handLShow`): 0 tucked away, 1 out at its rest place.
 */
export function handShowParameterName(side) {
  return `hand${side === 'right' ? 'R' : 'L'}Show`;
}

/** The parameters cartoon inertia lags. Depth is excluded: draw order must not wobble. */
export function handMotionParameters(hand) {
  return [hand.parameters.x, hand.parameters.y, hand.parameters.rotation, hand.parameters.scale];
}

/* ── Reach ───────────────────────────────────────────────────────────────── */

/**
 * Soft reach limit. Inside the ellipse nothing changes; outside it the radius
 * eases towards `1 + softness` instead of stopping dead, so a hand can
 * overshoot a little the way a cartoon hand should.
 *
 * ```text
 * ((x / reachX)² + (y / reachY)²) ≤ 1
 * ```
 */
export function softenReach(radius, softness = 0.25) {
  const r = Math.max(0, finite(radius, 0));
  if (r <= 1) return r;
  if (softness <= 0) return 1;
  return 1 + softness * (1 - Math.exp(-(r - 1) / softness));
}

/** Normalized hand input → an offset in user units, softly bounded by `reach`. */
export function handOffset(hand, x, y) {
  const nx = finite(x, 0);
  const ny = finite(y, 0);
  const radius = Math.hypot(nx, ny);
  if (radius === 0) return { x: hand.restOffset.x, y: hand.restOffset.y };
  const factor = softenReach(radius, hand.softness) / radius;
  return {
    x: hand.restOffset.x + nx * factor * hand.reach.x,
    y: hand.restOffset.y + ny * factor * hand.reach.y
  };
}

/* ── Anchors ─────────────────────────────────────────────────────────────── */

/**
 * How far the anchor travelled because the body moved. The hand adds this to
 * its own local animation, so "body movement moves the anchor" and "local hand
 * movement is preserved" are both true at once.
 */
export function anchorDrift(hand, elements = {}, frame = {}, matrices = null) {
  if (!hand.parent) return { x: 0, y: 0 };
  const base = elements?.[hand.parent]?.baseTransform;
  const animated = frame?.[hand.parent]?.transform;
  if (base && animated) {
    const rest = applyElementTransform(base, hand.anchor);
    const now = applyElementTransform(frame[hand.parent].matrix ? matrixTransform(frame[hand.parent].matrix, hand.anchor, animated) : animated, hand.anchor);
    return { x: now.x - rest.x, y: now.y - rest.y };
  }
  // An anchor may also hang off a deformer rather than a drawn element.
  const matrix = matrices?.get?.(hand.parent);
  if (!matrix) return { x: 0, y: 0 };
  const moved = applyMatrix(matrix, hand.anchor);
  return { x: moved.x - hand.anchor.x, y: moved.y - hand.anchor.y };
}

// When the parent itself is inside a hierarchy, its world matrix is the truth.
function matrixTransform(matrix, point, fallback) {
  if (!matrix) return fallback;
  const moved = applyMatrix(matrix, point);
  return { x: moved.x - point.x, y: moved.y - point.y, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
}

/* ── Evaluation ──────────────────────────────────────────────────────────── */

/**
 * Resolve both hands after the ordinary elements are compiled, and fold the
 * result into their frames. Poses contribute shape-key weights (method A) or
 * variant opacities (method B); the caller applies shape weights through the
 * usual shape-key pass.
 */
export function evaluateHands(hands, elements = {}, frame = {}, values = {}, { matrices = null, parallax = DEFAULT_PARALLAX, previousBands = null } = {}) {
  if (!hands) return frame;
  for (const side of HAND_SIDES) {
    const hand = hands[side];
    if (!hand) continue;
    const entry = frame[hand.element];
    if (!entry) continue;
    const offset = handOffset(hand, values[hand.parameters.x], values[hand.parameters.y]);
    const drift = anchorDrift(hand, elements, frame, matrices);
    // One movement for the hand and for every drawing that stands in for it.
    const move = {
      x: offset.x + drift.x, y: offset.y + drift.y,
      rotation: finite(values[hand.parameters.rotation], 0) * hand.reach.rotation,
      scale: 1 + finite(values[hand.parameters.scale], 0) * hand.reach.scale
    };
    carry(entry, move);
    // The hand's own depth and its parameter, on top of whatever the artwork's
    // depth already says: a keyform on the group can sink a hand behind the
    // head while it rests there (docs/HAND_RIGGING.md, "Behind the head").
    entry.depth = clampDepth(hand.depth + finite(values[hand.parameters.depth], 0) + finite(entry.depth, 0));
    // behind / normal / front, with hysteresis: a hand hovering on a boundary
    // must not swap draw order every frame (docs/DEPTH_PARALLAX.md).
    entry.depthBand = depthBand(entry.depth, parallax, previousBands?.[hand.element] || null);
    applyHandPoses(hand, entry, frame, values, move);
  }
  return frame;
}

/** Add the hand's movement to a frame entry; a pivot, when given, is where it turns. */
function carry(entry, move, pivot = null) {
  const t = entry.transform;
  entry.transform = {
    ...t,
    x: t.x + move.x, y: t.y + move.y,
    rotation: t.rotation + move.rotation,
    scaleX: t.scaleX * move.scale, scaleY: t.scaleY * move.scale,
    ...(pivot ? { pivotX: pivot.x, pivotY: pivot.y } : {})
  };
}

function applyHandPoses(hand, entry, frame, values, move) {
  if (hand.poses.length === 0) return;
  const variants = new Map();
  for (const pose of hand.poses) {
    const weight = clamp(finite(values[pose.parameter], 0), 0, 1);
    if (pose.shapeKey) {
      entry.shapeWeights ||= {};
      entry.shapeWeights[pose.shapeKey] = finite(entry.shapeWeights[pose.shapeKey], 0) + weight;
    }
    if (pose.variant && frame[pose.variant]) variants.set(pose.variant, finite(variants.get(pose.variant), 0) + weight);
  }
  if (variants.size === 0) return;
  // Method B: a short cross-fade, never a hard cut — the neutral hand fades out
  // by exactly as much as the drawings fade in. Several drawings raised at once
  // share that one hand rather than piling up past it.
  let total = 0;
  for (const weight of variants.values()) total += weight;
  const share = total > 1 ? 1 / total : 1;
  const pivot = { x: entry.transform.pivotX, y: entry.transform.pivotY };
  for (const [id, weight] of variants) {
    const target = frame[id];
    // A drawing stands in for the hand, so it goes where the hand goes: the
    // same reach, the same anchor drift, the same turn around the same pivot,
    // and the same place in the draw order.
    carry(target, move, pivot);
    target.depth = entry.depth;
    target.depthBand = entry.depthBand;
    target.opacity = clamp(target.opacity * weight * share, 0, 1);
  }
  entry.opacity = clamp(entry.opacity * (1 - Math.min(1, total)), 0, 1);
}
