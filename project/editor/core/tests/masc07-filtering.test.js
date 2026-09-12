import test from 'node:test';
import assert from 'node:assert/strict';
import { assetsFor } from '../face-library/compatibility.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { faceMorphology } from '../face-library/face-morphologies.js';

/**
 * MASC-07 — the parts on offer follow the kind of face.
 *
 * Two rules, and the second is the one that matters. The slot filters what is
 * *offered*; the semantic category is still the authority for what is
 * *installed*, so nothing above the library can change what the rig gets. And
 * the filter never hides a row the mascot is wearing something in: a human
 * face browsed as a bird still shows its hair, because hiding the only door to
 * a part somebody has already put on is exactly the failure this layer exists
 * to prevent.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace('.', '-');
  const role = { mouth: 'mouth', hair: 'hair', accessory: 'element' }[category] || 'element';
  return { id, category, name: id, artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`, roles: { [role]: `${root}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra };
};

/** The rule `rowsFor` applies, as the thing it is: a predicate over rows. */
const rowsFor = (rows, morphology, active = null) => {
  const slots = new Set(faceMorphology(morphology)?.slots || []);
  if (!slots.size) return rows;
  return rows.filter((row) => row.kind || slots.has(row.id) || row.pieces.length || row.id === active);
};

test('a slot offers only the drawings this kind of face can wear, and installs through the category', () => {
  const library = createFacePartRegistry();
  library.registerMany([
    part('mouth.plain', 'mouth'),
    part('mouth.beak', 'mouth', { slot: 'beak', morphologies: ['beak'] }),
    part('accessory.glasses', 'accessory'),
    part('accessory.muzzle-cat', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'] })
  ]);

  // The Mouth row of a bird does not offer the human mouth's beak sibling under
  // it, and a person is never offered the beak at all.
  assert.deepEqual(assetsFor({ library, morphology: 'beak', slot: 'mouth' }).map((item) => item.card.id), ['mouth.plain']);
  assert.deepEqual(assetsFor({ library, morphology: 'human', slot: 'beak' }).map((item) => item.card.id), []);
  assert.deepEqual(assetsFor({ library, morphology: 'beak', slot: 'beak' }).map((item) => item.card.id), ['mouth.beak']);
  // The cat's muzzle is not among the generic accessories, in any kind of face.
  for (const morphology of ['human', 'muzzle', 'monster']) {
    assert.deepEqual(assetsFor({ library, morphology, slot: 'accessory' }).map((item) => item.card.id), ['accessory.glasses'], `${morphology} sees the glasses and not the muzzle`);
  }
  // And what a press installs is still the asset's own category: a beak is a
  // mouth to the rig, whichever row an author found it in.
  assert.equal(library.get('mouth.beak').category, 'mouth');
  assert.equal(library.get('accessory.muzzle-cat').category, 'accessory');
});

test('the filter narrows what is offered, and never what the mascot is already wearing', () => {
  const rows = [
    { id: 'presets', kind: 'presets', pieces: [] },
    { id: 'type', kind: 'type', pieces: [] },
    { id: 'head', pieces: [{ id: 'h' }] },
    { id: 'hair', pieces: [{ id: 'hairRoot' }] },
    { id: 'facialHair', pieces: [] },
    { id: 'nose', pieces: [] }
  ];
  // A bird has no hair and no facial hair. The empty rows go; the hair that is
  // on the mascot stays, because hiding it would hide the only way to take it
  // off again.
  assert.deepEqual(rowsFor(rows, 'beak').map((row) => row.id), ['presets', 'type', 'head', 'hair']);
  assert.deepEqual(rowsFor(rows, 'human').map((row) => row.id), rows.map((row) => row.id), 'every row belongs to a person');
  // And the row the author has open stays open, whatever kind they switch to.
  assert.deepEqual(rowsFor(rows, 'beak', 'nose').map((row) => row.id), ['presets', 'type', 'head', 'hair', 'nose']);
  assert.deepEqual(rowsFor(rows, 'nope').map((row) => row.id), rows.map((row) => row.id), 'an unknown kind filters nothing');
});
