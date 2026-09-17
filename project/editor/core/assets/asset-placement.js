import { fitWithin } from './asset-optimise.js';
import { assetRef } from '../../../runtime/asset-reference.js';

/**
 * Where a picture lands when it is added, and the node that lands there.
 *
 * Separate from the service that adds it because *where* is arithmetic and
 * arithmetic is testable, while adding involves a file, a store, a canvas and
 * a history step. The rule is the one an author would expect without being
 * told: in the middle, at its own size, small enough to see all of.
 */

/** A new picture takes at most this much of the artboard's shorter side. */
export const PLACEMENT_FRACTION = 0.6;

/**
 * The box a picture takes when it joins an artboard.
 *
 * Fitted to a fraction of the artboard rather than to the artboard itself: a
 * picture that arrives filling the frame edge to edge cannot be seen in
 * relation to anything, and the first thing its author does is shrink it.
 * Never enlarged, for the same reason a resize never enlarges -- a small
 * picture blown up to fill a frame is an author's detail thrown away.
 *
 * Rounded to halves. A whole number would drift a piece off centre by up to
 * half a pixel per add, and a raw float writes `x="53.33333333333333"` into
 * artwork somebody reads.
 */
export function placeImageInArtboard(asset, artboard = { x: 0, y: 0, width: 240, height: 240 }, { fraction = PLACEMENT_FRACTION } = {}) {
  const board = {
    x: Number(artboard?.x) || 0, y: Number(artboard?.y) || 0,
    width: Number(artboard?.width) > 0 ? Number(artboard.width) : 240,
    height: Number(artboard?.height) > 0 ? Number(artboard.height) : 240
  };
  const room = Math.max(1, Math.round(Math.min(board.width, board.height) * fraction));
  const fitted = fitWithin({ width: asset?.width, height: asset?.height }, room);
  if (!fitted.width) return null;
  const half = (value) => Math.round(value * 2) / 2;
  return {
    x: half(board.x + (board.width - fitted.width) / 2),
    y: half(board.y + (board.height - fitted.height) / 2),
    width: fitted.width, height: fitted.height
  };
}

/**
 * An id nothing in the document is using, derived from what the author called
 * the file.
 *
 * Their own name, because they will read it in the layer list and in the rig,
 * and `image-3` tells them nothing about which picture it is.
 */
export function imageNodeId(name, taken = new Set()) {
  const base = String(name || 'picture').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'picture';
  const start = /^[a-z]/.test(base) ? base : `picture-${base}`;
  if (!taken.has(start)) return start;
  for (let suffix = 2; ; suffix += 1) { const candidate = `${start}-${suffix}`; if (!taken.has(candidate)) return candidate; }
}

const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** The node itself. `asset:` and not the bytes, always (docs/V4_ROADMAP.md, ASSET-REF). */
export function imageNodeMarkup({ id, assetId, box }) {
  return `<image id="${escapeAttribute(id)}" href="${escapeAttribute(assetRef(assetId))}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet"/>`;
}
