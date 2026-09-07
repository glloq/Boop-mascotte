import test from 'node:test';
import assert from 'node:assert/strict';
import { handOutsideReach, handPosePresets, handPuppetHandles } from '../puppet/hand-handles.js';
import { HAND_CONSOLE, handTrackLength, handTrackPoint } from '../puppet/hand-console.js';
import { HAND_DIGITS, handDigitTip } from '../sample/hand-artwork.js';
import { puppetDragValues, puppetHandles, puppetReadout } from '../puppet/puppet-handles.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });
const range = () => ({ type: 'number', min: -1, max: 1, default: 0, value: 0 });
const handParams = (side) => { const c = side === 'right' ? 'R' : 'L'; return { [`hand${c}X`]: range(), [`hand${c}Y`]: range(), [`hand${c}Rotation`]: range(), [`hand${c}Scale`]: range(), [`hand${c}Depth`]: range() }; };
/** The parameters a hand made of parts carries: the console has a slider for each. */
const consoleParams = (side) => { const c = side === 'right' ? 'R' : 'L'; return { ...handParams(side),
  [`hand${c}Grip`]: range(), [`hand${c}Facing`]: range(), [`hand${c}Show`]: { type: 'number', min: 0, max: 1, default: 0, value: 0 },
  [`hand${c}OnChin`]: { type: 'number', min: 0, max: 1, default: 0, value: 0 },
  [`hand${c}OnCheek`]: { type: 'number', min: 0, max: 1, default: 0, value: 0 },
  ...Object.fromEntries(['Thumb', 'Index', 'Middle', 'Ring'].map((digit) => [`hand${c}${digit}`, range()])) }; };

function project({ sides = ['left'], reach = { x: 35, y: 28 }, params = null, holds = false } = {}) {
  const elements = Object.fromEntries(sides.map((side) => [`hand${side}`, element()]));
  return {
    svgMarkup: '<svg/>', elements,
    // A hand held to a named place on the face (docs/HAND_RIGGING.md).
    rigHolds: holds ? sides.flatMap((side) => [
      { id: `${side}-chin`, hold: `hand.${side}.palm`, to: 'face.chin', weight: `hand${side === 'right' ? 'R' : 'L'}OnChin`, orient: true },
      { id: `${side}-cheek`, hold: `hand.${side}.palm`, to: `face.cheek.${side}`, weight: `hand${side === 'right' ? 'R' : 'L'}OnCheek`, orient: true }
    ]) : [],
    layers: Object.keys(elements).map((id) => ({ id, name: id, type: 'path', visible: true, children: [] })),
    semanticParts: {},
    hands: Object.fromEntries(sides.map((side) => [side, { element: `hand${side}`, anchor: { x: 40, y: 120 }, restOffset: { x: 0, y: 0 }, reach }])),
    params: params ?? Object.assign({}, ...sides.map(handParams))
  };
}
const byId = (document) => Object.fromEntries(handPuppetHandles(document).map((handle) => [handle.id, handle]));

test('a hand with artwork gets a handle to place it and a slider to turn it', () => {
  const handles = byId(project({ sides: ['left', 'right'] }));
  assert.deepEqual(Object.keys(handles).sort(), ['hand-left', 'hand-left-turn', 'hand-right', 'hand-right-turn']);
  assert.equal(handles['hand-left'].x.control, 'handLX');
  assert.equal(handles['hand-left'].y.control, 'handLY');
  assert.equal(handles['hand-right'].x.control, 'handRX');
  // The turn is one slider on the hand's console rather than a wrist-turn
  // around it: every movement a hand has is laid out on the same ring.
  assert.equal(handles['hand-left-turn'].mode, 'drag');
  assert.equal(handles['hand-left-turn'].x.control, 'handLRotation');
  assert.equal(handles['hand-left-turn'].slot, 'row');
  assert.equal(handles['hand-left-turn'].track.kind, 'line');
  assert.deepEqual(handles['hand-left'].elements, ['handleft']);

  // Nothing to grab without artwork, or without the parameters that drive it.
  assert.deepEqual(handPuppetHandles({}), []);
  assert.deepEqual(handPuppetHandles({ hands: { left: { element: 'ghost' } }, elements: {} }), []);
  assert.deepEqual(handPuppetHandles({ ...project(), params: {} }), []);
});

test('a hand handle reaches exactly as far as the hand can', () => {
  const hand = byId(project())['hand-left'];
  // The reach is a radius from rest, and a parameter's range runs min to max,
  // so one radius of travel is exactly the edge of the ellipse.
  assert.deepEqual(hand.span, { x: 70, y: 56 });
  assert.deepEqual(puppetDragValues(hand, { dx: 35, dy: 0 }), { handLX: 1, handLY: 0 });
  assert.deepEqual(puppetDragValues(hand, { dx: 0, dy: -28 }), { handLX: 0, handLY: -1 });
  assert.deepEqual(puppetDragValues(hand, { dx: 17.5, dy: 14 }), { handLX: 0.5, handLY: 0.5 });
  assert.deepEqual(puppetDragValues(hand, { dx: 350, dy: 0 }), { handLX: 1, handLY: 0 }, 'and no further');

  // The ellipse the canvas draws is the model's own, around the anchor.
  assert.deepEqual(hand.reach, { cx: 40, cy: 120, rx: 35, ry: 28, overshoot: 0.25 });
  // A tiny hand still gets a usable span rather than a hair-trigger one.
  assert.deepEqual(byId(project({ reach: { x: 0, y: 0 } }))['hand-left'].span, { x: 8, y: 8 });
});

test('a hand is turned by sliding along its track, and says where it is in words', () => {
  const turn = byId(project())['hand-left-turn'];
  // Sliding the length of the track covers the whole range, and crossing it
  // moves nothing: the drag is projected onto the slider it is on.
  const length = handTrackLength(turn.track);
  assert.deepEqual(puppetDragValues(turn, { dx: length, dy: 0 }), { handLRotation: 1 });
  assert.deepEqual(puppetDragValues(turn, { dx: -length / 4, dy: 0 }), { handLRotation: -0.5 });
  assert.deepEqual(puppetDragValues(turn, { dx: 0, dy: length }), { handLRotation: 0 });
  assert.deepEqual(puppetDragValues(turn, { dx: length * 9, dy: 0 }), { handLRotation: 1 }, 'and no further');

  const handles = byId(project());
  assert.equal(puppetReadout(handles['hand-left'], { handLX: 0.5, handLY: -0.25 }), 'left hand across +0.5 · left hand up and down -0.25');
  assert.equal(puppetReadout(handles['hand-left'], {}), 'at rest');
});

test('a hand made of parts gets a console: a ring, a rim of fingers, a row of turns and a way out', () => {
  const handles = byId(project({ params: consoleParams('left') }));
  // The ring is the reach the hand already had, so what is drawn around the
  // hand is exactly where the hand may go.
  assert.deepEqual(handles['hand-left'].ring, { cx: 40, cy: 120, rx: 35, ry: 28 });
  // The grip and one slider per finger, all on the ring's rim.
  const rim = Object.values(handles).filter((handle) => handle.slot === 'rim');
  assert.deepEqual(rim.map((handle) => handle.x.control),
    ['handLGrip', 'handLThumb', 'handLIndex', 'handLMiddle', 'handLRing']);
  for (const handle of rim) {
    assert.equal(handle.track.kind, 'arc', handle.id);
    const at = handTrackPoint(handle.track, 0.5);
    assert.ok(Math.abs(((at.x - 40) / 35) ** 2 + ((at.y - 120) / 28) ** 2 - 1) < 1e-9, `${handle.id} is off the ring`);
    // Closing turns the ring clockwise, on this hand and on the other.
    assert.ok(handle.track.to > handle.track.from, `${handle.id} closes the wrong way round`);
  }
  // And each finger's slider sits on the stretch of rim *its own finger points
  // along*: the slider nearest a finger is that finger's, which is the whole
  // point of putting them on a ring around the hand. Measured as a direction
  // from the middle of the ring, because a ring is an ellipse and the angle
  // that parameterises one is not the direction anything points in.
  const points = (id) => {
    const tip = handDigitTip('left', id, { at: { x: 40, y: 120 }, box: { width: 240, height: 240 } });
    return Math.atan2(tip.y - 120, tip.x - 40) * (180 / Math.PI);
  };
  const sits = (id) => {
    const knob = handTrackPoint(handles[id].track, 0.5);
    return Math.atan2(knob.y - 120, knob.x - 40) * (180 / Math.PI);
  };
  for (const digit of HAND_DIGITS) {
    assert.ok(Math.abs(sits(`hand-left-${digit.id}`) - points(digit.id)) < 0.001, `${digit.id} is not on its own finger`);
  }
  // The grip closes every finger, so it sits clear of the fan rather than in
  // the middle of it: its own slider, next to the thumb's, one gap away.
  assert.ok(handles['hand-left-thumb'].track.from - handles['hand-left-grip'].track.to >= HAND_CONSOLE.rimGap - 1e-6);
  // No two of them share a stretch of rim.
  const spans = rim.map((handle) => [handle.track.from, handle.track.to]).sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < spans.length; index += 1) assert.ok(spans[index][0] > spans[index - 1][1], 'the rim sliders overlap');

  // The places the hand can be held to, on the half of the rim that faces the
  // mascot -- they are places on its face, and the fingers leave that half
  // empty for them.
  const held = byId(project({ params: consoleParams('left'), holds: true }));
  const holds = Object.values(held).filter((handle) => handle.slot === 'hold');
  assert.deepEqual(holds.map((handle) => [handle.id, handle.x.control]),
    [['hand-left-hold-chin', 'handLOnChin'], ['hand-left-hold-cheek', 'handLOnCheek']]);
  assert.equal(holds[0].label, 'Left hand on the chin');
  // They take the arc the fingers leave, and never overlap one.
  const fingers = Object.values(held).filter((handle) => handle.slot === 'rim').map((handle) => handle.track);
  const wrap = (degrees) => ((degrees % 360) + 360) % 360;
  for (const handle of holds) {
    for (const finger of fingers) {
      const gap = Math.min(wrap(finger.from - handle.track.to), wrap(handle.track.from - finger.to));
      assert.ok(gap > 0, `${handle.id} is drawn over a finger`);
    }
  }
  // A hand with no holds simply has none, rather than empty sliders.
  assert.equal(Object.values(handles).some((handle) => handle.slot === 'hold'), false);

  // The whole-hand turns, side by side on one line under the ring.
  const row = Object.values(handles).filter((handle) => handle.slot === 'row');
  assert.deepEqual(row.map((handle) => handle.x.control), ['handLRotation', 'handLFacing']);
  assert.equal(row[0].track.from.y, row[1].track.from.y, 'the row is a row');
  assert.ok(row[0].track.from.y > 148, 'and it is under the ring');
  assert.ok(row[0].track.to.x < row[1].track.from.x, 'with a gap between the two');

  // And the way out from behind the head: upright, beside the face, on the
  // hand's own side, running downwards as the hand comes out.
  const show = handles['hand-left-show'];
  assert.equal(show.x.control, 'handLShow');
  assert.equal(show.track.from.x, show.track.to.x, 'the way out is upright');
  assert.ok(show.track.from.x < 40 - 35, 'and outside the ring, on the hand\'s own side');
  assert.ok(show.track.to.y > show.track.from.y, 'tucked away at the top, out at the bottom');
  // Sliding it down brings the hand out.
  assert.deepEqual(puppetDragValues(show, { dx: 0, dy: handTrackLength(show.track) }), { handLShow: 1 });

  // The right hand's console is the mirror of the left one's -- because its
  // artwork is, and the console follows the artwork rather than a rule of its
  // own about which way round a hand goes.
  const right = byId(project({ sides: ['right'], params: consoleParams('right') }));
  const mid = (list, id) => handTrackPoint(list[id].track, 0.5);
  for (const part of ['grip', 'thumb', 'index', 'middle', 'ring']) {
    const one = mid(handles, `hand-left-${part}`), other = mid(right, `hand-right-${part}`);
    assert.ok(Math.abs((80 - one.x) - other.x) < 1e-6 && Math.abs(one.y - other.y) < 1e-6, `${part} is not mirrored`);
    // And both close the same way round the ring, which the mirror does not.
    assert.ok(right[`hand-right-${part}`].track.to > right[`hand-right-${part}`].track.from, `${part} closes the wrong way round`);
  }
  assert.ok(right['hand-right-show'].track.from.x > 40 + 35);
});

test('a hand behind the head shows only the control that brings it out', () => {
  const handles = byId(project({ params: consoleParams('left') }));
  // Everything on the console waits for the hand to be out of hiding...
  for (const handle of Object.values(handles)) {
    if (handle.id === 'hand-left-show') continue;
    assert.deepEqual(handle.needs, { control: 'handLShow', above: 0.05 }, handle.id);
  }
  // ...except the one slider that brings it out, which is always there.
  assert.equal(handles['hand-left-show'].needs, null);
  // A hand that never hides has nothing to wait for, and no way out to offer.
  const always = byId(project());
  assert.equal(always['hand-left-show'], undefined);
  for (const handle of Object.values(always)) assert.equal(handle.needs, null, handle.id);
});

test('the corner of the reach is outside it, and the model says so', () => {
  const hand = byId(project())['hand-left'];
  assert.equal(handOutsideReach({ handLX: 0.5, handLY: 0.5 }, hand), false);
  assert.equal(handOutsideReach({ handLX: 1, handLY: 0 }, hand), false, 'on the edge is inside');
  assert.equal(handOutsideReach({ handLX: 1, handLY: 1 }, hand), true, 'the corner is not in the ellipse');
  assert.equal(handOutsideReach({}, null), false);
});

test('the hands join the face handles in one list, and do not need a rig', () => {
  const document = project();
  const all = puppetHandles(document).map((handle) => handle.id);
  assert.deepEqual(all, ['hand-left', 'hand-left-turn'], 'no face parts here, but the hands are grabbable');
  assert.equal(puppetHandles({}).length, 0);
});

test('a pose chip is ready when the pose parameter drives a key on a part, with no key on the pose itself', () => {
  const document = { ...project(), shapeKeys: [{ id: 'k', target: 'handleftIndex', delta: [1], driver: { mode: 'range', parameter: 'handLFist', min: 0, max: 1 } }] };
  document.hands.left.poses = [{ id: 'fist', name: 'Fist' }, { id: 'point', name: 'Point' }];
  const presets = Object.fromEntries(handPosePresets(document, 'left').map((preset) => [preset.id, preset]));
  assert.equal(presets.fist.ready, true);
  assert.equal(presets.fist.missing, null);
  assert.equal(presets.point.ready, false);
  assert.equal(presets.point.missing, 'a shape or its own artwork');
});
