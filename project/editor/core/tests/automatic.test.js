import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createAutomaticCommands } from '../behaviors/automatic-commands.js';
import { AUTOMATIC_PRESETS, deriveAutomaticStatus } from '../behaviors/automatic-presets.js';
import { normalizeBehaviors } from '../../../runtime/runtime.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const project = (params = { eyeOpen: number(0, 1, 1), lookX: number(-1, 1), lookY: number(-1, 1), headY: number(-1, 1) }) => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', elements: {}, layers: [], layerMetadata: {}, params,
  states: { idle: Object.fromEntries(Object.keys(params).map((name) => [name, params[name].default])) }, activeState: 'idle', transitions: {}, semanticParts: {}, animationClips: [], behaviors: [], expressions: [], reactions: []
});

test('automatic presets map exactly onto runtime behavior types and report their status', () => {
  for (const preset of AUTOMATIC_PRESETS) for (const spec of preset.behaviors) assert.ok(['blink', 'randomIdle', 'oscillator'].includes(spec.type), `${preset.id} uses a runtime type`);
  const empty = deriveAutomaticStatus(project());
  assert.deepEqual(empty.presets.map((item) => [item.id, item.status]), [['blink', 'off'], ['natural-gaze', 'off'], ['idle-head', 'off']]);
  assert.deepEqual(empty.other, []);
  const noGaze = deriveAutomaticStatus(project({ eyeOpen: number(0, 1, 1) }));
  assert.equal(noGaze.presets[1].status, 'unavailable');
  assert.deepEqual(noGaze.presets[1].missing.map((item) => item.control), ['lookX'], 'optional lookY is not required');
  assert.equal(noGaze.presets[2].status, 'unavailable');
  const handAuthored = project();
  handAuthored.behaviors = [{ id: 'blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 6, duration: .12, closedValue: 0 }, { id: 'idle-sway', type: 'oscillator', name: 'Idle', enabled: true, parameter: 'lookY', amplitude: .05, frequency: .3, offset: 0, waveform: 'sine' }];
  const detected = deriveAutomaticStatus(handAuthored);
  assert.equal(detected.presets[0].status, 'on', 'a hand authored blink on eyeOpen is Blink');
  assert.deepEqual(detected.presets[0].behaviorIds, ['blink']);
  assert.deepEqual(detected.other.map((item) => item.id), ['idle-sway'], 'an oscillator on the gaze is advanced, not Idle head movement');
  assert.equal(detected.on, 1);
});

test('automatic commands add preset behaviors once, keep tweaks when turned off and undo', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createAutomaticCommands(store, history);
  const revisions = store.getDomainRevisions();
  assert.deepEqual(commands.enable('blink'), ['auto-blink']);
  const blink = store.getDocument().behaviors[0];
  assert.deepEqual([blink.id, blink.type, blink.parameter, blink.enabled, blink.intervalMin, blink.intervalMax, blink.duration, blink.closedValue], ['auto-blink', 'blink', 'eyeOpen', true, 2, 6, .12, 0]);
  assert.equal(store.getDomainRevisions().stateMachine, revisions.stateMachine + 1);
  assert.equal(normalizeBehaviors(store.getDocument())[0].id, 'auto-blink', 'the runtime reads it as a normal behavior');
  assert.deepEqual(commands.enable('natural-gaze'), ['auto-gaze-x', 'auto-gaze-y']);
  assert.equal(store.getDocument().behaviors.length, 3);
  assert.equal(deriveAutomaticStatus(store.getDocument()).on, 2);
  assert.deepEqual(commands.disable('natural-gaze'), ['auto-gaze-x', 'auto-gaze-y']);
  assert.equal(deriveAutomaticStatus(store.getDocument()).presets[1].status, 'disabled');
  store.execute({ type: 'behavior/update-field', domains: ['stateMachine'], source: 'behaviors', apply: (d) => { d.behaviors[1].max = .9; } });
  assert.deepEqual(commands.enable('natural-gaze'), ['auto-gaze-x', 'auto-gaze-y']);
  assert.equal(store.getDocument().behaviors.length, 3, 'turning on again re-enables instead of duplicating');
  assert.equal(store.getDocument().behaviors[1].max, .9, 'tweaks survive off / on');
  assert.equal(deriveAutomaticStatus(store.getDocument()).presets[1].status, 'on');
  assert.throws(() => commands.enable('nope'), /Unknown automatic preset/);
  assert.throws(() => commands.disable('idle-head'), /is not on/);
  const count = store.getDocument().behaviors.length;
  const limited = createEditorStore(project({ eyeOpen: number(0, 1, 1), lookX: number(-1, 1) })), limitedCommands = createAutomaticCommands(limited, createHistory(limited));
  assert.throws(() => limitedCommands.enable('idle-head'), /Turn it on in Face Setup/);
  assert.deepEqual(limitedCommands.enable('natural-gaze'), ['auto-gaze-x'], 'optional behaviors are skipped when their movement is off');
  assert.equal(deriveAutomaticStatus(limited.getDocument()).presets[1].status, 'on');
  assert.equal(store.getDocument().behaviors.length, count);
  while (history.getState().canUndo) history.undo();
  assert.deepEqual(store.getDocument().behaviors, []);
});
