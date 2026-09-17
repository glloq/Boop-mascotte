import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_LEVELS, BAR_ACTIONS, GESTURE_SURFACES, PIECE_ACTIONS, PIECE_ACTION_IDS,
  CONFIRM_AT, actionRefusal, deleteConfirmation, deleteMessage, gestureDepth, matchPieceKey,
  pieceAction, pieceActionsFor, takesGestures
} from '../../ui/piece-actions.js';
import { SURFACES } from '../../ui/task-router.js';

/**
 * The gestures of one piece (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §1, §4).
 *
 * The tests that matter here are the ones about *where* a gesture reaches. Every
 * action in this catalogue already had a working implementation; what was broken
 * was that Delete, Duplicate and the canvas menu each carried their own
 * `workspace === 'create'` test, so the screen built for a beginner was the one
 * screen where none of them answered.
 */

test('the catalogue is well formed: unique ids, known levels, five on the bar', () => {
  assert.equal(new Set(PIECE_ACTION_IDS).size, PIECE_ACTION_IDS.length, 'an id appears twice');
  for (const action of PIECE_ACTIONS) {
    assert.ok(ACTION_LEVELS.includes(action.level), `${action.id} has an unknown level`);
    assert.ok(action.label, `${action.id} has no label`);
    if (action.altLabel) assert.notEqual(action.altLabel, action.label, `${action.id}'s two labels are the same word`);
  }
  // Five, deliberately. It was six while *Replace…* was among them, and that
  // one offered the face library's other drawings for a part -- gone with the
  // Character Builder (V5-07).
  assert.equal(BAR_ACTIONS.length, 5, 'the canvas bar is five buttons, deliberately');
  assert.deepEqual(BAR_ACTIONS.map((action) => action.id),
    ['duplicate', 'flip-x', 'forward', 'backward', 'delete']);
  for (const action of BAR_ACTIONS) assert.ok(action.glyph, `${action.id} rides the canvas and needs a glyph`);
});

test('the surface that needed these gestures most is the one that takes them', () => {
  // The bug this module exists for was that `character` -- an editing surface,
  // and the one a beginner landed on -- had none of these gestures. That
  // surface is gone with the Character Builder (V5-07) and what it argued for
  // is now true of Artwork, which every author lands on instead.
  assert.equal(takesGestures('character'), false, 'the surface itself no longer exists');
  assert.equal(gestureDepth('hands'), 'simple', 'a hand is handled, so it never shows a rigging entry');
  assert.equal(gestureDepth('create'), 'advanced', 'the vector editor sees everything');
  assert.equal(gestureDepth('rig'), 'advanced', 'so does the screen where artwork is named');
  // Preview is a test bench: a delete there would be a trap.
  assert.equal(takesGestures('preview'), false);
  for (const surface of ['expressions', 'animate', 'reactions']) {
    assert.equal(takesGestures(surface), false, `${surface} edits no artwork`);
  }
  for (const surface of Object.keys(GESTURE_SURFACES)) {
    assert.ok(SURFACES.includes(surface), `${surface} is not a surface the shell mounts`);
  }
  assert.equal(takesGestures(undefined), false);
  assert.equal(gestureDepth('nonsense'), null);
});

test('a simple surface offers the everyday gestures and none of the rigging ones', () => {
  const simple = pieceActionsFor({ path: true, shape: true, clip: true }, 'simple');
  const ids = simple.map((action) => action.id);
  assert.deepEqual(ids, ['duplicate', 'flip-x', 'forward', 'backward', 'delete']);
  for (const id of ['points', 'pin', 'to-path', 'release-clip', 'part']) {
    assert.ok(!ids.includes(id), `${id} names a rigging concept and must not reach a simple menu`);
  }
});

test('the full surface offers the rigging entries, but only where they apply', () => {
  const onAPath = pieceActionsFor({ path: true, part: true }, 'advanced').map((action) => action.id);
  assert.ok(onAPath.includes('points'), 'a path can be node-edited');
  assert.ok(onAPath.includes('pin'), 'and pinned');
  assert.ok(!onAPath.includes('to-path'), 'it is already a path');
  assert.ok(!onAPath.includes('release-clip'), 'nothing is cutting it');

  const onARect = pieceActionsFor({ shape: true, clip: { clipId: 'cut-1' } }, 'advanced').map((action) => action.id);
  assert.ok(onARect.includes('to-path'), 'a primitive can become one');
  assert.ok(onARect.includes('release-clip'), 'and something is cutting it');
  assert.ok(!onARect.includes('points'), 'but it has no points yet');
});

test('the two library gestures are gone, and nothing is left asking about a row', () => {
  // *Replace…* offered the library's other drawings for a part and *Reset
  // position* put one back where its fit had placed it. Both opened the
  // Character Builder, and a piece of a V5 mascot is a file somebody made --
  // the editor has no other drawing of it to offer (V5-07).
  for (const piece of [{ row: true, library: false }, { row: true, library: true }, {}]) {
    const ids = pieceActionsFor(piece, 'advanced').map((action) => action.id);
    assert.ok(!ids.includes('replace'));
    assert.ok(!ids.includes('reset-position'));
    assert.ok(ids.includes('delete'), 'every unlocked piece is still a piece, and still deletable');
  }
  // And the catalogue no longer asks a piece anything only the library knew.
  for (const action of PIECE_ACTIONS) assert.ok(!['row', 'library'].includes(action.needs), `${action.id} still needs ${action.needs}`);
});

test('a locked piece offers exactly one thing: unlocking it', () => {
  const actions = pieceActionsFor({ locked: true, path: true }, 'advanced');
  assert.deepEqual(actions.map((action) => action.id), ['lock']);
  assert.equal(actions[0].label, 'Unlock');
});

test('the three toggles say the state they lead to, not the one they are in', () => {
  const hidden = pieceActionsFor({ visible: false }, 'more').find((action) => action.id === 'visibility');
  assert.equal(hidden.label, 'Show');
  const shown = pieceActionsFor({ visible: true }, 'more').find((action) => action.id === 'visibility');
  assert.equal(shown.label, 'Hide');
  assert.equal(pieceActionsFor({ isolated: true }, 'more').find((action) => action.id === 'isolate').label, 'Stop isolating');
  assert.equal(pieceActionsFor({ isolated: false }, 'more').find((action) => action.id === 'isolate').label, 'Isolate');
  assert.equal(pieceActionsFor({ part: null }, 'advanced').find((action) => action.id === 'part').label, 'Assign to a face part');
  assert.equal(pieceActionsFor({ part: { id: 'eyes' } }, 'advanced').find((action) => action.id === 'part').label, 'Open its face part');
});

test('a key press names one action, and the keys that belong to something else name none', () => {
  assert.equal(matchPieceKey({ key: 'Delete' }), 'delete');
  assert.equal(matchPieceKey({ key: 'Backspace' }), 'delete');
  assert.equal(matchPieceKey({ key: 'd', ctrlKey: true }), 'duplicate');
  assert.equal(matchPieceKey({ key: 'D', metaKey: true }), 'duplicate', 'the shift-less capital a Mac sends');
  assert.equal(matchPieceKey({ key: ']' }), 'forward');
  assert.equal(matchPieceKey({ key: '[' }), 'backward');
  assert.equal(matchPieceKey({ key: ']', ctrlKey: true, shiftKey: true }), 'front');
  assert.equal(matchPieceKey({ key: '[', metaKey: true, shiftKey: true }), 'back');
  // A brace is what Shift+bracket sends on several layouts.
  assert.equal(matchPieceKey({ key: '}', ctrlKey: true, shiftKey: true }), 'front');
  // And the ones that are somebody else's.
  assert.equal(matchPieceKey({ key: 'z', ctrlKey: true }), null, 'undo');
  assert.equal(matchPieceKey({ key: 'd', ctrlKey: true, shiftKey: true }), null);
  assert.equal(matchPieceKey({ key: 'r' }), null, 'the Rectangle tool');
  assert.equal(matchPieceKey({ key: 'ArrowLeft' }), null, 'nudging');
  assert.equal(matchPieceKey(null), null);
});

test('one easily undone delete asks nothing; the three hard-to-picture ones ask', () => {
  assert.equal(deleteConfirmation({ count: 1 }).confirm, false, 'the default is to act and offer Undo');
  // The question is not "is this a lot?" but "can they see what they are
  // losing?". Four shapes inside a marquee they just drew: yes.
  for (const count of [2, 3, 4]) assert.equal(deleteConfirmation({ count }).confirm, false, `${count} is still a thing you can see`);
  assert.equal(deleteConfirmation().confirm, false);

  const many = deleteConfirmation({ count: 8 });
  assert.ok(many.confirm);
  assert.match(many.question, /8 pieces/);
  assert.match(many.detail, /one undo/i);
  assert.equal(deleteConfirmation({ count: CONFIRM_AT }).confirm, true, 'five is where a marquee stops being countable');

  // A small selection that carries the rig asks anyway: lassoing the eyes and
  // the mouth is four movements, whatever the piece count says.
  const rigged = deleteConfirmation({ count: 2, roles: 4 });
  assert.ok(rigged.confirm);
  assert.match(rigged.question, /2 pieces, and the 4 movements they play/);

  const host = deleteConfirmation({ count: 1, hosted: 1 });
  assert.ok(host.confirm, 'what hangs on a piece comes off with it');
  assert.match(host.question, /piece on it/);

  const rig = deleteConfirmation({ count: 1, roles: 3 });
  assert.ok(rig.confirm);
  assert.match(rig.question, /3 movements/);
  assert.equal(deleteConfirmation({ count: 1, roles: 1 }).confirm, false, 'one role is not a structure');
});

test('the toast names the piece and offers the button the message used to only describe', () => {
  const one = deleteMessage({ label: 'Left eye' });
  assert.equal(one.message, 'Left eye deleted.');
  assert.equal(one.action, 'Undo');
  assert.ok(!/ctrl/i.test(one.message), 'the button is right there, and a phone has no Ctrl key');

  assert.equal(deleteMessage({ label: 'Glasses', hosted: 2 }).message, 'Glasses deleted, with what hung on it.');
  assert.equal(deleteMessage({ count: 5 }).message, '5 pieces deleted.');
  assert.equal(deleteMessage().message, 'It deleted.');
});

test('a refusal says the thing the author can act on', () => {
  assert.match(actionRefusal('delete', { locked: true }), /locked/i);
  assert.match(actionRefusal('forward', { room: false }), /front of its group/);
  assert.match(actionRefusal('back', { room: false }), /back of its group/);
  assert.equal(actionRefusal('duplicate', {}), '', 'nothing to say when it simply works');
  assert.equal(actionRefusal('forward', { room: true }), '');
});

test('every action the catalogue declares is either on the bar or reachable in a menu', () => {
  // The rule of UIR-00, applied to gestures: nothing may lose its door.
  const reachable = new Set([
    ...BAR_ACTIONS.map((action) => action.id),
    ...pieceActionsFor({ row: true, library: true, path: true, visible: true }, 'advanced').map((action) => action.id),
    ...pieceActionsFor({ shape: true, clip: true, visible: true }, 'advanced').map((action) => action.id),
    ...pieceActionsFor({ locked: true }, 'advanced').map((action) => action.id)
  ]);
  for (const id of PIECE_ACTION_IDS) assert.ok(reachable.has(id), `${id} has no door`);
  assert.equal(pieceAction('delete').danger, true, 'Delete is the one that is marked');
  assert.equal(pieceAction('nonsense'), null);
});
