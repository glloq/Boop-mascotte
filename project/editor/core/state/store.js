import { lifecycleDiagnostics as diagnostics } from '../diagnostics/lifecycle-diagnostics.js';
import { createEditorStore } from './editor-store.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';

const defaultParams = {
  headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 },
  mouthOpen: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
};
const defaultValues = Object.fromEntries(Object.entries(defaultParams).map(([key, param]) => [key, param.default]));

const defaultConstraintScale = { translate: 1, rotate: 1, scale: 1 };

export function createCleanProjectState() {
  return {
  schemaVersion: RIG_SCHEMA_VERSION,
  svgMarkup: '',
  selectedId: null,
  elements: {},
  layers: [],
  layerMetadata: {},
  svgWarnings: [],
  params: {}, states: {}, transitions: {},
  globalConstraints: { ...defaultConstraintScale },
  stateConstraints: {}, activeState: null,
  runtimeConfig: { blink: false, idleMotion: 0 },
  behaviors: [], transitionSettings: {}, semanticParts: {}, animationClips: [], expressions: [], reactions: [], keyforms: [], shapeKeys: [], hands: null, deformers: [], parallax: null, expressionBlend: null,
  animationEditor: { activeClipId: null, playhead: 0, panel: 'preview' }
  };
}

export function createSampleProject() {
  const state = createCleanProjectState();
  state.params = structuredClone(defaultParams); state.states = { idle: { ...defaultValues }, happy: { ...defaultValues, mouthOpen: .5 }, sad: { ...defaultValues, mouthOpen: -.5 } };
  state.transitions = { idle: ['happy', 'sad'], happy: ['idle'], sad: ['idle'] }; state.activeState = 'idle';
  state.stateConstraints = Object.fromEntries(Object.keys(state.states).map((name) => [name, { ...defaultConstraintScale }]));
  state.runtimeConfig = { blink: true, idleMotion: .15 };
  state.behaviors = [{ id: 'blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 6, duration: .12, closedValue: 0 }];
  return state;
}

// The editor opens without artwork, so its persistent state must be equally
// empty. Demo data is available only through createSampleProject().
export const createInitialState = createCleanProjectState;

export function normalizeState(candidate = {}) {
  const defaults = createInitialState();
  const states = candidate.states && typeof candidate.states === 'object' ? candidate.states : defaults.states;
  const activeState = states[candidate.activeState] ? candidate.activeState : (Object.keys(states)[0] || null);
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
    layerMetadata: candidate.layerMetadata && typeof candidate.layerMetadata === 'object' ? candidate.layerMetadata : {},
    svgWarnings: Array.isArray(candidate.svgWarnings) ? candidate.svgWarnings : [],
    params: Object.fromEntries(Object.entries(candidate.params || defaults.params).map(([name, param]) => [name, normalizeParameter(param)])),
    states,
    transitions: candidate.transitions && typeof candidate.transitions === 'object' ? candidate.transitions : {},
    globalConstraints: { ...defaults.globalConstraints, ...(candidate.globalConstraints || {}) },
    stateConstraints,
    runtimeConfig: { ...defaults.runtimeConfig, ...(candidate.runtimeConfig || {}) },
    behaviors: Array.isArray(candidate.behaviors) ? candidate.behaviors : [],
    transitionSettings: candidate.transitionSettings && typeof candidate.transitionSettings === 'object' ? candidate.transitionSettings : {},
    semanticParts: candidate.semanticParts && typeof candidate.semanticParts === 'object' ? candidate.semanticParts : {},
    animationClips: Array.isArray(candidate.animationClips) ? candidate.animationClips : [],
    animationEditor: candidate.animationEditor && typeof candidate.animationEditor === 'object' ? candidate.animationEditor : defaults.animationEditor,
    activeState
  };
}

export function createStore() {
  return createEditorStore(createInitialState());
}
import { normalizeParameter } from '../rig/parameters.js';
