import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFollower, normalizeFollowers, createFollowerGroup,
  DEFAULT_FOLLOWER_AMOUNT, compileRigFrame, createMascotEngine
} from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';

const STEP = 1 / 60;
const hair = (over = {}) => ({ element: 'hair', ...over });

test('a follower is one element lagging one parameter, and a rig declares at most one per element', () => {
  const follower = normalizeFollower({ element: 'hair' });
  assert.equal(follower.parameterX, 'headX');
  assert.equal(follower.parameterY, 'headY');
  assert.deepEqual(follower.amount, { ...DEFAULT_FOLLOWER_AMOUNT });
  assert.equal(follower.enabled, true);
  assert.ok(follower.inertia.stiffness > 0, 'a spring that cannot move is not a spring');

  assert.deepEqual(normalizeFollowers({ followers: [hair(), hair({ amount: { x: 30 } })] }).map((item) => item.amount.x),
    [DEFAULT_FOLLOWER_AMOUNT.x], 'the second declaration for one element is dropped, not merged');
  assert.deepEqual(normalizeFollowers({ followers: [{ amount: { x: 3 } }] }), [], 'a follower with no artwork follows nothing');
  assert.deepEqual(normalizeFollowers({}), [], 'and a rig that declares none has none');
  // A stiffness of 0 would leave the follower behind for ever, which is not lag
  // but a part that has come off.
  assert.ok(normalizeFollower({ element: 'hair', inertia: { stiffness: 0 } }).inertia.stiffness > 0);
});

test('a head that is not moving displaces nothing at all', () => {
  const group = createFollowerGroup(normalizeFollowers({ followers: [hair()] }));
  // Seeded from the first value it is given, wherever the head happens to be
  // held: starting a preview on a turned head must not look like a movement.
  for (let frame = 0; frame < 120; frame += 1) {
    const offset = group.step({ headX: 0.8, headY: -0.4 }, STEP).hair;
    assert.equal(offset.x, 0, `frame ${frame}`);
    assert.equal(offset.y, 0);
  }
});

test('what the follower writes is how far behind it is, so it trails and then catches up', () => {
  const group = createFollowerGroup(normalizeFollowers({ followers: [hair({ amount: { x: 10, y: 0, rotation: 4 } })] }));
  group.step({ headX: 0 }, STEP);
  // The head snaps right. The hair is still where the head was, which is to the
  // left of where it is now: the displacement is against the movement.
  const first = group.step({ headX: 1 }, STEP).hair;
  assert.ok(first.x < 0, 'it drags behind the turn');
  assert.ok(first.rotation < 0, 'and swings with it, for anything long enough to read a rotation');
  assert.ok(first.x > -10, 'but never further behind than the movement itself');

  // Held there it arrives, but not immediately and not in a straight line: the
  // spring is under-damped on purpose, so it swings past and comes back. That
  // is the settle, and it is why "has it converged yet" is asked at the end of
  // a fixed run rather than the first time the value dips small.
  for (let frame = 0; frame < 5; frame += 1) group.step({ headX: 1 }, STEP);
  assert.ok(Math.abs(group.step({ headX: 1 }, STEP).hair.x) > 0.1, 'a few frames in, it is still visibly behind');
  let crossings = 0, previous = group.step({ headX: 1 }, STEP).hair.x;
  for (let frame = 0; frame < 300; frame += 1) {
    const now = group.step({ headX: 1 }, STEP).hair.x;
    if (now !== 0 && previous !== 0 && Math.sign(now) !== Math.sign(previous)) crossings += 1;
    previous = now;
  }
  assert.ok(crossings >= 1, 'it overshoots at least once rather than stopping dead on the mark');
  assert.ok(Math.abs(previous) < 0.01, 'and it is arrived by the end');
});

test('the offsets are one object, reused, because this runs on every frame of every element', () => {
  const group = createFollowerGroup(normalizeFollowers({ followers: [hair()] }));
  const first = group.step({ headX: 0 }, STEP);
  assert.equal(group.step({ headX: 1 }, STEP), first, 'the map is the same object');
  assert.equal(group.step({ headX: 1 }, STEP).hair, first.hair, 'and so is each element’s point');

  // A recompile that is not a new frame holds what is on screen instead of
  // advancing the spring by an invented step.
  const held = { ...group.step({ headX: -1 }, STEP).hair };
  assert.deepEqual({ ...group.step({ headX: -1 }, 0).hair }, held);
  group.reset();
  assert.deepEqual({ ...group.step({ headX: -1 }, 0).hair }, { x: 0, y: 0, rotation: 0 });
});

test('the frame adds the trail to the pose, under the same constraints as everything else', () => {
  const elements = { hair: { baseTransform: { x: 1, y: 2, rotation: 3, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 } } };
  const locked = { hair: { ...elements.hair, constraints: { translate: false } } };
  const offsets = { hair: { x: -5, y: 2, rotation: -7 } };
  const frame = (options) => compileRigFrame(elements, {}, {}, {}, options).hair.transform;
  assert.deepEqual(frame({}), { x: 1, y: 2, rotation: 3, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 });
  const trailed = frame({ followerOffsets: offsets });
  assert.equal(trailed.x, -4);
  assert.equal(trailed.y, 4);
  assert.equal(trailed.rotation, -4);
  // A rig that switches translation off switches the trail off with it, and a
  // state that damps it damps the trail too: this is a movement, not a second
  // channel that outranks the constraints.
  // The artwork's own placement stays -- a constraint disables the animation,
  // not where the piece was drawn -- so what has to disappear is the trail.
  const held = compileRigFrame(locked, {}, {}, {}, { followerOffsets: offsets }).hair.transform;
  assert.equal(held.x, 1);
  assert.equal(held.y, 2);
  assert.equal(compileRigFrame(elements, {}, { translate: 0.5 }, {}, { followerOffsets: offsets }).hair.transform.x, 1 + -5 * 0.5, 'a damped state damps the trail with everything else');
});

test('the block survives a round trip, and a rig without one is byte-identical to before', () => {
  const state = { params: {}, states: {}, activeState: '', transitions: {}, elements: {}, followers: [hair({ amount: { x: 12, y: 3, rotation: 2 } })] };
  const exported = createExportRig(state);
  assert.deepEqual(exported.followers.map((item) => item.element), ['hair']);
  assert.deepEqual(exported.followers[0].amount, { x: 12, y: 3, rotation: 2 });
  const normalized = normalizeRig(exported);
  assert.deepEqual(normalized.followers, exported.followers, 'normalizing is idempotent on what export writes');
  assert.deepEqual(normalizeRig(createExportRig({ ...state, followers: undefined })).followers, []);
});

/** The exported engine, driven the way the other runtime tests drive it. */
test('the exported engine is what runs the springs, and only while it is running', () => {
  const nodes = {};
  const node = (id) => (nodes[id] = { id, attrs: {}, tagName: 'path', setAttribute(name, value) { this.attrs[name] = value; }, getAttribute(name) { return this.attrs[name] ?? null; } });
  const root = { id: 'mascot', querySelectorAll: () => [node('head'), node('hair')] };
  const rig = {
    schemaVersion: 4,
    params: { headX: { min: -1, max: 1, default: 0, value: 0 } },
    states: { idle: { headX: 0 } }, activeState: 'idle', transitions: {},
    elements: {
      head: { baseTransform: {}, bindings: { translateX: { enabled: true, expression: 'headX', amplitude: 20 } } },
      hair: { baseTransform: {}, bindings: { translateX: { enabled: true, expression: 'headX', amplitude: 20 } } }
    },
    followers: [hair({ amount: { x: 12, y: 0, rotation: 0 } })]
  };
  const frames = new Map();
  let key = 0, clock = 0;
  const engine = createMascotEngine({
    svgRoot: root, rig, fps: 60,
    requestFrame: (fn) => { frames.set(++key, fn); return key; },
    cancelFrame: (id) => frames.delete(id),
    now: () => clock
  });
  const advance = () => { clock += 20; const pending = [...frames.entries()]; frames.clear(); pending.forEach(([, fn]) => fn(clock)); };
  const at = (id) => Number(/translate\(([-\d.]+)/.exec(nodes[id].attrs.transform)?.[1]);

  engine.start();
  advance();
  assert.equal(at('head'), at('hair'), 'at rest the hair is exactly where the head put it');
  engine.setParam('headX', 1);
  advance();
  assert.ok(at('hair') < at('head'), 'the head arrives first and the hair is still on its way');
  for (let frame = 0; frame < 120; frame += 1) advance();
  assert.ok(Math.abs(at('hair') - at('head')) < 0.01, 'and then it arrives');
  engine.stop();
});

/* ── Which artwork earns one ─────────────────────────────────────────────── */

test('the parts that trail are the ones a viewer expects to be late, and no others', async () => {
  const { suggestedFollowers, FOLLOWER_TUNING } = await import('../followers/follower-model.js');
  const element = () => ({ baseTransform: {}, bindings: {} });
  const document = {
    elements: Object.fromEntries(['face', 'hairFront', 'hairBack', 'earL', 'earR', 'nose', 'eyeL', 'eyeR'].map((id) => [id, element()])),
    semanticParts: {
      head: { id: 'head', type: 'head', roles: { head: 'face' } },
      hair: { id: 'hair', type: 'hair', roles: { hair: 'hairFront', hairBack: 'hairBack' } },
      ears: { id: 'ears', type: 'ears', roles: { leftEar: 'earL', rightEar: 'earR' } },
      nose: { id: 'nose', type: 'nose', roles: { nose: 'nose' } },
      eyes: { id: 'eyes', type: 'eyes', roles: { leftEye: 'eyeL', rightEye: 'eyeR' } }
    }
  };
  const followers = suggestedFollowers(document);
  assert.deepEqual(followers.map((item) => item.element), ['hairFront', 'hairBack', 'earL', 'earR'],
    'a nose that lagged would read as the face coming apart, not as weight');
  const by = Object.fromEntries(followers.map((item) => [item.element, item]));
  assert.ok(by.hairBack.inertia.stiffness < by.earL.inertia.stiffness, 'the back of the hair is the slowest thing on the head');
  assert.ok(by.hairBack.amount.x > by.earL.amount.x, 'and it swings furthest');
  assert.equal(by.earL.amount.rotation, 0, 'an ear that rotates looks broken; hair that rotates looks alive');
  assert.ok(by.hairFront.amount.rotation > 0);
  assert.deepEqual(by.hairFront.amount, { ...FOLLOWER_TUNING.hair.amount });

  // Artwork the author never assigned a role to earns nothing, and neither does
  // a role pointing at a piece that has since been deleted.
  assert.deepEqual(suggestedFollowers({ elements: document.elements, semanticParts: {} }), []);
  assert.deepEqual(suggestedFollowers({ elements: {}, semanticParts: document.semanticParts }), []);
});

test('a saved project brings its trail back, and one saved before there was one has none', async () => {
  const { createProjectSnapshot, applyProjectSnapshot } = await import('../state/project-snapshot.js');
  const state = {
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L1 1"/></svg>',
    params: {}, states: {}, activeState: null, transitions: {}, elements: {},
    followers: [hair({ amount: { x: 9, y: 5, rotation: 2 } })]
  };
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  assert.deepEqual(snapshot.document.rig.followers.map((item) => item.element), ['hair'],
    'it travels in the rig half, because it is what the mascot ships with and not how the editor is arranged');

  const restored = {};
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.followers, snapshot.document.rig.followers);

  // A project saved before 3D-10 opens with nothing trailing rather than
  // `undefined`, which the panel and the preview would both have to guard.
  const older = structuredClone(snapshot);
  delete older.document.rig.followers;
  const opened = {};
  applyProjectSnapshot(opened, older);
  assert.deepEqual(opened.followers, []);
});
