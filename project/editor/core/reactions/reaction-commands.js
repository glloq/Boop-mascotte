import { createReaction, duplicateReaction, removeReaction, renameReaction, updateReaction } from './reaction-model.js';

/** Atomic V2 commands on the `reactions` domain. Preflight keeps failures out of history. */
export function createReactionCommands(store, history) {
  const run = (type, operation) => {
    operation(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'reactions', domains: ['reactions'], apply: (document) => { result = operation(document); } });
    return result;
  };
  return {
    create(options) { return run('reaction/create', (d) => createReaction(d, options).id); },
    update(id, patch) { return run('reaction/update', (d) => structuredClone(updateReaction(d, id, patch))); },
    rename(id, name) { return run('reaction/rename', (d) => renameReaction(d, id, name).name); },
    duplicate(id) { return run('reaction/duplicate', (d) => duplicateReaction(d, id).id); },
    remove(id) { return run('reaction/remove', (d) => removeReaction(d, id).id); }
  };
}
