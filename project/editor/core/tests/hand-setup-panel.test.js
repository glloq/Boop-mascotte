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
  it.click({ handAction: 'add-pose', handSide: 'left', handPose: 'wave' });
  assert.deepEqual(it.hands().left.poses.map((pose) => pose.id), ['wave']);
  assert.equal(it.params().handLWave.default, 0, 'a pose gets its own movement');
  assert.match(it.host.innerHTML, /Give it a shape key or its own artwork next/);
  it.click({ handAction: 'remove-pose', handSide: 'left', handPose: 'wave' });
  assert.deepEqual(it.hands().left.poses, []);
});

test('a pose can be linked to artwork of its own', () => {
  const it = harness();
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.click({ handAction: 'add-pose', handSide: 'left', handPose: 'fist' });
  it.change({ handField: 'poseVariant', handSide: 'left', handPose: 'fist' }, 'handRight');
  assert.equal(it.hands().left.poses[0].variant, 'handRight');
});

test('mirroring needs a hand first, then fills in the other side', () => {
  const it = harness();
  it.click({ handAction: 'mirror', handSide: 'left' });
  assert.match(it.host.innerHTML, /Set this hand up first/);
  it.change({ handField: 'artwork', handSide: 'left' }, 'handLeft');
  it.change({ handField: 'anchorX', handSide: 'left' }, '-30');
  it.click({ handAction: 'add-pose', handSide: 'left', handPose: 'wave' });
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
