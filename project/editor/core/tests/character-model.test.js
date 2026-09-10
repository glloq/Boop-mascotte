import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createCleanProjectState } from '../state/store.js';
import {
  CHARACTER_CATEGORIES, CHARACTER_CATEGORY_IDS, activePiece, assetLabel, categoryForElement, characterCategory, characterSnapshot,
  deriveCharacterParts, instanceRootOf, layerParents, mirrorTransformPatch, pairLabel, pairOf, pairSpacing, paletteOfPaints, peerRole, pieceTransform, resolveActiveCategory, roleLabel, scalePatch, spacingPatch
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

test('a part that came from the library is one piece, its root, and every shape inside it moves as that root', () => {
  const state = template();
  // The template's mouth, as if the library had installed it: the mouth path is the root, teeth and tongue sit "inside" it.
  state.semanticParts.mouth.assetId = 'mouth.wide';
  state.semanticParts.mouth.assetRoot = 'mouth';
  const model = deriveCharacterParts(state);
  const mouth = model.categories.find((category) => category.id === 'mouth');
  assert.deepEqual(mouth.pieces.map((piece) => [piece.id, piece.role, piece.roleLabel]), [['mouth', 'instance', 'Library part · Wide']]);
  assert.equal(mouth.assetId, 'mouth.wide');
  assert.equal(mouth.summary, 'Mouth');
  assert.deepEqual(model.instances, { mouth: 'mouth' });
  assert.equal(instanceRootOf(model, 'mouth'), 'mouth');
  assert.equal(instanceRootOf(model, 'nose'), 'nose', 'a shape in no instance is its own');
  assert.equal(instanceRootOf(model, 'nope'), 'nope');
  assert.equal(instanceRootOf(null, 'x'), 'x');
  // A real root: a group with the shapes inside it.
  const nested = template();
  nested.elements['mouth-wide'] = { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, bindings: {}, meta: { nodeType: 'g' } };
  const face = nested.layers.find((layer) => layer.id === 'faceRoot');
  face.children = face.children.filter((child) => !['mouth', 'teeth', 'tongue'].includes(child.id));
  face.children.push({ id: 'mouth-wide', type: 'g', name: 'Mouth', visible: true, children: [{ id: 'mouth', type: 'path', name: 'Mouth', visible: true, children: [] }, { id: 'teeth', type: 'path', name: 'Teeth', visible: true, children: [] }] });
  nested.semanticParts.mouth.assetId = 'mouth.wide';
  nested.semanticParts.mouth.assetRoot = 'mouth-wide';
  const grouped = deriveCharacterParts(nested);
  assert.deepEqual(pieces(grouped, 'mouth'), ['mouth-wide']);
  assert.equal(instanceRootOf(grouped, 'teeth'), 'mouth-wide', 'the teeth move as the mouth');
  assert.equal(categoryForElement(grouped, 'teeth'), 'mouth', 'and are the mouth when clicked');
  assert.equal(assetLabel('accessory.round-glasses'), 'Round glasses');
  assert.equal(assetLabel(null), '');
  // A root that is gone (deleted in Artwork) is no instance: the roles are the pieces again.
  const orphan = template();
  orphan.semanticParts.mouth.assetId = 'mouth.wide';
  orphan.semanticParts.mouth.assetRoot = 'gone';
  assert.deepEqual(pieces(deriveCharacterParts(orphan), 'mouth'), ['mouth', 'teeth', 'tongue']);
  assert.equal(deriveCharacterParts(orphan).categories.find((category) => category.id === 'mouth').assetId, null);
});

test('a pair is two roles, one side each, or the peer the author named', () => {
  assert.equal(peerRole('leftEye'), 'rightEye');
  assert.equal(peerRole('rightUpper'), 'leftUpper');
  assert.equal(peerRole('mouth'), null);
  assert.equal(peerRole('leftover'), null, 'a word that starts with left is not a side');
  const state = template();
  const model = deriveCharacterParts(state);
  const eyes = model.categories.find((category) => category.id === 'eyes');
  const pair = pairOf(state, eyes, 'eyeRight');
  assert.deepEqual([pair.piece.id, pair.peer.id, pair.side], ['eyeRight', 'eyeLeft', 'right']);
  assert.deepEqual([pairOf(state, eyes, 'eyeLeft').peer.id, pairOf(state, eyes, 'eyeLeft').side], ['eyeRight', 'left']);
  const lids = model.categories.find((category) => category.id === 'eyelids');
  assert.equal(pairOf(state, lids, 'lidLowerLeft').peer.id, 'lidLowerRight');
  assert.equal(pairOf(state, model.categories.find((category) => category.id === 'nose'), 'nose'), null);
  assert.equal(pairOf(state, eyes, 'nope'), null);
  // A peer named in Artwork wins over the roles, when it is a piece of the same category.
  const named = template();
  named.elements.eyeRight.symmetryPeer = 'eyeLeft';
  assert.equal(pairOf(named, eyes, 'eyeRight').peer.id, 'eyeLeft');
  named.elements.eyeRight.symmetryPeer = 'nose';
  assert.equal(pairOf(named, eyes, 'eyeRight').peer.id, 'eyeLeft', 'a peer outside the pair is not the pair');
  assert.equal(pairLabel(eyes), 'Edit both eyes');
  assert.equal(pairLabel(model.categories.find((category) => category.id === 'eyebrows')), 'Edit both brows');
  assert.equal(pairLabel({ id: 'x', label: 'Things' }), 'Edit both things');
  assert.deepEqual(mirrorTransformPatch({ x: 6, y: -3, rotation: 10, scaleX: 1.2, scaleY: -1.2, pivotX: 'nope' }), { x: -6, y: -3, rotation: -10, scaleX: 1.2, scaleY: -1.2 });
  assert.equal(pairSpacing({ x: 83 }, { x: 157 }), 74);
  assert.equal(pairSpacing(null, { x: 1 }), null);
  assert.deepEqual(spacingPatch(state, 'pupilLeft', 'pupilRight', 84, 74), { left: { x: -5 }, right: { x: 5 } });
  state.elements.pupilLeft.baseTransform.x = 2;
  assert.deepEqual(spacingPatch(state, 'pupilLeft', 'pupilRight', 70, 78), { left: { x: 6 }, right: { x: -4 } }, 'from where each side is');
  assert.equal(spacingPatch(state, 'pupilLeft', 'pupilRight', 'nope', 74), null);
});

test('the snapshot is plain data the browser-test seam can hand out', () => {
  const model = deriveCharacterParts(template());
  const snapshot = characterSnapshot(model, { active: 'eyes', selectedId: 'eyeRight' });
  assert.equal(snapshot.active, 'eyes');
  assert.equal(snapshot.selectedId, 'eyeRight');
  assert.deepEqual(snapshot.categories.find((category) => category.id === 'eyes'), { id: 'eyes', status: 'ready', partId: 'eyes', assetId: null, pieces: ['eyeLeft', 'eyeRight'] });
  assert.deepEqual(structuredClone(snapshot), snapshot);
});
