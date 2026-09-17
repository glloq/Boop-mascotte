/**
 * How artwork points at an asset, in the one place both sides can import it.
 *
 * The editor's `core/assets/asset-model.js` owns what an asset *is*; this owns
 * only the reference, because the runtime needs to read one and must not
 * depend on the editor (docs/V4_ROADMAP.md, ASSET-REF).
 */
export const ASSET_SCHEME = 'asset:';
export const assetRef = (id) => `${ASSET_SCHEME}${id}`;

/**
 * The id inside an `asset:` reference, or null for anything else.
 *
 * Strict about the id's shape on purpose: a reference is a hex hash and
 * nothing else, so a value that merely starts with `asset:` cannot smuggle a
 * path, a query or a second scheme past whoever asks. That strictness is what
 * lets the sanitizer allow the scheme at all.
 */
export function parseAssetRef(value) {
  const text = String(value ?? '').trim();
  if (!text.toLowerCase().startsWith(ASSET_SCHEME)) return null;
  const id = text.slice(ASSET_SCHEME.length);
  return /^[0-9a-f]{8,64}$/.test(id) ? id : null;
}

export const isAssetRef = (value) => parseAssetRef(value) !== null;
