import test from 'node:test';
import assert from 'node:assert/strict';
import { BIRD_FACE_PARTS } from '../face-library/builtin/birds/index.js';
import { NARROWED } from './fixtures/face-packs.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { FACE_PALETTES, FACE_PRESET_LIBRARY } from '../face-library/face-presets.js';
import { PALETTE_TOKENS } from '../face-library/face-part-model.js';
import { assetSlot, compatibleMorphologies, morphologySlots } from '../face-library/face-morphologies.js';
import { availableMorphologies, presetsFor } from '../face-library/compatibility.js';
import { reviewAssets } from '../face-library/face-asset-review.js';

/**
 * MASC-12B — the Soft Cartoon bird pack, as the library sees it.
 *
 * `masc12a-beak-pilot.test.js` holds the pack to the brief. This file asks the
 * other question, and for the third pack it is the sharpest version of it: a
 * bird has **no nose, no ears, no hair and no separate mouth**, and the thing
 * it does have — a beak — is a mouth by category and a row of its own on
 * screen. If the library can hold that without a special case, MASC-01's split
 * between a slot and a category was drawn at the right level.
 */

const SPECIES = ['owl', 'duck', 'parrot', 'crow', 'cute-bird', 'slim-bird'];
const part = (id) => BIRD_FACE_PARTS.find((asset) => asset.id === id);
const ids = new Set(BIRD_FACE_PARTS.map((asset) => asset.id));

test('the pack is twenty-four drawings, and the rest of the planche was already here', () => {
  // Thirty when it arrived. The six eye sets were the shipped construction at
  // other radii for the third time -- the file's own header said so, twice --
  // and a bird's eye is a big round white with a disc in it, which is what
  // `eyes.simple` draws (docs/EYE_BUILDS.md).
  assert.equal(BIRD_FACE_PARTS.length, 24);
  const categories = {};
  for (const asset of BIRD_FACE_PARTS) categories[asset.category] = (categories[asset.category] || 0) + 1;
  assert.deepEqual(categories, { head: 6, eyebrows: 5, mouth: 6, accessory: 7 },
    'five rows and not one new category: the beaks are mouths and the crests accessories');
  for (const asset of BIRD_FACE_PARTS) {
    assert.equal(asset.origin, 'builtin');
    assert.ok(Object.isFrozen(asset), `${asset.id} is frozen`);
    assert.ok(FACE_PART_LIBRARY.has(asset.id), `${asset.id} is in the library`);
  }
  // The planche's row 6 is four accessories and two of them already existed,
  // because an accessory that declares no `morphologies` is universal -- and
  // its eye row is the library's own three builds, for the same reason. That is
  // why thirty-three pieces cost twenty-four drawings.
  for (const id of ['accessory.glasses', 'accessory.bow-tie']) {
    assert.ok(FACE_PART_LIBRARY.has(id), `${id} was already here`);
    assert.deepEqual([...FACE_PART_LIBRARY.get(id).morphologies], [], `${id} suits every kind of face, a bird included`);
  }
});

test('MASC-01 drew a bird correctly: six rows onto six slots, and no table amended', () => {
  // The claim this pack exists to test, checkable rather than asserted in a
  // comment. Where the robot pack had to add `ears` and `eyebrows` to
  // MORPHOLOGY_TABLE before a line could be drawn, nothing was added here.
  const offered = morphologySlots('beak').map((slot) => slot.id);
  assert.deepEqual(offered, ['head', 'eyes', 'pupils', 'eyebrows', 'beak', 'crest', 'accessory']);
  const drawn = [...new Set(BIRD_FACE_PARTS.map((asset) => assetSlot(asset)))];
  assert.deepEqual(drawn.filter((slot) => !offered.includes(slot)), [], 'every drawing has a row to be offered in');
  // And what a bird has not got, the morphology left out before anybody drew
  // one: there is no nose row, no mouth row, no ears row and no hair row on the
  // planche either.
  for (const absent of ['nose', 'mouth', 'ears', 'hair', 'facialHair']) {
    assert.equal(offered.includes(absent), false, `a bird is not made of ${absent}`);
    assert.equal(BIRD_FACE_PARTS.some((asset) => assetSlot(asset) === absent), false, `and the pack draws no ${absent}`);
  }
});

test('the pack narrows to birds, except the one drawing that suits everybody', () => {
  // Twenty-nine say `beak`; the monocle says nothing, which is how the library
  // spells universal. Row 6 is captioned "compatibles" and a monocle suits a
  // person as readily as an owl, so narrowing it would be inventing a rule the
  // planche does not have.
  const universal = BIRD_FACE_PARTS.filter((asset) => !asset.morphologies?.length);
  assert.deepEqual(universal.map((asset) => asset.id), ['accessory.monocle']);
  for (const asset of BIRD_FACE_PARTS) {
    if (asset === universal[0]) continue;
    assert.deepEqual(compatibleMorphologies(asset), ['beak'], asset.id);
  }
  assert.equal(NARROWED.has('accessory.monocle'), false, 'and the fixture agrees it is not one of the narrowed');
  // Beaks and crests are rows of their own on screen and ordinary categories to
  // the rig -- the arrangement the muzzles and the antennae already use.
  const slotted = BIRD_FACE_PARTS.filter((asset) => assetSlot(asset) !== asset.category);
  assert.deepEqual(slotted.map((asset) => `${asset.id} (${asset.category}) -> ${assetSlot(asset)}`), [
    'mouth.beak-owl (mouth) -> beak', 'mouth.beak-duck (mouth) -> beak', 'mouth.beak-parrot (mouth) -> beak',
    'mouth.beak-crow (mouth) -> beak', 'mouth.beak-small (mouth) -> beak', 'mouth.beak-wide (mouth) -> beak',
    'accessory.crest-owl-tufts (accessory) -> crest', 'accessory.crest-simple (accessory) -> crest',
    'accessory.crest-messy-tuft (accessory) -> crest', 'accessory.crest-smooth-feather (accessory) -> crest',
    'accessory.crest-parrot-tall (accessory) -> crest', 'accessory.crest-round-tuft (accessory) -> crest'
  ]);
});

test('drawing the beak and the crest turned the Beak kind of face on', () => {
  // MASC-05's mechanism, three times now, and the fourth kind of five.
  const kinds = availableMorphologies({ library: FACE_PART_LIBRARY });
  assert.deepEqual(kinds.map((kind) => `${kind.id}:${kind.available}`), ['human:true', 'muzzle:true', 'beak:true', 'robot:true', 'monster:false']);
  assert.deepEqual(kinds.find((kind) => kind.id === 'beak').missing, []);
  assert.deepEqual(kinds.find((kind) => kind.id === 'beak').distinctive, ['beak', 'crest'], 'and those two are what makes one');
  // Monster is the one left, and it still says exactly what it wants.
  assert.deepEqual(kinds.find((kind) => kind.id === 'monster').missing, ['horns']);
});

/* ── A beak is a mouth, which is the pack's whole argument ──────────────── */

test('a beak keeps every control a mouth has, and invents none', () => {
  const beaks = BIRD_FACE_PARTS.filter((asset) => assetSlot(asset) === 'beak');
  assert.equal(beaks.length, 6);
  for (const beak of beaks) {
    assert.equal(beak.category, 'mouth', `${beak.id} installs as a mouth`);
    assert.match(beak.id, /^mouth\.beak-/, 'and is prefixed by the category it installs through');
    assert.deepEqual(beak.capabilities, ['mouthOpen', 'smile', 'mouthWidth'], `${beak.id}: a beak opens`);
    assert.deepEqual(Object.keys(beak.roles), ['mouth'], `${beak.id} names one element, as a mouth does`);
    assert.equal(beak.mountPoint, 'mouth.center');
    // Two mandibles inside one group, and the group is what the role names:
    // `mouthOpen` is a `scaleY` on it, so the beak gapes about its own centre.
    assert.equal((beak.artwork.match(/<path id="beak(Upper|Lower)"/g) || []).length, 2, `${beak.id} is drawn as two mandibles`);
    assert.match(beak.artwork, /<g id="mouth"/, `${beak.id}'s role names the group holding both`);
    assert.equal(beak.drivers, undefined, `${beak.id} leaves the control to its category, as every shipped mouth does`);
  }
  // Drawn above the lip line, which is what makes a beak a beak rather than a
  // large mouth: the fit keeps the offset from the anchor, so a part saying
  // "higher than a mouth" costs nothing and lands where it was drawn.
  const lip = 176;
  for (const beak of beaks) {
    const middle = beak.referenceBox.y + beak.referenceBox.height / 2;
    assert.ok(middle < lip, `${beak.id} sits at ${middle}, which is not above the lip line at ${lip}`);
  }
  // And no control anywhere in the pack that the library did not already have.
  const known = new Set(FACE_PART_LIBRARY.list().filter((asset) => !ids.has(asset.id)).flatMap((asset) => [
    ...asset.capabilities, ...Object.values(asset.parts || {}).flatMap((drawn) => drawn.capabilities || [])
  ]));
  for (const asset of BIRD_FACE_PARTS) {
    for (const control of [...asset.capabilities, ...Object.values(asset.parts || {}).flatMap((drawn) => drawn.capabilities || [])]) {
      assert.ok(known.has(control), `${asset.id} claims ${control}, which nothing else in the library has`);
    }
  }
});

test('a bird head is soft, so it keeps its jaw — unlike a robot shell', () => {
  // The contrast worth writing down. A bolted plate does not stretch and the
  // robot shells ship no jaw; a feathered head does, so these do — the same
  // outline drawn twice, at rest and with its lower half dropped. What a bird
  // has not got is a separate mouth, so `jawOpen` drops the face and
  // `mouthOpen` opens the beak, and the two read together.
  const heads = BIRD_FACE_PARTS.filter((asset) => asset.category === 'head');
  assert.equal(heads.length, 6);
  for (const head of heads) {
    assert.ok(head.parts?.jaw, `${head.id} ships no jaw, and a feathered head is soft`);
    assert.deepEqual(head.parts.jaw.capabilities, ['jawOpen']);
    assert.ok(head.parts.jaw.drivers.jawOpen.posePath, `${head.id}'s jaw is a second outline, not a transform`);
  }
});

test('the crest anchors at head.top, which closes MASC-09 rather than reopening it', () => {
  // MASC-09 left two candidates and said the first real crest would decide:
  // `head.top` is the skull, `hair.top` the top of whatever hair the face has,
  // "which on a bird *is* the crest". The argument settles it without the
  // drawings: a `beak` face offers no hair slot at all, so `hair.top` would be
  // an anchor measured from something that can never be there.
  assert.equal(morphologySlots('beak').some((slot) => slot.id === 'hair'), false, 'there is no hair on a bird to measure from');
  const crests = BIRD_FACE_PARTS.filter((asset) => assetSlot(asset) === 'crest');
  assert.equal(crests.length, 6);
  for (const crest of crests) {
    assert.equal(crest.mountPoint, 'head.top', `${crest.id} stands on the crown`);
    assert.deepEqual(crest.turn.element, { depth: 0.35, side: null, narrow: true }, `${crest.id} sweeps, as a thing standing off the crown does`);
    assert.deepEqual(crest.capabilities, [], 'a crest is plumage, not a control');
  }
  // The parrot's is the tallest, and stands well into the artboard's headroom.
  assert.ok(part('accessory.crest-parrot-tall').referenceBox.y < -40, 'the fan reaches into the headroom above the artboard');
});

/* ── Six birds, over one set of rows ───────────────────────────────────── */

test('the six birds are recipes, and the sharing is exactly what the planche allows', () => {
  for (const id of SPECIES) {
    const preset = FACE_PRESET_LIBRARY.get(id);
    assert.ok(preset, `${id} is registered`);
    assert.equal(preset.morphology, 'beak');
    assert.ok(preset.tags.includes('bird'));
    for (const absent of ['nose', 'ears', 'hair', 'facialHair']) {
      assert.equal(preset.parts[absent], undefined, `${id} names a ${absent}, which a bird has not got`);
    }
    assert.match(preset.parts.mouth, /^mouth\.beak-/, `${id} wears a beak under the mouth key`);
    for (const asset of [...Object.values(preset.parts), ...preset.accessories]) {
      // Everything but the eyes, which come from the library's three builds.
      if (asset.startsWith('eyes.')) { assert.ok(['eyes.dot', 'eyes.simple', 'eyes.iris'].includes(asset), `${id} names ${asset}, which is not a build`); continue; }
      assert.ok(ids.has(asset), `${id} names ${asset}, which is not in the pack`);
    }
  }
  // Five brows for six birds, which the planche sets up by drawing five: the
  // duck and the parrot are both curious, and it is the only piece two share.
  const named = SPECIES.flatMap((id) => {
    const preset = FACE_PRESET_LIBRARY.get(id);
    return [...Object.values(preset.parts), ...preset.accessories];
  });
  assert.equal(named.length, 30, 'four parts and a crest each');
  assert.equal(new Set(named).size, 25, 'over twenty-five drawings');
  const twice = named.filter((id, index) => named.indexOf(id) !== index);
  // The brows are still the planche's own sharing. The eyes are shared five
  // ways now, which is the argument for having three builds rather than six
  // drawings: what told the six birds apart was never the construction.
  assert.deepEqual(twice, ['eyes.simple', 'eyes.simple', 'eyebrows.bird-curious', 'eyes.simple', 'eyes.simple']);
  // The monocle is what no recipe names, and it is the catalogue by design.
  assert.deepEqual(BIRD_FACE_PARTS.filter((asset) => !new Set(named).has(asset.id)).map((asset) => asset.id), ['accessory.monocle']);
});

test('six plumages, no new token, and nothing named for a colour', () => {
  for (const id of SPECIES) {
    const palette = FACE_PALETTES[FACE_PRESET_LIBRARY.get(id).palette];
    assert.ok(palette, `${id} paints in a palette that exists`);
    assert.deepEqual(Object.keys(palette), [...PALETTE_TOKENS], 'every token a colour, as every palette has');
  }
  // The thirteenth arrived for the iris build and not for a bird: nothing in
  // this pack paints with it, and an owl's amber eye is now a palette away.
  assert.equal(PALETTE_TOKENS.length, 13, 'and none of them added by a bird');
  assert.deepEqual(BIRD_FACE_PARTS.filter((asset) => asset.palette.includes('iris')), []);
  for (const asset of BIRD_FACE_PARTS) {
    assert.doesNotMatch(asset.id, /cream|orange|slate|amber|blue|yellow|green|grey|gray|pink|white|black/,
      `${asset.id} is named for a colour, and a colour is a palette`);
  }
});

test('a bird face is offered the birds and everything universal', () => {
  assert.deepEqual(presetsFor({ morphology: 'beak' }).map((item) => item.id), SPECIES);
  // The monocle reaches every kind of face, which is the point of it shipping
  // without `morphologies` — a drawing the bird pack made and everybody got.
  assert.deepEqual(compatibleMorphologies(part('accessory.monocle')).sort(), ['beak', 'human', 'monster', 'muzzle', 'robot']);
});

test('every drawing in the pack places, and the review sheet has nothing to say about any of them', () => {
  const reviewed = reviewAssets({ morphology: 'beak' }).filter((item) => ids.has(item.id));
  assert.equal(reviewed.length, 24, 'every one of them is reviewed');
  assert.deepEqual(reviewed.filter((item) => item.geometryIssues.length).map((item) => `${item.id}: ${item.geometryIssues.map((issue) => issue.code).join(', ')}`), []);
  for (const item of reviewed) assert.ok(item.fit, `${item.id} has a fit onto the template`);
});
