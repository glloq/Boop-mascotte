import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createHandSetupPanel } = await import('../../rig-editor/hands/hand-setup-panel.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');
const { assignHand } = await import('../hands/hand-model.js');
const { handSpriteElementId, HAND_SPRITE_VIEWS } = await import('../hands/hand-sprite-set.js');

/**
 * The Hands card, once a hand shows drawings (docs/HANDS_2D.md, PHASES 33-36).
 *
 * Two things it must get right: the views are laid out in the order they turn,
 * and the controls for a deformation that is no longer there are gone.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 100, ...over });

const drawings = (side, poses) => poses.flatMap((pose) => HAND_SPRITE_VIEWS.map((view) => ({
  pose, view, side, element: handSpriteElementId(side, pose, view), pivot: [100, 100]
})));

function project({ sprites = true, poses = ['relaxed'], facing = true } = {}) {
  const base = createSampleProject();
  const elements = { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() }, handRight: { baseTransform: transform() } };
  if (sprites) for (const drawing of drawings('left', poses)) elements[drawing.element] = { baseTransform: transform() };
  const assigned = assignHand(null, 'left', { element: 'handLeft', parent: 'body', anchor: { x: 100, y: 120 } });
  const hands = sprites
    ? { left: { ...assigned.hands.left, sprites: { drawings: drawings('left', poses), pivot: [100, 100] } } }
    : assigned.hands;
  return {
    ...base,
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="body"/><g id="handLeft"/><g id="handRight"/></svg>',
    elements, layerMetadata: {}, hands,
    params: {
      ...base.params, ...assigned.parameters,
      ...(sprites ? { handLPose: { type: 'number', min: 0, max: poses.length - 1, default: 0, value: 0 }, handLView: { type: 'number', min: 0, max: 4, default: 2, value: 2 } } : {}),
      ...(facing ? { handLFacing: { type: 'number', min: -1, max: 1, default: 0, value: 0 } } : {})
    }
  };
}

function harness(options = {}) {
  const store = createEditorStore(project(options));
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const applied = [];
  const panel = createHandSetupPanel(host, store, history, {
    artboardWidth: () => 200, applyPose: (values) => applied.push(values),
    liveValues: () => Object.fromEntries(Object.entries(store.getDocument().params).map(([name, item]) => [name, item.default])),
    useHandDrawings: (side) => { applied.push({ converted: side }); return true; }
  });
  panel.openHand('left');
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  const check = (dataset, checked) => host.dispatch('change', { target: clickTarget({ tag: 'input', type: 'checkbox', dataset, checked }) });
  return { store, host, panel, applied, click, check, hand: () => store.getDocument().hands.left };
}

test('a hand with drawings offers a pose and a view, and no fingers or facing', () => {
  const { host } = harness();
  assert.ok(host.innerHTML.includes('data-hand-drawing-pose="left:relaxed"'));
  for (const view of HAND_SPRITE_VIEWS) assert.ok(host.innerHTML.includes(`data-hand-drawing-view="left:${view}"`), view);
  assert.equal(host.innerHTML.includes('data-hand-view-chip'), false, 'the palm-to-side facing chips are gone');
  assert.equal(host.innerHTML.includes('Pose editor'), false, 'there is no table to edit');
  assert.equal(host.innerHTML.includes('data-hand-action="use-drawings"'), false, 'nothing left to convert');
});

test('the views are laid out in the order they turn', () => {
  const { host } = harness();
  const order = [...host.innerHTML.matchAll(/data-hand-drawing-view="left:(\w+)"/g)].map((match) => match[1]);
  assert.deepEqual(order, ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight']);
});

test('every chip shows the drawing it stands for, not a word for it', () => {
  const { host } = harness({ poses: ['relaxed', 'fist'] });
  const thumbs = host.innerHTML.match(/class="hand-thumb"/g) || [];
  assert.equal(thumbs.length, 7, 'two poses and five views');
  assert.ok(host.innerHTML.includes('viewBox="0 0 200 200"'), 'every thumbnail shares the set’s box');
});

test('pressing a view writes it, and takes the choice back from automatic', () => {
  const harnessed = harness();
  harnessed.store.execute({ type: 't', domains: ['hands'], apply: (document) => { document.hands.left.sprites.viewMode = 'auto'; } });
  harnessed.panel.render();
  harnessed.click({ handDrawingView: 'left:sideRight' });
  assert.equal(harnessed.hand().sprites.viewMode, 'manual');
  assert.deepEqual(harnessed.applied.at(-1), { handLView: 4 });
});

test('pressing a pose writes its index', () => {
  const harnessed = harness({ poses: ['relaxed', 'fist', 'point'] });
  harnessed.click({ handDrawingPose: 'left:point' });
  assert.deepEqual(harnessed.applied.at(-1), { handLPose: 2 });
  harnessed.click({ handDrawingPose: 'left:relaxed' });
  assert.deepEqual(harnessed.applied.at(-1), { handLPose: 0 });
  harnessed.click({ handDrawingPose: 'left:nonsense' });
  assert.deepEqual(harnessed.applied.at(-1), { handLPose: 0 }, 'an unknown pose writes nothing');
});

test('automatic view is a tick on the hand, not a parameter', () => {
  const harnessed = harness();
  assert.equal(harnessed.hand().sprites.viewMode, 'manual');
  harnessed.check({ handField: 'autoView', handSide: 'left' }, true);
  assert.equal(harnessed.hand().sprites.viewMode, 'auto');
  assert.ok(harnessed.host.innerHTML.includes('Automatic view'));
  harnessed.check({ handField: 'autoView', handSide: 'left' }, false);
  assert.equal(harnessed.hand().sprites.viewMode, 'manual');
});

test('a hand that still deforms is offered the conversion, and told what it does', () => {
  const { host, click, applied } = harness({ sprites: false });
  assert.ok(host.innerHTML.includes('data-hand-action="use-drawings"'));
  assert.match(host.innerHTML, /wobbles while it moves/);
  assert.match(host.innerHTML, /hidden, not deleted/);
  click({ handAction: 'use-drawings', handSide: 'left' });
  assert.deepEqual(applied.at(-1), { converted: 'left' });
});

test('a hand with no pseudo-3D turn is offered drawings without being told off about one', () => {
  const { host } = harness({ sprites: false, facing: false });
  assert.ok(host.innerHTML.includes('data-hand-action="use-drawings"'));
  assert.equal(/wobbles while it moves/.test(host.innerHTML), false);
});

test('a view the pose is not drawn in is offered, and says what will happen', () => {
  const store = createEditorStore(project({ poses: ['relaxed'] }));
  store.execute({ type: 't', domains: ['hands'], apply: (document) => {
    document.hands.left.sprites.drawings = document.hands.left.sprites.drawings.filter((drawing) => drawing.view !== 'sideRight');
  } });
  const host = document.createElementNS('', 'div');
  const panel = createHandSetupPanel(host, store, createHistory(store), { artboardWidth: () => 200, liveValues: () => ({}) });
  panel.openHand('left');
  assert.match(host.innerHTML, /not drawn for relaxed; the nearest one is used/);
});
