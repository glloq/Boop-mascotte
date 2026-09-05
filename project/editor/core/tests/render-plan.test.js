import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENT_RENDER_PLAN, RENDER_TARGETS, SESSION_RENDER_PLAN, createRenderPlan } from '../state/render-plan.js';
import { PROJECT_DOMAINS } from '../state/project-document.js';

/**
 * The render fan-out as data (VNX-05, docs/VNEXT_ROADMAP.md). What used to be
 * twelve hand-written closures in `main.js` is a table, so the questions an
 * author actually has — *what redraws when I change a parameter?*, *does
 * anything watch the hands?* — have answers a test can check.
 */

const stub = () => Object.fromEntries(RENDER_TARGETS.map((name) => [name, () => {}]));

test('every document domain has a plan, and no plan invents a domain', () => {
  const domains = Object.keys(PROJECT_DOMAINS);
  assert.deepEqual(domains.filter((domain) => !(domain in DOCUMENT_RENDER_PLAN)), [],
    'a domain with no plan notifies nothing: the panel that needs it silently goes stale');
  assert.deepEqual(Object.keys(DOCUMENT_RENDER_PLAN).filter((domain) => !domains.includes(domain)), [],
    'a plan for a domain the store does not have will never run');
});

test('every plan names targets that exist, and every target is used by something', () => {
  const used = new Set([...Object.values(DOCUMENT_RENDER_PLAN), ...Object.values(SESSION_RENDER_PLAN)].flat());
  for (const name of used) assert.ok(RENDER_TARGETS.includes(name), `${name} is not a declared target`);
  assert.deepEqual(RENDER_TARGETS.filter((name) => !used.has(name)), [],
    'a target nothing runs is either dead or the plan that should name it is wrong');
});

test('the plan is wired against the real panels, and says so when it is not', () => {
  const targets = stub();
  delete targets.inspector;
  assert.throws(() => createRenderPlan(targets), /missing targets: inspector/);
  assert.throws(() => createRenderPlan({ ...stub(), ghost: () => {} }), /does not know: ghost/);
});

test('running a domain runs exactly its targets, in order', () => {
  const ran = [];
  const targets = Object.fromEntries(RENDER_TARGETS.map((name) => [name, () => ran.push(name)]));
  const plan = createRenderPlan(targets);
  assert.deepEqual(plan.run('hands'), ['handSetup', 'puppetHandles']);
  assert.deepEqual(ran, ['handSetup', 'puppetHandles'], 'and nothing else was touched');
  // A pose-grid edit only moves the handles that are drawn; it does not
  // rebuild the set, which is a different and much more expensive job.
  assert.ok(DOCUMENT_RENDER_PLAN.keyforms.includes('puppetHandlesRefresh'));
  assert.equal(DOCUMENT_RENDER_PLAN.keyforms.includes('puppetHandles'), false);
  // The canvas reconciles before the panels that measure what it drew.
  assert.equal(plan.run('artwork')[0], 'canvasState');
  assert.equal(plan.run('layers')[0], 'layerOrder');
  assert.throws(() => plan.run('nope'), /No render plan for "nope"/);
});

test('one target that throws does not stop the rest', () => {
  // Half a redrawn editor is bad; an editor that stops redrawing is worse.
  const seen = [];
  const targets = { ...stub(), timeline: () => { throw new Error('boom'); }, rigPanel: () => seen.push('rigPanel') };
  const errors = [];
  const plan = createRenderPlan(targets, { onError: (name, error) => errors.push([name, error.message]) });
  assert.ok(plan.run('rig').includes('rigPanel'));
  assert.deepEqual(errors, [['timeline', 'boom']]);
  assert.deepEqual(seen, ['rigPanel']);
});

test('the session plan is separate, because selection never makes a project dirty', () => {
  assert.deepEqual(Object.keys(SESSION_RENDER_PLAN), ['selectedId']);
  const ran = [];
  const plan = createRenderPlan(Object.fromEntries(RENDER_TARGETS.map((name) => [name, () => ran.push(name)])));
  assert.deepEqual(plan.run('selectedId', SESSION_RENDER_PLAN), ['canvasSelection', 'layers', 'inspector', 'rigPanel', 'headPose']);
});

test('the fan-out is now measurable, which is the point of writing it down', () => {
  const width = Object.entries(DOCUMENT_RENDER_PLAN).map(([domain, list]) => [domain, list.length]);
  // Changing one rig parameter redraws fourteen things. That number is the
  // argument for the ViewModel gate (VNX-04); it is recorded here so a later
  // change to it is deliberate and visible in a diff. It grew by two when the
  // gaze solver landed in this domain (docs/FACE_CONTROL_RIG.md): its own
  // panel, and the frame -- switching the solver on changes what every
  // parameter *produces*, and the mascot went on showing the old pose.
  assert.deepEqual(Object.fromEntries(width), {
    artwork: 8, layers: 5, rig: 14, stateMachine: 3, semanticRig: 5, rigHandles: 2,
    animation: 4, arrangement: 1, keyforms: 5, hands: 2, hierarchy: 1, expressions: 3, reactions: 2
  });
  // A domain that redraws nothing is a domain whose edits are invisible until
  // something unrelated happens. `hierarchy` was that domain, and `keyforms`
  // notified four panels while leaving the mascot itself alone.
  const silent = Object.entries(DOCUMENT_RENDER_PLAN).filter(([, list]) => !list.length).map(([domain]) => domain);
  assert.deepEqual(silent, [], `these domains change the document and redraw nothing: ${silent.join(', ')}`);
});
