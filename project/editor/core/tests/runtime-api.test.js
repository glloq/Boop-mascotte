import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RUNTIME_MODULES, bundleRuntimeSource } from '../export/runtime-bundle.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { createCartoonMascot } from './fixtures/cartoon-mascot.js';

/** The runtime a page actually receives. */
async function loadExportedRuntime() {
  const modules = await Promise.all(RUNTIME_MODULES.map(async (name) => ({
    name, source: await readFile(new URL(`../../../runtime/${name}`, import.meta.url), 'utf8')
  })));
  return import(`data:text/javascript;base64,${Buffer.from(bundleRuntimeSource(modules)).toString('base64')}`);
}

const rig = () => createExportRig(normalizeRig(createCartoonMascot()));

function engineFor(runtime, model = rig()) {
  const nodes = new Map();
  const svgRoot = { id: '', querySelector: (selector) => nodes.get(selector.slice(1)) || null, querySelectorAll: null };
  for (const id of Object.keys(model.elements)) nodes.set(id, { id, tagName: 'g', style: {}, setAttribute() {} });
  return runtime.createMascotEngine({ svgRoot, rig: model, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0, random: () => 0.5 });
}

test('the exported runtime offers the documented public API', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  for (const method of ['setExpression', 'transitionToExpression', 'playMotion', 'triggerReaction', 'setParameter', 'setHandPose', 'showHands', 'hideHands', 'setState', 'start', 'stop']) {
    assert.equal(typeof engine[method], 'function', method);
  }
  assert.equal(typeof runtime.load, 'function', 'BoopMascot.load');
});

test('setParameter and setParam are the same operation', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.equal(engine.setParameter('headX', 0.5), true);
  assert.equal(engine.getParams().headX, 0.5);
  assert.equal(engine.setParameter('nope', 1), false, 'an unknown parameter is refused, not invented');
  engine.clearParameter('headX');
  assert.equal(engine.getParams().headX, 0);
});

test('playMotion plays a clip and reports it', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.deepEqual(engine.getMotions().map((item) => item.id), ['body-bounce']);
  assert.equal(engine.playMotion('body-bounce'), true);
  assert.equal(engine.getAnimation(), 'body-bounce');
  assert.equal(engine.playMotion('nope'), false);
  assert.equal(engine.stopMotion(), true);
});

test('triggerReaction accepts a reaction id or the event that fires it', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.equal(engine.triggerReaction('hello'), true, 'by id');
  engine.clearReactions();
  assert.equal(engine.triggerReaction('click'), 'hello', 'by event type');
  engine.clearReactions();
  assert.equal(engine.triggerReaction('nothing-listens'), null);
});

test('setHandPose raises a pose the hand actually has', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.deepEqual(engine.getHandPoses('right').map((pose) => pose.id), ['wave']);
  assert.equal(engine.setHandPose('right', 'wave', 0.6), true);
  assert.equal(engine.getParams().handRWave, 0.6);
  assert.equal(engine.setHandPose('right', 'peace'), false, 'a pose the hand does not have');
  assert.equal(engine.setHandPose('left', 'wave'), false, 'the other hand does not have it either');
});

test('setHandPose clamps to the usable range', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  engine.setHandPose('right', 'wave', 9);
  assert.equal(engine.getParams().handRWave, 1);
  engine.setHandPose('right', 'wave', -3);
  assert.equal(engine.getParams().handRWave, 0);
});

test('load mounts artwork, builds the engine and starts it', async () => {
  const runtime = await loadExportedRuntime();
  const svgRoot = { id: 'mascot', tagName: 'svg', style: {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, setAttribute() {} };
  const host = { innerHTML: '', querySelector: (selector) => selector === 'svg' ? svgRoot : null };
  let started = false;
  const mascot = await runtime.load({
    mount: host, svg: '<svg id="mascot"></svg>', rig: rig(),
    requestFrame: () => { started = true; return 1; }, cancelFrame: () => {}, now: () => 0
  });
  assert.equal(host.innerHTML, '<svg id="mascot"></svg>');
  assert.equal(typeof mascot.setExpression, 'function');
  assert.equal(started, true, 'it is running');
  assert.equal(typeof mascot.unbindEvents, 'function', 'and listening');
  mascot.stop();
});

test('load says which selector failed rather than throwing something cryptic', async () => {
  const runtime = await loadExportedRuntime();
  await assert.rejects(() => runtime.load({ mount: null, rig: rig() }), /no element matches/);
});

test('load can skip starting and binding, for a page that drives it itself', async () => {
  const runtime = await loadExportedRuntime();
  const svgRoot = { id: 'mascot', tagName: 'svg', style: {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {} };
  const host = { innerHTML: '', querySelector: () => svgRoot };
  let started = false;
  const mascot = await runtime.load({
    mount: host, svg: '<svg/>', rig: rig(), autoStart: false, bindEvents: false,
    requestFrame: () => { started = true; return 1; }, cancelFrame: () => {}, now: () => 0
  });
  assert.equal(started, false);
  assert.equal(mascot.unbindEvents, undefined);
});

/** Hands that rest behind the head come out for the page (docs/HAND_RIGGING.md, "Behind the head"). */
test('showHands and hideHands bring a hidden pair out and back, through the rig\'s own expression when it has one', async () => {
  const runtime = await loadExportedRuntime();
  const hidden = () => {
    const model = rig();
    model.params.handLShow = { type: 'number', min: 0, max: 1, default: 0, value: 0 };
    model.params.handRShow = { type: 'number', min: 0, max: 1, default: 0, value: 0 };
    model.states[model.activeState].handLShow = 0; model.states[model.activeState].handRShow = 0;
    return model;
  };
  // With the expression: a ramp like any other expression.
  const withExpression = hidden();
  withExpression.expressions = [...(withExpression.expressions || []), { id: 'hands-out', name: 'Hands out', source: 'hands', controls: { handLShow: 1, handRShow: 1 } }];
  const engine = engineFor(runtime, withExpression);
  // The fixture ramps expressions; `duration: 0` is the immediate form, as it is for setExpression.
  assert.equal(engine.showHands({ duration: 0 }), true);
  assert.equal(engine.getExpressions()['hands-out'], 1);
  assert.deepEqual([engine.getParams().handLShow, engine.getParams().handRShow], [1, 1]);
  assert.equal(engine.hideHands({ duration: 0 }), true);
  assert.equal(engine.getParams().handLShow, 0);
  // A span ramps it from where it is, like any expression: the target is set at once, the weight follows the clock.
  assert.equal(engine.showHands({ duration: 200 }), true);
  assert.equal(engine.getExpressions()['hands-out'], 1);
  assert.equal(engine.getExpressionWeights()['hands-out'] || 0, 0, 'no time has passed');
  // Without one: the parameters themselves, and one side at a time when asked.
  const bare = engineFor(runtime, hidden());
  assert.equal(bare.showHands({ side: 'right' }), true);
  assert.deepEqual([bare.getParams().handLShow, bare.getParams().handRShow], [0, 1]);
  assert.equal(bare.showHands(), true);
  assert.equal(bare.getParams().handLShow, 1);
  assert.equal(bare.hideHands(), true);
  assert.deepEqual([bare.getParams().handLShow, bare.getParams().handRShow], [0, 0]);
  // A rig whose hands never hide has nothing to show.
  assert.equal(engineFor(runtime).showHands(), false);
});
