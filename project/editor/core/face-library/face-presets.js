/**
 * Face style presets (docs/FACE_PART_LIBRARY.md, "Presets"; roadmap phases
 * 13 and 14).
 *
 * A preset is a *recipe* over the library: which asset plays each part,
 * which accessories are worn, which style those drawings are wanted in,
 * and which palette the face is painted in.
 * It is not a project and never replaces `MASCOT_PRESETS`: applying one is
 * the same replacements the cards make, one after another, inside one
 * history transaction, on the face that is there. Everything it leaves is
 * as editable as anything else, and the face it leaves *matches* it, which
 * is how the browser knows which preset a face wears -- read from the
 * parts, never stored.
 */
import { FACE_PART_LIBRARY, baseAssetId } from './face-part-registry.js';
import { HAND_SIDES } from '../../../runtime/hand-vocabulary.js';
// The live set, so a preset may name a gesture an author added.
import { handStyleIds } from '../hands/hand-style-art.js';
import { FACE_PART_CATEGORIES, FACE_STYLE_ID, FACE_TAG, PALETTE_TOKENS, facePartCategory } from './face-part-model.js';
import { FACE_MORPHOLOGY_IDS, assetSlot, assetSupportsMorphology, faceMorphology } from './face-morphologies.js';
import { availableFaceStyles, isBaseFaceStyle } from './face-styles.js';
import { elementSpan, remapArtworkIds, safePicture } from './face-part-artwork.js';
import { isColour, tintArtwork } from './palette-model.js';

/** Named palettes a preset paints the face in: every token a colour. */
export const FACE_PALETTES = Object.freeze({
  // Every token its own colour: a colour belongs to the first token seeded with it, so two tokens painted alike would be one swatch.
  warm: Object.freeze({ skin: '#f9d9b0', skinShadow: '#eab98a', outline: '#a4674a', hair: '#a6603c', hairShadow: '#7c4529', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#6d2831', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#33424f', accessorySecondary: '#c8a24a' }),
  cool: Object.freeze({ skin: '#e9d6c4', skinShadow: '#d3b59d', outline: '#5a4a6a', hair: '#3b3b58', hairShadow: '#26263b', eyeWhite: '#ffffff', pupil: '#243b53', mouth: '#7a3b45', tongue: '#d27a86', teeth: '#fff8ec', accessoryPrimary: '#2e4a66', accessorySecondary: '#8fb3d9' }),
  pale: Object.freeze({ skin: '#f3e4d3', skinShadow: '#dcc3ab', outline: '#8c6b5a', hair: '#d9d2c5', hairShadow: '#b3aa9a', eyeWhite: '#ffffff', pupil: '#4a4a4a', mouth: '#7a3b45', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#5c5c5c', accessorySecondary: '#c8a24a' }),
  robot: Object.freeze({ skin: '#c9d1d9', skinShadow: '#a5b0bc', outline: '#3a4652', hair: '#8a96a3', hairShadow: '#5f6a76', eyeWhite: '#e6f0ff', pupil: '#1b6fd1', mouth: '#2a3441', tongue: '#7f8ea0', teeth: '#dfe7f0', accessoryPrimary: '#46525f', accessorySecondary: '#ffd166' }),
  /* ── Coats (MASC-10B) ──────────────────────────────────────────────────
   * A ginger cat and a grey cat are **one drawing and two palettes**: nothing
   * in the animal pack is drawn twice for a colour, and no token was added for
   * it. `skinShadow` is the muzzle pad and the inner ear, which is why it is
   * paler than the coat here and darker than the skin on a person.
   *
   * `hair` and `hairShadow` have nothing to paint on an animal -- a `muzzle`
   * face names no hair slot -- and are kept only so a face that mixes an
   * animal head with a human wig still has a colour for it.
   */
  'cat-ginger': Object.freeze({ skin: '#e8a45c', skinShadow: '#f7e3c8', outline: '#8a4f22', hair: '#c9793a', hairShadow: '#a35d27', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#b4525c', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#8a4f22', accessorySecondary: '#f2b8ae' }),
  'cat-grey': Object.freeze({ skin: '#9aa3ab', skinShadow: '#e2e6e9', outline: '#4a545c', hair: '#7b858d', hairShadow: '#5d666d', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#a8616a', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#4a545c', accessorySecondary: '#e6b4ae' }),
  'dog-tan': Object.freeze({ skin: '#d3a878', skinShadow: '#f4e4cd', outline: '#7a5330', hair: '#b98a58', hairShadow: '#8f6539', eyeWhite: '#ffffff', pupil: '#3a2f26', mouth: '#a8515c', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#7a5330', accessorySecondary: '#eec4b6' }),
  'fox-orange': Object.freeze({ skin: '#e9a25a', skinShadow: '#fbeedd', outline: '#8a4a1c', hair: '#d1762c', hairShadow: '#9c5219', eyeWhite: '#ffffff', pupil: '#2a231c', mouth: '#b4525c', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#8a4a1c', accessorySecondary: '#f0b9a8' }),
  'bear-brown': Object.freeze({ skin: '#a97d55', skinShadow: '#e2c9a8', outline: '#5c3f28', hair: '#8d6544', hairShadow: '#6b4a2f', eyeWhite: '#ffffff', pupil: '#2a231c', mouth: '#9c4a53', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#5c3f28', accessorySecondary: '#e0b1a4' }),
  'wolf-grey': Object.freeze({ skin: '#a9a6a0', skinShadow: '#e6e4e0', outline: '#4f4c48', hair: '#8b8882', hairShadow: '#66635f', eyeWhite: '#ffffff', pupil: '#2a2724', mouth: '#9c4a53', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#4f4c48', accessorySecondary: '#ddb2ab' }),
  'rabbit-cream': Object.freeze({ skin: '#f0dfc6', skinShadow: '#fdf6ec', outline: '#a3866a', hair: '#d8c2a3', hairShadow: '#b39f83', eyeWhite: '#ffffff', pupil: '#3a2f26', mouth: '#b46b74', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#a3866a', accessorySecondary: '#f2b8ae' })
});

/** The parts a preset names, in the order they go on: the skull first, then what sits on it. */
export const PRESET_PART_ORDER = Object.freeze(['head', 'ears', 'eyes', 'eyebrows', 'nose', 'mouth', 'hair', 'facialHair']);

/** The paint order of a thumbnail: what is behind first, the face, then what sits on it. */
const THUMBNAIL_ORDER = Object.freeze(['ears', 'head', 'mouth', 'nose', 'eyes', 'eyebrows', 'hair', 'facialHair', 'accessory']);

const preset = (id, name, description, parts, accessories, palette, { hands = {}, morphology = '', tags = [] } = {}) => Object.freeze({ id, name, description, parts: Object.freeze(parts), accessories: Object.freeze(accessories), palette, hands: Object.freeze(hands), morphology, tags: Object.freeze(tags), origin: 'builtin' });

export const FACE_STYLE_PRESETS = Object.freeze([
  preset('classic', 'Classic Cartoon', 'The round, bright face of a cartoon.', { head: 'head.round', ears: 'ears.round', eyes: 'eyes.round-large', eyebrows: 'eyebrows.thin', nose: 'nose.dot', mouth: 'mouth.cartoon', hair: 'hair.short' }, [], 'warm'),
  preset('professor', 'Professor', 'Glasses, a moustache, and not much hair.', { head: 'head.oval', ears: 'ears.round', eyes: 'eyes.round-small', eyebrows: 'eyebrows.thick', nose: 'nose.hook', mouth: 'mouth.small', hair: 'hair.bald', facialHair: 'facialhair.moustache' }, ['accessory.glasses'], 'warm'),
  preset('young', 'Young', 'Big eyes, spiky hair, a wide grin.', { head: 'head.round', ears: 'ears.round', eyes: 'eyes.round-large', eyebrows: 'eyebrows.thin', nose: 'nose.dot', mouth: 'mouth.wide', hair: 'hair.spiky' }, [], 'warm'),
  preset('old', 'Old', 'Heavy lids, a long nose, a full beard.', { head: 'head.oval', ears: 'ears.large', eyes: 'eyes.sleepy', eyebrows: 'eyebrows.thick', nose: 'nose.hook', mouth: 'mouth.expressive', hair: 'hair.bald', facialHair: 'facialhair.beard' }, [], 'pale'),
  preset('robot', 'Robot', 'A square head, small eyes, a flat brow.', { head: 'head.square-soft', ears: 'ears.small', eyes: 'eyes.round-small', eyebrows: 'eyebrows.flat', nose: 'nose.cartoon', mouth: 'mouth.small', hair: 'hair.bald' }, ['accessory.bow-tie'], 'robot', { hands: { left: 'fist', right: 'fist' } }),
  preset('minimal', 'Minimal', 'A narrow head and the fewest lines.', { head: 'head.narrow', ears: 'ears.small', eyes: 'eyes.round-small', eyebrows: 'eyebrows.flat', nose: 'nose.soft', mouth: 'mouth.simple', hair: 'hair.bald' }, [], 'cool'),

  /* ── The animals (MASC-10B) ────────────────────────────────────────────
   * Six species over one set of drawings, which is the whole argument of the
   * pilot: a cat and a bear share a head, a fox and a wolf share their eyes
   * and their brows, a cat and a fox share a nose and a dog and a wolf share a
   * muzzle. What makes each one itself is its ears, its muzzle and its coat.
   *
   * Each names `muzzle` out loud, though it would be read that way anyway:
   * a recipe naming a muzzle and a pair of whiskers is a muzzle face, and
   * `presetMorphology` says so without being told (MASC-08C).
   */
  preset('cat', 'Cat', 'Pointed ears, a short muzzle, a slit pupil and whiskers you can see.',
    { head: 'head.animal-round', ears: 'ears.cat-pointed', eyes: 'eyes.animal-round-slit', eyebrows: 'eyebrows.animal-thin-soft', nose: 'nose.triangle-small', mouth: 'mouth.animal-smile' },
    ['accessory.muzzle-feline-short', 'accessory.whiskers-three-straight'], 'cat-ginger', { morphology: 'muzzle', tags: ['cat', 'feline', 'animal'] }),
  preset('dog', 'Dog', 'Folded ears, a medium muzzle and an open, friendly mouth.',
    { head: 'head.animal-chubby', ears: 'ears.dog-folded', eyes: 'eyes.animal-round-large', eyebrows: 'eyebrows.animal-friendly-raised', nose: 'nose.animal-rounded', mouth: 'mouth.animal-open-friendly' },
    ['accessory.muzzle-canine-medium'], 'dog-tan', { morphology: 'muzzle', tags: ['dog', 'canine', 'animal'] }),
  preset('fox', 'Fox', 'Large pointed ears, a narrow muzzle and an alert almond eye.',
    { head: 'head.animal-narrow', ears: 'ears.fox-large-pointed', eyes: 'eyes.animal-almond-alert', eyebrows: 'eyebrows.animal-firm', nose: 'nose.triangle-small', mouth: 'mouth.animal-small-smile' },
    ['accessory.muzzle-canine-narrow', 'accessory.whiskers-two-soft'], 'fox-orange', { morphology: 'muzzle', tags: ['fox', 'vulpine', 'animal'] }),
  preset('bear', 'Bear', 'Round ears high on the head, a broad muzzle and a big nose.',
    { head: 'head.animal-wide', ears: 'ears.bear-round', eyes: 'eyes.animal-small-cute', eyebrows: 'eyebrows.animal-thick', nose: 'nose.bear-broad', mouth: 'mouth.animal-neutral' },
    ['accessory.muzzle-bear-broad'], 'bear-brown', { morphology: 'muzzle', tags: ['bear', 'ursine', 'animal'] }),
  preset('wolf', 'Wolf', 'Upright ears, a narrow face and long whiskers.',
    { head: 'head.animal-square', ears: 'ears.wolf-pointed', eyes: 'eyes.animal-almond-alert', eyebrows: 'eyebrows.animal-firm', nose: 'nose.oval-soft', mouth: 'mouth.animal-neutral' },
    ['accessory.muzzle-canine-medium', 'accessory.whiskers-long-curved'], 'wolf-grey', { morphology: 'muzzle', tags: ['wolf', 'canine', 'lupine', 'animal'] }),
  preset('rabbit', 'Rabbit', 'Long upright ears, a small muzzle and a tiny pink nose.',
    { head: 'head.animal-small', ears: 'ears.rabbit-long', eyes: 'eyes.animal-round-large', eyebrows: 'eyebrows.animal-thin-soft', nose: 'nose.button-tiny', mouth: 'mouth.animal-small-smile' },
    ['accessory.muzzle-rodent-small', 'accessory.whiskers-subtle-short'], 'rabbit-cream', { morphology: 'muzzle', tags: ['rabbit', 'lagomorph', 'animal'] })
]);

const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []);

export function normalizeFacePreset(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const parts = {};
  for (const [category, assetId] of Object.entries(source.parts && typeof source.parts === 'object' ? source.parts : {})) if (typeof assetId === 'string' && assetId.trim()) parts[category] = assetId.trim();
  const palette = typeof source.palette === 'string' ? source.palette.trim() : (source.palette && typeof source.palette === 'object' ? Object.freeze(Object.fromEntries(Object.entries(source.palette).filter(([token, colour]) => PALETTE_TOKENS.includes(token) && typeof colour === 'string' && colour.trim()).map(([token, colour]) => [token, colour.trim().toLowerCase()]))) : '');
  // The hands' resting drawings, a side each; the parts' placements over
  // their fit, a category or an asset id each (roadmap phase 28): both optional.
  const hands = {};
  for (const side of HAND_SIDES) { const style = source.hands?.[side]; if (typeof style === 'string' && style.trim()) hands[side] = style.trim(); }
  const placements = {};
  for (const [target, placement] of Object.entries(source.placements && typeof source.placements === 'object' ? source.placements : {})) {
    if (!placement || typeof placement !== 'object') continue;
    const number = (value, fallback) => (Number.isFinite(Number(value)) ? Math.round(Number(value) * 1000) / 1000 : fallback);
    // A size per axis, so a flipped part (a negative ratio) or a stretched one stays so; `scale` is the shorthand for both.
    const ratio = (value) => { const n = number(value, 1); return n === 0 ? 1 : n; };
    placements[target] = Object.freeze({ x: number(placement.x, 0), y: number(placement.y, 0), rotation: number(placement.rotation, 0), scaleX: ratio(placement.scaleX ?? placement.scale), scaleY: ratio(placement.scaleY ?? placement.scale) });
  }
  return Object.freeze({
    id: typeof source.id === 'string' ? source.id.trim() : '',
    name: typeof source.name === 'string' ? source.name.trim() : '',
    description: typeof source.description === 'string' ? source.description.trim() : '',
    parts: Object.freeze(parts),
    accessories: Object.freeze([...new Set(strings(source.accessories))]),
    // The look it wears every part it names in, where the library holds that
    // drawing restyled (docs/FACE_PART_LIBRARY.md, "The style axis").
    style: typeof source.style === 'string' ? source.style.trim().toLowerCase() : '',
    // What kind of face it makes (MASC-03). A preset is where a species lives:
    // `cat`, `dog` and `fox` are presets inside the `muzzle` morphology, which
    // is why adding one costs drawings rather than a release. Empty means the
    // preset says nothing, as every one written before this did.
    morphology: typeof source.morphology === 'string' ? source.morphology.trim() : '',
    tags: Object.freeze([...new Set(strings(source.tags).map((tag) => tag.trim().toLowerCase()))]),
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
 * The drawing a preset actually puts on where it names one: the asset
 * restyled into the preset's style, where the library holds that restyle,
 * and the asset itself where it does not (docs/FACE_PART_LIBRARY.md, "The
 * style axis").
 *
 * This is the whole of the axis, and every reading of a preset goes through
 * it -- what a press puts on, what its picture is drawn from, and which
 * preset a face is read as wearing -- so a style cannot be honoured in one
 * of them and forgotten in another. A preset that wants one part
 * differently names that part's own id, which resolves to itself: there is
 * nothing to switch on.
 *
 * Three branches since MASC-08A, and the first is the compatibility one:
 *
 * ```text
 * style ''          the drawing the preset named, untouched
 * style base        the drawing it is a style of -- soft-cartoon is what the
 *                   library is drawn in, so there is nothing to look up
 * style other       the variant of that canonical base, or the named drawing
 *                   where nobody has drawn one
 * ```
 *
 * @param {string} assetId the asset the preset names
 * @param {string} style the preset's style, or '' for the drawing as named
 * @returns {string} the asset id to put on
 */
export const styledAsset = (assetId, style, library = FACE_PART_LIBRARY) => {
  // No style asked: the drawing the preset named, exactly. This is the branch
  // every preset saved from a face takes -- `facePresetFromDocument` writes the
  // drawings down under their own ids and asks for no style, so a preset made
  // from a restyled face names the restyles and must go on wearing them.
  if (!style) return assetId;
  // Otherwise, come home first (MASC-08A): a face already in one style is
  // restyled from the drawing it is a style *of*, never from itself, because
  // nobody draws a style of a style.
  const base = baseAssetId(assetId, library);
  if (isBaseFaceStyle(style)) return base;
  return library?.variant?.(base, style)?.id || assetId;
};

/** What a preset puts on, category by category and accessory by accessory, in its own style. */
export const presetDrawings = (item, library = FACE_PART_LIBRARY) => Object.freeze({
  parts: Object.freeze(Object.fromEntries(Object.entries(item?.parts || {}).map(([category, assetId]) => [category, styledAsset(assetId, item?.style, library)]))),
  accessories: Object.freeze((item?.accessories || []).map((assetId) => styledAsset(assetId, item?.style, library)))
});

/**
 * What a preset puts on the face, as anything naming one of its parts may
 * name it: a category, which reaches the one part a face wears of it, and an
 * asset id, which reaches one instance of several. A face wears one nose, so
 * `nose` says which; it wears a hat *and* glasses, and `accessory` says
 * neither, which is why an id is a name here at all.
 */
const presetTargets = (item) => new Set([...Object.keys(item.parts), ...Object.values(item.parts), ...item.accessories]);

/**
 * Whether a preset can be applied: every asset it names is in the library,
 * in the category it names it for, and its palette is known.
 *
 * @returns {{ ok: boolean, preset: object, issues: { code: string, message: string, field: string }[] }}
 */
export function validateFacePreset(input, library = FACE_PART_LIBRARY, { taken = () => false } = {}) {
  const item = normalizeFacePreset(input);
  const issues = [];
  const error = (code, message, field) => issues.push({ severity: 'error', code, message, field });
  // A warning lets the preset in and is worth saying anyway. The one that
  // matters is the style: a style is a *wish*, and `styledAsset` falls back to
  // the drawing the preset named when nobody has drawn the restyle -- so
  // refusing a preset for wishing would contradict the fallback and make it
  // impossible to ship a preset before its restyles. Saying nothing at all
  // would let a typo silently dress the face in the wrong drawings.
  const warning = (code, message, field) => issues.push({ severity: 'warning', code, message, field });
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
  // A style is a name, not a table: the library answers whether it holds a
  // drawing restyled into it, and a preset asking for one nobody has drawn
  // yet wears the drawings it names, which is what MASC-06 fills in.
  if (item.style && !FACE_STYLE_ID.test(item.style)) error('style-format', `"${item.style}" is not a style name: lower-case letters, digits and dashes.`, 'style');
  // Known, though: either the catalogue has it or somebody has drawn in it.
  // Both, rather than the catalogue alone, so a pack may bring a look of its
  // own; and the *wish* is still honoured loosely -- a style with nothing drawn
  // in it yet leaves every part as the preset named it, which is what makes it
  // possible to ship a preset and its restyles in either order.
  else if (item.style && !availableFaceStyles(library).some((style) => style.id === item.style)) warning('style-unknown', `Nothing is drawn in the style "${item.style}" yet, so this preset wears the drawings it names.`, 'style');
  // What kind of face it makes, and whether the parts it names can make one.
  if (item.morphology && !faceMorphology(item.morphology)) error('morphology-unknown', `There is no kind of face called "${item.morphology}": it is one of ${FACE_MORPHOLOGY_IDS.join(', ')}.`, 'morphology');
  else if (item.morphology) {
    for (const [category, assetId] of Object.entries(item.parts)) {
      const asset = library.get(assetId);
      if (asset && !assetSupportsMorphology(asset, item.morphology)) error('parts-asset-morphology', `"${assetId}" is not drawn for a ${faceMorphology(item.morphology).label.toLowerCase()} face.`, `parts.${category}`);
    }
    for (const assetId of item.accessories) {
      const asset = library.get(assetId);
      if (asset && !assetSupportsMorphology(asset, item.morphology)) error('accessories-asset-morphology', `"${assetId}" is not drawn for a ${faceMorphology(item.morphology).label.toLowerCase()} face.`, 'accessories');
    }
  }
  for (const tag of item.tags) if (!FACE_TAG.test(tag)) error('tag-format', `"${tag}" is not a tag: lower-case letters, digits and dashes.`, 'tags');
  if (typeof item.palette === 'string' && item.palette && !FACE_PALETTES[item.palette]) error('palette-unknown', `There is no palette called "${item.palette}".`, 'palette');
  // A colour of the preset's own is written into paint attributes and read back into a style attribute: it is a colour by its syntax, or refused.
  if (item.palette && typeof item.palette === 'object') for (const [token, colour] of Object.entries(item.palette)) if (!isColour(colour)) error('palette-colour-invalid', `"${colour}" is not a colour for ${token}.`, `palette.${token}`);
  for (const [side, style] of Object.entries(item.hands)) if (!handStyleIds().includes(style)) error('hands-style-unknown', `There is no hand drawing called "${style}".`, `hands.${side}`);
  // A placement the plan could not carry out is data accepted and dropped: it names a part of the preset's own, by its category or by its asset id.
  const targets = presetTargets(item);
  for (const target of Object.keys(item.placements)) {
    if (!facePartCategory(target)?.installable && !library.get(target)) error('placements-target-unknown', `"${target}" is neither a category nor an asset a preset places a part for.`, `placements.${target}`);
    else if (!targets.has(target)) error('placements-target-unnamed', `A preset places "${target}" only when it puts it on: name it under parts or accessories.`, `placements.${target}`);
  }
  const errors = issues.filter((issue) => issue.severity === 'error'), warnings = issues.filter((issue) => issue.severity === 'warning');
  return { ok: errors.length === 0, preset: item, issues, errors, warnings };
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
      if (!result.ok) throw new FacePresetError(`Preset "${result.preset.id || '?'}" was refused: ${result.errors.map((item) => item.message).join(' ')}`, result.issues);
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
 * Every library drawing the face is actually wearing, with the category it was
 * installed as and the part it became.
 *
 * The same reading `presetOfFace` and `facePresetFromDocument` do, in one place
 * they and `face-library/compatibility.js` share: a part counts as worn when it
 * names an asset *and* the artwork that asset installed is still on the canvas,
 * so a part whose drawing was deleted is not offered as something to restyle.
 *
 * @returns {{ partId: string, type: string, category: string, assetId: string }[]}
 */
export function wornFaceParts(document = {}) {
  return FACE_PART_CATEGORIES.filter((category) => category.installable)
    .flatMap((category) => wornOf(document, category.id).map((part) => ({ partId: part.id, type: part.type, category: category.id, assetId: part.assetId })));
}

/**
 * The preset a face wears: the first whose every part, and whose whole set
 * of accessories and facial hair, is what the face has -- read from the
 * parts' `assetId`, never stored. Colours are the author's to change, so
 * they are not read.
 *
 * **The style is part of the identity**, because what is compared is the
 * drawings the preset puts on, not the ids it writes down: two presets
 * naming the same parts in two styles are two faces, and a face is read as
 * the one whose drawings it is actually wearing. The alternative -- reading
 * through the style -- would make every restyle of V3-06 an alias of every
 * other, which is the failure this slice exists to prevent. The price is
 * that a face wearing a preset's parts with one of them put back to the
 * drawing the preset restyled is no longer that preset, which is true: it
 * is wearing another drawing.
 *
 * @returns {object|null}
 */
export function presetOfFace(document = {}, presets = FACE_PRESET_LIBRARY.list(), library = FACE_PART_LIBRARY) {
  const worn = (categoryId) => wornOf(document, categoryId).map((part) => part.assetId).sort();
  const extras = [...worn('accessory'), ...worn('facialHair')].sort();
  for (const item of presets) {
    const drawings = presetDrawings(item, library);
    // A face wears its facial hair in the order it went on: the one the preset names is among them, whichever came first.
    const parts = Object.entries(drawings.parts).every(([category, assetId]) => (facePartCategory(category)?.multiple ? worn(category).includes(assetId) : wornOf(document, category)[0]?.assetId === assetId));
    const named = [...drawings.accessories, ...(drawings.parts.facialHair ? [drawings.parts.facialHair] : [])].sort();
    if (parts && named.join() === extras.join()) return item;
  }
  return null;
}

/**
 * The visual slots a recipe's drawings sit in that a person's face has not got.
 *
 * The one reading both answers below are built on: `muzzle` and `whiskers` say
 * *cat*; a head, a nose and a mouth say nothing at all, because every kind of
 * face has those.
 */
function distinctiveSlots(preset, library) {
  const human = new Set(faceMorphology('human')?.slots || []);
  const named = [...Object.values(preset?.parts || {}), ...(preset?.accessories || [])];
  return [...new Set(named.map((assetId) => { const asset = library?.get?.(assetId); return asset ? assetSlot(asset) : null; }).filter((slot) => slot && !human.has(slot)))];
}

/** The one kind of face that holds every one of these slots, or '' when none does or several do not agree. */
const morphologyHolding = (slots) => FACE_MORPHOLOGY_IDS.find((id) => slots.every((slot) => faceMorphology(id).slots.includes(slot))) || '';

/**
 * The kind of face a preset makes (MASC-08B).
 *
 * A preset that says so is taken at its word. One that says nothing -- which is
 * every preset written before MASC-03, the six the editor ships among them --
 * is **read from its parts**, because the alternative is worse in both
 * directions: treating silence as "every kind" would offer Professor as a way
 * to make a bird, and treating it as nothing at all would hide the six presets
 * that exist from the one kind of face they do make.
 *
 * What is read is the visual slots its drawings sit in, and only the ones
 * `human` has not got. A preset naming a muzzle and a pair of whiskers makes a
 * muzzle face and could not make anything else; a preset naming a head, a nose
 * and a mouth names nothing distinctive, so it is human -- which is the honest
 * answer for Classic, Professor, Young, Old, Minimal, and for the Robot preset
 * too. That one is a square head and a bow tie: a human-styled robot, with
 * neither an antenna nor a panel on it. Calling it `robot` would be telling the
 * system something untrue about what it is made of, and the real Robot will
 * arrive with the slots that make it one.
 *
 * A preset whose distinctive slots no single kind of face holds claims nothing
 * rather than a kind that would be a guess.
 *
 * @returns {string} a morphology id, or '' for a preset no kind fits
 */
export function presetMorphology(preset, { library = FACE_PART_LIBRARY } = {}) {
  if (preset?.morphology) return preset.morphology;
  const distinctive = distinctiveSlots(preset, library);
  return distinctive.length ? morphologyHolding(distinctive) : 'human';
}

/**
 * What a preset saved from a face may claim about itself (MASC-08C).
 *
 * The **writing** half of {@link presetMorphology}, and deliberately stricter
 * than the reading half by one case: a face of nothing but universal drawings
 * gets no claim at all rather than `human`. Reading a claimless preset as human
 * is a classification anybody can revisit; writing `human` into the author's
 * saved preset is a fact they never stated, and one they could never tell from
 * a choice afterwards. So silence stays silence, and `presetMorphology` goes on
 * classifying it exactly as it classifies the six the editor ships.
 *
 * What it never reads is the Type row: that is a session preference -- which
 * kind of face Design is *offering* -- and the preset is made of what the
 * mascot is actually wearing.
 *
 * @returns {string} a morphology id, or '' for a face that does not say
 */
export const presetMorphologyClaim = (preset, { library = FACE_PART_LIBRARY } = {}) => {
  const distinctive = distinctiveSlots(preset, library);
  return distinctive.length ? morphologyHolding(distinctive) : '';
};

/**
 * The face as a preset: what it wears, and the colours it is painted in.
 *
 * What it wears, drawing by drawing: a face has parts, not a style, so a
 * face dressed by a restyled preset is written down as the restyled
 * drawings it is actually wearing, under their own ids, and the preset
 * asks for no style of its own. Applying it again puts the same drawings
 * on, whatever anyone restyles afterwards -- which is what a preset saved
 * from a face is for.
 *
 * Since MASC-08C it also writes down **what kind of face it makes**, when the
 * face says so: the recipe's own drawings are read through
 * {@link presetMorphologyClaim}, so a face wearing a cat's muzzle and its
 * whiskers is saved as a `muzzle` preset and is offered under Muzzle
 * afterwards. A face of nothing but universal drawings claims nothing, and
 * `presetMorphology` goes on classifying it as a person, exactly as it
 * classifies every preset written before any of this. The Type row is never
 * consulted: it is a session preference about what Design is *offering*, and a
 * preset is made of what the mascot is really wearing.
 *
 * @param {object} document
 * @param {object} palette from `derivePalette`: the tokens' colours
 * @param {{ id: string, name: string, description?: string, tags?: string[], library?: object }} options
 */
export function facePresetFromDocument(document = {}, palette = { tokens: [] }, { id, name, description = '', tags = [], library = FACE_PART_LIBRARY } = {}) {
  const parts = {};
  for (const category of PRESET_PART_ORDER) {
    if (facePartCategory(category)?.multiple) continue;
    const worn = wornOf(document, category)[0];
    if (worn) parts[category] = worn.assetId;
  }
  const facialHair = wornOf(document, 'facialHair');
  if (facialHair[0]) parts.facialHair = facialHair[0].assetId;
  // What the face wears several of: every accessory, and the facial hair the one named under `parts` did not take.
  const extras = [...wornOf(document, 'accessory'), ...facialHair.slice(1)];
  // Where the author put each part over its fit, when anywhere but on it; the
  // hands' resting drawings. The one part of a category is written down under
  // it; one of several under its asset id, so the moved glasses come back
  // moved and the hat beside them does not.
  const placements = {};
  for (const category of Object.keys(parts)) {
    const placement = placementOf(document, wornOf(document, category)[0]);
    if (placement) placements[category] = placement;
  }
  for (const part of extras) { const placement = placementOf(document, part); if (placement) placements[part.assetId] = placement; }
  const hands = {};
  for (const side of HAND_SIDES) { const showing = document.hands?.[side]?.styles?.showing; if (showing && document.elements?.[document.hands[side].element]) hands[side] = showing; }
  const recipe = { parts, accessories: extras.map((part) => part.assetId) };
  return normalizeFacePreset({
    id, name, description, origin: 'custom',
    ...recipe,
    // What kind of face it makes, when its own drawings say so; nothing when
    // they do not. A species -- `cat`, `fox` -- is editorial and is never
    // invented from a morphology, so the tags are the caller's to pass.
    morphology: presetMorphologyClaim(recipe, { library }),
    tags,
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
 * The parts named are then placed as the preset had them over their fit -- each named as the preset names it, by category or by asset id -- and the hands rest on the drawings it names.
 *
 * A step for a category a face wears several of names the part it means
 * (MASC-08B): the one already wearing that drawing, or none at all, in which
 * case the install adds a part rather than replacing whatever happens to share
 * its mount point. Without that a preset naming two drawings mounted in the
 * same place -- a muzzle and a pair of whiskers, both at the centre of the head
 * -- would put the first on and the second over it, and dress the face in one
 * of the two it asked for.
 *
 * @returns {({ kind: 'remove', partId } | { kind: 'replace', category, assetId, targetPartId?, within? } | { kind: 'place', target, placement } | { kind: 'handStyle', side, style } | { kind: 'retint', token, colour })[]}
 */
export function planFacePreset(document = {}, item, library = FACE_PART_LIBRARY) {
  const steps = [];
  // What goes on is the preset's parts in the preset's style, so every step
  // below -- what is kept, what is replaced, what is placed -- is about the
  // drawing that will really be there.
  const drawings = presetDrawings(item, library);
  const keep = new Set([...drawings.accessories, ...(drawings.parts.facialHair ? [drawings.parts.facialHair] : [])]);
  const wornByAsset = new Map();
  for (const category of ['accessory', 'facialHair']) {
    for (const part of wornOf(document, category)) {
      if (!keep.has(part.assetId)) { steps.push({ kind: 'remove', partId: part.id }); continue; }
      if (!wornByAsset.has(part.assetId)) wornByAsset.set(part.assetId, part.id);
    }
  }
  // The part a drawing goes onto, for a category a face wears several of: the
  // one already wearing it, and otherwise none -- a part of its own.
  const onto = (category, assetId) => (facePartCategory(category)?.multiple ? { targetPartId: wornByAsset.get(assetId) || null, within: [] } : {});
  for (const category of PRESET_PART_ORDER) if (drawings.parts[category]) steps.push({ kind: 'replace', category, assetId: drawings.parts[category], ...onto(category, drawings.parts[category]) });
  // An accessory goes on as what it is: a second facial hair a face wears (sideburns beside a moustache) is listed here too.
  for (const assetId of drawings.accessories) { const category = library.get(assetId)?.category || 'accessory'; steps.push({ kind: 'replace', category, assetId, ...onto(category, assetId) }); }
  // Placed after every replacement, so both accessories are on the face before either is addressed.
  // A placement names the part as the preset names it; the part on the face
  // is the restyled one, so the name is resolved the same way the drawing was.
  const targets = presetTargets(item);
  for (const [target, placement] of Object.entries(item.placements || {})) if (targets.has(target)) steps.push({ kind: 'place', target: facePartCategory(target)?.installable ? target : styledAsset(target, item.style, library), placement });
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

/**
 * The assets a preset's picture is made of, in the order they are painted:
 * the drawings a press would put on, so a restyled preset's card shows the
 * restyle, from the same artwork, with no picture kept beside it.
 */
function presetAssets(item, library) {
  const drawings = presetDrawings(item, library);
  const assets = [];
  for (const category of THUMBNAIL_ORDER) {
    if (category === 'accessory') for (const assetId of drawings.accessories) { const asset = library.get(assetId); if (asset) assets.push(asset); }
    else { const asset = drawings.parts[category] ? library.get(drawings.parts[category]) : null; if (asset) assets.push(asset); }
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
