// VNX-29 — an arrangement is played by starting each placement through the motion
// layer that already exists (docs/ADR_MOTION_LAYERING.md, "the clip started last
// wins"). Nothing here reaches the runtime that `playMotion(id, { layer: true })`
// did not already reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';

const ramp = (id, parameter, duration, loop = false) => ({ id, name: id.toUpperCase(), duration, loop,
  tracks: { [parameter]: [{ time: 0, value: 0, easing: 'linear' }, { time: duration, value: 1, easing: 'linear' }] } });
const hold = (id, parameter, value) => ({ id, name: id.toUpperCase(), duration: 2, loop: false,
  tracks: { [parameter]: [{ time: 0, value, easing: 'linear' }, { time: 2, value, easing: 'linear' }] } });

/** `a` ramps headY over 2s, `b` ramps lookX over 1s, `hold-z` pins headY, `loopy` ramps headY and repeats. */
const clips = () => [ramp('a', 'headY', 2), ramp('b', 'lookX', 1), hold('hold-z', 'headY', -1), ramp('loopy', 'headY', 1, true)];

/** The placement shape `arrangementPlacements(document)` produces. */
const place = (clipId, start, extra = {}) => ({ id: `${clipId}@${start}`, clipId, start, ...extra });

function setup({ motionBlend = null } = {}) {
  const state = createCleanProjectState();
  state.params = { headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, lookX: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  state.states = { idle: { headY: 0, lookX: 0 } }; state.activeState = 'idle';
  state.motionBlend = motionBlend; state.animationClips = clips();
  const store = createStore(); store.replaceState(state);
  // A real frame queue: a cancelled frame is gone, so "the loop went to sleep" is
  // observable rather than assumed.
  let clock = 0, key = 0; const pending = new Map();
  const preview = createPreviewController({ store, canvas: { applyFrame() {} },
    requestFrame: (fn) => { pending.set(++key, fn); return key; }, cancelFrame: (id) => pending.delete(id), now: () => clock });
  const advance = (ms) => { clock += ms; const entry = [...pending.entries()][0]; if (entry) { pending.delete(entry[0]); entry[1](clock); } };
  return { store, preview, advance, pending };
}

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);

test('a placement starts when the playhead reaches it and not before', () => {
  const { preview, advance } = setup();
  assert.equal(preview.playArrangement([place('a', 0.5)]), true);
  assert.deepEqual(preview.getMotionWeights(), {}, 'nothing plays at second 0');
  near(preview.getArrangementTime(), 0, 'the playhead starts at the top');
  assert.equal(preview.isRunning(), true, 'a silent gap before the first clip still keeps the loop awake');

  advance(200);
  assert.deepEqual(preview.getMotionWeights(), {}, 'still nothing at 0.2s');
  assert.equal(preview.getEffectiveParams().headY, 0);

  advance(400);
  assert.deepEqual(preview.getMotionWeights(), { a: 1 }, 'the clip starts on the frame that crosses 0.5s');
  near(preview.getArrangementTime(), 0.6, 'and the playhead reads arrangement time');
  // Clocked from the second the author placed it, not from the frame that noticed
  // it: 0.1s into a 2s ramp.
  near(preview.getEffectiveParams().headY, 0.05, 'the clip is 0.1s in');
});

test('a placement starts once, not on every frame after its start time', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('a', 0)]);
  // A clip re-started every frame would have its clock reset every frame, so it
  // would sit at the value it has at time 0 forever. This one keeps advancing.
  advance(500); near(preview.getEffectiveParams().headY, 0.25, 'half a second in');
  advance(500); near(preview.getEffectiveParams().headY, 0.5, 'one second in');
  advance(500); near(preview.getEffectiveParams().headY, 0.75, 'one and a half seconds in');
});

test('two placements at different times both end up playing', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('a', 0), place('b', 0.5)]);
  assert.deepEqual(Object.keys(preview.getMotionWeights()), ['a'], 'only the first one at second 0');
  advance(600);
  assert.deepEqual(preview.getMotionWeights(), { a: 1, b: 1 }, 'and both once the playhead passes the second');
  near(preview.getEffectiveParams().headY, 0.3, 'the first clip is 0.6s into 2s');
  near(preview.getEffectiveParams().lookX, 0.1, 'the second is 0.1s into 1s');
  assert.equal(preview.isPlaying(), true);
});

test('two placements on the same second are ordered by clip id, and the last one started wins the movement', () => {
  const { preview, advance } = setup();
  // Passed in the order that would give the wrong answer if input order decided.
  preview.playArrangement([place('hold-z', 0), place('a', 0)]);
  advance(200);
  assert.deepEqual(Object.keys(preview.getMotionWeights()), ['a', 'hold-z'], 'sorted by clip id, so the order is decided rather than incidental');
  assert.equal(preview.getEffectiveParams().headY, -1, 'the clip mixed last owns the movement they share');
});

test('stopping an arrangement leaves nothing playing', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('a', 0), place('b', 0.5)]);
  advance(600);
  assert.equal(preview.stopArrangement(), true);
  assert.deepEqual(preview.getMotionWeights(), {}, 'no motion is left');
  assert.equal(preview.isPlaying(), false);
  assert.equal(preview.isArrangementPlaying(), false);
  assert.equal(preview.getArrangementTime(), null, 'and no playhead to draw');
  assert.equal(preview.getEffectiveParams().headY, 0, 'the pose returns to the state underneath');
  assert.equal(preview.isRunning(), false, 'the frame loop sleeps');
  assert.equal(preview.stopArrangement(), false, 'stopping twice is not an event');
});

test('an arrangement ends itself when its last placement ends', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('b', 0)]);
  advance(500); assert.equal(preview.isArrangementPlaying(), true);
  advance(600);
  assert.equal(preview.isArrangementPlaying(), false, 'a pass with nothing left to start and nothing playing is over');
  assert.deepEqual(preview.getMotionWeights(), {});
  assert.equal(preview.isRunning(), false, 'and the loop stops rather than spinning on an empty arrangement');
});

test('seeking backwards re-arms a placement that already started, so it plays again from the top', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('a', 0), place('b', 1)]);
  advance(1200);
  assert.deepEqual(preview.getMotionWeights(), { a: 1, b: 1 }, 'both are running before the seek');

  assert.equal(preview.seekArrangement(0.2), true);
  assert.deepEqual(preview.getMotionWeights(), { a: 1 }, 'the placement the playhead moved back before is stopped');
  near(preview.getArrangementTime(), 0.2, 'the playhead is where it was put');
  near(preview.getEffectiveParams().headY, 0.1, 'and the clip covering that second is restored at its own clock');

  advance(900);
  assert.deepEqual(preview.getMotionWeights(), { a: 1, b: 1 }, 'reaching it a second time starts it a second time');
  near(preview.getEffectiveParams().lookX, 0.1, 'from the top, not from where it was');
});

test('seeking forward past a finished placement leaves it finished', () => {
  const { preview } = setup();
  preview.playArrangement([place('b', 0), place('a', 3)]);
  preview.seekArrangement(2);
  assert.deepEqual(preview.getMotionWeights(), {}, 'a 1s clip at second 0 is over at second 2');
  assert.equal(preview.isArrangementPlaying(), true, 'and the pass is still running, waiting for the clip at 3s');
});

test('a looping placement keeps the arrangement open and does not wedge the transport', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('loopy', 0), place('b', 0.5)]);
  advance(1500);
  assert.deepEqual(preview.getMotionWeights(), { loopy: 1 }, 'the 1s clip released itself, the looping one did not');
  near(preview.getEffectiveParams().headY, 0.5, 'and it wrapped rather than holding its last key');

  advance(3000);
  assert.equal(preview.isArrangementPlaying(), true, 'a loop has no end, so neither does the pass containing it');
  near(preview.getArrangementTime(), 4.5, 'the playhead keeps counting past the ruler');
  near(preview.getEffectiveParams().headY, 0.5);

  // The only thing that ends it is being asked to.
  assert.equal(preview.stopArrangement(), true);
  assert.deepEqual(preview.getMotionWeights(), {});
  assert.equal(preview.isRunning(), false, 'and the loop that never ends does not keep the frame loop awake once stopped');
});

test('the Timeline and Motion Inspector transports take the arrangement over, and the arrangement takes theirs', () => {
  const { preview, advance } = setup();
  preview.setClip('a'); preview.seek(1);
  assert.equal(preview.getEffectiveParams().headY, 0.5, 'the Timeline scrubs its clip at full weight');

  preview.playArrangement([place('b', 0)]);
  assert.equal(preview.getEffectiveParams().headY, 0, 'playing an arrangement takes the scrub pose down, like playMotion');
  assert.deepEqual(preview.getMotionWeights(), { b: 1 });

  preview.playClip();
  assert.equal(preview.isArrangementPlaying(), false, 'and the Timeline transport ends the pass');
  assert.deepEqual(preview.getMotionWeights(), {});

  preview.stopClip({ pose: false });
  preview.playArrangement([place('b', 2)]);
  assert.equal(preview.playMotion('a'), true);
  assert.equal(preview.isArrangementPlaying(), false, 'so does the Motion Inspector');
  advance(100);
  assert.deepEqual(preview.getMotionWeights(), { a: 1 }, 'and the placement that had not started never does');
});

test('an arrangement of clips the project no longer has plays nothing', () => {
  const { preview } = setup();
  assert.equal(preview.playArrangement([place('gone', 0)]), false);
  assert.equal(preview.isArrangementPlaying(), false);
  assert.equal(preview.playArrangement([]), false);
  assert.equal(preview.seekArrangement(1), false, 'and there is no playhead to move');
});

test('a document motion blend fades a placement in exactly as playMotion does', () => {
  const { preview, advance } = setup({ motionBlend: { duration: 200, easing: 'linear' } });
  preview.playArrangement([place('hold-z', 0)]);
  advance(100);
  near(preview.getMotionWeights()['hold-z'], 0.5, 'halfway through the document span');
  near(preview.getEffectiveParams().headY, -0.5, 'so the pose eases in rather than cutting');
  advance(100);
  near(preview.getEffectiveParams().headY, -1);
  // A seek is a state, not a replay: it restores at full weight instead of fading.
  preview.seekArrangement(0.5);
  assert.equal(preview.getEffectiveParams().headY, -1, 'a seek shows the second it landed on at once');
});

test('a placement the playhead could never reach does not keep the frame loop awake', () => {
  const { preview, advance } = setup();
  preview.playArrangement([place('b', 0), place('a', Infinity)]);
  // An unreachable start would be a placement that never fires and a pass that
  // never ends, so it is clamped to second 0 and plays like any other.
  assert.deepEqual(preview.getMotionWeights(), { a: 1, b: 1 });
  advance(1200); advance(1200);
  assert.equal(preview.isArrangementPlaying(), false, 'and the pass ends when both of them do');
  assert.equal(preview.isRunning(), false);
});
