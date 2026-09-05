import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, normalizeRigConstraints, solveRigConstraints } from '../../../runtime/runtime.js';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createConstraintCommands } from '../rig/constraint-commands.js';
import { CONSTRAINT_NEEDS_SOURCE, RIG_CONSTRAINT_TYPES, rigConstraintModel } from '../rig/constraint-model.js';
import { constraintChange } from '../../rig-editor/holding/constraint-section.js';
import { deriveSetupSections } from '../validation/setup-sections.js';

/**
 * Authoring a relationship (docs/FACE_CONTROL_RIG.md, §10, CR-25, CR-26).
 *
 * The solver could keep six relationships true and nothing in the editor could
 * write one: a rig you can run and cannot build. These are the commands that
 * write them, and the two things the panel gets from them — which fields a kind
 * is actually set by, and the order, which *is* the rule.
 */
function project() {
  const state = createCleanProjectState();
  state.elements = {
    hand: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, bindings: {} },
    head: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, bindings: {} }
  };
  state.params = { headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  state.states = { idle: { headX: 0 } };
  return state;
}

const commands = (state) => {
  const store = createEditorStore(state);
  return { store, run: createConstraintCommands(store, createHistory(store)) };
};

test('a relationship can be written, and one with nothing on the other end is refused', () => {
  const { store, run } = commands(project());
  const made = run.create('hand', 'parent', 'head');
  assert.equal(made.ok, true);
  assert.equal(made.id, 'hand-parent');
  assert.equal(store.getDocument().rigConstraints.length, 1);

  // Every kind that is *about* two pieces needs the second one. Storing it
  // without would store a rule that silently never fires, which is the worst
  // thing a rig can contain.
  for (const type of CONSTRAINT_NEEDS_SOURCE) {
    const refused = run.create('hand', type, null);
    assert.equal(refused.ok, false, type);
    assert.match(refused.message, /another piece of artwork/);
  }
  // And the two that are about the rig's own geometry do not ask for one.
  for (const type of RIG_CONSTRAINT_TYPES.filter((item) => !CONSTRAINT_NEEDS_SOURCE.includes(item))) {
    assert.equal(run.create('hand', type, null).ok, true, type);
  }
  assert.equal(run.create('nothing', 'axis').ok, false);
  assert.equal(run.create('hand', 'parent', 'hand').ok, false, 'and nothing is held to itself');
});

test('each kind shows the fields it is actually set by, and no others', () => {
  const { store, run } = commands(project());
  run.create('hand', 'parent', 'head');
  const model = () => rigConstraintModel(store.getDocument())[0];
  assert.deepEqual(model().fields, ['source', 'offset', 'copy']);
  assert.equal(model().label, 'Follow · move with another piece');

  // Changing the kind re-reads the record, so the new kind lands with every
  // field it needs already filled in rather than half a previous kind.
  assert.equal(run.configure(model().id, { type: 'limit' }).ok, true);
  assert.deepEqual(model().fields, ['limits']);
  assert.deepEqual(model().limits.y, [null, null], 'and no limit is no limit, not a limit of zero');
});

test('a limit an author leaves blank is no limit, and survives being written twice', () => {
  const { store, run } = commands(project());
  run.create('hand', 'limit');
  const model = () => rigConstraintModel(store.getDocument())[0];
  const set = (dataset, value) => run.configure(model().id, constraintChange(dataset, value, false, model()));

  set({ constraintField: 'limit', constraintChannel: 'y', constraintBound: 'max' }, '20');
  assert.deepEqual(model().limits.y, [null, 20]);
  // The frame agrees: a hand pushed past the bound comes back to it, and one
  // pushed the other way is not stopped by a bound nobody set.
  const frame = (y) => {
    const elements = { hand: { baseTransform: { x: 0, y, rotation: 0, scaleX: 1, scaleY: 1 }, bindings: {} } };
    return compileRigFrame(elements, {}, {}, {}, { rigConstraints: store.getDocument().rigConstraints }).hand.transform.y;
  };
  assert.equal(frame(80), 20);
  assert.equal(frame(-500), -500, 'nothing stops it going the other way');

  // Blanking it puts it back to no limit rather than to a limit of nothing --
  // the trap that pinned every unlimited channel to the origin.
  set({ constraintField: 'limit', constraintChannel: 'y', constraintBound: 'max' }, '');
  assert.deepEqual(model().limits.y, [null, null]);
  assert.equal(frame(80), 80);
});

test('the order is the rule, so every relationship can be moved through it', () => {
  const { store, run } = commands(project());
  run.create('hand', 'parent', 'head');
  run.create('hand', 'limit');
  const ids = () => store.getDocument().rigConstraints.map((item) => item.id);
  assert.deepEqual(ids(), ['hand-parent', 'hand-limit']);

  // Solved top to bottom, each reading the frame as the ones above it left it:
  // "follow the head, then never go past here" and "never go past here, then
  // follow the head" are different rigs, and only the order says which.
  assert.equal(run.reorder('hand-limit', 0).ok, true);
  assert.deepEqual(ids(), ['hand-limit', 'hand-parent']);
  assert.equal(run.reorder('hand-limit', -5).ok, true, 'and it stops at the ends rather than falling off them');
  assert.deepEqual(ids(), ['hand-limit', 'hand-parent']);
  assert.equal(run.reorder('nothing', 0).ok, false);

  // The solver reads the same list in the same order.
  const constraints = normalizeRigConstraints(store.getDocument());
  assert.deepEqual(constraints.map((item) => item.id), ids());
  assert.equal(solveRigConstraints(constraints, { hand: { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } } }), 1,
    'the parent has nothing to follow in this frame, and says so by doing nothing');
});

test('a relationship that is faded by a movement gets the movement, resting fully on', () => {
  const { store, run } = commands(project());
  run.create('hand', 'parent', 'head');
  assert.equal(run.configure('hand-parent', { weight: 'grabbing' }).ok, true);
  const document = store.getDocument();
  // Created with it, like a hold's contact, so an author has something to key
  // the moment they name one -- and resting at 1, because a relationship an
  // author has just written is one they mean.
  assert.equal(document.params.grabbing.default, 1);
  assert.equal(document.states.idle.grabbing, 1);
  assert.equal(rigConstraintModel(document)[0].weight, 'grabbing');

  // Undo puts the whole thing back, parameter and all: one command, one step.
  assert.equal(run.remove('hand-parent').ok, true);
  assert.deepEqual(store.getDocument().rigConstraints, []);
});

test('the setup heading counts the rules, so an advanced section says what is in it', () => {
  const state = project();
  const before = deriveSetupSections(state).find((section) => section.id === 'holding');
  assert.deepEqual([before.label, before.summary, before.state], ['Pins & holding', 'advanced', 'empty']);
  const { store, run } = commands(state);
  run.create('hand', 'parent', 'head');
  const after = deriveSetupSections(store.getDocument()).find((section) => section.id === 'holding');
  assert.deepEqual([after.summary, after.state], ['1 rule', 'ready']);
});
