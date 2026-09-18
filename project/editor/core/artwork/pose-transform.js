/**
 * The live pose, as the difference between what is drawn and what is authored.
 *
 * ```text
 *   authored (baseTransform)   ⊕  pose (bindings, keyforms, handles)  =  drawn
 *      what the project says          what the session asks for          what you see
 * ```
 *
 * A mascot stays **posable while it is being designed** — the puppet handles
 * are on in Artwork, the head-pose pad turns the head, a movement slider moves
 * a part (docs/STILL_WHILE_DESIGNING.md §1, *What does not stop*). So the
 * transform a piece is drawn with is usually not the transform the project
 * holds, and anything that draws a box around a piece has to know which of the
 * two it is looking at.
 *
 * The selection gizmo did not. It read `baseTransform` and drew the box there,
 * so with the head turned to `headX = 0.9` the nose was painted seventy-four
 * screen pixels to the right of its own selection rectangle. Every handle was
 * in the wrong place, which is worse than it sounds: the box is the thing an
 * author aims at.
 *
 * ## Why this can be arithmetic rather than matrices
 *
 * `compileFrame` composes **per channel**, not by multiplying matrices
 * (`runtime/runtime.js`):
 *
 * | Channel | Composition |
 * | --- | --- |
 * | `x`, `y`, `rotation` | authored **+** pose |
 * | `scaleX`, `scaleY` | authored **×** pose |
 * | `pivotX`, `pivotY` | authored, untouched — a pose never moves a pivot |
 *
 * So the pose is recoverable exactly, by the inverse of each channel, and a
 * drag can be authored back into `baseTransform` without baking the pose in.
 * There is no decomposition and nothing approximate here: these two functions
 * are inverses, and a test holds them to it.
 *
 * Pure arithmetic. Nothing here touches the DOM, the store or a document.
 */

/** The seven channels a transform has, in the order the canvas serialises them. */
export const TRANSFORM_CHANNELS = Object.freeze(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'pivotX', 'pivotY']);

/** A transform that changes nothing. */
export const REST_POSE = Object.freeze({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });

const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** The neutral value of a channel: 1 for a scale, 0 for everything else. */
const neutral = (channel) => (channel === 'scaleX' || channel === 'scaleY' ? 1 : 0);

/**
 * A transform with every channel present and finite.
 *
 * `scale 0` is a legitimate authored value — a part the rig has closed — so
 * only a missing or unparseable number falls back to 1.
 */
export function normalizeTransform(transform = {}) {
  return {
    x: number(transform.x, 0), y: number(transform.y, 0), rotation: number(transform.rotation, 0),
    scaleX: number(transform.scaleX, 1), scaleY: number(transform.scaleY, 1),
    pivotX: number(transform.pivotX, 0), pivotY: number(transform.pivotY, 0)
  };
}

/**
 * `[x, y, rotation, scaleX, scaleY, pivotX, pivotY]` → a transform.
 *
 * That array is what the canvas records in `lastRequested` when it writes a
 * frame to the DOM, which makes it the one honest answer to "what is this
 * piece drawn with" — it is the number the renderer used, not a matrix parsed
 * back out of an attribute and re-decomposed.
 */
export const transformFromChannels = (channels) => (Array.isArray(channels)
  ? normalizeTransform({ x: channels[0], y: channels[1], rotation: channels[2], scaleX: channels[3], scaleY: channels[4], pivotX: channels[5], pivotY: channels[6] })
  : null);

/**
 * What the session is adding to the authored transform.
 *
 * `drawn ⊖ authored`, per channel. The result is a **pose**, not a transform:
 * it has no pivot, because a pose never moves one, and its resting value is
 * `REST_POSE` rather than zeroes.
 *
 * @param {object} drawn     the transform the piece is painted with
 * @param {object} authored  `baseTransform`
 * @returns {{x,y,rotation,scaleX,scaleY}}
 */
export function poseBetween(drawn, authored) {
  const a = normalizeTransform(drawn), b = normalizeTransform(authored);
  return {
    x: a.x - b.x, y: a.y - b.y, rotation: a.rotation - b.rotation,
    // A part scaled to nothing by the author carries no recoverable ratio, and
    // guessing one would make the next drag multiply by infinity.
    scaleX: b.scaleX ? a.scaleX / b.scaleX : 1,
    scaleY: b.scaleY ? a.scaleY / b.scaleY : 1
  };
}

/** Whether a pose is doing anything, within a tolerance the eye cannot see. */
export function isRestPose(pose, epsilon = 1e-6) {
  if (!pose) return true;
  for (const channel of ['x', 'y', 'rotation', 'scaleX', 'scaleY']) {
    if (Math.abs(number(pose[channel], neutral(channel)) - neutral(channel)) > epsilon) return false;
  }
  return true;
}

/**
 * Authored + pose: where a piece is drawn.
 *
 * The same arithmetic `compileFrame` does, so that a gizmo can predict what
 * the next frame will paint without waiting for it.
 */
export function applyPose(authored, pose) {
  const base = normalizeTransform(authored);
  if (isRestPose(pose)) return base;
  return {
    ...base,
    x: base.x + number(pose.x, 0), y: base.y + number(pose.y, 0),
    rotation: base.rotation + number(pose.rotation, 0),
    scaleX: base.scaleX * number(pose.scaleX, 1), scaleY: base.scaleY * number(pose.scaleY, 1)
  };
}

/**
 * Drawn − pose: what to author so the piece stays where the drag left it.
 *
 * The inverse of `applyPose`, and the reason a drag on a posed mascot can be
 * committed at all. Without it, dropping a piece while the head was turned
 * would write the turn into the artwork: the pose would be baked into
 * `baseTransform` and the part would be doubly displaced the moment the head
 * came back.
 */
export function removePose(drawn, pose) {
  const target = normalizeTransform(drawn);
  if (isRestPose(pose)) return target;
  const sx = number(pose.scaleX, 1), sy = number(pose.scaleY, 1);
  return {
    ...target,
    x: target.x - number(pose.x, 0), y: target.y - number(pose.y, 0),
    rotation: target.rotation - number(pose.rotation, 0),
    // A pose that scaled a part to nothing cannot be divided back out; the
    // authored scale is left as it is rather than made infinite.
    scaleX: sx ? target.scaleX / sx : target.scaleX,
    scaleY: sy ? target.scaleY / sy : target.scaleY
  };
}
