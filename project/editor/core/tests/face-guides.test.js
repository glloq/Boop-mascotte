import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_SLOTS, faceGuides, ghostHead, landingBox } from '../face-library/face-guides.js';
import { TEMPLATE_FACE_LAYOUT, TEMPLATE_ROLE_BOXES, layoutFromBoxes } from '../face-library/face-layout.js';

/**
 * Where a face's parts go, for somebody who has not made one before
 * (docs/FACE_GUIDES.md).
 *
 * The property that matters is not what the boxes measure -- that is
 * `face-layout.js`'s -- but that a guide is **the same answer the install
 * gives**. A dashed box promising one place while the press puts the drawing
 * somewhere else is worse than no box, because an author believes it.
 */
const part = (type, roles) => ({ id: type, type, roles });
const faceWith = (...parts) => ({
  semanticParts: Object.fromEntries(parts.map((item) => [item.id, item])),
  elements: Object.fromEntries(parts.flatMap((item) => Object.values(item.roles)).map((id) => [id, { baseTransform: {} }]))
});

test('a face with nothing on it has a slot for every part a face needs', () => {
  const guides = faceGuides(TEMPLATE_FACE_LAYOUT, faceWith(part('head', { head: 'head' })));
  assert.deepEqual(guides.slots.map((slot) => slot.role), ['leftEye', 'rightEye', 'nose', 'mouth']);
  assert.deepEqual(guides.slots.map((slot) => slot.label), ['Left eye', 'Right eye', 'Nose', 'Mouth']);
  // The label is what a person calls it. `leftEye` is what the registry calls
  // it, and the guide is for somebody who has never read the registry.
  for (const slot of guides.slots) assert.ok(!/[A-Z]/.test(slot.label.slice(1).replace(/ \w/g, '')), `${slot.label} reads as words`);
  assert.deepEqual(guides.head, TEMPLATE_FACE_LAYOUT.headBox);

  // On the template's own face a slot is exactly where the template draws that
  // part: the guide is the identity there, which is what makes it believable
  // anywhere else.
  const byRole = Object.fromEntries(guides.slots.map((slot) => [slot.role, slot.box]));
  for (const [role, box] of Object.entries(byRole)) {
    for (const key of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(box[key] - TEMPLATE_ROLE_BOXES[role][key]) < 0.01, `${role}.${key}: ${box[key]} is where the template draws it`);
    }
  }
});

test('a part the face already has is not a slot', () => {
  const face = faceWith(part('head', { head: 'head' }), part('eyes', { leftEye: 'l', rightEye: 'r' }), part('mouth', { mouth: 'm' }));
  const guides = faceGuides(TEMPLATE_FACE_LAYOUT, face);
  assert.deepEqual(guides.slots.map((slot) => slot.role), ['nose'], 'only what is missing');

  // A part whose role points at an element that is not there is not a part:
  // the drawing was deleted and the role left behind, and an author needs the
  // slot back rather than a face that quietly has no mouth.
  const broken = { ...face, elements: { head: { baseTransform: {} }, l: { baseTransform: {} }, r: { baseTransform: {} } } };
  assert.deepEqual(faceGuides(TEMPLATE_FACE_LAYOUT, broken).slots.map((slot) => slot.role), ['nose', 'mouth']);
});

test('the slots are in proportion to the head they are on, not to the template', () => {
  // Half the width, a third of the way down the page.
  const layout = layoutFromBoxes({ head: { x: 0, y: 80, width: 94.105, height: 94 } });
  const guides = faceGuides(layout, faceWith(part('head', { head: 'head' })));
  const mouth = guides.slots.find((slot) => slot.role === 'mouth');
  const template = TEMPLATE_ROLE_BOXES.mouth;
  assert.ok(Math.abs(mouth.box.width - template.width / 2) < 0.1, 'half the head, half the mouth');
  assert.ok(mouth.box.y > 80 && mouth.box.y < 174, 'and inside the head, where the head is');
  // Nothing to be in proportion *to* is not a guess: a face with no head gets
  // the ghost instead, and no slots at all.
  assert.deepEqual(faceGuides(layoutFromBoxes({}), {}), { head: null, slots: [] });
});

test('a drawing lands where the guide says it will', () => {
  const layout = layoutFromBoxes({ head: { x: 10, y: 10, width: 376.42, height: 376 } });
  const asset = { id: 'mouth.full', referenceBox: { x: 87, y: 169.5, width: 66, height: 14 }, mountPoint: 'mouth.center' };
  const landing = landingBox(asset, layout);
  // Twice the template's head, so twice the drawing.
  assert.ok(Math.abs(landing.width - 132) < 0.1);
  assert.ok(Math.abs(landing.height - 28) < 0.1);
  // And centred on the mouth anchor this head has, which is the same anchor
  // the mouth *slot* is drawn at: press the card and the drawing arrives in
  // the box that was already there.
  const slot = faceGuides(layout, faceWith(part('head', { head: 'head' }))).slots.find((item) => item.role === 'mouth');
  const middle = (box) => box.x + box.width / 2;
  assert.ok(Math.abs(middle(landing) - middle(slot.box)) < 0.5, 'the landing and the slot share a middle');

  assert.equal(landingBox(null, layout), null);
  assert.equal(landingBox(asset, layoutFromBoxes({})), null, 'nothing to fit to is no promise');
});

test('with no head at all, the one thing that is always true', () => {
  const ghost = ghostHead({ x: 0, y: 0, width: 240, height: 240 });
  assert.ok(ghost.cx === 120 && ghost.cy === 120, 'in the middle of the working area');
  // The template's own proportion, so the ghost is the head the editor really
  // makes rather than a circle somebody guessed at.
  assert.ok(Math.abs(ghost.rx / ghost.ry - TEMPLATE_ROLE_BOXES.head.width / TEMPLATE_ROLE_BOXES.head.height) < 0.01);
  assert.ok(ghost.rx * 2 < 240 && ghost.rx * 2 > 150, 'most of the page, and inside it');
  // A working area that is not one is not drawn on.
  for (const box of [null, { width: 0, height: 100 }, { width: 100, height: -1 }]) assert.equal(ghostHead(box), null);
});

test('the slots are the parts a face is not a face without', () => {
  // Hair, ears and facial hair are absent on purpose: plenty of mascots have
  // none, and a dashed box saying a face is unfinished because it has no beard
  // is a guide that has started lying.
  assert.deepEqual(FACE_SLOTS.map((slot) => slot.category), ['eyes', 'eyes', 'nose', 'mouth']);
  for (const slot of FACE_SLOTS) assert.ok(TEMPLATE_ROLE_BOXES[slot.role], `${slot.role} is a role the template draws`);
});
