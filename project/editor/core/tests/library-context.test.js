/**
 * The parts library follows the selection (UX-50 PR 7).
 *
 * Two rules, and the second one is the one that keeps the first honest:
 *
 * 1. the cards are for the part the author has in hand;
 * 2. nothing is hidden without a way back — `Show all` restores the drawings
 *    the compatibility filter held back, and a drawing that merely *costs* a
 *    movement is sorted down and badged, never removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { faceLibraryModel, libraryCards } from '../face-library/face-library-model.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';

const state = () => createTemplateProjectState();

test('the cards are for the part in hand, not for whatever the panel opened on', () => {
  // The bug: it opened on Eyes and stayed. An author with a mouth selected was
  // shown eyes and had to find the Mouth tab by eye.
  const mouth = faceLibraryModel(state(), { subject: 'mouth' });
  assert.equal(mouth.active, 'mouth');
  assert.equal(mouth.following, true);
  assert.ok(mouth.cards.length, 'and it has mouths in it');
  const ears = faceLibraryModel(state(), { subject: 'ears' });
  assert.equal(ears.active, 'ears');
});

test('a pressed tab outranks the selection, and says it is no longer following', () => {
  const view = faceLibraryModel(state(), { subject: 'mouth', category: 'eyes' });
  assert.equal(view.active, 'eyes', 'the press wins');
  assert.equal(view.following, false, 'and the panel stops claiming to follow the selection');
});

test('with nothing selected the library opens where it always opened', () => {
  // Following the selection is not a reason to move the landing an author
  // already knows: with nothing in hand and no tab pressed, it is still Eyes.
  const view = faceLibraryModel(state(), {});
  assert.equal(view.active, 'eyes');
  assert.equal(view.following, false);
  assert.ok(view.cards.length, 'and it is one with drawings in it');
});

test('a selection naming a part the library has no drawings for falls back rather than emptying', () => {
  // There are no jaws in the library. Following it literally would be a panel
  // showing nothing at all, which is worse than showing the wrong thing.
  const view = faceLibraryModel(state(), { subject: 'jaw' });
  assert.ok(view.active, 'it lands on a real category');
  assert.ok(view.cards.length, 'with drawings in it');
  assert.equal(view.following, false, 'and does not pretend it followed');
});

test('a drawing says what it would cost this face before it is pressed', () => {
  // The install reported what it had switched off *afterwards*, which is the
  // wrong end of the decision. The template mouth uses all six of its
  // movements; most library mouths carry three.
  const cards = libraryCards(state(), 'mouth');
  const full = cards.find((card) => card.id === 'mouth.full');
  assert.ok(full, 'the template wears the full mouth');
  assert.deepEqual(full.loses, [], 'and the drawing it wears costs it nothing');

  const limited = cards.find((card) => card.loses.length);
  assert.ok(limited, 'some drawings carry fewer movements');
  assert.ok(limited.loses.every((control) => !limited.supports.includes(control)),
    'what it loses is exactly what it cannot carry');
});

test('what a drawing costs is measured against this face, not against the part in the abstract', () => {
  // A mouth that never rounds loses nothing by wearing a drawing that cannot
  // round. The warning has to be about the mascot in front of the author.
  const plain = state();
  const mouth = Object.values(plain.semanticParts).find((part) => part.type === 'mouth');
  mouth.controls = ['mouthOpen', 'smile'];
  for (const card of libraryCards(plain, 'mouth')) {
    assert.ok(card.loses.every((control) => mouth.controls.includes(control)),
      `${card.id} only warns about movements this face is using`);
  }
});

test('compatible drawings come first, and nothing else reorders the shelf', () => {
  // The order the library authors is the order an author learns, and the
  // affinity sort already speaks for the character being made
  // (`masc07b-library-filtering.test.js`). Compatibility is the one thing this
  // adds to it; what a drawing *costs* is said on the drawing instead, so the
  // row does not move under the hand reaching for it.
  const cards = faceLibraryModel(state(), { category: 'mouth', showAll: true }).cards;
  const rank = cards.map((card) => Number(!card.compatible));
  assert.deepEqual(rank, [...rank].sort((a, b) => a - b), 'compatible first');
  const authored = libraryCards(state(), 'mouth').filter((card) => card.compatible).map((card) => card.id);
  assert.deepEqual(cards.filter((card) => card.compatible).map((card) => card.id), authored,
    'and within the compatible ones, the library\u2019s own order is untouched');
});

test('Show all is a way back, and a lossy drawing was never taken away', () => {
  const shown = faceLibraryModel(state(), { category: 'mouth' });
  const all = faceLibraryModel(state(), { category: 'mouth', showAll: true });
  assert.equal(shown.cards.length + shown.filtered, all.cards.length,
    'the filter can account for every drawing it is not showing');
  // Badging is not removing: a drawing that costs a movement stays where the
  // library put it and stays choosable, because an author may well want the
  // drawing more than the movement.
  assert.ok(shown.cards.some((card) => card.loses.length),
    'drawings with limited animation are still offered by default');
});
