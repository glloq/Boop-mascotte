/**
 * VNX-15 — calibration as a sequence, tested as a sequence.
 *
 * ```text
 * Movement: Open / close
 *   1  Resting position
 *   2  Full open
 *   3  Try it
 * ```
 *
 * The unit tests around this file already prove the solver (`face-movements`,
 * `semantic-animation`). What was never pinned is the part an author actually
 * meets: the order the Movement Inspector asks for things in, and the promise
 * that the words *binding*, *amplitude* and *parameter* are not among them.
 * So this drives the real panel through the stub DOM, captures two poses the
 * way the canvas banner does, and asks the **runtime** whether the artwork
 * moved — not the document, which would only prove a number was written.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();
// The panel listens for Escape on the window and escapes ids with CSS.escape
// when it restores focus; neither exists under `node --test`.
globalThis.window ||= { addEventListener() {} };
globalThis.CSS ||= { escape: (value) => value };

const { createRigPanel } = await import('../../rig-editor/semantic-parts/rig-panel.js');
const { createSemanticRigCommands } = await import('../../rig-editor/semantic-parts/semantic-rig-commands.js');
const { calibrationSteps } = await import('../../rig-editor/semantic-parts/face-movements.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { compileRigFrame } = await import('../../../runtime/runtime.js');

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const element = () => ({ baseTransform: transform(), constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'path' } });
const layer = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
const ids = ['mouth', 'pupilL', 'pupilR'];

const project = () => ({
  svgMarkup: '<svg/>', elements: Object.fromEntries(ids.map((id) => [id, element()])), layers: ids.map(layer),
  layerMetadata: {}, semanticParts: {}, params: {}, states: { idle: {} }, activeState: 'idle', animationClips: [], behaviors: []
});

/** The panel, wired to stand-ins for the three things it talks to. */
function harness() {
  const store = createEditorStore(project()), history = createHistory(store);
  const host = document.createElementNS('', 'div'), navigator = document.createElementNS('', 'div');
  const live = {};
  const preview = {
    getLiveParams: () => live, setLiveParam: (name, value) => { live[name] = value; },
    clearLiveParam: (name) => { delete live[name]; }, clearLiveParams: () => { for (const name of Object.keys(live)) delete live[name]; }
  };
  let context = { activeSemanticPartId: null, activeControl: null };
  const editorContext = { get: () => context, update: (patch) => { context = { ...context, ...patch }; } };
  // The canvas pose session, reduced to what the panel uses: it hands over the
  // artwork ids, and later asks what the author left them looking like.
  const canvas = {
    session: null, posed: {},
    beginTransformPose(list, options) { this.session = { ids: list, ...options }; return true; },
    captureTransformPose() { const list = this.session?.ids || []; this.session = null; return Object.fromEntries(list.map((id) => [id, transform(this.posed[id] || {})])); },
    cancelRigTool() { this.session = null; }, getElementBounds: () => null, beginRolePick() {}, beginPivotEdit() {}, beginMorphPose() {}, captureMorphPose: () => ''
  };
  const panel = createRigPanel(host, store, history, preview, () => {}, canvas, editorContext, navigator);
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  /** Pose the artwork, then press Capture on the canvas banner. */
  const capture = (control, key, posed) => { click({ poseCapture: `${control}:${key}` }); canvas.posed = posed; canvas.session.capture(); };
  const document_ = () => store.getDocument();
  const frame = (params) => compileRigFrame(document_().elements, params);
  return { store, history, host, panel, canvas, preview, click, capture, document: document_, frame, commands: createSemanticRigCommands(store, history) };
}

// Advanced is the one part of the panel allowed to name the machinery, so it
// is the one part these assertions cut out. Everything else counts as read.
const ADVANCED = /<details[^>]*data-disclosure-level="advanced"[\s\S]*?<\/details>/;
const visibleText = (markup) => markup.replace(ADVANCED, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const advancedOf = (markup) => markup.match(ADVANCED)?.[0] || '';

test('a movement is set up by posing the mascot at rest and at full, and then it moves the artwork', () => {
  const it = harness();
  it.commands.assignFaceRole('mouth', 'mouth', 'mouth');
  it.commands.enableControl('mouth', 'mouthOpen');
  it.panel.openMovement('mouth', 'mouthOpen');

  // Step order is the item: rest, then full, then try it.
  const start = it.host.innerHTML;
  assert.ok(start.indexOf('Resting position') < start.indexOf('Full open'), 'rest is asked for first');
  assert.ok(start.indexOf('Full open') < start.indexOf('Try it'), 'testing comes last');
  assert.match(start, /data-movement-step="1" data-movement-step-active="true"[^>]*>[\s\S]*?1 · Resting position<\/b><small>Leave it as drawn\./);
  assert.match(start, /data-movement-step="2"[^>]*>[\s\S]*?2 · Full open<\/b><\/span>\s*<button/, 'only the step being done explains itself');
  assert.match(start, /<h3>3 · Try it<\/h3>/);
  assert.match(start, /data-movement-status="default"[^>]*>○ Not set up yet/);

  // Uncalibrated, the mouth still moves — by the registry's guess, 1 → 2.
  assert.equal(it.frame({ mouthOpen: 1 }).mouth.transform.scaleY, 2);

  it.capture('mouthOpen', 'closed', { mouth: { scaleY: 1 } });
  assert.match(it.host.innerHTML, /data-pose="closed" data-pose-captured="true"/);
  assert.match(it.host.innerHTML, /data-movement-step="2" data-movement-step-active="true"/, 'the flow moved on');
  assert.match(it.host.innerHTML, /data-movement-status="partial"[^>]*>● 1 of 2 set/);
  assert.equal(it.frame({ mouthOpen: 1 }).mouth.transform.scaleY, 2, 'one pose cannot solve a movement');

  const before = structuredClone(it.document());
  it.capture('mouthOpen', 'open', { mouth: { scaleY: 1.6 } });
  assert.match(it.host.innerHTML, /data-movement-status="calibrated"[^>]*>✓ Ready/);
  // Done with the steps, an author is back for the test: the two captures fold
  // into one line, above the pad, and redoing one is a single click.
  assert.match(it.host.innerHTML, /<summary>Set it up <span class="small">2 of 2 positions set<\/span><\/summary>/);
  assert.ok(it.host.innerHTML.indexOf('Set it up') < it.host.innerHTML.indexOf('Try it'), 'the order does not move under them');
  // The artwork now does what the author posed: flat at rest, 1.6× at full.
  assert.equal(it.frame({ mouthOpen: 0 }).mouth.transform.scaleY, 1);
  assert.equal(it.frame({ mouthOpen: 1 }).mouth.transform.scaleY, 1.6);
  assert.equal(it.frame({ mouthOpen: .5 }).mouth.transform.scaleY, 1.3);

  // One undo takes the solve and the pose that triggered it: the capture and
  // the calibration it completes are a single command, not two.
  it.history.undo();
  assert.deepEqual(it.document(), before);
  assert.equal(it.frame({ mouthOpen: 1 }).mouth.transform.scaleY, 2, 'the guessed movement is back');
  it.history.undo();
  assert.equal(it.document().semanticParts.mouth.calibration.mouthOpen, undefined, 'and the first pose with a second undo');
});

test('nothing in that path says binding, amplitude or a parameter name — Advanced still does', () => {
  const it = harness();
  it.commands.assignFaceRole('mouth', 'mouth', 'mouth');
  it.commands.enableControl('mouth', 'mouthOpen');
  it.panel.openMovement('mouth', 'mouthOpen');

  const seen = [it.host.innerHTML];
  it.capture('mouthOpen', 'closed', { mouth: { scaleY: 1 } });
  seen.push(it.host.innerHTML);
  it.capture('mouthOpen', 'open', { mouth: { scaleY: 1.6 } });
  seen.push(it.host.innerHTML);

  // Every parameter this project has, plus the transform properties a movement
  // can be built from: none of them is a word an author should have to read.
  const jargon = [...Object.keys(it.document().params), 'translateX', 'translateY', 'scaleX', 'scaleY', 'rotation', 'opacity', 'shapeKey', 'amplitude', 'offset'];
  for (const markup of seen) {
    // Ids still exist as `data-` hooks — that is plumbing, and the panel needs
    // it to route a click. The claim is about the words on screen.
    const text = visibleText(markup);
    assert.doesNotMatch(markup, /binding/i, 'the word never appears at all, attributes included');
    for (const word of jargon) assert.ok(!text.includes(word), `"${word}" is on screen: ${text.trim()}`);
    assert.doesNotMatch(text, /\d+\.\d+/, `a raw number is on screen: ${text.trim()}`);
  }

  // …and the numbers are not gone, they are one click away (VNX-12).
  const advanced = advancedOf(seen.at(-1));
  assert.match(advanced, /data-disclosure-level="advanced"/);
  assert.match(advanced, /data-keep-open="movement-advanced"/);
  assert.match(advanced, /Mouth · scaleY · amplitude 0\.60 · offset 1\.00/);
  assert.match(advanced, /data-method="mouthOpen"/, 'and so is the method it uses');
});

test('the resting step is the one the movement already sits at, whichever end that is', () => {
  // An eye rests OPEN and a mouth rests CLOSED; both are their parameter's
  // default, which is why the order is derived rather than listed per control.
  const eye = calibrationSteps('eyes', 'eyeOpen', { method: 'transform' }, { min: 0, max: 1, default: 1 });
  assert.deepEqual(eye.map((step) => [step.key, step.title]), [['open', 'Resting position'], ['closed', 'Full closed']]);
  const mouth = calibrationSteps('mouth', 'mouthOpen', { method: 'transform' }, { min: 0, max: 1, default: 0 });
  assert.deepEqual(mouth.map((step) => [step.key, step.title]), [['closed', 'Resting position'], ['open', 'Full open']]);
  // A three-pose movement asks for the middle first and both ends after it;
  // two of the three are still all the solver needs.
  const head = calibrationSteps('head', 'headX', { method: 'transform' }, { min: -1, max: 1, default: 0 });
  assert.deepEqual(head.map((step) => step.key), ['center', 'left', 'right']);
  assert.deepEqual(head.map((step) => step.step), [1, 2, 3]);
  assert.deepEqual(head.map((step) => step.hint), ['Leave it as drawn.', 'As far as it should go.', 'As far as it should go.']);
  // A shaped movement has no poses to capture at all: the shapes are the
  // movement, so it must not be asked for two.
  assert.deepEqual(calibrationSteps('mouth', 'teeth', { method: 'shapeKey' }, { min: 0, max: 1, default: 0 }), []);
});

test('a movement built from shape keys says so instead of asking for poses it cannot use', () => {
  const it = harness();
  it.commands.assignFaceRole('mouth', 'mouth', 'mouth');
  it.commands.enableControl('mouth', 'teeth');
  it.panel.openMovement('mouth', 'teeth');
  const markup = it.host.innerHTML;
  assert.match(markup, /data-movement-status="calibrated"[^>]*>✓ Ready/);
  assert.match(markup, /shape of its own/);
  assert.doesNotMatch(markup, /data-pose-capture/);
  assert.match(markup, /<h3>1 · Try it<\/h3>/, 'trying it is the only step left');
});
