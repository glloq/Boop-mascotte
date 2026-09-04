import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosaveService } from '../../app/services/autosave-service.js';
import { AUTOSAVE_KEY } from '../state/local-recovery.js';

// A Map behind the localStorage surface the service actually uses. `fail` turns
// a full or disabled browser storage into a deterministic failure.
const createStorage = (fail = {}) => {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => { if (fail.read) throw new Error('blocked'); return entries.has(key) ? entries.get(key) : null; },
    setItem: (key, value) => { if (fail.write) throw new Error('quota exceeded'); entries.set(key, value); },
    removeItem: (key) => { if (fail.remove) throw new Error('blocked'); entries.delete(key); }
  };
};

// Fake clock: scheduled callbacks are collected and run by hand, so the debounce
// is observable without waiting 500 ms and without a real timer queue.
const createHarness = ({ storage = createStorage(), ...overrides } = {}) => {
  const timers = [], shell = { dirty: [], status: [], recovery: [] };
  const diagnostics = { counts: {}, increment(path) { diagnostics.counts[path] = (diagnostics.counts[path] || 0) + 1; } };
  let edits = 0, documentState = { svgMarkup: '<svg><circle/></svg>' };
  const service = createAutosaveService({
    store: { getDocumentVersionToken: () => `v${edits}`, getState: () => documentState },
    storage,
    serializeSvg: () => documentState.svgMarkup,
    // Stands in for prepareProjectSnapshot: it rejects records the editor could not load.
    prepareSnapshot: (snapshot) => { if (snapshot?.version !== 3) throw new Error('unsupported'); return structuredClone(snapshot); },
    createSnapshot: (state, serializeSvg) => ({ version: 3, document: { svgMarkup: serializeSvg(), token: `v${edits}`, layers: state.layers || [] } }),
    diagnostics,
    setDirty: (dirty, autosaved = false) => shell.dirty.push([dirty, autosaved]),
    setStatus: (message, tone) => shell.status.push([message, tone]),
    setRecoveryState: (recovery) => shell.recovery.push(recovery),
    setTimeout: (callback, ms) => timers.push({ callback, ms, live: true }),
    clearTimeout: (handle) => { const entry = timers[handle - 1]; if (entry) entry.live = false; },
    ...overrides
  });
  return {
    service, storage, timers, diagnostics, shell,
    edit: () => { edits += 1; },
    runTimers: () => { for (const entry of timers) { if (!entry.live) continue; entry.live = false; entry.callback(); } },
    record: () => (storage.entries.has(AUTOSAVE_KEY) ? JSON.parse(storage.entries.get(AUTOSAVE_KEY)) : null)
  };
};

test('a schedule on an unchanged document reports the project clean and writes nothing', () => {
  const harness = createHarness();
  harness.service.schedule();
  assert.deepEqual(harness.shell.dirty, [[false, false]]);
  assert.deepEqual(harness.timers, []);
  assert.deepEqual(harness.diagnostics.counts, {});
  assert.equal(harness.service.isDirty(), false);
  assert.equal(harness.service.getStatus(), 'idle');
  assert.equal(harness.record(), null);
});

test('several edits inside the debounce window collapse into one recovery write', () => {
  const harness = createHarness();
  for (let index = 0; index < 3; index++) { harness.edit(); harness.service.schedule(); }
  assert.equal(harness.timers.length, 3);
  assert.deepEqual(harness.timers.map(entry => entry.live), [false, false, true]);
  assert.deepEqual(harness.timers.map(entry => entry.ms), [500, 500, 500]);
  assert.equal(harness.service.getStatus(), 'pending');
  harness.runTimers();
  assert.equal(harness.record().projectSnapshot.document.token, 'v3');
  assert.equal(harness.service.getStatus(), 'saved');
  // Still dirty after an autosave: local recovery is not a saved project.
  assert.deepEqual(harness.shell.dirty, [[true, false], [true, false], [true, false], [true, true]]);
  assert.deepEqual(harness.shell.recovery.map(state => state.status), ['available']);
  assert.equal(harness.service.isDirty(), true);
});

test('a storage that refuses the write warns and does not throw out of the timer', () => {
  const harness = createHarness({ storage: createStorage({ write: true }) });
  harness.edit();
  harness.service.schedule();
  assert.doesNotThrow(() => harness.runTimers());
  assert.deepEqual(harness.shell.status, [['Autosave unavailable (browser storage is full or disabled).', 'warn']]);
  assert.equal(harness.record(), null);
  assert.deepEqual(harness.shell.recovery, []);
  // The failed attempt is not counted as a write and the state stays dirty.
  assert.deepEqual(harness.diagnostics.counts, { 'autosave.schedules': 1 });
  assert.equal(harness.service.getStatus(), 'pending');
  assert.equal(harness.service.isDirty(), true);
});

test('markSaved cancels a pending write, clears dirty state and discards recovery', () => {
  const harness = createHarness();
  harness.edit(); harness.service.schedule(); harness.runTimers();
  assert.notEqual(harness.record(), null);

  harness.edit(); harness.service.schedule();
  harness.service.markSaved();
  harness.runTimers();
  assert.equal(harness.record(), null);
  assert.equal(harness.service.isDirty(), false);
  assert.equal(harness.service.getStatus(), 'idle');
  assert.deepEqual(harness.shell.recovery.map(state => state.status), ['available', 'none']);
  assert.deepEqual(harness.shell.dirty.at(-1), [false, false]);
  assert.deepEqual(harness.diagnostics.counts, { 'autosave.schedules': 2, 'autosave.writes': 1 });

  // The baseline moved with the save, so the same document is no longer dirty.
  harness.service.schedule();
  assert.equal(harness.service.isDirty(), false);
  assert.equal(harness.timers.length, 2);
});

test('markSaved with keepRecovery leaves the record in place for the restore path', () => {
  const harness = createHarness();
  harness.edit(); harness.service.schedule(); harness.runTimers();
  harness.edit();
  harness.service.markSaved({ keepRecovery: true });
  assert.equal(harness.record().projectSnapshot.document.token, 'v1');
  assert.equal(harness.service.isDirty(), false);
  assert.equal(harness.service.getStatus(), 'idle');
  assert.deepEqual(harness.shell.recovery.map(state => state.status), ['available']);
});

test('the lifecycle counters increment once per schedule and once per successful write', () => {
  const harness = createHarness();
  harness.service.schedule();
  harness.edit(); harness.service.schedule();
  harness.edit(); harness.service.schedule();
  assert.deepEqual(harness.diagnostics.counts, { 'autosave.schedules': 2 });
  harness.runTimers();
  assert.deepEqual(harness.diagnostics.counts, { 'autosave.schedules': 2, 'autosave.writes': 1 });
  harness.service.cancel();
  harness.service.schedule();
  assert.deepEqual(harness.diagnostics.counts, { 'autosave.schedules': 3, 'autosave.writes': 1 });
});

test('cancel stops the pending write and returns the service to idle', () => {
  const harness = createHarness();
  harness.edit(); harness.service.schedule();
  harness.service.cancel();
  harness.runTimers();
  assert.equal(harness.record(), null);
  assert.equal(harness.service.getStatus(), 'idle');
  // Cancelling reports nothing to the shell; only the dirty flag from schedule remains.
  assert.deepEqual(harness.shell.dirty, [[true, false]]);
});

test('recovery reads report none, then available, and a refused discard warns', () => {
  const harness = createHarness();
  assert.equal(harness.service.getRecoveryState().status, 'none');
  harness.edit(); harness.service.schedule(); harness.runTimers();
  const recovery = harness.service.getRecoveryState();
  assert.equal(recovery.status, 'available');
  assert.equal(recovery.snapshot.document.token, 'v1');
  harness.service.refreshRecovery();
  assert.deepEqual(harness.shell.recovery.map(state => state.status), ['available', 'available']);

  const blocked = createHarness({ storage: createStorage({ remove: true }) });
  blocked.service.discardRecovery();
  assert.deepEqual(blocked.shell.status, [['Browser storage is unavailable. Automatic local recovery may not work.', 'warn']]);
  assert.deepEqual(blocked.shell.recovery.map(state => state.status), ['none']);
});

test('a restored document can be marked dirty without a document change', () => {
  const harness = createHarness();
  harness.edit();
  harness.service.markSaved({ keepRecovery: true });
  harness.service.markDirty();
  assert.equal(harness.service.isDirty(), true);
  assert.deepEqual(harness.shell.dirty.at(-1), [true, false]);
});
