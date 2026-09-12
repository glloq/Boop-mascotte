import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createHandCommands } from '../hands/hand-commands.js';
import {
  addHandStyle, handStyleFrame, handStyleMarkupFor, installStyleHands, styleHandsMarkup
} from '../hands/hand-style-install.js';
import { handStyleElementId } from '../hands/hand-style-art.js';
import { handDrawingIsCustom } from '../hands/hand-drawing.js';
import { elementSpan } from '../face-library/face-part-artwork.js';
import { artworkIds } from '../face-library/face-part-model.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { boxesFromReferenceBox, createFakeFaceCanvas, templateBoxes } from './helpers/fake-face-canvas.js';

/**
 * UIR-00 — what must still be true after the interface is rebuilt
 * (docs/UIR_REFACTOR_BASELINE.md).
 *
 * The refactor moves panels: Hands leaves Character, the SVG editor learns to
 * open one drawing of one hand, and Face Setup is cut into four. None of that
 * is supposed to move *data*, and the failures that would be hardest to notice
 * are the quiet ones — a hand state edited through a newly scoped editor that
 * writes over its neighbour, a face part installed through a re-presented
 * Character Builder that drags the hands along with it.
 *
 * So these are not tests of panels. They are the four separations of §16 of the
 * roadmap written as assertions, against the models the panels drive:
 *
 * ```text
 * Hand state ≠ hand state      one drawing is edited, the others are not
 * Left       ≠ right           two hands, two libraries, no mirror link
 * Face       ≠ hands           a face edit is not a hand edit
 * Hand state ≠ face rig        showing a different drawing rigs nothing
 * ```
 *
 * A UI pull request that breaks one of these has broken the product, whatever
 * the screenshots say.
 */

const record = (nodeType = 'path') => ({
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
  constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' }
});

/** Register what the canvas would have registered for markup it just appended. */
const registerArtwork = (state, markup) => {
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) state.elements[match[2]] ||= record(match[1]);
};

/** A mascot whose hands are drawn from exactly these states, and nothing else. */
function drawnMascot(styles) {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  state.elements = { faceRoot: record('g') };
  state.states = { idle: {} };
  state.activeState = 'idle';
  const markup = styleHandsMarkup(state, { styles });
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  registerArtwork(state, markup);
  assert.equal(installStyleHands(state, { styles }), true, 'the fixture draws a pair of hands');
  return state;
}

/**
 * Add one state to one hand, the way **Design ▸ Hands** will: the canvas paints
 * the drawing inside that hand's group, then one command writes the library.
 * Deliberately the two steps `editor-app.js` already takes, so the test fails
 * if either of them starts reaching across to the other hand.
 */
function addState(state, side, style) {
  const frame = handStyleFrame(state, side);
  const markup = handStyleMarkupFor(state, side, style, { frame });
  const span = elementSpan(state.svgMarkup, state.hands[side].element);
  const close = state.svgMarkup.lastIndexOf('</g>', span.end);
  state.svgMarkup = `${state.svgMarkup.slice(0, close)}${markup}${state.svgMarkup.slice(close)}`;
  registerArtwork(state, markup);
  return addHandStyle(state, side, style, { frame });
}

/** The markup of one state of one hand, exactly as the document holds it. */
function stateMarkup(state, side, style) {
  const span = elementSpan(state.svgMarkup, handStyleElementId(side, style));
  return span ? state.svgMarkup.slice(span.start, span.end) : null;
}

/** Reshape one layer of one state, the way the Node tool would. */
function reshapeLayer(state, side, style, part, d = 'M 0 0 L 7 7 Z') {
  const id = `${handStyleElementId(side, style)}-${part}`;
  const before = state.svgMarkup;
  state.svgMarkup = state.svgMarkup.replace(new RegExp(`(<path id="${id}"[^>]*\\sd=")[^"]*(")`), `$1${d}$2`);
  assert.notEqual(state.svgMarkup, before, `${id} is in the document to reshape`);
}

/** Every state of every hand, as markup, for comparing a document to itself. */
const allStateMarkup = (state) => Object.fromEntries(['left', 'right'].flatMap((side) =>
  (state.hands?.[side]?.styles?.library || []).map((entry) => [`${side}/${entry.id}`, stateMarkup(state, side, entry.id)])));

/* ── Hand state ≠ hand state ──────────────────────────────────────────────── */

test('UIR-00: a new hand state is added, reshaped, and every other state is untouched', () => {
  const state = drawnMascot(['relaxed', 'open']);
  const before = allStateMarkup(state);

  assert.equal(addState(state, 'left', 'point'), true);
  assert.deepEqual(state.hands.left.styles.library.map((entry) => entry.id), ['relaxed', 'open', 'point'],
    'the new state joins the library it was added to');
  for (const [key, markup] of Object.entries(before)) {
    assert.equal(stateMarkup(state, ...key.split('/')), markup, `adding a state redrew ${key}`);
  }

  // …and now edit it. This is the whole point of scoping the SVG editor to one
  // drawing (UIR-06): the scope is a *view*, so nothing but the drawing under
  // it may come back changed.
  const drawn = allStateMarkup(state);
  reshapeLayer(state, 'left', 'point', 'index');
  assert.equal(handDrawingIsCustom(state, 'left', 'point'), true, 'the edited state is reshaped');
  for (const [key, markup] of Object.entries(drawn)) {
    if (key === 'left/point') continue;
    assert.equal(stateMarkup(state, ...key.split('/')), markup, `editing left/point also changed ${key}`);
    assert.equal(handDrawingIsCustom(state, ...key.split('/')), false, `${key} is reported as reshaped`);
  }
});

/* ── Left ≠ right ─────────────────────────────────────────────────────────── */

test('UIR-00: the two hands hold separate libraries, and editing one never reaches the other', () => {
  const state = drawnMascot(['relaxed', 'open']);
  const right = allStateMarkup(state);

  // A state added to the left hand is a state the right hand does not have.
  // `Mirror copy` (UIR-05) is a copy: there is no permanent link to keep.
  assert.equal(addState(state, 'left', 'fist'), true);
  assert.deepEqual(state.hands.right.styles.library.map((entry) => entry.id), ['relaxed', 'open'],
    'the right hand did not gain a state the left hand was given');

  reshapeLayer(state, 'left', 'relaxed', 'palm');
  assert.equal(handDrawingIsCustom(state, 'left', 'relaxed'), true);
  assert.equal(handDrawingIsCustom(state, 'right', 'relaxed'), false, 'the right hand still draws the set\'s Relaxed');
  assert.equal(stateMarkup(state, 'right', 'relaxed'), right['right/relaxed']);
  assert.equal(stateMarkup(state, 'right', 'open'), right['right/open']);
});

/* ── Face ≠ hands ─────────────────────────────────────────────────────────── */

test('UIR-00: installing a face part leaves the hands, their states and their rig alone', () => {
  const library = createFacePartRegistry();
  library.registerMany(BUILTIN_FACE_PARTS);
  const assets = {};
  for (const asset of library.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || null });
  const parts = createFacePartCommands(store, history, canvas, { library });

  const before = structuredClone(store.getDocument());
  const drawings = allStateMarkup(before);
  const handsRevision = store.getDomainRevision('hands');

  // The command the re-presented Character Builder keeps driving (UIR-04):
  // swap the mouth for another one out of the library.
  assert.equal(parts.replace('mouth', 'mouth.wide').ok, true);

  const after = store.getDocument();
  assert.notEqual(after.svgMarkup, before.svgMarkup, 'the face really was redrawn');
  assert.deepEqual(after.hands, before.hands, 'a face edit wrote into the hands block');
  assert.equal(store.getDomainRevision('hands'), handsRevision,
    'a face edit declared the hands domain, so every hand panel redraws for nothing');
  for (const [key, markup] of Object.entries(drawings)) {
    assert.equal(stateMarkup(after, ...key.split('/')), markup, `a face edit redrew ${key}`);
  }
});

/* ── Hand state ≠ face rig ────────────────────────────────────────────────── */

test('UIR-00: showing a different hand state writes nothing into the face rig', () => {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  const hands = createHandCommands(store, history);
  const before = structuredClone(store.getDocument());

  assert.equal(hands.setStyles('left', { showing: 'point' }), true);

  const after = store.getDocument();
  assert.equal(after.hands.left.styles.showing, 'point', 'the hand shows the state it was asked for');
  assert.equal(after.hands.right.styles.showing, before.hands.right.styles.showing, 'and the other hand does not');
  // Everything the face is: which parts it has, what deforms them, what they
  // are expected to do. A hand state is a drawing swap and touches none of it.
  for (const field of ['semanticParts', 'keyforms', 'shapeKeys', 'warps', 'rigPins', 'expressions', 'reactions', 'animationClips', 'deformers']) {
    assert.deepEqual(after[field], before[field], `swapping a hand state rewrote ${field}`);
  }
  assert.equal(after.svgMarkup, before.svgMarkup, 'and no artwork was redrawn');
  // The style parameter is the runtime's index into the library, not something
  // an author sets by hand: swapping the *rest* state must not silently pose
  // the mascot by writing a value into the rig.
  assert.deepEqual(after.params, before.params, 'swapping a hand state rewrote the parameters');
});
