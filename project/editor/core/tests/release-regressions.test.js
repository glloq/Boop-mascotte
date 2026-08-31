import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExportRig } from '../export/export-rig.js';
import { applyImportedRig } from '../state/import-rig.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createInitialState } from '../state/store.js';
import { createMascotEngine, normalizeBehaviors } from '../../../runtime/runtime.js';

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
