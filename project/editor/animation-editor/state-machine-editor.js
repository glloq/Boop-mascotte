import { createStateMachinePanel } from './state-machine/state-machine-panel.js';

// Compatibility entry point. The authoring workspace is implemented by focused
// state-machine and behavior modules rather than by one template monolith.
export function createStateMachineEditor(...args) {
  return createStateMachinePanel(...args);
}
