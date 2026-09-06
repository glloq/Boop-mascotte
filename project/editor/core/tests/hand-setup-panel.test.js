import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createHandSetupPanel, handSetupSteps } = await import('../../rig-editor/hands/hand-setup-panel.js');
const { createHandCommands } = await import('../hands/hand-commands.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');
const { validateHands } = await import('../validation/rig-validator.js');

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });

const project = () => ({
  ...createSampleProject(),
  svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="body"/><g id="handLeft"/><g id="handRight"/></svg>',
  elements: { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() }, handRight: { baseTransform: transform() } },
  layerMetadata: { handLeft: { name: 'Left hand art' } },
  hands: null
});

function harness() {
  const store = createEditorStore(project());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const selected = [];
  const panel = createHandSetupPanel(host, store, history, { onSelect: (id) => selected.push(id), artboardWidth: () => 200 });
  panel.render();
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  const change = (dataset, value) => host.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value }) });
  const check = (dataset, checked) => host.dispatch('change', { target: clickTarget({ tag: 'input', type: 'checkbox', dataset, checked }) });
  const hands = () => store.getDocument().hands;
  return { store, history, host, panel, selected, click, change, check, hands, params: () => store.getDocument().params };
}

test('the setup steps say what to do next, in order', () => {
  assert.match(handSetupSteps(null).next, /Choose the artwork/);
  assert.match(handSetupSteps({ element: 'h', parent: null, anchor: { x: 0, y: 0 }, poses: [] }, { h: {} }).next, /hangs from/);
  assert.match(handSetupSteps({ element: 'h', parent: 'body', anchor: { x: 0, y: 0 }, poses: [] }, { h: {} }).next, /Place the anchor/);
  assert.match(handSetupSteps({ element: 'h', parent: 'body', anchor: { x: 1, y: 1 }, poses: [] }, { h: {} }).next, /Add a pose/);
  assert.equal(handSetupSteps({ element: 'h', parent: 'body', anchor: { x: 1, y: 1 }, poses: [{ id: 'wave' }] }, { h: {} }).done, 4);
  assert.match(handSetupSteps({ element: 'gone', parent: 'body', anchor: { x: 1, y: 1 }, poses: [] }, {}).next, /no longer exists/);
});

test('a fresh panel offers both sides and no hand is assigned', () => {
  const it = harness();
  assert.equal(it.host.dataset.handSetupReady, 'true');
  assert.equal(it.host.dataset.handSetupCount, '0');
  assert.match(it.host.innerHTML, /data-hand-card="left" data-hand-status="empty"/);
  assert.match(it.host.innerHTML, /data-hand-card="right" data-hand-status="empty"/);
  assert.match(it.host.innerHTML, /no arms, no bones/);
});

test('choosing artwork assigns the hand and creates the movements it needs', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  assert.equal(it.hands().left.element, 'handLeft');
  for (const name of ['handLX', 'handLY', 'handLRotation', 'handLScale', 'handLDepth']) assert.ok(it.params()[name], name);
  assert.equal(it.store.getDocument().states.idle.handLX, 0, 'and every state carries them');
  assert.equal(it.host.dataset.handSetupCount, '1');
  assert.match(it.host.innerHTML, /Place its anchor next/);
});

test('assignment is one undo step', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.history.undo();
  assert.equal(it.hands(), null);
  assert.equal(it.params().handLX, undefined, 'the movements go back with it');
  it.history.redo();
  assert.equal(it.hands().left.element, 'handLeft');
});

test('the anchor, rest offset, reach, depth and overshoot are editable', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.change({ handField: 'parent', handSide: 'left' }, 'body');
  it.change({ handField: 'anchorX', handSide: 'left' }, '-30');
  it.change({ handField: 'anchorY', handSide: 'left' }, '12');
  it.change({ handField: 'restX', handSide: 'left' }, '4');
  it.change({ handField: 'reachX', handSide: 'left' }, '55');
  it.change({ handField: 'reachRotation', handSide: 'left' }, '45');
  it.change({ handField: 'depth', handSide: 'left' }, '0.4');
  it.change({ handField: 'softness', handSide: 'left' }, '0');
  const hand = it.hands().left;
  assert.equal(hand.parent, 'body');
  assert.deepEqual(hand.anchor, { x: -30, y: 12 });
  assert.equal(hand.restOffset.x, 4);
  assert.equal(hand.reach.x, 55);
  assert.equal(hand.reach.y, 30, 'the other reach axis is untouched');
  assert.equal(hand.reach.rotation, 45);
  assert.equal(hand.depth, 0.4);
  assert.equal(hand.softness, 0);
  assert.match(it.host.innerHTML, /Reach: 55 × 30 around \(-26, 12\)/);
});

test('inertia is a switch, off by default', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  assert.equal(it.hands().left.inertia.enabled, false);
  it.check({ handField: 'inertia', handSide: 'left' }, true);
  assert.equal(it.hands().left.inertia.enabled, true);
  it.check({ handField: 'inertia', handSide: 'left' }, false);
  assert.equal(it.hands().left.inertia.enabled, false);
});

test('poses are added from the suggestions and removed again', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  // The pose chips are the only way in: `add-pose` was a second, unreachable
  // door into the same command.
  it.click({ handPoseChip: 'left:wave' });
  assert.deepEqual(it.hands().left.poses.map((pose) => pose.id), ['wave']);
  assert.equal(it.params().handLWave.default, 0, 'a pose gets its own movement');
  assert.match(it.host.innerHTML, /Give it a shape key or its own artwork/);
  it.click({ handAction: 'remove-pose', handSide: 'left', handPose: 'wave' });
  assert.deepEqual(it.hands().left.poses, []);
});

test('a pose can be linked to artwork of its own', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.click({ handPoseChip: 'left:fist' });
  it.change({ handField: 'poseVariant', handSide: 'left', handPose: 'fist' }, 'handRight');
  assert.equal(it.hands().left.poses[0].variant, 'handRight');
});

test('mirroring needs a hand first, then fills in the other side', () => {
  const it = harness();
  it.click({ handAction: 'mirror', handSide: 'left' });
  assert.match(it.host.innerHTML, /Set this hand up first/);
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.change({ handField: 'anchorX', handSide: 'left' }, '-30');
  it.click({ handPoseChip: 'left:wave' });
  it.click({ handAction: 'mirror', handSide: 'left' });
  assert.equal(it.hands().right.anchor.x, 230, 'mirrored around the artboard centre');
  assert.equal(it.hands().right.poses[0].parameter, 'handRWave');
  assert.ok(it.params().handRX && it.params().handRWave, 'the other side gets its movements too');
});

test('removing a hand leaves the other one alone', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.change({ handField: 'artwork', handSide: 'right' }, 'handRight');
  assert.equal(it.host.dataset.handSetupCount, '2');
  it.click({ handAction: 'remove', handSide: 'left' });
  assert.equal(it.hands().left, undefined);
  assert.equal(it.hands().right.element, 'handRight');
});

test('"Show on canvas" selects the hand artwork', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.click({ handAction: 'select', handSide: 'left' });
  assert.deepEqual(it.selected, ['handLeft']);
});

test('opening the other side switches which card is expanded', () => {
  const it = harness();
  assert.equal(it.panel.getOpenSide(), 'left');
  it.click({ handAction: 'open', handSide: 'right' });
  assert.equal(it.panel.getOpenSide(), 'right');
});

test('a hand set up through the panel validates cleanly', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.change({ handField: 'parent', handSide: 'left' }, 'body');
  it.change({ handField: 'anchorX', handSide: 'left' }, '-30');
  assert.deepEqual(validateHands(it.store.getDocument()), []);
});

test('the commands refuse an unknown side or missing artwork', () => {
  const store = createEditorStore(project());
  const commands = createHandCommands(store, createHistory(store));
  assert.equal(commands.assign('foot', { element: 'handLeft' }), false);
  assert.equal(commands.assign('left', {}), false);
  assert.equal(commands.setAnchor('left', { x: 1, y: 1 }), false, 'nothing to edit yet');
  assert.equal(commands.mirror('left', {}), false);
  assert.equal(store.getDocument().hands, null);
});

/* ── The pose editor (docs/HAND_REPRESENTATIONS_STUDY.md, stage 3) ─────────── */

const { HAND_PART_IDS, HAND_POSE_TABLES, handElementId, handPartId } = await import('../sample/hand-artwork.js');
const { handsMarkup, installHands } = await import('../sample/hand-feature.js');
const { createCleanProjectState } = await import('../state/store.js');
const { compileRigFrame } = await import('../../../runtime/runtime.js');

/** A project with a generated pair, as the canvas and the installer leave it. */
function generated() {
  const state = createCleanProjectState();
  const markup = handsMarkup({});
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g>${markup}</svg>`;
  const element = (nodeType, d = '') => ({ baseTransform: transform(), baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: d, pathB: d } });
  state.elements = { faceRoot: element('g') };
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: [] }];
  for (const side of ['left', 'right']) {
    state.elements[handElementId(side)] = element('g');
    const children = [];
    for (const part of HAND_PART_IDS) {
      const id = handPartId(side, part);
      state.elements[id] = element('path', new RegExp(`<path id="${id}"[^>]* d="([^"]+)"`).exec(markup)?.[1] || '');
      children.push({ id, type: 'path', name: part, children: [] });
    }
    state.layers.push({ id: handElementId(side), type: 'g', name: `${side} hand`, children });
  }
  state.states = { idle: {} };
  state.activeState = 'idle';
  installHands(state);
  return state;
}

function editorHarness() {
  const store = createEditorStore(generated());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const applied = [];
  const panel = createHandSetupPanel(host, store, history, { applyPose: (values) => applied.push(values) });
  panel.render();
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  const change = (dataset, value, tag = 'select') => host.dispatch('change', { target: clickTarget({ tag, dataset, value }) });
  const slide = (field, value) => host.dispatch('input', { target: clickTarget({ tag: 'input', type: 'range', dataset: { handEditorSlider: field, handSide: 'left' }, value: String(value) }) });
  return { store, history, host, panel, applied, click, change, slide, doc: () => store.getDocument() };
}

test('the pose editor is offered for a hand the generator drew, and only then', () => {
  const it = editorHarness();
  assert.match(it.host.innerHTML, /data-hand-editor="left"/);
  assert.match(it.host.innerHTML, /data-hand-editor-preview="left"/, 'a preview drawn from the numbers');
  for (const field of ['curl', 'bend', 'angle', 'length', 'width']) assert.match(it.host.innerHTML, new RegExp(`data-hand-editor-slider="${field}"`));
  assert.match(it.host.innerHTML, /data-hand-editor-action="capture"/);
  assert.match(it.host.innerHTML, /Touch the thumb/);
  // Any other artwork has no table to edit: the section is dropped, not offered empty.
  const other = harness();
  other.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  assert.equal(/data-hand-editor="left"/.test(other.host.innerHTML), false);
});

test('a new pose is numbers until Capture writes it as keys, a parameter and a record, in one undo step', () => {
  const it = editorHarness();
  const before = it.doc();
  const keysBefore = before.shapeKeys.length, posesBefore = before.hands.left.poses.length;
  it.change({ handEditorField: 'name', handSide: 'left' }, 'Rock on', 'input');
  // Bend the index right over; the middle finger too. Nothing is written yet.
  it.slide('curl', 1);
  it.click({ handEditorDigit: 'left:middle' });
  it.slide('curl', 1);
  assert.equal(it.doc().shapeKeys.length, keysBefore, 'sliders write nothing');
  assert.equal(it.doc().hands.left.poses.length, posesBefore);

  it.click({ handEditorAction: 'capture', handSide: 'left' });
  const after = it.doc();
  const pose = after.hands.left.poses.find((item) => item.id === 'rockOn');
  assert.ok(pose, 'the pose exists, named from the name typed');
  assert.equal(pose.name, 'Rock on');
  assert.equal(pose.parameter, 'handLRockOn');
  assert.deepEqual(pose.table.digits, { index: { curl: 1 }, middle: { curl: 1 } }, 'the numbers are kept on the record');
  assert.ok(after.params.handLRockOn, 'and it can be raised');
  const keys = after.shapeKeys.filter((key) => key.id.startsWith('handLeft-rockOn-'));
  assert.deepEqual(keys.map((key) => key.target).sort(), ['handLeftIndex', 'handLeftMiddle'], 'a key on every part it moves, and no other');
  assert.ok(keys.every((key) => key.driver?.parameter === 'handLRockOn'));
  // Struck on the mascot so what was captured is what is seen.
  assert.equal(it.applied.at(-1).handLRockOn, 1);
  // It moves the artwork through the ordinary path.
  const frame = (values) => compileRigFrame(after.elements, { ...after.params, ...values }, {}, {}, { shapeKeys: after.shapeKeys, keyforms: after.keyforms, hands: after.hands });
  assert.notEqual(frame({ handLRockOn: { type: 'number', min: 0, max: 1, default: 0, value: 1 } }).handLeftIndex.path, frame({}).handLeftIndex.path);
  // One undo takes the keys, the parameter and the record back together.
  it.history.undo();
  assert.equal(it.doc().shapeKeys.length, keysBefore);
  assert.equal(it.doc().hands.left.poses.length, posesBefore);
  assert.equal(it.doc().params.handLRockOn, undefined);
});

test('a generated pose reopens with its numbers, and capturing again replaces its keys', () => {
  const it = editorHarness();
  it.change({ handEditorField: 'pose', handSide: 'left' }, 'fist');
  assert.match(it.host.innerHTML, /Capture again/);
  assert.match(it.host.innerHTML, /data-hand-editor-action="drop"/, 'create and remove live on one surface');
  const keysBefore = it.doc().shapeKeys.filter((key) => key.id.startsWith('handLeft-fist-')).length;
  assert.ok(keysBefore > 0);
  // The fist's own numbers are what the sliders show.
  assert.match(it.host.innerHTML, /data-hand-editor-readout="left:curl">1</);
  // Straighten the index and capture again: the fist now leaves the index alone.
  it.click({ handEditorDigit: 'left:index' });
  it.click({ handEditorAction: 'reset', handSide: 'left' });
  it.click({ handEditorAction: 'capture', handSide: 'left' });
  const after = it.doc();
  const fist = after.hands.left.poses.find((pose) => pose.id === 'fist');
  assert.equal(fist.table.digits.index, undefined);
  assert.equal(after.hands.left.poses.filter((pose) => pose.id === 'fist').length, 1, 'still one fist');
  // The palm-view key for the index is gone -- a part the new table leaves
  // alone loses its key rather than keeping a stale one -- while the profile
  // drawing, which was not edited, still bends it.
  assert.equal(after.shapeKeys.some((key) => key.id === 'handLeft-fist-index'), false, 'no stale key');
  assert.ok(after.shapeKeys.some((key) => key.id === 'handLeft-fist-near-index'), 'the side view keeps its own drawing');
  assert.ok(after.shapeKeys.some((key) => key.id === 'handLeft-fist-middle'));
  assert.deepEqual(validateHands(after), []);
});

test('Touch the thumb aims the digit at the thumb\'s tip, and Remove pose takes the keys with it', () => {
  const it = editorHarness();
  it.change({ handEditorField: 'pose', handSide: 'left' }, 'peace');
  it.click({ handEditorDigit: 'left:index' });
  const before = structuredClone(HAND_POSE_TABLES.peace.digits.index);
  it.click({ handEditorAction: 'aim', handSide: 'left' });
  assert.match(it.host.innerHTML, /now touches the thumb/);
  it.click({ handEditorAction: 'capture', handSide: 'left' });
  const peace = it.doc().hands.left.poses.find((pose) => pose.id === 'peace');
  assert.notEqual(peace.table.digits.index.bend, before.bend ?? 0, 'the index was hooked towards the thumb');
  assert.ok(Number.isFinite(peace.table.digits.index.angle));

  it.click({ handEditorAction: 'drop', handSide: 'left' });
  const after = it.doc();
  assert.equal(after.hands.left.poses.some((pose) => pose.id === 'peace'), false);
  assert.equal(after.shapeKeys.some((key) => key.id.startsWith('handLeft-peace-')), false, 'no stale keys');
  assert.equal(after.keyforms.some((keyform) => keyform.id.startsWith('handLeft-peace-')), false);
});

/* ── Drawings (docs/HAND_REPRESENTATIONS_STUDY.md, stage 4) ────────────────── */

test('a hand of any other artwork is offered a set of drawings; a generated hand is not, and any hand can import one', () => {
  const calls = [];
  const store = createEditorStore(project());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const panel = createHandSetupPanel(host, store, history, { useHandSet: (side) => { calls.push(side); return true; }, importHandSet: async () => true });
  panel.render();
  host.dispatch('change', { target: clickTarget({ tag: 'select', dataset: { handField: 'artwork', handSide: 'left' }, value: 'handLeft' }) });
  assert.match(host.innerHTML, /data-hand-action="set" data-hand-side="left"/, 'artwork the generator did not draw can swap between drawings');
  assert.match(host.innerHTML, /data-hand-set-file="left"/, 'and import them');
  host.dispatch('click', { target: clickTarget({ dataset: { handAction: 'set', handSide: 'left' } }) });
  assert.deepEqual(calls, ['left']);
  assert.match(host.innerHTML, /set of drawings added/);

  const drawn = editorHarness();
  assert.equal(/data-hand-action="set"/.test(drawn.host.innerHTML), false, 'a generated hand has every gesture already');
});

/**
 * Behind the head until asked (docs/HAND_RIGGING.md): the tick tucks a hand
 * away and brings its rest back, and posing a tucked hand here brings it out
 * to be looked at.
 */
test('a hand can rest behind the head, and posing it in the panel brings it out to look at', () => {
  const store = createEditorStore(project());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const applied = [];
  const panel = createHandSetupPanel(host, store, history, {
    artboardWidth: () => 200, applyPose: (values) => applied.push(values),
    measure: (id) => (id === 'handLeft' ? { x: 10, y: 150, width: 40, height: 50 } : id === 'body' ? { x: 0, y: 0, width: 200, height: 200 } : null)
  });
  panel.render();
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  const change = (dataset, value) => host.dispatch('change', { target: clickTarget({ tag: 'select', dataset, value }) });
  const check = (dataset, checked) => host.dispatch('change', { target: clickTarget({ tag: 'input', type: 'checkbox', dataset, checked }) });
  const doc = () => store.getDocument();
  change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  change({ handField: 'parent', handSide: 'left' }, 'body');
  assert.match(host.innerHTML, /data-hand-field="hidden" data-hand-side="left">/);
  assert.doesNotMatch(host.innerHTML, /data-hand-field="hidden" data-hand-side="left" checked/, 'artwork of the author\'s own rests in the open until asked');
  check({ handField: 'hidden', handSide: 'left' }, true);
  assert.equal(doc().params.handLShow.default, 0);
  assert.ok(doc().keyforms.some((item) => item.id === 'handLeft-show-depth'), 'the keyforms that hide it');
  assert.deepEqual(doc().expressions.find((item) => item.id === 'hands-out').controls, { handLShow: 1 });
  assert.match(host.innerHTML, /data-hand-field="hidden" data-hand-side="left" checked/);
  assert.match(host.innerHTML, /mascot\.showHands\(\)/);
  // One undo step.
  history.undo();
  assert.equal(doc().params.handLShow, undefined);
  history.redo();
  assert.ok(doc().params.handLShow);
  // Posing it here raises its show parameter with the pose.
  applied.length = 0;
  click({ handPoseChip: 'left:fist' });
  click({ handPoseChip: 'left:fist' });
  assert.ok(applied.some((values) => values.handLShow === 1 && values.handLFist === 1), 'the fist comes out to be seen');
  applied.length = 0;
  click({ handAction: 'open', handSide: 'left' });
  assert.deepEqual(applied.at(-1), { handLShow: 1 }, 'opening the card shows the hand');
  // And back into the open at rest.
  check({ handField: 'hidden', handSide: 'left' }, false);
  assert.equal(doc().params.handLShow, undefined);
  assert.equal(doc().keyforms.some((item) => item.id.startsWith('handLeft-show-')), false);
  assert.equal(doc().expressions.some((item) => item.id === 'hands-out'), false);
  applied.length = 0;
  click({ handPoseChip: 'left:fist' });
  assert.ok(applied.every((values) => !('handLShow' in values)), 'nothing to bring out');
});
