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
  assert.deepEqual(FACE_PART_LIBRARY.list().map((asset) => asset.id), ['head.round', 'head.oval', 'head.square-soft', 'head.narrow', 'eyes.round-large', 'eyes.round-small', 'eyes.sleepy', 'eyes.cartoon', 'eyes.minimal', 'eyebrows.thin', 'eyebrows.normal', 'eyebrows.thick', 'eyebrows.flat', 'eyebrows.expressive', 'nose.dot', 'nose.hook', 'nose.soft', 'nose.cartoon', 'mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive', 'ears.round', 'ears.large', 'ears.small', 'hair.short', 'hair.spiky', 'hair.curly', 'hair.long', 'hair.balding', 'hair.bald', 'facialhair.moustache', 'facialhair.large-moustache', 'facialhair.goatee', 'facialhair.beard', 'facialhair.sideburns', 'accessory.glasses', 'accessory.square-glasses', 'accessory.hat', 'accessory.earring', 'accessory.earring-right', 'accessory.bow-tie']);
  assert.deepEqual(FACE_PART_LIBRARY.list('mouth').map((asset) => asset.id), ['mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive']);
  assert.deepEqual(FACE_PART_LIBRARY.list('pupils'), [], 'the pupils come with the eyes');
  assert.equal(FACE_PART_LIBRARY.get('nose.dot').origin, 'builtin');
  assert.ok(Object.isFrozen(FACE_PART_LIBRARY.get('nose.dot')));
  assert.equal(FACE_PART_LIBRARY.get('nope'), null);
  const categories = FACE_PART_LIBRARY.categories();
  assert.deepEqual(categories.map((category) => category.id), [...FACE_PART_CATEGORY_IDS]);
  assert.deepEqual(Object.fromEntries(categories.map((category) => [category.id, category.count])), { head: 4, eyes: 5, pupils: 0, eyelids: 0, eyebrows: 5, nose: 4, mouth: 5, ears: 3, hair: 6, facialHair: 5, accessory: 6 });
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
  assert.deepEqual(FACE_PART_LIBRARY.list('accessory').map((item) => item.id), ['accessory.glasses', 'accessory.square-glasses', 'accessory.hat', 'accessory.earring', 'accessory.earring-right', 'accessory.bow-tie', 'accessory.round-glasses'], 'after the built-in ones');
  assert.throws(() => registerFacePart(glasses), FacePartError, 'no category, and the id is taken');
  assert.equal(FACE_PART_LIBRARY.size, before + 1);
  FACE_PART_LIBRARY.remove('accessory.round-glasses');
  assert.equal(FACE_PART_LIBRARY.size, before);
});

/**
 * The style axis (docs/FACE_PART_LIBRARY.md, "The style axis"; roadmap
 * V3-05). A drawing that restyles another is held like any other -- `get`
 * finds it, an install puts it on, the animation matrix drives it -- and is
 * reached through the drawing it restyles, so a restyle of every part for
 * every preset is drawings, never cards.
 */
test('a drawing that restyles another is in the library and not in the category\'s cards', () => {
  const registry = createFacePartRegistry();
  registry.registerMany(BUILTIN_FACE_PARTS);
  const workshop = { ...MOUTH_SIMPLE, id: 'mouth.simple-workshop', name: 'Simple, in the workshop style', artwork: MOUTH_SIMPLE.artwork.replace('id="mouth-simple"', 'id="mouth-simple-workshop"'), variant: { of: 'mouth.simple', style: 'workshop' } };
  registry.register(workshop);
  assert.equal(registry.size, BUILTIN_FACE_PARTS.length + 1);
  assert.equal(registry.get('mouth.simple-workshop').name, 'Simple, in the workshop style', 'the library holds it');
  assert.deepEqual(registry.list('mouth').map((asset) => asset.id), ['mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive', 'mouth.simple-workshop'], 'everything the library holds');
  assert.deepEqual(registry.cards('mouth').map((asset) => asset.id), ['mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive'], 'and not a card of its own');
  assert.equal(registry.cards().length, registry.size - 1);
  // Reached through the drawing it restyles, by name.
  assert.equal(registry.variant('mouth.simple', 'workshop').id, 'mouth.simple-workshop');
  assert.equal(registry.variant('mouth.simple', 'night'), null, 'a style nobody has drawn yet');
  assert.equal(registry.variant('mouth.wide', 'workshop'), null);
  assert.equal(registry.variant('mouth.simple', ''), null);
  assert.deepEqual(registry.variantsOf('mouth.simple').map((asset) => asset.id), ['mouth.simple-workshop']);
  assert.deepEqual(registry.variantsOf('mouth.wide'), []);
  // A second drawing cannot answer for the same style of the same part.
  assert.throws(() => registry.register({ ...workshop, id: 'mouth.simple-shed' }), (error) => error.issues.some((issue) => issue.code === 'variant-taken'));
  registry.remove('mouth.simple-workshop');
  assert.equal(registry.variant('mouth.simple', 'workshop'), null, 'forgotten, and the style with it');
});

test('a pack may write a style down before the drawing it restyles, and is taken in as one', () => {
  const registry = createFacePartRegistry();
  const simple = { ...MOUTH_SIMPLE };
  const workshop = { ...MOUTH_SIMPLE, id: 'mouth.simple-workshop', name: 'Workshop', artwork: MOUTH_SIMPLE.artwork.replace('id="mouth-simple"', 'id="mouth-simple-workshop"'), variant: { of: 'mouth.simple', style: 'workshop' } };
  registry.registerMany([workshop, simple]);
  assert.equal(registry.variant('mouth.simple', 'workshop').id, 'mouth.simple-workshop', 'checked against the rest of the batch, not against the order it is in');
  const other = createFacePartRegistry();
  assert.throws(() => other.registerMany([workshop]), (error) => error.issues.some((issue) => issue.code === 'variant-unknown'), 'and a style of a drawing nobody ships is refused');
  assert.equal(other.size, 0);
  assert.throws(() => other.registerMany([simple, workshop, { ...workshop, id: 'mouth.simple-shed' }]), (error) => error.issues.some((issue) => issue.code === 'variant-taken'), 'two answers for one style, in one pack');
  assert.equal(other.size, 0);
});

/**
 * The artboard is 240 x 240 (`core/sample/templates/face-artwork.js`), and the
 * canvas clips to it. A drawing whose reference box leaves it is a drawing the
 * author sees cut off — the top hat's crown wanted 78 units of headroom above
 * a head whose top sits at y=22, so half the hat was simply not there.
 *
 * The fit moves an asset onto whatever face it lands on, but the box is what
 * the fit measures from and the template is the frame it is drawn in, so a box
 * that does not fit is wrong at the source rather than at the destination.
 */
test('every built-in drawing fits inside the artboard it is drawn in', () => {
  const ARTBOARD = { width: 240, height: 240 };
  const outside = BUILTIN_FACE_PARTS.flatMap((asset) => {
    const box = asset.referenceBox || {};
    const over = [];
    if (box.x < 0) over.push(`left by ${-box.x}`);
    if (box.y < 0) over.push(`top by ${-box.y}`);
    if (box.x + box.width > ARTBOARD.width) over.push(`right by ${box.x + box.width - ARTBOARD.width}`);
    if (box.y + box.height > ARTBOARD.height) over.push(`bottom by ${box.y + box.height - ARTBOARD.height}`);
    return over.length ? [`${asset.id}: ${over.join(', ')}`] : [];
  });
  assert.deepEqual(outside, [], 'these drawings would be clipped on the canvas');
});
