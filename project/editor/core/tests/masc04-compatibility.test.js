import test from 'node:test';
import assert from 'node:assert/strict';
import { assetsFor, describeRestylePlan, morphologiesOfFace, presetCompatibility, presetMorphology, presetsFor, restylePlan, slotsFor } from '../face-library/compatibility.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, createFacePresetRegistry } from '../face-library/face-presets.js';
import { ANIMAL_FACE_PARTS } from '../face-library/builtin/animals/index.js';

/**
 * MASC-04 — the pure layer between the library and the builder.
 *
 * It answers and never writes. The behaviour worth guarding is the fallback:
 * a style is a wish, a wish nobody has drawn leaves the drawing alone, and
 * every answer says out loud how much of the wish it could grant. A restyle
 * that quietly took a part off the face because its replacement did not exist
 * would be the worst failure this layer could have, so `kept` is asserted
 * everywhere `replace` is.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace('.', '-');
  const role = { mouth: 'mouth', head: 'head', nose: 'nose', ears: 'leftEar', accessory: 'element' }[category] || 'element';
  return { id, category, name: id, artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`, roles: { [role]: `${root}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra };
};

function world() {
  const library = createFacePartRegistry();
  library.registerMany([
    part('head.round', 'head'),
    part('head.round-flat', 'head', { variant: { of: 'head.round', style: 'flat' } }),
    part('mouth.plain', 'mouth'),
    part('mouth.beak', 'mouth', { slot: 'beak', morphologies: ['beak'], tags: ['duck'] }),
    part('nose.human', 'nose', { morphologies: ['human'] }),
    part('accessory.muzzle-cat', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'], tags: ['cat'] })
  ]);
  const presets = createFacePresetRegistry({ library });
  presets.register({ id: 'person', name: 'Person', morphology: 'human', parts: { head: 'head.round', nose: 'nose.human' } });
  presets.register({ id: 'duck', name: 'Duck', morphology: 'beak', parts: { head: 'head.round', mouth: 'mouth.beak' } });
  presets.register({ id: 'anything', name: 'Anything', parts: { head: 'head.round' } });
  return { library, presets };
}

/** A face wearing library drawings: what `wornFaceParts` reads. */
const wearing = (pairs) => ({
  elements: Object.fromEntries(pairs.map(([, , root]) => [root, {}])),
  semanticParts: Object.fromEntries(pairs.map(([type, assetId, root], index) => [`p${index}`, { id: `p${index}`, type, assetId, assetRoot: root }]))
});

test('a slot offers the cards drawn for this kind of face, and a restyle is never a card', () => {
  const { library } = world();
  assert.deepEqual(assetsFor({ library, slot: 'head' }).map((item) => item.card.id), ['head.round'], 'the soft one is reached through it, not beside it');
  assert.deepEqual(assetsFor({ library, slot: 'beak' }).map((item) => item.card.id), ['mouth.beak']);
  assert.deepEqual(assetsFor({ library, slot: 'mouth' }).map((item) => item.card.id), ['mouth.plain'], 'and a beak is offered as a beak, not among the mouths');
  assert.deepEqual(assetsFor({ library, slot: 'muzzle' }).map((item) => item.card.id), ['accessory.muzzle-cat']);

  // The two things a card is, once a style is chosen: what is listed, and what
  // a press installs. A caller that conflated them would show one name and put
  // another drawing on.
  const [head] = assetsFor({ library, slot: 'head', style: 'flat' });
  assert.deepEqual([head.card.id, head.drawing.id, head.restyled], ['head.round', 'head.round-flat', true]);
  const [plain] = assetsFor({ library, slot: 'mouth', style: 'flat' });
  assert.deepEqual([plain.card.id, plain.drawing.id, plain.restyled], ['mouth.plain', 'mouth.plain', false]);
});

test('a kind of face offers its own slots, and says which ones nobody has drawn for', () => {
  const { library } = world();
  const beak = slotsFor({ library, morphology: 'beak' });
  assert.deepEqual(beak.map((entry) => entry.slot.id), ['head', 'eyes', 'pupils', 'eyebrows', 'beak', 'crest', 'accessory']);
  assert.equal(beak.find((entry) => entry.slot.id === 'beak').count, 1);
  // Empty rather than absent: a slot with nothing in it is a gap somebody can
  // fill, and hiding it would hide the gap too.
  assert.equal(beak.find((entry) => entry.slot.id === 'crest').count, 0);
  // The human nose is not offered on a bird, and the universal head is.
  assert.deepEqual(slotsFor({ library, morphology: 'human' }).find((entry) => entry.slot.id === 'nose').assets.map((item) => item.card.id), ['nose.human']);
  assert.deepEqual(beak.find((entry) => entry.slot.id === 'head').assets.map((item) => item.card.id), ['head.round']);
  assert.deepEqual(slotsFor({ library, morphology: 'nope' }), []);
});

test('a preset is offered for a kind of face only when its own parts can make one', () => {
  const { library, presets } = world();
  assert.deepEqual(presetsFor({ presets, library, morphology: 'human' }).map((item) => item.id), ['person', 'anything']);
  assert.deepEqual(presetsFor({ presets, library, morphology: 'beak' }).map((item) => item.id), ['duck']);
  assert.deepEqual(presetsFor({ presets, library, morphology: 'muzzle' }).map((item) => item.id), [],
    'a preset naming a human nose cannot make a cat, and one naming nothing special is a person');
  assert.deepEqual(presetsFor({ presets, library }).map((item) => item.id), ['person', 'duck', 'anything'], 'no kind asked, no filtering');

  // A preset claiming one kind is not offered under another, even when its
  // parts would allow it: two answers about one preset is one too many.
  assert.equal(presetCompatibility(presets.get('duck'), { library, morphology: 'human' }).ok, false);
  // And a preset claiming nothing is read from its drawings rather than
  // treated as universal (MASC-08B): a head and nothing distinctive is a
  // person, which is the honest answer and not the generous one.
  assert.equal(presetCompatibility(presets.get('anything'), { library, morphology: 'monster' }).ok, false);
  assert.equal(presetMorphology(presets.get('anything'), { library }), 'human');
  assert.equal(presetMorphology(presets.get('duck'), { library }), 'beak', 'a claim is taken at its word');
});

test('a preset that says nothing about the kind of face it makes is read from its drawings', () => {
  const { library, presets } = world();
  // The slots its parts sit in, and only the ones a person has not got.
  presets.register({ id: 'tabby', name: 'Tabby', parts: { head: 'head.round' }, accessories: ['accessory.muzzle-cat'] });
  assert.equal(presetMorphology(presets.get('tabby'), { library }), 'muzzle');
  assert.deepEqual(presetsFor({ presets, library, morphology: 'muzzle' }).map((item) => item.id), ['tabby']);
  assert.deepEqual(presetsFor({ presets, library, morphology: 'human' }).map((item) => item.id), ['person', 'anything']);

  // A preset whose distinctive slots no one kind of face holds claims nothing
  // rather than a kind that would be a guess.
  presets.register({ id: 'chimera', name: 'Chimera', parts: { mouth: 'mouth.beak' }, accessories: ['accessory.muzzle-cat'] });
  assert.equal(presetMorphology(presets.get('chimera'), { library }), '');

  // An explicit claim is never second-guessed, even one its parts contradict.
  presets.register({ id: 'insists', name: 'Insists', morphology: 'robot', parts: { head: 'head.round' } });
  assert.equal(presetMorphology(presets.get('insists'), { library }), 'robot');
});

test('a restyle replaces what it can and keeps the rest, and says which is which', () => {
  const { library, presets } = world();
  const reading = presetCompatibility(presets.get('person'), { library, style: 'flat' });
  assert.deepEqual([reading.restyled, reading.kept], [['head.round'], ['nose.human']]);

  const face = wearing([['head', 'head.round', 'headRoot'], ['nose', 'nose.human', 'noseRoot']]);
  const plan = restylePlan(face, 'flat', { library });
  assert.deepEqual(plan.replace, [{ partId: 'p0', category: 'head', from: 'head.round', to: 'head.round-flat' }]);
  assert.deepEqual(plan.kept, [{ partId: 'p1', category: 'nose', assetId: 'nose.human' }]);
  assert.equal(describeRestylePlan(plan), '1 part restyled, 1 kept as it is.');

  // The sentence the author is owed when the wish grants nothing: never
  // silence, and never a removal.
  const nothing = restylePlan(face, 'woodcut', { library });
  assert.deepEqual(nothing.replace, []);
  assert.equal(nothing.kept.length, 2);
  assert.equal(describeRestylePlan(nothing), 'Nothing can be redrawn in this style; 2 parts stay as they are.');
  assert.equal(describeRestylePlan(restylePlan({}, 'flat', { library })), 'Nothing on this face comes from the library yet.');

  // A plan is a plan: the document it was read from is untouched.
  assert.deepEqual(face, wearing([['head', 'head.round', 'headRoot'], ['nose', 'nose.human', 'noseRoot']]));
});

test('the kind of face a document is wearing is read from its parts, never stored', () => {
  const { library } = world();
  assert.deepEqual(morphologiesOfFace(wearing([['head', 'head.round', 'r']]), { library }), ['human', 'muzzle', 'beak', 'robot', 'monster'],
    'a face of universal drawings is every kind at once, which is what a new project is');
  assert.deepEqual(morphologiesOfFace(wearing([['head', 'head.round', 'r'], ['nose', 'nose.human', 'n']]), { library }), ['human']);
  assert.deepEqual(morphologiesOfFace(wearing([['nose', 'nose.human', 'n'], ['mouth', 'mouth.beak', 'm']]), { library }), [],
    'a human nose and a beak are no kind of face anybody has drawn');
  assert.deepEqual(morphologiesOfFace({}, { library }), ['human', 'muzzle', 'beak', 'robot', 'monster']);
});

test('the shipped library answers the same way it always did, and the animal pack only for its own kind', () => {
  // The 47 drawings that shipped before the animal pack declare no slot, no
  // kind and no style, so every one of their cards is still offered in every
  // kind of face, under its own category, unrestyled. The pack (MASC-10B) says
  // `muzzle`, so it joins a muzzle face's lists and no others -- which is the
  // whole difference between the two answers below.
  const animals = new Set(ANIMAL_FACE_PARTS.map((asset) => asset.id));
  for (const category of ['head', 'mouth', 'ears']) {
    const cards = FACE_PART_LIBRARY.cards(category).map((asset) => asset.id);
    const offered = assetsFor({ slot: category, morphology: 'monster' });
    assert.deepEqual(offered.map((item) => item.card.id), cards.filter((id) => !animals.has(id)));
    assert.ok(offered.every((item) => !item.restyled));
    assert.deepEqual(assetsFor({ slot: category, morphology: 'muzzle' }).map((item) => item.card.id), cards, 'a muzzle face is offered both halves');
  }
  // The six presets that shipped before name a head, a nose, a mouth and hair
  // and nothing a person has not got, so they are read as human (MASC-08B §16).
  // The Robot one among them is a square head and a bow tie -- a human-styled
  // robot, with neither an antenna nor a panel on it -- and calling it `robot`
  // would be telling the system something untrue about what it is made of. The
  // six animals name a muzzle, which is exactly what makes a muzzle face.
  assert.deepEqual(presetsFor({ morphology: 'human' }).map((item) => item.id), ['classic', 'professor', 'young', 'old', 'robot', 'minimal']);
  assert.deepEqual(presetsFor({ morphology: 'muzzle' }).map((item) => item.id), ['cat', 'dog', 'fox', 'bear', 'wolf', 'rabbit']);
  assert.deepEqual(presetsFor({ morphology: 'robot' }).map((item) => item.id), []);
  assert.deepEqual(presetsFor().map((item) => item.id), FACE_PRESET_LIBRARY.list().map((item) => item.id), 'no kind asked, no filtering');
  for (const item of FACE_PRESET_LIBRARY.list()) assert.equal(presetMorphology(item), item.morphology || 'human', `${item.id} is read as what it is made of`);
});
