/**
 * A row sorted by the character being made (UI-REDESIGN-04,
 * docs/REDESIGN_UI_2026-09/04_COMPATIBILITE.md §D).
 *
 * The filtering itself is MASC-04's and was already right; the search field and
 * the way past the kind of face are the panel's, and `part-browser.js` holds
 * them. What `assetsFor` gained is one argument, and the rule it obeys is the
 * difference between an aid and a cage: **`affinity` sorts, and never removes a
 * single drawing.**
 *
 * A fox is tagged `fox`, `vulpine`, `animal`, and the ears drawn for one carry
 * the same words — so the fox's ears come first in the Ears row without anything
 * having been written down about ears.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetsFor } from '../face-library/compatibility.js';

const ids = (list) => list.map((item) => item.card.id);

test('a character\'s own words sort its row, and hide nothing', () => {
  const plain = assetsFor({ slot: 'ears', morphology: 'muzzle' });
  const forAFox = assetsFor({ slot: 'ears', morphology: 'muzzle', affinity: ['fox', 'vulpine', 'animal'] });
  assert.equal(forAFox.length, plain.length, 'affinity sorts; a suggestion that hid the rest would be a filter');
  assert.deepEqual([...ids(forAFox)].sort(), [...ids(plain)].sort());
  assert.equal(forAFox[0].card.id, 'ears.fox-large-pointed', 'the fox\'s own ears come first');
  assert.ok(forAFox[0].affinity > 0);

  // Descending, and the library's own order inside a tie: an author who learns
  // where a card sits should find it there.
  const scores = forAFox.map((item) => item.affinity);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  const untouched = plain.filter((item) => !item.card.tags?.some((tag) => ['fox', 'vulpine', 'animal'].includes(tag)));
  assert.deepEqual(forAFox.filter((item) => !item.affinity).map((item) => item.card.id), ids(untouched),
    'and everything the words say nothing about keeps the order it had');

  // Words nobody drew for change nothing at all.
  assert.deepEqual(ids(assetsFor({ slot: 'ears', morphology: 'muzzle', affinity: ['zzz'] })), ids(plain));
});

test('the old call still answers exactly as it did', () => {
  // The argument is optional and the shape grew rather than changed: `card`,
  // `drawing` and `restyled` are where they were, and a caller that asks for no
  // affinity gets the library's own order with every score at zero.
  const before = assetsFor({ slot: 'eyes', morphology: 'human' });
  assert.ok(before.length > 0);
  for (const item of before) {
    assert.deepEqual(Object.keys(item).sort(), ['affinity', 'card', 'drawing', 'restyled']);
    assert.equal(item.affinity, 0);
  }
});
