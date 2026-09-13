import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_FACE_PARTS } from '../face-library/builtin/animals/index.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, FACE_PALETTES, presetColours } from '../face-library/face-presets.js';
import { PALETTE_TOKENS } from '../face-library/face-part-model.js';
import { assetSlot, compatibleMorphologies } from '../face-library/face-morphologies.js';
import { availableMorphologies, presetsFor } from '../face-library/compatibility.js';
import { reviewAssets } from '../face-library/face-asset-review.js';

/**
 * MASC-10B — the Soft Cartoon animal pack, as the library sees it.
 *
 * `masc10a-muzzle-pilot.test.js` holds the pack to the brief: every planned id
 * drawn, under the planned name, in the planned category, and six recipes worn
 * as six presets. This file asks the other question — whether the pack is a
 * well-behaved *citizen* of the library it joined.
 *
 * The answer has to be yes in a specific way. The whole argument of MASC-01 to
 * MASC-09 is that a species costs drawings and nothing else; a pack that needed
 * a new category, a new control or a special case anywhere would falsify that
 * in the one place it is testable.
 */

const SPECIES = ['cat', 'dog', 'fox', 'bear', 'wolf', 'rabbit'];
const animal = (id) => ANIMAL_FACE_PARTS.find((asset) => asset.id === id);
const COATS = ['cat-ginger', 'cat-grey', 'dog-tan', 'fox-orange', 'bear-brown', 'wolf-grey', 'rabbit-cream'];

test('the pack is forty-five drawings in the categories the library already had', () => {
  assert.equal(ANIMAL_FACE_PARTS.length, 45);
  assert.equal(BUILTIN_FACE_PARTS.length, 92, 'the 47 that were here, and these');
  const categories = {};
  for (const asset of ANIMAL_FACE_PARTS) categories[asset.category] = (categories[asset.category] || 0) + 1;
  assert.deepEqual(categories, { head: 6, eyes: 6, eyebrows: 5, ears: 8, accessory: 10, nose: 5, mouth: 5 },
    'no pupils card and no eyelids card: the eye sets draw both');
  for (const asset of ANIMAL_FACE_PARTS) {
    assert.equal(asset.origin, 'builtin');
    assert.ok(Object.isFrozen(asset), `${asset.id} is frozen`);
    assert.ok(FACE_PART_LIBRARY.has(asset.id), `${asset.id} is in the library`);
  }
});

test('the pack is the only thing in the library that narrows, and it narrows to one kind', () => {
  // The compatibility contract, seen from the other side: an animal ear on a
  // person is the look nobody asked for, and saying `muzzle` is the whole of
  // what prevents it. Everything that shipped before says nothing and is
  // untouched by the pack's arrival.
  const narrowed = FACE_PART_LIBRARY.list().filter((asset) => asset.morphologies?.length);
  assert.deepEqual(narrowed.map((asset) => asset.id).sort(), ANIMAL_FACE_PARTS.map((asset) => asset.id).sort());
  for (const asset of ANIMAL_FACE_PARTS) assert.deepEqual(compatibleMorphologies(asset), ['muzzle'], asset.id);
  // And the same for the slots: a muzzle and a pair of whiskers are accessories
  // to the rig and rows of their own on screen. Nothing else in the library
  // sits anywhere but its category.
  const slotted = FACE_PART_LIBRARY.list().filter((asset) => assetSlot(asset) !== asset.category);
  assert.deepEqual(slotted.map((asset) => `${asset.id} -> ${assetSlot(asset)}`), [
    'accessory.muzzle-feline-short -> muzzle', 'accessory.muzzle-feline-rounded -> muzzle',
    'accessory.muzzle-canine-medium -> muzzle', 'accessory.muzzle-canine-narrow -> muzzle',
    'accessory.muzzle-bear-broad -> muzzle', 'accessory.muzzle-rodent-small -> muzzle',
    'accessory.whiskers-three-straight -> whiskers', 'accessory.whiskers-two-soft -> whiskers',
    'accessory.whiskers-long-curved -> whiskers', 'accessory.whiskers-subtle-short -> whiskers'
  ]);
});

test('drawing the muzzles turned the Muzzle kind of face on, and nothing else', () => {
  // MASC-05's mechanism, working unattended: a kind of face is offered because
  // something is drawn for the slots that make it, never because a list was
  // edited. Nobody wrote `muzzle: available` anywhere.
  const kinds = availableMorphologies({ library: FACE_PART_LIBRARY });
  assert.deepEqual(kinds.map((kind) => `${kind.id}:${kind.available}`), ['human:true', 'muzzle:true', 'beak:false', 'robot:false', 'monster:false']);
  assert.deepEqual(kinds.find((kind) => kind.id === 'muzzle').missing, []);
  assert.deepEqual(kinds.find((kind) => kind.id === 'beak').missing, ['beak', 'crest'], 'and the others still say what they want');
});

/* ── The snout question, which is the pack's one real design result ──────── */

test('a muzzle leaves the nose and the mouth room, so nothing is drawn over anything', () => {
  // MASC-10A's biggest graphical risk, and the reason no `behind` field was
  // added: an accessory installed with nothing before it lands last in the
  // group, so a solid pad would paint over the features it was meant to frame.
  // The art answers it in two ways at once.
  const muzzles = ANIMAL_FACE_PARTS.filter((asset) => assetSlot(asset) === 'muzzle');
  assert.equal(muzzles.length, 6);

  // One: a muzzle is not one shape but **two pads**, mirrored about the face's
  // middle and meeting at a point, so the whole centre column -- where the nose
  // and the mouth are -- is open rather than painted.
  for (const muzzle of muzzles) {
    const d = muzzle.artwork.match(/<path id="accessory"[^>]*\sd="([^"]+)"/)[1];
    assert.equal(d.match(/M/g).length, 2, `${muzzle.id} is two pads, not one snout`);
    const [left, right] = d.split(/(?=M)/).filter(Boolean).map((sub) => sub.match(/-?[\d.]+/g).map(Number).filter((_, index) => index % 2 === 0));
    assert.deepEqual(left.map((x) => Math.round((240 - x) * 10) / 10), right.map((x) => Math.round(x * 10) / 10), `${muzzle.id}'s pads are exact mirrors`);
  }

  // Two: the three pieces are laid out in bands down the face, in the order
  // they are read -- nose, then the pads' seam, then the mouth. The boxes touch
  // at the edges, because a pad curves up and away at the sides where a mouth's
  // corners are; what keeps them apart is the order of their middles.
  const middle = (asset) => asset.referenceBox.y + asset.referenceBox.height / 2;
  const noses = ANIMAL_FACE_PARTS.filter((asset) => asset.category === 'nose');
  const mouths = ANIMAL_FACE_PARTS.filter((asset) => asset.category === 'mouth');
  assert.ok(Math.max(...noses.map(middle)) < Math.min(...muzzles.map(middle)), 'every nose sits above every muzzle');
  assert.ok(Math.max(...muzzles.map(middle)) < Math.min(...mouths.map(middle)), 'every muzzle above every mouth');

  // And a snout is artwork parented to the head: it carries no mouth logic, so
  // an animal opens its mouth with the controls a person opens theirs with.
  for (const muzzle of muzzles) {
    assert.equal(muzzle.category, 'accessory');
    assert.deepEqual(muzzle.capabilities, [], `${muzzle.id} claims a control`);
  }
  for (const mouth of mouths) assert.ok(mouth.capabilities.includes('mouthOpen') && mouth.capabilities.includes('smile'), mouth.id);
});

test('an eye drawn shut is still a whole eye set, and claims nothing it cannot do', () => {
  // The other open question MASC-10A left. A bare pair of arcs would be refused
  // by the install -- an eye set is the part that *holds* the gaze and the
  // eyelids, so swapping in one that brings neither takes the pupils off the
  // face -- which is why `eyes.animal-happy` is a composite like every other.
  const shut = animal('eyes.animal-happy');
  assert.ok(shut.parts.gaze.roles.leftPupil && shut.parts.gaze.roles.rightPupil, 'it holds the gaze');
  assert.equal(Object.keys(shut.parts.eyelids.roles).length, 4, 'and all four lids');
  assert.deepEqual(shut.capabilities, [], 'and claims no eyeOpen: there is no blink left in lids already met');
  assert.deepEqual(shut.parts.eyelids.capabilities, []);
  assert.deepEqual(shut.parts.gaze.capabilities, []);
  assert.equal(shut.drivers, undefined);
  // Every other eye set in the pack is an ordinary one, and says so.
  for (const asset of ANIMAL_FACE_PARTS.filter((item) => item.category === 'eyes' && item !== shut)) {
    assert.deepEqual(asset.capabilities, ['eyeOpen'], asset.id);
    assert.deepEqual(asset.parts.gaze.capabilities, ['lookX', 'lookY', 'pupilScale'], asset.id);
    assert.ok(asset.parts.eyelids.drivers.eyeOpen, asset.id);
  }
});

test('the three rows that would not turn on their own say how they turn', () => {
  // An accessory that says nothing about the 2.5D turn does not turn at all,
  // and the role table has no row that could ever answer for one. The ears are
  // the other case: the three shipped pairs sit at the sides of the head, these
  // eight sit on top of it, and a pair on the crown sweeps round rather than
  // staying flat against it.
  for (const asset of ANIMAL_FACE_PARTS.filter((item) => item.category === 'ears')) {
    assert.deepEqual(asset.turn.leftEar, { depth: 0.25, side: 'left', ear: true, sweeps: true }, asset.id);
    assert.deepEqual(asset.turn.rightEar, { depth: 0.25, side: 'right', ear: true, sweeps: true }, asset.id);
  }
  for (const asset of ANIMAL_FACE_PARTS.filter((item) => assetSlot(item) === 'muzzle')) {
    assert.deepEqual(asset.turn.element, { depth: 0.9, side: null, narrow: true }, `${asset.id}: a snout projects further than the moustache's 0.88`);
  }
  for (const asset of ANIMAL_FACE_PARTS.filter((item) => assetSlot(item) === 'whiskers')) {
    assert.deepEqual(asset.turn.element, { depth: 0.85, side: null, narrow: true }, `${asset.id}: just behind the snout they sit on`);
  }
  // And nothing else in the pack declares one: a head, an eye or a mouth is
  // what its category already says it is.
  const declared = ANIMAL_FACE_PARTS.filter((asset) => asset.turn).map((asset) => asset.category);
  assert.deepEqual([...new Set(declared)].sort(), ['accessory', 'ears']);
});

/* ── Six species, over one set of drawings ───────────────────────────────── */

test('the six animals are recipes over shared drawings, not six libraries', () => {
  const worn = SPECIES.map((id) => FACE_PRESET_LIBRARY.get(id));
  for (const preset of worn) {
    assert.ok(preset, 'the preset is registered');
    assert.equal(preset.morphology, 'muzzle');
    assert.ok(preset.tags.includes('animal'), `${preset.id} says what it is`);
    assert.equal(preset.parts.hair, undefined, `${preset.id} has fur, which its head is drawn with`);
    assert.ok(COATS.includes(preset.palette), `${preset.id} wears one of the coat palettes`);
    for (const id of [...Object.values(preset.parts), ...preset.accessories]) {
      assert.ok(animal(id), `${preset.id} names ${id}, which is not in the pack`);
    }
  }
  // The sharing is the argument. Six species over eight slots would be
  // forty-eight drawings if each owned its own; these six name thirty-two
  // between them, because a fox and a wolf share their eyes and their brows, a
  // cat and a fox a nose, a dog and a wolf a muzzle.
  const named = worn.flatMap((preset) => [...Object.values(preset.parts), ...preset.accessories]);
  assert.equal(named.length, 46, 'six parts each, and ten sets of whiskers and muzzles between them');
  assert.equal(new Set(named).size, 38, 'over thirty-eight drawings: eight of them dress two species');
  // The seven left over are the catalogue: two eye expressions, a worried brow,
  // two ear pairs, a second feline muzzle and a wide happy mouth. A parts
  // library exists to be combined, and the sheet's own header says so.
  assert.deepEqual(ANIMAL_FACE_PARTS.filter((asset) => !new Set(named).has(asset.id)).map((asset) => asset.id),
    ['eyes.animal-sleepy', 'eyes.animal-happy', 'eyebrows.animal-worried', 'ears.small-round', 'ears.tufted',
      'accessory.muzzle-feline-rounded', 'mouth.animal-happy-curve']);
});

test('a ginger cat and a grey cat are one drawing and two palettes', () => {
  for (const id of COATS) {
    const palette = FACE_PALETTES[id];
    assert.ok(palette, `${id} is a palette`);
    assert.deepEqual(Object.keys(palette), [...PALETTE_TOKENS], 'every token a colour, as every palette has');
  }
  // No thirteenth token: MASC-10A asked whether the muzzle pad and the inner ear
  // needed one, and `skinShadow` carries both against all seven coats.
  assert.equal(PALETTE_TOKENS.length, 12);
  const cat = FACE_PRESET_LIBRARY.get('cat');
  assert.equal(cat.palette, 'cat-ginger');
  assert.notDeepEqual(presetColours(cat), presetColours({ ...cat, palette: 'cat-grey' }), 'the same drawings, painted differently');
  assert.equal(FACE_PART_LIBRARY.list().filter((asset) => /ginger|grey|orange|brown|cream|tan/.test(asset.id)).length, 0,
    'and no drawing is named for a colour');
});

test('a muzzle face is offered both halves of the library, and every other face the human one', () => {
  assert.deepEqual(presetsFor({ morphology: 'muzzle' }).map((item) => item.id), SPECIES);
  assert.deepEqual(presetsFor({ morphology: 'human' }).map((item) => item.id), ['classic', 'professor', 'young', 'old', 'robot', 'minimal']);
  assert.equal(FACE_PRESET_LIBRARY.size, 12);
});

test('every drawing in the pack places, and the review sheet has nothing to say about any of them', () => {
  // The MASC-09 reading, run over the pack: a box with a size, an anchor a face
  // has, artwork inside the artboard it is drawn in. The ears are the ones to
  // watch -- they stand above the crown, and the rabbit's reach well above the
  // artboard's top edge into the headroom.
  const pack = new Set(ANIMAL_FACE_PARTS.map((asset) => asset.id));
  const reviewed = reviewAssets({ morphology: 'muzzle' }).filter((item) => pack.has(item.id));
  assert.equal(reviewed.length, 45, 'every one of them is reviewed');
  assert.deepEqual(reviewed.filter((item) => item.geometryIssues.length).map((item) => `${item.id}: ${item.geometryIssues.map((issue) => issue.code).join(', ')}`), []);
  for (const item of reviewed) assert.ok(item.fit, `${item.id} has a fit onto the template`);
  const rabbit = animal('ears.rabbit-long');
  assert.ok(rabbit.referenceBox.y < 0, 'the rabbit\'s ears stand in the headroom above the artboard');
});
