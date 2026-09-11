import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createBehaviorCommands } from '../../animation-editor/behaviors/behavior-commands.js';
import { BEHAVIOR_CATALOG, BEHAVIOR_TITLES, renderBehaviorCatalog } from '../../animation-editor/behaviors/behavior-catalog.js';
import { renderBehaviorInspector } from '../../animation-editor/behaviors/behavior-inspector.js';
import { validateRig } from '../validation/rig-validator.js';
import { BEHAVIOR_TYPES } from '../../../runtime/runtime.js';

/**
 * The advanced Behaviors panel offers every behaviour the runtime has (V3-10).
 *
 * `drift` is the V2 idle primitive (`docs/BEHAVIORS.md`): the runtime schedules
 * it, the rig validator has rules for it, the Automatic presets ship two built
 * from it, and the inspector would happily have edited one. The catalogue and
 * the add allow-list were the two tables it never reached, so the only drift a
 * project could own was one a preset had put there — it could be listed and
 * tuned and never *added*.
 *
 * These pin the round trip rather than the wording: a type the runtime knows is
 * a card, a card is a type the commands accept, and what the commands then
 * create is a behaviour the validator is happy with and the inspector can edit
 * down to its last field. A fifth type added to one table and not the others
 * fails here rather than a release later.
 */

const rigged = () => {
  const initial = createCleanProjectState();
  initial.params.lookX = { min: -1, max: 1, default: 0, value: 0 };
  initial.states = { idle: { lookX: 0 } };
  initial.transitions = { idle: [] };
  initial.activeState = 'idle';
  const store = createEditorStore(initial), history = createHistory(store);
  return { store, commands: createBehaviorCommands(store, history) };
};

test('every runtime behaviour type is a card, and every card can be added', () => {
  assert.deepEqual(BEHAVIOR_CATALOG.map((entry) => entry.type), [...BEHAVIOR_TYPES]);
  for (const entry of BEHAVIOR_CATALOG) {
    assert.ok(entry.title && entry.description, `${entry.type} says what it is`);
    assert.ok(BEHAVIOR_TITLES[entry.type], `${entry.type} has a name for once it exists`);
    assert.match(renderBehaviorCatalog(), new RegExp(`data-add-behavior="${entry.type}"`));
  }
  // The allow-list is the catalogue, so an offer is never refused.
  const { store, commands } = rigged();
  for (const type of BEHAVIOR_TYPES) assert.equal(commands.add(type).type, type);
  assert.deepEqual(store.getDocument().behaviors.map((item) => item.type), [...BEHAVIOR_TYPES]);
  assert.throws(() => commands.add('wobble'), /Unsupported Behavior type/);
});

test('a drift added from the catalogue is valid, named and editable to its last field', () => {
  const { store, commands } = rigged();
  const added = commands.add('drift');
  assert.equal(added.name, 'Drift');
  const index = store.getDocument().behaviors.findIndex((item) => item.id === added.id);
  commands.updateField(index, 'parameter', 'lookX');

  // Its own two settings reach the document as numbers, like every other
  // type's: without them in FIELDS a drift could only ever run at its defaults.
  commands.updateField(index, 'travelMin', '0.5');
  commands.updateField(index, 'travelMax', '1.4');
  const drift = store.getDocument().behaviors[index];
  assert.deepEqual([drift.travelMin, drift.travelMax], [0.5, 1.4]);
  assert.deepEqual(validateRig(store.getDocument()).filter((issue) => /drift/.test(issue)), [],
    'the defaults the catalogue creates already satisfy the validator');

  // And both settings are on screen, under the target picker every type shares.
  const inspector = renderBehaviorInspector(store.getDocument(), index);
  assert.match(inspector, /<h3>Drift<\/h3>/);
  for (const field of ['parameter', 'amplitude', 'travelMin', 'travelMax', 'intervalMin', 'intervalMax']) {
    assert.match(inspector, new RegExp(`data-behavior-field="${field}"`), `${field} is editable`);
  }
});

test('travel times typed the wrong way round are put back in order, as rests are', () => {
  const { store, commands } = rigged();
  const added = commands.add('drift');
  const index = store.getDocument().behaviors.findIndex((item) => item.id === added.id);
  commands.updateField(index, 'parameter', 'lookX');
  commands.updateField(index, 'travelMax', '0.4');
  commands.updateField(index, 'travelMin', '2');
  const drift = store.getDocument().behaviors[index];
  assert.ok(drift.travelMin <= drift.travelMax, `${drift.travelMin} … ${drift.travelMax}`);
  assert.deepEqual(validateRig(store.getDocument()).filter((issue) => /drift travel/.test(issue)), []);
});
