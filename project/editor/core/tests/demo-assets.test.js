import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ASSET_NAMES, createDemoAssets } from '../../../../scripts/demo-assets.mjs';
import { createTemplateExport, createTemplateProjectState, parseTemplateArtwork } from '../sample/templates/template-export.js';
import { MASCOT_FACE_SVG } from '../sample/templates/mascot-artwork.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';
import { EXPRESSION_PRESETS } from '../expressions/expression-presets.js';
import { VISEME_KEYS, visemeExpressionId } from '../face-library/face-states.js';
import { motionAvailability, MOTION_PRESETS } from '../motion/motion-presets.js';
import { REACTION_PRESETS } from '../reactions/reaction-presets.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { validateRig } from '../validation/rig-validator.js';

/**
 * The runtime demo ships what Export writes for the untouched Mascot Face, and
 * it is built without a canvas (docs/FULL_AUDIT_2026-09.md). The reference
 * numbers below were read off the editor's own download of the same template
 * in Chromium; the Node build matched it byte for byte.
 */

test('the template artwork parses into the records the canvas would build', () => {
  const { elements, layers } = parseTemplateArtwork(MASCOT_FACE_SVG);
  // A hundred and thirty-four: four more than before, which is the two eyelid
  // creases each eye grew when the lids stopped carrying an outline of their own
  // (docs/EYE_BUILDS.md).
  assert.equal(Object.keys(elements).length, 134, 'every layer the artwork draws — the face and the pair of hands — and nothing under <defs>');
  assert.equal(elements.eyeSocketLeft, undefined, 'and the eye sockets are gone: a lid that grows about its rim needs no mask');
  assert.equal(elements.headShape, undefined, 'a clip path is not a layer');
  for (const id of ['creaseUpperLeft', 'creaseLowerLeft', 'creaseUpperRight', 'creaseLowerRight']) {
    assert.equal(elements[id].meta.nodeType, 'path', `${id} is a path, so a shape key can bend it`);
  }
  assert.equal(elements.head.meta.nodeType, 'path');
  assert.equal(elements.eyeLeft.meta.nodeType, 'g');
  assert.equal(elements.pupilLeft.meta.nodeType, 'circle');
  assert.equal(elements.earLeftShape.meta.nodeType, 'ellipse');
  assert.equal(elements.earLeftEdge.meta.nodeType, 'path', 'the ear outline is its own shape: only the outer half is drawn');
  assert.deepEqual([elements.head.baseOpacity, elements.shadeLeft.baseOpacity, elements.glintLeft.baseOpacity, elements.earLeftFold.baseOpacity], [1, .22, .92, .55], 'the opacity attribute is the base opacity');
  assert.deepEqual(elements.head.baseTransform, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 });
  assert.deepEqual(elements.head.bindings, {});
  // The pair of hands is painted before the face, which is what puts it behind
  // the head it hides behind (docs/HAND_RIGGING.md, "Behind the head").
  assert.deepEqual(layers.map((layer) => layer.id), ['handLeft', 'handRight', 'faceRoot']);
  // A hand is the eight drawings of the library (docs/HAND_STYLES.md), and a
  // drawing is a **group of named layers** — a palm, the fingers, a thumb — so
  // an author can open one and edit a finger (docs/HAND_STYLES.md, "A gesture
  // is a file"). The hand itself still swaps whole drawings by one opacity.
  assert.deepEqual(layers[0].children.map((layer) => layer.id),
    ['relaxed', 'open', 'fist', 'point', 'thumbsUp', 'peace', 'ok', 'sideFist'].map((style) => `handLeftStyle-${style}`));
  assert.deepEqual(layers[0].children.map((layer) => layer.type), Array(8).fill('g'));
  assert.deepEqual(layers[0].children.map((layer) => layer.children.length), [5, 5, 5, 5, 3, 5, 4, 3]);
  // Every layer inside a drawing is named for the part it is, and named under
  // the drawing that owns it, so the layer tree reads and two drawings never
  // collide over a palm.
  assert.deepEqual(layers[0].children[0].children.map((layer) => layer.id),
    ['index', 'middle', 'ring', 'thumb', 'palm'].map((part) => `handLeftStyle-relaxed-${part}`));
  assert.deepEqual(layers[0].children[0].children.map((layer) => layer.name), ['Index', 'Middle', 'Ring', 'Thumb', 'Palm']);
  assert.deepEqual(layers[0].children[0].children.map((layer) => layer.children.length), [0, 0, 0, 0, 0]);
  const face = layers[2];
  assert.equal(face.name, 'Face');
  assert.deepEqual(face.children.find((layer) => layer.id === 'eyeLeft').children.map((layer) => layer.id),
    ['eyeWhiteLeft', 'pupilLeft', 'glintLeft', 'sparkLeft', 'lidUpperLeft', 'creaseUpperLeft', 'lidLowerLeft', 'creaseLowerLeft', 'rimLeft'],
    'the eye keeps its nesting, which the head turn reads, and each lid is followed by the crease that draws its edge');
  assert.equal(face.children.find((layer) => layer.id === 'earLeft').name, 'Left ear');
  // The shading is a folder of its own, clipped to the head: three soft shapes
  // an author can turn off together, rather than three loose ones between the
  // face and its features.
  assert.deepEqual(face.children.find((layer) => layer.id === 'faceShading').children.map((layer) => layer.id),
    ['shadeLeft', 'shadeRight', 'faceLight', 'shadeHair']);
  assert.throws(() => parseTemplateArtwork('<svg><path d="M0 0"/></svg>'), /no id/, 'the parser is for the template, which names everything');
});

test('the template export is the rig the editor writes for the untouched face', () => {
  const { svg, rig } = createTemplateExport();
  assert.equal(svg, MASCOT_FACE_SVG);
  assert.equal(rig.schemaVersion, RIG_SCHEMA_VERSION);
  assert.equal(Object.keys(rig.elements).length, 134);
  for (const id of Object.keys(rig.elements)) assert.match(svg, new RegExp(`id="${id}"`), `${id} is drawn`);
  assert.deepEqual(Object.keys(rig.states), ['idle', 'happy', 'surprised']);
  assert.equal(rig.activeState, 'idle');
  assert.deepEqual(rig.transitions, { idle: ['happy', 'surprised'], happy: ['idle'], surprised: ['idle'] });
  // The template ships the catalogues instead of a hand-written short list
  // (`buildStarterKit(state, FULL_KIT)`): every motion, face and reaction the
  // presets can build on this rig, under the presets' own ids -- so a clip that
  // arrives with the template and one an author adds by pressing its card are
  // the same clip, resettable and detachable alike.
  // The pair of hands brings its own two clips and its own "hands out" face;
  // everything after them is the catalogue, in catalogue order.
  // Every motion the catalogue offers, with none left out: the two that **are**
  // a hand -- *Point* and *Thumbs up* -- reach a drawing the pair ships with
  // (docs/HAND_STYLES.md).
  assert.deepEqual(rig.animations.map((clip) => clip.id),
    ['hand-wave', 'hands-up', ...MOTION_PRESETS.map((preset) => preset.id)]);
  for (const id of ['point-at', 'approve']) {
    const preset = motionAvailability(createTemplateProjectState()).find((item) => item.id === id);
    assert.equal(preset.usable, true, id);
  }
  // The faces, then the speech shapes. A viseme is an expression record like
  // any other -- which is what lets a mascot say something *while* being happy
  // (docs/VISEME_SYSTEM.md) -- installed under the naming rule so
  // `mascot.setViseme('AE')` finds it on a rig it has never seen.
  assert.deepEqual(rig.expressions.map((item) => item.id),
    ['hands-out', ...EXPRESSION_PRESETS.map((preset) => preset.id), ...VISEME_KEYS.map(visemeExpressionId)]);
  assert.deepEqual(rig.expressions.filter((item) => item.viseme).map((item) => item.viseme), [...VISEME_KEYS]);
  assert.deepEqual(rig.expressions.find((item) => item.viseme === 'OO').controls,
    { mouthOpen: 0.32, mouthWidth: -0.7, mouthRound: 1 }, 'a viseme is three numbers for the mouth\'s own movements, and no drawing');
  assert.deepEqual(rig.reactions.map((item) => item.id), REACTION_PRESETS.map((preset) => preset.id));
  // A hand is held to a named place on the face, position and angle together,
  // by one parameter each (docs/HAND_RIGGING.md, "Held to the face").
  assert.deepEqual(rig.rigAttachments.map((item) => item.id),
    ['face.chin', 'face.cheek.left', 'face.cheek.right', 'face.mouth', 'face.forehead', 'hand.left.palm', 'hand.right.palm']);
  assert.deepEqual(rig.rigHolds.map((item) => item.weight),
    ['handLOnChin', 'handLOnCheek', 'handLOnMouth', 'handLOnForehead', 'handROnChin', 'handROnCheek', 'handROnMouth', 'handROnForehead']);
  assert.ok(rig.rigHolds.every((item) => item.orient), 'a held hand turns with what it is holding on to');
  assert.deepEqual(rig.animations.filter((clip) => clip.loop).map((clip) => clip.id), ['talk'], 'talking is the one motion with no length of its own');
  assert.deepEqual(rig.behaviors.map((behavior) => behavior.id), ['auto-blink', 'auto-gaze-x', 'auto-gaze-y', 'auto-idle-head']);
  // A hand has **one** movement that decides its shape, not fifteen: which
  // drawing it is. Nothing curls, spreads, grips, flips, turns or animates it
  // (docs/HAND_STYLES.md).
  // Seventy, plus the two lid axes with a side offset each and the mouth's
  // pucker (docs/FACE_SVG_STATES.md, docs/VISEME_SYSTEM.md). All seven rest at
  // 0 and add nothing until something moves them.
  assert.equal(Object.keys(rig.params).length, 77);
  assert.deepEqual(Object.keys(rig.params).filter((name) => /^eyeSquint|^eyeCurve|^mouthRound/.test(name)).sort(),
    ['eyeCurve', 'eyeCurveLeft', 'eyeCurveRight', 'eyeSquint', 'eyeSquintLeft', 'eyeSquintRight', 'mouthRound']);
  // Two of those seventy are the gaze target: the template ships the solver on
  // (V3-12), so looking somewhere turns the eyes and then the head. They rest
  // at 0 and add nothing until something moves them.
  assert.deepEqual(Object.keys(rig.params).filter((name) => /^gaze/.test(name)).sort(), ['gazeX', 'gazeY']);
  assert.deepEqual(Object.keys(rig.params).filter((name) => /^handL/.test(name)).sort(),
    ['handLDepth', 'handLOnCheek', 'handLOnChin', 'handLOnForehead', 'handLOnMouth',
      'handLRotation', 'handLScale', 'handLShow', 'handLStyle', 'handLX', 'handLY']);
  assert.deepEqual(rig.params.handLStyle.options, ['relaxed', 'open', 'fist', 'point', 'thumbsUp', 'peace', 'ok', 'sideFist'], 'a movement whose value is a choice names its choices');
  // What the browser export of the same template contained. The hands used to
  // carry 202 shape keys and 154 pose grids between them, all of them so that
  // six paths a side could be deformed into a turn, and then 30 more for the
  // drawings' own little animations. A drawing is chosen and never deformed, so
  // there is nothing at all left to measure on a hand (docs/HAND_STYLES.md).
  assert.equal(rig.keyforms.length, 157, 'the 2.5D turn is generated, and the hands hide and hold');
  // Thirteen, plus eight on the four eyelids and eight more on the four creases
  // that draw their edges (narrowed and curved, per shape), and three on the
  // mouth's pucker (the lips, the teeth and the tongue).
  assert.equal(rig.shapeKeys.length, 32, "the face's own, and not one on a hand");
  assert.equal(rig.shapeKeys.filter((key) => /^lid/.test(key.target)).length, 8);
  assert.equal(rig.shapeKeys.filter((key) => /^crease/.test(key.target)).length, 8,
    'a crease is bent by the same two controls its lid is: it *is* the lid\'s edge (docs/EYE_BUILDS.md)');
  assert.equal(rig.shapeKeys.some((key) => /^hand/i.test(key.target || '')), false, 'nothing deforms a hand');
  assert.equal(rig.rigPins.length, 7);
  assert.ok(rig.gazeSolver, 'the gaze solver is configured');
  assert.deepEqual(rig.followers.map((follower) => follower.element), ['earLeft', 'earRight', 'hair', 'hairBack'], 'the ears, the fringe and the back of the hair trail the head -- the crown is the head');
  assert.deepEqual([rig.rigConstraints, rig.warps, rig.deformers], [[], [], []]);
  assert.deepEqual(Object.keys(rig.hands), ['left', 'right']);
  assert.equal(rig.elements.shadeLeft.bindings.opacity.amplitude, -.6, 'the template rigging landed on the parsed records');
  assert.equal(rig.elements.eyeLeft.baseTransform.pivotX, 83);
  assert.deepEqual(validateRig(normalizeRig(rig)), [], 'the exported rig validates when imported back');
});

test('the demo ships the three files Export writes, and the runtime runs the face standalone', async () => {
  const assets = await createDemoAssets();
  assert.deepEqual(assets.map((asset) => asset.name), [...DEMO_ASSET_NAMES]);
  assert.deepEqual(assets.map((asset) => asset.type), ['image/svg+xml', 'application/json', 'text/javascript']);
  const rig = JSON.parse(assets[1].source);
  assert.equal(assets[1].source, JSON.stringify(createTemplateExport().rig, null, 2), 'indented like the editor download');
  assert.doesNotMatch(assets[2].source, /^\s*import\s.*from\s*['"]\.\//m, 'one standalone module, no relative imports');

  const runtime = await import(`data:text/javascript;base64,${Buffer.from(assets[2].source).toString('base64')}`);
  assert.equal(typeof runtime.load, 'function');
  const written = new Map(), nodes = new Map();
  for (const id of Object.keys(rig.elements)) nodes.set(id, { id, tagName: 'g', style: {}, setAttribute(name, value) { written.set(`${id}.${name}`, value); } });
  const svgRoot = { id: '', querySelector: (selector) => nodes.get(selector.slice(1)) || null, querySelectorAll: null };
  let frame = null, time = 0;
  const engine = runtime.createMascotEngine({ svgRoot, rig, requestFrame: (callback) => { frame = callback; return 1; }, cancelFrame: () => {}, now: () => time, random: () => .5 });
  engine.start();
  assert.equal(engine.setParameter('lookX', .8), true);
  time = 100; frame(time);
  const transform = written.get('pupilLeft.transform');
  assert.match(transform, /^translate\(/);
  const x = Number(/^translate\(([-\d.e]+)/.exec(transform)[1]);
  assert.ok(x > 1, `the pupil follows lookX: ${transform}`);
  assert.equal(engine.setState('happy'), true);
  assert.equal(engine.setState('surprised'), false, 'the transitions are guarded: no happy → surprised');
  assert.deepEqual(engine.getMotions().map((clip) => clip.id), rig.animations.map((clip) => clip.id));
  assert.equal(engine.playMotion('nod'), true);
  assert.equal(engine.getAnimation(), 'nod');
  assert.equal(engine.setBehaviorEnabled('auto-blink', false), true);
  engine.stop();
});
