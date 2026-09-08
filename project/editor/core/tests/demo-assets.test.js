import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ASSET_NAMES, createDemoAssets } from '../../../../scripts/demo-assets.mjs';
import { createTemplateExport, createTemplateProjectState, parseTemplateArtwork } from '../sample/templates/template-export.js';
import { MASCOT_FACE_SVG } from '../sample/templates/face-artwork.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';
import { EXPRESSION_PRESETS } from '../expressions/expression-presets.js';
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
  assert.equal(Object.keys(elements).length, 114, 'every layer the artwork draws — the face and the pair of hands — and nothing under <defs>');
  assert.equal(elements.eyeSocketLeft, undefined, 'a clip path is not a layer');
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
  // A hand is its five drawings, in the order they turn (docs/HANDS_2D.md),
  // and a drawing is the glove's own six parts.
  assert.deepEqual(layers[0].children.map((layer) => layer.id),
    ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight'].map((view) => `handLeftDraw-relaxed-${view}`));
  assert.deepEqual(layers[0].children[2].children.map((layer) => layer.id),
    ['Palm', 'Ring', 'Middle', 'Index', 'Thumb', 'Cuff'].map((part) => `handLeftDraw-relaxed-front${part}`));
  const face = layers[2];
  assert.equal(face.name, 'Face');
  assert.deepEqual(face.children.find((layer) => layer.id === 'eyeLeft').children.map((layer) => layer.id),
    ['eyeWhiteLeft', 'pupilLeft', 'glintLeft', 'sparkLeft', 'lidUpperLeft', 'lidLowerLeft', 'rimLeft'], 'the eye keeps its nesting, which the head turn reads');
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
  assert.equal(Object.keys(rig.elements).length, 114);
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
  // Every motion the catalogue offers a mascot with this face and these hands.
  // *Point* and *Thumbs up* are the two it does not: each of them **is** a
  // hand, and the pair ships drawn in one -- the picker beside the face draws
  // the other in a press (docs/HANDS_2D.md).
  const wantsAHand = ['point-at', 'approve'];
  assert.deepEqual(rig.animations.map((clip) => clip.id),
    ['hand-wave', 'hands-up', ...MOTION_PRESETS.map((preset) => preset.id).filter((id) => !wantsAHand.includes(id))]);
  for (const id of wantsAHand) {
    const preset = motionAvailability(createTemplateProjectState()).find((item) => item.id === id);
    assert.equal(preset.usable, false, id);
    assert.match(preset.missing[0].hint, /Draw this hand first/, 'and it says so where it can be done');
  }
  assert.deepEqual(rig.expressions.map((item) => item.id), ['hands-out', ...EXPRESSION_PRESETS.map((preset) => preset.id)]);
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
  // A hand made of drawings has three movements, not fifteen: it is chosen,
  // not curled, spread, gripped, flipped and turned (docs/HANDS_2D.md).
  assert.equal(Object.keys(rig.params).length, 72);
  assert.deepEqual(Object.keys(rig.params).filter((name) => /^handL/.test(name)).sort(),
    ['handLDepth', 'handLFacing', 'handLOnCheek', 'handLOnChin', 'handLOnForehead', 'handLOnMouth',
      'handLPose', 'handLRotation', 'handLScale', 'handLShow', 'handLView', 'handLX', 'handLY']);
  assert.deepEqual(rig.params.handLPose.options, ['relaxed'], 'a movement whose value is a choice names its choices');
  // What the browser export of the same template contained. The hands used to
  // carry 202 shape keys and 154 pose grids between them, all of them so that
  // six paths a side could be deformed into a turn; a drawing is chosen, so
  // there is nothing left to measure.
  assert.equal(rig.keyforms.length, 157, 'the 2.5D turn is generated, and the hands hide and hold');
  assert.equal(rig.shapeKeys.length, 13);
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
