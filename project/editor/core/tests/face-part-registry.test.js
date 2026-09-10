import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_PART_LIBRARY, FacePartError, createFacePartRegistry, registerAccessory, registerFacePart } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';
import { FACE_PART_CATEGORY_IDS } from '../face-library/face-part-model.js';

/**
 * The library (docs/FACE_PART_LIBRARY.md): validated, frozen assets by id,
 * with the categories over them, and a door for packs to register through.
 */
const glasses = { id: 'accessory.round-glasses', name: 'Round glasses', artwork: '<g id="glasses"><circle id="frame" cx="0" cy="0" r="1"/></g>', roles: { element: 'frame' }, referenceBox: { x: 0, y: 0, width: 2, height: 2 } };

test('the editor\'s library ships the built-in assets, frozen and by category', () => {
  assert.equal(FACE_PART_LIBRARY.size, BUILTIN_FACE_PARTS.length);
  assert.deepEqual(FACE_PART_LIBRARY.list().map((asset) => asset.id), ['head.round', 'head.oval', 'head.square-soft', 'head.narrow', 'eyes.round-large', 'eyes.round-small', 'eyes.sleepy', 'eyebrows.thin', 'eyebrows.thick', 'eyebrows.flat', 'nose.dot', 'nose.hook', 'nose.soft', 'nose.cartoon', 'mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive', 'ears.round', 'ears.large', 'ears.small', 'hair.short', 'hair.spiky', 'hair.curly', 'hair.long', 'hair.bald', 'facialhair.moustache', 'facialhair.goatee', 'facialhair.beard', 'facialhair.sideburns', 'accessory.glasses', 'accessory.hat', 'accessory.earring', 'accessory.bow-tie']);
  assert.deepEqual(FACE_PART_LIBRARY.list('mouth').map((asset) => asset.id), ['mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive']);
  assert.deepEqual(FACE_PART_LIBRARY.list('pupils'), [], 'the pupils come with the eyes');
  assert.equal(FACE_PART_LIBRARY.get('nose.dot').origin, 'builtin');
  assert.ok(Object.isFrozen(FACE_PART_LIBRARY.get('nose.dot')));
  assert.equal(FACE_PART_LIBRARY.get('nope'), null);
  const categories = FACE_PART_LIBRARY.categories();
  assert.deepEqual(categories.map((category) => category.id), [...FACE_PART_CATEGORY_IDS]);
  assert.deepEqual(Object.fromEntries(categories.map((category) => [category.id, category.count])), { head: 4, eyes: 3, pupils: 0, eyelids: 0, eyebrows: 3, nose: 4, mouth: 5, ears: 3, hair: 5, facialHair: 4, accessory: 4 });
});

test('a registry validates on the way in and refuses with the issues attached', () => {
  const registry = createFacePartRegistry();
  const asset = registry.register(MOUTH_SIMPLE);
  assert.equal(asset.id, 'mouth.simple');
  assert.equal(registry.has('mouth.simple'), true);
  assert.throws(() => registry.register(MOUTH_SIMPLE), (error) => error instanceof FacePartError && error.issues.some((item) => item.code === 'id-taken') && /already registered/.test(error.message));
  assert.throws(() => registry.register({ ...MOUTH_SIMPLE, id: 'mouth.broken', artwork: '<g id="x"><script/></g>' }), (error) => error.name === 'FacePartError' && error.issues.map((item) => item.code).includes('artwork-unsafe'));
  assert.equal(registry.size, 1, 'a refused asset leaves nothing behind');
  assert.equal(registry.validate({}).ok, false, 'and can be asked without registering');
  assert.equal(registry.remove('mouth.simple'), true);
  assert.equal(registry.remove('mouth.simple'), false);
  assert.equal(registry.size, 0);
});

test('a pack registers all of its assets or none of them', () => {
  const registry = createFacePartRegistry();
  assert.throws(() => registry.registerMany([MOUTH_SIMPLE, { ...MOUTH_SIMPLE, id: 'mouth.dup', name: '' }]), /name/);
  assert.equal(registry.size, 0, 'the good one was not kept');
  assert.throws(() => registry.registerMany([MOUTH_SIMPLE, MOUTH_SIMPLE]), /appears twice/);
  assert.equal(registry.size, 0);
  const registered = registry.registerMany(BUILTIN_FACE_PARTS);
  assert.equal(registered.length, BUILTIN_FACE_PARTS.length);
  assert.equal(registry.size, BUILTIN_FACE_PARTS.length);
});

test('a module outside the editor registers into the shared library, and an accessory is one of its parts', () => {
  const before = FACE_PART_LIBRARY.size;
  const asset = registerAccessory(glasses);
  assert.equal(asset.category, 'accessory');
  assert.equal(asset.mountPoint, 'head.center', 'the category\'s default mount point');
  assert.equal(FACE_PART_LIBRARY.size, before + 1);
  assert.deepEqual(FACE_PART_LIBRARY.list('accessory').map((item) => item.id), ['accessory.glasses', 'accessory.hat', 'accessory.earring', 'accessory.bow-tie', 'accessory.round-glasses'], 'after the built-in ones');
  assert.throws(() => registerFacePart(glasses), FacePartError, 'no category, and the id is taken');
  assert.equal(FACE_PART_LIBRARY.size, before + 1);
  FACE_PART_LIBRARY.remove('accessory.round-glasses');
  assert.equal(FACE_PART_LIBRARY.size, before);
});
