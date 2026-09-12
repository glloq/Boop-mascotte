import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { installStyleHands, styleHandsMarkup } from '../hands/hand-style-install.js';
import {
  HAND_SET_FORMAT, HAND_SET_VERSION, createHandSetRegistry, gestureFragment, gestureLayers,
  normalizeHandGesture, normalizeHandSet, pathToDrawingUnits, validateHandGesture, validateHandSet
} from '../hands/hand-set.js';
import { HAND_SETS } from '../hands/sets/index.js';
import { readHandSets, handSetsModule } from '../../../../scripts/hand-sets.mjs';

/**
 * The **files** are the source of truth (docs/HAND_STYLES.md, "A gesture is a
 * file"). `core/hands/sets/index.js` is a copy of them, generated so that the
 * editor's bundle and this suite can both read a set without an asynchronous
 * startup — and a copy that can go stale is a copy that will.
 *
 * So this test reads `project/assets/hands/` itself, and fails if the two have
 * parted company. The remedy is always the same: `npm run hands:sets`.
 */

const ASSETS = fileURLToPath(new URL('../../../assets/hands/', import.meta.url));
const GENERATED = fileURLToPath(new URL('../hands/sets/index.js', import.meta.url));

test('the generated module is exactly the sets on disk — run npm run hands:sets', () => {
  const onDisk = readHandSets(ASSETS);
  assert.ok(onDisk.length >= 1, 'there is at least one set in project/assets/hands/');
  assert.deepEqual(HAND_SETS, onDisk,
    'project/editor/core/hands/sets/index.js has drifted from project/assets/hands/ — run npm run hands:sets');
  // Byte for byte, so a hand-edit of the generated file is caught too.
  assert.equal(readFileSync(GENERATED, 'utf8'), handSetsModule(onDisk),
    'the generated module is not what the generator would write — run npm run hands:sets');
});

test('every file in a set directory is a gesture the manifest names', () => {
  for (const entry of readdirSync(ASSETS, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const dir = `${ASSETS}${entry.name}/`;
    const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
    const named = new Set(manifest.gestures.map((gesture) => gesture.src || `${gesture.id}.svg`));
    const present = readdirSync(dir).filter((name) => name.endsWith('.svg'));
    assert.deepEqual(present.filter((name) => !named.has(name)), [],
      `${entry.name} has drawings its manifest does not list — add them to manifest.json`);
    assert.deepEqual([...named].filter((name) => !present.includes(name)), [],
      `${entry.name} lists drawings that are not on disk`);
  }
});

/* ── A gesture installs from a file, and the rig it leaves validates ───────── */

test('a gesture read off disk installs into a registry of its own', () => {
  const dir = `${ASSETS}defaultCartoon/`;
  const manifest = JSON.parse(readFileSync(`${dir}manifest.json`, 'utf8'));
  const files = Object.fromEntries(manifest.gestures.map((gesture) => [gesture.src, readFileSync(`${dir}${gesture.src}`, 'utf8')]));
  const set = normalizeHandSet(manifest, files);

  assert.equal(set.format, HAND_SET_FORMAT);
  assert.ok(set.version <= HAND_SET_VERSION);
  assert.deepEqual(validateHandSet(set).errors, []);

  const registry = createHandSetRegistry();
  registry.install(set);
  assert.deepEqual(registry.ids(), manifest.gestures.map((gesture) => gesture.id));
  assert.equal(registry.info.set, 'defaultCartoon');
  assert.equal(registry.info.fallback, manifest.fallback);

  // The artwork is in the drawing's own units: the pivot at the origin, one
  // unit to a unit, whatever box the file happened to use.
  for (const gesture of registry.list()) {
    const layers = gestureLayers(gesture);
    assert.ok(layers.length >= 1, `${gesture.id} installs at least one layer`);
    let reach = 0;
    for (const layer of layers) {
      for (const match of layer.d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
        reach = Math.max(reach, Math.hypot(Number(match[1]), Number(match[2])));
      }
    }
    assert.ok(reach <= set.radius, `${gesture.id} reaches ${reach.toFixed(1)} of the set's ${set.radius}`);
    assert.ok(reach > set.radius * 0.5, `${gesture.id} is a hand-sized drawing, not a file-sized one`);
  }
});

test('a ninth gesture is a ninth file, and no code at all', () => {
  // A drawing an author could have made in any editor: one group, named layers,
  // in the file's own 200 box. Nothing here knows about the shipped eight.
  const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" data-hand-pivot="100 100"'
    + ' data-hand-scale="2"><g id="hand-salute" data-name="Salute">'
    + '<path id="palm" data-name="Palm" d="M 80 100 L 120 100 L 120 140 L 80 140 Z" fill="#fff" stroke="#000"/>'
    + '<path id="thumb" data-name="Thumb" d="M 70 120 L 80 110 L 80 130 Z" fill="#fff" stroke="#000"/>'
    + '</g></svg>';
  const gesture = normalizeHandGesture(
    { id: 'salute', label: 'Salute', src: 'salute.svg', artwork: source, roles: { palm: 'Palm', thumb: 'Thumb' } },
    { pivot: [100, 100], scale: 2, set: 'defaultCartoon' }
  );
  const check = validateHandGesture(gesture);
  assert.deepEqual(check.errors, [], JSON.stringify(check.errors));
  assert.deepEqual(gestureLayers(gesture).map((layer) => layer.part), ['palm', 'thumb']);
  // 80 in a 200 box at 2× round a pivot of 100 is −10 in the drawing's units.
  assert.match(gestureLayers(gesture)[0].d, /^M -10 0 L 10 0 L 10 20 L -10 20 Z$/);

  const registry = createHandSetRegistry();
  registry.register(gesture);
  assert.equal(registry.has('salute'), true);
  assert.throws(() => registry.register(gesture), /already registered/, 'and not twice');
});

test('a pair of hands drawn from the set leaves a rig that validates', () => {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  state.elements = {
    faceRoot: {
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
      constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'g' },
      morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' }
    }
  };
  state.states = { idle: {} };
  state.activeState = 'idle';

  // What the canvas does with appended markup: a rig record per node with an id.
  const markup = styleHandsMarkup(state);
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) {
    state.elements[match[2]] ||= {
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
      constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: match[1] },
      morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' }
    };
  }
  assert.equal(installStyleHands(state), true);

  // A drawing is a group of layers now, and the rig does not care: every
  // library entry still names one node, and that node is a <g>.
  for (const side of ['left', 'right']) {
    for (const entry of state.hands[side].styles.library) {
      assert.equal(state.elements[entry.element].meta.nodeType, 'g', `${entry.element} is the drawing's group`);
      assert.ok(markup.includes(`<g id="${entry.element}"`), `${entry.element} is in the document`);
    }
  }
  assert.deepEqual(validateRig(state), [], 'a mascot with layered hands is a valid rig');
});

/* ── Reading a file's frame ─────────────────────────────────────────────────── */

test('a file says where its pivot is, and the reader takes it at its word', () => {
  assert.equal(pathToDrawingUnits('M 100 100 L 120 80 Z', [100, 100], 2), 'M 0 0 L 10 -10 Z');
  // Every command resets the pair count, so a path with four coordinates after
  // a C is read as two pairs and not as a run of x values.
  assert.equal(pathToDrawingUnits('M 100 100 C 110 100 120 90 120 80', [100, 100], 2), 'M 0 0 C 5 0 10 -5 10 -10');
  assert.equal(gestureFragment('<svg><g id="hand-x"><path d="M0 0"/></g></svg>'), '<g id="hand-x"><path d="M0 0"/></g>');
  assert.equal(gestureFragment('no group here'), '');
});

test('the rules a drawing an author brings has to pass', () => {
  const bad = (artwork, extra = {}) => validateHandGesture({ id: 'x', label: 'X', artwork, placed: true, ...extra }).errors.map((issue) => issue.code);
  assert.ok(bad('<g id="hand-x"><path d="M0 0"/><path d="M1 1"/></g>').includes('layer-id-missing'),
    'a layer nothing can name is a layer nothing can edit');
  assert.ok(bad('<g id="hand-x"><path id="a" d="M 0 0 A 1 1 0 0 1 2 2"/></g>').includes('artwork-path-commands'),
    'an arc would be mirrored wrongly and silently');
  assert.ok(bad('<g id="hand-x"><path id="a" d="M0 0"/></g>', { roles: { nope: 'Nope' } }).includes('role-unknown'));
  assert.ok(bad('<g id="hand-x"><path id="a" d="M0 0"/><path id="a" d="M1 1"/></g>').includes('artwork-duplicate-id'));
  assert.ok(bad('<g id="hand-x"><script>alert(1)</script></g>').some((code) => code.startsWith('artwork-')));
  assert.ok(bad('<g><path id="a" d="M0 0"/></g>').includes('artwork-root-id'));
  assert.ok(bad('<path id="a" d="M0 0"/><path id="b" d="M1 1"/>').includes('artwork-malformed'),
    'a gesture is one element, and that element is the group');
});
