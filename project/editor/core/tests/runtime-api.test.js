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

test('setHandStyle shows a drawing the hand actually has', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.deepEqual(engine.getHandStyles('right').map((style) => style.id), ['relaxed', 'open']);
  assert.equal(engine.setHandStyle('right', 'open'), true);
  assert.equal(engine.getParams().handRStyle, 1);
  assert.equal(engine.setHandStyle('right', 'relaxed'), true);
  assert.equal(engine.getParams().handRStyle, 0);
  // An old name the registry can follow resolves; one nothing can is refused
  // rather than guessed at (docs/HAND_STYLES.md, "Fallback").
  assert.equal(engine.setHandStyle('right', 'palmOpen'), true);
  assert.equal(engine.getParams().handRStyle, 1);
  assert.equal(engine.setHandStyle('right', 'peace'), false, 'a drawing the hand does not have');
  assert.equal(engine.setHandStyle('left', 'open'), false, 'the other hand has no drawings at all');
});

test('setHandPose is kept as the name a page written before the refit calls', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.deepEqual(engine.getHandPoses('right'), engine.getHandStyles('right'));
  assert.equal(engine.setHandPose('right', 'open', 1), true);
  assert.equal(engine.getParams().handRStyle, 1);
  assert.equal(engine.setHandPose('right', 'open', 0.2), false, 'a style is chosen, never half-raised');
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

/* ── A hand in the exported file (docs/HAND_STYLES.md) ─────────────────────── */

/**
 * The runtime a page receives is one concatenated file, and a hand that shows
 * drawings reaches two modules to do it. Left out of the bundle they are not
 * a missing feature but a `ReferenceError` on load, which takes the whole
 * mascot with it -- so the bundle is asked to run one.
 */
const styleRig = () => {
  const model = rig();
  const names = ['relaxed', 'open', 'fist'];
  const library = names.map((id) => ({ id, element: `draw-${id}` }));
  for (const entry of library) {
    model.elements[entry.element] = { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: {}, bindings: {} };
  }
  const hand = model.hands?.left || { element: Object.keys(model.elements)[0] };
  model.hands = { ...model.hands, left: { ...hand, styles: { swap: 'cut', showing: 'open', library } } };
  model.params.handLStyle = { type: 'number', min: 0, max: 2, default: 1, value: 1, options: names };
  return { model, names };
};

test('the exported runtime carries the hand, and shows one of its drawings', async () => {
  const runtime = await loadExportedRuntime();
  const { model, names } = styleRig();
  // Every piece the hand needs is in the one file the page gets.
  for (const name of ['normalizeHandStyleSet', 'createHandStyleSwaps', 'createHandSwap', 'handStyleId', 'handStyleList', 'HAND_STYLES', 'resolveHandStyle']) {
    assert.equal(typeof runtime[name] !== 'undefined', true, name);
  }
  const hands = runtime.normalizeHands(model);
  assert.equal(hands.left.styles.library.length, 3);
  const swaps = runtime.createHandStyleSwaps(hands);
  const frame = runtime.compileRigFrame(model.elements, { ...Object.fromEntries(Object.entries(model.params).map(([name, item]) => [name, item.default])), handLStyle: 2 },
    {}, {}, { hands, handStyles: swaps });
  const showing = names.filter((id) => frame[`draw-${id}`].opacity > 0.001);
  assert.deepEqual(showing, ['fist'], 'one drawing, and the one the parameter asked for');
  assert.equal(frame[hands.left.element].handStyle, 'fist');
});

test('the bundle keeps one declaration of every name the hand modules share', async () => {
  const modules = await Promise.all(RUNTIME_MODULES.map(async (name) => ({
    name, source: await readFile(new URL(`../../../runtime/${name}`, import.meta.url), 'utf8')
  })));
  // `bundleRuntimeSource` throws on a collision; this pins that the hand
  // modules are in the list at all, and ahead of the module that reads them.
  const order = modules.map((module) => module.name);
  for (const name of ['hand-vocabulary.js', 'hand-sprite.js']) {
    assert.ok(order.includes(name), name);
    assert.ok(order.indexOf(name) < order.indexOf('hands.js'), `${name} before hands.js`);
  }
  assert.ok(order.indexOf('depth.js') < order.indexOf('hands.js'), 'depth.js before the hands that band by it');
  assert.doesNotThrow(() => bundleRuntimeSource(modules));
});
