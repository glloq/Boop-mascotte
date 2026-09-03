import { captureExpression, createExpression, duplicateExpression, removeExpression, renameExpression, setExpressionBlend, setExpressionControl, setExpressionControls } from './expression-model.js';

/** Atomic V2 commands on the `expressions` domain. Preflight keeps failures out of history. */
export function createExpressionCommands(store, history) {
  const run = (type, operation) => {
    operation(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'expressions', domains: ['expressions'], apply: (document) => { result = operation(document); } });
    return result;
  };
  return {
    create(options) { return run('expression/create', (d) => createExpression(d, options).id); },
    rename(id, name) { return run('expression/rename', (d) => renameExpression(d, id, name).name); },
    duplicate(id) { return run('expression/duplicate', (d) => duplicateExpression(d, id).id); },
    remove(id) { return run('expression/remove', (d) => removeExpression(d, id).id); },
    setControl(id, control, value) { return run('expression/set-control', (d) => structuredClone(setExpressionControl(d, id, control, value).controls)); },
    setControls(id, values) { return run('expression/set-controls', (d) => structuredClone(setExpressionControls(d, id, values).controls)); },
    capture(id, values, options) { return run('expression/capture', (d) => structuredClone(captureExpression(d, id, values, options).controls)); },
    setBlend(patch) { return run('expression/set-blend', (d) => ({ ...setExpressionBlend(d, patch) })); }
  };
}
