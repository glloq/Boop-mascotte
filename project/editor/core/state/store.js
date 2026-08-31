const defaultParams = {
  headX: 0,
  headY: 0,
  eyeOpen: 1,
  mouthOpen: 0
};

const defaultConstraintScale = { translate: 1, rotate: 1, scale: 1 };

export function createInitialState() {
  return {
  svgMarkup: '',
  selectedId: null,
  elements: {},
  layers: [],
  params: defaultParams,
  states: {
    idle: { ...defaultParams },
    happy: { ...defaultParams, mouthOpen: 0.5 },
    sad: { ...defaultParams, mouthOpen: -0.5 }
  },
  transitions: {
    idle: ['happy', 'sad'],
    happy: ['idle'],
    sad: ['idle']
  },
  globalConstraints: { ...defaultConstraintScale },
  stateConstraints: {
    idle: { ...defaultConstraintScale },
    happy: { ...defaultConstraintScale },
    sad: { ...defaultConstraintScale }
  },
  activeState: 'idle',
  runtimeConfig: {
    blink: true,
    idleMotion: 0.15
  }
  };
}

export function normalizeState(candidate = {}) {
  const defaults = createInitialState();
  const states = candidate.states && typeof candidate.states === 'object' ? candidate.states : defaults.states;
  const activeState = states[candidate.activeState] ? candidate.activeState : (Object.keys(states)[0] || 'idle');
  const stateConstraints = {};
  Object.keys(states).forEach((name) => {
    stateConstraints[name] = { ...defaults.globalConstraints, ...(candidate.stateConstraints?.[name] || {}) };
  });
  return {
    ...defaults,
    ...candidate,
    svgMarkup: typeof candidate.svgMarkup === 'string' ? candidate.svgMarkup : '',
    selectedId: typeof candidate.selectedId === 'string' ? candidate.selectedId : null,
    elements: candidate.elements && typeof candidate.elements === 'object' ? candidate.elements : {},
    layers: Array.isArray(candidate.layers) ? candidate.layers : [],
    params: { ...defaults.params, ...(candidate.params || {}) },
    states,
    transitions: candidate.transitions && typeof candidate.transitions === 'object' ? candidate.transitions : {},
    globalConstraints: { ...defaults.globalConstraints, ...(candidate.globalConstraints || {}) },
    stateConstraints,
    runtimeConfig: { ...defaults.runtimeConfig, ...(candidate.runtimeConfig || {}) },
    activeState
  };
}

export function createStore() {
  let state = createInitialState();
  const listeners = new Set();

  return {
    getState: () => state,
    setState(recipe) {
      const draft = structuredClone(state);
      recipe(draft);
      state = normalizeState(draft);
      listeners.forEach((fn) => fn(state));
    },
    replaceState(nextState) {
      state = normalizeState(nextState);
      listeners.forEach((fn) => fn(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
