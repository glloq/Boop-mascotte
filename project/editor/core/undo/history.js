export function createHistory(store) {
  const past = [];
  const future = [];
  const listeners = new Set();

  const notify = () => {
    const snapshot = { canUndo: past.length > 0, canRedo: future.length > 0 };
    listeners.forEach((fn) => fn(snapshot));
  };

  function snapshot() {
    past.push(structuredClone(store.getState()));
    if (past.length > 100) past.shift();
    future.length = 0;
    notify();
  }

  return {
    snapshot,
    undo() {
      if (!past.length) return;
      future.push(structuredClone(store.getState()));
      store.replaceState(past.pop());
      notify();
    },
    redo() {
      if (!future.length) return;
      past.push(structuredClone(store.getState()));
      store.replaceState(future.pop());
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
