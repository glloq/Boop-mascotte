import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPRESSION_PRESET_GROUPS, EXPRESSION_PRESETS, instantiatePreset, presetAvailability, presetAvailabilityGroups } from '../expressions/expression-presets.js';
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';
import { controlMeta } from '../../ui/control-catalog.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

test('presets use movements the catalogue can name, and degrade to the controls a project has', () => {
  // Not only the movements a Face Part declares. Several of these faces used to
  // describe one thing and do another -- "brows up and inward" was `browTilt`,
  // which leans both brows the same way -- and the control rig has the
  // parameters those sentences meant (`docs/FACE_CONTROL_RIG.md`). What every
  // control has to be is *nameable*, or a missing one reaches an author as a
  // parameter id.
  const basic = new Set(BASIC_MOVEMENTS.map((item) => item.id));
  for (const preset of EXPRESSION_PRESETS) for (const name of Object.keys(preset.controls)) {
    assert.ok(basic.has(name) || controlMeta(name).group !== 'Other', `${preset.id} uses unnameable control ${name}`);
  }
  // And the catalogue as a whole reaches the parts of the rig that used to be
  // unreachable from a preset at all.
  const used = new Set(EXPRESSION_PRESETS.flatMap((preset) => Object.keys(preset.controls)));
  for (const name of ['browInner', 'browRaiseLeft', 'smileLeft', 'pupilScale', 'jawOpen', 'mouthLock', 'tongueOut']) {
    assert.ok(used.has(name), `no face in the catalogue uses ${name}`);
  }
  // The catalogue is deliberately large so an author picks a face instead of
  // building it: the original seven are still in it, ids stay unique, and every
  // preset sits in a declared group (the panel shows one group at a time).
  const ids = EXPRESSION_PRESETS.map((preset) => preset.id);
  for (const id of ['happy', 'sad', 'angry', 'surprised', 'sleepy', 'confused', 'excited']) assert.ok(ids.includes(id), `${id} is missing from the catalogue`);
  assert.equal(new Set(ids).size, ids.length, 'preset ids are unique');
  assert.ok(ids.length >= 24, `only ${ids.length} presets`);
  assert.deepEqual(EXPRESSION_PRESETS.filter((preset) => !EXPRESSION_PRESET_GROUPS.includes(preset.group)), []);

  const basicFace = { params: { smile: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1), lookX: number(-1, 1) } };
  const surprised = instantiatePreset(basicFace, 'surprised');
  assert.deepEqual(surprised.controls, { mouthOpen: 1, eyeOpen: 1 });
  assert.deepEqual(surprised.missing.map((item) => [item.control, item.label]),
    [['jawOpen', 'Jaw · Drop'], ['pupilScale', 'Gaze · Pupil size'], ['browRaise', 'Eyebrows · Raise']],
    'a control the rig has but this project does not is still reported by name');
  assert.equal(surprised.usable, true);

  const none = instantiatePreset({ params: {} }, 'angry');
  assert.equal(none.usable, false);
  assert.equal(none.missing.length, 5);
  assert.throws(() => instantiatePreset(basicFace, 'nope'), /Unknown expression preset/);

  const availability = presetAvailability(basicFace);
  assert.equal(availability.length, EXPRESSION_PRESETS.length);
  assert.equal(availability.find((item) => item.id === 'confused').usable, true, 'confused keeps smile even without brows or head');
  assert.deepEqual(availability.find((item) => item.id === 'confused').controls, { smile: -.2 });
});

test('the catalogue is offered group by group, in catalogue order', () => {
  const basicFace = { params: { smile: number(-1, 1), mouthOpen: number(0, 1), eyeOpen: number(0, 1, 1), lookX: number(-1, 1) } };
  const groups = presetAvailabilityGroups(basicFace);
  assert.deepEqual(groups.map((entry) => entry.group), [...EXPRESSION_PRESET_GROUPS]);
  assert.equal(groups.flatMap((entry) => entry.presets).length, EXPRESSION_PRESETS.length, 'every preset lands in exactly one group');
  assert.equal(groups[0].group, 'Everyday', 'the group that opens first holds the faces every mascot needs');
  assert.deepEqual(groups[0].presets.map((item) => item.id).slice(0, 4), ['happy', 'sad', 'angry', 'surprised']);
  // A group with nothing in it is never rendered: `presetAvailabilityGroups`
  // drops it rather than showing an empty accordion.
  assert.ok(groups.every((entry) => entry.presets.length));
});

/** A face does something with its hands when the project has them (docs/HAND_RIGGING.md), and is never told to draw some. */
test('a preset moves the hands when the project has them, and never misses them when it does not', () => {
  const number = (min, max) => ({ type: 'number', min, max, default: 0, value: 0 });
  const face = { params: { smile: number(-1, 1), eyeOpen: number(0, 1), browRaise: number(-1, 1), mouthOpen: number(0, 1), jawOpen: number(0, 1), pupilScale: number(.4, 1.6) } };
  const hands = { handLShow: number(0, 1), handRShow: number(0, 1), handLX: number(-1, 1), handRX: number(-1, 1), handLY: number(-1, 1), handRY: number(-1, 1), handLSpread: number(0, 1), handRSpread: number(0, 1), handRThumbsUp: number(0, 1), handRPinch: number(0, 1) };
  const withHands = { params: { ...face.params, ...hands } };
  const surprised = instantiatePreset(withHands, 'surprised');
  assert.deepEqual(surprised.missing, []);
  assert.equal(surprised.controls.handLShow, 1, 'the pair comes out with the face');
  assert.equal(surprised.controls.handRShow, 1);
  assert.deepEqual([surprised.controls.handLX, surprised.controls.handRX], [-.35, .35], 'outward on each side');
  assert.equal(surprised.controls.handLY, -1, 'up');
  assert.equal(surprised.controls.handLSpread, 1);
  // One side only, when the face says so.
  const thinking = instantiatePreset(withHands, 'thinking');
  assert.equal(thinking.controls.handRShow, 1);
  assert.equal(thinking.controls.handRPinch, 1);
  assert.equal('handLShow' in thinking.controls, false, 'the left hand stays where it is');
  // A pose the pair does not have is simply not asked for.
  const cheeky = instantiatePreset(withHands, 'cheeky');
  assert.equal(cheeky.controls.handRThumbsUp, 1);
  // Without hands, the face alone -- and nothing about hands in what is missing.
  const bare = instantiatePreset(face, 'surprised');
  assert.deepEqual(Object.keys(bare.controls).filter((name) => name.startsWith('hand')), []);
  assert.deepEqual(bare.missing, [], 'a hand this project has not got is never reported as absent');
  assert.ok(EXPRESSION_PRESETS.filter((preset) => Object.keys(preset.hands || {}).length).length >= 15, 'most faces do something with their hands');
});
