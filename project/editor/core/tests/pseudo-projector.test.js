import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAD_SWEEP, MAX_SWEEP, FORESHORTEN, SCALE_LIMITS,
  boxCentre, headAngles, depthScaleForTravel, projectPoint, projectFeature, relativeSample
} from '../projection/pseudo-projector.js';

/**
 * The shipped template's face: a 200-wide head centred at (120, 120), which is
 * what `headTurnUnit` measures 28 units of travel from. Every number below is
 * the one the generator would hand the projector for that artwork.
 */
const ORIGIN = Object.freeze({ x: 120, y: 120 });
const UNIT = 28;
const DEPTH_SCALE = depthScaleForTravel(UNIT); // 56: one unit of depth, in artwork units
const FACE = Object.freeze({
  nose: { centre: { x: 117, y: 133 }, depth: 1 },
  mouth: { centre: { x: 120, y: 163 }, depth: 0.85 },
  eyeLeft: { centre: { x: 82, y: 98 }, depth: 0.55 },
  eyeRight: { centre: { x: 158, y: 98 }, depth: 0.55 },
  earLeft: { centre: { x: 24, y: 124 }, depth: 0.15 },
  earRight: { centre: { x: 216, y: 124 }, depth: 0.15 },
  head: { centre: { x: 120, y: 120 }, depth: 0.18 }
});
/** One cell of the turn, for one part. */
const turn = (part, headX, headY = 0, options = {}) => projectFeature({
  centre: part.centre, origin: ORIGIN, depth: part.depth, headX, headY, unit: UNIT, ...options
});
const close = (actual, expected, tolerance = 1e-9) => Math.abs(actual - expected) <= tolerance;
const finiteSample = (sample) => Object.entries(sample).every(([, value]) => typeof value !== 'number' || Number.isFinite(value));

test('the sweep is a cartoon three-quarter turn, and strength turns further rather than harder', () => {
  assert.equal(HEAD_SWEEP.yaw, 30, 'past ~35 degrees a flat drawing folds; a profile is a second drawing');
  assert.equal(HEAD_SWEEP.pitch / HEAD_SWEEP.yaw, 0.6, "the generator's VERTICAL_DEPTH, kept so the vertical is not silently retuned");

  const full = headAngles({ x: 1, y: -1 });
  assert.ok(close(full.yaw, (30 * Math.PI) / 180), 'headX = 1 is a full sweep');
  assert.ok(close(full.pitch, (-18 * Math.PI) / 180), 'headY = -1 looks up, and by 60% as much');
  // Strength scales the angle, so a stronger turn is still one rotation.
  assert.ok(close(headAngles({ x: 1, strength: 1.5 }).yaw, (45 * Math.PI) / 180));
  assert.ok(close(headAngles({ x: 1, strength: 3 }).yaw, (MAX_SWEEP * Math.PI) / 180), 'and stops where the drawing would fold');
  assert.ok(close(headAngles({ x: 4 }).yaw, (MAX_SWEEP * Math.PI) / 180), 'a wider axis is clamped the same way');
  assert.deepEqual(headAngles({ x: 0, y: 0 }), { yaw: 0, pitch: 0 });
});

test('the neutral pose is exactly the artwork, whatever the depth', () => {
  for (const depth of [-1, -0.15, 0, 0.15, 0.55, 1, 4]) {
    const at = projectPoint({ x: 117, y: 133, depth, originX: ORIGIN.x, originY: ORIGIN.y, yaw: 0, pitch: 0, depthScale: DEPTH_SCALE });
    assert.equal(at.x, 117, 'no yaw moves nothing sideways');
    assert.equal(at.y, 133);
    assert.equal(at.scale, 1, 'and nothing has come nearer, so nothing resizes');
    assert.equal(at.virtualZ, depth * DEPTH_SCALE, 'the point is where its depth put it');
  }
  for (const part of Object.values(FACE)) {
    const sample = turn(part, 0, 0);
    assert.deepEqual(
      [sample.translateX, sample.translateY, sample.scaleX, sample.scaleY],
      [0, 0, 1, 1],
      'the centre cell of a generated grid must be the rest pose itself'
    );
  }
});

test('depth is the parallax: on the axis of rotation the projection is the old formula', () => {
  // A part on the head's centre line has no sideways offset to foreshorten, so
  // its whole travel is its depth swinging round: `unit x depth`, exactly what
  // `translateX = x * unit * depth * push` used to write.
  for (const depth of [0, 0.15, 0.18, 0.55, 0.85, 1]) {
    const sample = turn({ centre: { x: ORIGIN.x, y: 150 }, depth }, 1);
    assert.ok(close(sample.translateX, UNIT * depth, 1e-9), `depth ${depth} travels unit x depth`);
  }
  // A feature on the axis at depth 0 is the axis: it cannot move at all.
  const still = turn({ centre: ORIGIN, depth: 0 }, 1, 1);
  assert.deepEqual([still.translateX, still.translateY, still.scale], [0, 0, 1]);
  // And the ratio between a part that sticks out and one that sits on the axis
  // is the parallax the old formula approximated: the nose against an ear.
  const onAxis = turn({ centre: { x: ORIGIN.x, y: 124 }, depth: FACE.earLeft.depth }, 1);
  const sticksOut = turn({ centre: { x: ORIGIN.x, y: 133 }, depth: FACE.nose.depth }, 1);
  assert.ok(close(sticksOut.translateX / onAxis.translateX, 1 / 0.15, 1e-9), 'the nose swings 6.7x an ear');
  assert.ok(sticksOut.translateX > 6 * onAxis.translateX);
});

test('the near half swings further than the far half, and the pair still carries the old travel', () => {
  const near = turn(FACE.eyeLeft, 1);   // headX > 0 turns right, bringing the left side forward
  const far = turn(FACE.eyeRight, 1);
  assert.ok(near.translateX > far.translateX + 5, 'the same two eyes used to travel the same distance');
  assert.ok(close(near.translateX, 20.4910, 1e-4));
  assert.ok(close(far.translateX, 10.3090, 1e-4));
  // Redistributed, not invented: a symmetric pair still averages `unit x depth`,
  // because the two sideways foreshortenings are equal and opposite.
  assert.ok(close((near.translateX + far.translateX) / 2, UNIT * FACE.eyeLeft.depth, 1e-9));
  // The near half comes towards the viewer and the far half goes away, which is
  // the near/far cue falling out of the rotation instead of being a constant.
  assert.ok(near.virtualZ > far.virtualZ);
  assert.ok(near.scale > 1 && far.scale < 1);
});

test('a feature past the axis crosses behind the head on its own', () => {
  const far = turn(FACE.earRight, 1);
  // The generator tucks the far ear back with a constant (FAR_EAR_TUCK) because
  // a slide can only ever move it outwards. A rotation carries it inwards and
  // behind the head plane, which is what the tuck was imitating.
  assert.ok(far.translateX < 0, 'it moves against the turn');
  assert.ok(far.virtualZ < 0, 'and ends up behind the axis');
  assert.ok(close(far.translateX, -8.6616, 1e-4));
  assert.ok(close(far.virtualZ, -40.7254, 1e-4));
  const near = turn(FACE.earLeft, 1);
  assert.ok(near.translateX > 0 && near.virtualZ > 0, 'while its pair comes round to the front');
});

test('left and right are mirror images', () => {
  const mirrored = (part) => ({ centre: { x: 2 * ORIGIN.x - part.centre.x, y: part.centre.y }, depth: part.depth });
  for (const part of Object.values(FACE)) {
    for (const headY of [0, 0.5, -1]) {
      const right = turn(part, 1, headY);
      const left = turn(mirrored(part), -1, headY);
      assert.ok(close(left.translateX, -right.translateX, 1e-9), 'the mirrored part travels the mirrored distance');
      assert.ok(close(left.translateY, right.translateY, 1e-9), 'and the same distance vertically');
      assert.ok(close(left.virtualZ, right.virtualZ, 1e-9), 'at the same depth, so draw order mirrors too');
      assert.ok(close(left.scale, right.scale, 1e-9));
    }
  }
  // On the axis of rotation there is nothing to mirror: the same part reverses.
  const centre = { centre: { x: ORIGIN.x, y: 163 }, depth: 0.85 };
  assert.ok(close(turn(centre, -1).translateX, -turn(centre, 1).translateX, 1e-9));
});

test('a diagonal is one rotation, not two slides added together', () => {
  for (const part of [FACE.earRight, FACE.nose, FACE.eyeLeft]) {
    const yawOnly = turn(part, 1, 0);
    const pitchOnly = turn(part, 0, 1);
    const both = turn(part, 1, 1);
    const slides = { x: yawOnly.translateX + pitchOnly.translateX, y: yawOnly.translateY + pitchOnly.translateY };
    // The gap is exactly the depth the yaw spent, lifted by the pitch: a part
    // already swung sideways has that much less depth left to raise or drop.
    const spent = yawOnly.virtualZ - part.depth * DEPTH_SCALE;
    const expected = spent * Math.sin((HEAD_SWEEP.pitch * Math.PI) / 180);
    assert.ok(close(both.translateY - slides.y, expected, 1e-9));
    assert.ok(!close(both.scale, yawOnly.scale * pitchOnly.scale, 1e-6), 'and the foreshortening does not multiply out either');
  }
  // On this face that gap is a sixth of the head's width, which is not a rounding
  // difference between two ways of writing the same thing.
  const ear = { yaw: turn(FACE.earRight, 1, 0), pitch: turn(FACE.earRight, 0, 1), both: turn(FACE.earRight, 1, 1) };
  assert.ok(close(ear.both.translateY - (ear.yaw.translateY + ear.pitch.translateY), -15.1806, 1e-4));
  assert.ok(close(ear.both.translateY, -12.7806, 1e-4), 'the far ear drops as it tucks, where two slides would have raised it');
});

test('virtualZ is signed and comparable, so a later item can sort on it', () => {
  const at = (depth) => projectPoint({ x: ORIGIN.x, y: ORIGIN.y, depth, originX: ORIGIN.x, originY: ORIGIN.y, yaw: 0, pitch: 0, depthScale: DEPTH_SCALE }).virtualZ;
  assert.ok(at(-0.4) < 0, 'something drawn behind the head is behind the axis');
  assert.ok(at(0) === 0 && at(0.3) > 0, 'and something in front is in front of it');
  assert.ok(at(-0.4) < at(-0.1) && at(-0.1) < at(0.3) && at(0.3) < at(1), 'ordered by depth at rest');

  // Turned, the order is the one the turn produced, across every element.
  const order = Object.entries(FACE)
    .map(([id, part]) => ({ id, z: turn(part, 1).virtualZ }))
    .sort((a, b) => a.z - b.z)
    .map((item) => item.id);
  assert.equal(order[0], 'earRight', 'the far ear is the furthest back');
  assert.equal(order[order.length - 1], 'earLeft', 'the near ear has come round the front');
  assert.ok(order.indexOf('head') < order.indexOf('nose'), 'and the nose still stands out from the outline');
  // Turning the other way reverses the pair, and only the pair.
  const flipped = Object.fromEntries(Object.entries(FACE).map(([id, part]) => [id, turn(part, -1).virtualZ]));
  assert.ok(flipped.earLeft < 0 && flipped.earRight > 0);
});

test('foreshortening is gentler coming than going, and can never blow up', () => {
  // Two points the same distance either side of the axis: a turn brings one
  // exactly as far forward as it pushes the other back, so what is left between
  // them is the curve itself.
  const { yaw } = headAngles({ x: 1 });
  const at = (offset) => projectPoint({ x: ORIGIN.x + offset, y: ORIGIN.y, depth: 0, originX: ORIGIN.x, originY: ORIGIN.y, yaw, depthScale: DEPTH_SCALE });
  const coming = at(-50);
  const going = at(50);
  assert.ok(close(coming.virtualZ, -going.virtualZ, 1e-9), 'the same depth change, in opposite directions');
  // Not a perspective divide: no camera distance and no pole, and the far side
  // loses three times what the near side gains -- the 1:3 the generator's own
  // NEAR_WIDEN / FAR_NARROW pair carries, and the opposite of what a lens does.
  assert.ok(close((1 - going.scale) / (coming.scale - 1), FORESHORTEN.far / FORESHORTEN.near, 1e-9));
  // Linear in that depth change, which is the divide's first-order term.
  assert.ok(close(coming.scale, 1 + (FORESHORTEN.near * coming.virtualZ) / DEPTH_SCALE, 1e-12));
  assert.ok(close(going.scale, 1 + (FORESHORTEN.far * going.virtualZ) / DEPTH_SCALE, 1e-12));

  const near = turn(FACE.eyeLeft, 1);
  const far = turn(FACE.eyeRight, 1);
  assert.ok(near.scale > 1.02 && near.scale < 1.06, 'on this face the near eye gains a few percent');
  assert.ok(far.scale > 0.83 && far.scale < 0.88, 'and the far one loses a seventh');
  // Bounded whatever it is handed, including an absurd depth at a full sweep.
  for (const depth of [-40, -1, 0, 1, 40]) {
    const sample = projectFeature({ centre: FACE.earRight.centre, origin: ORIGIN, depth, headX: 1, headY: 1, strength: 3, unit: UNIT });
    assert.ok(sample.scale >= SCALE_LIMITS.min && sample.scale <= SCALE_LIMITS.max, `depth ${depth} stays inside the scale limits`);
    assert.ok(finiteSample(sample));
  }
});

test('a measured box, a bare centre and no measurement at all', () => {
  assert.deepEqual(boxCentre({ x: 20, y: 40, width: 60, height: 20 }), { x: 50, y: 50 });
  assert.deepEqual(boxCentre({ left: 20, top: 40, width: 60, height: 20 }), { x: 50, y: 50 });
  assert.equal(boxCentre(null), null);
  const box = projectFeature({ box: { x: 100, y: 120, width: 34, height: 26 }, originBox: { x: 20, y: 20, width: 200, height: 200 }, depth: 1, headX: 1, unit: UNIT });
  const centre = turn({ centre: { x: 117, y: 133 }, depth: 1 }, 1);
  assert.ok(close(box.translateX, centre.translateX, 1e-9), 'a box is its middle');
  assert.ok(close(box.translateY, centre.translateY, 1e-9));
  // Unmeasured artwork keeps working: with nothing to place the feature it sits
  // on the axis, where the projection is the plain `unit x depth` it always was.
  const blind = projectFeature({ depth: 0.85, headX: 1, unit: UNIT });
  assert.ok(close(blind.translateX, UNIT * 0.85, 1e-9));
  assert.equal(blind.translateY, 0);
});

test('nesting is subtracted, not stacked', () => {
  const socket = turn(FACE.eyeLeft, 1);
  // A pupil drawn inside its eye group: projected at its own absolute depth,
  // then handed only the difference, or it crosses the face while the socket
  // it sits in stays put.
  const pupil = turn({ centre: FACE.eyeLeft.centre, depth: FACE.eyeLeft.depth + 0.07 }, 1);
  const own = relativeSample(pupil, socket);
  assert.ok(own.translateX > 0 && own.translateX < 3, 'a pupil barely moves inside its own socket');
  assert.ok(close(own.translateX, pupil.translateX - socket.translateX, 1e-12));
  assert.ok(close(own.scaleX, pupil.scaleX / socket.scaleX, 1e-12));
  assert.equal(own.virtualZ, pupil.virtualZ, 'draw order still compares absolute depths');
  assert.deepEqual(relativeSample(socket, null), { ...socket }, 'a part drawn outside anything writes the whole thing');
  assert.ok(finiteSample(relativeSample(pupil, { scaleX: 0, scaleY: 0, scale: 0 })));
});

test('nothing ever comes back NaN', () => {
  const cases = [
    undefined, {},
    { x: 0, y: 0, depth: 0, originX: 0, originY: 0, yaw: 0, pitch: 0 },
    { x: 120, y: 120, originX: 120, originY: 120, depth: 1, yaw: 0.5, pitch: -0.3 }, // the point is the origin
    { x: 10, y: 10, depth: 0, yaw: 1, pitch: 1, depthScale: 0 },                     // no depth, no scale to divide by
    { x: 10, y: 10, depth: 1, yaw: 1, pitch: 1, depthScale: 0 },
    { x: NaN, y: undefined, depth: 'nose', originX: null, originY: [], yaw: Infinity, pitch: NaN, depthScale: NaN },
    { x: 1e9, y: -1e9, depth: 1e6, yaw: 1e3, pitch: -1e3, depthScale: 1e6 },
    { x: 10, y: 10, depth: 1, yaw: 0.5, foreshorten: { near: NaN, far: 'lots' } }
  ];
  for (const input of cases) {
    const projected = projectPoint(input);
    for (const key of ['x', 'y', 'virtualZ', 'scale']) {
      assert.ok(Number.isFinite(projected[key]), `${key} is a number for ${JSON.stringify(input)}`);
    }
    assert.ok(projected.scale >= SCALE_LIMITS.min && projected.scale <= SCALE_LIMITS.max);
  }
  for (const input of [undefined, {}, { unit: 0 }, { unit: NaN, depth: NaN, headX: NaN, headY: NaN, strength: NaN },
    { centre: { x: NaN, y: 3 }, origin: null, depth: 1, headX: 1, unit: 28 },
    { centre: ORIGIN, origin: ORIGIN, depth: 0, headX: 0, headY: 0, unit: 28, sweep: { yaw: 0, pitch: 0 } }]) {
    assert.ok(finiteSample(projectFeature(input)), `projectFeature survives ${JSON.stringify(input)}`);
  }
  assert.equal(depthScaleForTravel(28, { yaw: 0 }), 0, 'a sweep of nothing has no travel to distribute');
  assert.equal(depthScaleForTravel(NaN), 0);
  assert.ok(close(depthScaleForTravel(UNIT), 56, 1e-9), 'and 28 units of travel is a depth unit of 56');
});
