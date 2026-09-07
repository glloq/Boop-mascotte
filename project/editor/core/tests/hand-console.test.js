import test from 'node:test';
import assert from 'node:assert/strict';
import { HAND_CONSOLE, handConsoleLayout, handTrackAt, handTrackDirection, handTrackLength, handTrackPath, handTrackPoint } from '../puppet/hand-console.js';

/**
 * The hand console (docs/DIRECT_CONTROLS.md, docs/HAND_RIGGING.md).
 *
 * ```text
 *   ▲          ╭───────╮
 *   │       ╭──┤  ✋   ├──╮     the ring: the reach the hand really has
 *   ▼     ◆─┤  ╰───────╯  ├─◆  one half of the rim: a slider per finger
 *           ╰──◆───◆───◆──╯    the other half: the places it is held to
 *              ▬▬▬▬  ▬▬▬▬      under it: the turns, side by side
 * ```
 *
 * Pure geometry, so it is checked as geometry: on the ring, in order, never
 * overlapping, mirrored between the two hands, and reversible — the point a
 * value puts the knob at and the value a drag along the track produces are the
 * same function read in the two directions.
 */
const RING = { rest: { x: 100, y: 200 }, reach: { x: 40, y: 30 } };
const on = (track, t, ring = RING) => {
  const at = handTrackPoint(track, t);
  return Math.abs(((at.x - ring.rest.x) / ring.reach.x) ** 2 + ((at.y - ring.rest.y) / ring.reach.y) ** 2 - 1);
};
const layout = (over = {}) => handConsoleLayout({ ...RING, rim: ['a', 'b', 'c'], hold: ['h', 'i'], row: ['p', 'q'], show: 'out', ...over });

test('the ring is the reach, and every finger slider lies on it', () => {
  const { ring, tracks } = layout();
  assert.deepEqual(ring, { cx: 100, cy: 200, rx: 40, ry: 30 });
  for (const id of ['a', 'b', 'c']) {
    assert.equal(tracks[id].kind, 'arc');
    // Every point of the slider is on the ring, not merely its ends.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) assert.ok(on(tracks[id], t) < 1e-9, `${id} leaves the ring at ${t}`);
  }
  // In the order they were asked for, sharing the sweep evenly, with a gap
  // between each pair -- two sliders that touch are two sliders nobody can
  // tell apart.
  const spans = ['a', 'b', 'c'].map((id) => [tracks[id].from, tracks[id].to]);
  const slot = HAND_CONSOLE.rimSweep / 3;
  for (const [from, to] of spans) assert.ok(Math.abs(to - from - slot * (1 - HAND_CONSOLE.rimGap)) < 1e-9);
  assert.ok(spans[1][0] > spans[0][1] && spans[2][0] > spans[1][1], 'the fingers overlap on the rim');
  // And the whole rim stays within the sweep it was given.
  assert.ok(spans[0][0] >= HAND_CONSOLE.rimStart);
  assert.ok(spans[2][1] <= HAND_CONSOLE.rimStart + HAND_CONSOLE.rimSweep);
});

test('the places a hand is held to take the half of the rim that faces the mascot', () => {
  const { tracks } = layout();
  // The fingers face away from the mascot and the holds face towards it, so
  // the two halves together are the whole ring and neither is drawn over the
  // other.
  for (const id of ['h', 'i']) {
    for (const t of [0, 0.5, 1]) assert.ok(on(tracks[id], t) < 1e-9, `${id} leaves the ring at ${t}`);
  }
  const inner = handTrackPoint(tracks.h, 0.5), outer = handTrackPoint(tracks.b, 0.5);
  assert.ok(inner.x > 100 && outer.x < 100, 'the holds and the fingers share a side of the ring');
  // Between the last finger and the first hold, and round again: a gap either
  // way, so no finger slider begins where a hold slider ends.
  const ends = [tracks.c.to, tracks.h.from, tracks.i.to, tracks.a.from + 360];
  for (let index = 1; index < ends.length; index += 1) assert.ok(ends[index] > ends[index - 1], 'the two halves of the rim overlap');
  // And they mirror with the rest of the console.
  const right = layout({ side: 'right' });
  assert.ok(Math.abs((200 - handTrackPoint(tracks.h, 0.5).x) - handTrackPoint(right.tracks.h, 0.5).x) < 1e-9);
});

test('the turns are one row under the ring, and the way out is upright beside it', () => {
  const { tracks } = layout();
  // One line: a slider per line would walk off the bottom of the artboard the
  // moment a mascot's reach is a tall one.
  assert.equal(tracks.p.from.y, tracks.q.from.y);
  assert.equal(tracks.p.from.y, tracks.q.to.y);
  assert.ok(tracks.p.from.y > 230, 'the row is under the ring');
  assert.ok(tracks.p.to.x < tracks.q.from.x, 'with a gap between them');
  // Side by side, centred on the hand, and the same length as each other.
  assert.ok(Math.abs(handTrackLength(tracks.p) - handTrackLength(tracks.q)) < 1e-9);
  assert.ok(Math.abs((100 - tracks.p.from.x) - (tracks.q.to.x - 100)) < 1e-9, 'the row is centred on the hand');

  // The way out: upright, clear of the ring, running downwards -- which is the
  // way the hand itself travels as it comes out from behind the head.
  assert.equal(tracks.out.from.x, tracks.out.to.x);
  assert.ok(tracks.out.from.x < 100 - 40, 'and clear of the ring');
  assert.ok(tracks.out.from.y < 200 && tracks.out.to.y > tracks.out.from.y);
});

test('the right hand is the left one mirrored, and nothing else changes', () => {
  const left = layout(), right = layout({ side: 'right' });
  const flip = (x) => 200 - x;
  for (const id of ['a', 'b', 'c']) {
    for (const t of [0, 0.5, 1]) {
      const one = handTrackPoint(left.tracks[id], t), other = handTrackPoint(right.tracks[id], t);
      assert.ok(Math.abs(flip(one.x) - other.x) < 1e-9 && Math.abs(one.y - other.y) < 1e-9, `${id} is not mirrored at ${t}`);
    }
    // A slider is the same length whichever hand it is on: the gesture that
    // closes a finger cannot be twice as long on one side.
    assert.ok(Math.abs(handTrackLength(left.tracks[id]) - handTrackLength(right.tracks[id])) < 1e-9);
  }
  assert.equal(right.tracks.out.from.x, flip(left.tracks.out.from.x));
  assert.equal(right.tracks.p.from.y, left.tracks.p.from.y, 'the row is under the hand either way');
});

test('a knob is put where its value says, and a drag along the track says the same value back', () => {
  const { tracks } = layout();
  const axis = { min: -1, max: 1, rest: 0 };
  // The ends are the ends of the range, and the middle is the middle.
  assert.deepEqual(handTrackPoint(tracks.p, handTrackAt(axis, -1)), tracks.p.from);
  assert.deepEqual(handTrackPoint(tracks.p, handTrackAt(axis, 1)), tracks.p.to);
  assert.equal(handTrackAt(axis, 0), 0.5);
  // Out of range is at the end rather than off the track.
  assert.equal(handTrackAt(axis, 9), 1);
  assert.equal(handTrackAt({ min: 0, max: 0 }, 5), 0, 'a movement with no range has nowhere to be');

  // The direction is the way the track runs where the knob is: along a
  // straight one it never changes, around an arc it always does.
  assert.deepEqual(handTrackDirection(tracks.p, 0.5), { x: 1, y: 0 });
  assert.deepEqual(handTrackDirection(tracks.out, 0.5), { x: 0, y: 1 });
  const early = handTrackDirection(tracks.a, 0), late = handTrackDirection(tracks.a, 1);
  assert.ok(Math.hypot(early.x - late.x, early.y - late.y) > 0.05, 'an arc turns as it goes');
  for (const track of [tracks.a, tracks.p, tracks.out]) {
    for (const t of [0, 0.5, 1]) {
      const way = handTrackDirection(track, t);
      assert.ok(Math.abs(Math.hypot(way.x, way.y) - 1) < 1e-9, 'a direction is a unit vector');
    }
  }
  // A reversed arc runs the other way, which is how a mirrored rim still
  // closes a finger with the same gesture.
  const back = handTrackDirection({ ...tracks.a, from: tracks.a.to, to: tracks.a.from }, 0);
  const forth = handTrackDirection(tracks.a, 1);
  assert.ok(Math.abs(back.x + forth.x) < 1e-9 && Math.abs(back.y + forth.y) < 1e-9);
});

test('a track measures and draws itself, arc or straight', () => {
  const { tracks } = layout();
  assert.equal(handTrackLength(tracks.p), tracks.p.to.x - tracks.p.from.x);
  // An arc is longer than the chord it spans, and the sampling is fine enough
  // to say so rather than a straight line in disguise.
  const chord = Math.hypot(handTrackPoint(tracks.a, 1).x - handTrackPoint(tracks.a, 0).x, handTrackPoint(tracks.a, 1).y - handTrackPoint(tracks.a, 0).y);
  assert.ok(handTrackLength(tracks.a) > chord);
  assert.ok(handTrackLength(tracks.a) < chord * 1.1, 'and not much longer: it is a short arc');

  assert.match(handTrackPath(tracks.p), /^M[\d.-]+ [\d.-]+ L[\d.-]+ [\d.-]+$/);
  // The arc is drawn with the ring's own radii, so what is drawn under the
  // knob and what the knob slides along are one curve.
  assert.match(handTrackPath(tracks.a), /^M[\d.-]+ [\d.-]+ A40 30 0 0 1 [\d.-]+ [\d.-]+$/);
});

test('a console with nothing to lay out is a ring and no sliders', () => {
  const bare = handConsoleLayout({ ...RING, rim: [], row: [], show: null });
  assert.deepEqual(bare.tracks, {});
  assert.deepEqual(bare.ring, { cx: 100, cy: 200, rx: 40, ry: 30 });
  // And a hand with no reach worth the name still gets a ring big enough to
  // draw sliders on rather than a dot.
  const tiny = handConsoleLayout({ rest: { x: 0, y: 0 }, reach: { x: 0, y: -3 }, rim: ['a'] });
  assert.deepEqual(tiny.ring, { cx: 0, cy: 0, rx: 4, ry: 4 });
  assert.ok(handTrackLength(tiny.tracks.a) > 0);
  // Rubbish in is a ring at the origin rather than a crash.
  assert.deepEqual(handConsoleLayout().ring, { cx: 0, cy: 0, rx: 40, ry: 40 });
  assert.deepEqual(handTrackPoint(null, 0.5), { x: 0, y: 0 });
  assert.deepEqual(handTrackDirection(null, 0), { x: 1, y: 0 });
});
