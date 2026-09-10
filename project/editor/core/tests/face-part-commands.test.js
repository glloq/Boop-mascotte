import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox } from './helpers/fake-face-canvas.js';
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
  const boxes = { head: { x: 20, y: 30, width: 200, height: 180 } };
  for (const asset of library.list()) Object.assign(boxes, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  Object.assign(boxes, { 'eyeLeft-2': { ...MOUTH_SIMPLE.referenceBox }, 'nose-2': { ...MOUTH_SIMPLE.referenceBox } });
  const canvas = createFakeFaceCanvas(store, { boxes, fail });
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
  assert.deepEqual([result.partId, result.rootId, result.ids, result.enabled, result.disabled], ['mouth', 'mouth-wide', ['mouth-wide', 'mouth', 'teeth'], ['mouthOpen', 'smile', 'mouthWidth', 'teeth'], ['tongue']]);
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
