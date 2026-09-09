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

/**
 * The categories, in the order the browser lists them.
 *
 * `part` names the semantic part type a category reads its artwork from and
 * `roles` which of that part's roles count as its pieces. `kind` marks the two
 * that are not face parts: the presets, and the hands, which live in the
 * `hands` block rather than in a semantic part. Facial hair has no semantic
 * part yet; it is listed so the shape of the builder is complete, and it says
 * so rather than pretending.
 */
export const CHARACTER_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'presets', label: 'Presets', kind: 'presets', glyph: '★', hint: 'Ready-made faces to start from' }),
  Object.freeze({ id: 'head', label: 'Head', part: 'head', roles: Object.freeze(['head']), glyph: '◯', hint: 'The face as a whole' }),
  Object.freeze({ id: 'eyes', label: 'Eyes', part: 'eyes', roles: Object.freeze(['leftEye', 'rightEye']), glyph: '◉', hint: 'Both eyes' }),
  Object.freeze({ id: 'pupils', label: 'Pupils', part: 'gaze', roles: Object.freeze(['leftPupil', 'rightPupil']), glyph: '•', hint: 'What looks around' }),
  Object.freeze({ id: 'eyelids', label: 'Eyelids', part: 'eyelids', roles: Object.freeze(['leftUpper', 'rightUpper', 'leftLower', 'rightLower']), glyph: '◠', hint: 'What blinks' }),
  Object.freeze({ id: 'brows', label: 'Brows', part: 'eyebrows', roles: Object.freeze(['leftBrow', 'rightBrow']), glyph: '⌒', hint: 'Both eyebrows' }),
  Object.freeze({ id: 'nose', label: 'Nose', part: 'nose', roles: Object.freeze(['nose']), glyph: '▽', hint: 'The nose' }),
  Object.freeze({ id: 'mouth', label: 'Mouth', part: 'mouth', roles: Object.freeze(['mouth', 'cavity', 'teeth', 'tongue']), glyph: '◡', hint: 'The mouth, with its teeth and tongue' }),
  Object.freeze({ id: 'ears', label: 'Ears', part: 'ears', roles: Object.freeze(['leftEar', 'rightEar']), glyph: '◖', hint: 'Both ears' }),
  Object.freeze({ id: 'hair', label: 'Hair', part: 'hair', roles: Object.freeze(['hair', 'hairTop', 'hairBack']), glyph: '∿', hint: 'The fringe, the crown and the back' }),
  Object.freeze({ id: 'facialHair', label: 'Facial Hair', part: null, roles: Object.freeze([]), glyph: '≋', hint: 'Moustache, beard, goatee' }),
  Object.freeze({ id: 'accessories', label: 'Accessories', part: 'accessory', roles: Object.freeze(['element']), glyph: '◈', hint: 'Glasses, hats and the rest' }),
  Object.freeze({ id: 'hands', label: 'Hands', kind: 'hands', glyph: '✋', hint: 'The two floating hands' })
]);

export const CHARACTER_CATEGORY_IDS = Object.freeze(CHARACTER_CATEGORIES.map((category) => category.id));

export const characterCategory = (id) => CHARACTER_CATEGORIES.find((category) => category.id === id) || null;

/** `leftEye` → `Left eye`: role ids are camelCase and nothing else. */
export const roleLabel = (role) => String(role || '').replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).replace(/ (\w)/g, (_, char) => ` ${char.toLowerCase()}`);

const HAND_LABEL = Object.freeze({ left: 'Left hand', right: 'Right hand' });

/** Every layer's parent, so an ancestor walk is a lookup rather than a search. */
export function layerParents(layers = []) {
  const parents = {};
  const visit = (items, parent) => {
    for (const item of items || []) {
      parents[item.id] = parent;
      visit(item.children, item.id);
    }
  };
  visit(layers, null);
  return parents;
}

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
 * The categories of this mascot, each with the artwork that plays it.
 *
 * @param {object} document a ProjectDocument
 * @returns {{ categories: object[], owners: Record<string, string>, parents: Record<string, string|null> }}
 *   `owners` maps a piece to its category, `parents` a layer to the layer it
 *   sits in; both are what {@link categoryForElement} reads.
 */
export function deriveCharacterParts(document = {}) {
  const elements = document.elements || {};
  const parts = Object.values(document.semanticParts || {});
  const owners = {};
  const categories = CHARACTER_CATEGORIES.map((category) => {
    if (category.kind === 'presets') return { ...category, partId: null, partIds: [], pieces: [], status: 'presets', summary: category.hint };
    if (category.kind === 'hands') {
      const pieces = handPieces(document);
      for (const piece of pieces) owners[piece.id] = category.id;
      return { ...category, partId: null, partIds: [], pieces, status: pieces.length ? 'ready' : 'missing', summary: pieces.length ? summarize(pieces) : 'No hands yet' };
    }
    if (!category.part) return { ...category, partId: null, partIds: [], pieces: [], status: 'unavailable', summary: 'Coming with the part library' };
    const own = parts.filter((part) => part.type === category.part);
    const pieces = own.flatMap((part) => category.roles
      .filter((role) => elements[part.roles?.[role]])
      .map((role) => ({ id: part.roles[role], role, partId: part.id, label: elementDisplayName(document, part.roles[role]), roleLabel: roleLabel(role) })));
    for (const piece of pieces) owners[piece.id] ||= category.id;
    return {
      ...category, partId: own[0]?.id || null, partIds: own.map((part) => part.id), pieces,
      status: pieces.length ? 'ready' : 'missing',
      summary: pieces.length ? summarize(pieces) : `No ${category.label.toLowerCase()} on this mascot yet`
    };
  });
  return { categories, owners, parents: layerParents(document.layers) };
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

/** A paint the builder can offer as a swatch: a colour, not "none" and not a gradient reference. */
const isColour = (value) => { const text = String(value || '').trim().toLowerCase(); return Boolean(text) && text !== 'none' && text !== 'transparent' && text !== 'inherit' && !text.startsWith('url('); };

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
    categories: model.categories.map((category) => ({ id: category.id, status: category.status, partId: category.partId, pieces: category.pieces.map((piece) => piece.id) }))
  };
}
