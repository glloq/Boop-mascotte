/**
 * Face style presets (docs/FACE_PART_LIBRARY.md, "Presets"; roadmap phases
 * 13 and 14).
 *
 * A preset is a *recipe* over the library: which asset plays each part,
 * which accessories are worn, and which palette the face is painted in.
 * It is not a project and never replaces `MASCOT_PRESETS`: applying one is
 * the same replacements the cards make, one after another, inside one
 * history transaction, on the face that is there. Everything it leaves is
 * as editable as anything else, and the face it leaves *matches* it, which
 * is how the browser knows which preset a face wears -- read from the
 * parts, never stored.
 */
import { FACE_PART_LIBRARY } from './face-part-registry.js';
import { HAND_SIDES, HAND_STYLE_IDS } from '../../../runtime/hand-vocabulary.js';
import { PALETTE_TOKENS, facePartCategory } from './face-part-model.js';
import { elementSpan, remapArtworkIds, safePicture } from './face-part-artwork.js';
import { isColour, tintArtwork } from './palette-model.js';

/** Named palettes a preset paints the face in: every token a colour. */
export const FACE_PALETTES = Object.freeze({
  // Every token its own colour: a colour belongs to the first token seeded with it, so two tokens painted alike would be one swatch.
  warm: Object.freeze({ skin: '#f9d9b0', skinShadow: '#eab98a', outline: '#a4674a', hair: '#a6603c', hairShadow: '#7c4529', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#6d2831', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#33424f', accessorySecondary: '#c8a24a' }),
  cool: Object.freeze({ skin: '#e9d6c4', skinShadow: '#d3b59d', outline: '#5a4a6a', hair: '#3b3b58', hairShadow: '#26263b', eyeWhite: '#ffffff', pupil: '#243b53', mouth: '#7a3b45', tongue: '#d27a86', teeth: '#fff8ec', accessoryPrimary: '#2e4a66', accessorySecondary: '#8fb3d9' }),
  pale: Object.freeze({ skin: '#f3e4d3', skinShadow: '#dcc3ab', outline: '#8c6b5a', hair: '#d9d2c5', hairShadow: '#b3aa9a', eyeWhite: '#ffffff', pupil: '#4a4a4a', mouth: '#7a3b45', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#5c5c5c', accessorySecondary: '#c8a24a' }),
  robot: Object.freeze({ skin: '#c9d1d9', skinShadow: '#a5b0bc', outline: '#3a4652', hair: '#8a96a3', hairShadow: '#5f6a76', eyeWhite: '#e6f0ff', pupil: '#1b6fd1', mouth: '#2a3441', tongue: '#7f8ea0', teeth: '#dfe7f0', accessoryPrimary: '#46525f', accessorySecondary: '#ffd166' })
});

/** The parts a preset names, in the order they go on: the skull first, then what sits on it. */
export const PRESET_PART_ORDER = Object.freeze(['head', 'ears', 'eyes', 'eyebrows', 'nose', 'mouth', 'hair', 'facialHair']);

/** The paint order of a thumbnail: what is behind first, the face, then what sits on it. */
const THUMBNAIL_ORDER = Object.freeze(['ears', 'head', 'mouth', 'nose', 'eyes', 'eyebrows', 'hair', 'facialHair', 'accessory']);

const preset = (id, name, description, parts, accessories, palette, hands = {}) => Object.freeze({ id, name, description, parts: Object.freeze(parts), accessories: Object.freeze(accessories), palette, hands: Object.freeze(hands), origin: 'builtin' });

export const FACE_STYLE_PRESETS = Object.freeze([
  preset('classic', 'Classic Cartoon', 'The round, bright face of a cartoon.', { head: 'head.round', ears: 'ears.round', eyes: 'eyes.round-large', eyebrows: 'eyebrows.thin', nose: 'nose.dot', mouth: 'mouth.cartoon', hair: 'hair.short' }, [], 'warm'),
  preset('professor', 'Professor', 'Glasses, a moustache, and not much hair.', { head: 'head.oval', ears: 'ears.round', eyes: 'eyes.round-small', eyebrows: 'eyebrows.thick', nose: 'nose.hook', mouth: 'mouth.small', hair: 'hair.bald', facialHair: 'facialhair.moustache' }, ['accessory.glasses'], 'warm'),
  preset('young', 'Young', 'Big eyes, spiky hair, a wide grin.', { head: 'head.round', ears: 'ears.round', eyes: 'eyes.round-large', eyebrows: 'eyebrows.thin', nose: 'nose.dot', mouth: 'mouth.wide', hair: 'hair.spiky' }, [], 'warm'),
  preset('old', 'Old', 'Heavy lids, a long nose, a full beard.', { head: 'head.oval', ears: 'ears.large', eyes: 'eyes.sleepy', eyebrows: 'eyebrows.thick', nose: 'nose.hook', mouth: 'mouth.expressive', hair: 'hair.bald', facialHair: 'facialhair.beard' }, [], 'pale'),
  preset('robot', 'Robot', 'A square head, small eyes, a flat brow.', { head: 'head.square-soft', ears: 'ears.small', eyes: 'eyes.round-small', eyebrows: 'eyebrows.flat', nose: 'nose.cartoon', mouth: 'mouth.small', hair: 'hair.bald' }, ['accessory.bow-tie'], 'robot', { left: 'fist', right: 'fist' }),
  preset('minimal', 'Minimal', 'A narrow head and the fewest lines.', { head: 'head.narrow', ears: 'ears.small', eyes: 'eyes.round-small', eyebrows: 'eyebrows.flat', nose: 'nose.soft', mouth: 'mouth.simple', hair: 'hair.bald' }, [], 'cool')
]);

const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []);

export function normalizeFacePreset(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const parts = {};
  for (const [category, assetId] of Object.entries(source.parts && typeof source.parts === 'object' ? source.parts : {})) if (typeof assetId === 'string' && assetId.trim()) parts[category] = assetId.trim();
  const palette = typeof source.palette === 'string' ? source.palette.trim() : (source.palette && typeof source.palette === 'object' ? Object.freeze(Object.fromEntries(Object.entries(source.palette).filter(([token, colour]) => PALETTE_TOKENS.includes(token) && typeof colour === 'string' && colour.trim()).map(([token, colour]) => [token, colour.trim().toLowerCase()]))) : '');
  // The hands' resting drawings, a side each; the parts' placements over
  // their fit, a category each (roadmap phase 28): both optional.
  const hands = {};
  for (const side of HAND_SIDES) { const style = source.hands?.[side]; if (typeof style === 'string' && style.trim()) hands[side] = style.trim(); }
  const placements = {};
  for (const [category, placement] of Object.entries(source.placements && typeof source.placements === 'object' ? source.placements : {})) {
    if (!placement || typeof placement !== 'object') continue;
    const number = (value, fallback) => (Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : fallback);
    // A size per axis, so a flipped part (a negative ratio) or a stretched one stays so; `scale` is the shorthand for both.
    const ratio = (value) => { const n = number(value, 1); return n === 0 ? 1 : n; };
    placements[category] = Object.freeze({ x: number(placement.x, 0), y: number(placement.y, 0), rotation: number(placement.rotation, 0), scaleX: ratio(placement.scaleX ?? placement.scale), scaleY: ratio(placement.scaleY ?? placement.scale) });
  }
  return Object.freeze({
    id: typeof source.id === 'string' ? source.id.trim() : '',
    name: typeof source.name === 'string' ? source.name.trim() : '',
    description: typeof source.description === 'string' ? source.description.trim() : '',
    parts: Object.freeze(parts),
    accessories: Object.freeze([...new Set(strings(source.accessories))]),
    palette,
    hands: Object.freeze(hands),
    placements: Object.freeze(placements),
    origin: source.origin === 'builtin' ? 'builtin' : 'custom',
    pack: typeof source.pack === 'string' && source.pack.trim() ? source.pack.trim() : null
  });
}

/** The colours a preset paints in: a named palette, or its own tokens. */
export const presetColours = (item) => (typeof item?.palette === 'string' ? FACE_PALETTES[item.palette] || {} : item?.palette || {});

/**
 * Whether a preset can be applied: every asset it names is in the library,
 * in the category it names it for, and its palette is known.
 *
 * @returns {{ ok: boolean, preset: object, issues: { code: string, message: string, field: string }[] }}
 */
export function validateFacePreset(input, library = FACE_PART_LIBRARY, { taken = () => false } = {}) {
  const item = normalizeFacePreset(input);
  const issues = [];
  const error = (code, message, field) => issues.push({ code, message, field });
  if (!item.id) error('id-missing', 'A preset needs an id.', 'id');
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(item.id)) error('id-format', 'A preset id is lower case, digits and dashes.', 'id');
  else if (taken(item.id)) error('id-taken', `A preset called "${item.id}" is already registered.`, 'id');
  if (!item.name) error('name-missing', 'A preset needs a name.', 'name');
  if (!Object.keys(item.parts).length) error('parts-missing', 'A preset names at least one part.', 'parts');
  for (const [category, assetId] of Object.entries(item.parts)) {
    const known = facePartCategory(category);
    if (!known?.installable) { error('parts-category-unknown', `"${category}" is not a category a preset names a part for.`, `parts.${category}`); continue; }
    // What goes on is what the plan replaces: the categories in PRESET_PART_ORDER; a face wears several accessories, so they are named under `accessories`.
    if (!PRESET_PART_ORDER.includes(category)) { error(known.multiple ? 'parts-category-accessory' : 'parts-category-unknown', known.multiple ? `A face wears several ${known.label.toLowerCase()}: name "${assetId}" under accessories.` : `"${category}" comes with another part; a preset does not name it.`, `parts.${category}`); continue; }
    const asset = library.get(assetId);
    if (!asset) error('parts-asset-unknown', `There is no asset called "${assetId}".`, `parts.${category}`);
    else if (asset.category !== category) error('parts-asset-category', `"${assetId}" is not a ${known.label.toLowerCase()} asset.`, `parts.${category}`);
  }
  for (const assetId of item.accessories) {
    const asset = library.get(assetId);
    if (!asset) error('accessories-asset-unknown', `There is no asset called "${assetId}".`, 'accessories');
    else if (!facePartCategory(asset.category)?.multiple) error('accessories-asset-category', `"${assetId}" is a ${asset.category}, which a face wears one of: name it under parts.`, 'accessories');
  }
  if (typeof item.palette === 'string' && item.palette && !FACE_PALETTES[item.palette]) error('palette-unknown', `There is no palette called "${item.palette}".`, 'palette');
  // A colour of the preset's own is written into paint attributes and read back into a style attribute: it is a colour by its syntax, or refused.
  if (item.palette && typeof item.palette === 'object') for (const [token, colour] of Object.entries(item.palette)) if (!isColour(colour)) error('palette-colour-invalid', `"${colour}" is not a colour for ${token}.`, `palette.${token}`);
  for (const [side, style] of Object.entries(item.hands)) if (!HAND_STYLE_IDS.includes(style)) error('hands-style-unknown', `There is no hand drawing called "${style}".`, `hands.${side}`);
  for (const category of Object.keys(item.placements)) if (!facePartCategory(category)?.installable) error('placements-category-unknown', `"${category}" is not a category a preset places a part for.`, `placements.${category}`);
  return { ok: issues.length === 0, preset: item, issues };
}

export class FacePresetError extends Error {
  constructor(message, issues = []) { super(message); this.name = 'FacePresetError'; this.issues = issues; }
}

/** A registry of presets: validated against a part library, kept in registration order. */
export function createFacePresetRegistry({ library = FACE_PART_LIBRARY } = {}) {
  const presets = new Map();
  const validate = (input) => validateFacePreset(input, library, { taken: (id) => presets.has(id) });
  return {
    validate,
    register(input) {
      const result = validate(input);
      if (!result.ok) throw new FacePresetError(`Preset "${result.preset.id || '?'}" was refused: ${result.issues.map((item) => item.message).join(' ')}`, result.issues);
      presets.set(result.preset.id, result.preset);
      return result.preset;
    },
    has: (id) => presets.has(id),
    get: (id) => presets.get(id) || null,
    list: () => [...presets.values()],
    remove: (id) => presets.delete(id),
    get size() { return presets.size; }
  };
}

/** The editor's presets, with the built-in ones in it. */
export const FACE_PRESET_LIBRARY = createFacePresetRegistry();
for (const item of FACE_STYLE_PRESETS) FACE_PRESET_LIBRARY.register(item);

/** Add a preset from a pack or a plugin (roadmap phase 44). Throws a `FacePresetError` with its issues when refused. */
export const registerFacePreset = (item) => FACE_PRESET_LIBRARY.register(item);

const partsOf = (document) => Object.values(document?.semanticParts || {});
const wornOf = (document, categoryId) => partsOf(document).filter((part) => part?.type === facePartCategory(categoryId)?.part && part.assetId && part.assetRoot && document.elements?.[part.assetRoot]);

/**
 * The preset a face wears: the first whose every part, and whose whole set
 * of accessories and facial hair, is what the face has -- read from the
 * parts' `assetId`, never stored. Colours are the author's to change, so
 * they are not read.
 *
 * @returns {object|null}
 */
export function presetOfFace(document = {}, presets = FACE_PRESET_LIBRARY.list()) {
  const worn = (categoryId) => wornOf(document, categoryId).map((part) => part.assetId).sort();
  const extras = [...worn('accessory'), ...worn('facialHair')].sort();
  for (const item of presets) {
    // A face wears its facial hair in the order it went on: the one the preset names is among them, whichever came first.
    const parts = Object.entries(item.parts).every(([category, assetId]) => (facePartCategory(category)?.multiple ? worn(category).includes(assetId) : wornOf(document, category)[0]?.assetId === assetId));
    const named = [...item.accessories, ...(item.parts.facialHair ? [item.parts.facialHair] : [])].sort();
    if (parts && named.join() === extras.join()) return item;
  }
  return null;
}

/**
 * The face as a preset: what it wears, and the colours it is painted in.
 *
 * @param {object} document
 * @param {object} palette from `derivePalette`: the tokens' colours
 * @param {{ id: string, name: string, description?: string }} options
 */
export function facePresetFromDocument(document = {}, palette = { tokens: [] }, { id, name, description = '' } = {}) {
  const parts = {};
  for (const category of PRESET_PART_ORDER) {
    if (facePartCategory(category)?.multiple) continue;
    const worn = wornOf(document, category)[0];
    if (worn) parts[category] = worn.assetId;
  }
  const facialHair = wornOf(document, 'facialHair').map((part) => part.assetId);
  if (facialHair[0]) parts.facialHair = facialHair[0];
  // Where the author put each part over its fit, when anywhere but on it; the hands' resting drawings.
  const placements = {};
  for (const category of Object.keys(parts)) {
    const placement = placementOf(document, wornOf(document, category)[0]);
    if (placement) placements[category] = placement;
  }
  const hands = {};
  for (const side of HAND_SIDES) { const showing = document.hands?.[side]?.styles?.showing; if (showing && document.elements?.[document.hands[side].element]) hands[side] = showing; }
  return normalizeFacePreset({
    id, name, description, origin: 'custom',
    parts,
    accessories: [...wornOf(document, 'accessory').map((part) => part.assetId), ...facialHair.slice(1)],
    palette: Object.fromEntries((palette?.tokens || []).map((entry) => [entry.token, entry.colour])),
    placements, hands
  });
}

/**
 * A part's placement over its fit -- the author's move, turn and size on
 * the root -- or null when it sits where the fit put it, or its fit is not
 * known (installed before the place was written down).
 */
export function placementOf(document = {}, part) {
  const root = part?.assetRoot ? document.elements?.[part.assetRoot]?.baseTransform : null;
  const fit = part?.assetFit;
  if (!root || !fit || !Number.isFinite(Number(fit.x)) || !(Number(fit.scaleX) > 0)) return null;
  const round = (value) => Math.round(value * 1000) / 1000;
  const fitY = Number(fit.scaleY) > 0 ? Number(fit.scaleY) : Number(fit.scaleX);
  const placement = { x: round((Number(root.x) || 0) - Number(fit.x)), y: round((Number(root.y) || 0) - (Number(fit.y) || 0)), rotation: round(Number(root.rotation) || 0), scaleX: round((Number(root.scaleX) || 1) / Number(fit.scaleX)), scaleY: round((Number(root.scaleY) || 1) / fitY) };
  return Math.abs(placement.x) > 0.001 || Math.abs(placement.y) > 0.001 || Math.abs(placement.rotation) > 0.001 || Math.abs(placement.scaleX - 1) > 0.001 || Math.abs(placement.scaleY - 1) > 0.001 ? placement : null;
}

/**
 * What applying a preset does, in order: the accessories and facial hair
 * from the library that the preset does not name come off; each named
 * part is replaced, the skull first; the accessories go on; the palette
 * paints every token the face then has. Every step is a command the
 * builder already runs.
 *
 * The parts named are then placed as the preset had them over their fit, and the hands rest on the drawings it names.
 * @returns {({ kind: 'remove', partId } | { kind: 'replace', category, assetId } | { kind: 'place', category, placement } | { kind: 'handStyle', side, style } | { kind: 'retint', token, colour })[]}
 */
export function planFacePreset(document = {}, item, library = FACE_PART_LIBRARY) {
  const steps = [];
  const keep = new Set([...item.accessories, ...(item.parts.facialHair ? [item.parts.facialHair] : [])]);
  for (const category of ['accessory', 'facialHair']) for (const part of wornOf(document, category)) if (!keep.has(part.assetId)) steps.push({ kind: 'remove', partId: part.id });
  for (const category of PRESET_PART_ORDER) if (item.parts[category]) steps.push({ kind: 'replace', category, assetId: item.parts[category] });
  // An accessory goes on as what it is: a second facial hair a face wears (sideburns beside a moustache) is listed here too.
  for (const assetId of item.accessories) steps.push({ kind: 'replace', category: library.get(assetId)?.category || 'accessory', assetId });
  for (const [category, placement] of Object.entries(item.placements || {})) if (item.parts[category]) steps.push({ kind: 'place', category, placement });
  for (const [side, style] of Object.entries(item.hands || {})) steps.push({ kind: 'handStyle', side, style });
  for (const [token, colour] of Object.entries(presetColours(item))) steps.push({ kind: 'retint', token, colour });
  return steps;
}

const slug = (value) => String(value).replace(/[^a-z0-9]+/gi, '-').toLowerCase();

/**
 * A preset as a small picture: its parts drawn where the library draws
 * them, in the face's paint order, in the preset's colours. Generated from
 * the same artwork every time (roadmap phase 23), every id prefixed so the
 * picture never answers for the mascot's own clips.
 */
/** How many preset pictures were really drawn, for the performance budget's evidence (docs/PERFORMANCE_BUDGETS.md). */
export const presetThumbnailStats = { presets: 0 };
// A registered preset is one frozen object, and so is every asset it names:
// the picture is drawn once and read back while the same assets answer to
// the same ids (roadmap phase 32); a part forgotten and saved again under
// its id is a new object, and the picture is drawn again.
const presetThumbnails = new WeakMap();

/** The assets a preset's picture is made of, in the order they are painted. */
function presetAssets(item, library) {
  const assets = [];
  for (const category of THUMBNAIL_ORDER) {
    if (category === 'accessory') for (const assetId of item.accessories) { const asset = library.get(assetId); if (asset) assets.push(asset); }
    else { const asset = item.parts[category] ? library.get(item.parts[category]) : null; if (asset) assets.push(asset); }
  }
  return assets;
}

export function presetThumbnail(item, library = FACE_PART_LIBRARY, { size = 64 } = {}) {
  const assets = presetAssets(item, library);
  const cacheable = item && typeof item === 'object' && Object.isFrozen(item);
  const cached = cacheable ? presetThumbnails.get(item) : null;
  if (cached && cached.size === size && cached.assets.length === assets.length && cached.assets.every((asset, index) => asset === assets[index])) return cached.markup;
  const markup = renderPresetThumbnail(item, assets, size);
  if (cacheable) presetThumbnails.set(item, { size, assets, markup });
  return markup;
}

function renderPresetThumbnail(item, assets, size) {
  presetThumbnailStats.presets += 1;
  const palette = { tokens: Object.entries(presetColours(item)).map(([token, colour]) => ({ token, colour })) };
  const behind = [], front = [];
  for (const asset of assets) {
    const { markup, renamed } = remapArtworkIds(asset.artwork, { rename: (id) => `pv-${slug(item.id)}-${slug(asset.id)}-${id}` });
    const roles = Object.fromEntries(Object.entries(asset.paletteRoles || {}).map(([id, entry]) => [renamed[id] ?? id, entry]));
    let painted = tintArtwork(markup, roles, palette).markup;
    // A piece painted behind the face goes first, as the canvas would put it.
    for (const id of asset.behind || []) {
      const span = elementSpan(painted, renamed[id] ?? id);
      if (!span) continue;
      behind.push(painted.slice(span.start, span.end));
      painted = painted.slice(0, span.start) + painted.slice(span.end);
    }
    front.push(painted);
  }
  return safePicture(`<svg class="face-preset-thumb" viewBox="-10 -30 260 260" width="${size}" height="${size}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${behind.join('')}${front.join('')}</svg>`);
}

/* ── The author's own presets, kept in the browser ─────────────────────── */

export const CUSTOM_PRESETS_KEY = 'boop.facePresets';

/** The presets an author saved, read from storage into the registry; ones the library cannot honour are skipped. */
export function loadCustomPresets(storage, registry = FACE_PRESET_LIBRARY) {
  let saved = [];
  try { saved = JSON.parse(storage?.getItem?.(CUSTOM_PRESETS_KEY) || '[]'); } catch { saved = []; }
  const loaded = [];
  for (const item of Array.isArray(saved) ? saved : []) {
    if (!item || registry.has(item.id)) continue;
    try { loaded.push(registry.register({ ...item, origin: 'custom' })); } catch { /* a preset the library no longer honours */ }
  }
  return loaded;
}

/** The author's presets, written to storage: the custom ones only. */
export function saveCustomPresets(storage, registry = FACE_PRESET_LIBRARY) {
  const custom = registry.list().filter((item) => item.origin === 'custom');
  try { storage?.setItem?.(CUSTOM_PRESETS_KEY, JSON.stringify(custom)); return true; } catch { return false; }
}
