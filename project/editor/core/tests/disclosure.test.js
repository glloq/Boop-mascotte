import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom } from './helpers/stub-dom.js';

installStubDom();

const { disclosureSection, disclosurePanel, DISCLOSURE_LEVELS } = await import('../../ui/disclosure.js');
const { createHandSetupPanel } = await import('../../rig-editor/hands/hand-setup-panel.js');
const { createHandCommands } = await import('../hands/hand-commands.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createSampleProject } = await import('../state/store.js');
const { handDigitParameter, HAND_DIGIT_CONTROLS } = await import('../sample/hand-feature.js');

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const curl = () => ({ default: 0, min: 0, max: 1, value: 0 });

/** A project with two hands' worth of artwork and one curl per digit, so the panel has every tier to draw. */
function project() {
  const base = createSampleProject();
  return {
    ...base,
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="body"/><g id="handLeft"/><g id="handRight"/></svg>',
    elements: { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() }, handRight: { baseTransform: transform() } },
    layerMetadata: { handLeft: { name: 'Left hand art' } },
    shapeKeys: [{ id: 'handLeft-fist', name: 'Fist', target: 'handLeft' }],
    params: {
      ...base.params,
      ...Object.fromEntries(['left', 'right'].flatMap((side) => HAND_DIGIT_CONTROLS.map((digit) => [handDigitParameter(side, digit.id), curl()])))
    },
    hands: null
  };
}

/**
 * The state the inventory below was captured in: a left hand walked all the way
 * to Ready with a pose on it, and a right hand that has only just been assigned.
 * One render, every control the panel owns.
 */
function handPanel() {
  const store = createEditorStore(project());
  const history = createHistory(store);
  const host = document.createElementNS('', 'div');
  const panel = createHandSetupPanel(host, store, history, { artboardWidth: () => 200, liveValues: () => ({}), drawHands: () => true, handsDrawn: () => false });
  const commands = createHandCommands(store, history);
  commands.assign('left', { element: 'handLeft' });
  commands.setParent('left', 'body');
  commands.setAnchor('left', { x: -30, y: 12 });
  commands.addPose('left', { id: 'wave', name: 'Wave', parameter: 'handLWave' });
  commands.assign('right', { element: 'handRight' });
  panel.render();
  return { host, panel, html: () => host.innerHTML };
}

/** Every `data-` hook in a rendered panel, name and value, as the specs and the app address them. */
const hooks = (html) => new Set([...html.matchAll(/\s(data-[\w-]+)(?:="([^"]*)")?/g)].map((match) => (match[2] === undefined ? match[1] : `${match[1]}="${match[2]}"`)));

test('a basic section is what the author sees first, so it renders no <details>', () => {
  const html = disclosureSection({ id: 'place', level: 'basic', title: 'Position', body: '<input data-x>' });
  assert.equal(html.includes('<details'), false, 'nothing to click before the control is visible');
  assert.equal(html.includes('<summary'), false);
  assert.match(html, /data-disclosure="place" data-disclosure-level="basic"/);
  assert.match(html, /<h5 class="small">Position<\/h5>/);
  assert.match(html, /<input data-x>/);
});

test('a more or advanced section is one <details> carrying the id rememberOpen reads', () => {
  for (const level of ['more', 'advanced']) {
    const html = disclosureSection({ id: `hand:left:${level}`, level, title: 'Fingers', body: '<p>curls</p>' });
    assert.match(html, /^<details /, 'one element, so a panel can count its sections');
    assert.match(html, new RegExp(`data-keep-open="hand:left:${level}"`));
    assert.match(html, /data-disclosure-level="(more|advanced)"/);
    assert.match(html, /<summary>Fingers<\/summary>/);
    assert.equal(/<details[^>]* open/.test(html), false, 'closed unless asked for');
  }
});

test('a section renders open when it is asked to, and says what is inside while closed', () => {
  assert.match(disclosureSection({ id: 'motion', level: 'more', title: 'Motion', open: true, body: 'x' }), /<details[^>]* open>/);
  assert.match(disclosureSection({ id: 'motion', level: 'more', title: 'Motion', hint: '40 × 30', body: 'x' }), /<summary>Motion <span class="small">40 × 30<\/span><\/summary>/);
});

test('a section with nothing in it is dropped rather than offered empty', () => {
  assert.equal(disclosureSection({ id: 'fingers', level: 'more', title: 'Fingers', body: '' }), '');
  assert.equal(disclosureSection({ id: 'fingers', level: 'more', title: 'Fingers', body: '   ' }), '');
  assert.equal(disclosureSection({ id: 'place', level: 'basic', title: 'Position' }), '');
});

test('a panel reads basic, then more, then advanced, whatever order it was declared in', () => {
  const html = disclosurePanel([
    { id: 'c', level: 'advanced', title: 'Advanced', body: 'c' },
    { id: 'b', level: 'more', title: 'Motion', body: 'b' },
    { id: 'b2', level: 'more', title: 'Physics', body: 'b2' },
    { id: 'a', level: 'basic', body: 'a' }
  ]);
  assert.deepEqual([...html.matchAll(/data-disclosure="(\w+)"/g)].map((match) => match[1]), ['a', 'b', 'b2', 'c'], 'and the declared order holds within a tier');
});

test('a level that is not one of the three is a mistake, not a fourth tier', () => {
  assert.deepEqual(DISCLOSURE_LEVELS, ['basic', 'more', 'advanced']);
  assert.throws(() => disclosureSection({ id: 'x', level: 'expert', body: 'x' }), /Unknown disclosure level/);
});

test('a hand card shows where the hand is and what it can do, and folds the rest away', () => {
  const html = handPanel().html();
  const firstDetails = html.indexOf('<details');
  assert.ok(firstDetails > 0);
  // Artwork, anchor and the pose chips are above the first summary; reach,
  // curls, overshoot and the shape-key wiring are below it.
  for (const hook of ['data-hand-field="artwork"', 'data-hand-field="anchorX"', 'data-hand-pose-chip="left:wave"']) {
    assert.ok(html.indexOf(hook) < firstDetails, `${hook} is basic`);
  }
  for (const hook of ['data-hand-finger="handLThumb"', 'data-hand-field="reachX"', 'data-hand-field="softness"', 'data-hand-field="poseShape"', 'data-hand-field="depth"']) {
    assert.ok(html.indexOf(hook) > firstDetails, `${hook} is behind a summary`);
  }
  for (const id of ['fingers', 'motion', 'physics', 'advanced']) assert.match(html, new RegExp(`data-keep-open="hand:left:${id}"`));
  assert.equal(/<details[^>]* open/.test(html), false, 'the card opens on Basic, not on four expanded sections');
});

test('opening a hand section survives the card rebuilding itself', () => {
  const it = handPanel();
  // `rememberOpen` listens on the host in the capture phase, because `toggle`
  // does not bubble; this is the event the browser sends it.
  it.host.dispatch('toggle', { target: { open: true, getAttribute: (name) => (name === 'data-keep-open' ? 'hand:left:motion' : null) } });
  it.panel.render();
  assert.match(it.html(), /data-keep-open="hand:left:motion" open>/);
  assert.equal(/data-keep-open="hand:left:physics" open/.test(it.html()), false, 'and only the one that was opened');
});

/**
 * Every `data-` hook the panel rendered before VNX-12 split it into tiers,
 * captured from the same fixture `handPanel()` builds. Progressive disclosure
 * moves controls; it must never drop one, and a control that only the app or a
 * browser spec addresses is exactly the kind that disappears unnoticed.
 */
const HOOKS_BEFORE_TIERS = Object.freeze([
  'data-hand-action="draw"', 'data-hand-action="mirror"', 'data-hand-action="open"', 'data-hand-action="open-hand"',
  'data-hand-action="remove"', 'data-hand-action="remove-pose"', 'data-hand-action="select"',
  'data-hand-card="left"', 'data-hand-card="right"',
  'data-hand-field="anchorX"', 'data-hand-field="anchorY"', 'data-hand-field="artwork"', 'data-hand-field="depth"',
  'data-hand-field="inertia"', 'data-hand-field="parent"', 'data-hand-field="poseShape"', 'data-hand-field="poseVariant"',
  'data-hand-field="reachRotation"', 'data-hand-field="reachX"', 'data-hand-field="reachY"',
  'data-hand-field="restX"', 'data-hand-field="restY"', 'data-hand-field="softness"',
  'data-hand-finger="handLIndex"', 'data-hand-finger="handLMiddle"', 'data-hand-finger="handLRing"', 'data-hand-finger="handLThumb"',
  'data-hand-fingers="left"', 'data-hand-next', 'data-hand-pose="wave"', 'data-hand-reach',
  'data-hand-pose-chip="left:fist"', 'data-hand-pose-chip="left:neutral"', 'data-hand-pose-chip="left:open"',
  'data-hand-pose-chip="left:peace"', 'data-hand-pose-chip="left:point"', 'data-hand-pose-chip="left:thumbsUp"',
  'data-hand-pose-chip="left:wave"',
  'data-hand-side="left"', 'data-hand-side="right"',
  'data-hand-status="ready"', 'data-hand-status="setup"', 'data-hand-step="1"', 'data-hand-step="4"'
]);

test('no control left the hand panel when its tiers arrived', () => {
  const rendered = hooks(handPanel().html());
  const missing = HOOKS_BEFORE_TIERS.filter((hook) => !rendered.has(hook));
  assert.deepEqual(missing, [], 'moving a control into More is fine, dropping one is not');
});

test('the other side gets its own sections, so opening Fingers on the left leaves the right alone', () => {
  const it = handPanel();
  it.panel.openHand('right');
  const html = it.html();
  for (const id of ['fingers', 'motion', 'physics', 'advanced']) assert.match(html, new RegExp(`data-keep-open="hand:right:${id}"`));
  assert.equal(html.includes('data-keep-open="hand:left:fingers"'), false, 'the closed card renders no sections at all');
  assert.ok(hooks(html).has('data-hand-finger="handRThumb"'), 'and the right hand has its own curls');
});
