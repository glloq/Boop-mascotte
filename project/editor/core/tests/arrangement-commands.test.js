// VNX-29 — authoring an arrangement. One gesture is one undo step, the record
// still decides what a placement is, and a command that cannot name what it
// would change refuses instead of writing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { arrangementDuration, arrangementPlacements } from '../animation/arrangement.js';
import { arrangementPlacementId, createArrangementCommands } from '../animation/arrangement-commands.js';
import { findClipConflicts } from '../animation/clip-conflicts.js';

/** A clip that moves one parameter from `from` to `to` over its whole length. */
const ramp = (id, name, parameter, from, to, duration = 2) => ({
  id, name, duration, loop: false,
  tracks: { [parameter]: [{ time: 0, value: from, easing: 'linear' }, { time: duration, value: to, easing: 'linear' }] }
});
const wave = ramp('wave', 'Wave', 'handRX', -1, 1, 2);
const point = ramp('point', 'Point', 'handRX', 0.6, 0.6, 1);
const blink = ramp('blink', 'Blink', 'eyeOpen', 1, 0, 1);

function setup() {
  const initial = createCleanProjectState();
  initial.animationClips = [wave, point, blink];
  const store = createEditorStore(initial);
  const history = createHistory(store);
  return { store, history, commands: createArrangementCommands(store, history) };
}

const placements = (store) => store.getDocument().arrangement.placements;
const starts = (store) => placements(store).map((placement) => [placement.clipId, placement.start]);
/** Every gesture writes the arrangement domain and nothing else (VNX-05). */
const onlyArrangement = (before, after) => {
  for (const key of Object.keys(after)) assert.equal(after[key] - before[key], key === 'arrangement' ? 1 : 0, key);
};

test('each operation is one write, one undo step, and one step back', () => {
  const { store, history, commands } = setup();
  for (const gesture of [
    () => commands.place('wave', 0),
    () => commands.place('blink', 1.5),
    () => commands.move(placements(store)[0].id, 0.5),
    () => commands.remove(placements(store)[0].id),
    () => commands.clear()
  ]) {
    const revisions = store.getDomainRevisions();
    const result = gesture();
    assert.equal(result.ok, true);
    onlyArrangement(revisions, store.getDomainRevisions());
  }
  assert.deepEqual(starts(store), []);

  // Five gestures, five steps back, and the arrangement passes through exactly
  // the states the author saw on the way there.
  for (const expected of [[['blink', 1.5]], [['wave', 0.5], ['blink', 1.5]], [['wave', 0], ['blink', 1.5]], [['wave', 0]], []]) {
    history.undo();
    assert.deepEqual(starts(store), expected);
  }
  assert.equal(history.getState().canUndo, false, 'and nothing else was recorded');
});

test('placing a clip the project does not have is refused, with a reason, and writes nothing', () => {
  const { store, history, commands } = setup();
  const revisions = store.getDomainRevisions();
  const refused = commands.place('nope', 1);
  assert.deepEqual(refused, { ok: false, reason: 'no-clip', message: 'That motion is not in the project.' });
  assert.deepEqual(store.getDomainRevisions(), revisions, 'a refusal is not a mutation');
  assert.equal(history.getState().canUndo, false, 'nor an entry in Undo');
  assert.deepEqual(starts(store), []);

  // Moving or removing a placement that is not there is the same kind of
  // mistake, and gets the same treatment.
  assert.deepEqual(commands.move('wave@7', 1).reason, 'no-placement');
  assert.deepEqual(commands.remove('wave@7').reason, 'no-placement');
  assert.deepEqual(commands.clear(), { ok: false, reason: 'empty', message: 'There is nothing arranged yet.' });
  assert.deepEqual(store.getDomainRevisions(), revisions);
  assert.equal(history.getState().canUndo, false);
});

test('removing one placement leaves the others exactly where they were', () => {
  const { store, commands } = setup();
  const first = commands.place('wave', 0), second = commands.place('blink', 1), third = commands.place('point', 2.5);
  assert.deepEqual(starts(store), [['wave', 0], ['blink', 1], ['point', 2.5]]);

  assert.deepEqual(commands.remove(second.id), { ok: true, id: second.id, changed: true });
  assert.deepEqual(starts(store), [['wave', 0], ['point', 2.5]]);
  assert.deepEqual(placements(store).map((placement) => placement.id), [first.id, third.id], 'and the survivors keep their identity');
  assert.equal(arrangementDuration(store.getDocument()), 3.5);
});

test('the same clip twice is two placements at two times and one at the same time', () => {
  const { store, history, commands } = setup();
  const first = commands.place('wave', 0), second = commands.place('wave', 1);
  assert.notEqual(first.id, second.id, 'two placements of one clip are told apart by id, not by clip');
  assert.deepEqual(starts(store), [['wave', 0], ['wave', 1]]);

  // The record dedupes — an author cannot see the difference between two
  // placements of one clip at one second, and neither can the runtime — so the
  // command path reports the placement that is already there and records
  // nothing. Undo is a list of changes, not of attempts.
  const steps = store.getDomainRevisions().arrangement;
  const again = commands.place('wave', 1);
  assert.deepEqual(again, { ok: true, id: second.id, changed: false });
  assert.deepEqual(starts(store), [['wave', 0], ['wave', 1]]);
  assert.equal(store.getDomainRevisions().arrangement, steps, 'a gesture that changes nothing is not an undo step');

  // Rounding is the record's: 1.0004 s is 1 s, and therefore the same placement.
  assert.deepEqual(commands.place('wave', 1.0004), { ok: true, id: second.id, changed: false });

  // Dragging one onto the other collapses them the same way, and the one the
  // author dragged is the survivor.
  assert.deepEqual(commands.move(first.id, 1), { ok: true, id: first.id, changed: true });
  assert.deepEqual(starts(store), [['wave', 1]]);
  assert.deepEqual(placements(store).map((placement) => placement.id), [first.id]);
  history.undo();
  assert.deepEqual(starts(store), [['wave', 0], ['wave', 1]], 'and the collapse is one step, like any other drag');

  // A negative drop is clamped rather than refused, again by the record.
  commands.move(second.id, -4);
  assert.deepEqual(starts(store), [['wave', 0]], 'dropped before zero it lands on zero, and onto the placement already there');
  assert.deepEqual(placements(store).map((placement) => placement.id), [second.id]);
});

test('ids are readable and never handed to a second placement while the first is still there', () => {
  const { commands, store } = setup();
  assert.equal(commands.place('wave', 0).id, 'wave@0');
  assert.equal(commands.place('wave', 1).id, 'wave@1');
  commands.remove('wave@0');
  assert.equal(commands.place('wave', 2).id, 'wave@0', 'the freed slot is reused, and it is free');
  assert.deepEqual(placements(store).map((placement) => placement.id).sort(), ['wave@0', 'wave@1']);
  assert.equal(arrangementPlacementId('wave', [{ id: 'wave@0' }, 'wave@1']), 'wave@2');
});

test('the arrangement is what the conflict report reads (VNX-32)', () => {
  const { store, commands } = setup();
  commands.place('wave', 0);
  const overlapping = commands.place('point', 0.4);

  // Two clips placed over each other on one movement: the placements the
  // timeline draws are exactly the placements the warning is computed from.
  const document = store.getDocument();
  const conflicts = findClipConflicts(document, { placements: arrangementPlacements(document) });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].parameter, 'handRX');
  assert.deepEqual(conflicts[0].clips.map((clip) => clip.name), ['Wave', 'Point']);
  assert.equal(conflicts[0].message, 'Wave and Point both change "Move left / right" on the right hand, from 0.4 s to 1.4 s.');

  // The same two clips, dragged apart, are not in conflict at all.
  commands.move(overlapping.id, 2.5);
  const apart = store.getDocument();
  assert.deepEqual(findClipConflicts(apart, { placements: arrangementPlacements(apart) }), []);

  // And a clip on another movement never was.
  commands.place('blink', 0.5);
  const separate = store.getDocument();
  assert.deepEqual(findClipConflicts(separate, { placements: arrangementPlacements(separate) }), []);
});
