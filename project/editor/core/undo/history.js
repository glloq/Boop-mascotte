export function createHistory(store) {
  const past = [];
  const future = [];

  function snapshot() {
    past.push(structuredClone(store.getState()));
    if (past.length > 100) past.shift();
    future.length = 0;
  }

  return {
    snapshot,
    undo() {
      if (!past.length) return;
      future.push(structuredClone(store.getState()));
      store.replaceState(past.pop());
    },
    redo() {
      if (!future.length) return;
      past.push(structuredClone(store.getState()));
      store.replaceState(future.pop());
    }
  };
}
