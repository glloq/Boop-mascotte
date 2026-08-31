const defaultRevision = (state) => state;

export function createValidationCache(validate, revision = defaultRevision) {
  let key = Symbol('empty');
  let result = null;
  return {
    run(state) {
      const next = revision(state);
      if (next !== key) {
        key = next;
        result = validate(state);
      }
      return result;
    },
    clear() { key = Symbol('empty'); result = null; }
  };
}

export function validationRevision(state) {
  return JSON.stringify({
    schemaVersion: state.schemaVersion,
    elements: state.elements,
    params: state.params,
    states: state.states,
    transitions: state.transitions,
    transitionSettings: state.transitionSettings,
    behaviors: state.behaviors,
    semanticParts: state.semanticParts,
    animationClips: state.animationClips
  });
}

export function createDebouncedTask(task, delay = 150) {
  let timer;
  return {
    schedule() { clearTimeout(timer); timer = setTimeout(task, delay); },
    cancel() { clearTimeout(timer); timer = null; },
    flush() { clearTimeout(timer); timer = null; return task(); }
  };
}
