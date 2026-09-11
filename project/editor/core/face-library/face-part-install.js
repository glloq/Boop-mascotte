/**
 * Putting a library asset onto a mascot (docs/FACE_PART_LIBRARY.md,
 * "Installing"; roadmap phase 4).
 *
 * Replacing a part is one command with three halves, and this file is the
 * pure two of them: the *plan* (what goes, where the new artwork lands, and
 * whether it may happen at all) and the *application* (the document after
 * the canvas has swapped the drawing: roles reassigned, movements kept,
 * pivots set, the turn and the pins regenerated). The third half, the
 * canvas swapping the drawing, is `canvas.replaceArtwork`, and the command
 * that holds all three to one undo step is `face-part-commands.js`.
 *
 * The rule the whole thing serves: **changing a mouth never takes `smile`
 * away.** The movements a part had stay enabled wherever the new drawing can
 * carry them, on fresh transform drivers; the ones it cannot carry are
 * switched off the ordinary way, and a parameter an expression or a clip
 * still names is kept. Everything that pointed at the old artwork -- a shape
 * key, a pose cell, a pin, a hold -- goes with it, because a reference to a
 * shape that is not there is worse than none.
 */
import { SEMANTIC_PART_REGISTRY, semanticDriverProperties } from '../../rig-editor/semantic-parts/part-registry.js';
import { assignSemanticRole, createSemanticPart, disableSemanticControl, enableSemanticControl, removeSemanticPart, resetSemanticMorph, restingOffset } from '../../rig-editor/semantic-parts/part-model.js';
import { featureMountPoint } from '../sample/face-features.js';
import { captureHeadPose, createHeadPoseAxes, isHeadPoseKeyform } from '../head-pose/head-pose-model.js';
import { generateHeadTurn, headTurnElements } from '../head-pose/head-pose-turn.js';
import { enableMouthRig, hasMouthRig, withoutMouthRig } from '../rig/mouth-rig.js';
import { enableBrowRig, hasBrowRig, withoutBrowRig } from '../rig/brow-rig.js';
import { FACE_PART_CATEGORIES, artworkIds, describeFacePartCapabilities, facePartCategory } from './face-part-model.js';
import { elementSpan, shapeSignature } from './face-part-artwork.js';
import { composeFit } from './face-layout.js';
import { createShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';

/** What a replacement writes, and the domains that notify for it. */
export const FACE_PART_FIELDS = Object.freeze(['svgMarkup', 'elements', 'layers', 'layerMetadata', 'semanticParts', 'params', 'states', 'shapeKeys', 'keyforms', 'warps', 'rigPins', 'rigConstraints', 'rigAttachments', 'rigHolds', 'rigHandles', 'followers']);
export const FACE_PART_DOMAINS = Object.freeze(['artwork', 'layers', 'semanticRig', 'rig', 'stateMachine', 'keyforms', 'constraints', 'rigHandles', 'hierarchy']);

/**
 * How a drawing carries a movement the registry only knows as a shape.
 *
 * Teeth and a tongue are shape keys on the template: bands drawn out of the
 * lip curves. A library mouth *draws* its teeth, so the movement is whether
 * they show -- an opacity, from hidden to drawn -- and nothing has to be
 * captured for the control to do something on day one.
 */
const DRAWN_DRIVERS = Object.freeze({
  teeth: Object.freeze({ property: 'opacity', amplitude: 1, offset: 0 }),
  tongue: Object.freeze({ property: 'opacity', amplitude: 1, offset: 0 })
});

const round = (value) => Math.round(Number(value) * 1000) / 1000;
const refuse = (reason) => ({ ok: false, reason });
const FACE_PART_CATEGORIES_BY_PART = Object.fromEntries(FACE_PART_CATEGORIES.filter((category) => category.part).map((category) => [category.part, category]));

function layerMap(layers = []) {
  const map = new Map();
  const visit = (items, parent) => { for (const item of items || []) { map.set(item.id, { item, parent }); visit(item.children, item.id); } };
  visit(layers, null);
  return map;
}

function subtreeIds(map, id) {
  const entry = map.get(id);
  if (!entry) return [id];
  const out = [];
  const visit = (item) => { out.push(item.id); for (const child of item.children || []) visit(child); };
  visit(entry.item);
  return out;
}

const isInside = (map, ancestorId, id) => { for (let at = map.get(id)?.parent; at; at = map.get(at)?.parent) if (at === ancestorId) return true; return false; };

/**
 * Empty shells go with what they held: the template's fringe sits alone in
 * a group of its own, clipped to the skull, and a group left with nothing
 * inside it is not a layer anyone wants. A group that plays a role, or
 * holds anything else, stays.
 */
function withShells(map, document, ids) {
  const set = new Set(ids);
  const roles = new Set(Object.values(document.semanticParts || {}).flatMap((part) => Object.values(part?.roles || {})));
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...set]) {
      const parent = map.get(id)?.parent;
      const entry = parent ? map.get(parent) : null;
      if (!entry || set.has(parent) || roles.has(parent) || entry.item.type !== 'g') continue;
      if (entry.item.children.every((child) => set.has(child.id))) { set.add(parent); grew = true; }
    }
  }
  return [...set];
}

const partOfType = (document, type) => Object.values(document?.semanticParts || {}).find((part) => part?.type === type) || null;

/**
 * What replacing a category's part would do, or why it cannot be done.
 *
 * What goes is the root the last installed asset left, or else the pieces the
 * part's roles name, each with everything drawn inside it. A part drawn
 * *around* other parts -- the template's head is the group every feature sits
 * in, its eyes are the groups the pupils and the lids sit in -- is refused
 * rather than taking those with it; that is what a head or an eyes asset has
 * to solve before it exists.
 *
 * @returns {{ ok: true, category, definition, partId: string|null, removeIds: string[], mountPoint: string|null, before: string|null, previousRoot: string|null, previousTransform: object|null } | { ok: false, reason: string }}
 */
export function planFacePartReplacement(document = {}, categoryId, asset) {
  const category = facePartCategory(categoryId);
  if (!category) return refuse(`Unknown category "${categoryId}".`);
  if (!category.installable) return refuse(`${category.label} has no semantic part yet, so nothing can be installed there.`);
  if (!asset || asset.category !== category.id) return refuse(`"${asset?.id || '?'}" is not a ${category.label.toLowerCase()} asset.`);
  if (!document.svgMarkup) return refuse('Start from a face, or import artwork, before choosing a part.');
  const definition = SEMANTIC_PART_REGISTRY[category.part];
  const elements = document.elements || {};
  // A face wears one of most parts, and several accessories: for a category
  // that is *multiple*, the part to replace is the one at this asset's mount
  // point -- a second pair of glasses replaces the first, a hat joins them.
  const part = category.multiple
    ? Object.values(document.semanticParts || {}).find((item) => item?.type === category.part && item.assetMount === asset.mountPoint) || null
    : partOfType(document, category.part);
  const map = layerMap(document.layers);
  // What goes: the root the last install left, with the pieces it painted
  // behind the face (they sit outside it), or else every role of the part.
  const roleIds = part ? [...new Set(Object.values(part.roles || {}).filter((id) => elements[id]))] : [];
  // A piece the last install painted behind the face goes with the root whether or not it plays a role.
  let named = part ? (part.assetRoot && elements[part.assetRoot] ? [part.assetRoot, ...(part.assetDetached || []).filter((id) => id !== part.assetRoot && elements[id] && !isInside(map, part.assetRoot, id))] : roleIds) : [];
  // The head that turns can be the whole face -- the template's is the group
  // every feature sits in -- and a head asset is a skull, not a face. On such
  // a face the skull is what goes: the shape the jaw moves, inside the group
  // that keeps turning. `skull` tells the application to put the asset's head
  // on the jaw and leave the head part alone.
  let skull = false;
  if (category.id === 'head' && part) {
    const head = part.roles?.head, installed = part.assetRoot && elements[part.assetRoot] ? part.assetRoot : null;
    if (head && elements[head]?.meta?.nodeType === 'g' && installed !== head) {
      skull = true;
      if (!installed) {
        const jawShape = partOfType(document, 'jaw')?.roles?.jaw;
        if (!jawShape || !elements[jawShape] || !isInside(map, head, jawShape)) return refuse('Head is the whole face here, and it has no skull of its own to replace: give the jaw its shape in Face Setup first.');
        named = [jawShape];
      }
    }
  }
  // Only the outermost of them, shells included: a role drawn inside another
  // role goes with it, and a group left empty goes with its last piece.
  const shelled = withShells(map, document, named);
  const outer = shelled.filter((id) => !shelled.some((other) => other !== id && isInside(map, other, id)));
  const removeIds = [...new Set(outer.flatMap((id) => subtreeIds(map, id)))];
  const own = new Set(Object.values(part?.roles || {}));
  // The parts the asset draws itself may go with the old artwork: their new
  // shapes are in the fragment. The skull carries the jaw the same way.
  const covered = new Set([...Object.keys(asset.parts || {}), ...(skull ? ['jaw'] : [])]);
  const carried = [];
  for (const other of Object.values(document.semanticParts || {})) {
    if (other === part || covered.has(other.type)) continue;
    for (const [role, id] of Object.entries(other.roles || {})) if (removeIds.includes(id) && !own.has(id)) carried.push(`${other.name || other.type} (${role})`);
  }
  for (const side of ['left', 'right']) { const hand = document.hands?.[side]?.element; if (hand && removeIds.includes(hand)) carried.push(`the ${side} hand`); }
  if (carried.length) return refuse(`${category.label} is drawn around other parts (${carried.join(', ')}): replacing it would take them away too.`);
  const primary = part ? (part.assetRoot && elements[part.assetRoot] ? part.assetRoot : skull ? outer[0] : part.roles?.[category.required[0]] || outer[0] || null) : null;
  const first = outer[0] ? map.get(outer[0]) : null;
  const mountPoint = first ? first.parent : (featureMountPoint(document) ?? null);
  // Painted where the old part was: behind the sibling that followed it.
  let before = null;
  const siblingsOf = (parent) => (parent ? map.get(parent)?.item.children || [] : document.layers || []);
  if (first) {
    const siblings = siblingsOf(first.parent);
    const last = Math.max(...outer.map((id) => siblings.findIndex((item) => item.id === id)));
    before = siblings.slice(last + 1).find((item) => !removeIds.includes(item.id))?.id || null;
  }
  // Pieces the asset paints behind the face go to the front of the same
  // group: where the old part's own back piece was, or else first of all.
  let behind = null;
  if (asset.behind?.length) {
    const oldBack = part?.roles?.hairBack && removeIds.includes(part.roles.hairBack) ? part.roles.hairBack : null;
    const backParent = oldBack ? map.get(oldBack)?.parent : mountPoint;
    const siblings = siblingsOf(backParent);
    const from = oldBack ? siblings.findIndex((item) => item.id === oldBack) + 1 : 0;
    behind = { ids: [...asset.behind], before: siblings.slice(from).find((item) => !removeIds.includes(item.id))?.id || null };
  }
  const transform = primary && elements[primary]?.baseTransform ? elements[primary].baseTransform : null;
  // The author's own size, without the size the last fit gave the part.
  const fitted = part?.assetRoot && primary === part.assetRoot ? part.assetFit : null;
  const authored = (value, fit) => { const scale = Number.isFinite(Number(value)) ? Number(value) : 1; const by = Number(fit) || 1; return Math.round((scale / by) * 1000) / 1000; };
  return {
    ok: true, category, definition, partId: part?.id || null, removeIds, mountPoint, before, behind, previousRoot: primary, previousFitted: Boolean(fitted), skull,
    previousTransform: transform ? { x: Number(transform.x) || 0, y: Number(transform.y) || 0, rotation: Number(transform.rotation) || 0, scaleX: authored(transform.scaleX, fitted?.scaleX), scaleY: authored(transform.scaleY, fitted?.scaleY) } : null
  };
}

/**
 * Take every reference to artwork that is gone out of the document.
 *
 * @returns {{ partId: string, role: string }[]} the roles that were cleared, so a new drawing can take them up
 */
export function scrubRemovedArtwork(document, removedIds = []) {
  const removed = new Set(removedIds);
  const cleared = [];
  for (const part of Object.values(document.semanticParts || {})) {
    for (const [role, id] of Object.entries(part.roles || {})) if (removed.has(id)) { assignSemanticRole(document, part.id, role, null); cleared.push({ partId: part.id, role }); }
  }
  for (const [id, element] of Object.entries(document.elements || {})) {
    if (removed.has(id)) delete document.elements[id];
    else if (element?.symmetryPeer && removed.has(element.symmetryPeer)) element.symmetryPeer = null;
  }
  document.shapeKeys = (document.shapeKeys || []).filter((key) => !removed.has(key?.target));
  document.keyforms = (document.keyforms || []).filter((keyform) => !removed.has(keyform?.target?.id));
  document.warps = (document.warps || []).filter((warp) => !removed.has(warp?.target));
  document.rigPins = (document.rigPins || []).filter((pin) => !removed.has(pin?.target));
  document.rigConstraints = (document.rigConstraints || []).filter((constraint) => !removed.has(constraint?.target) && !removed.has(constraint?.source));
  const attachments = document.rigAttachments || [];
  const gone = new Set(attachments.filter((item) => removed.has(item?.target)).map((item) => item.id));
  document.rigAttachments = attachments.filter((item) => !gone.has(item.id));
  document.rigHolds = (document.rigHolds || []).filter((hold) => !gone.has(hold?.hold) && !gone.has(hold?.to));
  document.rigHandles = (document.rigHandles || [])
    .map((handle) => (Array.isArray(handle?.elements) ? { ...handle, elements: handle.elements.filter((id) => !removed.has(id)) } : handle))
    .filter((handle) => !(handle?.authored && Array.isArray(handle.elements) && !handle.elements.length));
  document.followers = (document.followers || []).filter((follower) => !removed.has(follower?.element));
  return cleared;
}

/** Whether anything still names a parameter once its part let go of it. */
const namedElsewhere = (document, control) =>
  (document.expressions || []).some((expression) => control in (expression?.controls || {}))
  || (document.animationClips || []).some((clip) => control in (clip?.tracks || {}))
  || (document.behaviors || []).some((behavior) => behavior?.parameter === control);

/**
 * The document after the canvas swapped the drawing.
 *
 * @param {object} candidate a clone of the document before, to write into
 * @param {object} plan from {@link planFacePartReplacement}
 * @param {object} options
 * @param {object} options.asset the library asset
 * @param {object} options.artwork the canvas payload: svgMarkup, elements, layers, layerMetadata
 * @param {Record<string, string>} [options.renamed] the asset's ids that had to change
 * @param {string[]} options.ids the ids the fragment carries, renamed, root first
 * @param {(id: string) => ({x,y,width,height}|null)} [options.measure] the canvas's measure
 * @param {object|null} [options.fit] where the asset goes on this face, from `fitFacePart`; null lands it where it was drawn
 */
export function applyFacePartReplacement(candidate, plan, { asset, artwork, renamed = {}, ids = null, measure = () => null, fit = null } = {}) {
  if (!plan?.ok) throw new Error(plan?.reason || 'Nothing planned.');
  const { category, definition } = plan;
  const previous = { hadMouthRig: hasMouthRig(candidate), hadBrowRig: hasBrowRig(candidate), hadTurn: (candidate.keyforms || []).some(isHeadPoseKeyform) };
  // The old artwork goes first, references and all, and only then does the
  // new arrive: a new mouth is usually called `mouth` like the one it
  // replaces, and a scrub after the fact would take the new one with it.
  const cleared = scrubRemovedArtwork(candidate, plan.removeIds);
  takeArtwork(candidate, artwork);
  const fragmentIds = (ids || artworkIds(asset.artwork).map((id) => renamed[id] ?? id)).filter((id) => candidate.elements[id]);
  const rootId = fragmentIds[0];
  if (!rootId) throw new Error('The canvas drew nothing for this asset.');

  const part = plan.partId ? candidate.semanticParts[plan.partId] : createSemanticPart(candidate, category.part);
  const idOf = (elementId) => renamed[elementId] ?? elementId;
  const roleElements = {};
  const enabled = [], disabled = [];
  // The skull rule: the asset's head goes on the jaw, and the head part --
  // the face that turns -- keeps its roles and its movements untouched.
  const takes = plan.skull ? (Object.values(candidate.semanticParts).find((item) => item?.type === 'jaw') || createSemanticPart(candidate, 'jaw')) : part;
  if (plan.skull) {
    const skull = idOf(asset.roles.head);
    if (!candidate.elements[skull]) throw new Error(`The asset names "${asset.roles.head}" for its head, and the canvas did not draw it.`);
    assignSemanticRole(candidate, takes.id, 'jaw', skull);
    roleElements.head = skull;
    // A jaw with no movement left (a skull without a pose came before) claims what this drawing carries.
    refreshControls(candidate, takes, { wanted: [...(takes.controls || [])], supported: new Set(asset.parts?.jaw?.capabilities || []), hints: asset.parts?.jaw?.drivers || {}, enabled, disabled, fresh: !(takes.controls || []).length });
  } else {
    // A role the old drawing played goes; a role pointing at artwork that stays
    // on the canvas and the asset does not draw (a tongue drawn by hand under a
    // library mouth) stays with that artwork rather than leaving it orphaned.
    for (const [role, elementId] of Object.entries(part.roles || {})) if (role in asset.roles || !candidate.elements[elementId]) assignSemanticRole(candidate, part.id, role, null);
    for (const [role, elementId] of Object.entries(asset.roles)) {
      const id = idOf(elementId);
      if (!candidate.elements[id]) throw new Error(`The asset names "${elementId}" for its ${role}, and the canvas did not draw it.`);
      assignSemanticRole(candidate, part.id, role, id);
      roleElements[role] = id;
    }
    refreshControls(candidate, part, { wanted: plan.partId ? [...(part.controls || [])] : [], supported: new Set(describeFacePartCapabilities(asset).supported), hints: { ...DRAWN_DRIVERS, ...asset.drivers }, enabled, disabled, fresh: !plan.partId });
    recordTurnProfiles(part, asset.turn);
  }
  // The other parts the asset draws -- a pair of eyes with its pupils and its
  // lids -- take their roles on the new shapes, and keep their movements the
  // same way; a part the mascot has not got yet is made.
  const composite = {};
  for (const [type, drawn] of Object.entries(asset.parts || {})) {
    // Under the skull rule the jaw took the skull above; its movements are done.
    if (type === 'jaw' && plan.skull) continue;
    const other = Object.values(candidate.semanticParts).find((item) => item?.type === type) || createSemanticPart(candidate, type);
    const had = Boolean(plan.partId) && cleared.some((item) => item.partId === other.id);
    for (const [role, elementId] of Object.entries(drawn.roles)) {
      const id = idOf(elementId);
      if (!candidate.elements[id]) throw new Error(`The asset names "${elementId}" for the ${role} of ${SEMANTIC_PART_REGISTRY[type]?.displayName || type}, and the canvas did not draw it.`);
      assignSemanticRole(candidate, other.id, role, id);
    }
    refreshControls(candidate, other, { wanted: [...(other.controls || [])], supported: new Set(drawn.capabilities), hints: drawn.drivers || {}, enabled, disabled, fresh: !had && !other.controls?.length });
    recordTurnProfiles(other, drawn.turn);
    composite[type] = { partId: other.id, roles: Object.fromEntries(Object.entries(drawn.roles).map(([role, elementId]) => [role, idOf(elementId)])) };
  }
  // A skull that ships a jaw pose: the jaw part takes the skull, and the pose
  // becomes a shape key on it, driven as the template's own (`mouthOpen +
  // jawOpen`), so the mouth opening drops the chin too.
  const jawHint = asset.parts?.jaw?.drivers?.jawOpen;
  if (jawHint?.property === 'shapeKey' && roleElements.head) {
    const jaw = plan.skull ? takes : candidate.semanticParts[composite.jaw?.partId];
    if (jaw) {
      if (jaw.roles?.jaw !== roleElements.head) assignSemanticRole(candidate, jaw.id, 'jaw', roleElements.head);
      // The pose that cannot become a shape key (a skull that is not a path, a
      // pose that does not parse) leaves the movement off, not promised.
      if (jaw.controls.includes('jawOpen') && !installJawShapeKey(candidate, jaw, roleElements.head, jawHint)) {
        const at = enabled.indexOf('jawOpen');
        if (at >= 0) enabled.splice(at, 1);
        turnOff(candidate, jaw, 'jawOpen', disabled);
      }
      composite.jaw = { partId: jaw.id, roles: { jaw: roleElements.head } };
    }
  }
  // Another part that lost a role of the same name takes the new piece: the
  // tongue part follows the mouth's tongue, when the new mouth draws one.
  for (const { partId, role } of cleared) {
    const other = candidate.semanticParts[partId];
    if (partId !== part.id && !composite[other?.type] && roleElements[role] && other && SEMANTIC_PART_REGISTRY[other.type]?.roles.includes(role)) assignSemanticRole(candidate, partId, role, roleElements[role]);
  }

  // Every new piece turns and scales about its own middle.
  const centre = (id) => { const box = measure(id); return box && Number.isFinite(box.width) && box.width > 0 ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null; };
  for (const id of fragmentIds) { const at = centre(id); if (at) Object.assign(candidate.elements[id].baseTransform, { pivotX: round(at.x), pivotY: round(at.y) }); }
  // Fitted to this face (docs/FACE_PART_LIBRARY.md, "Layout and auto-fit"),
  // and where the author had put the old part on top of that. A piece
  // painted behind the face sits outside the root, so it takes the same
  // transform about the same pivot: the two move as one rigid drawing.
  const detached = (plan.behind?.ids || []).map((id) => renamed[id] ?? id).filter((id) => id !== rootId && candidate.elements[id]);
  const placed = composeFit(fit, plan.previousTransform);
  for (const id of [rootId, ...detached]) {
    const base = candidate.elements[id].baseTransform;
    if (fit) Object.assign(base, { pivotX: fit.pivotX, pivotY: fit.pivotY });
    else if (detached.includes(id)) Object.assign(base, { pivotX: candidate.elements[rootId].baseTransform.pivotX, pivotY: candidate.elements[rootId].baseTransform.pivotY });
    Object.assign(base, placed);
  }

  // The geometry the old artwork had been measured for, measured again.
  let pinned = false, turned = false;
  if (category.id === 'mouth' && previous.hadMouthRig) {
    const mouth = roleElements.mouth, box = mouth ? measure(mouth) : null;
    if (mouth && candidate.elements[mouth]?.meta?.nodeType === 'path' && box?.width) { enableMouthRig(candidate, { target: mouth, box }); pinned = true; } else candidate.rigPins = withoutMouthRig(candidate);
  }
  if (category.id === 'eyebrows' && previous.hadBrowRig) {
    const sides = { left: roleElements.leftBrow, right: roleElements.rightBrow };
    const boxes = Object.fromEntries(Object.entries(sides).map(([side, id]) => [side, id && candidate.elements[id]?.meta?.nodeType === 'path' ? measure(id) : null]));
    if (boxes.left?.width && boxes.right?.width) { enableBrowRig(candidate, { left: { target: sides.left, box: boxes.left }, right: { target: sides.right, box: boxes.right } }); pinned = true; } else candidate.rigPins = withoutBrowRig(candidate);
  }
  if (previous.hadTurn) {
    const sample = (candidate.keyforms || []).find(isHeadPoseKeyform);
    const axes = sample?.axes?.length === 2 ? createHeadPoseAxes({ x: sample.axes[0], y: sample.axes[1] }) : createHeadPoseAxes();
    const centers = {};
    for (const layer of headTurnElements(candidate)) { const at = centre(layer.elementId); if (at) centers[layer.elementId] = at; }
    const head = partOfType(candidate, 'head')?.roles?.head;
    const headWidth = head ? Number(measure(head)?.width) || null : null;
    const fresh = new Set(fragmentIds);
    const turn = generateHeadTurn(candidate, { axes, centers, headWidth });
    for (const entry of turn.cells) {
      const samples = Object.fromEntries(Object.entries(entry.samples || {}).filter(([id]) => fresh.has(id)));
      if (Object.keys(samples).length) { candidate.keyforms = captureHeadPose(candidate.keyforms || [], { axes, cell: entry.cell, samples }); turned = true; }
    }
  }

  part.assetId = asset.id;
  part.assetRoot = rootId;
  part.assetMount = asset.mountPoint;
  // The shapes as the install left them, so a reshape by hand can be told from them.
  part.assetShape = shapeSignature(candidate.svgMarkup, [rootId, ...detached]);
  if (asset.depth !== null && asset.depth !== undefined) candidate.elements[rootId].depth = asset.depth;
  // The place and size the fit gave it, so the next replacement can tell the author's move and size from them.
  if (fit) part.assetFit = { x: fit.x, y: fit.y, scaleX: fit.scaleX, scaleY: fit.scaleY }; else delete part.assetFit;
  if (detached.length) part.assetDetached = [...detached]; else delete part.assetDetached;
  return { partId: part.id, rootId, ids: fragmentIds, roles: roleElements, parts: composite, detached, enabled, disabled, pinned, turned, fitted: Boolean(fit), skull: Boolean(plan.skull), removed: [...plan.removeIds] };
}

/**
 * A part's movements after its shapes changed: kept where the new drawing
 * carries them, on drivers made for it; switched off where it does not.
 *
 * @param {object} candidate the document being written
 * @param {object} part the semantic part, its roles already on the new shapes
 * @param {object} options
 * @param {string[]} options.wanted the movements the part had; empty for a part that is new, which claims every movement its drawing carries
 * @param {Set<string>} options.supported the movements the asset claims for this part
 * @param {object} options.hints per control: how the drawing carries it, when the registry's default would not do
 * @param {string[]} options.enabled written to, in place
 * @param {string[]} options.disabled written to, in place
 * @param {boolean} options.fresh whether the part is new, or had no movements to keep
 */
function refreshControls(candidate, part, { wanted, supported, hints, enabled, disabled, fresh }) {
  const definition = SEMANTIC_PART_REGISTRY[part.type];
  for (const control of definition.controls) {
    const on = part.controls.includes(control);
    const claimed = supported.has(control) && (wanted.includes(control) || (fresh && !wanted.length));
    if (claimed) {
      // The old driver deformed a shape that is gone, or moved one; a fresh
      // driver moves the new one -- the registry's own, or the asset's where
      // it says how its drawing carries the movement (a lid drawn open
      // travels down; drawn teeth show by opacity, which no strategy knows).
      const hint = hints[control];
      if (on) resetSemanticMorph(candidate, part.id, control);
      enableSemanticControl(candidate, part.id, control, hint ? { property: hint.property, amplitude: hint.amplitude, offset: hint.offset ?? restOffset(definition, control, hint) } : {});
      if (hint) applyHint(candidate, part, control, hint);
      enabled.push(control);
    } else if (on) turnOff(candidate, part, control, disabled);
  }
}

/**
 * What the asset said about turning with the head, onto the part it dressed
 * (docs/HEAD_POSE_2_5D.md, "Which parts turn").
 *
 * Written whole, so the profiles of the asset this one replaces go with it:
 * an answer left over from the drawing before would be a turn nothing on the
 * face asked for. Only the roles the part actually took are kept.
 *
 * It is recorded here, beside the roles, rather than with the rest of the
 * asset's bookkeeping at the end, because a replacement regenerates the turn
 * in between: a profile that arrived after that would leave the new drawing
 * turning by the role table until something regenerated the grid again.
 */
function recordTurnProfiles(part, turn) {
  const profiles = Object.entries(turn || {}).filter(([role]) => part.roles?.[role]);
  if (profiles.length) part.assetTurn = structuredClone(Object.fromEntries(profiles)); else delete part.assetTurn;
}

/**
 * The offset a driver hint leaves out: the one that puts the drawing at rest
 * as drawn when the movement sits at its default (`restingOffset`). The
 * registry's own offset belongs to the registry's own property, and is not
 * the hinted property's, so the hint passes this one explicitly rather than
 * letting the registry's default through.
 *
 * The amplitude is asked for, not read off the hint: a side that travels its
 * own distance needs the offset *that* distance leaves, not the shared one's.
 */
function restOffset(definition, control, hint, amplitude = hint.amplitude) {
  const [property] = semanticDriverProperties(definition, control, { property: hint.property });
  return restingOffset(property, amplitude, definition?.parameters?.[control]?.default);
}

/**
 * A movement the drawing cannot carry goes off, but a parameter an
 * expression or a clip still names stays a parameter: the face keeps
 * meaning what it meant, it just has nothing to move here. The one way a
 * movement is turned off by an install, wherever the install decides it.
 */
function turnOff(candidate, part, control, disabled) {
  const keep = namedElsewhere(candidate, control) ? structuredClone(candidate.params?.[control]) : null;
  const poses = keep ? Object.fromEntries(Object.entries(candidate.states || {}).map(([name, pose]) => [name, pose?.[control]])) : null;
  disableSemanticControl(candidate, part.id, control);
  if (keep && !candidate.params?.[control]) {
    candidate.params[control] = keep;
    for (const [name, pose] of Object.entries(candidate.states || {})) if (pose && !(control in pose)) pose[control] = poses?.[name] ?? keep.default;
  }
  if (!disabled.includes(control)) disabled.push(control);
}

/** The `d` a path is drawn with, read off the document's markup. */
function pathDataOf(markup, id) {
  const span = elementSpan(markup || '', id);
  if (!span) return null;
  const tag = markup.slice(span.start, markup.indexOf('>', span.start) + 1);
  const found = /\sd\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(tag);
  return found ? (found[1] ?? found[2]) : null;
}

/**
 * The jaw pose an asset ships for its skull, as a shape key on the skull
 * (docs/SHAPE_KEYS.md), driven as the template's jaw is. The skull's rest
 * shape is what the markup draws; the pose is the asset's, drawn from the
 * same points, so the two share their outline structure.
 */
function installJawShapeKey(candidate, jaw, skull, hint) {
  const element = candidate.elements[skull];
  const rest = pathDataOf(candidate.svgMarkup, skull);
  if (!element || element.meta?.nodeType !== 'path' || !rest) return false;
  const shape = createShapeKey({
    id: `${skull}-jaw`, target: skull, name: 'Jaw', restPath: rest, posePath: hint.posePath,
    driver: { mode: 'expression', expression: 'mouthOpen + jawOpen', curve: 'linear', amplitude: 1, offset: 0 },
    generatedBy: { semanticPart: jaw.id, control: 'jawOpen' }
  });
  if (!shape.ok) return false;
  element.restPath = rest;
  candidate.shapeKeys = upsertShapeKey(candidate.shapeKeys || [], shape.shapeKey);
  return true;
}

/**
 * The asset's amplitude and offset on every binding a control writes, a
 * side's own where it says so.
 *
 * A side that gives its own amplitude and leaves the offset out gets the
 * offset that amplitude rests at, not the one the shared amplitude rested
 * at: an upper lid travelling -38 and a lower travelling +40 are both drawn
 * open, and both have to sit where they are drawn when the eye is open.
 */
function applyHint(candidate, part, control, hint) {
  const driver = part.controlDrivers?.[control];
  if (!driver || driver.method !== 'transform') return;
  const definition = SEMANTIC_PART_REGISTRY[part.type];
  for (const role of driver.roles || []) {
    const binding = candidate.elements[part.roles[role]]?.bindings?.[hint.property];
    if (!binding || binding.generatedBy?.semanticPart !== part.id) continue;
    const override = hint.roles?.[role];
    const amplitude = override?.amplitude ?? hint.amplitude;
    if (Number.isFinite(amplitude)) binding.amplitude = amplitude;
    const offset = override?.offset ?? hint.offset;
    binding.offset = Number.isFinite(offset) ? offset : restOffset(definition, control, hint, binding.amplitude);
  }
}

/**
 * What taking a library part off the face would do: the root it left, the
 * pieces it painted behind the face, and any group left empty by them.
 * Only a part that came from the library, in a category a face wears
 * several of, is taken off whole; anything else is edited in Face Setup.
 *
 * @returns {{ ok: true, partId, category, removeIds: string[] } | { ok: false, reason: string }}
 */
export function planFacePartRemoval(document = {}, partId) {
  const part = document.semanticParts?.[partId];
  if (!part) return refuse(`There is no part called "${partId}".`);
  const category = FACE_PART_CATEGORIES_BY_PART[part.type];
  if (!category?.multiple) return refuse(`${part.name || part.type} is not a part a face wears several of: take its artwork away in Artwork, or reassign it in Face Setup.`);
  const elements = document.elements || {};
  if (!(part.assetRoot && elements[part.assetRoot])) return refuse(`${part.name || part.type} did not come from the library: take its artwork away in Artwork.`);
  const map = layerMap(document.layers);
  const named = [part.assetRoot, ...(part.assetDetached || []).filter((id) => elements[id] && !isInside(map, part.assetRoot, id))];
  const shelled = withShells(map, document, named);
  const outer = shelled.filter((id) => !shelled.some((other) => other !== id && isInside(map, other, id)));
  return { ok: true, partId, category, removeIds: [...new Set(outer.flatMap((id) => subtreeIds(map, id)))] };
}

/** The document after the canvas took the part's artwork out: references scrubbed, the part gone. */
export function applyFacePartRemoval(candidate, plan, { artwork } = {}) {
  if (!plan?.ok) throw new Error(plan?.reason || 'Nothing planned.');
  scrubRemovedArtwork(candidate, plan.removeIds);
  takeArtwork(candidate, artwork);
  if (candidate.semanticParts[plan.partId]) removeSemanticPart(candidate, plan.partId);
  return { partId: plan.partId, removed: [...plan.removeIds] };
}

/**
 * The canvas's payload after a swap, taken into the candidate: the markup,
 * the layers and their metadata as the canvas has them, the element
 * records that went dropped and the ones that came added -- the one step
 * a replacement and a removal share.
 */
function takeArtwork(candidate, artwork) {
  Object.assign(candidate, structuredClone({ svgMarkup: artwork.svgMarkup, layers: artwork.layers, layerMetadata: artwork.layerMetadata }));
  for (const id of Object.keys(candidate.elements)) if (!artwork.elements[id]) delete candidate.elements[id];
  for (const [id, record] of Object.entries(artwork.elements)) if (!candidate.elements[id]) candidate.elements[id] = structuredClone(record);
}
