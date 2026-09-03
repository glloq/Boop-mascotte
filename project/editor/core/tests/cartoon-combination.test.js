import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileRigFrame, createMascotEngine, createWeightBlender } from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { RUNTIME_MODULES, bundleRuntimeSource } from '../export/runtime-bundle.js';
import { validateProject } from '../validation/validate-project.js';
import { createCartoonMascot, CRITICAL_COMBINATION, MOUTH_REST } from './fixtures/cartoon-mascot.js';
import { parsePath } from '../../../runtime/path-vector.js';

const rig = () => normalizeRig(createCartoonMascot());
const options = (source) => ({ keyforms: source.keyforms, shapeKeys: source.shapeKeys, hands: source.hands, deformers: source.deformers, parallax: source.parallax });
const frameAt = (source, values) => compileRigFrame(source.elements, values, source.globalConstraints, {}, options(source));

/* §69 — the critical combination */

test('the cartoon fixture is a complete, valid V2 rig', () => {
  const source = rig();
  assert.equal(source.schemaVersion, 4);
  assert.ok(source.keyforms.length > 10, 'a multi-part head pose');
  assert.equal(source.shapeKeys.length, 3);
  assert.equal(source.deformers.length, 2);
  assert.ok(source.hands.left && source.hands.right);
  const blocking = validateProject(source).filter((issue) => issue.severity === 'error');
  assert.deepEqual(blocking.map((issue) => issue.message), []);
});

test('head pose, expression, shape keys, hands, motion and depth all survive together', () => {
  const source = rig();
  const frame = frameAt(source, CRITICAL_COMBINATION);

  // Head pose moved the face and turned the ears' presence.
  assert.ok(frame.face.transform.x > 0, 'face follows the head turn');
  assert.ok(frame.nose.transform.x > frame.face.transform.x, 'the nose leads the face');
  assert.ok(frame.earLeft.opacity < 1, 'the far ear recedes');
  assert.equal(frame.earRight.opacity, 1, 'the near ear stays');

  // Shape keys: smile and mouthOpen and the pose correction, at once.
  const rest = parsePath(MOUTH_REST).values;
  const mouth = parsePath(frame.mouth.path).values;
  assert.ok(mouth[1] < rest[1], 'the mouth corners lifted (smile)');
  assert.ok(mouth[5] > rest[5], 'and the mouth opened');

  // Eyes are still driven by their own binding.
  assert.ok(Math.abs(frame.eyeLeft.transform.scaleY - 0.8) < 0.2, 'eyeOpen still applies');

  // The right hand moved, turned and took its wave shape.
  assert.ok(frame.handRight.transform.x > 40, 'the hand reached out');
  assert.ok(frame.handRight.transform.rotation !== 0, 'and turned');
  assert.notEqual(frame.handRight.path, frame.handLeft.path, 'only the waving hand changed shape');

  // The idle hand stayed at rest.
  assert.equal(frame.handLeft.transform.rotation, 0);
});

test('no component silently cancels another', () => {
  const source = rig();
  const full = frameAt(source, CRITICAL_COMBINATION);

  // Removing one input must change only what that input owns.
  const withoutSmile = frameAt(source, { ...CRITICAL_COMBINATION, smile: 0 });
  assert.notEqual(withoutSmile.mouth.path, full.mouth.path, 'smile matters');
  assert.equal(withoutSmile.face.transform.x, full.face.transform.x, 'and only the mouth');

  const withoutHead = frameAt(source, { ...CRITICAL_COMBINATION, headX: 0, headY: 0 });
  assert.notEqual(withoutHead.face.transform.x, full.face.transform.x, 'the head pose matters');
  assert.equal(withoutHead.handRight.transform.rotation, full.handRight.transform.rotation, 'and does not touch the hand');

  const withoutHand = frameAt(source, { ...CRITICAL_COMBINATION, handRX: 0, handRY: 0, handRRotation: 0, handRWave: 0 });
  assert.notEqual(withoutHand.handRight.transform.x, full.handRight.transform.x, 'the hand matters');
  assert.equal(withoutHand.mouth.path, full.mouth.path, 'and does not touch the mouth');
});

test('the body carries the head and both hand anchors at once', () => {
  const source = rig();
  const still = frameAt(source, { ...CRITICAL_COMBINATION, bodyBounce: 0 });
  const bounced = frameAt(source, { ...CRITICAL_COMBINATION, bodyBounce: 1 });
  const lift = bounced.body.transform.y - still.body.transform.y;
  assert.ok(lift !== 0, 'the body moved');
  assert.equal(bounced.handLeft.transform.y - still.handLeft.transform.y, lift, 'the left anchor followed');
  assert.equal(bounced.handRight.transform.y - still.handRight.transform.y, lift, 'the right anchor followed');
  // The hand's own reach offset survived the drift.
  assert.equal(bounced.handRight.transform.x, still.handRight.transform.x);
});

test('parallax slides depths apart without touching the flat parts', () => {
  const source = rig();
  const centre = frameAt(source, { ...CRITICAL_COMBINATION, headX: 0, headY: 0 });
  const turned = frameAt(source, { ...CRITICAL_COMBINATION, headX: 1, headY: 0 });
  const shift = (id) => turned[id].transform.x - centre[id].transform.x;
  assert.ok(shift('nose') > shift('face'), 'the nose leads');
  assert.ok(shift('hairBack') < shift('face'), 'the back hair lags');
});

test('the whole combination survives export and the standalone runtime', async () => {
  const source = rig();
  const exported = createExportRig(source);
  const modules = await Promise.all(RUNTIME_MODULES.map(async (name) => ({
    name, source: await readFile(new URL(`../../../runtime/${name}`, import.meta.url), 'utf8')
  })));
  const runtime = await import(`data:text/javascript;base64,${Buffer.from(bundleRuntimeSource(modules)).toString('base64')}`);
  const mine = frameAt(source, CRITICAL_COMBINATION);
  const theirs = runtime.compileRigFrame(exported.elements, CRITICAL_COMBINATION, exported.globalConstraints, {}, options(exported));
  assert.deepEqual(theirs, mine, 'editor and exported runtime agree on the full combination');
});

/* §70 — the critical transition */

test('Happy → Angry → Surprised → Happy never shows a neutral frame', () => {
  const blender = createWeightBlender({ duration: 200, easing: 'easeInOut' });
  blender.set('happy', 1, { duration: 0 });
  const weakest = { total: Infinity, at: null };
  for (const next of ['angry', 'surprised', 'happy']) {
    blender.transitionTo(next);
    for (let step = 0; step < 20; step += 1) {
      blender.advance(10);
      const total = Object.values(blender.values()).reduce((sum, value) => sum + value, 0);
      if (total < weakest.total) { weakest.total = total; weakest.at = next; }
    }
  }
  assert.ok(weakest.total > 0.7, `something is always showing (weakest ${weakest.total} on the way to ${weakest.at})`);
  assert.deepEqual(blender.values(), { happy: 1 });
});

test('an expression change does not disturb the head, the hands or a blink', () => {
  const source = rig();
  const engine = createMascotEngine({
    svgRoot: { id: '', querySelector: () => null }, rig: source,
    requestFrame: () => 1, cancelFrame: () => {}, now: () => 0, random: () => 0.5
  });
  for (const [name, value] of Object.entries(CRITICAL_COMBINATION)) engine.setParam(name, value);
  const before = engine.getParams();
  engine.transitionToExpression('angry');
  const after = engine.getParams();
  for (const name of ['headX', 'headY', 'handRX', 'handRY', 'handRRotation', 'handRWave']) {
    assert.equal(after[name], before[name], `${name} is untouched by an expression change`);
  }
});

test('an expression change moves continuously, with no jump at either end', () => {
  const source = rig();
  let clock = 0;
  let frameCallback = null;
  const applied = [];
  const node = { id: 'mouth', tagName: 'path', style: {}, setAttribute: (name, value) => { if (name === 'd') applied.push(value); } };
  const engine = createMascotEngine({
    svgRoot: { id: '', querySelector: (selector) => selector === '#mouth' ? node : null }, rig: source, fps: 60,
    requestFrame: (callback) => { frameCallback = callback; return 1; }, cancelFrame: () => {},
    now: () => clock, random: () => 0.5
  });
  engine.start();
  const tick = (ms) => { clock += ms; frameCallback?.(clock); };
  tick(16);
  engine.setExpression('happy', 1);
  const samples = [];
  for (let step = 0; step < 20; step += 1) { tick(16); samples.push(engine.getExpressionWeights().happy || 0); }
  // Monotonic and gradual: no frame jumps most of the way on its own.
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index] >= samples[index - 1] - 1e-9, 'weights only rise');
    assert.ok(samples[index] - samples[index - 1] < 0.5, `no jump at step ${index}`);
  }
  assert.ok(samples.at(-1) > 0.9, 'and it arrives');
});

test('a state change starts from the pose on screen, not from neutral', () => {
  const source = rig();
  let clock = 0;
  const engine = createMascotEngine({
    svgRoot: { id: '', querySelector: () => null }, rig: source,
    requestFrame: () => 1, cancelFrame: () => {}, now: () => clock, random: () => 0.5
  });
  engine.setState('happy');
  clock = 125;
  const midway = engine.getParams().smile;
  assert.ok(midway > 0 && midway < 0.8, `halfway between the two states (${midway})`);
  // Turning back mid-transition continues from where it is.
  engine.setState('idle');
  assert.ok(Math.abs(engine.getParams().smile - midway) < 1e-6, 'no snap when reversing');
});
