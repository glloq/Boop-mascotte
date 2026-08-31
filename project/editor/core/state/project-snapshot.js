const SNAPSHOT_VERSION = 2;

export function createProjectSnapshot(state, serializeSvg) {
  return {
    version: SNAPSHOT_VERSION,
    capturedAt: new Date().toISOString(),
    document: {
      svgMarkup: serializeSvg ? serializeSvg() : (state.svgMarkup || ''),
      layers: state.layers || [],
      layerMetadata: state.layerMetadata || {},
      selectedId: state.selectedId || null,
      rig: {
        schemaVersion: state.schemaVersion || 2,
        params: state.params,
        states: state.states,
        elements: state.elements,
        activeState: state.activeState,
        transitions: state.transitions,
        transitionSettings: state.transitionSettings,
        globalConstraints: state.globalConstraints,
        stateConstraints: state.stateConstraints,
        runtimeConfig: state.runtimeConfig,
        behaviors: state.behaviors
      }
    }
  };
}

export function applyProjectSnapshot(state, snapshot) {
  if (!snapshot?.document?.rig) throw new Error('Invalid project snapshot');
  const { rig, svgMarkup } = snapshot.document;

  state.svgMarkup = svgMarkup || '';
  state.layers = Array.isArray(snapshot.document.layers) ? [...snapshot.document.layers] : Object.keys(rig.elements || {});
  state.layerMetadata = snapshot.document.layerMetadata && typeof snapshot.document.layerMetadata === 'object' ? structuredClone(snapshot.document.layerMetadata) : {};
  state.selectedId = snapshot.document.selectedId && rig.elements?.[snapshot.document.selectedId] ? snapshot.document.selectedId : null;
  if (rig.params) state.params = { ...rig.params };
  if (rig.states) state.states = { ...rig.states };
  if (rig.transitions) state.transitions = { ...rig.transitions };
  state.transitionSettings = rig.transitionSettings && typeof rig.transitionSettings === 'object' ? structuredClone(rig.transitionSettings) : {};
  if (rig.activeState && rig.states?.[rig.activeState]) state.activeState = rig.activeState;
  if (rig.globalConstraints) state.globalConstraints = { ...rig.globalConstraints };
  if (rig.stateConstraints) state.stateConstraints = { ...rig.stateConstraints };
  if (rig.runtimeConfig) state.runtimeConfig = { ...rig.runtimeConfig };
  state.behaviors = Array.isArray(rig.behaviors) ? structuredClone(rig.behaviors) : [];
  if (rig.elements) state.elements = { ...rig.elements };
}
