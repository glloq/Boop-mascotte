import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createFaceLibraryPanel } = await import('../../rig-editor/semantic-parts/face-library-panel.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createTemplateProjectState } = await import('../sample/templates/template-export.js');

/**
 * The shelf, once the editor is about human faces (V6, §3 of the brief;
 * docs/FACE_PART_LIBRARY.md, "Active and legacy").
 *
 * The library holds a hundred and thirty-two drawings and offers forty-two. A
 * shelf that is simply shorter with nothing said about it reads as a library
 * that has lost something, so what is checked here is the sentence as much as
 * the filter: how many are held back, and that there is a press that shows them.
 */
function harness() {
  const store = createEditorStore(createTemplateProjectState());
  const host = document.createElementNS('', 'div');
  const panel = createFaceLibraryPanel(host, store, { commands: { replace: () => ({ ok: true }) } });
  panel.render();
  return { host, panel, store };
}

/** One press on a button the panel drew, routed the way the panel routes it. */
const press = (host, attribute, value) => host.dispatch('click', { target: clickTarget({ dataset: { [attribute]: value } }) });

test('the shelf is the human library, and says how many drawings it is holding back', () => {
  const { host, panel } = harness();
  press(host, 'faceLibraryCategory', 'mouth');
  assert.equal(host.dataset.faceLibraryCategory, 'mouth');
  assert.equal(host.dataset.faceLibraryCards, '1', 'one mouth, where the library holds sixteen');
  assert.equal(host.dataset.faceLibraryLegacy, '15');
  assert.equal(host.dataset.faceLibraryTotal, '132', 'and nothing has been taken out of it');
  // The header counts what is offered rather than what is held: a panel that
  // said "132 drawings" over a shelf of one would be describing a different
  // library from the one on screen.
  assert.match(host.innerHTML, /42 drawings for a human face/);
  // The sentence is the morphology table's own words, not a string somebody has
  // to keep in step with it (§3.2 of the brief; `face-catalogue.js`).
  assert.match(host.innerHTML, /Show the older packs too \(15 animal, bird and robot drawings\)/);
  assert.deepEqual([...panel.snapshot().legacyKinds], ['Animal', 'Bird', 'Robot']);
  assert.equal(panel.snapshot().cards.length, 1);
});

test('and there is a press that shows them, and one that puts them away again', () => {
  const { host } = harness();
  press(host, 'faceLibraryCategory', 'mouth');
  press(host, 'faceLibraryShowLegacy', 'on');
  assert.equal(host.dataset.faceLibraryCards, '16');
  assert.equal(host.dataset.faceLibraryLegacy, '0');
  // Every one of them says what it is, so a drawing that will not be maintained
  // is not silently the same as one that will.
  // And each card says which kind it is *for*, where it used to shrug.
  assert.match(host.innerHTML, /A Bird drawing: kept for the faces that wear it, and no longer offered/);
  assert.match(host.innerHTML, /An? Animal drawing: kept for the faces that wear it/);
  assert.match(host.innerHTML, /Hide the older packs/);
  press(host, 'faceLibraryShowLegacy', 'off');
  assert.equal(host.dataset.faceLibraryCards, '1');
});

test('the two filters are two questions, and each has its own way back', () => {
  // `Show all` is the compatibility filter's and always was; the packs have one
  // of their own. An author looking for a beak is not asking to be shown every
  // drawing that does not fit their face.
  const { host } = harness();
  press(host, 'faceLibraryCategory', 'eyes');
  assert.equal(host.dataset.faceLibraryCards, '3', 'the three builds');
  assert.equal(host.dataset.faceLibraryLegacy, '4', 'and the pack’s four, held back');
  assert.equal(host.dataset.faceLibraryFiltered, '0', 'with nothing held back for not fitting this face');
  press(host, 'faceLibraryShowAll', 'on');
  assert.equal(host.dataset.faceLibraryCards, '3', 'so Show all changes nothing here');
  assert.equal(host.dataset.faceLibraryLegacy, '4', 'and does not reach the packs');
});
