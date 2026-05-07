const SNAPSHOT_VERSION = 1;

export function createProjectSnapshot(state) {
  return {
    version: SNAPSHOT_VERSION,
    capturedAt: new Date().toISOString(),
    document: {
      svgMarkup: state.svgMarkup || '',
      rig: {
        params: state.params,
        states: state.states,
        elements: state.elements,
        activeState: state.activeState,
        transitions: state.transitions,
        globalConstraints: state.globalConstraints,
        stateConstraints: state.stateConstraints,
        runtimeConfig: state.runtimeConfig
      }
    }
  };
}

export function applyProjectSnapshot(state, snapshot) {
  if (!snapshot?.document?.rig) throw new Error('Invalid project snapshot');
  const { rig, svgMarkup } = snapshot.document;

  state.svgMarkup = svgMarkup || '';
  if (rig.params) state.params = { ...rig.params };
  if (rig.states) state.states = { ...rig.states };
  if (rig.transitions) state.transitions = { ...rig.transitions };
  if (rig.activeState) state.activeState = rig.activeState;
  if (rig.globalConstraints) state.globalConstraints = { ...rig.globalConstraints };
  if (rig.stateConstraints) state.stateConstraints = { ...rig.stateConstraints };
  if (rig.runtimeConfig) state.runtimeConfig = { ...rig.runtimeConfig };
  if (rig.elements) state.elements = { ...rig.elements };
}
