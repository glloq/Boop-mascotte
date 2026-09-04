import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RUNTIME_MODULES, bundleRuntimeSource } from '../export/runtime-bundle.js';
import { createExportRig } from '../export/export-rig.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { PROJECT_DOMAINS, createProjectDocument } from '../state/project-document.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';
import { createCartoonMascot } from './fixtures/cartoon-mascot.js';

/**
 * VNX-01 — the public contracts, frozen (docs/VNEXT_ROADMAP.md).
 *
 * VNext rearranges the editor around four workspaces. Everything it is allowed
 * to move lives inside the editor; four things it is not allowed to break live
 * outside it, because someone else already depends on them:
 *
 *   ProjectDocument   a file a user saved
 *   rig.json          a file a page fetches
 *   mascot.svg        the markup that page mounts
 *   runtime API       the calls that page makes
 *
 * A refactor cannot know it broke one of these by reading its own diff. So the
 * contracts are executable: change the shape of a saved project or drop a
 * method a page calls, and this fails with the name of what was lost. Adding
 * is always allowed — every assertion here is about what must still be there.
 *
 * The editor/runtime import boundary is held up by `release-regressions.test.js`
 * and is deliberately not repeated here.
 */

/** The runtime a page actually receives, not the modules the editor imports. */
async function loadExportedRuntime() {
  const modules = await Promise.all(RUNTIME_MODULES.map(async (name) => ({
    name, source: await readFile(new URL(`../../../runtime/${name}`, import.meta.url), 'utf8')
  })));
  return import(`data:text/javascript;base64,${Buffer.from(bundleRuntimeSource(modules)).toString('base64')}`);
}

function engineFor(runtime, model = createExportRig(normalizeRig(createCartoonMascot()))) {
  const nodes = new Map();
  const svgRoot = { id: '', querySelector: (selector) => nodes.get(selector.slice(1)) || null, querySelectorAll: null };
  for (const id of Object.keys(model.elements)) nodes.set(id, { id, tagName: 'g', style: {}, setAttribute() {} });
  return runtime.createMascotEngine({ svgRoot, rig: model, requestFrame: () => 1, cancelFrame: () => {}, now: () => 0, random: () => 0.5 });
}

/** Every call `docs/RUNTIME_API.md` promises a page it can make. */
const PUBLIC_RUNTIME_API = Object.freeze([
  'setParameter', 'clearParameter',
  'setExpression', 'transitionToExpression', 'clearExpression', 'clearExpressions', 'getExpressions', 'getExpressionWeights',
  'playMotion', 'stopMotion', 'getMotions', 'getMotionWeights',
  'triggerReaction', 'getReactions', 'getActiveReaction', 'clearReactions',
  'setHandPose', 'getHandPoses', 'setHandInertiaEnabled',
  'setState', 'setBehaviorEnabled',
  'start', 'stop', 'isSettled', 'getParams', 'bindEvents'
]);

/** Names that predate V2. They are aliases, and they never go away. */
const RUNTIME_ALIASES = Object.freeze(['setParam', 'clearParam', 'playAnimation', 'stopAnimation', 'getAnimation', 'getAnimations', 'trigger', 'fire']);

test('the runtime keeps every call a page is allowed to make', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  for (const method of [...PUBLIC_RUNTIME_API, ...RUNTIME_ALIASES]) {
    assert.equal(typeof engine[method], 'function', `runtime API lost ${method}()`);
  }
  assert.equal(typeof runtime.load, 'function', 'BoopMascot.load');
  assert.equal(typeof runtime.createMascotEngine, 'function', 'BoopMascot.createMascotEngine');
});

test('an alias and the name that replaced it stay the same operation', async () => {
  const runtime = await loadExportedRuntime();
  const engine = engineFor(runtime);
  assert.equal(engine.setParameter('headX', 0.4), true);
  assert.equal(engine.getParams().headX, 0.4);
  engine.setParam('headX', 0.9);
  assert.equal(engine.getParams().headX, 0.9, 'setParam and setParameter write the same place');
  engine.clearParam('headX');
  assert.equal(engine.getParams().headX, 0, 'and clearParam and clearParameter clear the same place');
});

test('rig.json keeps every field a runtime reads', () => {
  const rig = createExportRig(normalizeRig(createCartoonMascot()));
  // Order is not a contract; presence is. A page loading an older runtime
  // ignores fields it does not know, so adding one is safe and removing one
  // is not.
  for (const key of ['schemaVersion', 'params', 'states', 'elements', 'activeState', 'transitions', 'transitionSettings',
    'globalConstraints', 'stateConstraints', 'runtimeConfig', 'behaviors', 'expressions', 'animations', 'reactions',
    'keyforms', 'shapeKeys', 'warps', 'hands', 'deformers', 'parallax', 'expressionBlend', 'motionBlend']) {
    assert.ok(key in rig, `rig.json lost ${key}`);
  }
  assert.equal(rig.schemaVersion, RIG_SCHEMA_VERSION);
  assert.equal('rigHandles' in rig, false, 'authoring-only state never reaches the runtime');
  assert.equal('semanticParts' in rig, false);
});

test('every document key belongs to exactly one domain, and every domain names a real key', () => {
  // This is what makes VNX-05 possible at all: a key no domain names can never
  // notify a scoped subscriber, so a panel watching it would silently go stale.
  const flat = Object.values(PROJECT_DOMAINS).flat();
  const duplicated = flat.filter((key, index) => flat.indexOf(key) !== index);
  assert.deepEqual(duplicated, [], 'a key in two domains is written twice and notified twice');

  const document = createProjectDocument({});
  const keys = Object.keys(document);
  // `schemaVersion` is the format stamp rather than a domain anyone mutates.
  assert.deepEqual(keys.filter((key) => !flat.includes(key)), ['schemaVersion']);
  assert.deepEqual(flat.filter((key) => !keys.includes(key)), [], 'a domain naming a key the document has not got notifies nothing');
});

test('a saved project survives the round trip in every domain', () => {
  const source = createCleanProjectState();
  source.svgMarkup = '<svg><g id="head"/></svg>';
  source.params = { headX: { value: 0.5, min: -1, max: 1, default: 0 }, mouthOpen: { value: 0, min: 0, max: 1, default: 0 } };
  source.elements = { head: { id: 'head', baseTransform: { x: 3, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'g' } } };
  source.layers = [{ id: 'head', type: 'g', name: 'head', children: [] }];
  source.states = { idle: {}, happy: {} };
  source.activeState = 'idle';
  source.transitions = { idle: ['happy'] };
  source.semanticParts = { mouth: { type: 'mouth', roles: { mouth: 'head' } } };
  source.animationClips = [{ id: 'wave', name: 'Wave', duration: 1, tracks: [] }];
  source.expressions = [{ id: 'happy', name: 'Happy', params: { mouthOpen: 0.4 } }];
  source.reactions = [{ id: 'hello', name: 'Hello', trigger: { type: 'click' }, expression: 'happy' }];
  source.behaviors = [{ id: 'blink', type: 'blink', enabled: true }];
  source.rigHandles = [{ id: 'mouth', name: 'Lips' }];

  const load = (state) => { const next = createCleanProjectState(); applyProjectSnapshot(next, createProjectSnapshot(state)); return next; };
  const once = load(source);

  // What was authored is still there, domain by domain. Saving cannot lose it.
  assert.equal(once.svgMarkup, '<svg><g id="head"/></svg>');
  assert.equal(once.params.headX.value, 0.5);
  assert.equal(once.elements.head.baseTransform.x, 3);
  assert.deepEqual(once.layers.map((layer) => layer.id), ['head']);
  assert.deepEqual(Object.keys(once.states).sort(), ['happy', 'idle']);
  assert.deepEqual(once.transitions.idle, ['happy']);
  assert.equal(once.semanticParts.mouth.type, 'mouth');
  assert.deepEqual(once.animationClips.map((clip) => clip.id), ['wave']);
  assert.deepEqual(once.expressions.map((item) => item.id), ['happy']);
  assert.deepEqual(once.reactions.map((item) => item.id), ['hello']);
  assert.deepEqual(once.behaviors.map((item) => item.id), ['blink']);
  assert.deepEqual(once.rigHandles, [{ id: 'mouth', name: 'Lips' }]);

  // And loading normalizes exactly once: the second round trip changes
  // nothing, in any domain. A format that drifts on every save is a format
  // that eventually stops opening.
  const twice = createProjectDocument(load(once));
  const first = createProjectDocument(once);
  for (const [domain, keys] of Object.entries(PROJECT_DOMAINS)) {
    for (const key of keys) {
      assert.deepEqual(twice[key], first[key], `${domain} drifts on ${key} every time the project is saved`);
    }
  }
});

test('a project saved before a field existed still opens', () => {
  // `normalizeRig` is the one migration boundary, and a v1 rig is the oldest
  // thing anyone can still be holding.
  const rig = normalizeRig({ params: { headX: { min: -1, max: 1, default: 0 } }, elements: { head: {} }, states: { idle: {} } });
  assert.equal(rig.schemaVersion, RIG_SCHEMA_VERSION);
  const document = createProjectDocument({});
  for (const key of Object.values(PROJECT_DOMAINS).flat()) {
    assert.notEqual(document[key], undefined, `an empty project has no ${key}, so opening one would throw`);
  }
});
