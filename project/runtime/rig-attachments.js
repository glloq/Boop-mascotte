/**
 * Attachments: one thing holding another (docs/FACE_CONTROL_RIG.md, CR-35 … CR-38).
 *
 * A hand touching a cheek is the shot that exposes every shortcut in a rig. The
 * hand is placed by its own controls, the cheek is moved by the head turn, a
 * pin and a warp, and the two have no idea about each other — so the finger
 * hovers, or sinks in, or slides off the moment anything moves.
 *
 * ```text
 *   Approach   ──▶   CONTACT   ──▶   Hold   ──▶   Release
 *   hold 0            hold 1         hold 1        hold 0
 * ```
 *
 * An **attachment point** is a place on a piece of artwork with a name:
 * `face.cheek.left`, `hand.left.indexTip`. It is resolved from where the
 * artwork *ended up* — after the pins deformed it and after its transform was
 * applied — so it follows the turn, the pose and the deformation without
 * knowing about any of them.
 *
 * A **hold** says: this attachment goes on that one. It carries a weight, and
 * the weight is an ordinary parameter, which is the whole of space switching
 * and the whole of hold-and-release:
 *
 * ```text
 * 0 %    where the hand's own controls put it        (world)
 * 50 %   halfway                                     (no jump: both are computed every frame)
 * 100 %  exactly on the cheek                        (head space)
 * ```
 *
 * There is no second positioning system and no space hierarchy to keep in
 * sync: at weight 1 the hand is on the cheek by construction, and at weight 0
 * it is wherever the animator put it. Everything in between is a straight line
 * between two points that are both true this frame, so a ramp cannot jump.
 *
 * Runs **last**, after the artwork is deformed, because that is the only point
 * at which "where the cheek ended up" is a question with an answer.
 */
import { finite, clamp, roundTo } from './numeric.js';
import { applyElementTransform } from './transform-2d.js';
import { pinDisplacementAt, pinOffsets } from './rig-pins.js';

/**
 * What a point is part of, so a panel can group them and an author can say
 * which world a point of their own belongs to.
 *
 * The solver never reads it — a hold is between two points and neither of them
 * needs a space to be resolved — so this is a *vocabulary* rather than a
 * hierarchy, and that is the point: the whole of space switching is a weight
 * between two positions that are both live (see below), not a tree of spaces
 * to keep in sync.
 *
 * The list of points a face and a pair of hands are usually held by lives in
 * the editor (`core/rig/attachment-model.js`), with the fractions that say
 * where each one is: the runtime resolves points, it does not propose them.
 */
export const ATTACHMENT_SPACES = Object.freeze(['world', 'head', 'body', 'hand', 'custom']);

export function normalizeRigAttachment(source = {}) {
  const id = typeof source?.id === 'string' && source.id.trim() ? source.id.trim() : null;
  const target = typeof source?.target === 'string' && source.target.trim() ? source.target.trim() : null;
  if (!id || !target) return null;
  return {
    id, target,
    point: { x: finite(source.point?.x, 0), y: finite(source.point?.y, 0) },
    // What it is part of, so a panel can group them and a space switch can name
    // one. Free text: a mascot may have spaces nobody anticipated.
    space: typeof source.space === 'string' && source.space.trim() ? source.space.trim() : 'world'
  };
}

export function normalizeRigAttachments(candidate) {
  const list = Array.isArray(candidate?.rigAttachments) ? candidate.rigAttachments : Array.isArray(candidate) ? candidate : [];
  const seen = new Set();
  const points = [];
  for (const item of list) {
    const attachment = normalizeRigAttachment(item);
    if (!attachment || seen.has(attachment.id)) continue;
    seen.add(attachment.id);
    points.push(attachment);
  }
  return points;
}

/**
 * A hold: which attachment goes on which, and how much.
 *
 * `weight` names a parameter, so the contact is animated on the timeline like
 * everything else. Without one the hold is simply on.
 */
export function normalizeRigHold(source = {}) {
  const id = typeof source?.id === 'string' && source.id.trim() ? source.id.trim() : null;
  const hold = typeof source?.hold === 'string' && source.hold.trim() ? source.hold.trim() : null;
  const to = typeof source?.to === 'string' && source.to.trim() ? source.to.trim() : null;
  if (!id || !hold || !to) return null;
  return {
    id, hold, to,
    enabled: source.enabled !== false,
    weight: typeof source.weight === 'string' && source.weight.trim() ? source.weight.trim() : null,
    influence: clamp(finite(source.influence, 1), 0, 1),
    offset: { x: finite(source.offset?.x, 0), y: finite(source.offset?.y, 0) },
    // Whether the held thing also turns with what it is holding on to.
    orient: source.orient === true
  };
}

export function normalizeRigHolds(candidate) {
  const list = Array.isArray(candidate?.rigHolds) ? candidate.rigHolds : Array.isArray(candidate) ? candidate : [];
  const seen = new Set();
  const holds = [];
  for (const item of list) {
    const hold = normalizeRigHold(item);
    if (!hold || seen.has(hold.id)) continue;
    seen.add(hold.id);
    holds.push(hold);
  }
  return holds;
}

/**
 * Where an attachment point actually is, this frame.
 *
 * Local point → what the pins did to it → the element's own transform. Nothing
 * about the order is negotiable: a pin deforms the shape in its own space, and
 * the transform is what puts that space on screen.
 *
 * @returns {{x:number,y:number}|null} null when its artwork is not in the frame
 */
export function attachmentPoint(attachment, frame, { pins = null, values = {}, evaluate = null } = {}) {
  const entry = frame?.[attachment?.target];
  if (!entry?.transform) return null;
  const held = pins?.get?.(attachment.target);
  const local = held
    ? shift(attachment.point, pinDisplacementAt(attachment.point, held.pins, pinOffsets(held.pins, values, evaluate || (() => 0))))
    : attachment.point;
  const world = applyElementTransform(entry.transform, local);
  return { x: roundTo(world.x) + 0, y: roundTo(world.y) + 0 };
}

const shift = (point, by) => ({ x: point.x + by.x, y: point.y + by.y });

/**
 * Put every held thing where it is holding on.
 *
 * @param {object[]} holds normalized
 * @param {object[]} attachments normalized
 * @param {Record<string, object>} frame the compiled frame, mutated in place
 * @param {object} options `pins`, `values` and the binding evaluator
 * @returns {number} how many holds actually moved something
 */
export function solveRigHolds(holds, attachments, frame, options = {}) {
  if (!Array.isArray(holds) || !holds.length) return 0;
  const byId = new Map((attachments || []).map((item) => [item.id, item]));
  const values = options.values || {};
  let applied = 0;
  for (const hold of holds) {
    if (!hold.enabled) continue;
    const weight = clamp(hold.influence * (hold.weight ? finite(values[hold.weight], 0) : 1), 0, 1);
    if (weight <= 0) continue;
    const held = byId.get(hold.hold), anchor = byId.get(hold.to);
    if (!held || !anchor) continue;
    const entry = frame[held.target];
    if (!entry?.transform) continue;
    const from = attachmentPoint(held, frame, options);
    const to = attachmentPoint(anchor, frame, options);
    if (!from || !to) continue;
    // Move the whole piece by the gap between the two points. Translating the
    // element rather than solving for a position keeps whatever else put it
    // there — its own controls, a constraint, a follower — intact underneath,
    // which is what makes a half-weight hold a real halfway and not a fight.
    entry.transform.x = roundTo(entry.transform.x + (to.x + hold.offset.x - from.x) * weight) + 0;
    entry.transform.y = roundTo(entry.transform.y + (to.y + hold.offset.y - from.y) * weight) + 0;
    if (hold.orient) {
      const anchorTransform = frame[anchor.target]?.transform;
      if (anchorTransform) {
        entry.transform.rotation = roundTo(entry.transform.rotation + (anchorTransform.rotation - entry.transform.rotation) * weight) + 0;
      }
    }
    // A matrix computed before the hold is out of date the moment it moves.
    if (entry.matrix) delete entry.matrix;
    applied += 1;
  }
  return applied;
}

/**
 * Every attachment a project has, with where it currently is, for a panel.
 *
 * A point on artwork the project has lost is still reported: losing artwork is
 * an accident, and hiding the rig built on it makes the accident unrecoverable.
 */
export function attachmentModel(attachments, frame, options = {}) {
  return (attachments || []).map((attachment) => ({
    id: attachment.id,
    target: attachment.target,
    space: attachment.space,
    missing: !frame?.[attachment.target],
    at: attachmentPoint(attachment, frame, options)
  }));
}
