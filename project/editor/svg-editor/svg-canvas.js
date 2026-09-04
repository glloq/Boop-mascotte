import SVG from 'svg.js';
import 'svg.select.js';
import 'svg.resize.js';
import 'svg.draggable.js';
import { sanitizeSvgMarkup } from '../core/security/sanitize-svg.js';
import { SvgDocument } from '../core/svg-document/svg-document.js';
import { lifecycleDiagnostics as diagnostics } from '../core/diagnostics/lifecycle-diagnostics.js';
import { createArtworkCommands } from '../core/commands/artwork-commands.js';
import { artboardAround, artboardOverflow, readArtboard } from '../core/artwork/artboard.js';
import { createTransformGizmo } from './transform-gizmo.js';
import { matrixToString } from '../../runtime/runtime.js';
import { movePathNode, pathNodes } from '../core/path/path-nodes.js';
import { deletePathNode, insertPathNode, nearestPathPoint } from '../core/path/path-edit.js';
import { describeMigration } from '../core/path/path-topology.js';
import { puppetDragValues, puppetOrbitValues, puppetRestValues } from '../core/puppet/puppet-handles.js';

// SVG.js 2.x `transform()` extracts `{x, y, rotation, scaleX, scaleY}`; the 3.x names are kept as a fallback.
// Group artwork is moved through its transform (not cx/cy), so a pose must read it or a dragged group calibrates to zero.
function parseTransform(element) {
  const matrix = element.transform();
  const pick = (...values) => values.find((value) => Number.isFinite(value));
  return { x: pick(matrix.translateX, matrix.x) ?? 0, y: pick(matrix.translateY, matrix.y) ?? 0, rotation: pick(matrix.rotate, matrix.rotation) ?? 0,
    scaleX: pick(matrix.scaleX) ?? 1, scaleY: pick(matrix.scaleY) ?? 1, pivotX: pick(matrix.originX) ?? 0, pivotY: pick(matrix.originY) ?? 0 };
}

export function createSvgCanvas(container, store, history, pluginRegistry) {
  const commands = createArtworkCommands(store, history);
  // SVG.js 2.x creates/attaches a drawing with SVG(container). addTo() is a
  // SVG.js 3 API and leaves the v2 plugins with an invalid parent (`put`).
  const draw = SVG(container).size('100%', '100%');
  let rootGroup = draw.group();
  const documentModel = new SvgDocument();
  let loadedMarkup = '';
  let workspace = 'create';
  let selectedId = null;
  let activeTool = 'select';
  let toolChangeHandler = () => {};
  let rigTool = null;
  let nodeEdit = null;
  let puppet = null;
  // Wrappers may be recreated, DOM nodes are stable. Weak collections neither
  // duplicate handlers nor retain removed/replaced artwork.
  const attachedNodes = new WeakSet();
  const lastApplied = new WeakMap();
  const lastRequested = new Map();

  const restoreRigNodes = (tool) => Object.entries(tool?.baseAttributes || {}).forEach(([id, attributes]) => {
    const node=documentModel.getNode(id);if(!node)return;
    // Exact restore: pose tools may have moved geometry attributes (cx/cy, x/y, rx/ry…), not only transform.
    if(tool.restoreExact)for(const name of node.getAttributeNames())if(!(name in attributes))node.removeAttribute(name);
    for(const [name,value] of Object.entries(attributes))value==null?node.removeAttribute(name):node.setAttribute(name,value);
  });
  const snapshotAttributes = (node) => Object.fromEntries([...node.attributes].map((attribute) => [attribute.name, attribute.value]));
  const safeBBox = (node) => { try { return node.getBBox(); } catch { return null; } };

  /** A hairline still needs corners to grab, in the element's own units. */
  const MIN_SELECTION_SIZE = 8;
  /**
   * The box the selection is drawn around.
   *
   * `getBBox()` measures geometry and ignores the stroke, so a stroked line —
   * the mouth of every template — measures zero height and its selection box
   * collapsed to a flat line with every handle stacked on top of the next.
   */
  const selectionBox = (node) => {
    const box = safeBBox(node);
    if (!box) return null;
    const stroke = node.getAttribute?.('stroke');
    const width = stroke && stroke !== 'none' ? Math.abs(Number.parseFloat(node.getAttribute('stroke-width') ?? '1')) || 0 : 0;
    let { x, y } = box, w = box.width + width, h = box.height + width;
    x -= width / 2; y -= width / 2;
    if (w < MIN_SELECTION_SIZE) { x -= (MIN_SELECTION_SIZE - w) / 2; w = MIN_SELECTION_SIZE; }
    if (h < MIN_SELECTION_SIZE) { y -= (MIN_SELECTION_SIZE - h) / 2; h = MIN_SELECTION_SIZE; }
    return { x, y, width: w, height: h };
  };
  // A pose is the element's transform plus any displacement/resize the drag plugins applied to its geometry.
  const posedTransform = (id, tool) => {
    const wrapper=wrapperFor(id), parsed=parseTransform(wrapper), base=tool.baseBoxes?.[id], box=wrapper?safeBBox(wrapper.node):null;
    if(!base||!box)return parsed;
    const dx=(box.x+box.width/2)-(base.x+base.width/2), dy=(box.y+box.height/2)-(base.y+base.height/2);
    return {...parsed,x:parsed.x+dx,y:parsed.y+dy,scaleX:parsed.scaleX*(base.width?box.width/base.width:1),scaleY:parsed.scaleY*(base.height?box.height/base.height:1)};
  };

  const wrapperFor = (id) => {
    const node = documentModel.getNode(id);
    return node ? SVG.adopt(node) : null;
  };

  /* ── Boop gizmo (docs/SELECTION_GIZMO.md) ──────────────────────────────── */

  // A layer of its own, above the artwork and outside the serialized document,
  // so the overlay can never hide or contaminate the drawing.
  const gizmoLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gizmoLayer.setAttribute('data-gizmo-layer', '');
  gizmoLayer.setAttribute('pointer-events', 'none');
  draw.node.append(gizmoLayer);
  const raiseGizmoLayer = () => draw.node.append(gizmoLayer);

  // The same again for what is being drawn right now. A preview that lived in
  // the artwork would be serialized into the document the moment anything
  // reconciled mid-drag; here it is chrome, and the shape only becomes artwork
  // when the gesture ends.
  const drawLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  drawLayer.setAttribute('data-draw-layer', '');
  drawLayer.setAttribute('pointer-events', 'none');
  draw.node.append(drawLayer);
  /** Line the preview up with the artwork, so it is drawn in the artwork's own units. */
  const raiseDrawLayer = () => {
    draw.node.append(drawLayer);
    const host = rootGroup.node.querySelector('svg');
    const ctm = host && draw.node.getScreenCTM()?.inverse().multiply(host.getScreenCTM());
    if (ctm) drawLayer.setAttribute('transform', `matrix(${ctm.a} ${ctm.b} ${ctm.c} ${ctm.d} ${ctm.e} ${ctm.f})`);
  };

  /**
   * The working area, and what is cutting the artwork (docs/VECTOR_EDITING.md).
   *
   * A nested `<svg>` clips to its own `viewBox`, and a `clip-path` cuts
   * whatever it is on. Both are invisible, so taller hair came back cropped
   * with nothing on screen to explain it. This layer draws the artboard's edge
   * and, for a clipped selection, the outline it is being cut against.
   */
  const frameLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  frameLayer.setAttribute('data-frame-layer', '');
  frameLayer.setAttribute('pointer-events', 'none');
  draw.node.append(frameLayer);
  let frameVisible = false;

  /** The matrix that puts chrome in the artwork's own units. */
  const artworkMatrix = () => {
    const host = rootGroup.node.querySelector('svg');
    return host ? draw.node.getScreenCTM()?.inverse().multiply(host.getScreenCTM()) : null;
  };

  /** The nearest element carrying a clip, from `id` upwards, with the shape it clips to. */
  function clipOwnerOf(id) {
    const host = rootGroup.node.querySelector('svg');
    for (let node = documentModel.getNode(id); node && node !== host?.parentNode; node = node.parentElement) {
      const reference = /url\(['"]?#([^)'"]+)['"]?\)/.exec(node.getAttribute?.('clip-path') || '')?.[1];
      if (!reference) continue;
      const shape = host?.querySelector?.(`#${CSS.escape(reference)} > *`) || null;
      return { ownerId: node.getAttribute('id') || null, clipId: reference, owner: node, shape };
    }
    return null;
  }

  function renderFrame() {
    frameLayer.replaceChildren();
    if (!frameVisible || !rootGroup?.node) return;
    // A rebuild appends the artwork after this layer, which would leave the
    // edges drawn underneath the drawing they are about.
    draw.node.append(frameLayer);
    const matrix = artworkMatrix();
    if (!matrix) return;
    frameLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    const box = readArtboard(store.getDocument().svgMarkup || '');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'canvas-artboard');
    rect.setAttribute('x', box.x); rect.setAttribute('y', box.y);
    rect.setAttribute('width', box.width); rect.setAttribute('height', box.height);
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    frameLayer.append(rect);
    // And the clip the selection is being cut against, where there is one.
    const clip = selectedId ? clipOwnerOf(selectedId) : null;
    if (!clip?.shape) return;
    const outline = clip.shape.cloneNode(true);
    outline.removeAttribute('id');
    outline.setAttribute('class', 'canvas-clip-outline');
    outline.setAttribute('vector-effect', 'non-scaling-stroke');
    const host = rootGroup.node.querySelector('svg');
    const local = host && clip.owner.getScreenCTM && host.getScreenCTM()?.inverse().multiply(clip.owner.getScreenCTM());
    if (local) outline.setAttribute('transform', `matrix(${local.a} ${local.b} ${local.c} ${local.d} ${local.e} ${local.f})`);
    frameLayer.append(outline);
  }

  /**
   * The canvas view (zoom and pan), written as a plain matrix.
   *
   * It used to go through SVG.js's `transform({ translateX, translateY, … })`.
   * Those are the **3.x** names and this is 2.x, so every translation was
   * silently dropped: Fit only scaled without centring, zoom drifted, and
   * panning did nothing at all. A matrix string cannot be misread.
   */
  const viewTransform = () => {
    const matrix = rootGroup?.node?.transform?.baseVal?.consolidate?.()?.matrix;
    return { scale: matrix?.a || 1, x: matrix?.e || 0, y: matrix?.f || 0 };
  };
  const setView = ({ scale = 1, x = 0, y = 0 }) => {
    const zoom = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    const tx = Number.isFinite(Number(x)) ? Number(x) : 0, ty = Number.isFinite(Number(y)) ? Number(y) : 0;
    rootGroup.node.setAttribute('transform', `matrix(${zoom} 0 0 ${zoom} ${tx} ${ty})`);
    raiseGizmoLayer();
    gizmo.render();
    if (nodeEdit) placeNodeHandles();
    placePuppetHandles();
    renderFrame();
    return { scale: zoom, x: tx, y: ty };
  };

  /**
   * A transform the browser can parse, or nothing at all.
   *
   * One NaN here is not a wrong position: it makes the whole attribute
   * invalid, the element vanishes, and the serialized markup carries the
   * damage into the saved project. So every number is checked at the boundary.
   */
  const finiteTransform = (t) => {
    const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    return { x: number(t?.x, 0), y: number(t?.y, 0), rotation: number(t?.rotation, 0),
      scaleX: number(t?.scaleX, 1), scaleY: number(t?.scaleY, 1), pivotX: number(t?.pivotX, 0), pivotY: number(t?.pivotY, 0) };
  };
  const transformString = (transform) => {
    const t = finiteTransform(transform);
    return `translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.pivotX} ${t.pivotY}) translate(${t.pivotX} ${t.pivotY}) scale(${t.scaleX} ${t.scaleY}) translate(${-t.pivotX} ${-t.pivotY})`;
  };

  // The gizmo works in the selected element's *parent* space: that is where a
  // baseTransform maps its own geometry to, and it survives nested groups,
  // viewBoxes and canvas zoom without a special case for any of them.
  const parentSpace = (node) => node?.parentNode?.getScreenCTM?.() || null;

  const gizmoTarget = () => {
    if (workspace !== 'create' || activeTool !== 'select' || rigTool || !selectedId) return null;
    if (store.getDocument().layerMetadata?.[selectedId]?.locked) return null;
    const node = documentModel.getNode(selectedId);
    const box = node && selectionBox(node);
    const ctm = parentSpace(node);
    if (!box || !ctm) return null;
    const authored = store.getDocument().elements?.[selectedId]?.baseTransform;
    const transform = authored ? { ...authored } : parseTransform(SVG.adopt(node));
    // An unconfigured pivot is (0, 0) — the corner of the artwork's own
    // coordinates, usually nowhere near the part. Rotating or scaling around
    // that is never what the author means, so the middle of the selection is
    // the default; the pivot handle still moves it anywhere.
    if (!transform.pivotX && !transform.pivotY) {
      transform.pivotX = box.x + box.width / 2;
      transform.pivotY = box.y + box.height / 2;
    }
    return { id: selectedId, node, box, transform, scale: Math.hypot(ctm.a, ctm.b) || 1 };
  };

  // Compact mode toolbar. It only exists while something is selected, so it
  // never competes with the vector tools for attention.
  const gizmoToolbar = document.createElement('div');
  gizmoToolbar.className = 'gizmo-toolbar';
  gizmoToolbar.setAttribute('role', 'toolbar');
  gizmoToolbar.setAttribute('aria-label', 'Transform mode');
  gizmoToolbar.hidden = true;
  gizmoToolbar.innerHTML = [
    ['move', 'Move', 'G', '✥'], ['rotate', 'Rotate', 'R', '⟳'], ['scale', 'Scale', 'S', '⤢'], ['pivot', 'Pivot', 'P', '⊕']
  ].map(([mode, label, key, glyph]) => `<button type="button" data-gizmo-mode="${mode}" title="${label} (${key})" aria-label="${label}"><span aria-hidden="true">${glyph}</span></button>`).join('');
  gizmoToolbar.addEventListener('click', (event) => {
    const mode = event.target.closest('[data-gizmo-mode]')?.dataset.gizmoMode;
    if (mode) { gizmo.setMode(mode); syncGizmoToolbar(); }
  });
  container.append(gizmoToolbar);
  function syncGizmoToolbar() {
    gizmoToolbar.hidden = !gizmoTarget();
    for (const button of gizmoToolbar.querySelectorAll('[data-gizmo-mode]')) {
      const active = button.dataset.gizmoMode === gizmo.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  const gizmo = createTransformGizmo({
    layer: gizmoLayer,
    surface: container,
    getTarget: () => {
      const item = gizmoTarget();
      if (!item) return null;
      // Keep the overlay's own coordinates aligned with the element's parent.
      const local = draw.node.getScreenCTM().inverse().multiply(parentSpace(item.node));
      gizmoLayer.setAttribute('transform', `matrix(${local.a} ${local.b} ${local.c} ${local.d} ${local.e} ${local.f})`);
      return item;
    },
    // Nested mascot parts overlap: pressing inside the head's box but on the
    // mouth means "select the mouth", not "drag the head". Handles are always
    // the gizmo's; the body only when the press is on the selection's own art.
    canDragBody: (event) => {
      const elements = store.getDocument().elements || {};
      for (let node = event.target; node && node !== container; node = node.parentNode) {
        const id = node.getAttribute?.('id');
        if (id && elements[id]) return id === selectedId;
      }
      return true;
    },
    toCanvas: (event) => {
      const node = documentModel.getNode(selectedId);
      const ctm = parentSpace(node);
      const point = draw.node.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      if (!ctm) return { x: 0, y: 0 };
      // A plain object, deliberately: an SVGPoint keeps x and y on its
      // prototype, so `{ ...point }` copies nothing and every drag that spread
      // one started from `undefined` and wrote NaN into the artwork.
      const local = point.matrixTransform(ctm.inverse());
      return { x: local.x, y: local.y };
    },
    // Transient: the DOM moves, history and the store do not.
    onPreview: (transform, drag) => { documentModel.getNode(drag.id)?.setAttribute('transform', transformString(transform)); },
    // One command for the whole gesture.
    onCommit: (transform, drag) => {
      const id = drag.id;
      documentModel.getNode(id)?.setAttribute('transform', transformString(transform));
      documentModel.captureAuthoringNode(id);
      const current = store.getDocument();
      commands.syncSvg({
        elements: { ...current.elements, [id]: { ...(current.elements[id] || {}), baseTransform: finiteTransform(transform) } },
        svgMarkup: documentModel.serialize()
      }, { domains: ['artwork'], source: 'canvas' });
    }
  });

  function clearSelection() {
    if (selectedId) requestAnimationFrame(() => renderFrame());
    gizmo.cancel();
    gizmo.render();
    syncGizmoToolbar();
    if (!selectedId) return;
    const previous=wrapperFor(selectedId);
    previous?.node?.removeAttribute('data-editor-selected');
    // SVG.js selection plugins retain helper nodes and pointer hit areas until
    // explicitly disabled. Transform-pose owns its wrappers until that rig
    // session finishes; normal editor selection does not.
    if (!(rigTool?.kind === 'transform-pose' && rigTool.ids.includes(selectedId))) {
      previous?.selectize(false);
      previous?.resize(false);
      previous?.draggable(false);
    }
    selectedId=null;
  }

  function showSelection(id) {
    clearSelection();
    if (!id || workspace === 'animate' || workspace === 'preview') return;
    const element=wrapperFor(id);if(!element)return;
    selectedId=id;element.node.setAttribute('data-editor-selected','true');
    // The Boop gizmo replaces the library selection chrome for ordinary
    // authoring; the legacy plugins remain only for the rig pose tools.
    gizmo.render();
    syncGizmoToolbar();
    // Clicking a path while the Node tool is chosen is how a person expects to
    // start editing it, rather than having to pick the tool again.
    if (activeTool === 'node') {
      if (startNodeEdit(id)) showMode('Drag a node to reshape the path. Arrow keys nudge it; Esc leaves the tool.', null);
      else showMode('That is not a path. Click a path to edit its nodes.', null);
    }
    // Say what is cutting this piece, if anything is.
    renderFrame();
  }

  function attachBehavior(element) {
    if (attachedNodes.has(element.node)) return false;
    attachedNodes.add(element.node);
    diagnostics.increment('canvas.interactionAttachments');
    diagnostics.increment('canvas.interactiveElements');
    element.selectize(false).draggable(false);
    element.on('mouseover', () => { if (rigTool?.kind === 'role') element.node.setAttribute('data-rig-candidate', 'true'); });
    element.on('mouseout', () => element.node.removeAttribute('data-rig-candidate'));
    element.on('click', (event) => {
      event.stopPropagation();
      if (rigTool?.kind === 'role') { rigTool.pick(element.id()); return; }
      store.mutateSession('selectedId', state => { state.selectedId = element.id(); });
    });
    element.on('dragstart resizestart', (event) => { if (store.getDocument().layerMetadata[element.id()]?.locked) event.preventDefault(); });
    element.on('dragend resize', () => {
      const id = element.id();
      if (store.getDocument().layerMetadata[id]?.locked) return;
      if(rigTool?.kind==='transform-pose'&&rigTool.ids.includes(id)){rigTool.temporary[id]=posedTransform(id,rigTool);return;}
      documentModel.captureAuthoringNode(id);
      commands.syncSvg({elements:{...store.getDocument().elements,[id]:{...(store.getDocument().elements[id]||{}),baseTransform:parseTransform(element)}},svgMarkup:documentModel.serialize()}, {domains:['artwork'],source:'canvas'});
    });
    return true;
  }

  function updateElementInteractionState(id) {
    const element = wrapperFor(id); if (!element) return;
    const locked = Boolean(store.getDocument().layerMetadata[id]?.locked);
    element.draggable(!locked && workspace === 'create' && activeTool === 'select');
    showSelection(store.getSession().selectedId);
  }

  function loadSvgText(svgText, metadata = {}, options = {}) {
    const safeMarkup = sanitizeSvgMarkup(svgText);
    rootGroup.remove();
    rootGroup = draw.group().svg(safeMarkup);
    raiseGizmoLayer();
    const svgRoot = rootGroup.node.querySelector('svg');
    const tree = documentModel.load(svgRoot, metadata);
    loadedMarkup = documentModel.serialize();
    if (options.recordHistory !== false) history.snapshot();
    const artwork = {
      layers: tree,
      layerMetadata: structuredClone(documentModel.metadata),
      elements: {},
      svgMarkup: documentModel.serialize(),
      svgWarnings: [...documentModel.warnings]
    };
    const visit = (items) => items.forEach((item) => {
        const node = wrapperFor(item.id);
        const plugin = pluginRegistry.getByNode(node);
        if (plugin) { artwork.elements[item.id] = plugin.createRigData(node, parseTransform(node)); attachBehavior(node); }
        visit(item.children);
    });
    visit(tree);
    if (options.updateStore !== false) store.mutateDocument({type:'artwork/load',source:'canvas',domains:['artwork','layers'],apply:state=>Object.assign(state,artwork)});
    return artwork;
  }

  /* ── Node tool (docs/VECTOR_EDITING.md) ──────────────────────────────────
   *
   * Direct editing of a path's anchors. Choosing the tool used to switch the
   * canvas out of Select — which turns the gizmo and dragging off — and put
   * nothing in their place, so the canvas went inert and editing looked
   * broken. The geometry is `core/path/path-nodes.js`; this is the pointer.
   */
  function endNodeEdit() {
    if (!nodeEdit) return;
    for (const { handle } of nodeEdit.handles) handle.remove();
    container.classList.remove('node-editing');
    nodeEdit = null;
  }

  function nodeEditTarget() { return nodeEdit ? wrapperFor(nodeEdit.id) : null; }

  /** Place every handle from the path as it currently stands. */
  function placeNodeHandles() {
    const element = nodeEditTarget();
    if (!element) return;
    const nodes = pathNodes(element.attr('d'));
    const box = container.getBoundingClientRect();
    const ctm = element.node.getScreenCTM();
    for (const { handle, index } of nodeEdit.handles) {
      const node = nodes.find((item) => item.index === index);
      if (!node || !ctm) { handle.hidden = true; continue; }
      const point = draw.node.createSVGPoint();
      point.x = node.x; point.y = node.y;
      const screen = point.matrixTransform(ctm);
      handle.hidden = false;
      handle.style.left = `${screen.x - box.left}px`;
      handle.style.top = `${screen.y - box.top}px`;
    }
  }

  /** Client point → the path's own coordinates, where a `d` lives. */
  function pathPoint(element, event) {
    const ctm = element.node.getScreenCTM();
    if (!ctm) return null;
    const point = draw.node.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());
    return Number.isFinite(local.x) && Number.isFinite(local.y) ? { x: local.x, y: local.y } : null;
  }

  function startNodeEdit(id) {
    endNodeEdit();
    // A lock is a lock: the gizmo already refuses a locked piece, and the Node
    // tool reshaped one happily.
    if (store.getDocument().layerMetadata?.[id]?.locked) return false;
    const element = wrapperFor(id);
    if (element?.type !== 'path') return false;
    const nodes = pathNodes(element.attr('d'));
    if (!nodes.length) return false;
    const handles = nodes.map((node, position) => {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'rig-node-handle';
      handle.dataset.pathNode = String(node.index);
      handle.setAttribute('aria-label', `Path node ${position + 1} of ${nodes.length}`);
      container.append(handle);
      return { handle, index: node.index };
    });
    // A deformed shape is drawn as `restPath + Σ shape keys`, so what is on
    // screen is a pose and the authored outline is underneath it. Dragging a
    // node used to write the pose into the document, where the very next frame
    // overwrote it: the edit looked like it had been rejected. The rest
    // outline travels with the drag instead, by the same vector.
    nodeEdit = { id, handles, moved: false, restPath: store.getDocument().elements?.[id]?.restPath || null };
    container.classList.add('node-editing');
    placeNodeHandles();
    return true;
  }

  /** Rebuild the handles after a change that moved the indices, and keep the focus. */
  function rebuildNodeHandles(focusIndex = null) {
    if (!nodeEdit) return false;
    const id = nodeEdit.id, moved = nodeEdit.moved, restPath = nodeEdit.restPath;
    if (!startNodeEdit(id)) return false;
    nodeEdit.moved = moved;
    nodeEdit.restPath = restPath;
    const entry = nodeEdit.handles.find((item) => item.index === focusIndex) || null;
    entry?.handle.focus();
    return true;
  }

  /**
   * Add or remove a point on the path being edited.
   *
   * Both change the path's topology, which is what every shape key, morph and
   * captured pose on that element is measured against, so they go through the
   * one command that carries all of them across (`docs/VECTOR_EDITING.md`).
   */
  function applyPathEdit(edit, { focus = null, verb = 'changed' } = {}) {
    const element = nodeEditTarget();
    if (!element || !edit) return false;
    if (edit.ok === false) { showMode(edit.message, null); return false; }
    const posed = element.attr('d');
    const result = commands.editPath(nodeEdit.id, edit, { posedPath: nodeEdit.restPath ? posed : null });
    if (result?.ok === false) { showMode(result.message, null); return false; }
    if (nodeEdit.restPath) {
      // What is authored is the outline the poses are measured from; what is on
      // screen is the pose, with the same point added to it.
      nodeEdit.restPath = store.getDocument().elements?.[nodeEdit.id]?.restPath || nodeEdit.restPath;
      element.attr('d', nodeEdit.restPath);
      documentModel.captureAuthoringNode(nodeEdit.id);
      commitDocument();
      element.attr('d', edit.d);
    } else {
      // With no rest outline the drawn path *is* the authored one.
      element.attr('d', edit.d);
      documentModel.captureAuthoringNode(nodeEdit.id);
      commitDocument();
    }
    const carried = describeMigration(result?.migrated || {});
    showMode(`Point ${verb}${carried ? `, and ${carried} came with it` : ''}.`, null);
    rebuildNodeHandles(focus);
    return true;
  }

  /** Add a point where the pointer is, on the segment nearest to it. */
  function insertNodeNear(point) {
    const element = nodeEditTarget();
    if (!element || !point) return false;
    const found = nearestPathPoint(element.attr('d'), point);
    if (!found) return false;
    return applyPathEdit(insertPathNode(element.attr('d'), found.index, found.t), { focus: found.index, verb: 'added' });
  }

  /** Remove the focused point, merging the two segments that met at it. */
  function deleteNodeAt(index) {
    const element = nodeEditTarget();
    if (!element) return false;
    return applyPathEdit(deletePathNode(element.attr('d'), index), { focus: null, verb: 'removed' });
  }

  /** One drag or one nudge = one undoable command. */
  function moveNodeTo(index, point) {
    const element = nodeEditTarget();
    if (!element || !point) return false;
    const current = element.attr('d');
    const before = pathNodes(current).find((node) => node.index === index);
    const next = movePathNode(current, index, point);
    if (next === current) return false;
    element.attr('d', next);
    // The same vector on the outline the poses are measured from, so a shape
    // key keeps deforming exactly what it deformed before.
    if (nodeEdit.restPath && before) {
      const rest = pathNodes(nodeEdit.restPath).find((node) => node.index === index);
      const moved = pathNodes(next).find((node) => node.index === index);
      if (rest && moved) nodeEdit.restPath = movePathNode(nodeEdit.restPath, index, { x: rest.x + (moved.x - before.x), y: rest.y + (moved.y - before.y) });
    }
    placeNodeHandles();
    return true;
  }

  function commitNodeEdit() {
    const element = nodeEditTarget();
    if (!element || !nodeEdit.moved) return;
    nodeEdit.moved = false;
    history.snapshot();
    if (nodeEdit.restPath) {
      // What is authored is the outline, not the pose that was on screen: the
      // next frame draws the pose again from it.
      element.attr('d', nodeEdit.restPath);
      commands.updateElement(nodeEdit.id, 'set-rest-path', (item) => { item.restPath = nodeEdit.restPath; }, { snapshot: false });
    }
    documentModel.captureAuthoringNode(nodeEdit.id);
    commitDocument();
  }

  container.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest?.('[data-path-node]');
    if (!handle || !nodeEdit) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    nodeEdit.dragging = Number(handle.dataset.pathNode);
  }, true);

  container.addEventListener('pointermove', (event) => {
    if (!nodeEdit || nodeEdit.dragging === undefined || nodeEdit.dragging === null) return;
    const element = nodeEditTarget();
    if (!element) return;
    if (moveNodeTo(nodeEdit.dragging, pathPoint(element, event))) nodeEdit.moved = true;
  });

  container.addEventListener('pointerup', (event) => {
    if (!nodeEdit || nodeEdit.dragging === undefined || nodeEdit.dragging === null) return;
    event.target.releasePointerCapture?.(event.pointerId);
    nodeEdit.dragging = null;
    commitNodeEdit();
  }, true);

  // Arrow keys nudge the focused node, so a node can be placed exactly and
  // without a pointer at all.
  container.addEventListener('keydown', (event) => {
    const handle = event.target.closest?.('[data-path-node]');
    if (!handle || !nodeEdit) return;
    const index = Number(handle.dataset.pathNode);
    // A point can be added and removed without a pointer, like it can be moved.
    // Both stop here: the editor's own Delete removes the whole shape, which is
    // not what someone with a point selected means by it.
    if (event.key === 'Insert' || event.key === '+') {
      event.preventDefault(); event.stopPropagation();
      const element = nodeEditTarget();
      applyPathEdit(insertPathNode(element.attr('d'), index, 0.5), { focus: index, verb: 'added' });
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); deleteNodeAt(index); return; }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step) return;
    event.preventDefault();
    const element = nodeEditTarget();
    const node = pathNodes(element.attr('d')).find((item) => item.index === index);
    if (!node) return;
    const amount = event.shiftKey ? 10 : 1;
    if (moveNodeTo(index, { x: node.x + step[0] * amount, y: node.y + step[1] * amount })) {
      nodeEdit.moved = true;
      commitNodeEdit();
      container.querySelector(`[data-path-node="${index}"]`)?.focus();
    }
  });

  /* ── Panning ─────────────────────────────────────────────────────────────
   * The Hand tool, space-drag and the middle button all do the same thing, so
   * the view can be moved without leaving whatever tool is in hand.
   */
  let panning = null;
  let spaceHeld = false;
  const wantsPan = (event) => event.button === 1 || (event.button === 0 && (activeTool === 'hand' || spaceHeld));

  container.addEventListener('pointerdown', (event) => {
    if (!wantsPan(event) || nodeEdit?.dragging != null || onCanvasOverlay(event)) return;
    event.preventDefault();
    event.stopPropagation();
    panning = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    container.setPointerCapture?.(event.pointerId);
    container.classList.add('panning');
  }, true);

  container.addEventListener('pointermove', (event) => {
    if (!panning) return;
    api.panView(event.clientX - panning.x, event.clientY - panning.y);
    panning.x = event.clientX; panning.y = event.clientY;
  });

  const endPan = (event) => {
    if (!panning) return;
    container.releasePointerCapture?.(panning.pointerId ?? event?.pointerId);
    panning = null;
    container.classList.remove('panning');
  };
  container.addEventListener('pointerup', endPan, true);
  container.addEventListener('pointercancel', endPan);

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    spaceHeld = true;
    container.classList.add('pan-ready');
  });
  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return;
    spaceHeld = false;
    container.classList.remove('pan-ready');
  });

  /* ── Puppet handles (docs/DIRECT_CONTROLS.md) ────────────────────────────
   *
   * Posing by dragging the mascot itself. The handles sit on the artwork, the
   * geometry is `core/puppet/puppet-handles.js`, and what a drag produces is
   * ordinary parameter values — the same ones the sliders set.
   */
  const PUPPET_NUDGE = 0.05;
  // Alt: a fifth of a step, which is the 0.01 the sliders offer.
  const PUPPET_PRECISION = 0.2;
  const PUPPET_SPOTS = Object.freeze({ centre: { x: .5, y: .5 }, top: { x: .5, y: .08 }, bottom: { x: .5, y: .92 }, left: { x: .06, y: .5 }, right: { x: .94, y: .5 }, bottomLeft: { x: .1, y: .88 } });

  /**
   * Where one element's clip lands on screen, or null when it has none.
   *
   * The clip is in the element's own user space, which is exactly what
   * `getScreenCTM` maps: no geometry is re-derived here, the browser is asked
   * where the clipping shape ended up.
   */
  function clipRect(node) {
    const reference = /url\(['"]?#([^)'"]+)['"]?\)/.exec(node.getAttribute?.('clip-path') || '')?.[1];
    const shape = reference && (node.ownerSVGElement || node).querySelector?.(`#${CSS.escape(reference)} > *`);
    const box = shape && safeBBox(shape);
    const ctm = box?.width ? node.getScreenCTM?.() : null;
    if (!ctm) return null;
    const at = (x, y) => ({ x: ctm.a * x + ctm.c * y + ctm.e, y: ctm.b * x + ctm.d * y + ctm.f });
    const corners = [at(box.x, box.y), at(box.x + box.width, box.y), at(box.x, box.y + box.height), at(box.x + box.width, box.y + box.height)];
    const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }

  /**
   * The box a piece of artwork actually covers on screen.
   *
   * An eye is a group of shapes clipped to its socket: the lids are drawn far
   * wider than the eye, and the clip hides the rest. `getBoundingClientRect`
   * measures what was *drawn*, so the eye came out 375px tall and its handle
   * floated up onto the forehead, on top of the head's own. Every clip on the
   * way up applies -- the fringe is clipped by the head it hangs on, not by
   * anything of its own.
   */
  function visibleRect(node) {
    const measured = node?.getBoundingClientRect?.();
    if (!measured?.width) return measured;
    let rect = { x: measured.x, y: measured.y, width: measured.width, height: measured.height };
    // Up to the drawing's root, and no further: `ownerSVGElement` is null once
    // the walk leaves the SVG.
    for (let owner = node; owner?.ownerSVGElement; owner = owner.parentElement) {
      const clip = clipRect(owner);
      if (!clip) continue;
      const left = Math.max(rect.x, clip.x), right = Math.min(rect.x + rect.width, clip.x + clip.width);
      const top = Math.max(rect.y, clip.y), bottom = Math.min(rect.y + rect.height, clip.y + clip.height);
      if (right > left && bottom > top) rect = { x: left, y: top, width: right - left, height: bottom - top };
    }
    return rect;
  }

  function clearPuppet() {
    if (!puppet) return;
    for (const { button } of puppet.handles) button.remove();
    for (const { button } of puppet.expanders || []) button.remove();
    puppet.halo?.remove();
    puppet.reachNode?.remove();
    puppet = null;
    container.classList.remove('puppet-ready');
  }

  /**
   * The nine head positions, around the head handle.
   *
   * `headX` and `headY` are what the pose grid interpolates, so dragging the
   * head handle is already driving the 2.5D turn — this is the part that says
   * so: which position you are near, and which ones hold a captured pose.
   */
  const HALO_RADIUS = 34;

  /**
   * The reach a hand has, drawn while its handle is held.
   *
   * The ellipse is the model's own (`handReachEllipse`), in the artwork's
   * coordinates, so what is drawn is exactly what the runtime allows rather
   * than a picture of it.
   */
  function renderPuppetReach(entry) {
    const reach = entry?.handle?.reach;
    const wanted = Boolean(reach) && puppet?.visible && puppet.dragging?.entry === entry;
    if (!wanted) { puppet?.reachNode?.remove(); if (puppet) puppet.reachNode = null; return; }
    if (!puppet.reachNode) {
      puppet.reachNode = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      puppet.reachNode.setAttribute('class', 'puppet-reach');
      puppet.reachNode.setAttribute('fill', 'none');
      puppet.reachNode.setAttribute('pointer-events', 'none');
      puppet.reachNode.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    const node = documentModel.getNode(entry.handle.anchor);
    const parent = node?.parentNode;
    if (!parent) return;
    if (puppet.reachNode.parentNode !== parent) parent.append(puppet.reachNode);
    puppet.reachNode.setAttribute('cx', reach.cx);
    puppet.reachNode.setAttribute('cy', reach.cy);
    puppet.reachNode.setAttribute('rx', reach.rx);
    puppet.reachNode.setAttribute('ry', reach.ry);
  }
  function renderPuppetHalo(entry) {
    if (!puppet) return;
    const grid = puppet.grid?.(entry.handle);
    // An empty grid means `headX` only slides the head sideways. That is the
    // moment to say so — on the mascot, where the drag just happened.
    const offer = Boolean(grid?.empty) && Boolean(puppet.generateTurn);
    const wanted = Boolean(grid) && puppet.visible && (puppet.dragging?.entry === entry || grid.captured > 0 || offer);
    if (!wanted) { puppet.halo?.setAttribute('hidden', ''); return; }
    if (!puppet.halo) {
      puppet.halo = document.createElement('div');
      puppet.halo.className = 'puppet-halo';
      puppet.halo.setAttribute('aria-hidden', 'true');
      container.append(puppet.halo);
    }
    const box = container.getBoundingClientRect();
    const rect = entry.button.getBoundingClientRect();
    puppet.halo.removeAttribute('hidden');
    puppet.halo.style.left = `${rect.x + rect.width / 2 - box.left}px`;
    puppet.halo.style.top = `${rect.y + rect.height / 2 - box.top}px`;
    // Alone in the halo, the offer has to be reachable: a neighbouring handle
    // would otherwise sit over it, and handles paint above the halo so the
    // pose dots never swallow a drag of the head handle they surround.
    puppet.halo.toggleAttribute('data-halo-offer', Boolean(grid.empty));
    const cells = grid.empty
      ? `<button type="button" class="halo-generate" data-halo-generate title="Right now the head only slides sideways. Generate the 2.5D turn from the face parts.">Make it 3D</button>`
      : grid.cells.map((cell) => `<i data-halo-cell="${cell.i},${cell.j}" data-halo-state="${cell.state}"${cell.current ? ' data-halo-current="true"' : ''}
      style="left:${(cell.at.x - 0.5) * 2 * HALO_RADIUS}px;top:${(cell.at.y - 0.5) * 2 * HALO_RADIUS}px"></i>`).join('');
    if (puppet.halo.dataset.cells !== cells) { puppet.halo.innerHTML = cells; puppet.halo.dataset.cells = cells; }
  }

  /**
   * The handles ride the artwork, so they are placed again whenever a frame
   * moves it — coalesced to one pass per animation frame, since placing them
   * reads layout.
   */
  let puppetPlacePending = false, puppetPlacedAt = 0;
  /** Placing reads layout, so a frame that is only playing back gets a slower lane. */
  const PUPPET_IDLE_INTERVAL = 200;
  function schedulePuppetPlacement({ immediate = false } = {}) {
    // Hidden handles need no placement, so a task that does not pose costs
    // nothing per frame.
    if (!puppet || !puppet.visible || puppetPlacePending) return;
    const now = Date.now();
    if (!immediate && !puppet.dragging && now - puppetPlacedAt < PUPPET_IDLE_INTERVAL) return;
    puppetPlacePending = true;
    requestAnimationFrame(() => { puppetPlacePending = false; puppetPlacedAt = Date.now(); placePuppetHandles(); });
  }

  /** A member of a group nobody has opened is not on screen. */
  const folded = (handle) => Boolean(handle?.group) && !puppet?.expanded?.has(handle.group);

  /** Open or close one group's own controls. */
  function togglePuppetGroup(id) {
    if (!puppet) return false;
    const open = !puppet.expanded.has(id);
    if (open) puppet.expanded.add(id); else puppet.expanded.delete(id);
    for (const { button } of puppet.expanders) if (button.dataset.puppetExpand === id) button.setAttribute('aria-expanded', String(open));
    for (const entry of puppet.handles) if (entry.handle.group === id) entry.button.hidden = !puppet.visible || !open;
    placePuppetHandles();
    return open;
  }

  /** Where a handle sits: the middle of the artwork it moves, right now. */
  function placePuppetHandles() {
    if (!puppet || !puppet.visible) return;
    const box = container.getBoundingClientRect();
    for (const entry of puppet.handles) {
      if (folded(entry.handle)) { entry.button.hidden = true; continue; }
      // A handle may name a point in the artwork's own coordinates rather than
      // a corner of a box: a fingertip is not a corner of the hand.
      if (entry.handle.point) {
        const node = documentModel.getNode(entry.handle.anchor);
        const ctm = node?.getScreenCTM?.();
        if (!ctm) { entry.button.hidden = true; continue; }
        const { x, y } = entry.handle.point;
        entry.button.hidden = false;
        entry.button.style.left = `${ctm.a * x + ctm.c * y + ctm.e - box.left}px`;
        entry.button.style.top = `${ctm.b * x + ctm.d * y + ctm.f - box.top}px`;
        continue;
      }
      // A handle moves both eyes or both brows, so it sits between them
      // rather than on one side of the face.
      const rects = (entry.handle.elements || [entry.handle.anchor])
        .map((id) => visibleRect(documentModel.getNode(id)))
        .filter((item) => item && item.width);
      if (!rects.length) { entry.button.hidden = true; continue; }
      const rect = {
        x: Math.min(...rects.map((item) => item.x)),
        y: Math.min(...rects.map((item) => item.y)),
        width: Math.max(...rects.map((item) => item.x + item.width)) - Math.min(...rects.map((item) => item.x)),
        height: Math.max(...rects.map((item) => item.y + item.height)) - Math.min(...rects.map((item) => item.y))
      };
      // `at` keeps two handles off the same spot: the gaze sits in the middle
      // of the pupil, so the eyelid's handle goes on top of the eye, the
      // head's above the face where a puppeteer would hold it, and the tilt
      // beside it like a knob.
      const spot = PUPPET_SPOTS[entry.handle.at] || PUPPET_SPOTS.centre;
      entry.button.hidden = false;
      entry.button.style.left = `${rect.x + rect.width * spot.x - box.left}px`;
      entry.button.style.top = `${rect.y + rect.height * spot.y - box.top}px`;
      if (entry.handle.grid) renderPuppetHalo(entry);
      if (entry.handle.reach) renderPuppetReach(entry);
      // The opener rides just off the group's own handle.
      const expander = puppet.expanders.find((item) => item.id === entry.handle.id);
      if (expander) {
        expander.button.hidden = false;
        expander.button.style.left = `${Number.parseFloat(entry.button.style.left) + 19}px`;
        expander.button.style.top = `${Number.parseFloat(entry.button.style.top) - 15}px`;
      }
    }
  }

  /**
   * What the handles say, refreshed from the document.
   *
   * Placement runs every frame of a drag, so it only moves the buttons; the
   * spoken value is recomputed when something that changes it happened --
   * a pose applied, the 2.5D grid generated or cleared.
   */
  function describePuppetHandles() {
    if (!puppet) return;
    const values = puppet.getValues();
    for (const entry of puppet.handles) entry.button.setAttribute('aria-valuetext', puppet.describe(entry.handle, values));
  }

  /** The part's size in its own units, so a gesture scales with the drawing. */
  function puppetSize(handle) {
    const node = documentModel.getNode(handle.anchor);
    const box = node && safeBBox(node);
    return box ? Math.max(box.width, box.height) || 40 : 40;
  }

  /** Client delta → the artwork's own units, whatever the zoom. */
  function puppetDelta(handle, event, origin) {
    const node = documentModel.getNode(handle.anchor);
    const ctm = node?.parentNode?.getScreenCTM?.();
    const scale = ctm ? Math.hypot(ctm.a, ctm.b) || 1 : 1;
    return { dx: (event.clientX - origin.x) / scale, dy: (event.clientY - origin.y) / scale };
  }

  function puppetApply(entry, values, { commit = false } = {}) {
    if (!Object.keys(values).length) return;
    puppet.onChange(values, { handle: entry.handle, commit });
    entry.button.setAttribute('aria-valuetext', puppet.describe(entry.handle, puppet.getValues()));
    schedulePuppetPlacement({ immediate: true });
  }

  /** The middle of what a handle moves, in client coordinates. */
  function puppetCentre(handle) {
    const rects = (handle.elements || [handle.anchor]).map((id) => visibleRect(documentModel.getNode(id))).filter(Boolean);
    if (!rects.length) return null;
    const left = Math.min(...rects.map((r) => r.x)), right = Math.max(...rects.map((r) => r.x + r.width));
    const top = Math.min(...rects.map((r) => r.y)), bottom = Math.max(...rects.map((r) => r.y + r.height));
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }

  const angleAt = (centre, point) => Math.atan2(point.y - centre.y, point.x - centre.x) * 180 / Math.PI;

  container.addEventListener('click', (event) => {
    const expand = event.target.closest?.('[data-puppet-expand]');
    if (expand) { event.preventDefault(); togglePuppetGroup(expand.dataset.puppetExpand); return; }
    if (event.target.closest?.('[data-halo-generate]') && puppet?.generateTurn) { event.preventDefault(); puppet.generateTurn(); return; }
    const dot = event.target.closest?.('[data-halo-cell]');
    if (!dot || !puppet?.goToCell) return;
    event.preventDefault();
    const [i, j] = dot.dataset.haloCell.split(',').map(Number);
    const entry = puppet.handles.find((item) => item.handle.grid);
    const values = puppet.goToCell({ i, j });
    if (entry && values) puppetApply(entry, values, { commit: true });
  });

  container.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.('[data-puppet-handle]');
    if (!button || !puppet || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const entry = puppet.handles.find((item) => item.button === button);
    if (!entry) return;
    button.setPointerCapture(event.pointerId);
    const centre = puppetCentre(entry.handle);
    puppet.dragging = {
      entry, origin: { x: event.clientX, y: event.clientY }, start: puppet.getValues(), size: puppetSize(entry.handle),
      centre, angle: centre ? angleAt(centre, { x: event.clientX, y: event.clientY }) : 0, turned: 0
    };
  }, true);

  container.addEventListener('pointermove', (event) => {
    if (!puppet?.dragging) return;
    const drag = puppet.dragging;
    const { entry, origin, start, size } = drag;
    let values;
    if (entry.handle.mode === 'orbit' && drag.centre) {
      // Unwrap at ±180° so a turn keeps going the way the hand is going.
      const angle = angleAt(drag.centre, { x: event.clientX, y: event.clientY });
      let step = angle - drag.angle;
      while (step > 180) step -= 360;
      while (step < -180) step += 360;
      drag.angle = angle;
      drag.turned += event.altKey ? step * PUPPET_PRECISION : step;
      values = puppetOrbitValues(entry.handle, drag.turned, { start });
    } else {
      // Alt is the precision modifier: the pointer travels the same distance,
      // the parameter moves a fifth as far. The scaling is rebased whenever the
      // modifier changes, so pressing or releasing Alt mid-drag continues from
      // where the handle is instead of jumping. Shift stays snap, so a grid
      // handle can be nudged precisely or landed on a cell, never both.
      const raw = puppetDelta(entry.handle, event, origin);
      const factor = event.altKey ? PUPPET_PRECISION : 1;
      if (!drag.scale || drag.scale.factor !== factor) drag.scale = { factor, raw, from: drag.delta || { dx: 0, dy: 0 } };
      drag.delta = { dx: drag.scale.from.dx + (raw.dx - drag.scale.raw.dx) * factor, dy: drag.scale.from.dy + (raw.dy - drag.scale.raw.dy) * factor };
      values = puppetDragValues(entry.handle, drag.delta, { start, size });
      // Shift lands the head on one of the nine captured positions.
      if (event.shiftKey && !event.altKey && entry.handle.grid && puppet.snap) values = { ...values, ...puppet.snap(values) };
    }
    drag.values = values;
    puppetApply(entry, values);
  });

  container.addEventListener('pointerup', (event) => {
    if (!puppet?.dragging) return;
    // What the gesture produced, not the whole parameter set: committing
    // everything would write every movement into an expression at once.
    const { entry, values } = puppet.dragging;
    event.target.releasePointerCapture?.(event.pointerId);
    puppet.dragging = null;
    if (entry.handle.reach) renderPuppetReach(entry);
    if (values) puppetApply(entry, values, { commit: true });
  }, true);

  container.addEventListener('dblclick', (event) => {
    const button = event.target.closest?.('[data-puppet-handle]');
    if (!button || !puppet) return;
    const entry = puppet.handles.find((item) => item.button === button);
    if (entry) puppetApply(entry, puppetRestValues(entry.handle), { commit: true });
  });

  // A handle is a control, so it answers to the keyboard like one.
  container.addEventListener('keydown', (event) => {
    const button = event.target.closest?.('[data-puppet-handle]');
    if (!button || !puppet) return;
    const entry = puppet.handles.find((item) => item.button === button);
    if (!entry) return;
    if (event.key === 'Home') {
      event.preventDefault();
      puppetApply(entry, puppetRestValues(entry.handle), { commit: true });
      return;
    }
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step) return;
    event.preventDefault();
    const amount = (event.altKey ? PUPPET_PRECISION : event.shiftKey ? 4 : 1) * PUPPET_NUDGE;
    const start = puppet.getValues();
    if (entry.handle.mode === 'orbit') {
      const turn = (step[0] || step[1]) * amount * Math.abs(entry.handle.throw || 120);
      puppetApply(entry, puppetOrbitValues(entry.handle, turn, { start }), { commit: true });
      return;
    }
    const size = puppetSize(entry.handle);
    const span = Math.max(8, size * entry.handle.throw);
    puppetApply(entry, puppetDragValues(entry.handle, { dx: step[0] * amount * span, dy: step[1] * amount * span }, { start, size }), { commit: true });
  });

  function commitDocument(updateStore = true) {
    const markup = documentModel.serialize();
    loadedMarkup = markup;
    if (updateStore) commands.syncSvg({svgMarkup:markup,layers:documentModel.getTree(),layerMetadata:documentModel.metadata},{snapshot:false});
    return markup;
  }

  function refreshDocument(selectId = null) {
    const svgRoot = rootGroup.node.querySelector('svg');
    const tree = documentModel.load(svgRoot, documentModel.metadata);
    const state=structuredClone(store.getDocument());
      state.layers = tree;
      state.layerMetadata = structuredClone(documentModel.metadata);
      const valid = new Set();
      const visit = (items) => items.forEach((item) => { valid.add(item.id); const node=wrapperFor(item.id),plugin=pluginRegistry.getByNode(node); if(plugin&&!state.elements[item.id]) state.elements[item.id]=plugin.createRigData(node,parseTransform(node)); attachBehavior(node); visit(item.children); });
      visit(tree);
      // A piece that is gone is gone from everything that pointed at it: a
      // semantic role, a shape key, a keyform, a hand. Those panels subscribe
      // to their own domains, so deleting artwork has to notify them or they
      // keep showing an entry for artwork that no longer exists.
      const removed = Object.keys(state.elements).some((id)=>!valid.has(id));
      Object.keys(state.elements).forEach((id)=>{if(!valid.has(id))delete state.elements[id];});
      state.svgMarkup = documentModel.serialize();
    // Before the command, not after: the store notifies synchronously, and a
    // reconcile that still believed the old markup rebuilt the whole canvas --
    // which threw the zoom and pan away every time anything was drawn.
    loadedMarkup = state.svgMarkup;
    commands.syncSvg({layers:state.layers,layerMetadata:state.layerMetadata,elements:state.elements,svgMarkup:state.svgMarkup},{snapshot:false,domains:removed?['artwork','layers','semanticRig','keyforms','hands']:undefined});
    store.mutateSession('selectedId',session=>{session.selectedId=selectId;});
  }

  /**
   * A pointer event in the **artwork's** own coordinates.
   *
   * Which is the imported `<svg>`'s viewBox, not the group that holds it: a
   * shape is appended inside that `<svg>`, so measuring anywhere else puts it
   * somewhere else. Half a pixel of precision is kept, so a small shape on a
   * zoomed-out canvas is not rounded away.
   */
  function artworkPoint(event) {
    const host = rootGroup.node.querySelector('svg');
    const ctm = host?.getScreenCTM();
    if (!ctm) return null;
    const point = draw.node.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());
    const round = (value) => Math.round(value * 2) / 2;
    return { x: round(local.x), y: round(local.y) };
  }

  // A press on the menu is not a press on the mascot behind it: the gizmo used
  // to take it as a body drag and stop the click ever reaching the button.
  container.addEventListener('pointerdown', (event) => { if (!onCanvasOverlay(event) && gizmo.onPointerDown(event)) event.stopPropagation(); }, true);
  container.addEventListener('pointermove', (event) => { gizmo.onPointerMove(event); });
  container.addEventListener('pointerup', (event) => { if (gizmo.onPointerUp(event)) event.stopPropagation(); }, true);
  container.addEventListener('pointercancel', () => gizmo.cancel());
  /*
   * Drawing a shape.
   *
   * Four things were wrong with the first version, and every one of them was
   * visible the first time anyone pressed Rectangle:
   *
   * 1. The shape was placed in the outer group's coordinates but appended to
   *    the imported `<svg>`, which has a viewBox of its own. A rectangle drawn
   *    over the face landed off the artboard, three times too big.
   * 2. The toolbar sits inside the canvas element, so pressing another tool --
   *    or the zoom buttons -- was also a press on the drawing surface, and left
   *    a 2x2 pixel shape behind every time.
   * 3. Nothing was drawn until the gesture ended, so there was no way to see
   *    what was being made.
   * 4. The tool stayed armed afterwards, so the obvious next move (click the
   *    new shape to move it) drew another shape on top of it.
   */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DRAW_TOOLS = new Set(['rect', 'ellipse', 'pen']);
  const DRAW_FILL = '#60a5fa';
  const DRAW_MIN = 3;
  /**
   * Chrome lives inside the canvas element, so a press on a button is not a
   * press on the artwork — and the artwork underneath must not act on it.
   *
   * `overlay` is the UI floating over the canvas: the toolbars, the mode
   * banner, and the right-click menu, which sits on top of the very artwork it
   * edits. `chrome` adds the handles the canvas draws for itself, which the
   * shape tools must ignore but the gizmo owns.
   */
  const onCanvasOverlay = (event) => Boolean(event.target?.closest?.(
    'button, input, select, label, [data-canvas-menu], .design-toolbar, .canvas-toolbar, .canvas-mode-banner'
  ));
  const onCanvasChrome = (event) => onCanvasOverlay(event) || Boolean(event.target?.closest?.('.puppet-handle, .puppet-expand, .puppet-halo, [data-gizmo-layer]'));
  let drawing = null;

  /**
   * One shape, from two corners — used for the preview and for the artwork, so
   * what an author sees while dragging is exactly what is committed.
   */
  function shapeSpec(tool, a, b, points = null) {
    if (tool === 'pen') {
      const list = [...(points || []), b].filter(Boolean);
      if (list.length < 2) return null;
      const d = list.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
      return { name: 'path', label: 'Line', attrs: { d, fill: 'none', stroke: DRAW_FILL, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } };
    }
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (tool === 'ellipse') return { name: 'ellipse', label: 'Ellipse', attrs: { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, fill: DRAW_FILL } };
    return { name: 'rect', label: 'Rectangle', attrs: { x, y, width: w, height: h, rx: Math.min(8, w / 4, h / 4), fill: DRAW_FILL } };
  }

  const drawNode = (spec) => { const node = document.createElementNS(SVG_NS, spec.name); for (const [key, value] of Object.entries(spec.attrs)) node.setAttribute(key, value); return node; };

  function renderDrawPreview(spec) {
    while (drawLayer.firstChild) drawLayer.firstChild.remove();
    if (!spec) return;
    const node = drawNode(spec);
    node.setAttribute('opacity', '.7');
    drawLayer.append(node);
  }

  /** Give up on whatever is being drawn. Returns whether there was anything. */
  function cancelDrawing() {
    const had = Boolean(drawing);
    drawing = null;
    renderDrawPreview(null);
    return had;
  }

  /** Turn the preview into artwork, select it, and go back to Select. */
  function commitDrawing(spec) {
    const svgRoot = rootGroup.node.querySelector('svg');
    cancelDrawing();
    if (!spec || !svgRoot) return null;
    history.snapshot();
    const node = drawNode(spec);
    node.setAttribute('data-name', spec.label);
    svgRoot.appendChild(node);
    refreshDocument();
    const id = node.getAttribute('id');
    store.mutateSession('selectedId', (state) => { state.selectedId = id; });
    // A tool you have to leave by hand is a tool that draws when you meant to
    // select: one shape, then straight back to Select with it selected.
    api.setTool('select');
    toolChangeHandler('select');
    return id;
  }

  container.addEventListener('pointerdown', (event) => {
    if (workspace !== 'create' || !DRAW_TOOLS.has(activeTool) || event.button !== 0 || onCanvasChrome(event)) return;
    const point = artworkPoint(event);
    if (!point) return;
    event.preventDefault();
    raiseDrawLayer();
    if (activeTool === 'pen') {
      // A pen is a run of points: press to add one, double-click or Enter to
      // finish, and pressing the first point again closes the outline.
      const points = drawing?.points || [];
      const first = points[0];
      if (first && points.length > 2 && Math.hypot(point.x - first.x, point.y - first.y) < 8) {
        const spec = shapeSpec('pen', null, first, points);
        commitDrawing(spec && { ...spec, attrs: { ...spec.attrs, d: `${spec.attrs.d} Z` } });
        return;
      }
      drawing = { tool: 'pen', points: [...points, point] };
      renderDrawPreview(shapeSpec('pen', null, point, points));
      return;
    }
    drawing = { tool: activeTool, start: point, moved: false };
    container.setPointerCapture?.(event.pointerId);
  });

  container.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const point = artworkPoint(event);
    if (!point) return;
    if (drawing.tool === 'pen') { renderDrawPreview(shapeSpec('pen', null, point, drawing.points)); return; }
    if (!drawing.moved && Math.hypot(point.x - drawing.start.x, point.y - drawing.start.y) < DRAW_MIN) return;
    drawing.moved = true;
    drawing.end = point;
    renderDrawPreview(shapeSpec(drawing.tool, drawing.start, point));
  });

  container.addEventListener('pointerup', (event) => {
    if (!drawing || drawing.tool === 'pen') return;
    container.releasePointerCapture?.(event.pointerId);
    // A press that never moved is a press, not a drawing: it used to leave a
    // 2x2 shape wherever the author clicked.
    const spec = drawing.moved ? shapeSpec(drawing.tool, drawing.start, drawing.end || drawing.start) : null;
    commitDrawing(spec);
  });

  container.addEventListener('dblclick', (event) => {
    // A double-click on the outline is how a point is added, which is what the
    // Node tool was missing: it could move the points a shape already had and
    // nothing else.
    if (nodeEdit && !event.target.closest?.('[data-path-node]')) {
      const point = artworkPoint(event);
      if (point && insertNodeNear(point)) { event.preventDefault(); return; }
    }
    // Belt and braces: leaving Artwork already cancels a pen run, and a run
    // that outlived it must not be able to author artwork from Preview.
    if (drawing?.tool !== 'pen' || workspace !== 'create') return;
    event.preventDefault();
    const spec = drawing.points.length > 1 ? shapeSpec('pen', null, drawing.points.at(-1), drawing.points.slice(0, -1)) : null;
    commitDrawing(spec);
  });

  draw.on('click', () => { store.mutateSession('selectedId', state => { state.selectedId = null; }); });
  // One visible mode instruction for Canvas pick tools. It is transient UI only.
  const modeBanner = () => {
    let node = container.querySelector('.canvas-mode-banner');
    if (!node) {
      node = document.createElement('div'); node.className = 'canvas-mode-banner'; node.setAttribute('role', 'status'); node.hidden = true;
      node.innerHTML = '<span data-canvas-mode-text></span><button type="button" data-canvas-mode-capture hidden>Capture</button><button type="button" class="secondary" data-canvas-mode-cancel>Cancel (Esc)</button>';
      node.querySelector('[data-canvas-mode-cancel]').onclick = () => api.cancelRigTool();
      node.querySelector('[data-canvas-mode-capture]').onclick = () => modeCapture?.();
      container.append(node);
    }
    return node;
  };
  let modeCapture = null;
  const showMode = (text, capture = null) => { const node = modeBanner(); node.querySelector('[data-canvas-mode-text]').textContent = text; modeCapture = capture; node.querySelector('[data-canvas-mode-capture]').hidden = !capture; node.hidden = false; };
  const hideMode = () => { const node = container.querySelector('.canvas-mode-banner'); if (node) node.hidden = true; };
  const api = {
    /** Told when the canvas changes tool on its own, so the toolbar can follow. */
    onToolChange(handler) { toolChangeHandler = typeof handler === 'function' ? handler : () => {}; },
    /** Abandon a shape being drawn. Returns whether there was one. */
    cancelDrawing() { return cancelDrawing(); },
    /** Whether a shape is being drawn right now (a pen run counts). */
    isDrawing() { return Boolean(drawing); },
    /** Close a pen run from the keyboard. Returns whether it made a shape. */
    finishDrawing() {
      if (drawing?.tool !== 'pen') return false;
      const points = drawing.points;
      const spec = points.length > 1 ? shapeSpec('pen', null, points.at(-1), points.slice(0, -1)) : null;
      if (!spec) { cancelDrawing(); return false; }
      commitDrawing(spec);
      return true;
    },
    beginRolePick({ label, pick, cancel }) {
      this.cancelRigTool();
      rigTool={kind:'role',pick,cancel};
      container.classList.add('rig-role-picking');
      container.setAttribute('aria-label',`Pick artwork for ${label}. Press Escape to cancel.`);
      showMode(`Click the ${label} on the canvas.`);
    },
    beginPivotEdit(id, { commit, cancel }) {
      this.cancelRigTool();
      const element=wrapperFor(id);if(!element)return false;
      const handle=document.createElement('button');handle.className='rig-pivot-handle';handle.type='button';handle.textContent='⊕';handle.setAttribute('aria-label','Drag pivot');container.append(handle);
      const place=(clientX,clientY)=>{const box=container.getBoundingClientRect();handle.style.left=`${clientX-box.left}px`;handle.style.top=`${clientY-box.top}px`;};
      const transform=store.getDocument().elements[id]?.baseTransform||{}, box=element.node.getBoundingClientRect();
      let clientX=box.left+box.width/2,clientY=box.top+box.height/2;
      if(Number.isFinite(transform.pivotX)&&Number.isFinite(transform.pivotY)){const point=draw.node.createSVGPoint();point.x=transform.pivotX;point.y=transform.pivotY;const screen=point.matrixTransform(element.node.getScreenCTM());clientX=screen.x;clientY=screen.y;}
      place(clientX,clientY);
      const move=(event)=>{clientX=event.clientX;clientY=event.clientY;place(clientX,clientY);};
      handle.onpointerdown=(event)=>{if(event.button===0)handle.setPointerCapture(event.pointerId);};
      handle.onpointermove=(event)=>{if(handle.hasPointerCapture(event.pointerId))move(event);};
      handle.onpointerup=(event)=>{move(event);handle.releasePointerCapture(event.pointerId);const point=draw.node.createSVGPoint();point.x=clientX;point.y=clientY;const local=point.matrixTransform(element.node.getScreenCTM().inverse());commit({x:local.x,y:local.y});this.cancelRigTool(false);};
      rigTool={kind:'pivot',cancel,handle};container.classList.add('rig-pivot-editing');return true;
    },
    beginTransformPose(ids,{cancel,instruction,capture}={}){
      this.cancelRigTool();const valid=ids.filter(id=>wrapperFor(id));if(!valid.length)return false;
      showMode(instruction||'Drag, resize or rotate the artwork into position, then press Capture.',capture||null);
      const baseAttributes=Object.fromEntries(valid.map(id=>[id,snapshotAttributes(documentModel.getNode(id))]));
      const baseBoxes=Object.fromEntries(valid.map(id=>[id,safeBBox(documentModel.getNode(id))]));
      rigTool={kind:'transform-pose',ids:valid,baseAttributes,baseBoxes,restoreExact:true,temporary:{},cancel};
      container.classList.add('rig-transform-pose');container.setAttribute('aria-label','Calibration pose editing. Drag, resize, or rotate the selected artwork.');
      valid.forEach(id=>wrapperFor(id).selectize().resize().draggable());showSelection(valid[0]);return true;
    },
    captureTransformPose(){if(rigTool?.kind!=='transform-pose')return null;hideMode();const current=rigTool;const poses=Object.fromEntries(current.ids.map(id=>[id,posedTransform(id,current)]));restoreRigNodes(current);rigTool=null;container.classList.remove('rig-transform-pose');container.removeAttribute('aria-label');current.ids.forEach(id=>wrapperFor(id)?.selectize(false).draggable(false));showSelection(store.getSession().selectedId);return poses;},
    beginMorphPose(id,initialPath,{cancel,instruction,capture}={}){
      this.cancelRigTool();const element=wrapperFor(id);if(element?.type!=='path')return false;
      showMode(instruction||'Move the path nodes into the target shape, then press Capture.',capture||null);
      const basePath=element.attr('d'),candidate=initialPath||basePath;element.attr('d',candidate);
      const numbers=[...candidate.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)];const handles=[];
      for(let i=0;i+1<numbers.length;i+=2){const point=draw.node.createSVGPoint();point.x=Number(numbers[i][0]);point.y=Number(numbers[i+1][0]);const screen=point.matrixTransform(element.node.getScreenCTM());const box=container.getBoundingClientRect(),handle=document.createElement('button');handle.type='button';handle.className='rig-node-handle';handle.setAttribute('aria-label',`Path node ${i/2+1}`);handle.style.left=`${screen.x-box.left}px`;handle.style.top=`${screen.y-box.top}px`;container.append(handle);handles.push({handle,xIndex:i,yIndex:i+1});handle.onpointerdown=e=>{if(e.button===0)handle.setPointerCapture(e.pointerId);};handle.onpointermove=e=>{if(!handle.hasPointerCapture(e.pointerId))return;const p=draw.node.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const local=p.matrixTransform(element.node.getScreenCTM().inverse());const values=[...element.attr('d').matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)];const replacements=new Map([[i,local.x],[i+1,local.y]]);let cursor=0,index=0,next='';for(const match of values){next+=element.attr('d').slice(cursor,match.index)+(replacements.has(index)?Number(replacements.get(index).toFixed(3)):match[0]);cursor=match.index+match[0].length;index++;}next+=element.attr('d').slice(cursor);element.attr('d',next);const b=container.getBoundingClientRect();handle.style.left=`${e.clientX-b.left}px`;handle.style.top=`${e.clientY-b.top}px`;};}
      rigTool={kind:'morph-pose',id,baseAttributes:{[id]:{d:basePath}},handles,cancel};container.classList.add('rig-morph-pose');container.setAttribute('aria-label','Morph endpoint editing. Topology is locked.');return true;
    },
    captureMorphPose(){if(rigTool?.kind!=='morph-pose')return null;hideMode();const current=rigTool,path=wrapperFor(current.id).attr('d');restoreRigNodes(current);current.handles.forEach(({handle})=>handle.remove());rigTool=null;container.classList.remove('rig-morph-pose');container.removeAttribute('aria-label');return path;},
    cancelRigTool(notify=true) { const current=rigTool;restoreRigNodes(current);rigTool=null;hideMode();container.classList.remove('rig-role-picking','rig-pivot-editing','rig-transform-pose','rig-morph-pose');container.removeAttribute('aria-label');container.querySelectorAll('[data-rig-candidate]').forEach(node=>node.removeAttribute('data-rig-candidate'));current?.handle?.remove();current?.handles?.forEach(({handle})=>handle.remove());current?.ids?.forEach(id=>wrapperFor(id)?.selectize(false).draggable(false));if(notify)current?.cancel?.(); },
    getElementBounds(id) { const node=wrapperFor(id);return node?node.bbox():null; },
    /** The element's current `d`, for capturing a warp's rest outline. */
    getPathData(id) { const node=wrapperFor(id);return node?.type==='path'?node.attr('d'):null; },
    // Canvas-relative pixel frame, comparable across nested transforms. Hidden artwork yields null.
    getElementFrame(id) { const node=documentModel.getNode(id);if(!node?.getBoundingClientRect)return null;const box=node.getBoundingClientRect();if(!box.width&&!box.height)return null;const base=container.getBoundingClientRect();return {x:box.left-base.left,y:box.top-base.top,width:box.width,height:box.height,cx:box.left-base.left+box.width/2,cy:box.top-base.top+box.height/2}; },
    setSuggestedArtwork(id) { container.querySelectorAll('[data-face-suggested]').forEach(node=>node.removeAttribute('data-face-suggested'));const node=id?documentModel.getNode(id):null;if(node)node.setAttribute('data-face-suggested','true'); },
    prepareSvgImport(svgText) {
      const safeMarkup = sanitizeSvgMarkup(svgText);
      const candidate = new DOMParser().parseFromString(safeMarkup, 'image/svg+xml').documentElement;
      if (!candidate.querySelector('path,rect,circle,ellipse,line,polyline,polygon,text,image,use,g')) {
        throw new Error('The imported SVG contains no supported artwork.');
      }
      return safeMarkup;
    },
    async loadSvgFromFile(file) { loadSvgText(await file.text()); },
    loadSvgFromText: loadSvgText,
    serializeCurrentSvg() { return commitDocument(false); },
    getTree() { return documentModel.getTree(); },
    getWarnings() { return [...documentModel.warnings]; },
    setWorkspace(next) {
      workspace=next;
      // The vector tools belong to Artwork (`docs/VECTOR_EDITING.md`, and the
      // shortcuts declare them scoped to it). Leaving that task puts the canvas
      // back to Select the way finishing a shape does: node handles, a
      // half-drawn pen run, the mode banner and the grab cursor are Artwork
      // chrome, and a node handle that survives into Preview still rewrites the
      // path it is dragged on.
      if (next !== 'create' && activeTool !== 'select') { api.setTool('select'); toolChangeHandler('select'); }
      clearSelection();
      Object.keys(store.getDocument().elements||{}).forEach((id)=>wrapperFor(id)?.draggable(false));
      showSelection(store.getSession().selectedId);
    },
    setTool(next) {
      activeTool=next; cancelDrawing(); gizmo.cancel(); endNodeEdit(); clearSelection();
      Object.keys(store.getDocument().elements||{}).forEach((id)=>{const node=wrapperFor(id);node?.selectize(false).draggable(false);});
      showSelection(store.getSession().selectedId);
      // The Node tool needs a path: start on the selection, or say what to do.
      if (next === 'node') {
        const id = store.getSession().selectedId;
        if (!startNodeEdit(id)) showMode('Click a path on the canvas to edit its nodes.', null);
        else showMode('Drag a node to reshape the path. Arrow keys nudge it; Esc leaves the tool.', null);
      } else hideMode();
    },
    /**
     * Put draggable handles on the mascot.
     *
     * @param {object[]} handles from `puppetHandles`
     * @param {object} hooks  getValues() → the live parameters,
     *   onChange(values, { handle, commit }) → where they go,
     *   describe(handle) → the handle's spoken value
     */
    setPuppetHandles(handles = [], { getValues = () => ({}), onChange = () => {}, describe = () => '', grid = null, snap = null, goToCell = null, generateTurn = null } = {}) {
      // Switching tasks must not rebuild the DOM for the same set of handles:
      // the stability suite flips workspaces two hundred times.
      const same = puppet && puppet.handles.length === handles.length
        && puppet.handles.every((entry, index) => entry.handle.id === handles[index].id && entry.handle.anchor === handles[index].anchor);
      if (same) {
        puppet.getValues = getValues; puppet.onChange = onChange; puppet.describe = describe;
        puppet.grid = grid; puppet.snap = snap; puppet.goToCell = goToCell; puppet.generateTurn = generateTurn;
        puppet.handles.forEach((entry, index) => { entry.handle = handles[index]; });
        describePuppetHandles();
        placePuppetHandles();
        return puppet.handles.length;
      }
      clearPuppet();
      if (!handles.length) return 0;
      const values = getValues();
      // A group's own members stay folded away until the author opens it: a
      // hand has seven controls of its own, and all of them at once buries the
      // face they hang beside.
      const groups = new Set(handles.map((handle) => handle.group).filter(Boolean));
      puppet = { handles: [], getValues, onChange, describe, grid, snap, goToCell, generateTurn, halo: null, dragging: null, visible: true, expanded: new Set(), expanders: [] };
      for (const handle of handles) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'puppet-handle';
        button.dataset.puppetHandle = handle.id;
        if (handle.group) button.dataset.puppetMember = handle.group;
        button.setAttribute('role', 'slider');
        button.setAttribute('aria-label', `${handle.label}. ${handle.hint}. Arrow keys adjust, Home resets.`);
        button.setAttribute('aria-valuetext', describe(handle, values));
        button.title = handle.hint;
        container.append(button);
        puppet.handles.push({ handle, button });
        if (!groups.has(handle.id)) continue;
        const expander = document.createElement('button');
        expander.type = 'button';
        expander.className = 'puppet-expand';
        expander.dataset.puppetExpand = handle.id;
        expander.setAttribute('aria-expanded', 'false');
        expander.setAttribute('aria-label', `Show the individual controls of ${handle.label}`);
        expander.title = `Every control of ${handle.label}`;
        container.append(expander);
        puppet.expanders.push({ id: handle.id, button: expander });
      }
      container.classList.add('puppet-ready');
      placePuppetHandles();
      return puppet.handles.length;
    },
    /**
     * Show or hide the handles without rebuilding them: a task switch is a
     * class toggle, not a DOM rebuild.
     */
    showPuppetHandles(visible) {
      if (!puppet) return false;
      puppet.visible = Boolean(visible);
      for (const { handle, button } of puppet.handles) button.hidden = !puppet.visible || folded(handle);
      for (const { button } of puppet.expanders) button.hidden = !puppet.visible;
      if (!puppet.visible) puppet.halo?.setAttribute('hidden', '');
      container.classList.toggle('puppet-ready', puppet.visible);
      if (puppet.visible) placePuppetHandles();
      return puppet.visible;
    },
    /** Reposition the handles, and say again where they are, after anything moved the artwork or changed the rig. */
    refreshPuppetHandles() { describePuppetHandles(); placePuppetHandles(); },
    clearPuppetHandles() { clearPuppet(); },
    getPuppetHandles() { return puppet ? puppet.handles.map((entry) => entry.handle.id) : []; },
    /** Which path is being node-edited, if any. */
    getNodeEdit() { return nodeEdit ? { id: nodeEdit.id, nodes: nodeEdit.handles.length } : null; },
    /* ── The working area (docs/VECTOR_EDITING.md) ────────────────────────── */
    /** Draw the artboard's edge, and the clip the selection is cut against. */
    showArtboardFrame(visible) { frameVisible = Boolean(visible); renderFrame(); return frameVisible; },
    /** What the drawing actually covers, in the artboard's own units. */
    getArtworkBounds() {
      const host = rootGroup?.node?.querySelector('svg');
      const box = host && safeBBox(host);
      return box && box.width ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
    },
    /** The artboard, what is outside it, and the artboard that would hold everything. */
    artboardReport(margin = 8) {
      const box = readArtboard(store.getDocument().svgMarkup || '');
      const content = this.getArtworkBounds();
      return { box, content, overflow: artboardOverflow(box, content), fitted: artboardAround(box, content, margin) };
    },
    setArtboard(box) { commands.setArtboard(box); renderFrame(); return readArtboard(store.getDocument().svgMarkup || ''); },
    /** Which element is clipping this one, and to what. Null when nothing is. */
    describeClip(id) {
      const clip = clipOwnerOf(id);
      if (!clip) return null;
      return { ownerId: clip.ownerId, clipId: clip.clipId, self: clip.ownerId === id };
    },
    /**
     * Stop clipping a piece.
     *
     * A clip is a deliberate tool -- the fringe is clipped to the head so it
     * cannot cross the outline -- but it is invisible, so an author redrawing
     * the hair taller has to be able to see it and take it off.
     */
    releaseClip(id) {
      const clip = clipOwnerOf(id);
      if (!clip?.owner) return false;
      history.snapshot();
      clip.owner.removeAttribute('clip-path');
      refreshDocument(store.getSession().selectedId);
      renderFrame();
      return true;
    },
    syncSelection(id) { if(id!==selectedId)showSelection(id); else gizmo.render(); },
    /** Gizmo mode: move | rotate | scale | pivot. */
    setGizmoMode(mode) { const changed = gizmo.setMode(mode); syncGizmoToolbar(); return changed; },
    getGizmoMode() { return gizmo.mode; },
    isGizmoDragging() { return gizmo.dragging; },
    handleGizmoKey(event) { const handled = gizmo.onKeyDown(event); if (handled) syncGizmoToolbar(); return handled; },
    cancelGizmoDrag() { return gizmo.cancel(); },
    renderGizmo() { gizmo.render(); },
    fitToCanvas(padding=.1) {
      if(!rootGroup?.node)return 1;
      setView({ scale: 1, x: 0, y: 0 });
      const box=rootGroup.node.getBBox(),width=container.clientWidth,height=container.clientHeight;
      if(!box.width||!box.height||!width||!height)return 1;
      const scale=Math.min(width*(1-padding*2)/box.width,height*(1-padding*2)/box.height);
      setView({ scale, x: (width-box.width*scale)/2-box.x*scale, y: (height-box.height*scale)/2-box.y*scale });
      return scale;
    },
    resetView(){ setView({ scale: 1, x: 0, y: 0 }); return 1; },
    /** Zoom about the middle of the viewport, so the mascot stays in view. */
    zoomView(factor){
      const view=viewTransform();
      const scale=Math.max(.2,Math.min(5,view.scale*factor));
      const cx=container.clientWidth/2, cy=container.clientHeight/2;
      const ratio=scale/(view.scale||1);
      setView({ scale, x: cx-(cx-view.x)*ratio, y: cy-(cy-view.y)*ratio });
      return scale;
    },
    /**
     * Move the view. The Hand tool used to be a button that only turned Select
     * off, so the canvas could not be panned at all — on a zoomed-in mascot
     * that means the artwork you want is simply out of reach.
     */
    panView(dx, dy) {
      const view=viewTransform();
      return setView({ scale: view.scale, x: view.x + dx, y: view.y + dy });
    },
    getView() { return viewTransform(); },
    appendArtwork(markup, mountPoint = null, { updateStore = true, viewBox = null } = {}) {
      const svgRoot=rootGroup.node.querySelector('svg');if(!svgRoot)return false;
      // Artwork that needs room to live in says so: a pair of hands hangs below
      // a face that already fills its artboard.
      if(viewBox)svgRoot.setAttribute('viewBox',viewBox);
      const target=(mountPoint&&documentModel.getNode(mountPoint))||svgRoot;
      target.insertAdjacentHTML('beforeend',sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`).replace(/^<svg[^>]*>|<\/svg>$/g,''));
      const tree=documentModel.load(svgRoot,documentModel.metadata);loadedMarkup=documentModel.serialize();
      const elements=structuredClone(store.getDocument().elements);const visit=(items)=>items.forEach((item)=>{if(!elements[item.id]){const node=wrapperFor(item.id),plugin=pluginRegistry.getByNode(node);if(plugin){elements[item.id]=plugin.createRigData(node,parseTransform(node));attachBehavior(node);}}visit(item.children);});visit(tree);
      const artwork={layers:tree,layerMetadata:structuredClone(documentModel.metadata),elements,svgMarkup:loadedMarkup};
      if(updateStore)commands.syncSvg(artwork);
      return artwork;
    },
    reconcileState(state) {
      diagnostics.increment('canvas.reconciles');
      if (!state.svgMarkup || state.svgMarkup === loadedMarkup) return;
      // Rebuilding the artwork must not move the camera: an undo, or another
      // panel writing to the document, is not a reason to re-frame the mascot.
      const view = viewTransform();
      rootGroup.remove(); rootGroup = draw.group().svg(sanitizeSvgMarkup(state.svgMarkup)); raiseGizmoLayer();
      setView(view);
      const svgRoot = rootGroup.node.querySelector('svg');
      documentModel.load(svgRoot, state.layerMetadata || {}); loadedMarkup = documentModel.serialize();
      Object.keys(state.elements || {}).forEach((id) => { const node = wrapperFor(id); if (node) attachBehavior(node); });
    },
    reorder(id, direction) { const changed = documentModel.reorder(id, direction); if (changed) commitDocument(); return changed; },
    setVisibility(id, visible) { const changed = documentModel.setVisibility(id, visible); if (changed) commitDocument(); return changed; },
    setLocked(id, locked) { const changed = documentModel.setLocked(id, locked); if (changed) { commitDocument(); updateElementInteractionState(id); } return changed; },
    setName(id, name) { const changed = documentModel.setName(id, name); if (changed) commitDocument(); return changed; },
    setExpanded(id, expanded) { documentModel.setExpanded(id, expanded); commitDocument(); },
    setAppearance(id, property, value) { const node=wrapperFor(id);if(!node)return false;history.snapshot();if(value===''||value==null)node.attr(property,null);else node.attr(property,value);documentModel.captureAuthoringAttribute(id,property);commitDocument();return true; },
    duplicate(id) { const node=documentModel.getNode(id);if(!node)return false;history.snapshot();const clone=node.cloneNode(true);clone.removeAttribute('id');node.parentNode.insertBefore(clone,node.nextSibling);refreshDocument();store.mutateSession('selectedId',state=>{state.selectedId=clone.getAttribute('id');});return true; },
    delete(id) { const node=documentModel.getNode(id);if(!node)return false;history.snapshot();node.remove();delete documentModel.metadata[id];refreshDocument();return true; },
    group(id) { const node=documentModel.getNode(id);if(!node||node===documentModel.root)return false;history.snapshot();const group=document.createElementNS('http://www.w3.org/2000/svg','g');node.parentNode.insertBefore(group,node);group.appendChild(node);refreshDocument();store.mutateSession('selectedId',state=>{state.selectedId=group.getAttribute('id');});return true; },
    ungroup(id) { const node=documentModel.getNode(id);if(!node||node.localName!=='g'||!node.parentNode)return false;history.snapshot();const parent=node.parentNode;while(node.firstChild)parent.insertBefore(node.firstChild,node);node.remove();refreshDocument();return true; },
    frameDiagnostic(id) {
      const node=documentModel.getNode(id), applied=node ? lastApplied.get(node)?.transform : undefined;
      return { requested:lastRequested.get(id) ? [...lastRequested.get(id)] : null, applied:applied ? [...applied] : null, domTransform:node?.getAttribute('transform') || null };
    },
    applyFrame(frame) {
      Object.entries(frame.paths || {}).forEach(([id, d]) => { const wrapper=wrapperFor(id),node=wrapper?.node;if(node&&wrapper.type==='path'){const previous=lastApplied.get(node)||{};if(previous.path!==d){wrapper.attr('d',d);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,path:d});}} });
      // A hierarchy resolves to one matrix; only a flat element uses channels.
      Object.entries(frame.matrices || {}).forEach(([id, matrix]) => {const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const next=matrixToString(matrix),previous=lastApplied.get(node)||{};if(previous.matrix!==next){wrapper.attr('transform',next);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,matrix:next,transform:null});}});
      // `scale 0` means collapsed, so only a missing or broken number falls back
      // to 1 -- `|| 1` kept a part the rig had closed open on the canvas alone.
      Object.entries(frame.transforms || {}).forEach(([id, transform]) => {if(frame.matrices?.[id])return;const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const next=[transform.x,transform.y,transform.rotation,transform.scaleX,transform.scaleY,transform.pivotX,transform.pivotY].map((value,index)=>{const fallback=index===3||index===4?1:0;return value==null||!Number.isFinite(Number(value))?fallback:Number(value);});lastRequested.set(id,[...next]);const previous=lastApplied.get(node)||{};if(!previous.transform||next.some((value,index)=>Math.abs(value-previous.transform[index])>1e-6)){const [x,y,rotation,scaleX,scaleY,pivotX,pivotY]=next;wrapper.attr('transform',`translate(${x} ${y}) rotate(${rotation} ${pivotX} ${pivotY}) translate(${pivotX} ${pivotY}) scale(${scaleX} ${scaleY}) translate(${-pivotX} ${-pivotY})`);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,transform:next});}});
      if (puppet) schedulePuppetPlacement();
      Object.entries(frame.opacity || {}).forEach(([id, opacity]) => {const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const previous=lastApplied.get(node)||{},next=Number(opacity);if(!Number.isFinite(previous.opacity)||Math.abs(next-previous.opacity)>1e-6){wrapper.attr('opacity',next);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,opacity:next});}});
    },
    applyElementTransform(id, element) {
      const node = wrapperFor(id); if (!node || store.getDocument().layerMetadata[id]?.locked) return;
      const transform = element.baseTransform || element;
      // A scale of 0 is a scale of 0, not a missing value: `|| 1` used to make a
      // part the rig asked to collapse stay full size on the canvas while the
      // exported runtime collapsed it.
      const at = (name, fallback) => { const value = transform[name]; return value == null || !Number.isFinite(Number(value)) ? fallback : Number(value); };
      const [x, y, rotation, scaleX, scaleY, pivotX, pivotY] = [at('x', 0), at('y', 0), at('rotation', 0), at('scaleX', 1), at('scaleY', 1), at('pivotX', 0), at('pivotY', 0)];
      node.attr('transform', `translate(${x} ${y}) rotate(${rotation} ${pivotX} ${pivotY}) translate(${pivotX} ${pivotY}) scale(${scaleX} ${scaleY}) translate(${-pivotX} ${-pivotY})`);
      documentModel.captureAuthoringNode(id);
    },
    applyPathData(id, d) { const node = wrapperFor(id); if (node?.type !== 'path') return; node.attr('d', d); documentModel.captureAuthoringNode(id); commitDocument(); },
    syncLayerOrder(tree) {
      documentModel.metadata = structuredClone(store.getDocument().layerMetadata || {});
      const sync = (items) => {
        items.forEach((item, index) => {
          const node = documentModel.getNode(item.id);
          const previous = index ? documentModel.getNode(items[index - 1].id) : null;
          if (node && previous && node.previousElementSibling !== previous) documentModel.moveAfter(item.id, items[index - 1].id);
          if (node) {
            item.visible === false ? node.setAttribute('display', 'none') : node.removeAttribute('display');
            documentModel.captureAuthoringAttribute(item.id, 'display');
          }
          sync(item.children || []);
        });
      };
      sync(Array.isArray(tree) ? tree : []);
    },
    getNode: wrapperFor
  };
  return api;
}
