import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HAND_FACE, DEFAULT_HAND_POSE, DEFAULT_HAND_VIEW, HAND_FACES, HAND_POSES, HAND_SIDES, HAND_VIEWS,
  handFaceOpposite, handPose, handPoseId, handSideOpposite, handView, handViewAngle, handViewId, handViewIndex,
  handViewMirror, handViewNeighbours, handViewStep, isPoseMirrorable, isSelfMirroredView,
  normalizeHandAppearance, normalizeHandState
} from '../../../runtime/hand-vocabulary.js';

/**
 * The three closed lists a 2D hand is made of (docs/HANDS_2D.md, PHASES 3-5).
 * Everything downstream reads these, so what they promise is pinned here.
 */

test('the five views are in spatial order, at the angles they stand for', () => {
  assert.deepEqual(HAND_VIEWS.map((view) => view.id), ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight']);
  assert.deepEqual(HAND_VIEWS.map((view) => view.angle), [-90, -45, 0, 45, 90]);
  assert.equal(DEFAULT_HAND_VIEW, 'front');
  assert.equal(handViewIndex('front'), 2);
});

test('mirroring a view is an involution over the row, and the front maps to itself', () => {
  for (const view of HAND_VIEWS) assert.equal(handViewMirror(handViewMirror(view.id)), view.id);
  assert.equal(handViewMirror('threeQuarterLeft'), 'threeQuarterRight');
  assert.equal(handViewMirror('sideRight'), 'sideLeft');
  assert.equal(handViewMirror('front'), 'front');
  assert.equal(isSelfMirroredView('front'), true);
  assert.equal(isSelfMirroredView('sideLeft'), false);
});

test('the poses are one list, and the asymmetric ones refuse to be mirrored', () => {
  assert.deepEqual(HAND_POSES.map((pose) => pose.id), ['relaxed', 'open', 'fist', 'point', 'grab', 'thumbsUp', 'peace']);
  assert.equal(DEFAULT_HAND_POSE, 'relaxed');
  for (const id of ['relaxed', 'open', 'fist', 'grab']) assert.equal(isPoseMirrorable(id), true, id);
  for (const id of ['point', 'thumbsUp', 'peace']) assert.equal(isPoseMirrorable(id), false, id);
});

test('a wave is an open hand, not a pose of its own', () => {
  assert.equal(handPoseId('wave'), 'open');
  assert.equal(handPoseId('hello'), 'open');
  assert.equal(handPose('wave').id, 'open');
  assert.equal(HAND_POSES.some((pose) => pose.id === 'wave'), false);
});

test('an unknown pose or view is the default one, never a throw', () => {
  assert.equal(handPoseId('rubbish'), null);
  assert.equal(handPose('rubbish').id, DEFAULT_HAND_POSE);
  assert.equal(handPose(undefined).id, DEFAULT_HAND_POSE);
  assert.equal(handViewId(42), null);
  assert.equal(handView(null).id, DEFAULT_HAND_VIEW);
  assert.equal(handViewAngle('rubbish'), 0);
});

test('older names for a view still find one', () => {
  assert.equal(handViewId('profile'), 'sideRight');
  assert.equal(handViewId('far'), 'sideLeft');
  assert.equal(handViewId('3/4L'), 'threeQuarterLeft');
  assert.equal(handViewId('center'), 'front');
});

test('stepping along the row stops at either end', () => {
  assert.equal(handViewStep('front', 1), 'threeQuarterRight');
  assert.equal(handViewStep('front', -2), 'sideLeft');
  assert.equal(handViewStep('sideRight', 3), 'sideRight');
  assert.equal(handViewStep('sideLeft', -3), 'sideLeft');
});

test('the neighbours of a view are what a turning hand reaches next', () => {
  assert.deepEqual(handViewNeighbours('front'), ['threeQuarterLeft', 'threeQuarterRight']);
  assert.deepEqual(handViewNeighbours('sideLeft'), ['threeQuarterLeft']);
});

test('palm and back are one parameter, not two spellings of a view', () => {
  assert.deepEqual(HAND_FACES.map((face) => face.id), ['palm', 'back']);
  assert.equal(DEFAULT_HAND_FACE, 'palm');
  assert.equal(handFaceOpposite('palm'), 'back');
  assert.equal(handFaceOpposite('nonsense'), 'back');
  assert.equal(HAND_VIEWS.some((view) => /back|palm/i.test(view.id)), false);
});

test('sides are two, and each knows the other', () => {
  assert.deepEqual([...HAND_SIDES], ['left', 'right']);
  assert.equal(handSideOpposite('left'), 'right');
  assert.equal(handSideOpposite('anything else'), 'right');
});

test('appearance is pose, view and face — and nothing that moves', () => {
  const appearance = normalizeHandAppearance({ pose: 'wave', view: 'profile', face: 'back', x: 10 }, 'right');
  assert.deepEqual(appearance, { side: 'right', pose: 'open', view: 'sideRight', face: 'back' });
  assert.equal('x' in appearance, false);
});

test('a hand state carries where it is and what it looks like, with usable defaults', () => {
  assert.deepEqual(normalizeHandState({}, 'left'), {
    id: 'leftHand', side: 'left', pose: 'relaxed', view: 'front', face: 'palm',
    x: 0, y: 0, rotation: 0, scale: 1, flipX: false, visible: true
  });
  const state = normalizeHandState({ id: 'l', pose: 'point', view: 'threeQuarterRight', x: 12, y: -4, rotation: 15, scale: 1.2, flipX: true, visible: false }, 'left');
  assert.deepEqual(state, { id: 'l', side: 'left', pose: 'point', view: 'threeQuarterRight', face: 'palm', x: 12, y: -4, rotation: 15, scale: 1.2, flipX: true, visible: false });
});

test('rubbish in a hand state becomes the default, never NaN', () => {
  const state = normalizeHandState({ x: 'nope', y: null, rotation: undefined, scale: NaN }, 'left');
  assert.deepEqual([state.x, state.y, state.rotation, state.scale], [0, 0, 0, 1]);
});
