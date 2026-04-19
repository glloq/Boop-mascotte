export function getStateParams(rig, activeState) {
  return rig.states?.[activeState] || rig.params || {};
}
