/**
 * Constraints: keeping the rig's own geometry true (docs/FACE_CONTROL_RIG.md).
 *
 * A binding says *this parameter moves that element*. A constraint says
 * something a binding cannot: **this element must stay in a particular
 * relationship to that one**, whatever moved either of them. A hand that stays
 * on a cheek, a brow that may only go up, a jaw that may never open past a
 * point, an eye that keeps its distance from another.
 *
 * The project already had constraints, and they were three booleans per
 * element — may it translate, may it rotate, may it scale — plus a global
 * scale factor. That is a *switch*, not a relationship.
 *
 * ```text
 *  parent        copy where that one is
 *  distance      stay this far from it
 *  orientation   face the same way it does
 *  axis          only move along this line
 *  limit         never go past here
 *  slide         follow it, but only along this line
 * ```
 *
 * **Deterministic and one-pass.** They are solved in the order they are listed,
 * each one reading the frame as it stands — the same rule the parameter mixer
 * uses (docs/PARAMETER_MIXER.md), and for the same reason: an order an author
 * can read beats an order that emerges. No iteration, no relaxation, nothing
 * that can oscillate or fail to converge, and no physics: this runs on every
 * frame of a mascot on somebody's marketing page.
 *
 * Attachment is deliberately elsewhere (`runtime/rig-attachments.js`): it has
 * to run after the artwork is deformed rather than before, so it is a stage of
 * its own rather than a seventh kind here.
 */
import { clamp, finite, roundTo } from './numeric.js';

/** The relationships a rig can hold. */
export const RIG_CONSTRAINT_TYPES = Object.freeze(['parent', 'distance', 'orientation', 'axis', 'limit', 'slide']);

/** What each one is for, in the words a panel uses. */
export const RIG_CONSTRAINT_LABELS = Object.freeze({
  parent: 'Follow · move with another piece',
  distance: 'Distance · stay this far away',
  orientation: 'Orientation · face the same way',
  axis: 'Axis · only move along one line',
  limit: 'Limit · never go past here',
  slide: 'Slide · follow, along one line only'
});

const pairOf = (source, fallback = { x: 0, y: 0 }) => ({ x: finite(source?.x, fallback.x), y: finite(source?.y, fallback.y) });

function unitAxis(source, fallback = { x: 1, y: 0 }) {
  const raw = pairOf(source, { x: 0, y: 0 });
  const length = Math.hypot(raw.x, raw.y);
  return length > 1e-9 ? { x: roundTo(raw.x / length, 6), y: roundTo(raw.y / length, 6) } : { ...fallback };
}

/** A limit an author left out is not a limit: `null` means "as far as it likes". */
const boundOf = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

export function normalizeRigConstraint(source = {}) {
  const id = typeof source?.id === 'string' && source.id.trim() ? source.id.trim() : null;
  const target = typeof source?.target === 'string' && source.target.trim() ? source.target.trim() : null;
  if (!id || !target) return null;
  const type = RIG_CONSTRAINT_TYPES.includes(source.type) ? source.type : 'parent';
  return {
    id, target, type,
    source: typeof source?.source === 'string' && source.source.trim() ? source.source.trim() : null,
    enabled: source.enabled !== false,
    // How much of the relationship is enforced. A weight rather than a switch,
    // because an animator fades a constraint in and never flips one on.
    influence: clamp(finite(source.influence, 1), 0, 1),
    offset: pairOf(source.offset),
    distance: Math.max(0, finite(source.distance, 0)),
    axis: unitAxis(source.axis),
    // Whether a `parent` also copies the turn and the size, or only the place.
    copy: {
      translate: source.copy?.translate !== false,
      rotate: source.copy?.rotate === true,
      scale: source.copy?.scale === true
    },
    limits: {
      x: [boundOf(source.limits?.minX), boundOf(source.limits?.maxX)],
      y: [boundOf(source.limits?.minY), boundOf(source.limits?.maxY)],
      rotation: [boundOf(source.limits?.minRotation), boundOf(source.limits?.maxRotation)],
      scale: [boundOf(source.limits?.minScale), boundOf(source.limits?.maxScale)]
    },
    // A parameter that fades the whole constraint, keyed like anything else.
    weight: typeof source.weight === 'string' && source.weight.trim() ? source.weight.trim() : null
  };
}

export function normalizeRigConstraints(candidate) {
  const list = Array.isArray(candidate?.rigConstraints) ? candidate.rigConstraints : Array.isArray(candidate) ? candidate : [];
  const seen = new Set();
  const constraints = [];
  for (const item of list) {
    const constraint = normalizeRigConstraint(item);
    if (!constraint || seen.has(constraint.id)) continue;
    seen.add(constraint.id);
    constraints.push(constraint);
  }
  return constraints;
}

/** Nothing to enforce is nothing to run, which is the common case. */
export const hasRigConstraints = (constraints) => Array.isArray(constraints) && constraints.some((item) => item?.enabled !== false);

const towards = (from, to, weight) => (weight >= 1 ? to : from + (to - from) * weight);
// `+ 0` so a value that lands on nothing is 0 rather than -0: a transform is
// compared against rest to decide whether anything moved, and
// `Object.is(-0, 0)` is false.
const settle = (value) => roundTo(value) + 0;

/**
 * Solve every constraint, in order, against a frame that already has its
 * transforms.
 *
 * Mutates `frame` in place — it is the frame's own scratch, built one line
 * earlier by `compileRigFrame` and thrown away one line later, and copying it
 * per constraint would allocate once per constraint per frame for nothing.
 *
 * @param {object[]} constraints normalized
 * @param {Record<string, object>} frame the compiled frame
 * @param {Record<string, number>} values the effective parameters, for weights
 * @returns {number} how many constraints actually did something
 */
export function solveRigConstraints(constraints, frame, values = {}) {
  if (!hasRigConstraints(constraints)) return 0;
  let applied = 0;
  for (const constraint of constraints) {
    if (!constraint.enabled) continue;
    const target = frame[constraint.target];
    if (!target?.transform) continue;
    // A constraint may be faded by a parameter as well as by its own setting:
    // that is what makes a hold something an animator keys rather than a switch
    // somebody flipped while rigging (CR-38).
    const weight = constraint.weight
      ? clamp(constraint.influence * finite(values[constraint.weight], 0), 0, 1)
      : constraint.influence;
    if (weight <= 0) continue;
    const from = constraint.source ? frame[constraint.source]?.transform || null : null;
    if (applyConstraint(constraint, target.transform, from, weight)) applied += 1;
  }
  return applied;
}

function applyConstraint(constraint, transform, source, weight) {
  switch (constraint.type) {
    case 'parent': return applyParent(constraint, transform, source, weight);
    case 'distance': return applyDistance(constraint, transform, source, weight);
    case 'orientation': return applyOrientation(constraint, transform, source, weight);
    case 'axis': return applyAxis(constraint, transform, weight);
    case 'slide': return applySlide(constraint, transform, source, weight);
    case 'limit': return applyLimit(constraint, transform, weight);
    default: return false;
  }
}

/** Be where that one is, plus an offset of your own. */
function applyParent(constraint, transform, source, weight) {
  if (!source) return false;
  if (constraint.copy.translate) {
    transform.x = settle(towards(transform.x, source.x + constraint.offset.x, weight));
    transform.y = settle(towards(transform.y, source.y + constraint.offset.y, weight));
  }
  if (constraint.copy.rotate) transform.rotation = settle(towards(transform.rotation, source.rotation, weight));
  if (constraint.copy.scale) {
    transform.scaleX = settle(towards(transform.scaleX, source.scaleX, weight));
    transform.scaleY = settle(towards(transform.scaleY, source.scaleY, weight));
  }
  return true;
}

/**
 * Stay this far away.
 *
 * The direction is kept and the length is corrected, which is what makes this
 * a *constraint* rather than a second way of positioning something: the thing
 * an author moved still decides where it is going, and this decides how far.
 */
function applyDistance(constraint, transform, source, weight) {
  if (!source) return false;
  const dx = transform.x - source.x, dy = transform.y - source.y;
  const length = Math.hypot(dx, dy);
  // Sitting exactly on top of it, there is no direction to correct along, so
  // the constraint's own axis stands in rather than a random one.
  const direction = length > 1e-9 ? { x: dx / length, y: dy / length } : constraint.axis;
  const wanted = { x: source.x + direction.x * constraint.distance, y: source.y + direction.y * constraint.distance };
  transform.x = settle(towards(transform.x, wanted.x, weight));
  transform.y = settle(towards(transform.y, wanted.y, weight));
  return true;
}

/** Face the same way it does. */
function applyOrientation(constraint, transform, source, weight) {
  if (!source) return false;
  transform.rotation = settle(towards(transform.rotation, source.rotation + constraint.offset.x, weight));
  return true;
}

/**
 * Only move along this line.
 *
 * Whatever put the element where it is, only the part of that along the axis
 * survives: a brow on a vertical axis raises and never wanders sideways.
 */
function applyAxis(constraint, transform, weight) {
  const along = transform.x * constraint.axis.x + transform.y * constraint.axis.y;
  transform.x = settle(towards(transform.x, along * constraint.axis.x, weight));
  transform.y = settle(towards(transform.y, along * constraint.axis.y, weight));
  return true;
}

/** Follow it, but only along the line: a corner riding a lip. */
function applySlide(constraint, transform, source, weight) {
  if (!source) return false;
  const along = (source.x + constraint.offset.x) * constraint.axis.x + (source.y + constraint.offset.y) * constraint.axis.y;
  transform.x = settle(towards(transform.x, along * constraint.axis.x, weight));
  transform.y = settle(towards(transform.y, along * constraint.axis.y, weight));
  return true;
}

/**
 * Never go past here.
 *
 * This is what a rig has and a poser does not, in the place where it finally
 * cannot be got round: a limit on the *result* holds however the element got
 * there — a binding, a pose, a constraint above it, or an animator dragging.
 */
function applyLimit(constraint, transform, weight) {
  const hold = (value, [min, max]) => {
    let landed = value;
    if (min !== null) landed = Math.max(landed, min);
    if (max !== null) landed = Math.min(landed, max);
    return settle(towards(value, landed, weight));
  };
  transform.x = hold(transform.x, constraint.limits.x);
  transform.y = hold(transform.y, constraint.limits.y);
  transform.rotation = hold(transform.rotation, constraint.limits.rotation);
  transform.scaleX = hold(transform.scaleX, constraint.limits.scale);
  transform.scaleY = hold(transform.scaleY, constraint.limits.scale);
  return true;
}
