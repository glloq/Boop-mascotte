/**
 * What an asset is, and how artwork points at one.
 *
 * The rule the whole raster program rests on (docs/V4_ROADMAP.md, ASSET-REF):
 * **artwork never carries a binary**. A raster node is
 * `<image href="asset:7f3c…">`, and the id is resolved to something a browser
 * can paint at the moment of painting, nowhere else. That keeps the
 * sanitizer's rule literally true, keeps undo's `structuredClone` cheap, keeps
 * the autosave snapshot JSON, and makes a `.boop` portable, because the
 * reference is not a path.
 *
 * **The id is the content hash.** Not a field beside one: deduplicating by
 * hash and addressing by id are the same question, and two fields holding the
 * same answer is a pair that drifts. So importing the same bytes twice gives
 * the same asset, and a reference means exactly one sequence of bytes on every
 * machine that opens the project.
 *
 * Nothing else is stored that can be derived. `kind` is a function of
 * `format`; where the bytes live is a function of the id.
 */

/** Everything an asset may be. JPG is an import to convert, never a stored asset. */
export const ASSET_FORMATS = Object.freeze(['image/svg+xml', 'image/png', 'image/webp']);

/** The budget an asset is normally kept inside (docs/V4_ROADMAP.md). */
export const ASSET_MAX_DIMENSION = 512;

export const assetKind = (asset) => (asset?.format === 'image/svg+xml' ? 'vector' : 'raster');

/** `asset:<id>` — internal by construction, which is what makes it sanitizable. */
export const ASSET_SCHEME = 'asset:';
export const assetRef = (id) => `${ASSET_SCHEME}${id}`;

/**
 * The id inside an `asset:` reference, or null for anything else.
 *
 * Deliberately strict about the id's shape: a reference is a hex hash and
 * nothing else, so a value that merely starts with `asset:` cannot smuggle a
 * path, a query or a second scheme past whoever asks this question.
 */
export function parseAssetRef(value) {
  const text = String(value ?? '').trim();
  if (!text.toLowerCase().startsWith(ASSET_SCHEME)) return null;
  const id = text.slice(ASSET_SCHEME.length);
  return /^[0-9a-f]{8,64}$/.test(id) ? id : null;
}

export const isAssetRef = (value) => parseAssetRef(value) !== null;

const positiveInteger = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : 0);

/**
 * One asset record, or null when the candidate is not one.
 *
 * Null rather than a repaired record on purpose: an asset whose id, format or
 * size cannot be trusted is an asset nothing should paint, and quietly giving
 * it a size of zero would put a broken reference into a document instead of
 * keeping it out.
 */
export function normalizeAsset(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const id = String(candidate.id ?? '').toLowerCase();
  if (!/^[0-9a-f]{8,64}$/.test(id)) return null;
  if (!ASSET_FORMATS.includes(candidate.format)) return null;
  const width = positiveInteger(candidate.width), height = positiveInteger(candidate.height);
  if (!width || !height) return null;
  return {
    id, format: candidate.format, width, height,
    // Whether the format carries an alpha channel at all -- not whether any
    // pixel actually uses it. That stronger question needs every pixel read,
    // and this one is answered by the header: a canvas writes RGBA whatever it
    // drew, so an opaque PNG still says true while lossy WebP says false.
    // Enough to know that something behind *may* show through.
    alpha: Boolean(candidate.alpha),
    bytes: positiveInteger(candidate.bytes),
    // What the author called it. Free text, for the library and for nothing else.
    name: typeof candidate.name === 'string' ? candidate.name : '',
    importedAt: typeof candidate.importedAt === 'string' ? candidate.importedAt : ''
  };
}

/**
 * The asset table a document carries: id → record, and never the bytes.
 *
 * Anything that does not normalize is dropped rather than kept as it was. A
 * table is read to decide what to paint and what to collect, and a member of
 * it that is not an asset can do neither.
 */
export function normalizeAssets(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    const asset = normalizeAsset(value);
    // The table is keyed by the id, so a key that disagrees with the record it
    // holds is a table that cannot be looked up in. The record wins.
    if (asset && (key === asset.id)) out[asset.id] = asset;
  }
  return out;
}
