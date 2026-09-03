import test from 'node:test';
import assert from 'node:assert/strict';
import { PART_POSES, activePartPose, partPoseGroups, partPoses } from '../puppet/part-poses.js';
import { handPosePresets, handPoseRest } from '../puppet/hand-handles.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });

function project({ controls = { eyebrows: ['browRaise', 'browTilt'], mouth: ['smile', 'mouthOpen'], eyes: ['eyeOpen'] } } = {}) {
  const ids = ['browL', 'browR', 'mouth', 'eyeL', 'eyeR'];
  return {
    svgMarkup: '<svg/>', elements: Object.fromEntries(ids.map((id) => [id, element()])),
    layers: ids.map((id) => ({ id, name: id, type: 'path', visible: true, children: [] })),
    semanticParts: {
      eyebrows: { id: 'eyebrows', type: 'eyebrows', roles: { leftBrow: 'browL', rightBrow: 'browR' }, controls: controls.eyebrows || [] },
      mouth: { id: 'mouth', type: 'mouth', roles: { mouth: 'mouth' }, controls: controls.mouth || [] },
      eyes: { id: 'eyes', type: 'eyes', roles: { leftEye: 'eyeL', rightEye: 'eyeR' }, controls: controls.eyes || [] }
    },
    params: { browRaise: number(-1, 1), browTilt: number(-1, 1), smile: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1) }
  };
}

test('a part pose is a place on that part`s movements worth having a name', () => {
  const poses = partPoses(project(), 'eyebrows');
  assert.deepEqual(poses.map((pose) => pose.id), ['neutral', 'raised', 'angry', 'sad', 'curious']);
  const angry = poses.find((pose) => pose.id === 'angry');
  assert.deepEqual(angry.controls, { browRaise: -0.7, browTilt: -0.8 });
  assert.equal(angry.usable, true);
  assert.deepEqual(angry.missing, []);
  assert.deepEqual(partPoses({}, 'eyebrows').filter((pose) => pose.usable), []);
  assert.deepEqual(partPoses(project(), 'nothing-like-that'), []);
});

test('a pose keeps what the project has and names what it does not', () => {
  // A face with a raise but no tilt can still be *raised*; *angry* is half a
  // pose, so it says which movement would finish it.
  const document = project({ controls: { eyebrows: ['browRaise'], mouth: ['smile'] } });
  const poses = partPoses(document, 'eyebrows');
  const angry = poses.find((pose) => pose.id === 'angry');
  assert.deepEqual(angry.controls, { browRaise: -0.7 });
  assert.deepEqual(angry.missing, ['Tilt']);
  assert.equal(angry.usable, true, 'it still does something');

  // With no movement at all there is nothing to press.
  const bare = partPoses(project({ controls: {} }), 'mouth');
  assert.deepEqual(bare.filter((pose) => pose.usable), []);
  assert.deepEqual(bare[0].missing, ['Smile', 'Open / close']);

  // Values are clamped into each parameter's own range, never past it.
  assert.equal(partPoses(project(), 'mouth').find((pose) => pose.id === 'open').controls.mouthOpen, 1);
  assert.equal(partPoses(project(), 'eyes').find((pose) => pose.id === 'closed').controls.eyeOpen, 0);
});

test('groups come back in panel order, and only when there is something to press', () => {
  const groups = partPoseGroups(project());
  assert.deepEqual(groups.map((group) => group.part), ['eyes', 'eyebrows', 'mouth'], 'no head or gaze in this project');
  assert.deepEqual(groups.map((group) => group.label), ['Eyes', 'Eyebrows', 'Mouth']);
  assert.ok(groups.every((group) => group.poses.every((pose) => pose.usable)));
  assert.deepEqual(partPoseGroups({}), []);
});

test('a chip knows when the face is already standing in its pose', () => {
  const poses = partPoses(project(), 'mouth');
  assert.equal(activePartPose(poses, { smile: 1, mouthOpen: 0 }), 'smile');
  assert.equal(activePartPose(poses, { smile: 0, mouthOpen: 0 }), 'neutral');
  assert.equal(activePartPose(poses, { smile: 0.42, mouthOpen: 0 }), null, 'halfway is not a pose');
  assert.equal(activePartPose(poses, {}), 'neutral', 'nothing set is the rest pose');
  assert.equal(activePartPose([], { smile: 1 }), null);
  // Every catalogue entry is reachable, which is what makes a chip row honest.
  for (const part of Object.keys(PART_POSES)) {
    for (const pose of PART_POSES[part]) assert.ok(pose.name && Object.keys(pose.controls).length, `${part}:${pose.id}`);
  }
});

/* Hand poses are the same idea, over the poses a hand actually carries. */
const handProject = (poses) => ({
  elements: { handL: element() },
  hands: { left: { element: 'handL', poses } },
  params: {}
});

test('a hand offers the poses it has, and the ones it could have', () => {
  const chips = handPosePresets(handProject([{ id: 'wave', name: 'Wave', shapeKey: 'waveKey' }, { id: 'fist', name: 'Fist' }]), 'left');
  const [wave, fist] = chips;
  assert.equal(wave.added, true);
  assert.equal(wave.ready, true, 'it deforms the hand through a shape key');
  assert.deepEqual(wave.values, { handLWave: 1, handLFist: 0 }, 'striking one puts the others down');

  // A pose with neither a shape nor its own artwork is a name and nothing
  // else, and says so instead of pretending to work.
  assert.equal(fist.ready, false);
  assert.equal(fist.missing, 'a shape or its own artwork');

  // The rest are offers, in the order a mascot usually wants them.
  const offers = chips.filter((chip) => !chip.added).map((chip) => chip.id);
  assert.deepEqual(offers, ['neutral', 'open', 'point', 'peace', 'thumbsUp']);
  assert.deepEqual(chips.filter((chip) => !chip.added)[0].values, {}, 'an offer sets nothing until it is added');

  assert.deepEqual(handPoseRest(handProject([{ id: 'wave' }, { id: 'fist' }]), 'left'), { handLWave: 0, handLFist: 0 });
  assert.deepEqual(handPosePresets({}, 'left'), []);
  assert.deepEqual(handPoseRest({}, 'left'), {});
});
