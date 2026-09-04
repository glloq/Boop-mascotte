import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelGate, createSelector, sameModel, shallowEqual } from '../selectors/create-selector.js';
import { PROJECT_SELECTORS, createProjectSelectors, selectGuide, selectHandleBoard, selectProjectShell, selectReadiness, selectSetupSections } from '../selectors/project-selectors.js';
import { deriveTaskReadiness, worstStatus } from '../validation/task-readiness.js';
import { GUIDE_STEPS } from '../validation/guide.js';
import { validateProject } from '../validation/validate-project.js';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';

/**
 * Selectors and ViewModels (VNX-04). The layer exists so a panel can answer
 * "is this the same thing I already drew?" without walking a whole document,
 * so the tests are about identity as much as they are about the shapes.
 */
const FACE = ['faceRoot', 'head', 'earLeft', 'earRight', 'shadeLeft', 'shadeRight', 'mouth', 'tongue', 'teeth',
  'eyeLeft', 'eyeRight', 'pupilLeft', 'pupilRight', 'lidUpperLeft', 'lidUpperRight', 'lidLowerLeft', 'lidLowerRight',
  'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'hairFront', 'eyebrows'];
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'path' } });
function project() {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(FACE.map((id) => [id, element()]));
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: FACE.filter((id) => id !== 'faceRoot').map((id) => ({ id, type: 'path', name: id, children: [] })) }];
  applyTemplateProject(state);
  return state;
}

test('the same revision returns the same object, so a panel can skip its render', () => {
  let runs = 0;
  const selector = createSelector((state) => { runs += 1; return { layers: state.layers.length }; });
  const first = selector(7, { layers: [1, 2] });
  assert.deepEqual(first, { layers: 2 });
  assert.equal(selector(7, { layers: [1, 2, 3] }), first, 'the key is the whole cache; the arguments are not even looked at');
  assert.equal(runs, 1);
});

test('a new revision recomputes, and clearing forgets what the selector knew', () => {
  let runs = 0;
  const selector = createSelector(() => ({ run: ++runs }));
  const first = selector(1), second = selector(2);
  assert.notEqual(second, first);
  assert.equal(selector(2), second);
  assert.equal(runs, 2);
  selector.clear();
  assert.notEqual(selector(2), second, 'a destroyed panel must not resurrect the ViewModel it was holding');
  // The store hands out a number and a symbol, and both work as keys.
  const token = Symbol('document'), memo = createSelector(() => ({}));
  assert.equal(memo(token), memo(token));
  assert.notEqual(memo(Symbol('document')), memo(token), 'two tokens that print the same are still two revisions');
});

test('a selector that throws keeps the answer it already had', () => {
  let broken = false;
  const selector = createSelector(() => { if (broken) throw new Error('derive failed'); return { ok: true }; });
  const first = selector(1);
  broken = true;
  assert.throws(() => selector(2), /derive failed/);
  assert.equal(selector(1), first, 'the failed key was never cached, so revision 1 is still valid');
});

test('shallowEqual compares one level and treats everything below it as changed', () => {
  assert.equal(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' }), true);
  assert.equal(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(shallowEqual({ a: undefined }, { b: undefined }), false, 'same size and the same lookups, different keys');
  assert.equal(shallowEqual([1, 2], [1, 2]), true);
  assert.equal(shallowEqual([1, 2], [2, 1]), false, 'order is part of an array');
  assert.equal(shallowEqual({ 0: 1, 1: 2 }, [1, 2]), false, 'an array and an object are not the same kind of model');
  const handle = { id: 'mouth' };
  assert.equal(shallowEqual({ handle }, { handle }), true);
  assert.equal(shallowEqual({ handle }, { handle: { id: 'mouth' } }), false, 'the second level is identity, not structure');
  assert.equal(shallowEqual(null, null), true);
  assert.equal(shallowEqual(null, {}), false);
  assert.equal(shallowEqual(undefined, null), false);
  assert.equal(shallowEqual(NaN, NaN), true, 'Object.is, so a slider that reads NaN is not a change every frame');
});

test('sameModel sees one level further down, and admits it sees no further', () => {
  const core = [{ label: 'Face', ready: true }];
  const model = { loaded: true, features: { hands: false }, core };
  assert.equal(sameModel(model, { loaded: true, features: { hands: false }, core }), true);
  assert.equal(sameModel(model, { loaded: true, features: { hands: true }, core }), false, 'a nested object is compared key by key');
  // The documented limit: the third level is identity, so a model rebuilt from
  // scratch reads as changed even when nothing in it moved.
  assert.equal(sameModel(model, { loaded: true, features: { hands: false }, core: [{ label: 'Face', ready: true }] }), false);
  assert.equal(sameModel({ steps: [] }, { steps: [] }), true, 'two empty arrays are still the same model');
  assert.equal(sameModel(null, null), true);
  assert.equal(sameModel({ a: 1 }, null), false);
  assert.equal(sameModel([{ id: 'a' }], [{ id: 'a' }]), true, 'a list of flat rows is still within reach');
  assert.equal(sameModel({ layers: [{ items: [] }] }, { layers: [{ items: [] }] }), false, 'and three levels down is the case it cannot judge');
});

test('a model gate renders the first time and then only when the ViewModel changed', () => {
  const changed = createModelGate(), core = [];
  assert.equal(changed({ loaded: true, core }), true, 'the first model is always a render');
  assert.equal(changed({ loaded: true, core }), false);
  assert.equal(changed({ loaded: false, core }), true);
  // A memoised selector already guarantees identity, so a panel fed by one can
  // ask the cheapest question there is.
  const model = { loaded: true }, byIdentity = createModelGate(Object.is);
  assert.equal(byIdentity(model), true);
  assert.equal(byIdentity(model), false);
  assert.equal(byIdentity({ ...model }), true);
});

test('the project shell reports what is loaded, what is installed and which core parts are complete', () => {
  const state = project(), shell = selectProjectShell(state);
  assert.equal(shell.loaded, true);
  assert.deepEqual(shell.core, [{ label: 'Face', ready: true }, { label: 'Eyes', ready: true }, { label: 'Gaze', ready: true }, { label: 'Mouth', ready: true }]);
  assert.equal(shell.featureCompatible, true, 'the head part owns faceRoot, so a face feature has somewhere to mount');
  assert.equal(shell.features.eyebrows, true, 'the template already draws the brows on the elements the feature names');
  assert.equal(shell.features.eyelids, false, 'its lids are its own artwork, which is not the same as the feature');
  assert.equal(shell.features.hands, false);
  // A part whose artwork was deleted is not a part that is done.
  delete state.elements.mouth;
  assert.equal(selectProjectShell(state).core.at(-1).ready, false);
  const empty = selectProjectShell({});
  assert.equal(empty.loaded, false);
  assert.equal(empty.featureCompatible, false);
  assert.deepEqual(empty.core.map((item) => item.ready), [false, false, false, false]);
  assert.equal(Object.values(empty.features).every((installed) => installed === false), true, 'an empty project reports rather than throwing');
});

test('the setup sections selector grades every heading of Face Setup', () => {
  const sections = selectSetupSections(project()), byId = (id) => sections.find((section) => section.id === id);
  assert.deepEqual(sections.map((section) => section.id), ['face-parts', 'movements', 'head-pose', 'hands', 'handles', 'warp', 'all-parts']);
  assert.deepEqual(byId('face-parts'), { ...byId('face-parts'), summary: '8 / 8', state: 'ready', panel: 'face-setup-checklist', open: true });
  assert.equal(byId('hands').state, 'empty', 'the template draws no hands, and hands are optional');
  assert.equal(byId('warp').advanced, true);
  assert.equal(selectSetupSections({}).length, sections.length, 'an empty project still gets every heading');
});

test('readiness carries the combined Face Setup badge the workspace tabs read', () => {
  const state = project();
  const ready = selectReadiness(state, validateProject(state));
  assert.equal(ready.artwork.status, 'ready');
  assert.equal(ready.blocking, 0);
  assert.equal(ready.faceSetupBadge, 'ready');
  assert.equal(Object.isFrozen(ready), true, 'badges, Preview, Problems and Export share it, so none of them may edit it');
  // The badge is the worse of the two sections it stands for, which is the only
  // reason it exists: a fully assigned face with uncalibrated movements is not
  // ready, and one tab has to say so.
  for (const part of Object.values(state.semanticParts)) { part.calibration = {}; part.controlDrivers = {}; }
  const issues = validateProject(state), uncalibrated = selectReadiness(state, issues);
  assert.equal(uncalibrated.faceSetup.status, 'ready');
  assert.equal(uncalibrated.movements.status, 'warning');
  assert.equal(uncalibrated.faceSetupBadge, worstStatus(uncalibrated.faceSetup.status, uncalibrated.movements.status));
  assert.equal(uncalibrated.faceSetupBadge, 'warning');
  // Everything deriveTaskReadiness reports is on it, unchanged: the selector adds a field, it does not restate one.
  const { faceSetupBadge, ...passedThrough } = uncalibrated;
  assert.deepEqual(passedThrough, { ...deriveTaskReadiness(state, issues) });
});

test('the guide selector answers what to do next from the same readiness model', () => {
  const state = project(), readiness = selectReadiness(state, validateProject(state));
  const guide = selectGuide(state, readiness);
  assert.equal(guide.total, GUIDE_STEPS.length);
  assert.equal(guide.blocker, null, 'nothing blocks the export, so the journey is the only advice');
  assert.deepEqual(guide.steps.filter((step) => step.done).map((step) => step.id), ['artwork', 'face-parts', 'movements', 'head-pose', 'motions', 'automatic']);
  assert.equal(guide.next.id, 'hands');
  assert.deepEqual(guide.steps.filter((step) => step.current).map((step) => step.id), ['hands'], 'exactly one step is the current one');
  // Given no readiness it derives its own, so a caller with nothing to hand it still gets an answer.
  assert.equal(selectGuide({}).next.id, 'artwork');
});

test('the handle board selector lists every control with the value it is at now', () => {
  const state = project(), board = selectHandleBoard(state, { mouthOpen: 0.4 });
  const items = board.layers.flatMap((layer) => layer.items);
  assert.ok(board.count >= 15);
  assert.equal(items.find((item) => item.id === 'mouth').axes.find((axis) => axis.control === 'mouthOpen').value, 0.4);
  assert.deepEqual(items.find((item) => item.id === 'eyes').members.map((member) => member.id), ['eyeLeft', 'eyeRight'], 'a member is listed under its group, not on its own row');
  assert.deepEqual(selectHandleBoard({}), { layers: [], hidden: [], count: 0 });
  // The live values are not in the document, which is why a memoised board has
  // to fold them into its key rather than trusting the revision alone.
  const moved = selectHandleBoard(state, { mouthOpen: 0.1 }).layers.flatMap((layer) => layer.items);
  assert.equal(moved.find((item) => item.id === 'mouth').axes.find((axis) => axis.control === 'mouthOpen').value, 0.1);
});

test('the memoised selectors hand a component the same ViewModel until the revision moves', () => {
  const state = project(), selectors = createProjectSelectors();
  assert.deepEqual(Object.keys(selectors), Object.keys(PROJECT_SELECTORS));
  const mustRender = createModelGate(Object.is);
  const first = selectors.projectShell(1, state);
  assert.equal(mustRender(first), true);
  assert.equal(selectors.projectShell(1, state), first, 'the second caller on revision 1 gets the first caller\'s work');
  assert.equal(mustRender(selectors.projectShell(1, state)), false, 'and the panel skips the render it used to do anyway');
  const next = selectors.projectShell(2, state);
  assert.notEqual(next, first, 'a new revision is a new object even when it says the same thing');
  assert.equal(mustRender(next), true);
  // Which is the case for a value gate to catch: nothing about the project
  // changed, so a panel over a flat slice of the model stays put.
  const flat = (model) => ({ loaded: model.loaded, featureCompatible: model.featureCompatible });
  const changed = createModelGate();
  assert.equal(changed(flat(first)), true);
  assert.equal(changed(flat(next)), false);
  // Each selector caches on its own key, so the readiness of one revision does
  // not evict the shell of another.
  const issues = validateProject(state);
  assert.equal(selectors.readiness(1, state, issues), selectors.readiness(1, state, issues));
  assert.equal(selectors.projectShell(2, state), next);
});
