// Basic movements checklist: the ten semantic controls a beginner enables and
// calibrates visually in Face Setup. Derived from ProjectDocument only; the
// authored truth stays in `semanticParts[*].controls / controlDrivers /
// calibration` and the generated bindings.
import { SEMANTIC_PART_REGISTRY, requiredSemanticRoles } from './part-registry.js';
import { findFacePartByType } from './face-roles.js';

/**
 * Every position of the face, in the order the panel shows them.
 *
 * It was the ten a beginner starts with, and a mascot has more than ten
 * positions: the nose scrunches, the jaw drops on its own, the hair moves, the
 * ears wiggle, and an open mouth has teeth and a tongue in it. A part with a
 * movement missing from here has no pose chips and no live slider, which is
 * the same as not being controllable at all.
 */
export const BASIC_MOVEMENTS = Object.freeze([
  Object.freeze({ id: 'headX', part: 'head', label: 'Move left / right', group: 'Head', axis: 'x', pair: 'headY' }),
  Object.freeze({ id: 'headY', part: 'head', label: 'Move up / down', group: 'Head', axis: 'y', pair: 'headX' }),
  Object.freeze({ id: 'headTilt', part: 'head', label: 'Tilt', group: 'Head', axis: 'x' }),
  Object.freeze({ id: 'eyeOpen', part: 'eyes', label: 'Open / close', group: 'Eyes', axis: 'y' }),
  Object.freeze({ id: 'lookX', part: 'gaze', label: 'Look left / right', group: 'Gaze', axis: 'x', pair: 'lookY' }),
  Object.freeze({ id: 'lookY', part: 'gaze', label: 'Look up / down', group: 'Gaze', axis: 'y', pair: 'lookX' }),
  // The pupils dilate. It is one movement writing two scale axes, which is why
  // the registry lets a binding name a pair (docs/FACE_CONTROL_RIG.md).
  Object.freeze({ id: 'pupilScale', part: 'gaze', label: 'Pupil size', group: 'Gaze', axis: 'y' }),
  Object.freeze({ id: 'browRaise', part: 'eyebrows', label: 'Raise', group: 'Eyebrows', axis: 'y' }),
  Object.freeze({ id: 'browTilt', part: 'eyebrows', label: 'Tilt', group: 'Eyebrows', axis: 'x' }),
  Object.freeze({ id: 'noseScrunch', part: 'nose', label: 'Scrunch', group: 'Nose', axis: 'y' }),
  Object.freeze({ id: 'mouthOpen', part: 'mouth', label: 'Open / close', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'smile', part: 'mouth', label: 'Smile', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'mouthWidth', part: 'mouth', label: 'Width', group: 'Mouth', axis: 'x' }),
  Object.freeze({ id: 'teeth', part: 'mouth', label: 'Teeth', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'tongue', part: 'mouth', label: 'Tongue', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'jawOpen', part: 'jaw', label: 'Drop', group: 'Jaw', axis: 'y' }),
  // Where the tongue is, as opposed to whether it shows (docs/FACE_CONTROL_RIG.md).
  Object.freeze({ id: 'tongueX', part: 'tongue', label: 'Left / right', group: 'Tongue', axis: 'x', pair: 'tongueY' }),
  Object.freeze({ id: 'tongueY', part: 'tongue', label: 'Up / down', group: 'Tongue', axis: 'y', pair: 'tongueX' }),
  Object.freeze({ id: 'tongueOut', part: 'tongue', label: 'Stick out', group: 'Tongue', axis: 'y' }),
  Object.freeze({ id: 'tongueCurl', part: 'tongue', label: 'Curl', group: 'Tongue', axis: 'x' }),
  Object.freeze({ id: 'hairSway', part: 'hair', label: 'Sway', group: 'Hair', axis: 'x' }),
  Object.freeze({ id: 'hairLift', part: 'hair', label: 'Lift', group: 'Hair', axis: 'y' }),
  Object.freeze({ id: 'earWiggle', part: 'ears', label: 'Wiggle', group: 'Ears', axis: 'x' })
]);

export const movementEntry = (id) => BASIC_MOVEMENTS.find((entry) => entry.id === id) || null;

const MORPH_POSES = { eyeOpen: [{ key: 'closed', label: 'Closed', value: 0 }, { key: 'open', label: 'Open', value: 1 }] };
const DEFAULT_MORPH_POSES = [{ key: 'neutral', label: 'Neutral', value: 0 }, { key: 'open', label: 'Open', value: 1 }];

/**
 * Pose cards for one control: registry poses for transforms, the endpoint pair
 * for morphs, and none at all for shape keys — the shapes *are* the
 * calibration, and there is nothing to capture from the canvas.
 */
export function calibrationPoses(partType, control, driver) {
  if (driver?.method === 'shapeKey') return [];
  if (driver?.method === 'morph') return MORPH_POSES[control] || DEFAULT_MORPH_POSES;
  return SEMANTIC_PART_REGISTRY[partType]?.calibration?.[control]?.poses || [];
}

// Who a movement moves, for a sentence written about it. The checklist keeps
// its own table: it is naming artwork to assign ("both eyes"), not artwork to
// pose ("the eyes"), and the two sentences want different words.
const SUBJECTS = Object.freeze({ head: 'the head', eyes: 'the eyes', gaze: 'the pupils', eyebrows: 'the eyebrows', nose: 'the nose', mouth: 'the mouth', jaw: 'the jaw', tongue: 'the tongue', hair: 'the hair', ears: 'the ears' });
const movementSubject = (part) => SUBJECTS[part] || 'the artwork';

/**
 * The captures one movement asks for, in the order an author is asked for them.
 *
 * The registry lists a control's poses along its own axis -- LEFT, CENTER,
 * RIGHT -- which is the order the solver reads them in, not the order they are
 * authored in. Setting a movement up starts from where it **rests**, because
 * that is the face already drawn and the one capture that changes nothing, and
 * then asks for each end the movement has to reach (VNX-15).
 *
 * Wording and order only. `calibrateSemanticPart` still solves the movement
 * from the samples; nothing here computes how far anything moves.
 */
export function calibrationSteps(partType, control, driver, parameter) {
  const poses = calibrationPoses(partType, control, driver);
  if (!poses.length) return [];
  // Rest is the pose sitting at the parameter's own default: an eye rests OPEN
  // and a mouth rests CLOSED, and each of those is that parameter's default.
  const home = Number(parameter?.default ?? SEMANTIC_PART_REGISTRY[partType]?.parameters?.[control]?.default ?? 0);
  const rest = poses.find((pose) => Number(pose.value) === home) || null;
  const shape = driver?.method === 'morph';
  return [rest, ...poses.filter((pose) => pose !== rest)].filter(Boolean).map((pose, index) => ({
    ...pose,
    rest: pose === rest,
    step: index + 1,
    title: pose === rest ? 'Resting position' : `Full ${String(pose.label).toLowerCase()}`,
    // One short line: it is read while doing the step, and the canvas banner
    // names the artwork again the moment the pose session opens.
    hint: pose === rest
      ? shape ? 'The shape it rests in.' : 'Leave it as drawn.'
      : shape ? 'Move the nodes, then capture.' : 'As far as it should go.'
  }));
}

/** Human, direction-aware instruction for capturing one pose. */
export function poseInstruction(entry, pose) {
  const subject = movementSubject(entry.part);
  // The resting capture is the one where nothing moves: telling an author to
  // move artwork that is already in position reads like a step they failed.
  if (pose.rest ?? (pose.value === 0 && pose.key !== 'open' && pose.key !== 'closed')) return `Leave ${subject} at rest, then press Capture.`;
  return `Move ${subject} to the ${pose.label.toLowerCase()} position, then press Capture.`;
}

export function deriveMovementChecklist(document) {
  const items = BASIC_MOVEMENTS.map((entry) => {
    const part = findFacePartByType(document, entry.part), definition = SEMANTIC_PART_REGISTRY[entry.part];
    // Required roles only: a mouth is ready to move without the optional
    // cavity, which is artwork the turn carries rather than a movement.
    const rolesReady = Boolean(part && requiredSemanticRoles(definition).every((role) => part.roles?.[role] && document?.elements?.[part.roles[role]]));
    const enabled = Boolean(part?.controls?.includes(entry.id));
    const driver = part?.controlDrivers?.[entry.id] || null;
    const poses = enabled ? calibrationPoses(entry.part, entry.id, driver) : calibrationPoses(entry.part, entry.id, null);
    const record = part?.calibration?.[entry.id];
    const capturedKeys = driver?.method === 'morph' ? Object.keys(record || {}) : (record?.samples || []).map((sample) => sample.key);
    const poseItems = poses.map((pose) => ({ ...pose, captured: capturedKeys.includes(pose.key) }));
    const captured = poseItems.filter((pose) => pose.captured).length;
    // A shaped movement arrives calibrated: its shape keys already say what it
    // does at both ends, so the panel has nothing to ask for.
    const status = !part ? 'unassigned' : !rolesReady ? 'incomplete' : !enabled ? 'off'
      : driver?.method === 'shapeKey' || captured >= 2 ? 'calibrated' : 'on';
    return { ...entry, partId: part?.id || null, status, enabled, method: driver?.method || null, property: driver?.property || null, poses: poseItems, captured, total: poseItems.length, parameter: document?.params?.[entry.id] || null };
  });
  const groups = new Map();
  for (const item of items) { if (!groups.has(item.group)) groups.set(item.group, []); groups.get(item.group).push(item); }
  return {
    items,
    groups,
    available: items.filter((item) => item.status !== 'unassigned' && item.status !== 'incomplete').length,
    enabled: items.filter((item) => item.enabled).length,
    calibrated: items.filter((item) => item.status === 'calibrated').length,
    total: items.length
  };
}
