import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_PACK_FORMAT, installFacePack, normalizeFacePack, validateFacePack } from '../face-library/face-pack.js';
import { createFacePartRegistry, loadCustomParts, saveCustomParts } from '../face-library/face-part-registry.js';
import { createFacePresetRegistry, loadCustomPresets, presetDrawings } from '../face-library/face-presets.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { MOUTH_SMALL } from '../face-library/builtin/mouths.js';

/**
 * Face packs (docs/FACE_PART_LIBRARY.md, "Face packs"; roadmap phase 44):
 * one JSON document of parts and presets, validated against the library and
 * against itself, taken in all or nothing, kept with the author's own.
 */
function registries() {
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const presets = createFacePresetRegistry({ library });
  return { library, presets };
}

const grin = () => ({ ...MOUTH_SMALL, id: 'mouth.grin', name: 'Grin', description: 'A small grin, from a pack.', artwork: MOUTH_SMALL.artwork.replace('id="mouth-small"', 'id="mouth-grin"'), origin: undefined });
const hat = () => ({ id: 'accessory.pack-hat', category: 'accessory', name: 'Pack hat', artwork: '<g id="pack-hat" data-name="Pack hat"><rect id="brim" data-name="Brim" x="40" y="10" width="160" height="20" fill="#333"/></g>', roles: { element: 'brim' }, referenceBox: { x: 40, y: 10, width: 160, height: 20 } });
const pack = (extra = {}) => ({ format: FACE_PACK_FORMAT, version: 1, id: 'grins', name: 'Grins', description: 'A grin and a hat.', parts: [grin(), hat()], presets: [{ id: 'grinning', name: 'Grinning', description: 'The grin, in warm colours.', parts: { mouth: 'mouth.grin' }, accessories: ['accessory.pack-hat'], palette: 'warm' }], ...extra });

function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map };
}

test('a pack is normalised to one shape: format, version, id, name, and lists of objects', () => {
  assert.deepEqual(normalizeFacePack(null), { format: '', version: 1, id: '', name: '', description: '', parts: [], presets: [] });
  const shape = normalizeFacePack({ format: ' boop-face-pack ', id: ' grins ', name: ' Grins ', parts: [null, 'x', { id: 'a' }], presets: 'nope' });
  assert.deepEqual(shape, { format: 'boop-face-pack', version: 1, id: 'grins', name: 'Grins', description: '', parts: [{ id: 'a' }], presets: [] });
  assert.ok(Object.isFrozen(shape) && Object.isFrozen(shape.parts));
});

test('a pack is validated as a whole: the file must say what it is, and each part and preset says where its issue is', () => {
  const { library, presets } = registries();
  const good = validateFacePack(pack(), { library, presets });
  assert.equal(good.ok, true, JSON.stringify(good.errors));
  assert.deepEqual(good.parts.map((asset) => [asset.id, asset.origin, asset.pack]), [['mouth.grin', 'custom', 'grins'], ['accessory.pack-hat', 'custom', 'grins']], 'the parts carry the pack');
  assert.deepEqual(good.presets.map((item) => [item.id, item.origin, item.pack]), [['grinning', 'custom', 'grins']], 'a preset may name a part of its own pack');

  const codes = (input) => validateFacePack(input, { library, presets }).errors.map((issue) => `${issue.code}@${issue.field}`);
  assert.deepEqual(codes({ id: 'x', name: 'X', parts: [hat()] }), ['pack-format@format']);
  assert.deepEqual(codes(pack({ version: 2 })), ['pack-version@version']);
  for (const version of ['2.0.0', 'v2', 0, 1.5]) assert.deepEqual(codes(pack({ version })), ['pack-version@version'], `version ${JSON.stringify(version)} is not quietly version 1`);
  assert.deepEqual(codes(pack({ version: '1' })), [], 'a number written as a string is that number');
  assert.deepEqual(codes(pack({ id: '', name: '' })), ['pack-id-missing@id', 'pack-name-missing@name']);
  assert.deepEqual(codes(pack({ id: 'Grins!' })), ['pack-id-format@id']);
  assert.deepEqual(codes(pack({ parts: [], presets: [] })), ['pack-empty@parts']);
  // A part the library already has, a part appearing twice, a part with no artwork: each named by its place.
  assert.deepEqual(codes(pack({ parts: [{ ...grin(), id: 'mouth.small' }], presets: [] })), ['id-taken@parts[0].id']);
  assert.deepEqual(codes(pack({ parts: [hat(), hat()], presets: [] })), ['id-taken@parts[1].id']);
  assert.ok(codes(pack({ parts: [{ ...hat(), artwork: '' }], presets: [] })).includes('artwork-missing@parts[0].artwork'));
  // A preset naming a part neither the library nor the pack has, and one whose id a built-in preset holds.
  assert.deepEqual(codes(pack({ presets: [{ id: 'grinning', name: 'Grinning', parts: { mouth: 'mouth.nope' } }] })), ['parts-asset-unknown@presets[0].parts.mouth']);
  assert.deepEqual(codes(pack({ presets: [{ id: 'grinning', name: 'A' }, { id: 'grinning', name: 'B', parts: { mouth: 'mouth.grin' } }] })), ['parts-missing@presets[0].parts', 'id-taken@presets[1].id']);
});

test('a pack installs all or nothing: one bad preset keeps every part out; a good one registers parts and presets as the author\'s own, and keeps them', () => {
  const { library, presets } = registries();
  const partStorage = storage(), presetStorage = storage();
  const size = library.size;
  const refused = installFacePack(pack({ presets: [{ id: 'grinning', name: 'Grinning', parts: { mouth: 'mouth.nope' } }] }), { library, presets, partStorage, presetStorage });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /There is no asset called "mouth\.nope"/);
  assert.equal(library.size, size, 'nothing registered');
  assert.equal(library.has('mouth.grin'), false);
  assert.equal(partStorage.map.size, 0, 'nothing written');

  const result = installFacePack(pack(), { library, presets, partStorage, presetStorage });
  assert.deepEqual(result, { ok: true, pack: { id: 'grins', name: 'Grins', description: 'A grin and a hat.' }, parts: ['mouth.grin', 'accessory.pack-hat'], presets: ['grinning'] });
  assert.equal(library.get('mouth.grin').pack, 'grins');
  assert.equal(library.get('mouth.grin').origin, 'custom');
  assert.equal(presets.get('grinning').pack, 'grins');
  assert.equal(library.list('mouth').at(-1).id, 'mouth.grin', 'a card of the mouth category');

  // Kept: a fresh library reads them back from storage, the pack on them.
  const fresh = registries();
  assert.deepEqual(loadCustomParts(partStorage, fresh.library).map((asset) => [asset.id, asset.pack]), [['mouth.grin', 'grins'], ['accessory.pack-hat', 'grins']]);
  assert.deepEqual(loadCustomPresets(presetStorage, fresh.presets).map((item) => [item.id, item.pack]), [['grinning', 'grins']]);

  // Installed twice is refused: its ids are taken now.
  const again = installFacePack(pack(), { library, presets, partStorage, presetStorage });
  assert.equal(again.ok, false);
  assert.match(again.reason, /"mouth\.grin" is already registered/);
  assert.equal(saveCustomParts(partStorage, library), true);
});

test('a preset registry with rules of its own that refuses at register time leaves nothing of the pack behind', () => {
  const { library, presets } = registries();
  const strict = { ...presets, register: (item) => { if (item.id === 'grinning') throw Object.assign(new Error('Refused at the door.'), { issues: [{ code: 'door' }] }); return presets.register(item); }, remove: (id) => presets.remove(id), has: (id) => presets.has(id) };
  const result = installFacePack(pack(), { library, presets: strict });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'Refused at the door.');
  assert.equal(library.has('mouth.grin'), false, 'the parts registered before are gone again');
  assert.equal(presets.has('grinning'), false);
});

/**
 * A whole new look in one file (docs/FACE_PART_LIBRARY.md, "The style axis";
 * roadmap V3-05): a pack ships the drawings of a style and the preset that
 * asks for it. The parts are checked against the pack as well as the
 * library, so a style may be written down before the drawing it restyles,
 * and they go in together or not at all.
 */
const workshopMouth = () => ({ ...MOUTH_SMALL, id: 'mouth.small-workshop', name: 'Small, workshop', description: 'The small mouth, restyled.', artwork: MOUTH_SMALL.artwork.replace('id="mouth-small"', 'id="mouth-small-workshop"'), variant: { of: 'mouth.small', style: 'workshop' }, origin: undefined });
const workshopPack = (extra = {}) => ({ format: FACE_PACK_FORMAT, version: 1, id: 'workshop', name: 'Workshop', parts: [workshopMouth()], presets: [{ id: 'workshop-face', name: 'Workshop face', parts: { head: 'head.round', mouth: 'mouth.small' }, style: 'workshop', palette: 'warm' }], ...extra });

test('a pack ships a style and the preset that asks for it, and the preset wears the pack\'s drawing', () => {
  const { library, presets } = registries();
  const result = installFacePack(workshopPack(), { library, presets });
  assert.deepEqual([result.ok, result.parts, result.presets], [true, ['mouth.small-workshop'], ['workshop-face']]);
  assert.equal(library.variant('mouth.small', 'workshop').id, 'mouth.small-workshop', 'reached through the drawing it restyles');
  assert.deepEqual(library.cards('mouth').map((asset) => asset.id), ['mouth.simple', 'mouth.wide', 'mouth.small', 'mouth.cartoon', 'mouth.expressive', 'mouth.animal-smile', 'mouth.animal-neutral', 'mouth.animal-open-friendly', 'mouth.animal-small-smile', 'mouth.animal-happy-curve'], 'and no card of its own');
  assert.deepEqual(presetDrawings(presets.get('workshop-face'), library), { parts: { head: 'head.round', mouth: 'mouth.small-workshop' }, accessories: [] });

  // A style of a drawing the same pack ships, written down before it.
  const own = registries();
  const pair = workshopPack({ parts: [{ ...workshopMouth(), id: 'mouth.grin-workshop', variant: { of: 'mouth.grin', style: 'workshop' } }, grin()], presets: [{ id: 'workshop-face', name: 'Workshop face', parts: { mouth: 'mouth.grin' }, style: 'workshop', palette: 'warm' }] });
  assert.deepEqual(validateFacePack(pair, own).errors, [], 'checked against the whole pack, not against the order it is in');
  assert.equal(installFacePack(pair, own).ok, true);
  assert.equal(own.library.variant('mouth.grin', 'workshop').id, 'mouth.grin-workshop');
  assert.deepEqual(presetDrawings(own.presets.get('workshop-face'), own.library).parts, { mouth: 'mouth.grin-workshop' });

  const reversed = registries();
  assert.equal(installFacePack({ ...workshopPack(), parts: [workshopMouth(), { ...grin(), variant: { of: 'mouth.small-workshop', style: 'night' } }] }, reversed).ok, false, 'a style of a style is refused');
  const chained = validateFacePack({ ...workshopPack(), parts: [workshopMouth(), { ...grin(), variant: { of: 'mouth.small-workshop', style: 'night' } }] }, reversed).errors;
  assert.deepEqual(chained.map((issue) => `${issue.code}@${issue.field}`), ['variant-chained@parts[1].variant.of'], 'and says which entry');
  assert.equal(reversed.library.has('mouth.small-workshop'), false, 'nothing of the pack stays');
  // A style of a drawing nobody ships, named where it is written.
  const orphan = validateFacePack(workshopPack({ parts: [{ ...workshopMouth(), variant: { of: 'mouth.nobody', style: 'workshop' } }] }), registries()).errors;
  assert.deepEqual(orphan.map((issue) => `${issue.code}@${issue.field}`), ['variant-unknown@parts[0].variant.of']);
});

test('a style kept in the browser is read back after the drawing it restyles, whichever order it was written in', () => {
  const { library, presets } = registries();
  const partStorage = storage(), presetStorage = storage();
  // The author's own drawing, and a style of it: two custom parts, the style first in storage.
  library.register({ ...grin(), origin: 'custom' });
  library.register({ ...workshopMouth(), id: 'mouth.grin-workshop', variant: { of: 'mouth.grin', style: 'workshop' }, origin: 'custom' });
  saveCustomParts(partStorage, library);
  partStorage.map.set('boop.faceParts', JSON.stringify([...JSON.parse(partStorage.map.get('boop.faceParts'))].reverse()));
  const fresh = registries();
  assert.deepEqual(loadCustomParts(partStorage, fresh.library).map((asset) => asset.id), ['mouth.grin', 'mouth.grin-workshop'], 'the drawing first, then the style of it');
  assert.equal(fresh.library.variant('mouth.grin', 'workshop').id, 'mouth.grin-workshop');
  assert.equal(presets.size, presetStorage.map.size, 'nothing of the presets touched here');
});
