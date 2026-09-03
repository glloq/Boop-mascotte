import { disableAutomaticPreset, enableAutomaticPreset } from './automatic-model.js';

/**
 * Atomic commands that turn an automatic preset on (adding the missing
 * behaviors with the preset values, re-enabling kept ones) or off (disabling
 * the matching behaviors so hand tweaks survive). Behaviors live in the
 * `stateMachine` domain like the advanced Behaviors panel writes them.
 */
export function createAutomaticCommands(store, history) {
  const run = (type, operation) => {
    operation(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'automatic', domains: ['stateMachine'], apply: (document) => { result = operation(document); } });
    return result;
  };
  return {
    enable(id) { return run('automatic/enable', (document) => enableAutomaticPreset(document, id)); },
    disable(id) { return run('automatic/disable', (document) => disableAutomaticPreset(document, id)); }
  };
}
