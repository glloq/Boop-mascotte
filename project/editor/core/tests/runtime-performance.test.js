import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileRigFrame } from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createCartoonMascot, CRITICAL_COMBINATION } from './fixtures/cartoon-mascot.js';

/**
 * These are *contract* tests, not benchmarks: they assert the properties the
 * roadmap forbids breaking (docs/RUNTIME_PERFORMANCE.md), which hold on any
 * machine, rather than a wall-clock number that would vary with the runner.
 */

const rig = () => normalizeRig(createCartoonMascot());
const options = (source) => ({ keyforms: source.keyforms, shapeKeys: source.shapeKeys, hands: source.hands, deformers: source.deformers, parallax: source.parallax, warps: source.warps });

test('a path is never parsed inside the render loop', async () => {
  const source = await readFile(new URL('../../../runtime/path-vector.js', import.meta.url), 'utf8');
  // The one place a `d` string is read is the compile step, which is cached.
  assert.match(source, /const parseCache = new Map\(\)/);
  assert.match(source, /PARSE_CACHE_LIMIT/);

  const shapeKeys = await readFile(new URL('../../../runtime/shape-keys.js', import.meta.url), 'utf8');
  const inFrame = shapeKeys.slice(shapeKeys.indexOf('export function evaluateShapeTarget'));
  assert.doesNotMatch(inFrame, /parsePath/, 'evaluateShapeTarget never parses');

  const warps = await readFile(new URL('../../../runtime/warp-grid.js', import.meta.url), 'utf8');
  const warpFrame = warps.slice(warps.indexOf('export function warpDisplacement'));
  assert.doesNotMatch(warpFrame, /parsePath/, 'warpDisplacement never parses');
});

test('the runtime never clones the project or queries the document per frame', async () => {
  const source = await readFile(new URL('../../../runtime/runtime.js', import.meta.url), 'utf8');
  const loop = source.slice(source.indexOf('function tick('), source.indexOf('return { setParam'));
  assert.doesNotMatch(loop, /structuredClone/, 'no per-frame clone');
  assert.doesNotMatch(loop, /querySelector/, 'nodes are resolved once, at construction');
  assert.doesNotMatch(loop, /JSON\.(parse|stringify)/, 'no per-frame serialization');
});

test('keyforms, shape keys, warps and deformers compile once per rig', () => {
  const source = rig();
  const first = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options(source));
  const second = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options(source));
  assert.deepEqual(second, first, 'the same inputs give the same frame');
  // The compiled indexes are keyed on the arrays the rig keeps, so a second
  // call reuses them rather than recompiling.
  assert.equal(source.keyforms, source.keyforms);
});

test('an unchanged shape rebuilds no string', () => {
  const source = rig();
  const stable = { ...CRITICAL_COMBINATION, smile: 0.5, mouthOpen: 0.2 };
  const a = compileRigFrame(source.elements, stable, source.globalConstraints, {}, options(source));
  const path = a.mouth.path;
  const b = compileRigFrame(source.elements, stable, source.globalConstraints, {}, options(source));
  assert.equal(b.mouth.path, path);
  // Identity, not just equality: the previous string is reused untouched.
  assert.ok(Object.is(b.mouth.path, path), 'the same string instance comes back');
});

test('a changed weight does rebuild the string', () => {
  const source = rig();
  const a = compileRigFrame(source.elements, { ...CRITICAL_COMBINATION, smile: 0.2 }, source.globalConstraints, {}, options(source));
  const b = compileRigFrame(source.elements, { ...CRITICAL_COMBINATION, smile: 0.9 }, source.globalConstraints, {}, options(source));
  assert.notEqual(b.mouth.path, a.mouth.path);
});

test('a stress mascot compiles a frame in well under a frame budget', () => {
  const source = rig();
  // Warm up: the first call compiles the indexes.
  compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options(source));
  const samples = 400;
  const started = performance.now();
  for (let index = 0; index < samples; index += 1) {
    const headX = Math.sin(index / 20);
    compileRigFrame(source.elements, { ...CRITICAL_COMBINATION, headX, smile: (index % 7) / 7 }, source.globalConstraints, {}, options(source));
  }
  const perFrame = (performance.now() - started) / samples;
  // 16.6 ms is one frame at 60 fps and the mascot is one of many things on a
  // page: a generous ceiling that still catches an order-of-magnitude
  // regression on any machine that can run the suite at all.
  assert.ok(perFrame < 4, `${perFrame.toFixed(3)} ms per frame`);
});

test('the frame is a flat description, with no live references into the rig', () => {
  const source = rig();
  const frame = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options(source));
  for (const [id, item] of Object.entries(frame)) {
    assert.notEqual(item.transform, source.elements[id].baseTransform, `${id} transform is its own object`);
    assert.equal(typeof item.opacity, 'number');
    if (item.path) assert.equal(typeof item.path, 'string');
    if (item.matrix) assert.equal(item.matrix.length, 6);
  }
});

test('a rig using none of the V2 blocks compiles exactly as a v3 rig did', () => {
  const elements = {
    face: { baseTransform: { x: 3, y: 4, rotation: 5, scaleX: 1.1, scaleY: 0.9, pivotX: 1, pivotY: 2 }, baseOpacity: 0.8, bindings: { translateX: { expression: 'headX', amplitude: 9 } } }
  };
  const values = { headX: 0.4 };
  const plain = compileRigFrame(elements, values, {}, {});
  const withEmptyBlocks = compileRigFrame(elements, values, {}, {}, { keyforms: [], shapeKeys: [], warps: [], deformers: [], hands: null });
  assert.deepEqual(withEmptyBlocks, plain);
});
