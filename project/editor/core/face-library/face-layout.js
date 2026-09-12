/**
 * Where things are on a face (docs/FACE_PART_LIBRARY.md, "Layout and
 * auto-fit"; roadmap phases 5 and 6).
 *
 * ```text
 *            hair.top
 *          ┌──────────┐  head.top
 *   ear.left │ ◉    ◉ │ ear.right      eyes · eye.left · eye.right
 *            │  brows  │                brows · brow.left · brow.right
 *            │    ▽    │  nose.center
 *            │   ◡    │  mouth.center
 *          └──────────┘  head.bottom
 * ```
 *
 * An asset is drawn against the template face, and the face it joins is any
 * size, anywhere. The *layout context* is that face read as anchors: a point
 * for every mount point an asset may name, measured from the part that plays
 * the role when the mascot has one, and placed by the template's own
 * proportions inside the head when it does not. Fitting an asset is then one
 * similarity: the asset's reference box lands where its mount point is, at
 * the size of this head, and the author's adjustments to the old part ride
 * on top. Nothing here reads the DOM: the caller measures, this derives.
 */
import { FACE_MOUNT_POINTS } from './face-part-model.js';

/**
 * The template face's parts, as the canvas measures them (each shape's own
 * box, before its transform). Measured once in the browser and written down,
 * so the layout the template *is* can be derived without one; the browser
 * test holds the live face to these within a pixel.
 */
export const TEMPLATE_ROLE_BOXES = Object.freeze({
  head: Object.freeze({ x: 25.89, y: 22, width: 188.21, height: 188 }),
  // An eye is the whole group -- the lids parked outside the socket included,
  // since a box is geometry and knows nothing of the clip that hides them.
  leftEye: Object.freeze({ x: 37, y: 44.5, width: 92, height: 135 }),
  rightEye: Object.freeze({ x: 111, y: 44.5, width: 92, height: 135 }),
  leftBrow: Object.freeze({ x: 60, y: 74.97, width: 50.5, height: 12.63 }),
  rightBrow: Object.freeze({ x: 129.5, y: 74.97, width: 50.5, height: 12.63 }),
  nose: Object.freeze({ x: 114.23, y: 143.4, width: 12.77, height: 9.2 }),
  mouth: Object.freeze({ x: 87, y: 172.5, width: 66, height: 5.5 }),
  leftEar: Object.freeze({ x: 12.9, y: 97, width: 28, height: 42.05 }),
  rightEar: Object.freeze({ x: 199.1, y: 97, width: 28, height: 42.05 }),
  hair: Object.freeze({ x: 0.65, y: 0, width: 238.8, height: 134.13 }),
  hairTop: Object.freeze({ x: 15.63, y: 0.64, width: 202.6, height: 106.63 }),
  hairBack: Object.freeze({ x: 8.36, y: 0.65, width: 217.65, height: 129.56 })
});

/** Which semantic part and role each layout role is read from. */
export const LAYOUT_ROLES = Object.freeze({
  head: Object.freeze(['head', 'head']),
  leftEye: Object.freeze(['eyes', 'leftEye']), rightEye: Object.freeze(['eyes', 'rightEye']),
  leftBrow: Object.freeze(['eyebrows', 'leftBrow']), rightBrow: Object.freeze(['eyebrows', 'rightBrow']),
  nose: Object.freeze(['nose', 'nose']),
  mouth: Object.freeze(['mouth', 'mouth']),
  leftEar: Object.freeze(['ears', 'leftEar']), rightEar: Object.freeze(['ears', 'rightEar']),
  hair: Object.freeze(['hair', 'hair']), hairTop: Object.freeze(['hair', 'hairTop']), hairBack: Object.freeze(['hair', 'hairBack'])
});

const usable = (box) => Boolean(box && [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0 && box.height > 0);
const round = (value) => Math.round(Number(value) * 1000) / 1000;
const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/* ── Coordinates ──────────────────────────────────────────────────────────
 * The canvas measures a shape in its own space, before its transform and its
 * ancestors'. An anchor has to be where the shape *is*, in the space the new
 * artwork is drawn into: the group the part sits in. So a measured box is
 * carried through every base transform between the shape and that group,
 * the way the runtime composes them: scale about the pivot, turn about the
 * pivot, then move.
 */

/** A point through one base transform. */
export function transformPoint(transform = {}, point) {
  const sx = finite(transform.scaleX, 1), sy = finite(transform.scaleY, 1), px = finite(transform.pivotX, 0), py = finite(transform.pivotY, 0);
  const angle = (finite(transform.rotation, 0) * Math.PI) / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const x = (point.x - px) * sx, y = (point.y - py) * sy;
  return { x: px + x * cos - y * sin + finite(transform.x, 0), y: py + x * sin + y * cos + finite(transform.y, 0) };
}

/**
 * A point back through one base transform: where it was drawn, given where it
 * ended up. The way *into* a group, as `transformPoint` is the way out of one.
 *
 * A group with no width -- a scale of zero on either axis -- has no inside to
 * speak of: everything drawn in it lands on the same line, and there is no
 * point to come back to, so the point is left where it is.
 */
export function untransformPoint(transform = {}, point) {
  const sx = finite(transform.scaleX, 1), sy = finite(transform.scaleY, 1);
  if (!sx || !sy) return { x: point.x, y: point.y };
  const px = finite(transform.pivotX, 0), py = finite(transform.pivotY, 0);
  const angle = (finite(transform.rotation, 0) * Math.PI) / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const x = point.x - px - finite(transform.x, 0), y = point.y - py - finite(transform.y, 0);
  return { x: px + (x * cos + y * sin) / sx, y: py + (y * cos - x * sin) / sy };
}

/** The box around a box's corners through one base transform. */
export function transformBox(transform = {}, box) {
  const corners = [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height }].map((corner) => transformPoint(transform, corner));
  const x = Math.min(...corners.map((corner) => corner.x)), y = Math.min(...corners.map((corner) => corner.y));
  return { x, y, width: Math.max(...corners.map((corner) => corner.x)) - x, height: Math.max(...corners.map((corner) => corner.y)) - y };
}

/** The box around a box's corners back through one base transform. */
export function untransformBox(transform = {}, box) {
  const corners = [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height }].map((corner) => untransformPoint(transform, corner));
  const x = Math.min(...corners.map((corner) => corner.x)), y = Math.min(...corners.map((corner) => corner.y));
  return { x, y, width: Math.max(...corners.map((corner) => corner.x)) - x, height: Math.max(...corners.map((corner) => corner.y)) - y };
}

/** Every layer's parent, so an ancestor walk is a lookup rather than a search: the one walker the library and the builder share. */
export function layerParents(layers = []) {
  const parents = {};
  const visit = (items, parent) => { for (const item of items || []) { parents[item.id] = parent; visit(item.children, item.id); } };
  visit(layers, null);
  return parents;
}

/** The shape and every ancestor below the mount group, innermost first. */
function chainTo(document, id, mountPoint, parents = layerParents(document.layers)) {
  const chain = [];
  for (let at = id; at && at !== mountPoint; at = parents[at]) chain.push(at);
  return chain;
}

/**
 * Whether the mount group is one of the groups this shape is drawn inside --
 * and a shape the layer tree does not hold counts as inside, because it is
 * nowhere, and nowhere is left where it is.
 */
const under = (parents, mountPoint, id) => {
  if (!(id in parents)) return true;
  for (let at = id; at; at = parents[at]) if (at === mountPoint) return true;
  return false;
};

/**
 * The mount group and every group above it, outermost first: the way *down*
 * into it, for a shape that is drawn somewhere else.
 *
 * New artwork usually joins the group the old part sat in, which is above
 * everything the layout measures, so the walk is upwards and stops there. An
 * asset hosted on a part is drawn *inside* that part instead -- an earring in
 * the ear -- and the face it is being fitted to is outside it: the head, the
 * eyes and the other ear are read in the document's own space and then carried
 * down into the ear's, or the ear's own scale would be counted twice.
 */
function chainInto(mountPoint, parents) {
  const chain = [];
  for (let at = mountPoint; at; at = parents[at]) chain.unshift(at);
  return chain;
}

/** A point of a shape's own space, in the mount group's space. */
export function pointInMountSpace(document, id, point, mountPoint = null) {
  const parents = layerParents(document.layers);
  const at = chainTo(document, id, mountPoint, parents).reduce((point_, node) => transformPoint(document.elements?.[node]?.baseTransform, point_), point);
  if (!mountPoint || under(parents, mountPoint, id)) return at;
  return chainInto(mountPoint, parents).reduce((point_, node) => untransformPoint(document.elements?.[node]?.baseTransform, point_), at);
}

/** A shape's measured box, in the mount group's space. */
export function boxInMountSpace(document, id, box, mountPoint = null) {
  const parents = layerParents(document.layers);
  const at = chainTo(document, id, mountPoint, parents).reduce((box_, node) => transformBox(document.elements?.[node]?.baseTransform, box_), box);
  if (!mountPoint || under(parents, mountPoint, id)) return at;
  return chainInto(mountPoint, parents).reduce((box_, node) => untransformBox(document.elements?.[node]?.baseTransform, box_), at);
}

/** The box around several boxes, or null when none is usable. */
export function unionBox(...boxes) {
  const list = boxes.filter(usable);
  if (!list.length) return null;
  const x = Math.min(...list.map((box) => box.x)), y = Math.min(...list.map((box) => box.y));
  return { x, y, width: Math.max(...list.map((box) => box.x + box.width)) - x, height: Math.max(...list.map((box) => box.y + box.height)) - y };
}

/** Every layer by id, so a subtree can be walked without searching for its root. */
function layerIndex(layers = []) {
  const index = new Map();
  const visit = (items) => { for (const item of items || []) { index.set(item.id, item); visit(item.children); } };
  visit(layers);
  return index;
}

/** Whether anything that hangs on a part is drawn somewhere inside this piece. */
function holds(index, id, guests) {
  const visit = (node) => (guests.has(node.id) ? true : (node.children || []).some(visit));
  return (index.get(id)?.children || []).some(visit);
}

/**
 * A role's own box: what the part draws, without what hangs on it.
 *
 * A hosted accessory is drawn *inside* its host (docs/FACE_PART_LIBRARY.md,
 * "Hosted on a part"), so the canvas measures the ear and the earring together
 * when it measures the ear -- and anything fitted to that box would land half
 * an earring low, again at every replacement, which over three ear swaps is a
 * face sliding down the page. A piece with a guest inside it is measured from
 * its own pieces instead, each carried up through its transform, the way the
 * canvas unions them.
 */
function drawnBox(document, measure, id, guests, index) {
  if (!guests.size || !holds(index, id, guests)) return measure(id);
  const boxes = (index.get(id)?.children || [])
    .filter((child) => !guests.has(child.id))
    .map((child) => { const box = drawnBox(document, measure, child.id, guests, index); return usable(box) ? transformBox(document.elements?.[child.id]?.baseTransform, box) : null; });
  return unionBox(...boxes);
}

/**
 * Every layout role's box on this mascot, measured from the shape that plays
 * it and carried into the mount group's space. A role nobody plays, or a
 * shape the canvas cannot measure, is null.
 *
 * @param {object} document a ProjectDocument
 * @param {(id: string) => ({x,y,width,height}|null)} measure the canvas's measure
 * @param {{ mountPoint?: string|null }} [options] the group new artwork is drawn into; null for the root
 */
export function faceRoleBoxes(document = {}, measure = () => null, { mountPoint = null } = {}) {
  const parts = Object.values(document.semanticParts || {});
  const elements = document.elements || {};
  const roleElement = (type, role) => { const id = parts.find((part) => part?.type === type)?.roles?.[role]; return id && elements[id] ? id : null; };
  const index = layerIndex(document.layers);
  const guests = new Set(parts.filter((part) => part?.assetHost && part.assetRoot && elements[part.assetRoot]).map((part) => part.assetRoot));
  const boxes = {};
  for (const [name, [type, role]] of Object.entries(LAYOUT_ROLES)) {
    let id = roleElement(type, role);
    // The head that turns can be the whole face (the template's is the group
    // every feature sits in); the head that is *measured* is the skull, which
    // on such a face is the shape the jaw moves.
    if (name === 'head' && id && elements[id].meta?.nodeType === 'g') id = roleElement('jaw', 'jaw') || id;
    const box = id ? drawnBox(document, measure, id, guests, index) : null;
    const placed = usable(box) ? boxInMountSpace(document, id, { x: box.x, y: box.y, width: box.width, height: box.height }, mountPoint) : null;
    boxes[name] = placed ? { x: round(placed.x), y: round(placed.y), width: round(placed.width), height: round(placed.height) } : null;
  }
  return boxes;
}

/**
 * Where each mount point is, given the boxes: a point, and whether a part
 * was there to measure it from. Pairs need both sides, as the brows did
 * before this file existed: one eye's box would put a pair over one eye.
 */
function anchorsFromBoxes(boxes) {
  const head = boxes.head;
  const pair = (left, right) => (usable(boxes[left]) && usable(boxes[right]) ? unionBox(boxes[left], boxes[right]) : null);
  const eyes = pair('leftEye', 'rightEye'), brows = pair('leftBrow', 'rightBrow'), ears = pair('leftEar', 'rightEar');
  const hair = unionBox(boxes.hair, boxes.hairTop, boxes.hairBack);
  const at = (box, pick = centre) => (usable(box) ? { ...pick(box), measured: true } : null);
  return {
    'head.top': at(head, (box) => ({ x: box.x + box.width / 2, y: box.y })),
    'head.center': at(head),
    'head.bottom': at(head, (box) => ({ x: box.x + box.width / 2, y: box.y + box.height })),
    eyes: at(eyes), 'eye.left': eyes && at(boxes.leftEye), 'eye.right': eyes && at(boxes.rightEye),
    brows: at(brows), 'brow.left': brows && at(boxes.leftBrow), 'brow.right': brows && at(boxes.rightBrow),
    'nose.center': at(boxes.nose),
    'mouth.center': at(boxes.mouth),
    ears: at(ears), 'ear.left': ears && at(boxes.leftEar), 'ear.right': ears && at(boxes.rightEar),
    'hair.top': at(hair, (box) => ({ x: box.x + box.width / 2, y: box.y }))
  };
}

/**
 * The layout a set of role boxes describes.
 *
 * @param {Record<string, {x,y,width,height}|null>} boxes by layout role
 * @param {{ template?: object }} [options] the reference layout, for the proportions a missing part is placed by
 * @returns {{ headBox: object|null, centerX: number|null, eyeLine: number|null, scaleReference: number, anchors: Record<string, {x:number,y:number,measured:boolean}>, boxes: object }}
 */
export function layoutFromBoxes(boxes = {}, { template = null } = {}) {
  const measured = anchorsFromBoxes(boxes);
  const head = usable(boxes.head) ? { ...boxes.head } : null;
  const reference = template || TEMPLATE_FACE_LAYOUT;
  const anchors = {};
  for (const name of FACE_MOUNT_POINTS) {
    if (measured[name]) { anchors[name] = { x: round(measured[name].x), y: round(measured[name].y), measured: true }; continue; }
    // Nothing to measure: where the template keeps it, in proportion to this head.
    const from = reference?.anchors?.[name], box = reference?.headBox;
    if (head && from && box) anchors[name] = { x: round(head.x + ((from.x - box.x) / box.width) * head.width), y: round(head.y + ((from.y - box.y) / box.height) * head.height), measured: false };
    else if (from) anchors[name] = { x: from.x, y: from.y, measured: false };
    else anchors[name] = { x: 0, y: 0, measured: false };
  }
  return {
    headBox: head,
    centerX: head ? round(head.x + head.width / 2) : null,
    eyeLine: anchors.eyes ? anchors.eyes.y : null,
    scaleReference: head && reference?.headBox ? round(head.width / reference.headBox.width) : 1,
    anchors,
    boxes: Object.fromEntries(Object.keys(LAYOUT_ROLES).map((name) => [name, usable(boxes[name]) ? { ...boxes[name] } : null]))
  };
}

/** The template face's own layout: the frame every asset is drawn in. */
export const TEMPLATE_FACE_LAYOUT = Object.freeze((() => {
  // Built with no reference: every anchor is measured, nothing falls back.
  const measured = anchorsFromBoxes(TEMPLATE_ROLE_BOXES);
  const anchors = Object.fromEntries(FACE_MOUNT_POINTS.map((name) => [name, Object.freeze({ x: round(measured[name].x), y: round(measured[name].y), measured: true })]));
  const head = { ...TEMPLATE_ROLE_BOXES.head };
  return { headBox: Object.freeze(head), centerX: round(head.x + head.width / 2), eyeLine: anchors.eyes.y, scaleReference: 1, anchors: Object.freeze(anchors), boxes: TEMPLATE_ROLE_BOXES };
})());

/**
 * The layout context of a mascot (roadmap phase 5).
 *
 * @param {object} document a ProjectDocument
 * @param {(id: string) => ({x,y,width,height}|null)} measure the canvas's measure
 * @param {{ mountPoint?: string|null }} [options] the group new artwork is drawn into
 */
export const createFaceLayoutContext = (document, measure, options = {}) => layoutFromBoxes(faceRoleBoxes(document, measure, options));

/**
 * The layout, with the anchor of a part that came from the library carried
 * through the root that part left behind.
 *
 * A measured anchor is the centre of what is drawn, and a library mouth is
 * drawn a little below the template's own anchor; replacing it again from
 * that centre would put the next mouth a little lower still. Instead the old
 * root's own centre -- its pivot, which a turn or a resize leaves where it
 * is -- is carried into the face, and the offset that asset was drawn at is
 * taken back off at the face's scale: the anchor the last fit aimed at, so a
 * part replaced ten times stays where the first one went, and one the author
 * moved stays moved.
 *
 * @param {object} layout from {@link createFaceLayoutContext}
 * @param {object} document
 * @param {{ rootId: string, mountPoint: string, parentId?: string|null }} root the old asset root and the anchor it was fitted to
 */
export function layoutThroughRoot(layout, document, { rootId, mountPoint, parentId = null, scaleReference = null, template = TEMPLATE_FACE_LAYOUT } = {}) {
  const from = template.anchors[mountPoint];
  const root = document?.elements?.[rootId]?.baseTransform;
  if (!layout?.headBox || !from || !root) return layout;
  const pivot = { x: finite(root.pivotX, from.x), y: finite(root.pivotY, from.y) };
  const at = pointInMountSpace(document, rootId, pivot, parentId);
  // The face's scale: measured, or carried in -- the head is what the scale
  // is measured from, so replacing the head, the reference is the scale the
  // old one was fitted at, not its own skull's width, or a narrow skull
  // would narrow the next head a little at every replacement.
  const scale = Number(scaleReference) > 0 ? Number(scaleReference) : layout.scaleReference > 0 ? layout.scaleReference : 1;
  const anchor = { x: at.x - (pivot.x - from.x) * scale, y: at.y - (pivot.y - from.y) * scale };
  return { ...layout, scaleReference: round(scale), anchors: { ...layout.anchors, [mountPoint]: { x: round(anchor.x), y: round(anchor.y), measured: true } } };
}

/** Which layout role reads a part's role, so what is measured for the layout can be found from the rig's own names. */
export const layoutRoleFor = (part, role) => Object.entries(LAYOUT_ROLES).find(([, [type, name]]) => type === part && name === role)?.[0] || null;

/**
 * The layout with a hosted asset's mount point put on its host's own box.
 *
 * A pair's anchor needs both sides -- `ear.left` is read from the two ears
 * together, because one ear's box would put a pair over one ear -- and a face
 * with one ear has no `ear.left` to measure at all, only the proportional
 * place the template keeps it. An asset that *hangs on* an ear has named which
 * ear it hangs on, so that ear is the anchor whether or not the face has the
 * other one, and a host the layout does not measure (an accessory on an
 * accessory) leaves the anchor as it was.
 *
 * @param {object} layout from {@link createFaceLayoutContext}
 * @param {{ part: string, role: string }|null} host what the asset says it hangs on
 * @param {string} mountPoint the anchor the asset is fitted to
 * @param {object} [boxes] the measured boxes, when the layout in hand was rebuilt without them
 */
export function layoutOnHost(layout, host, mountPoint, boxes = layout?.boxes) {
  const name = layoutRoleFor(host?.part, host?.role);
  const box = name ? boxes?.[name] : null;
  if (!layout || !mountPoint || !usable(box)) return layout;
  const at = centre(box);
  return { ...layout, anchors: { ...layout.anchors, [mountPoint]: { x: round(at.x), y: round(at.y), measured: true } } };
}

/**
 * Where an asset goes on this face, as the base transform of its root
 * (roadmap phase 6).
 *
 * One similarity: the size of this head over the template's, and the
 * asset's reference box centred where the mount point is, keeping the
 * offset the asset was drawn at from the template's own anchor (a nose drawn
 * a little above the anchor stays a little above it, in proportion). The
 * pivot is the reference box's centre, so scaling about it keeps the centre
 * put and the translation is the plain difference of centres. A face with no
 * head to measure gets nothing fitted: the asset lands where it was drawn,
 * which on the template's artboard is the right place.
 *
 * @param {object} asset a normalised asset: referenceBox, mountPoint
 * @param {object} layout from {@link createFaceLayoutContext}
 * @returns {{ x, y, rotation, scaleX, scaleY, pivotX, pivotY, mountPoint, anchor }|null}
 */
export function fitFacePart(asset, layout, { template = TEMPLATE_FACE_LAYOUT } = {}) {
  const box = asset?.referenceBox;
  if (!layout?.headBox || !usable(box)) return null;
  const name = asset.mountPoint && layout.anchors[asset.mountPoint] ? asset.mountPoint : 'head.center';
  const to = layout.anchors[name], from = template.anchors[name];
  if (!to || !from) return null;
  const scale = layout.scaleReference > 0 ? layout.scaleReference : 1;
  const pivot = centre(box);
  const target = { x: to.x + (pivot.x - from.x) * scale, y: to.y + (pivot.y - from.y) * scale };
  return {
    x: round(target.x - pivot.x), y: round(target.y - pivot.y), rotation: 0, scaleX: round(scale), scaleY: round(scale),
    pivotX: round(pivot.x), pivotY: round(pivot.y), mountPoint: name, anchor: { x: to.x, y: to.y, measured: to.measured }
  };
}

/**
 * The fit with the author's adjustments to the old part on top: a mouth
 * turned a little and made a little bigger stays so on the new mouth.
 *
 * A fit already lands the part where the old one was -- its anchor is the
 * old part's place, moves included -- so only the turn and the size are
 * taken from the old transform. With nothing to fit to, the old transform is
 * put back whole, moves and all.
 *
 * @param {object|null} fit from {@link fitFacePart}
 * @param {object|null} previous the old root's base transform, its size relative to its own fit: x, y, rotation, scaleX, scaleY
 */
export function composeFit(fit, previous) {
  if (!fit) return previous ? { x: round(finite(previous.x, 0)), y: round(finite(previous.y, 0)), rotation: round(finite(previous.rotation, 0)), scaleX: round(finite(previous.scaleX, 1)), scaleY: round(finite(previous.scaleY, 1)) } : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  return {
    x: fit.x, y: fit.y, rotation: round(finite(previous?.rotation, 0)),
    scaleX: round(fit.scaleX * finite(previous?.scaleX, 1)), scaleY: round(fit.scaleY * finite(previous?.scaleY, 1))
  };
}
