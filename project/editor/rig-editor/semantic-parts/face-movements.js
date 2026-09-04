// Basic movements checklist: the ten semantic controls a beginner enables and
// calibrates visually in Face Setup. Derived from ProjectDocument only; the
// authored truth stays in `semanticParts[*].controls / controlDrivers /
// calibration` and the generated bindings.
import { SEMANTIC_PART_REGISTRY, requiredSemanticRoles } from './part-registry.js';
import { findFacePartByType } from './face-roles.js';

export const BASIC_MOVEMENTS = Object.freeze([
  Object.freeze({ id: 'headX', part: 'head', label: 'Move left / right', group: 'Head', axis: 'x', pair: 'headY' }),
  Object.freeze({ id: 'headY', part: 'head', label: 'Move up / down', group: 'Head', axis: 'y', pair: 'headX' }),
  Object.freeze({ id: 'headTilt', part: 'head', label: 'Tilt', group: 'Head', axis: 'x' }),
  Object.freeze({ id: 'eyeOpen', part: 'eyes', label: 'Open / close', group: 'Eyes', axis: 'y' }),
  Object.freeze({ id: 'lookX', part: 'gaze', label: 'Look left / right', group: 'Gaze', axis: 'x', pair: 'lookY' }),
  Object.freeze({ id: 'lookY', part: 'gaze', label: 'Look up / down', group: 'Gaze', axis: 'y', pair: 'lookX' }),
  Object.freeze({ id: 'browRaise', part: 'eyebrows', label: 'Raise', group: 'Eyebrows', axis: 'y' }),
  Object.freeze({ id: 'browTilt', part: 'eyebrows', label: 'Tilt', group: 'Eyebrows', axis: 'x' }),
  Object.freeze({ id: 'mouthOpen', part: 'mouth', label: 'Open / close', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'smile', part: 'mouth', label: 'Smile', group: 'Mouth', axis: 'y' })
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

/** Human, direction-aware instruction for capturing one pose. */
export function poseInstruction(entry, pose) {
  const subject = { head: 'the head', eyes: 'the eyes', gaze: 'the pupils', eyebrows: 'the eyebrows', mouth: 'the mouth' }[entry.part] || 'the artwork';
  const verb = pose.value === 0 && pose.key !== 'open' && pose.key !== 'closed' ? 'Leave' : 'Move';
  return `${verb} ${subject} to the ${pose.label.toLowerCase()} position, then press Capture.`;
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
