import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_REACH_MINIMUM, HAND_RIG_PARTS, HAND_RIG_WORKSPACE, createHandRigGesture,
  handAnchorFromPoint, handReachFromPoint, handRigGeometry, handRigOverlay, handRigSide
} from '../puppet/hand-handles.js';
import { handReachEllipse } from '../hands/hand-model.js';
import { normalizeHand } from '../../../runtime/runtime.js';
import { createHandCommands } from '../hands/hand-commands.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createSampleProject } from '../state/store.js';

/**
 * Hand mode (VNX-19, docs/HAND_RIGGING.md).
 *
 * The anchor and the reach were four number fields. They are geometry, so they
 * are drawn and dragged; and they are *document* geometry, not a pose, so one
 * whole drag is one command and one undo step.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });

const project = (over = {}) => ({
  ...createSampleProject(),
  svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="body"/><g id="handLeft"/></svg>',
  elements: { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() } },
  hands: {
    left: {
      side: 'left', element: 'handLeft', parent: 'body',
      anchor: { x: -20, y: 40 }, restOffset: { x: 5, y: -5 },
      reach: { x: 40, y: 30, rotation: 30, scale: 0.2 }, softness: 0.25
    }
  },
  ...over
});

function harness(state = project()) {
  const store = createEditorStore(state);
  const history = createHistory(store);
  const commands = createHandCommands(store, history);
  const gesture = createHandRigGesture({ document: () => store.getDocument(), commands });
  return { store, history, gesture, hand: () => store.getDocument().hands?.left ?? null };
}

/* ── Geometry ──────────────────────────────────────────────────────────────── */

test('the overlay is the model\'s own ellipse, with an anchor and a grip on its edge', () => {
  const state = project();
  const overlay = handRigOverlay(state, 'left');
  const ellipse = handReachEllipse(normalizeHand(state.hands.left, 'left'), state.elements);

  // Nothing is re-derived: the ellipse the canvas draws is the one the runtime
  // limits the hand with.
  assert.deepEqual(overlay.rest, { x: ellipse.cx, y: ellipse.cy });
  assert.equal(overlay.reach.rx, ellipse.rx);
  assert.equal(overlay.reach.ry, ellipse.ry);
  assert.equal(overlay.reach.overshoot, ellipse.overshoot);
  // The anchor is the ellipse's centre less the rest offset: the hand hangs
  // from the anchor and rests a little away from it.
  assert.deepEqual(overlay.anchor, { x: -20, y: 40 });
  assert.deepEqual(overlay.rest, { x: -15, y: 35 });
  assert.equal(overlay.element, 'handLeft');
  assert.equal(overlay.parent, 'body');

  // The grip is on the ellipse itself — `(x/rx)² + (y/ry)² = 1` — so what is
  // dragged is the edge rather than a box drawn around it.
  const nx = (overlay.grip.x - overlay.rest.x) / overlay.reach.rx;
  const ny = (overlay.grip.y - overlay.rest.y) / overlay.reach.ry;
  assert.ok(Math.abs(Math.hypot(nx, ny) - 1) < 1e-9, 'the grip sits on the ellipse');
});

test('an anchor on a moved body is drawn where the body puts it', () => {
  // The anchor is stored in the parent's own coordinates, so a body that is
  // scaled and turned moves the whole picture with it.
  const state = project();
  state.elements.body.baseTransform = transform({ x: 10, y: 6, rotation: 90, scaleX: 2, scaleY: 2 });
  const overlay = handRigOverlay(state, 'left');
  const ellipse = handReachEllipse(normalizeHand(state.hands.left, 'left'), state.elements);
  assert.deepEqual(overlay.anchor, { x: ellipse.cx - 5, y: ellipse.cy + 5 });
  // And dragging it back to where it is drawn writes the anchor it started as.
  assert.deepEqual(handAnchorFromPoint(state, 'left', overlay.anchor), { x: -20, y: 40 });
});

test('there is nothing to draw without a hand, or without the artwork that draws it', () => {
  assert.equal(handRigOverlay({}, 'left'), null);
  assert.equal(handRigOverlay(project(), 'right'), null);
  assert.equal(handRigOverlay(project({ elements: {} }), 'left'), null, 'artwork that is gone explains nothing');
  assert.equal(handAnchorFromPoint({}, 'left', { x: 1, y: 2 }), null);
});

test('a hand hanging off nothing is anchored in the artwork\'s own coordinates', () => {
  const state = project();
  state.hands.left.parent = null;
  assert.deepEqual(handRigOverlay(state, 'left').anchor, { x: -20, y: 40 });
  assert.deepEqual(handAnchorFromPoint(state, 'left', { x: 12.5, y: -3 }), { x: 12.5, y: -3 });
});

test('the grip maps back to exactly the reach it was drawn from', () => {
  const rest = { x: -15, y: 35 };
  const geometry = handRigGeometry({ anchor: { x: -20, y: 40 }, restOffset: { x: 5, y: -5 }, reach: { x: 40, y: 30 } });
  assert.deepEqual(handReachFromPoint(rest, geometry.grip), { x: 40, y: 30 });
  // Pulling the grip further out, or across, is a bigger reach either way: the
  // ellipse is symmetric, so which quadrant the pointer ends in does not matter.
  assert.deepEqual(handReachFromPoint(rest, { x: rest.x + Math.SQRT1_2 * 80, y: rest.y - Math.SQRT1_2 * 60 }), { x: 80, y: 60 });
});

test('a reach never falls to zero or below, however far the grip is dragged', () => {
  const rest = { x: 0, y: 0 };
  // A reach of zero is a hand that cannot move and a division by zero in the
  // runtime's own normalisation; a negative one is an ellipse inside out.
  assert.deepEqual(handReachFromPoint(rest, rest), { x: HAND_REACH_MINIMUM, y: HAND_REACH_MINIMUM });
  assert.deepEqual(handReachFromPoint(rest, { x: -0.1, y: 0.2 }), { x: HAND_REACH_MINIMUM, y: HAND_REACH_MINIMUM });
  assert.deepEqual(handReachFromPoint(rest, { x: NaN, y: undefined }), { x: HAND_REACH_MINIMUM, y: HAND_REACH_MINIMUM });
  // And the drawn ellipse honours the same floor, whatever the document holds.
  assert.deepEqual(handRigGeometry({ reach: { x: 0, y: -12 } }).reach, { rx: HAND_REACH_MINIMUM, ry: 12, overshoot: 0 });
});

/* ── When it is on screen ──────────────────────────────────────────────────── */

test('hand mode is drawn in Rig, for one hand, and nowhere else', () => {
  const state = project();
  const view = (over = {}) => handRigSide({ workspace: HAND_RIG_WORKSPACE, document: state, ...over });

  // A reach ellipse round every mascot in every task is clutter on every canvas
  // an author ever looks at, so setting a hand up is where it belongs.
  assert.equal(view({ requested: 'left' }), 'left');
  for (const workspace of ['create', 'animate', 'preview', 'expressions', null]) {
    assert.equal(handRigSide({ workspace, requested: 'left', document: state }), null, workspace);
  }
  // Nothing is on show until something says which hand.
  assert.equal(view(), null);
  // Hand Setup names the side it has open.
  assert.equal(view({ requested: 'right' }), null, 'a side with no hand names nothing');
  // Failing that, the hand whose own artwork is selected — which is what the
  // panel's "Show on canvas" already does.
  assert.equal(view({ selectedId: 'handLeft' }), 'left');
  assert.equal(view({ selectedId: 'body' }), null, 'selecting the body is not selecting the hand');
  // The panel is the louder of the two, and neither replaces the other.
  assert.equal(view({ requested: 'left', selectedId: 'body' }), 'left');
  assert.equal(view({ requested: 'right', selectedId: 'handLeft' }), 'left');
  // Artwork that is gone names nothing either way.
  assert.equal(handRigSide({ workspace: HAND_RIG_WORKSPACE, requested: 'left', selectedId: 'handLeft', document: project({ elements: {} }) }), null);
  assert.equal(handRigSide(), null);
});

test('selecting a part of a hand is selecting the hand', () => {
  // A hand made of parts is a group; a click on the canvas lands on the finger
  // under the pointer. The layer tree says which group that finger sits in.
  const state = project({
    layers: [
      { id: 'body', type: 'g', name: 'Body', children: [{ id: 'nose', type: 'path', name: 'Nose', children: [] }] },
      { id: 'handLeft', type: 'g', name: 'Left hand', children: [
        { id: 'handLeftPalm', type: 'path', name: 'Palm', children: [] },
        { id: 'handLeftThumb', type: 'path', name: 'Thumb', children: [] }
      ] }
    ]
  });
  const view = (selectedId) => handRigSide({ workspace: HAND_RIG_WORKSPACE, selectedId, document: state });
  assert.equal(view('handLeftThumb'), 'left');
  assert.equal(view('handLeftPalm'), 'left');
  assert.equal(view('handLeft'), 'left');
  assert.equal(view('nose'), null, 'a part of the body is not a part of the hand');
  assert.equal(view('handLeftGhost'), null, 'a name that merely starts the same way is not inside the group');
});

/* ── The gesture, and the command it ends in ───────────────────────────────── */

test('one released drag is one document write and one undo step', () => {
  const it = harness();
  assert.deepEqual(HAND_RIG_PARTS, ['anchor', 'reach']);
  assert.equal(it.history.getState().canUndo, false);

  assert.ok(it.gesture.begin('left', 'anchor'));
  assert.deepEqual(it.gesture.active(), { side: 'left', kind: 'anchor', moved: false });
  // Every frame of the drag moves the picture and nothing else: a per-frame
  // write would be a hundred undo steps for one gesture.
  for (const x of [-10, 0, 10, 30]) it.gesture.to({ x, y: 60 });
  assert.deepEqual(it.hand().anchor, { x: -20, y: 40 }, 'the document is untouched while the pointer moves');
  assert.equal(it.history.getState().canUndo, false);
  assert.deepEqual(it.gesture.preview().anchor, { x: 30, y: 60 }, 'but the overlay follows the pointer');

  assert.equal(it.gesture.commit(), true);
  assert.deepEqual(it.hand().anchor, { x: 30, y: 60 });
  assert.equal(it.gesture.active(), null);
  assert.equal(it.gesture.preview(), null);

  it.history.undo();
  assert.deepEqual(it.hand().anchor, { x: -20, y: 40 }, 'one undo takes the whole drag back');
  assert.equal(it.history.getState().canUndo, false, 'and there is nothing left behind it');
});

test('a cancelled drag writes nothing at all', () => {
  const it = harness();
  it.gesture.begin('left', 'anchor');
  it.gesture.to({ x: 200, y: 200 });
  assert.equal(it.gesture.cancel(), true);
  assert.deepEqual(it.hand().anchor, { x: -20, y: 40 });
  assert.equal(it.history.getState().canUndo, false, 'nothing to undo, because nothing happened');
  assert.equal(it.gesture.preview(), null, 'and the overlay goes back to the document');
  assert.equal(it.gesture.cancel(), false, 'cancelling nothing is not a gesture');
  // Committing after a cancel must not resurrect the abandoned value.
  assert.equal(it.gesture.commit(), false);
  assert.deepEqual(it.hand().anchor, { x: -20, y: 40 });
});

test('a press that never moved is a press, not an edit', () => {
  const it = harness();
  it.gesture.begin('left', 'reach');
  assert.equal(it.gesture.commit(), false);
  assert.equal(it.history.getState().canUndo, false);
  assert.deepEqual(it.hand().reach.x, 40);
});

test('dragging the ellipse writes the reach, and never a reach of zero', () => {
  const it = harness();
  const rest = handRigOverlay(it.store.getDocument(), 'left').rest;
  it.gesture.begin('left', 'reach');
  it.gesture.to({ x: rest.x + Math.SQRT1_2 * 60, y: rest.y + Math.SQRT1_2 * 12 });
  assert.equal(it.gesture.commit(), true);
  assert.equal(it.hand().reach.x, 60);
  assert.equal(it.hand().reach.y, 12);
  // The rest of the reach — the turn range and the scale — is not this
  // gesture's to touch.
  assert.equal(it.hand().reach.rotation, 30);
  assert.equal(it.hand().reach.scale, 0.2);

  // Dragging the grip onto the centre would be a hand that cannot move.
  it.gesture.begin('left', 'reach');
  it.gesture.to(rest);
  it.gesture.commit();
  assert.deepEqual([it.hand().reach.x, it.hand().reach.y], [HAND_REACH_MINIMUM, HAND_REACH_MINIMUM]);
});

test('a nudge is the same edit from the keyboard, one press at a time', () => {
  const it = harness();
  assert.equal(it.gesture.nudge('left', 'anchor', { dx: 1, dy: 0 }), true);
  assert.deepEqual(it.hand().anchor, { x: -19, y: 40 });
  assert.equal(it.gesture.nudge('left', 'anchor', { dx: 0, dy: -10 }), true);
  assert.deepEqual(it.hand().anchor, { x: -19, y: 30 });
  it.history.undo();
  assert.deepEqual(it.hand().anchor, { x: -19, y: 40 }, 'each press is its own undo step');

  // The grip is on the bottom-right of the ellipse, so the arrows grow the
  // reach the way dragging it does, and stop at the same floor.
  assert.equal(it.gesture.nudge('left', 'reach', { dx: 5, dy: 5 }), true);
  assert.deepEqual([it.hand().reach.x, it.hand().reach.y], [45, 35]);
  assert.equal(it.gesture.nudge('left', 'reach', { dx: -1000, dy: -1000 }), true);
  assert.deepEqual([it.hand().reach.x, it.hand().reach.y], [HAND_REACH_MINIMUM, HAND_REACH_MINIMUM]);
});

test('the gesture refuses what it cannot draw', () => {
  const it = harness();
  assert.equal(it.gesture.begin('right', 'anchor'), null, 'no hand on that side');
  assert.equal(it.gesture.begin('left', 'softness'), null, 'not a part hand mode offers');
  assert.equal(it.gesture.active(), null);
  assert.equal(it.gesture.nudge('right', 'anchor', { dx: 1 }), false);
  assert.equal(it.history.getState().canUndo, false);

  // A drag already in hand is not restarted by the keyboard underneath it.
  it.gesture.begin('left', 'anchor');
  assert.equal(it.gesture.nudge('left', 'anchor', { dx: 1 }), false);
  it.gesture.cancel();
});
