import test from 'node:test';
import assert from 'node:assert/strict';
import { REST_POSE, TRANSFORM_CHANNELS, applyPose, isRestPose, normalizeTransform, poseBetween, removePose, transformFromChannels } from '../artwork/pose-transform.js';
import { compileFrame } from '../preview-runtime/frame-compiler.js';

/**
 * Where a piece is drawn, against where it is authored.
 *
 * A mascot stays posable while it is designed, so the two differ as soon as
 * anybody turns the head — and the selection gizmo read the authored one and
 * drew its box there. The arithmetic here is the whole fix, and the test that
 * matters most is the last one: that it is the same arithmetic the renderer
 * does, checked against the renderer rather than against a copy of its rules.
 */

test('a pose is the difference between drawn and authored, per channel', () => {
  const authored = { x: 10, y: 20, rotation: 5, scaleX: 2, scaleY: 0.5, pivotX: 120, pivotY: 116 };
  const drawn = { x: 17, y: 20, rotation: 14, scaleX: 3, scaleY: 0.5, pivotX: 120, pivotY: 116 };
  assert.deepEqual(poseBetween(drawn, authored), { x: 7, y: 0, rotation: 9, scaleX: 1.5, scaleY: 1 });
  // A pose has no pivot: nothing in the runtime moves one, so the authored
  // pivot is the drawn pivot and there is no difference to carry.
  assert.equal('pivotX' in poseBetween(drawn, authored), false);
});

test('the two directions are inverses, which is what lets a drag be committed', () => {
  const authored = { x: -4, y: 9, rotation: -30, scaleX: 1.25, scaleY: 0.8, pivotX: 83, pivotY: 113 };
  const pose = { x: 7, y: -2.5, rotation: 12, scaleX: 1.4, scaleY: 0.9 };
  const drawn = applyPose(authored, pose);
  const expected = { x: 3, y: 6.5, rotation: -18, scaleX: 1.75, scaleY: 0.72, pivotX: 83, pivotY: 113 };
  for (const channel of TRANSFORM_CHANNELS) assert.ok(Math.abs(drawn[channel] - expected[channel]) < 1e-12, `${channel} is ${expected[channel]}`);
  const back = removePose(drawn, pose);
  for (const channel of TRANSFORM_CHANNELS) {
    assert.ok(Math.abs(back[channel] - normalizeTransform(authored)[channel]) < 1e-12, `${channel} came back`);
  }
});

test('at rest nothing happens at all, so an unposed drag commits the number it always did', () => {
  const authored = { x: 3, y: 4, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
  assert.ok(isRestPose(REST_POSE));
  assert.ok(isRestPose(null), 'a piece no frame has reached has no pose');
  assert.ok(isRestPose({ x: 1e-9, scaleX: 1 + 1e-9 }), 'and one the eye cannot see is none');
  assert.deepEqual(applyPose(authored, REST_POSE), normalizeTransform(authored));
  assert.deepEqual(removePose(authored, REST_POSE), normalizeTransform(authored));
  assert.equal(isRestPose({ x: 0.5 }), false);
  assert.equal(isRestPose({ scaleX: 1.2 }), false);
});

test('a scale of nothing is left alone rather than made infinite', () => {
  // `scale 0` is a legitimate authored value -- a part the rig has closed --
  // and dividing by it would put Infinity in the artwork.
  assert.deepEqual(poseBetween({ scaleX: 0, scaleY: 3 }, { scaleX: 0, scaleY: 1 }), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 3 });
  const kept = removePose({ x: 5, scaleX: 2, scaleY: 2 }, { x: 1, scaleX: 0, scaleY: 0 });
  assert.equal(kept.scaleX, 2);
  assert.equal(kept.scaleY, 2);
  assert.equal(kept.x, 4, 'and the channels that can be undone still are');
});

test('the renderer’s own numbers, not a matrix parsed back out of an attribute', () => {
  // `lastRequested` holds exactly this array, in exactly this order, because
  // that is what the canvas passed to `setAttribute`.
  assert.deepEqual(transformFromChannels([1, 2, 3, 4, 5, 6, 7]),
    { x: 1, y: 2, rotation: 3, scaleX: 4, scaleY: 5, pivotX: 6, pivotY: 7 });
  assert.equal(transformFromChannels(null), null, 'a piece with no frame yet says so');
  assert.equal(transformFromChannels(undefined), null);
  // Only a broken number falls back, and a scale falls back to 1.
  assert.deepEqual(transformFromChannels([null, 'x', undefined, NaN, 5, 6, 7]),
    { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 5, pivotX: 6, pivotY: 7 });
});

test('and it is the same composition the runtime does', () => {
  // The claim this module rests on: `compileFrame` composes per channel --
  // add for x, y and rotation, multiply for scale, pivot straight through --
  // so a pose is recoverable exactly. Checked against the compiler itself,
  // because a copy of its rules is a copy that can drift.
  const elements = {
    part: {
      baseTransform: { x: 10, y: -5, rotation: 8, scaleX: 1.5, scaleY: 0.5, pivotX: 120, pivotY: 116 },
      bindings: {
        translateX: { enabled: true, mode: 'simple', expression: 'headX', amplitude: -7, offset: 0 },
        rotation: { enabled: true, mode: 'simple', expression: 'headX', amplitude: 20, offset: 0 },
        scaleX: { enabled: true, mode: 'simple', expression: 'headX', amplitude: 0.5, offset: 1 }
      }
    }
  };
  const frame = compileFrame(elements, { headX: 0.9 });
  const drawn = frame.transforms.part;
  const authored = elements.part.baseTransform;

  // What the module says the session is adding, read back out of the frame.
  const pose = poseBetween(drawn, authored);
  assert.ok(Math.abs(pose.x - -6.3) < 1e-9, 'translateX is added');
  assert.ok(Math.abs(pose.rotation - 18) < 1e-9, 'rotation is added');
  assert.ok(Math.abs(pose.scaleX - 1.45) < 1e-9, 'and scaleX multiplies');
  assert.equal(pose.y, 0, 'an unbound channel contributes nothing');

  // Predicting the frame, and authoring back out of it.
  assert.deepEqual(applyPose(authored, pose), normalizeTransform(drawn));
  const back = removePose(drawn, pose);
  for (const channel of TRANSFORM_CHANNELS) {
    assert.ok(Math.abs(back[channel] - normalizeTransform(authored)[channel]) < 1e-9, `${channel} authors back to rest`);
  }
  // The pivot is the authored pivot, untouched: this is why a pose has none.
  assert.equal(drawn.pivotX, 120);
  assert.equal(drawn.pivotY, 116);
});
