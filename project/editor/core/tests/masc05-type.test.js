import test from 'node:test';
import assert from 'node:assert/strict';
import { availableMorphologies } from '../face-library/compatibility.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { ANIMAL_FACE_PARTS } from '../face-library/builtin/animals/index.js';
import { CHARACTER_CATEGORY_IDS, characterCategory } from '../../ui/character-builder/character-model.js';
import { typeBrowserMarkup } from '../../ui/character-builder/type-browser.js';

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
  // The shipped library was a human one until MASC-10B drew the Soft Cartoon
  // animals, and it is that pack's muzzles and whiskers -- nothing anybody
  // wrote in a list -- that put Muzzle on the row. The other three are still
  // waiting on their own pieces: a robot with no panels and no antenna is a
  // person with a square head, and offering it would be offering the same face
  // twice under two names.
  const shipped = availableMorphologies({ library: FACE_PART_LIBRARY });
  assert.deepEqual(shipped.map((type) => `${type.id}:${type.available}`), ['human:true', 'muzzle:true', 'beak:false', 'robot:false', 'monster:false']);
  assert.deepEqual(shipped.find((type) => type.id === 'muzzle').missing, [], 'both pieces drawn');
  assert.deepEqual(shipped.find((type) => type.id === 'robot').missing, ['antenna', 'panels']);
  assert.deepEqual(shipped.find((type) => type.id === 'human').distinctive, [], 'human is the reference the library grew as');

  // Take the pack back out and the kind goes off again; draw the two pieces,
  // and it turns on by itself. Which is the whole mechanism, in one library.
  const animals = new Set(ANIMAL_FACE_PARTS.map((asset) => asset.id));
  const library = createFacePartRegistry();
  for (const asset of FACE_PART_LIBRARY.list()) if (!animals.has(asset.id)) library.register({ ...asset, origin: 'custom' });
  assert.equal(availableMorphologies({ library }).find((type) => type.id === 'muzzle').available, false);
  assert.deepEqual(availableMorphologies({ library }).find((type) => type.id === 'muzzle').missing, ['muzzle', 'whiskers']);
  library.register(part('accessory.muzzle-cat', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'] }));
  assert.deepEqual(availableMorphologies({ library }).find((type) => type.id === 'muzzle').missing, ['whiskers'], 'half-drawn is not drawn');
  library.register(part('accessory.whiskers-cat', 'accessory', { slot: 'whiskers', morphologies: ['muzzle'] }));
  assert.equal(availableMorphologies({ library }).find((type) => type.id === 'muzzle').available, true);
  assert.equal(availableMorphologies({ library }).find((type) => type.id === 'beak').available, false, 'and only that kind turned on');
});

test('the Type row shows every kind, and says what the ones it cannot offer are waiting for', () => {
  const markup = typeBrowserMarkup({
    loaded: true,
    types: [
      { id: 'human', label: 'Human', description: 'A person.', available: true, missing: [], current: true },
      { id: 'muzzle', label: 'Muzzle', description: 'A cat, a dog.', available: false, missing: ['muzzle', 'whiskers'], current: false }
    ]
  });
  assert.match(markup, /data-face-type="human"[^>]*aria-pressed="true"/);
  assert.match(markup, /data-face-type="muzzle"[^>]*disabled/);
  assert.match(markup, /Nothing is drawn for its muzzle or its whiskers yet\./);
  // The sentence that makes the row safe to press.
  assert.match(markup, /It changes nothing on the mascot/);
  assert.match(typeBrowserMarkup({}), /No kinds of face to choose from/);
});

test('Type is a row of the browser, beside the presets rather than in front of them', () => {
  assert.deepEqual([...CHARACTER_CATEGORY_IDS].slice(0, 4), ['presets', 'type', 'style', 'palette']);
  assert.equal(characterCategory('type').kind, 'type');
  assert.ok(characterCategory('type').hint.includes('what kind of face this is'));
});
