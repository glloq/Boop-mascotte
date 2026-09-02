export const PROJECT_DOMAINS = Object.freeze({
  artwork: ['svgMarkup', 'elements'],
  layers: ['layers', 'layerMetadata'],
  rig: ['params', 'globalConstraints', 'stateConstraints', 'runtimeConfig'],
  stateMachine: ['states', 'transitions', 'transitionSettings', 'activeState', 'behaviors'],
  semanticRig: ['semanticParts'],
  animation: ['animationClips']
});

export const PROJECT_DOCUMENT_FIELDS = Object.freeze(['schemaVersion', ...new Set(Object.values(PROJECT_DOMAINS).flat())]);

const constraintScale = { translate: 1, rotate: 1, scale: 1 };

export function createProjectDocument(candidate = {}) {
  const states = candidate.states && typeof candidate.states === 'object' ? candidate.states : {};
  const activeState = states[candidate.activeState] ? candidate.activeState : Object.keys(states)[0] || null;
  const globalConstraints = { ...constraintScale, ...(candidate.globalConstraints || {}) };
  return {
    schemaVersion: 3,
    svgMarkup: typeof candidate.svgMarkup === 'string' ? candidate.svgMarkup : '',
    elements: candidate.elements && typeof candidate.elements === 'object' ? candidate.elements : {},
    layers: Array.isArray(candidate.layers) ? candidate.layers : [],
    layerMetadata: candidate.layerMetadata && typeof candidate.layerMetadata === 'object' ? candidate.layerMetadata : {},
    params: candidate.params && typeof candidate.params === 'object' ? candidate.params : {},
    states, transitions: candidate.transitions && typeof candidate.transitions === 'object' ? candidate.transitions : {},
    transitionSettings: candidate.transitionSettings && typeof candidate.transitionSettings === 'object' ? candidate.transitionSettings : {},
    activeState, globalConstraints,
    stateConstraints: candidate.stateConstraints && typeof candidate.stateConstraints === 'object' ? candidate.stateConstraints : {},
    runtimeConfig: { blink: false, idleMotion: 0, ...(candidate.runtimeConfig || {}) },
    behaviors: Array.isArray(candidate.behaviors) ? candidate.behaviors : [],
    semanticParts: candidate.semanticParts && typeof candidate.semanticParts === 'object' ? candidate.semanticParts : {},
    animationClips: Array.isArray(candidate.animationClips) ? candidate.animationClips : []
  };
}

export const normalizeProjectDocument = createProjectDocument;
