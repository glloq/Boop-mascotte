import test from 'node:test';
import assert from 'node:assert/strict';
import { createFacePartRegistry, loadCustomParts, saveCustomParts } from '../face-library/face-part-registry.js';
import { createFacePresetRegistry } from '../face-library/face-presets.js';
import { installFacePack } from '../face-library/face-pack.js';
import { validateFacePart } from '../face-library/face-part-validation.js';
import { assetSlot, compatibleMorphologies } from '../face-library/face-morphologies.js';

/**
 * MASC-02 — the three optional fields, and the promise that they are optional.
 *
 * The field is easy; the promise is the work. Forty-seven shipped assets, every
 * pack anyone has ever exported and every part saved in somebody's browser say
 * none of these things, and every one of them has to keep behaving exactly as
 * it did. So the rules refuse only claims that cannot be true — a slot holding
 * another category's drawings, a kind of face nobody has heard of — and never
 * the absence of a claim.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace('.', '-');
  const roles = { mouth: 'mouth', ears: 'leftEar', accessory: 'element' }[category] || 'element';
  return {
    id, category, name: id,
    artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`,
    roles: { [roles]: `${root}-a` },
    referenceBox: { x: 0, y: 0, width: 10, height: 4 },
    ...extra
  };
};

const memory = () => {
  const store = new Map();
  return { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
};

const codes = (input) => validateFacePart(input).errors.map((item) => item.code);

test('a slot is refused when it cannot hold the drawing, and never when it is absent', () => {
  assert.deepEqual(codes(part('mouth.plain', 'mouth')), []);
  // A beak is a mouth: it opens, and mouthOpen means the same thing on a duck.
  assert.deepEqual(codes(part('mouth.beak', 'mouth', { slot: 'beak' })), []);
  assert.deepEqual(codes(part('accessory.muzzle', 'accessory', { slot: 'muzzle' })), []);
  // And these two cannot be true.
  assert.deepEqual(codes(part('mouth.x', 'mouth', { slot: 'muzzle' })), ['slot-category']);
  assert.deepEqual(codes(part('mouth.x', 'mouth', { slot: 'snoot' })), ['slot-unknown']);
  // A slot naming the drawing's own category is simply redundant, not wrong.
  assert.deepEqual(codes(part('mouth.x', 'mouth', { slot: 'mouth' })), []);
});

test('a kind of face is one of the five, or every one of them, and never both', () => {
  assert.deepEqual(codes(part('mouth.x', 'mouth', { morphologies: ['beak', 'monster'] })), []);
  assert.deepEqual(codes(part('mouth.x', 'mouth', { morphologies: ['*'] })), []);
  assert.deepEqual(codes(part('mouth.x', 'mouth', { morphologies: ['unicorn'] })), ['morphology-unknown']);
  assert.deepEqual(codes(part('mouth.x', 'mouth', { morphologies: ['*', 'human'] })), ['morphology-mixed']);
  assert.deepEqual(codes(part('mouth.x', 'mouth', { tags: ['cat', 'wolf'] })), []);
  assert.deepEqual(codes(part('mouth.x', 'mouth', { tags: ['Big Cat'] })), ['tag-format']);
});

test('a pack carries the metadata in, and a pack written before it existed still imports', () => {
  const library = createFacePartRegistry(), presets = createFacePresetRegistry({ library });
  const result = installFacePack({
    format: 'boop-face-pack', version: 1, id: 'cats', name: 'Cats',
    parts: [
      part('accessory.muzzle-cat', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'], tags: ['cat'] }),
      part('mouth.plain', 'mouth')
    ],
    presets: [{ id: 'cat', name: 'Cat', parts: { mouth: 'mouth.plain' }, palette: 'warm' }]
  }, { library, presets });

  assert.equal(result.ok, true, result.reason);
  const muzzle = library.get('accessory.muzzle-cat');
  assert.deepEqual({ slot: muzzle.slot, morphologies: [...muzzle.morphologies], tags: [...muzzle.tags] }, { slot: 'muzzle', morphologies: ['muzzle'], tags: ['cat'] });
  assert.equal(assetSlot(muzzle), 'muzzle');
  assert.deepEqual(compatibleMorphologies(muzzle), ['muzzle']);

  // The part beside it said nothing, and is universal, offered under its category.
  const plain = library.get('mouth.plain');
  assert.equal(assetSlot(plain), 'mouth');
  assert.deepEqual(compatibleMorphologies(plain), ['human', 'muzzle', 'beak', 'robot', 'monster']);
});

test('a part an author saved keeps what it said, and one saved before the fields existed still loads', () => {
  const library = createFacePartRegistry();
  library.register(part('accessory.horn', 'accessory', { slot: 'horns', morphologies: ['monster'], tags: ['devil'] }));
  library.register(part('mouth.plain', 'mouth'));
  const storage = memory();
  saveCustomParts(storage, library);

  const reloaded = createFacePartRegistry();
  loadCustomParts(storage, reloaded);
  assert.deepEqual(reloaded.get('accessory.horn').morphologies, ['monster']);
  assert.deepEqual(reloaded.get('accessory.horn').tags, ['devil']);
  assert.equal(reloaded.get('accessory.horn').slot, 'horns');
  assert.deepEqual(reloaded.get('mouth.plain'), library.get('mouth.plain'));

  // And the shape a browser has held since before MASC-02: no slot, no
  // morphologies, no tags. It is not migrated, it is simply complete.
  const old = memory();
  old.setItem('boop.faceParts', JSON.stringify([{ ...part('mouth.old', 'mouth'), origin: 'custom' }]));
  const opened = createFacePartRegistry();
  assert.deepEqual(loadCustomParts(old, opened).map((asset) => asset.id), ['mouth.old']);
  assert.deepEqual({ slot: opened.get('mouth.old').slot, morphologies: [...opened.get('mouth.old').morphologies] }, { slot: '', morphologies: [] });
});
