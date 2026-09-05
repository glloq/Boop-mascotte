import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GAZE_SOLVER, createGazeFollower, gazeSolverActive, normalizeGazeSolver, solveGaze, solveGazeAxis } from '../../../runtime/gaze-solver.js';
import { applyControlRig, createControlRig, eyelidFollowAmount } from '../../../runtime/effective-params.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { createProjectDocument } from '../state/project-document.js';
import { GAZE_TARGET_PARAMETERS, disableGazeSolver, enableGazeSolver, gazeSolverModel } from '../rig/gaze-rig.js';

/**
 * The gaze solver and the effective parameter layer (docs/FACE_CONTROL_RIG.md).
 *
 * `lookX` moved the pupils and `headX` turned the head, and those were two
 * unrelated decisions an animator made twice. This is the third: the character
 * wants to look somewhere, the eyes go first, the head follows — and the
 * animation the author keyed is never edited to make it happen.
 */

const range = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const faceParams = () => ({
  gazeX: range(-1, 1), gazeY: range(-1, 1),
  lookX: range(-1, 1), lookY: range(-1, 1),
  headX: range(-1, 1), headY: range(-1, 1),
  eyeOpen: range(0, 1, 1), eyeOpenLeft: range(-1, 1), eyeOpenRight: range(-1, 1),
  lookXLeft: range(-2, 2), lookXRight: range(-2, 2), lookYLeft: range(-2, 2), lookYRight: range(-2, 2)
});
const solving = (settings = {}) => normalizeGazeSolver({ gazeSolver: { enabled: true, ...settings } });

test('a project that never asked for a solver gets one that does nothing', () => {
  const off = normalizeGazeSolver({});
  assert.deepEqual(off, DEFAULT_GAZE_SOLVER);
  assert.equal(off.enabled, false);
  assert.equal(gazeSolverActive(off), false);
  // Disabled is not "solve with zero settings": the decomposition never runs.
  assert.deepEqual(solveGaze({ x: 1, y: 1 }, off), { eye: { x: 0, y: 0 }, head: { x: 0, y: 0 }, angles: { eyeYaw: 0, eyePitch: 0, headYaw: 0, headPitch: 0, desiredYaw: 0, desiredPitch: 0 } });

  // A rig hands over the whole document; a panel hands over the block itself.
  // Neither may be mistaken for the other (a rig has `params`, a block has not).
  assert.equal(normalizeGazeSolver({ params: { enabled: 1 }, elements: {} }).enabled, false);
  assert.equal(normalizeGazeSolver({ enabled: true }).enabled, true);
  assert.equal(normalizeGazeSolver({ gazeSolver: { enabled: true } }).enabled, true);
  // Rubbish falls back to the default; a deliberate 0 does not.
  assert.equal(normalizeGazeSolver({ enabled: true, headFollow: 'lots' }).headFollow, DEFAULT_GAZE_SOLVER.headFollow);
  assert.equal(normalizeGazeSolver({ enabled: true, headFollow: 0 }).headFollow, 0);
  assert.equal(normalizeGazeSolver({ enabled: true, eyeYawLimit: -20 }).eyeYawLimit, DEFAULT_GAZE_SOLVER.eyeYawLimit);
});

test('the split is angular: the eyes take what they are comfortable with, the head takes the rest', () => {
  // The roadmap's own worked example. 30° wanted, the eyes comfortable to 15°,
  // the head willing to help: the head takes 15° and the eyes take 15°, and
  // the two add back up to the 30° that was asked for.
  const axis = { eyeLimit: 30, headLimit: 30, comfort: 0.5, deadZone: 0, headFollow: 1 };
  const half = solveGazeAxis(0.5, axis);
  assert.equal(half.desired, 30);
  assert.equal(half.headAngle, 15);
  assert.equal(half.eyeAngle, 15);
  assert.equal(half.eyeAngle + half.headAngle, half.desired, 'the character looks where it was told to');

  // In parameter units, which is what `lookX` and `headX` actually are: 1 is
  // the eye's own limit and 1 is the head's own limit.
  assert.equal(half.eye, 0.5);
  assert.equal(half.head, 0.5);

  // A gaze the eyes can cover on their own leaves the head alone.
  assert.equal(solveGazeAxis(0.2, axis).headAngle, 0);
  assert.equal(solveGazeAxis(0.2, axis).eyeAngle, 12);
  // And the far end asks for everything both of them have.
  assert.equal(solveGazeAxis(1, axis).eyeAngle, 30);
  assert.equal(solveGazeAxis(1, axis).headAngle, 30);
  // Symmetric, and it never runs past what either can do.
  assert.equal(solveGazeAxis(-1, axis).eyeAngle, -30);
  assert.equal(solveGazeAxis(-4, axis).headAngle, -30, 'a target past the ends is still on the ends');
});

test('the dead zone is what makes a glance a glance', () => {
  const axis = { eyeLimit: 30, headLimit: 30, comfort: 0, deadZone: 0.25, headFollow: 1 };
  // Inside it the eyes move and the head does not: turning the head to look at
  // something six inches away is what reads as a robot.
  assert.equal(solveGazeAxis(0.2, axis).headAngle, 0);
  assert.ok(solveGazeAxis(0.2, axis).eyeAngle > 0);
  assert.ok(solveGazeAxis(0.4, axis).headAngle > 0, 'and past it the head joins in');

  // `headFollow` is how much of the overflow the head takes. 0 is eyes-only,
  // which is a rig some mascots want, not a missing value.
  const still = { ...axis, headFollow: 0 };
  assert.equal(solveGazeAxis(1, still).headAngle, 0);
  assert.equal(solveGazeAxis(1, still).eyeAngle, 30, 'the eyes still reach as far as they can');
});

test('a sweep of the target produces no jump, no NaN and no reversal (CR-57)', () => {
  const config = solving();
  let previous = solveGaze({ x: -1, y: -1 }, config);
  for (let step = -100; step <= 100; step += 1) {
    const at = step / 100;
    const now = solveGaze({ x: at, y: at }, config);
    for (const value of [now.eye.x, now.eye.y, now.head.x, now.head.y]) assert.ok(Number.isFinite(value), `NaN at ${at}`);
    // Piecewise linear: one step of 1/100 of the range can never move a
    // contribution by more than a small fraction of its own range.
    assert.ok(Math.abs(now.eye.x - previous.eye.x) < 0.1, `eye jumped at ${at}`);
    assert.ok(Math.abs(now.head.x - previous.head.x) < 0.1, `head jumped at ${at}`);
    // Monotonic: looking further right never sends anything left.
    assert.ok(now.eye.x >= previous.eye.x - 1e-9 && now.head.x >= previous.head.x - 1e-9, `reversed at ${at}`);
    previous = now;
  }
  // Straight ahead is exactly straight ahead, not 2.7e-17 off it.
  assert.deepEqual(solveGaze({ x: 0, y: 0 }, config).eye, { x: 0, y: 0 });
  assert.deepEqual(solveGaze({ x: 0, y: 0 }, config).head, { x: 0, y: 0 });
});

test('the eyes go first and the head arrives late (CR-13)', () => {
  const follower = createGazeFollower(solving({ headLag: 0.1, headSettle: 0.25 }));
  const step = (seconds) => follower.step({ x: 1, y: 0 }, seconds);
  // Nothing at all in the first frame: two cascaded lags start at zero
  // velocity, which is what stops the head from being yanked.
  assert.ok(step(1 / 60).x < 0.05, 'the head has barely started');
  let time = 1 / 60;
  while (time < 0.1) { step(1 / 60); time += 1 / 60; }
  const started = follower.value().x;
  assert.ok(started > 0.05 && started < 0.6, `at 100 ms the head is on its way, not there: ${started}`);
  while (time < 0.45) { step(1 / 60); time += 1 / 60; }
  assert.ok(follower.value().x > 0.9, `by 450 ms the head has arrived: ${follower.value().x}`);
  // And it never overshoots, which a spring would.
  assert.ok(follower.value().x <= 1);

  // A follower nobody configured a lag for is simply not there.
  const instant = createGazeFollower(solving({ headLag: 0, headSettle: 0 }));
  assert.deepEqual(instant.step({ x: 1, y: -1 }, 1 / 60), { x: 1, y: -1 });

  // Deterministic: the same deltas from the same start land in the same place.
  const a = createGazeFollower(solving()), b = createGazeFollower(solving());
  for (let frame = 0; frame < 20; frame += 1) { a.step({ x: 0.7, y: 0.2 }, 1 / 60); b.step({ x: 0.7, y: 0.2 }, 1 / 60); }
  assert.deepEqual(a.value(), b.value());
});

test('the solver adds to what the author keyed and never overwrites it (CR-15, CR-16)', () => {
  const params = faceParams();
  const raw = Object.freeze({ gazeX: 1, lookX: 0.2, headX: 0.2 });
  const rig = createControlRig({ params, gazeSolver: { enabled: true, headFollow: 1, headLag: 0, headSettle: 0 } });
  const effective = rig.solve(raw);

  // The authored values are exactly where the author left them.
  assert.equal(raw.lookX, 0.2);
  assert.equal(raw.headX, 0.2);
  assert.notEqual(effective, raw, 'the effective pose is its own object');
  // And the effective ones are the sum, clamped to what each parameter allows.
  assert.equal(effective.headX, 1, '0.2 + a full head contribution, clamped to the range');
  assert.equal(effective.lookX, 1);
  assert.ok(rig.contribution.head.x > 0 && rig.contribution.eye.x > 0);

  // Half a target is half the work, and the sum is still additive.
  const gentle = createControlRig({ params, gazeSolver: { enabled: true, headFollow: 1, headLag: 0, headSettle: 0 } });
  const softly = gentle.solve({ gazeX: 0.5, lookX: 0.1, headX: 0 });
  assert.ok(softly.lookX > 0.1 && softly.lookX < 1);
  assert.equal(Math.round((softly.lookX - 0.1) * 1e5) / 1e5, gentle.contribution.eye.x);
});

test('an inert layer hands back the very object it was given (CR-52)', () => {
  const params = faceParams();
  const raw = { gazeX: 1, lookX: 0.2, headX: 0.2 };
  const off = createControlRig({ params });
  assert.equal(off.step(raw, 1 / 60), raw, 'no copy, no allocation, no behaviour change');
  assert.equal(off.solve(raw), raw);
  assert.equal(off.active, false);
  assert.equal(off.settled(raw), true, 'and it never keeps a render loop awake');

  // The same guarantee one level down: nothing to contribute is nothing done.
  const nothing = applyControlRig(raw, { params, config: normalizeGazeSolver({}) });
  assert.equal(nothing.values, raw);
  assert.equal(nothing.changed, false);
});

test('the lids ride the gaze, per side where the two eyes disagree (CR-17)', () => {
  const config = normalizeGazeSolver({ gazeSolver: { eyelidFollowY: 0.25, eyelidFollowX: 0.1 } });
  // Looking up opens the eye a little; looking down closes it.
  assert.equal(eyelidFollowAmount(0, -1, config), 0.25);
  assert.equal(eyelidFollowAmount(0, 1, config), -0.25);
  // Looking hard sideways narrows it, whichever side it is: a squint reads the
  // distance from centre, not the direction.
  assert.equal(eyelidFollowAmount(1, 0, config), -0.1);
  assert.equal(eyelidFollowAmount(-1, 0, config), -0.1);

  const params = faceParams();
  const rig = createControlRig({ params, gazeSolver: { eyelidFollowY: 0.25 } });
  assert.equal(rig.active, true, 'a follow of its own is enough to make the layer do something');
  const looking = rig.solve({ lookY: -1, eyeOpen: 0.7 });
  assert.equal(looking.eyeOpen, 0.95);
  // Both eyes together while they agree — nothing is written per side.
  assert.equal(looking.eyeOpenLeft, undefined);

  // And apart the moment they do not: the left eye is looking further down, so
  // its own lid comes down further, as a *difference* from the shared one.
  const apart = rig.solve({ lookY: 0, lookYLeft: 1, eyeOpen: 1 });
  assert.equal(apart.eyeOpenLeft, -0.25);
  assert.equal(apart.eyeOpenRight, undefined);
});

test('a contribution is clamped to the parameter it lands in, never past it (CR-55)', () => {
  const params = faceParams();
  const rig = createControlRig({ params, gazeSolver: { enabled: true, headFollow: 1, headLag: 0, headSettle: 0 } });
  const hard = rig.solve({ gazeX: 1, lookX: 1, headX: 1 });
  assert.equal(hard.lookX, 1);
  assert.equal(hard.headX, 1);
  // A parameter the rig has not got is skipped rather than invented.
  const partial = createControlRig({ params: { lookX: range(-1, 1) }, gazeSolver: { enabled: true } });
  const only = partial.solve({ gazeX: 1 });
  assert.ok(only.lookX > 0);
  assert.equal('headX' in only, false);
});

test('asking a running mascot what it shows does not move anything', () => {
  const rig = createControlRig({ params: faceParams(), gazeSolver: { enabled: true, headFollow: 1 } });
  for (let frame = 0; frame < 10; frame += 1) rig.step({ gazeX: 1 }, 1 / 60);
  const mid = rig.peek({ gazeX: 1 }).headX;
  assert.deepEqual(rig.peek({ gazeX: 1 }).headX, mid, 'peeking twice reads the same head');
  assert.ok(mid > 0 && mid < 1, 'and it reads the head where the lag has got to');
});

test('the settings are a document field that survives save, export and reopen (CR-52)', () => {
  const project = createProjectDocument({});
  assert.deepEqual(project.gazeSolver, DEFAULT_GAZE_SOLVER, 'an empty project has a solver that is switched off');
  assert.deepEqual(project.rigLinks, []);

  const rig = { params: {}, states: { idle: {} }, elements: {} };
  enableGazeSolver(rig, { headFollow: 0.8 });
  assert.deepEqual(GAZE_TARGET_PARAMETERS.map((name) => rig.params[name].default), [0, 0]);
  assert.equal(rig.states.idle.gazeX, 0, 'every state starts looking straight ahead');
  assert.equal(rig.gazeSolver.headFollow, 0.8);

  const exported = createExportRig({ ...rig, states: rig.states });
  assert.equal(exported.gazeSolver.enabled, true);
  assert.equal(normalizeRig(exported).gazeSolver.headFollow, 0.8);

  // Switching it off leaves the parameters alone: a clip may be keying them,
  // and deleting a parameter a clip animates is how an author loses work.
  disableGazeSolver(rig);
  assert.equal(rig.gazeSolver.enabled, false);
  assert.ok(rig.params.gazeX, 'the target is still there to be keyed');
});

test('the panel says what the solver has, and what it has nowhere to send', () => {
  const withEyes = gazeSolverModel({ params: { lookX: range(-1, 1), headX: range(-1, 1) } });
  assert.deepEqual(withEyes.missing, []);
  assert.equal(withEyes.enabled, false);
  assert.equal(withEyes.ready, false, 'no target parameters yet');
  assert.ok(withEyes.fields.length > 5);
  assert.ok(withEyes.fields.every((field) => Number.isFinite(field.value)));

  // A solver with nowhere to send its head contribution is worth saying out
  // loud: the eyes reach their limit and stop, which reads as broken.
  const noHead = gazeSolverModel({ params: { lookX: range(-1, 1) } });
  assert.deepEqual(noHead.missing, ['the head']);
});
