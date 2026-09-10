import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { fitFacePart, layoutFromBoxes } from '../face-library/face-layout.js';
import { createCleanProjectState } from '../state/store.js';
import { assignSemanticRole, createSemanticPart } from '../../rig-editor/semantic-parts/part-model.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds } from '../face-library/face-part-model.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';

/**
 * Replacing a part as one command (docs/FACE_PART_LIBRARY.md, "Installing"):
 * the canvas swaps the drawing, the store takes the rig in one write, and
 * one undo takes both back. When anything refuses, the canvas is put back
 * and the history never hears of it.
 */
function harness({ fail } = {}) {
  const state = createTemplateProjectState();
  const store = createEditorStore(state);
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  // A mouth whose ids collide with the mascot's own: its root is called what the left eye is called.
  library.register({ ...MOUTH_SIMPLE, id: 'mouth.clash', name: 'Clash', artwork: '<g id="eyeLeft" data-name="Mouth"><path id="nose" data-name="Mouth" d="M87 172 Q120 190 153 172" fill="none" stroke="#b4525c" stroke-width="3.5"/></g>', roles: { mouth: 'nose' } });
  const assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  Object.assign(assets, { 'eyeLeft-2': { ...MOUTH_SIMPLE.referenceBox }, 'nose-2': { ...MOUTH_SIMPLE.referenceBox } });
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || null, fail });
  const installed = [];
  const commands = createFacePartCommands(store, history, canvas, { library, onInstalled: (summary) => installed.push(summary) });
  return { store, history, canvas, commands, installed, library };
}

test('replacing a mouth is one write and one undo step, and the canvas is asked once', () => {
  const ui = harness();
  const before = structuredClone(ui.store.getDocument());
  const revision = ui.store.getPersistentRevision();
  const result = ui.commands.replace('mouth', 'mouth.wide');
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual([result.partId, result.rootId, result.ids, result.enabled, result.disabled, result.fitted], ['mouth', 'mouth-wide', ['mouth-wide', 'mouth', 'teeth'], ['mouthOpen', 'smile', 'mouthWidth', 'teeth'], ['tongue'], true]);
  assert.deepEqual(ui.store.getDocument().elements['mouth-wide'].baseTransform, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 179 }, 'on the template, fitting an asset drawn for the template moves nothing');
  assert.equal(ui.store.getPersistentRevision(), revision + 1, 'one write');
  assert.deepEqual(ui.installed.map((item) => item.rootId), ['mouth-wide'], 'the preview is told once, after the write');
  assert.equal(ui.canvas.calls.replace.length, 1);
  assert.deepEqual(ui.canvas.calls.replace[0].removeIds, ['mouth', 'teeth', 'tongue']);
  assert.equal(ui.canvas.calls.load.length, 0, 'nothing to put back');
  const after = ui.store.getDocument();
  assert.equal(after.svgMarkup, ui.canvas.markup(), 'the store holds the markup the canvas shows');
  assert.deepEqual(Object.values(after.semanticParts).find((part) => part.type === 'mouth').roles, { mouth: 'mouth', teeth: 'teeth' });
  assert.deepEqual(ui.history.getState(), { canUndo: true, canRedo: false });
  ui.history.undo();
  assert.deepEqual(ui.store.getDocument(), before, 'one undo, and everything is as it was');
  assert.deepEqual(ui.history.getState(), { canUndo: false, canRedo: true });
  ui.history.redo();
  assert.deepEqual(ui.store.getDocument(), after);
});

test('ids the mascot already draws are renamed on the way in, and the part follows the new names', () => {
  const ui = harness();
  const result = ui.commands.replace('mouth', 'mouth.clash');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.rootId, 'eyeLeft-2', 'the left eye keeps its name');
  assert.deepEqual(result.roles, { mouth: 'nose-2' }, 'and so does the nose');
  const document = ui.store.getDocument();
  assert.ok(document.elements.eyeLeft && document.elements.nose && document.elements['eyeLeft-2'] && document.elements['nose-2']);
  const mouth = Object.values(document.semanticParts).find((part) => part.type === 'mouth');
  assert.deepEqual([mouth.roles, mouth.assetId, mouth.assetRoot], [{ mouth: 'nose-2' }, 'mouth.clash', 'eyeLeft-2']);
  assert.deepEqual(Object.values(document.semanticParts).find((part) => part.type === 'nose').roles, { nose: 'nose' }, 'the nose part still has the nose');
  assert.match(ui.canvas.calls.replace[0].fragment, /<g id="eyeLeft-2" data-name="Mouth"><path id="nose-2"/);
  // A second install of the same asset frees its own ids first: no `-3`.
  assert.equal(ui.commands.replace('mouth', 'mouth.clash').rootId, 'eyeLeft-2');
});

test('a refusal leaves the canvas as it was, the store untouched and the history empty', () => {
  const ui = harness({ fail: (removeIds) => removeIds.includes('mouth') });
  const before = structuredClone(ui.store.getDocument());
  const revision = ui.store.getPersistentRevision();
  const result = ui.commands.replace('mouth', 'mouth.wide');
  assert.deepEqual(result, { ok: false, reason: 'The canvas refused the swap.' });
  assert.deepEqual(ui.canvas.calls.load, [before.svgMarkup], 'the markup the document still holds is put back');
  assert.equal(ui.store.getPersistentRevision(), revision);
  assert.deepEqual(ui.store.getDocument(), before);
  assert.deepEqual(ui.history.getState(), { canUndo: false, canRedo: false });
  assert.deepEqual(ui.installed, []);
});

test('what cannot be planned is refused before the canvas is touched', () => {
  const ui = harness();
  assert.deepEqual(ui.commands.replace('mouth', 'mouth.nope'), { ok: false, reason: 'There is no asset called "mouth.nope".' });
  assert.match(ui.commands.replace('nose', 'mouth.simple').reason, /is not a nose asset/);
  assert.match(ui.commands.replace('facialHair', 'mouth.simple').reason, /no semantic part yet/);
  assert.equal(ui.canvas.calls.replace.length, 0);
  assert.equal(ui.canvas.calls.load.length, 0);
  assert.deepEqual(ui.history.getState(), { canUndo: false, canRedo: false });
  assert.equal(ui.commands.plan('mouth', 'mouth.simple').ok, true, 'a plan is a question, not a write');
  assert.equal(ui.commands.plan('mouth', 'mouth.nope').ok, false);
  assert.equal(ui.commands.library, ui.library);
});

test('on a face somebody drew, the part is fitted to its head before the author\'s adjustments', () => {
  // One ellipse, assigned as the head, in a group; nothing else the layout can measure.
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="face" data-name="Face"><ellipse id="blob" data-name="Blob" cx="90" cy="90" rx="50" ry="60" fill="#fc9"/></g></svg>';
  const record = (nodeType) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, symmetryPeer: null, meta: { nodeType } });
  state.elements = { face: record('g'), blob: record('ellipse') };
  state.layers = [{ id: 'face', type: 'g', name: 'Face', visible: true, locked: false, expanded: true, children: [{ id: 'blob', type: 'ellipse', name: 'Blob', visible: true, locked: false, expanded: false, children: [] }] }];
  const head = createSemanticPart(state, 'head');
  assignSemanticRole(state, head.id, 'head', 'blob');
  const store = createEditorStore(state);
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const boxes = { blob: { x: 40, y: 30, width: 100, height: 120 } }, assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = createFakeFaceCanvas(store, { boxes, installed: (id) => assets[id] || null });
  const commands = createFacePartCommands(store, history, canvas, { library });
  const layout = commands.layout();
  assert.deepEqual(layout.headBox, boxes.blob);
  assert.equal(layout.anchors['nose.center'].measured, false, 'placed by the template\'s proportions in this head');
  const result = commands.replace('nose', 'nose.dot');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fitted, true);
  const expected = fitFacePart(library.get('nose.dot'), layoutFromBoxes({ head: boxes.blob }));
  const root = store.getDocument().elements['nose-dot'].baseTransform;
  assert.deepEqual(root, { x: expected.x, y: expected.y, rotation: 0, scaleX: expected.scaleX, scaleY: expected.scaleY, pivotX: 120, pivotY: 148 });
  // Where it ends up: the nose's centre on the head's nose anchor, half the template's size for a head half as wide.
  assert.ok(Math.abs((120 + root.x) - layout.anchors['nose.center'].x) < 0.5, 'centred on the anchor');
  assert.ok(Math.abs((148 + root.y) - layout.anchors['nose.center'].y) < 0.01);
  assert.ok(Math.abs(root.scaleX - 100 / 188.21) < 0.001);
  assert.equal(canvas.calls.replace[0].mountPoint, 'face', 'inside the group the head sits in');
  // A second style for the same part lands in the same place, at the same
  // size: the anchor is carried through the root the first one left, and the
  // first fit's size is not counted twice.
  const again = commands.replace('nose', 'nose.dot');
  assert.equal(again.ok, true, again.reason);
  const rootAgain = store.getDocument().elements['nose-dot'].baseTransform;
  assert.deepEqual(rootAgain, root, 'the same place, the same size');
  // And what the author does to it in between rides along: moved and enlarged, the next nose is moved and enlarged.
  store.execute({ type: 'test/move', domains: ['artwork'], source: 'test', apply: (document) => { const t = document.elements['nose-dot'].baseTransform; t.x += 6; t.scaleX *= 2; t.scaleY *= 2; t.rotation = 10; } });
  const third = commands.replace('nose', 'nose.dot');
  assert.equal(third.ok, true, third.reason);
  const rootThird = store.getDocument().elements['nose-dot'].baseTransform;
  assert.ok(Math.abs(rootThird.x - (root.x + 6)) < 0.001, `moved by six: ${rootThird.x} vs ${root.x + 6}`);
  assert.ok(Math.abs(rootThird.y - root.y) < 0.001);
  assert.ok(Math.abs(rootThird.scaleX - root.scaleX * 2) < 0.001, 'twice the size');
  assert.equal(rootThird.rotation, 10);
});
