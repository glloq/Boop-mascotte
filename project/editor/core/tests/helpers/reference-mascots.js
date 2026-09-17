/**
 * The mascots V4 says it supports, built the way an author would build them
 * (docs/V4_ROADMAP.md, Phase 11).
 *
 * Five, because five is the set of things that had to keep working:
 *
 * ```text
 * historic   paths only, written before any of this existed
 * raster     every piece a picture
 * hybrid     paths and pictures in one artwork
 * personal   a photograph as the base, features placed on top of it
 * bent       a picture with a mesh and an alpha mask
 * ```
 *
 * They live in a helper rather than in one test file because the matrix that
 * uses them is not the only thing that should be able to: a reference mascot is
 * a fixture, and a fixture nobody else can reach is a fixture that rots.
 *
 * Each builder returns the same shape — `{ name, state, store, assets }` —
 * where `state` is a live editor state, `store` is the asset store holding the
 * bytes and `assets` is the id→record table. A vector mascot has an empty store
 * and an empty table, which is exactly the point: nothing downstream should be
 * able to tell that from a missing one.
 */
import { readFileSync } from 'node:fs';
import { createCleanProjectState } from '../../state/store.js';
import { createProjectDocument } from '../../state/project-document.js';
import { normalizeRig } from '../../rig/normalize-rig.js';
import { createMemoryAssetStore } from '../../assets/asset-store.js';
import { createAssetManager } from '../../assets/asset-manager.js';
import { assetRef } from '../../../../runtime/asset-reference.js';
import { meshRestPoints } from '../../../../runtime/mesh-warp.js';

export const fixtureBytes = (name) => new Uint8Array(readFileSync(new URL(`../fixtures/assets/${name}`, import.meta.url)));

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });

export const REFERENCE_PARAMS = Object.freeze({
  headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  headTilt: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
  mouthOpen: { type: 'number', min: 0, max: 1, default: 0, value: 0 }
});
export const REFERENCE_STATES = Object.freeze({
  idle: { headX: 0, headY: 0, headTilt: 0, mouthOpen: 0 },
  talking: { headX: .2, headY: -.1, headTilt: .3, mouthOpen: 1 }
});

/** One rig over every artwork: the bindings are the mascot, not what drew it. */
const bindingsFor = (id) => ({
  translateX: { enabled: true, mode: 'simple', expression: 'headX', curve: 'linear', amplitude: id === 'head' ? 6 : 4, offset: 0 },
  translateY: { enabled: true, mode: 'simple', expression: 'headY', curve: 'linear', amplitude: 3, offset: 0 },
  rotation: { enabled: true, mode: 'simple', expression: 'headTilt', curve: 'linear', amplitude: 5, offset: 0 }
});

/**
 * A state in the shape the editor actually keeps one.
 *
 * Through `normalizeRig` *and* `createProjectDocument`, which is the pair every
 * real project goes through — a template loads into the first and is stored as
 * the second. Assembled by hand instead, a fixture is missing the things those
 * two fill in (an element's `constraints`, a document's parallax block), and a
 * matrix comparing it against a saved-and-reopened copy would be measuring the
 * fixture rather than the code. That is not hypothetical: the first version of
 * this helper made the editor and the exported rig disagree about depth, purely
 * because `createCleanProjectState` leaves `parallax` null and
 * `createProjectDocument` does not.
 */
const normalized = (state) => {
  const rig = normalizeRig({ params: state.params, states: state.states, elements: state.elements, activeState: state.activeState, meshes: state.meshes });
  return createProjectDocument(Object.assign(state, { elements: rig.elements, params: rig.params, states: rig.states }));
};

const baseState = (over = {}) => Object.assign(createCleanProjectState(), {
  params: structuredClone(REFERENCE_PARAMS),
  states: structuredClone(REFERENCE_STATES),
  activeState: 'idle',
  transitions: { idle: ['talking'], talking: ['idle'] },
  transitionSettings: { 'idle->talking': { duration: 180, easing: 'easeOut' }, 'talking->idle': { duration: 240, easing: 'easeInOut' } },
  reactions: [{ id: 'greet', name: 'Greet', trigger: { type: 'click' }, expression: null, motion: null, gestures: [], timing: 'fast', after: 'return' }]
}, over);

const pathElement = (over = {}) => ({ baseTransform: transform(over.baseTransform), constraints: {}, bindings: {}, meta: { nodeType: 'path' }, ...over });
const imageElement = (asset, over = {}) => ({
  baseTransform: transform(over.baseTransform), constraints: {}, bindings: {},
  meta: { nodeType: 'image', width: asset.width, height: asset.height }, ...over
});

/**
 * The four pieces every reference mascot is made of, and where each one sits.
 *
 * One list for the paths mascot and the pictures mascot, because the claim
 * Phase 2 exists to keep is that those two move identically: a difference in
 * the fixture would be a difference the matrix then measured as a difference in
 * the code.
 */
const PIECES = Object.freeze([
  { id: 'head', file: 'opaque-48x32.webp', x: 0, y: 0 },
  { id: 'eyeLeft', file: 'alpha-16x16.png', x: -8, y: -6 },
  { id: 'eyeRight', file: 'alpha-16x16.png', x: 8, y: -6 },
  { id: 'mouth', file: 'alpha-24x17.webp', x: 0, y: 8 }
]);

/** Paths only, and nothing that postdates them: a project from before V4. */
export function historicMascot() {
  const state = baseState({
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${PIECES.map((piece) => `<path id="${piece.id}" d="M${piece.x} ${piece.y} h20 v20 h-20 z" fill="#c8d4e6"/>`).join('')}</svg>`,
    elements: Object.fromEntries(PIECES.map((piece) => [piece.id, pathElement({ baseTransform: { x: piece.x, y: piece.y }, bindings: bindingsFor(piece.id) })])),
    layers: PIECES.map((piece) => ({ id: piece.id, name: piece.id, type: 'path', visible: true, children: [] }))
  });
  return { name: 'historic', state: normalized(state), store: createMemoryAssetStore(), assets: {} };
}

/** Every piece a picture. The same rig, the same states, different nodes. */
export async function rasterMascot() {
  const store = createMemoryAssetStore(), manager = createAssetManager({ store });
  const assets = {}, elements = {}, nodes = [];
  for (const piece of PIECES) {
    const imported = await manager.import(fixtureBytes(piece.file), { name: piece.file, type: '' });
    if (!imported.ok) throw new Error(`${piece.file} did not import: ${JSON.stringify(imported.issues)}`);
    assets[imported.asset.id] = imported.asset;
    elements[piece.id] = imageElement(imported.asset, { baseTransform: { x: piece.x, y: piece.y }, bindings: bindingsFor(piece.id) });
    nodes.push(`<image id="${piece.id}" href="${assetRef(imported.asset.id)}" x="${piece.x}" y="${piece.y}" width="${imported.asset.width}" height="${imported.asset.height}"/>`);
  }
  const state = baseState({
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${nodes.join('')}</svg>`,
    elements, assets,
    layers: PIECES.map((piece) => ({ id: piece.id, name: piece.id, type: 'image', visible: true, children: [] }))
  });
  return { name: 'raster', state: normalized(state), store, assets };
}

/** Paths and pictures in one artwork, which is what most real mascots become. */
export async function hybridMascot() {
  const store = createMemoryAssetStore(), manager = createAssetManager({ store });
  const imported = await manager.import(fixtureBytes('alpha-24x17.webp'), { name: 'mouth.webp', type: 'image/webp' });
  const assets = { [imported.asset.id]: imported.asset };
  const state = baseState({
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><path id="head" d="M0 0 h60 v60 h-60 z" fill="#c8d4e6"/><path id="eyeLeft" d="M8 8 h8 v8 h-8 z"/><path id="eyeRight" d="M40 8 h8 v8 h-8 z"/><image id="mouth" href="${assetRef(imported.asset.id)}" x="0" y="8" width="${imported.asset.width}" height="${imported.asset.height}"/></svg>`,
    elements: {
      head: pathElement({ bindings: bindingsFor('head') }),
      eyeLeft: pathElement({ bindings: bindingsFor('eyeLeft') }),
      eyeRight: pathElement({ bindings: bindingsFor('eyeRight') }),
      mouth: imageElement(imported.asset, { baseTransform: { y: 8 }, bindings: bindingsFor('mouth') })
    },
    assets,
    layers: ['head', 'eyeLeft', 'eyeRight', 'mouth'].map((id) => ({ id, name: id, type: id === 'mouth' ? 'image' : 'path', visible: true, children: [] }))
  });
  return { name: 'hybrid', state: normalized(state), store, assets };
}

/**
 * A photograph as the base, with features placed on top of it.
 *
 * The case Phase 1 was written for, and the one that shares an asset: both eyes
 * are the same file, so the store holds it once. A mascot that stored it twice
 * would be twice the size for no reason nobody could see.
 */
export async function personalMascot() {
  const store = createMemoryAssetStore(), manager = createAssetManager({ store });
  const base = await manager.import(fixtureBytes('opaque-48x32.webp'), { name: 'photo.webp', type: 'image/webp' });
  const eye = await manager.import(fixtureBytes('alpha-16x16.png'), { name: 'eye.png', type: 'image/png' });
  const again = await manager.import(fixtureBytes('alpha-16x16.png'), { name: 'eye-copy.png', type: 'image/png' });
  const assets = { [base.asset.id]: base.asset, [eye.asset.id]: eye.asset };
  const state = baseState({
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><image id="base" href="${assetRef(base.asset.id)}" x="0" y="0" width="${base.asset.width}" height="${base.asset.height}"/><image id="eyeLeft" href="${assetRef(eye.asset.id)}" x="-8" y="-6" width="${eye.asset.width}" height="${eye.asset.height}"/><image id="eyeRight" href="${assetRef(again.asset.id)}" x="8" y="-6" width="${eye.asset.width}" height="${eye.asset.height}"/></svg>`,
    elements: {
      base: imageElement(base.asset, { depth: 0 }),
      eyeLeft: imageElement(eye.asset, { baseTransform: { x: -8, y: -6 }, depth: .3, bindings: bindingsFor('eyeLeft') }),
      eyeRight: imageElement(eye.asset, { baseTransform: { x: 8, y: -6 }, depth: .3, bindings: bindingsFor('eyeRight') })
    },
    assets,
    layers: ['base', 'eyeLeft', 'eyeRight'].map((id) => ({ id, name: id, type: 'image', visible: true, children: [] }))
  });
  return { name: 'personal', state: normalized(state), store, assets, sharedAsset: eye.asset.id, duplicateOf: again.asset.id };
}

/** A picture that bends, and one cut to the shape of another's alpha. */
export async function bentMascot() {
  const store = createMemoryAssetStore(), manager = createAssetManager({ store });
  const mouth = await manager.import(fixtureBytes('alpha-24x17.webp'), { name: 'mouth.webp', type: 'image/webp' });
  const cutter = await manager.import(fixtureBytes('alpha-16x16.png'), { name: 'cutter.png', type: 'image/png' });
  const assets = { [mouth.asset.id]: mouth.asset, [cutter.asset.id]: cutter.asset };
  const rest = meshRestPoints(3);
  // Bent open: the middle of the bottom row pulled down past the edge of the
  // drawing, which is the most ordinary thing a mesh is for.
  const points = rest.map((point, index) => (index === 7 ? { x: point.x, y: point.y + .35 } : point));
  const state = baseState({
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><mask id="mouth-cut" mask-type="alpha"><image href="${assetRef(cutter.asset.id)}" x="0" y="8" width="${cutter.asset.width}" height="${cutter.asset.height}"/></mask></defs><image id="mouth" href="${assetRef(mouth.asset.id)}" mask="url(#mouth-cut)" x="0" y="8" width="${mouth.asset.width}" height="${mouth.asset.height}"/></svg>`,
    elements: { mouth: imageElement(mouth.asset, { baseTransform: { y: 8 }, bindings: bindingsFor('mouth') }) },
    assets,
    layers: [{ id: 'mouth', name: 'mouth', type: 'image', visible: true, children: [] }],
    meshes: [{ id: 'mesh-mouth', target: 'mouth', size: 3, points: rest, driver: { parameter: 'mouthOpen', min: 0, max: 1 }, to: points }]
  });
  return { name: 'bent', state: normalized(state), store, assets };
}

/** Every reference mascot, built. */
export const referenceMascots = async () => [historicMascot(), await rasterMascot(), await hybridMascot(), await personalMascot(), await bentMascot()];
