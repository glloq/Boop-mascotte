/**
 * What the canvas draws when the face is not finished yet (docs/FACE_GUIDES.md).
 *
 * ```text
 *        ┌──────────────┐        the head, drawn
 *        │  ╌╌╌╌  ╌╌╌╌  │        eyes      ← dashed: nothing there yet
 *        │      ╌╌      │        nose
 *        │    ╌╌╌╌╌╌    │        mouth
 *        └──────────────┘
 * ```
 *
 * An author opening the editor on a head they drew has a blank oval and a
 * panel of categories, and nothing on the canvas says a face *has* places. The
 * guides say it: a dashed box where each missing part would go, at the size it
 * would be on this head, named. Press a card and the drawing lands in the box
 * that was already there.
 *
 * Pure, and derived rather than invented: a slot is the template's own role box
 * put through the same fit an asset goes through (`fitFacePart`), so what the
 * guide promises is what the install does. Nothing here reads the DOM; the
 * caller measures and this derives, exactly as `face-layout.js` does.
 */
import { LAYOUT_ROLES, TEMPLATE_FACE_LAYOUT, TEMPLATE_ROLE_BOXES, fitFacePart, transformBox } from './face-layout.js';
import { FACE_PART_CATEGORIES } from './face-part-model.js';

/**
 * The slots a face has, in the order a face is read in.
 *
 * `role` is the layout role the slot stands for, `mount` the anchor an asset of
 * that category is fitted to, and `label` what it is called on the canvas --
 * "Left eye", not `leftEye`, because the guide is for somebody who has not read
 * the registry.
 *
 * Only the parts a face is *missing something* without. Hair, ears and facial
 * hair are all optional -- plenty of mascots have none -- and a dashed box
 * telling an author their face is incomplete because it has no beard is worse
 * than no guide at all.
 */
export const FACE_SLOTS = Object.freeze([
  Object.freeze({ role: 'leftEye', mount: 'eye.left', label: 'Left eye', category: 'eyes' }),
  Object.freeze({ role: 'rightEye', mount: 'eye.right', label: 'Right eye', category: 'eyes' }),
  Object.freeze({ role: 'nose', mount: 'nose.center', label: 'Nose', category: 'nose' }),
  Object.freeze({ role: 'mouth', mount: 'mouth.center', label: 'Mouth', category: 'mouth' })
]);

/** The category a slot is filled from, as the library names it. */
const categoryLabel = (id) => FACE_PART_CATEGORIES.find((item) => item.id === id)?.label || id;

/**
 * Where a box drawn on the template lands on this face.
 *
 * The same similarity `fitFacePart` applies to an asset, applied to a box: it
 * is the *asset* path with the box standing in for a reference box, so a slot
 * cannot drift from where the install actually puts things.
 */
function fitBox(box, mount, layout) {
  const fit = fitFacePart({ referenceBox: box, mountPoint: mount }, layout);
  return fit ? transformBox(fit, box) : null;
}

/**
 * The guides for a document, given its layout.
 *
 * @param {object} layout from `createFaceLayoutContext`
 * @param {object} document a ProjectDocument
 * @returns {{ head: object|null, slots: {role,label,category,categoryLabel,box}[] }}
 */
export function faceGuides(layout, document = {}) {
  // No head measured means no face to place anything on: the ghost head below
  // is what that case gets instead, and a slot would have nothing to be in
  // proportion to.
  if (!layout?.headBox) return { head: null, slots: [] };
  const filled = new Set();
  for (const [name, [type, role]] of Object.entries(LAYOUT_ROLES)) {
    const part = Object.values(document.semanticParts || {}).find((item) => item.type === type);
    if (part?.roles?.[role] && document.elements?.[part.roles[role]]) filled.add(name);
  }
  const slots = [];
  for (const slot of FACE_SLOTS) {
    if (filled.has(slot.role)) continue;
    const box = fitBox(TEMPLATE_ROLE_BOXES[slot.role], slot.mount, layout);
    if (box) slots.push({ ...slot, categoryLabel: categoryLabel(slot.category), box });
  }
  return { head: { ...layout.headBox }, slots };
}

/**
 * A head where there is none: the template's own silhouette, centred on the
 * working area.
 *
 * Not a slot -- there is no layout to put a slot in until something is the
 * head -- and deliberately the *shape* rather than a box, because "draw
 * something about this big, about here" is the whole message, and a rectangle
 * says the head should be a rectangle.
 *
 * @param {{x,y,width,height}|null} artboard the working area
 * @returns {{cx:number, cy:number, rx:number, ry:number}|null}
 */
export function ghostHead(artboard) {
  if (!artboard || !(artboard.width > 0) || !(artboard.height > 0)) return null;
  const head = TEMPLATE_FACE_LAYOUT.headBox;
  // The template's head against the template's own artboard, so the ghost is
  // the proportion the face template really has rather than a guess.
  const share = Math.min(head.width / 240, head.height / 240);
  const size = Math.min(artboard.width, artboard.height) * share;
  return {
    cx: artboard.x + artboard.width / 2,
    cy: artboard.y + artboard.height / 2,
    rx: (size / 2) * (head.width / Math.max(head.width, head.height)),
    ry: (size / 2) * (head.height / Math.max(head.width, head.height))
  };
}

/**
 * Where a drawing from the library will land, before it is pressed.
 *
 * The same call the install makes, so the frame is a promise the install keeps
 * rather than a second opinion about it.
 *
 * @param {object|null} asset a normalised library asset
 * @param {object} layout from `createFaceLayoutContext`
 * @returns {{x,y,width,height}|null}
 */
export function landingBox(asset, layout) {
  if (!asset?.referenceBox || !layout?.headBox) return null;
  return fitBox(asset.referenceBox, asset.mountPoint, layout);
}
