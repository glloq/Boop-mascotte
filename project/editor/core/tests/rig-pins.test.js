import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIN_FALLOFF_PRESETS, RIG_PIN_TYPES, applyPins, compilePinTarget, compileRigFrame,
  constrainPinOffset, normalizeRigPin, normalizeRigPins, pinDisplacement, pinFalloff,
  pinInfluence, pinMotion, pinOffsets, pinWeightAt
} from '../../../runtime/runtime.js';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createPinCommands } from '../rig/pin-commands.js';
import { PIN_SOFTNESS_PRESETS, pinOverlay, rigPinModel } from '../rig/pin-model.js';
import { HEAD_SURFACE_PINS, generateSurfacePins, hasSurfacePins, surfacePinResidual, withoutSurfacePins } from '../rig/surface-pins.js';
import { createProjectDocument } from '../state/project-document.js';
import { createExportRig } from '../export/export-rig.js';
import { normalizeRig } from '../rig/normalize-rig.js';

/**
 * Pins (docs/FACE_CONTROL_RIG.md, CR-20 … CR-24).
 *
 * Everything the rig could do to a shape moved all of it. A pin is the first
 * thing that can say "this corner of the mouth, and the artwork near it" —
 * which is the sentence a facial rig is made of.
 */

// A square, so the distance from a pin to each corner is arithmetic anybody
// can check by hand rather than a number that came out of the code.
const SQUARE = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
const pinAt = (id, x, y, options = {}) => normalizeRigPin({ id, target: 'shape', position: { x, y }, radius: 60, ...options });

test('a reach may be an ellipse, because a face is wider than it is tall', () => {
  const flat = pinAt('lip', 0, 0, { radius: { x: 100, y: 10 }, falloff: 'linear' });
  assert.deepEqual(flat.radius, { x: 100, y: 10 });
  // Fifty units sideways is halfway across its reach; five units up is halfway
  // up it. The distance is measured in units of the pin's own ellipse.
  assert.equal(pinWeightAt(flat, 50, 0), 0.5);
  assert.equal(pinWeightAt(flat, 0, 5), 0.5);
  assert.equal(pinWeightAt(flat, 0, 20), 0, 'and past it, nothing');
  // A number is still a circle, so every pin written before this reads the same.
  const round = pinAt('circle', 0, 0, { radius: 50, falloff: 'linear' });
  assert.deepEqual(round.radius, { x: 50, y: 50 });
  assert.equal(pinWeightAt(round, 25, 0), pinWeightAt(round, 0, 25));
});

test('a pin holds the artwork inside its reach and nothing outside it (CR-21)', () => {
  const pin = pinAt('corner', 0, 0, { radius: 50, falloff: 'linear' });
  const target = compilePinTarget(SQUARE, [pin]);
  // Distance 0 is the whole movement, the rim is none of it, halfway is half.
  assert.equal(pinFalloff(0, 50, 'linear'), 1);
  assert.equal(pinFalloff(50, 50, 'linear'), 0);
  assert.equal(pinFalloff(25, 50, 'linear'), 0.5);
  assert.equal(pinFalloff(80, 50, 'linear'), 0, 'a pin with a reach stops reaching');

  const influence = pinInfluence(target, [pin]);
  assert.equal(influence[0].reach, 1, 'only the corner it sits on: the others are 100 units away and the reach is 50');

  // The point it sits on moves the whole way; the opposite corner not at all.
  const path = applyPins(target, [{ x: 10, y: 0 }]);
  assert.match(path, /^M10 0/, 'the corner it holds follows it exactly');
  assert.match(path, /100 100/, 'and the far corner is where it was drawn');
});

test('a softness preset is a curve, not a number nobody can picture (CR-22)', () => {
  // Firmer holds more of its reach; softer spreads the movement further out.
  const at = (falloff) => pinFalloff(25, 50, falloff);
  assert.ok(at('rigid') < at('firm'));
  assert.ok(at('firm') < at('linear'));
  assert.ok(at('linear') < at('soft'));
  assert.ok(at('soft') < at('verySoft'));
  // Smoothstep is the one that creases at neither end: flat at the pin and
  // flat at the rim, which is why it is the default.
  assert.ok(pinFalloff(1, 50, 'smooth') > 0.99);
  assert.ok(pinFalloff(49, 50, 'smooth') < 0.01);
  assert.deepEqual(PIN_SOFTNESS_PRESETS.map((preset) => preset.id), ['rigid', 'firm', 'smooth', 'soft', 'verySoft']);
  for (const preset of PIN_SOFTNESS_PRESETS) if (preset.id !== 'smooth') assert.ok(PIN_FALLOFF_PRESETS[preset.id] > 0, preset.id);
});

test('overlapping pins share a point rather than moving it twice (CR-22)', () => {
  const pins = [pinAt('a', 0, 0, { radius: 400, falloff: 'linear' }), pinAt('b', 100, 0, { radius: 400, falloff: 'linear' })];
  const target = compilePinTarget(SQUARE, pins);
  // Both pins reach the whole square, so every point's weights add to exactly
  // one: pulling both by the same amount moves the shape by that amount, not
  // by twice it.
  for (let index = 0; index < target.weights[0].length; index += 1) {
    const total = target.weights[0][index] + target.weights[1][index];
    assert.ok(Math.abs(total - 1) < 1e-9, `weights at ${index} add to ${total}`);
  }
  const path = applyPins(target, [{ x: 10, y: 0 }, { x: 10, y: 0 }]);
  assert.match(path, /^M10 0/);
  assert.match(path, /110 0/, 'the far corner moved by ten, not by twenty');

  // Below one they are left alone: a point outside every reach stays exactly
  // where it was drawn, which is what makes this a face rig and not a skin.
  const sparse = compilePinTarget(SQUARE, [pinAt('a', 0, 0, { radius: 10 })]);
  assert.equal(sparse.weights[0][2], 0, 'the far corner follows nothing');
});

test('a hard pin holds rigidly, a directional one holds one axis, a slide re-aims (CR-23)', () => {
  // Hard: everything inside the radius moves as one piece, with no fade.
  const hard = compilePinTarget(SQUARE, [pinAt('hinge', 0, 0, { type: 'hard', radius: 150 })]);
  for (const weight of hard.weights[0]) assert.equal(weight, 1);

  // Directional: only the part of the movement along its own axis survives, so
  // a brow told to go up and sideways goes up.
  const up = normalizeRigPin({ id: 'brow', target: 'brow', type: 'directional', direction: { x: 0, y: -1 } });
  assert.deepEqual(constrainPinOffset(up, { x: 8, y: -6 }), { x: 0, y: -6 });
  assert.deepEqual(constrainPinOffset(up, { x: 8, y: 0 }), { x: 0, y: 0 }, 'sideways alone moves it nowhere');

  // Slide: the whole movement, re-aimed along the axis — a mouth corner
  // dragged outwards rides the lip line instead of leaving it.
  const along = normalizeRigPin({ id: 'corner', target: 'mouth', type: 'slide', direction: { x: 1, y: 0 } });
  const slid = constrainPinOffset(along, { x: 3, y: 4 });
  assert.equal(slid.y, 0);
  assert.equal(slid.x, 5, 'it keeps its magnitude and loses its direction');
  assert.equal(constrainPinOffset(along, { x: -3, y: 4 }).x, -5, 'and it knows which way it was going');

  // A direction is normalized on the way in, so nothing downstream has to.
  assert.deepEqual(normalizeRigPin({ id: 'p', target: 't', direction: { x: 0, y: 5 } }).direction, { x: 0, y: 1 });
  assert.deepEqual(normalizeRigPin({ id: 'p', target: 't', direction: { x: 0, y: 0 } }).direction, { x: 0, y: 1 }, 'and nothing is a direction of its own');
});

test('a pin is moved by the parameters everything else is', () => {
  const pin = normalizeRigPin({ id: 'corner', target: 'mouth', position: { x: 0, y: 0 }, motion: { y: { expression: 'smile', amplitude: -8 } } });
  const evaluate = (motion, values) => Number(values[motion.expression] || 0) * motion.amplitude + motion.offset;
  assert.deepEqual(pinOffsets([pin], { smile: 1 }, evaluate), [{ x: 0, y: -8 }]);
  assert.deepEqual(pinOffsets([pin], { smile: 0 }, evaluate), [{ x: 0, y: 0 }]);
  // Nothing moved is nothing done: no allocation, no path work.
  const target = compilePinTarget(SQUARE, [pin]);
  assert.equal(pinDisplacement(target, [{ x: 0, y: 0 }]), null);
});

test('a pin deforms a path inside the frame, beside the shape keys and the warp', () => {
  const elements = {
    mouth: {
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
      baseOpacity: 1, restPath: SQUARE, bindings: {}, constraints: { translate: true, rotate: true, scale: true }
    }
  };
  const rigPins = [{ id: 'corner', target: 'mouth', position: { x: 0, y: 0 }, radius: 40, falloff: 'linear', motion: { y: { expression: 'smile', amplitude: -10 } } }];
  const rest = compileRigFrame(elements, { smile: 0 }, {}, {}, { rigPins });
  assert.equal(rest.mouth.path, SQUARE, 'at rest the shape is the shape that was drawn');
  const smiling = compileRigFrame(elements, { smile: 1 }, {}, {}, { rigPins });
  assert.match(smiling.mouth.path, /^M0 -10/, 'the corner it holds has come up');
  assert.match(smiling.mouth.path, /100 100/, 'and the far corner has not');
  // And it keeps moving: a pin that only worked on the first frame would be a
  // pin that does nothing, which is the failure this whole layer exists to end.
  const half = compileRigFrame(elements, { smile: 0.5 }, {}, {}, { rigPins });
  assert.match(half.mouth.path, /^M0 -5/);
  assert.match(compileRigFrame(elements, { smile: 1 }, {}, {}, { rigPins }).mouth.path, /^M0 -10/);
});

test('the silhouette turns with the head instead of sliding (CR-24, CR-50)', () => {
  const box = { x: 20, y: 20, width: 200, height: 200 };
  const pins = normalizeRigPins({ rigPins: generateSurfacePins({ target: 'head', box, unit: 28 }) });
  assert.equal(pins.length, HEAD_SURFACE_PINS.length);
  const read = (id, headX, headY = 0) => pinMotion(pins.find((pin) => pin.id === id), { headX, headY }, () => 0);

  // Straight ahead, nothing: the drawn head is the drawn head.
  for (const pin of pins) assert.deepEqual(pinMotion(pin, { headX: 0, headY: 0 }, () => 0), { x: 0, y: 0 }, pin.id);

  // Turning right, the two cheeks do opposite things — which is the whole
  // point. A silhouette where both sides shifted the same way is a card.
  const near = read('head-cheek-left', 1), far = read('head-cheek-right', 1);
  assert.ok(near.x > 0 && far.x < 0, `near ${near.x}, far ${far.x}`);
  assert.ok(Math.abs(near.x) > Math.abs(far.x), 'and the near one travels further');
  // A temple sits near the axis and barely moves; a chin stands out and swings.
  assert.ok(Math.abs(read('head-temple-left', 1).x) < Math.abs(read('head-cheek-left', 1).x));
  assert.ok(Math.abs(read('head-chin', 1).x) > 1);
  // Mirrored: turning the other way is the same face the other way round.
  assert.ok(Math.abs(read('head-cheek-left', -1).x + read('head-cheek-right', 1).x) < 0.01);

  // The residual is the movement *beyond* what the head element already does,
  // so nothing is applied twice.
  const centre = { x: 120, y: 120 };
  assert.deepEqual(surfacePinResidual(centre, { box, depth: 0.18, headX: 1, headY: 0, unit: 28 }), { x: 0, y: 0 },
    'a point at the outline’s own depth, in the middle, has nothing left to do');

  const document = { rigPins: pins };
  assert.equal(hasSurfacePins(document), true);
  assert.deepEqual(withoutSurfacePins(document), []);
  assert.equal(hasSurfacePins({ rigPins: [pinAt('mine', 0, 0)] }), false, 'a pin an author placed is not the silhouette');
});

test('placing a pin is one command and one undo step', () => {
  const state = createCleanProjectState();
  state.elements = { mouth: { baseTransform: {}, restPath: SQUARE }, plain: { baseTransform: {} } };
  const store = createEditorStore(state);
  const commands = createPinCommands(store, createHistory(store));

  const created = commands.create('mouth', { x: 10, y: 20 }, { name: 'left corner', radius: 30 });
  assert.equal(created.ok, true);
  assert.equal(store.getDocument().rigPins.length, 1);
  assert.equal(store.getDocument().rigPins[0].id, 'mouth-left-corner');
  assert.deepEqual(store.getDocument().rigPins[0].position, { x: 10, y: 20 });

  assert.equal(commands.move(created.id, { x: 12, y: 22 }).ok, true);
  assert.deepEqual(store.getDocument().rigPins[0].position, { x: 12, y: 22 });
  assert.equal(commands.configure(created.id, { type: 'slide', falloff: 'firm', radius: 44 }).ok, true);
  assert.equal(store.getDocument().rigPins[0].type, 'slide');
  // A reach is an ellipse, and a number is the circle it describes: a mouth
  // is ten times wider than it is tall, and a circular reach cannot hold a
  // corner without also holding the upper lip.
  assert.deepEqual(store.getDocument().rigPins[0].radius, { x: 44, y: 44 });


  // A pin holds a drawn path, and saying so is the difference between a pin
  // that does nothing and a message that says why.
  const refused = commands.create('plain', { x: 0, y: 0 });
  assert.equal(refused.ok, false);
  assert.match(refused.message, /drawn path/);
  assert.equal(commands.create('nothing', { x: 0, y: 0 }).ok, false);

  const overlay = pinOverlay(store.getDocument(), 'mouth');
  assert.equal(overlay.pins.length, 1);
  assert.ok(overlay.pins[0].reach >= 1, 'and the overlay says what it is actually holding');

  // One axis at a time, and the other one survives. The panel offers two
  // numbers because a pin's reach *has* two: writing a single one as a circle
  // would flatten the shallow reach the mouth's corners and the brows' ends
  // are built on, and the author would only find out on the canvas.
  assert.equal(commands.configure(created.id, { radiusY: 6 }).ok, true);
  assert.deepEqual(store.getDocument().rigPins[0].radius, { x: 44, y: 6 });
  assert.equal(commands.configure(created.id, { radiusX: 60 }).ok, true);
  assert.deepEqual(store.getDocument().rigPins[0].radius, { x: 60, y: 6 }, 'the shallow reach survived');
  // Changing something else does not quietly round the ellipse off either.
  assert.equal(commands.configure(created.id, { falloff: 'soft' }).ok, true);
  assert.deepEqual(store.getDocument().rigPins[0].radius, { x: 60, y: 6 });
  assert.deepEqual(rigPinModel(store.getDocument()).map((group) => group.target), ['mouth']);

  assert.equal(commands.remove(created.id).ok, true);
  assert.deepEqual(store.getDocument().rigPins, []);
});

test('a project that has no pins says so, and one that has them keeps them (CR-52)', () => {
  assert.deepEqual(createProjectDocument({}).rigPins, []);
  assert.deepEqual(normalizeRig({ params: {}, states: {}, elements: {} }).rigPins, []);
  const pins = [{ id: 'corner', target: 'mouth', position: { x: 1, y: 2 }, radius: 12, type: 'slide', direction: { x: 1, y: 0 } }];
  const exported = createExportRig({ params: {}, states: {}, elements: {}, rigPins: pins });
  assert.equal(exported.rigPins.length, 1);
  assert.equal(exported.rigPins[0].type, 'slide');
  assert.deepEqual(normalizeRig(exported).rigPins[0].position, { x: 1, y: 2 });
  // Rubbish never becomes a pin.
  assert.deepEqual(normalizeRigPins({ rigPins: [null, { id: 'a' }, { target: 'b' }, { id: 'c', target: 'd' }, { id: 'c', target: 'e' }] }).map((pin) => pin.id), ['c']);
  for (const type of RIG_PIN_TYPES) assert.equal(normalizeRigPin({ id: 'p', target: 't', type }).type, type);
  assert.equal(normalizeRigPin({ id: 'p', target: 't', type: 'magnet' }).type, 'soft');
});
