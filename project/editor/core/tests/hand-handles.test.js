import test from 'node:test';
import assert from 'node:assert/strict';
import { handOutsideReach, handPuppetHandles } from '../puppet/hand-handles.js';
import { puppetDragValues, puppetHandles, puppetOrbitValues, puppetReadout } from '../puppet/puppet-handles.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });
const range = () => ({ type: 'number', min: -1, max: 1, default: 0, value: 0 });
const handParams = (side) => { const c = side === 'right' ? 'R' : 'L'; return { [`hand${c}X`]: range(), [`hand${c}Y`]: range(), [`hand${c}Rotation`]: range(), [`hand${c}Scale`]: range(), [`hand${c}Depth`]: range() }; };

function project({ sides = ['left'], reach = { x: 35, y: 28 }, params = null } = {}) {
  const elements = Object.fromEntries(sides.map((side) => [`hand${side}`, element()]));
  return {
    svgMarkup: '<svg/>', elements,
    layers: Object.keys(elements).map((id) => ({ id, name: id, type: 'path', visible: true, children: [] })),
    semanticParts: {},
    hands: Object.fromEntries(sides.map((side) => [side, { element: `hand${side}`, anchor: { x: 40, y: 120 }, restOffset: { x: 0, y: 0 }, reach }])),
    params: params ?? Object.assign({}, ...sides.map(handParams))
  };
}
const byId = (document) => Object.fromEntries(handPuppetHandles(document).map((handle) => [handle.id, handle]));

test('a hand with artwork gets a handle to place it and one to turn it', () => {
  const handles = byId(project({ sides: ['left', 'right'] }));
  assert.deepEqual(Object.keys(handles).sort(), ['hand-left', 'hand-left-turn', 'hand-right', 'hand-right-turn']);
  assert.equal(handles['hand-left'].x.control, 'handLX');
  assert.equal(handles['hand-left'].y.control, 'handLY');
  assert.equal(handles['hand-right'].x.control, 'handRX');
  assert.equal(handles['hand-left-turn'].mode, 'orbit');
  assert.equal(handles['hand-left-turn'].orbit.control, 'handLRotation');
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

test('a hand is turned by orbiting, and says where it is in words', () => {
  const handles = byId(project());
  assert.deepEqual(puppetOrbitValues(handles['hand-left-turn'], 60), { handLRotation: 1 });
  assert.deepEqual(puppetOrbitValues(handles['hand-left-turn'], -30), { handLRotation: -0.5 });
  assert.equal(puppetReadout(handles['hand-left'], { handLX: 0.5, handLY: -0.25 }), 'left hand across +0.5 · left hand up and down -0.25');
  assert.equal(puppetReadout(handles['hand-left'], {}), 'at rest');
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
