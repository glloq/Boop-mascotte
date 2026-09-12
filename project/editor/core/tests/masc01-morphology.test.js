import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FACE_MORPHOLOGIES, FACE_MORPHOLOGY_IDS, FACE_SLOTS, FACE_SLOT_IDS,
  assetSlot, assetSupportsMorphology, compatibleMorphologies, faceMorphology, faceSlot, morphologySlots
} from '../face-library/face-morphologies.js';
import { FACE_STYLES, FACE_STYLE_IDS, availableFaceStyles, faceStyle } from '../face-library/face-styles.js';
import { FACE_PART_CATEGORY_IDS, facePartCategory } from '../face-library/face-part-model.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';

/**
 * MASC-01 — morphologies, slots and styles, as metadata and nothing else.
 *
 * The separation these tests are really about is the one in §5 of the plan: a
 * **slot** is what an author picks, a **category** is what the rig understands,
 * and several slots may name one category. A muzzle is an accessory to the
 * runtime and a muzzle to the person choosing it, and that is the whole trick —
 * it is what lets a new kind of mascot cost drawings rather than a rig change.
 */

test('every slot names a category the rig has, and the eleven that are one carry its id', () => {
  for (const slot of Object.values(FACE_SLOTS)) {
    assert.ok(facePartCategory(slot.category), `${slot.id} names a category that does not exist`);
  }
  // A slot with nothing special to say about itself *is* its category, so the
  // eleven a human face already had need no second table to drift from.
  for (const id of FACE_PART_CATEGORY_IDS) {
    assert.equal(faceSlot(id)?.category, id, `${id} should be its own slot`);
    assert.equal(faceSlot(id).label, facePartCategory(id).label);
  }
  // And the new vocabulary is exactly the vocabulary the rig does *not* have.
  const extra = FACE_SLOT_IDS.filter((id) => !FACE_PART_CATEGORY_IDS.includes(id));
  assert.deepEqual(extra, ['muzzle', 'whiskers', 'beak', 'horns', 'crest', 'antenna', 'panels']);
  assert.deepEqual(extra.map((id) => FACE_SLOTS[id].category), ['accessory', 'accessory', 'mouth', 'accessory', 'accessory', 'accessory', 'accessory'],
    'a beak is a mouth because it opens; the rest are accessories because that is what they are to the rig');
  assert.equal(faceSlot('nope'), null);
});

test('a morphology is a list of slots, and never a species', () => {
  assert.deepEqual([...FACE_MORPHOLOGY_IDS], ['human', 'muzzle', 'beak', 'robot', 'monster']);
  for (const id of FACE_MORPHOLOGY_IDS) {
    const morphology = faceMorphology(id);
    assert.ok(morphology.label && morphology.description, `${id} says what it is`);
    assert.ok(morphology.slots.length, `${id} is made of something`);
    for (const slot of morphology.slots) assert.ok(FACE_SLOTS[slot], `${id} names a slot that does not exist: ${slot}`);
    assert.deepEqual(morphology.slots.filter((slot, index) => morphology.slots.indexOf(slot) !== index), [], `${id} names a slot twice`);
    assert.equal(morphology.slots[0], 'head', `${id} starts with the skull everything else sits on`);
  }
  // The line the plan is most likely to be broken along: cat, dog and fox are
  // presets inside `muzzle`, so adding one must never add a morphology.
  for (const species of ['cat', 'dog', 'fox', 'bear', 'owl', 'dragon']) {
    assert.equal(faceMorphology(species), null, `${species} is a preset, not a kind of face`);
  }
  assert.deepEqual(morphologySlots('muzzle').map((slot) => slot.id), [...FACE_MORPHOLOGIES.muzzle.slots]);
  assert.deepEqual(morphologySlots('nope'), []);
});

test('a default preset a morphology names is a preset that exists', () => {
  // A forward reference to a preset nobody has drawn is a dangling one. Kinds
  // whose presets arrive in MASC-08 and MASC-10 say `null` until they do.
  for (const id of FACE_MORPHOLOGY_IDS) {
    const named = FACE_MORPHOLOGIES[id].defaultPreset;
    if (named === null) continue;
    assert.ok(FACE_PRESET_LIBRARY.get(named), `${id} defaults to "${named}", which is not a preset`);
  }
  assert.equal(FACE_MORPHOLOGIES.human.defaultPreset, 'classic');
});

test('an asset that says nothing is compatible with every kind of face', () => {
  // The compatibility contract, and the reason MASC-02 can add the field
  // without a migration: 47 shipped assets, every pack and every part an
  // author saved say nothing, and must keep working untouched.
  assert.deepEqual(compatibleMorphologies({}), [...FACE_MORPHOLOGY_IDS]);
  assert.deepEqual(compatibleMorphologies({ morphologies: [] }), [...FACE_MORPHOLOGY_IDS]);
  assert.deepEqual(compatibleMorphologies({ morphologies: ['*'] }), [...FACE_MORPHOLOGY_IDS], 'the same thing, said out loud');
  for (const asset of FACE_PART_LIBRARY.list()) {
    assert.deepEqual(compatibleMorphologies(asset), [...FACE_MORPHOLOGY_IDS], `${asset.id} lost its universality`);
  }

  assert.deepEqual(compatibleMorphologies({ morphologies: ['muzzle', 'monster'] }), ['muzzle', 'monster']);
  assert.equal(assetSupportsMorphology({ morphologies: ['muzzle'] }, 'muzzle'), true);
  assert.equal(assetSupportsMorphology({ morphologies: ['muzzle'] }, 'human'), false);
  assert.equal(assetSupportsMorphology({}, 'nope'), false, 'universal means every kind there is, not every word');
  // A kind nobody has heard of is neither universal nor an error.
  assert.deepEqual(compatibleMorphologies({ morphologies: ['unicorn'] }), []);
  assert.deepEqual(compatibleMorphologies({ morphologies: ['unicorn', 'human'] }), ['human']);
});

test('an asset is offered in the slot it names, or in its category', () => {
  assert.equal(assetSlot({ category: 'mouth' }), 'mouth');
  assert.equal(assetSlot({ category: 'accessory', slot: 'muzzle' }), 'muzzle');
  assert.equal(assetSlot({ category: 'mouth', slot: 'beak' }), 'beak');
  // A typo hides a drawing, and a drawing nobody can find is worse than one in
  // the wrong list: it falls back to the category rather than to nowhere.
  assert.equal(assetSlot({ category: 'mouth', slot: 'bekk' }), 'mouth');
  assert.equal(assetSlot({ category: 'nope' }), null);
  for (const asset of FACE_PART_LIBRARY.list()) assert.equal(assetSlot(asset), asset.category);
});

test('a style is a catalogue entry, and worth exactly the variants drawn in it', () => {
  assert.deepEqual([...FACE_STYLE_IDS], ['soft-cartoon']);
  assert.equal(faceStyle('soft-cartoon').label, 'Soft Cartoon');
  assert.equal(faceStyle('flat'), null, 'a style arrives with its drawings, or it lies to whoever picks it');
  assert.ok(Object.isFrozen(FACE_STYLES));

  // Today: one entry, nothing drawn in it. MASC-06 is what changes this.
  assert.deepEqual(availableFaceStyles(FACE_PART_LIBRARY), [{ ...FACE_STYLES['soft-cartoon'], variants: 0 }]);

  const library = createFacePartRegistry();
  const mouth = (id, extra = {}) => ({ id, name: id, category: 'mouth', artwork: `<g id="${id.replace('.', '-')}"><path id="${id.replace('.', '-')}-l" d="M0 0h10"/></g>`, roles: { mouth: `${id.replace('.', '-')}-l` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra });
  library.registerMany([
    mouth('mouth.wide'),
    mouth('mouth.wide-soft', { variant: { of: 'mouth.wide', style: 'soft-cartoon' } }),
    // A pack bringing a look of its own is not invisible for having skipped the catalogue.
    mouth('mouth.wide-woodcut', { variant: { of: 'mouth.wide', style: 'woodcut' } })
  ]);
  assert.deepEqual(availableFaceStyles(library), [
    { ...FACE_STYLES['soft-cartoon'], variants: 1 },
    { id: 'woodcut', label: 'woodcut', description: '', variants: 1 }
  ]);
});
