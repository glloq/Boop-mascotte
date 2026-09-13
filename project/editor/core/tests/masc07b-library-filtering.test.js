/**
 * The library, narrowed and widened on purpose (UI-REDESIGN-04,
 * docs/REDESIGN_UI_2026-09/04_COMPATIBILITE.md §D).
 *
 * The filtering itself is MASC-04's and was already right. What this covers is
 * the three things the interface needs on top of it, and the rule each one
 * obeys — because each rule is the difference between an aid and a cage:
 *
 * ```text
 * query               narrows, and two words narrow further rather than wider
 * includeIncompatible widens across kinds, and NEVER across slots
 * affinity            sorts, and never removes a single drawing
 * ```
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetsFor, matchesSearch, searchTerms } from '../face-library/compatibility.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { assetSlot } from '../face-library/face-morphologies.js';

const ids = (list) => list.map((item) => item.card.id);

test('a search reads a drawing\'s name, its description and the words it was tagged with', () => {
  assert.deepEqual(searchTerms(' Cat,  pointed/ '), ['cat', 'pointed']);
  assert.deepEqual(searchTerms(''), []);
  const tagged = FACE_PART_LIBRARY.get('ears.cat-pointed');
  assert.ok(matchesSearch(tagged, ['cat']), 'by a tag');
  assert.ok(matchesSearch(tagged, ['pointed']), 'by a word of its name');
  assert.ok(matchesSearch(tagged, []), 'and everything matches nothing typed');

  // Two words narrow: somebody typing a second one is asking for less, not more.
  const pointed = ids(assetsFor({ slot: 'ears', query: 'pointed' }));
  const catPointed = ids(assetsFor({ slot: 'ears', query: 'cat pointed' }));
  assert.ok(pointed.length > catPointed.length);
  assert.deepEqual(catPointed, ['ears.cat-pointed']);
  assert.deepEqual(ids(assetsFor({ slot: 'ears', query: 'zzz' })), [], 'and a search that finds nothing says so');
});

test('showing everything crosses kinds of mascot, and never crosses slots', () => {
  const forABird = assetsFor({ slot: 'ears', morphology: 'beak' });
  const everything = assetsFor({ slot: 'ears', morphology: 'beak', includeIncompatible: true });
  assert.ok(everything.length > forABird.length, 'there is something behind the door');
  assert.ok(everything.some((item) => !item.compatible), 'and it says which drawings those are');
  assert.ok(forABird.every((item) => item.compatible));

  // The one thing the hatch must never do. A row is a slot, and an author who
  // opened Ears is choosing ears however far past their own kind they look.
  for (const item of everything) assert.equal(assetSlot(item.card), 'ears', `${item.card.id} is an ear`);
  assert.deepEqual(ids(everything).filter((id) => id.startsWith('mouth.beak')), []);

  // And it composes with a search rather than overriding it.
  const searched = assetsFor({ slot: 'ears', morphology: 'beak', includeIncompatible: true, query: 'robot' });
  assert.ok(searched.length > 0 && searched.length < everything.length);
});

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
  const unscored = forAFox.filter((item) => !item.affinity).map((item) => item.card.id);
  assert.deepEqual(unscored, plain.filter((item) => !ids(forAFox.filter((x) => x.affinity)).includes(item.card.id)).map((item) => item.card.id));
  // Words nobody drew for change nothing at all.
  assert.deepEqual(ids(assetsFor({ slot: 'ears', morphology: 'muzzle', affinity: ['zzz'] })), ids(plain));
});

test('the old call still answers exactly as it did', () => {
  // Every argument UI-REDESIGN-04 added is optional, and the shape grew rather
  // than changed: `card`, `drawing` and `restyled` are where they were.
  const before = assetsFor({ slot: 'eyes', morphology: 'human' });
  assert.ok(before.length > 0);
  for (const item of before) {
    assert.deepEqual(Object.keys(item).sort(), ['affinity', 'card', 'compatible', 'drawing', 'restyled']);
    assert.equal(item.compatible, true);
    assert.equal(item.affinity, 0);
  }
});
