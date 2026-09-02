import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createMotionCommands } from '../motion/motion-commands.js';
import { classifyClip, createMotionClip, motionSummary } from '../motion/motion-model.js';
import { MOTION_PRESETS, compileMotionTracks, motionAvailability, normalizeMotionSettings, presetById, resolveMotionControls } from '../motion/motion-presets.js';
import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { applyProjectSnapshot, createProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { createExportRig } from '../export/export-rig.js';
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, constraints: {}, bindings: { translateY: { enabled: true, mode: 'simple', expression: 'headY', curve: 'linear', amplitude: 8, offset: 0 } }, meta: { nodeType: 'path' } });
const headParams = () => ({ headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1), eyeOpen: number(0, 1, 1) });
const project = (params = headParams()) => ({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>', elements: { head: element() }, layers: [{ id: 'head', name: 'Head', type: 'path', visible: true, children: [] }], layerMetadata: {},
  params, states: { idle: Object.fromEntries(Object.keys(params).map((name) => [name, params[name].default])) }, activeState: 'idle', transitions: {}, semanticParts: {}, animationClips: [], behaviors: [], expressions: []
});
const nodTracks = { headY: [{ time: 0, value: 0, easing: 'linear' }, { time: .4, value: .5, easing: 'easeInOut' }, { time: .8, value: 0, easing: 'easeInOut' }] };
const times = (clip, name) => clip.tracks[name].map((frame) => frame.time);

test('motion presets use basic movements and compile deterministically', () => {
  const basic = new Set(BASIC_MOVEMENTS.map((item) => item.id));
  for (const preset of MOTION_PRESETS) for (const slot of preset.slots) for (const name of [slot.control, ...slot.fallbacks]) assert.ok(basic.has(name), `${preset.id} uses unknown control ${name}`);
  assert.deepEqual(MOTION_PRESETS.map((preset) => preset.id), ['nod', 'shake', 'bounce', 'tilt', 'look-around', 'eye-dart', 'head-pop']);
  const nod = presetById('nod'), params = headParams();
  assert.deepEqual(compileMotionTracks(nod, { amplitude: .5, duration: .8, repeats: 1 }, { headY: 'headY' }, params), nodTracks);
  assert.deepEqual(compileMotionTracks(nod, { amplitude: .5, duration: .8, repeats: 1 }, { headY: 'headY' }, params), compileMotionTracks(nod, { amplitude: .5, duration: .8, repeats: 1 }, { headY: 'headY' }, params), 'deterministic');
  const twice = compileMotionTracks(nod, { amplitude: .5, duration: .8, repeats: 2 }, { headY: 'headY' }, params).headY;
  assert.deepEqual(twice.map((frame) => [frame.time, frame.value]), [[0, 0], [.2, .5], [.4, 0], [.6, .5], [.8, 0]]);
  assert.equal(twice[2].easing, 'easeInOut', 'cycle boundaries keep the easing that arrives at them');
  const shake = compileMotionTracks(presetById('shake'), { amplitude: 1, duration: .8, repeats: 1 }, { headX: 'headX' }, params).headX;
  assert.deepEqual(shake.map((frame) => [frame.time, frame.value]), [[0, 0], [.2, -1], [.6, 1], [.8, 0]], 'negative shape values scale toward the parameter minimum');
  assert.deepEqual(normalizeMotionSettings(nod, { amplitude: 5, duration: 0, repeats: 3.6 }), { amplitude: 1, duration: .1, repeats: 4 });
  assert.deepEqual(normalizeMotionSettings(nod, {}), nod.defaults);

  assert.deepEqual(resolveMotionControls(nod, params).controls, { headY: 'headY' });
  assert.deepEqual(resolveMotionControls(nod, { headTilt: number(-1, 1) }).controls, { headY: 'headTilt' }, 'fallback control');
  const entry = BASIC_MOVEMENTS.find((item) => item.id === 'headY');
  assert.deepEqual(resolveMotionControls(nod, { eyeOpen: number(0, 1, 1) }), { controls: {}, missing: [{ control: 'headY', label: `${entry.group} · ${entry.label}`, part: entry.part }] });
  assert.deepEqual(resolveMotionControls(nod, {}, { headY: 'headY' }).controls, { headY: 'headY' }, 'pinned mapping stays stable');
  assert.deepEqual(motionAvailability(project()).filter((preset) => preset.usable).map((preset) => preset.id), ['nod', 'shake', 'bounce', 'tilt', 'head-pop'], 'head presets are usable with head movements only');
  const gazeless = motionAvailability(project());
  assert.deepEqual(gazeless.find((preset) => preset.id === 'look-around').missing.map((item) => item.control), ['lookX', 'lookY'], 'gaze presets need gaze movements');
  assert.equal(gazeless.find((preset) => preset.id === 'look-around').usable, false);
  const headPop = gazeless.find((preset) => preset.id === 'head-pop');
  assert.deepEqual(headPop.controls, { headY: 'headY' });
  assert.deepEqual(headPop.missing.map((item) => item.control), ['mouthOpen'], 'partial presets stay usable and list what they also need');
  assert.equal(headPop.usable, true);
  const full = { ...headParams(), lookX: number(-1, 1), lookY: number(-1, 1), mouthOpen: number(0, 1) };
  const look = compileMotionTracks(presetById('look-around'), { amplitude: .8, duration: 2, repeats: 1 }, { lookX: 'lookX', lookY: 'lookY' }, full);
  assert.deepEqual(Object.keys(look), ['lookX', 'lookY']);
  assert.deepEqual(look.lookX.map((frame) => [frame.time, frame.value]), [[0, 0], [.4, -.8], [1, -.8], [1.4, .8], [2, 0]]);
  const pop = compileMotionTracks(presetById('head-pop'), { amplitude: .7, duration: .6, repeats: 1 }, { headY: 'headY', mouthOpen: 'mouthOpen' }, full);
  assert.deepEqual(pop.mouthOpen.map((frame) => [frame.time, frame.value]), [[0, 0], [.12, .7], [.36, 0], [.6, 0]], 'a 0..1 parameter scales from its neutral toward its maximum');
  assert.deepEqual(pop.headY.map((frame) => frame.value), [0, -.7, 0, 0]);
  assert.ok(motionAvailability({ params: {} }).every((preset) => !preset.usable && preset.missing.length >= 1));
});

test('motion commands create preset clips, regenerate tracks from settings, classify Timeline edits and undo', () => {
  const store = createEditorStore(project()), history = createHistory(store), commands = createMotionCommands(store, history);
  const revisions = store.getDomainRevisions();
  assert.equal(commands.createFromPreset('nod'), 'nod');
  const clip = store.getDocument().animationClips[0];
  assert.deepEqual(clip, { id: 'nod', name: 'Nod', duration: .8, loop: false, tracks: nodTracks, motion: { preset: 'nod', amplitude: .5, repeats: 1, controls: { headY: 'headY' } } });
  assert.equal(store.getDomainRevisions().animation, revisions.animation + 1);
  assert.equal(store.getDomainRevisions().stateMachine, revisions.stateMachine, 'no state machine writes');
  assert.deepEqual(evaluateAnimationClip(clip, .4), { headY: .5 }, 'preview evaluator plays the compiled keys');
  assert.equal(classifyClip(store.getDocument(), clip), 'simple');

  commands.updateSettings('nod', { amplitude: 1, duration: 1.2, repeats: 2 });
  let current = store.getDocument().animationClips[0];
  assert.deepEqual(times(current, 'headY'), [0, .3, .6, .9, 1.2]);
  assert.equal(current.tracks.headY[1].value, 1);
  assert.deepEqual(current.motion, { preset: 'nod', amplitude: 1, repeats: 2, controls: { headY: 'headY' } });
  assert.equal(current.duration, 1.2);
  assert.equal(classifyClip(store.getDocument(), current), 'simple');

  store.execute({ type: 'animation/edit', domains: ['animation'], source: 'timeline', apply: (d) => { d.animationClips[0].tracks.headY[1].value = .2; } });
  current = store.getDocument().animationClips[0];
  assert.equal(classifyClip(store.getDocument(), current), 'edited');
  assert.equal(motionSummary(store.getDocument(), current).kind, 'edited');
  assert.throws(() => commands.updateSettings('missing', { amplitude: 1 }), /does not exist/);
  store.execute({ type: 'animation/edit', domains: ['animation'], source: 'timeline', apply: (d) => { d.animationClips[0].tracks.headY[1].value = 1; } });
  assert.equal(classifyClip(store.getDocument(), store.getDocument().animationClips[0]), 'simple', 'restoring the key restores the preset relationship');

  store.execute({ type: 'animation/create', domains: ['animation'], source: 'timeline', apply: (d) => { d.animationClips.push({ id: 'custom', name: 'Custom', duration: 1, loop: false, tracks: { headX: [{ time: 0, value: 0, easing: 'linear' }] } }); } });
  const custom = store.getDocument().animationClips[1];
  assert.equal(classifyClip(store.getDocument(), custom), 'custom');
  assert.deepEqual(motionSummary(store.getDocument(), custom), { id: 'custom', name: 'Custom', kind: 'custom', preset: null, presetName: null, amplitude: null, repeats: null, duration: 1, loop: false, controls: ['headX'], tracks: 1, keys: 1 });
  assert.throws(() => commands.updateSettings('custom', { amplitude: 1 }), /not a preset motion/);

  assert.throws(() => commands.createFromPreset('nope'), /Unknown motion preset/);
  const count = store.getDocument().animationClips.length;
  assert.throws(() => createMotionClip(project({ eyeOpen: number(0, 1, 1) }), 'nod'), /Turn it on in Face Setup/);
  assert.throws(() => commands.rename('nod', '  '), /Give the motion a name/);
  assert.equal(store.getDocument().animationClips.length, count, 'failed commands change nothing');

  commands.rename('nod', 'Slow nod');
  commands.setLoop('nod', true);
  assert.equal(commands.duplicate('nod'), 'nod-copy');
  const copy = store.getDocument().animationClips.find((item) => item.id === 'nod-copy');
  assert.equal(copy.name, 'Slow nod Copy');
  assert.equal(classifyClip(store.getDocument(), copy), 'simple', 'duplicates keep their preset settings');
  assert.equal(commands.createFromPreset('nod', { name: 'Quick nod', duration: .3 }), 'nod-2');
  assert.equal(store.getDocument().animationClips.at(-1).duration, .3);
  commands.remove('nod-copy');
  assert.deepEqual(store.getDocument().animationClips.map((item) => item.id), ['nod', 'custom', 'nod-2']);
  history.undo();
  assert.deepEqual(store.getDocument().animationClips.map((item) => item.id), ['nod', 'custom', 'nod-copy', 'nod-2']);
  store.execute({ type: 'animation/edit', domains: ['animation'], source: 'timeline', apply: (d) => { d.animationClips[0].tracks.headY[1].value = .25; } });
  assert.equal(classifyClip(store.getDocument(), store.getDocument().animationClips[0]), 'edited');
  commands.reset('nod');
  assert.equal(classifyClip(store.getDocument(), store.getDocument().animationClips[0]), 'simple', 'reset rebuilds the tracks from the stored settings');
  assert.equal(store.getDocument().animationClips[0].tracks.headY[1].value, 1);
  assert.equal(commands.detach('nod'), 'nod');
  assert.equal(store.getDocument().animationClips[0].motion, undefined);
  assert.equal(classifyClip(store.getDocument(), store.getDocument().animationClips[0]), 'custom');
  assert.throws(() => commands.detach('nod'), /already a custom animation/);
  assert.throws(() => commands.reset('custom'), /not a preset motion/);
  history.undo();
  assert.deepEqual(store.getDocument().animationClips[0].motion, { preset: 'nod', amplitude: 1, repeats: 2, controls: { headY: 'headY' } }, 'undo restores the preset relationship');
  while (history.getState().canUndo) history.undo();
  assert.deepEqual(store.getDocument().animationClips, []);
});

test('simple motions round-trip through snapshots and export as plain animations', () => {
  const state = { ...createCleanProjectState(), ...project() };
  createMotionClip(state, 'nod', { amplitude: .8 });
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  assert.deepEqual(snapshot.document.editor.animationClips[0].motion, { preset: 'nod', amplitude: .8, repeats: 1, controls: { headY: 'headY' } });
  const restored = createCleanProjectState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.animationClips, state.animationClips);
  assert.equal(classifyClip(restored, restored.animationClips[0]), 'simple');
  const rig = createExportRig(state);
  assert.equal(rig.animationClips, undefined);
  assert.deepEqual(rig.animations, [{ id: 'nod', name: 'Nod', duration: .8, loop: false, tracks: state.animationClips[0].tracks }], 'exported clips carry no editor metadata');
});
