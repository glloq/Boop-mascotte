import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { BASIC_MOVEMENTS, calibrationPoses, deriveMovementChecklist, poseInstruction } from '../../rig-editor/semantic-parts/face-movements.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id, name) => ({ id, name, type: 'path', visible: true, children: [] });
function faceProject() {
  const ids = ['head', 'eyeL', 'eyeR', 'pupilL', 'pupilR', 'mouth'];
  return { svgMarkup: '<svg/>', elements: Object.fromEntries(ids.map((id) => [id, element()])), layers: ids.map((id) => layer(id, id)), layerMetadata: {}, semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', animationClips: [], behaviors: [] };
}
const pose = (role, x) => ({ [role]: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } });

test('the movement checklist covers every position of the face, with availability derived from assigned parts', () => {
  // Every part of the face, not the ten a beginner starts with: a movement
  // that is not here has no pose chip and no live slider, which is the same as
  // not being controllable.
  assert.equal(BASIC_MOVEMENTS.length, 19);
  assert.deepEqual([...new Set(BASIC_MOVEMENTS.map((item) => item.group))],
    ['Head', 'Eyes', 'Gaze', 'Eyebrows', 'Nose', 'Mouth', 'Jaw', 'Hair', 'Ears']);
  const store = createEditorStore(faceProject()), commands = createSemanticRigCommands(store, createHistory(store));
  commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'gaze', role: 'leftPupil', elementId: 'pupilL' }, { type: 'eyes', role: 'leftEye', elementId: 'eyeL' }, { type: 'eyes', role: 'rightEye', elementId: 'eyeR' }]);
  commands.enableControl('eyes', 'eyeOpen');
  const checklist = deriveMovementChecklist(store.getDocument()), byId = Object.fromEntries(checklist.items.map((item) => [item.id, item]));
  assert.equal(byId.headX.status, 'off', 'assigned but not enabled');
  assert.equal(byId.lookX.status, 'incomplete', 'gaze is missing its right pupil');
  assert.equal(byId.browRaise.status, 'unassigned');
  assert.equal(byId.eyeOpen.status, 'on');
  assert.equal(byId.eyeOpen.method, 'transform');
  assert.deepEqual(byId.eyeOpen.poses.map((p) => [p.key, p.captured]), [['closed', false], ['open', false]]);
  assert.deepEqual(byId.headX.poses.map((p) => p.key), ['left', 'center', 'right']);
  assert.equal(checklist.available, 4);
  assert.equal(checklist.enabled, 1);
  assert.deepEqual([...checklist.groups.keys()], ['Head', 'Eyes', 'Gaze', 'Eyebrows', 'Nose', 'Mouth', 'Jaw', 'Hair', 'Ears']);
  assert.deepEqual(calibrationPoses('eyes', 'eyeOpen', { method: 'morph' }).map((p) => p.key), ['closed', 'open']);
  assert.match(poseInstruction(byId.lookX, { key: 'left', label: 'LEFT', value: -1 }), /pupils to the left position/);
});

test('captureAndCalibrate solves the movement on the second pose in one undo step and reset restores defaults', () => {
  const store = createEditorStore(faceProject()), history = createHistory(store), commands = createSemanticRigCommands(store, createHistory(store));
  commands.assignFaceRoles([{ type: 'gaze', role: 'leftPupil', elementId: 'pupilL' }, { type: 'gaze', role: 'rightPupil', elementId: 'pupilR' }]);
  const tracked = createSemanticRigCommands(store, history);
  tracked.enableControl('gaze', 'lookX');
  const defaultAmplitude = store.getDocument().elements.pupilL.bindings.translateX.amplitude;
  assert.equal(tracked.captureAndCalibrate('gaze', 'lookX', { key: 'left', value: -1, pose: { ...pose('leftPupil', -12), ...pose('rightPupil', -12) } }), false, 'one pose cannot solve a movement');
  assert.equal(store.getDocument().elements.pupilL.bindings.translateX.amplitude, defaultAmplitude);
  assert.equal(deriveMovementChecklist(store.getDocument()).items.find((item) => item.id === 'lookX').status, 'on');
  const revision = store.getPersistentRevision();
  assert.equal(tracked.captureAndCalibrate('gaze', 'lookX', { key: 'right', value: 1, pose: { ...pose('leftPupil', 12), ...pose('rightPupil', 12) } }), true);
  assert.equal(store.getPersistentRevision(), revision + 1, 'capture and solve are one command');
  assert.equal(store.getDocument().elements.pupilL.bindings.translateX.amplitude, 12);
  assert.equal(store.getDocument().elements.pupilR.bindings.translateX.offset, 0);
  assert.equal(deriveMovementChecklist(store.getDocument()).items.find((item) => item.id === 'lookX').status, 'calibrated');
  history.undo();
  assert.equal(store.getDocument().elements.pupilL.bindings.translateX.amplitude, defaultAmplitude, 'one undo removes the solve and the second pose');
  assert.equal(store.getDocument().semanticParts.gaze.calibration.lookX.samples.length, 1);
  history.redo();
  tracked.resetCalibration('gaze', 'lookX');
  assert.equal(store.getDocument().semanticParts.gaze.calibration.lookX, undefined);
  assert.equal(store.getDocument().elements.pupilL.bindings.translateX.amplitude, defaultAmplitude);
  assert.equal(store.getDocument().elements.pupilL.bindings.translateX.generatedBy.control, 'lookX');
});

test('disableControl removes the owned driver and orphaned parameter but keeps parameters other features use', () => {
  const store = createEditorStore(faceProject()), history = createHistory(store), commands = createSemanticRigCommands(store, history);
  commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'mouth', role: 'mouth', elementId: 'mouth' }]);
  commands.enableControl('head', 'headX'); commands.enableControl('mouth', 'smile');
  store.mutateDocument({ type: 'test/clip', domains: ['animation'], apply: (d) => { d.animationClips.push({ id: 'c', name: 'Clip', duration: 1, loop: false, tracks: { smile: [{ time: 0, value: 0, easing: 'linear' }] } }); } });
  const before = structuredClone(store.getDocument());
  commands.disableControl('head', 'headX');
  const after = store.getDocument();
  assert.deepEqual(after.semanticParts.head.controls, []);
  assert.equal(after.elements.head.bindings.translateX, undefined);
  assert.equal(after.params.headX, undefined, 'orphaned parameter is dropped');
  assert.equal(after.states.idle.headX, undefined);
  commands.disableControl('mouth', 'smile');
  assert.equal(store.getDocument().params.smile !== undefined, true, 'a clip still references smile');
  assert.equal(store.getDocument().elements.mouth.bindings.translateY, undefined);
  history.undo(); history.undo();
  assert.deepEqual(store.getDocument(), before);
  assert.throws(() => commands.disableControl('head', 'headTilt'), /not enabled/);
});
