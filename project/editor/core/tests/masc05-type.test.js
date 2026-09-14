import test from 'node:test';
import assert from 'node:assert/strict';
import { availableMorphologies } from '../face-library/compatibility.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { NARROWED } from './fixtures/face-packs.js';
import { CHARACTER_CATEGORY_IDS, characterCategory } from '../../ui/character-builder/character-model.js';
import { typeSelectMarkup, typeWaitingFor } from '../../ui/character-builder/type-browser.js';
import { FACE_MORPHOLOGY_IDS, faceMorphology } from '../face-library/face-morphologies.js';

/**
 * MASC-05 — Type in Design ▸ Face.
 *
 * Two behaviours are worth holding still. A kind of face is offered when the
 * library can draw the pieces that make it that kind, derived rather than
 * listed — so drawing a muzzle is what turns `muzzle` on, with nothing to
 * remember to edit. And a kind that cannot be drawn for is *shown* and
 * disabled: a missing option an author can see is a promise, one they cannot
 * see is a feature that does not exist.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace('.', '-');
  const role = { mouth: 'mouth', accessory: 'element' }[category] || 'element';
  return { id, category, name: id, artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`, roles: { [role]: `${root}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra };
};

test('a kind of face is offered once the library can draw what makes it that kind', () => {
  // The shipped library was a human one until the Soft Cartoon packs arrived,
  // and it is those packs' own pieces -- nothing anybody wrote in a list --
  // that put Muzzle, Robot and Beak on the row. Monster is still waiting on its
  // horns, and that is the mechanism working rather than a gap: a kind nobody
  // can draw is a promise the row would be making on somebody else's behalf.
  const shipped = availableMorphologies({ library: FACE_PART_LIBRARY });
  assert.deepEqual(shipped.map((type) => `${type.id}:${type.available}`), ['human:true', 'muzzle:true', 'beak:true', 'robot:true', 'monster:false']);
  for (const id of ['muzzle', 'robot', 'beak']) assert.deepEqual(shipped.find((type) => type.id === id).missing, [], `${id} has everything it needs`);
  assert.deepEqual(shipped.find((type) => type.id === 'monster').missing, ['horns']);
  assert.deepEqual(shipped.find((type) => type.id === 'human').distinctive, [], 'human is the reference the library grew as');

  // Take the packs back out and their kinds go off again; draw the pieces, and
  // each turns on by itself. Which is the whole mechanism, in one library.
  const library = createFacePartRegistry();
  for (const asset of FACE_PART_LIBRARY.list()) if (!NARROWED.has(asset.id)) library.register({ ...asset, origin: 'custom' });
  const bare = availableMorphologies({ library });
  assert.deepEqual(bare.map((type) => `${type.id}:${type.available}`), ['human:true', 'muzzle:false', 'beak:false', 'robot:false', 'monster:false']);
  assert.deepEqual(bare.find((type) => type.id === 'muzzle').missing, ['muzzle', 'whiskers']);
  assert.deepEqual(bare.find((type) => type.id === 'robot').missing, ['antenna', 'panels']);
  assert.deepEqual(bare.find((type) => type.id === 'beak').missing, ['beak', 'crest']);
  library.register(part('accessory.muzzle-cat', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'] }));
  assert.deepEqual(availableMorphologies({ library }).find((type) => type.id === 'muzzle').missing, ['whiskers'], 'half-drawn is not drawn');
  library.register(part('accessory.whiskers-cat', 'accessory', { slot: 'whiskers', morphologies: ['muzzle'] }));
  assert.equal(availableMorphologies({ library }).find((type) => type.id === 'muzzle').available, true);
  assert.equal(availableMorphologies({ library }).find((type) => type.id === 'beak').available, false, 'and only that kind turned on');
});

test('the Kind setting offers every kind, and says what the ones it cannot offer are waiting for', () => {
  // It was a row, second in a list whose subject is the parts of a face and
  // above the head — a setting that announces it does nothing, read before
  // anything that does (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §1.4). It is one
  // `<select>` in the panel's header now, carrying the same three facts.
  const markup = typeSelectMarkup({
    loaded: true,
    types: [
      { id: 'human', label: 'Human', description: 'A person.', available: true, missing: [], current: true },
      { id: 'muzzle', label: 'Animal', description: 'A cat, a dog.', available: false, missing: ['muzzle', 'whiskers'], current: false }
    ]
  });
  assert.match(markup, /<select data-face-type/);
  assert.match(markup, /<option value="human" selected/);
  assert.match(markup, /<option value="muzzle"[^>]*disabled/);
  // The reason rides in the option and in the note, never only in a `title`:
  // a tooltip is invisible to a finger.
  assert.match(markup, /Animal — not drawn yet/);
  assert.match(markup, /Nothing is drawn for its muzzle or its whiskers yet\./);
  assert.equal(typeWaitingFor({ missing: [] }), '');
  assert.equal(typeWaitingFor({ missing: ['beak', 'crest'] }), 'Nothing is drawn for its beak or its crest yet.');
  // The sentence that makes it safe to change.
  assert.match(typeSelectMarkup({ loaded: true, types: [{ id: 'human', label: 'Human', description: 'A person.', available: true, missing: [], current: true }] }), /changes nothing on the mascot/);
  assert.equal(typeSelectMarkup({}), '', 'no kinds, no control');
});

/**
 * UI-REDESIGN-03 — the label is the author's word, the id stays ours.
 *
 * Nobody shops for a snout. The ids are load-bearing — a document, a pack, an
 * asset's `morphologies`, every test — and they do not move.
 */
test('a kind is named for what an author is making, not for what it is made of', () => {
  const named = Object.fromEntries(FACE_MORPHOLOGY_IDS.map((id) => [id, faceMorphology(id).label]));
  assert.deepEqual(named, { human: 'Human', muzzle: 'Animal', beak: 'Bird', robot: 'Robot', monster: 'Creature' });
  // And the six birds MASC-12B drew give Bird a default at last: a kind with
  // presets and no default has no picture for its card and nothing to start from.
  assert.equal(faceMorphology('beak').defaultPreset, 'owl');
});

test('Type is a row of the browser, beside the presets rather than in front of them', () => {
  assert.deepEqual([...CHARACTER_CATEGORY_IDS].slice(0, 4), ['presets', 'type', 'style', 'palette']);
  assert.equal(characterCategory('type').kind, 'type');
  assert.ok(characterCategory('type').hint.includes('what kind of face this is'));
});
