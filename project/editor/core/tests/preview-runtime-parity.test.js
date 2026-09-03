import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileFrame } from '../preview-runtime/frame-compiler.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { RUNTIME_MODULES, bundleRuntimeSource } from '../export/runtime-bundle.js';

/** The runtime a user actually receives, loaded the way a page would load it. */
async function loadExportedRuntime() {
  const modules = await Promise.all(RUNTIME_MODULES.map(async (name) => ({
    name, source: await readFile(new URL(`../../../runtime/${name}`, import.meta.url), 'utf8')
  })));
  const source = bundleRuntimeSource(modules);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const state = () => normalizeRig({
  params: {
    headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    smile: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
  },
  states: { idle: { headX: 0, headY: 0, smile: 0 } },
  activeState: 'idle',
  transitions: {},
  elements: {
    face: {
      baseTransform: { x: 4, y: -2, rotation: 3, scaleX: 1.1, scaleY: 0.9, pivotX: 20, pivotY: 30 },
      baseOpacity: 0.9,
      bindings: { translateY: { expression: 'headY', amplitude: 5 }, rotation: { expression: 'headX', amplitude: 4, curve: 'easeInOut' } }
    },
    nose: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } },
    earLeft: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 }
  },
  keyforms: [
    { id: 'face-x', target: { kind: 'element', id: 'face' }, channel: 'translateX',
      axes: [{ parameter: 'headX', values: [-1, 0, 1] }, { parameter: 'headY', values: [-1, 0, 1] }],
      keyforms: [{ at: [0, 1], value: -6 }, { at: [1, 1], value: 0 }, { at: [2, 1], value: 6 }, { at: [1, 0], value: 1 }] },
    { id: 'nose-x', target: { kind: 'element', id: 'nose' }, channel: 'translateX',
      axes: [{ parameter: 'headX', values: [-1, -0.4, 0, 0.7, 1] }],
      keyforms: [{ at: [0], value: -9 }, { at: [2], value: 0 }, { at: [4], value: 9 }] },
    { id: 'ear-opacity', target: { kind: 'element', id: 'earLeft' }, channel: 'opacity',
      axes: [{ parameter: 'headX', values: [-1, 0, 1] }],
      keyforms: [{ at: [0], value: 0.2 }, { at: [2], value: 1 }] },
    { id: 'ear-scale', target: { kind: 'element', id: 'earLeft' }, channel: 'scaleX',
      axes: [{ parameter: 'headX', values: [-1, 0, 1] }],
      keyforms: [{ at: [0], value: 0.7 }, { at: [2], value: 1.3 }] }
  ]
});

const SAMPLES = [
  { headX: 0, headY: 0, smile: 0 },
  { headX: 1, headY: 0, smile: 0 },
  { headX: -1, headY: -1, smile: 0.5 },
  { headX: 0.37, headY: -0.62, smile: 0.8 },
  { headX: 0.5, headY: 0.5, smile: 0 },
  { headX: 4, headY: -4, smile: 0 }
];

test('editor preview and the exported runtime compile identical frames', async () => {
  const runtime = await loadExportedRuntime();
  const source = state();
  const rig = createExportRig(source);
  for (const values of SAMPLES) {
    const preview = compileFrame(source.elements, values, source.globalConstraints, source.stateConstraints?.idle, { keyforms: source.keyforms });
    const exported = runtime.compileRigFrame(rig.elements, values, rig.globalConstraints, rig.stateConstraints?.idle, { keyforms: rig.keyforms });
    assert.deepEqual(preview.frames, exported, `parameters ${JSON.stringify(values)}`);
  }
});

test('the exported rig carries the poses the preview evaluated', () => {
  const rig = createExportRig(state());
  assert.deepEqual(rig.keyforms.map((item) => item.id), ['face-x', 'nose-x', 'ear-opacity', 'ear-scale']);
});

test('the exported runtime resolves an irregular axis the same way the editor does', async () => {
  const runtime = await loadExportedRuntime();
  const { evaluateKeyform } = await import('../keyforms/keyform-evaluator.js');
  const record = state().keyforms[1];
  for (const headX of [-1, -0.7, -0.4, -0.2, 0, 0.35, 0.7, 0.85, 1, 3]) {
    assert.equal(runtime.evaluateKeyform(record, { headX }), evaluateKeyform(record, { headX }), `headX ${headX}`);
  }
});
