import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createCharacterBuilder } = await import('../../ui/character-builder/character-builder.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createTemplateProjectState } = await import('../sample/templates/template-export.js');
const { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } = await import('./helpers/fake-face-canvas.js');
const { createFacePartCommands } = await import('../face-library/face-part-commands.js');
const { createFacePartRegistry, loadCustomParts } = await import('../face-library/face-part-registry.js');
const { createFacePresetRegistry, presetMorphology } = await import('../face-library/face-presets.js');
const { BUILTIN_FACE_PARTS } = await import('../face-library/builtin/index.js');
const { artworkIds, assetHasTag, assetTags, parseFaceTags } = await import('../face-library/face-part-model.js');
const { assetSlot } = await import('../face-library/face-morphologies.js');

/**
 * MASC-08C — a drawing saved from a row comes back to that row.
 *
 * ```text
 * Muzzle row → Save as a library part → slot 'muzzle' → the library → Muzzle row
 * ```
 *
 * That is the whole invariant, and until now it was broken at the third arrow:
 * the form asked for a *semantic category*, so an author who took a pack's
 * muzzle, reshaped it and saved it got an accessory, which Design listed under
 * Accessories beside the glasses. What closes it is asking for the **slot** and
 * deriving the category from it -- one question, not two in two vocabularies --
 * and carrying `morphologies` and `tags` along with it.
 *
 * The second half is the presets: a face saved as a preset now writes down what
 * kind of face it makes, when its own drawings say so, and writes nothing when
 * they do not.
 *
 * No production drawing is added. The fixtures are the MASC-08B ones.
 */

const part = (id, category, extra = {}) => {
  const root = id.replace(/\./g, '-');
  const role = { mouth: 'mouth', accessory: 'element', head: 'head', nose: 'nose' }[category] || 'element';
  return {
    id, category, name: id.split('.')[1], origin: 'custom',
    artwork: `<g id="${root}" data-name="${id}"><path id="${root}-a" data-name="${id}" d="M100 200 L140 200 L140 215 L100 215 Z" fill="#cccccc"/></g>`,
    roles: { [role]: `${root}-a` }, referenceBox: { x: 100, y: 200, width: 40, height: 15 }, ...extra
  };
};

const MUZZLE = part('accessory.pack-muzzle', 'accessory', { slot: 'muzzle', morphologies: ['muzzle'], tags: ['cat', 'short'], pack: 'Cats' });
const WHISKERS = part('accessory.pack-whiskers', 'accessory', { slot: 'whiskers', morphologies: ['muzzle'], tags: ['cat'], pack: 'Cats' });
const GLASSES = part('accessory.pack-glasses', 'accessory');
const BEAK = part('mouth.pack-beak', 'mouth', { slot: 'beak', morphologies: ['beak'] });
const EVERY_KIND = part('accessory.pack-star', 'accessory', { slot: 'horns', morphologies: ['*'] });

function registry(extra = []) {
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  library.registerMany([MUZZLE, WHISKERS, GLASSES, BEAK, EVERY_KIND, ...extra]);
  return library;
}

function harness({ parts = [], storage: partStorage = null } = {}) {
  const store = createEditorStore(createTemplateProjectState());
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
  const commands = createFacePartCommands(store, history, canvas, { library, presets, partStorage });
  const builder = createCharacterBuilder({ browserHost, inspectorHost, store, history, canvas, facePartCommands: commands, onStatus: (message, tone) => statuses.push(tone ? `${tone}: ${message}` : message) });
  builder.render();
  return {
    store, history, builder, commands, library, presets, browserHost, inspectorHost, statuses,
    press: (dataset) => browserHost.dispatch('click', { target: clickTarget({ dataset }) }),
    change: (dataset, value) => inspectorHost.dispatch('change', { target: { dataset, value } }),
    /** The root of the part wearing an asset, so a saved piece can be picked up again. */
    rootOf: (assetId) => Object.values(store.getDocument().semanticParts).find((item) => item.assetId === assetId)?.assetRoot || null
  };
}

/* ── The slot is the truth, and the category comes from it ─────────────── */

test('a drawing saved from the Muzzle row is a muzzle, and comes back to Muzzle', () => {
  const ui = harness();
  ui.builder.useStyle('accessory.pack-muzzle');
  const root = ui.rootOf('accessory.pack-muzzle');
  const saved = ui.commands.saveAsPart({ rootId: root, slot: 'muzzle', name: 'My muzzle', roles: { element: root }, morphologies: ['muzzle'], tags: ['cat', 'short'] });
  assert.equal(saved.ok, true, saved.reason);
  assert.deepEqual([saved.asset.category, saved.asset.slot, [...saved.asset.morphologies], [...saved.asset.tags]], ['accessory', 'muzzle', ['muzzle'], ['cat', 'short']]);
  // Which is the whole point: it is offered under Muzzle, and not beside the glasses.
  assert.equal(assetSlot(saved.asset), 'muzzle');
  assert.equal(saved.asset.id, 'accessory.my-muzzle', 'the id is still the category first, so a listing sorts by what the rig gets');
});

test('a drawing saved from the Beak row is a mouth to the rig and a beak to Design', () => {
  const ui = harness();
  ui.builder.useStyle('mouth.pack-beak');
  const root = ui.rootOf('mouth.pack-beak');
  const saved = ui.commands.saveAsPart({ rootId: root, slot: 'beak', name: 'My beak', roles: { mouth: root }, morphologies: ['beak'] });
  assert.equal(saved.ok, true, saved.reason);
  assert.deepEqual([saved.asset.category, saved.asset.slot], ['mouth', 'beak']);
  assert.equal(assetSlot(saved.asset), 'beak');
  // And no new semantic part came of it.
  assert.equal(Object.values(ui.store.getDocument().semanticParts).some((item) => ['muzzle', 'beak', 'whiskers'].includes(item.type)), false);
});

test('a piece nobody drew for the library is saved as the row it is in, which is its category', () => {
  const ui = harness();
  const saved = ui.commands.saveAsPart({ rootId: 'mouth', slot: 'mouth', name: 'Plain', roles: { mouth: 'mouth' } });
  assert.deepEqual([saved.asset.category, saved.asset.slot, [...saved.asset.morphologies], [...saved.asset.tags]], ['mouth', 'mouth', [], []]);
  // And the historic call, which names a category and nothing else, means the
  // slot of the same name.
  const legacy = ui.commands.saveAsPart({ rootId: 'mouth', category: 'mouth', name: 'Plain two', roles: { mouth: 'mouth' } });
  assert.deepEqual([legacy.asset.category, legacy.asset.slot], ['mouth', 'mouth']);
  assert.deepEqual(ui.commands.saveAsPart({ rootId: 'mouth', slot: 'nope', name: 'x' }), { ok: false, reason: '"nope" is not a part a drawing can be saved as.' });
});

test('a slot is offered only where its semantic part could be filled from the shapes the piece carries', () => {
  const ui = harness();
  ui.builder.openCategory('mouth');
  ui.builder.selectPiece('mouth');
  const { slots } = formOf(ui);
  // The template's mouth is one shape. It can be a mouth, a nose, a beak, a
  // muzzle, a pair of glasses -- anything whose part names one required role.
  for (const id of ['mouth', 'beak', 'muzzle', 'whiskers', 'accessory', 'nose', 'head']) assert.equal(slots.includes(id), true, `${id} is offered`);
  // It cannot be a pair of eyes, or of brows, or the four lids: there is
  // nothing to be the other side. The required roles are the library's own, so
  // there is no second reading of what a part needs.
  for (const id of ['eyes', 'pupils', 'eyebrows', 'eyelids', 'ears']) assert.equal(slots.includes(id), false, `${id} is not offered for one shape`);
});

/* ── What it suits, and what to find it by ─────────────────────────────── */

test('the kinds of face are the author\'s, and nothing ticked is every kind', () => {
  const ui = harness();
  const save = (name, morphologies) => ui.commands.saveAsPart({ rootId: 'mouth', slot: 'mouth', name, roles: { mouth: 'mouth' }, morphologies }).asset;
  assert.deepEqual([...save('One', ['muzzle']).morphologies], ['muzzle']);
  assert.deepEqual([...save('Two', ['muzzle', 'monster']).morphologies], ['muzzle', 'monster']);
  assert.deepEqual([...save('Three', []).morphologies], [], 'universal, and said in one way only');
  assert.deepEqual([...save('Four', ['muzzle', 'muzzle']).morphologies], ['muzzle'], 'said twice is said once');
  // A kind nobody has heard of is refused rather than written down.
  const refused = ui.commands.saveAsPart({ rootId: 'mouth', slot: 'mouth', name: 'Five', roles: { mouth: 'mouth' }, morphologies: ['unicorn'] });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /no kind of face called "unicorn"/);
  // Nothing that is saved is ever `'*'`, which the validator still reads on
  // the way in: one canonical way to say universal, and it is `[]`.
  for (const name of ['One', 'Two', 'Three', 'Four']) assert.equal(ui.library.get(`mouth.${name.toLowerCase()}`).morphologies.includes('*'), false);
});

test('tags are free vocabulary, normalised the one way, and a word that is not a tag is refused by name', () => {
  assert.deepEqual(parseFaceTags('Cat, fox, pointed'), ['cat', 'fox', 'pointed']);
  assert.deepEqual(parseFaceTags('  Cat ,  ,fox   short  '), ['cat', 'fox', 'short'], 'spaces and empties are not tags');
  assert.deepEqual(parseFaceTags('cat, Cat, CAT'), ['cat'], 'said three ways is said once');
  assert.deepEqual(parseFaceTags(''), []);
  assert.deepEqual(parseFaceTags(null), []);
  assert.deepEqual(assetTags({ tags: ['Cat', ' cat ', 'Fox'] }), ['cat', 'fox']);
  assert.equal(assetHasTag({ tags: ['cat'] }, 'CAT'), true);
  assert.equal(assetHasTag({ tags: ['cat'] }, 'dog'), false);
  assert.equal(assetHasTag({}, 'cat'), false);

  const ui = harness();
  const saved = ui.commands.saveAsPart({ rootId: 'mouth', slot: 'mouth', name: 'Tagged', roles: { mouth: 'mouth' }, tags: parseFaceTags('Cat, fox, pointed') });
  assert.deepEqual([...saved.asset.tags], ['cat', 'fox', 'pointed']);
  const refused = ui.commands.saveAsPart({ rootId: 'mouth', slot: 'mouth', name: 'Bad', roles: { mouth: 'mouth' }, tags: ['cat!'] });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /"cat!" is not a tag/);
});

test('what was saved is what comes back: the metadata survives storage and a fresh registry', () => {
  const stored = new Map();
  const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  const ui = harness({ storage });
  ui.builder.useStyle('accessory.pack-muzzle');
  const root = ui.rootOf('accessory.pack-muzzle');
  const saved = ui.commands.saveAsPart({ rootId: root, slot: 'muzzle', name: 'My muzzle', roles: { element: root }, morphologies: ['muzzle'], tags: ['cat', 'short'] });
  assert.equal(saved.ok, true, saved.reason);

  const again = createFacePartRegistry();
  again.registerMany(BUILTIN_FACE_PARTS);
  loadCustomParts(storage, again);
  const back = again.get('accessory.my-muzzle');
  assert.deepEqual([back.category, back.slot, [...back.morphologies], [...back.tags]], ['accessory', 'muzzle', ['muzzle'], ['cat', 'short']]);
  assert.equal(assetSlot(back), 'muzzle', 'and it is still offered under Muzzle in the next session');
});

/* ── The form's defaults ───────────────────────────────────────────────── */

/** The save form the inspector is showing, read out of its markup. */
function formOf(ui) {
  const html = ui.inspectorHost.innerHTML;
  const slot = html.match(/data-part-save-slot aria-label="Part">([\s\S]*?)<\/select>/)?.[1] || '';
  const kinds = [...html.matchAll(/data-part-save-morphology="([^"]+)"( checked)?/g)];
  return {
    slots: [...slot.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]),
    slot: slot.match(/<option value="([^"]+)" selected>/)?.[1] || null,
    category: html.match(/data-part-save-category="([^"]+)"/)?.[1] || null,
    morphologies: kinds.filter((match) => match[2]).map((match) => match[1]),
    tags: html.match(/data-part-save-tags placeholder="[^"]*" maxlength="\d+" value="([^"]*)"/)?.[1] ?? null
  };
}

test('the form opens on the row the piece is in, with the drawing\'s own metadata', () => {
  const ui = harness();
  ui.builder.useStyle('accessory.pack-muzzle');
  ui.builder.selectPiece(ui.rootOf('accessory.pack-muzzle'));
  const form = formOf(ui);
  assert.equal(form.slot, 'muzzle', 'the row it is in, not the category it installs through');
  assert.equal(form.category, 'accessory', 'said once, derived, never asked for');
  assert.deepEqual(form.morphologies, ['muzzle'], 'the kinds the pack\'s drawing named');
  assert.equal(form.tags, 'cat, short');
  // The seven slots that are not a category of their own are on offer too:
  // this is the door a first muzzle comes into the library through.
  for (const id of ['muzzle', 'whiskers', 'beak', 'horns', 'crest', 'antenna', 'panels']) assert.equal(form.slots.includes(id), true, `${id} is offered`);
});

test('a drawing that says nothing about the kinds of face it suits does not acquire a restriction by being edited', () => {
  const ui = harness();
  ui.builder.useStyle('accessory.pack-glasses');
  ui.builder.selectPiece(ui.rootOf('accessory.pack-glasses'));
  assert.deepEqual(formOf(ui).morphologies, [], 'universal stays universal');
  assert.equal(formOf(ui).tags, '');
  // And one that said `'*'` out loud reads as the same thing, so saving it
  // writes the one canonical form.
  ui.builder.useStyle('accessory.pack-star');
  ui.builder.selectPiece(ui.rootOf('accessory.pack-star'));
  assert.equal(formOf(ui).slot, 'horns');
  assert.deepEqual(formOf(ui).morphologies, []);
});

test('a new drawing saved as a row a person has not got suggests the kind of face being browsed, and the suggestion is only that', () => {
  const ui = harness();
  // The template's own mouth: nobody drew it for the library, so it says
  // nothing about the kinds of face it suits and nothing may be read from it.
  ui.press({ partCategory: 'type' });
  ui.press({ faceType: 'muzzle' });
  ui.builder.openCategory('mouth');
  ui.builder.selectPiece('mouth');
  assert.deepEqual(formOf(ui).morphologies, [], 'a mouth is every kind of face');

  // Saved as a muzzle, while Design is offering muzzle faces: the kind is
  // suggested, because that is what the author is plainly making.
  ui.change({ partSaveSlot: '' }, 'muzzle');
  assert.deepEqual(formOf(ui).morphologies, ['muzzle']);
  // And it follows the row, because nobody has touched it.
  ui.change({ partSaveSlot: '' }, 'whiskers');
  assert.deepEqual(formOf(ui).morphologies, ['muzzle']);
  ui.change({ partSaveSlot: '' }, 'accessory');
  assert.deepEqual(formOf(ui).morphologies, [], 'the catch-all row suggests nothing: universal');
});

test('the form is the author\'s the moment they touch it: the name, the tags and the kinds survive a change of row', () => {
  const ui = harness();
  ui.press({ partCategory: 'type' });
  ui.press({ faceType: 'muzzle' });
  ui.builder.openCategory('mouth');
  ui.builder.selectPiece('mouth');
  ui.change({ partSaveName: '' }, 'My thing');
  ui.change({ partSaveTags: '' }, 'cat, short');
  ui.change({ partSaveSlot: '' }, 'muzzle');
  assert.equal(formOf(ui).slot, 'muzzle');
  assert.equal(formOf(ui).category, 'accessory');
  assert.equal(formOf(ui).tags, 'cat, short', 'what was typed is still there');
  assert.match(ui.inspectorHost.innerHTML, /data-part-save-name placeholder="A name" maxlength="40" required value="My thing"/);
  // The kinds the row suggested, unticked on purpose, stay unticked.
  assert.deepEqual(formOf(ui).morphologies, ['muzzle'], 'the suggestion followed the row');
  ui.inspectorHost.dispatch('change', { target: { dataset: { partSaveMorphology: 'muzzle' }, value: 'muzzle', checked: false, closest: () => null } });
  ui.change({ partSaveSlot: '' }, 'whiskers');
  assert.deepEqual(formOf(ui).morphologies, [], 'once touched, the choice is the author\'s and the row stops suggesting');
});

test('the form saves what it shows, and says which row the drawing landed in', () => {
  const ui = harness();
  ui.press({ partCategory: 'type' });
  ui.press({ faceType: 'muzzle' });
  ui.builder.openCategory('mouth');
  ui.builder.selectPiece('mouth');
  ui.inspectorHost.dispatch('submit', {
    target: clickTarget({ tag: 'form', dataset: { partSaveForm: '' } }),
    name: { value: 'Cat muzzle' }, slot: { value: 'muzzle' }, roles: { element: 'mouth' },
    morphologies: ['muzzle'], tags: { value: 'Cat, short' }
  });
  assert.equal(ui.statuses.at(-1), 'Cat muzzle is in the library now, under Muzzle for Muzzle faces: a style card of yours, on this face and the next.');
  const asset = ui.library.get('accessory.cat-muzzle');
  assert.deepEqual([asset.category, asset.slot, [...asset.morphologies], [...asset.tags]], ['accessory', 'muzzle', ['muzzle'], ['cat', 'short']]);
  // And Design offers it where it was saved.
  ui.press({ partCategory: 'muzzle' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory\.cat-muzzle"/);
  ui.press({ partCategory: 'accessory' });
  assert.equal(/data-face-part="accessory\.cat-muzzle"/.test(ui.browserHost.innerHTML), false, 'and nowhere else');
});

/* ── A dedicated row uses, it does not add ─────────────────────────────── */

test('a row that holds one thing says Use; only the row that accumulates says Add', () => {
  const ui = harness();
  ui.press({ partCategory: 'type' });
  ui.press({ faceType: 'muzzle' });
  ui.press({ partCategory: 'muzzle' });
  assert.match(ui.browserHost.innerHTML, /title="Use pack-muzzle"/);
  assert.equal(/title="Add pack-muzzle"/.test(ui.browserHost.innerHTML), false);
  ui.press({ partCategory: 'accessory' });
  assert.match(ui.browserHost.innerHTML, /title="Add pack-glasses"/);
  // And a category a face wears one of is as it was: Add while it is empty,
  // Use once something is on it.
  ui.press({ partCategory: 'mouth' });
  assert.match(ui.browserHost.innerHTML, /title="Use Wide: /);
});

/* ── A preset saved from a face knows what kind of face it is ──────────── */

test('a preset saved from a face made of distinctive drawings claims that kind of face', () => {
  const ui = harness();
  ui.builder.useStyle('mouth.wide');
  ui.builder.useStyle('accessory.pack-muzzle');
  ui.builder.useStyle('accessory.pack-whiskers');
  const saved = ui.commands.saveAsPreset({ name: 'Tabby' });
  assert.equal(saved.ok, true, saved.reason);
  assert.equal(saved.preset.morphology, 'muzzle');
  assert.deepEqual([...saved.preset.tags], [], 'a species is editorial: nothing is invented from a kind of face');
  assert.equal(presetMorphology(saved.preset, { library: ui.library }), 'muzzle');
});

test('a preset saved from a face that does not say claims nothing, and is read as a person afterwards', () => {
  const ui = harness();
  ui.builder.useStyle('mouth.wide');
  const saved = ui.commands.saveAsPreset({ name: 'Plain' });
  assert.equal(saved.preset.morphology, '', 'nothing is guessed');
  // Which is not the same as being nowhere: the reading of a claimless preset
  // is unchanged, so it is offered to people exactly as the six shipped ones are.
  assert.equal(presetMorphology(saved.preset, { library: ui.library }), 'human');

  // A face of drawings no one kind of face holds claims nothing either.
  ui.builder.useStyle('accessory.pack-muzzle');
  ui.builder.useStyle('mouth.pack-beak');
  assert.equal(ui.commands.saveAsPreset({ name: 'Chimera' }).preset.morphology, '');
});

test('a preset carries the tags it is given, and the Type row is never what decides its kind', () => {
  const ui = harness();
  ui.builder.useStyle('mouth.wide');
  ui.builder.useStyle('accessory.pack-muzzle');
  ui.builder.useStyle('accessory.pack-whiskers');
  // Design browsed as something else entirely: a session preference, and no
  // part of what the face is made of.
  ui.press({ partCategory: 'type' });
  ui.press({ faceType: 'human' });
  const saved = ui.commands.saveAsPreset({ name: 'Tabby two', tags: ['cat', 'tabby'] });
  assert.equal(saved.preset.morphology, 'muzzle', 'read from the mascot, not from the row');
  assert.deepEqual([...saved.preset.tags], ['cat', 'tabby']);
});
