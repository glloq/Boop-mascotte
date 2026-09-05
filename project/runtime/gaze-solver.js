/**
 * The gaze solver (docs/FACE_CONTROL_RIG.md).
 *
 * `lookX` moves the pupils and `headX` turns the head, and until now those
 * were two unrelated decisions an animator made twice. Real looking is one
 * decision: *the character wants to look there*. The eyes go first because
 * they are light, the head follows because they run out of socket, and the
 * two together add up to the angle that was asked for.
 *
 * ```text
 *                    gazeX / gazeY
 *                          │
 *                    ┌─────┴─────┐
 *                    │   solver  │
 *                    └─────┬─────┘
 *              ┌───────────┴───────────┐
 *              ▼                       ▼
 *      eye contribution         head contribution
 *      (adds to lookX/Y)        (adds to headX/Y, late)
 * ```
 *
 * Two things make this a rig feature rather than a gimmick:
 *
 * - It reasons in **degrees**, not in artwork units. An eye is comfortable
 *   over maybe 35°, a head turns over 55°, and those numbers are what decide
 *   the split. What the degrees are worth in pixels is the pseudo-3D turn's
 *   business, further down the pipeline (docs/HEAD_POSE_2_5D.md).
 * - The head is **late**. `createGazeFollower` holds the head contribution
 *   behind two cascaded lags, so it starts moving after the eyes and arrives
 *   without overshoot — the thing that reads as alive rather than mechanical.
 *
 * Pure and deterministic. The solve is a function of the target and the
 * config; the follower is a function of the target, the config and the frame
 * delta. No iteration, no springs that can ring, nothing that needs a random
 * source. Everything defaults to *off*: a project that has never heard of the
 * solver gets zero contribution and behaves exactly as it did.
 */
import { finite, clamp, roundTo } from './numeric.js';

/**
 * The solver's settings, and what happens when nobody touches them.
 *
 * | Field | Default | What it decides |
 * | --- | --- | --- |
 * | `enabled` | `false` | whether the decomposition runs at all |
 * | `headFollow` | `0.5` | how much of the overflow angle the head takes |
 * | `deadZoneX` / `deadZoneY` | `0.15` / `0.2` | the gaze the head ignores entirely |
 * | `eyeYawLimit` / `eyePitchLimit` | `35` / `25` | degrees the eyes reach alone |
 * | `eyeComfortX` / `eyeComfortY` | `0.6` / `0.6` | fraction of that limit before the head helps |
 * | `headYawLimit` / `headPitchLimit` | `55` / `35` | degrees the head can turn |
 * | `headLag` | `0.1` | seconds before the head starts to move |
 * | `headSettle` | `0.25` | seconds for the head to arrive |
 * | `eyelidFollowX` / `eyelidFollowY` | `0` / `0` | how much the lids ride the gaze |
 *
 * `enabled: false` is the only default that matters for compatibility: with it
 * the solver contributes nothing and `lookX` / `headX` mean what they always
 * meant. The eyelid follow is deliberately outside that gate — it reads the
 * *final* eye direction, whoever set it, and it is already inert at 0.
 */
export const DEFAULT_GAZE_SOLVER = Object.freeze({
  enabled: false,
  headFollow: 0.5,
  deadZoneX: 0.15, deadZoneY: 0.2,
  eyeYawLimit: 35, eyePitchLimit: 25,
  eyeComfortX: 0.6, eyeComfortY: 0.6,
  headYawLimit: 55, headPitchLimit: 35,
  headLag: 0.1, headSettle: 0.25,
  eyelidFollowX: 0, eyelidFollowY: 0
});

const positive = (value, fallback) => { const n = finite(value, fallback); return n >= 0 ? n : fallback; };

/**
 * Read a rig's solver block, filling in every default.
 *
 * Takes the rig (`{ gazeSolver: {...} }`) or the block itself, so a caller
 * that already has the settings does not have to wrap them.
 */
export function normalizeGazeSolver(source = {}) {
  const object = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  // A rig hands over the whole document, a panel hands over the block itself.
  // Anything carrying `params` or `elements` is the document, so its own fields
  // are never mistaken for settings that happen to share a name.
  const wrapper = 'gazeSolver' in object || 'params' in object || 'elements' in object;
  const raw = wrapper ? (object.gazeSolver && typeof object.gazeSolver === 'object' ? object.gazeSolver : {}) : object;
  return {
    enabled: raw.enabled === true,
    // A follow of 0 is eyes-only, which is a legitimate rig and not a missing
    // value: only rubbish falls back to the default.
    headFollow: clamp(finite(raw.headFollow, DEFAULT_GAZE_SOLVER.headFollow), 0, 1),
    deadZoneX: clamp(positive(raw.deadZoneX, DEFAULT_GAZE_SOLVER.deadZoneX), 0, 1),
    deadZoneY: clamp(positive(raw.deadZoneY, DEFAULT_GAZE_SOLVER.deadZoneY), 0, 1),
    eyeYawLimit: clamp(positive(raw.eyeYawLimit, DEFAULT_GAZE_SOLVER.eyeYawLimit), 0, 90),
    eyePitchLimit: clamp(positive(raw.eyePitchLimit, DEFAULT_GAZE_SOLVER.eyePitchLimit), 0, 90),
    eyeComfortX: clamp(positive(raw.eyeComfortX, DEFAULT_GAZE_SOLVER.eyeComfortX), 0, 1),
    eyeComfortY: clamp(positive(raw.eyeComfortY, DEFAULT_GAZE_SOLVER.eyeComfortY), 0, 1),
    headYawLimit: clamp(positive(raw.headYawLimit, DEFAULT_GAZE_SOLVER.headYawLimit), 0, 90),
    headPitchLimit: clamp(positive(raw.headPitchLimit, DEFAULT_GAZE_SOLVER.headPitchLimit), 0, 90),
    headLag: clamp(positive(raw.headLag, DEFAULT_GAZE_SOLVER.headLag), 0, 2),
    headSettle: clamp(positive(raw.headSettle, DEFAULT_GAZE_SOLVER.headSettle), 0, 4),
    eyelidFollowX: clamp(finite(raw.eyelidFollowX, 0), -1, 1),
    eyelidFollowY: clamp(finite(raw.eyelidFollowY, 0), -1, 1)
  };
}

/** Whether this block asks the pipeline to do anything at all. */
export const gazeSolverActive = (config) =>
  Boolean(config?.enabled) || Number(config?.eyelidFollowX) !== 0 || Number(config?.eyelidFollowY) !== 0;

/**
 * Split one axis of a gaze into an eye angle and a head angle.
 *
 * ```text
 * desired = gaze × (eyeLimit + headLimit)          the angle asked for
 * threshold = max(deadZone × range, eyeLimit × comfort)
 * overflow  = max(0, |desired| − threshold)        what the eyes are not comfortable with
 * head      = min(overflow × headFollow, headLimit)
 * eye       = clamp(desired − head, ±eyeLimit)     the eyes make up the rest
 * ```
 *
 * The roadmap's worked example: 30° wanted, eyes comfortable to 15°, follow 1
 * → the head takes 15° and the eyes take the remaining 15°, and the two add
 * back up to the 30° that was asked for. Below the threshold the head does not
 * move at all, which is the dead zone: a glance is not a turn.
 *
 * Piecewise linear and continuous — a sweep of the target produces no jump
 * anywhere, which is what the continuity tests check (docs/FACE_CONTROL_RIG.md).
 *
 * @returns {{eye:number, head:number, eyeAngle:number, headAngle:number, desired:number}}
 *   `eye` and `head` are in **parameter units**: 1 is the eye's own limit and
 *   1 is the head's own limit, because that is what `lookX` and `headX` mean.
 */
export function solveGazeAxis(gaze, { eyeLimit, headLimit, comfort, deadZone, headFollow }) {
  const eyeSpan = Math.max(0, finite(eyeLimit, 0)), headSpan = Math.max(0, finite(headLimit, 0));
  const range = eyeSpan + headSpan;
  const desired = clamp(finite(gaze, 0), -1, 1) * range;
  if (!range) return { eye: 0, head: 0, eyeAngle: 0, headAngle: 0, desired: 0 };
  const threshold = Math.max(clamp(finite(deadZone, 0), 0, 1) * range, eyeSpan * clamp(finite(comfort, 1), 0, 1));
  const overflow = Math.max(0, Math.abs(desired) - threshold);
  const headAngle = Math.sign(desired) * Math.min(overflow * clamp(finite(headFollow, 0), 0, 1), headSpan);
  const eyeAngle = clamp(desired - headAngle, -eyeSpan, eyeSpan);
  return {
    eye: eyeSpan ? roundTo(eyeAngle / eyeSpan) : 0,
    head: headSpan ? roundTo(headAngle / headSpan) : 0,
    eyeAngle: roundTo(eyeAngle), headAngle: roundTo(headAngle), desired: roundTo(desired)
  };
}

/**
 * Where a gaze target sends the eyes and the head.
 *
 * @param {{x:number, y:number}} target the point the character wants to look
 *   at, as `gazeX` / `gazeY` — −1 to 1, the same units every other control uses
 * @param {object} config a normalized block from `normalizeGazeSolver`
 * @returns {{eye:{x,y}, head:{x,y}, angles:object}} contributions to **add**
 *   to whatever the animator set by hand. A disabled solver returns zeroes.
 */
export function solveGaze(target = {}, config = DEFAULT_GAZE_SOLVER) {
  if (!config?.enabled) return ZERO_SOLUTION;
  const x = solveGazeAxis(target.x, { eyeLimit: config.eyeYawLimit, headLimit: config.headYawLimit, comfort: config.eyeComfortX, deadZone: config.deadZoneX, headFollow: config.headFollow });
  const y = solveGazeAxis(target.y, { eyeLimit: config.eyePitchLimit, headLimit: config.headPitchLimit, comfort: config.eyeComfortY, deadZone: config.deadZoneY, headFollow: config.headFollow });
  return {
    eye: { x: x.eye, y: y.eye },
    head: { x: x.head, y: y.head },
    angles: { eyeYaw: x.eyeAngle, eyePitch: y.eyeAngle, headYaw: x.headAngle, headPitch: y.headAngle, desiredYaw: x.desired, desiredPitch: y.desired }
  };
}

const ZERO_SOLUTION = Object.freeze({
  eye: Object.freeze({ x: 0, y: 0 }), head: Object.freeze({ x: 0, y: 0 }),
  angles: Object.freeze({ eyeYaw: 0, eyePitch: 0, headYaw: 0, headPitch: 0, desiredYaw: 0, desiredPitch: 0 })
});

/**
 * The head, arriving late (CR-13).
 *
 * ```text
 * 0 ms      eyes are already there
 * ~100 ms   the head starts to move
 * ~250 ms   the head has arrived
 * ```
 *
 * Two exponential lags in series, not one: a single lag starts at full speed
 * the instant the target moves, which reads as the head being yanked. Cascading
 * two makes the response start at zero velocity, so the head *builds up* and
 * then settles — an S curve, with no overshoot to ring and nothing to iterate.
 *
 * `headLag` is the first stage's time constant (how long before anything
 * visibly happens) and `headSettle` the span the second stage arrives in. Both
 * at 0 is a follower that is simply not there, which is what a rig that wants
 * the head nailed to the gaze asks for.
 */
export function createGazeFollower(config = DEFAULT_GAZE_SOLVER) {
  let settings = normalizeGazeSolver(config);
  let stage = { x: 0, y: 0 }, value = { x: 0, y: 0 };
  /** The fraction of the remaining distance a lag of `tau` covers in `delta`. */
  const approach = (tau, delta) => (tau > 0 ? 1 - Math.exp(-Math.max(0, delta) / tau) : 1);
  return {
    /** Swap the settings without losing where the head currently is. */
    configure(next) { settings = normalizeGazeSolver(next); return settings; },
    /** Back to looking straight ahead, for a mascot that has just started. */
    reset() { stage = { x: 0, y: 0 }; value = { x: 0, y: 0 }; },
    /** Put the head exactly on target, for a seek rather than a step. */
    snap(target = {}) {
      value = { x: finite(target.x, 0), y: finite(target.y, 0) };
      stage = { ...value };
      return { ...value };
    },
    /**
     * @param {{x:number,y:number}} target the head contribution the solver asked for
     * @param {number} delta seconds since the previous frame
     */
    step(target = {}, delta = 0) {
      const wanted = { x: finite(target.x, 0), y: finite(target.y, 0) };
      const dt = Math.max(0, finite(delta, 0));
      // The settle stage covers its span in about three time constants, so a
      // `headSettle` of 250 ms means arrived-at-250 ms rather than
      // still-63%-of-the-way-there.
      const first = approach(settings.headLag, dt), second = approach(settings.headSettle / 3, dt);
      stage = { x: stage.x + (wanted.x - stage.x) * first, y: stage.y + (wanted.y - stage.y) * first };
      value = { x: value.x + (stage.x - value.x) * second, y: value.y + (stage.y - value.y) * second };
      return { x: roundTo(value.x), y: roundTo(value.y) };
    },
    /** Where the head is right now, without advancing the clock. */
    value() { return { x: roundTo(value.x), y: roundTo(value.y) }; },
    /** Whether the head has caught up, so a caller can stop asking for frames. */
    settled(target = {}) {
      return Math.abs(value.x - finite(target.x, 0)) < 0.001 && Math.abs(value.y - finite(target.y, 0)) < 0.001
        && Math.abs(stage.x - value.x) < 0.001 && Math.abs(stage.y - value.y) < 0.001;
    }
  };
}
