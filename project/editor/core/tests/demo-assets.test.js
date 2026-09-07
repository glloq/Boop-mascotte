import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ASSET_NAMES, createDemoAssets } from '../../../../scripts/demo-assets.mjs';
import { createTemplateExport, parseTemplateArtwork } from '../sample/templates/template-export.js';
import { MASCOT_FACE_SVG } from '../sample/templates/face-artwork.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';
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
  assert.equal(Object.keys(elements).length, 42, 'every layer the artwork draws, and nothing under <defs>');
  assert.equal(elements.eyeSocketLeft, undefined, 'a clip path is not a layer');
  assert.equal(elements.head.meta.nodeType, 'path');
  assert.equal(elements.eyeLeft.meta.nodeType, 'g');
  assert.equal(elements.pupilLeft.meta.nodeType, 'circle');
  assert.equal(elements.earLeftShape.meta.nodeType, 'ellipse');
  assert.equal(elements.earLeftEdge.meta.nodeType, 'path', 'the ear outline is its own shape: only the outer half is drawn');
  assert.deepEqual([elements.head.baseOpacity, elements.shadeLeft.baseOpacity, elements.glintLeft.baseOpacity, elements.earLeftFold.baseOpacity], [1, .22, .92, .55], 'the opacity attribute is the base opacity');
  assert.deepEqual(elements.head.baseTransform, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 });
  assert.deepEqual(elements.head.bindings, {});
  assert.deepEqual(layers.map((layer) => layer.id), ['faceRoot']);
  const face = layers[0];
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
  assert.equal(Object.keys(rig.elements).length, 42);
  for (const id of Object.keys(rig.elements)) assert.match(svg, new RegExp(`id="${id}"`), `${id} is drawn`);
  assert.deepEqual(Object.keys(rig.states), ['idle', 'happy', 'surprised']);
  assert.equal(rig.activeState, 'idle');
  assert.deepEqual(rig.transitions, { idle: ['happy', 'surprised'], happy: ['idle'], surprised: ['idle'] });
  assert.deepEqual(rig.animations.map((clip) => clip.id), ['look-around', 'blink-clip', 'smile', 'head-nod', 'head-turn', 'simple-talk']);
  assert.deepEqual(rig.behaviors.map((behavior) => behavior.id), ['auto-blink', 'auto-gaze-x', 'auto-gaze-y', 'auto-idle-head']);
  assert.equal(Object.keys(rig.params).length, 46);
  // What the browser export of the same template contained.
  assert.equal(rig.keyforms.length, 139, 'the 2.5D turn is generated');
  assert.equal(rig.shapeKeys.length, 8);
  assert.equal(rig.rigPins.length, 7);
  assert.ok(rig.gazeSolver, 'the gaze solver is configured');
  assert.deepEqual(rig.followers.map((follower) => follower.element), ['earLeft', 'earRight', 'hair', 'hairBack'], 'the ears, the fringe and the back of the hair trail the head -- the crown is the head');
  assert.deepEqual([rig.expressions, rig.reactions, rig.rigConstraints, rig.rigAttachments, rig.rigHolds, rig.warps, rig.deformers], [[], [], [], [], [], [], []]);
  assert.equal(rig.hands, null);
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
  assert.equal(engine.playMotion('head-nod'), true);
  assert.equal(engine.getAnimation(), 'head-nod');
  assert.equal(engine.setBehaviorEnabled('auto-blink', false), true);
  engine.stop();
});
