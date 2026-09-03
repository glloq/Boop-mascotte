import test from 'node:test';
import assert from 'node:assert/strict';
import { RIG_SCHEMA_VERSION, compileRigFrame, createMascotEngine } from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { parameterReferences, renameParameter, deleteParameter } from '../rig/project-model.js';
import { validateKeyforms } from '../validation/rig-validator.js';
import { validateProject } from '../validation/validate-project.js';
import { createExportRig } from '../export/export-rig.js';
import { createProjectSnapshot, applyProjectSnapshot } from '../state/project-snapshot.js';
import { createInitialState, createSampleProject } from '../state/store.js';

const params = () => ({
  headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
});

const poseGrid = (overrides = {}) => ({
  id: 'head-face-x',
  target: { kind: 'element', id: 'face' },
  channel: 'translateX',
  axes: [{ parameter: 'headX', values: [-1, 0, 1] }, { parameter: 'headY', values: [-1, 0, 1] }],
  keyforms: [{ at: [0, 1], value: -6 }, { at: [1, 1], value: 0 }, { at: [2, 1], value: 6 }],
  extrapolation: 'clamp',
  ...overrides
});

const element = () => ({ baseTransform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } });

test('the canonical schema is v4', () => {
  assert.equal(RIG_SCHEMA_VERSION, 4);
});

test('a v3 rig migrates to v4 with an empty pose list', () => {
  const migrated = normalizeRig({ schemaVersion: 3, params: params(), states: { idle: {} }, elements: { face: element() } });
  assert.equal(migrated.schemaVersion, 4);
  assert.deepEqual(migrated.keyforms, []);
});

test('normalizeRig keeps valid poses and drops unusable ones', () => {
  const migrated = normalizeRig({
    params: params(), states: {}, elements: { face: element() },
    keyforms: [
      poseGrid(),
      poseGrid({ id: '' }),
      poseGrid({ id: 'no-target', target: { kind: 'element', id: '' } }),
      poseGrid({ id: 'no-axis', axes: [] })
    ]
  });
  assert.deepEqual(migrated.keyforms.map((item) => item.id), ['head-face-x']);
});

test('normalizeRig is idempotent for poses', () => {
  const once = normalizeRig({ params: params(), states: {}, elements: { face: element() }, keyforms: [poseGrid()] });
  assert.deepEqual(normalizeRig(once).keyforms, once.keyforms);
});

test('a pose adds to the binding result on additive channels', () => {
  const elements = { face: { ...element(), bindings: { translateX: { expression: 'headX', amplitude: 2 } } } };
  const frame = compileRigFrame(elements, { headX: 1, headY: 0 }, {}, {}, { keyforms: [poseGrid()] });
  // base 10 + binding (1 × 2) + pose (+6)
  assert.equal(frame.face.transform.x, 18);
});

test('a pose multiplies on scale and opacity channels', () => {
  const scale = poseGrid({ id: 'ear-scale', channel: 'scaleX', keyforms: [{ at: [0, 1], value: 0.8 }, { at: [2, 1], value: 1.4 }] });
  const opacity = poseGrid({ id: 'ear-opacity', channel: 'opacity', keyforms: [{ at: [0, 1], value: 0.5 }, { at: [2, 1], value: 1 }] });
  const elements = { face: { ...element(), baseOpacity: 1 } };
  const frame = compileRigFrame(elements, { headX: -1, headY: 0 }, {}, {}, { keyforms: [scale, opacity] });
  assert.equal(frame.face.transform.scaleX, 0.8);
  assert.equal(frame.face.opacity, 0.5);
});

test('several poses on the same element and channel accumulate', () => {
  const a = poseGrid({ id: 'a', keyforms: [{ at: [2, 1], value: 6 }] });
  const b = poseGrid({ id: 'b', keyforms: [{ at: [2, 1], value: 3 }] });
  const frame = compileRigFrame({ face: element() }, { headX: 1, headY: 0 }, {}, {}, { keyforms: [a, b] });
  assert.equal(frame.face.transform.x, 19);
});

test('a rig with no poses compiles exactly as it did before v4', () => {
  const elements = { face: { ...element(), bindings: { translateX: { expression: 'headX', amplitude: 2 } } } };
  const values = { headX: 0.5, headY: 0 };
  assert.deepEqual(compileRigFrame(elements, values, {}, {}, { keyforms: [] }), compileRigFrame(elements, values));
});

test('constraints scale the pose contribution like any other animation', () => {
  const frame = compileRigFrame({ face: element() }, { headX: 1, headY: 0 }, { translate: 0.5 }, {}, { keyforms: [poseGrid()] });
  assert.equal(frame.face.transform.x, 13);
  const off = compileRigFrame({ face: { ...element(), constraints: { translate: false } } }, { headX: 1, headY: 0 }, {}, {}, { keyforms: [poseGrid()] });
  assert.equal(off.face.transform.x, 10);
});

test('a pathShape pose reports a shape-key weight instead of a transform', () => {
  const shape = poseGrid({ id: 'mouth-smile-pose', channel: 'pathShape', shapeKey: 'smile', keyforms: [{ at: [2, 1], value: 0.75 }] });
  const frame = compileRigFrame({ face: element() }, { headX: 1, headY: 0 }, {}, {}, { keyforms: [shape] });
  assert.deepEqual(frame.face.shapeWeights, { smile: 0.75 });
  assert.equal(frame.face.transform.x, 10);
});

test('the engine evaluates poses through the same shared compiler', () => {
  const rig = normalizeRig({
    params: params(), states: { idle: { headX: 0, headY: 0 } }, activeState: 'idle', transitions: {},
    elements: { face: element() }, keyforms: [poseGrid()]
  });
  const applied = [];
  const node = { id: 'face', tagName: 'g', style: {}, setAttribute: (name, value) => applied.push([name, value]) };
  const engine = createMascotEngine({
    svgRoot: { id: null, querySelector: () => node, querySelectorAll: null },
    rig, fps: 0, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0
  });
  engine.setParam('headX', 1);
  const frame = compileRigFrame(rig.elements, engine.getParams(), rig.globalConstraints, {}, { keyforms: rig.keyforms });
  assert.equal(frame.face.transform.x, 16);
});

test('parameter references list the poses that use a parameter', () => {
  const rig = { params: params(), states: {}, elements: { face: element() }, keyforms: [poseGrid()] };
  assert.deepEqual(parameterReferences(rig, 'headX').keyforms, ['head-face-x']);
  assert.deepEqual(parameterReferences(rig, 'headY').keyforms, ['head-face-x']);
  assert.deepEqual(parameterReferences(rig, 'smile').keyforms, []);
});

test('renaming a parameter retargets pose axes', () => {
  const rig = { params: params(), states: {}, elements: { face: element() }, keyforms: [poseGrid()] };
  renameParameter(rig, 'headX', 'headTurn');
  assert.equal(rig.keyforms[0].axes[0].parameter, 'headTurn');
  assert.equal(rig.keyforms[0].axes[1].parameter, 'headY');
});

test('deleting a parameter removes the poses that can no longer be evaluated', () => {
  const rig = { params: params(), states: {}, elements: { face: element() }, keyforms: [poseGrid()] };
  const refs = deleteParameter(rig, 'headY');
  assert.deepEqual(refs.keyforms, ['head-face-x']);
  assert.deepEqual(rig.keyforms, []);
});

test('pose diagnostics are written for someone building a mascot', () => {
  const issues = validateKeyforms({
    elements: {}, params: {},
    keyforms: [poseGrid({ target: { kind: 'element', id: 'ghost' } })]
  });
  assert.ok(issues.some((issue) => /the shape "ghost" it poses no longer exists/.test(issue)));
  assert.ok(issues.some((issue) => /first axis uses a movement that no longer exists: "headX"/.test(issue)));
  assert.ok(issues.every((issue) => !/undefined|\[object/.test(issue)));
});

test('pose diagnostics catch broken axes, cells and channels', () => {
  const base = { elements: { face: element() }, params: params() };
  const of = (overrides) => validateKeyforms({ ...base, keyforms: [poseGrid(overrides)] });
  assert.ok(of({ channel: 'wobble' }).some((issue) => /unknown movement "wobble"/.test(issue)));
  assert.ok(of({ channel: 'pathShape', shapeKey: null }).some((issue) => /must name the shape key/.test(issue)));
  assert.ok(of({ axes: [] }).some((issue) => /needs one or two movement axes/.test(issue)));
  assert.ok(of({ axes: [{ parameter: 'headX', values: [0, 0] }] }).some((issue) => /repeats a position/.test(issue)));
  assert.ok(of({ keyforms: [{ at: [9, 9], value: 1 }] }).some((issue) => /outside the grid/.test(issue)));
  assert.ok(of({ keyforms: [{ at: [0], value: 1 }] }).some((issue) => /does not match the number of axes/.test(issue)));
  assert.deepEqual(of({}), []);
});

test('an empty pose warns instead of blocking export', () => {
  const state = { ...createSampleProject(), svgMarkup: '<svg><g id="face"/></svg>', keyforms: [poseGrid({ keyforms: [] })] };
  const issues = validateProject(state);
  const empty = issues.find((issue) => issue.id === 'pose.head-face-x.empty');
  assert.ok(empty);
  assert.equal(empty.severity, 'warning');
  assert.equal(empty.domain, 'poses');
  assert.equal(empty.blocking, false);
});

test('poses survive a snapshot round-trip and reach the exported rig', () => {
  const state = createSampleProject();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><g id="face"><path d="M0 0L1 1"/></g></svg>';
  state.elements = { face: element() };
  state.params = { ...state.params, ...params() };
  state.keyforms = [poseGrid()];
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  assert.equal(snapshot.document.rig.keyforms.length, 1);

  const restored = createInitialState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.keyforms, snapshot.document.rig.keyforms);
  assert.equal(createExportRig(restored).keyforms[0].id, 'head-face-x');
});

test('a snapshot without poses restores an empty pose list', () => {
  const state = createSampleProject();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><g id="face"><path d="M0 0L1 1"/></g></svg>';
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  delete snapshot.document.rig.keyforms;
  const restored = createInitialState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.keyforms, []);
});
