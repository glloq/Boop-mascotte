/**
 * Turning the gaze solver on for a project (docs/FACE_CONTROL_RIG.md).
 *
 * The solver itself is runtime maths with no opinions about documents
 * (`runtime/gaze-solver.js`). This is the other half: the two parameters an
 * author actually animates, and the settings block that says how the eyes and
 * the head divide the work.
 *
 * ```text
 * gazeX / gazeY   the point the character wants to look at   ← animated
 * lookX / lookY   where the eyes are pointed                 ← manual correction
 * headX / headY   where the head is pointed                  ← manual correction
 * ```
 *
 * `lookX` is deliberately **not** repurposed. Every project that exists uses it
 * as the eyes' own control, every clip that exists keys it, and the solver adds
 * to it rather than taking it over (CR-11, CR-53). A project that never turns
 * the solver on has no `gazeX` at all and behaves exactly as it always did.
 *
 * Pure document operations, like the rest of `core/rig`: they mutate the rig
 * they are handed and the command layer wraps them in one undo step.
 */
import { normalizeGazeSolver } from '../../../runtime/runtime.js';

/** What an animator keys when they want the character to look at something. */
export const GAZE_TARGET_PARAMETERS = Object.freeze(['gazeX', 'gazeY']);

const targetParameter = () => ({ type: 'number', min: -1, max: 1, default: 0, value: 0 });

/** This project's solver settings, with every default filled in. */
export const gazeSolverSettings = (document) => normalizeGazeSolver(document);

/** Whether the gaze decomposition is running for this project. */
export const gazeSolverEnabled = (document) => normalizeGazeSolver(document).enabled;

/** Whether the project has the two parameters a gaze target is dragged with. */
export const hasGazeTarget = (document) => GAZE_TARGET_PARAMETERS.every((name) => Boolean(document?.params?.[name]));

/**
 * Give the project a gaze target, and let the solver split it.
 *
 * The two parameters are created at rest, and every state gets them at rest,
 * so switching the solver on changes nothing until an author moves the target.
 */
export function enableGazeSolver(rig, settings = {}) {
  rig.gazeSolver = normalizeGazeSolver({ gazeSolver: { ...normalizeGazeSolver(rig), ...settings, enabled: true } });
  rig.params ||= {};
  for (const name of GAZE_TARGET_PARAMETERS) {
    if (!rig.params[name]) rig.params[name] = targetParameter();
    for (const pose of Object.values(rig.states || {})) if (!(name in pose)) pose[name] = 0;
  }
  return rig.gazeSolver;
}

/**
 * Stop solving, and leave the animation alone.
 *
 * The parameters stay: a clip may key them, and deleting a parameter a clip
 * animates is how an author loses work. They rest at 0 and contribute nothing,
 * which is the same thing the solver being off already means.
 */
export function disableGazeSolver(rig) {
  rig.gazeSolver = normalizeGazeSolver({ gazeSolver: { ...normalizeGazeSolver(rig), enabled: false } });
  return rig.gazeSolver;
}

/** Change how the work is divided, without touching whether it is divided. */
export function configureGazeSolver(rig, settings = {}) {
  rig.gazeSolver = normalizeGazeSolver({ gazeSolver: { ...normalizeGazeSolver(rig), ...settings } });
  return rig.gazeSolver;
}

/**
 * The settings a panel lays out, in the order they are worth reading.
 *
 * Grouped by the question each one answers rather than by the axis it belongs
 * to: an author tuning a gaze asks "how soon does the head join in", not "what
 * is `eyeComfortX`".
 */
export const GAZE_SOLVER_FIELDS = Object.freeze([
  Object.freeze({ id: 'headFollow', label: 'How much the head helps', min: 0, max: 1, step: 0.05, hint: '0 keeps the head still and moves only the eyes.' }),
  Object.freeze({ id: 'deadZoneX', label: 'Glance before turning · sideways', min: 0, max: 1, step: 0.05, hint: 'A gaze inside this stays a glance: the eyes move, the head does not.' }),
  Object.freeze({ id: 'deadZoneY', label: 'Glance before turning · up and down', min: 0, max: 1, step: 0.05, hint: 'The same, for looking up and down.' }),
  Object.freeze({ id: 'eyeYawLimit', label: 'Eyes reach · sideways', min: 0, max: 90, step: 1, unit: '°', hint: 'How far the eyes go on their own before the head has to.' }),
  Object.freeze({ id: 'eyePitchLimit', label: 'Eyes reach · up and down', min: 0, max: 90, step: 1, unit: '°' }),
  Object.freeze({ id: 'headYawLimit', label: 'Head turns · sideways', min: 0, max: 90, step: 1, unit: '°' }),
  Object.freeze({ id: 'headPitchLimit', label: 'Head turns · up and down', min: 0, max: 90, step: 1, unit: '°' }),
  Object.freeze({ id: 'headLag', label: 'Head starts after', min: 0, max: 1, step: 0.02, unit: 's', hint: 'The eyes go first. This is how long the head waits.' }),
  Object.freeze({ id: 'headSettle', label: 'Head arrives in', min: 0, max: 2, step: 0.05, unit: 's' }),
  Object.freeze({ id: 'eyelidFollowY', label: 'Lids follow the gaze · up and down', min: -1, max: 1, step: 0.05, hint: 'Looking up opens the eye a little, looking down closes it.' }),
  Object.freeze({ id: 'eyelidFollowX', label: 'Lids narrow looking sideways', min: -1, max: 1, step: 0.05 })
]);

/**
 * What a panel needs to draw the solver: whether it is on, what it is set to,
 * and whether the project can actually use it.
 *
 * A solver with nowhere to send its contributions is worth saying out loud —
 * a rig with no `headX` gets eyes that reach their limit and stop, which looks
 * like the solver is broken rather than like the head is missing.
 */
export function gazeSolverModel(document = {}) {
  const settings = gazeSolverSettings(document);
  const params = document.params || {};
  const missing = [];
  if (!params.lookX && !params.lookY) missing.push('the pupils');
  if (!params.headX && !params.headY) missing.push('the head');
  return {
    enabled: settings.enabled,
    settings,
    ready: hasGazeTarget(document),
    missing,
    fields: GAZE_SOLVER_FIELDS.map((field) => ({ ...field, value: settings[field.id] }))
  };
}
