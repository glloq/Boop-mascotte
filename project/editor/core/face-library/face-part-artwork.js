/**
 * An asset's artwork, made ready for a document (docs/FACE_PART_LIBRARY.md).
 *
 * Two jobs, both pure over markup. The ids inside an asset are the asset's
 * own -- every mouth in the library calls its lips `mouth` -- and a document
 * can only hold each id once, so an asset going in has its ids renamed past
 * whatever the document already draws, references included. And a thumbnail
 * is the same artwork inside its own reference box, with every id prefixed,
 * because a thumbnail lives on the same page as the canvas and an id drawn
 * twice on a page breaks the clip that names it.
 */
import { artworkIds, normalizeFacePart } from './face-part-model.js';

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rename ids in a fragment, and every reference to them inside it.
 *
 * `taken` says which ids the document already holds; a taken id becomes
 * `id-2`, `id-3`… until one is free. `rename` replaces that rule with a
 * function of the caller's own, for a thumbnail that prefixes everything.
 *
 * @param {string} markup
 * @param {{ taken?: (id: string) => boolean, rename?: ((id: string) => string)|null }} [options]
 * @returns {{ markup: string, renamed: Record<string, string> }} the fragment, and old id → new id for the ones that changed
 */
export function remapArtworkIds(markup, { taken = () => false, rename = null } = {}) {
  const ids = [...new Set(artworkIds(markup))];
  const used = new Set();
  const renamed = {};
  for (const id of ids) {
    let next = rename ? rename(id) : id;
    if (!rename) { let index = 2; while (taken(next) || used.has(next)) next = `${id}-${index++}`; }
    used.add(next);
    if (next !== id) renamed[id] = next;
  }
  let out = String(markup ?? '');
  for (const [from, to] of Object.entries(renamed)) {
    const id = escapeRegExp(from);
    out = out
      .replace(new RegExp(`(\\sid\\s*=\\s*["'])${id}(["'])`, 'g'), `$1${to}$2`)
      .replace(new RegExp(`url\\(\\s*(["']?)#${id}\\1\\s*\\)`, 'g'), `url(#${to})`)
      .replace(new RegExp(`((?:xlink:)?href\\s*=\\s*["'])#${id}(["'])`, 'g'), `$1#${to}$2`);
  }
  return { markup: out, renamed };
}

/** Every id a document's markup carries, layers, defs and clips alike. */
export const documentIds = (svgMarkup) => new Set(artworkIds(svgMarkup));

const slug = (value) => String(value).replace(/[^a-z0-9]+/gi, '-').toLowerCase();

/**
 * The asset as a small picture: its artwork in its own reference box.
 *
 * Generated from the same artwork every time (roadmap phase 23), never kept
 * as a second file that could fall behind it. The box is padded a little so
 * a stroke on the edge is not cut, and every id is prefixed so the picture
 * never answers for the mascot's own clips and gradients.
 *
 * @param {object} asset
 * @param {{ size?: number, padding?: number }} [options] size in CSS pixels, padding as a fraction of the box
 */
export function facePartThumbnail(asset, { size = 48, padding = 0.15 } = {}) {
  const normalized = normalizeFacePart(asset);
  const box = normalized.referenceBox;
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) return '';
  const side = Math.max(box.width, box.height) * (1 + padding * 2);
  const x = box.x + box.width / 2 - side / 2, y = box.y + box.height / 2 - side / 2;
  const round = (value) => Math.round(value * 100) / 100;
  const { markup } = remapArtworkIds(normalized.artwork, { rename: (id) => `thumb-${slug(normalized.id)}-${id}` });
  return `<svg class="face-part-thumb" viewBox="${round(x)} ${round(y)} ${round(side)} ${round(side)}" width="${size}" height="${size}" aria-hidden="true" focusable="false">${markup}</svg>`;
}

const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;

/**
 * Where an element with this id starts and ends in a well-formed fragment,
 * its whole subtree included, or null. For markup this library validated:
 * one element per tag, quoted attributes.
 *
 * @returns {{ start: number, end: number }|null}
 */
export function elementSpan(markup, id) {
  const text = String(markup ?? '');
  const open = new RegExp(`<([A-Za-z][\\w:-]*)((?:\\s+[\\w:-]+\\s*=\\s*(?:"[^"]*"|'[^']*'))*?\\s+id\\s*=\\s*["']${escapeRegExp(id)}["'](?:\\s+[\\w:-]+\\s*=\\s*(?:"[^"]*"|'[^']*'))*)\\s*(\\/?)>`);
  const match = open.exec(text);
  if (!match) return null;
  const start = match.index;
  if (match[3]) return { start, end: start + match[0].length };
  const scan = new RegExp(TAG.source, 'g');
  scan.lastIndex = start + match[0].length;
  let depth = 1;
  for (let found = scan.exec(text); found; found = scan.exec(text)) {
    if (found[4]) continue;
    depth += found[1] ? -1 : 1;
    if (!depth) return { start, end: found.index + found[0].length };
  }
  return null;
}

/* ── What a drawing's shapes are ──────────────────────────────────────────── */

/**
 * The attributes that *are* a shape: what an edit of its points, its curves
 * or its size changes, and a move, a turn or a resize of the whole piece --
 * its transform -- does not.
 */
const SHAPE_ATTRIBUTES = Object.freeze(['d', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height']);
const OPEN_TAG = /<([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;

/** djb2, as a short base-36 word: enough to tell one drawing from its edit. */
function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

/**
 * The shapes of some elements, and everything inside them, as one word: the
 * same word as long as nothing was reshaped, a different one once a point,
 * a curve or a size changed (docs/FACE_PART_LIBRARY.md, "Custom parts").
 * A library instance is compared with the word its install left on the
 * part; a whole-part move, turn or resize leaves the word alone.
 *
 * @param {string} markup the document's svg
 * @param {string[]} ids the roots to read, in order
 */
export function shapeSignature(markup, ids = []) {
  const text = String(markup ?? '');
  const parts = [];
  for (const id of [].concat(ids).filter(Boolean)) {
    const span = elementSpan(text, id);
    if (!span) { parts.push(`${id}:missing`); continue; }
    for (const match of text.slice(span.start, span.end).matchAll(OPEN_TAG)) {
      const attributes = match[2] || '';
      const shape = SHAPE_ATTRIBUTES.map((name) => { const found = new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`).exec(attributes); return found ? `${name}=${found[1]}` : null; }).filter(Boolean);
      if (shape.length) parts.push(`${match[1]}{${shape.join(' ')}}`);
    }
  }
  return `s${hashText(parts.join(';'))}`;
}
