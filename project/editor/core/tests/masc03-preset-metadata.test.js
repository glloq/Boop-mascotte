import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_PRESET_LIBRARY, createFacePresetRegistry, normalizeFacePreset, presetDrawings, validateFacePreset } from '../face-library/face-presets.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';

/**
 * MASC-03 — a preset says what kind of face it makes.
 *
 * This is where a species lives. `cat`, `dog` and `fox` are presets inside the
 * `muzzle` morphology, never morphologies of their own, which is the whole
 * reason adding one costs drawings rather than a release. The check worth
 * having is therefore the one that catches a preset whose parts cannot make
 * the kind of face it claims — a human nose on a beak.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace('.', '-');
  const role = { mouth: 'mouth', head: 'head', nose: 'nose', accessory: 'element' }[category] || 'element';
  return { id, category, name: id, artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`, roles: { [role]: `${root}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra };
};

const world = () => {
  const library = createFacePartRegistry();
  library.registerMany([
    part('head.round', 'head'),
    part('mouth.beak', 'mouth', { slot: 'beak', morphologies: ['beak'], tags: ['duck'] }),
    part('nose.human', 'nose', { morphologies: ['human'] }),
    part('accessory.hat', 'accessory')
  ]);
  return { library, presets: createFacePresetRegistry({ library }) };
};

const codes = (input, library) => validateFacePreset(input, library).issues.map((issue) => `${issue.severity}:${issue.code}`);

test('a preset carries the kind of face it makes, and the words to find it by', () => {
  const item = normalizeFacePreset({ id: 'cat', name: 'Cat', morphology: ' muzzle ', tags: [' Cat ', 'pet', 'pet'], parts: { head: 'head.round' } });
  assert.equal(item.morphology, 'muzzle');
  assert.deepEqual(item.tags, ['cat', 'pet']);
  assert.ok(Object.isFrozen(item.tags));
  // And every preset written before this said nothing, which stays legal.
  for (const preset of FACE_PRESET_LIBRARY.list()) {
    assert.equal(preset.morphology, '', `${preset.id} claims a kind of face, and the baseline says none does`);
    assert.deepEqual(preset.tags, []);
  }
});

test('a preset cannot claim a kind of face its own parts are not drawn for', () => {
  const { library } = world();
  // The check that earns its keep: a human nose on a bird.
  assert.deepEqual(codes({ id: 'duck', name: 'Duck', morphology: 'beak', parts: { head: 'head.round', mouth: 'mouth.beak' } }, library), [],
    'a universal head and a beak make a bird');
  assert.deepEqual(codes({ id: 'duck', name: 'Duck', morphology: 'beak', parts: { head: 'head.round', nose: 'nose.human' } }, library),
    ['error:parts-asset-morphology']);
  assert.deepEqual(codes({ id: 'duck', name: 'Duck', morphology: 'beak', parts: { head: 'head.round' }, accessories: ['accessory.hat'] }, library), [],
    'an accessory that says nothing suits every kind of face');
  assert.deepEqual(codes({ id: 'duck', name: 'Duck', morphology: 'unicorn', parts: { head: 'head.round' } }, library), ['error:morphology-unknown']);
  // A preset that claims nothing is checked against nothing: the 47 shipped
  // assets and six shipped presets stay exactly as valid as they were.
  assert.deepEqual(codes({ id: 'any', name: 'Any', parts: { head: 'head.round', nose: 'nose.human', mouth: 'mouth.beak' } }, library), []);
});

test('a catalogued style with nothing drawn in it is fine; a style nobody has heard of is a warning', () => {
  const { library, presets } = world();
  // Asking for a catalogued style before its drawings exist is the normal
  // order of work, and the whole reason `styledAsset` falls back. No complaint.
  const wished = validateFacePreset({ id: 'soft', name: 'Soft', style: 'soft-cartoon', parts: { head: 'head.round' } }, library);
  assert.deepEqual(wished.issues, []);
  const registered = presets.register({ id: 'soft', name: 'Soft', style: 'soft-cartoon', parts: { head: 'head.round' } });
  assert.deepEqual(presetDrawings(registered, library).parts, { head: 'head.round' }, 'the wish is not granted yet, and nothing is lost');

  // Draw one, and the preset already registered wears it: a style is resolved
  // when the face is dressed, never stored on the preset.
  library.register(part('head.round-soft', 'head', { variant: { of: 'head.round', style: 'soft-cartoon' } }));
  assert.deepEqual(presetDrawings(presets.get('soft'), library).parts, { head: 'head.round-soft' });

  // A style that is in no catalogue and that nobody has drawn is almost always
  // a typo, and a typo here silently dresses the face in the wrong drawings.
  const typo = validateFacePreset({ id: 'oops', name: 'Oops', style: 'soft-cartoonn', parts: { head: 'head.round' } }, library);
  assert.deepEqual(typo.issues.map((issue) => `${issue.severity}:${issue.code}`), ['warning:style-unknown']);
  assert.equal(typo.ok, true, 'worth saying, not worth refusing');

  // And a pack bringing a look of its own is not a typo: the drawing is what
  // makes the style real, catalogue or no catalogue.
  library.register(part('head.round-woodcut', 'head', { variant: { of: 'head.round', style: 'woodcut' } }));
  assert.deepEqual(validateFacePreset({ id: 'cut', name: 'Cut', style: 'woodcut', parts: { head: 'head.round' } }, library).issues, []);
});

test('a preset tag is a tag, and a refusal names errors rather than everything said', () => {
  const { library } = world();
  assert.deepEqual(codes({ id: 'x', name: 'X', parts: { head: 'head.round' }, tags: ['Big Cat'] }, library), ['error:tag-format']);
  // One real problem should read as one problem: a preset asking for an
  // undrawn style *and* naming a part that does not exist says both, and only
  // the second keeps it out.
  const both = validateFacePreset({ id: 'x', name: 'X', style: 'nobody-drew-this', parts: { head: 'head.nobody' } }, library);
  assert.deepEqual(both.errors.map((issue) => issue.code), ['parts-asset-unknown']);
  assert.deepEqual(both.warnings.map((issue) => issue.code), ['style-unknown']);
  assert.equal(both.ok, false);
});
