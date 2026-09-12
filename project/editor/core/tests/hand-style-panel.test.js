import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createHandSetupPanel } = await import('../../rig-editor/hands/hand-setup-panel.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');
const { assignHand } = await import('../hands/hand-model.js');
const { handStyleIds, handStyleElementId } = await import('../hands/hand-style-art.js');

/**
 * The Hands card, once a hand shows drawings (docs/HAND_STYLES.md).
 *
 * Two things it must get right: every drawing is offered as the drawing it is,
 * and every control for a deformation that is no longer there is gone.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 100, ...over });
const library = (side, ids) => ids.map((id) => ({ id, label: id, element: handStyleElementId(side, id) }));

function project({ styles = true, ids = ['relaxed'], facing = true } = {}) {
  const base = createSampleProject();
  const elements = { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() }, handRight: { baseTransform: transform() } };
  if (styles) for (const entry of library('left', ids)) elements[entry.element] = { baseTransform: transform() };
  const assigned = assignHand(null, 'left', { element: 'handLeft', parent: 'body', anchor: { x: 100, y: 120 } });
  const hands = styles
    ? { left: { ...assigned.hands.left, styles: { library: library('left', ids), pivot: [100, 100] } } }
    : assigned.hands;
  return {
    ...base,
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="body"/><g id="handLeft"/><g id="handRight"/></svg>',
    elements, layerMetadata: {}, hands,
    params: {
      ...base.params, ...assigned.parameters,
      ...(styles ? { handLStyle: { type: 'number', min: 0, max: ids.length - 1, default: 0, value: 0, options: [...ids] } } : {}),
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
    useHandStyles: (side) => { applied.push({ converted: side }); return true; }
  });
  panel.openHand('left');
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  return { store, host, panel, applied, click, hand: () => store.getDocument().hands.left };
}

test('a hand offers its drawings, and no fingers, views, facing or animation', () => {
  const { host } = harness({ ids: [...handStyleIds()] });
  for (const id of handStyleIds()) assert.ok(host.innerHTML.includes(`data-hand-style-chip="left:${id}"`), id);
  assert.match(host.innerHTML, /Hand style/, 'the row is named for what it chooses');
  for (const gone of ['data-hand-view-chip', 'data-hand-finger', 'Pose editor', 'Fingers', 'handLAnim', 'handLFacing', 'handLGrip', 'Touch the thumb', 'Capture']) {
    assert.equal(host.innerHTML.includes(gone), false, `${gone} is gone from the card`);
  }
  assert.equal(host.innerHTML.includes('data-hand-action="use-styles"'), false, 'nothing left to convert');
});

test('every chip shows the drawing it stands for, not a word for it', () => {
  const { host } = harness({ ids: ['relaxed', 'fist'] });
  const thumbs = host.innerHTML.match(/class="hand-thumb"/g) || [];
  // A cell per drawing the library holds, drawn or not.
  assert.equal(thumbs.length, handStyleIds().length);
  assert.ok(host.innerHTML.includes('viewBox="0 0 200 200"'), 'every thumbnail shares the set’s box');
});

test('pressing a drawing writes its index, and an offer says how to draw it', () => {
  const harnessed = harness({ ids: [...handStyleIds()] });
  harnessed.click({ handStyleChip: 'left:fist' });
  assert.deepEqual(harnessed.applied.at(-1), { handLStyle: 2 });
  harnessed.click({ handStyleChip: 'left:relaxed' });
  assert.deepEqual(harnessed.applied.at(-1), { handLStyle: 0 });
  harnessed.click({ handStyleChip: 'left:nonsense' });
  assert.deepEqual(harnessed.applied.at(-1), { handLStyle: 0 }, 'an unknown drawing writes nothing');

  const partial = harness({ ids: ['relaxed'] });
  partial.click({ handStyleChip: 'left:peace' });
  assert.deepEqual(partial.applied, [], 'a drawing this hand has not got is not written');
  assert.match(partial.host.innerHTML, /not drawn on this hand yet/);
});

test('the card says which drawing the hand rests on, and how it changes', () => {
  const { host } = harness({ ids: [...handStyleIds()] });
  assert.match(host.innerHTML, /data-hand-field="restStyle"/);
  assert.match(host.innerHTML, /data-hand-field="swap"/);
  assert.match(host.innerHTML, /Only while out of sight/);
  assert.match(host.innerHTML, /never a blend/);
});

test('a hand that still deforms is offered the conversion, and told what it does', () => {
  const { host, click, applied } = harness({ styles: false });
  assert.ok(host.innerHTML.includes('data-hand-action="use-styles"'));
  assert.match(host.innerHTML, /wobbles while it moves/);
  assert.match(host.innerHTML, /hidden, not deleted/);
  click({ handAction: 'use-styles', handSide: 'left' });
  assert.deepEqual(applied.at(-1), { converted: 'left' });
});

test('a hand with no pseudo-3D turn is offered drawings without being told off about one', () => {
  const { host } = harness({ styles: false, facing: false });
  assert.ok(host.innerHTML.includes('data-hand-action="use-styles"'));
  assert.equal(/wobbles while it moves/.test(host.innerHTML), false);
});
