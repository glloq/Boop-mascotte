import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createMotionCommands } from '../motion/motion-commands.js';
import { classifyClip, createMotionClip, motionSummary } from '../motion/motion-model.js';
import { MOTION_PRESETS, MOTION_PRESET_GROUPS, compileMotionTracks, motionAvailability, motionAvailabilityGroups, normalizeMotionSettings, presetById, resolveMotionControls } from '../motion/motion-presets.js';
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
  // The catalogue is deliberately large: the original seven are still in it,
  // ids stay unique, and every preset sits in a declared group.
  const ids = MOTION_PRESETS.map((preset) => preset.id);
  for (const id of ['nod', 'shake', 'bounce', 'tilt', 'look-around', 'eye-dart', 'head-pop']) assert.ok(ids.includes(id), `${id} is missing from the catalogue`);
  assert.equal(new Set(ids).size, ids.length, 'preset ids are unique');
  assert.ok(ids.length >= 18, `only ${ids.length} presets`);
  assert.deepEqual(MOTION_PRESETS.filter((preset) => !MOTION_PRESET_GROUPS.includes(preset.group)), []);
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
  assert.deepEqual(motionAvailability(project()).filter((preset) => preset.usable).map((preset) => preset.id),
    ['nod', 'shake', 'bounce', 'tilt', 'head-pop', 'head-roll', 'double-take', 'wobble', 'peek', 'shiver', 'blink', 'gasp', 'yawn', 'laugh', 'sigh'],
    'a head-and-eyelids project gets every preset that can run on one of its movements');
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
  assert.deepEqual(motionSummary(store.getDocument(), custom), { id: 'custom', name: 'Custom', kind: 'custom', preset: null, presetName: null, amplitude: null, repeats: null, duration: 1, loop: false, blend: 'override', controls: ['headX'], tracks: 1, keys: 1 });
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

test('motions are offered group by group, in catalogue order', () => {
  const groups = motionAvailabilityGroups(project());
  assert.deepEqual(groups.map((entry) => entry.group), [...MOTION_PRESET_GROUPS]);
  assert.equal(groups.flatMap((entry) => entry.presets).length, MOTION_PRESETS.length, 'every preset lands in exactly one group');
  assert.equal(groups[0].group, 'Head', 'the group that opens first is the one a head-only project can use');
  assert.deepEqual(groups.find((entry) => entry.group === 'Eyes').presets.filter((item) => item.usable).map((item) => item.id), ['blink'], 'gaze motions need gaze movements');
});

/* ── Make your own (VNX-27) ──────────────────────────────────────────────── */

test('any movement the project has can be given a shape, with no timeline at all', async () => {
  const { MOTION_SHAPES, composableMovements, composedMotion, composedMotionId, resolveMotionPreset, shapeById } = await import('../motion/motion-presets.js');
  // A mascot whose ears wiggle. The ready-made catalogue is head, eyes and
  // face, so there is nothing in it for this movement at all.
  const state = project({ ...headParams(), earWiggle: number(-1, 1) });
  assert.equal(motionAvailability(state).some((preset) => Object.values(preset.controls).includes('earWiggle')), false,
    'no ready-made motion drives an ear, which is the gap this closes');

  const id = composedMotionId('dip', 'earWiggle');
  assert.equal(id, 'shape:dip:earWiggle', 'one string, so a clip stores it in the field it already had');
  assert.equal(presetById(id), null, 'it is not in the catalogue');
  assert.equal(resolveMotionPreset(id).id, id, 'and everything downstream still resolves it');

  const clip = createMotionClip(state, id);
  assert.equal(classifyClip(state, clip), 'simple', 'a composed motion is an ordinary preset motion');
  assert.deepEqual(Object.keys(clip.tracks), ['earWiggle']);
  assert.equal(clip.motion.preset, id);
  assert.deepEqual(clip.tracks.earWiggle.map((frame) => frame.time), [0, .4, .8], 'the shape, tiled over the duration');
  assert.equal(clip.tracks.earWiggle[1].value, .5, 'and scaled by amplitude within the movement’s own range');

  // The Inspector settings work on it exactly as on a catalogue preset.
  const summary = motionSummary(state, clip);
  assert.equal(summary.kind, 'simple');
  assert.match(summary.presetName, /dip/i);
  assert.deepEqual(summary.controls, ['earWiggle']);
});

test('a shape is picked by name and never quietly swapped for another movement', async () => {
  const { composedMotion, composedMotionId, resolveMotionPreset, MOTION_SHAPES } = await import('../motion/motion-presets.js');
  const state = project();
  // Every shape compiles, on every movement, without the caller checking first.
  for (const form of MOTION_SHAPES) {
    const preset = composedMotion(composedMotionId(form.id, 'headX'));
    assert.equal(preset.slots.length, 1);
    assert.deepEqual(preset.slots[0].fallbacks, [], 'the author named this movement; animating a different one would be a lie');
    assert.ok(preset.slots[0].shape.length >= 3, `${form.id} has a shape`);
    assert.equal(preset.slots[0].shape[0].t, 0, 'and starts at rest');
    assert.equal(preset.slots[0].shape.at(-1).t, 1, 'and ends there');
    assert.equal(preset.slots[0].shape.at(-1).v, 0);
  }
  // A movement the project does not have is refused, rather than silently
  // producing an empty clip.
  assert.throws(() => createMotionClip(state, composedMotionId('dip', 'tailSwish')), /needs a movement that is off/);
  // Nonsense resolves to nothing, and `createMotionClip` says so.
  assert.equal(resolveMotionPreset('shape:nope:headX'), null);
  assert.equal(resolveMotionPreset('shape:dip'), null);
  assert.throws(() => createMotionClip(state, 'shape:nope:headX'), /Unknown motion preset/);
});

test('the movements offered are the project’s own, named the way the rest of the editor names them', async () => {
  const { composableMovements } = await import('../motion/motion-presets.js');
  const groups = composableMovements(project({ ...headParams(), handLGrip: number(0, 1), handRThumbsUp: number(0, 1) }));
  const flat = Object.fromEntries(groups.flatMap((entry) => entry.movements.map((item) => [item.id, `${entry.group} · ${item.label}`])));
  assert.equal(flat.headX, 'Head · Move left / right');
  // The reason this item exists: a hand's controls are generated, so no fixed
  // table could ever have listed them (VNX-34).
  assert.equal(flat.handLGrip, 'Left hand · Close the hand');
  assert.equal(flat.handRThumbsUp, 'Right hand · Thumbs up');
  assert.deepEqual(composableMovements({}), [], 'a project with no movements offers none');
});

test('a composed motion survives a save and reopen like any other', async () => {
  const { composedMotionId } = await import('../motion/motion-presets.js');
  const state = { ...createCleanProjectState(), ...project({ ...headParams(), earWiggle: number(-1, 1) }) };
  createMotionClip(state, composedMotionId('settle', 'earWiggle'));
  const restored = {};
  applyProjectSnapshot(restored, createProjectSnapshot(state, () => state.svgMarkup));
  const reopened = restored.animationClips.find((clip) => clip.motion?.preset === 'shape:settle:earWiggle');
  assert.ok(reopened, 'the clip came back with the shape it was made from');
  assert.equal(classifyClip({ ...state, animationClips: restored.animationClips }, reopened), 'simple',
    'and still recompiles to itself, so Amplitude still drives it after a reopen');
});

/* ── How a motion meets another that is already playing (VNX-31) ─────────── */

test('a motion can add to what is playing instead of replacing it', async () => {
  const { setClipBlend } = await import('../motion/motion-model.js');
  const { createMotionLayer, mixParameters, normalizeAnimations } = await import('../../../runtime/runtime.js');
  const state = project();
  // Two motions on the *same* movement -- both of these drive `headY` -- which
  // is the only case where how they meet can be seen at all.
  const nod = createMotionClip(state, 'nod');
  const tilt = createMotionClip(state, 'bounce');
  assert.equal(motionSummary(state, nod).blend, 'override', 'which is what every clip did, and still does');

  const rig = { animations: state.animationClips.map((clip) => ({ ...clip })) };
  const both = (clips) => {
    const layer = createMotionLayer({ blend: { duration: 0 }, clips });
    // `layer: true` is what an arrangement does when two clips overlap; without
    // it the second play cross-fades the first away and there is nothing to mix.
    layer.play(nod.id, 0); layer.play(tilt.id, 0, { layer: true });
    layer.advance(1000);
    return layer.layers(0.4, {});
  };

  // Override: the one started last wins outright on a movement they share.
  const over = both(normalizeAnimations(rig));
  assert.deepEqual(over.map((entry) => entry.mode), ['weightedOverride', 'weightedOverride']);

  // Additive: it contributes its distance from the movement's own neutral, so
  // the two sum rather than the later one winning.
  setClipBlend(state, tilt.id, 'additive');
  const layered = normalizeAnimations({ animations: state.animationClips.map((clip) => ({ ...clip })) });
  assert.deepEqual(both(layered).map((entry) => entry.mode), ['weightedOverride', 'additive']);

  const mixed = (list) => mixParameters({ headY: 0 }, both(list), state.params);
  assert.notDeepEqual(mixed(layered), mixed(normalizeAnimations(rig)), 'and the frame it produces is a different frame');

  // Back to the default deletes the field rather than storing it, so a project
  // that never touches this exports the file it exported before.
  setClipBlend(state, tilt.id, 'override');
  assert.equal('blend' in state.animationClips.find((clip) => clip.id === tilt.id), false);
  assert.equal(normalizeAnimations({ animations: [{ id: 'a', duration: 1, tracks: {} }] })[0].blend, undefined);
  assert.equal(normalizeAnimations({ animations: [{ id: 'a', duration: 1, blend: 'nonsense', tracks: {} }] })[0].blend, undefined);
  assert.equal(normalizeAnimations({ animations: [{ id: 'a', duration: 1, blend: 'additive', tracks: {} }] })[0].blend, 'additive');
});
