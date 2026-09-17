import { ASSET_MAX_DIMENSION } from './asset-model.js';

/**
 * Bringing an import inside the budget, and drawing a small version of it.
 *
 * Split in two on purpose. **Deciding** what should happen to a picture is
 * arithmetic and lives here, where the suite can check it. **Doing** it needs
 * a decoder and an encoder, which only a browser has, so that arrives as a
 * codec the caller supplies. The seam is not ceremony: the rounding is where
 * the bugs are, and rounding is exactly the part a browser is not needed for.
 *
 * The budget is the one the roadmap fixes: a logical canvas of 240, about
 * twice that in device pixels, so 512 for a normal asset
 * (docs/V4_ROADMAP.md).
 */

/** Small enough to hold hundreds of, big enough to recognise a mascot's mouth in. */
export const THUMBNAIL_MAX_DIMENSION = 96;

/**
 * The size a picture takes when made to fit a square of `max`, keeping its
 * shape. **Never larger than it came in**: an asset that is already small is
 * already right, and scaling it up would invent detail and cost bytes.
 *
 * Rounds the short side rather than flooring it, and never to zero: a 2000x3
 * banner is a strange asset but it is still two-dimensional afterwards.
 */
export function fitWithin({ width, height }, max = ASSET_MAX_DIMENSION) {
  const from = { width: Math.max(0, Math.round(Number(width) || 0)), height: Math.max(0, Math.round(Number(height) || 0)) };
  if (!from.width || !from.height) return { width: 0, height: 0, scale: 1 };
  const longest = Math.max(from.width, from.height);
  if (longest <= max) return { ...from, scale: 1 };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(from.width * scale)), height: Math.max(1, Math.round(from.height * scale)), scale };
}

/**
 * What should happen to this picture, as a decision anyone can read.
 *
 * Vector artwork is never resized: an SVG has no pixels to lose and its
 * `viewBox` is not a size, it is a coordinate system. Everything raster is
 * measured against the budget and either kept or scaled -- and the format is
 * kept either way. PNG and WebP are both first-class here, and silently
 * converting an author's file to the one we would have picked is a decision
 * that is not ours (docs/V4_ROADMAP.md).
 *
 * @returns {{ action: 'keep'|'resize', format: string, width: number, height: number, scale: number }}
 */
export function planAssetOptimisation({ format, width, height } = {}, { max = ASSET_MAX_DIMENSION } = {}) {
  if (format === 'image/svg+xml') return { action: 'keep', format, width, height, scale: 1 };
  const fitted = fitWithin({ width, height }, max);
  return { action: fitted.scale === 1 ? 'keep' : 'resize', format, ...fitted };
}

/** The same decision, for the small version shown in a library. */
export const planThumbnail = (header, { max = THUMBNAIL_MAX_DIMENSION } = {}) => fitWithin(header, max);

/**
 * Optimising and thumbnailing, given something that can decode and encode.
 *
 * `codec.draw(bytes, format, width, height)` is the whole contract: decode
 * these bytes, paint them at that size, hand back bytes in that format. A
 * caller with no codec -- Node, or a browser too old for `OffscreenCanvas` --
 * gets pictures through unchanged rather than an error, because an import
 * that is bigger than we would like is still an import that works.
 */
export function createAssetOptimiser({ codec = null, max = ASSET_MAX_DIMENSION } = {}) {
  return {
    /**
     * @returns {Promise<{bytes: Uint8Array, width: number, height: number, resized: boolean, reason: string}>}
     */
    async optimise(bytes, header) {
      const plan = planAssetOptimisation(header, { max });
      if (plan.action === 'keep') return { bytes, width: header.width, height: header.height, resized: false, reason: '' };
      if (!codec) return { bytes, width: header.width, height: header.height, resized: false, reason: 'no-codec' };
      try {
        const drawn = await codec.draw(bytes, plan.format, plan.width, plan.height);
        // A re-encode that came out bigger than the original is a re-encode
        // worth throwing away: the point was to cost less.
        if (!drawn || drawn.length >= bytes.length) return { bytes, width: header.width, height: header.height, resized: false, reason: 'no-smaller' };
        return { bytes: drawn, width: plan.width, height: plan.height, resized: true, reason: '' };
      } catch {
        return { bytes, width: header.width, height: header.height, resized: false, reason: 'codec-failed' };
      }
    },

    /** A small PNG of the picture, or null when there is nothing to draw with. */
    async thumbnail(bytes, header) {
      if (!codec) return null;
      const fitted = planThumbnail(header);
      if (!fitted.width) return null;
      try { return await codec.draw(bytes, 'image/png', fitted.width, fitted.height); } catch { return null; }
    }
  };
}

/**
 * The codec a browser can provide. Exercised in the browser, not by the suite:
 * everything decidable without one is decided above, and what is left is four
 * calls whose behaviour is the platform's.
 */
export function createBrowserCodec({ createImageBitmap: decode = globalThis.createImageBitmap, OffscreenCanvas: Canvas = globalThis.OffscreenCanvas } = {}) {
  if (!decode || !Canvas) return null;
  return {
    async draw(bytes, format, width, height) {
      const bitmap = await decode(new Blob([bytes], { type: format }));
      try {
        const canvas = new Canvas(width, height);
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvas.convertToBlob({ type: format, quality: 0.92 });
        return new Uint8Array(await blob.arrayBuffer());
      } finally { bitmap.close?.(); }
    }
  };
}
