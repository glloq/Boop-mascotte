import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { createCharacterBuilder } = await import('../../ui/character-builder/character-builder.js');
const { createEditorStore } = await import('../state/editor-store.js');
const { createHistory } = await import('../undo/history.js');
const { createTemplateProjectState } = await import('../sample/templates/template-export.js');
const { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } = await import('./helpers/fake-face-canvas.js');
const { createFacePartCommands } = await import('../face-library/face-part-commands.js');
const { createFacePartRegistry } = await import('../face-library/face-part-registry.js');
const { BUILTIN_FACE_PARTS } = await import('../face-library/builtin/index.js');
const { createFacePresetRegistry, FACE_STYLE_PRESETS } = await import('../face-library/face-presets.js');
const { artworkIds } = await import('../face-library/face-part-model.js');

/**
 * The Character Builder shell (docs/CHARACTER_BUILDER.md, PR 1).
 *
 * What is worth proving: a press on a category is a *selection*, never a
 * write; a field is the artwork command the Artwork inspector runs, one undo
 * step each; a colour is one undo step however many shapes carry it; Edit
 * Shape and Advanced are routes into the existing interface with the piece
 * in hand; and the inspector follows a canvas click whichever part it lands
 * on. DOM-less, like the other panel tests: the hosts are stub elements and
 * the canvas is the handful of primitives the builder asks of it.
 */
const PAINTS = {
  head: { fill: '#f9d9b0', stroke: '#a4674a' }, earLeftShape: { fill: '#f9d9b0' }, earRightShape: { fill: '#f9d9b0' }, lidUpperLeft: { fill: '#f9d9b0', stroke: '#a4674a' }, nose: { stroke: '#bd8763' },
  hair: { fill: '#5b3a1e' }, hairTop: { fill: '#5b3a1e', stroke: '#111111' }, hairBack: { fill: '#4a2f18' },
  mouth: { fill: '#b83a3a', stroke: '#111111' }, teeth: { fill: '#ffffff' }, tongue: { fill: '#e06060' },
  eyeLeft: {}, eyeWhiteLeft: { fill: '#ffffff' }, pupilLeft: { fill: '#10172a' }, eyeRight: {}, eyeWhiteRight: { fill: '#ffffff' }, pupilRight: { fill: '#10172a' },
  handLeft: {}, 'handLeftStyle-relaxed': { fill: '#f4d8b8', stroke: '#111111' }
};

/** The editor's library plus a pair of eyes drawn without pupils or lids, which the template refuses: a card that cannot be pressed. */
function library() {
  const registry = createFacePartRegistry();
  registry.registerMany(BUILTIN_FACE_PARTS);
  registry.register({ id: 'eyes.plain', category: 'eyes', name: 'Plain', artwork: '<g id="eyes-plain"><circle id="eyeL" cx="83" cy="113" r="20"/><circle id="eyeR" cx="157" cy="113" r="20"/></g>', roles: { leftEye: 'eyeL', rightEye: 'eyeR' }, referenceBox: { x: 63, y: 93, width: 114, height: 40 } });
  // And one accessory, for a category the template has no part for yet.
  registry.register({ id: 'accessory.test-hat', category: 'accessory', name: 'Hat', description: 'A flat hat.', artwork: '<g id="hat" data-name="Hat"><rect id="brim" data-name="Brim" x="40" y="10" width="160" height="20" fill="#333"/></g>', roles: { element: 'brim' }, referenceBox: { x: 40, y: 10, width: 160, height: 20 } });
  return registry;
}

function harness(state = createTemplateProjectState(), { styles = true } = {}) {
  const store = createEditorStore(state);
  const history = createHistory(store);
  const browserHost = document.createElementNS('', 'div'), inspectorHost = document.createElementNS('', 'div');
  const applied = [], routes = [], tools = [], statuses = [], colourRequests = [], templates = [], installed = [], scopes = [];
  const paints = structuredClone(PAINTS);
  const registry = library();
  const presetRegistry = createFacePresetRegistry({ library: registry });
  for (const item of FACE_STYLE_PRESETS) presetRegistry.register(item);
  const stored = new Map();
  const presetStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  const assets = {};
  for (const asset of registry.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const faceCanvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || assets[id.replace(/-\d+$/, '')] || null });
  // The subtree of a piece, from the layer tree, as the canvas would walk it.
  const subtree = (id) => {
    const find = (items) => { for (const item of items || []) { if (item.id === id) return item; const found = find(item.children); if (found) return found; } return null; };
    const out = [];
    const visit = (item) => { if (!item) return; out.push(item.id); (item.children || []).forEach(visit); };
    visit(find(store.getDocument().layers));
    return out;
  };
  const canvas = {
    ...faceCanvas,
    applyElementTransform: (id, element) => applied.push([id, structuredClone(element.baseTransform)]),
    elementKind: (id) => store.getDocument().elements[id]?.meta?.nodeType || null,
    setEditScope: (id) => { scopes.push(id); return Boolean(id && store.getDocument().elements[id]); },
    getEditScope: () => scopes.at(-1) ?? null,
    // One piece and what is inside it, or, with no id, the whole mascot -- in
    // document order, as the canvas reads it, whatever order the table is in.
    describePaints: (id) => {
      const all = []; const visit = (items) => { for (const item of items || []) { all.push(item.id); visit(item.children); } }; visit(store.getDocument().layers);
      return (id ? subtree(id) : all).filter((item) => paints[item] && store.getDocument().elements[item]).map((item) => ({ id: item, ...paints[item] }));
    },
    setAppearance: (id, property, value) => {
      history.snapshot();
      paints[id] = { ...(paints[id] || {}), [property]: value };
      store.execute({ type: 'artwork/set-appearance', domains: ['artwork'], source: 'test', apply: () => {} });
      return true;
    }
  };
  const builder = createCharacterBuilder({
    browserHost, inspectorHost, store, history, canvas,
    navigate: (route) => routes.push(route),
    setDesignTool: (tool) => tools.push(tool),
    openColour: (request) => colourRequests.push(request),
    loadTemplate: (kind) => { templates.push(kind); return true; },
    facePartCommands: styles ? createFacePartCommands(store, history, canvas, { library: registry, presets: presetRegistry, presetStorage: presetStorage, onInstalled: (summary) => installed.push(summary) }) : null,
    onStatus: (message, tone) => statuses.push(tone ? `${tone}: ${message}` : message)
  });
  builder.render();
  return {
    store, history, builder, browserHost, inspectorHost, applied, routes, tools, statuses, colourRequests, templates, paints, installed, faceCanvas, stored, scopes,
    session: () => { const { selectedId, selectedIds } = store.getSession(); return { selectedId, selectedIds }; },
    press: (dataset) => browserHost.dispatch('click', { target: clickTarget({ dataset }) }),
    pressInspector: (dataset) => inspectorHost.dispatch('click', { target: clickTarget({ dataset }) }),
    // A field's write comes back as a document notification, which the render
    // plan turns into `render()`; here the test plays the plan.
    field: (dataset, value, checked = false) => { inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset, value, checked }) }); builder.render(); },
    element: (id) => store.getDocument().elements[id]
  };
}

test('a press on a category selects every piece that plays it, and writes nothing', () => {
  const ui = harness();
  const revision = ui.store.getPersistentRevision();
  assert.equal(ui.browserHost.dataset.partReady, 'true');
  assert.equal(ui.inspectorHost.dataset.partKind, 'empty', 'nothing is in hand yet');
  assert.match(ui.inspectorHost.innerHTML, /Pick a part on the left, or click the mascot/);

  ui.press({ partCategory: 'eyes' });
  assert.deepEqual(ui.session(), { selectedId: 'eyeRight', selectedIds: ['eyeLeft', 'eyeRight'] }, 'both eyes, the last one in hand');
  assert.equal(ui.browserHost.dataset.partActive, 'eyes');
  assert.match(ui.browserHost.innerHTML, /data-part-category="eyes" aria-pressed="true"/);
  assert.match(ui.browserHost.innerHTML, /data-part-category-body="eyes"/, 'the open category shows what it holds');
  assert.match(ui.browserHost.innerHTML, /data-part-piece="eyeLeft" aria-pressed="false"/);
  assert.match(ui.browserHost.innerHTML, /data-part-piece="eyeRight" aria-pressed="true"/);
  assert.equal(ui.inspectorHost.dataset.partKind, 'piece');
  assert.equal(ui.inspectorHost.dataset.partPiece, 'eyeRight');
  assert.match(ui.inspectorHost.innerHTML, /data-part-subject="eyes"><strong>Eyes<\/strong>/);
  assert.match(ui.inspectorHost.innerHTML, /All 2 are selected/);
  for (const field of ['data-part-transform="x"', 'data-part-transform="y"', 'data-part-transform="rotation"', 'data-part-scale', 'data-part-edit-shape', 'data-part-colour']) assert.ok(ui.inspectorHost.innerHTML.includes(field), `${field} is offered`);
  assert.equal(ui.store.getPersistentRevision(), revision, 'a selection is not a document write');
  assert.equal(ui.history.getState().canUndo, false);
  assert.deepEqual(ui.builder.snapshot().categories.find((category) => category.id === 'eyes'), { id: 'eyes', status: 'ready', partId: 'eyes', assetId: null, pieces: ['eyeLeft', 'eyeRight'] });
  assert.equal(ui.builder.snapshot().piece, 'eyeRight');
});

test('a piece chip takes one of the pair in hand and keeps both selected', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyes' });
  ui.press({ partPiece: 'eyeLeft' });
  assert.deepEqual(ui.session(), { selectedId: 'eyeLeft', selectedIds: ['eyeRight', 'eyeLeft'] });
  assert.equal(ui.inspectorHost.dataset.partPiece, 'eyeLeft');
  // The same chip in the inspector.
  ui.pressInspector({ partPiece: 'eyeRight' });
  assert.deepEqual(ui.session(), { selectedId: 'eyeRight', selectedIds: ['eyeLeft', 'eyeRight'] });
  // A chip for a piece outside the selection selects that piece alone.
  ui.pressInspector({ partPiece: 'nose' });
  assert.deepEqual(ui.session(), { selectedId: 'nose', selectedIds: ['nose'] });
  assert.equal(ui.browserHost.dataset.partActive, 'nose', 'and the browser follows');
  assert.equal(ui.builder.selectPiece('nope'), false);
});

test('a position field is the artwork command, one undo step, applied to the canvas', () => {
  const ui = harness();
  ui.press({ partCategory: 'nose' });
  const revision = ui.store.getPersistentRevision();
  ui.field({ partTransform: 'x' }, '12.5');
  assert.equal(ui.element('nose').baseTransform.x, 12.5);
  assert.equal(ui.store.getPersistentRevision(), revision + 1);
  assert.deepEqual(ui.applied.at(-1), ['nose', ui.element('nose').baseTransform], 'the canvas is asked to show it');
  assert.match(ui.inspectorHost.innerHTML, /data-part-transform="x" aria-label="X position" value="12.5"/, 'the field shows what was written');
  ui.field({ partTransform: 'rotation' }, '-15');
  assert.equal(ui.element('nose').baseTransform.rotation, -15);
  assert.equal(ui.history.getState().canUndo, true);
  ui.history.undo();
  assert.equal(ui.element('nose').baseTransform.rotation, 0, 'one step took the turn back');
  assert.equal(ui.element('nose').baseTransform.x, 12.5, 'and left the move alone');
  ui.history.undo();
  assert.equal(ui.element('nose').baseTransform.x, 0);
  assert.equal(ui.history.getState().canUndo, false, 'two writes were two steps, no more');
  ui.field({ partTransform: 'y' }, 'nope');
  assert.equal(ui.element('nose').baseTransform.y, 0, 'rubbish is not written');
});

test('the size field writes both axes and keeps a mirrored piece mirrored', () => {
  const ui = harness();
  ui.store.execute({ type: 'test', domains: ['artwork'], source: 'test', apply: (document) => { document.elements.browRight.baseTransform.scaleX = -1; } });
  ui.press({ partCategory: 'eyebrows' });
  assert.equal(ui.session().selectedId, 'browRight');
  ui.field({ partScale: '' }, '1.5');
  assert.deepEqual([ui.element('browRight').baseTransform.scaleX, ui.element('browRight').baseTransform.scaleY], [-1.5, 1.5]);
  assert.match(ui.inspectorHost.innerHTML, /data-part-scale aria-label="Scale" value="1.5"/);
  assert.deepEqual([ui.element('browLeft').baseTransform.scaleX, ui.element('browLeft').baseTransform.scaleY], [1.5, 1.5], 'the other brow follows, its own way round');
});

test('a pair is edited as one: a write on one side mirrors onto the other, as one undo step', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyes' });
  assert.equal(ui.session().selectedId, 'eyeRight');
  assert.match(ui.inspectorHost.innerHTML, /<label class="part-linked"><input type="checkbox" data-part-linked checked aria-label="Edit both eyes"> Edit both eyes<\/label>/);
  assert.match(ui.inspectorHost.innerHTML, /data-part-pair-note>Left eye mirrors every change/);
  assert.match(ui.inspectorHost.innerHTML, /data-part-spacing aria-label="Spacing between the two" value="74"/, 'the two eyes are 74 apart on the template');
  const revision = ui.store.getPersistentRevision();
  ui.field({ partTransform: 'x' }, '6');
  assert.equal(ui.element('eyeRight').baseTransform.x, 6);
  assert.equal(ui.element('eyeLeft').baseTransform.x, -6, 'out on the right is out on the left');
  assert.equal(ui.store.getPersistentRevision(), revision + 2, 'two writes');
  ui.history.undo();
  assert.deepEqual([ui.element('eyeRight').baseTransform.x, ui.element('eyeLeft').baseTransform.x], [0, 0], 'one undo step for the pair');
  assert.equal(ui.history.getState().canUndo, false);
  ui.field({ partTransform: 'y' }, '-3');
  assert.deepEqual([ui.element('eyeRight').baseTransform.y, ui.element('eyeLeft').baseTransform.y], [-3, -3], 'up is up on both');
  ui.field({ partTransform: 'rotation' }, '10');
  assert.deepEqual([ui.element('eyeRight').baseTransform.rotation, ui.element('eyeLeft').baseTransform.rotation], [10, -10], 'a turn mirrors');
  ui.field({ partScale: '' }, '1.2');
  assert.deepEqual([ui.element('eyeRight').baseTransform.scaleX, ui.element('eyeLeft').baseTransform.scaleX], [1.2, 1.2]);
  assert.deepEqual(ui.applied.slice(-2).map(([id]) => id), ['eyeRight', 'eyeLeft'], 'the canvas is asked to show both');
  // Pupils, brows, ears and lids pair the same way; the lids by upper and lower.
  ui.press({ partCategory: 'eyelids' });
  ui.pressInspector({ partPiece: 'lidUpperLeft' });
  ui.field({ partTransform: 'y' }, '2');
  assert.deepEqual([ui.element('lidUpperLeft').baseTransform.y, ui.element('lidUpperRight').baseTransform.y, ui.element('lidLowerLeft').baseTransform.y], [2, 2, 0]);
  // A part with no pair, and a pair with one side locked, write one side.
  ui.press({ partCategory: 'nose' });
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-linked'), false);
  ui.store.execute({ type: 'test', domains: ['layers'], source: 'test', apply: (document) => { document.layerMetadata.earLeft = { locked: true }; } });
  ui.press({ partCategory: 'ears' });
  ui.field({ partTransform: 'x' }, '4');
  assert.deepEqual([ui.element('earRight').baseTransform.x, ui.element('earLeft').baseTransform.x], [4, 0], 'a locked side is left alone');
});

test('Spacing moves the pair apart or together, half each; Unlink edits one side alone', () => {
  const ui = harness();
  ui.press({ partCategory: 'pupils' });
  assert.match(ui.inspectorHost.innerHTML, /data-part-spacing aria-label="Spacing between the two" value="74"/);
  const revision = ui.store.getPersistentRevision();
  ui.field({ partSpacing: '' }, '84');
  assert.deepEqual([ui.element('pupilLeft').baseTransform.x, ui.element('pupilRight').baseTransform.x], [-5, 5]);
  assert.match(ui.inspectorHost.innerHTML, /data-part-spacing aria-label="Spacing between the two" value="84"/, 'measured again, through the move');
  assert.equal(ui.store.getPersistentRevision(), revision + 2);
  ui.history.undo();
  assert.deepEqual([ui.element('pupilLeft').baseTransform.x, ui.element('pupilRight').baseTransform.x], [0, 0], 'one undo step');
  ui.field({ partSpacing: '' }, '70');
  assert.deepEqual([ui.element('pupilLeft').baseTransform.x, ui.element('pupilRight').baseTransform.x], [2, -2], 'together');
  ui.field({ partSpacing: '' }, 'nope');
  assert.deepEqual([ui.element('pupilLeft').baseTransform.x, ui.element('pupilRight').baseTransform.x], [2, -2]);

  // Unlinked: one side, and no spacing to set.
  ui.field({ partLinked: '' }, undefined);
  assert.match(ui.inspectorHost.innerHTML, /<input type="checkbox" data-part-linked aria-label="Edit both pupils">/);
  assert.match(ui.inspectorHost.innerHTML, /data-part-pair-note>Right pupil alone\. Tick to edit both again\./);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-spacing'), false);
  ui.field({ partTransform: 'x' }, '9');
  assert.deepEqual([ui.element('pupilRight').baseTransform.x, ui.element('pupilLeft').baseTransform.x], [9, 2], 'the left pupil stays');
  assert.equal(ui.builder.setLinked(true), true);
  assert.match(ui.inspectorHost.innerHTML, /data-part-linked checked/);
  ui.field({ partTransform: 'x' }, '1');
  assert.deepEqual([ui.element('pupilRight').baseTransform.x, ui.element('pupilLeft').baseTransform.x], [1, -1], 'linked again');
  // The link is the category's: unlinking the pupils leaves the eyes linked.
  ui.builder.setLinked(false);
  ui.press({ partCategory: 'eyes' });
  assert.match(ui.inspectorHost.innerHTML, /data-part-linked checked/);
  ui.press({ partCategory: 'pupils' });
  assert.match(ui.inspectorHost.innerHTML, /<input type="checkbox" data-part-linked aria-label/);
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.builder.setLinked(true), false, 'nothing to link');
});

test('a locked piece is shown and not written', () => {
  const ui = harness();
  ui.store.execute({ type: 'test', domains: ['layers'], source: 'test', apply: (document) => { document.layerMetadata.nose = { ...(document.layerMetadata.nose || {}), locked: true }; } });
  ui.press({ partCategory: 'nose' });
  assert.match(ui.inspectorHost.innerHTML, /data-part-locked/);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-transform="x"'), false);
  const revision = ui.store.getPersistentRevision();
  ui.field({ partTransform: 'x' }, '4');
  assert.equal(ui.store.getPersistentRevision(), revision);
});

test('a canvas click on a piece inside a part lands the inspector on that part', () => {
  const ui = harness();
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.browserHost.dataset.partActive, 'presets');
  // The canvas writes the same session the builder reads.
  ui.store.mutateSession(['selectedId', 'selectedIds'], (session) => { session.selectedId = 'eyeWhiteLeft'; session.selectedIds = ['eyeWhiteLeft']; });
  ui.builder.render();
  assert.equal(ui.browserHost.dataset.partActive, 'eyes', 'the white of the eye is the eyes');
  assert.equal(ui.inspectorHost.dataset.partKind, 'piece');
  assert.equal(ui.inspectorHost.dataset.partPiece, 'eyeWhiteLeft');
  assert.match(ui.inspectorHost.innerHTML, /<strong>Eyes<\/strong>/);
  assert.match(ui.inspectorHost.innerHTML, /data-part-piece="eyeLeft" aria-pressed="false"/, 'the pair is offered, neither in hand');

  ui.store.mutateSession(['selectedId', 'selectedIds'], (session) => { session.selectedId = 'mouth'; session.selectedIds = ['mouth']; });
  ui.builder.render();
  assert.equal(ui.browserHost.dataset.partActive, 'mouth');
  assert.equal(ui.builder.snapshot().active, 'mouth');
});

test('artwork no part owns is still inspected, as artwork', () => {
  const state = createTemplateProjectState();
  state.elements.extra = { baseTransform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, bindings: {}, meta: { nodeType: 'rect' } };
  state.layers.push({ id: 'extra', type: 'rect', name: 'Sticker', visible: true, children: [] });
  const ui = harness(state);
  ui.store.mutateSession(['selectedId', 'selectedIds'], (session) => { session.selectedId = 'extra'; session.selectedIds = ['extra']; });
  ui.builder.render();
  assert.equal(ui.browserHost.dataset.partActive, '', 'no category claims it');
  assert.equal(ui.inspectorHost.dataset.partKind, 'piece');
  assert.match(ui.inspectorHost.innerHTML, /data-part-subject="artwork"><strong>Artwork<\/strong>/);
  assert.match(ui.inspectorHost.innerHTML, /No face part uses this piece/);
  assert.match(ui.inspectorHost.innerHTML, /data-part-piece-name>Sticker</);
  assert.match(ui.inspectorHost.innerHTML, /the Node tool turns it into a path/, 'a rectangle is told what Edit Shape does to it');
  ui.field({ partTransform: 'x' }, '7');
  assert.equal(ui.element('extra').baseTransform.x, 7);
});

test('Edit Shape opens Artwork on the piece, the visible edit limited to it, with the Node tool when the piece has nodes', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.pressInspector({ partPiece: 'mouth' });
  ui.pressInspector({ partEditShape: '' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'mouth' } });
  assert.deepEqual(ui.tools, ['node'], 'the mouth is a path');
  assert.deepEqual(ui.scopes, ['mouth'], 'the edit is limited to the piece');
  assert.equal(ui.builder.snapshot().scope, 'mouth');
  assert.match(ui.statuses.at(-1), /^Editing the shape of Mouth: drag its points; Esc leaves the Node tool\. Back to Character, or the Character tab, brings you back with it in hand\.$/);

  ui.press({ partCategory: 'eyes' });
  ui.pressInspector({ partEditShape: '' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'eyeRight' } });
  assert.deepEqual(ui.tools, ['node'], 'a group has no nodes to edit, so no tool is forced on it');
  assert.deepEqual(ui.scopes, ['mouth', 'eyeRight']);
  assert.match(ui.statuses.at(-1), /^Right eye is selected in Artwork, the rest of the drawing out of the way\. Pick the Node tool to reshape it, or draw into it\. Back to Character/);
  assert.equal(ui.builder.editShape('nope'), false);
  assert.deepEqual(ui.scopes, ['mouth', 'eyeRight'], 'nothing to scope to');
});

test('Advanced is the existing interface, on the same part', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyebrows' });
  ui.press({ characterAdvanced: 'artwork' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'browRight' } });
  ui.press({ characterAdvanced: 'face-setup' });
  assert.deepEqual(ui.routes.at(-1), { task: 'face-setup', target: { kind: 'semantic-part', id: 'eyebrows' } }, 'Face Setup opens on the brows');
  // With nothing in hand, Artwork opens plain and Face Setup opens its checklist.
  ui.press({ partCategory: 'presets' });
  ui.press({ characterAdvanced: 'artwork' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: undefined });
  ui.press({ characterAdvanced: 'face-setup' });
  assert.deepEqual(ui.routes.at(-1), { task: 'face-setup', focus: 'face-setup-checklist', target: undefined });
  // The inspector's own Advanced disclosure goes the same two places.
  ui.press({ partCategory: 'nose' });
  ui.pressInspector({ characterRoute: 'face-part' });
  assert.deepEqual(ui.routes.at(-1), { task: 'face-setup', target: { kind: 'semantic-part', id: 'nose' } });
  ui.pressInspector({ characterRoute: 'artwork' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'nose' } });
  ui.pressInspector({ characterRoute: 'nowhere' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'nose' } }, 'an unknown route goes nowhere');
});

test('Presets and Facial Hair take the selection away and say what they are', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyes' });
  ui.press({ partCategory: 'presets' });
  assert.deepEqual(ui.session(), { selectedId: null, selectedIds: [] }, 'a category with no pieces holds nothing in hand');
  assert.equal(ui.inspectorHost.dataset.partKind, 'category');
  assert.match(ui.browserHost.innerHTML, /data-character-preset="basic"/);
  assert.match(ui.inspectorHost.innerHTML, /Choose a face on the left/);
  ui.press({ characterPreset: 'basic' });
  assert.deepEqual(ui.templates, ['basic'], 'a preset is the template, through the project service and its confirmation');
  ui.press({ characterPreset: 'nope' });
  assert.deepEqual(ui.templates, ['basic']);

  ui.press({ partCategory: 'facialHair' });
  assert.equal(ui.inspectorHost.dataset.partKind, 'category');
  assert.match(ui.inspectorHost.innerHTML, /No facial hair on this mascot yet/);
  assert.match(ui.browserHost.innerHTML, /data-part-status="missing" data-part-active="true"/);
  assert.match(ui.browserHost.innerHTML, /data-face-part="facialhair.moustache" aria-pressed="false" title="Add Moustache/, 'the library has some');
  ui.press({ partCategory: 'accessory' });
  assert.match(ui.inspectorHost.innerHTML, /data-character-route="face-setup"/, 'a missing part is assigned in Face Setup');
  ui.pressInspector({ characterRoute: 'face-setup' });
  assert.deepEqual(ui.routes.at(-1), { task: 'face-setup', focus: 'face-setup-checklist' });
  assert.equal(ui.builder.openCategory('nope'), false);
});

test('the hands are a pair to pick, not a position to type', () => {
  const ui = harness();
  ui.press({ partCategory: 'hands' });
  assert.deepEqual(ui.session(), { selectedId: 'handRight', selectedIds: ['handLeft', 'handRight'] });
  assert.match(ui.inspectorHost.innerHTML, /data-hand-placement="right"/);
  assert.match(ui.inspectorHost.innerHTML, /Right hand hangs from its anchor/);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-transform'), false, 'the rig moves a hand; a number here would be written over');
  assert.match(ui.inspectorHost.innerHTML, /data-part-edit-shape/, 'its drawing can still be reshaped');
  assert.match(ui.browserHost.innerHTML, /data-character-route="hand-setup"/);
  ui.press({ characterRoute: 'hand-setup' });
  assert.deepEqual(ui.routes.at(-1), { task: 'face-setup', focus: 'hand-setup' });
});

test('a colour is changed everywhere the piece uses it, as one undo step', () => {
  const ui = harness();
  ui.press({ partCategory: 'hair' });
  ui.pressInspector({ partPiece: 'hair' });
  ui.press({ partCategory: 'head' });
  assert.equal(ui.session().selectedId, 'faceRoot');
  // The face group carries every colour of the face; the hair's brown twice.
  assert.match(ui.inspectorHost.innerHTML, /data-part-colour="#5b3a1e"[^>]*aria-label="Colour #5b3a1e, used 2 times"/);
  ui.pressInspector({ partColour: '#5b3a1e' });
  assert.equal(ui.colourRequests.length, 1);
  assert.equal(ui.colourRequests[0].value, '#5b3a1e');
  assert.match(ui.colourRequests[0].title, /Face/);
  const revision = ui.store.getPersistentRevision();
  ui.colourRequests[0].onPick('#ff0000');
  assert.equal(ui.paints.hair.fill, '#ff0000');
  assert.equal(ui.paints.hairTop.fill, '#ff0000');
  assert.equal(ui.paints.hairBack.fill, '#4a2f18', 'a different brown is a different colour');
  assert.equal(ui.store.getPersistentRevision(), revision + 2, 'two shapes, two writes');
  assert.match(ui.statuses.at(-1), /2 pieces recoloured/);
  ui.history.undo();
  assert.equal(ui.history.getState().canUndo, false, 'and one undo step for both');
  assert.match(ui.inspectorHost.innerHTML, /data-part-colour="#ff0000"/);
  assert.equal(ui.pressInspector({ partColour: '#123456' }) && ui.colourRequests.length, 1, 'a colour the piece does not use opens nothing');
});

test('an unchanged mascot costs a comparison, and destroy lets go', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  const before = ui.builder.counters();
  for (let pass = 0; pass < 5; pass += 1) assert.equal(ui.builder.render(), false);
  assert.deepEqual(ui.builder.counters(), { browser: { renders: before.browser.renders, skipped: before.browser.skipped + 5 }, inspector: { renders: before.inspector.renders, skipped: before.inspector.skipped + 5 } });
  // A rig edit that changes nothing the builder shows -- a movement's value --
  // is exactly the notification the lifecycle exists to absorb.
  ui.store.execute({ type: 'state/pose', domains: ['rig'], source: 'test', apply: (document) => { document.states.idle.lookX = .4; } });
  assert.equal(ui.builder.render(), false);
  const clicks = () => (ui.browserHost.listeners.get('click')?.size || 0) + (ui.inspectorHost.listeners.get('click')?.size || 0) + (ui.inspectorHost.listeners.get('change')?.size || 0);
  assert.equal(clicks(), 3);
  ui.builder.destroy();
  assert.equal(clicks(), 0);
  assert.equal(ui.browserHost.innerHTML, '');
  assert.equal(ui.inspectorHost.innerHTML, '');
  const revision = ui.store.getPersistentRevision();
  // The press itself, not the helper: `render()` after `destroy()` throws on
  // purpose (docs/VNEXT_COMPONENTS.md), and whoever destroys a workspace stops
  // calling render in the same breath.
  ui.inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset: { partTransform: 'x' }, value: '3' }) });
  ui.press({ partCategory: 'eyes' });
  assert.equal(ui.store.getPersistentRevision(), revision, 'a destroyed panel writes nothing');
  assert.deepEqual(ui.session(), { selectedId: 'tongue', selectedIds: ['mouth', 'teeth', 'tongue'] }, 'and selects nothing new: the mouth from before is still in hand');
  assert.throws(() => ui.builder.render(), /destroyed/);
});

test('the open category offers the library\'s styles for it, as cards that say what they are', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  const html = ui.browserHost.innerHTML;
  assert.match(html, /<div class="part-styles" role="group" aria-label="Mouth styles" data-part-styles="mouth">/);
  assert.match(html, /data-face-part="mouth.simple" aria-pressed="false" title="Use Simple: One curved line: a smile with nothing inside it\. Limited animation: teeth, tongue not carried\."/);
  assert.match(html, /data-face-part="mouth.wide" aria-pressed="false" title="Use Wide: A wide grin with a row of teeth\. Limited animation: tongue not carried\."/);
  assert.match(html, /<svg class="face-part-thumb" viewBox="[^"]+" width="48" height="48"[^>]*><g id="thumb-mouth-wide-mouth-wide"/, 'a thumbnail drawn from the asset, its ids kept off the mascot');
  assert.equal((html.match(/part-style-badge part-style-limited">Limited</g) || []).length, 4, 'four of the five mouths leave a movement out; the cartoon one carries everything');
  assert.match(html, /data-face-part="mouth.cartoon" aria-pressed="false" title="Use Cartoon: An open cartoon grin with teeth and a tongue\."/);
  assert.equal(html.includes('Current'), false, 'the template\'s mouth came from no asset');
  assert.match(html, /data-part-piece="mouth"/, 'the pieces are still offered above the styles');

  // A category the library has nothing for shows no styles; one the template
  // refuses shows the card, unpressable, with the reason on it.
  ui.press({ partCategory: 'nose' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="nose.dot"/);
  ui.press({ partCategory: 'pupils' });
  assert.equal(ui.browserHost.innerHTML.includes('data-part-styles'), false, 'the pupils come with the eyes: nothing of their own in the library');
  ui.press({ partCategory: 'eyes' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="eyes.plain" aria-pressed="false" disabled title="Eyes is drawn around other parts \(Pupils \/ Gaze \(leftPupil\), [^"]+\): replacing it would take them away too\."/);
  // A category with no part yet says Add, and keeps the way to Face Setup.
  ui.press({ partCategory: 'accessory' });
  assert.match(ui.browserHost.innerHTML, /Pick a style below, give the part its artwork in Face Setup/);
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.test-hat" aria-pressed="false" title="Add Hat: A flat hat\."/);
  assert.match(ui.browserHost.innerHTML, /data-character-route="face-setup"/);
  ui.press({ partCategory: 'facialHair' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="facialhair.beard" aria-pressed="false" title="Add Beard/, 'facial hair adds: a face wears several');
  // Without the commands there are no styles at all, and nothing to press.
  const plain = harness(createTemplateProjectState(), { styles: false });
  plain.press({ partCategory: 'mouth' });
  assert.equal(plain.browserHost.innerHTML.includes('data-part-styles'), false);
  assert.equal(plain.builder.useStyle('mouth.wide'), false);
});

test('a style card replaces the part as one undo step, selects the new pieces and says what still moves', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  const revision = ui.store.getPersistentRevision();
  ui.press({ facePart: 'mouth.wide' });
  const document = ui.store.getDocument();
  assert.ok(document.elements['mouth-wide'], 'the new mouth is on the mascot');
  assert.equal('tongue' in document.elements, false);
  assert.equal(ui.store.getPersistentRevision(), revision + 1, 'one write');
  assert.deepEqual(ui.installed.map((item) => item.rootId), ['mouth-wide']);
  assert.deepEqual(ui.session(), { selectedId: 'mouth-wide', selectedIds: ['mouth-wide'] }, 'the new part is in hand, as one piece: its root');
  assert.equal(ui.statuses.at(-1), 'Wide is the mouth now. mouthOpen, smile, mouthWidth, teeth still work; tongue has nothing to move on it. Undo puts the old one back.');
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="true" title="Wide: the mouth now\. Press to put the library drawing back\."/);
  assert.match(ui.browserHost.innerHTML, /part-style-badge">Current</);
  assert.match(ui.browserHost.innerHTML, /data-part-piece="mouth-wide" aria-pressed="true" title="Library part · Wide">Mouth</);
  assert.equal(ui.browserHost.innerHTML.includes('data-part-piece="teeth"'), false, 'the shapes inside are not pieces to pick apart here');
  assert.deepEqual(ui.builder.snapshot().categories.find((category) => category.id === 'mouth'), { id: 'mouth', status: 'ready', partId: 'mouth', assetId: 'mouth.wide', pieces: ['mouth-wide'] });
  assert.match(ui.inspectorHost.innerHTML, /<span class="small" data-part-style="mouth.wide">Style: Wide<\/span>/, 'the inspector names the style');
  assert.match(ui.inspectorHost.innerHTML, /<span class="semantic-badge">Mouth<\/span>/, 'and the part');
  assert.match(ui.inspectorHost.innerHTML, /data-part-piece-name>Mouth · Library part · Wide</);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-instance'), false, 'the root itself is in hand: nothing to redirect');

  // A shape inside the part, picked on the canvas: the inspector shows it,
  // and its fields move the whole part.
  ui.store.mutateSession(['selectedId', 'selectedIds'], (session) => { session.selectedId = 'teeth'; session.selectedIds = ['teeth']; });
  ui.builder.render();
  assert.equal(ui.browserHost.dataset.partActive, 'mouth', 'the teeth are the mouth');
  assert.equal(ui.inspectorHost.dataset.partPiece, 'teeth');
  assert.match(ui.inspectorHost.innerHTML, /data-part-instance="mouth-wide">Position, size and turn are the whole part's \(Mouth\)/);
  ui.field({ partTransform: 'x' }, '7');
  assert.equal(ui.element('mouth-wide').baseTransform.x, 7, 'the root moved');
  assert.equal(ui.element('teeth').baseTransform.x, 0, 'the teeth stayed inside it');
  assert.match(ui.inspectorHost.innerHTML, /data-part-transform="x" aria-label="X position" value="7"/, 'and the field shows the root\'s');
  ui.history.undo();
  ui.builder.render();

  // Back on the root, then Undo: what was selected is gone, and the
  // category the author pressed stays open with its styles.
  ui.press({ partCategory: 'mouth' });
  assert.deepEqual(ui.session(), { selectedId: 'mouth-wide', selectedIds: ['mouth-wide'] });
  ui.history.undo();
  ui.builder.render();
  assert.equal('tongue' in ui.store.getDocument().elements, true, 'one undo, and the old mouth is back');
  assert.equal(ui.history.getState().canUndo, false);
  assert.equal(ui.session().selectedId, 'mouth-wide', 'the session still names what is gone');
  assert.equal(ui.browserHost.dataset.partActive, 'mouth', 'and the browser is still on the mouth');
  assert.equal(ui.inspectorHost.dataset.partKind, 'category', 'with nothing in hand');
  assert.equal(ui.builder.snapshot().categories.find((category) => category.id === 'mouth').assetId, null);
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="false"/);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-style='), false);
});

test('a style the mascot refuses is reported and writes nothing', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyes' });
  const revision = ui.store.getPersistentRevision();
  // The browser leaves a disabled card alone; the builder itself refuses too, for a press that gets through.
  assert.equal(ui.builder.useStyle('eyes.plain'), false);
  assert.match(ui.statuses.at(-1), /^error: Could not use Plain: Eyes is drawn around other parts/);
  assert.equal(ui.builder.useStyle('mouth.wide'), false, 'a mouth is not a pair of eyes');
  assert.match(ui.statuses.at(-1), /^error: Could not use Wide: "mouth.wide" is not a eyes asset\./);
  assert.equal(ui.store.getPersistentRevision(), revision);
  assert.equal(ui.history.getState().canUndo, false);
  assert.equal(ui.faceCanvas.calls.replace.length, 0);
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.builder.useStyle('mouth.wide'), false, 'no category with a part is open');
});

test('a library head of hair moves as one: the back it paints behind the face follows the root', () => {
  const ui = harness();
  ui.press({ partCategory: 'hair' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="hair.long"/);
  ui.press({ facePart: 'hair.long' });
  assert.deepEqual(ui.session(), { selectedId: 'hair-long', selectedIds: ['hair-long'] });
  assert.deepEqual(ui.builder.snapshot().categories.find((category) => category.id === 'hair'), { id: 'hair', status: 'ready', partId: 'hair', assetId: 'hair.long', pieces: ['hair-long'] });
  assert.ok(ui.element('hairBack') && !ui.store.getDocument().layers.find((layer) => layer.id === 'faceRoot')?.children?.find((child) => child.id === 'hair-long')?.children?.some((child) => child.id === 'hairBack'), 'the back sits outside the root');
  const revision = ui.store.getPersistentRevision();
  ui.field({ partTransform: 'x' }, '9');
  assert.deepEqual([ui.element('hair-long').baseTransform.x, ui.element('hairBack').baseTransform.x], [9, 9], 'both moved');
  assert.equal(ui.store.getPersistentRevision(), revision + 2, 'two writes');
  ui.history.undo();
  assert.deepEqual([ui.element('hair-long').baseTransform.x, ui.element('hairBack').baseTransform.x], [0, 0], 'one undo step');
  ui.field({ partScale: '' }, '1.1');
  assert.deepEqual([ui.element('hair-long').baseTransform.scaleY, ui.element('hairBack').baseTransform.scaleY], [1.1, 1.1]);
  // A click on the back on the canvas lands on the hair, and its fields move the whole head of hair.
  ui.store.mutateSession(['selectedId', 'selectedIds'], (session) => { session.selectedId = 'hairBack'; session.selectedIds = ['hairBack']; });
  ui.builder.render();
  assert.equal(ui.browserHost.dataset.partActive, 'hair');
  assert.match(ui.inspectorHost.innerHTML, /data-part-instance="hair-long"/);
  ui.field({ partTransform: 'y' }, '-4');
  assert.deepEqual([ui.element('hair-long').baseTransform.y, ui.element('hairBack').baseTransform.y], [-4, -4]);
});

test('Colours is one swatch a token, read from the face, and a pick changes every use as one undo step', () => {
  const ui = harness();
  ui.press({ partCategory: 'palette' });
  assert.deepEqual(ui.session(), { selectedId: null, selectedIds: [] }, 'nothing in hand: the colours are the whole face\'s');
  assert.equal(ui.inspectorHost.dataset.partKind, 'category');
  for (const host of [ui.browserHost, ui.inspectorHost]) {
    assert.match(host.innerHTML, /data-face-token="skin" title="#f9d9b0 · 4 uses · click to change"/, 'the skull, the ears and a lid: everything painted like the skull');
    assert.match(host.innerHTML, /data-face-token="outline" title="#a4674a · 2 uses/);
    assert.match(host.innerHTML, /data-face-token="hair" title="#5b3a1e · 2 uses/);
    assert.match(host.innerHTML, /data-face-token="eyeWhite" title="#ffffff · 3 uses/, 'the teeth are painted like the whites, so they are the whites');
    assert.equal(host.innerHTML.includes('data-face-token="teeth"'), false);
    assert.equal(host.innerHTML.includes('data-face-token="skinShadow"'), false, 'the nose is a line: no skin shadow on this face');
  }
  assert.deepEqual(ui.builder.snapshot().palette, { skin: '#f9d9b0', outline: '#a4674a', hair: '#5b3a1e', hairShadow: '#4a2f18', eyeWhite: '#ffffff', pupil: '#10172a', mouth: '#b83a3a', tongue: '#e06060' });
  ui.press({ faceToken: 'skin' });
  assert.equal(ui.colourRequests.length, 1);
  assert.deepEqual([ui.colourRequests[0].title, ui.colourRequests[0].value], ['Skin colour', '#f9d9b0']);
  const revision = ui.store.getPersistentRevision();
  ui.colourRequests[0].onPick('#88cc88');
  for (const id of ['head', 'earLeftShape', 'earRightShape', 'lidUpperLeft']) assert.equal(ui.paints[id].fill, '#88cc88', `${id} is green`);
  assert.equal(ui.paints.lidUpperLeft.stroke, '#a4674a', 'the outline is another token');
  assert.equal(ui.store.getPersistentRevision(), revision + 4, 'four writes');
  assert.match(ui.statuses.at(-1), /^Skin is #88cc88 now, on 4 pieces\. Undo puts it back\./);
  assert.match(ui.browserHost.innerHTML, /data-face-token="skin" title="#88cc88 · 4 uses/, 'read again');
  ui.history.undo();
  assert.equal(ui.history.getState().canUndo, false, 'one undo step for the four');
  // (The stand-in paint table does not follow the history; the real canvas reads its paints back from the document.)
  ui.pressInspector({ faceToken: 'nope' });
  assert.equal(ui.colourRequests.length, 1, 'a token the face has not got opens nothing');
  // A library part comes in the face's colours.
  ui.colourRequests[0].onPick('#88cc88');
  ui.press({ partCategory: 'head' });
  ui.press({ facePart: 'head.round' });
  assert.match(ui.faceCanvas.calls.replace.at(-1).fragment, /<circle id="skull" data-name="Skull" cx="120" cy="116" r="94" fill="#88cc88" stroke="#a4674a"/, 'the skull is green, and outlined in the face\'s outline');
});

test('a face wears several accessories: one per mount point, each its own piece, taken off one at a time', () => {
  const ui = harness();
  ui.press({ partCategory: 'accessory' });
  ui.press({ facePart: 'accessory.glasses' });
  assert.deepEqual(ui.session(), { selectedId: 'accessory-glasses', selectedIds: ['accessory-glasses'] });
  ui.press({ facePart: 'accessory.hat' });
  assert.deepEqual(ui.session(), { selectedId: 'accessory-hat', selectedIds: ['accessory-hat'] }, 'the one that just went on is in hand');
  const category = ui.builder.snapshot().categories.find((item) => item.id === 'accessory');
  assert.deepEqual([category.status, category.pieces, category.assetIds], ['ready', ['accessory-glasses', 'accessory-hat'], ['accessory.glasses', 'accessory.hat']], 'both on the face, each its own part');
  assert.equal(Object.values(ui.store.getDocument().semanticParts).filter((part) => part.type === 'accessory').length, 2);
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.glasses" aria-pressed="true" title="Glasses: on the face now/);
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.hat" aria-pressed="true"/);
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.earring" aria-pressed="false" title="Add Earring/);
  assert.match(ui.browserHost.innerHTML, /data-part-piece="accessory-glasses" aria-pressed="false"[^>]*>Glasses</);
  // Remove takes one off, as one undo step; the other stays.
  assert.match(ui.inspectorHost.innerHTML, /<button type="button" class="secondary" data-part-remove aria-label="Remove Hat">Remove<\/button>/);
  ui.pressInspector({ partRemove: '' });
  assert.equal('accessory-hat' in ui.store.getDocument().elements, false);
  assert.ok(ui.store.getDocument().elements['accessory-glasses'], 'the glasses stay');
  assert.deepEqual(ui.session(), { selectedId: null, selectedIds: [] });
  assert.equal(ui.statuses.at(-1), 'Hat is off. Undo puts it back.');
  assert.deepEqual(ui.builder.snapshot().categories.find((item) => item.id === 'accessory').pieces, ['accessory-glasses']);
  ui.history.undo();
  ui.builder.render();
  assert.ok(ui.store.getDocument().elements['accessory-hat'], 'one undo, and the hat is back');
  assert.deepEqual(ui.builder.snapshot().categories.find((item) => item.id === 'accessory').pieces, ['accessory-glasses', 'accessory-hat']);
  // A part that is not an accessory has no Remove.
  ui.press({ partCategory: 'nose' });
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-remove'), false);
  assert.equal(ui.builder.removePart('nose'), false);
  // Facial hair the same way: a moustache and a beard together.
  ui.press({ partCategory: 'facialHair' });
  ui.press({ facePart: 'facialhair.moustache' });
  ui.press({ facePart: 'facialhair.beard' });
  assert.deepEqual(ui.builder.snapshot().categories.find((item) => item.id === 'facialHair').pieces, ['facial-hair-moustache', 'facial-hair-beard']);
});

test('Presets are the library\'s recipes: a card each with a picture, one press applies as one undo step, the one worn is marked', () => {
  const ui = harness();
  ui.press({ partCategory: 'presets' });
  const html = ui.browserHost.innerHTML;
  assert.match(html, /data-character-preset="basic"/, 'the template stays, to start over');
  for (const id of ['classic', 'professor', 'young', 'old', 'robot', 'minimal']) assert.match(html, new RegExp(`data-face-preset="${id}" aria-pressed="false" title="`), `${id} is offered`);
  assert.match(html, /<span class="face-preset-thumb"><svg class="face-preset-thumb" viewBox="-10 -30 260 260"[^>]*><g id="pv-classic-ears-round-ears-round" data-name="Ears">/, 'a picture from the parts');
  assert.match(html, /data-preset-reset disabled title="The face wears no preset\."/);
  assert.match(html, /<form class="preset-save" data-preset-save-form><label>Save the face as a preset<input type="text" data-preset-name/);
  assert.equal(ui.builder.snapshot().preset, null);
  const revision = ui.store.getPersistentRevision();
  ui.press({ facePreset: 'professor' });
  assert.equal(ui.builder.snapshot().preset, 'professor');
  assert.ok(ui.store.getDocument().elements['accessory-glasses'] && ui.store.getDocument().elements['facial-hair-moustache']);
  assert.ok(ui.store.getPersistentRevision() > revision + 5, 'many writes');
  assert.match(ui.statuses.at(-1), /^Professor is on: \d+ steps, one undo\./);
  assert.match(ui.browserHost.innerHTML, /data-face-preset="professor" aria-pressed="true" title="Professor: what the face wears/);
  assert.match(ui.browserHost.innerHTML, /part-style-badge">Current</);
  assert.match(ui.browserHost.innerHTML, /data-preset-reset title="Every part back where the preset puts it/);
  assert.deepEqual(ui.session(), { selectedId: null, selectedIds: [] });
  ui.history.undo();
  ui.builder.render();
  assert.equal(ui.history.getState().canUndo, false, 'one undo step for the whole preset');
  assert.equal(ui.builder.snapshot().preset, null);
  assert.equal('accessory-glasses' in ui.store.getDocument().elements, false);
  // Reset: the parts back where the preset puts them, after the author moved one.
  ui.press({ facePreset: 'robot' });
  const placed = structuredClone(ui.store.getDocument().elements['nose-cartoon'].baseTransform);
  ui.store.execute({ type: 'test/move', domains: ['artwork'], source: 'test', apply: (document) => { document.elements['nose-cartoon'].baseTransform.x = placed.x + 9; document.elements['nose-cartoon'].baseTransform.scaleX = 2; } });
  ui.builder.render();
  assert.equal(ui.builder.snapshot().preset, 'robot', 'a moved nose is still the robot');
  ui.press({ presetReset: '' });
  const reset = ui.store.getDocument().elements['nose-cartoon'].baseTransform;
  for (const key of Object.keys(placed)) assert.ok(Math.abs(reset[key] - placed[key]) < 0.01, `back where the preset puts it, at the size it gives it:  is , not `);
  assert.equal(ui.builder.snapshot().preset, 'robot');
  // Save: the face as a preset of the author's own, kept in storage, offered as a card, forgotten on request.
  ui.press({ partCategory: 'accessory' });
  ui.press({ facePart: 'accessory.hat' });
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.builder.snapshot().preset, null, 'a hat the robot does not wear');
  ui.browserHost.dispatch('submit', { target: clickTarget({ tag: 'form', dataset: { presetSaveForm: '' } }), name: { value: ' Robot in a hat ' } });
  assert.match(ui.statuses.at(-1), /^Robot in a hat is saved as a preset of yours\./);
  assert.equal(ui.builder.snapshot().preset, 'robot-in-a-hat');
  assert.match(ui.browserHost.innerHTML, /data-face-preset="robot-in-a-hat" aria-pressed="true"/);
  assert.match(ui.browserHost.innerHTML, /data-preset-forget="robot-in-a-hat" title="Forget this preset">Robot in a hat ×<\/button>/);
  assert.match(ui.stored.get('boop.facePresets'), /"accessory.hat"/);
  ui.press({ presetForget: 'robot-in-a-hat' });
  assert.equal(ui.browserHost.innerHTML.includes('data-face-preset="robot-in-a-hat"'), false);
  assert.equal(ui.builder.snapshot().preset, null);
  assert.equal(JSON.parse(ui.stored.get('boop.facePresets')).length, 0);
  assert.equal(ui.builder.useFacePreset('nope'), false);
  assert.match(ui.statuses.at(-1), /^error: There is no preset called "nope"\./);
});
