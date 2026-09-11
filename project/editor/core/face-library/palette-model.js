/**
 * The face's colours as tokens (docs/FACE_PART_LIBRARY.md, "Palette
 * tokens"; roadmap phase 9).
 *
 * ```text
 * skin      ■  the head, the lids, the ears — every shape painted like the skull
 * outline   ■  the lines that carry the face
 * hair      ■  the fringe and the crown       hairShadow  ■  the back
 * eyeWhite  ■  pupil  ■  mouth  ■  teeth  ■  tongue  ■  …
 * ```
 *
 * A token is a *reading* of the artwork, never a second record of it: its
 * colour is the colour the part that plays the token's role is painted with
 * -- the skull's fill is `skin` -- and its uses are every fill and stroke on
 * the mascot painted that same colour. Change the token and every use
 * changes; the SVG stays the only truth. A library asset says which token
 * each of its paints plays (`paletteRoles`), so it is painted in the face's
 * colours as it goes on.
 */
import { PALETTE_TOKENS } from './face-part-model.js';
import { openTagPattern } from './face-part-artwork.js';
import { layerParents } from './face-layout.js';

export const TOKEN_LABELS = Object.freeze({
  skin: 'Skin', skinShadow: 'Skin shadow', outline: 'Outline', hair: 'Hair', hairShadow: 'Hair shadow',
  eyeWhite: 'Eye white', pupil: 'Pupil', mouth: 'Mouth', tongue: 'Tongue', teeth: 'Teeth',
  accessoryPrimary: 'Accessory', accessorySecondary: 'Accessory trim'
});

/**
 * Where each token is read from, in order: the first rule whose role is
 * played and painted seeds the token. `descend` reads the first painted
 * shape inside a role that is a group (the white of an eye); `either`
 * takes the fill, or the stroke of a shape with no fill (a mouth drawn as
 * a line).
 */
export const TOKEN_SEEDS = Object.freeze([
  { token: 'skin', part: 'jaw', role: 'jaw', property: 'fill' },
  { token: 'skin', part: 'head', role: 'head', property: 'fill' },
  { token: 'skin', part: 'ears', role: 'leftEar', property: 'fill', descend: true },
  { token: 'skin', part: 'eyelids', role: 'leftUpper', property: 'fill' },
  { token: 'outline', part: 'jaw', role: 'jaw', property: 'stroke' },
  { token: 'outline', part: 'head', role: 'head', property: 'stroke' },
  { token: 'outline', part: 'ears', role: 'leftEar', property: 'stroke', descend: true },
  { token: 'outline', part: 'eyelids', role: 'leftUpper', property: 'stroke' },
  { token: 'hair', part: 'hair', role: 'hair', property: 'fill', descend: true },
  { token: 'hair', part: 'hair', role: 'hairTop', property: 'fill' },
  { token: 'hairShadow', part: 'hair', role: 'hairBack', property: 'fill' },
  { token: 'eyeWhite', part: 'eyes', role: 'leftEye', property: 'fill', descend: true },
  { token: 'pupil', part: 'gaze', role: 'leftPupil', property: 'fill' },
  { token: 'mouth', part: 'mouth', role: 'mouth', property: 'either' },
  { token: 'teeth', part: 'mouth', role: 'teeth', property: 'fill' },
  { token: 'tongue', part: 'mouth', role: 'tongue', property: 'fill' },
  { token: 'tongue', part: 'tongue', role: 'tongue', property: 'fill' },
  { token: 'skinShadow', part: 'nose', role: 'nose', property: 'fill' },
  { token: 'accessoryPrimary', part: 'accessory', role: 'element', property: 'fill', descend: true },
  { token: 'accessorySecondary', part: 'accessory', role: 'element', property: 'stroke', descend: true }
].map(Object.freeze));

/** A paint the palette can hold: a colour, not "none" and not a reference. */
/**
 * A paint the palette can hold: a colour by its syntax -- `#hex`, a named
 * colour, `rgb()`/`rgba()`/`hsl()`/`hsla()` with numbers in it -- and
 * nothing else. Not "none", not a reference, and not a string that merely
 * begins with a colour: what is read here is written into a `style`
 * attribute, so a value carrying a `;` or a `url(` is not a colour.
 */
const COLOUR_SYNTAX = /^(?:#[0-9a-f]{3,8}|[a-z]{3,24}|(?:rgb|rgba|hsl|hsla)\(\s*[\d.%,\s/-]+\s*\))$/i;
const NOT_A_PAINT = new Set(['none', 'transparent', 'inherit', 'initial', 'unset', 'revert', 'currentcolor']);
export const isColour = (value) => { const text = String(value || '').trim(); return COLOUR_SYNTAX.test(text) && !NOT_A_PAINT.has(text.toLowerCase()); };
const normalise = (value) => String(value).trim().toLowerCase();

/**
 * Each token's colour on this mascot, read from the part that plays it.
 *
 * @param {object} document a ProjectDocument
 * @param {{ id: string, fill?: string, stroke?: string }[]} paints every element's paints, from the canvas, in document order
 * @returns {Record<string, { colour: string, id: string, property: 'fill'|'stroke' }>}
 */
export function seedTokens(document = {}, paints = []) {
  const parts = Object.values(document.semanticParts || {});
  const parents = layerParents(document.layers);
  const byId = new Map(paints.map((paint) => [paint.id, paint]));
  const inside = (ancestor, id) => { for (let at = parents[id]; at; at = parents[at]) if (at === ancestor) return true; return false; };
  const seeds = {};
  for (const rule of TOKEN_SEEDS) {
    if (seeds[rule.token]) continue;
    const id = parts.find((part) => part?.type === rule.part)?.roles?.[rule.role];
    if (!id) continue;
    const candidates = [byId.get(id), ...(rule.descend ? paints.filter((paint) => inside(id, paint.id)) : [])].filter(Boolean);
    for (const paint of candidates) {
      const property = rule.property === 'either' ? (isColour(paint.fill) ? 'fill' : 'stroke') : rule.property;
      if (!isColour(paint[property])) continue;
      seeds[rule.token] = { colour: normalise(paint[property]), id: paint.id, property };
      break;
    }
  }
  return seeds;
}

/**
 * The palette: every token with a colour on this face, and every use of it.
 *
 * A colour belongs to the first token seeded with it, in the tokens' own
 * order, so a face whose teeth happen to be painted like its eye whites
 * counts them as eye whites; the swatch changes both, which is what the
 * author painted.
 *
 * @returns {{ tokens: { token: string, label: string, colour: string, seed: object, uses: { id: string, property: string }[] }[], other: { colour: string, uses: object[] }[] }}
 */
export function derivePalette(document = {}, paints = []) {
  const seeds = seedTokens(document, paints);
  const byColour = new Map();
  for (const paint of paints) for (const property of ['fill', 'stroke']) {
    if (!isColour(paint?.[property])) continue;
    const colour = normalise(paint[property]);
    if (!byColour.has(colour)) byColour.set(colour, []);
    byColour.get(colour).push({ id: paint.id, property });
  }
  const claimed = new Set();
  const tokens = [];
  for (const token of PALETTE_TOKENS) {
    const seed = seeds[token];
    if (!seed || claimed.has(seed.colour)) continue;
    claimed.add(seed.colour);
    tokens.push({ token, label: TOKEN_LABELS[token] || token, colour: seed.colour, seed: { id: seed.id, property: seed.property }, uses: byColour.get(seed.colour) || [] });
  }
  const other = [...byColour.entries()].filter(([colour]) => !claimed.has(colour)).map(([colour, uses]) => ({ colour, uses }));
  return { tokens, other };
}

/** The writes that change one token everywhere it is used. */
export function tokenWrites(palette, token, colour) {
  const entry = palette?.tokens?.find((item) => item.token === token);
  if (!entry || !isColour(colour)) return [];
  return entry.uses.map((use) => ({ id: use.id, property: use.property, value: String(colour).trim() }));
}



/**
 * An asset's artwork painted in this face's colours.
 *
 * For every element whose paints play a token, the fill or the stroke it is
 * drawn with becomes the token's colour here; a token the face has no
 * colour for leaves the asset's own. Pure over markup: an attribute on the
 * element's open tag, replaced or added.
 *
 * @param {string} markup the fragment, ids as they will be in the document
 * @param {Record<string, { fill?: string, stroke?: string }>} paletteRoles element id → token per paint
 * @param {object} palette from {@link derivePalette}
 * @returns {{ markup: string, tinted: { id: string, property: string, token: string, colour: string }[] }}
 */
export function tintArtwork(markup, paletteRoles = {}, palette = { tokens: [] }) {
  const colours = Object.fromEntries((palette?.tokens || []).map((item) => [item.token, item.colour]));
  let out = String(markup ?? '');
  const tinted = [];
  for (const [id, roles] of Object.entries(paletteRoles || {})) {
    for (const property of ['fill', 'stroke']) {
      const token = roles?.[property], colour = token ? colours[token] : null;
      if (!colour) continue;
      const match = openTagPattern(id).exec(out);
      if (!match) continue;
      const attributes = match[2];
      const attribute = new RegExp(`(\\s${property}\\s*=\\s*)(?:"[^"]*"|'[^']*')`);
      const next = attribute.test(attributes) ? attributes.replace(attribute, `$1"${colour}"`) : `${attributes} ${property}="${colour}"`;
      out = out.slice(0, match.index) + `<${match[1]}${next}${match[3]}` + out.slice(match.index + match[0].length);
      tinted.push({ id, property, token, colour });
    }
  }
  return { markup: out, tinted };
}

/** The tokens a set of palette roles names. */
export const paletteRoleTokens = (paletteRoles = {}) => [...new Set(Object.values(paletteRoles || {}).flatMap((roles) => [roles?.fill, roles?.stroke]).filter(Boolean))];

/**
 * The tokens a drawing plays, read from its paints: every fill and stroke
 * painted in a colour the face's palette has a token for is that token, so
 * a part saved from the face comes back in whatever colours the next face
 * has (docs/FACE_PART_LIBRARY.md, "Custom parts").
 *
 * @param {{ id: string, fill?: string, stroke?: string }[]} paints the piece's paints, as the canvas describes them
 * @param {{ tokens: { token: string, colour: string }[] }} palette from {@link derivePalette}
 * @param {string[]} [ids] the ids the drawing carries; paints of other ids are left out
 * @returns {Record<string, { fill?: string, stroke?: string }>}
 */
export function paletteRolesFromPaints(paints = [], palette = { tokens: [] }, ids = null) {
  const byColour = new Map((palette?.tokens || []).map((entry) => [String(entry.colour).toLowerCase(), entry.token]));
  const allowed = ids ? new Set(ids) : null;
  const roles = {};
  for (const paint of paints || []) {
    if (!paint?.id || (allowed && !allowed.has(paint.id))) continue;
    for (const property of ['fill', 'stroke']) {
      const token = isColour(paint[property]) ? byColour.get(String(paint[property]).toLowerCase()) : null;
      if (token) (roles[paint.id] ||= {})[property] = token;
    }
  }
  return roles;
}
