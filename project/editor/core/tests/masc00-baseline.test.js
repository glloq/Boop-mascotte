import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_PART_LIBRARY, createFacePartRegistry, loadCustomParts, saveCustomParts } from '../face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, createFacePresetRegistry, presetDrawings, styledAsset } from '../face-library/face-presets.js';
import { installFacePack, validateFacePack } from '../face-library/face-pack.js';
import { normalizeFacePart } from '../face-library/face-part-model.js';

/**
 * MASC-00 — what the library already does, written down before anything is
 * added to it (docs/MASC_LIBRARY_BASELINE.md).
 *
 * The morphology work adds three optional fields and a filter above the
 * categories. Its failure mode is not a screen that breaks: it is an asset
 * that quietly stops being offered, a preset that resolves to another
 * drawing, or a pack that imported yesterday and is refused today. These are
 * the four behaviours that must read the same before and after, tested
 * against the models rather than the panels — a net re-tied by the change it
 * is watching is not one.
 */

const mouth = (id, name, extra = {}) => ({
  id, name, category: 'mouth',
  artwork: `<g id="${id.replace('.', '-')}"><path id="${id.replace('.', '-')}-lips" d="M0 0h10"/></g>`,
  roles: { mouth: `${id.replace('.', '-')}-lips` },
  referenceBox: { x: 0, y: 0, width: 10, height: 4 },
  ...extra
});

const memory = () => {
  const store = new Map();
  return { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
};

test('a restyle is reached through the drawing it restyles, and never listed beside it', () => {
  const library = createFacePartRegistry();
  library.registerMany([mouth('mouth.wide', 'Wide'), mouth('mouth.wide-soft', 'Wide, soft', { variant: { of: 'mouth.wide', style: 'soft-cartoon' } })]);

  // Both are assets: `get` finds either, and an install can put either on.
  assert.equal(library.size, 2);
  assert.equal(library.get('mouth.wide-soft').variant.style, 'soft-cartoon');
  // Only one is a card. Six restyles of one mouth are six drawings and one
  // card, which is the whole reason the axis is not "six libraries".
  assert.deepEqual(library.cards('mouth').map((asset) => asset.id), ['mouth.wide']);
  assert.deepEqual(library.list('mouth').map((asset) => asset.id), ['mouth.wide', 'mouth.wide-soft']);
  assert.equal(library.variant('mouth.wide', 'soft-cartoon').id, 'mouth.wide-soft');
  assert.equal(library.variant('mouth.wide', 'flat'), null, 'a style nobody drew is null, not a guess');
  assert.deepEqual(library.variantsOf('mouth.wide').map((asset) => asset.id), ['mouth.wide-soft']);

  // A pack may write the restyle down before the drawing it restyles.
  const reversed = createFacePartRegistry();
  reversed.registerMany([mouth('mouth.wide-soft', 'Wide, soft', { variant: { of: 'mouth.wide', style: 'soft-cartoon' } }), mouth('mouth.wide', 'Wide')]);
  assert.equal(reversed.variant('mouth.wide', 'soft-cartoon').id, 'mouth.wide-soft');
});

test('a preset in a style nobody drew wears the drawings it named, and says nothing about it', () => {
  // The fallback the whole plan rests on: a style is a *wish*, and a wish the
  // library cannot grant leaves the asset alone. Without it, every style would
  // have to be complete before any of it could ship.
  const library = createFacePartRegistry();
  library.registerMany([mouth('mouth.wide', 'Wide'), mouth('mouth.wide-soft', 'Wide, soft', { variant: { of: 'mouth.wide', style: 'soft-cartoon' } }), mouth('mouth.small', 'Small')]);

  assert.equal(styledAsset('mouth.wide', 'soft-cartoon', library), 'mouth.wide-soft');
  assert.equal(styledAsset('mouth.small', 'soft-cartoon', library), 'mouth.small', 'no restyle drawn: the named drawing stands');
  assert.equal(styledAsset('mouth.wide', '', library), 'mouth.wide', 'no style asked: the named drawing stands');
  assert.equal(styledAsset('mouth.wide', 'flat', library), 'mouth.wide', 'an unknown style is not an error');

  const presets = createFacePresetRegistry({ library });
  const styled = presets.register({ id: 'soft', name: 'Soft', style: 'soft-cartoon', parts: { mouth: 'mouth.wide' } });
  const partial = presets.register({ id: 'soft-two', name: 'Soft two', style: 'soft-cartoon', parts: { mouth: 'mouth.small' } });
  assert.deepEqual(presetDrawings(styled, library).parts, { mouth: 'mouth.wide-soft' });
  assert.deepEqual(presetDrawings(partial, library).parts, { mouth: 'mouth.small' });

  // And every shipped preset today asks for no style at all, so every one of
  // them resolves to exactly the drawings it names. MASC-06 is what changes
  // this line, deliberately and visibly.
  for (const item of FACE_PRESET_LIBRARY.list()) {
    assert.equal(item.style, '', `${item.id} carries a style, and the baseline says none does`);
    assert.deepEqual(presetDrawings(item, FACE_PART_LIBRARY).parts, { ...item.parts });
  }
});

test('a pack is all or nothing, across its parts and the presets that name them', () => {
  const library = createFacePartRegistry();
  const presets = createFacePresetRegistry({ library });
  const pack = {
    format: 'boop-face-pack', version: 1, id: 'grins', name: 'Grins',
    parts: [mouth('mouth.grin', 'Grin')],
    presets: [{ id: 'grinning', name: 'Grinning', parts: { mouth: 'mouth.grin' }, palette: 'warm' }]
  };
  assert.equal(validateFacePack(pack, { library, presets }).ok, true, 'a preset may name a part of its own pack');
  assert.equal(installFacePack(pack, { library, presets }).ok, true);
  assert.equal(library.size, 1);
  assert.equal(presets.size, 1);

  // One bad preset and the pack's own good part stays out with it.
  const clean = createFacePartRegistry(), cleanPresets = createFacePresetRegistry({ library: clean });
  const broken = { ...pack, id: 'broken', presets: [{ id: 'nope', name: 'Nope', parts: { mouth: 'mouth.nothing' } }] };
  const refused = installFacePack(broken, { library: clean, presets: cleanPresets });
  assert.equal(refused.ok, false);
  assert.equal(clean.size, 0, 'nothing of a refused pack is registered');
  assert.equal(cleanPresets.size, 0);
  assert.ok(refused.issues.some((issue) => issue.field?.startsWith('presets[0]')), 'and the issue says which entry');
});

test('an asset carrying none of the morphology metadata normalises, validates and loads', () => {
  // The compatibility contract MASC-02 keeps: every field it added is
  // optional, an asset written before they existed is complete, and a part an
  // author saved in this browser opens again afterwards. The three fields are
  // *in* the shape now and empty here, which is the whole assertion: the
  // library reads a drawing that says nothing exactly as it always did.
  const plain = mouth('mouth.plain', 'Plain');
  const normalized = normalizeFacePart(plain);
  assert.deepEqual(Object.keys(normalized).sort(), ['artwork', 'behind', 'capabilities', 'category', 'depth', 'description', 'drivers', 'host', 'id', 'morphologies', 'mountPoint', 'name', 'origin', 'paletteRoles', 'palette', 'parts', 'pack', 'referenceBox', 'roles', 'slot', 'tags', 'turn', 'variant'].sort());
  assert.deepEqual({ slot: normalized.slot, morphologies: normalized.morphologies, tags: normalized.tags }, { slot: '', morphologies: [], tags: [] });
  assert.equal(normalized.origin, 'custom');
  assert.equal(normalized.pack, null);

  const library = createFacePartRegistry();
  const result = library.validate(plain);
  assert.equal(result.ok, true, result.errors.map((item) => item.message).join(' '));
  library.register(plain);

  const storage = memory();
  assert.equal(saveCustomParts(storage, library), true);
  const reloaded = createFacePartRegistry();
  assert.deepEqual(loadCustomParts(storage, reloaded).map((asset) => asset.id), ['mouth.plain']);
  assert.deepEqual(reloaded.get('mouth.plain'), library.get('mouth.plain'), 'what went into storage is what comes back');
});
