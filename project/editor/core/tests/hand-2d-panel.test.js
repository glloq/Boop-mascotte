import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createHandSetupPanel } = await import('../../rig-editor/hands/hand-setup-panel.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');
const { assignHand } = await import('../hands/hand-model.js');
const { handSpriteElementId, GENERATED_HAND_DRAWINGS } = await import('../hands/hand-sprite-set.js');

/**
 * The Hands card, once a hand shows drawings (docs/HANDS_2D.md).
 *
 * Two things it must get right: every picture is offered as the picture it is,
 * and the controls for a deformation that is no longer there are gone.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 100, ...over });

const drawings = (side, ids) => ids.map((id) => ({ id, element: handSpriteElementId(side, id), pivot: [100, 100] }));

function project({ sprites = true, ids = ['sideOpen'], facing = true } = {}) {
  const base = createSampleProject();
  const elements = { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() }, handRight: { baseTransform: transform() } };
  if (sprites) for (const drawing of drawings('left', ids)) elements[drawing.element] = { baseTransform: transform() };
  const assigned = assignHand(null, 'left', { element: 'handLeft', parent: 'body', anchor: { x: 100, y: 120 } });
  const hands = sprites
    ? { left: { ...assigned.hands.left, sprites: { drawings: drawings('left', ids), pivot: [100, 100] } } }
    : assigned.hands;
  return {
    ...base,
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="body"/><g id="handLeft"/><g id="handRight"/></svg>',
    elements, layerMetadata: {}, hands,
    params: {
      ...base.params, ...assigned.parameters,
      ...(sprites ? { handLDrawing: { type: 'number', min: 0, max: ids.length - 1, default: 0, value: 0, options: [...ids] }, handLAnim: { type: 'number', min: 0, max: 1, default: 0, value: 0 } } : {}),
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

test('a hand with drawings offers its pictures, and no fingers, views or facing', () => {
  const { host } = harness({ ids: [...GENERATED_HAND_DRAWINGS] });
  for (const id of GENERATED_HAND_DRAWINGS) assert.ok(host.innerHTML.includes(`data-hand-drawing="left:${id}"`), id);
  assert.equal(host.innerHTML.includes('data-hand-drawing-view'), false, 'there is no row of views left');
  assert.equal(host.innerHTML.includes('data-hand-view-chip'), false, 'the palm-to-side facing chips are gone');
  assert.equal(host.innerHTML.includes('autoView'), false, 'and nothing chooses a drawing from an angle');
  assert.equal(host.innerHTML.includes('Pose editor'), false, 'there is no table to edit');
  assert.equal(host.innerHTML.includes('data-hand-action="use-drawings"'), false, 'nothing left to convert');
});

test('every chip shows the drawing it stands for, not a word for it', () => {
  const { host } = harness({ ids: ['sideOpen', 'frontFist'] });
  const thumbs = host.innerHTML.match(/class="hand-thumb"/g) || [];
  // Two pictures to pick from, and the picture showing beside what it does.
  assert.equal(thumbs.length, 4);
  assert.ok(host.innerHTML.includes('viewBox="0 0 200 200"'), 'every thumbnail shares the set\u2019s box');
});

test('the picture showing says what it can do on its own', () => {
  const { host } = harness({ ids: [...GENERATED_HAND_DRAWINGS] });
  assert.match(host.innerHTML, /own animation/);
  assert.match(host.innerHTML, /Close the fist/, 'the first picture closes into a fist');
  assert.match(host.innerHTML, /handLAnim/, 'and it says which slider plays it');
});

test('pressing a picture writes its index', () => {
  const harnessed = harness({ ids: [...GENERATED_HAND_DRAWINGS] });
  harnessed.click({ handDrawing: 'left:frontFist' });
  assert.deepEqual(harnessed.applied.at(-1), { handLDrawing: 2 });
  harnessed.click({ handDrawing: 'left:sideOpen' });
  assert.deepEqual(harnessed.applied.at(-1), { handLDrawing: 0 });
  harnessed.click({ handDrawing: 'left:nonsense' });
  assert.deepEqual(harnessed.applied.at(-1), { handLDrawing: 0 }, 'an unknown picture writes nothing');
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
