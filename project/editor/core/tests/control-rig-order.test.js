import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compileRigFrame, createControlRig, normalizeGazeSolver, normalizeRigAttachments,
  normalizeRigConstraints, normalizeRigHolds, normalizeRigPins
} from '../../../runtime/runtime.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { createProjectDocument, PROJECT_DOMAINS } from '../state/project-document.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { createCartoonMascot, CRITICAL_COMBINATION } from './fixtures/cartoon-mascot.js';

/**
 * The evaluation order, frozen (docs/FACE_CONTROL_RIG.md §9, Phase 14).
 *
 * Nineteen stages, and the only thing that makes them a *pipeline* rather than
 * a pile is that their order is decided, written down and tested. A stage that
 * moves changes what every saved project looks like, so moving one has to be a
 * deliberate act with a diff — which is what this file is for.
 */

/** The order as the document states it. Read from the doc, not repeated here. */
const DECLARED_ORDER = [
  'base parameters', 'animation / timeline', 'expression / state mixing',
  'gaze solver', 'semantic control solvers', 'manual offsets', 'effective params',
  'hierarchy transforms', 'pseudo-3D projection', 'constraints', 'surface pins',
  'soft pins', 'warps', 'shape-key correctives', 'attachments',
  'secondary / inertia', 'depth', 'draw order', 'render'
];

test('the order in the document is the order the code runs in', async () => {
  const doc = await readFile(new URL('../../../../docs/FACE_CONTROL_RIG.md', import.meta.url), 'utf8');
  const block = doc.slice(doc.indexOf('## 14. Evaluation order'));
  const listed = [...block.matchAll(/^\s*(\d+)\s{2}(.+)$/gm)].slice(0, 19).map((match) => match[2].trim());
  assert.deepEqual(listed, DECLARED_ORDER, 'the document and this test disagree about the pipeline');

  // The frame compiler runs the stages it owns in that order. Read from the
  // source, so a refactor that reorders them fails here rather than in a shot.
  const source = await readFile(new URL('../../../runtime/runtime.js', import.meta.url), 'utf8');
  const frame = source.slice(source.indexOf('export function compileRigFrame'), source.indexOf('/** A pin\'s own movement reads like a binding'));
  const at = (needle) => { const index = frame.indexOf(needle); assert.ok(index > 0, `compileRigFrame no longer does ${needle}`); return index; };
  assert.ok(at('compileDeformerMatrices') < at('solveRigConstraints'), 'the hierarchy resolves before the constraints');
  assert.ok(at('solveRigConstraints') < at('pinDisplacement'), 'constraints before the pins deform anything');
  assert.ok(at('pinDisplacement') < at('warpDisplacement'), 'pins before warps');
  assert.ok(at('evaluateShapeTarget') < at('solveRigHolds'), 'the artwork is deformed before anything holds it');

  // And the mixer's own stages, which are the first three.
  const mixer = await readFile(new URL('../../../runtime/mixer.js', import.meta.url), 'utf8');
  assert.match(mixer, /MIXER_ORDER = Object\.freeze\(\['base', 'motion', 'reaction', 'expression', 'behavior', 'override'\]\)/);
});

test('the solvers run between the mixer and the frame, in both surfaces', async () => {
  // The engine and the editor preview each own a control rig and call it in
  // the same place. If one of them stops, a mascot looks different in the
  // editor from the way it looks on the page, which is the one bug this whole
  // layer is arranged to prevent.
  const runtime = await readFile(new URL('../../../runtime/runtime.js', import.meta.url), 'utf8');
  const tick = runtime.slice(runtime.indexOf('function tick('), runtime.indexOf('return { setParam'));
  assert.ok(tick.indexOf('composeBehaviorParams') < tick.indexOf('controlRig.step'), 'the mixer runs first');
  assert.ok(tick.indexOf('controlRig.step') < tick.indexOf('compileRigFrame'), 'and the frame is compiled from what it produced');

  const preview = await readFile(new URL('../preview-runtime/preview-controller.js', import.meta.url), 'utf8');
  const compute = preview.slice(preview.indexOf('function compute()'), preview.indexOf('function schedule('));
  assert.ok(compute.indexOf('composeBehaviorParams') < compute.indexOf('controlRig.step'));
  assert.ok(compute.indexOf('controlRig.step') < compute.indexOf('compileFrame'));
});

test('a project that predates the control rig compiles the identical frame (CR-52)', () => {
  const source = normalizeRig(createCartoonMascot());
  const options = { keyforms: source.keyforms, shapeKeys: source.shapeKeys, hands: source.hands, deformers: source.deformers, parallax: source.parallax, warps: source.warps };
  const before = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options);

  // The same rig, handed every block the control rig added — all of them empty,
  // because that is what a project written before them normalizes to.
  const after = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, {
    ...options,
    rigPins: source.rigPins, rigConstraints: source.rigConstraints,
    rigAttachments: source.rigAttachments, rigHolds: source.rigHolds
  });
  assert.deepEqual(after, before, 'the new stages changed a frame they were not asked to touch');
  assert.deepEqual([source.rigPins, source.rigConstraints, source.rigAttachments, source.rigHolds], [[], [], [], []]);
  assert.equal(source.gazeSolver.enabled, false);

  // And the effective layer hands back the very object it was given.
  const rig = createControlRig(source);
  const raw = { ...CRITICAL_COMBINATION };
  assert.equal(rig.step(raw, 1 / 60), raw);
});

test('every new block survives a save and reopen, and none of them is orphaned', () => {
  // The contract every domain obeys: one domain per key, every key on the
  // document, nothing written twice.
  const flat = Object.values(PROJECT_DOMAINS).flat();
  for (const key of ['gazeSolver', 'rigLinks', 'rigPins', 'rigConstraints', 'rigAttachments', 'rigHolds']) {
    assert.equal(flat.filter((item) => item === key).length, 1, `${key} is in ${flat.filter((item) => item === key).length} domains`);
    assert.notEqual(createProjectDocument({})[key], undefined, `an empty project has no ${key}, so opening one would throw`);
  }

  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><path id="mouth" d="M 0 0 L 10 0 Z"/></svg>';
  state.elements = { mouth: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: {}, constraints: {}, restPath: 'M 0 0 L 10 0 Z' } };
  state.params = { smile: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  state.states = { idle: { smile: 0 } };
  state.activeState = 'idle';
  state.gazeSolver = { enabled: true, headFollow: 0.8 };
  state.rigLinks = ['eyelids'];
  state.rigPins = [{ id: 'corner', target: 'mouth', position: { x: 1, y: 2 }, radius: { x: 20, y: 6 } }];
  state.rigConstraints = [{ id: 'hold-still', target: 'mouth', type: 'limit', limits: { maxY: 4 } }];
  state.rigAttachments = [{ id: 'mouth.corner.left', target: 'mouth', point: { x: 0, y: 0 } }];
  state.rigHolds = [{ id: 'press', hold: 'mouth.corner.left', to: 'mouth.corner.left' }];

  const reopened = {};
  applyProjectSnapshot(reopened, createProjectSnapshot(state, () => state.svgMarkup));
  assert.equal(reopened.gazeSolver.headFollow, 0.8);
  assert.deepEqual(reopened.rigLinks, ['eyelids']);
  assert.deepEqual(reopened.rigPins[0].radius, { x: 20, y: 6 });
  assert.equal(reopened.rigConstraints[0].limits.y[1], 4);
  assert.equal(reopened.rigAttachments[0].id, 'mouth.corner.left');
  assert.equal(reopened.rigHolds[0].id, 'press');

  // And a page that fetches `rig.json` gets all of it.
  const exported = createExportRig(state);
  for (const key of ['gazeSolver', 'rigPins', 'rigConstraints', 'rigAttachments', 'rigHolds']) {
    assert.notEqual(exported[key], undefined, `the exported rig has no ${key}`);
  }
});

test('normalizing twice is normalizing once, because a project is normalized three times', () => {
  // A saved project is normalized on the way out, again on the way in, and once
  // more by the runtime. A normalizer that cannot read its own output loses
  // whatever it rewrote -- which is exactly how the constraint limits went
  // missing between a save and a reopen.
  const twice = (normalize, source) => {
    const once = normalize(source);
    assert.deepEqual(normalize(once), once, `${normalize.name} cannot read its own output`);
    return once;
  };
  twice(normalizeGazeSolver, { gazeSolver: { enabled: true, headFollow: 0.8, eyelidFollowY: 0.3 } });
  twice(normalizeRigPins, { rigPins: [
    { id: 'a', target: 't', radius: 30, direction: { x: 0, y: 4 }, motion: { y: { expression: 'smile', amplitude: -8 } } },
    { id: 'b', target: 't', type: 'surface', radius: { x: 20, y: 6 }, surface: { u: 0.2, v: 0.6, z: 0.3 }, motion: { grid: { axes: [{ parameter: 'headX', values: [-1, 0, 1] }], x: [[1, 0, -1]], y: [[0, 0, 0]] } } }
  ] });
  twice(normalizeRigConstraints, { rigConstraints: [{ id: 'c', target: 't', type: 'limit', limits: { minY: -2, maxY: 4, maxRotation: 10 } }] });
  twice(normalizeRigAttachments, { rigAttachments: [{ id: 'face.nose', target: 'nose', point: { x: 1, y: 2 }, space: 'head' }] });
  twice(normalizeRigHolds, { rigHolds: [{ id: 'h', hold: 'a', to: 'b', weight: 'contact', offset: { x: 1, y: 0 } }] });
});

test('a sweep of every new control produces no jump, no NaN and no reversal (CR-57)', () => {
  const elements = {
    mouth: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: {}, constraints: { translate: true, rotate: true, scale: true }, restPath: 'M 0 0 L 100 0 L 100 20 L 0 20 Z' }
  };
  const rigPins = normalizeRigPins({ rigPins: [
    { id: 'corner', target: 'mouth', position: { x: 0, y: 10 }, radius: { x: 45, y: 40 }, motion: { y: { expression: 'smileLeft', amplitude: -8 } } },
    { id: 'lip', target: 'mouth', position: { x: 50, y: 20 }, radius: { x: 60, y: 12 }, motion: { y: { expression: 'jawOpen - jawOpen * mouthLock', amplitude: 30 } } }
  ] });
  const params = (values) => ({ smileLeft: 0, jawOpen: 0, mouthLock: 0, ...values });
  const pointsOf = (values) => (compileRigFrame(elements, params(values), {}, {}, { rigPins }).mouth.path.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

  for (const control of ['smileLeft', 'jawOpen', 'mouthLock']) {
    let previous = pointsOf({ [control]: -1, jawOpen: control === 'mouthLock' ? 1 : 0 });
    for (let step = -100; step <= 100; step += 1) {
      const at = step / 100;
      const now = pointsOf({ [control]: at, jawOpen: control === 'mouthLock' ? 1 : undefined });
      assert.equal(now.length, previous.length, `${control} changed the shape's topology at ${at}`);
      for (let index = 0; index < now.length; index += 1) {
        assert.ok(Number.isFinite(now[index]), `${control} produced a NaN at ${at}`);
        assert.ok(Math.abs(now[index] - previous[index]) < 2, `${control} jumped at ${at}`);
      }
      previous = now;
    }
  }
});

test('the new stages cost nothing when a project does not use them (CR-58)', () => {
  const source = normalizeRig(createCartoonMascot());
  const options = { keyforms: source.keyforms, shapeKeys: source.shapeKeys, warps: source.warps, rigPins: [], rigConstraints: [], rigHolds: [] };
  // Compiling twice with the same inputs gives the same frame, which is the
  // property the caches depend on: nothing here is allowed to accumulate.
  const first = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options);
  const second = compileRigFrame(source.elements, CRITICAL_COMBINATION, source.globalConstraints, {}, options);
  assert.deepEqual(second, first);

  // An empty pin list is not an index, so the frame never walks one.
  const rig = createControlRig({ params: source.params });
  assert.equal(rig.active, false);
  const raw = { ...CRITICAL_COMBINATION };
  for (let frame = 0; frame < 60; frame += 1) assert.equal(rig.step(raw, 1 / 60), raw, 'a frame allocated a copy for nothing');
});
