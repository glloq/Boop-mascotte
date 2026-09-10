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
