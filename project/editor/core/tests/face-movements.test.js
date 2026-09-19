import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { BASIC_MOVEMENTS, MOVEMENT_TIERS, byTier, calibrationPoses, contextualMovements, deriveMovementChecklist, movementFamilies, movementTier, poseInstruction } from '../../rig-editor/semantic-parts/face-movements.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { disableSemanticControl } from '../../rig-editor/semantic-parts/part-model.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id, name) => ({ id, name, type: 'path', visible: true, children: [] });
function faceProject() {
  const ids = ['head', 'eyeL', 'eyeR', 'pupilL', 'pupilR', 'mouth'];
  return { svgMarkup: '<svg/>', elements: Object.fromEntries(ids.map((id) => [id, element()])), layers: ids.map((id) => layer(id, id)), layerMetadata: {}, semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', animationClips: [], behaviors: [] };
}
const pose = (role, x) => ({ [role]: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } });

test('a shaped movement is ready when it has its keys, and not merely when it has the method', () => {
  // Teeth and a tongue are shape keys on the template, which authors them
  // itself -- so "shaped" and "ready" always coincided there and the row asked
  // the method rather than the keys. Switch one on by hand on a face that has
  // none and the method is written immediately: the row said "On · ready"
  // about a movement with nothing at all behind it.
  const state = createTemplateProjectState();
  const row = (id) => deriveMovementChecklist(state).items.find((item) => item.id === id);
  for (const id of ['teeth', 'tongue', 'jawOpen']) {
    assert.equal(row(id).status, 'calibrated', `${id} ships with its keys`);
    assert.equal(row(id).movingBy, 'shapeKey', `${id} moves by the keys it owns`);
  }
  state.shapeKeys = state.shapeKeys.filter((key) => key?.generatedBy?.control !== 'teeth');
  assert.equal(row('teeth').status, 'on', 'with its keys gone it is on and not set up');
  assert.equal(row('teeth').moving, false);
  assert.equal(row('tongue').status, 'calibrated', 'and its neighbour is untouched');
});

test('a movement two parts share is one row, and switching it off reaches both', () => {
  // The lids are what actually shuts an eye, and they are a part of their own
  // carrying the same `eyeOpen` as the eyes. The row used to name the eyes
  // alone: unticking Eyes · Open / close took the eyes' own squash off and
  // left all four lid bindings live, so the face went on blinking with its
  // movement switched off and nothing left in the panel to stop it.
  const state = createTemplateProjectState();
  const row = () => deriveMovementChecklist(state).items.find((item) => item.id === 'eyeOpen');
  const lids = Object.values(state.semanticParts).find((part) => part.type === 'eyelids');
  const moving = () => Object.values(lids.roles)
    .flatMap((id) => Object.values(state.elements[id]?.bindings || {}))
    .filter((binding) => binding?.enabled !== false && Number(binding.amplitude) !== 0).length;

  assert.deepEqual(row().partIds, ['eyes', 'eyelids'], 'one row, both parts');
  assert.equal(row().enabled, true);
  assert.equal(moving(), 4, 'two upper lids and two lower ones');

  for (const partId of row().partIds) disableSemanticControl(state, partId, 'eyeOpen');
  assert.equal(moving(), 0, 'the eye stops closing when its movement is switched off');
  assert.equal(row().enabled, false);

  // Every other row names one part, and the jaw's reaches facial hair for the
  // same reason: a beard is carried by the jaw opening under it. Narrowing and
  // the lid curve are the *lids'* own rows rather than shared ones, because
  // neither is a thing that can be done to an eyeball
  // (docs/FACE_SVG_STATES.md).
  assert.deepEqual(BASIC_MOVEMENTS.filter((entry) => entry.also).map((entry) => [entry.id, entry.part, ...entry.also]),
    [['eyeOpen', 'eyes', 'eyelids'], ['jawOpen', 'jaw', 'facialHair']]);
});

test('every control a semantic part declares has a row that can switch it off', () => {
  // A control with no row has no checkbox, no pose chips and no slider, which
  // is the same as not being controllable at all -- and worse when another
  // part's row appears to cover it.
  const rows = new Set(BASIC_MOVEMENTS.flatMap((entry) => [entry.part, ...(entry.also || [])].map((part) => `${part}:${entry.id}`)));
  const missing = [];
  for (const [type, definition] of Object.entries(SEMANTIC_PART_REGISTRY)) {
    for (const control of definition.controls || []) if (!rows.has(`${type}:${control}`)) missing.push(`${type}.${control}`);
  }
  assert.deepEqual(missing, [], 'controls the Movements panel cannot reach');
});

test('the movement checklist covers every position of the face, with availability derived from assigned parts', () => {
  // Every part of the face, not the ten a beginner starts with: a movement
  // that is not here has no pose chip and no live slider, which is the same as
  // not being controllable.
  assert.equal(BASIC_MOVEMENTS.length, 26);
  assert.deepEqual([...new Set(BASIC_MOVEMENTS.map((item) => item.group))],
    ['Head', 'Eyes', 'Gaze', 'Eyebrows', 'Nose', 'Mouth', 'Jaw', 'Tongue', 'Hair', 'Ears']);
  const store = createEditorStore(faceProject()), commands = createSemanticRigCommands(store, createHistory(store));
  commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }, { type: 'gaze', role: 'leftPupil', elementId: 'pupilL' }, { type: 'eyes', role: 'leftEye', elementId: 'eyeL' }, { type: 'eyes', role: 'rightEye', elementId: 'eyeR' }]);
  commands.enableControl('eyes', 'eyeOpen');
  const checklist = deriveMovementChecklist(store.getDocument()), byId = Object.fromEntries(checklist.items.map((item) => [item.id, item]));
  assert.equal(byId.headX.status, 'off', 'assigned but not enabled');
  assert.equal(byId.lookX.status, 'incomplete', 'gaze is missing its right pupil');
  assert.equal(byId.browRaise.status, 'unassigned');
  assert.equal(byId.eyeOpen.status, 'on');
  assert.equal(byId.eyeOpen.method, 'transform');
  // Turning it on wrote generated bindings with a default range: it moves
  // already, and the row says so rather than "not set up yet".
  assert.equal(byId.eyeOpen.moving, true);
  assert.equal(byId.eyeOpen.movingBy, 'bindings');
  assert.equal(byId.headX.moving, false, 'off movements do not move');
  assert.deepEqual(byId.eyeOpen.poses.map((p) => [p.key, p.captured]), [['closed', false], ['open', false]]);
  assert.deepEqual(byId.headX.poses.map((p) => p.key), ['left', 'center', 'right']);
  assert.equal(checklist.available, 4);
  assert.equal(checklist.enabled, 1);
  assert.deepEqual([...checklist.groups.keys()], ['Head', 'Eyes', 'Gaze', 'Eyebrows', 'Nose', 'Mouth', 'Jaw', 'Tongue', 'Hair', 'Ears']);
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

test('a head movement counts as moving once the head pose grid is posed', () => {
  const store = createEditorStore(faceProject()), commands = createSemanticRigCommands(store, createHistory(store));
  commands.assignFaceRoles([{ type: 'head', role: 'head', elementId: 'head' }]);
  commands.enableControl('head', 'headX');
  const before = deriveMovementChecklist(store.getDocument()).items.find((item) => item.id === 'headX');
  assert.equal(before.status, 'on');
  assert.equal(before.movingBy, 'bindings', 'the generated binding turns it a little on its own');
  store.mutateDocument({ type: 'test/pose-grid', domains: ['keyforms'], source: 'test', apply: (document) => { document.keyforms = [{ id: 'headPose:head', target: 'head', keyforms: [{ at: [1, 0], transform: { x: 4 } }] }]; } });
  const after = deriveMovementChecklist(store.getDocument()).items.find((item) => item.id === 'headX');
  assert.equal(after.movingBy, 'headPose');
  assert.equal(after.moving, true);
});

/* ── UX-50 PR 2: the panel stops being an inventory ───────────────────────── */

test('every movement is ranked, so none of them is shown by accident', () => {
  // An untagged movement defaults to `more` — it folds rather than shouting —
  // but a table where that default is doing the work is a table nobody tiered.
  for (const entry of BASIC_MOVEMENTS) {
    assert.ok(MOVEMENT_TIERS.includes(entry.tier), `${entry.id} names a real tier`);
    assert.equal(movementTier(entry), entry.tier);
  }
  assert.equal(movementTier({ id: 'nothing' }), 'more', 'and anything untagged folds');
  assert.equal(movementTier(null), 'more');
});

test('the four movements somebody means by "make the mouth move" are the quick ones', () => {
  // The example in the brief, held to literally: Open/close, Smile, Width and
  // Round in front; Teeth and Tongue folded behind them.
  const mouth = BASIC_MOVEMENTS.filter((entry) => entry.group === 'Mouth');
  const { quick, more } = byTier(mouth);
  assert.deepEqual(quick.map((item) => item.id), ['mouthOpen', 'smile', 'mouthWidth', 'mouthRound']);
  assert.deepEqual(more.map((item) => item.id), ['teeth', 'tongue']);
});

test('a part in hand narrows the panel to its band, and says how much it is holding back', () => {
  const state = createTemplateProjectState();
  const checklist = deriveMovementChecklist(state);
  // Nothing in hand: the families, not the inventory (§10).
  const none = contextualMovements(checklist, {});
  assert.equal(none.scope, 'families');
  assert.equal(none.shown, 0, 'no rows at all');
  assert.equal(none.hidden, checklist.items.length);
  assert.ok(none.families.length, 'and the way in is the families');

  const all = contextualMovements(checklist, { showAll: true });
  assert.equal(all.scope, 'all');
  assert.equal(all.hidden, 0, 'the whole inventory hides nothing');
  assert.equal(all.shown, checklist.items.length);

  const mouth = contextualMovements(checklist, { band: 'Mouth' });
  assert.equal(mouth.scope, 'band');
  assert.equal(mouth.band, 'Mouth');
  assert.deepEqual([...mouth.bands.keys()], ['Mouth']);
  assert.ok(mouth.shown < checklist.items.length, 'it is narrower than everything');
  assert.equal(mouth.shown + mouth.hidden, checklist.items.length, 'and it can account for every row it is not showing');
});

test('Show all controls puts the inventory back, whatever is selected', () => {
  // The escape hatch progressive disclosure owes the author (§34): narrowing
  // must never be the only state the panel can be in.
  const checklist = deriveMovementChecklist(createTemplateProjectState());
  const restored = contextualMovements(checklist, { band: 'Mouth', showAll: true });
  assert.equal(restored.scope, 'all');
  assert.equal(restored.band, null);
  assert.equal(restored.shown, checklist.items.length);
  assert.equal(restored.hidden, 0);
});

test('a band this project has nothing in cannot narrow the panel to nothing', () => {
  // A face with no brows assigned still has Brows rows in the checklist, so the
  // band exists. A band the checklist dropped entirely must not produce a
  // screen of rows for a part that is not there — it falls back to the
  // families, which is what an unrecognised subject deserves.
  const checklist = deriveMovementChecklist(createTemplateProjectState());
  const missing = contextualMovements(checklist, { band: 'Nonexistent' });
  assert.equal(missing.scope, 'families');
  assert.equal(missing.shown, 0);
  assert.ok(missing.families.length, 'and every family is still a way in');
  // And asking for everything still works from there.
  assert.equal(contextualMovements(checklist, { band: 'Nonexistent', showAll: true }).shown, checklist.items.length);
});

test('with nothing in hand the panel offers families and their readiness, not rows', () => {
  const state = createTemplateProjectState();
  const families = movementFamilies(deriveMovementChecklist(state));
  assert.deepEqual(families.map((family) => family.band), ['Head', 'Eyes', 'Brows', 'Mouth', 'Extra']);
  for (const family of families) {
    assert.ok(family.total > 0, `${family.band} has movements`);
    assert.ok(family.enabled <= family.available, `${family.band} cannot have more on than it has`);
    assert.ok(family.available <= family.total);
  }
  // Every movement is accounted for by exactly one family: a row filed under no
  // family is a row no empty state leads to.
  assert.equal(families.reduce((sum, family) => sum + family.total, 0), BASIC_MOVEMENTS.length);
});

test('a face with nothing assigned offers families that say so rather than families that lie', () => {
  const state = faceProject();
  const families = movementFamilies(deriveMovementChecklist(state));
  assert.ok(families.length, 'the families are still listed');
  for (const family of families) assert.equal(family.available, 0, `${family.band} has nothing to turn on yet`);
});
