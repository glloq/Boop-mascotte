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
const { PART_DRAG_TYPE } = await import('../../ui/character-builder/part-drag.js');
const { describeHands } = await import('../../ui/character-builder/hand-placement-panel.js');

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
  const browserHost = document.createElementNS('', 'div'), inspectorHost = document.createElementNS('', 'div'), dropHost = document.createElementNS('', 'section');
  const applied = [], routes = [], tools = [], statuses = [], colourRequests = [], templates = [], installed = [], scopes = [], drawn = [];
  let active = true;
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
    browserHost, inspectorHost, store, history, canvas, dropHost, isActive: () => active,
    navigate: (route) => routes.push(route),
    setDesignTool: (tool) => tools.push(tool),
    openColour: (request) => colourRequests.push(request),
    loadTemplate: (kind) => { templates.push(kind); return true; },
    // The picker's press, stood in for: the drawing joins the hand's library as one command.
    drawHandStyle: (side, style) => {
      drawn.push([side, style]);
      const hand = store.getDocument().hands?.[side];
      if (!hand?.styles || hand.styles.library.some((entry) => entry.id === style)) return false;
      history.snapshot();
      store.execute({ type: 'test/draw-style', domains: ['hands'], source: 'test', apply: (d) => { d.hands[side].styles.library.push({ id: style, label: style, element: `hand${side === 'left' ? 'Left' : 'Right'}Style-${style}`, mirrored: false }); } });
      return true;
    },
    facePartCommands: styles ? createFacePartCommands(store, history, canvas, { library: registry, presets: presetRegistry, presetStorage: presetStorage, onInstalled: (summary) => installed.push(summary) }) : null,
    onStatus: (message, tone) => statuses.push(tone ? `${tone}: ${message}` : message)
  });
  builder.render();
  return {
    store, history, builder, browserHost, inspectorHost, dropHost, applied, routes, setActive: (value) => { active = value; }, tools, statuses, colourRequests, templates, paints, installed, faceCanvas, stored, scopes, drawn, library: registry,
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

test('a hand is placed like any piece, its depth is the hand\'s own, and Mirror placement makes the other its mirror image as one undo step', () => {
  const ui = harness();
  ui.press({ partCategory: 'hands' });
  assert.deepEqual(ui.session(), { selectedId: 'handRight', selectedIds: ['handLeft', 'handRight'] });
  assert.match(ui.inspectorHost.innerHTML, /data-hand-placement="right"/);
  for (const field of ['data-part-transform="x"', 'data-part-transform="y"', 'data-part-transform="rotation"', 'data-part-scale', 'data-hand-depth', 'data-hand-mirror aria-label="Mirror the placement of Right hand onto Left hand"', 'data-part-edit-shape']) assert.ok(ui.inspectorHost.innerHTML.includes(field), `${field} is offered`);
  assert.match(ui.inspectorHost.innerHTML, /The rig moves right hand from where it is put here/);
  assert.match(ui.browserHost.innerHTML, /data-character-route="hand-setup"/);
  // Position, turn and size are the artwork's base transform, which the rig adds its movement to.
  ui.inspectorHost.dispatch('change', { target: { dataset: { partTransform: 'x' }, value: '12' } });
  ui.inspectorHost.dispatch('change', { target: { dataset: { partTransform: 'rotation' }, value: '-8' } });
  assert.equal(ui.store.getDocument().elements.handRight.baseTransform.x, 12);
  assert.equal(ui.store.getDocument().elements.handRight.baseTransform.rotation, -8);
  assert.equal(ui.store.getDocument().elements.handLeft.baseTransform.x, 0, 'the hands are not a linked pair: one moves alone');
  // Depth is the hand's own.
  ui.inspectorHost.dispatch('change', { target: { dataset: { handDepth: '' }, value: '0.6' } });
  assert.equal(ui.store.getDocument().hands.right.depth, 0.6);
  assert.match(ui.statuses.at(-1), /^Right hand rests at depth 0\.6, in front\. Undo puts it back\.$/);
  ui.inspectorHost.dispatch('change', { target: { dataset: { handDepth: '' }, value: '7' } });
  assert.equal(ui.store.getDocument().hands.right.depth, 1, 'clamped');
  // Mirror: the left hand becomes the mirror image, one undo step.
  const before = ui.history.getState();
  const leftBefore = structuredClone(ui.store.getDocument().hands.left);
  ui.pressInspector({ handMirror: '' });
  const left = ui.store.getDocument().elements.handLeft.baseTransform;
  assert.deepEqual([left.x, left.y, left.rotation, left.scaleX], [-12, 0, 8, ui.store.getDocument().elements.handRight.baseTransform.scaleX]);
  assert.equal(ui.store.getDocument().hands.left.depth, 1, 'depth mirrored by the hand model');
  assert.equal(ui.store.getDocument().hands.left.element, 'handLeft', 'the left keeps its own artwork');
  assert.deepEqual(ui.store.getDocument().hands.left.styles, leftBefore.styles, 'and its own drawings');
  assert.match(ui.statuses.at(-1), /^Left hand is the mirror of the right hand now/);
  assert.deepEqual(ui.applied.at(-1)[0], 'handLeft', 'the canvas is told');
  ui.history.undo();
  assert.deepEqual(ui.store.getDocument().hands.left, leftBefore, 'one undo, and the left hand is as it was');
  assert.equal(ui.store.getDocument().elements.handLeft.baseTransform.x, 0);
  assert.equal(ui.history.getState().canUndo, before.canUndo);
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
  assert.match(html, /data-face-part="mouth.simple" aria-pressed="false" title="Use Simple: One curved line: a smile with nothing inside it\. Limited animation: ✓ mouthOpen ✓ smile ✓ mouthWidth – teeth – tongue\."/);
  assert.match(html, /data-face-part="mouth.wide" aria-pressed="false" title="Use Wide: A wide grin with a row of teeth\. Limited animation: ✓ mouthOpen ✓ smile ✓ mouthWidth ✓ teeth – tongue\."/);
  assert.match(html, /data-face-part="mouth.cartoon" aria-pressed="false" title="Use Cartoon: [^"]*Fully animated: ✓ mouthOpen ✓ smile ✓ mouthWidth ✓ teeth ✓ tongue\."/);
  assert.match(html, /<svg class="face-part-thumb" viewBox="[^"]+" width="48" height="48"[^>]*><g id="thumb-mouth-wide-mouth-wide"/, 'a thumbnail drawn from the asset, its ids kept off the mascot');
  assert.equal((html.match(/part-style-badge part-style-limited">Limited</g) || []).length, 4, 'four of the five mouths leave a movement out; the cartoon one carries everything');
  assert.match(html, /data-face-part="mouth.cartoon" aria-pressed="false" title="Use Cartoon: An open cartoon grin with teeth and a tongue\. Fully animated: ✓ mouthOpen ✓ smile ✓ mouthWidth ✓ teeth ✓ tongue\."/);
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
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="true" title="Wide: the mouth now\. Press to put the library drawing back\. Limited animation: ✓ mouthOpen ✓ smile ✓ mouthWidth ✓ teeth – tongue\."/);
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
  assert.equal(ui.builder.useStyle('mouth.nope'), false, 'an asset the library has not got goes to the open category, which refuses it');
  assert.match(ui.statuses.at(-1), /^error: Could not use mouth\.nope: There is no asset called "mouth\.nope"\./);
  assert.equal(ui.store.getPersistentRevision(), revision);
  assert.equal(ui.history.getState().canUndo, false);
  assert.equal(ui.faceCanvas.calls.replace.length, 0);
  // An asset is its own category's: pressed with Presets open, the mouth opens and takes it (a card dropped on the mascot comes this way).
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.builder.useStyle('mouth.wide'), true);
  assert.equal(ui.browserHost.dataset.partActive, 'mouth');
  assert.ok(ui.element('mouth-wide'));
  ui.history.undo();
  assert.equal(ui.history.getState().canUndo, false, 'one step');
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
  assert.match(ui.faceCanvas.calls.replace.at(-1).fragment, /<path id="skull" data-name="Skull" d="[^"]*" fill="#88cc88" stroke="#a4674a"/, 'the skull is green, and outlined in the face\'s outline');
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
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.earring" aria-pressed="false" title="Add Left earring/);
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

test('the drawings of each hand are cards: a press rests the hand on one, and draws one it has not got, as one undo step', () => {
  const state = createTemplateProjectState();
  state.hands.left.styles.library = state.hands.left.styles.library.filter((entry) => ['relaxed', 'fist'].includes(entry.id));
  const ui = harness(state);
  ui.press({ partCategory: 'hands' });
  const html = ui.browserHost.innerHTML;
  assert.equal((html.match(/data-hand-style="/g) || []).length, 12, 'six cards a hand');
  assert.match(html, /<h4 class="hand-styles-heading">Left hand · drawings<\/h4><div class="part-styles hand-styles" role="group" aria-label="Drawings of the left hand" data-hand-styles="left">/);
  assert.match(html, /data-hand-style="left:relaxed" aria-pressed="true" title="Relaxed: what left hand rests on" draggable="true" data-drag="hand-style:left:relaxed"><span class="part-style-thumb hand-style-thumb"><svg viewBox="0 0 200 200" class="hand-thumb" aria-hidden="true" focusable="false"><path d="/, 'a picture of the drawing, id-free');
  assert.match(html, /class="part-style hand-style hand-style-offer" data-hand-style="left:open" aria-pressed="false" title="Open is not drawn on this hand yet: press to draw it and rest on it"/);
  assert.match(html, /data-hand-style="right:peace" aria-pressed="false" title="Rest right hand on Peace"/);
  assert.deepEqual(ui.builder.snapshot().hands, [{ side: 'left', element: 'handLeft', resting: 'relaxed', drawn: ['relaxed', 'fist'] }, { side: 'right', element: 'handRight', resting: 'relaxed', drawn: ['relaxed', 'open', 'fist', 'point', 'thumbsUp', 'peace'] }]);
  // A drawing the hand has: the resting style, one undo step.
  ui.press({ handStyle: 'left:fist' });
  assert.equal(ui.store.getDocument().hands.left.styles.showing, 'fist');
  assert.deepEqual(ui.session(), { selectedId: 'handLeft', selectedIds: ['handLeft'] }, 'the hand is in hand');
  assert.match(ui.statuses.at(-1), /^Left hand rests on Fist now/);
  assert.match(ui.browserHost.innerHTML, /data-hand-style="left:fist" aria-pressed="true"/);
  assert.deepEqual(ui.drawn, [], 'nothing to draw');
  // One it has not: drawn, then rested on, as one step.
  const revision = ui.store.getPersistentRevision();
  ui.press({ handStyle: 'left:peace' });
  assert.deepEqual(ui.drawn, [['left', 'peace']]);
  assert.equal(ui.store.getDocument().hands.left.styles.showing, 'peace');
  assert.ok(ui.store.getDocument().hands.left.styles.library.some((entry) => entry.id === 'peace'));
  assert.match(ui.statuses.at(-1), /^Peace is drawn on the left hand, and the hand rests on it\. One undo takes both back\.$/);
  assert.ok(ui.store.getPersistentRevision() > revision + 1, 'two writes');
  ui.history.undo();
  assert.equal(ui.store.getDocument().hands.left.styles.showing, 'fist', 'one undo, and both are back');
  assert.equal(ui.store.getDocument().hands.left.styles.library.some((entry) => entry.id === 'peace'), false);
  // The press that cannot draw says so and writes nothing.
  ui.press({ handStyle: 'left:peace' });
  ui.press({ handStyle: 'left:peace' });
  assert.equal(ui.builder.useHandStyle('left:nope'), false);
  assert.equal(ui.builder.useHandStyle('nope'), false);
});

test('a piece in hand is saved as a library part of the author\'s own, offered as a card marked Mine, and forgotten again', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.pressInspector({ partPiece: 'mouth' });
  const html = ui.inspectorHost.innerHTML;
  assert.match(html, /<form class="part-save" data-part-save-form>/);
  assert.match(html, /<select data-part-save-category aria-label="Category"><option value="head">Head<\/option>.*<option value="mouth" selected>Mouth<\/option>/s, 'the piece\'s own category first');
  assert.match(html, /<select data-part-save-role="mouth" aria-label="Mouth role" required><option value="mouth" selected>Mouth<\/option><\/select>/, 'the role the part names, among the shapes the piece carries');
  assert.match(html, /<select data-part-save-role="teeth" aria-label="Teeth role"><option value="" selected>—<\/option><option value="mouth">Mouth<\/option><\/select>/, 'an optional role left empty');
  assert.match(html, /<select data-part-save-mount aria-label="Mount point">.*<option value="mouth.center" selected>mouth.center<\/option>/s);
  // The category can change; the name typed so far stays.
  ui.inspectorHost.dispatch('change', { target: { dataset: { partSaveName: '' }, value: 'My mouth' } });
  ui.inspectorHost.dispatch('change', { target: { dataset: { partSaveCategory: '' }, value: 'nose' } });
  assert.match(ui.inspectorHost.innerHTML, /<option value="nose" selected>Nose<\/option>/);
  assert.match(ui.inspectorHost.innerHTML, /<select data-part-save-role="nose" aria-label="Nose role" required><option value="mouth" selected>Mouth<\/option>/, 'a lone shape plays the one role');
  assert.match(ui.inspectorHost.innerHTML, /data-part-save-name placeholder="A name" maxlength="40" required value="My mouth"/);
  // Saved: a style card of the author's, under its category.
  ui.inspectorHost.dispatch('submit', { target: clickTarget({ tag: 'form', dataset: { partSaveForm: '' } }), name: { value: 'My mouth' }, category: { value: 'mouth' }, roles: { mouth: 'mouth' }, mountPoint: { value: 'mouth.center' } });
  assert.match(ui.statuses.at(-1), /^My mouth is in the library now, under Mouth: a style card of yours/);
  assert.ok(ui.library.has('mouth.my-mouth'));
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.my-mouth" aria-pressed="false" title="Use My mouth Fully animated: ✓ mouthOpen ✓ smile ✓ mouthWidth ✓ teeth ✓ tongue\." draggable="true" data-drag="face-part:mouth.my-mouth"><span class="part-style-thumb" aria-hidden="true"><svg/, 'a card, with a picture, its movements the part\'s, dragged as itself');
  assert.match(ui.browserHost.innerHTML, /part-style-badge part-style-mine">Mine</);
  assert.match(ui.browserHost.innerHTML, /<div class="preset-own part-own"><button type="button" class="chip" data-face-part-forget="mouth.my-mouth" title="Forget this part of yours">My mouth ×<\/button><\/div>/);
  assert.match(ui.stored.get('boop.faceParts'), /"mouth\.my-mouth"/, 'kept in the browser');
  // The draft is spent; a refusal says why.
  assert.match(ui.inspectorHost.innerHTML, /data-part-save-name placeholder="A name" maxlength="40" required value=""/);
  ui.inspectorHost.dispatch('submit', { target: clickTarget({ tag: 'form', dataset: { partSaveForm: '' } }), name: { value: '' }, category: { value: 'mouth' }, roles: { mouth: 'mouth' } });
  assert.equal(ui.statuses.at(-1), 'error: Give the part a name.');
  // Forgotten.
  ui.press({ facePartForget: 'mouth.my-mouth' });
  assert.match(ui.statuses.at(-1), /^My mouth is forgotten\./);
  assert.equal(ui.browserHost.innerHTML.includes('data-face-part="mouth.my-mouth"'), false);
  assert.equal(ui.library.has('mouth.my-mouth'), false);
});

test('a library instance reshaped by hand is custom: said in the inspector, no card current, and the card puts the library drawing back', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.press({ facePart: 'mouth.wide' });
  assert.equal(ui.store.getDocument().semanticParts.mouth.assetId, 'mouth.wide');
  assert.match(ui.store.getDocument().semanticParts.mouth.assetShape, /^s[0-9a-z]+$/, 'the install leaves the word its shapes sign as');
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="true"/);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-custom'), false);
  // A point dragged (as Edit Shape's Node tool writes it): the drawing no longer signs as the install left it.
  ui.store.execute({ type: 'test/reshape', domains: ['artwork'], source: 'test', apply: (document) => { document.svgMarkup = document.svgMarkup.replace(/(<path id="mouth"[^>]*\sd=")([^"]*)"/, (_, head, d) => `${head}${d.replace(/\d/, (digit) => String((Number(digit) + 1) % 10))}"`); } });
  ui.builder.render();
  assert.match(ui.inspectorHost.innerHTML, /<p class="small" data-part-custom>Reshaped by hand: this is yours now, from the library\x27s Wide\. Its roles and movements are kept; the Wide card puts the library drawing back\.<\/p>/);
  assert.match(ui.inspectorHost.innerHTML, /Custom · from Wide/);
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="false"/, 'no card is current for the author\'s own drawing');
  assert.equal(ui.builder.snapshot().categories.find((category) => category.id === 'mouth').custom, true);
  assert.deepEqual(ui.store.getDocument().semanticParts.mouth.roles, { mouth: 'mouth', teeth: 'teeth' }, 'the roles are kept');
  // The card puts the library drawing back.
  ui.press({ facePart: 'mouth.wide' });
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-custom'), false);
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="true"/);
  assert.equal('custom' in ui.builder.snapshot().categories.find((category) => category.id === 'mouth'), false);
});

test('Reset puts a library instance back where its fit put it, paints it again in the face\'s tokens, and restores the library drawing, each one undo step', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.press({ facePart: 'mouth.wide' });
  const root = () => ui.store.getDocument().elements['mouth-wide'].baseTransform;
  const fit = { ...ui.store.getDocument().semanticParts.mouth.assetFit };
  assert.match(ui.inspectorHost.innerHTML, /<div class="action-row part-resets" role="group" aria-label="Reset Mouth"><button type="button" class="secondary" data-part-reset="position" title="Back where the fit put it, at the size it gave it, unturned">Reset position<\/button><button type="button" class="secondary" data-part-reset="colours"/);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-reset="shape"'), false, 'nothing to restore on a drawing the library\'s own');
  assert.match(ui.inspectorHost.innerHTML, /data-part-reset="all" title="The drawing, the colours and the place, as one step">Reset all<\/button>/);
  // Moved, turned and enlarged by the author; position puts the fit's place and size back, unturned.
  ui.inspectorHost.dispatch('change', { target: { dataset: { partTransform: 'x' }, value: '7' } });
  ui.inspectorHost.dispatch('change', { target: { dataset: { partTransform: 'rotation' }, value: '5' } });
  ui.inspectorHost.dispatch('change', { target: { dataset: { partScale: '' }, value: String(fit.scaleX * 1.3) } });
  assert.deepEqual([root().x, root().rotation], [7, 5]);
  ui.pressInspector({ partReset: 'position' });
  assert.deepEqual([root().x, root().y, root().rotation, root().scaleX, root().scaleY], [fit.x, fit.y, 0, fit.scaleX, fit.scaleY]);
  assert.match(ui.statuses.at(-1), /^Mouth: its place, turn and size back\. Undo puts it as it was\.$/);
  ui.history.undo();
  assert.deepEqual([root().x, root().rotation], [7, 5], 'one undo');
  // Shape: a point dragged, then the library drawing back where this one is, as one step.
  ui.store.execute({ type: 'test/reshape', domains: ['artwork'], source: 'test', apply: (document) => { document.svgMarkup = document.svgMarkup.replace(/(<path id="mouth"[^>]*\sd=")([^"]*)"/, (_, head, d) => `${head}${d.replace(/\d/, (digit) => String((Number(digit) + 1) % 10))}"`); } });
  ui.builder.render();
  assert.match(ui.inspectorHost.innerHTML, /data-part-reset="shape" title="The library&#39;s Wide drawn again, where this one is">Restore library drawing<\/button>/);
  const before = ui.history.getState();
  ui.pressInspector({ partReset: 'shape' });
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-custom'), false, 'the library\'s again');
  assert.deepEqual([root().x, root().rotation], [7, 5], 'where the author had put it');
  assert.match(ui.statuses.at(-1), /^Mouth: the library drawing back\./);
  ui.history.undo();
  ui.builder.render();
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-custom'), true, 'one undo, and the author\'s drawing is back');
  assert.equal(ui.history.getState().canUndo, before.canUndo);
  // All: the drawing, the colours and the place, as one step.
  ui.pressInspector({ partReset: 'all' });
  assert.deepEqual([root().x, root().rotation, root().scaleX], [fit.x, 0, fit.scaleX]);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-custom'), false);
  assert.match(ui.statuses.at(-1), /^Mouth: its place, turn and size, the library drawing, its colours back\./);
  ui.history.undo();
  assert.deepEqual([root().x, root().rotation], [7, 5], 'one undo for all three');
  // Colours: a pair of ears painted skin, one recoloured by hand, painted again in the face's skin and outline.
  ui.press({ partCategory: 'ears' });
  ui.press({ facePart: 'ears.round' });
  // The fake canvas knows no paint for a piece the library drew until one is
  // written: the author's recolour is that write. The paint is on the shape
  // inside the ear's group, which is what plays the token -- the group is what
  // the earring hangs in (V3-03).
  ui.paints.earLeftShape = { fill: '#000000', stroke: '#000000' };
  ui.pressInspector({ partReset: 'colours' });
  assert.deepEqual(ui.paints.earLeftShape, { fill: '#f9d9b0', stroke: '#a4674a' });
  assert.match(ui.statuses.at(-1), /^Ears: its colours back\./);
  // The template's own piece: back where it was drawn; a hand has its own placement.
  ui.press({ partCategory: 'nose' });
  ui.inspectorHost.dispatch('change', { target: { dataset: { partTransform: 'y' }, value: '-4' } });
  assert.equal(ui.store.getDocument().elements.nose.baseTransform.y, -4);
  assert.match(ui.inspectorHost.innerHTML, /data-part-reset="position" title="Back where it was drawn, unturned, at its own size"/);
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-reset="colours"'), false);
  ui.pressInspector({ partReset: 'position' });
  assert.equal(ui.store.getDocument().elements.nose.baseTransform.y, 0);
  ui.press({ partCategory: 'hands' });
  assert.equal(ui.inspectorHost.innerHTML.includes('data-part-reset'), false);
  assert.equal(ui.builder.resetPart('handLeft', 'position'), false);
});

/* ── Drag & drop (docs/CHARACTER_BUILDER.md, "Drag & drop"; roadmap phase 22) ── */

/** The drag data a browser hands a card, stood in for. */
function transfer(payload = null) {
  const data = new Map(payload ? [[PART_DRAG_TYPE, payload]] : []);
  return { types: [...data.keys()], effectAllowed: 'uninitialized', dropEffect: 'none', setData(type, value) { data.set(type, String(value)); if (!this.types.includes(type)) this.types.push(type); }, getData: (type) => data.get(type) ?? '' };
}

test('a card picked up carries what it is, and a card that cannot be pressed carries nothing', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyes' });
  const html = ui.browserHost.innerHTML;
  const revision = ui.store.getPersistentRevision();
  assert.match(html, /data-face-part="eyes.cartoon" aria-pressed="false" title="[^"]*" draggable="true" data-drag="face-part:eyes.cartoon">/, 'a card that can be pressed can be dragged');
  assert.match(html, /data-face-part="eyes.plain" aria-pressed="false" disabled title="[^"]*">/, 'a card the face refuses is not dragged');
  assert.match(html, /<small class="part-styles-title">Styles <span class="part-styles-hint">· press one, or drag it onto the mascot<\/span><\/small>/);

  const drag = transfer();
  ui.browserHost.dispatch('dragstart', { target: clickTarget({ dataset: { facePart: 'eyes.cartoon', drag: 'face-part:eyes.cartoon' } }), dataTransfer: drag });
  assert.equal(drag.getData(PART_DRAG_TYPE), 'face-part:eyes.cartoon');
  assert.equal(drag.getData('text/plain'), 'face-part:eyes.cartoon');
  assert.equal(drag.effectAllowed, 'copy', 'the card stays in the browser');

  const refused = transfer();
  let prevented = false;
  ui.browserHost.dispatch('dragstart', { target: clickTarget({ dataset: { facePart: 'eyes.plain', drag: 'face-part:eyes.plain' }, disabled: true }), dataTransfer: refused, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, 'the drag is refused');
  assert.deepEqual(refused.types, []);
  assert.equal(ui.store.getPersistentRevision(), revision, 'a drag writes nothing');
});

test('a card dropped on the mascot is the card\'s press: its own category opens, the part goes on as one undo step; a drop of anything else is left alone', () => {
  const ui = harness();
  ui.press({ partCategory: 'eyes' });
  const revision = ui.store.getPersistentRevision();
  const carrying = transfer('face-part:mouth.wide');
  let prevented = 0;
  const preventDefault = () => { prevented += 1; };
  // Over the mascot: the canvas says so, the cursor is a copy, and a child crossed does not unsay it.
  ui.dropHost.dispatch('dragenter', { dataTransfer: carrying, preventDefault });
  ui.dropHost.dispatch('dragover', { dataTransfer: carrying, preventDefault });
  assert.equal(ui.dropHost.dataset.characterDrop, 'true');
  assert.equal(carrying.dropEffect, 'copy');
  ui.dropHost.dispatch('dragenter', { dataTransfer: carrying, preventDefault });
  ui.dropHost.dispatch('dragleave', { dataTransfer: carrying });
  assert.equal(ui.dropHost.dataset.characterDrop, 'true', 'still over a child of the canvas');
  ui.dropHost.dispatch('dragleave', { dataTransfer: carrying });
  assert.equal(ui.dropHost.dataset.characterDrop, undefined, 'gone');
  assert.equal(ui.store.getPersistentRevision(), revision, 'hovering writes nothing');

  // The drop, with the eyes open: the mouth is its own category's.
  ui.dropHost.dispatch('dragenter', { dataTransfer: carrying, preventDefault });
  ui.dropHost.dispatch('drop', { dataTransfer: carrying, preventDefault });
  assert.equal(prevented, 5, 'every event of a card\'s drag is taken');
  assert.equal(ui.dropHost.dataset.characterDrop, undefined);
  assert.equal(ui.browserHost.dataset.partActive, 'mouth', 'the mouth opened');
  assert.ok(ui.element('mouth-wide'), 'the wide mouth is on');
  assert.equal(ui.element('tongue'), undefined);
  assert.deepEqual(ui.session(), { selectedId: 'mouth-wide', selectedIds: ['mouth-wide'] }, 'in hand, as one piece');
  assert.match(ui.statuses.at(-1), /^Wide is the mouth now\./);
  assert.match(ui.browserHost.innerHTML, /data-face-part="mouth.wide" aria-pressed="true"/);
  ui.history.undo();
  assert.ok(ui.element('tongue'), 'one undo, and the template\'s mouth is back');
  assert.equal(ui.history.getState().canUndo, false, 'the drop was one step');

  // A file, or text, dropped on the canvas keeps doing what it did: nothing here takes it.
  const file = { types: ['Files'], getData: () => '' };
  let taken = false;
  for (const type of ['dragenter', 'dragover', 'drop']) ui.dropHost.dispatch(type, { dataTransfer: file, preventDefault: () => { taken = true; } });
  assert.equal(taken, false);
  assert.equal(ui.dropHost.dataset.characterDrop, undefined);
  assert.equal(ui.history.getState().canUndo, false);

  // A hand's drawing dropped rests the hand on it, the hand in hand.
  ui.dropHost.dispatch('drop', { dataTransfer: transfer('hand-style:left:fist'), preventDefault });
  assert.equal(ui.store.getDocument().hands.left.styles.showing, 'fist');
  assert.deepEqual(ui.session(), { selectedId: 'handLeft', selectedIds: ['handLeft'] });
  assert.match(ui.statuses.at(-1), /^Left hand rests on Fist now/);

  // A drop the string of which is not a card's writes nothing and says nothing.
  const before = ui.statuses.length;
  ui.dropHost.dispatch('drop', { dataTransfer: transfer('sticker:eyes.cartoon'), preventDefault });
  assert.equal(ui.statuses.length, before);
  // A card of an asset this library has not got (a stale drag) says so, whichever category is open.
  ui.press({ partCategory: 'presets' });
  ui.dropHost.dispatch('drop', { dataTransfer: transfer('face-part:mouth.nope'), preventDefault });
  assert.match(ui.statuses.at(-1), /^error: Could not use mouth\.nope: There is no asset called "mouth\.nope"\./);
  assert.equal(ui.browserHost.dataset.partActive, 'presets', 'and nothing opened');
  // Not the surface showing: the canvas leaves the drag to the browser.
  ui.setActive(false);
  const taken2 = { count: 0 };
  ui.dropHost.dispatch('dragenter', { dataTransfer: transfer('face-part:mouth.wide'), preventDefault: () => { taken2.count += 1; } });
  ui.dropHost.dispatch('drop', { dataTransfer: transfer('face-part:mouth.wide'), preventDefault: () => { taken2.count += 1; } });
  assert.equal(taken2.count, 0);
  assert.equal(ui.element('mouth-wide'), undefined, 'nothing went on');
  assert.equal(ui.dropHost.dataset.characterDrop, undefined);
  ui.setActive(true);

  // Gone with the builder: the canvas is not listening any more.
  ui.builder.destroy();
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) assert.equal(ui.dropHost.listeners.get(type)?.size || 0, 0, type);
});

/* ── Face packs (docs/FACE_PART_LIBRARY.md, "Face packs"; roadmap phase 44) ── */

test('a part and a preset that came in a pack are cards marked Pack, the pack named in the badge', () => {
  const ui = harness();
  ui.library.register({ id: 'accessory.pack-hat', category: 'accessory', name: 'Pack hat', pack: 'grins', artwork: '<g id="pack-hat" data-name="Pack hat"><rect id="brim" data-name="Brim" x="40" y="10" width="160" height="20" fill="#333"/></g>', roles: { element: 'brim' }, referenceBox: { x: 40, y: 10, width: 160, height: 20 } });
  ui.press({ partCategory: 'accessory' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.pack-hat"[^>]*><span class="part-style-thumb"[^>]*>.*?<small class="part-style-badge part-style-pack" title="From the pack grins">Pack<\/small>/s, 'the badge says Pack, not Mine');
  assert.match(ui.browserHost.innerHTML, /data-face-part-forget="accessory.pack-hat"/, 'and it can be forgotten as any of the author\'s own');
  ui.press({ partCategory: 'presets' });
  ui.builder.useFacePreset('robot');
  const before = ui.browserHost.innerHTML;
  assert.doesNotMatch(before, /part-style-pack/);
});

/* ── Review fixes (PR 31) ────────────────────────────────────────────────── */

test('Reset all on a part whose asset the library has forgotten writes nothing: no half-done reset, the reason said', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.builder.useStyle('mouth.wide');
  ui.field({ partTransform: 'x' }, '7');
  const moved = structuredClone(ui.element('mouth-wide').baseTransform);
  const revision = ui.store.getPersistentRevision();
  ui.library.remove('mouth.wide');
  assert.equal(ui.builder.resetPart('mouth-wide', 'all'), false);
  assert.match(ui.statuses.at(-1), /^error: There is no part called "mouth\.wide" in the library any more/);
  assert.deepEqual(ui.element('mouth-wide').baseTransform, moved, 'the place was not touched');
  assert.equal(ui.store.getPersistentRevision(), revision, 'nothing written');
  assert.equal(ui.builder.resetPart('mouth-wide', 'position'), true, 'the place alone still resets');
});

test('the hands are described without their pictures for the readers that do not draw them', () => {
  const ui = harness();
  const drawn = describeHands(ui.store.getDocument());
  const plain = describeHands(ui.store.getDocument(), { pictures: false });
  assert.ok(drawn[0].styles.length > 0 && drawn[0].styles.every((style) => style.thumb.startsWith('<')), 'the cards get pictures');
  assert.ok(plain[0].styles.every((style) => style.thumb === ''), 'the inspector, the snapshot and the commands get none');
  assert.deepEqual(plain.map(({ styles, ...rest }) => rest), drawn.map(({ styles, ...rest }) => rest), 'and everything else the same');
  assert.deepEqual(plain[0].styles.map(({ thumb, ...rest }) => rest), drawn[0].styles.map(({ thumb, ...rest }) => rest));
});

test('Reset all is one fresh install: the place and the drawing come back together, and a refusal leaves nothing half done', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.builder.useStyle('mouth.wide');
  const fit = ui.store.getDocument().semanticParts.mouth.assetFit;
  ui.field({ partTransform: 'x' }, '7');
  assert.notEqual(ui.element('mouth-wide').baseTransform.x, fit.x);
  const revision = ui.store.getPersistentRevision();
  assert.equal(ui.builder.resetPart('mouth-wide', 'all'), true);
  assert.match(ui.statuses.at(-1), /^Mouth: its place, turn and size, the library drawing(, its colours)? back\. Undo puts it as it was\.$/);
  assert.ok(Math.abs(ui.element('mouth-wide').baseTransform.x - fit.x) < 0.01, 'back where the fit puts it');
  assert.deepEqual(ui.session(), { selectedId: 'mouth-wide', selectedIds: ['mouth-wide'] }, 'in hand: what came back');
  assert.ok(ui.store.getPersistentRevision() > revision);
  ui.history.undo();
  assert.ok(Math.abs(ui.element('mouth-wide').baseTransform.x - 7) < 0.01, 'one undo, and the move is back');
});

test('a swatch is painted only in a colour: a paint that is not one shows as nothing, and is no token of the face', async () => {
  const { paletteRowsMarkup } = await import('../../ui/character-builder/part-browser.js');
  const rows = paletteRowsMarkup({ tokens: [{ token: 'skin', label: 'Skin', colour: '#fff;background:url(https://evil.example/leak)', uses: [] }, { token: 'hair', label: 'Hair', colour: '#5b3a1e', uses: [] }] });
  assert.doesNotMatch(rows, /style="[^"]*url\(/, 'nothing but a colour reaches a style attribute (the title, escaped text, may still name what was painted)');
  assert.match(rows, /--swatch:transparent/);
  assert.match(rows, /--swatch:#5b3a1e/);
  // Read off a face whose head was painted with such a value: the skin is not seeded from it.
  const ui = harness();
  ui.paints.head.fill = '#fff;background:url(https://evil.example/leak)';
  ui.press({ partCategory: 'palette' });
  assert.doesNotMatch(ui.browserHost.innerHTML, /evil\.example/, 'not a token of the face');
  ui.press({ partCategory: 'head' });
  assert.doesNotMatch(ui.inspectorHost.innerHTML, /style="[^"]*url\(/);
});
