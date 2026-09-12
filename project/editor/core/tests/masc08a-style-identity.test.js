import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_BASE_STYLE_ID, FACE_STYLES, availableFaceStyles, isBaseFaceStyle } from '../face-library/face-styles.js';
import { baseAsset, baseAssetId, createFacePartRegistry } from '../face-library/face-part-registry.js';
import { createFacePresetRegistry, presetDrawings, styledAsset } from '../face-library/face-presets.js';
import { describeRestylePlan, restylePlan } from '../face-library/compatibility.js';
import { planFacePartReplacement } from '../face-library/face-part-install.js';
import { faceStyleState } from '../../ui/character-builder/style-browser.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds } from '../face-library/face-part-model.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';

/**
 * MASC-08A — the identities a restyle needs to be safe to do twice.
 *
 * Two hardenings, and both are about *which drawing* and *which part*.
 *
 * A style used to be resolved from whatever the face was wearing, which works
 * exactly once: ask a flat face for retro and the library is asked for "the
 * retro style of head.round-flat", which nobody has drawn and nobody may draw,
 * because a style of a style is refused. Every restyle comes home to the
 * canonical base first, so base → flat → retro → base is four ordinary
 * restyles rather than a chain that dies at the second.
 *
 * And a replacement used to find its part by category and slot, which works
 * until two parts share a slot. A muzzle and a pair of whiskers are two
 * accessories at the same mount on the same host, and restyling one must not
 * reach the other.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace(/\./g, '-');
  const role = { mouth: 'mouth', head: 'head', nose: 'nose', accessory: 'element' }[category] || 'element';
  return { id, category, name: id, artwork: `<g id="${root}"><path id="${root}-a" d="M0 0h10"/></g>`, roles: { [role]: `${root}-a` }, referenceBox: { x: 0, y: 0, width: 10, height: 4 }, ...extra };
};
const styleOf = (id, of, style) => part(id, of.split('.')[0], { variant: { of, style } });

/** A library where one drawing has two restyles and another has none. */
function world() {
  const library = createFacePartRegistry();
  library.registerMany([
    part('head.round', 'head'),
    styleOf('head.round-flat', 'head.round', 'flat'),
    styleOf('head.round-retro', 'head.round', 'retro'),
    part('mouth.small', 'mouth'),
    styleOf('mouth.small-flat', 'mouth.small', 'flat'),
    part('nose.button', 'nose')
  ]);
  return library;
}

/** A face wearing library drawings: what `wornFaceParts` reads. */
const wearing = (pairs) => ({
  elements: Object.fromEntries(pairs.map(([, , root]) => [root, {}])),
  semanticParts: Object.fromEntries(pairs.map(([type, assetId, root], index) => [`p${index}`, { id: `p${index}`, type, assetId, assetRoot: root }]))
});

test('the library is drawn in exactly one base style, and asking for it asks for the drawing itself', () => {
  const bases = Object.values(FACE_STYLES).filter((style) => style.base);
  assert.equal(bases.length, 1, 'two base styles would make "the drawing itself" ambiguous');
  assert.equal(FACE_BASE_STYLE_ID, 'soft-cartoon');
  assert.equal(isBaseFaceStyle('soft-cartoon'), true);
  assert.equal(isBaseFaceStyle('flat'), false);
  assert.equal(isBaseFaceStyle(''), false);
  // And it is deliberately empty: the whole point of naming a base style is
  // *not* drawing 47 twins of drawings that already look like that.
  assert.equal(availableFaceStyles(world()).find((style) => style.id === 'soft-cartoon').variants, 0);
});

test('a drawing knows the drawing it is a style of', () => {
  const library = world();
  assert.equal(baseAssetId('head.round', library), 'head.round');
  assert.equal(baseAssetId('head.round-flat', library), 'head.round');
  assert.equal(baseAssetId('head.round-retro', library), 'head.round');
  assert.equal(baseAsset('head.round-flat', library).id, 'head.round');
  // Total by construction: an id nobody holds answers with itself rather than
  // null, so a caller never has to ask twice.
  assert.equal(baseAssetId('nobody.here', library), 'nobody.here');
  assert.equal(baseAsset('nobody.here', library), null);
});

test('styledAsset: no style is the drawing named, and every style starts from the canonical base', () => {
  const library = world();
  // The compatibility branch. A preset saved from a restyled face writes the
  // restyles down under their own ids and asks for no style: it must go on
  // wearing exactly those, whatever anybody restyles afterwards.
  assert.equal(styledAsset('head.round', '', library), 'head.round');
  assert.equal(styledAsset('head.round-flat', '', library), 'head.round-flat');
  assert.equal(styledAsset('nobody.here', '', library), 'nobody.here');

  const cases = [
    // from                 style           to
    ['head.round', 'flat', 'head.round-flat'],
    ['head.round-flat', 'retro', 'head.round-retro'],
    ['head.round-retro', 'flat', 'head.round-flat'],
    ['head.round-flat', 'soft-cartoon', 'head.round'],
    ['head.round-retro', 'soft-cartoon', 'head.round'],
    ['head.round-flat', 'flat', 'head.round-flat'],
    ['head.round', 'soft-cartoon', 'head.round'],
    // A style nobody has drawn for this drawing leaves the drawing named.
    ['mouth.small-flat', 'retro', 'mouth.small-flat'],
    ['nose.button', 'flat', 'nose.button']
  ];
  for (const [from, style, to] of cases) {
    assert.equal(styledAsset(from, style, library), to, `${from} asked for ${style}`);
  }
});

test('a face can be restyled as many times as anybody likes', () => {
  const library = world();
  let face = wearing([['head', 'head.round', 'h'], ['mouth', 'mouth.small', 'm'], ['nose', 'nose.button', 'n']]);
  const drawings = (document) => Object.values(document.semanticParts).map((item) => item.assetId);
  // Applying a plan, the way `applyStyle` does, without touching a store.
  const apply = (document, style) => {
    const plan = restylePlan(document, style, { library });
    const next = structuredClone(document);
    for (const step of plan.replace) next.semanticParts[step.partId].assetId = step.to;
    return { document: next, plan };
  };

  let round = apply(face, 'flat'); face = round.document;
  assert.deepEqual(drawings(face), ['head.round-flat', 'mouth.small-flat', 'nose.button']);
  assert.deepEqual([round.plan.replace.length, round.plan.already.length, round.plan.kept.length], [2, 0, 1]);
  assert.equal(describeRestylePlan(round.plan), '2 parts restyled, 1 kept as it is.');

  // Flat → Retro: the head comes home and goes out again; the mouth has no
  // retro drawing, so the *flat* mouth is kept rather than reverted.
  round = apply(face, 'retro'); face = round.document;
  assert.deepEqual(drawings(face), ['head.round-retro', 'mouth.small-flat', 'nose.button']);
  assert.deepEqual([round.plan.replace.length, round.plan.already.length, round.plan.kept.length], [1, 0, 2]);

  // Retro → Flat, and back to the base.
  round = apply(face, 'flat'); face = round.document;
  assert.deepEqual(drawings(face), ['head.round-flat', 'mouth.small-flat', 'nose.button']);
  round = apply(face, 'soft-cartoon'); face = round.document;
  assert.deepEqual(drawings(face), ['head.round', 'mouth.small', 'nose.button'], 'home is where every variant points');
  assert.deepEqual([round.plan.replace.length, round.plan.already.length, round.plan.kept.length], [2, 1, 0]);
  assert.equal(describeRestylePlan(round.plan), '2 parts restyled, 1 already in this style.');
});

test('asking for the style a face already wears is "already", never a missing drawing', () => {
  const library = world();
  const flat = wearing([['head', 'head.round-flat', 'h'], ['mouth', 'mouth.small-flat', 'm']]);
  const same = restylePlan(flat, 'flat', { library });
  assert.deepEqual(same.replace, []);
  assert.deepEqual(same.already.map((item) => item.assetId), ['head.round-flat', 'mouth.small-flat']);
  assert.deepEqual(same.kept, []);
  assert.equal(describeRestylePlan(same), 'All 2 library parts are already in this style.');

  const base = wearing([['head', 'head.round', 'h'], ['nose', 'nose.button', 'n']]);
  const home = restylePlan(base, 'soft-cartoon', { library });
  assert.deepEqual(home.already.map((item) => item.assetId), ['head.round', 'nose.button']);
  assert.equal(describeRestylePlan(home), 'All 2 library parts are already in this style.');
  // The sentence this whole revision exists to stop: a face entirely in a
  // style being told nothing is drawn in it.
  assert.ok(!describeRestylePlan(home).includes('Nothing'));

  // And the card that says so, rather than one that looks broken.
  const card = (plan) => faceStyleState({ total: plan.replace.length + plan.already.length + plan.kept.length, restyled: plan.replace.length, already: plan.already.length, kept: plan.kept.length });
  assert.equal(card(home), 'current');
  assert.equal(card(restylePlan(base, 'flat', { library })), 'partial', 'the head can go flat, the nose cannot');
  assert.equal(card(restylePlan(base, 'retro', { library })), 'partial');
  assert.equal(card(restylePlan(wearing([['nose', 'nose.button', 'n']]), 'flat', { library })), 'unavailable');
  assert.equal(card(restylePlan({}, 'flat', { library })), 'unavailable');
  assert.equal(card(restylePlan(wearing([['head', 'head.round', 'h']]), 'flat', { library })), 'available');
});

test('a part whose drawing the library has forgotten is kept, never taken off', () => {
  const library = world();
  const face = wearing([['head', 'head.round', 'h'], ['mouth', 'mouth.gone', 'm']]);
  const plan = restylePlan(face, 'flat', { library });
  assert.deepEqual(plan.replace.map((step) => step.to), ['head.round-flat']);
  assert.deepEqual(plan.kept.map((item) => item.assetId), ['mouth.gone']);
  assert.deepEqual(plan.already, []);
});

test('a preset asking for no style still wears the drawings it names, restyled or not', () => {
  const library = world();
  const presets = createFacePresetRegistry({ library });
  // Exactly what `facePresetFromDocument` writes down from a flat face.
  const saved = presets.register({ id: 'mine', name: 'Mine', parts: { head: 'head.round-flat', mouth: 'mouth.small-flat' } });
  assert.equal(saved.style, '');
  assert.deepEqual(presetDrawings(saved, library).parts, { head: 'head.round-flat', mouth: 'mouth.small-flat' });
  // And one that does ask resolves from the base, whichever drawing it names.
  const asked = presets.register({ id: 'retro', name: 'Retro', style: 'retro', parts: { head: 'head.round-flat', mouth: 'mouth.small-flat' } });
  assert.deepEqual(presetDrawings(asked, library).parts, { head: 'head.round-retro', mouth: 'mouth.small-flat' });
});

/* ── The exact part ───────────────────────────────────────────────────────── */

/** Two accessories at the same mount, on the same host: what a cat's face is. */
const twoAccessories = () => ({
  svgMarkup: '<svg><g id="faceRoot"><g id="muzzleRoot"/><g id="whiskersRoot"/></g></svg>',
  layers: [{ id: 'faceRoot', children: [{ id: 'muzzleRoot', children: [] }, { id: 'whiskersRoot', children: [] }] }],
  elements: { faceRoot: {}, muzzleRoot: {}, whiskersRoot: {} },
  semanticParts: {
    muzzle: { id: 'muzzle', type: 'accessory', roles: { element: 'muzzleRoot' }, assetId: 'accessory.muzzle-cat', assetRoot: 'muzzleRoot', assetMount: 'head.center', assetHost: null },
    whiskers: { id: 'whiskers', type: 'accessory', roles: { element: 'whiskersRoot' }, assetId: 'accessory.whiskers-cat', assetRoot: 'whiskersRoot', assetMount: 'head.center', assetHost: null }
  }
});

test('a replacement can name the exact part, and refuses a name that is not one', () => {
  const library = createFacePartRegistry();
  library.registerMany([
    part('accessory.muzzle-cat', 'accessory'),
    styleOf('accessory.muzzle-cat-flat', 'accessory.muzzle-cat', 'flat'),
    part('accessory.whiskers-cat', 'accessory'),
    styleOf('accessory.whiskers-cat-flat', 'accessory.whiskers-cat', 'flat')
  ]);
  const document = twoAccessories();

  // Without a target, the historic search decides — and with two parts in the
  // same slot it reaches whichever it finds first, which is the bug.
  const blind = planFacePartReplacement(document, 'accessory', library.get('accessory.whiskers-cat-flat'));
  assert.equal(blind.ok, true);
  assert.equal(blind.partId, 'muzzle', 'the search cannot tell two parts in one slot apart');

  // With one, it is the part named and no other.
  const aimed = planFacePartReplacement(document, 'accessory', library.get('accessory.whiskers-cat-flat'), { targetPartId: 'whiskers' });
  assert.equal(aimed.ok, true);
  assert.equal(aimed.partId, 'whiskers');
  assert.deepEqual(aimed.removeIds, ['whiskersRoot'], 'and only that part’s artwork goes');

  // A name that is not a part, or is a part of another category, is refused
  // rather than falling back to the search: a silent fallback would replace
  // the wrong accessory and look like it had worked.
  assert.deepEqual(planFacePartReplacement(document, 'accessory', library.get('accessory.muzzle-cat-flat'), { targetPartId: 'nobody' }), { ok: false, reason: 'There is no part called "nobody" on this face.' });
  const wrongKind = { ...document, semanticParts: { ...document.semanticParts, mouth: { id: 'mouth', type: 'mouth', roles: {} } } };
  assert.equal(planFacePartReplacement(wrongKind, 'accessory', library.get('accessory.muzzle-cat-flat'), { targetPartId: 'mouth' }).ok, false);
});

test('a restyle plan names a part for every replacement, so two accessories stay two', () => {
  const library = createFacePartRegistry();
  library.registerMany([
    part('accessory.muzzle-cat', 'accessory'),
    styleOf('accessory.muzzle-cat-flat', 'accessory.muzzle-cat', 'flat'),
    part('accessory.whiskers-cat', 'accessory'),
    styleOf('accessory.whiskers-cat-flat', 'accessory.whiskers-cat', 'flat')
  ]);
  const document = twoAccessories();
  const plan = restylePlan(document, 'flat', { library });
  // Each step carries the part it is about, and the two are different parts.
  assert.deepEqual(plan.replace.map((step) => `${step.partId}:${step.from}→${step.to}`),
    ['muzzle:accessory.muzzle-cat→accessory.muzzle-cat-flat', 'whiskers:accessory.whiskers-cat→accessory.whiskers-cat-flat']);
  assert.equal(new Set(plan.replace.map((step) => step.partId)).size, 2);

  // And every one of them is a target the planner accepts, aimed at its own
  // part: what `applyStyle` hands to `replace`.
  for (const step of plan.replace) {
    const aimed = planFacePartReplacement(document, step.category, library.get(step.to), { targetPartId: step.partId });
    assert.equal(aimed.ok, true, aimed.reason);
    assert.equal(aimed.partId, step.partId);
  }

  // Coming home again names the same two parts, still apart.
  const flat = structuredClone(document);
  for (const step of plan.replace) flat.semanticParts[step.partId].assetId = step.to;
  const home = restylePlan(flat, 'soft-cartoon', { library });
  assert.deepEqual(home.replace.map((step) => `${step.partId}:${step.to}`), ['muzzle:accessory.muzzle-cat', 'whiskers:accessory.whiskers-cat']);
});

/* ── Through the commands ─────────────────────────────────────────────────── */

/**
 * A restyle is one undo step, and it can be done again and again.
 *
 * The model tests above prove the arithmetic; this proves the command really
 * replaces the drawing on the canvas, really takes one history step for the
 * whole face, and really comes back to where it started after a round trip.
 */
function commandHarness() {
  const state = createTemplateProjectState();
  const store = createEditorStore(state);
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  // One restyle of a drawing the library ships. A fixture, not an asset: it is
  // registered into a library of this test's own and never reaches the editor.
  library.register({ ...MOUTH_SIMPLE, id: 'mouth.simple-flat', name: 'Simple, flat', artwork: MOUTH_SIMPLE.artwork.replace(/id="mouth-simple"/, 'id="mouth-simple-flat"'), variant: { of: 'mouth.simple', style: 'flat' } });
  const assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || null });
  const commands = createFacePartCommands(store, history, canvas, { library });
  return { store, history, commands, library };
}

const mouthAsset = (store) => Object.values(store.getDocument().semanticParts).find((part) => part.type === 'mouth')?.assetId || null;

test('applyStyle is one undo step, and a face can go out and come home again', () => {
  const ui = commandHarness();
  assert.equal(ui.commands.replace('mouth', 'mouth.simple').ok, true);
  assert.equal(mouthAsset(ui.store), 'mouth.simple');
  const before = structuredClone(ui.store.getDocument());

  // Out: the one drawing with a flat restyle moves, and the rest of the face
  // is kept rather than taken off.
  const out = ui.commands.applyStyle('flat');
  assert.equal(out.ok, true);
  assert.deepEqual([out.restyled, out.already, out.kept], [1, 0, 0]);
  assert.equal(mouthAsset(ui.store), 'mouth.simple-flat');
  // One step for the whole restyle, proved the way an author would: one undo
  // and the face is exactly what it was, not part of the way back.
  ui.history.undo();
  assert.deepEqual(ui.store.getDocument(), before, 'one undo puts the whole face back');
  assert.equal(ui.commands.applyStyle('flat').restyled, 1);

  // Asking again for the style it is already in does nothing, and says so.
  const again = ui.commands.applyStyle('flat');
  assert.deepEqual([again.restyled, again.already, again.kept], [0, 1, 0]);
  assert.equal(mouthAsset(ui.store), 'mouth.simple-flat');

  // Home: the variant resolves back through the drawing it is a style of.
  const home = ui.commands.applyStyle('soft-cartoon');
  assert.deepEqual([home.restyled, home.already, home.kept], [1, 0, 0]);
  assert.equal(mouthAsset(ui.store), 'mouth.simple');

  // And out once more, which is the round trip that did not work before.
  assert.equal(ui.commands.applyStyle('flat').restyled, 1);
  assert.equal(mouthAsset(ui.store), 'mouth.simple-flat');

  // Undo walks it back one restyle at a time.
  ui.history.undo();
  assert.equal(mouthAsset(ui.store), 'mouth.simple');
});

test('a restyle with nothing drawn for it changes nothing and takes no history step', () => {
  const ui = commandHarness();
  assert.equal(ui.commands.replace('mouth', 'mouth.simple').ok, true);
  const revision = ui.store.getPersistentRevision(), before = structuredClone(ui.store.getDocument());
  const plan = ui.commands.applyStyle('retro');
  assert.deepEqual([plan.restyled, plan.already], [0, 0]);
  assert.ok(plan.kept > 0, 'and the parts it could not redraw are counted, not removed');
  assert.equal(mouthAsset(ui.store), 'mouth.simple');
  assert.equal(ui.store.getPersistentRevision(), revision, 'nothing was written');
  assert.deepEqual(ui.store.getDocument(), before);
});
