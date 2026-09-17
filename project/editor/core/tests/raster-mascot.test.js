import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRigFrame, resolveStateParams } from '../../../runtime/runtime.js';
import { assetRef } from '../../../runtime/asset-reference.js';
import { paintAssetReferences, restoreAssetReferences, unpaintAssetNodes } from '../../../runtime/asset-paint.js';
import { createAssetResolver } from '../../../runtime/asset-resolver.js';
import { createMemoryAssetStore } from '../assets/asset-store.js';
import { createAssetManager } from '../assets/asset-manager.js';
import { imageElementPlugin } from '../plugins/builtin/image-plugin.js';
import { pathElementPlugin } from '../plugins/builtin/path-plugin.js';
import { applyProjectSnapshot, createProjectSnapshot, prepareProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { sanitizeSvgMarkup } from '../security/sanitize-svg.js';

/**
 * A mascot made entirely of pictures, against the same mascot made of paths.
 *
 * The exit this phase was written for (docs/V4_ROADMAP.md, Phase 2): a raster
 * mascot rigs, animates and turns exactly as its vector equivalent. Proved by
 * building both from one rig and comparing what the runtime hands the artwork,
 * which is a stronger claim than two screenshots looking alike -- a screenshot
 * agrees to the pixel it was captured at, and this agrees to the number.
 *
 * The browser half of this (drag it, see it) is a Playwright spec and belongs
 * with the rest of them; it is not here because this file has to be runnable
 * by `npm test`.
 */

const file = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url)));
const PIECES = [
  { id: 'head', picture: 'opaque-48x32.webp', x: 0, y: 0, depth: 0 },
  { id: 'eyeLeft', picture: 'alpha-16x16.png', x: -8, y: -6, depth: 0.3 },
  { id: 'eyeRight', picture: 'alpha-16x16.png', x: 8, y: -6, depth: 0.3 },
  { id: 'mouth', picture: 'alpha-24x17.webp', x: 0, y: 8, depth: 0.2 },
  { id: 'hair', picture: 'tiny-3x7.png', x: 0, y: -14, depth: -0.5 }
];

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
/** One rig, two artworks: the bindings are the mascot, not what drew it. */
const bindingsFor = (id) => ({
  translateX: { expression: 'headX', amplitude: id.startsWith('eye') ? 4 : 6 },
  translateY: { expression: 'headY', amplitude: 3 },
  rotation: { expression: 'headTilt', amplitude: 5 }
});
const PARAMS = { headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, headTilt: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
const STATES = { idle: { headX: 0, headY: 0, headTilt: 0 }, looking: { headX: 0.8, headY: -0.4, headTilt: 0.5 } };

/** The two nodes a piece can be, in the shape a plugin is handed one. */
const wrapper = (type, attributes) => ({ type, node: { localName: type }, attr: (name) => attributes[name] });

async function rasterProject() {
  const store = createMemoryAssetStore();
  const assets = createAssetManager({ store });
  const table = {}, elements = {}, nodes = [];
  for (const piece of PIECES) {
    const imported = await assets.import(file(piece.picture), { name: piece.picture, type: '' });
    assert.equal(imported.ok,true,`${piece.picture} should import`);
    table[imported.asset.id] = imported.asset;
    const attributes = { href: assetRef(imported.asset.id), width: String(imported.asset.width), height: String(imported.asset.height), x: String(piece.x), y: String(piece.y) };
    nodes.push({ id: piece.id, ...attributes });
    elements[piece.id] = {
      ...imageElementPlugin.createRigData(wrapper('image', attributes), transform({ x: piece.x, y: piece.y })),
      depth: piece.depth, bindings: bindingsFor(piece.id)
    };
  }
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${nodes.map((node) => `<image id="${node.id}" href="${node.href}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"/>`).join('')}</svg>`;
  return { store, assets: table, elements, svgMarkup };
}

function vectorProject() {
  const elements = {};
  for (const piece of PIECES) elements[piece.id] = {
    ...pathElementPlugin.createRigData(wrapper('path', { d: 'M0 0 L10 0 L10 10 L0 10 Z' }), transform({ x: piece.x, y: piece.y })),
    depth: piece.depth, bindings: bindingsFor(piece.id)
  };
  return { elements };
}

const framesOf = (elements) => Object.fromEntries(Object.keys(STATES).map((name) => [name,
  compileRigFrame(elements, resolveStateParams(PARAMS, STATES[name]), { translate: 1, rotate: 1, scale: 1 }, {}, { parallax: { enabled: true, strength: 1 } })]));
const movement = (frames) => Object.fromEntries(Object.entries(frames).map(([state, frame]) =>
  [state, Object.fromEntries(Object.entries(frame).map(([id, item]) => [id, { transform: item.transform, opacity: item.opacity, matrix: item.matrix }]))]));

test('a mascot made of pictures moves exactly as the same mascot made of paths',async()=>{
  const raster = await rasterProject();
  const vector = vectorProject();
  // The rig never asked what a piece was drawn with, and this is that claim
  // as a number rather than as a belief: same transforms, same opacities, same
  // matrices, in every state.
  assert.deepEqual(movement(framesOf(raster.elements)),movement(framesOf(vector.elements)));
  // And the turn is a turn: the pieces are somewhere else when the head looks.
  const frames = framesOf(raster.elements);
  assert.notDeepEqual(frames.idle.head.transform,frames.looking.head.transform);
  // Depth still separates them -- an eye in front of the head moves further.
  assert.notEqual(frames.looking.eyeLeft.transform.x,frames.looking.hair.transform.x);
});

test('a raster mascot survives the file it is saved to',async()=>{
  const raster = await rasterProject();
  const source = Object.assign(createCleanProjectState(), {
    svgMarkup: raster.svgMarkup, assets: raster.assets, elements: raster.elements,
    params: PARAMS, states: STATES, activeState: 'idle', transitions: { idle: ['looking'], looking: ['idle'] }
  });

  const saved = createProjectSnapshot(source);
  // A project carrying pictures says so, because a reader that predates them
  // would drop the table without a word.
  assert.equal(saved.version,4);
  assert.equal(Object.keys(saved.document.assets).length,4,'four assets: the two eyes share one picture');
  assert.match(saved.document.svgMarkup,/href="asset:[0-9a-f]{16}"/);
  assert.doesNotMatch(saved.document.svgMarkup,/blob:/);

  const reloaded = createCleanProjectState();
  applyProjectSnapshot(reloaded, prepareProjectSnapshot(saved, (svg) => sanitizeSvgMarkup(svg)));
  assert.deepEqual(reloaded.assets,raster.assets);
  assert.deepEqual(movement(framesOf(reloaded.elements)),movement(framesOf(raster.elements)));
});

test('two eyes drawn from one picture are one asset, and neither can lose it',async()=>{
  const raster = await rasterProject();
  const { assetReferencesIn, unusedAssets } = await import('../assets/asset-manager.js');
  const document = { svgMarkup: raster.svgMarkup, elements: raster.elements, assets: raster.assets };
  assert.equal(assetReferencesIn(document).size,4);
  assert.deepEqual(unusedAssets(document),[],'nothing in the table is unreferenced');

  // One eye deleted: the picture is still the other eye's.
  const oneEye = { ...document, svgMarkup: raster.svgMarkup.replace(/<image id="eyeLeft"[^>]*\/>/, ''), elements: { ...raster.elements } };
  delete oneEye.elements.eyeLeft;
  assert.deepEqual(unusedAssets(oneEye),[]);
});

test('the round trip through the DOM never leaves an object URL in the artwork',async()=>{
  const raster = await rasterProject();
  const resolver = createAssetResolver({ store: raster.store, createObjectURL: () => 'blob:test/0', revokeObjectURL() {} });
  const ids = Object.keys(raster.assets);
  await resolver.prime(ids);

  // The nodes as the canvas holds them.
  const nodes = ids.map((id) => {
    const held = new Map([['href', assetRef(id)]]);
    return { getAttribute: (n) => held.get(n) ?? null, setAttribute: (n, v) => held.set(n, String(v)), removeAttribute: (n) => held.delete(n), toObject: () => Object.fromEntries(held) };
  });
  paintAssetReferences(nodes, resolver);
  for (const node of nodes) assert.equal(node.toObject().href,'blob:test/0','painted for the browser');
  unpaintAssetNodes(nodes);
  for (const node of nodes) {
    assert.equal(node.toObject().href,undefined,'the object URL comes off the node');
    assert.match(restoreAssetReferences(`<image data-editor-asset="${node.toObject()['data-editor-asset']}"/>`),/href="asset:/,'and the reference goes back into the text');
  }
});
