/**
 * Part poses (docs/DIRECT_CONTROLS.md).
 *
 * A movement is a slider from one end to the other; a **pose** is a place on
 * it worth having a name. Eyebrows go up and they tilt — but what an author
 * wants is *angry*, *sad*, *curious*, and those are two numbers each, found by
 * fiddling with two sliders.
 *
 * Expressions already name whole faces. This names one part at a time, which
 * is the missing rung: a row of buttons under each group of movements that
 * puts that part somewhere useful in one press.
 *
 * Pure: it reads the document and reports the poses the project can actually
 * strike, with the same `usable` / `missing` shape as every other preset
 * catalogue in the editor.
 */
import { deriveMovementChecklist, movementEntry } from '../../rig-editor/semantic-parts/face-movements.js';

/** Named places on the movements of one part. */
export const PART_POSES = Object.freeze({
  eyes: Object.freeze([
    Object.freeze({ id: 'open', name: 'Open', controls: Object.freeze({ eyeOpen: 1 }) }),
    Object.freeze({ id: 'half', name: 'Half', controls: Object.freeze({ eyeOpen: 0.5 }) }),
    Object.freeze({ id: 'closed', name: 'Closed', controls: Object.freeze({ eyeOpen: 0 }) })
  ]),
  eyebrows: Object.freeze([
    Object.freeze({ id: 'neutral', name: 'Neutral', controls: Object.freeze({ browRaise: 0, browTilt: 0 }) }),
    Object.freeze({ id: 'raised', name: 'Raised', controls: Object.freeze({ browRaise: 1, browTilt: 0 }) }),
    Object.freeze({ id: 'angry', name: 'Angry', controls: Object.freeze({ browRaise: -0.7, browTilt: -0.8 }) }),
    Object.freeze({ id: 'sad', name: 'Sad', controls: Object.freeze({ browRaise: -0.15, browTilt: 0.8 }) }),
    Object.freeze({ id: 'curious', name: 'Curious', controls: Object.freeze({ browRaise: 0.6, browTilt: 0.45 }) })
  ]),
  mouth: Object.freeze([
    Object.freeze({ id: 'neutral', name: 'Neutral', controls: Object.freeze({ smile: 0, mouthOpen: 0 }) }),
    Object.freeze({ id: 'smile', name: 'Smile', controls: Object.freeze({ smile: 1, mouthOpen: 0 }) }),
    Object.freeze({ id: 'grin', name: 'Grin', controls: Object.freeze({ smile: 0.8, mouthOpen: 0.5 }) }),
    Object.freeze({ id: 'frown', name: 'Frown', controls: Object.freeze({ smile: -0.8, mouthOpen: 0 }) }),
    Object.freeze({ id: 'open', name: 'Open', controls: Object.freeze({ smile: 0, mouthOpen: 1 }) })
  ]),
  gaze: Object.freeze([
    Object.freeze({ id: 'ahead', name: 'Ahead', controls: Object.freeze({ lookX: 0, lookY: 0 }) }),
    Object.freeze({ id: 'left', name: 'Left', controls: Object.freeze({ lookX: -1, lookY: 0 }) }),
    Object.freeze({ id: 'right', name: 'Right', controls: Object.freeze({ lookX: 1, lookY: 0 }) }),
    Object.freeze({ id: 'up', name: 'Up', controls: Object.freeze({ lookX: 0, lookY: -1 }) }),
    Object.freeze({ id: 'down', name: 'Down', controls: Object.freeze({ lookX: 0, lookY: 1 }) })
  ]),
  head: Object.freeze([
    Object.freeze({ id: 'straight', name: 'Straight', controls: Object.freeze({ headX: 0, headY: 0, headTilt: 0 }) }),
    Object.freeze({ id: 'turn-left', name: 'Turn left', controls: Object.freeze({ headX: -1, headY: 0 }) }),
    Object.freeze({ id: 'turn-right', name: 'Turn right', controls: Object.freeze({ headX: 1, headY: 0 }) }),
    Object.freeze({ id: 'lift', name: 'Chin up', controls: Object.freeze({ headY: -1 }) }),
    Object.freeze({ id: 'lower', name: 'Chin down', controls: Object.freeze({ headY: 1 }) }),
    Object.freeze({ id: 'tilt', name: 'Tilt', controls: Object.freeze({ headTilt: 0.7 }) })
  ])
});

/** The order the groups are shown in, matching the movements panel. */
export const PART_POSE_GROUPS = Object.freeze([
  Object.freeze({ part: 'head', label: 'Head' }),
  Object.freeze({ part: 'eyes', label: 'Eyes' }),
  Object.freeze({ part: 'gaze', label: 'Gaze' }),
  Object.freeze({ part: 'eyebrows', label: 'Eyebrows' }),
  Object.freeze({ part: 'mouth', label: 'Mouth' })
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * The poses one part can strike in this project.
 *
 * A pose keeps only the movements the project has turned on, and reports the
 * rest: a project without `browTilt` can still be *raised*, and says that
 * *angry* would need the tilt.
 *
 * @returns {{id,name,part,controls,missing,usable}[]}
 */
export function partPoses(document = {}, part) {
  const poses = PART_POSES[part];
  if (!poses) return [];
  const movements = deriveMovementChecklist(document);
  const params = document.params || {};
  const enabled = (control) => Boolean(movements.items.find((item) => item.id === control)?.enabled) && Boolean(params[control]);
  return poses.map((pose) => {
    const controls = {};
    const missing = [];
    for (const [control, value] of Object.entries(pose.controls)) {
      if (!enabled(control)) { missing.push(movementEntry(control)?.label || control); continue; }
      const parameter = params[control];
      controls[control] = clamp(number(value), number(parameter.min, -1), number(parameter.max, 1));
    }
    return { id: pose.id, name: pose.name, part, controls, missing, usable: Object.keys(controls).length > 0 };
  });
}

/** Every group with at least one pose to strike, for a panel to lay out. */
export function partPoseGroups(document = {}) {
  return PART_POSE_GROUPS
    .map((group) => ({ ...group, poses: partPoses(document, group.part).filter((pose) => pose.usable) }))
    .filter((group) => group.poses.length > 0);
}

/** Whether the live face is already standing in a pose, so a chip can say so. */
export function activePartPose(poses = [], values = {}) {
  const near = (a, b) => Math.abs(number(a) - number(b)) < 0.02;
  return poses.find((pose) => Object.entries(pose.controls).every(([control, value]) => near(values[control], value)))?.id || null;
}
