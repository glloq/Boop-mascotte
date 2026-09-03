import test from 'node:test';
import assert from 'node:assert/strict';
import { createBehaviorController, composeBehaviorParams, normalizeBehavior, normalizeBehaviors, BEHAVIOR_TYPES } from '../../../runtime/runtime.js';
import { AUTOMATIC_PRESETS, deriveAutomaticStatus } from '../behaviors/automatic-presets.js';
import { validateRig } from '../validation/rig-validator.js';

/** A deterministic "random" so behaviour tests describe behaviour, not luck. */
const sequence = (values) => { let index = 0; return () => values[index++ % values.length]; };

const behavior = (over) => normalizeBehavior({ enabled: true, ...over });

test('drift is a runtime behaviour type alongside the original three', () => {
  assert.deepEqual(BEHAVIOR_TYPES, ['blink', 'randomIdle', 'oscillator', 'drift']);
  assert.equal(normalizeBehavior({ type: 'drift' }).name, 'Drift');
  assert.equal(normalizeBehavior({ type: 'wobble' }).type, 'oscillator', 'an unknown type falls back');
});

test('drift eases towards a target and then holds it', () => {
  // random() === 1 makes every target the top of the amplitude and every
  // interval its maximum, so the shape of the motion is what is being asserted.
  const controller = createBehaviorController({ random: () => 1 });
  const drift = behavior({ id: 'wander', type: 'drift', parameter: 'lookX', amplitude: 0.4, travelMin: 1, travelMax: 1, intervalMin: 2, intervalMax: 2 });
  const at = (time) => composeBehaviorParams({ lookX: 0 }, [drift], time, controller.evaluate([drift], time)).lookX;
  assert.equal(at(0), 0, 'starts at rest');
  assert.equal(at(1.5), 0, 'and waits out the first interval');
  // The move starts on the first evaluation at or after t = 2, and takes one
  // second from there — a render loop evaluates every frame, so it starts on time.
  assert.equal(at(2), 0, 'the move begins');
  const quarter = at(2.25), half = at(2.5), full = at(3);
  assert.ok(quarter > 0 && quarter < half && half < full, `eases outward (${quarter}, ${half}, ${full})`);
  assert.ok(Math.abs(full - 0.4) < 1e-9, 'reaches the target');
  assert.ok(Math.abs(at(4) - 0.4) < 1e-9, 'and rests there');
});

test('drift stays inside its amplitude and moves smoothly', () => {
  const controller = createBehaviorController({ random: sequence([1, 0, 1, 0]) });
  const drift = behavior({ id: 'wander', type: 'drift', parameter: 'lookX', amplitude: 0.3, travelMin: 1, travelMax: 1, intervalMin: 0, intervalMax: 0 });
  let previous = 0;
  let largestStep = 0;
  let extreme = 0;
  for (let time = 0; time <= 6; time += 0.05) {
    const value = composeBehaviorParams({ lookX: 0 }, [drift], time, controller.evaluate([drift], time)).lookX;
    largestStep = Math.max(largestStep, Math.abs(value - previous));
    extreme = Math.max(extreme, Math.abs(value));
    previous = value;
  }
  assert.ok(extreme <= 0.3 + 1e-9, `stays inside the amplitude (${extreme})`);
  assert.ok(extreme > 0.1, 'actually moves');
  assert.ok(largestStep < 0.08, `no jumps (largest step ${largestStep})`);
});

test('two drifts on different parameters keep their own state', () => {
  const controller = createBehaviorController({ random: () => 1 });
  const x = behavior({ id: 'x', type: 'drift', parameter: 'lookX', amplitude: 0.4, travelMin: 1, travelMax: 1, intervalMin: 0, intervalMax: 0 });
  const y = behavior({ id: 'y', type: 'drift', parameter: 'lookY', amplitude: 0.1, travelMin: 1, travelMax: 1, intervalMin: 0, intervalMax: 0 });
  controller.evaluate([x, y], 0);
  const runtime = controller.evaluate([x, y], 2);
  assert.deepEqual(Object.keys(runtime.contributions).sort(), ['x', 'y']);
  // Each drift reaches its own amplitude, not a shared one.
  assert.ok(Math.abs(runtime.contributions.x - 0.4) < 1e-9, `x ${runtime.contributions.x}`);
  assert.ok(Math.abs(runtime.contributions.y - 0.1) < 1e-9, `y ${runtime.contributions.y}`);
});

test('two random idles no longer share one value', () => {
  const controller = createBehaviorController({ random: sequence([0, 1]) });
  const a = behavior({ id: 'a', type: 'randomIdle', parameter: 'headX', min: -1, max: 1, intervalMin: 0, intervalMax: 0 });
  const b = behavior({ id: 'b', type: 'randomIdle', parameter: 'headY', min: -1, max: 1, intervalMin: 0, intervalMax: 0 });
  const runtime = controller.evaluate([a, b], 1);
  assert.notEqual(runtime.contributions.a, runtime.contributions.b);
});

test('blink closes the eyes and reopens them', () => {
  const controller = createBehaviorController({ random: () => 0 });
  const blink = behavior({ id: 'blink', type: 'blink', parameter: 'eyeOpen', duration: 0.12, intervalMin: 2, intervalMax: 2, closedValue: 0 });
  const at = (time) => composeBehaviorParams({ eyeOpen: 1 }, [blink], time, controller.evaluate([blink], time)).eyeOpen;
  assert.equal(at(0), 1, 'open at rest');
  assert.equal(at(2), 0, 'closed');
  assert.equal(at(2.2), 1, 'open again');
});

test('blink never fights an expression that already closes the eyes', () => {
  const controller = createBehaviorController({ random: sequence([0]) });
  const blink = behavior({ id: 'blink', type: 'blink', parameter: 'eyeOpen', duration: 0.12, intervalMin: 0, intervalMax: 0, closedValue: 0.2 });
  const runtime = controller.evaluate([blink], 0);
  // The expression has the eyes at 0.05; a blink to 0.2 must not open them.
  assert.equal(composeBehaviorParams({ eyeOpen: 0.05 }, [blink], 0, runtime).eyeOpen, 0.05);
  assert.equal(composeBehaviorParams({ eyeOpen: 1 }, [blink], 0, runtime).eyeOpen, 0.2);
});

test('a double blink is a short second close, not a longer one', () => {
  const always = createBehaviorController({ random: () => 0 });
  const blink = behavior({ id: 'blink', type: 'blink', parameter: 'eyeOpen', duration: 0.1, intervalMin: 1, intervalMax: 1, doubleChance: 1 });
  const closedAt = (controller, time) => controller.evaluate([blink], time).closed.blink;
  closedAt(always, 0);
  assert.equal(closedAt(always, 1), true, 'first close');
  assert.equal(closedAt(always, 1.15), false, 'brief opening');
  assert.equal(closedAt(always, 1.2), true, 'second close');
  assert.equal(closedAt(always, 1.35), false, 'and open again, not a longer blink');
  const never = createBehaviorController({ random: () => 0.99 });
  const single = behavior({ id: 'blink', type: 'blink', parameter: 'eyeOpen', duration: 0.1, intervalMin: 1, intervalMax: 1, doubleChance: 0 });
  never.evaluate([single], 0);
  never.evaluate([single], 1);
  assert.equal(never.evaluate([single], 1.2).closed.blink, false, 'no second close when the chance is zero');
});

test('behaviours that are switched off contribute nothing', () => {
  const controller = createBehaviorController({ random: () => 0 });
  const drift = behavior({ id: 'wander', type: 'drift', parameter: 'lookX', amplitude: 0.4, enabled: false });
  assert.deepEqual(composeBehaviorParams({ lookX: 0 }, [drift], 5, controller.evaluate([drift], 5)), { lookX: 0 });
});

test('a behaviour whose parameter is gone is skipped rather than inventing one', () => {
  const controller = createBehaviorController({ random: () => 0 });
  const drift = behavior({ id: 'wander', type: 'drift', parameter: 'ghost', amplitude: 0.4 });
  assert.deepEqual(composeBehaviorParams({ lookX: 0 }, [drift], 5, controller.evaluate([drift], 5)), { lookX: 0 });
});

test('removing a behaviour drops its state', () => {
  const controller = createBehaviorController({ random: () => 0 });
  const drift = behavior({ id: 'wander', type: 'drift', parameter: 'lookX', amplitude: 0.4, travelMin: 1, travelMax: 1, intervalMin: 0, intervalMax: 0 });
  controller.evaluate([drift], 3);
  assert.deepEqual(controller.evaluate([], 4).contributions, {});
  controller.reset();
  assert.deepEqual(controller.evaluate([drift], 0).contributions, { wander: 0 }, 'starts fresh');
});

test('the cartoon idle presets exist and use runtime types only', () => {
  const ids = AUTOMATIC_PRESETS.map((preset) => preset.id);
  for (const id of ['blink', 'eye-wander', 'head-drift', 'breathing', 'body-bounce', 'hand-drift']) assert.ok(ids.includes(id), id);
  for (const preset of AUTOMATIC_PRESETS) for (const spec of preset.behaviors) assert.ok(BEHAVIOR_TYPES.includes(spec.type), `${preset.id}/${spec.parameter}`);
});

test('idle amplitudes stay small enough not to look like shivering', () => {
  for (const preset of AUTOMATIC_PRESETS) {
    for (const spec of preset.behaviors) {
      if (spec.amplitude === undefined) continue;
      assert.ok(Math.abs(spec.amplitude) <= 0.25, `${preset.id}/${spec.parameter} amplitude ${spec.amplitude}`);
    }
  }
});

test('a preset is unavailable, not broken, when its movement does not exist', () => {
  const document = { params: { eyeOpen: { min: 0, max: 1, default: 1 } }, behaviors: [] };
  const status = deriveAutomaticStatus(document);
  assert.equal(status.presets.find((item) => item.id === 'hand-drift').status, 'unavailable');
  assert.equal(status.presets.find((item) => item.id === 'blink').status, 'off');
});

test('drift settings are validated in the author language', () => {
  const state = { params: { lookX: { min: -1, max: 1, default: 0 } }, states: {}, elements: {}, activeState: null, transitions: {},
    behaviors: [{ id: 'a', type: 'drift', parameter: 'lookX', amplitude: 0, travelMin: 0, travelMax: 1, intervalMin: 0, intervalMax: 1 }] };
  const issues = validateRig(state);
  assert.ok(issues.some((issue) => /drift amplitude must be finite and not zero/.test(issue)));
  assert.ok(issues.some((issue) => /drift travel times must be positive/.test(issue)));
});

test('normalizeBehaviors keeps drift records intact', () => {
  const [drift] = normalizeBehaviors({ behaviors: [{ id: 'w', type: 'drift', parameter: 'lookX', amplitude: 0.2, travelMin: 0.5, travelMax: 2 }] });
  assert.equal(drift.type, 'drift');
  assert.equal(drift.travelMin, 0.5);
  assert.equal(drift.travelMax, 2);
});
