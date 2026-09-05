import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileRigFrame, ADDITIVE_KEYFORM_CHANNELS } from '../../../runtime/runtime.js';
import { KEYFORM_CHANNELS, keyformChannelNeutral } from '../../../runtime/keyforms.js';
import { normalizeParallax, parallaxOffset, depthBand, clampDepth, DEPTH_BANDS } from '../../../runtime/depth.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { createCartoonMascot, CRITICAL_COMBINATION } from './fixtures/cartoon-mascot.js';

/**
 * 3D-02 — effective depth (docs/DEPTH_PARALLAX.md, docs/KEYFORM_ENGINE.md).
 *
 * A head pose can now say `leftEar.depth = +0.25`. The depth an element
 * actually has becomes `authored + pose`, under the clamp the authored value
 * already went through, and every element reports the band that depth falls
 * into — through the same hysteresis the hands have always used.
 *
 * The band is **reported, never acted on**. Reordering is a separate item, so
 * these tests exist as much to prove that nothing an author can see changed as
 * to prove that the new channel works.
 */

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} != ${expected}`);

/** A 1D pose over `headX`, on any channel, addressing cells by index. */
const poseOn = (channel, targetId, cells, id = `pose-${targetId}-${channel}`) => ({
  id, target: { kind: 'element', id: targetId }, channel,
  axes: [{ parameter: 'headX', values: [-1, 0, 1] }], keyforms: cells, extrapolation: 'clamp'
});

const stress = () => normalizeRig(createCartoonMascot());
const options = (source, over = {}) => ({
  keyforms: source.keyforms, shapeKeys: source.shapeKeys, hands: source.hands,
  deformers: source.deformers, parallax: source.parallax, warps: source.warps, ...over
});

/* ── The channel ─────────────────────────────────────────────────────────── */

test('depth is a keyform channel with a neutral of 0 and additive semantics', () => {
  assert.ok(KEYFORM_CHANNELS.includes('depth'));
  // 0, like every other additive channel: a cell records how far a pose pushes
  // an element away from its authored depth, never an absolute depth.
  assert.equal(keyformChannelNeutral('depth'), 0);
  assert.ok(ADDITIVE_KEYFORM_CHANNELS.includes('depth'));
});

test('a keyform captured at its channel neutral compiles the frame of no keyform at all', () => {
  const elements = { face: { baseTransform: transform({ x: 5, y: -3 }), baseOpacity: 0.8, depth: 0.4 } };
  const values = { headX: 0.3 };
  const parallax = { amount: 6 };
  const plain = compileRigFrame(elements, values, {}, {}, { parallax });
  for (const channel of KEYFORM_CHANNELS) {
    // `pathShape` resolves to a shape-key weight rather than to a channel of
    // the pose, and needs a shape key to land on; it has its own tests.
    if (channel === 'pathShape') continue;
    const neutral = keyformChannelNeutral(channel);
    const keyforms = [poseOn(channel, 'face', [{ at: [0], value: neutral }, { at: [1], value: neutral }, { at: [2], value: neutral }])];
    assert.deepEqual(compileRigFrame(elements, values, {}, {}, { parallax, keyforms }), plain,
      `a ${channel} pose at its neutral must contribute nothing`);
  }
});

test('every channel the table names reaches the frame', () => {
  // The other half of the previous test: a channel listed but never accumulated
  // would pass "neutral changes nothing" while doing nothing at all.
  const elements = { face: { baseTransform: transform({ x: 5, y: -3 }), baseOpacity: 0.8, depth: 0.4 } };
  const values = { headX: 1 };
  const parallax = { amount: 6 };
  const plain = compileRigFrame(elements, values, {}, {}, { parallax });
  for (const channel of KEYFORM_CHANNELS) {
    if (channel === 'pathShape') continue;
    const keyforms = [poseOn(channel, 'face', [{ at: [2], value: keyformChannelNeutral(channel) + 0.25 }])];
    assert.notDeepEqual(compileRigFrame(elements, values, {}, {}, { parallax, keyforms }), plain,
      `${channel} is in the channel table but changes nothing`);
  }
});

/* ── Effective depth ─────────────────────────────────────────────────────── */

test('a depth keyform moves an element through depth, and parallax follows it', () => {
  const elements = { ear: { baseTransform: transform(), depth: -0.2 } };
  const keyforms = [poseOn('depth', 'ear', [{ at: [0], value: -0.3 }, { at: [1], value: 0 }, { at: [2], value: 0.25 }])];
  const at = (headX) => compileRigFrame(elements, { headX, headY: 0 }, {}, {}, { parallax: { amount: 10 }, keyforms }).ear;

  // Head centred: the middle cell holds the neutral, so the authored depth stands.
  assert.equal(at(0).depth, -0.2);
  assert.equal(at(0).transform.x, 0);
  // Turned right, the ear comes forward — and the offset it earns comes with it.
  near(at(1).depth, 0.05);
  near(at(1).transform.x, 0.05 * 10, 'headX * effective depth * amount');
  // Turned left it goes further back, and the offset changes sign with it.
  near(at(-1).depth, -0.5);
  near(at(-1).transform.x, 5);
});

test('effective depth is clamped, and the parallax offset uses the clamped value', () => {
  const elements = { nose: { baseTransform: transform(), depth: 0.8 } };
  const keyforms = [poseOn('depth', 'nose', [{ at: [2], value: 0.5 }])];
  const frame = compileRigFrame(elements, { headX: 1 }, {}, {}, { parallax: { amount: 10 }, keyforms });
  assert.equal(frame.nose.depth, 1, 'clampDepth, not 1.3');
  assert.equal(frame.nose.transform.x, 10, 'and the offset is the clamped depth, not the raw sum');
});

test('a depth pose moves depth only — never the artwork', () => {
  const elements = { ear: { baseTransform: transform({ x: 4, y: -2, rotation: 5 }), baseOpacity: 0.5 } };
  const keyforms = [poseOn('depth', 'ear', [{ at: [2], value: 0.9 }])];
  // No parallax settings, so depth has nothing to offset: the frame must be the
  // frame of a rig with no pose at all, plus the band.
  const posed = compileRigFrame(elements, { headX: 1 }, {}, {}, { keyforms }).ear;
  const plain = compileRigFrame(elements, { headX: 1 }, {}, {}).ear;
  assert.deepEqual(posed.transform, plain.transform);
  assert.equal(posed.opacity, plain.opacity);
  assert.equal(posed.depth, 0.9);
});

/* ── Bands ───────────────────────────────────────────────────────────────── */

test('the band follows effective depth through the existing hysteresis', () => {
  // Default bands are [-0.35, 0.35] with a 0.08 margin, and this pose sweeps
  // depth linearly from -0.4 to +0.4 across headX.
  const elements = { ear: { baseTransform: transform(), depth: 0 } };
  const keyforms = [poseOn('depth', 'ear', [{ at: [0], value: -0.4 }, { at: [1], value: 0 }, { at: [2], value: 0.4 }])];
  const band = (headX, previousBands) => compileRigFrame(elements, { headX }, {}, {}, { parallax: {}, keyforms, previousBands }).ear.depthBand;

  assert.equal(band(1), 'front');
  assert.equal(band(0), 'normal');
  assert.equal(band(-1), 'behind');
  // The middle is sticky in both directions: the same 0.3 reads as `front` when
  // it arrives from the front and as `normal` when it arrives from the middle,
  // which is exactly what stops a depth on a boundary from flickering.
  assert.equal(band(0.75, { ear: 'front' }), 'front');
  assert.equal(band(0.75, { ear: 'normal' }), 'normal');
  assert.equal(band(0.5, { ear: 'front' }), 'normal', 'past the margin it finally drops back');
  assert.equal(band(-0.75, { ear: 'behind' }), 'behind');
  assert.equal(band(-0.5, { ear: 'behind' }), 'normal');
  // And it is the same rule, not a second copy of it.
  assert.equal(band(0.75, { ear: 'front' }), depthBand(0.4 * 0.75, normalizeParallax({}), 'front'));
});

test('every element reports a band, and a hand still reports its own', () => {
  const source = stress();
  const frame = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options(source));
  for (const [id, item] of Object.entries(frame)) {
    assert.ok(DEPTH_BANDS.includes(item.depthBand), `${id} reports no band`);
  }
  // Hands resolve after the element loop and own their depth outright, so the
  // band a hand reports is the hand's, not the one its artwork was born with.
  const forward = compileRigFrame(source.elements, { ...CRITICAL_COMBINATION, handRDepth: 1 }, source.globalConstraints, {}, options(source));
  assert.equal(forward.handRight.depth, 1);
  assert.equal(forward.handRight.depthBand, 'front');
});

test('the band is reported, not acted on', async () => {
  const source = stress();
  const keyforms = [...source.keyforms, poseOn('depth', 'hairBack', [{ at: [2], value: 1.6 }])];
  const frame = compileRigFrame(source.elements, { ...CRITICAL_COMBINATION, headX: 1 }, source.globalConstraints, {}, options(source, { keyforms }));
  assert.equal(frame.hairBack.depthBand, 'front', 'the pose really did cross a band');
  assert.deepEqual(Object.keys(frame), Object.keys(source.elements), 'and the frame is still in rig order');
  // Reordering is the next item. Until it lands, no runtime module moves a node.
  for (const name of ['runtime.js', 'depth.js', 'hands.js']) {
    const module = await readFile(new URL(`../../../runtime/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(module, /insertBefore|appendChild/, `${name} reparents an SVG node`);
  }
});

/* ── What must not have changed ──────────────────────────────────────────── */

test('an element with no depth keyform keeps exactly the depth and the parallax it had', () => {
  const source = stress();
  assert.deepEqual(source.keyforms.filter((keyform) => keyform.channel === 'depth'), [], 'the stress fixture authors no depth pose');
  const parallax = normalizeParallax(source.parallax);
  for (const values of [CRITICAL_COMBINATION, { ...CRITICAL_COMBINATION, headX: -0.5, headY: 0.25 }, { ...CRITICAL_COMBINATION, headX: 1, headY: 1 }]) {
    const on = compileRigFrame(source.elements, values, source.globalConstraints, {}, options(source));
    // The same frame with parallax switched off isolates the offset exactly:
    // what is left is the drift the authored depth earns, and nothing else.
    const off = compileRigFrame(source.elements, values, source.globalConstraints, {}, options(source, { parallax: { ...source.parallax, enabled: false } }));
    for (const [id, element] of Object.entries(source.elements)) {
      const authored = clampDepth(element.depth ?? 0);
      const offset = parallaxOffset(authored, values, parallax);
      assert.equal(on[id].depth ?? 0, authored, `${id} depth`);
      near(on[id].transform.x - off[id].transform.x, offset.x, `${id} parallax x`);
      near(on[id].transform.y - off[id].transform.y, offset.y, `${id} parallax y`);
    }
  }
});

test('a runtime that ignores the depth channel compiles the frame it compiles today', () => {
  // This is what "additive" has to mean here: drop the depth records — which is
  // all a reader that does not know the channel can do with them — and the
  // element is back on its authored depth, with today's parallax and no
  // reordering. Losing the pose loses a refinement; it never inverts anything.
  const elements = { ear: { baseTransform: transform(), depth: -0.2 }, nose: { baseTransform: transform(), depth: 0.6 } };
  const values = { headX: 1, headY: -0.5 };
  const parallax = { amount: 6 };
  const authored = [poseOn('translateY', 'nose', [{ at: [2], value: 3 }])];
  const posed = [...authored, poseOn('depth', 'ear', [{ at: [2], value: 0.5 }])];
  assert.deepEqual(compileRigFrame(elements, values, {}, {}, { parallax, keyforms: authored }),
    compileRigFrame(elements, values, {}, {}, { parallax, keyforms: posed.filter((keyform) => keyform.channel !== 'depth') }));
});

test('a depth pose is one more record in the block rig.json already has', () => {
  const project = createCartoonMascot();
  const before = createExportRig(normalizeRig(project));
  const after = createExportRig(normalizeRig({ ...project, keyforms: [...project.keyforms, poseOn('depth', 'earLeft', [{ at: [2], value: 0.4 }], 'headPose:earLeft:depth')] }));
  // No new top-level field, and no existing one disturbed: a depth pose travels
  // in `keyforms`, which every runtime since schema v4 already reads.
  assert.deepEqual(Object.keys(after), Object.keys(before));
  for (const key of Object.keys(before)) {
    if (key !== 'keyforms') assert.deepEqual(after[key], before[key], `a depth pose moved ${key}`);
  }
  assert.deepEqual(after.keyforms.slice(0, before.keyforms.length), before.keyforms);
  assert.equal(after.keyforms.length, before.keyforms.length + 1);
  assert.equal(after.keyforms.at(-1).channel, 'depth');
  // And a project that authors none is untouched: nothing gains a depth record.
  assert.equal(before.keyforms.some((keyform) => keyform.channel === 'depth'), false);
});

test('normalizing a rig that carries a depth pose is idempotent', () => {
  const project = { ...createCartoonMascot() };
  project.keyforms = [...project.keyforms, poseOn('depth', 'earLeft', [{ at: [0], value: -0.3 }, { at: [2], value: 0.25 }], 'headPose:earLeft:depth')];
  const once = normalizeRig(project);
  assert.equal(once.keyforms.filter((keyform) => keyform.channel === 'depth').length, 1, 'the channel survives the migration boundary');
  assert.deepEqual(normalizeRig(once), once, 'and a second pass changes nothing');
});
