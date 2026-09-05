import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RIG_CONSTRAINT_TYPES, attachmentModel, attachmentPoint, compileRigFrame,
  normalizeRigAttachments, normalizeRigConstraint, normalizeRigConstraints,
  normalizeRigHolds, solveRigConstraints, solveRigHolds
} from '../../../runtime/runtime.js';
import { createProjectDocument } from '../state/project-document.js';
import { createExportRig } from '../export/export-rig.js';
import { normalizeRig } from '../rig/normalize-rig.js';

/**
 * Constraints and holding (docs/FACE_CONTROL_RIG.md, CR-25, CR-26, CR-35 … CR-38).
 *
 * A binding says *this parameter moves that element*. A constraint says what a
 * binding cannot: this element must stay in a relationship to that one,
 * whatever moved either of them. A hold is the sharpest case of it — a hand on
 * a cheek that neither hovers nor sinks in when the head turns.
 */
const transform = (x = 0, y = 0, extra = {}) => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...extra });
const frameOf = (entries) => Object.fromEntries(Object.entries(entries).map(([id, item]) => [id, { transform: { ...transform(), ...item } }]));
const solve = (constraints, frame, values = {}) => {
  solveRigConstraints(normalizeRigConstraints({ rigConstraints: constraints }), frame, values);
  return frame;
};

test('every relationship the rig can hold is one an author can name', () => {
  assert.deepEqual([...RIG_CONSTRAINT_TYPES], ['parent', 'distance', 'orientation', 'axis', 'limit', 'slide']);
  // A record needs a name and something to constrain; everything else has a
  // default that does nothing.
  assert.equal(normalizeRigConstraint({ target: 'hand' }), null);
  assert.equal(normalizeRigConstraint({ id: 'c' }), null);
  const plain = normalizeRigConstraint({ id: 'c', target: 'hand' });
  assert.equal(plain.type, 'parent');
  assert.equal(plain.influence, 1);
  assert.equal(plain.enabled, true);
  assert.deepEqual(plain.limits.x, [null, null], 'a limit nobody set is not a limit');
  // A direction is normalized on the way in, so the solver never has to.
  assert.deepEqual(normalizeRigConstraint({ id: 'c', target: 't', axis: { x: 0, y: 4 } }).axis, { x: 0, y: 1 });
  assert.deepEqual(normalizeRigConstraints({ rigConstraints: [{ id: 'a', target: 't' }, { id: 'a', target: 'u' }] }).map((item) => item.target), ['t']);
});

test('follow, distance and orientation put one thing where another is', () => {
  const followed = solve([{ id: 'c', type: 'parent', target: 'hand', source: 'cheek', offset: { x: 4, y: 0 } }],
    frameOf({ hand: { x: 100, y: 100 }, cheek: { x: 20, y: 30 } }));
  assert.deepEqual([followed.hand.transform.x, followed.hand.transform.y], [24, 30]);

  // Half a follow is exactly halfway, which is what makes a constraint
  // something an animator fades rather than a switch somebody flipped.
  const half = solve([{ id: 'c', type: 'parent', target: 'hand', source: 'cheek', influence: 0.5 }],
    frameOf({ hand: { x: 100, y: 0 }, cheek: { x: 0, y: 0 } }));
  assert.equal(half.hand.transform.x, 50);

  // Distance keeps the direction and corrects the length: what put the hand
  // there still decides where it is going, and this decides how far.
  const kept = solve([{ id: 'c', type: 'distance', target: 'hand', source: 'body', distance: 10 }],
    frameOf({ hand: { x: 30, y: 40 }, body: { x: 0, y: 0 } }));
  assert.equal(Math.round(Math.hypot(kept.hand.transform.x, kept.hand.transform.y)), 10);
  assert.ok(kept.hand.transform.x > 0 && kept.hand.transform.y > 0, 'and it is still up and to the right');

  const turned = solve([{ id: 'c', type: 'orientation', target: 'hand', source: 'head' }],
    frameOf({ hand: { rotation: 0 }, head: { rotation: 30 } }));
  assert.equal(turned.hand.transform.rotation, 30);
});

test('an axis, a limit and a slide are what a rig has and a poser does not', () => {
  // Only along the line: a brow on a vertical axis raises and never wanders.
  const vertical = solve([{ id: 'c', type: 'axis', target: 'brow', axis: { x: 0, y: 1 } }], frameOf({ brow: { x: 12, y: -6 } }));
  assert.deepEqual([vertical.brow.transform.x, vertical.brow.transform.y], [0, -6]);

  // A limit holds however the element got there — a binding, a pose, a
  // constraint above it, or an animator dragging.
  const held = solve([{ id: 'c', type: 'limit', target: 'jaw', limits: { maxY: 8, minRotation: -10, maxRotation: 10 } }],
    frameOf({ jaw: { y: 40, rotation: 45 } }));
  assert.equal(held.jaw.transform.y, 8);
  assert.equal(held.jaw.transform.rotation, 10);
  assert.equal(solve([{ id: 'c', type: 'limit', target: 'jaw', limits: { maxY: 8 } }], frameOf({ jaw: { y: 2 } })).jaw.transform.y, 2, 'and it leaves alone what is already inside');

  // Slide follows, along one line only: a corner riding a lip.
  const slid = solve([{ id: 'c', type: 'slide', target: 'corner', source: 'lip', axis: { x: 1, y: 0 } }],
    frameOf({ corner: { x: 0, y: 0 }, lip: { x: 6, y: 20 } }));
  assert.deepEqual([slid.corner.transform.x, slid.corner.transform.y], [6, 0]);
});

test('they are solved in the order they are listed, and later ones see earlier ones', () => {
  // A follow that overshoots, then a limit that pulls it back: the order is the
  // rig's, and reading the list top to bottom is reading what happens.
  const frame = solve([
    { id: 'follow', type: 'parent', target: 'hand', source: 'cheek' },
    { id: 'stop', type: 'limit', target: 'hand', limits: { maxX: 10 } }
  ], frameOf({ hand: { x: 0 }, cheek: { x: 40 } }));
  assert.equal(frame.hand.transform.x, 10);

  // The other way round the limit is applied first and the follow wins, which
  // is a different rig and not a bug.
  const reversed = solve([
    { id: 'stop', type: 'limit', target: 'hand', limits: { maxX: 10 } },
    { id: 'follow', type: 'parent', target: 'hand', source: 'cheek' }
  ], frameOf({ hand: { x: 0 }, cheek: { x: 40 } }));
  assert.equal(reversed.hand.transform.x, 40);

  // A constraint naming artwork the project has lost does nothing rather than
  // throwing into a render loop.
  assert.doesNotThrow(() => solve([{ id: 'c', type: 'parent', target: 'ghost', source: 'cheek' }], frameOf({ cheek: {} })));
  assert.doesNotThrow(() => solve([{ id: 'c', type: 'parent', target: 'hand', source: 'ghost' }], frameOf({ hand: {} })));
});

test('a constraint can be faded by a parameter, which is what makes a hold animatable (CR-38)', () => {
  const constraint = [{ id: 'c', type: 'parent', target: 'hand', source: 'cheek', weight: 'contact' }];
  const at = (contact) => solve(constraint, frameOf({ hand: { x: 100 }, cheek: { x: 0 } }), { contact }).hand.transform.x;
  assert.equal(at(0), 100, 'approach: the hand is where the animator put it');
  assert.equal(at(0.5), 50, 'halfway is halfway, and both ends are true this frame');
  assert.equal(at(1), 0, 'contact');
  assert.equal(at(0), 100, 'and release puts it back with no jump anywhere in between');
});

test('an attachment point follows the artwork it is drawn on (CR-35)', () => {
  const attachments = normalizeRigAttachments({ rigAttachments: [
    { id: 'face.nose', target: 'nose', point: { x: 10, y: 20 } },
    { id: 'hand.left.indexTip', target: 'hand', point: { x: 0, y: 0 } }
  ] });
  const frame = frameOf({ nose: { x: 5, y: 0 }, hand: { x: 0, y: 0 } });
  assert.deepEqual(attachmentPoint(attachments[0], frame), { x: 15, y: 20 });
  // It follows a turn as well as a move: the point is resolved through the
  // element's whole transform, not by adding its translation.
  frame.nose.transform = { ...frame.nose.transform, rotation: 90, pivotX: 0, pivotY: 0, x: 0 };
  assert.deepEqual(attachmentPoint(attachments[0], frame), { x: -20, y: 10 });
  assert.equal(attachmentPoint({ id: 'x', target: 'ghost', point: { x: 0, y: 0 } }, frame), null);

  const model = attachmentModel(attachments, frame);
  assert.deepEqual(model.map((item) => item.id), ['face.nose', 'hand.left.indexTip']);
  assert.equal(model[0].missing, false);
});

test('a finger stays on the nose through a whole head turn (CR-36, CR-56)', () => {
  // The nose is moved by the head; the hand is not. Without a hold the finger
  // is left behind by exactly the distance the nose travelled.
  const elements = {
    nose: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: { translateX: { enabled: true, mode: 'simple', expression: 'headX', curve: 'linear', amplitude: 12, offset: 0 }, translateY: { enabled: true, mode: 'simple', expression: 'headY', curve: 'linear', amplitude: 9, offset: 0 } }, constraints: { translate: true, rotate: true, scale: true } },
    hand: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: {}, constraints: { translate: true, rotate: true, scale: true } }
  };
  const rigAttachments = [
    { id: 'face.nose', target: 'nose', point: { x: 100, y: 100 } },
    { id: 'hand.left.indexTip', target: 'hand', point: { x: 100, y: 100 } }
  ];
  const rigHolds = [{ id: 'boop', hold: 'hand.left.indexTip', to: 'face.nose', weight: 'contact' }];
  const points = normalizeRigAttachments({ rigAttachments });

  for (const headX of [-1, -0.5, 0, 0.5, 1]) {
    for (const headY of [-1, 0, 1]) {
      const frame = compileRigFrame(elements, { headX, headY, contact: 1 }, {}, {}, { rigAttachments, rigHolds });
      const finger = attachmentPoint(points[1], frame), nose = attachmentPoint(points[0], frame);
      assert.ok(Math.abs(finger.x - nose.x) < 1e-6 && Math.abs(finger.y - nose.y) < 1e-6,
        `the contact slid at headX ${headX}, headY ${headY}: finger ${JSON.stringify(finger)} nose ${JSON.stringify(nose)}`);
    }
  }

  // Released, the hand is back where its own controls put it.
  const released = compileRigFrame(elements, { headX: 1, headY: 0, contact: 0 }, {}, {}, { rigAttachments, rigHolds });
  assert.deepEqual([released.hand.transform.x, released.hand.transform.y], [0, 0]);

  // And halfway is halfway: a hold ramps from where the hand is to where the
  // nose is, both computed this frame, so the switch cannot jump (CR-37).
  const halfway = compileRigFrame(elements, { headX: 1, headY: 0, contact: 0.5 }, {}, {}, { rigAttachments, rigHolds });
  assert.equal(halfway.hand.transform.x, 6, 'half of the twelve the nose travelled');
});

test('a hold reaches through the deformation, not just the transform (CR-35)', () => {
  // The cheek is not moved — it is *pinned*, which deforms its path in its own
  // space. An attachment resolved from the transform alone would not notice.
  const elements = {
    cheek: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, restPath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z', bindings: {}, constraints: { translate: true, rotate: true, scale: true } },
    hand: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: {}, constraints: { translate: true, rotate: true, scale: true } }
  };
  const rigPins = [{ id: 'dimple', target: 'cheek', position: { x: 0, y: 0 }, radius: 60, falloff: 'linear', motion: { y: { expression: 'squish', amplitude: -20 } } }];
  const rigAttachments = [
    { id: 'face.cheek.left', target: 'cheek', point: { x: 0, y: 0 } },
    { id: 'hand.left.indexTip', target: 'hand', point: { x: 0, y: 0 } }
  ];
  const rigHolds = [{ id: 'press', hold: 'hand.left.indexTip', to: 'face.cheek.left' }];
  const frame = compileRigFrame(elements, { squish: 1 }, {}, {}, { rigPins, rigAttachments, rigHolds });
  assert.equal(frame.hand.transform.y, -20, 'the finger followed the dent the pin made');
  const rest = compileRigFrame(elements, { squish: 0 }, {}, {}, { rigPins, rigAttachments, rigHolds });
  assert.equal(rest.hand.transform.y, 0);
});

test('a project with no constraints and no holds is a project that had none (CR-52)', () => {
  const empty = createProjectDocument({});
  assert.deepEqual(empty.rigConstraints, []);
  assert.deepEqual(empty.rigAttachments, []);
  assert.deepEqual(empty.rigHolds, []);
  assert.equal(solveRigConstraints([], {}), 0);
  assert.equal(solveRigHolds([], [], {}), 0);

  const exported = createExportRig({
    params: {}, states: {}, elements: {},
    rigConstraints: [{ id: 'c', target: 'hand', source: 'cheek', type: 'parent' }],
    rigAttachments: [{ id: 'face.nose', target: 'nose', point: { x: 1, y: 2 } }],
    rigHolds: [{ id: 'boop', hold: 'hand.left.indexTip', to: 'face.nose' }]
  });
  assert.equal(exported.rigConstraints.length, 1);
  assert.equal(exported.rigHolds[0].to, 'face.nose');
  assert.deepEqual(normalizeRig(exported).rigAttachments[0].point, { x: 1, y: 2 });
  // Rubbish never becomes a hold.
  assert.deepEqual(normalizeRigHolds({ rigHolds: [{ id: 'a' }, { id: 'b', hold: 'x' }, { id: 'c', hold: 'x', to: 'y' }] }).map((item) => item.id), ['c']);
});
