import { assetRef, normalizeAsset, parseAssetRef } from './asset-model.js';
import { validateAssetBytes } from './asset-validate.js';

/**
 * Importing assets, and knowing which of them anything still points at.
 *
 * **References are derived from the document, never counted by hand.** The
 * plan called for `retain` and `release`; an editor with undo cannot have
 * them. Undo restores a whole document in one step (`core/undo/history.js`),
 * and a hand-kept count would have to be replayed backwards alongside it --
 * every command that ever touched a reference getting the bookkeeping exactly
 * right, for ever. Reading the references *out of* the document instead makes
 * the count a function of the state it describes, so it cannot drift, and undo
 * costs nothing.
 *
 * **Duplicates cannot exist.** The plan also called for `findDuplicates`.
 * With the id being the hash of the bytes (`asset-model.js`), importing the
 * same picture twice reaches the same record: there is nothing to find. What
 * remains is the useful half -- telling the author their import was already
 * here -- and `import` reports that as `stored: false`. Two *visually* alike
 * pictures with different bytes are a different question entirely, needing
 * perceptual hashing, and nothing here pretends to answer it.
 *
 * **Replacing artwork is not an asset operation.** Swapping the picture on a
 * node changes which id that node points at; the asset it pointed at before
 * is untouched, and may well still be used by something else. So that lives
 * with the node command (V4-032), and all this side needs is `import`.
 */

/** 64 bits of SHA-256, hex. Enough that a project will never see a collision, short enough to read. */
export const ASSET_ID_LENGTH = 16;

export async function hashAssetBytes(bytes, { subtle = globalThis.crypto?.subtle } = {}) {
  if (!subtle) throw new Error('No SubtleCrypto: an asset cannot be named without hashing it.');
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await subtle.digest('SHA-256', source);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, ASSET_ID_LENGTH);
}

/**
 * Every asset id the document points at.
 *
 * Two places, because artwork has two: the markup, where a raster node carries
 * `href="asset:…"`, and the element records, where a future field may hold an
 * id directly. Scanning both means neither has to remember to tell anyone.
 */
export function assetReferencesIn(document = {}) {
  const found = new Set();
  for (const match of String(document.svgMarkup ?? '').matchAll(/asset:[0-9a-f]{8,64}/gi)) {
    const id = parseAssetRef(match[0]);
    if (id) found.add(id);
  }
  const walk = (value, depth = 0) => {
    if (depth > 8 || value == null) return;
    if (typeof value === 'string') { const id = parseAssetRef(value); if (id) found.add(id); return; }
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    if (typeof value === 'object') for (const item of Object.values(value)) walk(item, depth + 1);
  };
  walk(document.elements);
  return found;
}

/** Assets the table holds that nothing points at. */
export const unusedAssets = (document = {}) => {
  const used = assetReferencesIn(document);
  return Object.keys(document.assets || {}).filter((id) => !used.has(id)).sort();
};

/**
 * Ids the artwork points at that the table has no record of.
 *
 * A project in this state is one that will paint holes, and it is worth
 * saying so loudly: it means a file was assembled by hand, a package lost
 * part of itself, or an edit dropped a record it should not have.
 */
export const missingAssets = (document = {}) => {
  const table = document.assets || {};
  return [...assetReferencesIn(document)].filter((id) => !table[id]).sort();
};

export function createAssetManager({ store, hash = hashAssetBytes, now = () => new Date().toISOString() }) {
  return {
    /**
     * Bytes in, an asset record out -- or a refusal with the reason.
     *
     * The bytes are validated before they are hashed and stored: nothing
     * reaches the store that is not going to become an asset.
     *
     * @returns {Promise<{ok: boolean, asset: object|null, stored: boolean, issues: object[]}>}
     */
    async import(bytes, { name = '', type = '' } = {}) {
      const checked = validateAssetBytes(bytes, { name, declaredType: type });
      if (!checked.ok) return { ok: false, asset: null, stored: false, issues: checked.issues };
      const id = await hash(bytes);
      const held = await store.put(id, bytes);
      const asset = normalizeAsset({
        id, format: checked.format, width: checked.width, height: checked.height,
        alpha: checked.alpha, bytes: held.bytes, name, importedAt: now()
      });
      // `stored: false` is the duplicate case, and the useful thing to say
      // about it: the author already had this picture.
      return { ok: true, asset, stored: held.stored, issues: checked.issues };
    },

    /** The bytes behind an id, or null. Painting them is the resolver's job, not this one's. */
    bytes: (id) => store.get(id),

    reference: assetRef,
    referencesIn: assetReferencesIn,
    unusedIn: unusedAssets,
    missingIn: missingAssets,

    /**
     * Drop every asset nothing points at, records and bytes together.
     *
     * Deliberately takes the document rather than working from its own idea of
     * what is live: collection is only ever correct against a *particular*
     * state, and taking it as an argument is what stops this being run against
     * a stale one. It returns the table to keep rather than mutating anything,
     * because the document is the store's to change, not this one's.
     *
     * @returns {Promise<{assets: object, removed: string[]}>}
     */
    async collect(document = {}) {
      const removed = unusedAssets(document);
      if (!removed.length) return { assets: document.assets || {}, removed };
      const assets = { ...(document.assets || {}) };
      for (const id of removed) { delete assets[id]; await store.remove(id); }
      return { assets, removed };
    }
  };
}
