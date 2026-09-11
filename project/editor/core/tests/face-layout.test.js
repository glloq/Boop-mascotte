import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_MOUNT_POINTS } from '../face-library/face-part-model.js';
import { LAYOUT_ROLES, TEMPLATE_FACE_LAYOUT, TEMPLATE_ROLE_BOXES, boxInMountSpace, composeFit, createFaceLayoutContext, faceRoleBoxes, fitFacePart, layoutFromBoxes, layoutOnHost, layoutRoleFor, layoutThroughRoot, pointInMountSpace, transformBox, transformPoint, unionBox } from '../face-library/face-layout.js';
import { NOSE_DOT } from '../face-library/builtin/nose-dot.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createCleanProjectState } from '../state/store.js';
import { createSemanticPart, assignSemanticRole } from '../../rig-editor/semantic-parts/part-model.js';

/**
 * Where things are on a face (docs/FACE_PART_LIBRARY.md, "Layout and
 * auto-fit"). The template is the frame every asset is drawn in, so its
 * layout is the identity; a face somebody drew is read the same way, and
 * what it has not got is placed by the template's proportions in its head.
 */
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.01, `${message || ''} ${actual} ≈ ${expected}`);

test('the template\'s layout is every mount point, measured, and the reference every other face is read against', () => {
  const layout = TEMPLATE_FACE_LAYOUT;
  assert.deepEqual(Object.keys(layout.anchors), [...FACE_MOUNT_POINTS], 'one anchor per mount point, in the vocabulary\'s order');
  for (const anchor of Object.values(layout.anchors)) assert.equal(anchor.measured, true);
  assert.deepEqual(layout.headBox, TEMPLATE_ROLE_BOXES.head);
  near(layout.centerX, 120, 'the face is centred in its frame');
  near(layout.eyeLine, 111);
  assert.equal(layout.scaleReference, 1);
  near(layout.anchors['head.top'].y, 22);
  near(layout.anchors['head.bottom'].y, 210);
  near(layout.anchors['eye.left'].x, 83); near(layout.anchors['eye.right'].x, 157);
  near(layout.anchors['nose.center'].y, 148);
  near(layout.anchors['mouth.center'].y, 175.25);
  near(layout.anchors['ear.left'].x, 26.9); near(layout.anchors['ear.right'].x, 213.1);
  near(layout.anchors['hair.top'].y, 0, 'the top of the hair, not of the head');
  assert.ok(Object.isFrozen(layout.anchors));
  assert.deepEqual(Object.keys(LAYOUT_ROLES), Object.keys(TEMPLATE_ROLE_BOXES), 'every layout role has a template box');
});

test('a head somebody drew places what it has not got by the template\'s proportions', () => {
  const layout = layoutFromBoxes({ head: { x: 40, y: 30, width: 100, height: 120 } });
  assert.deepEqual(layout.headBox, { x: 40, y: 30, width: 100, height: 120 });
  near(layout.centerX, 90);
  near(layout.scaleReference, 100 / 188.21);
  for (const name of FACE_MOUNT_POINTS) assert.equal(layout.anchors[name].measured, name.startsWith('head.'), `${name} is ${name.startsWith('head.') ? 'measured' : 'placed'}`);
  const at = (name) => [layout.anchors[name].x, layout.anchors[name].y];
  assert.deepEqual(at('head.top'), [90, 30]); assert.deepEqual(at('head.center'), [90, 90]); assert.deepEqual(at('head.bottom'), [90, 150]);
  // The template's nose sits at (120.6, 148) in a head at (25.89, 22) 188 wide: the same fraction of this head.
  near(layout.anchors['nose.center'].x, 40 + ((120.615 - 25.89) / 188.21) * 100);
  near(layout.anchors['nose.center'].y, 30 + ((148 - 22) / 188) * 120);
  near(layout.anchors.eyes.y, 30 + ((111 - 22) / 188) * 120);
  near(layout.eyeLine, layout.anchors.eyes.y);
  assert.ok(layout.anchors['hair.top'].y < 30, 'the hair starts above the head');
  assert.deepEqual(layout.boxes.nose, null);
});

test('a measured part wins over the proportion, and a pair needs both sides', () => {
  const head = { x: 0, y: 0, width: 200, height: 200 };
  const one = layoutFromBoxes({ head, leftEye: { x: 40, y: 60, width: 30, height: 30 } });
  assert.equal(one.anchors.eyes.measured, false, 'one eye is not a pair');
  assert.equal(one.anchors['eye.left'].measured, false);
  const both = layoutFromBoxes({ head, leftEye: { x: 40, y: 60, width: 30, height: 30 }, rightEye: { x: 130, y: 60, width: 30, height: 30 }, nose: { x: 95, y: 100, width: 10, height: 12 } });
  assert.deepEqual(both.anchors.eyes, { x: 100, y: 75, measured: true });
  assert.deepEqual(both.anchors['eye.left'], { x: 55, y: 75, measured: true });
  assert.deepEqual(both.anchors['eye.right'], { x: 145, y: 75, measured: true });
  assert.deepEqual(both.anchors['nose.center'], { x: 100, y: 106, measured: true });
  assert.equal(both.eyeLine, 75);
  assert.equal(both.anchors.brows.measured, false, 'no brows: placed by proportion');
  assert.deepEqual(unionBox(null, { x: 1, y: 2, width: 3, height: 4 }, { x: 0, y: 0, width: 0, height: 5 }), { x: 1, y: 2, width: 3, height: 4 }, 'a box with no area is not a box');
  assert.equal(unionBox(), null);
});

test('with no head there is nothing to fit to, and the anchors are the template\'s own', () => {
  const layout = layoutFromBoxes({});
  assert.equal(layout.headBox, null);
  assert.equal(layout.centerX, null);
  assert.equal(layout.scaleReference, 1);
  assert.deepEqual(layout.anchors['mouth.center'], { ...TEMPLATE_FACE_LAYOUT.anchors['mouth.center'], measured: false });
  assert.equal(fitFacePart(NOSE_DOT, layout), null);
});

test('the role boxes are read from the semantic parts, whatever the shapes are called', () => {
  const state = createTemplateProjectState();
  const boxes = faceRoleBoxes(state, (id) => TEMPLATE_ROLE_BOXES[({ eyeLeft: 'leftEye', eyeRight: 'rightEye', browLeft: 'leftBrow', browRight: 'rightBrow', earLeft: 'leftEar', earRight: 'rightEar' })[id] || id] || null);
  assert.deepEqual(boxes, Object.fromEntries(Object.entries(TEMPLATE_ROLE_BOXES).map(([name, box]) => [name, { ...box }])));
  const layout = createFaceLayoutContext(state, (id) => boxes[({ eyeLeft: 'leftEye', eyeRight: 'rightEye', browLeft: 'leftBrow', browRight: 'rightBrow', earLeft: 'leftEar', earRight: 'rightEar' })[id] || id]);
  assert.deepEqual(layout.anchors, Object.fromEntries(Object.entries(TEMPLATE_FACE_LAYOUT.anchors).map(([name, anchor]) => [name, { ...anchor }])), 'the template read live is the template');
  // A drawn face: one ellipse, assigned as the head, and nothing the canvas can measure for the rest.
  const drawn = createCleanProjectState();
  drawn.elements = { blob: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, bindings: {}, meta: { nodeType: 'ellipse' } } };
  const part = createSemanticPart(drawn, 'head');
  assignSemanticRole(drawn, part.id, 'head', 'blob');
  const read = faceRoleBoxes(drawn, (id) => (id === 'blob' ? { x: 10, y: 10, width: 50, height: 60 } : null));
  assert.deepEqual(read.head, { x: 10, y: 10, width: 50, height: 60 });
  assert.equal(read.mouth, null);
  assert.equal(faceRoleBoxes(drawn, () => ({ x: 0, y: 0, width: 0, height: 0 })).head, null, 'a box the canvas could not measure is no box');
});

test('fitting is one similarity: this head\'s size, the reference box centred on the mount point', () => {
  // On the template every asset is already where it belongs.
  assert.deepEqual(fitFacePart(NOSE_DOT, TEMPLATE_FACE_LAYOUT), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 148, mountPoint: 'nose.center', anchor: { x: 120.615, y: 148, measured: true } });
  assert.deepEqual(fitFacePart(MOUTH_SIMPLE, TEMPLATE_FACE_LAYOUT), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 120, pivotY: 176.5, mountPoint: 'mouth.center', anchor: { x: 120, y: 175.25, measured: true } });
  // On a head half the size, elsewhere: half the size, at that head's nose.
  const layout = layoutFromBoxes({ head: { x: 300, y: 100, width: 94.105, height: 94 } });
  const fit = fitFacePart(NOSE_DOT, layout);
  near(fit.scaleX, 0.5); near(fit.scaleY, 0.5);
  assert.deepEqual([fit.pivotX, fit.pivotY], [120, 148], 'scaled about the reference box\'s own centre');
  // The nose's centre lands on the anchor, the asset's own offset from the template anchor halved with it.
  const anchor = layout.anchors['nose.center'];
  near(120 + fit.x, anchor.x + (120 - 120.615) * 0.5);
  near(148 + fit.y, anchor.y);
  assert.equal(fit.mountPoint, 'nose.center');
  assert.equal(fit.anchor.measured, false);
  // A mount point the layout does not know falls back to the head's centre; a box with no area cannot be fitted.
  assert.equal(fitFacePart({ ...NOSE_DOT, mountPoint: 'nowhere' }, layout).mountPoint, 'head.center');
  assert.equal(fitFacePart({ ...NOSE_DOT, referenceBox: { x: 0, y: 0, width: 0, height: 1 } }, layout), null);
});

test('the author\'s turn and size ride on top of the fit; the place is the fit\'s', () => {
  const fit = { x: -30, y: -37.5, rotation: 0, scaleX: 0.5, scaleY: 0.5, pivotX: 120, pivotY: 148 };
  assert.deepEqual(composeFit(fit, null), { x: -30, y: -37.5, rotation: 0, scaleX: 0.5, scaleY: 0.5 });
  assert.deepEqual(composeFit(fit, { x: 4, y: -2, rotation: 5, scaleX: 1.2, scaleY: -1.2 }), { x: -30, y: -37.5, rotation: 5, scaleX: 0.6, scaleY: -0.6 }, 'a flip is kept; the move is already in the anchor');
  assert.deepEqual(composeFit(null, { x: 4, y: -2, rotation: 5, scaleX: 1.2, scaleY: 1.2 }), { x: 4, y: -2, rotation: 5, scaleX: 1.2, scaleY: 1.2 }, 'nothing fitted: the old transform as it was');
  assert.deepEqual(composeFit(null, null), { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  assert.deepEqual(composeFit(fit, { x: 'nope', scaleX: 'nope' }), { x: -30, y: -37.5, rotation: 0, scaleX: 0.5, scaleY: 0.5 }, 'rubbish is not composed');
});

test('a measured box is carried into the mount group\'s space through every transform below it', () => {
  const move = { x: 10, y: 5, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
  assert.deepEqual(transformPoint(move, { x: 1, y: 2 }), { x: 11, y: 7 });
  const grow = { x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, pivotX: 10, pivotY: 10 };
  assert.deepEqual(transformPoint(grow, { x: 10, y: 10 }), { x: 10, y: 10 }, 'the pivot stays put');
  assert.deepEqual(transformPoint(grow, { x: 15, y: 10 }), { x: 20, y: 10 });
  const turn = { x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 };
  const turned = transformPoint(turn, { x: 1, y: 0 });
  near(turned.x, 0); near(turned.y, 1);
  assert.deepEqual(transformBox(grow, { x: 10, y: 10, width: 5, height: 5 }), { x: 10, y: 10, width: 10, height: 10 });
  const spun = transformBox(turn, { x: 0, y: 0, width: 4, height: 2 });
  near(spun.x, -2); near(spun.y, 0); near(spun.width, 2); near(spun.height, 4);

  // A nose inside a fitted root inside the face group: its own space is the
  // root's, and the anchor has to be where the face sees it.
  const document = {
    layers: [{ id: 'face', children: [{ id: 'nose-dot', children: [{ id: 'nose', children: [] }] }] }],
    elements: { face: { baseTransform: { x: 100, y: 100 } }, 'nose-dot': { baseTransform: { x: -30, y: -37.5, rotation: 0, scaleX: 0.5, scaleY: 0.5, pivotX: 120, pivotY: 148 } }, nose: { baseTransform: { x: 0, y: 0 } } }
  };
  assert.deepEqual(pointInMountSpace(document, 'nose', { x: 120, y: 148 }, 'face'), { x: 90, y: 110.5 }, 'through the root, not through the mount itself');
  assert.deepEqual(pointInMountSpace(document, 'nose', { x: 120, y: 148 }, null), { x: 190, y: 210.5 }, 'with no mount, through everything');
  assert.deepEqual(boxInMountSpace(document, 'nose', { x: 114.5, y: 142.5, width: 11, height: 11 }, 'face'), { x: 87.25, y: 107.75, width: 5.5, height: 5.5 });
  assert.deepEqual(pointInMountSpace(document, 'nowhere', { x: 1, y: 2 }, 'face'), { x: 1, y: 2 }, 'a shape the tree does not hold is left where it is');
});

test('a part that came from the library keeps its anchor through its root, so replacing it again does not drift', () => {
  const document = {
    layers: [{ id: 'face', children: [{ id: 'mouth-wide', children: [{ id: 'mouth', children: [] }] }] }],
    elements: { face: { baseTransform: {} }, 'mouth-wide': { baseTransform: { x: 3, y: -4, rotation: 0, scaleX: 0.5, scaleY: 0.5, pivotX: 120, pivotY: 179 } }, mouth: { baseTransform: {} } }
  };
  const layout = layoutFromBoxes({ head: { x: 25.89, y: 22, width: 188.21, height: 188 }, mouth: { x: 43, y: 88, width: 40, height: 5 } });
  const through = layoutThroughRoot(layout, document, { rootId: 'mouth-wide', mountPoint: 'mouth.center', parentId: 'face' });
  // The root's centre (120, 179) moved by (3, -4), less the 3.75 the wide mouth is drawn below the template's anchor, at this face's scale of one.
  assert.deepEqual(through.anchors['mouth.center'], { x: 123, y: 171.25, measured: true });
  // Fitting the same asset there lands its centre exactly where the old one's was, whatever the old root's turn or size.
  const same = fitFacePart({ referenceBox: { x: 80, y: 168, width: 80, height: 22 }, mountPoint: 'mouth.center' }, through);
  assert.deepEqual([same.x, same.y], [3, -4]);
  assert.deepEqual(through.anchors['nose.center'], layout.anchors['nose.center'], 'every other anchor as measured');
  assert.equal(layoutThroughRoot(layout, document, { rootId: 'nope', mountPoint: 'mouth.center', parentId: 'face' }), layout, 'no such root: the layout as it was');
  assert.equal(layoutThroughRoot(layoutFromBoxes({}), document, { rootId: 'mouth-wide', mountPoint: 'mouth.center' }).headBox, null, 'no head: nothing to anchor');
});

/* ── Hosted on a part (V3-03) ────────────────────────────────────────────── */

/** A face whose ears are a fitted pair of groups, with an earring drawn inside the left one. */
function hosted() {
  const document = createCleanProjectState();
  const element = (baseTransform, nodeType = 'g') => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...baseTransform }, bindings: {}, meta: { nodeType } });
  document.elements = {
    head: element({}, 'path'),
    // The pair is fitted onto a face twice the template's size, so everything
    // drawn inside it is drawn in the asset's own frame, at half the scale.
    ears: element({ scaleX: 2, scaleY: 2 }),
    earLeft: element({}), earLeftShape: element({}, 'ellipse'),
    earring: element({}, 'circle')
  };
  document.layers = [{ id: 'head', children: [] }, { id: 'ears', children: [{ id: 'earLeft', children: [{ id: 'earLeftShape', children: [] }, { id: 'earring', children: [] }] }] }];
  const head = createSemanticPart(document, 'head');
  assignSemanticRole(document, head.id, 'head', 'head');
  const ears = createSemanticPart(document, 'ears');
  assignSemanticRole(document, ears.id, 'leftEar', 'earLeft');
  const accessory = createSemanticPart(document, 'accessory');
  assignSemanticRole(document, accessory.id, 'element', 'earring');
  Object.assign(accessory, { assetId: 'accessory.earring', assetRoot: 'earring', assetHost: { partId: ears.id, role: 'leftEar' } });
  // The canvas measures a group as everything inside it, the earring included.
  const measure = (id) => ({ head: { x: 0, y: 0, width: 376.42, height: 376 }, earLeft: { x: 12, y: 103, width: 30, height: 71 }, earLeftShape: { x: 12, y: 103, width: 30, height: 30 }, earring: { x: 21, y: 138, width: 12, height: 12 } })[id] || null;
  return { document, measure, ears };
}

test('a face is read in the space the new artwork joins, even when that space is inside the face', () => {
  const { document, measure } = hosted();
  // Read for artwork joining the face: the ear is where the pair's fit put it,
  // at the size that fit gave it.
  assert.deepEqual(faceRoleBoxes(document, measure).leftEar, { x: 24, y: 206, width: 60, height: 60 });
  // Read for artwork joining the ear: the same ear, in the ear's own frame,
  // where it is drawn. The pair's scale belongs to the group, and counting it
  // twice is how an earring ends up at four times its size.
  const inside = faceRoleBoxes(document, measure, { mountPoint: 'earLeft' });
  assert.deepEqual(inside.leftEar, { x: 12, y: 103, width: 30, height: 30 });
  assert.deepEqual(inside.head, { x: 0, y: 0, width: 188.21, height: 188 }, 'and the head, which is nowhere near it');
  assert.equal(layoutFromBoxes(inside).scaleReference, 1, 'so an asset drawn in that frame is fitted at the size it was drawn');
});

test('what hangs on a part is not measured as part of it', () => {
  const { document, measure } = hosted();
  // The canvas measures the ear group 71 tall, because the earring hangs 26
  // below the ear. The ear is 30 tall; the rest is the earring's own.
  assert.deepEqual(faceRoleBoxes(document, measure, { mountPoint: 'earLeft' }).leftEar, { x: 12, y: 103, width: 30, height: 30 });
  const loose = structuredClone(document);
  delete Object.values(loose.semanticParts).find((part) => part.type === 'accessory').assetHost;
  assert.deepEqual(faceRoleBoxes(loose, measure, { mountPoint: 'earLeft' }).leftEar, { x: 12, y: 103, width: 30, height: 71 }, 'a drawing that hangs on nothing is part of the piece it is drawn in');
});

test('an asset that hangs on a part is anchored on that part, whichever side it named', () => {
  const { document, measure } = hosted();
  assert.deepEqual([layoutRoleFor('ears', 'leftEar'), layoutRoleFor('ears', 'rightEar'), layoutRoleFor('ears', 'nope')], ['leftEar', 'rightEar', null]);
  const layout = layoutFromBoxes(faceRoleBoxes(document, measure, { mountPoint: 'earLeft' }));
  assert.equal(layout.anchors['ear.left'].measured, false, 'one ear is not a pair, so there is nothing measured to fit to');
  const onHost = layoutOnHost(layout, { part: 'ears', role: 'leftEar' }, 'ear.left');
  assert.deepEqual(onHost.anchors['ear.left'], { x: 27, y: 118, measured: true }, 'the ear it named');
  assert.deepEqual(onHost.anchors['ear.right'], layout.anchors['ear.right'], 'and nothing else moves');
  assert.equal(layoutOnHost(layout, { part: 'accessory', role: 'element' }, 'ear.left'), layout, 'a host the layout does not measure leaves the anchor as it was');
  assert.equal(layoutOnHost(layout, null, 'ear.left'), layout);
});
