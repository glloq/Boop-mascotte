/**
 * What kind of creature a face is, and which pieces it is made of
 * (docs/MASC_LIBRARY_BASELINE.md; MASC-01).
 *
 * Two words that are deliberately not the same one:
 *
 * ```text
 * SEMANTIC CATEGORY   what the rig understands        head, eyes, mouth, accessory…
 * VISUAL SLOT         what the author picks in Design  Head, Eyes, Muzzle, Beak, Horns…
 * ```
 *
 * A muzzle, a pair of whiskers, a crest and a robot's panels are all things an
 * author wants to choose. None of them is a thing the *runtime* needs to know
 * about: a muzzle is artwork parented to the head, and the rig that plays it is
 * the accessory rig it already has. Giving each one a semantic part would make
 * the exported mascot depend on the graphics library, which is the one thing
 * this layer exists to prevent.
 *
 * So a slot names a category, and several slots may name the same one. `Beak`
 * installs as a `mouth` — it opens and closes, and `mouthOpen` means on a duck
 * exactly what it means on a person. `Muzzle`, `Whiskers`, `Horns`, `Antenna`
 * and `Panels` install as accessories, which is what they are to the rig.
 *
 * A **morphology** is then a list of slots, in the order Design offers them. It
 * is not a species: `cat`, `dog` and `fox` are presets *inside* `muzzle`, which
 * is why they cost drawings rather than code.
 *
 * Nothing here reaches a document, and nothing here is exported. This is
 * authoring metadata over the library, in the same sense a category is.
 */
import { FACE_PART_CATEGORY_IDS, facePartCategory } from './face-part-model.js';

/**
 * The slots, and the category each installs through.
 *
 * Eleven of them *are* a category, and say so by carrying its id: a slot with
 * nothing special to say about itself is its category, so the eleven a human
 * face already had need no table of their own and cannot drift from one. The
 * rest are the new vocabulary, and each one names the category it becomes.
 */
const SLOT_TABLE = [
  // The eleven the library already had, in the order Design lists them.
  ...FACE_PART_CATEGORY_IDS.map((id) => [id, facePartCategory(id).label, id]),
  // And the ones a face that is not a person needs. The label is the author's
  // word; the third column is the rig's.
  ['muzzle', 'Muzzle', 'accessory'],
  ['whiskers', 'Whiskers', 'accessory'],
  ['beak', 'Beak', 'mouth'],
  ['horns', 'Horns', 'accessory'],
  ['crest', 'Crest', 'accessory'],
  ['antenna', 'Antenna', 'accessory'],
  ['panels', 'Panels', 'accessory']
];

export const FACE_SLOTS = Object.freeze(Object.fromEntries(SLOT_TABLE.map(([id, label, category]) => {
  const known = facePartCategory(category);
  if (!known) throw new Error(`Face slot "${id}" names a category that does not exist: ${category}`);
  return [id, Object.freeze({ id, label, category, multiple: known.multiple, installable: known.installable })];
})));

export const FACE_SLOT_IDS = Object.freeze(Object.keys(FACE_SLOTS));

/** A slot by id, or null. */
export const faceSlot = (id) => FACE_SLOTS[String(id ?? '')] || null;

/**
 * The slot an asset is offered in.
 *
 * `slot` where it declares one (MASC-02), and its category otherwise — which
 * is every asset the library ships, and every asset anyone has ever written.
 * An asset naming a slot that does not exist is offered under its category
 * rather than nowhere: a typo hides a drawing, and a drawing nobody can find
 * is worse than one in the wrong list.
 */
export const assetSlot = (asset) => (faceSlot(asset?.slot)?.id) || (facePartCategory(asset?.category) ? asset.category : null);

/**
 * The five kinds of face, each a list of slots in the order Design offers them.
 *
 * `cat`, `dog`, `fox` and `bear` are **not** here: they are presets inside
 * `muzzle`. A morphology is what a face is made of; a preset is what it looks
 * like. Adding a species should cost drawings, never a release.
 *
 * `defaultPreset` is null where the presets for that kind have not been drawn
 * yet. A forward reference to a preset nobody has written is a dangling one,
 * and `core/tests/masc01-morphology.test.js` holds every named default to
 * being real.
 */
const MORPHOLOGY_TABLE = [
  ['human', 'Human', 'A person: hair, brows, a nose and a mouth.',
    ['head', 'eyes', 'pupils', 'eyelids', 'eyebrows', 'nose', 'mouth', 'ears', 'hair', 'facialHair', 'accessory'], 'classic'],
  ['muzzle', 'Muzzle', 'A cat, a dog, a fox, a bear: a snout out in front of the face.',
    ['head', 'eyes', 'pupils', 'eyebrows', 'ears', 'muzzle', 'nose', 'mouth', 'whiskers', 'hair', 'accessory'], null],
  ['beak', 'Beak', 'A bird: a beak that opens, and a crest instead of hair.',
    ['head', 'eyes', 'pupils', 'eyebrows', 'beak', 'crest', 'accessory'], null],
  ['robot', 'Robot', 'A machine: panels, an antenna, a mouth that is a display.',
    ['head', 'eyes', 'pupils', 'mouth', 'antenna', 'panels', 'accessory'], null],
  ['monster', 'Monster', 'Horns, too many teeth, and whatever else you like.',
    ['head', 'eyes', 'pupils', 'eyebrows', 'horns', 'ears', 'mouth', 'hair', 'accessory'], null]
];

export const FACE_MORPHOLOGIES = Object.freeze(Object.fromEntries(MORPHOLOGY_TABLE.map(([id, label, description, slots, defaultPreset]) => {
  for (const slot of slots) if (!FACE_SLOTS[slot]) throw new Error(`Morphology "${id}" names a slot that does not exist: ${slot}`);
  return [id, Object.freeze({ id, label, description, slots: Object.freeze([...slots]), defaultPreset })];
})));

export const FACE_MORPHOLOGY_IDS = Object.freeze(Object.keys(FACE_MORPHOLOGIES));

/** A morphology by id, or null. */
export const faceMorphology = (id) => FACE_MORPHOLOGIES[String(id ?? '')] || null;

/** The slots of a morphology, as records; an unknown morphology has none. */
export const morphologySlots = (id) => (faceMorphology(id)?.slots || []).map((slot) => FACE_SLOTS[slot]);

/**
 * The kinds of face an asset may be used in.
 *
 * **An asset that says nothing is universal.** That is the contract, and it is
 * chosen so that every drawing written before this existed — the 47 the library
 * ships, every pack, every part an author saved in their browser — keeps
 * working with no migration and no edit. `['*']` says the same thing out loud,
 * for an asset that wants to be explicit about it.
 *
 * An asset naming a kind nobody has heard of is not universal and not an error:
 * it is offered in the kinds it names that exist, and in nothing else.
 */
export function compatibleMorphologies(asset) {
  const declared = Array.isArray(asset?.morphologies) ? asset.morphologies.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()) : [];
  if (!declared.length || declared.includes('*')) return [...FACE_MORPHOLOGY_IDS];
  return FACE_MORPHOLOGY_IDS.filter((id) => declared.includes(id));
}

/** Whether an asset may be used in one kind of face. */
export const assetSupportsMorphology = (asset, morphology) =>
  Boolean(faceMorphology(morphology)) && compatibleMorphologies(asset).includes(morphology);
