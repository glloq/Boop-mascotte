import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds } from '../face-library/face-part-model.js';
import { identifyFaceParts } from '../face-library/face-part-migration.js';
import { instanceIsCustom } from '../../ui/character-builder/character-model.js';

/**
 * An old project through the library (docs/FACE_PART_LIBRARY.md, "Migration").
 *
 * The fixture is a face the library dressed, with every word about it taken
 * off the parts -- what a project saved before the library carries.
 */
function dressed(...installs) {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || assets[id.replace(/-\d+$/, '')] || null });
  const commands = createFacePartCommands(store, history, canvas, { library });
  for (const [category, assetId] of installs) { const result = commands.replace(category, assetId); assert.equal(result.ok, true, result.reason); }
  const state = structuredClone(store.getDocument());
  const before = structuredClone(state.semanticParts);
  for (const part of Object.values(state.semanticParts)) for (const key of ['assetId', 'assetRoot', 'assetMount', 'assetShape', 'assetFit', 'assetDetached']) delete part[key];
  return { state, before, library, commands, store };
}

test('a part that is a library asset drawn exactly is identified, with its root, its mount and the word its shapes sign as', () => {
  const { state, before, library } = dressed(['mouth', 'mouth.wide'], ['eyes', 'eyes.round-large'], ['head', 'head.round']);
  const report = identifyFaceParts(state, library);
  assert.deepEqual(report.identified, [
    { partId: 'head', assetId: 'head.round', rootId: 'head-round' },
    { partId: 'eyes', assetId: 'eyes.round-large', rootId: 'eyes-round-large' },
    { partId: 'mouth', assetId: 'mouth.wide', rootId: 'mouth-wide' }
  ]);
  for (const id of ['head', 'eyes', 'mouth']) {
    const part = state.semanticParts[id];
    assert.deepEqual([part.assetId, part.assetRoot, part.assetMount, part.assetShape], [before[id].assetId, before[id].assetRoot, before[id].assetMount, before[id].assetShape], `${id} as the install left it`);
    assert.equal('assetFit' in part, false, 'the fit is not known again');
    assert.equal(instanceIsCustom(state, part), false, 'and reads as the library\'s');
  }
  assert.equal(state.semanticParts.nose.assetId, undefined, 'the template\'s nose is nobody\'s asset');
  assert.deepEqual(identifyFaceParts(state, library).identified, [], 'a second look changes nothing');
});

test('moved as a whole, still identified; a point dragged, the author\'s own; a back piece painted behind the face is found again', () => {
  const moved = dressed(['mouth', 'mouth.wide']);
  moved.state.svgMarkup = moved.state.svgMarkup.replace(/<g id="mouth-wide"/, '<g id="mouth-wide" transform="translate(9 -3) rotate(5)"');
  assert.deepEqual(identifyFaceParts(moved.state, moved.library).identified.map((item) => item.assetId), ['mouth.wide']);
  const reshaped = dressed(['mouth', 'mouth.wide']);
  reshaped.state.svgMarkup = reshaped.state.svgMarkup.replace(/(<path id="mouth"[^>]*\sd=")([^"]*)"/, (_, head, d) => `${head}${d.replace(/\d/, (digit) => String((Number(digit) + 1) % 10))}"`);
  assert.deepEqual(identifyFaceParts(reshaped.state, reshaped.library).identified, [], 'the author\'s mouth now');
  assert.equal(reshaped.state.semanticParts.mouth.assetId, undefined);
  const hair = dressed(['hair', 'hair.long']);
  assert.ok(hair.before.hair.assetDetached?.length, 'the long hair paints a back behind the face');
  const report = identifyFaceParts(hair.state, hair.library);
  assert.deepEqual(report.identified, [{ partId: 'hair', assetId: 'hair.long', rootId: hair.before.hair.assetRoot }]);
  assert.deepEqual(hair.state.semanticParts.hair.assetDetached, hair.before.hair.assetDetached);
  assert.equal(hair.state.semanticParts.hair.assetShape, hair.before.hair.assetShape);
});

test('a project drawn before V3-02 gets back how its glasses turn, without its captured cells being rebuilt behind it', () => {
  const { state, before, library } = dressed(['accessory', 'accessory.glasses'], ['facialHair', 'facialhair.beard']);
  // The document is stripped back to what a project saved before V3-02 holds:
  // the parts are there and the drawings are exact, but nothing says how they
  // turn, because nothing could.
  for (const part of Object.values(state.semanticParts)) delete part.assetTurn;
  const keyforms = JSON.stringify(state.keyforms);

  identifyFaceParts(state, library);

  const glasses = Object.values(state.semanticParts).find((part) => part.assetId === 'accessory.glasses');
  const beard = Object.values(state.semanticParts).find((part) => part.assetId === 'facialhair.beard');
  assert.deepEqual(glasses.assetTurn, { element: { depth: 0.7, side: null, narrow: true } }, 'the glasses turn as the library says they do');
  assert.deepEqual(beard.assetTurn, { facialHair: { depth: 0.5, side: null, narrow: true } });
  assert.deepEqual([glasses.assetTurn, beard.assetTurn], [before.accessory?.assetTurn ?? glasses.assetTurn, before.facialHair?.assetTurn ?? beard.assetTurn], 'the same answer the install writes');

  // And the grid is untouched: the cells an author captured are theirs, and
  // rebuilding the turn to pick this up is a press they make, not one made
  // behind them.
  assert.equal(JSON.stringify(state.keyforms), keyforms, 'not one keyform was rewritten on open');
});

test('a fresh template, a part the library already knows, and a document with nothing to read are all left alone', () => {
  const template = createTemplateProjectState();
  assert.deepEqual(identifyFaceParts(template).identified, [], 'the template\'s own drawings are nobody\'s asset');
  const known = dressed(['mouth', 'mouth.wide']);
  known.state.semanticParts.mouth.assetId = 'mouth.cartoon';
  assert.deepEqual(identifyFaceParts(known.state, known.library).identified, [], 'a part with a word on it keeps it');
  assert.equal(known.state.semanticParts.mouth.assetId, 'mouth.cartoon');
  for (const input of [null, undefined, {}, { svgMarkup: '<svg/>' }, { svgMarkup: '<svg/>', semanticParts: null }, { svgMarkup: '<svg/>', semanticParts: { x: null }, layers: 'nope' }]) assert.deepEqual(identifyFaceParts(input), { identified: [] });
});
