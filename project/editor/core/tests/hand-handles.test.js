import test from 'node:test';
import assert from 'node:assert/strict';
import { handOutsideReach, handPosePresets, handStylePresets, handPuppetHandles } from '../puppet/hand-handles.js';
import { HAND_CONSOLE, handTrackLength, handTrackPoint } from '../puppet/hand-console.js';
import { puppetDragValues, puppetHandles, puppetReadout } from '../puppet/puppet-handles.js';

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });
const range = () => ({ type: 'number', min: -1, max: 1, default: 0, value: 0 });
const handParams = (side) => { const c = side === 'right' ? 'R' : 'L'; return { [`hand${c}X`]: range(), [`hand${c}Y`]: range(), [`hand${c}Rotation`]: range(), [`hand${c}Scale`]: range(), [`hand${c}Depth`]: range() }; };
/** Everything a hand can be asked for: the console has a slider for each. */
const consoleParams = (side) => { const c = side === 'right' ? 'R' : 'L'; return { ...handParams(side),
  [`hand${c}Show`]: { type: 'number', min: 0, max: 1, default: 0, value: 0 },
  [`hand${c}OnChin`]: { type: 'number', min: 0, max: 1, default: 0, value: 0 },
  [`hand${c}OnCheek`]: { type: 'number', min: 0, max: 1, default: 0, value: 0 } }; };

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
  assert.deepEqual(Object.keys(handles).sort(), ['hand-left', 'hand-left-depth', 'hand-left-turn', 'hand-right', 'hand-right-depth', 'hand-right-turn']);
  assert.equal(handles['hand-left'].x.control, 'handLX');
  assert.equal(handles['hand-left'].y.control, 'handLY');
  assert.equal(handles['hand-right'].x.control, 'handRX');
  // The turn is one slider on the hand's console rather than a wrist-turn
  // around it: every movement a hand has is laid out on the same ring.
  assert.equal(handles['hand-left-turn'].mode, 'drag');
  assert.equal(handles['hand-left-turn'].x.control, 'handLRotation');
  assert.equal(handles['hand-left-turn'].slot, 'ring');
  assert.equal(handles['hand-left-turn'].track.kind, 'arc');
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

test('a hand is turned round its own ring, and says where it is in words', () => {
  const turn = byId(project())['hand-left-turn'];
  // The turn goes round the hand rather than along a line under it: a turn
  // dragged around a ring is the turn itself (docs/HAND_STYLES.md).
  assert.equal(turn.track.kind, 'arc');
  const on = handTrackPoint(turn.track, 0.5);
  assert.ok(Math.abs(((on.x - 40) / 35) ** 2 + ((on.y - 120) / 28) ** 2 - 1) < 1e-9, 'the knob rides the reach ellipse');

  const handles = byId(project());
  assert.equal(puppetReadout(handles['hand-left'], { handLX: 0.5, handLY: -0.25 }), 'left hand across +0.5 · left hand up and down -0.25');
  assert.equal(puppetReadout(handles['hand-left'], {}), 'at rest');
});

test('a hand gets a console: a ring, a row under it and a way out beside the face', () => {
  const handles = byId(project({ params: consoleParams('left') }));
  // The ring is the reach the hand already had, so what is drawn around the
  // hand is exactly where the hand may go.
  assert.deepEqual(handles['hand-left'].ring, { cx: 40, cy: 120, rx: 35, ry: 28 });
  // Nothing rides the rim any more: there is no finger to curl, so the rim is
  // where the turn goes (docs/HAND_STYLES.md).
  assert.deepEqual(Object.values(handles).filter((handle) => handle.slot === 'rim'), []);
  const ring = Object.values(handles).filter((handle) => handle.slot === 'ring');
  assert.deepEqual(ring.map((handle) => handle.x.control), ['handLRotation']);

  // The places the hand can be held to, on the half of the rim that faces the
  // mascot, sharing the ring with the turn.
  const held = byId(project({ params: consoleParams('left'), holds: true }));
  const holds = Object.values(held).filter((handle) => handle.slot === 'hold');
  assert.deepEqual(holds.map((handle) => [handle.id, handle.x.control]),
    [['hand-left-hold-chin', 'handLOnChin'], ['hand-left-hold-cheek', 'handLOnCheek']]);
  assert.equal(holds[0].label, 'Left hand on the chin');
  for (const handle of holds) assert.equal(handle.track.kind, 'arc', handle.id);
  // A hand with no holds simply has none, rather than empty sliders.
  assert.equal(Object.values(handles).some((handle) => handle.slot === 'hold'), false);

  // The draw order, on one line under the ring.
  const row = Object.values(handles).filter((handle) => handle.slot === 'row');
  assert.deepEqual(row.map((handle) => handle.x.control), ['handLDepth']);
  assert.ok(row[0].track.from.y > 148, 'and it is under the ring');

  // And the way out from behind the head: upright, beside the face, on the
  // hand's own side, running downwards as the hand comes out.
  const show = handles['hand-left-show'];
  assert.equal(show.x.control, 'handLShow');
  assert.equal(show.track.from.x, show.track.to.x, 'the way out is upright');
  assert.ok(show.track.from.x < 40 - 35, 'and outside the ring, on the hand\'s own side');
  assert.ok(show.track.to.y > show.track.from.y, 'tucked away at the top, out at the bottom');
  assert.deepEqual(puppetDragValues(show, { dx: 0, dy: handTrackLength(show.track) }), { handLShow: 1 });

  // With nothing on the rim the turn has the whole ring, and its knob rides it.
  const turn = handTrackPoint(handles['hand-left-turn'].track, 0.5);
  assert.ok(Math.abs(((turn.x - 40) / 35) ** 2 + ((turn.y - 120) / 28) ** 2 - 1) < 1e-9);
  // The turn and the places the hand is held to share the ring rather than
  // being drawn on top of each other.
  const spans = [...Object.values(held).filter((handle) => handle.track?.kind === 'arc')]
    .map((handle) => [handle.track.from, handle.track.to]).sort((a, b) => a[0] - b[0]);
  for (let index = 1; index < spans.length; index += 1) assert.ok(spans[index][0] >= spans[index - 1][1], 'two sliders share a stretch of ring');
  // And the way out is on each hand's own side.
  const right = byId(project({ sides: ['right'], params: consoleParams('right') }));
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
  assert.deepEqual(all, ['hand-left', 'hand-left-turn', 'hand-left-depth'], 'no face parts here, but the hands are grabbable');
  assert.equal(puppetHandles({}).length, 0);
});

test('a style chip writes one number: which drawing', () => {
  const document = drawnProject();
  const presets = Object.fromEntries(handStylePresets(document, 'left').map((preset) => [preset.id, preset]));
  assert.equal(presets.open.ready, true);
  assert.deepEqual(presets.open.values, { handLStyle: 0 });
  assert.equal(presets.fist.added, false, 'a drawing this hand has not got is an offer');
  assert.deepEqual(presets.fist.values, {});
});

/* ── A hand made of drawings (docs/HAND_STYLES.md) ─────────────────────────── */

/** The same project, with the left hand showing drawings. */
function drawnProject({ showing = 'open' } = {}) {
  const document = project({ sides: ['left'], params: { ...consoleParams('left'), handLStyle: { type: 'number', min: 0, max: 0, default: 0, value: 0, options: ['open'] } }, holds: true });
  document.hands.left = {
    ...document.hands.left,
    parameters: { x: 'handLX', y: 'handLY', rotation: 'handLRotation', scale: 'handLScale', depth: 'handLDepth', style: 'handLStyle' },
    styles: { showing, library: [{ id: 'open', label: 'Open', element: 'handLeftStyle-open' }] }
  };
  return document;
}

test('a hand is asked where it goes, how it is turned, how it is painted and where it is held', () => {
  const handles = byId(drawnProject());
  assert.deepEqual(Object.keys(handles).sort(),
    ['hand-left', 'hand-left-depth', 'hand-left-hold-cheek', 'hand-left-hold-chin', 'hand-left-show', 'hand-left-turn']);
  // Dragged where it goes, turned round the ring, painted in front of or
  // behind the rest, and brought out from behind the head. Which drawing it is
  // belongs to the picker beside the face, not to the console.
  assert.equal(handles['hand-left'].controller, 'target');
  assert.equal(handles['hand-left-turn'].slot, 'ring');
  assert.equal(handles['hand-left-turn'].track.kind, 'arc', 'the turn goes round the hand, not along a line under it');
  assert.equal(handles['hand-left-turn'].x.control, 'handLRotation');
  assert.equal(handles['hand-left-depth'].x.control, 'handLDepth');
  assert.match(handles['hand-left-depth'].hint, /in front of the other layers/);
});

test('there is no finger, curl, grip, flip, facing or animation on any hand', () => {
  for (const document of [drawnProject(), project({ sides: ['left'], params: consoleParams('left'), holds: true })]) {
    const handles = byId(document);
    for (const gone of ['hand-left-grip', 'hand-left-thumb', 'hand-left-index', 'hand-left-middle', 'hand-left-ring', 'hand-left-facing', 'hand-left-flip', 'hand-left-anim']) {
      assert.equal(handles[gone], undefined, gone);
    }
    assert.equal(JSON.stringify(handles).toLowerCase().includes('curl'), false);
  }
});

test('every hand that has places to be held to is offered them, drawings or not', () => {
  // A hold is one number for a place that takes three to find by dragging, so
  // the hand you would most want to hold -- the drawn, recommended one -- is
  // the last hand that should be without them (V3-11).
  const drawn = byId(drawnProject());
  assert.ok(drawn['hand-left-hold-chin'] && drawn['hand-left-hold-cheek']);
  assert.equal(drawn['hand-left-hold-chin'].slot, 'hold', 'on the ring, beside the turn');
  assert.equal(drawn['hand-left-hold-chin'].x.control, 'handLOnChin');
  const plain = byId(project({ sides: ['left'], params: consoleParams('left'), holds: true }));
  assert.ok(plain['hand-left-hold-chin'] && plain['hand-left-hold-cheek']);
  // Nothing invented: a project with no holds gets no chips for them.
  assert.equal(byId(project({ sides: ['left'], params: consoleParams('left') }))['hand-left-hold-chin'], undefined);
});

test('a hand has named places to be put, and the holds are among them', () => {
  const places = handPosePresets(drawnProject(), 'left');
  const byName = Object.fromEntries(places.map((place) => [place.id, place]));
  assert.deepEqual(places.filter((place) => place.kind === 'place').map((place) => place.id),
    ['rest', 'up', 'down', 'out', 'in', 'wave']);
  // Every place brings the hand out from behind the head with it: a pose
  // nobody can see is not a pose (docs/HAND_RIGGING.md, "Behind the head").
  assert.deepEqual(byName.up.values, { handLShow: 1, handLY: -1 });
  assert.deepEqual(byName.rest.values, { handLShow: 1, handLX: 0, handLY: 0, handLRotation: 0 });
  // Out is away from the middle on both hands, because that is what it means.
  assert.equal(byName.out.values.handLX, -1);
  assert.equal(handPosePresets({ ...drawnProject(), hands: { right: { element: 'handleft', anchor: { x: 0, y: 0 }, reach: { x: 1, y: 1 } } }, params: consoleParams('right') }, 'right')
    .find((place) => place.id === 'out').values.handRX, 1);
  // And the places it can be held to, with the way back out of them.
  assert.deepEqual(places.filter((place) => place.kind === 'hold').map((place) => place.name),
    ['On the chin', 'On the cheek', 'Let go']);
  assert.deepEqual(byName['left-chin'].values, { handLShow: 1, handLOnChin: 1 });
  assert.deepEqual(byName['let-go'].values, { handLOnChin: 0, handLOnCheek: 0 });
  // A hand the project does not have has no places at all.
  assert.deepEqual(handPosePresets(drawnProject(), 'right'), []);
});

test('the wrist a hand is grabbed by is the same point in every drawing', () => {
  const open = byId(drawnProject({ showing: 'open' }))['hand-left'];
  const fist = byId(drawnProject({ showing: 'fist' }))['hand-left'];
  assert.ok(open.point, 'a hand made of drawings is held by its wrist, not by its anchor');
  assert.deepEqual(open.point, fist.point, 'and the grip does not move when the drawing does');
});
