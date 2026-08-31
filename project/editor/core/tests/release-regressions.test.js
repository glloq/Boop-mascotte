import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExportRig } from '../export/export-rig.js';
import { applyImportedRig } from '../state/import-rig.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createInitialState, createStore } from '../state/store.js';
import { createMascotEngine, normalizeBehaviors } from '../../../runtime/runtime.js';
import { createHistory } from '../undo/history.js';
import { deleteState, renameState } from '../rig/project-model.js';

const complete = () => ({ ...createInitialState(), transitionSettings: { 'idle->happy': { duration: 300, easing: 'easeInOut' } }, behaviors: [{ id: 'blink', type: 'blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 4, duration: .1, closedValue: 0 }] });

test('canvas uses the SVG.js 2 attachment API (regression: t.put is not a function)', async () => {
  const source = await readFile(new URL('../../svg-editor/svg-canvas.js', import.meta.url), 'utf8');
  assert.match(source, /SVG\(container\)\.size/);
  assert.doesNotMatch(source, /SVG\(\)\.addTo/);
});

test('rig v3 export/import preserves all runtime data', () => {
  const source = complete(), exported = createExportRig(source), target = createInitialState();
  applyImportedRig(target, exported);
  assert.deepEqual(target.behaviors, normalizeBehaviors(source));
  assert.deepEqual(target.transitionSettings, source.transitionSettings);
  for (const key of ['schemaVersion','params','states','elements','activeState','transitions','transitionSettings','globalConstraints','stateConstraints','runtimeConfig','behaviors']) assert.ok(key in exported, key);
});

test('project save/load/save is semantically stable', () => {
  const source = complete(); source.svgMarkup = '<svg id="authoring"/>'; source.layerMetadata = { authoring: { name: 'Face' } };
  const first = createProjectSnapshot(source, () => source.svgMarkup), restored = createInitialState();
  applyProjectSnapshot(restored, first);
  const second = createProjectSnapshot(restored, () => restored.svgMarkup);
  delete first.capturedAt; delete second.capturedAt;
  assert.deepEqual(second, first);
});

test('exported runtime source has no relative import', async () => {
  const source = await readFile(new URL('../../../runtime/runtime.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:from\s*|import\s*)['"]\.\.?\//);
  const standalone = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(typeof standalone.createMascotEngine, 'function');
});

test('external overrides persist through state transitions and can be cleared', () => {
  let now = 0, callback;
  const oldPerformance = globalThis.performance, oldRaf = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  globalThis.requestAnimationFrame = (fn) => { callback = fn; return 1; }; globalThis.cancelAnimationFrame = () => {};
  try {
    const node = { style: {}, tagName: 'g', setAttribute() {} };
    const rig = complete(); rig.elements = { eye: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, bindings: {} } };
    const engine = createMascotEngine({ svgRoot: { querySelector: () => node }, rig, fps: 60 });
    assert.equal(engine.setParam('eyeOpen', .8), true);
    assert.equal(engine.setState('happy'), true);
    now = 150; assert.equal(engine.getParams().eyeOpen, .8);
    engine.clearParam('eyeOpen'); assert.equal(engine.getParams().eyeOpen, 1);
    engine.start(); callback(200); engine.stop();
  } finally {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: oldPerformance });
    globalThis.requestAnimationFrame = oldRaf; globalThis.cancelAnimationFrame = oldCancel;
  }
});

test('interrupted transitions start from the current interpolated values', () => {
  let now = 0;
  const oldPerformance = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  try {
    const rig = { params: { mood: { default: 0, value: 0 } }, states: { idle: { mood: 0 }, happy: { mood: 1 }, surprised: { mood: -1 } }, activeState: 'idle',
      transitions: { idle: ['happy'], happy: ['surprised'] }, transitionSettings: { 'idle->happy': { duration: 1000, easing: 'linear' }, 'happy->surprised': { duration: 1000, easing: 'linear' } }, elements: {} };
    const engine = createMascotEngine({ svgRoot: { querySelector: () => null }, rig });
    engine.setState('happy'); now = 500; assert.equal(engine.getParams().mood, .5);
    engine.setState('surprised'); assert.equal(engine.getParams().mood, .5);
    now = 1000; assert.equal(engine.getParams().mood, -.25);
    now = 1500; assert.equal(engine.getParams().mood, -1);
  } finally { Object.defineProperty(globalThis, 'performance', { configurable: true, value: oldPerformance }); }
});

test('state rename/delete rewrites and removes every transition setting reference', () => {
  const rig = { params: {}, states: { idle: {}, happy: {}, sad: {} }, activeState: 'happy', transitions: { idle: ['happy'], happy: ['sad'], sad: ['happy'] },
    transitionSettings: { 'idle->happy': { duration: 1 }, 'happy->sad': { duration: 2 }, 'sad->happy': { duration: 3 } } };
  renameState(rig, 'happy', 'joy');
  assert.equal(rig.activeState, 'joy'); assert.deepEqual(rig.transitions, { idle: ['joy'], joy: ['sad'], sad: ['joy'] });
  assert.deepEqual(Object.keys(rig.transitionSettings).sort(), ['idle->joy', 'joy->sad', 'sad->joy']);
  deleteState(rig, 'sad'); assert.deepEqual(rig.transitions, { idle: ['joy'], joy: [] });
  assert.deepEqual(Object.keys(rig.transitionSettings), ['idle->joy']);
});

test('history snapshots restore serialized authoring SVG atomically with rig state', () => {
  const store = createStore(), history = createHistory(store);
  store.setState((state) => { state.svgMarkup = '<svg><g id="a" transform="translate(0 0)"/></svg>'; state.elements = { a: { baseTransform: { x: 0 } } }; });
  history.snapshot();
  store.setState((state) => { state.svgMarkup = '<svg><g id="a" transform="translate(100 0)"/></svg>'; state.elements.a.baseTransform.x = 100; });
  history.undo(); assert.equal(store.getState().elements.a.baseTransform.x, 0); assert.match(store.getState().svgMarkup, /translate\(0 0\)/);
  history.redo(); assert.equal(store.getState().elements.a.baseTransform.x, 100); assert.match(store.getState().svgMarkup, /translate\(100 0\)/);
});
