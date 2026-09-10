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
  hair: { fill: '#5b3a1e' }, hairTop: { fill: '#5b3a1e', stroke: '#111111' }, hairBack: { fill: '#4a2f18' },
  mouth: { fill: '#b83a3a', stroke: '#111111' }, teeth: { fill: '#ffffff' }, tongue: { fill: '#e06060' },
  eyeLeft: {}, eyeWhiteLeft: { fill: '#ffffff' }, pupilLeft: { fill: '#10172a' }, eyeRight: {}, eyeWhiteRight: { fill: '#ffffff' }, pupilRight: { fill: '#10172a' },
  handLeft: {}, 'handLeftStyle-relaxed': { fill: '#f4d8b8', stroke: '#111111' }
};

/** The editor's library plus one head asset, which the template refuses: a card that cannot be pressed. */
function library() {
  const registry = createFacePartRegistry();
  registry.registerMany(BUILTIN_FACE_PARTS);
  registry.register({ id: 'head.round', category: 'head', name: 'Round', artwork: '<g id="head-round"><circle id="skull" cx="120" cy="120" r="90"/></g>', roles: { head: 'skull' }, referenceBox: { x: 30, y: 30, width: 180, height: 180 } });
  // And one accessory, for a category the template has no part for yet.
  registry.register({ id: 'accessory.hat', category: 'accessory', name: 'Hat', description: 'A flat hat.', artwork: '<g id="hat" data-name="Hat"><rect id="brim" data-name="Brim" x="40" y="10" width="160" height="20" fill="#333"/></g>', roles: { element: 'brim' }, referenceBox: { x: 40, y: 10, width: 160, height: 20 } });
  return registry;
}

function harness(state = createTemplateProjectState(), { styles = true } = {}) {
  const store = createEditorStore(state);
  const history = createHistory(store);
  const browserHost = document.createElementNS('', 'div'), inspectorHost = document.createElementNS('', 'div');
  const applied = [], routes = [], tools = [], statuses = [], colourRequests = [], templates = [], installed = [];
  const paints = structuredClone(PAINTS);
  const registry = library();
  const assets = {};
  for (const asset of registry.list()) Object.assign(assets, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const faceCanvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => assets[id] || null });
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
    describePaints: (id) => subtree(id).filter((item) => paints[item]).map((item) => ({ id: item, ...paints[item] })),
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
    facePartCommands: styles ? createFacePartCommands(store, history, canvas, { library: registry, onInstalled: (summary) => installed.push(summary) }) : null,
    onStatus: (message, tone) => statuses.push(tone ? `${tone}: ${message}` : message)
  });
  builder.render();
  return {
    store, history, builder, browserHost, inspectorHost, applied, routes, tools, statuses, colourRequests, templates, paints, installed, faceCanvas,
    session: () => { const { selectedId, selectedIds } = store.getSession(); return { selectedId, selectedIds }; },
    press: (dataset) => browserHost.dispatch('click', { target: clickTarget({ dataset }) }),
    pressInspector: (dataset) => inspectorHost.dispatch('click', { target: clickTarget({ dataset }) }),
    // A field's write comes back as a document notification, which the render
    // plan turns into `render()`; here the test plays the plan.
    field: (dataset, value) => { inspectorHost.dispatch('change', { target: clickTarget({ tag: 'input', dataset, value }) }); builder.render(); },
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
  assert.equal(ui.element('browLeft').baseTransform.scaleX, 1, 'the other brow is untouched: linked editing is a later PR');
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

test('Edit Shape opens Artwork on the piece, with the Node tool when the piece has nodes', () => {
  const ui = harness();
  ui.press({ partCategory: 'mouth' });
  ui.pressInspector({ partPiece: 'mouth' });
  ui.pressInspector({ partEditShape: '' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'mouth' } });
  assert.deepEqual(ui.tools, ['node'], 'the mouth is a path');
  assert.match(ui.statuses.at(-1), /Editing the shape of Mouth/);

  ui.press({ partCategory: 'eyes' });
  ui.pressInspector({ partEditShape: '' });
  assert.deepEqual(ui.routes.at(-1), { task: 'artwork', target: { kind: 'artwork-element', id: 'eyeRight' } });
  assert.deepEqual(ui.tools, ['node'], 'a group has no nodes to edit, so no tool is forced on it');
  assert.equal(ui.builder.editShape('nope'), false);
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
  assert.match(ui.inspectorHost.innerHTML, /Coming with the part library/);
  assert.match(ui.browserHost.innerHTML, /data-part-status="unavailable" data-part-active="true"/);
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
  assert.equal((html.match(/part-style-badge part-style-limited">Limited</g) || []).length, 2, 'both mouths leave a movement out');
  assert.equal(html.includes('Current'), false, 'the template\'s mouth came from no asset');
  assert.match(html, /data-part-piece="mouth"/, 'the pieces are still offered above the styles');

  // A category the library has nothing for shows no styles; one the template
  // refuses shows the card, unpressable, with the reason on it.
  ui.press({ partCategory: 'nose' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="nose.dot"/);
  ui.press({ partCategory: 'ears' });
  assert.equal(ui.browserHost.innerHTML.includes('data-part-styles'), false);
  ui.press({ partCategory: 'head' });
  assert.match(ui.browserHost.innerHTML, /data-face-part="head.round" aria-pressed="false" disabled title="Head is drawn around other parts \(Eyes \(leftEye\), [^"]+\): replacing it would take them away too\."/);
  // A category with no part yet says Add, and keeps the way to Face Setup.
  ui.press({ partCategory: 'accessory' });
  assert.match(ui.browserHost.innerHTML, /Pick a style below, give the part its artwork in Face Setup/);
  assert.match(ui.browserHost.innerHTML, /data-face-part="accessory.hat" aria-pressed="false" title="Add Hat: A flat hat\."/);
  assert.match(ui.browserHost.innerHTML, /data-character-route="face-setup"/);
  ui.press({ partCategory: 'facialHair' });
  assert.equal(ui.browserHost.innerHTML.includes('data-part-styles'), false, 'nothing can be installed there yet');
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
  ui.press({ partCategory: 'head' });
  const revision = ui.store.getPersistentRevision();
  // The browser leaves a disabled card alone; the builder itself refuses too, for a press that gets through.
  assert.equal(ui.builder.useStyle('head.round'), false);
  assert.match(ui.statuses.at(-1), /^error: Could not use Round: Head is drawn around other parts/);
  assert.equal(ui.builder.useStyle('mouth.wide'), false, 'a mouth is not a head');
  assert.match(ui.statuses.at(-1), /^error: Could not use Wide: "mouth.wide" is not a head asset\./);
  assert.equal(ui.store.getPersistentRevision(), revision);
  assert.equal(ui.history.getState().canUndo, false);
  assert.equal(ui.faceCanvas.calls.replace.length, 0);
  ui.press({ partCategory: 'presets' });
  assert.equal(ui.builder.useStyle('mouth.wide'), false, 'no category with a part is open');
});
