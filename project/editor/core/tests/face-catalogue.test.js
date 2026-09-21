import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_MORPHOLOGY, FACE_CATALOGUE_SCOPES, catalogueAssets, catalogueMorphologies, cataloguePresets,
  faceCatalogueScope, faceCatalogueSummary, isLegacyAsset, isLegacyPreset
} from '../face-library/face-catalogue.js';
import { FACE_PART_LIBRARY, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { FACE_PRESET_LIBRARY, createFacePresetRegistry, normalizeFacePreset } from '../face-library/face-presets.js';
import { ACTIVE_FACE_MORPHOLOGY_IDS, LEGACY_FACE_MORPHOLOGY_IDS, FACE_MORPHOLOGY_IDS, assetSupportsMorphology, faceMorphology, isLegacyMorphology } from '../face-library/face-morphologies.js';
import { availableMorphologies, offeredMorphologies, presetsFor } from '../face-library/compatibility.js';
import { installFacePack } from '../face-library/face-pack.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { faceLibraryModel } from '../face-library/face-library-model.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';

/**
 * Human first, and nothing thrown away (V6, §2.1 and §3 of the brief;
 * docs/FACE_PART_LIBRARY.md, "Active and legacy").
 *
 * The library grew to a hundred and thirty-two drawings and ninety of them are
 * not people. The brief asks for the shelves to be cleared and, in the same
 * breath, that nothing already made stops opening — which is only possible if
 * "cleared" means *not offered* rather than *not there*.
 *
 * So every test here is one of two sentences:
 *
 * ```text
 *   an author choosing is offered the human library and nothing else
 *   everything else goes on registering, validating, installing and loading
 * ```
 */

const mouth = (id, extra = {}) => ({
  id, category: 'mouth', name: id,
  artwork: `<g id="${id.replace('.', '-')}"><path id="${id.replace('.', '-')}-a" d="M0 0h10"/></g>`,
  roles: { mouth: `${id.replace('.', '-')}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra
});

/* ── What is offered ─────────────────────────────────────────────────────── */

test('the editor offers human faces, and keeps the four other kinds', () => {
  assert.equal(ACTIVE_MORPHOLOGY, 'human');
  assert.deepEqual([...ACTIVE_FACE_MORPHOLOGY_IDS], ['human']);
  assert.deepEqual([...LEGACY_FACE_MORPHOLOGY_IDS], ['muzzle', 'beak', 'robot', 'monster']);
  // Kept, which means still *there*: every one of the five is still a kind of
  // face, still has its slots, and still answers for the drawings that name it.
  assert.equal(FACE_MORPHOLOGY_IDS.length, 5);
  for (const id of LEGACY_FACE_MORPHOLOGY_IDS) {
    assert.ok(faceMorphology(id), `${id} is still a kind of face`);
    assert.ok(faceMorphology(id).slots.length, `${id} still says what it is made of`);
    assert.equal(isLegacyMorphology(id), true);
  }
  assert.equal(isLegacyMorphology('human'), false);
  // A kind nobody has heard of reads as legacy: offering it would be offering
  // a row nothing can fill.
  assert.equal(isLegacyMorphology('dragon'), true);
});

test('a kind of face is available, legacy and offered, and those are three questions', () => {
  const kinds = Object.fromEntries(availableMorphologies().map((kind) => [kind.id, kind]));
  // Still makeable: the drawings are all there, which is exactly why a project
  // that wears one goes on working.
  assert.equal(kinds.muzzle.available, true);
  assert.equal(kinds.robot.available, true);
  assert.equal(kinds.beak.available, true);
  // And not offered.
  assert.equal(kinds.muzzle.legacy, true);
  assert.equal(kinds.human.legacy, false);
  assert.deepEqual(offeredMorphologies().map((kind) => kind.id), ['human']);
  assert.deepEqual(catalogueMorphologies().map((kind) => kind.id), ['human']);
  assert.deepEqual(catalogueMorphologies({ scope: 'all' }).map((kind) => kind.id), [...FACE_MORPHOLOGY_IDS]);
  assert.deepEqual(catalogueMorphologies({ scope: 'legacy' }).map((kind) => kind.id), [...LEGACY_FACE_MORPHOLOGY_IDS]);
});

test('ninety drawings and sixteen presets moved without one of them being edited', () => {
  const summary = faceCatalogueSummary();
  assert.deepEqual(summary.assets, { active: 42, legacy: 90 });
  assert.deepEqual(summary.presets, { active: 6, legacy: 16 });
  assert.equal(summary.assets.active + summary.assets.legacy, FACE_PART_LIBRARY.cards().length, 'every drawing is in one or the other');
  assert.equal(summary.presets.active + summary.presets.legacy, FACE_PRESET_LIBRARY.list().length);
  // Derived from what the packs already declared (MASC-02), never from a list
  // somebody has to keep: an asset that names no kind of face is universal, so
  // it suits a person and is offered.
  assert.deepEqual(cataloguePresets().map((item) => item.id), ['classic', 'professor', 'young', 'old', 'robot', 'minimal']);
  assert.equal(cataloguePresets({ scope: 'legacy' }).length, 16);
  assert.equal(cataloguePresets({ scope: 'all' }).length, 22);
  for (const asset of catalogueAssets()) assert.ok(assetSupportsMorphology(asset, 'human'), `${asset.id} is a drawing a person can wear`);
  for (const asset of catalogueAssets({ scope: 'legacy' })) assert.equal(assetSupportsMorphology(asset, 'human'), false, asset.id);
});

test('the six human presets are the way in, and the "Robot" look is one of them', () => {
  // It is a square head, a bow tie and a machine's palette on a *person*:
  // `presetMorphology` reads it as human because every drawing it names is one
  // a person can wear. Hiding it for its name would hide a human preset, which
  // is the opposite of what the recentring is for -- what §3 asks to retire is
  // the robot *pack*, and `robot-screen` and its three siblings are that.
  const robot = FACE_PRESET_LIBRARY.get('robot');
  assert.equal(isLegacyPreset(robot), false);
  for (const id of ['robot-screen', 'robot-retro', 'robot-industrial', 'robot-toy']) {
    assert.equal(isLegacyPreset(FACE_PRESET_LIBRARY.get(id)), true, id);
  }
});

test('a scope is one of three words, and anything else means "what the editor offers"', () => {
  assert.deepEqual([...FACE_CATALOGUE_SCOPES], ['active', 'legacy', 'all']);
  for (const scope of FACE_CATALOGUE_SCOPES) assert.equal(faceCatalogueScope(scope), scope);
  for (const nonsense of ['everything', '', null, undefined, 7]) assert.equal(faceCatalogueScope(nonsense), 'active');
});

/* ── What is kept ────────────────────────────────────────────────────────── */

test('nothing was taken out: the legacy drawings register, validate and resolve', () => {
  // The whole library still loads, which is the compatibility contract §3.3
  // asks for: a document naming any of these still finds its drawing.
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  assert.equal(library.list().length, BUILTIN_FACE_PARTS.length);
  for (const id of ['accessory.muzzle-feline-short', 'mouth.beak-owl', 'head.robot-retro-square']) {
    assert.ok(library.get(id), `${id} is still in the library`);
    assert.ok(FACE_PART_LIBRARY.get(id), `${id} is still in the editor's own`);
  }
  // And a preset for a kind that is no longer offered still applies to that
  // kind: `presetsFor` answers about drawings, not about what is on a shelf.
  assert.deepEqual(presetsFor({ morphology: 'beak' }).map((item) => item.id), ['owl', 'duck', 'parrot', 'crow', 'cute-bird', 'slim-bird']);
  assert.deepEqual(presetsFor({ morphology: 'muzzle' }).map((item) => item.id), ['cat', 'dog', 'fox', 'bear', 'wolf', 'rabbit']);
});

test('a pack that ships for a kind the editor keeps still comes in', () => {
  const library = createFacePartRegistry();
  const presets = createFacePresetRegistry({ library });
  const result = installFacePack({
    format: 'boop-face-pack', version: 1, id: 'barnyard', name: 'Barnyard',
    parts: [mouth('mouth.snout', { slot: 'mouth', morphologies: ['muzzle'] })],
    presets: [{ id: 'goat', name: 'Goat', parts: { mouth: 'mouth.snout' }, morphology: 'muzzle' }]
  }, { library, presets });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.parts, ['mouth.snout']);
  // In, and legacy: the editor keeps it, and does not put it on a shelf.
  assert.equal(isLegacyAsset(library.get('mouth.snout')), true);
  assert.equal(isLegacyPreset(presets.get('goat'), { library }), true);
  assert.deepEqual(catalogueAssets({ library, scope: 'active' }), []);
  assert.deepEqual(catalogueAssets({ library, scope: 'legacy' }).map((asset) => asset.id), ['mouth.snout']);
});

test('a drawing says nothing, so it is offered; one that says `legacy` is kept', () => {
  // The contract every optional field before this one kept: a drawing written
  // before the recentring behaves exactly as it did.
  assert.equal(isLegacyAsset(mouth('mouth.plain')), false);
  assert.equal(isLegacyAsset({ ...mouth('mouth.any'), morphologies: ['*'] }), false, 'and one that says "every kind" is every kind');
  // `legacy: true` is for the case derivation cannot reach: a *human* drawing
  // somebody has retired anyway.
  assert.equal(isLegacyAsset({ ...mouth('mouth.old'), legacy: true }), true);
  assert.equal(isLegacyPreset(normalizeFacePreset({ id: 'retired', name: 'Retired', parts: { mouth: 'mouth.full' }, legacy: true })), true);
  assert.equal(isLegacyAsset(null), false);
  assert.equal(isLegacyPreset(null), false);
});

/* ── What an author sees ─────────────────────────────────────────────────── */

test('the Design shelf is the human library, and says what it is holding back', () => {
  const state = createTemplateProjectState();
  const view = faceLibraryModel(state, { category: 'mouth' });
  assert.deepEqual(view.cards.map((card) => card.id), ['mouth.full'], 'one mouth, where sixteen used to be offered');
  assert.equal(view.legacy, 15);
  assert.equal(view.offered, 42, 'and the header counts what is offered, not what is held');
  assert.equal(view.total, 132);
  // Every row, so the recentring is not one category's.
  const rows = ['head', 'eyes', 'eyebrows', 'nose', 'mouth', 'ears', 'accessory']
    .map((id) => faceLibraryModel(state, { category: id }));
  assert.equal(rows.reduce((sum, row) => sum + row.cards.length, 0), 31);
  assert.equal(rows.reduce((sum, row) => sum + row.legacy, 0), 90, 'the ninety, across the rows they are in');
  for (const row of rows) for (const card of row.cards) assert.equal(card.legacy, false);
});
