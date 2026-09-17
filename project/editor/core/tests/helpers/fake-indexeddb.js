/**
 * Enough IndexedDB to run the real store against, in Node.
 *
 * Not a polyfill and not trying to be: it implements the handful of shapes
 * `asset-store.js` actually uses -- `open` with an upgrade, a keyPath object
 * store, `get` / `put` / `delete` / `clear` / `getAll` / `getAllKeys`, and a
 * transaction that completes or aborts. The point is that the IndexedDB path
 * is exercised by the suite rather than first run in a browser, including the
 * two failures that matter: a request that errors, and a write that aborts
 * because the quota is gone.
 *
 * Requests resolve on a later turn, like the real thing, so code that forgets
 * to wait fails here too.
 */
const later = (fn) => queueMicrotask(fn);

class FakeRequest {
  constructor() { this.result = undefined; this.error = null; this.onsuccess = null; this.onerror = null; }
  succeed(result) { this.result = result; later(() => this.onsuccess?.()); }
  fail(error) { this.error = error; later(() => this.onerror?.()); }
}

class FakeObjectStore {
  constructor(records, transaction) { this.records = records; this.transaction = transaction; }
  #request(work) {
    const request = new FakeRequest();
    this.transaction.pending += 1;
    later(() => {
      if (this.transaction.aborted) { this.transaction.settle(); return request.fail(this.transaction.error); }
      try { request.succeed(work()); } catch (error) { this.transaction.abort(error); request.fail(error); }
      this.transaction.settle();
    });
    return request;
  }
  get(id) { return this.#request(() => this.records.get(id)); }
  put(record) { return this.#request(() => { this.transaction.guard(record); this.records.set(record.id, record); return record.id; }); }
  delete(id) { return this.#request(() => { this.records.delete(id); return undefined; }); }
  clear() { return this.#request(() => { this.records.clear(); return undefined; }); }
  getAll() { return this.#request(() => [...this.records.values()]); }
  getAllKeys() { return this.#request(() => [...this.records.keys()]); }
}

class FakeTransaction {
  constructor(database, mode) {
    this.database = database; this.mode = mode; this.aborted = false; this.done = false; this.error = null;
    this.pending = 0;
    this.oncomplete = null; this.onerror = null; this.onabort = null;
    // Like the real thing: the transaction commits by itself once the
    // microtask queue drains with nothing outstanding. Waiting a turn first
    // gives the caller its chance to queue a request at all.
    later(() => this.settle());
  }
  settle() {
    if (this.pending) this.pending -= 1;
    later(() => { if (!this.done && !this.aborted && !this.pending) { this.done = true; this.oncomplete?.(); } });
  }
  guard(record) { this.database.beforeWrite?.(record); }
  abort(error) {
    if (this.done) return;
    this.done = true; this.aborted = true; this.error = error;
    later(() => { this.onerror?.(); this.onabort?.(); });
  }
  objectStore() { return new FakeObjectStore(this.database.records, this); }
}

class FakeDatabase {
  constructor() { this.records = new Map(); this.objectStoreNames = { contains: (name) => this.created.has(name) }; this.created = new Set(); this.beforeWrite = null; }
  createObjectStore(name) { this.created.add(name); return new FakeObjectStore(this.records, new FakeTransaction(this, 'versionchange')); }
  transaction(_name, mode) { return new FakeTransaction(this, mode); }
}

/**
 * @param {object} options
 * @param {'error'|'blocked'|null} options.openAs how `open` should fail, if it should
 * @param {(record: object) => void} options.beforeWrite throw from here to simulate a quota failure
 */
export function createFakeIndexedDb({ openAs = null, beforeWrite = null } = {}) {
  const database = new FakeDatabase();
  database.beforeWrite = beforeWrite;
  return {
    database,
    open() {
      const opening = { result: database, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      later(() => {
        if (openAs === 'error') { opening.error = new Error('refused'); return opening.onerror?.(); }
        if (openAs === 'blocked') return opening.onblocked?.();
        opening.onupgradeneeded?.();
        opening.onsuccess?.();
      });
      return opening;
    }
  };
}
