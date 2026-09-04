import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewService } from '../../app/services/preview-service.js';

// The preview controller reduced to what the service actually drives: the
// start / stop / reset transport, the two state entry points, and a reaction
// trigger that answers from the same document the service reads, so a fired
// reaction and a `no-listener` one are distinguished the way the real one does.
const createRuntime = (readDocument) => {
  const calls = [];
  return {
    calls,
    start() { calls.push('start'); return true; },
    stop() { calls.push('stop'); return true; },
    reset() { calls.push('reset'); },
    setState(name) { calls.push(`setState:${name}`); return true; },
    previewState(name) { calls.push(`previewState:${name}`); return true; },
    triggerReaction(event) {
      calls.push(`trigger:${event.type}`);
      return (readDocument().reactions || []).find(item => item.enabled !== false && item.trigger?.type === event.type)?.id || null;
    }
  };
};

// Every shell effect is collected instead of applied, so what preview mode does
// to the editor is a list of values rather than a DOM to inspect.
const createHarness = ({ reactions = [], workspace = 'preview', ...overrides } = {}) => {
  const shell = { status: [], renders: 0, revealed: 0, classes: [] };
  let document = { reactions };
  let currentWorkspace = workspace;
  const preview = createRuntime(() => document);
  const service = createPreviewService({
    preview,
    store: { getDocument: () => document },
    getWorkspace: () => currentWorkspace,
    revealInspector: () => { shell.revealed += 1; },
    renderPanel: () => { shell.renders += 1; },
    setStatus: (message) => shell.status.push(message),
    setPreviewClass: (on) => shell.classes.push(on),
    ...overrides
  });
  return {
    service, preview, shell,
    setWorkspace: (next) => { currentWorkspace = next; },
    setReactions: (next) => { document = { reactions: next }; }
  };
};

// A click as the canvas delivers it: `closest` is the only thing the guard uses.
const canvasClick = ({ onControl = false } = {}) => ({ target: { closest: () => (onControl ? { tagName: 'BUTTON' } : null) } });

test('turning preview on starts the runtime, reveals the inspector and announces itself', () => {
  const harness = createHarness();
  assert.equal(harness.service.isLive(), false);
  harness.service.setLive(true);
  assert.equal(harness.service.isLive(), true);
  assert.deepEqual(harness.preview.calls, ['start']);
  assert.deepEqual(harness.shell.classes, [true]);
  assert.equal(harness.shell.revealed, 1);
  assert.equal(harness.shell.renders, 1);
  assert.deepEqual(harness.shell.status, ['Preview is live. Changes here are non-destructive.']);
});

test('turning preview off stops the runtime and reports nothing', () => {
  const harness = createHarness();
  harness.service.setLive(true);
  harness.service.setLive(false);
  assert.equal(harness.service.isLive(), false);
  assert.deepEqual(harness.preview.calls, ['start', 'stop']);
  assert.deepEqual(harness.shell.classes, [true, false]);
  // Leaving preview reveals nothing, redraws nothing and says nothing.
  assert.equal(harness.shell.revealed, 1);
  assert.equal(harness.shell.renders, 1);
  assert.deepEqual(harness.shell.status, ['Preview is live. Changes here are non-destructive.']);
});

test('a canvas click outside the Preview workspace does nothing at all', () => {
  const harness = createHarness({ workspace: 'artwork', reactions: [{ id: 'wave', trigger: { type: 'click' } }] });
  assert.equal(harness.service.triggerClick(canvasClick()), false);
  assert.deepEqual(harness.preview.calls, []);
  assert.equal(harness.shell.renders, 0);
});

test('a canvas click on the mascot fires the click reaction and redraws the panel', () => {
  const harness = createHarness({ reactions: [{ id: 'wave', trigger: { type: 'click' } }] });
  assert.equal(harness.service.triggerClick(canvasClick()), true);
  assert.deepEqual(harness.preview.calls, ['trigger:click']);
  assert.equal(harness.shell.renders, 1);
});

test('a canvas click on a control belongs to the control, not to the mascot', () => {
  const harness = createHarness({ reactions: [{ id: 'wave', trigger: { type: 'click' } }] });
  assert.equal(harness.service.triggerClick(canvasClick({ onControl: true })), false);
  assert.deepEqual(harness.preview.calls, []);
  assert.equal(harness.shell.renders, 0);
});

test('a click that reaches no listening reaction leaves the panel alone', () => {
  const harness = createHarness({ reactions: [{ id: 'greet', trigger: { type: 'hover' } }] });
  assert.equal(harness.service.triggerClick(canvasClick()), false);
  assert.deepEqual(harness.preview.calls, ['trigger:click']);
  assert.equal(harness.shell.renders, 0);
});

test('a hover gesture is ignored when no enabled reaction listens for hover', () => {
  const harness = createHarness({ reactions: [{ id: 'greet', enabled: false, trigger: { type: 'hover' } }, { id: 'wave', trigger: { type: 'click' } }] });
  assert.equal(harness.service.triggerHover(), false);
  // The controller is never asked, so no `no-listener` event is logged either.
  assert.deepEqual(harness.preview.calls, []);
  assert.equal(harness.shell.renders, 0);

  harness.setWorkspace('reactions');
  harness.setReactions([{ id: 'greet', trigger: { type: 'hover' } }]);
  assert.equal(harness.service.triggerHover(), false);
  assert.deepEqual(harness.preview.calls, []);
});

test('a hover gesture fires when an enabled hover reaction is listening', () => {
  const harness = createHarness({ reactions: [{ id: 'greet', enabled: true, trigger: { type: 'hover' } }] });
  assert.equal(harness.service.triggerHover(), true);
  assert.deepEqual(harness.preview.calls, ['trigger:hover']);
  assert.equal(harness.shell.renders, 1);
});

test('reset clears live values and restarts the runtime only when preview is live', () => {
  const idle = createHarness();
  idle.service.reset();
  assert.deepEqual(idle.preview.calls, ['reset']);
  assert.equal(idle.shell.renders, 1);
  assert.deepEqual(idle.shell.status, ['Mascot reset. Live controls and preview-only changes were cleared.']);

  const running = createHarness();
  running.service.setLive(true);
  running.service.reset();
  assert.deepEqual(running.preview.calls, ['start', 'reset', 'start']);
  assert.equal(running.service.isLive(), true);
});

test('a silent reset restarts and redraws exactly the same, without the status line', () => {
  const harness = createHarness();
  harness.service.setLive(true);
  harness.service.reset({ announce: false });
  assert.deepEqual(harness.preview.calls, ['start', 'reset', 'start']);
  assert.equal(harness.shell.renders, 2);
  assert.deepEqual(harness.shell.status, ['Preview is live. Changes here are non-destructive.']);
});

test('activateState sets the state when preview is live and previews it when it is not', () => {
  const harness = createHarness();
  assert.equal(harness.service.activateState('happy'), true);
  harness.service.setLive(true);
  assert.equal(harness.service.activateState('happy'), true);
  assert.deepEqual(harness.preview.calls, ['previewState:happy', 'start', 'setState:happy']);
});

test('stopping for a project replacement drops preview mode without a word', () => {
  const harness = createHarness();
  harness.service.setLive(true);
  harness.service.stop();
  assert.equal(harness.service.isLive(), false);
  assert.deepEqual(harness.preview.calls, ['start', 'stop', 'reset']);
  assert.deepEqual(harness.shell.classes, [true, false]);
  // The replacement reports itself; a teardown that also rendered would draw
  // the panel against a document that is about to be thrown away.
  assert.equal(harness.shell.renders, 1);
  assert.deepEqual(harness.shell.status, ['Preview is live. Changes here are non-destructive.']);
});

test('bindCanvas registers both gestures on the canvas and unbinds them together', () => {
  const harness = createHarness({ reactions: [{ id: 'wave', trigger: { type: 'click' } }] });
  const listeners = new Map();
  const element = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => { if (listeners.get(type) === handler) listeners.delete(type); }
  };
  const unbind = harness.service.bindCanvas(element);
  assert.deepEqual([...listeners.keys()], ['click', 'pointerenter']);

  listeners.get('click')(canvasClick());
  assert.deepEqual(harness.preview.calls, ['trigger:click']);

  unbind();
  assert.deepEqual([...listeners.keys()], []);
});

test('bindCanvas accepts the component contract listen, so a workspace can own the gestures', () => {
  const harness = createHarness();
  const registered = [];
  const listen = (target, type, handler) => { registered.push([target, type, handler]); return () => registered.splice(registered.findIndex(entry => entry[2] === handler), 1); };
  const unbind = harness.service.bindCanvas('canvas-host', { listen });
  assert.deepEqual(registered.map(([target, type]) => [target, type]), [['canvas-host', 'click'], ['canvas-host', 'pointerenter']]);
  unbind();
  assert.deepEqual(registered, []);
});
