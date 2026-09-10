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
import { assignSemanticRole, createSemanticPart, disableSemanticControl, enableSemanticControl, resetSemanticMorph, setSemanticControlMethod } from '../../rig-editor/semantic-parts/part-model.js';
import { featureMountPoint } from '../sample/face-features.js';
import { captureHeadPose, createHeadPoseAxes, isHeadPoseKeyform } from '../head-pose/head-pose-model.js';
import { generateHeadTurn, headTurnElements } from '../head-pose/head-pose-turn.js';
import { enableMouthRig, hasMouthRig, withoutMouthRig } from '../rig/mouth-rig.js';
import { enableBrowRig, hasBrowRig, withoutBrowRig } from '../rig/brow-rig.js';
import { artworkIds, describeFacePartCapabilities, facePartCategory } from './face-part-model.js';
import { composeFit } from './face-layout.js';

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
  const part = partOfType(document, category.part);
  const map = layerMap(document.layers);
  const named = part ? (part.assetRoot && elements[part.assetRoot] ? [part.assetRoot] : [...new Set(Object.values(part.roles || {}).filter((id) => elements[id]))]) : [];
  // Only the outermost of them: a role drawn inside another role goes with it.
  const outer = named.filter((id) => !named.some((other) => other !== id && isInside(map, other, id)));
  const removeIds = [...new Set(outer.flatMap((id) => subtreeIds(map, id)))];
  const own = new Set(Object.values(part?.roles || {}));
  const carried = [];
  for (const other of Object.values(document.semanticParts || {})) {
    if (other === part) continue;
    for (const [role, id] of Object.entries(other.roles || {})) if (removeIds.includes(id) && !own.has(id)) carried.push(`${other.name || other.type} (${role})`);
  }
  for (const side of ['left', 'right']) { const hand = document.hands?.[side]?.element; if (hand && removeIds.includes(hand)) carried.push(`the ${side} hand`); }
  if (carried.length) return refuse(`${category.label} is drawn around other parts (${carried.join(', ')}): replacing it would take them away too.`);
  const primary = part ? (part.assetRoot && elements[part.assetRoot] ? part.assetRoot : part.roles?.[category.required[0]] || outer[0] || null) : null;
  const first = outer[0] ? map.get(outer[0]) : null;
  const mountPoint = first ? first.parent : (featureMountPoint(document) ?? null);
  // Painted where the old part was: behind the sibling that followed it.
  let before = null;
  if (first) {
    const siblings = first.parent ? map.get(first.parent).item.children : document.layers;
    const last = Math.max(...outer.map((id) => siblings.findIndex((item) => item.id === id)));
    before = siblings.slice(last + 1).find((item) => !removeIds.includes(item.id))?.id || null;
  }
  const transform = primary && elements[primary]?.baseTransform ? elements[primary].baseTransform : null;
  // The author's own size, without the size the last fit gave the part.
  const fitted = part?.assetRoot && primary === part.assetRoot ? part.assetFit : null;
  const authored = (value, fit) => { const scale = Number.isFinite(Number(value)) ? Number(value) : 1; const by = Number(fit) || 1; return Math.round((scale / by) * 1000) / 1000; };
  return {
    ok: true, category, definition, partId: part?.id || null, removeIds, mountPoint, before, previousRoot: primary, previousFitted: Boolean(fitted),
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
  Object.assign(candidate, structuredClone({ svgMarkup: artwork.svgMarkup, layers: artwork.layers, layerMetadata: artwork.layerMetadata }));
  for (const id of Object.keys(candidate.elements)) if (!artwork.elements[id]) delete candidate.elements[id];
  for (const [id, record] of Object.entries(artwork.elements)) if (!candidate.elements[id]) candidate.elements[id] = structuredClone(record);
  const fragmentIds = (ids || artworkIds(asset.artwork).map((id) => renamed[id] ?? id)).filter((id) => candidate.elements[id]);
  const rootId = fragmentIds[0];
  if (!rootId) throw new Error('The canvas drew nothing for this asset.');

  const part = plan.partId ? candidate.semanticParts[plan.partId] : createSemanticPart(candidate, category.part);
  const wanted = plan.partId ? [...(part.controls || [])] : [...asset.capabilities];
  for (const role of Object.keys(part.roles || {})) assignSemanticRole(candidate, part.id, role, null);
  const roleElements = {};
  for (const [role, elementId] of Object.entries(asset.roles)) {
    const id = renamed[elementId] ?? elementId;
    if (!candidate.elements[id]) throw new Error(`The asset names "${elementId}" for its ${role}, and the canvas did not draw it.`);
    assignSemanticRole(candidate, part.id, role, id);
    roleElements[role] = id;
  }
  // Another part that lost a role of the same name takes the new piece: the
  // tongue part follows the mouth's tongue, when the new mouth draws one.
  for (const { partId, role } of cleared) {
    const other = candidate.semanticParts[partId];
    if (partId !== part.id && roleElements[role] && other && SEMANTIC_PART_REGISTRY[other.type]?.roles.includes(role)) assignSemanticRole(candidate, partId, role, roleElements[role]);
  }

  const supported = new Set(describeFacePartCapabilities(asset).supported);
  const enabled = [], disabled = [];
  for (const control of definition.controls) {
    const on = part.controls.includes(control);
    if (wanted.includes(control) && supported.has(control)) {
      const drawn = DRAWN_DRIVERS[control];
      if (drawn) {
        // Off the registry's strategies on purpose (they only know a shape),
        // so it is written by hand: the driver, and one binding per role.
        if (on) resetSemanticMorph(candidate, part.id, control); else enableSemanticControl(candidate, part.id, control, drawn);
        const roles = Object.keys(definition.bindings || {}).filter((role) => definition.bindings[role][control]);
        part.controlDrivers[control] = { method: 'transform', property: drawn.property, roles };
        for (const role of roles) {
          const element = candidate.elements[part.roles[role]];
          if (element) (element.bindings ||= {})[drawn.property] = { enabled: true, mode: 'simple', expression: control, curve: 'linear', amplitude: drawn.amplitude, offset: drawn.offset, generatedBy: { semanticPart: part.id, control } };
        }
      } else if (on) {
        // The old driver deformed a shape that is gone; a fresh transform
        // driver moves the new one, with the registry's own amplitudes.
        resetSemanticMorph(candidate, part.id, control);
        setSemanticControlMethod(candidate, part.id, control, semanticDriverProperties(definition, control)[0]);
      } else enableSemanticControl(candidate, part.id, control);
      enabled.push(control);
    } else if (on) {
      const keep = namedElsewhere(candidate, control) ? structuredClone(candidate.params?.[control]) : null;
      const poses = keep ? Object.fromEntries(Object.entries(candidate.states || {}).map(([name, pose]) => [name, pose?.[control]])) : null;
      disableSemanticControl(candidate, part.id, control);
      // A movement the drawing cannot carry goes off, but a parameter an
      // expression or a clip still names stays a parameter: the face keeps
      // meaning what it meant, it just has nothing to move here.
      if (keep && !candidate.params?.[control]) {
        candidate.params[control] = keep;
        for (const [name, pose] of Object.entries(candidate.states || {})) if (pose && !(control in pose)) pose[control] = poses?.[name] ?? keep.default;
      }
      disabled.push(control);
    }
  }

  // Every new piece turns and scales about its own middle.
  const centre = (id) => { const box = measure(id); return box && Number.isFinite(box.width) && box.width > 0 ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null; };
  for (const id of fragmentIds) { const at = centre(id); if (at) Object.assign(candidate.elements[id].baseTransform, { pivotX: round(at.x), pivotY: round(at.y) }); }
  // Fitted to this face (docs/FACE_PART_LIBRARY.md, "Layout and auto-fit"),
  // and where the author had put the old part on top of that.
  const root = candidate.elements[rootId].baseTransform;
  if (fit) Object.assign(root, { pivotX: fit.pivotX, pivotY: fit.pivotY });
  Object.assign(root, composeFit(fit, plan.previousTransform));

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
  // The size the fit gave it, so the next replacement can tell the author's size from it.
  if (fit) part.assetFit = { scaleX: fit.scaleX, scaleY: fit.scaleY }; else delete part.assetFit;
  return { partId: part.id, rootId, ids: fragmentIds, roles: roleElements, enabled, disabled, pinned, turned, fitted: Boolean(fit), removed: [...plan.removeIds] };
}
