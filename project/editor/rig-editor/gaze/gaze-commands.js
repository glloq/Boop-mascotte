/**
 * Turning the gaze solver on, and tuning it (docs/FACE_CONTROL_RIG.md).
 *
 * Atomic, like every other command boundary here: one `history.snapshot()`,
 * one `store.execute`. Enabling writes two parameters as well as the settings
 * block, so the command declares the domains that carry both — the panel that
 * lists movements and the timeline that keys them have to hear about it.
 */
import { configureGazeSolver, disableGazeSolver, enableGazeSolver } from '../../core/rig/gaze-rig.js';

export function createGazeRigCommands(store, history) {
  const run = (type, domains, operation) => { history?.snapshot(); return store.execute({ type, source: 'gaze-rig', domains, apply: operation }); };
  return {
    /** Give the project a gaze target and start dividing it (CR-11). */
    enable: (settings) => run('gaze/enable', ['rig', 'stateMachine'], (document) => { enableGazeSolver(document, settings); }),
    /** Stop dividing it. The parameters stay: a clip may be keying them. */
    disable: () => run('gaze/disable', ['rig'], (document) => { disableGazeSolver(document); }),
    /** How much of the work the head does, how late, and how far the lids ride. */
    configure: (settings) => run('gaze/configure', ['rig'], (document) => { configureGazeSolver(document, settings); }),
    /** On or off, whichever it is not. */
    toggle(enabled) { return enabled ? this.enable() : this.disable(); }
  };
}
