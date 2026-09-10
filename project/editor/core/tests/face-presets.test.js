import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_PRESETS_KEY, FACE_PALETTES, FACE_PRESET_LIBRARY, FACE_STYLE_PRESETS, FacePresetError, PRESET_PART_ORDER, createFacePresetRegistry, facePresetFromDocument, loadCustomPresets, normalizeFacePreset, placementOf, planFacePreset, presetColours, presetOfFace, presetThumbnail, saveCustomPresets, validateFacePreset } from '../face-library/face-presets.js';
import { FACE_PART_LIBRARY } from '../face-library/face-part-registry.js';
import { PALETTE_TOKENS } from '../face-library/face-part-model.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { artworkIds } from '../face-library/face-part-model.js';
import { validateRig } from '../validation/rig-validator.js';

/**
 * Face style presets (docs/FACE_PART_LIBRARY.md, "Presets"): a recipe over
 * the library, applied to the face that is there as one undo step, read
 * back from the parts it leaves, and saved from a face as one of the
 * author's own.
 */
function harness(storage = null) {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const assets = {};
  for (const asset of FACE_PART_LIBRARY.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const paints = { head: { fill: '#f9d9b0', stroke: '#a4674a' }, hair: { fill: '#a6603c' }, mouth: { fill: '#6d2831' }, eyeWhiteLeft: { fill: '#ffffff' }, pupilLeft: { fill: '#2f3a43' } };
  const canvas = { ...createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || assets[id.replace(/-\d+$/, '')] || null }), setAppearance: (id, property, value) => { history.snapshot(); paints[id] = { ...(paints[id] || {}), [property]: value }; store.execute({ type: 'artwork/set-appearance', domains: ['artwork'], source: 'test', apply: () => {} }); return true; }, describePaints: () => Object.entries(paints).filter(([id]) => store.getDocument().elements[id]).map(([id, paint]) => ({ id, ...paint })) };
  const presets = createFacePresetRegistry();
  for (const item of FACE_STYLE_PRESETS) presets.register(item);
  const commands = createFacePartCommands(store, history, canvas, { presets, presetStorage: storage });
  return { store, history, canvas, commands, presets, paints };
}

test('the six presets are recipes the library can honour, in every category, with a palette each', () => {
  assert.deepEqual(FACE_STYLE_PRESETS.map((item) => item.id), ['classic', 'professor', 'young', 'old', 'robot', 'minimal']);
  for (const item of FACE_STYLE_PRESETS) {
    const result = validateFacePreset(item, FACE_PART_LIBRARY);
    assert.equal(result.ok, true, `${item.id}: ${result.issues.map((issue) => issue.message).join(' ')}`);
    for (const category of ['head', 'ears', 'eyes', 'eyebrows', 'nose', 'mouth', 'hair']) assert.ok(item.parts[category], `${item.id} names a ${category}`);
    assert.ok(FACE_PALETTES[item.palette], `${item.id} paints in a known palette`);
  }
  for (const palette of Object.values(FACE_PALETTES)) assert.deepEqual(Object.keys(palette), [...PALETTE_TOKENS], 'every token a colour');
  assert.deepEqual([...PRESET_PART_ORDER], ['head', 'ears', 'eyes', 'eyebrows', 'nose', 'mouth', 'hair', 'facialHair'], 'the skull first');
  assert.equal(FACE_PRESET_LIBRARY.size, 6);
  assert.equal(FACE_PRESET_LIBRARY.get('professor').accessories[0], 'accessory.glasses');
  assert.deepEqual(presetColours(FACE_PRESET_LIBRARY.get('robot')), FACE_PALETTES.robot);
  assert.deepEqual(presetColours({ palette: { skin: '#123' } }), { skin: '#123' });
});

test('a preset is normalised and validated: real categories, real assets in them, a known palette, one id', () => {
  const item = normalizeFacePreset({ id: ' Mine ', name: ' Mine ', parts: { head: ' head.round ', nope: 3 }, accessories: ['accessory.hat', 'accessory.hat', 7], palette: { skin: '#ABC', nope: '#000' } });
  assert.deepEqual(item, { id: 'Mine', name: 'Mine', description: '', parts: { head: 'head.round' }, accessories: ['accessory.hat'], palette: { skin: '#abc' }, hands: {}, placements: {}, origin: 'custom', pack: null });
  const codes = (input, options) => validateFacePreset(input, FACE_PART_LIBRARY, options).issues.map((issue) => issue.code);
  assert.deepEqual(codes({ name: 'x', parts: { head: 'head.round' } }), ['id-missing']);
  assert.deepEqual(codes({ id: 'Bad Id', name: 'x', parts: { head: 'head.round' } }), ['id-format']);
  assert.deepEqual(codes({ id: 'classic', name: 'x', parts: { head: 'head.round' } }, { taken: (id) => id === 'classic' }), ['id-taken']);
  assert.deepEqual(codes({ id: 'x', parts: { head: 'head.round' } }), ['name-missing']);
  assert.deepEqual(codes({ id: 'x', name: 'x' }), ['parts-missing']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { hands: 'head.round' } }), ['parts-category-unknown']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { head: 'head.nope' } }), ['parts-asset-unknown']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { head: 'mouth.wide' } }), ['parts-asset-category']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { head: 'head.round' }, accessories: ['nope'] }), ['accessories-asset-unknown']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { head: 'head.round' }, accessories: ['mouth.wide'] }), ['accessories-asset-category']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { head: 'head.round' }, palette: 'neon' }), ['palette-unknown']);
  const registry = createFacePresetRegistry();
  registry.register({ id: 'x', name: 'X', parts: { head: 'head.round' } });
  assert.throws(() => registry.register({ id: 'x', name: 'X', parts: { head: 'head.round' } }), (error) => error instanceof FacePresetError && error.issues[0].code === 'id-taken');
  assert.equal(registry.size, 1);
  assert.equal(registry.remove('x'), true);
});

test('applying a preset is every step the builder runs, in order, as one undo step, and the face then wears it', () => {
  const ui = harness();
  const before = structuredClone(ui.store.getDocument());
  assert.equal(ui.commands.presetOf(), null, 'the template wears no preset');
  // What the professor does to the template: glasses on, the skull first.
  const steps = planFacePreset(ui.store.getDocument(), ui.presets.get('professor'));
  assert.deepEqual(steps.slice(0, 3).map((step) => `${step.kind}:${step.category || step.token}`), ['replace:head', 'replace:ears', 'replace:eyes']);
  assert.deepEqual(steps.filter((step) => step.kind === 'replace').map((step) => step.assetId), ['head.oval', 'ears.round', 'eyes.round-small', 'eyebrows.thick', 'nose.hook', 'mouth.small', 'hair.bald', 'facialhair.moustache', 'accessory.glasses']);
  assert.deepEqual(steps.filter((step) => step.kind === 'retint').map((step) => step.token), [...PALETTE_TOKENS], 'then the palette');
  const result = ui.commands.applyPreset('professor');
  assert.deepEqual([result.ok, result.preset, result.refused], [true, 'professor', null]);
  assert.ok(result.steps >= 9);
  const document = ui.store.getDocument();
  assert.equal(ui.commands.presetOf()?.id, 'professor', 'read back from the parts');
  assert.ok(document.elements['accessory-glasses'] && document.elements['facial-hair-moustache'] && document.elements['skull']);
  assert.equal('head' in document.elements, false, 'the template\'s skull went');
  assert.deepEqual(validateRig(document), []);
  assert.equal(ui.paints.hair.fill, '#a6603c', 'the warm palette is the template\'s own: nothing to repaint');
  assert.deepEqual(ui.history.getState(), { canUndo: true, canRedo: false });
  ui.history.undo();
  assert.deepEqual(ui.store.getDocument(), before, 'one undo, and the template is back');
  assert.equal(ui.commands.presetOf(), null);
  // The robot repaints: the skull grey, and takes the professor's glasses off for its bow tie.
  ui.commands.applyPreset('professor');
  const robot = ui.commands.applyPreset('robot');
  assert.equal(robot.ok, true, robot.refused?.reason);
  assert.equal(ui.commands.presetOf()?.id, 'robot');
  assert.equal(ui.paints.skull?.fill ?? ui.paints.head?.fill, undefined === ui.paints.skull ? ui.paints.head?.fill : ui.paints.skull.fill);
  const parts = Object.values(ui.store.getDocument().semanticParts);
  assert.deepEqual(parts.filter((part) => part.type === 'accessory').map((part) => part.assetId), ['accessory.bow-tie'], 'the glasses came off');
  assert.equal(parts.some((part) => part.type === 'facialHair'), false, 'and the moustache');
  assert.deepEqual(validateRig(ui.store.getDocument()), []);
  assert.deepEqual(ui.commands.applyPreset('nope').refused.reason, 'There is no preset called "nope".');
});

test('the face as a preset: what it wears and the colours it is painted in, saved and loaded through storage', () => {
  const stored = new Map();
  const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  const ui = harness(storage);
  assert.equal(ui.presets.size, 6, 'nothing saved yet');
  ui.commands.applyPreset('young');
  ui.commands.replace('accessory', 'accessory.hat');
  ui.commands.replace('facialHair', 'facialhair.goatee');
  const item = facePresetFromDocument(ui.store.getDocument(), ui.commands.palette(), { id: 'mine', name: 'Mine' });
  assert.deepEqual(item.parts, { head: 'head.round', ears: 'ears.round', eyes: 'eyes.round-large', eyebrows: 'eyebrows.thin', nose: 'nose.dot', mouth: 'mouth.wide', hair: 'hair.spiky', facialHair: 'facialhair.goatee' });
  assert.deepEqual(item.accessories, ['accessory.hat']);
  assert.equal(item.palette.hair, '#a6603c');
  assert.equal(item.origin, 'custom');
  const saved = ui.commands.saveAsPreset({ name: 'My face' });
  assert.equal(saved.ok, true, saved.reason);
  assert.deepEqual([saved.preset.id, saved.preset.name, saved.preset.origin], ['my-face', 'My face', 'custom']);
  assert.equal(ui.presets.size, 7);
  assert.equal(ui.commands.presetOf()?.id, 'my-face', 'the face wears what was just saved');
  assert.match(stored.get(CUSTOM_PRESETS_KEY), /"id":"my-face"/);
  assert.equal(ui.commands.saveAsPreset({ name: 'My face' }).preset.id.startsWith('my-face-'), true, 'the same name again is another preset');
  assert.deepEqual(ui.commands.saveAsPreset({ name: '' }), { ok: false, reason: 'A preset needs an id. A preset needs a name.' });
  assert.deepEqual(ui.commands.removePreset('classic'), { ok: false, reason: 'A built-in preset stays.' });
  assert.deepEqual(ui.commands.removePreset('my-face'), { ok: true });
  assert.equal(JSON.parse(stored.get(CUSTOM_PRESETS_KEY)).length, 1);
  // Another session reads them back; one the library cannot honour is skipped.
  stored.set(CUSTOM_PRESETS_KEY, JSON.stringify([{ id: 'kept', name: 'Kept', parts: { head: 'head.oval' } }, { id: 'broken', name: 'Broken', parts: { head: 'head.nope' } }, 'rubbish']));
  const registry = createFacePresetRegistry();
  assert.deepEqual(loadCustomPresets(storage, registry).map((entry) => entry.id), ['kept']);
  assert.equal(registry.get('kept').origin, 'custom');
  assert.equal(saveCustomPresets({ setItem: () => { throw new Error('full'); } }, registry), false);
  assert.deepEqual(loadCustomPresets({ getItem: () => '{not json' }, createFacePresetRegistry()), []);
});

test('a thumbnail is the preset\'s parts in the face\'s paint order, in its colours, with every id prefixed', () => {
  const thumb = presetThumbnail(FACE_PRESET_LIBRARY.get('robot'), FACE_PART_LIBRARY, { size: 40 });
  assert.match(thumb, /^<svg class="face-preset-thumb" viewBox="-10 -30 260 260" width="40" height="40"/);
  const order = ['pv-robot-ears-small-earLeft', 'pv-robot-head-square-soft-skull', 'pv-robot-mouth-small-mouth', 'pv-robot-eyes-round-small-eyeLeft', 'pv-robot-accessory-bow-tie-accessory'].map((id) => thumb.indexOf(`id="${id}"`));
  assert.ok(order.every((index, position) => index > 0 && (position === 0 || index > order[position - 1])), `ears, skull, mouth, eyes, accessory, in that order: ${order}`);
  assert.match(thumb, /id="pv-robot-head-square-soft-skull"[^>]*fill="#c9d1d9" stroke="#3a4652"/, 'painted in the robot palette');
  assert.equal(thumb.includes(' id="skull"'), false);
  // A long-haired preset paints the back of the hair first of all.
  const registry = createFacePresetRegistry();
  const item = registry.register({ id: 'longhair', name: 'Long', parts: { head: 'head.round', hair: 'hair.long' }, palette: 'cool' });
  const long = presetThumbnail(item, FACE_PART_LIBRARY);
  assert.ok(long.indexOf('pv-longhair-hair-long-hairBack') < long.indexOf('pv-longhair-head-round-skull'), 'the back behind the skull');
  assert.ok(long.indexOf('pv-longhair-hair-long-hair"') > long.indexOf('pv-longhair-head-round-skull'), 'the fringe over it');
  assert.match(long, /id="pv-longhair-hair-long-hairBack"[^>]*fill="#26263b"/, 'in the cool palette\'s hair shadow');
});

test('the preset a face wears is read from its parts, whole set of extras included', () => {
  const ui = harness();
  ui.commands.applyPreset('classic');
  assert.equal(presetOfFace(ui.store.getDocument(), ui.presets.list())?.id, 'classic');
  ui.commands.replace('accessory', 'accessory.hat');
  assert.equal(presetOfFace(ui.store.getDocument(), ui.presets.list()), null, 'a hat the classic does not name');
  ui.commands.remove(Object.values(ui.store.getDocument().semanticParts).find((part) => part.type === 'accessory').id);
  assert.equal(presetOfFace(ui.store.getDocument(), ui.presets.list())?.id, 'classic');
  ui.commands.replace('nose', 'nose.hook');
  assert.equal(presetOfFace(ui.store.getDocument(), ui.presets.list()), null, 'another nose');
  assert.equal(presetOfFace({}, ui.presets.list()), null);
});

test('a preset carries where the parts were put over their fit and what the hands rest on, saved from the face and applied with it', () => {
  // Normalised and validated: a side each, a known drawing, a real category.
  const item = normalizeFacePreset({ id: 'x', name: 'X', parts: { mouth: 'mouth.wide' }, hands: { left: ' fist ', up: 'open' }, placements: { mouth: { x: '2', rotation: 3, scale: 0 }, nose: null } });
  assert.deepEqual([item.hands, item.placements], [{ left: 'fist' }, { mouth: { x: 2, y: 0, rotation: 3, scale: 1 } }]);
  const codes = (input) => validateFacePreset(input, FACE_PART_LIBRARY).issues.map((issue) => issue.code);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { mouth: 'mouth.wide' }, hands: { left: 'nope' } }), ['hands-style-unknown']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { mouth: 'mouth.wide' }, placements: { hands: { x: 1 } } }), ['placements-category-unknown']);
  assert.deepEqual(codes({ id: 'x', name: 'x', parts: { mouth: 'mouth.wide' }, hands: { right: 'peace' }, placements: { mouth: { x: 1 } } }), []);
  assert.deepEqual(FACE_STYLE_PRESETS.find((preset) => preset.id === 'robot').hands, { left: 'fist', right: 'fist' }, 'the robot makes fists');
  // Read from a face: the wide mouth moved, turned and enlarged over its fit; the left hand on a fist.
  const ui = harness();
  ui.commands.replace('mouth', 'mouth.wide');
  const fit = ui.store.getDocument().semanticParts.mouth.assetFit;
  ui.store.execute({ type: 'test/move', domains: ['artwork', 'hands'], source: 'test', apply: (document) => { const t = document.elements['mouth-wide'].baseTransform; t.x = fit.x + 5; t.y = fit.y - 3; t.rotation = 4; t.scaleX = fit.scaleX * 1.2; t.scaleY = fit.scaleY * 1.2; document.hands.left.styles.showing = 'fist'; } });
  const saved = facePresetFromDocument(ui.store.getDocument(), ui.commands.palette(), { id: 'moved', name: 'Moved' });
  assert.deepEqual(saved.placements, { mouth: { x: 5, y: -3, rotation: 4, scale: 1.2 } }, 'the move over the fit, and nothing for the parts that sit on theirs');
  assert.deepEqual(saved.hands, { left: 'fist', right: 'relaxed' });
  assert.equal(placementOf(ui.store.getDocument(), ui.store.getDocument().semanticParts.nose), null, 'a part with no fit known has no placement');
  // Planned after the parts, before the colours; applied on a fresh face as one undo step.
  const steps = planFacePreset(createTemplateProjectState(), saved).map((step) => step.kind);
  assert.deepEqual(steps.slice(steps.indexOf('replace'), steps.indexOf('retint')), ['replace', 'place', 'handStyle', 'handStyle']);
  const fresh = harness();
  fresh.presets.register(saved);
  const result = fresh.commands.applyPreset('moved');
  assert.deepEqual([result.ok, result.refused], [true, null]);
  const root = fresh.store.getDocument().elements['mouth-wide'].baseTransform, freshFit = fresh.store.getDocument().semanticParts.mouth.assetFit;
  assert.deepEqual([root.x - freshFit.x, root.y - freshFit.y, root.rotation, Math.round((root.scaleX / freshFit.scaleX) * 1000) / 1000], [5, -3, 4, 1.2], 'placed as the preset had it, over this face\'s own fit');
  assert.equal(fresh.store.getDocument().hands.left.styles.showing, 'fist');
  assert.equal(fresh.store.getDocument().hands.right.styles.showing, 'relaxed');
  assert.deepEqual(fresh.history.getState(), { canUndo: true, canRedo: false });
  fresh.history.undo();
  assert.equal(fresh.store.getDocument().hands.left.styles.showing, 'relaxed', 'one undo, hands included');
  assert.equal('mouth-wide' in fresh.store.getDocument().elements, false);
  // A hand the face has not got, a drawing it has not got: not a refusal.
  fresh.store.execute({ type: 'test/no-hand', domains: ['hands'], source: 'test', apply: (document) => { delete document.hands.left; } });
  assert.equal(fresh.commands.applyPreset('moved').ok, true);
  assert.deepEqual(fresh.commands.restHand('left', 'fist'), { ok: false, reason: 'The left hand has no drawing called "fist".' });
  assert.deepEqual(fresh.commands.place('nose', { x: 1 }), { ok: false, reason: 'No nose from the library is on the face to place.' });
});
