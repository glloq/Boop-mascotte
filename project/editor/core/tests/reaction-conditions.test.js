import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createReactionCommands } from '../reactions/reaction-commands.js';
import { createExportRig } from '../export/export-rig.js';
import { describeConditions, reactionIssues } from '../reactions/reaction-model.js';
import { CONDITION_REQUIREMENT, conditionsHold, describeCondition, normalizeCondition, normalizeConditions } from '../../../runtime/reaction-conditions.js';
import { RUNTIME_FEATURES, createReactionController, normalizeReactions, rigRequirements, unsupportedRequirements } from '../../../runtime/runtime.js';

/**
 * The **IF** of `WHEN → IF → DO` (V4-090, docs/V4_ROADMAP.md Phase 9).
 *
 * Two rules decide everything here, and both are about what an author gets when
 * they are not looking:
 *
 * 1. **A condition narrows a reaction; it never repairs one.** A row nobody can
 *    read is dropped by the runtime and refused by the command, because the
 *    alternative is evaluating a guess about when somebody wanted their mascot
 *    to act.
 * 2. **A condition is not safely additive.** A runtime that does not know about
 *    one does not skip the reaction — it fires it unconditionally, which is the
 *    reaction behaving as something else. That is VNX-39, so a rig with a
 *    condition asks for `reaction:condition` by name.
 */

const condition = (extra = {}) => ({ kind: 'parameter', parameter: 'smile', operator: '>=', value: .5, ...extra });

test('a condition is read or dropped, never repaired', () => {
  assert.deepEqual(normalizeCondition(condition()), { kind: 'parameter', parameter: 'smile', operator: '>=', value: .5 });
  // An operator nobody has is the one thing that *is* filled in: ">=" is the
  // condition an author writing "only when this is up" means, and the row is
  // otherwise complete. Everything else the row is *made of* has no default.
  assert.equal(normalizeCondition({ kind: 'parameter', parameter: 'smile', operator: '≥' }).operator, '>=');
  assert.equal(normalizeCondition({ kind: 'parameter', parameter: 'smile' }).value, 0);
  for (const junk of [null, 'smile > 1', {}, { kind: 'expression', source: 'smile > 1' }, { kind: 'parameter', parameter: '  ' }, { kind: 'state', state: '' }]) {
    assert.equal(normalizeCondition(junk), null, `${JSON.stringify(junk)} is not a condition`);
  }
  // A state row carries no number, and the only two comparisons it has are the
  // two a state can answer.
  assert.deepEqual(normalizeCondition({ kind: 'state', state: ' sleeping ', operator: '>' }), { kind: 'state', state: 'sleeping', operator: '==' });
  assert.deepEqual(normalizeCondition({ kind: 'state', state: 'sleeping', operator: '!=' }), { kind: 'state', state: 'sleeping', operator: '!=' });
  // A list keeps what it can read and drops the rest, rather than failing whole:
  // one unreadable row in a file written elsewhere must not cost the mascot its
  // other conditions.
  assert.deepEqual(normalizeConditions([condition(), 'junk', null, { kind: 'state', state: 'idle' }]).map((item) => item.kind), ['parameter', 'state']);
  assert.deepEqual(normalizeConditions('everything'), []);
});

test('every condition holds, or the reaction is not this one', () => {
  // No conditions is true. This is the line that keeps every reaction written
  // before V4-090 behaving exactly as it did.
  assert.equal(conditionsHold([], { params: {} }), true);
  assert.equal(conditionsHold(undefined, {}), true);

  const situation = { params: { smile: .8, eyeOpen: 0 }, state: 'idle' };
  for (const [operator, value, expected] of [['>=', .8, true], ['>=', .9, false], ['<=', .8, true], ['>', .8, false], ['<', .9, true], ['==', .8, true], ['!=', .8, false]]) {
    assert.equal(conditionsHold([condition({ operator, value })], situation), expected, `smile ${operator} ${value}`);
  }
  // A parameter the situation has no value for reads as 0 rather than throwing:
  // the runtime is mid-frame, and a missing movement is one that has not moved.
  assert.equal(conditionsHold([condition({ parameter: 'headTilt', operator: '==', value: 0 })], situation), true);

  // Every, not any: an author listing two things is describing one situation,
  // and "or" is two reactions.
  assert.equal(conditionsHold([condition(), condition({ parameter: 'eyeOpen', operator: '<=', value: .1 })], situation), true);
  assert.equal(conditionsHold([condition(), condition({ parameter: 'eyeOpen', operator: '>=', value: .5 })], situation), false);

  assert.equal(conditionsHold([{ kind: 'state', state: 'idle', operator: '==' }], situation), true);
  assert.equal(conditionsHold([{ kind: 'state', state: 'sleeping', operator: '==' }], situation), false);
  assert.equal(conditionsHold([{ kind: 'state', state: 'sleeping', operator: '!=' }], situation), true);
  // No state at all is a mascot that is in no state, which is not `sleeping`.
  assert.equal(conditionsHold([{ kind: 'state', state: 'sleeping', operator: '!=' }], { params: {} }), true);
});

test('a condition reads back as the sentence an author wrote', () => {
  assert.equal(describeCondition(normalizeCondition(condition())), 'smile is at least 0.5');
  assert.equal(describeCondition(normalizeCondition({ kind: 'state', state: 'sleeping', operator: '!=' })), 'the mascot is not in sleeping');
  assert.equal(describeCondition(null), '');
  assert.equal(describeConditions([]), '', 'a reaction with no conditions has no clause at all');
  assert.equal(describeConditions(normalizeConditions([condition(), { kind: 'state', state: 'idle' }])), 'only if smile is at least 0.5 and the mascot is in idle');
});

// ---------------------------------------------------------------------------
// WHEN, then IF: what the dispatcher does with one
// ---------------------------------------------------------------------------

const reaction = (extra = {}) => ({ id: 'wave', name: 'Wave', trigger: { type: 'click' }, expression: { id: 'happy', weight: 1 }, timing: 'fast', ...extra });

test('a reaction whose conditions do not hold is not an error, it is not this one', () => {
  let situation = { params: { smile: 0 }, state: 'idle' };
  const reactions = normalizeReactions({ reactions: [
    reaction({ id: 'grin', priority: 2, conditions: [condition()] }),
    reaction({ id: 'shrug', priority: 1 })
  ] });
  const controller = createReactionController(() => ({ reactions, clips: [] }), { context: () => situation });

  // The higher-priority reaction wants a smile and there is none, so the next
  // candidate gets its turn — the click is answered, by the other one.
  assert.equal(controller.trigger('click', 0), 'shrug');
  controller.reset();
  situation = { params: { smile: 1 }, state: 'idle' };
  assert.equal(controller.trigger('click', 0), 'grin', 'and with the smile, the one that asked for it wins');
});

test('the situation is read at the moment of the trigger, not when the controller was made', () => {
  let state = 'idle';
  const reactions = normalizeReactions({ reactions: [reaction({ conditions: [{ kind: 'state', state: 'sleeping' }] })] });
  const controller = createReactionController(() => ({ reactions, clips: [] }), { context: () => ({ params: {}, state }) });
  assert.equal(controller.trigger('click', 0), null);
  state = 'sleeping';
  assert.equal(controller.trigger('click', 1), 'wave', 'a condition is about now');
});

test('a controller with no context behaves as one that never had conditions', () => {
  // The default context is `{}`, which reads every parameter as 0 and the state
  // as none. A reaction with no conditions is untouched by any of it — which is
  // what every call site written before V4-090 relies on.
  const reactions = normalizeReactions({ reactions: [reaction()] });
  assert.equal(createReactionController(() => ({ reactions, clips: [] })).trigger('click', 0), 'wave');
});

// ---------------------------------------------------------------------------
// Declining beats mis-firing
// ---------------------------------------------------------------------------

test('a rig with a condition asks for it by name', () => {
  assert.ok(RUNTIME_FEATURES.includes(CONDITION_REQUIREMENT), 'this build has them');
  assert.deepEqual(rigRequirements({ reactions: [reaction()] }), [], 'and a rig without one asks for nothing');
  assert.deepEqual(rigRequirements({ reactions: [reaction({ conditions: [condition()] })] }), [CONDITION_REQUIREMENT]);
  // A condition nobody can read is not a condition, so it is not a requirement
  // either: the runtime would drop the row, and a rig must not be declined over
  // a feature it does not end up using.
  assert.deepEqual(rigRequirements({ reactions: [reaction({ conditions: ['smile > 1'] })] }), []);
  assert.deepEqual(unsupportedRequirements({ requires: [CONDITION_REQUIREMENT] }), [], 'this build runs it');
  assert.deepEqual(unsupportedRequirements({ requires: ['reaction:script'] }), ['reaction:script'], 'and declines by name what it cannot');
});

// ---------------------------------------------------------------------------
// What the editor writes, and refuses to write
// ---------------------------------------------------------------------------

const project = () => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>',
  elements: {}, layers: [], layerMetadata: {}, semanticParts: {},
  params: { smile: { type: 'number', min: -1, max: 1, default: 0, value: 0 } },
  states: { idle: {} }, activeState: 'idle', transitions: {},
  animationClips: [], behaviors: [], expressions: [{ id: 'happy', name: 'Happy', controls: { smile: 1 }, source: 'manual' }], reactions: []
});

const editor = () => {
  const store = createEditorStore(project()), history = createHistory(store);
  return { store, history, commands: createReactionCommands(store, history) };
};

test('conditions are authored, undone and exported like anything else a reaction carries', () => {
  const { store, history, commands } = editor();
  const id = commands.create({ name: 'Wave', expressionId: 'happy' });
  assert.deepEqual(store.getDocument().reactions[0].conditions, [], 'a new reaction has none');

  commands.update(id, { conditions: [condition()] });
  assert.deepEqual(store.getDocument().reactions[0].conditions, [{ kind: 'parameter', parameter: 'smile', operator: '>=', value: .5 }]);
  // One edit, one history step, and the reaction comes back without it.
  history.undo();
  assert.deepEqual(store.getDocument().reactions[0].conditions, []);
  history.redo();
  assert.equal(store.getDocument().reactions[0].conditions.length, 1);

  // Duplicating copies the whole reaction, the IF included.
  const copy = commands.duplicate(id);
  assert.deepEqual(store.getDocument().reactions.find((item) => item.id === copy).conditions, store.getDocument().reactions[0].conditions);

  // And the exported rig carries both the condition and the name of what it
  // needs, so a page loading it with an older runtime is told rather than shown
  // a mascot that reacts to everything.
  const rig = createExportRig(store.getDocument());
  assert.deepEqual(rig.reactions[0].conditions, [{ kind: 'parameter', parameter: 'smile', operator: '>=', value: .5 }]);
  assert.deepEqual(rig.requires, [CONDITION_REQUIREMENT]);
});

test('a half-filled condition is refused where it is typed, not dropped under the pointer', () => {
  const { store, commands } = editor();
  const id = commands.create({ name: 'Wave', expressionId: 'happy' });
  assert.throws(() => commands.update(id, { conditions: [{ kind: 'parameter', parameter: '' }] }), /Condition 1 has no movement to test/);
  assert.throws(() => commands.update(id, { conditions: [condition(), { kind: 'state', state: '' }] }), /Condition 2 has no state to test/);
  // Preflight: the refusal left neither the document nor the history touched.
  assert.deepEqual(store.getDocument().reactions[0].conditions, []);
});

test('a condition the mascot has no way to satisfy is reported as a reaction that never runs', () => {
  const { store, commands } = editor();
  const id = commands.create({ name: 'Wave', expressionId: 'happy', conditions: [condition()] });
  assert.deepEqual(reactionIssues(store.getDocument()), [], 'the movement exists, so there is nothing to report');

  commands.update(id, { conditions: [condition({ parameter: 'earWiggle' })] });
  assert.equal(reactionIssues(store.getDocument())[0].unknownCondition.parameter, 'earWiggle');
  commands.update(id, { conditions: [{ kind: 'state', state: 'sleeping' }] });
  assert.equal(reactionIssues(store.getDocument())[0].unknownCondition.state, 'sleeping');
  commands.update(id, { conditions: [{ kind: 'state', state: 'idle' }] });
  assert.deepEqual(reactionIssues(store.getDocument()), [], 'and a state it has is not an issue');
});
