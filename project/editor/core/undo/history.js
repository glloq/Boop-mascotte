export function createHistory(store) {
  const past = [];
  const future = [];
  const listeners = new Set();
  let transactionOpen = false;
  const document = () => store.getDocument ? store.getDocument() : store.getState();
  const token = () => store.getDocumentVersionToken ? store.getDocumentVersionToken() : null;
  const restore = (entry) => store.restoreDocument ? store.restoreDocument(entry.document, entry.version) : store.replaceState(entry.document);

  const notify = () => {
    const snapshot = { canUndo: past.length > 0, canRedo: future.length > 0 };
    listeners.forEach((fn) => fn(snapshot));
  };

  function snapshot() {
    if (transactionOpen) return;
    past.push({ document: structuredClone(document()), version: token() });
    if (past.length > 100) past.shift();
    future.length = 0;
    notify();
  }

  return {
    snapshot,
    clear() { past.length = 0; future.length = 0; transactionOpen = false; notify(); },
    beginTransaction() { if (transactionOpen) return; snapshot(); transactionOpen = true; },
    commitTransaction() { transactionOpen = false; },
    undo() {
      if (!past.length) return;
      future.push({ document: structuredClone(document()), version: token() });
      restore(past.pop());
      notify();
    },
    redo() {
      if (!future.length) return;
      past.push({ document: structuredClone(document()), version: token() });
      restore(future.pop());
      notify();
    },
    getState() {
      return { canUndo: past.length > 0, canRedo: future.length > 0 };
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ canUndo: past.length > 0, canRedo: future.length > 0 });
      return () => listeners.delete(listener);
    }
  };
}
