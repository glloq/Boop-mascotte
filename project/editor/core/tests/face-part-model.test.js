import test from 'node:test';
import assert from 'node:assert/strict';
import { SEMANTIC_PART_REGISTRY, requiredSemanticRoles } from '../../rig-editor/semantic-parts/part-registry.js';
import {
  FACE_MOUNT_POINTS, FACE_PART_CATEGORIES, FACE_PART_CATEGORY_IDS, FACE_PART_ID, FACE_STYLE_ID, PALETTE_TOKENS,
  artworkIds, describeFacePartCapabilities, facePartCategory, normalizeFacePart, scanArtwork
} from '../face-library/face-part-model.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';
import { MOUTH_WIDE } from '../face-library/builtin/mouth-wide.js';

/**
 * What a face part is (docs/FACE_PART_LIBRARY.md). The categories are a
 * reading of the semantic part registry, so the rig stays the one place a
 * role or a movement is declared; the rest is a plain shape with defaults.
 */
test('the categories are the roadmap\'s eleven, each reading its semantic part', () => {
  assert.deepEqual([...FACE_PART_CATEGORY_IDS], ['head', 'eyes', 'pupils', 'eyelids', 'eyebrows', 'nose', 'mouth', 'ears', 'hair', 'facialHair', 'accessory']);
  for (const category of FACE_PART_CATEGORIES) {
    if (!category.part) { assert.equal(category.installable, false, `${category.id} says it cannot be installed yet`); assert.deepEqual([...category.roles], []); continue; }
    const definition = SEMANTIC_PART_REGISTRY[category.part];
    assert.ok(definition, `${category.id} names a real part`);
    assert.deepEqual([...category.roles], [...definition.roles], `${category.id} reads its roles from the rig`);
    assert.deepEqual([...category.required], [...requiredSemanticRoles(definition)]);
    assert.deepEqual([...category.controls], [...definition.controls], `${category.id} reads its movements from the rig`);
    assert.ok(FACE_MOUNT_POINTS.includes(category.mountPoint), `${category.id} mounts somewhere known`);
    assert.equal(category.installable, true);
  }
  assert.equal(facePartCategory('mouth').part, 'mouth');
  assert.deepEqual([...facePartCategory('mouth').required], ['mouth'], 'the cavity, the teeth and the tongue are optional');
  assert.equal(facePartCategory('facialHair').part, 'facialHair', 'facial hair has its part now (PR 9)');
  assert.deepEqual(FACE_PART_CATEGORIES.filter((category) => category.multiple).map((category) => category.id), ['facialHair', 'accessory'], 'a face wears several of these');
  assert.equal(facePartCategory('nope'), null);
  assert.ok(Object.isFrozen(FACE_PART_CATEGORIES[0]));
  assert.equal(PALETTE_TOKENS.length, 12);
});

test('an asset is normalised to one shape, defaults filled and frozen', () => {
  const asset = normalizeFacePart({ id: ' mouth.x ', category: 'mouth', name: ' X ', artwork: ' <g id="a"/> ', roles: { mouth: 'a', teeth: 7 }, capabilities: ['smile', 'smile', 3], referenceBox: { x: '1', y: 2, width: '3', height: 4 }, palette: ['mouth', 'mouth'] });
  assert.deepEqual(asset, { id: 'mouth.x', category: 'mouth', name: 'X', description: '', artwork: '<g id="a"/>', roles: { mouth: 'a' }, capabilities: ['smile'], drivers: {}, turn: {}, parts: {}, behind: [], paletteRoles: {}, depth: null, referenceBox: { x: 1, y: 2, width: 3, height: 4 }, mountPoint: 'mouth.center', host: null, variant: null, slot: '', morphologies: [], tags: [], palette: ['mouth'], origin: 'custom', pack: null });
  assert.ok(Object.isFrozen(asset) && Object.isFrozen(asset.roles) && Object.isFrozen(asset.capabilities) && Object.isFrozen(asset.parts));
  // Where it is offered, what it suits and what to find it by (MASC-02): all
  // three optional, and "said nothing" is kept as such rather than guessed at.
  const filed = normalizeFacePart({ id: 'mouth.b', category: 'mouth', slot: ' beak ', morphologies: ['beak', 'beak', 7], tags: [' Duck ', 'bird'] });
  assert.deepEqual({ slot: filed.slot, morphologies: filed.morphologies, tags: filed.tags }, { slot: 'beak', morphologies: ['beak'], tags: ['duck', 'bird'] });
  assert.ok(Object.isFrozen(filed.morphologies) && Object.isFrozen(filed.tags));
  // The other parts a drawing carries, and how it carries a movement.
  const composite = normalizeFacePart({ id: 'eyes.x', category: 'eyes', drivers: { eyeOpen: { property: ' scaleY ', amplitude: '0.12', offset: 0.88, roles: { leftEye: { amplitude: 1 } } }, nope: null }, parts: { gaze: { roles: { leftPupil: 'pl', rightPupil: 3 }, capabilities: ['lookX', 'lookX'] }, eyelids: { drivers: { eyeOpen: { property: 'translateY', amplitude: -20, offset: 20, roles: { leftLower: { amplitude: 20, offset: -20 } } } } }, bad: 4 } });
  assert.deepEqual(composite.drivers, { eyeOpen: { property: 'scaleY', amplitude: 0.12, offset: 0.88, roles: { leftEye: { amplitude: 1, offset: NaN } } } });
  assert.deepEqual(Object.keys(composite.parts), ['gaze', 'eyelids']);
  assert.deepEqual(composite.parts.gaze, { roles: { leftPupil: 'pl' }, capabilities: ['lookX'], drivers: {}, turn: {} });
  assert.deepEqual(composite.parts.eyelids.drivers.eyeOpen, { property: 'translateY', amplitude: -20, offset: 20, roles: { leftLower: { amplitude: 20, offset: -20 } } });
  assert.deepEqual(composite.parts.eyelids.roles, {});
  // And how each of its roles turns with the head, where the role table's own
  // answer would not do (docs/HEAD_POSE_2_5D.md, "Which parts turn").
  const turning = normalizeFacePart({ id: 'accessory.x', category: 'accessory', turn: { element: { depth: '0.7', narrow: 1, nope: 2 }, quiet: { dpeth: 1 }, bad: 5 }, parts: { gaze: { turn: { leftPupil: { side: ' left ' } } } } });
  assert.deepEqual(turning.turn, { element: { depth: 0.7, narrow: true }, quiet: {} }, 'a flag nobody knows is dropped, and a profile left saying nothing stays to be refused');
  assert.deepEqual(turning.parts.gaze.turn, { leftPupil: { side: 'left' } });
  const painted = normalizeFacePart({ id: 'head.x', category: 'head', paletteRoles: { skull: { fill: ' skin ', stroke: 'outline', nope: 'x' }, ghost: {}, bad: 3 } });
  assert.deepEqual(painted.paletteRoles, { skull: { fill: 'skin', stroke: 'outline' } });
  assert.deepEqual([...painted.palette], ['skin', 'outline'], 'the palette list is the roles\' tokens when none is given');
  const empty = normalizeFacePart();
  assert.equal(empty.id, '');
  assert.equal(empty.mountPoint, '', 'no category, no default mount point');
  assert.ok(Number.isNaN(empty.referenceBox.width));
  assert.equal(normalizeFacePart({ category: 'nose', mountPoint: 'head.top' }).mountPoint, 'head.top', 'a mount point of its own wins over the category default');
  assert.equal(normalizeFacePart(MOUTH_SIMPLE).origin, 'builtin');
  assert.equal(normalizeFacePart(null).category, '');
  assert.ok(FACE_PART_ID.test('mouth.cartoon-wide'));
  assert.equal(FACE_PART_ID.test('Mouth.wide'), false);
  assert.equal(FACE_PART_ID.test('mouth'), false);
  assert.equal(FACE_PART_ID.test('mouth.'), false);
});

/**
 * The style axis (docs/FACE_PART_LIBRARY.md, "The style axis"): a drawing
 * may say it restyles another, and which look it restyles it into. Half of
 * it is no variant, as half a host is no host -- normalising keeps what was
 * written so validation can say which half is missing.
 */
test('a drawing may say it restyles another, and into which style', () => {
  const restyled = normalizeFacePart({ id: 'accessory.glasses-workshop', category: 'accessory', variant: { of: ' accessory.glasses ', style: ' Workshop ' } });
  assert.deepEqual(restyled.variant, { of: 'accessory.glasses', style: 'workshop' }, 'a style is a name, in one case');
  assert.ok(Object.isFrozen(restyled.variant));
  assert.deepEqual(normalizeFacePart({ id: 'mouth.x', variant: { of: 'mouth.simple' } }).variant, { of: 'mouth.simple', style: '' }, 'half of it is kept, to be refused');
  assert.deepEqual(normalizeFacePart({ id: 'mouth.x', variant: { style: 'workshop' } }).variant, { of: '', style: 'workshop' });
  assert.equal(normalizeFacePart({ id: 'mouth.x', variant: {} }).variant, null, 'and none of it is no variant');
  assert.equal(normalizeFacePart({ id: 'mouth.x', variant: 'workshop' }).variant, null);
  assert.equal(normalizeFacePart(MOUTH_SIMPLE).variant, null, 'the library\'s own drawings restyle nothing');
  assert.ok(FACE_STYLE_ID.test('workshop') && FACE_STYLE_ID.test('late-night') && FACE_STYLE_ID.test('v2'));
  assert.equal(FACE_STYLE_ID.test('Workshop'), false);
  assert.equal(FACE_STYLE_ID.test('-workshop'), false);
  assert.equal(FACE_STYLE_ID.test(''), false);
});

test('the artwork scanner reads elements, ids and balance from a fragment', () => {
  const scan = scanArtwork(MOUTH_WIDE.artwork);
  assert.deepEqual(scan.elements.map((item) => [item.tag, item.id, item.depth]), [['g', 'mouth-wide', 0], ['path', 'mouth', 1], ['path', 'teeth', 1]]);
  assert.equal(scan.balanced, true);
  assert.deepEqual(artworkIds(MOUTH_WIDE.artwork), ['mouth-wide', 'mouth', 'teeth']);
  assert.deepEqual(artworkIds("<g><circle id='one'/><rect/></g>"), ['one'], 'single quotes and unnamed shapes');
  assert.equal(scanArtwork('<g><path/>').balanced, false, 'an unclosed group');
  assert.equal(scanArtwork('<g></path>').balanced, false, 'the wrong closing tag');
  assert.deepEqual(scanArtwork('').elements, []);
  assert.deepEqual(scanArtwork('just words').elements, []);
});

test('capabilities are read against the part: what is carried, what is not, what cannot be', () => {
  assert.deepEqual(describeFacePartCapabilities(MOUTH_SIMPLE), { controls: ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue'], supported: ['mouthOpen', 'smile', 'mouthWidth'], missing: ['teeth', 'tongue'], unsupported: [], complete: false });
  assert.deepEqual(describeFacePartCapabilities({ category: 'nose', capabilities: ['noseScrunch'] }).missing, []);
  assert.equal(describeFacePartCapabilities({ category: 'nose', capabilities: ['noseScrunch'] }).complete, true);
  assert.deepEqual(describeFacePartCapabilities({ category: 'nose', capabilities: ['smile'] }).unsupported, ['smile']);
  // Sideburns: the one drawing here that nothing carries, so it claims the part's movement and is Limited animation for saying so.
  assert.deepEqual(describeFacePartCapabilities({ category: 'facialHair', capabilities: [] }), { controls: ['jawOpen'], supported: [], missing: ['jawOpen'], unsupported: [], complete: false });
  assert.deepEqual(describeFacePartCapabilities({ category: 'nope', capabilities: ['x'] }).unsupported, ['x']);
});
