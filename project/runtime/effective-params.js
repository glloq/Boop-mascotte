/**
 * The effective parameter layer (docs/FACE_CONTROL_RIG.md).
 *
 * A solver has to be able to move the head without *editing the animation*.
 * The moment a gaze solver writes `headX = 0.5` into the parameters an author
 * keyed, their 0.2 is gone: undo cannot get it back, the next frame solves
 * from the solved value, and the drift compounds. Every rig that has ever done
 * this has ended up with the same rule, so this is that rule:
 *
 * ```text
 * rawParams        what the author, the timeline and the states say
 *     ↓
 * solvers          gaze decomposition, eyelid follow
 *     ↓
 * effectiveParams  what the artwork is posed from, this frame only
 * ```
 *
 * `raw.headX` stays 0.2 forever. `effective.headX` is 0.5 for exactly as long
 * as the gaze asks for it. Nothing downstream — bindings, keyforms, warps,
 * shape keys — knows the difference, because they were only ever handed a bag
 * of numbers.
 *
 * The layer is **inert by default**. With no gaze solver configured and no
 * eyelid follow, `step()` returns the very object it was given: no allocation,
 * no copy, no behaviour change, which is what keeps every project that
 * predates it running identically (docs/FACE_CONTROL_RIG.md, CR-52).
 */
import { finite, clamp, roundTo } from './numeric.js';
import { createGazeFollower, gazeSolverActive, normalizeGazeSolver, solveGaze } from './gaze-solver.js';

export { DEFAULT_GAZE_SOLVER, normalizeGazeSolver, solveGaze, solveGazeAxis, createGazeFollower, gazeSolverActive } from './gaze-solver.js';

/** The parameters the solvers read and write, so a caller can spot them. */
export const GAZE_TARGET_PARAMS = Object.freeze(['gazeX', 'gazeY']);
export const GAZE_EYE_PARAMS = Object.freeze(['lookX', 'lookY']);
export const GAZE_HEAD_PARAMS = Object.freeze(['headX', 'headY']);

const NO_CONTRIBUTION = Object.freeze({
  eye: Object.freeze({ x: 0, y: 0 }), head: Object.freeze({ x: 0, y: 0 }),
  eyelid: Object.freeze({ common: 0, left: 0, right: 0 }),
  angles: Object.freeze({ eyeYaw: 0, eyePitch: 0, headYaw: 0, headPitch: 0, desiredYaw: 0, desiredPitch: 0 })
});


/** A parameter's own bounds, or the open range for a value nobody declared. */
function bounds(params, name) {
  const param = params?.[name];
  if (!param || typeof param !== 'object') return null;
  const min = Number(param.min), max = Number(param.max);
  return { min: Number.isFinite(min) ? min : -Infinity, max: Number.isFinite(max) ? max : Infinity, rest: finite(param.default, 0) };
}

/**
 * Add a contribution to one parameter of a **copy**, clamped to its range.
 *
 * A parameter the rig does not have is skipped rather than invented: a project
 * with no `eyeOpenLeft` has no per-side lids, and the follow simply has
 * nowhere to go.
 */
function contribute(target, params, name, amount) {
  if (!amount) return false;
  const range = bounds(params, name);
  if (!range) return false;
  const from = finite(target[name], range.rest);
  const landed = clamp(from + amount, range.min, range.max);
  if (landed === target[name]) return false;
  target[name] = roundTo(landed);
  return true;
}

/**
 * How far the lids ride the gaze (CR-17).
 *
 * Looking **up** opens the eye a little and looking **down** closes it — the
 * upper lid follows the pupil, which is the single cheapest thing that makes a
 * cartoon face read as looking somewhere rather than staring. Looking hard
 * sideways narrows it slightly, which is a squint, so that one reads the
 * *distance* from centre and not the direction.
 *
 * `lookY` grows downwards like every other vertical parameter here, so the
 * vertical term is negated.
 */
export const eyelidFollowAmount = (lookX, lookY, config) =>
  roundTo(-finite(config?.eyelidFollowY, 0) * clamp(finite(lookY, 0), -1, 1)
        - finite(config?.eyelidFollowX, 0) * Math.abs(clamp(finite(lookX, 0), -1, 1)));

/**
 * One frame of solving, with the head contribution already decided.
 *
 * Split out from the follower so it can be called with the raw solution (a
 * still pose, a test, a scrub with no clock) or with the lagged one (a running
 * frame) — the arithmetic is identical either way, which is what stops the
 * editor and the exported runtime from disagreeing.
 *
 * @param {Record<string, number>} raw the parameters as authored. **Never mutated.**
 * @param {object} options
 * @param {object} options.params the rig's parameter descriptors, for bounds
 * @param {object} options.config a normalized gaze-solver block
 * @param {{x:number,y:number}} [options.eye] eye contribution, in `lookX` units
 * @param {{x:number,y:number}} [options.head] head contribution, in `headX` units
 * @returns {{values: Record<string, number>, contribution: object, changed: boolean}}
 */
export function applyControlRig(raw = {}, { params = {}, config = null, eye = null, head = null } = {}) {
  const settings = config || normalizeGazeSolver({});
  const wantsGaze = Boolean(eye || head);
  const followX = finite(settings.eyelidFollowX, 0), followY = finite(settings.eyelidFollowY, 0);
  const wantsLids = followX !== 0 || followY !== 0;
  if (!wantsGaze && !wantsLids) return { values: raw, contribution: NO_CONTRIBUTION, changed: false };

  const values = { ...raw };
  let changed = false;
  const applied = { eye: { x: 0, y: 0 }, head: { x: 0, y: 0 }, eyelid: { common: 0, left: 0, right: 0 } };

  if (wantsGaze) {
    applied.eye = { x: finite(eye?.x, 0), y: finite(eye?.y, 0) };
    applied.head = { x: finite(head?.x, 0), y: finite(head?.y, 0) };
    changed = contribute(values, params, 'lookX', applied.eye.x) || changed;
    changed = contribute(values, params, 'lookY', applied.eye.y) || changed;
    changed = contribute(values, params, 'headX', applied.head.x) || changed;
    changed = contribute(values, params, 'headY', applied.head.y) || changed;
  }

  if (wantsLids) {
    // The lids follow where the eyes **ended up**, so the gaze solver's own
    // contribution is already in here: a head-follow that turned the head
    // instead of rolling the eyes moves the lids less, which is right.
    const lookX = finite(values.lookX, 0), lookY = finite(values.lookY, 0);
    const common = eyelidFollowAmount(lookX, lookY, settings);
    applied.eyelid.common = common;
    changed = contribute(values, params, 'eyeOpen', common) || changed;
    // Per-side only where the two eyes actually disagree. An offset of 0 leaves
    // the differential at 0, so a rig without per-eye targets never writes here.
    for (const [side, name] of [['Left', 'eyeOpenLeft'], ['Right', 'eyeOpenRight']]) {
      const offsetX = finite(values[`lookX${side}`], 0), offsetY = finite(values[`lookY${side}`], 0);
      if (!offsetX && !offsetY) continue;
      const sided = eyelidFollowAmount(lookX + offsetX, lookY + offsetY, settings);
      const differential = roundTo(sided - common);
      applied.eyelid[side.toLowerCase()] = differential;
      changed = contribute(values, params, name, differential) || changed;
    }
  }

  return { values: changed ? values : raw, contribution: { ...applied, angles: NO_CONTRIBUTION.angles }, changed };
}

/**
 * The control rig for one mascot: the solvers, and the state they need.
 *
 * The engine and the editor preview each own one of these and call `step`
 * once per frame, between the mixer and `compileRigFrame` — stage 4 to 7 of
 * the evaluation order (docs/FACE_CONTROL_RIG.md). It is the only stateful
 * thing in the layer, because the head arriving late is the only part that
 * needs to remember a previous frame.
 *
 * @param {object} rig the document or exported rig: `params` and `gazeSolver`
 */
export function createControlRig(rig = {}) {
  let config = normalizeGazeSolver(rig);
  let params = rig?.params || {};
  const follower = createGazeFollower(config);
  let contribution = NO_CONTRIBUTION;
  // Where the target was last frame, for the anticipation term (CR-48).
  let previousTarget = null;

  /**
   * How far the eyes lead a target that is still moving.
   *
   * Real eyes arrive *before* the thing they are following and settle back;
   * that overshoot is most of what reads as intent rather than tracking. It is
   * proportional to the target's speed, so it appears while the target moves
   * and is gone the instant it stops — a derivative term, not a spring, with
   * nothing to oscillate.
   */
  const anticipate = (target, delta) => {
    const lead = finite(config.gazeAnticipation, 0);
    if (lead <= 0 || !(delta > 0)) { previousTarget = { ...target }; return { x: 0, y: 0 }; }
    const from = previousTarget || target;
    const velocity = { x: (target.x - from.x) / delta, y: (target.y - from.y) / delta };
    previousTarget = { ...target };
    // Half a range per second is a fast look; anything faster leads the same
    // amount, so a scrub or a jump cannot fling the eyes off the face.
    return { x: clamp(velocity.x * lead * 0.15, -lead, lead), y: clamp(velocity.y * lead * 0.15, -lead, lead) };
  };

  /** The eye/head split this pose asks for, before the head is made late. */
  const solveFrom = (raw) => (config.enabled
    ? solveGaze({ x: finite(raw?.gazeX, 0), y: finite(raw?.gazeY, 0) }, config)
    : null);

  return {
    /** Whether anything here would change a pose. Cheap enough to ask per frame. */
    get active() { return gazeSolverActive(config); },
    get config() { return config; },
    /** What the solvers added last time, for an inspector or a test to read. */
    get contribution() { return contribution; },
    /** Follow a document that changed under the editor without losing the head. */
    configure(next = {}) {
      config = normalizeGazeSolver(next);
      params = next?.params || params;
      follower.configure(config);
      return config;
    },
    reset() { follower.reset(); previousTarget = null; contribution = NO_CONTRIBUTION; },
    /**
     * Whether the head has caught up with the gaze this pose asks for.
     *
     * A render loop that has nothing else to do still has to keep turning
     * while the head is on its way, or the follow would freeze half-done the
     * moment the author stopped dragging.
     */
    settled(raw = {}) {
      if (!config.enabled) return true;
      return follower.settled(solveFrom(raw)?.head || { x: 0, y: 0 });
    },
    /**
     * One running frame: the head lags, so this needs the frame's delta.
     *
     * @param {Record<string, number>} raw parameters as authored — not mutated
     * @param {number} delta seconds since the previous frame
     */
    step(raw = {}, delta = 0) {
      if (!gazeSolverActive(config)) { contribution = NO_CONTRIBUTION; return raw; }
      const solution = solveFrom(raw);
      const head = solution ? follower.step(solution.head, delta) : null;
      const lead = solution ? anticipate({ x: finite(raw.gazeX, 0), y: finite(raw.gazeY, 0) }, delta) : null;
      const eye = solution ? { x: solution.eye.x + (lead?.x || 0), y: solution.eye.y + (lead?.y || 0) } : null;
      const result = applyControlRig(raw, { params, config, eye, head });
      contribution = solution ? { ...result.contribution, angles: solution.angles } : result.contribution;
      return result.values;
    },
    /**
     * The pose as it stands, without touching the clock or the head's lag.
     *
     * Asking a running engine what it is showing must not move anything: this
     * reads the follower where it currently is instead of stepping or snapping
     * it, so an inspector polling every frame changes nothing.
     */
    peek(raw = {}) {
      if (!gazeSolverActive(config)) return raw;
      const solution = solveFrom(raw);
      return applyControlRig(raw, { params, config, eye: solution?.eye || null, head: solution ? follower.value() : null }).values;
    },
    /**
     * One still pose: no clock, so the head is wherever the gaze puts it.
     *
     * This is what a scrubbed timeline, a captured thumbnail and an export
     * preview want — a frame that depends on the pose alone and never on how
     * the playhead got there.
     */
    solve(raw = {}) {
      if (!gazeSolverActive(config)) { contribution = NO_CONTRIBUTION; return raw; }
      const solution = solveFrom(raw);
      if (solution) follower.snap(solution.head);
      const result = applyControlRig(raw, { params, config, eye: solution?.eye || null, head: solution?.head || null });
      contribution = solution ? { ...result.contribution, angles: solution.angles } : result.contribution;
      return result.values;
    }
  };
}
