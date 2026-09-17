/**
 * Where an asset's bytes live: keyed by the hash that names them.
 *
 * Deliberately not the document. A binary inside `ProjectDocument` is a binary
 * `structuredClone`d up to a hundred times by undo and re-serialized by every
 * autosave (docs/V4_ROADMAP.md, ASSET-REF), so the document holds records and
 * this holds bytes, and the two are joined by an id.
 *
 * Content-addressed, which decides the semantics: a `put` of an id already
 * held is not an overwrite but a no-op, because the same id cannot name
 * different bytes. Callers get told whether it was new, so a duplicated import
 * can say "you already had this".
 *
 * **Persistence is reported, never assumed.** A browser in private mode, with
 * site data blocked, or a Node test has no usable IndexedDB, and silently
 * falling back to memory would mean autosave quietly stopping at the images
 * while claiming to have saved. So a memory store says `persistent: false`
 * and why, and the caller decides what to tell the author.
 */

export const ASSET_DB_NAME = 'boop-mascotte-assets';
export const ASSET_DB_VERSION = 1;
export const ASSET_STORE_NAME = 'assets';

const sizeOf = (blob) => Number(blob?.size ?? blob?.byteLength ?? 0) || 0;

/**
 * The store every implementation has to provide. Written once, here, so the
 * memory one and the IndexedDB one cannot drift into different contracts.
 *
 * @typedef {object} AssetStore
 * @property {boolean} persistent whether bytes survive the tab closing
 * @property {string} reason why not, when they do not
 * @property {(id: string, blob: Blob) => Promise<{ id: string, bytes: number, stored: boolean }>} put
 * @property {(id: string) => Promise<Blob|null>} get
 * @property {(id: string) => Promise<boolean>} has
 * @property {(id: string) => Promise<boolean>} remove
 * @property {() => Promise<string[]>} keys
 * @property {() => Promise<number>} bytes total held, for budgets and for saying how much
 * @property {() => Promise<void>} clear
 */

/** Bytes for as long as the tab is open. The fallback, and what tests run on. */
export function createMemoryAssetStore({ reason = 'memory' } = {}) {
  const held = new Map();
  return {
    persistent: false,
    reason,
    async put(id, blob) {
      if (held.has(id)) return { id, bytes: held.get(id).bytes, stored: false };
      held.set(id, { blob, bytes: sizeOf(blob) });
      return { id, bytes: sizeOf(blob), stored: true };
    },
    async get(id) { return held.get(id)?.blob ?? null; },
    async has(id) { return held.has(id); },
    async remove(id) { return held.delete(id); },
    async keys() { return [...held.keys()]; },
    async bytes() { let total = 0; for (const record of held.values()) total += record.bytes; return total; },
    async clear() { held.clear(); }
  };
}

/** One IndexedDB request as a promise, because the whole API is one shape. */
const request = (source) => new Promise((resolve, reject) => {
  source.onsuccess = () => resolve(source.result);
  source.onerror = () => reject(source.error || new Error('IndexedDB request failed'));
});

export function openAssetDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(ASSET_DB_NAME, ASSET_DB_VERSION);
    opening.onupgradeneeded = () => {
      const database = opening.result;
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) database.createObjectStore(ASSET_STORE_NAME, { keyPath: 'id' });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error || new Error('IndexedDB could not be opened'));
    opening.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

export function createIndexedDbAssetStore(database) {
  /**
   * One transaction's worth of work.
   *
   * A read is done once its request is. A write is only done once the
   * transaction *commits* -- a quota failure arrives as an abort after the
   * request has already succeeded -- so a write waits for both.
   *
   * The completion handlers are attached before any `await`, and that ordering
   * is load-bearing rather than tidy: an IndexedDB transaction commits by
   * itself as soon as the microtask queue drains without a new request, so a
   * handler attached after awaiting the request can be attached to a
   * transaction that has already finished, and then nothing ever resolves.
   */
  const run = (mode, work) => {
    const transaction = database.transaction(ASSET_STORE_NAME, mode);
    const committed = mode !== 'readwrite' ? null : new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB write failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB write was aborted'));
    });
    const result = Promise.resolve().then(() => work(transaction.objectStore(ASSET_STORE_NAME)));
    if (!committed) return result;
    // Both are awaited, and whichever fails first is the failure. Each is also
    // given a sink so the one that loses the race is never an unhandled
    // rejection.
    result.catch(() => {}); committed.catch(() => {});
    return Promise.all([result, committed]).then(([value]) => value);
  };

  return {
    persistent: true,
    reason: '',
    async put(id, blob) {
      const bytes = sizeOf(blob);
      // Read then write, in two transactions. The gap between them is not a
      // race worth closing: the store is content-addressed, so the worst a
      // concurrent put can do is write the same bytes to the same key.
      const existing = await run('readonly', (store) => request(store.get(id)));
      if (existing) return { id, bytes: existing.bytes ?? bytes, stored: false };
      await run('readwrite', (store) => request(store.put({ id, blob, bytes, storedAt: new Date().toISOString() })));
      return { id, bytes, stored: true };
    },
    async get(id) { return (await run('readonly', (store) => request(store.get(id))))?.blob ?? null; },
    async has(id) { return Boolean(await run('readonly', (store) => request(store.get(id)))); },
    async remove(id) {
      const existed = await this.has(id);
      if (existed) await run('readwrite', (store) => request(store.delete(id)));
      return existed;
    },
    async keys() { return await run('readonly', (store) => request(store.getAllKeys())); },
    async bytes() {
      const all = await run('readonly', (store) => request(store.getAll()));
      return all.reduce((total, record) => total + (Number(record.bytes) || 0), 0);
    },
    async clear() { await run('readwrite', (store) => request(store.clear())); }
  };
}

/**
 * The store this environment can actually give, with persistence reported.
 *
 * Never throws: a browser that refuses IndexedDB still has to let someone work
 * on a mascot, it just cannot promise the pictures survive the tab. What it
 * must not do is pretend otherwise, which is what `persistent` is for.
 */
export async function openAssetStore({ indexedDB = globalThis.indexedDB } = {}) {
  if (!indexedDB) return createMemoryAssetStore({ reason: 'no-indexeddb' });
  try { return createIndexedDbAssetStore(await openAssetDatabase(indexedDB)); }
  catch { return createMemoryAssetStore({ reason: 'indexeddb-unavailable' }); }
}
