import { discardLocalRecovery, readLocalRecovery, writeLocalRecovery } from '../../core/state/local-recovery.js';

const silentDiagnostics = { increment() {} };

/**
 * Owns dirty state and the local recovery record: the debounced write, the
 * saved baseline it is compared against, and the shell messages both produce.
 *
 * Every collaborator is injected — store, storage, snapshot helpers, shell
 * callbacks and the timers — so the whole lifecycle runs in Node without a DOM.
 * The editor keeps no autosave variables of its own; `main.js` only forwards
 * store notifications to `schedule()` and save/replacement events to
 * `markSaved()`.
 */
export function createAutosaveService({
  store, storage, serializeSvg, prepareSnapshot, createSnapshot,
  diagnostics = silentDiagnostics,
  setDirty = () => {}, setStatus = () => {}, setRecoveryState = () => {},
  delay = 500,
  // Destructured under other names on purpose: `setTimeout = setTimeout` would
  // be a temporal-dead-zone self reference, and DOM timers must keep the global
  // as their receiver, so the defaults call through `globalThis`.
  setTimeout: startTimer = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: stopTimer = (handle) => globalThis.clearTimeout(handle)
} = {}) {
  let timer = null;
  let status = 'idle';
  let dirty = false;
  // The baseline the dirty check compares against. Document version tokens are
  // cheap and change only on authored mutations, so transient session work
  // (selection, playhead, live preview values) never schedules a write.
  let savedVersionToken = store.getDocumentVersionToken();

  const getRecoveryState = () => readLocalRecovery(storage, prepareSnapshot);
  const refreshRecovery = () => setRecoveryState(getRecoveryState());

  // A refused discard is reported but not thrown: losing the record is not a
  // reason to interrupt the save or replacement that asked for it.
  const discardRecovery = () => {
    if (!discardLocalRecovery(storage)) setStatus('Browser storage is unavailable. Automatic local recovery may not work.', 'warn');
    refreshRecovery();
  };

  const cancel = () => { stopTimer(timer); timer = null; status = 'idle'; };

  // Establishes a new saved baseline. `keepRecovery` is for the restore path,
  // where the record being restored from must survive the baseline it creates.
  const markSaved = ({ keepRecovery = false } = {}) => {
    cancel();
    savedVersionToken = store.getDocumentVersionToken();
    dirty = false;
    setDirty(false);
    if (!keepRecovery) discardRecovery();
  };

  // Called on every document notification. The token comparison is what keeps
  // an unchanged document from writing, and the debounce is what collapses a
  // burst of mutations (one drag, one typed name) into a single write.
  const schedule = () => {
    dirty = store.getDocumentVersionToken() !== savedVersionToken;
    setDirty(dirty);
    if (!dirty) return;
    status = 'pending';
    diagnostics.increment('autosave.schedules');
    stopTimer(timer);
    timer = startTimer(() => {
      try {
        writeLocalRecovery(storage, createSnapshot(store.getState(), serializeSvg));
        diagnostics.increment('autosave.writes');
        status = 'saved';
        // Still dirty — an autosave is recovery, not a saved project — but the
        // shell says so differently.
        setDirty(true, true);
        refreshRecovery();
      } catch { setStatus('Autosave unavailable (browser storage is full or disabled).', 'warn'); }
    }, delay);
  };

  // For a document restored from local recovery: it matches the record, so the
  // token check would call it clean, yet it has never been saved by the user.
  // The flag lasts until the next schedule, exactly as before.
  const markDirty = () => { dirty = true; setDirty(true); };

  return {
    schedule, cancel, markSaved, markDirty,
    refreshRecovery, discardRecovery, getRecoveryState,
    getStatus: () => status, isDirty: () => dirty
  };
}
