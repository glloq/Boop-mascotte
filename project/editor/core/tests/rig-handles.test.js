import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBoardModel, normalizeRigHandles, resolveRigHandles } from '../puppet/handle-model.js';
import { puppetDragValues, puppetOrbitValues } from '../puppet/puppet-handles.js';
import { handleIdFrom } from '../puppet/handle-commands.js';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';

/**
 * Handles an author owns (docs/DIRECT_CONTROLS.md). The store is sparse: it
 * holds what was changed, never the whole set, so a default that improves
 * later still reaches a project that was saved before it existed.
 */
const FACE = ['faceRoot', 'head', 'earLeft', 'earRight', 'shadeLeft', 'shadeRight', 'mouth', 'tongue', 'teeth',
  'eyeLeft', 'eyeRight', 'pupilLeft', 'pupilRight', 'lidUpperLeft', 'lidUpperRight', 'lidLowerLeft', 'lidLowerRight',
  'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'hairFront', 'eyebrows'];
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'path' } });
function project() {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(FACE.map((id) => [id, element()]));
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: FACE.filter((id) => id !== 'faceRoot').map((id) => ({ id, type: 'path', name: id, children: [] })) }];
  applyTemplateProject(state);
  return state;
}

test('a project that has authored nothing gets exactly the generated set', () => {
  const state = project();
  assert.deepEqual(state.rigHandles, []);
  const handles = resolveRigHandles(state);
  assert.ok(handles.length >= 15);
  assert.ok(handles.every((handle) => handle.authored === false));
  // The widget is what a control looks like *and* how it is operated: the
  // mouth moves in two directions, so the control it wants is a pad.
  assert.deepEqual(handles.find((handle) => handle.id === 'mouth').widget, { shape: 'circle', size: 'normal', colour: 'default', controller: 'pad' });
  assert.deepEqual(resolveRigHandles({}), [], 'and an empty project has none rather than throwing');
});

test('an override changes only what it names', () => {
  const state = project();
  state.rigHandles = normalizeRigHandles({ rigHandles: [{ id: 'mouth', name: 'Lips', widget: { colour: 'warm' }, axes: { y: { max: 0.7, snap: 0.1 } } }] });
  const mouth = resolveRigHandles(state).find((handle) => handle.id === 'mouth');
  assert.equal(mouth.label, 'Lips');
  assert.equal(mouth.widget.colour, 'warm');
  assert.equal(mouth.widget.shape, 'circle', 'what was not named still comes from the generated set');
  assert.equal(mouth.y.max, 0.7);
  assert.equal(mouth.y.min, 0, 'and so does the end that was not narrowed');
  assert.equal(mouth.x.control, 'smile');
});

test('a limit is a limit, a lock is a lock, and a step is a step', () => {
  const state = project();
  state.rigHandles = normalizeRigHandles({ rigHandles: [{ id: 'mouth', axes: { y: { max: 0.7, snap: 0.25 }, x: { locked: true } } }] });
  const mouth = resolveRigHandles(state).find((handle) => handle.id === 'mouth');
  // A drag that would open the mouth all the way stops where the author said.
  assert.equal(puppetDragValues(mouth, { dx: 200, dy: 400 }, { size: 40 }).mouthOpen, 0.7);
  assert.equal('smile' in puppetDragValues(mouth, { dx: 200, dy: 0 }, { size: 40 }), false, 'a locked axis is not reached at all');
  // A step lands on the step -- and the gesture covers the *limited* range, so
  // narrowing a control also makes it easier to place inside what is left.
  assert.equal(puppetDragValues(mouth, { dx: 0, dy: 12 }, { size: 40 }).mouthOpen, 0.25);
  assert.equal(puppetDragValues(mouth, { dx: 0, dy: 24 }, { size: 40 }).mouthOpen, 0.7, 'and the limit still wins over the step');
  // A limit narrows; it can never widen past what the movement itself allows.
  state.rigHandles = normalizeRigHandles({ rigHandles: [{ id: 'mouth', axes: { y: { max: 5 } } }] });
  assert.equal(resolveRigHandles(state).find((handle) => handle.id === 'mouth').y.max, 1);
});

test('an orbit honours its lock and its step too', () => {
  const state = project();
  state.rigHandles = normalizeRigHandles({ rigHandles: [{ id: 'headTilt', axes: { orbit: { snap: 0.5 } } }] });
  const tilt = resolveRigHandles(state).find((handle) => handle.id === 'headTilt');
  assert.equal(puppetOrbitValues(tilt, 40).headTilt, 0.5);
  state.rigHandles = normalizeRigHandles({ rigHandles: [{ id: 'headTilt', axes: { orbit: { locked: true } } }] });
  assert.deepEqual(puppetOrbitValues(resolveRigHandles(state).find((handle) => handle.id === 'headTilt'), 40), {});
});

test('a generated handle is hidden rather than deleted, and reset is forgetting the override', () => {
  const state = project();
  state.rigHandles = normalizeRigHandles({ rigHandles: [{ id: 'nose', hidden: true }] });
  assert.equal(resolveRigHandles(state).some((handle) => handle.id === 'nose'), false);
  // It stays on the board, because hiding one must not be the same as losing it.
  assert.deepEqual(handleBoardModel(state).hidden, [{ id: 'nose', label: 'nose' }]);
  state.rigHandles = [];
  assert.equal(resolveRigHandles(state).some((handle) => handle.id === 'nose'), true);
});

test('an authored handle carries its own artwork and movements', () => {
  const state = project();
  state.rigHandles = normalizeRigHandles({ rigHandles: [
    { id: 'tail', authored: true, name: 'Tail', elements: ['hairTop'], at: 'top', axes: { x: { parameter: 'hairSway' } } },
    { id: 'nothing', authored: true, elements: ['hairTop'], axes: { x: { parameter: 'notAParameter' } } },
    { id: 'nowhere', authored: true, elements: ['ghost'], axes: { x: { parameter: 'hairSway' } } }
  ] });
  const handles = resolveRigHandles(state);
  const tail = handles.find((handle) => handle.id === 'tail');
  assert.equal(tail.label, 'Tail');
  assert.equal(tail.x.control, 'hairSway');
  assert.equal(tail.anchor, 'hairTop');
  assert.equal(tail.authored, true);
  // A control that drives nothing, or sits on artwork that is gone, is not a
  // control: it is simply not offered.
  assert.equal(handles.some((handle) => handle.id === 'nothing' || handle.id === 'nowhere'), false);
});

test('the board lists every control, members under their group', () => {
  const state = project();
  const board = handleBoardModel(state, { mouthOpen: 0.4 });
  const eyes = board.layers.flatMap((layer) => layer.items).find((item) => item.id === 'eyes');
  assert.deepEqual(eyes.members.map((member) => member.id), ['eyeLeft', 'eyeRight']);
  const mouth = board.layers.flatMap((layer) => layer.items).find((item) => item.id === 'mouth');
  assert.equal(mouth.axes.find((axis) => axis.control === 'mouthOpen').value, 0.4, 'and says where each one is now');
  assert.equal(board.count, resolveRigHandles(state).length);
});

test('rubbish in the store is dropped rather than trusted', () => {
  assert.deepEqual(normalizeRigHandles({ rigHandles: [{}, { id: '' }, 7, null] }), []);
  assert.deepEqual(normalizeRigHandles({ rigHandles: [{ id: 'a' }, { id: 'a', name: 'twice' }] }), [{ id: 'a' }], 'first one wins');
  assert.deepEqual(normalizeRigHandles({ rigHandles: [{ id: 'a', widget: { shape: 'blob', colour: 'warm' } }] }), [{ id: 'a', widget: { colour: 'warm' } }]);
  assert.deepEqual(normalizeRigHandles({ rigHandles: [{ id: 'a', group: 'a' }] }), [{ id: 'a' }], 'nothing is its own group');
  assert.deepEqual(normalizeRigHandles({ rigHandles: [{ id: 'a', axes: { y: { snap: -3 } } }] }), [{ id: 'a' }]);
});

test('a new control gets a readable id that is not already taken', () => {
  assert.equal(handleIdFrom('Tail swing'), 'tail-swing');
  assert.equal(handleIdFrom('Tail swing', ['tail-swing']), 'tail-swing-2');
  assert.equal(handleIdFrom('  '), 'control');
});
