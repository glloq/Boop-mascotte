import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { FACE_ROLE_CHECKLIST, deriveFaceRoleChecklist, findFaceRoleUsage, listAssignableElements, nextMissingFaceRole } from '../../rig-editor/semantic-parts/face-roles.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id, name, children = []) => ({ id, name, type: 'path', visible: true, children });
const project = () => ({
  svgMarkup: '<svg/>',
  elements: { head: element(), eyeL: element(), eyeR: element(), pupilL: element(), pupilR: element(), mouth: element() },
  layers: [layer('head', 'Head shape', [layer('eyeL', 'Left eye'), layer('eyeR', 'Right eye'), layer('pupilL', 'Left pupil'), layer('pupilR', 'Right pupil'), layer('mouth', 'Mouth')])],
  layerMetadata: {}, semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', animationClips: []
});

test('checklist exposes eight basic roles in beginner order and derives status from authored roles', () => {
  assert.deepEqual(FACE_ROLE_CHECKLIST.map((entry) => entry.id), ['head', 'leftEye', 'rightEye', 'leftPupil', 'rightPupil', 'leftBrow', 'rightBrow', 'mouth']);
  const empty = deriveFaceRoleChecklist(project());
  assert.equal(empty.assigned, 0); assert.equal(empty.total, 8); assert.equal(empty.complete, false); assert.equal(empty.next, 'head');
  assert.ok(empty.items.every((item) => item.status === 'missing' && item.partId === null));

  const state = project();
  state.semanticParts = { head: { id: 'head', type: 'head', name: 'Head', roles: { head: 'head' }, controls: [], controlDrivers: {}, calibration: {} }, gaze: { id: 'gaze', type: 'gaze', name: 'Pupils', roles: { leftPupil: 'pupilL', rightPupil: 'ghost' }, controls: [], controlDrivers: {}, calibration: {} } };
  const checklist = deriveFaceRoleChecklist(state), byId = Object.fromEntries(checklist.items.map((item) => [item.id, item]));
  assert.equal(byId.head.status, 'assigned'); assert.equal(byId.head.elementName, 'Head shape');
  assert.equal(byId.leftPupil.status, 'assigned'); assert.equal(byId.leftPupil.partId, 'gaze');
  assert.equal(byId.rightPupil.status, 'invalid');
  assert.equal(byId.leftEye.status, 'missing');
  assert.equal(checklist.assigned, 2); assert.equal(checklist.next, 'leftEye');
  assert.equal(nextMissingFaceRole(state, 'leftEye').id, 'rightEye');
  assert.equal(nextMissingFaceRole(state, 'mouth').id, 'leftEye', 'wraps around after the last role');
  assert.equal(findFaceRoleUsage(state, 'pupilL').id, 'leftPupil');
  assert.equal(findFaceRoleUsage(state, 'pupilL', 'leftPupil'), null);
  assert.deepEqual(listAssignableElements(state).map((item) => item.id), ['head', 'eyeL', 'eyeR', 'pupilL', 'pupilR', 'mouth']);
  assert.deepEqual(state.semanticParts.gaze.roles, { leftPupil: 'pupilL', rightPupil: 'ghost' }, 'derivation never mutates the document');
});

test('assignFaceRole creates the owning part and assigns artwork as one undoable command', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createSemanticRigCommands(store, history);
  const revision = store.getPersistentRevision();
  const partId = commands.assignFaceRole('gaze', 'leftPupil', 'pupilL');
  assert.equal(partId, 'gaze');
  assert.deepEqual(store.getDocument().semanticParts.gaze.roles, { leftPupil: 'pupilL' });
  assert.equal(store.getPersistentRevision(), revision + 1);
  assert.equal(history.getState().canUndo, true);
  history.undo();
  assert.deepEqual(store.getDocument().semanticParts, {}, 'one undo removes the role and the part it created');
  history.redo();
  assert.deepEqual(store.getDocument().semanticParts.gaze.roles, { leftPupil: 'pupilL' });
  assert.equal(commands.assignFaceRole('gaze', 'rightPupil', 'pupilR'), 'gaze', 'reuses the existing part instead of creating gaze-2');
  assert.deepEqual(Object.keys(store.getDocument().semanticParts), ['gaze']);
  assert.equal(deriveFaceRoleChecklist(store.getDocument()).assigned, 2);
});

test('assignFaceRole rejects missing artwork and in-part duplicates without touching history', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createSemanticRigCommands(store, history);
  commands.assignFaceRole('eyes', 'leftEye', 'eyeL');
  const before = structuredClone(store.getDocument()), revision = store.getPersistentRevision(), undoable = history.getState();
  assert.throws(() => commands.assignFaceRole('eyes', 'rightEye', 'eyeL'), /already used/);
  assert.throws(() => commands.assignFaceRole('mouth', 'mouth', 'nope'), /does not exist/);
  assert.deepEqual(store.getDocument(), before);
  assert.equal(store.getPersistentRevision(), revision);
  assert.deepEqual(history.getState(), undoable);
  assert.deepEqual(Object.keys(store.getDocument().semanticParts), ['eyes'], 'a failed assignment leaves no orphan part');
});
