import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createCleanProjectState } from '../state/store.js';
import { STARTER_KIT, buildStarterKit, createStarterKitCommands, starterKitDraft, starterKitSummary } from '../starter/starter-kit.js';
import { REACTION_PRESETS, REACTION_PRESET_GROUPS, instantiateReactionPreset, reactionPresetAvailabilityGroups } from '../reactions/reaction-presets.js';
import { reactionIssues } from '../reactions/reaction-model.js';
import { validateProject } from '../validation/validate-project.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const fullFace = () => ({
  headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1), eyeOpen: number(0, 1, 1),
  lookX: number(-1, 1), lookY: number(-1, 1), browRaise: number(-1, 1), browTilt: number(-1, 1),
  mouthOpen: number(0, 1), smile: number(-1, 1)
});
const project = (params = fullFace()) => ({
  ...createCleanProjectState(),
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>',
  params, expressions: [], animationClips: [], reactions: [], behaviors: [],
  states: { idle: Object.fromEntries(Object.keys(params).map((name) => [name, params[name].default])) }, activeState: 'idle',
  hands: { right: { element: 'handRight', poses: [{ id: 'wave', name: 'Wave' }] } }
});

test('the starter kit fills an empty mascot with faces, motions, reactions and life', () => {
  const document = project();
  const report = buildStarterKit(document);

  assert.equal(report.skipped, 0, 'a project with every movement can build the whole kit');
  assert.equal(report.added, STARTER_KIT.expressions.length + STARTER_KIT.motions.length + STARTER_KIT.reactions.length + STARTER_KIT.automatic.length);
  assert.deepEqual(document.expressions.map((item) => item.id), [...STARTER_KIT.expressions]);
  assert.deepEqual(document.animationClips.map((item) => item.motion.preset), [...STARTER_KIT.motions]);
  assert.deepEqual(document.reactions.map((item) => item.id), [...STARTER_KIT.reactions]);
  assert.equal(starterKitSummary(report), '8 faces, 6 motions, 4 reactions and 3 automatic behaviours');

  // Reactions resolve against what the same pass just created, and never
  // against something that does not exist.
  assert.deepEqual(reactionIssues(document), []);
  assert.equal(document.reactions.find((item) => item.id === 'greet').expression.id, 'happy');
  assert.deepEqual(document.reactions.find((item) => item.id === 'greet').gestures, [{ side: 'right', pose: 'wave', weight: 1 }]);
  assert.ok(document.behaviors.some((item) => item.type === 'blink' && item.enabled));
  // The fixture's hand is a stub, so only the domains the kit writes are checked.
  assert.deepEqual(validateProject(document).filter((item) => ['expressions', 'animation', 'reactions', 'states'].includes(item.domain)), [], 'the kit never leaves the project invalid');
});

test('the kit is idempotent, and skips what the project cannot do yet', () => {
  const document = project();
  buildStarterKit(document);
  const again = buildStarterKit(document);
  assert.equal(again.added, 0, 'pressing it twice adds nothing');
  assert.equal(again.present, STARTER_KIT.expressions.length + STARTER_KIT.motions.length + STARTER_KIT.reactions.length + STARTER_KIT.automatic.length);

  // A mouth-only project: the faces that need a mouth are built, everything
  // else is reported rather than half-created.
  const narrow = buildStarterKit(project({ smile: number(-1, 1), mouthOpen: number(0, 1) }));
  assert.ok(narrow.skipped > 0);
  assert.ok(narrow.entries.filter((item) => item.action === 'skip').every((item) => item.reason), 'a skip always says why');
  assert.deepEqual(narrow.entries.filter((item) => item.kind === 'automatic').map((item) => item.action), ['skip', 'skip', 'skip']);
  assert.equal(narrow.entries.find((item) => item.id === 'happy').action, 'add', 'a face keeps the movements the project does have');
});

test('the whole kit is one command and one undo step across four domains', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createStarterKitCommands(store, history);
  const before = store.getDomainRevisions();

  const plan = commands.plan();
  assert.equal(plan.added, 21);
  assert.deepEqual(store.getDocument().expressions, [], 'planning authors nothing');
  assert.equal(commands.plan(), plan, 'the plan is cached until the document changes');

  const report = commands.add();
  assert.equal(report.added, 21);
  const state = store.getDocument();
  assert.equal(state.expressions.length, 8);
  assert.equal(state.animationClips.length, 6);
  assert.equal(state.reactions.length, 4);
  for (const domain of ['expressions', 'animation', 'reactions', 'stateMachine']) assert.notEqual(store.getDomainRevisions()[domain], before[domain], `${domain} advanced`);

  history.undo();
  const undone = store.getDocument();
  assert.deepEqual([undone.expressions.length, undone.animationClips.length, undone.reactions.length, undone.behaviors.length], [0, 0, 0, 0], 'one undo removes all of it');

  // Nothing to add is not an edit: it must not push an empty step onto history.
  commands.add();
  const depth = store.getDocument().expressions.length;
  commands.add();
  assert.equal(store.getDocument().expressions.length, depth);
  history.undo();
  assert.deepEqual(store.getDocument().expressions, [], 'the no-op add left no extra history step');
});

test('the reaction catalogue covers every trigger and only names things it found', () => {
  const ids = REACTION_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length, 'preset ids are unique');
  assert.ok(ids.length >= 15, `only ${ids.length} reaction presets`);
  assert.deepEqual(REACTION_PRESETS.filter((preset) => !REACTION_PRESET_GROUPS.includes(preset.group)), []);
  assert.deepEqual([...new Set(REACTION_PRESETS.map((preset) => preset.trigger.type))].sort(), ['click', 'custom', 'hover', 'timer']);
  const groups = reactionPresetAvailabilityGroups({});
  assert.deepEqual(groups.map((entry) => entry.group), [...REACTION_PRESET_GROUPS]);
  assert.equal(groups.flatMap((entry) => entry.presets).length, REACTION_PRESETS.length);

  // A gesture is a list of candidates: the first pose a hand actually has wins,
  // and a preset never names a pose that is not there.
  const withWave = { expressions: [{ id: 'excited', name: 'Excited' }], animationClips: [{ id: 'bounce', name: 'Bounce' }], hands: { left: { poses: [{ id: 'wave', name: 'Wave' }] } } };
  assert.deepEqual(instantiateReactionPreset(withWave, 'cheer').gestures, [{ side: 'left', pose: 'wave' }]);
  const withThumb = { ...withWave, hands: { right: { poses: [{ id: 'thumbsUp', name: 'Thumbs Up' }, { id: 'wave', name: 'Wave' }] } } };
  assert.deepEqual(instantiateReactionPreset(withThumb, 'cheer').gestures, [{ side: 'right', pose: 'thumbsUp' }], 'the first candidate wins');
  const bare = instantiateReactionPreset({ ...withWave, hands: {} }, 'cheer');
  assert.deepEqual(bare.gestures, []);
  assert.deepEqual(bare.missing.map((item) => item.kind), ['gesture']);
  assert.equal(bare.usable, true, 'a missing gesture never blocks a reaction that already does something');
});

test('planning never touches the project it plans against', () => {
  const document = project();
  document.behaviors = [{ id: 'auto-blink', type: 'blink', name: 'Blink', parameter: 'eyeOpen', enabled: false }];
  const draft = starterKitDraft(document);
  buildStarterKit(draft);
  assert.deepEqual(document.expressions, []);
  assert.deepEqual(document.animationClips, []);
  assert.deepEqual(document.reactions, []);
  assert.equal(document.behaviors[0].enabled, false, 'a behavior the kit would re-enable is left alone');
  assert.equal(draft.behaviors[0].enabled, true, 'the draft carries the change instead');
});
