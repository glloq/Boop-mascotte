import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASCOT_PRESETS, mascotPresetById, mascotPresetStatus, mascotPresetOverview,
  assignedPartTypes, setupAssistantSteps
} from '../sample/mascot-presets.js';
import { AUTOMATIC_PRESETS } from '../behaviors/automatic-presets.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';

const part = (type, roles) => ({ type, roles });
const face = () => ({
  svgMarkup: '<svg/>',
  semanticParts: {
    head: part('head', { head: 'head' }), eyes: part('eyes', { leftEye: 'l' }),
    gaze: part('gaze', { leftPupil: 'p' }), brows: part('eyebrows', { leftBrow: 'b' }),
    mouth: part('mouth', { mouth: 'm' })
  },
  hands: null, keyforms: [], expressions: [], animationClips: [], reactions: [], behaviors: []
});
const withHands = (document) => ({ ...document, hands: { left: { element: 'handLeft' }, right: { element: 'handRight' } } });

test('the three presets go from a face to a whole character', () => {
  assert.deepEqual(MASCOT_PRESETS.map((preset) => preset.id), ['face-only', 'face-hands', 'full-cartoon']);
  assert.equal(MASCOT_PRESETS[0].hands, false);
  assert.equal(MASCOT_PRESETS[1].hands, true);
  assert.ok(MASCOT_PRESETS[2].parts.length > MASCOT_PRESETS[1].parts.length);
  assert.equal(mascotPresetById('nope'), null);
});

test('every preset names real part types and real idle behaviours', () => {
  const behaviours = new Set(AUTOMATIC_PRESETS.map((preset) => preset.id));
  for (const preset of MASCOT_PRESETS) {
    for (const type of preset.parts) assert.ok(SEMANTIC_PART_REGISTRY[type], `${preset.id} → ${type}`);
    for (const behaviour of preset.behaviors) assert.ok(behaviours.has(behaviour), `${preset.id} → ${behaviour}`);
  }
});

test('a part counts only once a role is actually assigned', () => {
  assert.deepEqual([...assignedPartTypes({ semanticParts: { a: part('eyes', {}) } })], []);
  assert.deepEqual([...assignedPartTypes({ semanticParts: { a: part('eyes', { leftEye: 'l' }) } })], ['eyes']);
});

test('a face project completes the face preset and is partway to the others', () => {
  const document = face();
  assert.equal(mascotPresetStatus(document, 'face-only').status, 'complete');
  const hands = mascotPresetStatus(document, 'face-hands');
  assert.equal(hands.status, 'partial');
  assert.deepEqual(hands.missing.map((item) => item.label), ['Left hand', 'Right hand']);
  assert.equal(hands.done, 5);
  assert.equal(hands.total, 7);
});

test('hands count from the hands block, not from a semantic part alone', () => {
  const withPartOnly = { ...face(), semanticParts: { ...face().semanticParts, lh: part('leftHand', { hand: 'handLeft' }) } };
  assert.ok(mascotPresetStatus(withPartOnly, 'face-hands').missing.some((item) => item.label === 'Left hand'));
  assert.ok(!mascotPresetStatus(withHands(face()), 'face-hands').missing.some((item) => item.label === 'Left hand'));
});

test('the overview picks the most ambitious preset that is finished', () => {
  const empty = mascotPresetOverview({ semanticParts: {} });
  assert.equal(empty.closest.id, 'face-only', 'an empty project is closest to the smallest preset');
  assert.equal(empty.presets.every((item) => item.status === 'empty'), true);
  assert.equal(mascotPresetOverview(face()).closest.id, 'face-only');
  assert.equal(mascotPresetOverview(withHands(face())).closest.id, 'face-hands');
});

test('the assistant walks the roadmap workflow in order', () => {
  const assistant = setupAssistantSteps({}, 'face-only');
  assert.deepEqual(assistant.steps.map((step) => step.id),
    ['import', 'parts', 'face', 'head-pose', 'hands', 'expressions', 'motions', 'reactions', 'preview', 'export']);
  assert.equal(assistant.total, 10);
  assert.equal(assistant.next.id, 'import');
  assert.equal(assistant.steps[0].current, true);
  assert.equal(assistant.steps[1].current, false, 'only one step is current');
});

test('the assistant says what to do next, not only what is missing', () => {
  const document = face();
  const assistant = setupAssistantSteps(document, 'face-only');
  assert.equal(assistant.next.id, 'head-pose');
  assert.match(assistant.next.text, /Capture at least one head position/);
  // import, parts, face, and hands — which this preset does not ask for.
  assert.equal(assistant.done, 4);
});

test('a preset without hands does not ask for hands', () => {
  const document = face();
  assert.equal(setupAssistantSteps(document, 'face-only').steps.find((step) => step.id === 'hands').done, true);
  assert.equal(setupAssistantSteps(document, 'face-hands').steps.find((step) => step.id === 'hands').done, false);
  assert.equal(setupAssistantSteps(withHands(document), 'face-hands').steps.find((step) => step.id === 'hands').done, true);
});

test('capturing a head pose advances the assistant', () => {
  const document = { ...face(), keyforms: [{ id: 'headPose:face:translateX' }] };
  assert.equal(setupAssistantSteps(document, 'face-only').next.id, 'expressions');
});

test('an unknown preset falls back to the smallest one rather than failing', () => {
  const assistant = setupAssistantSteps(face(), 'nope');
  assert.equal(assistant.preset.id, 'face-only');
});

test('export is the last step and never reports itself done', () => {
  const finished = {
    ...withHands(face()),
    keyforms: [{ id: 'headPose:face:translateX' }],
    expressions: [{ id: 'happy' }], animationClips: [{ id: 'wave' }],
    reactions: [{ id: 'hello' }], behaviors: [{ id: 'blink' }]
  };
  const assistant = setupAssistantSteps(finished, 'face-hands');
  assert.equal(assistant.done, 9);
  assert.equal(assistant.next.id, 'export');
  assert.equal(assistant.preset.status, 'complete');
});
