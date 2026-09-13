import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createCharacterBuilder } = await import('../../ui/character-builder/character-builder.js');
const { deriveVisualRows, partRowIndex, rowInstallTarget, slotOrder } = await import('../../ui/character-builder/visual-rows.js');
const { deriveCharacterParts } = await import('../../ui/character-builder/character-model.js');
const { wornPartSlot } = await import('../face-library/compatibility.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createTemplateProjectState } = await import('../sample/templates/template-export.js');
const { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } = await import('./helpers/fake-face-canvas.js');
const { createFacePartCommands } = await import('../face-library/face-part-commands.js');
const { createFacePartRegistry } = await import('../face-library/face-part-registry.js');
const { BUILTIN_FACE_PARTS } = await import('../face-library/builtin/index.js');
const { FACE_STYLE_PRESETS, createFacePresetRegistry } = await import('../face-library/face-presets.js');
const { artworkIds } = await import('../face-library/face-part-model.js');

/**
 * MASC-08B — Design ▸ Face is made of visual rows, not of semantic categories.
 *
 * The whole of it in one line:
 *
 * ```text
 * Muzzle · Whiskers · Accessories    three rows, three parts, one category
 * Beak                               a row of `mouth`, and no new semantic type
 * ```
 *
 * What has to hold for that to be worth anything: a card offered in a row goes
 * on in that row; a press in one row never reaches a part in another, whatever
 * mount point and host they share; a row the mascot is wearing something in
 * never disappears; and a project that knows nothing about any of this opens
 * with its accessories under Accessories, unmigrated.
 *
 * No production drawing is added here. The four fixtures below are the
 * smallest things that are a muzzle, a pair of whiskers, a pair of glasses and
 * a beak -- enough to install, select and take off.
 */

/** A drawing small enough to read, in whatever slot the test needs it in. */
const part = (id, category, extra = {}) => {
  const root = id.replace(/\./g, '-');
  const role = { mouth: 'mouth', accessory: 'element', head: 'head' }[category] || 'element';
  return {
    id, category, name: id.split('.')[1], origin: 'custom',
    artwork: `<g id="${root}" data-name="${id}"><path id="${root}-a" data-name="${id}" d="M100 200 L140 200 L140 215 L100 215 Z" fill="#cccccc"/></g>`,
    roles: { [role]: `${root}-a` }, referenceBox: { x: 100, y: 200, width: 40, height: 15 }, ...extra
  };
};

/**
 * The four fixtures. All three accessories mount at the centre of the head with
 * no host, which is the case that used to be unreachable: the slot rule cannot
 * tell them apart, so only the row can.
 */
const MUZZLE = part('accessory.test-muzzle', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'] });
const WHISKERS = part('accessory.test-whiskers', 'accessory', { slot: 'whiskers', morphologies: ['muzzle'] });
const GLASSES = part('accessory.test-glasses', 'accessory');
const BEAK = part('mouth.test-beak', 'mouth', { slot: 'beak', morphologies: ['beak'] });

function registry(extra = []) {
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  library.registerMany([MUZZLE, WHISKERS, GLASSES, BEAK, ...extra]);
  return library;
}

/* ── The rows, pure ────────────────────────────────────────────────────── */

/** A face wearing library drawings, as `deriveCharacterParts` reads one. */
const wearing = (parts) => ({
  svgMarkup: '<svg></svg>',
  elements: Object.fromEntries(parts.map(([, , root]) => [root, { meta: { nodeType: 'g' } }])),
  layers: parts.map(([, , root]) => ({ id: root, children: [] })),
  semanticParts: Object.fromEntries(parts.map(([type, assetId, root], index) => [`p${index}`, { id: `p${index}`, type, assetId, assetRoot: root, assetMount: 'head.center', roles: {} }]))
});

const rowsOf = (document, library, morphology = null) => deriveVisualRows(deriveCharacterParts(document), { document, library, morphology });
const row = (rows, id) => rows.categories.find((item) => item.id === id);

test('muzzle, whiskers and accessories are three rows of one semantic category', () => {
  const library = registry();
  const document = wearing([['accessory', 'accessory.test-muzzle', 'muzzleRoot'], ['accessory', 'accessory.test-whiskers', 'whiskersRoot'], ['accessory', 'accessory.test-glasses', 'glassesRoot']]);
  const rows = rowsOf(document, library, 'muzzle');

  for (const id of ['muzzle', 'whiskers', 'accessory']) assert.equal(row(rows, id).categoryId, 'accessory', `${id} installs as an accessory`);
  assert.deepEqual(row(rows, 'muzzle').pieces.map((piece) => piece.id), ['muzzleRoot']);
  assert.deepEqual(row(rows, 'whiskers').pieces.map((piece) => piece.id), ['whiskersRoot']);
  assert.deepEqual(row(rows, 'accessory').pieces.map((piece) => piece.id), ['glassesRoot']);
  assert.deepEqual([row(rows, 'muzzle').assetId, row(rows, 'whiskers').assetId, row(rows, 'accessory').assetId],
    ['accessory.test-muzzle', 'accessory.test-whiskers', 'accessory.test-glasses']);

  // And no new semantic part has appeared to pay for it: three accessories.
  assert.deepEqual(Object.values(document.semanticParts).map((item) => item.type), ['accessory', 'accessory', 'accessory']);

  // The two that are slots of their own hold one piece each; the catch-all is
  // what it always was.
  assert.deepEqual([row(rows, 'muzzle').dedicated, row(rows, 'whiskers').dedicated, row(rows, 'accessory').dedicated], [true, true, false]);
});

test('a beak is a row of the mouth, and stays a mouth to the rig', () => {
  const library = registry();
  const document = wearing([['mouth', 'mouth.test-beak', 'beakRoot']]);
  const rows = rowsOf(document, library, 'beak');
  assert.equal(row(rows, 'beak').categoryId, 'mouth');
  assert.equal(row(rows, 'beak').part, 'mouth', 'the semantic part it installs as');
  assert.equal(row(rows, 'beak').multiple, false, 'a face has one mouth, beak or not');
  assert.deepEqual(row(rows, 'beak').pieces.map((piece) => piece.id), ['beakRoot']);
  assert.deepEqual(row(rows, 'mouth').pieces, [], 'and the Mouth row is empty: the beak is not in two places');
  assert.equal(document.semanticParts.p0.type, 'mouth');
});

test('a part with no asset the library knows falls back to its category, so old projects need no migration', () => {
  const library = registry();
  // One drawn by hand (no asset at all), and one from a pack that has gone.
  const document = wearing([['accessory', '', 'drawnRoot'], ['accessory', 'accessory.from-a-pack-long-gone', 'lostRoot'], ['accessory', 'accessory.test-muzzle', 'muzzleRoot']]);
  // One drawn by hand knows no asset at all: it is its roles, as it always was.
  Object.assign(document.semanticParts.p0, { assetId: null, assetRoot: null, roles: { element: 'drawnRoot' } });
  const rows = rowsOf(document, library, 'muzzle');
  assert.deepEqual(row(rows, 'accessory').pieces.map((piece) => piece.id), ['drawnRoot', 'lostRoot']);
  assert.deepEqual(row(rows, 'muzzle').pieces.map((piece) => piece.id), ['muzzleRoot']);
  assert.equal(wornPartSlot({ assetId: null, category: 'accessory' }, { library }), 'accessory');
  assert.equal(wornPartSlot({ assetId: 'accessory.nope', category: 'accessory' }, { library }), 'accessory');
  // And a slot that does not hold this kind of part is not this part's row: no
  // piece may fall out of every row and off the screen.
  assert.equal(wornPartSlot({ assetId: 'mouth.test-beak', category: 'accessory' }, { library }), 'accessory');
  assert.equal(wornPartSlot({ assetId: 'mouth.test-beak', category: 'mouth' }, { library }), 'beak');
});

test('a restyle of a muzzle is still a muzzle, whether or not the variant repeated the slot', () => {
  const library = registry([
    { ...MUZZLE, id: 'accessory.test-muzzle-flat', name: 'Muzzle, flat', variant: { of: 'accessory.test-muzzle', style: 'flat' }, slot: '' }
  ]);
  assert.equal(wornPartSlot({ assetId: 'accessory.test-muzzle-flat', category: 'accessory' }, { library }), 'muzzle');
  const rows = rowsOf(wearing([['accessory', 'accessory.test-muzzle-flat', 'muzzleRoot']]), library, 'muzzle');
  assert.deepEqual(row(rows, 'muzzle').pieces.map((piece) => piece.id), ['muzzleRoot']);
  assert.deepEqual(row(rows, 'accessory').pieces, []);
});

test('the rows follow the kind of face, and never hide one the mascot is wearing something in', () => {
  const library = registry();
  const document = wearing([['accessory', 'accessory.test-muzzle', 'muzzleRoot']]);
  // The order is the morphology's own, then everything else: Muzzle sits
  // between Ears and Nose on a cat, as the roadmap draws it.
  assert.deepEqual(slotOrder('muzzle').slice(0, 11), ['head', 'eyes', 'pupils', 'eyebrows', 'ears', 'muzzle', 'nose', 'mouth', 'whiskers', 'hair', 'accessory']);
  assert.deepEqual(rowsOf(document, library, 'muzzle').categories.map((item) => item.id).slice(0, 4), ['presets', 'type', 'style', 'palette']);
  assert.equal(rowsOf(document, library, 'muzzle').categories.at(-1).id, 'hands');

  // Browsed as a person, the Muzzle row is not one of human's -- and it is
  // still there, because the mascot is wearing one (MASC-07, per row).
  const human = rowsOf(document, library, 'human');
  assert.deepEqual(row(human, 'muzzle').pieces.map((piece) => piece.id), ['muzzleRoot']);
  assert.equal(slotOrder('human').includes('muzzle'), true, 'every row exists; which are shown is the browser\'s filter');
  assert.equal(slotOrder('human').indexOf('muzzle') > slotOrder('human').indexOf('accessory'), true, 'after the eleven a person has');
});

test('each part is indexed to its row, and pieces are owned by the row rather than the category', () => {
  const library = registry();
  const document = wearing([['accessory', 'accessory.test-muzzle', 'muzzleRoot'], ['accessory', 'accessory.test-whiskers', 'whiskersRoot']]);
  const model = deriveCharacterParts(document);
  assert.deepEqual(partRowIndex(document, model, { library }), { p0: 'muzzle', p1: 'whiskers' });
  const rows = deriveVisualRows(model, { document, library, morphology: 'muzzle' });
  assert.equal(rows.owners.muzzleRoot, 'muzzle');
  assert.equal(rows.owners.whiskersRoot, 'whiskers');
  assert.deepEqual([rows.instances.muzzleRoot, rows.instances.whiskersRoot], ['muzzle', 'whiskers']);
});

test('where a card lands in its row: what the row holds, or a part of its own', () => {
  const library = registry();
  const document = wearing([['accessory', 'accessory.test-muzzle', 'muzzleRoot'], ['accessory', 'accessory.test-glasses', 'glassesRoot']]);
  const rows = rowsOf(document, library, 'muzzle');
  // A slot of its own, holding a piece: that piece is what a card replaces.
  assert.deepEqual(rowInstallTarget(row(rows, 'muzzle')), { targetPartId: 'p0', within: [] });
  // A slot of its own, empty: a new part, and the search may look at nothing,
  // so the glasses at the same mount point are never the answer.
  assert.deepEqual(rowInstallTarget(row(rows, 'whiskers')), { targetPartId: null, within: [] });
  // The catch-all: the mount point decides, among this row's own parts.
  assert.deepEqual(rowInstallTarget(row(rows, 'accessory')), { targetPartId: null, within: ['p1'] });
});

/* ── The rows, through the builder ─────────────────────────────────────── */

function harness({ parts = [] } = {}) {
  const state = createTemplateProjectState();
  const store = createEditorStore(state);
  const history = createHistory(store);
  const browserHost = document.createElementNS('', 'div'), inspectorHost = document.createElementNS('', 'div');
  const statuses = [];
  const library = registry(parts);
  const presets = createFacePresetRegistry({ library });
  const assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = {
    ...createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || assets[id.replace(/-\d+$/, '')] || null }),
    applyElementTransform: () => {},
    elementKind: (id) => store.getDocument().elements[id]?.meta?.nodeType || null,
    describePaints: () => [],
    setAppearance: () => true
  };
  const builder = createCharacterBuilder({
    browserHost, inspectorHost, store, history, canvas,
    facePartCommands: createFacePartCommands(store, history, canvas, { library, presets }),
    onStatus: (message, tone) => statuses.push(tone ? `${tone}: ${message}` : message)
  });
  builder.render();
  const rowsNow = () => builder.snapshot().categories;
  return {
    store, history, builder, browserHost, inspectorHost, statuses, library, presets,
    press: (dataset) => browserHost.dispatch('click', { target: clickTarget({ dataset }) }),
    row: (id) => rowsNow().find((item) => item.id === id),
    /** Which asset each accessory part on the face came from, in document order. */
    accessories: () => Object.values(store.getDocument().semanticParts).filter((item) => item.type === 'accessory').map((item) => item.assetId)
  };
}

test('a muzzle, a pair of whiskers and a pair of glasses live on one face at one mount point', () => {
  const ui = harness();
  ui.builder.useStyle('accessory.test-glasses');
  ui.builder.useStyle('accessory.test-muzzle');
  ui.builder.useStyle('accessory.test-whiskers');

  assert.deepEqual(ui.accessories().sort(), ['accessory.test-glasses', 'accessory.test-muzzle', 'accessory.test-whiskers'],
    'putting a muzzle on did not take the glasses off, and the whiskers did not take the muzzle off');
  assert.deepEqual(ui.row('muzzle').assetIds, ['accessory.test-muzzle']);
  assert.deepEqual(ui.row('whiskers').assetIds, ['accessory.test-whiskers']);
  assert.deepEqual(ui.row('accessory').assetIds, ['accessory.test-glasses']);
  // All three at the same mount point, with no host: the case the slot rule
  // alone could not tell apart.
  const mounts = Object.values(ui.store.getDocument().semanticParts).filter((item) => item.type === 'accessory').map((item) => item.assetMount);
  assert.deepEqual(mounts, ['head.center', 'head.center', 'head.center']);
});

test('a card in one row replaces only that row, and a press on the card it wears takes only that off', () => {
  const ui = harness({ parts: [{ ...MUZZLE, id: 'accessory.test-muzzle-long', name: 'Long muzzle' }] });
  ui.builder.useStyle('accessory.test-glasses');
  ui.builder.useStyle('accessory.test-muzzle');
  ui.builder.useStyle('accessory.test-whiskers');

  // Another muzzle: the Muzzle row changes, and nothing else does.
  assert.equal(ui.builder.useStyle('accessory.test-muzzle-long'), true);
  assert.deepEqual(ui.row('muzzle').assetIds, ['accessory.test-muzzle-long']);
  assert.deepEqual(ui.row('whiskers').assetIds, ['accessory.test-whiskers']);
  assert.deepEqual(ui.row('accessory').assetIds, ['accessory.test-glasses']);
  assert.equal(ui.accessories().length, 3, 'still three accessories: one was replaced, none added');

  // The card of what a row wears is the way it comes off, and takes nothing else.
  assert.equal(ui.builder.useStyle('accessory.test-whiskers'), true);
  assert.deepEqual(ui.row('whiskers').assetIds, []);
  assert.deepEqual(ui.row('muzzle').assetIds, ['accessory.test-muzzle-long']);
  assert.deepEqual(ui.row('accessory').assetIds, ['accessory.test-glasses']);

  // One undo step each, as every press in the builder is.
  const before = structuredClone(ui.store.getDocument());
  ui.builder.useStyle('accessory.test-muzzle');
  assert.deepEqual(ui.row('muzzle').assetIds, ['accessory.test-muzzle']);
  ui.history.undo();
  assert.deepEqual(ui.store.getDocument(), before);
});

test('the row a piece is in is the row a click on it opens', () => {
  const ui = harness();
  ui.builder.useStyle('accessory.test-glasses');
  ui.builder.useStyle('accessory.test-muzzle');
  ui.builder.useStyle('accessory.test-whiskers');

  const rootOf = (assetId) => Object.values(ui.store.getDocument().semanticParts).find((item) => item.assetId === assetId).assetRoot;
  for (const [assetId, expected] of [['accessory.test-muzzle', 'muzzle'], ['accessory.test-whiskers', 'whiskers'], ['accessory.test-glasses', 'accessory']]) {
    ui.builder.selectPiece(rootOf(assetId));
    assert.equal(ui.builder.snapshot().active, expected, `${assetId} opens ${expected}`);
    // And the inspector names the row, not the category it installs through.
    assert.equal(ui.inspectorHost.dataset.partKind, 'piece');
  }

  // A card dropped on the mascot opens its own row, whichever one was open.
  ui.press({ partCategory: 'accessory' });
  assert.equal(ui.builder.snapshot().active, 'accessory');
  ui.builder.useStyle('accessory.test-muzzle');
  assert.equal(ui.builder.snapshot().active, 'muzzle', 'a muzzle press opens Muzzle, never Accessories');
});

test('a row offers only its own drawings, and installs them through the semantic category', () => {
  const ui = harness();
  ui.press({ partCategory: 'type' });
  ui.builder.useStyle('accessory.test-muzzle');
  ui.press({ partCategory: 'muzzle' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory\.test-muzzle"/);
  assert.equal(/data-face-part="accessory\.test-whiskers"/.test(ui.browserHost.innerHTML), false, 'the whiskers are not among the muzzles');
  assert.equal(/data-face-part="accessory\.test-glasses"/.test(ui.browserHost.innerHTML), false, 'and neither are the glasses');
  // What went on is an accessory, whichever row the card was found in.
  assert.equal(Object.values(ui.store.getDocument().semanticParts).find((item) => item.assetId === 'accessory.test-muzzle').type, 'accessory');
});

test('a beak replaces the mouth and is not a semantic part of its own', () => {
  const ui = harness();
  const mouthPart = Object.values(ui.store.getDocument().semanticParts).find((item) => item.type === 'mouth').id;
  assert.equal(ui.builder.useStyle('mouth.test-beak'), true);
  const parts = Object.values(ui.store.getDocument().semanticParts);
  assert.deepEqual(parts.filter((item) => item.type === 'mouth').map((item) => item.id), [mouthPart], 'one mouth, the same one');
  assert.equal(parts.some((item) => ['muzzle', 'whiskers', 'beak'].includes(item.type)), false, 'and no new kind of semantic part');
  assert.equal(ui.row('beak').assetId, 'mouth.test-beak');
  assert.equal(ui.row('mouth').assetId, null, 'and the Mouth row is empty: one part, one row');
  assert.equal(ui.builder.snapshot().active, 'beak');
});

test('a preset naming two drawings at one mount point puts both on, and keeps the one it names', () => {
  const ui = harness();
  ui.presets.register({ id: 'tabby', name: 'Tabby', parts: { head: 'head.round' }, accessories: ['accessory.test-muzzle', 'accessory.test-whiskers'] });
  // Both accessories mount at the centre of the head with no host: by the mount
  // rule alone the whiskers would have gone on over the muzzle.
  assert.equal(ui.builder.useFacePreset('tabby'), true);
  assert.deepEqual(ui.accessories().sort(), ['accessory.test-muzzle', 'accessory.test-whiskers']);
  assert.deepEqual(ui.row('muzzle').assetIds, ['accessory.test-muzzle']);
  assert.deepEqual(ui.row('whiskers').assetIds, ['accessory.test-whiskers']);

  // Applied again, it does not grow a second pair of anything: a drawing the
  // face already wears is put back on the part that is wearing it.
  assert.equal(ui.builder.useFacePreset('tabby'), true);
  assert.equal(ui.accessories().length, 2);

  // And an accessory the preset does not name still comes off.
  ui.builder.useStyle('accessory.test-glasses');
  assert.equal(ui.accessories().length, 3);
  ui.builder.useFacePreset('tabby');
  assert.deepEqual(ui.accessories().sort(), ['accessory.test-muzzle', 'accessory.test-whiskers']);
});

test('the presets on offer follow the kind of face, and the six human ones stay human', () => {
  const ui = harness();
  for (const item of FACE_STYLE_PRESETS) ui.presets.register(item);
  ui.presets.register({ id: 'tabby', name: 'Tabby', parts: { head: 'head.round' }, accessories: ['accessory.test-muzzle', 'accessory.test-whiskers'] });
  ui.press({ partCategory: 'presets' });
  const offered = () => [...ui.browserHost.innerHTML.matchAll(/data-face-preset="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(offered(), ['classic', 'professor', 'young', 'old', 'robot', 'minimal'], 'a template face is human, and the six are its presets');

  // A face wearing a muzzle is a muzzle face, and the presets follow: the six
  // Soft Cartoon animals the library ships (MASC-10B), then the one this
  // harness drew for itself.
  ui.builder.useStyle('accessory.test-muzzle');
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.builder.snapshot().morphology, 'muzzle');
  assert.deepEqual(offered(), ['cat', 'dog', 'fox', 'bear', 'wolf', 'rabbit', 'tabby']);
});
