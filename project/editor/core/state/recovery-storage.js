/**
 * Where the local draft lives, once a draft can contain pictures.
 *
 * The record itself never held bytes and still does not: a snapshot references
 * assets by id and the pictures live in their own store
 * (docs/V4_ROADMAP.md, ASSET-REF). What it did hold was everything else, in
 * `localStorage`, which is a few megabytes of *string* shared with every other
 * thing the page keeps -- and a mascot's worth of rig, keyforms, clips and
 * markup is not small. A draft that silently stops being written is the worst
 * kind of autosave.
 *
 * **Synchronous in, asynchronous out.** IndexedDB is asynchronous and the
 * autosave service is not: it reads the record while rendering and writes it
 * from a timer. Rewriting that to await would turn a storage change into a
 * lifecycle change. So this is a write-through cache -- the record is held in
 * memory, reads are from memory, and writes go to IndexedDB behind them. The
 * one await is `open`, before the editor asks anything.
 *
 * It keeps `localStorage`'s three-method shape on purpose, so the service
 * cannot tell which it got, and so a browser with no IndexedDB can be handed
 * the real `localStorage` and carry on as before.
 */

export const RECOVERY_DB_NAME = 'boop-mascotte-recovery';
export const RECOVERY_DB_VERSION = 1;
export const RECOVERY_STORE_NAME = 'drafts';

const request = (source) => new Promise((resolve, reject) => {
  source.onsuccess = () => resolve(source.result);
  source.onerror = () => reject(source.error || new Error('IndexedDB request failed'));
});

function openDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(RECOVERY_DB_NAME, RECOVERY_DB_VERSION);
    opening.onupgradeneeded = () => {
      const database = opening.result;
      if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) database.createObjectStore(RECOVERY_STORE_NAME, { keyPath: 'id' });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error || new Error('IndexedDB could not be opened'));
    opening.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

/**
 * @returns {Promise<{getItem: Function, setItem: Function, removeItem: Function, persistent: boolean, reason: string, settled: Function}>}
 */
export async function openRecoveryStorage({ indexedDB = globalThis.indexedDB, fallback = globalThis.localStorage, timeout = 2000 } = {}) {
  if (!indexedDB) return fallback ?? null;

  let database;
  try {
    // Raced, because the editor waits on this to know whether it has a draft
    // to offer, and an IndexedDB that never answers -- another tab holding an
    // older version, a profile in a strange state -- would be an editor that
    // never appears. A slow answer costs a draft; no editor costs everything.
    database = await Promise.race([
      openDatabase(indexedDB),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('IndexedDB did not answer')), timeout))
    ]);
  } catch { return fallback ?? null; }

  const run = (mode, work) => {
    const transaction = database.transaction(RECOVERY_STORE_NAME, mode);
    const committed = mode !== 'readwrite' ? null : new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB write failed'));
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB write was aborted'));
    });
    const result = Promise.resolve().then(() => work(transaction.objectStore(RECOVERY_STORE_NAME)));
    if (!committed) return result;
    result.catch(() => {}); committed.catch(() => {});
    return Promise.all([result, committed]).then(([value]) => value);
  };

  /** key -> value, read once at open and kept true by every write after. */
  const held = new Map();
  for (const record of (await run('readonly', (store) => request(store.getAll()))) || []) held.set(record.id, record.value);

  // A draft written by a version that used `localStorage` is still that
  // author's work: it is taken over on the way past rather than left behind
  // for them to lose.
  if (fallback) {
    for (const index of Array.from({ length: fallback.length ?? 0 }, (unused, at) => at)) {
      const key = fallback.key?.(index);
      if (!key?.startsWith('boop-mascotte-') || held.has(key)) continue;
      const value = fallback.getItem(key);
      if (typeof value === 'string') { held.set(key, value); run('readwrite', (store) => request(store.put({ id: key, value }))).catch(() => {}); }
    }
  }

  // The last write's failure, reported on the *next* write. A write-through
  // cache cannot fail synchronously, and the service's "autosave unavailable"
  // warning is worth keeping, so it arrives one write late rather than never.
  let failure = null;
  let pending = Promise.resolve();
  const behind = (work) => { pending = pending.then(work).then(() => { failure = null; }, (error) => { failure = error; }); return pending; };

  return {
    persistent: true,
    reason: '',
    getItem: (key) => (held.has(key) ? held.get(key) : null),
    setItem(key, value) {
      if (failure) { const error = failure; failure = null; throw error; }
      held.set(key, String(value));
      behind(() => run('readwrite', (store) => request(store.put({ id: key, value: String(value) }))));
    },
    removeItem(key) {
      held.delete(key);
      behind(() => run('readwrite', (store) => request(store.delete(key))));
    },
    /** For tests and for shutdown: when everything queued has actually landed. */
    settled: () => pending
  };
}
