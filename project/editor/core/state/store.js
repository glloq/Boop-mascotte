const defaultParams = {
  headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 },
  mouthOpen: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
};
const defaultValues = Object.fromEntries(Object.entries(defaultParams).map(([key, param]) => [key, param.default]));

const defaultConstraintScale = { translate: 1, rotate: 1, scale: 1 };

export function createInitialState() {
  return {
  schemaVersion: 2,
  svgMarkup: '',
  selectedId: null,
  elements: {},
  layers: [],
  params: defaultParams,
  states: {
    idle: { ...defaultValues },
    happy: { ...defaultValues, mouthOpen: 0.5 },
    sad: { ...defaultValues, mouthOpen: -0.5 }
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
    params: Object.fromEntries(Object.entries(candidate.params || defaults.params).map(([name, param]) => [name, normalizeParameter(param)])),
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
import { normalizeParameter } from '../rig/parameters.js';
