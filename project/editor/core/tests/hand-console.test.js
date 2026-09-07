import test from 'node:test';
import assert from 'node:assert/strict';
import { HAND_CONSOLE, handConsoleLayout, handTrackAt, handTrackDirection, handTrackLength, handTrackPath, handTrackPoint } from '../puppet/hand-console.js';

/**
 * The hand console (docs/DIRECT_CONTROLS.md, docs/HAND_RIGGING.md).
 *
 * ```text
 *   ▲          ╭───────╮
 *   │       ╭──┤  ✋   ├──╮     the ring: the reach the hand really has
 *   ▼     ◆─┤  ╰───────╯  ├─◆  each finger's slider, on its own finger
 *           ╰──◆───◆───◆──╯    the rest of the rim: the places it is held to
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
/** A fan of three fingers, at the angles an artwork would report for them. */
const FAN = [{ id: 'a', at: 20 }, { id: 'b', at: 60 }, { id: 'c', at: 100 }];
const layout = (over = {}) => handConsoleLayout({ ...RING, rim: FAN, hold: ['h', 'i'], row: ['p', 'q'], show: 'out', ...over });
const norm = (degrees) => ((degrees % 360) + 360) % 360;

test('a finger slider is centred on the stretch of rim its own finger points along', () => {
  const { ring, tracks } = layout();
  assert.deepEqual(ring, { cx: 100, cy: 200, rx: 40, ry: 30 });
  for (const { id, at } of FAN) {
    assert.equal(tracks[id].kind, 'arc');
    // Every point of the slider is on the ring, not merely its ends.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) assert.ok(on(tracks[id], t) < 1e-9, `${id} leaves the ring at ${t}`);
    // Centred on the angle it was given -- which is where its finger is --
    // rather than on a share of some sweep the console decided for itself.
    assert.equal((tracks[id].from + tracks[id].to) / 2, at, `${id} is not on its own finger`);
    assert.equal(tracks[id].to - tracks[id].from, HAND_CONSOLE.rimSpan);
    // And closing turns the ring **clockwise**: `from` is open, `to` is shut,
    // and `to` is the larger angle. On this hand and on the other one.
    assert.ok(tracks[id].to > tracks[id].from, `${id} closes the wrong way round`);
  }
  // Two fingers never share a stretch of rim.
  assert.ok(tracks.b.from > tracks.a.to && tracks.c.from > tracks.b.to, 'the fingers overlap on the rim');
  // A finger the artwork puts anywhere is followed there, wrapping included.
  const wrapped = handConsoleLayout({ ...RING, rim: [{ id: 'a', at: -6 }] });
  assert.deepEqual([wrapped.tracks.a.from, wrapped.tracks.a.to], [-19, 7]);
});

test('the places a hand is held to take whatever arc the fingers leave', () => {
  const { tracks } = layout();
  // The fingers point away from the mascot, so the arc they leave is the one
  // facing it -- and nothing here has to know which way that is.
  for (const id of ['h', 'i']) {
    for (const t of [0, 0.5, 1]) assert.ok(on(tracks[id], t) < 1e-9, `${id} leaves the ring at ${t}`);
    assert.ok(tracks[id].to > tracks[id].from, `${id} closes the wrong way round`);
  }
  // Clear of the last finger, clear of the first, and clear of each other:
  // going once round, every edge comes after the one before it.
  const edges = [tracks.c.to, tracks.h.from, tracks.h.to, tracks.i.from, tracks.i.to, tracks.a.from + 360];
  for (let index = 1; index < edges.length; index += 1) assert.ok(edges[index] > edges[index - 1], `the rim overlaps at ${index}`);
  assert.ok(tracks.h.from - tracks.c.to >= HAND_CONSOLE.holdMargin, 'the holds crowd the fingers');

  // A fan running the other way round -- the mirrored hand's -- leaves the
  // mirrored arc, so the two consoles are mirror images rather than merely
  // both correct.
  const other = handConsoleLayout({ ...RING, side: 'right', hold: ['i', 'h'],
    rim: FAN.map(({ id, at }) => ({ id, at: 180 - at })).reverse() });
  for (const id of ['a', 'b', 'c', 'h', 'i']) {
    const one = handTrackPoint(tracks[id], 0.5), flipped = handTrackPoint(other.tracks[id], 0.5);
    assert.ok(Math.abs((200 - one.x) - flipped.x) < 1e-9 && Math.abs(one.y - flipped.y) < 1e-9, `${id} is not mirrored`);
  }
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

test('the row and the way out are the side\'s own, mirrored', () => {
  const left = layout(), right = layout({ side: 'right' });
  const flip = (x) => 200 - x;
  assert.equal(right.tracks.out.from.x, flip(left.tracks.out.from.x));
  assert.equal(right.tracks.p.from.y, left.tracks.p.from.y, 'the row is under the hand either way');
  // A slider is the same length whichever hand it is on: the gesture that
  // closes a finger cannot be twice as long on one side.
  for (const id of ['a', 'b', 'c']) {
    assert.ok(Math.abs(handTrackLength(left.tracks[id]) - handTrackLength(right.tracks[id])) < 1e-9);
  }
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
  const bare = handConsoleLayout({ ...RING, rim: [], hold: [], row: [], show: null });
  assert.deepEqual(bare.tracks, {});
  assert.deepEqual(bare.ring, { cx: 100, cy: 200, rx: 40, ry: 30 });
  // And a hand with no reach worth the name still gets a ring big enough to
  // draw sliders on rather than a dot.
  const tiny = handConsoleLayout({ rest: { x: 0, y: 0 }, reach: { x: 0, y: -3 }, rim: [{ id: 'a', at: 0 }] });
  assert.deepEqual(tiny.ring, { cx: 0, cy: 0, rx: 4, ry: 4 });
  assert.ok(handTrackLength(tiny.tracks.a) > 0);
  // Rubbish in is a ring at the origin rather than a crash.
  assert.deepEqual(handConsoleLayout().ring, { cx: 0, cy: 0, rx: 40, ry: 40 });
  assert.deepEqual(handTrackPoint(null, 0.5), { x: 0, y: 0 });
  assert.deepEqual(handTrackDirection(null, 0), { x: 1, y: 0 });
});
