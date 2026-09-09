import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createCleanProjectState } from '../state/store.js';
import {
  CHARACTER_CATEGORIES, CHARACTER_CATEGORY_IDS, activePiece, categoryForElement, characterCategory, characterSnapshot,
  deriveCharacterParts, layerParents, paletteOfPaints, pieceTransform, resolveActiveCategory, roleLabel, scalePatch
} from '../../ui/character-builder/character-model.js';
import { FACE_PART_CATEGORY_IDS } from '../face-library/face-part-model.js';

/**
 * The Character Builder's reading of a mascot (docs/CHARACTER_BUILDER.md).
 *
 * A category is a reading of the semantic parts and never a second record of
 * them, so the whole model is pure over a ProjectDocument. The template face
 * is the fixture: it carries every part the categories name, in the tree the
 * artwork draws them in, and a project rigged by hand carries fewer.
 */
const template = () => createTemplateProjectState();
const pieces = (model, id) => model.categories.find((category) => category.id === id).pieces.map((piece) => piece.id);
const status = (model, id) => model.categories.find((category) => category.id === id).status;

test('the categories are the parts a person names, presets first and hands last', () => {
  assert.deepEqual([...CHARACTER_CATEGORY_IDS], ['presets', 'head', 'eyes', 'pupils', 'eyelids', 'eyebrows', 'nose', 'mouth', 'ears', 'hair', 'facialHair', 'accessory', 'hands']);
  for (const category of CHARACTER_CATEGORIES) {
    assert.ok(category.label && category.glyph && category.hint, `${category.id} says what it is`);
    if (!category.kind) assert.ok(Array.isArray(category.roles), `${category.id} names the roles it reads`);
  }
  assert.equal(characterCategory('eyes').part, 'eyes');
  // The face rows are the library's categories, in its order, with their roles.
  assert.deepEqual(CHARACTER_CATEGORIES.filter((category) => !category.kind).map((category) => category.id), [...FACE_PART_CATEGORY_IDS]);
  assert.deepEqual([...characterCategory('mouth').roles], ['mouth', 'cavity', 'teeth', 'tongue']);
  assert.equal(characterCategory('nope'), null);
  assert.equal(roleLabel('leftUpper'), 'Left upper');
  assert.equal(roleLabel('hairTop'), 'Hair top');
});

test('the template face fills every category the rig has a part for', () => {
  const model = deriveCharacterParts(template());
  assert.deepEqual(pieces(model, 'head'), ['faceRoot'], 'the head is the face that turns');
  assert.deepEqual(pieces(model, 'eyes'), ['eyeLeft', 'eyeRight']);
  assert.deepEqual(pieces(model, 'pupils'), ['pupilLeft', 'pupilRight']);
  assert.deepEqual(pieces(model, 'eyelids'), ['lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight'], 'in the order the semantic part names its roles');
  assert.deepEqual(pieces(model, 'eyebrows'), ['browLeft', 'browRight']);
  assert.deepEqual(pieces(model, 'nose'), ['nose']);
  assert.deepEqual(pieces(model, 'mouth'), ['mouth', 'teeth', 'tongue'], 'the cavity is optional and the template draws none');
  assert.deepEqual(pieces(model, 'ears'), ['earLeft', 'earRight']);
  assert.deepEqual(pieces(model, 'hair'), ['hair', 'hairTop', 'hairBack']);
  assert.deepEqual(pieces(model, 'hands'), ['handLeft', 'handRight'], 'the hands come from the hands block');
  assert.deepEqual(pieces(model, 'presets'), []);
  assert.equal(status(model, 'presets'), 'presets');
  assert.equal(status(model, 'facialHair'), 'unavailable', 'no part exists for it yet, and the category says so');
  assert.equal(status(model, 'accessory'), 'missing');
  assert.equal(model.categories.find((category) => category.id === 'accessory').summary, 'No accessories on this mascot yet');
  for (const id of ['head', 'eyes', 'mouth', 'hair', 'hands']) assert.equal(status(model, id), 'ready');
  // A piece is named the way the layer tree names it, with its role beside it.
  const eyes = model.categories.find((category) => category.id === 'eyes');
  assert.deepEqual(eyes.pieces.map((piece) => [piece.label, piece.roleLabel, piece.partId]), [['Left eye', 'Left eye', 'eyes'], ['Right eye', 'Right eye', 'eyes']]);
  assert.equal(eyes.partId, 'eyes');
  assert.equal(eyes.summary, 'Left eye · Right eye');
  assert.match(model.categories.find((category) => category.id === 'eyelids').summary, /\+1$/, 'a long list is cut with a count');
});

test('a piece belongs to the nearest part that draws it, and to none when nothing does', () => {
  const model = deriveCharacterParts(template());
  assert.equal(categoryForElement(model, 'pupilLeft'), 'pupils', 'exact wins over the eye around it');
  assert.equal(categoryForElement(model, 'eyeWhiteLeft'), 'eyes', 'the white of an eye is the eye');
  assert.equal(categoryForElement(model, 'faceShading'), 'head', 'the shading of the face is the head');
  assert.equal(categoryForElement(model, 'handLeftStyle-fist'), 'hands', 'a drawing inside a hand is the hand');
  assert.equal(categoryForElement(model, 'nope'), null);
  assert.equal(categoryForElement(model, null), null);
  assert.equal(categoryForElement(null, 'mouth'), null);
  // A tree that loops must not hang the walk.
  assert.equal(categoryForElement({ owners: {}, parents: { a: 'b', b: 'a' } }, 'a'), null);
  assert.deepEqual(layerParents([{ id: 'root', children: [{ id: 'leaf', children: [] }] }]), { root: null, leaf: 'root' });
});

test('the browser keeps the category the author pressed until the canvas picks another part', () => {
  const model = deriveCharacterParts(template());
  assert.equal(resolveActiveCategory(model, { chosen: 'eyes', selectedId: 'eyeRight' }), 'eyes');
  assert.equal(resolveActiveCategory(model, { chosen: 'eyes', selectedId: 'eyeLeft' }), 'eyes');
  assert.equal(resolveActiveCategory(model, { chosen: 'presets', selectedId: null }), 'presets', 'a category with no pieces holds while nothing is selected');
  assert.equal(resolveActiveCategory(model, { chosen: 'presets', selectedId: 'mouth' }), 'mouth', 'and gives way to a selection');
  assert.equal(resolveActiveCategory(model, { chosen: 'eyes', selectedId: 'nose' }), 'nose', 'the canvas picked another part');
  assert.equal(resolveActiveCategory(model, { chosen: 'eyes', selectedId: 'eyeWhiteLeft' }), 'eyes', 'a piece inside one of its own pieces is still it');
  assert.equal(resolveActiveCategory(model, { chosen: null, selectedId: null }), null);
  assert.equal(resolveActiveCategory(model, { chosen: 'nope', selectedId: null }), null);
  assert.equal(resolveActiveCategory(model, { chosen: null, selectedId: 'handRight' }), 'hands');
  const eyes = model.categories.find((category) => category.id === 'eyes');
  assert.equal(activePiece(eyes, 'eyeLeft').id, 'eyeLeft');
  assert.equal(activePiece(eyes, 'eyeWhiteLeft'), null, 'a piece inside a piece is not the piece');
  assert.equal(activePiece(eyes, null), null);
  assert.equal(activePiece(null, 'eyeLeft'), null);
});

test('a mascot rigged by hand reads through the same categories, hands included', () => {
  const state = createCleanProjectState();
  const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, bindings: {}, meta: { nodeType: 'path' } });
  state.svgMarkup = '<svg/>';
  state.elements = { skull: element(), lips: element(), paw: element(), gone: element() };
  state.layers = [{ id: 'skull', name: 'Skull', children: [{ id: 'lips', name: 'Lips', children: [] }] }, { id: 'paw', name: 'Paw', children: [] }];
  state.layerMetadata = { lips: { name: 'The lips' } };
  state.semanticParts = {
    head: { id: 'head', type: 'head', name: 'Head', roles: { head: 'skull' }, controls: [] },
    mouth: { id: 'mouth', type: 'mouth', name: 'Mouth', roles: { mouth: 'lips', teeth: 'missing-artwork' }, controls: [] },
    leftHand: { id: 'leftHand', type: 'leftHand', name: 'Left Hand', roles: { hand: 'paw' }, controls: [] }
  };
  const model = deriveCharacterParts(state);
  assert.deepEqual(pieces(model, 'head'), ['skull']);
  assert.deepEqual(pieces(model, 'mouth'), ['lips'], 'a role whose artwork is gone is not a piece');
  assert.equal(model.categories.find((category) => category.id === 'mouth').pieces[0].label, 'The lips', 'the display name the author gave wins');
  assert.deepEqual(pieces(model, 'hands'), ['paw'], 'a hand named as a part, before the hands block existed');
  assert.equal(model.categories.find((category) => category.id === 'hands').pieces[0].partId, 'leftHand');
  assert.equal(status(model, 'eyes'), 'missing');
  assert.equal(model.categories.find((category) => category.id === 'eyes').summary, 'No eyes on this mascot yet');
  const bare = deriveCharacterParts({});
  assert.ok(bare.categories.every((category) => category.pieces.length === 0));
  assert.equal(status(bare, 'hands'), 'missing');
});

test('a piece has one size, and a new size keeps a flip', () => {
  const document = { elements: {
    plain: { baseTransform: { x: 3, y: -4.5, rotation: 12, scaleX: 1.5, scaleY: 1.5 } },
    flipped: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: -2, scaleY: 2 } },
    wide: { baseTransform: { scaleX: 2, scaleY: 1 } },
    broken: { baseTransform: { x: 'nope', scaleX: 0 } }
  } };
  assert.deepEqual(pieceTransform(document, 'plain'), { x: 3, y: -4.5, rotation: 12, scaleX: 1.5, scaleY: 1.5, scale: 1.5, uniform: true });
  assert.equal(pieceTransform(document, 'flipped').scale, 2, 'a mirrored piece is still its size');
  assert.equal(pieceTransform(document, 'wide').uniform, false);
  assert.deepEqual(pieceTransform(document, 'broken'), { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 1, scale: 1, uniform: false });
  assert.deepEqual(pieceTransform(document, 'missing'), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, scale: 1, uniform: true });
  assert.deepEqual(scalePatch(document, 'plain', 0.5), { scaleX: 0.5, scaleY: 0.5 });
  assert.deepEqual(scalePatch(document, 'flipped', 3), { scaleX: -3, scaleY: 3 }, 'the mirror stays');
  assert.deepEqual(scalePatch(document, 'plain', 0), { scaleX: 1, scaleY: 1 }, 'a size of nothing is not a size');
  assert.deepEqual(scalePatch(document, 'plain', -2), { scaleX: 2, scaleY: 2 }, 'the field does not flip');
  assert.deepEqual(scalePatch(document, 'plain', 'nope'), { scaleX: 1, scaleY: 1 });
});

test('the palette is one swatch per colour, in first use, with every place it is used', () => {
  const palette = paletteOfPaints([
    { id: 'hair', fill: '#5B3A1E', stroke: 'none' },
    { id: 'hairTop', fill: '#5b3a1e', stroke: '#111111' },
    { id: 'hairBack', fill: 'url(#shine)', stroke: '#111111' },
    { id: 'clip', fill: '', stroke: undefined },
    { id: 'name', fill: 'tomato' }
  ]);
  assert.deepEqual(palette, [
    { colour: '#5b3a1e', uses: [{ id: 'hair', property: 'fill' }, { id: 'hairTop', property: 'fill' }] },
    { colour: '#111111', uses: [{ id: 'hairTop', property: 'stroke' }, { id: 'hairBack', property: 'stroke' }] },
    { colour: 'tomato', uses: [{ id: 'name', property: 'fill' }] }
  ]);
  assert.deepEqual(paletteOfPaints([]), []);
  assert.deepEqual(paletteOfPaints([null, { id: 'x', fill: 'transparent', stroke: 'inherit' }]), []);
});

test('the snapshot is plain data the browser-test seam can hand out', () => {
  const model = deriveCharacterParts(template());
  const snapshot = characterSnapshot(model, { active: 'eyes', selectedId: 'eyeRight' });
  assert.equal(snapshot.active, 'eyes');
  assert.equal(snapshot.selectedId, 'eyeRight');
  assert.deepEqual(snapshot.categories.find((category) => category.id === 'eyes'), { id: 'eyes', status: 'ready', partId: 'eyes', pieces: ['eyeLeft', 'eyeRight'] });
  assert.deepEqual(structuredClone(snapshot), snapshot);
});
