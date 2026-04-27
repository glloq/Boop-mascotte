import { produce } from 'immer';

const defaultParams = {
  headX: 0,
  headY: 0,
  eyeOpen: 1,
  mouthOpen: 0
};

const initialState = {
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
  activeState: 'idle'
};

export function createStore() {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState(recipe) {
      state = produce(state, recipe);
      listeners.forEach((fn) => fn(state));
    },
    replaceState(nextState) {
      state = nextState;
      listeners.forEach((fn) => fn(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
