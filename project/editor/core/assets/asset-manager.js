import { assetRef, normalizeAsset, parseAssetRef } from './asset-model.js';
import { validateAssetBytes } from './asset-validate.js';
import { createAssetOptimiser } from './asset-optimise.js';

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

/**
 * Bytes as the store keeps them: a `Blob`, carrying the format.
 *
 * Not a detail. What finally paints a picture is
 * `URL.createObjectURL(blob)`, and that takes a `Blob` and nothing else --
 * handed a `Uint8Array` it throws `Overload resolution failed`, which is a
 * sentence nobody traces back to a missing wrapper. And the type matters as
 * much as the wrapper: an object URL with no MIME type leaves the browser
 * sniffing at bytes it was told nothing about.
 *
 * This existed as a bug for six commits because every test wrote
 * `new Blob([...])` into the store by hand while the manager wrote a
 * `Uint8Array`. The fixtures were more correct than the code they were
 * checking, so they agreed with each other and with nothing real.
 */
const asBlob = (bytes, type) => (bytes instanceof Blob ? bytes : new Blob([bytes], type ? { type } : undefined));

/** And back again, for hashing and for writing into a package. */
const asBytes = async (value) => (value instanceof Blob ? new Uint8Array(await value.arrayBuffer()) : (value ? new Uint8Array(value) : null));

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

export function createAssetManager({ store, hash = hashAssetBytes, optimiser = createAssetOptimiser(), now = () => new Date().toISOString() }) {
  return {
    /**
     * Bytes in, an asset record out -- or a refusal with the reason.
     *
     * Validated, then brought inside the budget, then hashed, and in that
     * order: the id names the bytes that are *kept*, so resizing after hashing
     * would leave every reference pointing at a picture nobody has. It also
     * means two authors who import the same oversized original end up sharing
     * one asset, because they resize to the same bytes.
     *
     * @returns {Promise<{ok: boolean, asset: object|null, stored: boolean, issues: object[]}>}
     */
    async import(bytes, { name = '', type = '' } = {}) {
      const checked = validateAssetBytes(bytes, { name, declaredType: type });
      if (!checked.ok) return { ok: false, asset: null, stored: false, issues: checked.issues };
      const fitted = await optimiser.optimise(bytes, checked);
      // Only worth saying when it did not happen: an import the author was
      // told would be resized, and then was not, is a surprise otherwise.
      const issues = fitted.resized || !fitted.reason ? checked.issues : [...checked.issues, { code: 'not-resized', detail: fitted.reason }];
      const id = await hash(fitted.bytes);
      const held = await store.put(id, asBlob(fitted.bytes, checked.format));
      const asset = normalizeAsset({
        id, format: checked.format, width: fitted.width, height: fitted.height,
        alpha: checked.alpha, bytes: held.bytes, name, importedAt: now()
      });
      // `stored: false` is the duplicate case, and the useful thing to say
      // about it: the author already had this picture.
      return { ok: true, asset, stored: held.stored, issues };
    },

    /**
     * The bytes behind an id as a `Uint8Array`, or null -- for hashing and for
     * writing into a package. Painting is the resolver's job, and it takes the
     * `Blob` straight from the store.
     */
    bytes: async (id) => asBytes(await store.get(id)),

    /**
     * Take in bytes that are already named -- a package being opened.
     *
     * Not `import`: importing validates, *resizes* and then names, and a
     * resize would produce different bytes and therefore a different id,
     * leaving every reference in the file pointing at a picture that no longer
     * exists. What a package needs is the opposite operation: the name is
     * given and what is checked is that the bytes deserve it.
     *
     * @param {string} id the name the package gave them
     * @param {Uint8Array|Blob} bytes
     * @param {string} [format] the MIME type to keep them under, so that what
     *   paints them later is told what it is looking at
     * @returns {Promise<boolean>} false when the bytes are not what the id says
     */
    async adopt(id, bytes, format = '') {
      const raw = await asBytes(bytes);
      if (!raw || await hash(raw) !== id) return false;
      await store.put(id, asBlob(raw, format));
      return true;
    },

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
