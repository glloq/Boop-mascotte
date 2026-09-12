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
import { elementSpan, hostedRoots, shapeSignature } from './face-part-artwork.js';
import { composeFit } from './face-layout.js';
import { createShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { IDENTITY_MATRIX, multiplyMatrix, transformToMatrix } from '../../../runtime/transform-2d.js';

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
 * What an asset hangs on, on this face (docs/FACE_PART_LIBRARY.md, "Hosted on
 * a part"): the part that plays the host's role, and the shape that plays it.
 *
 * A host that is a group is a *parent*: the artwork is drawn inside it and
 * the host's every movement composes onto it for nothing. One that is a lone
 * shape has no inside, and the part follows it with a constraint instead. A
 * face that has not got the part at all hosts nothing, and the accessory is
 * fitted to its mount point and left there, as it always was.
 */
function resolveHost(document, host) {
  if (!host?.part || !host.role) return null;
  const part = partOfType(document, host.part);
  const elementId = part?.roles?.[host.role] || null;
  const element = elementId ? document.elements?.[elementId] : null;
  if (!part || !element) return null;
  return { partId: part.id, role: host.role, elementId, group: element.meta?.nodeType === 'g' };
}

/**
 * Which slot of a *multiple* category a part occupies: where it mounts, and
 * what it hangs on.
 *
 * The mount point alone stopped being the answer as soon as a drawing could
 * name a host, because two accessories can be fitted to the same anchor and
 * still be two things -- one on each ear -- and replacing either would take
 * the other off.
 */
const hostKey = (host) => `${host?.partId || ''}.${host?.role || ''}`;

/**
 * The parts hosted on the one about to be replaced.
 *
 * A hosted accessory is drawn inside its host, so replacing the host would
 * carry it off -- which is what "drawn around other parts" refuses for
 * anything else. Here there is somewhere for it to go: the new drawing plays
 * the same role, so the accessory is lifted out of what goes and re-homed onto
 * it. One that hangs on a role the new drawing does not play has nothing to be
 * re-homed onto, and is left to that refusal.
 */
function hostedOn(document, part, asset, map, removeIds) {
  if (!part) return [];
  const guests = [];
  for (const guest of Object.values(document.semanticParts || {})) {
    if (!guest || guest.id === part.id || guest.assetHost?.partId !== part.id) continue;
    const role = guest.assetHost.role;
    if (!asset.roles?.[role]) continue;
    const rootId = guest.assetRoot && document.elements?.[guest.assetRoot] ? guest.assetRoot : null;
    guests.push({ partId: guest.id, role, rootId, ids: rootId && removeIds.includes(rootId) ? subtreeIds(map, rootId) : [] });
  }
  return guests;
}

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
 * Where it lands is the group the old part sat in, unless the asset hangs on a
 * part: then it lands *inside* the host, and anything already hanging on the
 * part being replaced is lifted across onto the new drawing rather than going
 * with the old one.
 *
 * @returns {{ ok: true, category, definition, partId: string|null, removeIds: string[], mountPoint: string|null, before: string|null, host: object|null, rehome: object[], previousRoot: string|null, previousTransform: object|null } | { ok: false, reason: string }}
 */
export function planFacePartReplacement(document = {}, categoryId, asset) {
  const category = facePartCategory(categoryId);
  if (!category) return refuse(`Unknown category "${categoryId}".`);
  if (!category.installable) return refuse(`${category.label} has no semantic part yet, so nothing can be installed there.`);
  if (!asset || asset.category !== category.id) return refuse(`"${asset?.id || '?'}" is not a ${category.label.toLowerCase()} asset.`);
  if (!document.svgMarkup) return refuse('Start from a face, or import artwork, before choosing a part.');
  const definition = SEMANTIC_PART_REGISTRY[category.part];
  const elements = document.elements || {};
  const host = resolveHost(document, asset.host);
  // A face wears one of most parts, and several accessories: for a category
  // that is *multiple*, the part to replace is the one in this asset's slot --
  // its mount point and the part it hangs on. A second pair of glasses
  // replaces the first, a hat joins them, and the earring on the right ear
  // joins the one on the left rather than taking it off.
  const part = category.multiple
    ? Object.values(document.semanticParts || {}).find((item) => item?.type === category.part && item.assetMount === asset.mountPoint && hostKey(item.assetHost) === hostKey(host)) || null
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
  const cut = [...new Set(outer.flatMap((id) => subtreeIds(map, id)))];
  // Somebody else's drawing may be inside what goes: an accessory hosted on
  // this part hangs in its group. It is not this part's to take away, so it
  // leaves the removal -- the swap lifts it across onto the new shape that
  // plays the same role -- and the refusal below is not about it.
  const rehome = hostedOn(document, part, asset, map, cut);
  const lifted = new Set(rehome.flatMap((guest) => guest.ids));
  const removeIds = cut.filter((id) => !lifted.has(id));
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
  // Where the new drawing lands: inside the host when the asset hangs on one
  // and the host is a group, else the group the old part sat in.
  const mountPoint = host?.group ? host.elementId : (first ? first.parent : (featureMountPoint(document) ?? null));
  // Painted where the old part was: behind the sibling that followed it. A
  // part that has just been given a host is not where it was, so it has no
  // sibling there to follow, and goes last inside the host.
  let before = null;
  const siblingsOf = (parent) => (parent ? map.get(parent)?.item.children || [] : document.layers || []);
  if (first && first.parent === mountPoint) {
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
    ok: true, category, definition, partId: part?.id || null, removeIds, mountPoint, before, behind, host, rehome, previousRoot: primary, previousFitted: Boolean(fitted), skull,
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
 * @param {(part: object, candidate: object) => (object|null)} [options.fitHosted] where a re-homed accessory goes on the
 *   drawing it has just been hung on; it reads the library, which this file does not
 */
export function applyFacePartReplacement(candidate, plan, { asset, artwork, renamed = {}, ids = null, measure = () => null, fit = null, fitHosted = () => null } = {}) {
  if (!plan?.ok) throw new Error(plan?.reason || 'Nothing planned.');
  const { category, definition } = plan;
  const previous = { hadMouthRig: hasMouthRig(candidate), hadBrowRig: hasBrowRig(candidate), hadTurn: (candidate.keyforms || []).some(isHeadPoseKeyform) };
  // What the head was drawing, before its drawing can go: a clip cut from it is
  // recognised by it (`followHeadClips`).
  const wasDrawing = pathDataOf(candidate.svgMarkup, headOutline(candidate));
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
  // And a part that *hangs on* this one is re-homed the same way: its drawing
  // was lifted into the new shape playing the role it hangs on, so what held
  // it to the old shape is written again against the new one. Nothing would
  // have survived otherwise -- a constraint is scrubbed with its source as
  // readily as with its target, which is why replacing the ears used to sever
  // an earring in silence.
  const rehomed = [];
  for (const guest of plan.rehome || []) {
    const other = candidate.semanticParts[guest.partId];
    const onto = roleElements[guest.role];
    if (!other || !onto || !candidate.elements[onto]) continue;
    other.assetHost = { partId: part.id, role: guest.role };
    refitHosted(candidate, other, fitHosted(other, candidate));
    hostArtwork(candidate, other, other.assetRoot, onto);
    rehomed.push({ partId: other.id, role: guest.role, host: onto });
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
  // And the head's own outline, wherever it is copied: the shading and the
  // fringe are cut to a copy of it, and a copy nobody writes to is the head
  // that has gone (`followHeadClips`). Read the same way before and after, so
  // a replacement that leaves the outline alone rewrites nothing.
  const outline = headOutline(candidate);
  if (outline && wasDrawing) {
    candidate.svgMarkup = followHeadClips(candidate.svgMarkup, {
      from: wasDrawing, to: pathDataOf(candidate.svgMarkup, outline), transform: transformInto(candidate, outline, rootId)
    });
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
  // What it hangs on, so replacing *that* knows to bring this along, and so
  // two accessories fitted to one anchor are two slots rather than one.
  if (plan.host) part.assetHost = { partId: plan.host.partId, role: plan.host.role }; else delete part.assetHost;
  hostArtwork(candidate, part, rootId, plan.host?.elementId || null);
  // The shapes as the install left them, so a reshape by hand can be told from
  // them -- without whatever hangs inside them, which is somebody else's.
  part.assetShape = shapeSignature(candidate.svgMarkup, [rootId, ...detached], { without: hostedRoots(candidate, part.id) });
  if (asset.depth !== null && asset.depth !== undefined) candidate.elements[rootId].depth = asset.depth;
  // The place and size the fit gave it, so the next replacement can tell the author's move and size from them.
  if (fit) part.assetFit = { x: fit.x, y: fit.y, scaleX: fit.scaleX, scaleY: fit.scaleY }; else delete part.assetFit;
  if (detached.length) part.assetDetached = [...detached]; else delete part.assetDetached;
  return { partId: part.id, rootId, ids: fragmentIds, roles: roleElements, parts: composite, detached, enabled, disabled, pinned, turned, fitted: Boolean(fit), skull: Boolean(plan.skull), rehomed, hosted: plan.host ? { partId: plan.host.partId, role: plan.host.role, element: plan.host.elementId, inside: plan.host.group } : null, removed: [...plan.removeIds] };
}

/**
 * What holds a part to its host.
 *
 * Inside a group there is nothing to hold: SVG composes the host's transform
 * onto everything drawn in it, which is why the install parents rather than
 * constrains -- no solver, no per-frame cost, and the wiggle, the head turn
 * and a follower's lag arrive together because they are one transform by the
 * time the runtime writes it. A host that is a lone shape has no inside, so
 * the part follows it with a `parent` constraint instead, offset by the
 * distance the two rest at: where it goes, which is all a constraint can
 * honestly copy of a shape that carries no children. A part that hangs on
 * nothing drops the constraint that said it did.
 */
function hostArtwork(candidate, part, rootId, hostElementId) {
  const id = `${part.id}-host`;
  const others = (candidate.rigConstraints || []).filter((item) => item?.id !== id);
  const host = hostElementId ? candidate.elements[hostElementId] : null;
  const root = rootId ? candidate.elements[rootId] : null;
  if (!host || !root || host.meta?.nodeType === 'g') { candidate.rigConstraints = others; return; }
  const from = host.baseTransform || {}, to = root.baseTransform || {};
  candidate.rigConstraints = [...others, { id, type: 'parent', target: rootId, source: hostElementId, offset: { x: round((Number(to.x) || 0) - (Number(from.x) || 0)), y: round((Number(to.y) || 0) - (Number(from.y) || 0)) } }];
}

/**
 * A re-homed part, fitted to the drawing it has just been hung on.
 *
 * Its numbers were in the old host's own frame -- an asset is drawn in the
 * template's 240 frame and the fit is what maps that onto this face, so an
 * earring fitted inside the template's ear carries the face's scale and one
 * fitted inside a library ear does not -- and moving the drawing between two
 * frames without re-reading them is how a part ends up at four times its size.
 * The author's turn and size ride on top, the old fit's size divided out, the
 * way a replacement keeps them.
 */
function refitHosted(candidate, part, fit) {
  const root = part.assetRoot ? candidate.elements[part.assetRoot] : null;
  if (!fit || !root) return;
  const was = root.baseTransform || {}, fitted = part.assetFit;
  const authored = (value, by) => round((Number.isFinite(Number(value)) ? Number(value) : 1) / (Number(by) || 1));
  Object.assign(root.baseTransform, { pivotX: fit.pivotX, pivotY: fit.pivotY }, composeFit(fit, { rotation: Number(was.rotation) || 0, scaleX: authored(was.scaleX, fitted?.scaleX), scaleY: authored(was.scaleY, fitted?.scaleY) }));
  part.assetFit = { x: fit.x, y: fit.y, scaleX: fit.scaleX, scaleY: fit.scaleY };
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
 *
 * Exported because the migration recovers the same answer for a project drawn
 * before any of this existed (`face-part-migration.js`), and one rule about
 * which roles keep a profile is better than two.
 */
export function recordTurnProfiles(part, turn) {
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
 * The outline the head is drawing: the shape the jaw moves, or the head itself
 * where the head is a shape rather than the whole face.
 *
 * One reading, asked before a replacement and after it, so what the clip below
 * follows is the same thing it was cut from.
 */
function headOutline(document) {
  const jaw = partOfType(document, 'jaw')?.roles?.jaw;
  if (jaw && document.elements?.[jaw]) return jaw;
  const head = partOfType(document, 'head')?.roles?.head;
  return head && document.elements?.[head]?.meta?.nodeType === 'path' ? head : null;
}

/**
 * Where a piece of the fragment sits in the group the fragment joined: its own
 * base transform under every one it was drawn inside, up to the root.
 *
 * A clip is read in the space of the piece it cuts (docs/MASCOT_TEMPLATE.md),
 * and the pieces the head's clip cuts are siblings of the root the fit placed
 * -- so an outline copied out of the fragment has to carry what the fit did to
 * it, or the clip is the right drawing in the wrong place.
 */
function transformInto(candidate, id, rootId) {
  const map = layerMap(candidate.layers);
  let matrix = IDENTITY_MATRIX;
  for (let at = id; at; at = at === rootId ? null : map.get(at)?.parent) {
    const base = candidate.elements[at]?.baseTransform;
    if (base) matrix = multiplyMatrix(transformToMatrix(base), matrix);
  }
  return matrix.every((value, index) => Math.abs(value - IDENTITY_MATRIX[index]) < 1e-9)
    ? null : `matrix(${matrix.map((value) => round(value)).join(' ')})`;
}

/**
 * A clip drawn from the head follows the head.
 *
 * The template keeps a copy of its own outline in the definitions and cuts the
 * face shading and the fringe to it, so neither can show past the silhouette
 * (docs/MASCOT_TEMPLATE.md). Nothing ever wrote to that copy: a face wearing a
 * skull from the library was still cut to the head that had gone, so the
 * shading spilled over the new outline on one side and stopped short of it on
 * the other, and the fringe hung off it.
 *
 * What is recognised is the **drawing**, never an id: the clip that was the old
 * outline is the one that becomes the new one. So a clip the author renamed
 * still follows, two clips cut from the same head both follow, and a clip cut
 * from anything else is somebody's own decision and is left alone.
 *
 * @param {string} markup the document's markup, the definitions included
 * @param {{ from: string, to: string, transform: string|null }} outline the `d` that was the head's, the one that is, and where the new one sits
 */
export function followHeadClips(markup, { from, to, transform = null } = {}) {
  const text = String(markup || '');
  if (!from || !to) return text;
  const attribute = transform ? ` transform="${transform}"` : '';
  return text.replace(/<clipPath\b[^>]*>[\s\S]*?<\/clipPath>/g, (clip) => clip.replace(/<path\b[^>]*?(?:\/>|><\/path>)/g, (path) => {
    const drawn = /\sd\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(path);
    if ((drawn?.[1] ?? drawn?.[2]) !== from) return path;
    // Everything else the clip's path says is the author's and stays; the
    // outline and where it sits are what this owns.
    const kept = path.replace(/\s(?:d|transform)\s*=\s*(?:"[^"]*"|'[^']*')/g, '').replace(/\s*\/?>(?:<\/path>)?$/, '');
    return `${kept} d="${to}"${attribute} />`;
  }));
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
 * What hangs on it comes off with it. A part whose drawing has gone is not a
 * part, and a hosted accessory's drawing is inside its host's.
 *
 * @returns {{ ok: true, partId, category, removeIds: string[], hosted: string[] } | { ok: false, reason: string }}
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
  const removeIds = [...new Set(outer.flatMap((id) => subtreeIds(map, id)))];
  const hosted = Object.values(document.semanticParts || {})
    .filter((item) => item?.assetHost?.partId === partId && item.id !== partId && item.assetRoot && removeIds.includes(item.assetRoot))
    .map((item) => item.id);
  return { ok: true, partId, category, removeIds, hosted };
}

/** The document after the canvas took the part's artwork out: references scrubbed, the part and what hung on it gone. */
export function applyFacePartRemoval(candidate, plan, { artwork } = {}) {
  if (!plan?.ok) throw new Error(plan?.reason || 'Nothing planned.');
  scrubRemovedArtwork(candidate, plan.removeIds);
  takeArtwork(candidate, artwork);
  for (const partId of [plan.partId, ...(plan.hosted || [])]) if (candidate.semanticParts[partId]) removeSemanticPart(candidate, partId);
  return { partId: plan.partId, hosted: [...(plan.hosted || [])], removed: [...plan.removeIds] };
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
