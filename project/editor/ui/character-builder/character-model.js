/**
 * The Character Builder's view of a mascot (docs/CHARACTER_BUILDER.md).
 *
 * The builder shows a face as the parts a person would name -- head, eyes,
 * brows, mouth, hair -- and never as the thirty layers that draw it. This is
 * the pure half: given a ProjectDocument, which artwork each named part is,
 * and given a selection, which part it belongs to. Nothing here is stored.
 * The semantic parts and their roles stay the truth (docs/SEMANTIC_RIGGING.md);
 * a category is a *reading* of them, so an old project with no builder
 * metadata at all opens in the builder exactly as a new one does.
 *
 * Every function is pure over plain data so it can be tested without a DOM,
 * and so the panels stay thin.
 */
import { elementDisplayName } from '../../rig-editor/semantic-parts/face-roles.js';
import { FACE_PART_CATEGORIES } from '../../core/face-library/face-part-model.js';
import { hostedRoots, shapeSignature } from '../../core/face-library/face-part-artwork.js';
import { layerParents } from '../../core/face-library/face-layout.js';
import { isColour } from '../../core/face-library/palette-model.js';

/**
 * The categories, in the order the browser lists them.
 *
 * The face categories are the library's (`core/face-library`): which semantic
 * part each becomes and which roles count as its pieces are read from there,
 * so the builder, the library and the rig agree by construction. The builder
 * adds the two that are not face parts -- the presets, and the hands, which
 * live in the `hands` block -- and a glyph and a hint for each row.
 */
const FACE_GLYPHS = Object.freeze({ head: '◯', eyes: '◉', pupils: '•', eyelids: '◠', eyebrows: '⌒', nose: '▽', mouth: '◡', ears: '◖', hair: '∿', facialHair: '≋', accessory: '◈' });
const FACE_HINTS = Object.freeze({
  head: 'The face as a whole', eyes: 'Both eyes', pupils: 'What looks around', eyelids: 'What blinks', eyebrows: 'Both eyebrows', nose: 'The nose',
  mouth: 'The mouth, with its teeth and tongue', ears: 'Both ears', hair: 'The fringe, the crown and the back', facialHair: 'Moustache, beard, goatee', accessory: 'Glasses, hats and the rest'
});

export const CHARACTER_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'presets', label: 'Presets', kind: 'presets', glyph: '★', hint: 'Ready-made faces to start from' }),
  Object.freeze({ id: 'palette', label: 'Colours', kind: 'palette', glyph: '◐', hint: 'Skin, outline, hair, mouth: the colours of the face' }),
  ...FACE_PART_CATEGORIES.map((category) => Object.freeze({ id: category.id, label: category.label, part: category.part, roles: category.roles, installable: category.installable, multiple: category.multiple, glyph: FACE_GLYPHS[category.id] || '◆', hint: FACE_HINTS[category.id] || category.label })),
  Object.freeze({ id: 'hands', label: 'Hands', kind: 'hands', glyph: '✋', hint: 'The two floating hands' })
]);

export const CHARACTER_CATEGORY_IDS = Object.freeze(CHARACTER_CATEGORIES.map((category) => category.id));

export const characterCategory = (id) => CHARACTER_CATEGORIES.find((category) => category.id === id) || null;

/** `leftEye` → `Left eye`: role ids are camelCase and nothing else. */
export const roleLabel = (role) => String(role || '').replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).replace(/ (\w)/g, (_, char) => ` ${char.toLowerCase()}`);

const HAND_LABEL = Object.freeze({ left: 'Left hand', right: 'Right hand' });

/** Every layer's parent, so an ancestor walk is a lookup rather than a search: the library's walker, shared. */
export { layerParents };

/** Piece labels joined, so a category says what it holds without being opened. */
function summarize(pieces, limit = 3) {
  const names = pieces.map((piece) => piece.label);
  return names.length > limit ? `${names.slice(0, limit).join(' · ')} +${names.length - limit}` : names.join(' · ');
}

function handPieces(document) {
  const elements = document.elements || {};
  const pieces = [];
  for (const side of ['left', 'right']) {
    const element = document.hands?.[side]?.element;
    if (element && elements[element]) { pieces.push({ id: element, role: side, partId: null, label: HAND_LABEL[side], roleLabel: HAND_LABEL[side], side }); continue; }
    // A mascot rigged before the hands block existed names its hands as parts.
    const part = Object.values(document.semanticParts || {}).find((item) => item.type === `${side}Hand`);
    const fallback = part?.roles?.hand;
    if (fallback && elements[fallback]) pieces.push({ id: fallback, role: side, partId: part.id, label: HAND_LABEL[side], roleLabel: HAND_LABEL[side], side });
  }
  return pieces;
}

/**
 * Whether a library instance was reshaped by hand since it went on: its
 * shapes no longer sign as the install left them (`part.assetShape`,
 * docs/FACE_PART_LIBRARY.md, "Custom parts"). Moved, turned or resized as a
 * whole, it is still the library's; a point or a curve dragged, it is the
 * author's -- and keeps its category, its roles and its movements.
 */
export const instanceIsCustom = (document, part) => Boolean(part?.assetShape && part.assetRoot && shapeSignature(document?.svgMarkup, [part.assetRoot, ...(part.assetDetached || [])], { without: hostedRoots(document, part.id) }) !== part.assetShape);

/**
 * The categories of this mascot, each with the artwork that plays it.
 *
 * @param {object} document a ProjectDocument
 * @returns {{ categories: object[], owners: Record<string, string>, instances: Record<string, string>, detached: Record<string, string[]>, parents: Record<string, string|null> }}
 *   `owners` maps a piece to its category, `instances` a library root to its
 *   category, `detached` a root to the pieces it paints behind the face,
 *   `parents` a layer to the layer it sits in; what
 *   {@link categoryForElement}, {@link instanceRootOf} and {@link instanceNodes} read.
 */
export function deriveCharacterParts(document = {}) {
  const elements = document.elements || {};
  const parts = Object.values(document.semanticParts || {});
  const owners = {}, instances = {}, detached = {};
  const categories = CHARACTER_CATEGORIES.map((category) => {
    if (category.kind === 'presets') return { ...category, partId: null, partIds: [], pieces: [], assetId: null, status: 'presets', summary: category.hint };
    if (category.kind === 'palette') return { ...category, partId: null, partIds: [], pieces: [], assetId: null, status: 'palette', summary: category.hint };
    if (category.kind === 'hands') {
      const pieces = handPieces(document);
      for (const piece of pieces) owners[piece.id] = category.id;
      return { ...category, partId: null, partIds: [], pieces, assetId: null, status: pieces.length ? 'ready' : 'missing', summary: pieces.length ? summarize(pieces) : 'No hands yet' };
    }
    if (!category.part) return { ...category, partId: null, partIds: [], pieces: [], assetId: null, status: 'unavailable', summary: 'Coming with the part library' };
    const own = parts.filter((part) => part.type === category.part);
    // A part that came from the library is one piece: its root, the instance
    // the fit placed and the author moves as a whole (docs/FACE_PART_LIBRARY.md,
    // "Layout and auto-fit"). The shapes inside it are reached through Artwork.
    // Signing an instance's shapes reads its whole subtree: once per part, not once per use.
    const customOf = new Map();
    const isCustom = (part) => { if (!customOf.has(part.id)) customOf.set(part.id, instanceIsCustom(document, part)); return customOf.get(part.id); };
    const pieces = own.flatMap((part) => (part.assetId && part.assetRoot && elements[part.assetRoot]
      ? [{ id: part.assetRoot, role: 'instance', partId: part.id, label: elementDisplayName(document, part.assetRoot), roleLabel: `${isCustom(part) ? 'Custom · from' : 'Library part ·'} ${assetLabel(part.assetId)}`, custom: isCustom(part), from: assetLabel(part.assetId), detached: (part.assetDetached || []).filter((id) => elements[id]), removable: Boolean(category.multiple) }]
      : category.roles
        .filter((role) => elements[part.roles?.[role]])
        .map((role) => ({ id: part.roles[role], role, partId: part.id, label: elementDisplayName(document, part.roles[role]), roleLabel: roleLabel(role) }))));
    for (const piece of pieces) {
      owners[piece.id] ||= category.id;
      if (piece.role === 'instance') { instances[piece.id] = category.id; detached[piece.id] = piece.detached; for (const id of piece.detached) owners[id] ||= category.id; }
    }
    // The library asset the part was last installed from, while its drawing
    // is still there: a part drawn by hand, or one whose asset artwork was
    // deleted in Artwork, comes from no asset.
    const installed = own.filter((part) => part.assetId && part.assetRoot && elements[part.assetRoot]);
    // A reshaped instance is the author's: no card is "current" for it, and
    // the card of the asset it came from puts the library drawing back.
    const pristine = installed.filter((part) => !isCustom(part));
    return {
      ...category, partId: own[0]?.id || null, partIds: own.map((part) => part.id), pieces,
      assetId: installed[0]?.assetId || null,
      assetIds: pristine.map((part) => part.assetId),
      custom: installed.length > pristine.length,
      status: pieces.length ? 'ready' : 'missing',
      summary: pieces.length ? summarize(pieces) : `No ${category.label.toLowerCase()} on this mascot yet`
    };
  });
  return { categories, owners, instances, detached, parents: layerParents(document.layers) };
}

/**
 * Every node a library part is: its root, and the pieces it paints behind
 * the face, which sit outside the root and move with it as one drawing.
 */
export const instanceNodes = (model, rootId) => [rootId, ...(model?.detached?.[rootId] || [])];

/** `mouth.wide` → `Wide`: the asset's own name is the library's; its id says enough for a label. */
export const assetLabel = (assetId) => String(assetId || '').split('.').slice(1).join('.').replace(/-/g, ' ').replace(/^./, (char) => char.toUpperCase());

/**
 * The instance a piece belongs to: the library root it sits in, or itself.
 *
 * A move, a size and a turn are the instance's, whichever shape inside it
 * was picked on the canvas: the fit placed the root, the next replacement
 * reads the root, and a shape moved inside it would be a move the next
 * mouth does not get.
 *
 * @returns {string} an element id
 */
export function instanceRootOf(model, elementId) {
  if (!model || !elementId) return elementId;
  const instances = model.instances || {}, parents = model.parents || {};
  // A pupil drawn inside a library pair of eyes is the pupils', not the eyes':
  // only a root of the piece's own category is its instance.
  const owner = categoryForElement(model, elementId);
  // A piece painted behind the face sits outside its root, and is the root's all the same.
  for (const [root, ids] of Object.entries(model.detached || {})) if (ids.includes(elementId) && instances[root] === owner) return root;
  const seen = new Set();
  for (let id = elementId; id && !seen.has(id); id = parents[id]) {
    seen.add(id);
    if (instances[id]) return instances[id] === owner ? id : elementId;
  }
  return elementId;
}

/**
 * Which category a piece of artwork belongs to.
 *
 * Exact first: the pupil is the pupil even though it sits inside the eye. Then
 * the nearest ancestor that is a piece: the white of an eye is the eyes, the
 * shading of the face is the head. The nearest, not the first part that
 * happens to contain it -- everything on a face sits inside the head group,
 * and "the head" is the wrong answer for a click on an eye.
 *
 * @returns {string|null} a category id, or null for artwork no part owns
 */
export function categoryForElement(model, elementId) {
  if (!model || !elementId) return null;
  const owners = model.owners || {}, parents = model.parents || {};
  const seen = new Set();
  for (let id = elementId; id && !seen.has(id); id = parents[id]) {
    seen.add(id);
    if (owners[id]) return owners[id];
  }
  return null;
}

/**
 * The category the builder is showing.
 *
 * What the author *chose* in the browser wins while it still describes the
 * selection: it was chosen, nothing is selected against it, or the selection
 * is one of its pieces. The moment the canvas selects something else, the
 * selection wins -- the inspector follows what is picked, whichever door it
 * came through.
 *
 * @param {object} model from {@link deriveCharacterParts}
 * @param {{ chosen?: string|null, selectedId?: string|null }} state
 * @returns {string|null}
 */
export function resolveActiveCategory(model, { chosen = null, selectedId = null } = {}) {
  const category = model?.categories?.find((item) => item.id === chosen) || null;
  if (category && (!selectedId || category.pieces.some((piece) => piece.id === selectedId))) return category.id;
  return selectedId ? categoryForElement(model, selectedId) : null;
}

/** The piece of a category that is in hand, or its first one. */
export function activePiece(category, selectedId = null) {
  if (!category?.pieces?.length) return null;
  return category.pieces.find((piece) => piece.id === selectedId) || null;
}

const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Where a piece is, as the builder shows it: position, turn and one size.
 *
 * A base transform carries two scales; the builder shows one, because a part
 * is made bigger or smaller and never wider. A piece that *is* wider than tall
 * says so, and the field edits both axes by the same factor.
 */
export function pieceTransform(document, id) {
  const transform = document?.elements?.[id]?.baseTransform || {};
  const scaleX = finite(transform.scaleX, 1), scaleY = finite(transform.scaleY, 1);
  return {
    x: finite(transform.x, 0), y: finite(transform.y, 0), rotation: finite(transform.rotation, 0),
    scaleX, scaleY, scale: Math.abs(scaleX) || 1, uniform: Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) < 1e-6
  };
}

/**
 * The patch a new size writes: both axes, the flip of each kept.
 *
 * A mirrored piece has a negative scale on one axis, and a size field that
 * turned it back the right way round would be a field that also flips.
 */
export function scalePatch(document, id, value) {
  const { scaleX, scaleY } = pieceTransform(document, id);
  const size = Math.max(0.01, Math.abs(finite(value, 1)) || 1);
  return { scaleX: (scaleX < 0 ? -1 : 1) * size, scaleY: (scaleY < 0 ? -1 : 1) * size };
}

/**
 * The distinct colours a piece is painted with, and every place each is used.
 *
 * A part is recoloured by colour rather than by layer: "the hair" is one
 * swatch whatever number of shapes draw it, and changing it changes every one
 * of them at once. Order is first use, which for a face is skin, then line.
 *
 * @param {{ id: string, fill?: string, stroke?: string }[]} paints from the canvas
 * @returns {{ colour: string, uses: { id: string, property: string }[] }[]}
 */
export function paletteOfPaints(paints = []) {
  const palette = [], index = new Map();
  for (const paint of paints) {
    for (const property of ['fill', 'stroke']) {
      const value = paint?.[property];
      if (!isColour(value)) continue;
      const colour = String(value).trim().toLowerCase();
      if (!index.has(colour)) { index.set(colour, palette.length); palette.push({ colour, uses: [] }); }
      palette[index.get(colour)].uses.push({ id: paint.id, property });
    }
  }
  return palette;
}

/** The whole builder, as plain data, for the browser-test seam. */
export function characterSnapshot(model, { active = null, selectedId = null } = {}) {
  return {
    active,
    selectedId,
    categories: model.categories.map((category) => ({ id: category.id, status: category.status, partId: category.partId, assetId: category.assetId || null, ...(category.multiple ? { assetIds: category.assetIds } : {}), ...(category.custom ? { custom: true } : {}), pieces: category.pieces.map((piece) => piece.id) }))
  };
}

/* ── Pairs (docs/CHARACTER_BUILDER.md, "Linked editing") ──────────────────
 * The eyes, the pupils, the brows, the ears and the lids come in twos, and a
 * face is edited as a face: move one eye out and the other goes out with it.
 * A pair is read from the roles -- `leftEye` and `rightEye` are the two
 * sides of one thing -- or from a symmetry peer the author named in Artwork.
 */

/** `leftEye` → `rightEye`, `rightUpper` → `leftUpper`; a role with no side is its own. */
export function peerRole(role) {
  const text = String(role || '');
  if (/^left[A-Z]/.test(text)) return text.replace(/^left/, 'right');
  if (/^right[A-Z]/.test(text)) return text.replace(/^right/, 'left');
  return null;
}

/**
 * The other side of a piece, when it has one.
 *
 * @param {object} document
 * @param {object} category from {@link deriveCharacterParts}
 * @param {string} pieceId
 * @returns {{ piece: object, peer: object, side: 'left'|'right' }|null}
 */
export function pairOf(document, category, pieceId) {
  const piece = category?.pieces?.find((item) => item.id === pieceId);
  if (!piece) return null;
  const named = document?.elements?.[pieceId]?.symmetryPeer;
  const peer = (named && category.pieces.find((item) => item.id === named && item.id !== pieceId))
    || category.pieces.find((item) => item.id !== pieceId && item.partId === piece.partId && item.role === peerRole(piece.role))
    || null;
  if (!peer) return null;
  return { piece, peer, side: /^right/.test(piece.role) ? 'right' : 'left' };
}

/**
 * What the other side writes when one side is written: the same size and
 * height, the move and the turn mirrored across the face.
 *
 * On the offsets a base transform holds, a mirror is a sign: the two eyes
 * are drawn where they belong, and an eye moved a little out is the other
 * eye moved a little out the other way.
 */
export function mirrorTransformPatch(patch = {}) {
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!Number.isFinite(Number(value))) continue;
    out[key] = key === 'x' || key === 'rotation' ? -Number(value) : Number(value);
  }
  return out;
}

/** What a pair's category calls its two: "Edit both eyes". */
export function pairLabel(category) {
  const noun = { eyes: 'eyes', pupils: 'pupils', eyelids: 'eyelids', eyebrows: 'brows', ears: 'ears' }[category?.id] || (category?.label ? category.label.toLowerCase() : 'sides');
  return `Edit both ${noun}`;
}

/**
 * The distance between two centres, and what each side writes to reach a
 * new one: half the difference each, apart or together.
 *
 * @param {{x:number}} left the left piece's centre, in the space both sit in
 * @param {{x:number}} right the right piece's centre
 */
export const pairSpacing = (left, right) => (left && right ? Math.round((right.x - left.x) * 1000) / 1000 : null);

export function spacingPatch(document, leftId, rightId, spacing, current) {
  const next = Number(spacing), now = Number(current);
  if (!Number.isFinite(next) || !Number.isFinite(now)) return null;
  const half = (next - now) / 2;
  const x = (id) => Number(document?.elements?.[id]?.baseTransform?.x) || 0;
  const round = (value) => Math.round(value * 1000) / 1000;
  return { left: { x: round(x(leftId) - half) }, right: { x: round(x(rightId) + half) } };
}
