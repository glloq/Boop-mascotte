import SVG from 'svg.js';
import 'svg.select.js';
import 'svg.resize.js';
import 'svg.draggable.js';
import { sanitizeSvgMarkup } from '../core/security/sanitize-svg.js';
import { collectAssetReferences, deferAssetReferences, paintAssetReferences } from '../../runtime/asset-paint.js';
import { pathOnlyMessage } from './path-only.js';
import { DEFAULT_MESH_SIZE, MESH_PRESETS, applyMeshesToDom, meshMarkup, restMesh } from '../../runtime/mesh-warp.js';
import { SvgDocument } from '../core/svg-document/svg-document.js';
import { lifecycleDiagnostics as diagnostics } from '../core/diagnostics/lifecycle-diagnostics.js';
import { createArtworkCommands } from '../core/commands/artwork-commands.js';
import { artboardAround, artboardOverflow, readArtboard } from '../core/artwork/artboard.js';
import { readCuts } from '../core/artwork/cuts.js';
import { faceGuides, ghostHead, landingBox } from '../core/face-library/face-guides.js';
import { createFaceLayoutContext } from '../core/face-library/face-layout.js';
import { createTransformGizmo } from './transform-gizmo.js';
import { alignBoxes, boxFromCorners, distributeBoxes, marqueeSelection, unionBox, vectorInSpace } from '../core/artwork/arrange.js';
import { poseBetween, removePose, transformFromChannels } from '../core/artwork/pose-transform.js';
import { selectMany, selectOnly, toggleSelected } from '../core/state/selection.js';
import { matrixToString } from '../../runtime/runtime.js';
import { createPreviewOrder } from '../core/preview-runtime/preview-order.js';
import { movePathNode, pathNodes } from '../core/path/path-nodes.js';
import { deletePathNode, insertPathNode, nearestPathPoint } from '../core/path/path-edit.js';
import { describeMigration } from '../core/path/path-topology.js';
import { puppetDragValues, puppetOrbitValues, puppetRestValues } from '../core/puppet/puppet-handles.js';
import { RIG_CONTROL_GROUPS } from '../core/puppet/control-groups.js';
import { HAND_RIG_PARTS, HAND_RIG_WORKSPACE, createHandRigGesture, handRigOverlay, handRigSide } from '../core/puppet/hand-handles.js';
import { handTrackAt, handTrackDirection, handTrackLength, handTrackPath, handTrackPoint } from '../core/puppet/hand-console.js';
import { handPickerChange, handPickerOffer, handPickerOverlay } from '../core/puppet/hand-picker.js';
import { controlSpot, packControls, pushClear } from '../core/puppet/control-packing.js';
import { handleGlyph } from '../core/puppet/handle-glyph.js';
import { renderPartGlyph } from '../ui/rig-controls/part-glyph.js';
import { handStyleThumbnail } from '../core/hands/hand-style-art.js';
import { installedHandLook } from '../core/sample/hand-feature.js';
import { createWarpGesture, isWarpEdgePoint, warpLattice, warpOverlay, warpedPath } from '../core/warp/warp-handles.js';
import { createMeshGesture, isMeshEdgePoint, meshLattice, meshOverlay } from '../core/mesh/mesh-handles.js';
import { createPinGesture, pinReachEllipse } from '../core/rig/pin-handles.js';
import { pinOverlay } from '../core/rig/pin-model.js';
import { createPinCommands } from '../core/rig/pin-commands.js';
import { createWarpCommands } from '../core/warp/warp-commands.js';
import { createHandCommands } from '../core/hands/hand-commands.js';
import { IDENTITY, applyMatrix, invertMatrix, matrixScale, matrixToString as matrixString, multiplyMatrix, viewBoxAttributes, viewBoxTransform } from '../core/artwork/viewport.js';
import { SHAPE_GEOMETRY_ATTRIBUTES, shapeToPath, snapToGrid } from '../core/path/path-build.js';
import { convertNode, movePathControl, pathControls, smoothNode } from '../core/path/path-controls.js';
import { DRAW_TOOLS, createDrawTools } from './draw-tools.js';
import { parsePath, serializePath } from '../../runtime/path-vector.js';

/**
 * A base transform as the seven numbers a frame compares, and as the attribute
 * a node carries.
 *
 * One spelling, because two writers share that attribute: the author's own
 * moves go through `applyElementTransform`, and every preview frame goes
 * through `applyFrame`. They compare against the same cache, so they have to
 * agree on what a transform *is*.
 *
 * A scale of 0 is a scale of 0, not a missing value: `|| 1` used to make a part
 * the rig asked to collapse stay full size on the canvas while the exported
 * runtime collapsed it.
 */
function transformValues(transform = {}) {
  const at = (name, fallback) => { const value = transform[name]; return value == null || !Number.isFinite(Number(value)) ? fallback : Number(value); };
  return [at('x', 0), at('y', 0), at('rotation', 0), at('scaleX', 1), at('scaleY', 1), at('pivotX', 0), at('pivotY', 0)];
}

function transformAttribute(transform = {}) {
  const [x, y, rotation, scaleX, scaleY, pivotX, pivotY] = transformValues(transform);
  return `translate(${x} ${y}) rotate(${rotation} ${pivotX} ${pivotY}) translate(${pivotX} ${pivotY}) scale(${scaleX} ${scaleY}) translate(${-pivotX} ${-pivotY})`;
}

// SVG.js 2.x `transform()` extracts `{x, y, rotation, scaleX, scaleY}`; the 3.x names are kept as a fallback.
// Group artwork is moved through its transform (not cx/cy), so a pose must read it or a dragged group calibrates to zero.
function parseTransform(element) {
  const matrix = element.transform();
  const pick = (...values) => values.find((value) => Number.isFinite(value));
  return { x: pick(matrix.translateX, matrix.x) ?? 0, y: pick(matrix.translateY, matrix.y) ?? 0, rotation: pick(matrix.rotate, matrix.rotation) ?? 0,
    scaleX: pick(matrix.scaleX) ?? 1, scaleY: pick(matrix.scaleY) ?? 1, pivotX: pick(matrix.originX) ?? 0, pivotY: pick(matrix.originY) ?? 0 };
}

export function createSvgCanvas(container, store, history, pluginRegistry, { assetResolver = null } = {}) {
  const commands = createArtworkCommands(store, history);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // SVG.js 2.x creates/attaches a drawing with SVG(container). addTo() is a
  // SVG.js 3 API and leaves the v2 plugins with an invalid parent (`put`).
  const draw = SVG(container).size('100%', '100%');
  let rootGroup = draw.group();
  const documentModel = new SvgDocument();
  // The paint order the exported runtime draws, borrowed for the preview and
  // given back whenever the document is read or edited (docs/DEPTH_PARALLAX.md).
  const previewOrder = createPreviewOrder({
    nodes: () => { const map = new Map(); rootGroup.node.querySelector('svg')?.querySelectorAll('[id]').forEach((node) => map.set(node.id, node)); return map; },
    ids: () => Object.keys(store.getDocument().elements || {}),
    parallax: () => store.getDocument().parallax
  });
  /**
   * The markup this canvas last put into the store, or last loaded from it.
   *
   * `reconcileState` rebuilds the whole drawing when the store's markup is not
   * this — that is how an undo, or another panel's edit, reaches the canvas. So
   * a canvas that writes markup and forgets to record it has armed a rebuild
   * against itself: the next unrelated change reloads the artwork from the
   * markup it wrote earlier, and every DOM-only edit made since is rolled back
   * without anybody asking. An author sees a move come undone the moment they
   * click something else (`syncDocument`).
   */
  let loadedMarkup = '';
  /**
   * Hand the document to the store, and remember what was handed over.
   *
   * Every canvas-side write that carries markup goes through here. The two that
   * did not — the gizmo's commit and the legacy drag plugin's — each left
   * `loadedMarkup` a version behind, which is the whole of the bug above.
   */
  const syncDocument = (patch, options) => {
    if (typeof patch?.svgMarkup === 'string') loadedMarkup = patch.svgMarkup;
    return commands.syncSvg(patch, options);
  };
  /**
   * A transform gesture is finished, so the document says so too.
   *
   * `setTransform` writes `elements` and `applyElementTransform` writes the
   * DOM; neither writes markup, so the store was left holding a drawing with
   * the move missing from it. Nothing noticed until the next rebuild, which
   * then restored that drawing — the move undone by nothing the author did.
   */
  const commitTransforms = () => commitDocument();
  let workspace = 'create';
  /**
   * What a click means on a surface where a person handles a mascot (audit
   * §2.1, §2.2).
   *
   * The canvas knows about SVG elements; it does not know that seven of them
   * are one eye. So it asks: `resolve(id)` gives the piece a person would name,
   * `contains(root, id)` says what is drawn inside one, and `commit(id, t)`
   * writes a gesture the way the inspector's fields write it — which is what
   * makes a drag mirror a linked pair.
   *
   * Unset on Artwork, which *is* the vector editor: there a click means the
   * shape under the pointer, and always did.
   */
  let pieces = null;
  /** The piece a double-click has stepped inside, so clicks reach its shapes. */
  let insidePiece = null;

  /** The piece an id belongs to, with no side effects. */
  const clickTargetOf = (id) => {
    if (!pieces?.resolve) return id;
    if (insidePiece && pieces.contains?.(insidePiece, id)) return id;
    return pieces.resolve(id) || id;
  };

  /** The id a plain click selects: the piece, or a shape inside the one entered. */
  const clickTarget = (id) => {
    if (!pieces?.resolve) return id;
    if (insidePiece && pieces.contains?.(insidePiece, id)) return id;
    insidePiece = null;
    return pieces.resolve(id) || id;
  };

  /**
   * Alt+click reaches what is behind (audit §5).
   *
   * Nothing could select a piece under another one. On a mascot that is not a
   * corner case: hair is drawn over a head, glasses over a face, a highlight
   * over an eye — and once a click resolves to the *piece* rather than the
   * deepest shape, the piece in front is the only one a pointer can name.
   *
   * Each Alt+click at the same place steps one further down the stack and wraps
   * at the bottom, which is how every drawing tool has done it for thirty
   * years: no list to read, no modifier to learn beyond the one.
   */
  let behindAt = null;

  /** The pieces under a point, front to back, each named once. */
  const piecesUnder = (event) => {
    const elements = store.getDocument().elements || {};
    const seen = new Set(), out = [];
    for (const hit of document.elementsFromPoint?.(event.clientX, event.clientY) || []) {
      if (!container.contains(hit)) continue;
      for (let node = hit; node && node !== container; node = node.parentNode) {
        const id = node.getAttribute?.('id');
        if (!id || !elements[id]) continue;
        const piece = clickTargetOf(id);
        if (piece && !seen.has(piece)) { seen.add(piece); out.push(piece); }
        break;
      }
    }
    return out;
  };

  /** The drawings directly inside one, by the layer tree rather than the DOM. */
  const childrenOf = (layers, id) => {
    const walk = (items) => {
      for (const item of items || []) {
        if (item.id === id) return (item.children || []).map((child) => child.id);
        const nested = walk(item.children);
        if (nested) return nested;
      }
      return null;
    };
    return walk(layers) || [];
  };

  /** The next piece down from the one in hand, wrapping at the bottom. */
  const behind = (event) => {
    const stack = piecesUnder(event);
    if (stack.length < 2) return stack[0] || null;
    const near = behindAt && Math.hypot(behindAt.x - event.clientX, behindAt.y - event.clientY) < 4 ? behindAt.id : selectedId;
    const at = stack.indexOf(near);
    const next = stack[(at + 1) % stack.length];
    behindAt = { x: event.clientX, y: event.clientY, id: next };
    return next;
  };

  /**
   * The deepest element of the document under an event, if any.
   *
   * Two passes, because the second click of a double-click lands on the gizmo:
   * once something is selected its overlay covers the artwork, so walking up
   * from `event.target` finds no drawing at all. The fallback asks the document
   * what is under the pointer and skips the chrome on top of it.
   */
  const elementUnder = (event) => {
    const elements = store.getDocument().elements || {};
    for (let node = event.target; node && node !== container; node = node.parentNode) {
      const id = node.getAttribute?.('id');
      if (id && elements[id]) return id;
    }
    for (const hit of document.elementsFromPoint?.(event.clientX, event.clientY) || []) {
      if (!container.contains(hit)) continue;
      for (let node = hit; node && node !== container; node = node.parentNode) {
        const id = node.getAttribute?.('id');
        if (id && elements[id]) return id;
      }
    }
    return null;
  };
  // Where a piece is picked, framed and dragged: Artwork. The Character
  // Builder was the other one, being Artwork's selection with the drawing
  // tools put away (V5-07). Drawing itself was always Artwork's alone.
  const EDIT_WORKSPACES = new Set(['create']);
  const editing = () => EDIT_WORKSPACES.has(workspace);
  let selectedId = null;
  /** Everything selected, the piece in hand last (core/state/selection.js). */
  let selectedIds = [];
  let activeTool = 'select';
  let toolChangeHandler = () => {};
  let rigTool = null;
  let nodeEdit = null;
  let puppet = null;
  // Wrappers may be recreated, DOM nodes are stable. Weak collections neither
  // duplicate handlers nor retain removed/replaced artwork.
  const attachedNodes = new WeakSet();
  const lastApplied = new WeakMap();
  /**
   * What the canvas last **drew** each piece with, in channels.
   *
   * The selection box is built from this, because a mascot being designed is
   * posable: the box belongs where the piece is painted, not where its resting
   * transform says it would be (`core/artwork/pose-transform.js`).
   *
   * Which only works if everything that writes a transform records it here. A
   * preview frame did; the Inspector's fields, the arrange commands and the
   * gizmo's own drag did not — so typing a number moved the artwork and left
   * the box a hundred pixels behind, where it stayed until some later frame
   * happened to run. That is the "rectangle de sélection pas centré sur
   * l'élément" an author reported, and re-selecting the piece did not fix it
   * because the stale entry outlived the selection.
   */
  const lastRequested = new Map();
  /** Record what a piece has just been drawn with, so its box can follow it. */
  const drewWith = (id, transform) => { if (id) lastRequested.set(id, transformValues(transform)); };
  /** A hierarchy resolves to one matrix and has no channels to remember. */
  const drewMatrix = (id) => { if (id) lastRequested.delete(id); };

  const restoreRigNodes = (tool) => Object.entries(tool?.baseAttributes || {}).forEach(([id, attributes]) => {
    const node=documentModel.getNode(id);if(!node)return;
    // Exact restore: pose tools may have moved geometry attributes (cx/cy, x/y, rx/ry…), not only transform.
    if(tool.restoreExact)for(const name of node.getAttributeNames())if(!(name in attributes))node.removeAttribute(name);
    for(const [name,value] of Object.entries(attributes))value==null?node.removeAttribute(name):node.setAttribute(name,value);
  });
  const snapshotAttributes = (node) => Object.fromEntries([...node.attributes].map((attribute) => [attribute.name, attribute.value]));
  const safeBBox = (node) => { try { return node.getBBox(); } catch { return null; } };

  /**
   * Whether one piece is drawn inside another.
   *
   * Off the DOM rather than off `document.layers`, because the DOM is what the
   * pointer hit and the two agree by construction -- the layer tree is read from
   * this markup. `contains` counts a node as containing itself, so the ancestor
   * is excluded: "inside" means *strictly* inside.
   */
  const inside = (ancestorId, id) => {
    if (!ancestorId || !id || ancestorId === id) return false;
    const ancestor = documentModel.getNode(ancestorId), node = documentModel.getNode(id);
    return Boolean(ancestor && node && ancestor !== node && ancestor.contains?.(node));
  };
  /** Document order is paint order: `id` is drawn over `over` when it comes after it. */
  const paintedOver = (id, over) => {
    const a = documentModel.getNode(over), b = documentModel.getNode(id);
    if (!a || !b || a === b) return false;
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  };

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
  /*
   * Several pieces at once (docs/SELECTION_GIZMO.md, "Several pieces"): each
   * selected piece gets a thin frame and the whole selection one box, drawn in
   * the outer svg's own coordinates so nested groups and the zoom need no
   * special case. The gizmo frames one piece; this frames the set.
   */
  const multiLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  multiLayer.setAttribute('data-multi-select', '');
  multiLayer.setAttribute('pointer-events', 'none');
  multiLayer.setAttribute('fill', 'none');
  const raiseGizmoLayer = () => { draw.node.append(multiLayer); draw.node.append(gizmoLayer); };

  // The same again for what is being drawn right now. A preview that lived in
  // the artwork would be serialized into the document the moment anything
  // reconciled mid-drag; here it is chrome, and the shape only becomes artwork
  // when the gesture ends.
  const drawLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  drawLayer.setAttribute('data-draw-layer', '');
  drawLayer.setAttribute('pointer-events', 'none');
  draw.node.append(drawLayer);
  // The preview is cut where the artwork will be: a nested `<svg>` clips to
  // its viewBox, and a line drawn past the working area used to be whole while
  // it was drawn and cut the moment it was committed.
  const drawDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const drawClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  drawClip.setAttribute('id', 'boop-draw-clip');
  drawClip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const drawClipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  drawClip.append(drawClipRect);
  drawDefs.append(drawClip);
  draw.node.prepend(drawDefs);
  drawLayer.setAttribute('clip-path', 'url(#boop-draw-clip)');
  /**
   * Line the preview up with the artwork, in the artwork's own units.
   *
   * Recomputed on every view change and every gesture, never measured once:
   * the transform used to be read at pointer-down and went stale the moment
   * the view moved mid-drawing, which left the preview a pan away from the
   * shape it became.
   */
  const syncDrawLayer = () => {
    draw.node.append(drawLayer);
    const matrix = artworkMatrix();
    if (!matrix) return;
    drawLayer.setAttribute('transform', matrixString(matrix));
    const box = readArtboard(store.getDocument().svgMarkup || '');
    drawClipRect.setAttribute('x', box.x); drawClipRect.setAttribute('y', box.y);
    drawClipRect.setAttribute('width', box.width); drawClipRect.setAttribute('height', box.height);
  };

  /**
   * The working area, and what is cutting the artwork (docs/VECTOR_EDITING.md).
   *
   * A nested `<svg>` clips to its own `viewBox`, and a `clip-path` cuts
   * whatever it is on. Both are invisible, so taller hair came back cropped
   * with nothing on screen to explain it. This layer draws the artboard's edge
   * and, for a clipped selection, the outline it is being cut against.
   */
  const paperLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  paperLayer.setAttribute('data-paper-layer', '');
  paperLayer.setAttribute('pointer-events', 'none');
  const frameLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  frameLayer.setAttribute('data-frame-layer', '');
  frameLayer.setAttribute('pointer-events', 'none');
  draw.node.append(frameLayer);
  let frameVisible = false;

  /**
   * Where a face's parts go, for somebody who has not made one before
   * (docs/FACE_GUIDES.md).
   *
   * A head somebody drew is a blank oval, and nothing on the canvas says a
   * face *has* places. This draws them: a dashed box, named, where each
   * missing part would land, at the size it would be on this head -- and the
   * frame a library drawing is about to land in, while the card is under the
   * pointer. Both come out of `fitFacePart`, the call the install itself
   * makes, so the guide is a promise the install keeps.
   */
  const guideLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  guideLayer.setAttribute('data-face-guides', '');
  guideLayer.setAttribute('pointer-events', 'none');
  draw.node.append(guideLayer);
  let guidesVisible = false;
  let guideAsset = null;

  /**
   * The matrix that puts chrome in the artwork's own units.
   *
   * Computed, not measured (`core/artwork/viewport.js`): the zoom and pan the
   * canvas itself wrote, times the nested `<svg>`'s own viewBox rule. It is
   * therefore right the instant the view changes, and the same in every
   * browser — a nested-`<svg>` CTM is the one measurement browsers have long
   * disagreed on.
   */
  const artworkMatrix = () => {
    const host = rootGroup?.node?.querySelector('svg');
    if (!host) return null;
    const view = viewTransform();
    const inner = viewBoxTransform(viewBoxAttributes(host), { width: container.clientWidth, height: container.clientHeight });
    return multiplyMatrix({ a: view.scale, b: 0, c: 0, d: view.scale, e: view.x, f: view.y }, inner);
  };
  /** What the canvas draws in artwork units for itself: the grid, snapping. */
  let drawOptions = { grid: false, gridSize: 10, snap: false };
  const snapIfOn = (point) => (drawOptions.snap && point ? snapToGrid(point, drawOptions.gridSize) : point);

  /**
   * The nearest element carrying a clip, from `id` upwards, with the shape it
   * clips to.
   *
   * Looked up in the artwork itself rather than through the model's node map:
   * an edit that reloads the artwork leaves that map pointing at the pieces it
   * replaced, and a clip read off a piece nobody can see any more is a cut
   * drawn on a canvas that no longer has one.
   */
  /**
   * What is cutting this piece, whether it is cut to a shape or to a picture.
   *
   * Two attributes because there are two kinds of cut and they are not
   * interchangeable. A `clip-path` cuts to an outline, which is what a shape
   * has. A picture's outline is its rectangle, so cutting to one would be
   * cutting to a box -- never what anybody means by "the iris inside the eye".
   * What a picture has instead is transparency, and cutting to *that* is a
   * `mask` (docs/V4_ROADMAP.md, V4-062).
   */
  const CUT_ATTRIBUTES = ['clip-path', 'mask'];
  function clipOwnerOf(id) {
    const host = rootGroup.node.querySelector('svg');
    const from = (id && host?.querySelector?.(`#${CSS.escape(id)}`)) || documentModel.getNode(id);
    for (let node = from; node && node !== host?.parentNode; node = node.parentElement) {
      for (const attribute of CUT_ATTRIBUTES) {
        const reference = /url\(['"]?#([^)'"]+)['"]?\)/.exec(node.getAttribute?.(attribute) || '')?.[1];
        if (!reference) continue;
        const shape = host?.querySelector?.(`#${CSS.escape(reference)} > *`) || null;
        return { ownerId: node.getAttribute('id') || null, clipId: reference, owner: node, shape, attribute };
      }
    }
    return null;
  }

  /**
   * The guides, redrawn.
   *
   * Measured through the canvas, derived in `face-guides.js`: the layout is
   * built from what is on screen now, so a head an author has just resized
   * moves its slots with it.
   *
   * The labels are drawn with `non-scaling-stroke`'s cousin for text -- a
   * fixed size in screen pixels, undone from the artwork matrix -- because a
   * guide that shrinks with the zoom is unreadable exactly when an author has
   * zoomed out to see the whole face.
   */
  function renderGuides() {
    guideLayer.replaceChildren();
    if (!guidesVisible || !rootGroup?.node) return;
    draw.node.append(guideLayer);
    const matrix = artworkMatrix();
    if (!matrix) return;
    guideLayer.setAttribute('transform', matrixString(matrix));
    const state = store.getDocument();
    const layout = createFaceLayoutContext(state, (id) => wrapperFor(id)?.bbox() || null);
    // Text at a fixed size on screen: the artwork matrix scales everything in
    // this layer, so a label divides that scale back out.
    const scale = matrixScale(matrix) || 1;
    const label = (text, x, y, tone, anchor = 'start') => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      node.setAttribute('class', `canvas-guide-label${tone ? ` canvas-guide-${tone}` : ''}`);
      node.setAttribute('x', x); node.setAttribute('y', y);
      node.setAttribute('text-anchor', anchor);
      node.setAttribute('transform', `translate(${x} ${y}) scale(${1 / scale}) translate(${-x} ${-y})`);
      node.textContent = text;
      return node;
    };
    const frame = (box, tone) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      node.setAttribute('class', `canvas-guide-slot${tone ? ` canvas-guide-${tone}` : ''}`);
      node.setAttribute('x', box.x); node.setAttribute('y', box.y);
      node.setAttribute('width', box.width); node.setAttribute('height', box.height);
      node.setAttribute('vector-effect', 'non-scaling-stroke');
      return node;
    };

    // No head at all: there is no layout to put a slot in, so what the canvas
    // offers is the one thing that is always true -- draw a head about this
    // big, about here.
    if (!layout?.headBox) {
      const ghost = ghostHead(readArtboard(state.svgMarkup || ''));
      if (!ghost) return;
      const oval = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      oval.setAttribute('class', 'canvas-guide-ghost');
      oval.setAttribute('cx', ghost.cx); oval.setAttribute('cy', ghost.cy);
      oval.setAttribute('rx', ghost.rx); oval.setAttribute('ry', ghost.ry);
      oval.setAttribute('vector-effect', 'non-scaling-stroke');
      // Inside the oval rather than under it: under it is off the working area
      // on an artboard the ghost nearly fills, and a guide the canvas cuts in
      // half is a guide that has said nothing.
      guideLayer.append(oval, label('Draw a head, or press a head in the library', ghost.cx, ghost.cy, 'ghost', 'middle'));
      guideLayer.dataset.faceGuides = 'ghost';
      return;
    }

    const guides = faceGuides(layout, state);
    for (const slot of guides.slots) {
      guideLayer.append(frame(slot.box), label(slot.label, slot.box.x, slot.box.y - 4));
    }
    guideLayer.dataset.faceGuides = String(guides.slots.length);

    // And where the drawing under the pointer will land, which is the question
    // a card cannot answer on its own: the preview on it is drawn on the
    // template's head, not on this one.
    const landing = guideAsset ? landingBox(guideAsset, layout) : null;
    if (landing) {
      // Under the frame, where a slot's own name is above it: the landing is
      // almost always over an empty slot, and two labels on the same line is
      // two labels nobody can read.
      guideLayer.append(frame(landing, 'landing'), label(`${guideAsset.name || 'This drawing'} lands here`, landing.x, landing.y + landing.height + 12, 'landing'));
      guideLayer.dataset.faceGuideLanding = guideAsset.id || 'true';
    } else delete guideLayer.dataset.faceGuideLanding;
  }

  function renderFrame() {
    frameLayer.replaceChildren();
    paperLayer.replaceChildren();
    if (!frameVisible || !rootGroup?.node) return;
    // A rebuild appends the artwork after this layer, which would leave the
    // edges drawn underneath the drawing they are about.
    draw.node.append(frameLayer);
    const matrix = artworkMatrix();
    if (!matrix) return;
    frameLayer.setAttribute('transform', matrixString(matrix));
    const box = readArtboard(store.getDocument().svgMarkup || '');
    // The paper goes under everything: the working area painted the white of
    // the pages the file will be seen on, so a dark stroke reads as drawn.
    draw.node.prepend(paperLayer);
    paperLayer.setAttribute('transform', matrixString(matrix));
    const paper = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    paper.setAttribute('class', 'canvas-paper');
    paper.setAttribute('x', box.x); paper.setAttribute('y', box.y);
    paper.setAttribute('width', box.width); paper.setAttribute('height', box.height);
    paperLayer.append(paper);
    // The grid, when asked for: light lines every `gridSize` units inside the
    // working area, drawn under the artboard edge.
    const step = Number(drawOptions.gridSize) || 0;
    if (drawOptions.grid && step > 0 && box.width / step < 400 && box.height / step < 400) {
      const lines = [];
      for (let x = Math.ceil(box.x / step) * step; x <= box.x + box.width; x += step) lines.push(`M ${x} ${box.y} V ${box.y + box.height}`);
      for (let y = Math.ceil(box.y / step) * step; y <= box.y + box.height; y += step) lines.push(`M ${box.x} ${y} H ${box.x + box.width}`);
      const grid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      grid.setAttribute('class', 'canvas-grid');
      grid.setAttribute('d', lines.join(' '));
      grid.setAttribute('vector-effect', 'non-scaling-stroke');
      frameLayer.append(grid);
    }
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
    // The chain goes on a wrapper rather than on the shape: a cutting shape
    // carries a transform of its own -- the one that put it in the cut piece's
    // space -- and writing the chain over it drew the cut somewhere neither of
    // them meant.
    const carrier = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    carrier.setAttribute('transform', matrixString(matrixToArtwork(clip.owner)));
    carrier.append(outline);
    frameLayer.append(carrier);
  }

  /**
   * An element's own user space → the artwork's, multiplied out of the
   * elements' own transforms.
   *
   * A clip is read in the user space of the piece carrying it, after that
   * piece's own transform -- so drawing the outline means walking that chain.
   * Multiplied rather than measured: this layer is already placed by
   * `artworkMatrix`, which is computed for the reason it gives, and reading a
   * nested `<svg>`'s CTM to fill in the rest mixes the two. When they agree
   * nothing shows; when they do not, the cut is drawn a whole canvas away from
   * the piece it cuts.
   */
  function matrixToArtwork(node) {
    const host = rootGroup?.node?.querySelector('svg');
    let matrix = IDENTITY;
    for (let owner = node; owner && owner !== host; owner = owner.parentNode) {
      matrix = multiplyMatrix(ownTransformMatrix(owner), matrix);
    }
    return matrix;
  }

  /**
   * One element's own transform, read without rewriting it.
   *
   * `SVGTransformList.consolidate()` returns the matrix *and replaces the list
   * with it*, so asking a piece what its transform is would rewrite the
   * artwork's own `transform="translate(10 20)"` as a matrix -- on every
   * selection, and into the saved file. The list is multiplied out instead:
   * `transform="A B C"` is A·B·C, left to right.
   */
  function ownTransformMatrix(node) {
    const list = node?.transform?.baseVal;
    let matrix = IDENTITY;
    for (let index = 0; index < (list?.numberOfItems || 0); index += 1) {
      const own = list.getItem(index).matrix;
      matrix = multiplyMatrix(matrix, { a: own.a, b: own.b, c: own.c, d: own.d, e: own.e, f: own.f });
    }
    return matrix;
  }

  /* ── Hand mode (VNX-19, docs/HAND_RIGGING.md) ─────────────────────────────
   *
   * ```text
   *      ┌───────────┐
   *      │   HAND    │
   *      └───────────┘
   *           ●
   *      ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒◆      the reach ellipse, and the grip on its edge
   *           │
   *         anchor
   * ```
   *
   * A hand's anchor is two number fields and its reach is two more. Both are
   * geometry, and geometry is edited by looking at it. So they are drawn on the
   * canvas — the same layer trick as the artboard frame: chrome above the
   * artwork, outside the serialized document, in the artwork's own units.
   *
   * This is **authoring, not posing**. The puppet handles drive `handLX`… live
   * and non-destructively; the anchor and the reach are document fields under
   * `hands[side]`, so a drag ends in one command over the `hands` domain and is
   * one undo step however many frames it took (`core/puppet/hand-handles.js`
   * owns what a gesture means; this owns the pointer).
   */
  const handCommands = createHandCommands(store, history);
  const handRigGesture = createHandRigGesture({ document: () => store.getDocument(), commands: handCommands });

  // Which hand is on show, if any, is a rule rather than a flag, and it lives
  // with the rest of the geometry (`core/puppet/hand-handles.js`): the Rig
  // task, and within it either the side Hand Setup has open or the hand whose
  // own artwork is selected.
  let handRigRequest = null;
  const openHandRig = () => handRigSide({ workspace, requested: handRigRequest, selectedId, document: store.getDocument() });

  // Built once and moved, never rebuilt: a drag repositions six attributes and
  // two buttons, which is what the artboard frame costs and no more.
  const handRigLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  handRigLayer.setAttribute('data-hand-rig-layer', '');
  handRigLayer.setAttribute('pointer-events', 'none');
  handRigLayer.style.display = 'none';
  /**
   * Each shape carries its own colour as a presentation attribute *and* a class.
   * The attribute is what makes hand mode visible with no stylesheet of its own
   * — a stroke-less overlay is an overlay nobody can see — and a CSS rule on the
   * class beats a presentation attribute, so the class is still the way to
   * restyle it.
   */
  const handRigShape = (name, className, attributes) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    node.setAttribute('class', className);
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', '#79adff');
    node.setAttribute('vector-effect', 'non-scaling-stroke');
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    handRigLayer.append(node);
    return node;
  };
  // The reach it has, the leash back to the anchor, and the anchor itself.
  // `.puppet-reach` is deliberately not reused: that class means "the reach of
  // the hand currently being posed", and a test counts the one on screen.
  const handRigReach = handRigShape('ellipse', 'hand-rig-reach', { 'stroke-width': 1.5, 'stroke-dasharray': '5 4', opacity: 0.85 });
  const handRigLeash = handRigShape('line', 'hand-rig-mark', { 'stroke-width': 1.5, 'stroke-dasharray': '2 3', opacity: 0.9 });
  const handRigAnchor = handRigShape('circle', 'hand-rig-mark', { 'stroke-width': 2, r: 3 });
  draw.node.append(handRigLayer);

  /**
   * The two grabbable points are ordinary buttons, like the path-node handles:
   * that is what gives them focus, a label and a keyboard route for free.
   */
  const HAND_RIG_LABEL = Object.freeze({
    anchor: 'Hand anchor. Drag to move where the hand hangs from. Arrow keys nudge it, Shift for ten.',
    reach: 'Hand reach. Drag the edge to change how far the hand can go. Arrow keys resize it, Shift for ten.'
  });
  const handRigHandles = HAND_RIG_PARTS.map((kind) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rig-node-handle';
    button.dataset.handRig = kind;
    button.hidden = true;
    button.title = HAND_RIG_LABEL[kind];
    button.setAttribute('aria-label', HAND_RIG_LABEL[kind]);
    container.append(button);
    return { kind, button };
  });

  /** Where a handle sits, in client coordinates: the artwork's own `getScreenCTM`. */
  function placeHandRigHandle(button, point, ctm, box) {
    placeCanvasHandle(button, onScreen(point, ctm, box));
  }

  /** An artwork point, in the canvas's own coordinates. */
  const onScreen = (point, ctm, box) => ({
    x: ctm.a * point.x + ctm.c * point.y + ctm.e - box.left,
    y: ctm.b * point.x + ctm.d * point.y + ctm.f - box.top
  });

  /** The same, for a point that is already in the canvas's own coordinates. */
  function placeCanvasHandle(button, at) {
    button.hidden = false;
    button.style.left = `${at.x}px`;
    button.style.top = `${at.y}px`;
  }

  function renderHandRig() {
    // A drag owns the picture while it lasts: what is drawn is where the
    // pointer is, not what the document still says.
    const live = handRigGesture.preview();
    const side = live ? null : openHandRig();
    const overlay = live || (side ? handRigOverlay(store.getDocument(), side) : null);
    handRigLayer.style.display = overlay ? '' : 'none';
    if (!overlay) { for (const { button } of handRigHandles) button.hidden = true; return null; }
    // A rebuild appends the artwork after this layer, which would leave the
    // rig drawn underneath the hand it is about.
    draw.node.append(handRigLayer);
    const matrix = artworkMatrix();
    const host = rootGroup.node.querySelector('svg');
    const ctm = host?.getScreenCTM();
    if (!matrix || !ctm) { for (const { button } of handRigHandles) button.hidden = true; return null; }
    handRigLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    const { anchor, rest, reach, grip } = overlay;
    handRigReach.setAttribute('cx', rest.x); handRigReach.setAttribute('cy', rest.y);
    handRigReach.setAttribute('rx', reach.rx); handRigReach.setAttribute('ry', reach.ry);
    handRigLeash.setAttribute('x1', anchor.x); handRigLeash.setAttribute('y1', anchor.y);
    handRigLeash.setAttribute('x2', rest.x); handRigLeash.setAttribute('y2', rest.y);
    handRigAnchor.setAttribute('cx', anchor.x); handRigAnchor.setAttribute('cy', anchor.y);
    const box = container.getBoundingClientRect();
    for (const entry of handRigHandles) placeHandRigHandle(entry.button, entry.kind === 'anchor' ? anchor : grip, ctm, box);
    handRigHandles[0].button.setAttribute('aria-valuetext', `Anchor at ${Math.round(anchor.x)}, ${Math.round(anchor.y)}`);
    handRigHandles[1].button.setAttribute('aria-valuetext', `Reach ${Math.round(reach.rx)} across by ${Math.round(reach.ry)} up`);
    return overlay;
  }

  // The overlay is document geometry, so it follows the document rather than
  // waiting to be told: an undo, a mirror, or the panel's own number fields all
  // move the anchor without the canvas being involved at all.
  store.subscribeDocument?.('hands', () => renderHandRig());
  // And so is the frame: the working area's edge and the shape a piece is cut
  // against are both read off the artwork. Drawing them in the middle of an
  // edit's own round trip caught the document halfway -- taking a cut off left
  // its outline on the canvas until the next thing an author selected -- so
  // the frame follows the artwork instead of being told at the right moment.
  store.subscribeDocument?.('artwork', () => { renderFrame(); renderGuides(); });

  /* ── A warp's control points ───────────────────────────────────────────────
   *
   * The warp panel has always told the author to drag handles on the canvas.
   * These are them. Same bargain as the hand rig: a control point is document
   * geometry, so one drag is one command and one undo step, and the artwork
   * bends live in between without anything being written down.
   */
  const warpCommands = createWarpCommands(store, history);
  const warpGesture = createWarpGesture({ document: () => store.getDocument(), commands: warpCommands });
  const warpLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  warpLayer.setAttribute('data-warp-layer', '');
  warpLayer.setAttribute('pointer-events', 'none');
  warpLayer.style.display = 'none';
  draw.node.append(warpLayer);
  /** One line per neighbouring pair, so the author sees a grid and not dots. */
  const warpEdges = [];
  const warpHandles = [];
  const warpHandle = (index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rig-node-handle';
    button.dataset.warpPoint = String(index);
    button.hidden = true;
    container.append(button);
    return button;
  };

  /** Whether the canvas should be showing a warp at all, and which one. */
  // The same double limit the hand rig uses: the task where a warp is set up,
  // and the piece whose own artwork is selected. A lattice over every shape in
  // every task is clutter on every canvas an author looks at.
  const openWarp = () => (workspace === HAND_RIG_WORKSPACE ? warpOverlay(store.getDocument(), selectedId) : null);

  function renderWarp() {
    const live = warpGesture.preview();
    const overlay = live || openWarp();
    warpLayer.style.display = overlay ? '' : 'none';
    if (!overlay) {
      for (const button of warpHandles) button.hidden = true;
      return null;
    }
    // A rebuild appends the artwork after this layer, which would leave the
    // lattice drawn underneath the shape it is about.
    draw.node.append(warpLayer);
    const matrix = artworkMatrix();
    const ctm = rootGroup.node.querySelector('svg')?.getScreenCTM();
    if (!matrix || !ctm) { for (const button of warpHandles) button.hidden = true; return null; }
    warpLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    // The outline bends while the pointer is down; the document still says what
    // it said, and a cancelled drag simply stops asking for the preview.
    const node = wrapperFor(overlay.target)?.node;
    if (node && overlay.target) {
      if (live?.path) node.setAttribute('d', live.path);
      // A cancelled drag goes back to what the document says, which is the
      // rest path *bent by the grid* -- not the artwork's own markup, where no
      // warp is ever baked.
      else if (!live) node.setAttribute('d', warpedPath(overlay) || documentModel.getNode(overlay.target)?.getAttribute('d') || node.getAttribute('d'));
    }
    const edges = warpLattice(overlay);
    while (warpEdges.length < edges.length) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'warp-lattice');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '3 3');
      warpEdges.push(line);
      warpLayer.append(line);
    }
    warpEdges.forEach((line, index) => {
      const edge = edges[index];
      line.style.display = edge ? '' : 'none';
      if (!edge) return;
      const [a, b] = [overlay.points[edge[0]], overlay.points[edge[1]]];
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    });
    while (warpHandles.length < overlay.points.length) warpHandles.push(warpHandle(warpHandles.length));
    const box = container.getBoundingClientRect();
    warpHandles.forEach((button, index) => {
      const point = overlay.points[index];
      if (!point) { button.hidden = true; return; }
      const label = `Warp point ${index + 1} of ${overlay.points.length}${isWarpEdgePoint(index, overlay) ? ', on the edge of the grid' : ''}. Drag to bend the shape. Arrow keys nudge it, Shift for ten.`;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-valuetext', `${Math.round(point.x)}, ${Math.round(point.y)}`);
      button.dataset.warpEdge = String(isWarpEdgePoint(index, overlay));
      placeHandRigHandle(button, point, ctm, box);
    });
    return overlay;
  }

  // A warp is document geometry, so the lattice follows the document: an undo,
  // a reset from the panel or a change of grid size all move it without the
  // canvas being told.
  store.subscribeDocument?.('keyforms', () => renderWarp());

  /* ── Mesh points ──────────────────────────────────────────────────────────
   *
   * The same gesture as the warp, over a picture instead of a path
   * (core/mesh/mesh-handles.js). Simpler in one way that matters: a mesh's
   * triangles already carry their own transforms, so the live preview is
   * writing those again rather than re-running a deformation over a path.
   */
  const meshLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  meshLayer.setAttribute('class', 'mesh-layer');
  meshLayer.style.display = 'none';
  draw.node.append(meshLayer);
  const meshEdges = [], meshHandles = [];
  const meshHandle = (index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rig-node-handle';
    button.dataset.meshPoint = String(index);
    button.hidden = true;
    container.append(button);
    return button;
  };

  /** A mesh's box is the box of the copies inside it -- they all share one. */
  const meshBoxFor = (id) => {
    const group = documentModel.getNode(id);
    const image = group?.localName === 'g' && group.hasAttribute('data-mesh') ? group.querySelector('image') : null;
    if (!image) return null;
    const side = (name) => Number(image.getAttribute(name)) || 0;
    return { x: side('x'), y: side('y'), width: side('width'), height: side('height') };
  };

  const meshGesture = createMeshGesture({
    document: () => store.getDocument(),
    box: (id) => meshBoxFor(id),
    commands: { moveMeshPoints: (target, points) => api.moveMeshPoints?.(target, points) }
  });

  /** Whether the canvas should be showing a mesh at all, and which one. */
  const openMesh = () => meshOverlay(store.getDocument(), selectedId, meshBoxFor(selectedId));

  /** Write a live shape onto the triangles, so the picture bends under the pointer. */
  const paintMeshPieces = (target, pieces) => {
    const group = documentModel.getNode(target);
    if (!group || !pieces) return;
    const children = [...group.children];
    pieces.forEach((piece, index) => {
      const cell = children[index];
      const image = cell?.querySelector?.('image');
      if (image) image.setAttribute('transform', `matrix(${piece.transform.map((value) => Math.round(value * 1000) / 1000).join(' ')})`);
      const reference = /url\(['"]?#([^)'"]+)['"]?\)/.exec(cell?.getAttribute?.('clip-path') || '')?.[1];
      const polygon = reference ? rootGroup.node.querySelector(`#${CSS.escape(reference)} > polygon`) : null;
      if (polygon) polygon.setAttribute('points', piece.clip.map((point) => `${Math.round(point.x * 1000) / 1000},${Math.round(point.y * 1000) / 1000}`).join(' '));
    });
  };

  function renderMesh() {
    const live = meshGesture.preview();
    const overlay = live || openMesh();
    meshLayer.style.display = overlay ? '' : 'none';
    if (!overlay) { for (const button of meshHandles) button.hidden = true; return null; }
    // A rebuild appends the artwork after this layer, which would leave the
    // lattice drawn underneath the picture it is about.
    draw.node.append(meshLayer);
    const matrix = artworkMatrix();
    const ctm = rootGroup.node.querySelector('svg')?.getScreenCTM();
    if (!matrix || !ctm) { for (const button of meshHandles) button.hidden = true; return null; }
    meshLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    if (live?.pieces) paintMeshPieces(overlay.target, live.pieces);

    const edges = meshLattice(overlay.size);
    while (meshEdges.length < edges.length) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'warp-lattice');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '3 3');
      meshEdges.push(line);
      meshLayer.append(line);
    }
    meshEdges.forEach((line, index) => {
      const edge = edges[index];
      line.style.display = edge ? '' : 'none';
      if (!edge) return;
      const [a, b] = [overlay.points[edge[0]], overlay.points[edge[1]]];
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    });
    while (meshHandles.length < overlay.points.length) meshHandles.push(meshHandle(meshHandles.length));
    const box = container.getBoundingClientRect();
    meshHandles.forEach((button, index) => {
      const point = overlay.points[index];
      if (!point) { button.hidden = true; return; }
      const label = `Mesh point ${index + 1} of ${overlay.points.length}${isMeshEdgePoint(index, overlay.size) ? ', on the edge of the picture' : ''}. Drag to bend it. Hold Alt to move its mirror with it.`;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-valuetext', `${Math.round(point.x)}, ${Math.round(point.y)}`);
      button.dataset.warpEdge = String(isMeshEdgePoint(index, overlay.size));
      placeHandRigHandle(button, point, ctm, box);
    });
    return overlay;
  }

  // A mesh is document geometry like a warp, so the lattice follows the
  // document: an undo, a change of grid size or a reset all move it.
  store.subscribeDocument?.('keyforms', () => renderMesh());
  store.subscribeDocument?.('artwork', () => renderMesh());

  /* ── Pins ─────────────────────────────────────────────────────────────────
   *
   * The structural points the artwork is held by (docs/FACE_CONTROL_RIG.md).
   * Same bargain as the warp: a pin's position is document geometry, so one
   * drag is one command and one undo step. What is drawn beside each pin is
   * its **reach** — the thing that decides what it holds, and the thing an
   * author cannot guess from a dot.
   */
  const pinCommands = createPinCommands(store, history);
  const pinGesture = createPinGesture({ document: () => store.getDocument(), commands: pinCommands });
  const pinLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pinLayer.setAttribute('data-pin-layer', '');
  pinLayer.setAttribute('pointer-events', 'none');
  pinLayer.style.display = 'none';
  draw.node.append(pinLayer);
  const pinReaches = [];
  const pinAxes = [];
  const pinHandles = [];
  const pinHandle = (id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rig-node-handle';
    button.dataset.rigPin = id;
    button.hidden = true;
    container.append(button);
    return button;
  };
  /*
   * The reach is the thing a pin is about, and it was a number in a panel.
   * Two small handles on the ellipse — one on its right edge, one on its
   * bottom — drag it wider or taller where the artwork is, and the ellipse
   * follows the pointer while the count of points it would hold updates.
   * One drag is one command.
   */
  const pinReachHandles = [];
  /** Far enough out that the pin's own dot cannot swallow it: both radii, and air. */
  const PIN_REACH_CLEAR = 19;
  const reachHandle = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rig-node-handle rig-reach-handle';
    button.dataset.pinReach = '';
    button.hidden = true;
    container.append(button);
    return button;
  };
  let reachDrag = null;

  /** Whether the canvas should be showing pins at all, and whose. */
  // The same double limit the warp uses: the task where a rig is built, and the
  // piece whose own artwork is selected. Pins over every shape in every task is
  // clutter on every canvas an author looks at.
  const openPins = () => (workspace === HAND_RIG_WORKSPACE ? pinOverlay(store.getDocument(), selectedId) : null);

  function renderPins() {
    const live = pinGesture.preview();
    const overlay = live || openPins();
    pinLayer.style.display = overlay ? '' : 'none';
    if (!overlay) {
      for (const button of pinHandles) button.hidden = true;
      for (const button of pinReachHandles) button.hidden = true;
      return null;
    }
    draw.node.append(pinLayer);
    const matrix = artworkMatrix();
    const ctm = rootGroup.node.querySelector('svg')?.getScreenCTM();
    if (!matrix || !ctm) { for (const button of [...pinHandles, ...pinReachHandles]) button.hidden = true; return null; }
    pinLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    while (pinReaches.length < overlay.pins.length) {
      const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellipse.setAttribute('class', 'pin-reach');
      ellipse.setAttribute('fill', 'none');
      ellipse.setAttribute('vector-effect', 'non-scaling-stroke');
      pinReaches.push(ellipse);
      pinLayer.append(ellipse);
    }
    const box = container.getBoundingClientRect();
    pinReaches.forEach((ellipse, index) => {
      const pin = overlay.pins[index];
      const dragged = pin && reachDrag && reachDrag.id === pin.id ? { ...pin, radius: { ...pin.radius, [reachDrag.axis]: reachDrag.value } } : pin;
      const reach = pinReachEllipse(dragged);
      ellipse.style.display = reach ? '' : 'none';
      if (!reach) return;
      ellipse.setAttribute('cx', reach.cx); ellipse.setAttribute('cy', reach.cy);
      ellipse.setAttribute('rx', reach.rx); ellipse.setAttribute('ry', reach.ry);
      ellipse.dataset.pinType = overlay.pins[index].type;
    });
    // A directional or sliding pin may only move along its axis: drawn as a
    // line through the pin, as long as its reach.
    while (pinAxes.length < overlay.pins.length) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'pin-axis');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      pinAxes.push(line);
      pinLayer.append(line);
    }
    pinAxes.forEach((line, index) => {
      const pin = overlay.pins[index];
      const axial = pin && (pin.type === 'directional' || pin.type === 'slide') && pin.direction;
      line.style.display = axial ? '' : 'none';
      if (!axial) return;
      const length = Math.max(pin.radius.x, pin.radius.y);
      line.setAttribute('x1', pin.position.x - pin.direction.x * length); line.setAttribute('y1', pin.position.y - pin.direction.y * length);
      line.setAttribute('x2', pin.position.x + pin.direction.x * length); line.setAttribute('y2', pin.position.y + pin.direction.y * length);
    });
    while (pinReachHandles.length < overlay.pins.length * 2) pinReachHandles.push(reachHandle());
    pinReachHandles.forEach((button, index) => {
      const pin = overlay.pins[Math.floor(index / 2)];
      const axis = index % 2 === 0 ? 'x' : 'y';
      if (!pin) { button.hidden = true; return; }
      const live = reachDrag && reachDrag.id === pin.id && reachDrag.axis === axis ? reachDrag.value : null;
      const radius = { x: live ?? pin.radius.x, y: live ?? pin.radius.y };
      const at = axis === 'x' ? { x: pin.position.x + radius.x, y: pin.position.y } : { x: pin.position.x, y: pin.position.y + radius.y };
      button.dataset.pinReach = `${pin.id}:${axis}`;
      const label = `Reach of ${pin.id} ${axis === 'x' ? 'across' : 'down'}: ${Math.round(radius[axis])}. Drag to change how far it holds.`;
      button.title = label;
      button.setAttribute('aria-label', label);
      // A shallow reach is a handful of artwork units, which at most zooms is
      // a handful of pixels: both of these squares were drawn *inside* the
      // pin's own dot, where the dot took every press and neither could be
      // grabbed. A square may only be pushed out along the axis it sets, never
      // sideways -- where it sits across from the pin is the number it reports
      // (`core/puppet/control-packing.js`).
      placeCanvasHandle(button, pushClear(onScreen(pin.position, ctm, box), onScreen(at, ctm, box), PIN_REACH_CLEAR));
    });
    while (pinHandles.length < overlay.pins.length) pinHandles.push(pinHandle(String(pinHandles.length)));
    pinHandles.forEach((button, index) => {
      const pin = overlay.pins[index];
      if (!pin) { button.hidden = true; return; }
      button.dataset.rigPin = pin.id;
      button.dataset.pinType = pin.type;
      // What it is holding, said out loud: a pin holding no points is a pin in
      // the wrong place, and a dot cannot say that on its own.
      const label = `${pin.id}: a ${pin.type} pin holding ${pin.reach} point${pin.reach === 1 ? '' : 's'}. Drag to move it. Arrow keys nudge it, Shift for ten.`;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-valuetext', `${Math.round(pin.position.x)}, ${Math.round(pin.position.y)}`);
      placeHandRigHandle(button, pin.position, ctm, box);
    });
    return overlay;
  }

  // Pins live in the same domain as the warps and the pose grids: everything
  // that deforms artwork rather than moving it whole.
  store.subscribeDocument?.('keyforms', () => renderPins());

  container.addEventListener('pointerdown', (event) => {
    const reach = event.target.closest?.('[data-pin-reach]');
    if (reach && event.button === 0) {
      const overlay = openPins();
      const [id, axis] = String(reach.dataset.pinReach).split(':');
      const pin = overlay?.pins.find((item) => item.id === id);
      if (pin) {
        event.preventDefault();
        event.stopPropagation();
        reach.setPointerCapture(event.pointerId);
        reach.focus?.();
        reachDrag = { id, axis, target: overlay.target, value: pin.radius[axis], moved: false };
        return;
      }
    }
    const pin = event.target.closest?.('[data-rig-pin]');
    if (pin && event.button === 0) {
      const overlay = openPins();
      if (overlay && pinGesture.begin(overlay.target, pin.dataset.rigPin)) {
        event.preventDefault();
        event.stopPropagation();
        pin.setPointerCapture(event.pointerId);
        pin.focus?.();
        return;
      }
    }
    const meshPoint = event.target.closest?.('[data-mesh-point]');
    if (meshPoint && event.button === 0) {
      const overlay = openMesh();
      // Alt moves the mirror with it: a face is symmetrical far more often
      // than not, and bending one cheek alone is the rarer thing to want.
      if (overlay && meshGesture.start(overlay.target, Number(meshPoint.dataset.meshPoint), { mirror: event.altKey })) {
        event.preventDefault();
        event.stopPropagation();
        meshPoint.setPointerCapture(event.pointerId);
        meshPoint.focus?.();
        return;
      }
    }
    const point = event.target.closest?.('[data-warp-point]');
    if (point && event.button === 0) {
      const overlay = openWarp();
      if (overlay && warpGesture.begin(overlay.target, Number(point.dataset.warpPoint))) {
        event.preventDefault();
        event.stopPropagation();
        point.setPointerCapture(event.pointerId);
        point.focus?.();
        return;
      }
    }
    const button = event.target.closest?.('[data-hand-rig]');
    if (!button || event.button !== 0) return;
    const side = openHandRig();
    if (!side || !handRigGesture.begin(side, button.dataset.handRig)) return;
    event.preventDefault();
    event.stopPropagation();
    button.setPointerCapture(event.pointerId);
    button.focus?.();
  }, true);

  container.addEventListener('pointermove', (event) => {
    if (reachDrag) {
      const point = artworkPoint(event), overlay = openPins();
      const pin = overlay?.pins.find((item) => item.id === reachDrag.id);
      if (point && pin) { reachDrag.value = Math.max(1, Math.round(Math.abs(point[reachDrag.axis] - pin.position[reachDrag.axis]) * 10) / 10); reachDrag.moved = true; renderPins(); }
      return;
    }
    if (pinGesture.active()) { pinGesture.to(artworkPoint(event)); renderPins(); return; }
    if (meshGesture.preview()) { meshGesture.move(artworkPoint(event)); renderMesh(); return; }
    if (warpGesture.active()) { warpGesture.to(artworkPoint(event)); renderWarp(); return; }
    if (!handRigGesture.active()) return;
    handRigGesture.to(artworkPoint(event));
    renderHandRig();
  });

  container.addEventListener('pointerup', (event) => {
    if (reachDrag) {
      event.target.releasePointerCapture?.(event.pointerId);
      const { id, axis, value, moved } = reachDrag;
      reachDrag = null;
      // One command for the whole drag; a press that never moved writes nothing.
      if (moved) pinCommands.configure(id, axis === 'x' ? { radiusX: value } : { radiusY: value });
      renderPins();
      return;
    }
    if (pinGesture.active()) {
      event.target.releasePointerCapture?.(event.pointerId);
      // One command for the whole gesture, not one per frame.
      pinGesture.commit();
      renderPins();
      return;
    }
    if (meshGesture.preview()) {
      event.target.releasePointerCapture?.(event.pointerId);
      // One command for the whole gesture, not one per frame.
      meshGesture.commit();
      renderMesh();
      return;
    }
    if (warpGesture.active()) {
      event.target.releasePointerCapture?.(event.pointerId);
      // One command for the whole gesture, not one per frame.
      warpGesture.commit();
      renderWarp();
      return;
    }
    if (!handRigGesture.active()) return;
    event.target.releasePointerCapture?.(event.pointerId);
    // One command for the whole gesture, not one per frame.
    handRigGesture.commit();
    renderHandRig();
  }, true);

  container.addEventListener('pointercancel', () => { if (reachDrag) { reachDrag = null; renderPins(); } if (pinGesture.cancel()) renderPins(); if (meshGesture.cancel()) renderMesh(); if (warpGesture.cancel()) renderWarp(); if (handRigGesture.cancel()) renderHandRig(); });

  // Escape abandons a drag in progress. It is caught here, in the capture
  // phase, because the shell's own Escape closes whatever surface is on top and
  // a half-finished drag is above all of them.
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (reachDrag) { event.stopPropagation(); reachDrag = null; renderPins(); return; }
    if (pinGesture.active()) { event.stopPropagation(); pinGesture.cancel(); renderPins(); return; }
    if (meshGesture.preview()) { event.stopPropagation(); meshGesture.cancel(); renderMesh(); return; }
    if (warpGesture.active()) { event.stopPropagation(); warpGesture.cancel(); renderWarp(); return; }
    if (!handRigGesture.active()) return;
    event.stopPropagation();
    handRigGesture.cancel();
    renderHandRig();
  }, true);

  /**
   * The keyboard route (docs/UX21): the handles are buttons, so they take focus
   * from the Tab order, and the arrow keys move exactly what a drag moves —
   * one artwork unit, ten with Shift. One press is one command, the same as the
   * path-node tool's nudge.
   */
  const HAND_RIG_NUDGE = 1, HAND_RIG_NUDGE_FAR = 10;
  container.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    const point = event.target.closest?.('[data-warp-point]');
    if (point && step) {
      event.preventDefault();
      const overlay = openWarp();
      const amount = event.shiftKey ? HAND_RIG_NUDGE_FAR : HAND_RIG_NUDGE;
      if (overlay) warpGesture.nudge(overlay.target, Number(point.dataset.warpPoint), { dx: step[0] * amount, dy: step[1] * amount });
      renderWarp();
      return;
    }
    const pinButton = event.target.closest?.('[data-rig-pin]');
    if (pinButton && step) {
      event.preventDefault();
      const overlay = openPins();
      const amount = event.shiftKey ? HAND_RIG_NUDGE_FAR : HAND_RIG_NUDGE;
      if (overlay) pinGesture.nudge(overlay.target, pinButton.dataset.rigPin, { dx: step[0] * amount, dy: step[1] * amount });
      renderPins();
      return;
    }
    const button = event.target.closest?.('[data-hand-rig]');
    if (!button) return;
    if (!step) return;
    event.preventDefault();
    const side = openHandRig();
    const amount = event.shiftKey ? HAND_RIG_NUDGE_FAR : HAND_RIG_NUDGE;
    if (side) handRigGesture.nudge(side, button.dataset.handRig, { dx: step[0] * amount, dy: step[1] * amount });
    renderHandRig();
  });

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
  /**
   * What the view is currently *a framing of*, if anything (`frameElements`).
   *
   * A view set by framing named pieces is an intent — "show me this hand" —
   * and not just a matrix. Remembering that lets the canvas honour it again
   * when its own size changes, which happens every time a screen declares
   * different column widths or an author drags one (`ui/panel-split.js`).
   * Every other way of changing the view drops it, because every other way is
   * the author saying where they want to look instead.
   */
  let framing = null;
  const setView = ({ scale = 1, x = 0, y = 0 }, { keepFraming = false } = {}) => {
    if (!keepFraming) framing = null;
    const zoom = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    const tx = Number.isFinite(Number(x)) ? Number(x) : 0, ty = Number.isFinite(Number(y)) ? Number(y) : 0;
    rootGroup.node.setAttribute('transform', `matrix(${zoom} 0 0 ${zoom} ${tx} ${ty})`);
    raiseGizmoLayer();
    gizmo.render();
    if (nodeEdit) placeNodeHandles();
    placePuppetHandles();
    renderFrame();
    renderHandRig();
    renderWarp();
    renderPins();
    syncDrawLayer();
    if (nodeEdit) placeControlHandles();
    renderMultiSelection();
    viewChangeHandler({ scale: zoom, x: tx, y: ty });
    return { scale: zoom, x: tx, y: ty };
  };
  let viewChangeHandler = () => {};

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

  /**
   * A moved piece lands on the grid when the grid is on.
   *
   * The box's corner is what is snapped, so a piece that was off the grid comes
   * *onto* it rather than moving in grid-sized steps from where it was.
   */
  const snapMove = (transform, drag) => {
    if (!drawOptions.snap || drag?.mode !== 'move') return transform;
    const size = Number(drawOptions.gridSize) || 0;
    if (!(size > 0)) return transform;
    // The artwork's own box, not `drag.box`: the selection box is padded by
    // half a stroke and grown to a minimum so thin lines stay grabbable, so
    // snapping *it* would leave the drawing a stroke's width off the grid.
    // `getBBox` is in the element's own space, which is the space this
    // transform translates from.
    const box = safeBBox(documentModel.getNode(drag.id));
    if (!box) return transform;
    const round = (value) => Math.round(value / size) * size;
    return { ...transform, x: round(box.x + transform.x) - box.x, y: round(box.y + transform.y) - box.y };
  };

  // The gizmo works in the selected element's *parent* space: that is where a
  // baseTransform maps its own geometry to, and it survives nested groups,
  // viewBoxes and canvas zoom without a special case for any of them.
  const parentSpace = (node) => node?.parentNode?.getScreenCTM?.() || null;

  const gizmoTarget = () => {
    if (!editing() || activeTool !== 'select' || rigTool || !selectedId || selectedIds.length > 1) return null;
    if (store.getDocument().layerMetadata?.[selectedId]?.locked) return null;
    const node = documentModel.getNode(selectedId);
    const box = node && selectionBox(node);
    const ctm = parentSpace(node);
    if (!box || !ctm) return null;
    /**
     * The transform the piece is **drawn** with, and what the session is
     * adding to the authored one (`core/artwork/pose-transform.js`).
     *
     * Artwork stays posable while it is designed — the puppet handles are on,
     * the head-pose pad turns the head — so `baseTransform` is the rest pose
     * and not where the part is. Reading it drew the box around where the nose
     * *would* be if the head were straight, seventy-four pixels from the nose.
     *
     * `lastRequested` is the channel array the canvas wrote to the DOM for the
     * last frame: the renderer's own numbers, not a matrix parsed back out of
     * an attribute. A deformer hierarchy resolves to a matrix instead and has
     * no channels, and a piece no frame has reached yet has none either; both
     * fall back to the authored transform, which is what they are drawn with.
     */
    const authored = store.getDocument().elements?.[selectedId]?.baseTransform;
    const base = authored ? { ...authored } : parseTransform(SVG.adopt(node));
    const drawn = transformFromChannels(lastRequested.get(selectedId));
    const pose = drawn ? poseBetween(drawn, base) : null;
    const transform = drawn || base;
    // An unconfigured pivot is (0, 0) — the corner of the artwork's own
    // coordinates, usually nowhere near the part. Rotating or scaling around
    // that is never what the author means, so the middle of the selection is
    // the default; the pivot handle still moves it anywhere.
    if (!transform.pivotX && !transform.pivotY) {
      transform.pivotX = box.x + box.width / 2;
      transform.pivotY = box.y + box.height / 2;
    }
    return { id: selectedId, node, box, transform, pose, scale: Math.hypot(ctm.a, ctm.b) || 1 };
  };

  // Compact mode toolbar. It only exists while something is selected, so it
  // never competes with the vector tools for attention.
  const gizmoToolbar = document.createElement('div');
  gizmoToolbar.className = 'gizmo-toolbar';
  gizmoToolbar.setAttribute('role', 'toolbar');
  gizmoToolbar.setAttribute('aria-label', 'Transform mode');
  gizmoToolbar.hidden = true;
  gizmoToolbar.innerHTML = [
    ['move', 'Move', 'G', '✥'], ['rotate', 'Rotate', 'E', '⟳'], ['scale', 'Scale', 'K', '⤢'], ['pivot', 'Pivot', 'A', '⊕']
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
    // `R` `S` `P` also pick a mode on a surface with no drawing tools to
    // collide with — which is every editing surface except Artwork.
    aliasKeys: () => workspace !== 'create',
    // Nested mascot parts overlap: pressing inside the head's box but on the
    // mouth means "select the mouth", not "drag the head". Handles are always
    // the gizmo's; the body only when the press is on the selection's own art.
    canDragBody: (event) => {
      const elements = store.getDocument().elements || {};
      for (let node = event.target; node && node !== container; node = node.parentNode) {
        const id = node.getAttribute?.('id');
        if (!id || !elements[id]) continue;
        // A press on a shape *inside* the selected piece is a press on the
        // piece: the eye is selected and the pointer is on its white, and
        // dragging is what a person expects. Without this a group could be
        // selected and never moved -- a group is covered by its own children, so
        // there is no point on it that is not on one of them. An eye you could
        // select and not move is exactly what an author reported
        // (docs/EYE_BUILDS.md), and the piece model that used to answer this is
        // installed on Hands alone.
        if (id === selectedId || inside(selectedId, id)) return true;
        /**
         * Some other piece is under the pointer. It wins only if it is painted
         * **in front of** the selection.
         *
         * "Anything else means select that instead" read well and made a
         * selected nose undraggable: a nose is a thin open stroke, so the
         * middle of its own box is the head showing through, and pressing the
         * middle of the thing you have just selected deselected it and picked
         * the face. Behind the selection is background — the box is the
         * author's claim on that area. In front of it is a piece they can see
         * and are more likely reaching for, which is the case this rule was
         * written for: the mouth inside the head's box.
         */
        return !paintedOver(id, selectedId);
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
    // Snap, on a move (audit §5).
    //
    // The grid used to help the drawing tools alone: it placed the corners of a
    // shape being drawn and did nothing at all to a shape being moved. What is
    // snapped is the **box's own corner**, not the distance travelled: moving in
    // grid steps from wherever a piece happened to sit would leave it off the
    // grid for ever, which is the half-measure that reads as a bug.
    //
    // Only a move, and only where the grid is: a rotation or a scale has no
    // corner to land on, and nothing is drawn on a mascot (`tool-options.js`
    // keeps Grid and Snap with the tools they serve).
    // Transient: the DOM moves, history and the store do not.
    onPreview: (transform, drag) => {
      const shown = snapMove(transform, drag);
      documentModel.getNode(drag.id)?.setAttribute('transform', transformString(shown));
      // The box follows the pointer because the drag says where the piece is
      // now; without this it stayed where the drag began.
      drewWith(drag.id, shown);
    },
    // One command for the whole gesture.
    onCommit: (rawTransform, drag) => {
      const transform = snapMove(rawTransform, drag);
      const id = drag.id;
      documentModel.getNode(id)?.setAttribute('transform', transformString(transform));
      drewWith(id, transform);
      documentModel.captureAuthoringNode(id);
      /**
       * The drag leaves the piece where the pointer put it; the *project*
       * records that place without the pose that was on it.
       *
       * The gizmo works in drawn coordinates, because that is where the
       * author can see it. `baseTransform` is the resting artwork, so
       * committing the drawn transform straight into it would write the head
       * turn into the drawing: the part would be displaced once by the
       * authored value and again by the turn, and would fly off as soon as
       * the head came back to centre. At rest the pose is identity and this
       * is the same number as before (`core/artwork/pose-transform.js`).
       */
      const authored = finiteTransform(removePose(transform, drag.pose));
      // On a mascot surface the gesture goes where a typed field goes, so a
      // linked pair follows a drag exactly as it follows a number (audit §2.2).
      if (pieces?.commit?.(id, authored)) return;
      const current = store.getDocument();
      syncDocument({
        elements: { ...current.elements, [id]: { ...(current.elements[id] || {}), baseTransform: authored } },
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
    for (const other of selectedIds) documentModel.getNode(other)?.removeAttribute('data-editor-selected');
    selectedIds = [];
    renderMultiSelection();
    renderHandRig();
    renderWarp();
    renderPins();
  }

  function showSelection(id, ids = null) {
    clearSelection();
    if (!id || workspace === 'animate' || workspace === 'preview') return;
    const element=wrapperFor(id);if(!element)return;
    selectedId=id;element.node.setAttribute('data-editor-selected','true');
    // The rest of the set, marked the same way and framed together.
    selectedIds = (Array.isArray(ids) && ids.includes(id) ? ids : [id]).filter((item) => documentModel.getNode(item));
    for (const other of selectedIds) documentModel.getNode(other)?.setAttribute('data-editor-selected', 'true');
    renderMultiSelection();
    // Once more after the frame: an undo restores the document before the
    // pieces are drawn where it says, and frames measured now would be stale.
    if (selectedIds.length > 1) requestAnimationFrame(() => renderMultiSelection());
    // The Boop gizmo replaces the library selection chrome for ordinary
    // authoring; the legacy plugins remain only for the rig pose tools.
    gizmo.render();
    syncGizmoToolbar();
    // Clicking a path while the Node tool is chosen is how a person expects to
    // start editing it, rather than having to pick the tool again.
    //
    // A rectangle or an ellipse is not a path, and answering "that is not a
    // path" was a dead end: rounding one corner of a drawn rectangle, or
    // pulling a curve out of an ellipse, is exactly what the tool is for and
    // the way to it was a different menu. Clicking one with the Node tool
    // converts it, in the same undo step as the edit that follows.
    if (activeTool === 'node') {
      if (startNodeEdit(id)) showNote('Drag a node to reshape the path. Arrow keys nudge it; Esc leaves the tool.');
      else if (store.getDocument().layerMetadata?.[id]?.locked) showNote('This piece is locked. Unlock it to edit its points.');
      else {
        const converted = api.convertToPathNow(id);
        if (converted.ok && startNodeEdit(id)) showNote('Turned into a path so its points can be moved. Drag a node to reshape it; undo puts the shape back.');
        else showNote(converted.ok ? 'Nothing here to reshape.' : converted.message);
      }
    }
    // Say what is cutting this piece, if anything is.
    renderFrame();
    // Selecting a hand's own artwork is one of the two ways hand mode opens.
    renderHandRig();
    // And selecting a warped piece is the only way its lattice appears.
    renderWarp();
    // The same for the pins the piece is held by.
    renderPins();
  }

  function attachBehavior(element) {
    if (attachedNodes.has(element.node)) return false;
    attachedNodes.add(element.node);
    diagnostics.increment('canvas.interactionAttachments');
    diagnostics.increment('canvas.interactiveElements');
    element.selectize(false).draggable(false);
    element.on('mouseover', () => { if (rigTool?.kind === 'role' || (rigTool?.kind === 'pin-place' && element.type === 'path' && (!rigTool.target || rigTool.target === element.id()))) element.node.setAttribute('data-rig-candidate', 'true'); });
    element.on('mouseout', () => element.node.removeAttribute('data-rig-candidate'));
    element.on('click', (event) => {
      event.stopPropagation();
      if (rigTool?.kind === 'role') { rigTool.pick(element.id()); return; }
      if (rigTool?.kind === 'pin-place') {
        const tool = rigTool, id = element.id();
        if (!tool.target && element.type !== 'path') { showMode(pathOnlyMessage(id, element.node?.localName || element.type)); return; }
        const point = artworkPoint(event);
        if (!point) return;
        api.cancelRigTool(false);
        tool.place(tool.target || id, point);
        return;
      }
      // Shift (or Ctrl/Cmd) adds a piece to the selection, or takes it back out.
      const extend = editing() && activeTool === 'select' && Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
      const picked = extend ? element.id() : clickTarget(element.id());
      store.mutateSession(['selectedId', 'selectedIds'], state => { Object.assign(state, extend ? toggleSelected(state, picked) : selectOnly(picked)); });
    });
    element.on('dragstart resizestart', (event) => { if (store.getDocument().layerMetadata[element.id()]?.locked) event.preventDefault(); });
    element.on('dragend resize', () => {
      const id = element.id();
      if (store.getDocument().layerMetadata[id]?.locked) return;
      if(rigTool?.kind==='transform-pose'&&rigTool.ids.includes(id)){rigTool.temporary[id]=posedTransform(id,rigTool);return;}
      documentModel.captureAuthoringNode(id);
      syncDocument({elements:{...store.getDocument().elements,[id]:{...(store.getDocument().elements[id]||{}),baseTransform:parseTransform(element)}},svgMarkup:documentModel.serialize()}, {domains:['artwork'],source:'canvas'});
    });
    return true;
  }

  function updateElementInteractionState(id) {
    // Dragging is the gizmo's job (docs/SELECTION_GIZMO.md). This used to turn
    // the legacy svg.draggable plugin back on for a piece the moment it was
    // unlocked, which gave that one piece a second, uncoordinated drag path.
    if (!wrapperFor(id)) return;
    showSelection(store.getSession().selectedId, store.getSession().selectedIds);
  }

  /** Every `<image>` currently in the artwork, painted or not. */
  const assetNodes = (root = rootGroup.node) => [...(root?.querySelectorAll?.('image') || [])];
  const paintAssets = (root) => paintAssetReferences(assetNodes(root), assetResolver);

  function loadSvgText(svgText, metadata = {}, options = {}) {
    return previewOrder.authored(() => loadSvgTextNow(svgText, metadata, options));
  }
  function loadSvgTextNow(svgText, metadata = {}, options = {}) {
    const safeMarkup = sanitizeSvgMarkup(svgText);
    lastRequested.clear();
    rootGroup.remove();
    // `deferAssetReferences` first: a browser starts fetching `asset:` the
    // moment the markup is parsed, so moving the reference aside afterwards
    // would be one failed request too late (runtime/asset-paint.js).
    rootGroup = draw.group().svg(deferAssetReferences(safeMarkup));
    raiseGizmoLayer();
    const svgRoot = rootGroup.node.querySelector('svg');
    // Before anything measures the artwork: a raster node carrying
    // `asset:` cannot be drawn by a browser, so it is pointed at what the
    // resolver already holds. Fetching is `refreshAssets`, which is
    // asynchronous and is the caller's to await; this pass is not, because
    // loading is not.
    paintAssets(svgRoot);
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
    applyEditScope();
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
    clearControlHandles();
    container.classList.remove('node-editing');
    nodeEdit = null;
    nodeFocusHandler(null);
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
    placeControlHandles();
  }

  /* ── Bezier handles (core/path/path-controls.js) ────────────────────────
   *
   * The point last pressed or focused shows the two control points that
   * shape the curve on either side of it, joined to it by a line. Dragging one
   * moves the other with it while the point is smooth; Alt breaks the pair.
   */
  const nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodeLayer.setAttribute('data-node-layer', '');
  nodeLayer.setAttribute('pointer-events', 'none');
  let nodeFocusHandler = () => {};

  function focusNode(index) {
    if (!nodeEdit || nodeEdit.focus === index) return;
    nodeEdit.focus = index;
    placeControlHandles();
    nodeFocusHandler(focusedNodeInfo());
  }

  /** What the options bar says about the focused point. */
  function focusedNodeInfo() {
    const element = nodeEditTarget();
    if (!element || nodeEdit.focus == null) return null;
    const node = pathControls(element.attr('d')).find((item) => item.index === nodeEdit.focus);
    if (!node) return null;
    const handles = Boolean(node.in || node.out);
    const corner = nodeEdit.corners.has(node.index) || (handles && !node.smooth);
    return { index: node.index, handles, smooth: handles && !corner, corner };
  }

  function clearControlHandles() {
    for (const entry of nodeEdit?.controls || []) entry.handle.remove();
    if (nodeEdit) nodeEdit.controls = [];
    nodeLayer.replaceChildren();
  }

  function placeControlHandles() {
    const element = nodeEditTarget();
    if (!element || !nodeEdit) return;
    clearControlHandles();
    if (nodeEdit.focus == null) return;
    const node = pathControls(element.attr('d')).find((item) => item.index === nodeEdit.focus);
    const ctm = element.node.getScreenCTM();
    if (!node || !ctm) return;
    const box = container.getBoundingClientRect();
    const toCanvas = (p) => { const point = draw.node.createSVGPoint(); point.x = p.x; point.y = p.y; const screen = point.matrixTransform(ctm); return { x: screen.x - box.left, y: screen.y - box.top }; };
    const anchor = toCanvas(node);
    draw.node.append(nodeLayer);
    for (const side of ['in', 'out']) {
      const control = node[side];
      if (!control) continue;
      const at = toCanvas(control);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'node-guide');
      line.setAttribute('x1', anchor.x); line.setAttribute('y1', anchor.y);
      line.setAttribute('x2', at.x); line.setAttribute('y2', at.y);
      nodeLayer.append(line);
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'rig-node-handle rig-control-handle';
      handle.dataset.pathControl = `${node.index}:${side}`;
      handle.setAttribute('aria-label', `${side === 'in' ? 'Incoming' : 'Outgoing'} curve handle of path node ${node.index}`);
      handle.style.left = `${at.x}px`;
      handle.style.top = `${at.y}px`;
      container.append(handle);
      nodeEdit.controls.push({ handle, index: node.index, side });
    }
  }

  /**
   * A change of numbers with the same topology: the pose on screen takes the
   * new path, and the rest outline underneath moves by the same deltas, so a
   * shape key keeps deforming what it deformed before.
   */
  function applyValueEdit(before, after) {
    const element = nodeEditTarget();
    if (!element || before === after) return false;
    element.attr('d', after);
    if (nodeEdit.restPath) {
      try {
        const a = parsePath(before).values, b = parsePath(after).values, rest = parsePath(nodeEdit.restPath);
        if (rest.values.length === a.length && a.length === b.length) nodeEdit.restPath = serializePath(rest.commands, Array.from(rest.values).map((value, slot) => value + (b[slot] - a[slot])));
      } catch { /* an unreadable rest outline keeps its shape */ }
    }
    return true;
  }

  /** Curve, Straight, Smooth or Corner, on the focused point (`ui/tool-options.js`). */
  function convertFocusedNode(kind) {
    const element = nodeEditTarget();
    if (!element || nodeEdit.focus == null) return false;
    const index = nodeEdit.focus;
    if (kind === 'curve' || kind === 'straight') {
      const done = applyPathEdit(convertNode(element.attr('d'), index, kind), { focus: index, verb: kind === 'curve' ? 'curved' : 'straightened' });
      if (done && kind === 'straight') nodeEdit?.corners.delete(index);
      return done;
    }
    if (kind === 'corner') {
      nodeEdit.corners.add(index);
      nodeFocusHandler(focusedNodeInfo());
      showNote('Corner: the two handles of this point move on their own.');
      return true;
    }
    if (kind === 'smooth') {
      const current = element.attr('d');
      const next = smoothNode(current, index);
      nodeEdit.corners.delete(index);
      if (next === current) {
        showNote(focusedNodeInfo()?.handles ? 'This point is already smooth.' : 'Give this point curves first (Curve), then smooth it.');
        nodeFocusHandler(focusedNodeInfo());
        return false;
      }
      applyValueEdit(current, next);
      nodeEdit.moved = true;
      placeNodeHandles();
      commitNodeEdit();
      nodeFocusHandler(focusedNodeInfo());
      return true;
    }
    return false;
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
      // The point in hand shows its curve handles; focus is how it gets there
      // by keyboard, and a press is how it gets there by pointer.
      handle.addEventListener('focus', () => focusNode(node.index));
      container.append(handle);
      return { handle, index: node.index };
    });
    // A deformed shape is drawn as `restPath + Σ shape keys`, so what is on
    // screen is a pose and the authored outline is underneath it. Dragging a
    // node used to write the pose into the document, where the very next frame
    // overwrote it: the edit looked like it had been rejected. The rest
    // outline travels with the drag instead, by the same vector.
    nodeEdit = { id, handles, moved: false, restPath: store.getDocument().elements?.[id]?.restPath || null, focus: null, corners: new Set(), controls: [], draggingControl: null };
    container.classList.add('node-editing');
    placeNodeHandles();
    return true;
  }

  /** Rebuild the handles after a change that moved the indices, and keep the focus. */
  function rebuildNodeHandles(focusIndex = null) {
    if (!nodeEdit) return false;
    const id = nodeEdit.id, moved = nodeEdit.moved, restPath = nodeEdit.restPath, corners = nodeEdit.corners;
    if (!startNodeEdit(id)) return false;
    nodeEdit.moved = moved;
    nodeEdit.restPath = restPath;
    nodeEdit.corners = corners;
    const entry = nodeEdit.handles.find((item) => item.index === focusIndex) || null;
    if (entry) { entry.handle.focus(); focusNode(focusIndex); }
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
    if (edit.ok === false) { showNote(edit.message); return false; }
    const posed = element.attr('d');
    const result = commands.editPath(nodeEdit.id, edit, { posedPath: nodeEdit.restPath ? posed : null });
    if (result?.ok === false) { showNote(result.message); return false; }
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
    showNote(`Point ${verb}${carried ? `, and ${carried} came with it` : ''}.`);
    rebuildNodeHandles(focus);
    return true;
  }

  /**
   * Add a point where the pointer is, on the segment nearest to it — if the
   * pointer is actually near the outline. A double-click on empty canvas used
   * to add a point on the nearest segment however far away it was.
   */
  function insertNodeNear(point, { maxScreenDistance = 14 } = {}) {
    const element = nodeEditTarget();
    if (!element || !point) return false;
    const found = nearestPathPoint(element.attr('d'), point);
    if (!found) return false;
    const ctm = rootGroup.node.querySelector('svg')?.getScreenCTM();
    const unit = ctm ? Math.hypot(ctm.a, ctm.b) || 1 : 1;
    if (Number.isFinite(found.distance) && found.distance * unit > maxScreenDistance) return false;
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
    if (!nodeEdit) return;
    const control = event.target.closest?.('[data-path-control]');
    if (control) {
      event.preventDefault();
      event.stopPropagation();
      control.setPointerCapture(event.pointerId);
      const [index, side] = control.dataset.pathControl.split(':');
      nodeEdit.draggingControl = { index: Number(index), side };
      return;
    }
    const handle = event.target.closest?.('[data-path-node]');
    if (!handle) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    // preventDefault above keeps the browser from focusing the button; focus
    // it anyway, so Delete after a press removes this point, not the shape.
    handle.focus({ preventScroll: true });
    nodeEdit.dragging = Number(handle.dataset.pathNode);
    focusNode(nodeEdit.dragging);
  }, true);

  container.addEventListener('pointermove', (event) => {
    if (!nodeEdit) return;
    const element = nodeEditTarget();
    if (!element) return;
    if (nodeEdit.draggingControl) {
      const { index, side } = nodeEdit.draggingControl;
      const point = pathPoint(element, event);
      if (!point) return;
      const current = element.attr('d');
      const node = pathControls(current).find((item) => item.index === index);
      // Smooth points keep their handles opposite; Alt breaks the pair, and a
      // point the author declared a corner never mirrors.
      const mirror = event.altKey || !node || nodeEdit.corners.has(index) || !node.smooth ? false : 'angle';
      if (applyValueEdit(current, movePathControl(current, index, side, snapIfOn(point), { mirror }))) { nodeEdit.moved = true; placeNodeHandles(); }
      return;
    }
    if (nodeEdit.dragging === undefined || nodeEdit.dragging === null) return;
    if (moveNodeTo(nodeEdit.dragging, snapIfOn(pathPoint(element, event)))) nodeEdit.moved = true;
  });

  container.addEventListener('pointerup', (event) => {
    if (!nodeEdit) return;
    if (nodeEdit.draggingControl) {
      event.target.releasePointerCapture?.(event.pointerId);
      nodeEdit.draggingControl = null;
      commitNodeEdit();
      nodeFocusHandler(focusedNodeInfo());
      return;
    }
    if (nodeEdit.dragging === undefined || nodeEdit.dragging === null) return;
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

  /* ── Several pieces at once ─────────────────────────────────────────────
   *
   * A drag on empty canvas under the Select tool draws a marquee and selects
   * the highest pieces wholly inside it (core/artwork/arrange.js); a drag on
   * any piece of a selection of several moves them all, as one undo step.
   * Both are measured on screen: a piece's client rectangle already carries
   * every transform above it, whatever group it sits in.
   */
  const clientBoxOf = (id) => {
    const node = documentModel.getNode(id);
    if (!node?.getBoundingClientRect) return null;
    const rect = node.getBoundingClientRect();
    return Number.isFinite(rect.width) && (rect.width || rect.height) ? { id, x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  };
  /** Client → the outer svg, where the chrome layers draw. */
  const outerPoint = (x, y) => {
    const ctm = draw.node.getScreenCTM?.();
    if (!ctm) return { x, y };
    const point = draw.node.createSVGPoint(); point.x = x; point.y = y;
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };
  const artboardScreenBox = () => {
    const matrix = artworkMatrix(), ctm = draw.node.getScreenCTM?.();
    if (!matrix || !ctm) return null;
    const box = readArtboard(store.getDocument().svgMarkup || '');
    const corner = (x, y) => { const p = applyMatrix(matrix, { x, y }); const point = draw.node.createSVGPoint(); point.x = p.x; point.y = p.y; return point.matrixTransform(ctm); };
    const a = corner(box.x, box.y), b = corner(box.x + box.width, box.y + box.height);
    return { id: 'artboard', ...boxFromCorners(a, b) };
  };
  /* ── Edit scope (ui/piece-actions.js, "Isolate") ──────────────────────────
   *
   * Isolating a piece limits the visible edit to it:
   * everything outside it is dimmed and inert, a marquee and Ctrl/Cmd+A pass
   * it by, and a shape drawn goes inside it. It is session chrome, not the
   * document: the marks are editor attributes the serializer strips, and a
   * new drawing, a selection outside the piece or leaving Artwork drops it.
   */
  let editScope = null;
  let editScopeHandler = () => {};
  const scopeNode = () => (editScope ? documentModel.getNode(editScope) : null);
  /** Whether a piece is the scope or inside it; with no scope, everything is. */
  function inEditScope(id) {
    const root = scopeNode();
    if (!root) return true;
    for (let node = documentModel.getNode(id); node; node = node.parentNode) if (node === root) return true;
    return false;
  }
  /** The marks on the drawing, from the scope as it is: the piece "in", every sibling of its chain "out", whole. */
  function applyEditScope() {
    container.querySelectorAll('[data-editor-scope]').forEach((node) => node.removeAttribute('data-editor-scope'));
    const root = scopeNode(), svgRoot = rootGroup.node.querySelector('svg');
    if (!root || !svgRoot) {
      container.removeAttribute('data-edit-scope');
      if (editScope) { editScope = null; editScopeHandler(null); }
      return;
    }
    container.setAttribute('data-edit-scope', editScope);
    root.setAttribute('data-editor-scope', 'in');
    for (let step = root; step && step !== svgRoot && step.parentNode; step = step.parentNode) {
      for (const sibling of step.parentNode.children) if (sibling !== step && sibling.localName !== 'defs') sibling.setAttribute('data-editor-scope', 'out');
    }
  }
  function setEditScope(id) {
    const next = id && documentModel.getNode(id) ? id : null;
    const changed = next !== editScope;
    editScope = next;
    applyEditScope();
    if (changed) editScopeHandler(editScope);
    return Boolean(next);
  }
  const findLayer = (items, id) => { for (const item of items || []) { if (item.id === id) return item; const found = findLayer(item.children, id); if (found) return found; } return null; };

  /** Unlocked, visible pieces at the top of the artwork -- or, inside an edit scope, at the top of the scope. */
  const topLevelIds = () => {
    const metadata = store.getDocument().layerMetadata || {};
    const scoped = editScope ? findLayer(documentModel.getTree(), editScope) : null;
    const items = scoped ? (scoped.children?.length ? scoped.children : [scoped]) : documentModel.getTree();
    return items.filter((item) => item.visible !== false && !metadata[item.id]?.locked).map((item) => item.id);
  };
  const hasSelectedAncestor = (id) => {
    for (let node = documentModel.getNode(id)?.parentNode; node && node !== documentModel.root; node = node.parentNode) {
      const ancestor = node.getAttribute?.('id');
      if (ancestor && selectedIds.includes(ancestor)) return true;
    }
    return false;
  };
  // A piece inside a selected group travels with the group; moving it on its
  // own as well would move it twice.
  const movableSelection = () => selectedIds.filter((id) => store.getDocument().elements[id] && !store.getDocument().layerMetadata[id]?.locked && !hasSelectedAncestor(id));

  function renderMultiSelection() {
    multiLayer.replaceChildren();
    if (selectedIds.length < 2 || !editing()) return;
    const boxes = selectedIds.map(clientBoxOf).filter(Boolean);
    const frame = (box, className) => {
      const a = outerPoint(box.x, box.y), b = outerPoint(box.x + box.width, box.y + box.height);
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', className);
      rect.setAttribute('x', Math.min(a.x, b.x)); rect.setAttribute('y', Math.min(a.y, b.y));
      rect.setAttribute('width', Math.abs(b.x - a.x)); rect.setAttribute('height', Math.abs(b.y - a.y));
      rect.setAttribute('vector-effect', 'non-scaling-stroke');
      multiLayer.append(rect);
    };
    for (const box of boxes) frame(box, 'multi-select-piece');
    const union = unionBox(boxes);
    if (union) frame(union, 'multi-select-box');
  }

  /**
   * Move the selected pieces by a screen vector: each one by that vector in
   * its own parent's space, so a piece inside a rotated group goes where the
   * pointer went.
   */
  function moveSelectionBy(delta, starts) {
    for (const id of movableSelection()) {
      const start = starts.get(id);
      const node = documentModel.getNode(id);
      const parent = node?.parentNode?.getScreenCTM?.();
      if (!start || !node) continue;
      const local = vectorInSpace(parent ? parent.inverse() : null, delta);
      api.applyElementTransform(id, { ...store.getDocument().elements[id], baseTransform: { ...start, x: start.x + local.x, y: start.y + local.y } });
    }
    renderMultiSelection();
  }

  /** Apply a set of screen-space moves as one undo step. */
  function arrangeSelection(plan, note) {
    const boxes = movableSelection().map(clientBoxOf).filter(Boolean);
    const moves = boxes.length ? plan(boxes) : [];
    if (!moves.length) { if (boxes.length) showNote('Already lined up.'); return false; }
    history.snapshot();
    for (const move of moves) {
      const node = documentModel.getNode(move.id);
      const parent = node?.parentNode?.getScreenCTM?.();
      const local = vectorInSpace(parent ? parent.inverse() : null, { x: move.dx, y: move.dy });
      const base = store.getDocument().elements[move.id]?.baseTransform || {};
      commands.setTransform(move.id, { x: (Number(base.x) || 0) + local.x, y: (Number(base.y) || 0) + local.y }, { source: 'canvas', snapshot: false });
      api.applyElementTransform(move.id, store.getDocument().elements[move.id]);
    }
    commitTransforms();
    renderMultiSelection();
    showNote(`${note}.`);
    return true;
  }

  const marquee = (() => {
    let state = null;
    let swallowClick = false;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('class', 'canvas-marquee');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    const artworkUnder = (target) => {
      const elements = store.getDocument().elements || {};
      for (let node = target; node && node !== container; node = node.parentNode) {
        const id = node.getAttribute?.('id');
        if (id && elements[id]) return id;
      }
      return null;
    };
    const idle = () => editing() && activeTool === 'select' && !rigTool && !nodeEdit && !panning && !drawTools.isDrawing();
    container.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !idle() || onCanvasChrome(event) || event.target.closest?.('.canvas-menu, .canvas-tools, .gizmo-toolbar')) return;
      const under = artworkUnder(event.target);
      if (under && selectedIds.length > 1 && selectedIds.includes(under)) {
        // A press on one of several selected pieces: dragging moves them all.
        const starts = new Map(movableSelection().map((id) => [id, finiteTransform(store.getDocument().elements[id]?.baseTransform)]));
        if (!starts.size) return;
        state = { kind: 'move', x: event.clientX, y: event.clientY, pointerId: event.pointerId, starts, moved: false };
      } else if (!under) {
        state = { kind: 'marquee', x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false, extend: Boolean(event.shiftKey || event.ctrlKey || event.metaKey) };
      } else return;
      event.preventDefault();
    });
    container.addEventListener('pointermove', (event) => {
      if (!state || event.pointerId !== state.pointerId) return;
      const dx = event.clientX - state.x, dy = event.clientY - state.y;
      if (!state.moved && Math.hypot(dx, dy) < 4) return;
      // Captured only once it is a drag: a click that never moved keeps its
      // click, which is how the background deselects and a piece is picked.
      if (!state.moved) container.setPointerCapture?.(event.pointerId);
      state.moved = true;
      if (state.kind === 'move') { moveSelectionBy({ x: dx, y: dy }, state.starts); return; }
      const a = outerPoint(state.x, state.y), b = outerPoint(event.clientX, event.clientY);
      const box = boxFromCorners(a, b);
      rect.setAttribute('x', box.x); rect.setAttribute('y', box.y); rect.setAttribute('width', box.width); rect.setAttribute('height', box.height);
      if (!rect.parentNode) { draw.node.append(rect); raiseGizmoLayer(); }
    });
    const finish = (event) => {
      if (!state || (event && event.pointerId !== state.pointerId)) return;
      const current = state; state = null;
      rect.remove();
      if (!event) {
        // The browser took the pointer away mid-drag: the pieces go back where
        // the drag found them, and nothing is written.
        if (current.moved) container.releasePointerCapture?.(current.pointerId);
        if (current.kind === 'move' && current.moved) { for (const [id, start] of current.starts) api.applyElementTransform(id, { ...store.getDocument().elements[id], baseTransform: start }); renderMultiSelection(); }
        return;
      }
      if (!current.moved) {
        // A press on empty canvas that never moved is a click on the
        // background: nothing selected, unless Shift was held to keep adding.
        if (current.kind === 'marquee' && !current.extend && selectedIds.length) { swallowClick = true; store.mutateSession(['selectedId', 'selectedIds'], (session) => { Object.assign(session, selectOnly(null)); }); }
        return;
      }
      container.releasePointerCapture?.(current.pointerId);
      swallowClick = true;
      if (current.kind === 'move') {
        // One undo step for the whole drag: the DOM already shows the result,
        // the store catches up here.
        history.snapshot();
        const delta = { x: event.clientX - current.x, y: event.clientY - current.y };
        for (const [id, start] of current.starts) {
          const node = documentModel.getNode(id);
          const parent = node?.parentNode?.getScreenCTM?.();
          const local = vectorInSpace(parent ? parent.inverse() : null, delta);
          commands.setTransform(id, { x: start.x + local.x, y: start.y + local.y }, { source: 'canvas', snapshot: false });
          api.applyElementTransform(id, store.getDocument().elements[id]);
        }
        commitTransforms();
        renderMultiSelection();
        return;
      }
      const frame = boxFromCorners({ x: current.x, y: current.y }, { x: event.clientX, y: event.clientY });
      const metadata = store.getDocument().layerMetadata || {};
      const picked = marqueeSelection(documentModel.getTree(), frame, (item) => clientBoxOf(item.id), (item) => item.visible === false || Boolean(metadata[item.id]?.locked) || !inEditScope(item.id));
      const next = current.extend ? [...selectedIds.filter((id) => !picked.includes(id)), ...picked] : picked;
      store.mutateSession(['selectedId', 'selectedIds'], (session) => { Object.assign(session, selectMany(next)); });
    };
    container.addEventListener('pointerup', finish);
    container.addEventListener('pointercancel', () => finish(null));
    return {
      /** The click that ends a marquee or a drag is not a click on the background. */
      consumeClick() { const was = swallowClick; swallowClick = false; return was; },
      cancel() { if (state) { if (state.moved) container.releasePointerCapture?.(state.pointerId); state = null; rect.remove(); } }
    };
  })();

  // The wheel: Ctrl/Cmd — which is also how a browser reports a trackpad pinch —
  // zooms about the pointer; on its own it pans, because the canvas has nothing
  // else to scroll and a zoomed-in mascot was otherwise reachable only by the
  // Hand tool.
  container.addEventListener('wheel', (event) => {
    if (!rootGroup?.node || onCanvasOverlay(event)) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const box = container.getBoundingClientRect();
      api.zoomView(Math.exp(-event.deltaY * 0.002), { x: event.clientX - box.left, y: event.clientY - box.top });
      return;
    }
    api.panView(-event.deltaX, -event.deltaY);
  }, { passive: false });

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
    for (const node of puppet.cages?.values() || []) node.remove();
    puppet.halo?.remove();
    puppet.reachNode?.remove();
    puppet = null;
    handConsoleLayer.style.display = 'none';
    for (const node of handConsoleNodes.values()) node.remove();
    handConsoleNodes.clear();
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
    if (!wanted) {
      // Only the handle whose reach is on screen may take it off again. There
      // is one node for all of them, and with a *pair* of hands the one that is
      // not being dragged used to remove the one that is — so a hand dragged on
      // a mascot with two of them showed no reach at all.
      if (puppet && puppet.reachOwner === entry) { puppet.reachNode?.remove(); puppet.reachNode = null; puppet.reachOwner = null; }
      return;
    }
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
    puppet.reachOwner = entry;
  }
  /* ── The hand console (docs/DIRECT_CONTROLS.md, docs/HAND_RIGGING.md) ─────
   *
   * A hand carries ten movements, and ten dots on a hand the size of an eye is
   * a minefield. So they are laid out on a dial instead: the ring is the reach
   * the hand really has, the fingers are sliders on its rim, the turns are a
   * row under it, and one more beside the face brings the hand out from behind
   * the head. The geometry is the model's (`core/puppet/hand-console.js`); all
   * that happens here is drawing it, in the artwork's own coordinates so it
   * follows a zoom, a pan and a pose without being told.
   */
  const handConsoleLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  handConsoleLayer.setAttribute('data-hand-console-layer', '');
  handConsoleLayer.setAttribute('pointer-events', 'none');
  handConsoleLayer.style.display = 'none';
  draw.node.append(handConsoleLayer);
  /** Built once per control and moved: a drag rewrites one attribute, not the DOM. */
  const handConsoleNodes = new Map();
  function handConsoleNode(id, shape, className) {
    let node = handConsoleNodes.get(id);
    if (!node) {
      node = document.createElementNS('http://www.w3.org/2000/svg', shape);
      node.setAttribute('class', className);
      // The colour is a presentation attribute as well as a class, for the
      // same reason hand mode's is: an overlay with no stroke is invisible on
      // a page that never loaded the editor's stylesheet.
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke', '#79adff');
      node.setAttribute('vector-effect', 'non-scaling-stroke');
      handConsoleNodes.set(id, node);
      handConsoleLayer.append(node);
    }
    return node;
  }

  /**
   * Artwork coordinates → the container's own pixels, or null when there is no
   * artwork to measure against.
   *
   * A console's tracks are drawn through `artworkMatrix` -- computed rather
   * than measured, for the reason that function gives -- so its knobs have to
   * be placed through the same one. Reading the nested `<svg>`'s own CTM
   * instead put every knob on a *second* picture of the console: right while
   * the calculation and the measurement agreed, and a whole cluster of dots
   * adrift on empty canvas the moment they did not.
   */
  function artworkPlacer(box) {
    const matrix = artworkMatrix(), ctm = draw.node.getScreenCTM?.();
    if (!matrix || !ctm) return null;
    const point = draw.node.createSVGPoint();
    return (at) => {
      const drawn = applyMatrix(matrix, at);
      point.x = drawn.x; point.y = drawn.y;
      const screen = point.matrixTransform(ctm);
      return { x: screen.x - box.left, y: screen.y - box.top };
    };
  }

  function renderHandConsole() {
    const drawn = puppet?.visible
      ? puppet.handles.filter((entry) => !entry.button.hidden && (entry.handle.track || entry.handle.ring))
      : [];
    const matrix = drawn.length ? artworkMatrix() : null;
    if (!matrix) { handConsoleLayer.style.display = 'none'; return 0; }
    // A rebuild appends the artwork after this layer, which would leave the
    // console drawn underneath the hand it is about.
    draw.node.append(handConsoleLayer);
    handConsoleLayer.style.display = '';
    handConsoleLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    const wanted = new Set();
    for (const { handle } of drawn) {
      if (handle.ring) {
        const id = `${handle.id}:ring`;
        const ring = handConsoleNode(id, 'ellipse', 'hand-console-ring');
        for (const [key, value] of [['cx', handle.ring.cx], ['cy', handle.ring.cy], ['rx', handle.ring.rx], ['ry', handle.ring.ry]]) {
          if (ring.getAttribute(key) !== String(value)) ring.setAttribute(key, value);
        }
        wanted.add(id);
      }
      if (handle.track) {
        const id = `${handle.id}:track`;
        const path = handConsoleNode(id, 'path', 'hand-console-track');
        const d = handTrackPath(handle.track);
        if (path.getAttribute('d') !== d) path.setAttribute('d', d);
        wanted.add(id);
      }
    }
    for (const [id, node] of handConsoleNodes) node.style.display = wanted.has(id) ? '' : 'none';
    return wanted.size;
  }

  /* ── The drawing picker (docs/HAND_STYLES.md) ────────────────────────────
   *
   * A hand made of drawings has no fingers to curl and no facing to slide: it
   * **is** one of a handful of pictures, and the quickest way to say which is
   * to show them. So the poses go in a column beside the face, on the hand's
   * own side, and the views in a row under it -- every cell holding the
   * drawing it selects, drawn by the generator that drew the hand.
   *
   * Same split as the console: the picture is SVG in the artwork's own
   * coordinates, so it follows a zoom and a pan without being told, and the
   * press is an HTML button over it. A press goes through `puppet.onChange`,
   * which is what makes picking a hand key with Auto Key on and land in an
   * expression while one is being shaped -- without this knowing either.
   */
  const handPickerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  handPickerLayer.setAttribute('data-hand-picker-layer', '');
  handPickerLayer.setAttribute('pointer-events', 'none');
  handPickerLayer.style.display = 'none';
  draw.node.append(handPickerLayer);
  /** One group and one button per cell, built once and moved. */
  const handPickerCells = new Map();

  function handPickerCell(cell) {
    let entry = handPickerCells.get(cell.id);
    if (!entry) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'hand-pick');
      const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      frame.setAttribute('class', 'hand-pick-frame');
      frame.setAttribute('vector-effect', 'non-scaling-stroke');
      const art = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      art.setAttribute('class', 'hand-pick-art');
      group.append(frame, art);
      handPickerLayer.append(group);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hand-pick-hit';
      button.dataset.handPick = cell.id;
      button.hidden = true;
      // The button is invisible, so the cell under it is what answers a
      // pointer: without this a picker gives no sign it can be pressed.
      button.addEventListener('pointerenter', () => { group.dataset.hover = 'true'; });
      button.addEventListener('pointerleave', () => { group.dataset.hover = 'false'; });
      container.append(button);
      entry = { group, frame, art, button, drawn: '' };
      handPickerCells.set(cell.id, entry);
    }
    return entry;
  }

  /** Which hands are offering a picker, given what the preview is showing. */
  const handPickers = () => (puppet?.visible && store.getDocument().svgMarkup
    ? handPickerOverlay(store.getDocument(), puppet.getValues?.() || {})
    : []);

  function renderHandPicker() {
    const pickers = handPickers();
    const matrix = pickers.length ? artworkMatrix() : null;
    const place = matrix ? artworkPlacer(container.getBoundingClientRect()) : null;
    if (!matrix || !place) {
      handPickerLayer.style.display = 'none';
      for (const entry of handPickerCells.values()) entry.button.hidden = true;
      return 0;
    }
    // A rebuild appends the artwork after this layer, which would leave the
    // picker drawn underneath the hand it is about.
    draw.node.append(handPickerLayer);
    handPickerLayer.style.display = '';
    handPickerLayer.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    const wanted = new Set();
    for (const picker of pickers) {
      for (const cell of picker.cells) {
        const entry = handPickerCell(cell);
        const { x, y, size } = cell.cell;
        const half = size / 2;
        entry.frame.setAttribute('x', round2(x - half));
        entry.frame.setAttribute('y', round2(y - half));
        entry.frame.setAttribute('width', round2(size));
        entry.frame.setAttribute('height', round2(size));
        entry.frame.setAttribute('rx', round2(size * 0.18));
        // The drawing only changes when the choice it stands for does: a
        // column redrawn every frame is a column of paths reparsed every frame.
        const key = `${cell.side}/${cell.style}/${round2(size)}`;
        if (entry.drawn !== key) {
          entry.art.innerHTML = handStyleThumbnail(cell.side, cell.style, { at: { x, y }, size: size * 0.82, look: installedHandLook(store.getDocument()) });
          entry.drawn = key;
        }
        entry.group.dataset.active = String(Boolean(cell.active));
        entry.group.dataset.disabled = String(Boolean(cell.disabled));
        entry.group.dataset.offer = String(Boolean(cell.offer));
        const at = place({ x, y });
        entry.button.hidden = false;
        entry.button.style.left = `${at.x}px`;
        entry.button.style.top = `${at.y}px`;
        entry.button.setAttribute('aria-pressed', String(Boolean(cell.active)));
        entry.button.disabled = Boolean(cell.disabled);
        entry.button.setAttribute('aria-label', cell.label);
        entry.button.title = cell.hint;
        wanted.add(cell.id);
      }
    }
    for (const [id, entry] of handPickerCells) {
      const shown = wanted.has(id);
      entry.group.style.display = shown ? '' : 'none';
      if (!shown) entry.button.hidden = true;
    }
    return wanted.size;
  }

  const round2 = (value) => Math.round(Number(value) * 100) / 100;

  /**
   * One press, one hand.
   *
   * A pose the hand already draws is a value: `onChange` is the console's own
   * channel, so it keys with Auto Key on and lands in an expression exactly as
   * a drag on a slider does. A picture it does not draw yet is an **offer** --
   * the drawing is made first, in one undo step, and the value written after
   * -- so "use this hand" is one press either way, which is the point.
   */
  container.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-hand-pick]');
    if (!button || button.disabled) return;
    const find = () => handPickers().flatMap((picker) => picker.cells).find((item) => item.id === button.dataset.handPick);
    const cell = find();
    const offer = handPickerOffer(cell);
    if (offer) {
      if (!handPickerAdd?.(offer.side, offer.style)) return;
      // The set has changed, so the cell has: it is a choice now, with an index.
      const change = handPickerChange(find());
      if (change) puppet?.onChange?.(change, { commit: true });
      renderHandPicker();
      return;
    }
    const change = handPickerChange(cell);
    if (!change) return;
    puppet?.onChange?.(change, { commit: true });
    renderHandPicker();
  });

  /** How a picture that is not drawn yet gets drawn. Supplied by the app. */
  let handPickerAdd = null;

  // The picker is document geometry and live values at once, so it follows
  // both: a pose written from the panel lights the cell it belongs to.
  store.subscribeDocument?.('hands', () => renderHandPicker());

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

  /**
   * What a handle is called and what it looks like.
   *
   * Both are the author's (docs/DIRECT_CONTROLS.md), so they are written from
   * the record every time it is handed over -- not once, when the button was
   * made.
   */
  function dressHandle(entry) {
    const { button, handle } = entry;
    // How big it is and what it is a picture of are both the widget's, so both
    // are forgotten here and worked out again on the next placement pass.
    entry.hit = 0; entry.glyph = null;
    button.setAttribute('aria-label', `${handle.label}. ${handle.hint}. Arrow keys adjust, Home resets.`);
    button.title = handle.hint;
    if (!handle.widget) return;
    button.dataset.handleShape = handle.widget.shape;
    button.dataset.handleSize = handle.widget.size;
    button.dataset.handleColour = handle.widget.colour;
    // The kind of control this is, so a target reads as a target and a ring as
    // a ring on the mascot too (docs/FACE_CONTROL_RIG.md).
    button.dataset.handleController = handle.widget.controller || '';
    // And whether the two sides it belongs to are moving together (CR-10).
    button.toggleAttribute('data-handle-linked', Boolean(handle.linked));
    // Which slot of a hand's console this is, if any: the rim, the row under
    // it, or the one beside the face that brings the hand out.
    if (handle.slot) button.dataset.handleSlot = handle.slot; else delete button.dataset.handleSlot;
  }

  /**
   * A member of a group nobody has opened is not on screen.
   *
   * A hand's console is the exception: its sliders are laid out on a ring
   * around the hand rather than piled on top of it, so they are legible
   * already and there is nothing to unfold (`core/puppet/hand-console.js`).
   */
  const folded = (handle) => Boolean(handle?.group) && !handle.track && !puppet?.expanded?.has(handle.group);

  /**
   * Whether a control's own condition is met.
   *
   * A hand resting behind the head has nothing to pose, so its console is not
   * drawn at all -- only the slider that brings it out. The condition is the
   * handle's, so nothing here has to know what a hand is.
   */
  function conditionMet(handle, values) {
    const needs = handle?.needs;
    if (!needs?.control) return true;
    const value = Number(values?.[needs.control]);
    return Number.isFinite(value) && value > Number(needs.above ?? 0);
  }

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

  /**
   * How much room a control takes on screen, which is pixels whatever the zoom.
   *
   * Measured rather than assumed: the stylesheet decides how wide a control
   * ends up and a layout that guessed would pack a rig the browser then drew
   * differently. A control's size only changes when it is dressed again, so it
   * is measured once and remembered; the sizes below are the stylesheet's own
   * and are read only before a control has ever been laid out.
   */
  const HANDLE_HIT = Object.freeze({ small: 19, normal: 26, large: 32 });
  /** The opener's own width, how high it rides, and the air it keeps. */
  const EXPANDER_WIDTH = 15;
  const EXPANDER_LIFT = -15;
  const EXPANDER_GAP = 2;
  /**
   * Where the opener sits, on a control of *this* size.
   *
   * It used to be a constant 19px to the right, which put a 15px badge's left
   * edge at +11.5 on a 26px control whose own hit area reaches +13 — so the
   * two overlapped by a pixel and a half, and since the badge sits above it in
   * the stack, that sliver of the control could not be pressed. Derived from
   * the measured control instead, so the three sizes the stylesheet draws
   * (19, 26, 32) each clear their own badge by the same air.
   *
   * Only the horizontal separation is made: the badge still rides the shoulder,
   * overlapping the control's rows but never its columns, which is what keeps
   * it reading as part of the control rather than as a second one beside it.
   */
  const openerAt = (box) => ({ x: box.width / 2 + EXPANDER_WIDTH / 2 + EXPANDER_GAP, y: EXPANDER_LIFT });
  function handleBox(entry) {
    if (!entry.hit) {
      const measured = { width: entry.button.offsetWidth, height: entry.button.offsetHeight };
      // A button the browser has not laid out yet measures nothing, so the
      // stylesheet's own widths stand in — and nothing is remembered until
      // there is a real measurement to remember.
      if (!measured.width) {
        const side = HANDLE_HIT[entry.handle.widget?.size] || HANDLE_HIT.normal;
        return { width: side, height: side };
      }
      entry.hit = measured;
    }
    return entry.hit;
  }

  /**
   * And how much room it takes *with its opener*, which rides its shoulder.
   *
   * The **+** is part of the control it opens rather than a control of its
   * own: it belongs against it, and packing the two apart would only push a
   * badge off the thing it is a badge on. So the control is given the room
   * they take together, and nothing else is packed into it. Symmetric about
   * the control, because that is what a box handed to the packing is — which
   * reserves a little air on the side the opener is not on, and a little air
   * beside a control is not a fault.
   */
  const withOpener = (box) => {
    const at = openerAt(box);
    return {
      width: Math.max(box.width, 2 * (at.x + EXPANDER_WIDTH / 2)),
      height: Math.max(box.height, 2 * (Math.abs(at.y) + EXPANDER_WIDTH / 2))
    };
  };

  /**
   * Where one control would like to be, and whether it may be moved off it.
   *
   * A control whose position *is* the value it reports is **fixed**: a knob on
   * a hand's console sits where the movement is set to, and a control on a
   * named point sits on the fingertip it names. Everything else asks for a
   * spot on the artwork it moves and is free to be nudged clear of its
   * neighbours (`core/puppet/control-packing.js`).
   */
  function puppetWanted(entry, { box, onCanvas, values }) {
    const handle = entry.handle;
    if (folded(handle)) return null;
    if (handle.needs && !conditionMet(handle, values())) return null;
    if (handle.track) {
      if (!onCanvas) return null;
      const axis = handle.x || handle.y;
      return { ...onCanvas(handTrackPoint(handle.track, handTrackAt(axis, values()[axis?.control]))), fixed: true };
    }
    // A handle may name a point in the artwork's own coordinates rather than
    // a corner of a box: a fingertip is not a corner of the hand.
    if (handle.point) {
      const node = documentModel.getNode(handle.anchor);
      const ctm = node?.getScreenCTM?.();
      if (!ctm) return null;
      const { x, y } = handle.point;
      return { x: ctm.a * x + ctm.c * y + ctm.e - box.left, y: ctm.b * x + ctm.d * y + ctm.f - box.top, fixed: true };
    }
    // A handle moves both eyes or both brows, so it sits between them
    // rather than on one side of the face.
    const rects = (handle.elements || [handle.anchor])
      .map((id) => visibleRect(documentModel.getNode(id)))
      .filter((item) => item && item.width);
    if (!rects.length) return null;
    const left = Math.min(...rects.map((item) => item.x)), top = Math.min(...rects.map((item) => item.y));
    const rect = {
      x: left - box.left, y: top - box.top,
      width: Math.max(...rects.map((item) => item.x + item.width)) - left,
      height: Math.max(...rects.map((item) => item.y + item.height)) - top
    };
    // `at` is where on its own artwork a control belongs -- the gaze in the
    // middle of the pupils, the eyelid's on top of the eye, the head's above
    // the face where a puppeteer would hold it -- plus whatever the author
    // nudged it by. Whether it can *stay* there is the packing's business.
    return { ...controlSpot(rect, handle.at, handle.offset), fixed: false };
  }

  /**
   * The control's own picture, posed by what it is set to right now (V3-14).
   *
   * Rebuilt only when the pose it draws has visibly changed: placement runs on
   * every frame of every drag, and a picture rewritten every frame is a set of
   * paths reparsed every frame.
   */
  function drawHandleGlyph(entry, values) {
    const glyph = handleGlyph(entry.handle, values);
    const key = glyph ? `${glyph.kind}/${glyph.controller}/${Math.round(glyph.x * 12)}/${Math.round(glyph.y * 12)}/${Math.round(glyph.orbit * 12)}` : '';
    if (entry.glyph === key) return;
    entry.glyph = key;
    entry.button.innerHTML = renderPartGlyph(glyph);
    entry.button.toggleAttribute('data-handle-glyph', Boolean(key));
  }

  /**
   * Where the handles sit: on the artwork they move, and never on each other.
   *
   * Measure, pack, write — in that order and once each. Where a control wants
   * to be is read off the artwork, where it *goes* is decided with every other
   * control in hand, and only then is anything written. Deciding one control
   * at a time is what made overlap possible in the first place: a spot is only
   * free relative to the controls already on screen, and the loop could not
   * see them. It also asked the browser to lay the page out once per control.
   */
  function placePuppetHandles() {
    if (!puppet || !puppet.visible) return;
    const box = container.getBoundingClientRect();
    // Only a console and the controls' own pictures need to know what the
    // movements are set to, so a project with neither never asks: placing runs
    // every frame of every drag.
    let live = null;
    const values = () => (live ||= puppet.getValues());
    const onCanvas = artworkPlacer(box);

    // Every measurement first, and no write among them: a style written in the
    // middle of a run of measurements makes the browser lay the page out again
    // before the next one.
    const measured = puppet.handles.map((entry) => ({ entry, at: puppetWanted(entry, { box, onCanvas, values }) }));
    for (const { entry, at } of measured) entry.button.hidden = !at;
    const showing = measured.filter((item) => item.at);
    // Sized only once every control that will be on screen is on screen: a
    // hidden button measures zero.
    const opens = new Set(puppet.expanders.map((expander) => expander.id));
    const controls = showing.map(({ entry, at }) => ({
      id: entry.handle.id, x: at.x, y: at.y,
      ...(opens.has(entry.handle.id) ? withOpener(handleBox(entry)) : handleBox(entry)),
      // The one under the pointer never moves either: a control that slid out
      // from under a drag would be a control that could not be dragged.
      fixed: at.fixed || puppet.dragging?.entry === entry
    }));
    const placed = packControls(controls);
    showing.forEach(({ entry }, index) => {
      entry.button.style.left = `${placed[index].x}px`;
      entry.button.style.top = `${placed[index].y}px`;
      drawHandleGlyph(entry, values());
    });

    // The opener rides its own control's shoulder, wherever that landed. The
    // room it needs was reserved above, so it lands on nobody else.
    for (const expander of puppet.expanders) {
      const index = showing.findIndex(({ entry }) => entry.handle.id === expander.id);
      expander.button.hidden = index < 0;
      if (index < 0) continue;
      const at = openerAt(handleBox(showing[index].entry));
      expander.button.style.left = `${placed[index].x + at.x}px`;
      expander.button.style.top = `${placed[index].y + at.y}px`;
    }

    // Everything that is drawn *from* where a control ended up, once it has.
    for (const { entry } of showing) {
      if (entry.handle.grid) renderPuppetHalo(entry);
      if (entry.handle.reach && !entry.handle.ring) renderPuppetReach(entry);
    }
    renderHandConsole();
    renderHandPicker();
    placePuppetCages(box);
  }

  /**
   * The cages: a frame around the controls of one part of the face (CR-06).
   *
   * The roadmap draws the eye rig as a pair of glasses, and that is exactly
   * what this is — a frame that says *these controls are the eyes*, so a face
   * carrying twenty dots reads as four things to pose instead of twenty things
   * to hunt for.
   *
   * It is an **editor overlay** and never artwork: it is measured from where
   * the handles ended up, so it follows the mascot through a turn, a zoom and a
   * pose without knowing anything about any of them (docs/FACE_CONTROL_RIG.md).
   */
  function placePuppetCages(box) {
    if (!puppet) return;
    const bounds = new Map();
    for (const entry of puppet.handles) {
      const group = entry.handle.visualParent;
      // A console draws its own ring, which says "these are the hand's"
      // better than a dashed box drawn around the ring would.
      if (!group || entry.button.hidden || entry.handle.console) continue;
      const left = Number.parseFloat(entry.button.style.left), top = Number.parseFloat(entry.button.style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) continue;
      const current = bounds.get(group) || { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      bounds.set(group, {
        left: Math.min(current.left, left), top: Math.min(current.top, top),
        right: Math.max(current.right, left), bottom: Math.max(current.bottom, top)
      });
    }
    for (const [id, node] of puppet.cages) {
      const rect = bounds.get(id);
      // A cage around one control is a box drawn around a dot: it says nothing
      // the dot did not already say, so it is not drawn at all.
      if (!rect || rect.right - rect.left + rect.bottom - rect.top < 12) { node.hidden = true; continue; }
      node.hidden = false;
      node.style.left = `${rect.left - CAGE_PADDING}px`;
      node.style.top = `${rect.top - CAGE_PADDING}px`;
      node.style.width = `${rect.right - rect.left + CAGE_PADDING * 2}px`;
      node.style.height = `${rect.bottom - rect.top + CAGE_PADDING * 2}px`;
    }
  }

  /** Clear of the handles it frames, so the frame never swallows a drag. */
  const CAGE_PADDING = 22;

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
    // A slider on a console runs sideways, upright or around a ring, so the
    // arrows move it *along its own track* rather than along the screen: right
    // and up raise it, left and down lower it, whichever way it happens to lie.
    if (entry.handle.track) {
      const axis = entry.handle.x || entry.handle.y;
      const along = handTrackDirection(entry.handle.track, handTrackAt(axis, start[axis?.control]));
      const travel = (step[0] || -step[1]) * amount * handTrackLength(entry.handle.track);
      puppetApply(entry, puppetDragValues(entry.handle, { dx: along.x * travel, dy: along.y * travel }, { start }), { commit: true });
      return;
    }
    const size = puppetSize(entry.handle);
    const span = Math.max(8, size * entry.handle.throw);
    puppetApply(entry, puppetDragValues(entry.handle, { dx: step[0] * amount * span, dy: step[1] * amount * span }, { start, size }), { commit: true });
  });

  function commitDocument(updateStore = true) {
    return previewOrder.authored(() => commitDocumentNow(updateStore));
  }
  function commitDocumentNow(updateStore = true) {
    const markup = documentModel.serialize();
    loadedMarkup = markup;
    if (updateStore) syncDocument({svgMarkup:markup,layers:documentModel.getTree(),layerMetadata:documentModel.metadata},{snapshot:false});
    return markup;
  }

  function refreshDocument(selectId = null) {
    return previewOrder.authored(() => refreshDocumentNow(selectId));
  }
  function refreshDocumentNow(selectId = null) {
    const svgRoot = rootGroup.node.querySelector('svg');
    const tree = documentModel.load(svgRoot, documentModel.metadata);
    applyEditScope();
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
    syncDocument({layers:state.layers,layerMetadata:state.layerMetadata,elements:state.elements,svgMarkup:state.svgMarkup},{snapshot:false,domains:removed?['artwork','layers','semanticRig','keyforms','hands']:undefined});
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
    const matrix = artworkMatrix();
    const inverse = matrix && invertMatrix(matrix);
    const screen = draw.node.getScreenCTM?.();
    if (!inverse || !screen) return null;
    // Client → the outer svg (its own CTM is a plain HTML-to-SVG offset that
    // every browser agrees on) → the artwork, through the computed matrix.
    const point = draw.node.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const outer = point.matrixTransform(screen.inverse());
    const local = applyMatrix(inverse, { x: outer.x, y: outer.y });
    if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
    // Two decimals: half a unit was eight screen pixels at the deepest zoom.
    const round = (value) => Math.round(value * 100) / 100;
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
  const drawNode = (spec) => {
    const node = document.createElementNS(SVG_NS, spec.name);
    for (const [key, value] of Object.entries(spec.attrs)) if (value !== undefined && value !== null) node.setAttribute(key, value);
    if (spec.text !== undefined) node.textContent = spec.text;
    return node;
  };

  /** What is being drawn, and the handles of the point being placed, as chrome. */
  function renderDrawPreview(spec) {
    while (drawLayer.firstChild) drawLayer.firstChild.remove();
    if (!spec) return;
    syncDrawLayer();
    const node = drawNode(spec);
    node.setAttribute('opacity', '.75');
    node.setAttribute('class', 'draw-preview');
    drawLayer.append(node);
    for (const guide of spec.guides || []) {
      const chrome = drawNode(guide);
      chrome.setAttribute('vector-effect', 'non-scaling-stroke');
      drawLayer.append(chrome);
    }
  }

  let createdHandler = () => {};

  /** Turn the preview into artwork, select it, and go back to Select. */
  function commitDrawing(spec) {
    const svgRoot = rootGroup.node.querySelector('svg');
    renderDrawPreview(null);
    if (!spec || !svgRoot) return null;
    history.snapshot();
    const node = drawNode(spec);
    node.setAttribute('data-name', spec.label);
    // Inside the edit scope when the scope is a group; next to a piece that has
    // no inside, where the scope would only dim it, so the scope ends there.
    const scope = scopeNode();
    const parent = scope?.localName === 'g' ? scope : scope?.parentNode || svgRoot;
    parent.appendChild(node);
    if (scope && parent !== scope) setEditScope(null);
    refreshDocument();
    const id = node.getAttribute('id');
    store.mutateSession('selectedId', (state) => { state.selectedId = id; });
    // A tool you have to leave by hand is a tool that draws when you meant to
    // select: one shape, then straight back to Select with it selected.
    api.setTool('select');
    toolChangeHandler('select');
    // Say when the new shape reaches past the working area, which cuts it.
    const box = readArtboard(store.getDocument().svgMarkup || '');
    const bounds = safeBBox(node);
    const overflow = bounds && (bounds.x < box.x || bounds.y < box.y || bounds.x + bounds.width > box.x + box.width || bounds.y + bounds.height > box.y + box.height);
    createdHandler(id, spec.name, { overflow: Boolean(overflow) });
    return id;
  }

  const drawTools = createDrawTools({
    point: artworkPoint,
    preview: renderDrawPreview,
    commit: commitDrawing,
    options: () => drawOptions,
    snap: snapIfOn,
    // "The same point" is about eight screen pixels, whatever the zoom.
    tolerance: () => 8 / matrixScale(artworkMatrix() || IDENTITY)
  });
  const cancelDrawing = () => drawTools.cancel();

  container.addEventListener('pointerdown', (event) => {
    if (workspace !== 'create' || !DRAW_TOOLS.includes(activeTool) || event.button !== 0 || onCanvasChrome(event)) return;
    if (!drawTools.pointerDown(event, activeTool)) return;
    event.preventDefault();
    if (activeTool !== 'text') container.setPointerCapture?.(event.pointerId);
  });

  container.addEventListener('pointermove', (event) => {
    if (!drawTools.isDrawing()) return;
    drawTools.pointerMove(event);
  });

  container.addEventListener('pointerup', (event) => {
    if (!drawTools.isDrawing()) return;
    if (activeTool !== 'pen') container.releasePointerCapture?.(event.pointerId);
    drawTools.pointerUp(event);
  });

  /**
   * Alt+click, caught before the gizmo (audit §5).
   *
   * Once something is selected its overlay covers the artwork, so a listener on
   * the artwork never sees the press: the gizmo takes it as a drag on the body.
   * This runs in the capture phase on the container, which is the only place
   * ahead of it.
   */
  container.addEventListener('click', (event) => {
    if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
    // A piece model is not required: `clickTargetOf` answers with the element
    // itself where there is none, so the stack is the shapes under the pointer.
    // It *was* required, which quietly turned the gesture off in the vector
    // editor -- the one surface with things drawn over each other on purpose --
    // and left it working only where a piece model happened to be installed
    // (V5-07, where the last such surface but Hands went).
    if (activeTool !== 'select' || rigTool || !editing()) return;
    const next = behind(event);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectOnly(next)); });
  }, true);

  /**
   * Double-click steps inside a piece (audit §2.1).
   *
   * One click selects the eye; two select the shape under the pointer and stay
   * there, so the next click reaches its neighbours rather than jumping back
   * out. Clicking anything outside leaves again, and so does Escape. This is
   * the pattern every drawing tool has had for thirty years, and the reason it
   * is worth having is that a click can then mean the obvious thing.
   */
  container.addEventListener('dblclick', (event) => {
    if (!pieces?.resolve || activeTool !== 'select' || rigTool || !editing()) return;
    const deep = elementUnder(event);
    if (!deep) return;
    const root = pieces.resolve(deep) || deep;
    if (root === deep) return;
    insidePiece = root;
    event.preventDefault();
    store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectOnly(deep)); });
  });

  container.addEventListener('dblclick', (event) => {
    // A double-click on the outline is how a point is added, which is what the
    // Node tool was missing: it could move the points a shape already had and
    // nothing else.
    if (nodeEdit && !event.target.closest?.('[data-path-node],[data-path-control]')) {
      const point = artworkPoint(event);
      if (point && insertNodeNear(point)) { event.preventDefault(); return; }
    }
    // Belt and braces: leaving Artwork already cancels a pen run, and a run
    // that outlived it must not be able to author artwork from Preview.
    if (!drawTools.isDrawing() || workspace !== 'create') return;
    event.preventDefault();
    drawTools.doubleClick();
  });

  draw.on('click', (event) => {
    if (marquee.consumeClick()) return;
    // A pin being placed on a chosen piece goes where the click was, even on
    // empty canvas: a thin eyelid is hard to hit, and the point is the same.
    if (rigTool?.kind === 'pin-place' && rigTool.target) { const tool = rigTool, point = artworkPoint(event); if (point) { api.cancelRigTool(false); tool.place(tool.target, point); } return; }
    store.mutateSession(['selectedId', 'selectedIds'], state => { Object.assign(state, selectOnly(null)); });
  });
  // One visible mode instruction for Canvas pick tools. It is transient UI only.
  const modeBanner = () => {
    let node = container.querySelector('.canvas-mode-banner');
    if (!node) {
      node = document.createElement('div'); node.className = 'canvas-mode-banner'; node.setAttribute('role', 'status'); node.hidden = true;
      node.innerHTML = '<span data-canvas-mode-text></span><button type="button" data-canvas-mode-capture hidden>Capture</button><button type="button" class="secondary" data-canvas-mode-cancel>Cancel (Esc)</button>';
      node.querySelector('[data-canvas-mode-cancel]').onclick = () => api.cancelRigTool();
      node.querySelector('[data-canvas-mode-capture]').onclick = () => modeCapture?.();
      (container.querySelector('.canvas-tools') || container).append(node);
    }
    return node;
  };
  let modeCapture = null;
  let modeTimer = null;
  const showMode = (text, capture = null, { transient = false } = {}) => {
    const node = modeBanner();
    node.querySelector('[data-canvas-mode-text]').textContent = text;
    modeCapture = capture;
    node.querySelector('[data-canvas-mode-capture]').hidden = !capture;
    // A note about what just happened has nothing to cancel: it shows on its
    // own and leaves by itself. A mode (pick a part, pose it) keeps its Cancel.
    node.querySelector('[data-canvas-mode-cancel]').hidden = transient;
    node.dataset.transient = String(transient);
    node.hidden = false;
    clearTimeout(modeTimer);
    if (transient) modeTimer = setTimeout(() => { if (node.dataset.transient === 'true') node.hidden = true; }, 3200);
  };
  const hideMode = () => { clearTimeout(modeTimer); const node = container.querySelector('.canvas-mode-banner'); if (node) node.hidden = true; };
  /** A note, not a mode: shown for a moment, with nothing to cancel. */
  const showNote = (text) => showMode(text, null, { transient: true });
  /*
   * Everything the canvas draws for itself — the paper and the artboard edge,
   * the grid, the draw layer, the frames of a selection, the gizmo, the
   * handles — is measured against the container. A phone layout settles a
   * beat after the first render, a sidebar closes, a window is resized: the
   * artwork follows because the browser lays it out, and the chrome has to
   * follow by hand. The artboard edge used to sit where the first, smaller
   * layout had put it.
   */
  /**
   * Every layer drawn *over* the artwork, put back where the artwork now is.
   *
   * The artwork itself follows a changed layout because the browser lays it
   * out; the chrome is positioned by `artworkMatrix()` and has to follow by
   * hand. Two things move that matrix — the container being resized, and the
   * working area being resized — and only one of them used to do this.
   *
   * Resizing the working area called `renderFrame()` alone, so the edge and
   * the paper moved and every handle stayed where the mascot used to be: the
   * pins, the warp lattice, the puppet handles and the gizmo all left behind,
   * pointing at nothing. One function for both callers, so a layer added later
   * cannot be given to one and forgotten by the other.
   */
  function placeChrome() {
    if (!rootGroup?.node) return;
    renderFrame(); renderGuides(); syncDrawLayer(); renderMultiSelection(); gizmo.render(); placePuppetHandles();
    // The deformation overlays are placed by the same matrix, and the resize
    // observer was forgetting them too.
    renderWarp(); renderMesh(); renderPins(); renderHandRig();
    if (nodeEdit) { placeNodeHandles(); placeControlHandles(); }
  }

  /**
   * A canvas that changes size keeps looking at the same thing.
   *
   * The view is a matrix from the artwork into the container, so its
   * translation is measured from the container's top left. Narrow the
   * container and every artwork point stays where it was *relative to that
   * corner* — which means the mascot slides towards the right-hand edge and
   * off it, taking the puppet handles with it. On a 1280px window, the hand's
   * own slider ended up fourteen pixels behind the panel beside the canvas,
   * where nobody could reach it.
   *
   * Nothing noticed before because the columns were the same width on every
   * screen and the canvas never changed size except when the window did. It
   * now changes with the screen (`ui/panel-split.js`) and with every drag of a
   * boundary, so half the difference goes into the translation and whatever
   * was in the middle of the view stays in the middle of it.
   *
   * The zoom is deliberately untouched: an author working at 240% has chosen
   * that, and a re-fit on resize would throw it away every time they dragged a
   * column.
   */
  let canvasSize = { width: container.clientWidth, height: container.clientHeight };
  function keepViewCentred() {
    const width = container.clientWidth, height = container.clientHeight;
    const dw = width - canvasSize.width, dh = height - canvasSize.height;
    canvasSize = { width, height };
    if ((!dw && !dh) || !width || !height) return;
    // A view that is a framing is re-framed rather than slid: the pieces it
    // was asked to show should still fill the new size, not sit half outside
    // it. This is what a dragged column boundary does to a framed hand.
    if (framing) { api.frameElements(framing.ids, framing.padding); return; }
    const view = viewTransform();
    setView({ scale: view.scale, x: view.x + dw / 2, y: view.y + dh / 2 });
  }

  if (typeof ResizeObserver !== 'undefined') {
    let resizeFrame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      // `setView` places the chrome itself, so a resize that moved the view
      // does not place it twice.
      resizeFrame = requestAnimationFrame(() => { const before = viewTransform(); keepViewCentred(); if (viewTransform().x === before.x && viewTransform().y === before.y) placeChrome(); });
    }).observe(container);
  }

  const api = {
    /** Told when the canvas changes tool on its own, so the toolbar can follow. */
    onToolChange(handler) { toolChangeHandler = typeof handler === 'function' ? handler : () => {}; },
    /** Limit the visible edit to one piece (`Isolate`, ui/piece-actions.js); null lifts it. */
    setEditScope(id) { return setEditScope(id); },
    getEditScope() { return editScope; },
    onEditScopeChange(handler) { editScopeHandler = typeof handler === 'function' ? handler : () => {}; },
    /** Told whenever the view (zoom, pan) changes, so the zoom readout can follow the wheel too. */
    onViewChange(handler) { viewChangeHandler = typeof handler === 'function' ? handler : () => {}; },
    /** Abandon a shape being drawn. Returns whether there was one. */
    cancelDrawing() { return cancelDrawing(); },
    /** Whether a shape is being drawn right now (a pen run counts). */
    isDrawing() { return drawTools.isDrawing(); },
    /** Close a pen run from the keyboard. Returns whether it made a shape. */
    finishDrawing() { return Boolean(drawTools.finish()); },
    /** Enter finishes a pen run, Backspace takes its last point back. Returns whether the key was used. */
    handleDrawKey(event) { return drawTools.keyDown(event); },
    /** What is being drawn, for the browser tests. */
    drawingState() { return drawTools.state(); },
    /** Fill, stroke, sides, grid… for the tools and the frame (`ui/tool-options.js`). */
    setDrawOptions(next) { drawOptions = { ...drawOptions, ...(next || {}) }; renderFrame(); return drawOptions; },
    getDrawOptions() { return { ...drawOptions }; },
    /** Told when a shape or a text has just been drawn, with whether it reaches past the working area. */
    onArtworkCreated(handler) { createdHandler = typeof handler === 'function' ? handler : () => {}; },
    /** The Node tool's point operations, for the options bar. */
    focusedNode() { return focusedNodeInfo(); },
    onNodeFocus(handler) { nodeFocusHandler = typeof handler === 'function' ? handler : () => {}; },
    convertFocusedNode(kind) { return convertFocusedNode(kind); },
    deleteFocusedNode() { return nodeEdit?.focus != null ? deleteNodeAt(nodeEdit.focus) : false; },
    /**
     * Put a pin where the next click lands (docs/FACE_CONTROL_RIG.md §9).
     * `target` narrows it to one piece; without one, any path will do. The
     * point is handed over in the artwork's own units, the same the pins keep.
     */
    beginPinPlacement({ target = null, label = null, place, cancel = () => {} } = {}) {
      this.cancelRigTool();
      rigTool = { kind: 'pin-place', target, label, place, cancel };
      container.classList.add('rig-pin-placing');
      container.setAttribute('aria-label', 'Click the artwork where the pin goes. Press Escape to cancel.');
      showMode(target ? `Click ${label || target} where the pin goes. Esc cancels.` : 'Click a path where the pin goes. Esc cancels.');
      return true;
    },
    /** A client point in the artwork's own units, for a pin placed from a menu. */
    artworkPointAt(clientX, clientY) { return artworkPoint({ clientX, clientY }); },
    /** What the element is: path, rect, g … */
    elementKind(id) { return documentModel.getNode(id)?.localName || null; },
    /**
     * The fill and stroke of a piece and of every piece drawn inside it.
     *
     * The Character Builder recolours a part by colour rather than by layer
     * (docs/CHARACTER_BUILDER.md): "the hair" is one swatch whatever number
     * of shapes draw it. Read from the artwork itself -- the inline style
     * first, because an imported drawing paints that way -- and never from
     * svg.js's defaults, which answer black for a shape that has no fill.
     */
    describePaints(id = null) {
      // No id: every piece of the mascot, for the palette (docs/FACE_PART_LIBRARY.md, "Palette tokens").
      const root = id ? documentModel.getNode(id) : rootGroup.node.querySelector('svg');
      if (!root) return [];
      const elements = store.getDocument().elements || {};
      const paint = (node, name) => String(node.style?.getPropertyValue?.(name) || node.getAttribute?.(name) || '').trim();
      return [root, ...(root.querySelectorAll?.('[id]') || [])]
        .filter((node) => elements[node.getAttribute('id')])
        .map((node) => ({ id: node.getAttribute('id'), fill: paint(node, 'fill'), stroke: paint(node, 'stroke') }));
    },
    /** The authored outline of a path — what a pin, a warp or a shape key holds — or null for anything else. */
    authoredPath(id) {
      const node = documentModel.getNode(id);
      if (node?.localName !== 'path') return null;
      return documentModel.authorAttributes.get(id)?.d ?? node.getAttribute('d');
    },
    /**
     * A rectangle, circle, ellipse, line or polygon becomes the path it draws,
     * keeping its id, its name, its paint and its transform. Everything that
     * reshapes artwork works on a path's points, and these have none.
     */
    convertToPath(id) { return previewOrder.authored(() => api.convertToPathNow(id)); },
    convertToPathNow(id) {
      const node = documentModel.getNode(id);
      const kind = node?.localName;
      const geometry = SHAPE_GEOMETRY_ATTRIBUTES[kind];
      if (!node || !geometry) return { ok: false, message: 'Only a rectangle, a circle, an ellipse, a line or a polygon becomes a path.' };
      const attrs = {};
      for (const attribute of node.attributes) attrs[attribute.name] = attribute.value;
      const d = shapeToPath(kind, attrs);
      if (!d) return { ok: false, message: 'This shape has no outline to turn into a path.' };
      history.snapshot();
      const path = document.createElementNS(SVG_NS, 'path');
      for (const attribute of node.attributes) if (!geometry.includes(attribute.name)) path.setAttribute(attribute.name, attribute.value);
      path.setAttribute('d', d);
      node.replaceWith(path);
      refreshDocument(store.getSession().selectedId);
      commands.updateElement(id, 'convert-to-path', (element) => { element.meta = { ...(element.meta || {}), nodeType: 'path' }; }, { snapshot: false, source: 'canvas' });
      documentModel.captureAuthoringNode(id);
      commitDocument();
      showSelection(store.getSession().selectedId, store.getSession().selectedIds);
      return { ok: true, d };
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
    captureTransformPose(){if(rigTool?.kind!=='transform-pose')return null;hideMode();const current=rigTool;const poses=Object.fromEntries(current.ids.map(id=>[id,posedTransform(id,current)]));restoreRigNodes(current);rigTool=null;container.classList.remove('rig-transform-pose');container.removeAttribute('aria-label');current.ids.forEach(id=>wrapperFor(id)?.selectize(false).draggable(false));showSelection(store.getSession().selectedId, store.getSession().selectedIds);return poses;},
    beginMorphPose(id,initialPath,{cancel,instruction,capture}={}){
      this.cancelRigTool();const element=wrapperFor(id);if(element?.type!=='path')return false;
      showMode(instruction||'Move the path nodes into the target shape, then press Capture.',capture||null);
      const basePath=element.attr('d'),candidate=initialPath||basePath;element.attr('d',candidate);
      const numbers=[...candidate.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)];const handles=[];
      for(let i=0;i+1<numbers.length;i+=2){const point=draw.node.createSVGPoint();point.x=Number(numbers[i][0]);point.y=Number(numbers[i+1][0]);const screen=point.matrixTransform(element.node.getScreenCTM());const box=container.getBoundingClientRect(),handle=document.createElement('button');handle.type='button';handle.className='rig-node-handle';handle.setAttribute('aria-label',`Path node ${i/2+1}`);handle.style.left=`${screen.x-box.left}px`;handle.style.top=`${screen.y-box.top}px`;container.append(handle);handles.push({handle,xIndex:i,yIndex:i+1});handle.onpointerdown=e=>{if(e.button===0)handle.setPointerCapture(e.pointerId);};handle.onpointermove=e=>{if(!handle.hasPointerCapture(e.pointerId))return;const p=draw.node.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const local=p.matrixTransform(element.node.getScreenCTM().inverse());const values=[...element.attr('d').matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)];const replacements=new Map([[i,local.x],[i+1,local.y]]);let cursor=0,index=0,next='';for(const match of values){next+=element.attr('d').slice(cursor,match.index)+(replacements.has(index)?Number(replacements.get(index).toFixed(3)):match[0]);cursor=match.index+match[0].length;index++;}next+=element.attr('d').slice(cursor);element.attr('d',next);const b=container.getBoundingClientRect();handle.style.left=`${e.clientX-b.left}px`;handle.style.top=`${e.clientY-b.top}px`;};}
      rigTool={kind:'morph-pose',id,baseAttributes:{[id]:{d:basePath}},handles,cancel};container.classList.add('rig-morph-pose');container.setAttribute('aria-label','Morph endpoint editing. Topology is locked.');return true;
    },
    captureMorphPose(){if(rigTool?.kind!=='morph-pose')return null;hideMode();const current=rigTool,path=wrapperFor(current.id).attr('d');restoreRigNodes(current);current.handles.forEach(({handle})=>handle.remove());rigTool=null;container.classList.remove('rig-morph-pose');container.removeAttribute('aria-label');return path;},
    cancelRigTool(notify=true) { const current=rigTool;restoreRigNodes(current);rigTool=null;hideMode();container.classList.remove('rig-role-picking','rig-pin-placing','rig-pivot-editing','rig-transform-pose','rig-morph-pose');container.removeAttribute('aria-label');container.querySelectorAll('[data-rig-candidate]').forEach(node=>node.removeAttribute('data-rig-candidate'));current?.handle?.remove();current?.handles?.forEach(({handle})=>handle.remove());current?.ids?.forEach(id=>wrapperFor(id)?.selectize(false).draggable(false));if(notify)current?.cancel?.(); },
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
    /**
     * Point a picture at a different asset, keeping the node.
     *
     * The whole value of the raster model in one method: the id, the
     * transform, the pivot, the depth, the bindings and the place in the paint
     * order are all properties of the *node*, and none of them knows which
     * picture it draws. So replacing artwork is writing one attribute
     * (docs/V4_ROADMAP.md, V4-032).
     *
     * Writes the reference, never a resolved URL: repainting is
     * `refreshAssets`, and a blob written here would be captured as authored.
     * Returns the artwork for a command to write together with the asset
     * table, and touches neither the store nor the history itself.
     */
    replaceImageAsset(id, reference) { return previewOrder.authored(() => api.replaceImageAssetNow(id, reference)); },
    replaceImageAssetNow(id, reference) {
      const node = documentModel.getNode(id);
      if (!node || node.localName !== 'image') return false;
      const attribute = node.hasAttribute?.('xlink:href') && !node.hasAttribute?.('href') ? 'xlink:href' : 'href';
      // The reference goes where references live, and the href is emptied
      // rather than pointed at a scheme no browser can fetch. `refreshAssets`
      // fills it; until then the piece is blank, which is honest -- it is a
      // picture nothing has fetched yet.
      node.setAttribute('data-editor-asset', reference);
      node.setAttribute('data-editor-asset-missing', 'true');
      node.removeAttribute(attribute);
      documentModel.captureAuthoringAttribute(id, attribute);
      const elements = structuredClone(store.getDocument().elements);
      if (elements[id]) elements[id].meta = { ...(elements[id].meta || {}), assetRef: reference };
      loadedMarkup = documentModel.serialize();
      return { svgMarkup: loadedMarkup, elements };
    },
    /**
     * Turn a picture into a mesh, or a mesh back into a picture.
     *
     * The group keeps the piece's own id, so nothing above it changes: the rig
     * binds to it, the turn carries it, the depth sorts it and the layer list
     * names it, and none of them ever asked what was inside
     * (runtime/mesh-warp.js). What is inside is one clipped copy of the
     * picture per triangle.
     *
     * Returns the artwork for a command to write together with the mesh, and
     * touches neither the store nor the history: a deformation and the record
     * of it have to arrive and leave in one step, or an undo leaves a group
     * nothing knows how to edit.
     */
    setMesh(id, mesh) { return previewOrder.authored(() => api.setMeshNow(id, mesh)); },
    setMeshNow(id, mesh) {
      const node = documentModel.getNode(id);
      if (!node) return false;
      // A mesh bends a picture. Everything else already bends: a path has
      // points, and warps and shape keys are how it bends (docs/WARP_GRID.md).
      const current = node.localName === 'image' ? node : (node.localName === 'g' && node.hasAttribute('data-mesh') ? node.querySelector('image') : null);
      if (!current) return false;
      const reference = ['data-editor-asset', 'href', 'xlink:href'].map((name) => current.getAttribute(name)).find((value) => value && value.startsWith('asset:'));
      if (!reference) return false;
      const box = { x: Number(current.getAttribute('x')) || 0, y: Number(current.getAttribute('y')) || 0, width: Number(current.getAttribute('width')) || 0, height: Number(current.getAttribute('height')) || 0 };
      if (!(box.width > 0) || !(box.height > 0)) return false;

      const host = rootGroup.node.querySelector('svg');
      if (!host) return false;
      let defs = host.querySelector(':scope > defs');
      if (!defs) { defs = document.createElementNS(SVG_NS, 'defs'); host.prepend(defs); }

      const owner = node.localName === 'g' && node.hasAttribute('data-mesh') ? node : current;
      // Every attribute of the piece except the picture's own geometry: a
      // transform, an opacity, a name, a depth mark all belong to the piece
      // and have to survive becoming a group and stop being one.
      const carried = [...owner.attributes].filter((attribute) => !['id', 'href', 'xlink:href', 'x', 'y', 'width', 'height', 'preserveAspectRatio', 'data-mesh', 'data-editor-asset', 'data-editor-asset-missing'].includes(attribute.name));
      const attributes = carried.map((attribute) => `${attribute.name}="${String(attribute.value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join(' ');

      // Whatever this piece's clips were, they are about to be rewritten.
      for (const stale of [...defs.querySelectorAll(`[id^="mesh-${CSS.escape(id)}-"]`)]) stale.remove();

      let replacement;
      if (mesh) {
        const built = meshMarkup(mesh, { target: id, reference, box, attributes });
        if (!built.markup) return false;
        defs.insertAdjacentHTML('beforeend', built.defs);
        replacement = built.markup;
      } else {
        replacement = `<image id="${id}" href="${reference}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet"${attributes ? ` ${attributes}` : ''}/>`;
      }
      const template = document.createElementNS(SVG_NS, 'g');
      template.innerHTML = deferAssetReferences(sanitizeSvgMarkup(`<svg xmlns="${SVG_NS}">${replacement}</svg>`)).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      const built = template.firstElementChild;
      if (!built) return false;
      owner.replaceWith(built);
      paintAssets(host);
      refreshDocument(id);
      return { svgMarkup: documentModel.serialize(), elements: structuredClone(store.getDocument().elements) };
    },
    /**
     * A whole drag, written once.
     *
     * The deformation and the record of it go together, as they do when
     * bending is switched on: an undo that put the triangles back without the
     * mesh, or the mesh back without the triangles, would leave a piece
     * nothing can edit.
     */
    moveMeshPoints(target, points) {
      const before = store.getDocument();
      const mesh = (before.meshes || []).find((item) => item.target === target);
      if (!mesh) return false;
      const next = { ...mesh, points: points.map((point) => ({ x: point.x, y: point.y })) };
      history.snapshot();
      const artwork = api.setMeshNow(target, next);
      if (!artwork) return false;
      syncDocument({ ...artwork, meshes: (before.meshes || []).map((item) => (item.target === target ? next : item)) },
        { domains: ['artwork', 'keyforms'], source: 'mesh-drag', snapshot: false });
      renderMesh();
      return true;
    },
    /** Back to the grid it started as, in one step. */
    resetMesh(target) { return meshGesture.reset(target); },
    /** The sizes a mesh may be, for whoever is offering the choice. */
    meshSizes: () => [...MESH_PRESETS],
    restMeshFor: (id, size = DEFAULT_MESH_SIZE) => restMesh(id, size),
    /** The resolver every `asset:` reference is drawn through. One per editor. */
    setAssetResolver(resolver) { assetResolver = resolver; },
    /**
     * Fetch what the artwork points at, then point it at what was fetched.
     *
     * Split from loading because loading is synchronous and reading bytes is
     * not (`runtime/asset-resolver.js`). A caller that has changed which
     * assets the artwork uses awaits this; a caller that has not does not have
     * to, because the synchronous pass inside `loadSvgFromText` already drew
     * whatever was primed.
     */
    async refreshAssets() {
      const nodes = assetNodes();
      const references = collectAssetReferences(nodes);
      await assetResolver?.prime?.(references);
      // Nothing on the canvas points at them any more: stop holding a URL for
      // every picture that was ever here.
      assetResolver?.retain?.(references);
      return paintAssetReferences(nodes, assetResolver);
    },
    async loadSvgFromFile(file) { loadSvgText(await file.text()); },
    loadSvgFromText: loadSvgText,
    serializeCurrentSvg() { return commitDocument(false); },
    getTree() { return previewOrder.authored(() => documentModel.getTree()); },
    getWarnings() { return [...documentModel.warnings]; },
    /**
     * Teach the canvas what a piece is, on the surfaces that have them.
     *
     * `{ resolve, contains, commit }` — see the declaration of `pieces`. Passing
     * nothing takes it back to being a vector editor, which is what Artwork is.
     */
    setPieceModel(model) { pieces = model || null; insidePiece = null; },
    /** Which piece a double-click has stepped inside, if any. */
    insidePiece: () => insidePiece,
    /** Step back out; `true` if there was anywhere to come out of. */
    leavePiece() { if (!insidePiece) return false; insidePiece = null; return true; },
    /**
     * Every drawing under a point, deepest first (UX-50 PR 1).
     *
     * The *layers*, not the pieces: `piecesUnder` answers "which pieces are
     * here", which is what Alt+click cycles, and this answers "what is actually
     * stacked here" -- which is the question *Select inside…* is for. A menu
     * that could only offer the pieces would be a second Alt+click.
     *
     * Front to back, because that is the order they are on screen and the order
     * an author reads them in.
     */
    stackAt(clientX, clientY) {
      const elements = store.getDocument().elements || {};
      const names = store.getDocument().layerMetadata || {};
      const seen = new Set(), out = [];
      for (const hit of document.elementsFromPoint?.(clientX, clientY) || []) {
        if (!container.contains(hit)) continue;
        for (let node = hit; node && node !== container; node = node.parentNode) {
          const id = node.getAttribute?.('id');
          if (!id || !elements[id] || seen.has(id)) continue;
          seen.add(id);
          out.push({ id, name: names[id]?.name || id, piece: clickTargetOf(id) === id });
        }
      }
      return out;
    },
    /**
     * Select one drawing by name, stepping inside whatever piece holds it.
     *
     * Without the step inside, the next plain click would resolve straight back
     * up to the piece and undo the choice -- which is the whole point of having
     * chosen a layer under the cursor.
     */
    selectInside(id) {
      if (!documentModel.getNode(id)) return false;
      const root = pieces?.resolve?.(id) || null;
      insidePiece = root && root !== id ? root : insidePiece;
      store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectOnly(id)); });
      return true;
    },
    /**
     * Down one level, from the keyboard (§4 of the brief: Enter enters).
     *
     * Double-click has always done this with a pointer; the gesture had no
     * keyboard equivalent at all, which made the hierarchy unreachable without
     * a mouse. The first child, because there is no cursor to say which.
     */
    enterSelection() {
      const id = store.getSession().selectedId;
      if (!id) return null;
      const child = childrenOf(store.getDocument().layers, id)[0] || null;
      if (!child || !documentModel.getNode(child)) return null;
      const root = pieces?.resolve?.(child) || null;
      if (root && root !== child) insidePiece = root;
      else if (pieces?.contains) insidePiece = id;
      store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectOnly(child)); });
      return child;
    },
    setWorkspace(next) {
      workspace=next;
      // Stepping inside a piece is where the pointer is, not a preference: a
      // change of screen comes back out.
      insidePiece = null;
      if (next !== 'create') setEditScope(null);
      // The vector tools belong to Artwork (`docs/VECTOR_EDITING.md`, and the
      // shortcuts declare them scoped to it). Leaving that task puts the canvas
      // back to Select the way finishing a shape does: node handles, a
      // half-drawn pen run, the mode banner and the grab cursor are Artwork
      // chrome, and a node handle that survives into Preview still rewrites the
      // path it is dragged on.
      if (next !== 'create' && activeTool !== 'select') { api.setTool('select'); toolChangeHandler('select'); }
      clearSelection();
      Object.keys(store.getDocument().elements||{}).forEach((id)=>wrapperFor(id)?.draggable(false));
      showSelection(store.getSession().selectedId, store.getSession().selectedIds);
      // Leaving Rig takes the anchor, the reach, any warp lattice and the pins
      // off the canvas with it.
      renderHandRig();
      renderWarp();
      renderPins();
    },
    /**
     * The box a piece of artwork occupies, in the artwork's own units.
     *
     * The panels that place things *on* artwork — a pin, an attachment point —
     * need to know where it is, and only the canvas can measure it. `getBBox`
     * is the artwork's own geometry, which is what those coordinates are in.
     */
    measureElement(id) {
      const node = id ? documentModel.getNode(id) : null;
      const box = node && safeBBox(node);
      return box && box.width ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
    },
    setTool(next) {
      activeTool=next; cancelDrawing(); gizmo.cancel(); endNodeEdit(); clearSelection();
      Object.keys(store.getDocument().elements||{}).forEach((id)=>{const node=wrapperFor(id);node?.selectize(false).draggable(false);});
      showSelection(store.getSession().selectedId, store.getSession().selectedIds);
      // The Node tool needs a path: start on the selection, convert a shape
      // into one -- rounding a corner of a drawn rectangle is what the tool is
      // for -- or say what to do.
      if (next === 'node') {
        const id = store.getSession().selectedId;
        if (!startNodeEdit(id)) {
          const converted = id && !store.getDocument().layerMetadata?.[id]?.locked ? api.convertToPathNow(id) : { ok: false };
          if (converted.ok && startNodeEdit(id)) showNote('Turned into a path so its points can be moved. Drag a node to reshape it; undo puts the shape back.');
          else showNote('Click a path on the canvas to edit its nodes.');
        }
        else showNote('Drag a node to reshape the path. Arrow keys nudge it; Esc leaves the tool.');
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
    /** How the drawing picker draws a pose the hand has not got yet. */
    setHandPicker({ addStyle = null } = {}) { handPickerAdd = addStyle; renderHandPicker(); },
    setPuppetHandles(handles = [], { getValues = () => ({}), onChange = () => {}, describe = () => '', grid = null, snap = null, goToCell = null, generateTurn = null } = {}) {
      // Switching tasks must not rebuild the DOM for the same set of handles:
      // the stability suite flips workspaces two hundred times.
      const same = puppet && puppet.handles.length === handles.length
        && puppet.handles.every((entry, index) => entry.handle.id === handles[index].id && entry.handle.anchor === handles[index].anchor);
      if (same) {
        puppet.getValues = getValues; puppet.onChange = onChange; puppet.describe = describe;
        puppet.grid = grid; puppet.snap = snap; puppet.goToCell = goToCell; puppet.generateTurn = generateTurn;
        // The set is the same, but what an author calls each one, and what it
        // looks like, are theirs to change without a rebuild.
        puppet.handles.forEach((entry, index) => { entry.handle = handles[index]; dressHandle(entry); });
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
      puppet = { handles: [], getValues, onChange, describe, grid, snap, goToCell, generateTurn, halo: null, dragging: null, visible: true, expanded: new Set(), expanders: [], cages: new Map() };
      for (const handle of handles) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'puppet-handle';
        button.dataset.puppetHandle = handle.id;
        if (handle.group) button.dataset.puppetMember = handle.group;
        button.setAttribute('role', 'slider');
        const entry = { handle, button, hit: 0, glyph: null };
        dressHandle(entry);
        button.setAttribute('aria-valuetext', describe(handle, values));
        container.append(button);
        puppet.handles.push(entry);
        // A group whose members are laid out on a console is already open:
        // there is nothing an opener could reveal.
        if (!groups.has(handle.id) || handles.every((item) => item.group !== handle.id || item.track)) continue;
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
      // One frame per part of the face that has controls in it (CR-06).
      for (const handle of handles) {
        const id = handle.visualParent;
        if (!id || puppet.cages.has(id)) continue;
        const cage = document.createElement('div');
        cage.className = 'puppet-cage';
        cage.dataset.puppetCage = id;
        cage.setAttribute('aria-hidden', 'true');
        cage.hidden = true;
        const label = RIG_CONTROL_GROUPS.find((group) => group.id === id)?.label || id;
        cage.innerHTML = `<b>${String(label).replace(/[<&]/g, '')}</b>`;
        container.append(cage);
        puppet.cages.set(id, cage);
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
      if (!puppet.visible) for (const cage of puppet.cages.values()) cage.hidden = true;
      if (!puppet.visible) puppet.halo?.setAttribute('hidden', '');
      // The console is drawn from the placement pass, which a hidden set of
      // handles never runs -- so turning them off has to take it down here.
      if (!puppet.visible) handConsoleLayer.style.display = 'none';
      container.classList.toggle('puppet-ready', puppet.visible);
      if (puppet.visible) placePuppetHandles();
      return puppet.visible;
    },
    /**
     * Which handles the board has selected.
     *
     * A control picker and the mascot are two views of one rig, so selecting a
     * control in the list has to show on the thing itself.
     */
    setSelectedHandles(ids = []) {
      if (!puppet) return 0;
      const chosen = new Set(ids);
      for (const { handle, button } of puppet.handles) button.classList.toggle('selected-handle', chosen.has(handle.id));
      return chosen.size;
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
    /* ── The guides (docs/FACE_GUIDES.md) ─────────────────────────────────── */
    /**
     * Draw where the face's missing parts go, or stop.
     *
     * On for the screens where an author is *making* a face; off everywhere
     * else, because a dashed box over a finished mascot is clutter. A face
     * with every part has no slots to draw, so turning it on costs nothing
     * there either.
     */
    showFaceGuides(visible) { guidesVisible = Boolean(visible); renderGuides(); return guidesVisible; },
    /**
     * Frame where one library drawing will land, or none.
     *
     * The asset, not its id: the canvas asks it for a reference box and a
     * mount point, which is what the fit is made of, and looking it up here
     * would put a second copy of the library's own lookup in the canvas.
     */
    previewFacePart(asset) { guideAsset = asset && asset.referenceBox ? asset : null; renderGuides(); return Boolean(guideAsset); },
    /* ── Hand mode (VNX-19, docs/HAND_RIGGING.md) ─────────────────────────── */
    /**
     * Draw the anchor and the reach of one hand, or of none.
     *
     * Hand Setup drives this with the side it has open; `null` gives the say
     * back to the selection. It is honoured only in Rig, and only for a side
     * that has drawn artwork, so a panel need not repeat either rule.
     *
     * @param {'left'|'right'|null} side
     * @returns {'left'|'right'|null} what is actually on the canvas
     */
    showHandRig(side) {
      handRigRequest = side === 'left' || side === 'right' ? side : null;
      renderHandRig();
      return openHandRig();
    },
    /** What hand mode is showing, and where: the drawn anchor, ellipse and grip. */
    getHandRig() { const side = openHandRig(); return side ? handRigOverlay(store.getDocument(), side) : null; },
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
    // The whole chrome, not just the edge: a new working area is a new
    // artwork matrix, and everything drawn over the mascot is placed by it.
    setArtboard(box) { commands.setArtboard(box); placeChrome(); return readArtboard(store.getDocument().svgMarkup || ''); },
    /**
     * Which element is clipping this one, and **which drawing** does the
     * cutting. Null when nothing is.
     *
     * The clip's own id (`headShape`) is a name for the relationship, not for
     * anything an author can press. What they can press is the shape: the
     * drawing a `<clipPath>` references, or the named shape it holds. Read
     * from the markup so the Layers panel and this give the same answer
     * (`core/artwork/cuts.js`).
     */
    describeClip(id) {
      const clip = clipOwnerOf(id);
      if (!clip) return null;
      const cut = readCuts(store.getDocument().svgMarkup || '').byPiece[clip.ownerId] || null;
      return {
        ownerId: clip.ownerId, clipId: clip.clipId, self: clip.ownerId === id,
        shapeId: cut?.shapeId || null, shapeName: cut?.shapeName || null, named: Boolean(cut?.named)
      };
    },
    /**
     * Cut pieces to the shape of another (docs/VECTOR_EDITING.md).
     *
     * The editor could always *show* a clip and take one off, and there was no
     * way to make one: the fringe arrived clipped to the head and nothing an
     * author drew could ever be cut. The piece in front is the shape that does
     * the cutting -- the bargain every vector editor makes -- so it leaves the
     * drawing and becomes the cutter, and `releaseClip` brings it back.
     *
     * A clip is read in the user space of the piece being cut, **after** that
     * piece's own transform -- and after every transform above it, which is the
     * part this used to miss. Cutting a piece that sits in a turned group with
     * a shape drawn at the top level put the cut wherever that group's turn
     * sent it: a hand is rotated two hundred degrees at rest, so the cut landed
     * clean off the mascot. The cutter is copied once per piece with the whole
     * chain divided out, so the cut lands on the shape the author is looking at
     * whatever either of them is drawn inside.
     */
    setClip(ids) {
      const nodes = [...new Set(ids || [])].map((id) => documentModel.getNode(id)).filter(Boolean);
      if (nodes.length < 2) return { ok: false, message: 'Select the piece to cut, and the shape to cut it to in front of it.' };
      // Document order is paint order: the piece painted last is the one in front.
      nodes.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const cutter = nodes[nodes.length - 1], targets = nodes.slice(0, -1);
      if (targets.some((node) => node.contains(cutter) || cutter.contains(node))) return { ok: false, message: 'A shape cannot cut what it is drawn inside.' };
      const locked = targets.find((node) => store.getDocument().layerMetadata?.[node.getAttribute('id')]?.locked);
      if (locked) return { ok: false, message: 'Unlock the piece before cutting it.' };
      return previewOrder.authored(() => {
        const host = rootGroup.node.querySelector('svg');
        if (!host) return { ok: false, message: 'No artwork to cut.' };
        let defs = host.querySelector(':scope > defs');
        if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); host.prepend(defs); }
        history.snapshot();
        const cutterMatrix = matrixToArtwork(cutter);
        const used = new Set([...host.querySelectorAll('[id]')].map((node) => node.getAttribute('id')));
        let counter = 0;
        const clipId = () => { let id; do { counter += 1; id = `cut-${counter}`; } while (used.has(id)); used.add(id); return id; };
        // A picture cuts by its transparency, not by its rectangle. Anything
        // else cuts by its outline, exactly as it always did.
        const byAlpha = cutter.localName === 'image';
        for (const target of targets) {
          const shape = cutter.cloneNode(true);
          shape.removeAttribute('id');
          shape.removeAttribute('data-name');
          const into = invertMatrix(matrixToArtwork(target));
          if (!into) return { ok: false, message: 'This piece is flattened to nothing, so there is nothing to cut.' };
          shape.setAttribute('transform', matrixString(multiplyMatrix(into, cutterMatrix)));
          const definition = document.createElementNS('http://www.w3.org/2000/svg', byAlpha ? 'mask' : 'clipPath');
          definition.setAttribute('id', clipId());
          if (byAlpha) {
            definition.setAttribute('maskUnits', 'userSpaceOnUse');
            // A `<mask>` reads luminance by default, so a dark picture would
            // erase what it was meant to keep. `mask-type` says to read the
            // alpha instead; written twice because the attribute is newer than
            // the property and neither is everywhere yet.
            definition.setAttribute('mask-type', 'alpha');
            definition.setAttribute('style', 'mask-type:alpha');
          } else definition.setAttribute('clipPathUnits', 'userSpaceOnUse');
          definition.append(shape);
          defs.append(definition);
          target.setAttribute(byAlpha ? 'mask' : 'clip-path', `url(#${definition.getAttribute('id')})`);
        }
        // The cutter is a shape now, not a drawing: out of the artwork and into
        // the definitions, the way it went in every editor that has this tool.
        cutter.remove();
        refreshDocument(targets[0]?.getAttribute('id') || null);
        renderFrame();
        return { ok: true, byAlpha, cutter: cutter.getAttribute('id'), targets: targets.map((node) => node.getAttribute('id')) };
      });
    },
    /**
     * Stop clipping a piece, and give the shape back.
     *
     * A clip is a deliberate tool -- the fringe is clipped to the head so it
     * cannot cross the outline -- but it is invisible, so an author redrawing
     * the hair taller has to be able to see it and take it off. And the shape
     * that was doing the cutting comes back into the drawing rather than being
     * left in the definitions where nothing can reach it: that is how a cut is
     * *changed* -- release it, redraw the shape, cut again.
     */
    releaseClip(id) {
      const clip = clipOwnerOf(id);
      if (!clip?.owner) return false;
      return previewOrder.authored(() => {
        const host = rootGroup.node.querySelector('svg');
        history.snapshot();
        const owner = clip.owner, reference = clip.clipId;
        owner.removeAttribute(clip.attribute || 'clip-path');
        // Only when nothing else is cut by it: a shape shared by both eyes is
        // still doing its job for the other one. Both attributes are searched,
        // because a definition is shared by whoever points at it and not by
        // whoever points at it the same way.
        const definition = host?.querySelector?.(`#${CSS.escape(reference)}`);
        const stillUsed = CUT_ATTRIBUTES.some((attribute) => [...(host?.querySelectorAll(`[${attribute}]`) || [])]
          .some((node) => (node.getAttribute(attribute) || '').includes(`#${reference}`)));
        const child = definition?.firstElementChild || null;
        // A cut that points at a drawing has nothing to give back: the shape is
        // in the artwork already, named and selectable, which is the whole
        // reason the template's cuts are written `<use href="#head">` rather
        // than with a frozen copy. Restoring the `<use>` itself would drop a
        // second head into the drawing.
        if (definition && !stillUsed && child?.localName === 'use') definition.remove();
        else if (definition && !stillUsed && child) {
          const shape = child;
          // It was drawn in the owner's user space; put it back beside the
          // owner, where that is what the parent's space is.
          // The shape comes back beside the owner, so it needs the owner's own
          // transform and no more: everything above them is the parent space
          // they now share. Read as SVG rather than handed to `DOMMatrix`,
          // which parses the CSS spelling -- `matrix(1, 0, 0, 1, 0, 0)` -- and
          // throws on the space-separated one every SVG in this editor is
          // written with, taking the whole release down with it.
          const restored = multiplyMatrix(ownTransformMatrix(owner), ownTransformMatrix(shape));
          const moved = ['a', 'b', 'c', 'd', 'e', 'f'].some((key) => Math.abs(restored[key] - IDENTITY[key]) > 1e-9);
          if (moved) shape.setAttribute('transform', matrixString(restored));
          else shape.removeAttribute('transform');
          owner.after(shape);
          definition.remove();
        }
        refreshDocument(store.getSession().selectedId);
        renderFrame();
        return true;
      });
    },
    syncSelection(id, ids = null) {
      // A piece picked outside the edit scope (from the layers, say) is the author leaving it.
      if (editScope && id && !inEditScope(id)) setEditScope(null);
      const next = Array.isArray(ids) && id && ids.includes(id) ? ids : (id ? [id] : []);
      const same = id === selectedId && next.length === selectedIds.length && next.every((item, index) => item === selectedIds[index]);
      if (!same) showSelection(id, next); else { gizmo.render(); renderMultiSelection(); }
    },
    /** Everything selected, the piece in hand last. */
    getSelection() { return [...selectedIds]; },
    /**
     * Where a piece is on screen, for the chrome that has to sit next to it
     * (`ui/selection-actions.js`). Client coordinates, which is what a
     * `position:absolute` bar inside the canvas container needs.
     */
    clientBox(id) { return clientBoxOf(id); },
    /** Select several pieces at once; the last one is in hand. */
    selectMany(ids) { store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectMany(ids.filter((item) => documentModel.getNode(item)))); }); return selectedIds.length; },
    /** Every unlocked, visible piece at the top of the artwork (Ctrl/Cmd+A). */
    selectAll() { return this.selectMany(topLevelIds()); },
    /** Line the selected pieces up on the selection's edge or centre line; one piece lines up on the working area. */
    alignSelection(kind) { return arrangeSelection((boxes) => alignBoxes(boxes, kind, boxes.length < 2 ? { target: artboardScreenBox() } : {}), `Aligned ${kind}`); },
    /** Equal gaps between three or more selected pieces. */
    distributeSelection(axis) { return arrangeSelection((boxes) => distributeBoxes(boxes, axis), `Distributed ${axis === 'vertical' ? 'vertically' : 'horizontally'}`); },
    /** Move every selected piece by a step, one undo step for the lot. */
    nudgeMany(ids, dx, dy) {
      const movable = ids.filter((id) => store.getDocument().elements[id] && !store.getDocument().layerMetadata[id]?.locked);
      if (!movable.length) return false;
      history.snapshot();
      for (const id of movable) { const base = store.getDocument().elements[id].baseTransform || {}; commands.setTransform(id, { x: (Number(base.x) || 0) + dx, y: (Number(base.y) || 0) + dy }, { source: 'canvas', snapshot: false }); api.applyElementTransform(id, store.getDocument().elements[id]); }
      commitTransforms();
      renderMultiSelection();
      return true;
    },
    /** Remove every selected piece, one undo step for the lot. */
    deleteMany(ids) {
      const nodes = ids.map((id) => documentModel.getNode(id)).filter((node) => node && node !== documentModel.root);
      if (!nodes.length) return false;
      history.snapshot();
      for (const node of nodes) { delete documentModel.metadata[node.getAttribute('id')]; node.remove(); }
      refreshDocument();
      store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectOnly(null)); });
      return true;
    },
    /**
     * Put several pieces in one group, where the first of them was painted.
     * They have to share a parent: a group that pulled a pupil out of its eye
     * would move it out of the eye's turn and blink.
     */
    groupMany(ids) { return previewOrder.authored(() => api.groupManyNow(ids)); },
    groupManyNow(ids) {
      const nodes = ids.map((id) => documentModel.getNode(id)).filter((node) => node && node !== documentModel.root);
      if (nodes.length < 2) return nodes.length === 1 ? api.group(nodes[0].getAttribute('id')) : false;
      const parent = nodes[0].parentNode;
      if (!parent || nodes.some((node) => node.parentNode !== parent)) { showNote('Pieces of the same group can be grouped together. These sit in different groups.'); return false; }
      history.snapshot();
      const ordered = [...parent.children].filter((child) => nodes.includes(child));
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      parent.insertBefore(group, ordered[0]);
      for (const node of ordered) group.appendChild(node);
      refreshDocument();
      store.mutateSession(['selectedId', 'selectedIds'], (state) => { Object.assign(state, selectOnly(group.getAttribute('id'))); });
      return true;
    },
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
    /**
     * Fill the view with what is selected (audit §5).
     *
     * *Fit* has always framed the whole mascot; there was no way to get close
     * to the piece in hand except by wheeling towards it and hoping. A pupil is
     * forty pixels of a six-hundred-pixel face, and shaping one meant working
     * at a size nobody can aim at.
     *
     * The same arithmetic as `fitToCanvas`, over the union of the selection
     * rather than the whole drawing, and capped at the zoom ceiling the wheel
     * already respects — a two-pixel reflection would otherwise fill the screen
     * at four hundred times life size.
     */
    zoomToSelection(padding = .25) {
      const ids = selectedIds.length ? selectedIds : (selectedId ? [selectedId] : []);
      if (!ids.length || !rootGroup?.node) return viewTransform().scale;
      setView({ scale: 1, x: 0, y: 0 });
      const boxes = ids.map((id) => documentModel.getNode(id)).filter(Boolean).map((node) => node.getBBox?.()).filter((box) => box && box.width && box.height);
      if (!boxes.length) return viewTransform().scale;
      const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
      const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
      const box = { x: left, y: top, width: right - left, height: bottom - top };
      const width = container.clientWidth, height = container.clientHeight;
      if (!box.width || !box.height || !width || !height) return viewTransform().scale;
      const scale = Math.max(.2, Math.min(5, Math.min(width * (1 - padding * 2) / box.width, height * (1 - padding * 2) / box.height)));
      setView({ scale, x: (width - box.width * scale) / 2 - box.x * scale, y: (height - box.height * scale) / 2 - box.y * scale });
      return scale;
    },
    /**
     * Fill the view with named pieces, wherever the frame has put them.
     *
     * `zoomToSelection` frames what is *selected* and measures with `getBBox`,
     * which is the piece's own untransformed geometry. That is right for a
     * shape being drawn and wrong for a piece the rig has placed: a hand is
     * drawn at the origin and put beside the body by its transform, so its
     * `getBBox` says nothing about where it is on screen.
     *
     * This measures what is painted — each node's client rect, mapped back
     * into the artwork's own space — so it frames the thing an author can see.
     * Used by Design ▸ Hands, where the subject of the screen is one hand and
     * the canvas used to show the whole face with the hands behind its head.
     *
     * @param {string[]} ids
     * @param {number} padding  share of the view left around the pieces
     */
    frameElements(ids, padding = 0.18) {
      if (!rootGroup?.node || !ids?.length) return viewTransform().scale;
      setView({ scale: 1, x: 0, y: 0 }, { keepFraming: true });
      const inverse = rootGroup.node.getScreenCTM?.()?.inverse();
      const width = container.clientWidth, height = container.clientHeight;
      if (!inverse || !width || !height) return viewTransform().scale;
      const point = (x, y) => { const p = draw.node.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(inverse); };
      const corners = [];
      for (const id of ids) {
        const node = documentModel.getNode(id);
        const rect = node?.getBoundingClientRect?.();
        // A piece with no area is one that is hidden or has not been drawn:
        // framing on it would zoom the view onto nothing.
        if (!rect?.width || !rect?.height) continue;
        corners.push(point(rect.left, rect.top), point(rect.right, rect.bottom));
      }
      if (!corners.length) return viewTransform().scale;
      const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
      const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      if (!box.width || !box.height) return viewTransform().scale;
      // The same ceiling the wheel respects, so framing a thumb-sized piece
      // cannot leave the author at four hundred times life size.
      const scale = Math.max(.2, Math.min(5, Math.min(width * (1 - padding * 2) / box.width, height * (1 - padding * 2) / box.height)));
      setView({ scale, x: (width - box.width * scale) / 2 - box.x * scale, y: (height - box.height * scale) / 2 - box.y * scale }, { keepFraming: true });
      framing = { ids: [...ids], padding };
      return scale;
    },
    /**
     * Whether the view is still the framing it was asked for.
     *
     * A caller that framed something and means to do it again once it has
     * settled asks this first: a *Fit*, a wheel or a zoom-to-selection in the
     * meantime is the author saying where to look, and a framing arriving
     * afterwards to undo that is worse than never framing at all.
     */
    isFraming(ids) { return Boolean(framing) && (!ids?.length || ids.every((id) => framing.ids.includes(id))); },
    resetView(){ setView({ scale: 1, x: 0, y: 0 }); return 1; },
    /** Zoom about a point of the viewport — the middle by default, so the mascot stays in view; the pointer for the wheel. */
    zoomView(factor, center = null){
      const view=viewTransform();
      const scale=Math.max(.2,Math.min(5,view.scale*factor));
      const cx=center?center.x:container.clientWidth/2, cy=center?center.y:container.clientHeight/2;
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
    appendArtwork(markup, mountPoint = null, { updateStore = true, viewBox = null, position = 'front' } = {}) { return previewOrder.authored(() => api.appendArtworkNow(markup, mountPoint, { updateStore, viewBox, position })); },
    appendArtworkNow(markup, mountPoint = null, { updateStore = true, viewBox = null, position = 'front' } = {}) {
      const svgRoot=rootGroup.node.querySelector('svg');if(!svgRoot)return false;
      // Artwork that needs room to live in says so: a pair of hands hangs below
      // a face that already fills its artboard.
      if(viewBox)svgRoot.setAttribute('viewBox',viewBox);
      const target=(mountPoint&&documentModel.getNode(mountPoint))||svgRoot;
      // `back` paints it behind everything already in the group, which is what
      // a head or a body is: the thing the rest of the mascot sits on.
      target.insertAdjacentHTML(position==='back'?'afterbegin':'beforeend',deferAssetReferences(sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`)).replace(/^<svg[^>]*>|<\/svg>$/g,''));
      // What was just inserted is pointed at whatever is already primed;
      // anything new is fetched by `refreshAssets`.
      paintAssets(svgRoot);
      const tree=documentModel.load(svgRoot,documentModel.metadata);loadedMarkup=documentModel.serialize();
      const elements=structuredClone(store.getDocument().elements);const visit=(items)=>items.forEach((item)=>{if(!elements[item.id]){const node=wrapperFor(item.id),plugin=pluginRegistry.getByNode(node);if(plugin){elements[item.id]=plugin.createRigData(node,parseTransform(node));attachBehavior(node);}}visit(item.children);});visit(tree);
      const artwork={layers:tree,layerMetadata:structuredClone(documentModel.metadata),elements,svgMarkup:loadedMarkup};
      if(updateStore)syncDocument(artwork);
      return artwork;
    },
    /**
     * Take some artwork out and put other artwork where it was, in one go.
     *
     * The Character Builder replaces a part (docs/FACE_PART_LIBRARY.md,
     * "Installing"): the old shapes go, the new fragment lands in the same
     * group at the same place in the paint order, and the document is read
     * back once. Like `appendArtwork` with `updateStore: false`, it returns
     * the artwork for a command to write together with the rig -- nothing here
     * touches the store or the history.
     *
     * @param {string[]} removeIds pieces to take out, with everything inside them
     * @param {string} markup the fragment to put in their place
     * @param {{ mountPoint?: string|null, before?: string|null, behind?: { ids: string[], before?: string|null }|null, rehome?: { id: string, into: string }[] }} [options]
     *   which group the fragment joins, which sibling it is painted behind,
     *   which of its pieces are painted behind the face instead (moved out of
     *   the fragment to the front of the same group, or before `behind.before`
     *   -- a head of hair is one drawing, and its back paints behind the
     *   skull), and which pieces of the *old* drawing belong to somebody else
     *   and are to be kept: each is lifted out before its host goes and put
     *   inside the new piece named by `into`, or beside it where that piece
     *   holds nothing (an earring moving from one pair of ears to the next)
     * @returns {object|false} the artwork payload, or false when the canvas has no document
     */
    replaceArtwork(removeIds, markup, options = {}) { return previewOrder.authored(() => api.replaceArtworkNow(removeIds, markup, options)); },
    replaceArtworkNow(removeIds = [], markup = '', { mountPoint = null, before = null, behind = null, rehome = [] } = {}) {
      const svgRoot = rootGroup.node.querySelector('svg');
      if (!svgRoot) return false;
      const nodes = removeIds.map((id) => documentModel.getNode(id)).filter((node) => node && node !== documentModel.root);
      // Somebody else's drawing, out of what is about to go, before it goes.
      const kept = (rehome || []).map((entry) => ({ into: entry.into, node: documentModel.getNode(entry.id) })).filter((entry) => entry.node);
      for (const entry of kept) entry.node.remove();
      // Where the new fragment goes: the group it was told to join -- a host
      // it hangs inside, or the group the old part sat in -- and otherwise the
      // first removed piece's own place, so the paint order is kept.
      const first = nodes[0];
      const parent = (mountPoint && documentModel.getNode(mountPoint)) || first?.parentNode || svgRoot;
      let anchor = (before && documentModel.getNode(before)) || (first ? nodes.reduce((last, node) => (node.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING ? last : node), first).nextSibling : null);
      while (anchor && nodes.includes(anchor)) anchor = anchor.nextSibling;
      const gone = new Set();
      for (const node of nodes) { for (const item of [node, ...node.querySelectorAll('[id]')]) { const id = item.getAttribute('id'); if (id) { gone.add(id); delete documentModel.metadata[id]; } } node.remove(); }
      const template = document.createElementNS(SVG_NS, 'svg');
      template.innerHTML = deferAssetReferences(sanitizeSvgMarkup(`<svg xmlns="${SVG_NS}">${markup}</svg>`)).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      const added = [...template.childNodes];
      for (const node of added) { if (anchor && anchor.parentNode === parent) parent.insertBefore(node, anchor); else parent.appendChild(node); }
      // One anchor for every piece painted behind, found before any moves:
      // inserted before the same node one after another, they keep the order
      // the asset declared them in.
      const back = behind?.ids?.length ? (behind.before && parent.querySelector(`:scope > [id="${CSS.escape(behind.before)}"]`)) || parent.firstElementChild : null;
      for (const id of behind?.ids || []) {
        const piece = added.map((node) => (node.getAttribute?.('id') === id ? node : node.querySelector?.(`[id="${CSS.escape(id)}"]`))).find(Boolean);
        if (piece && back && back !== piece) parent.insertBefore(piece, back);
      }
      // And back in, inside the new piece it belongs to: a group holds it, and
      // anything else is beside it -- a shape has no inside, and what hangs on
      // one follows it by constraint instead.
      for (const entry of kept) {
        const into = documentModel.getNode(entry.into);
        const target = into ? (into.tagName?.toLowerCase() === 'g' ? into : into.parentNode) : parent;
        (target || parent).appendChild(entry.node);
      }
      const tree = documentModel.load(svgRoot, documentModel.metadata); loadedMarkup = documentModel.serialize();
      const elements = structuredClone(store.getDocument().elements);
      for (const id of gone) delete elements[id];
      const visit = (items) => items.forEach((item) => { if (!elements[item.id]) { const node = wrapperFor(item.id), plugin = pluginRegistry.getByNode(node); if (plugin) { elements[item.id] = plugin.createRigData(node, parseTransform(node)); attachBehavior(node); } } visit(item.children); });
      visit(tree);
      return { layers: tree, layerMetadata: structuredClone(documentModel.metadata), elements, svgMarkup: loadedMarkup, removed: [...gone] };
    },
    reconcileState(state) {
      diagnostics.increment('canvas.reconciles');
      if (!state.svgMarkup || state.svgMarkup === loadedMarkup) return;
      // The artwork is rebuilt from the document: whatever order was borrowed
      // went with the old nodes.
      previewOrder.reset();
      // Rebuilding the artwork must not move the camera: an undo, or another
      // panel writing to the document, is not a reason to re-frame the mascot.
      const view = viewTransform();
      // New nodes, so nothing is drawn with what the old ones were.
      lastRequested.clear();
      rootGroup.remove(); rootGroup = draw.group().svg(deferAssetReferences(sanitizeSvgMarkup(state.svgMarkup))); raiseGizmoLayer(); paintAssets();
      setView(view);
      const svgRoot = rootGroup.node.querySelector('svg');
      documentModel.load(svgRoot, state.layerMetadata || {}); loadedMarkup = documentModel.serialize();
      Object.keys(state.elements || {}).forEach((id) => { const node = wrapperFor(id); if (node) attachBehavior(node); });
      renderHandRig();
    },
    reorder(id, direction) { return previewOrder.authored(() => { const changed = documentModel.reorder(id, direction); if (changed) commitDocument(); return changed; }); },
    /** Straight to the front or the back of its group, in one step. */
    reorderToEnd(id, direction) { return previewOrder.authored(() => api.reorderToEndNow(id, direction)); },
    reorderToEndNow(id, direction) {
      const node = documentModel.getNode(id); if (!node?.parentNode) return false;
      const siblings = [...node.parentNode.children].filter((item) => item !== node && item.getAttribute('id') && documentModel.getNode(item.getAttribute('id')));
      const target = direction === 'front' ? siblings.at(-1) : siblings[0];
      if (!target) return false;
      if (direction === 'front' ? node.nextElementSibling === null : node.previousElementSibling === null) return false;
      history.snapshot();
      const changed = direction === 'front' ? documentModel.moveAfter(id, target.getAttribute('id')) : documentModel.moveBefore(id, target.getAttribute('id'));
      if (changed) commitDocument();
      return changed;
    },
    /** Mirror the piece across its pivot: a negative scale on one axis, one undo step. */
    flip(id, axis = 'x') {
      const element = store.getDocument().elements[id]; if (!element) return false;
      if (store.getDocument().layerMetadata[id]?.locked) return false;
      const key = axis === 'y' ? 'scaleY' : 'scaleX', current = Number(element.baseTransform?.[key]);
      commands.setTransform(id, { [key]: -(Number.isFinite(current) && current !== 0 ? current : 1) }, { source: 'canvas' });
      api.applyElementTransform(id, store.getDocument().elements[id]);
      commitTransforms();
      return true;
    },
    /** Move the piece by a step in artwork units — the arrow keys — one undo step per press. */
    nudge(id, dx, dy) {
      const element = store.getDocument().elements[id]; if (!element) return false;
      if (store.getDocument().layerMetadata[id]?.locked) return false;
      const base = element.baseTransform || {};
      const next = { x: (Number(base.x) || 0) + dx, y: (Number(base.y) || 0) + dy };
      // The arrows are the third way to move a piece, so they take the same
      // path as the gizmo and the fields: on a mascot surface a linked pair
      // follows them too (audit §2.2).
      if (pieces?.commit?.(id, next)) return true;
      commands.setTransform(id, next, { source: 'canvas' });
      api.applyElementTransform(id, store.getDocument().elements[id]);
      commitTransforms();
      return true;
    },
    setVisibility(id, visible) { const changed = documentModel.setVisibility(id, visible); if (changed) commitDocument(); return changed; },
    setLocked(id, locked) { const changed = documentModel.setLocked(id, locked); if (changed) { commitDocument(); updateElementInteractionState(id); } return changed; },
    setName(id, name) { const changed = documentModel.setName(id, name); if (changed) commitDocument(); return changed; },
    setExpanded(id, expanded) { documentModel.setExpanded(id, expanded); commitDocument(); },
    /**
     * Set one presentation attribute. An inline `style` for the same property
     * would beat the attribute, so it is removed first: an imported Illustrator
     * or Figma SVG carries `style="fill:…"` on every shape, and changing the
     * fill there used to appear to do nothing.
     */
    setAppearance(id, property, value) { const node=wrapperFor(id);if(!node)return false;history.snapshot();if(node.node.style?.getPropertyValue?.(property))node.node.style.removeProperty(property);if(value===''||value==null)node.attr(property,null);else node.attr(property,value);documentModel.captureAuthoringAttribute(id,property);commitDocument();return true; },
    /** The words inside a `<text>` element. */
    setTextContent(id, value) { const node=documentModel.getNode(id);if(!node||node.localName!=='text')return false;history.snapshot();node.textContent=String(value??'');documentModel.captureAuthoringNode(id);commitDocument();return true; },
    duplicate(id) { return previewOrder.authored(() => api.duplicateNow(id)); },
    duplicateNow(id) {
      const node=documentModel.getNode(id);if(!node)return false;history.snapshot();
      const clone=node.cloneNode(true);
      // Fresh ids for the copy and everything inside it, chosen here rather than
      // left to the loader: a clone that kept its ids drew a "duplicate id
      // renamed" warning per child, and the copy arrived nameless, as "Path 7".
      const taken=(candidate)=>Boolean(documentModel.getNode(candidate))||Boolean(rootGroup.node.querySelector(`[id="${candidate}"]`));
      const fresh=(base)=>{let candidate=`${base}-copy`,n=2;while(taken(candidate))candidate=`${base}-copy-${n++}`;return candidate;};
      const renamed=new Map();
      for(const item of [clone,...clone.querySelectorAll('[id]')]){const old=item.getAttribute('id');if(!old||renamed.has(old))continue;const next=fresh(old);item.setAttribute('id',next);renamed.set(old,next);}
      node.parentNode.insertBefore(clone,node.nextSibling);
      // The copy is called "<name> copy" — in the project's metadata and in
      // the artwork's own `data-name`, which is where a template names its
      // pieces — so two rows never read as the same piece. Children keep
      // their names and metadata; nothing in the copy stays locked.
      const rootName=documentModel.metadata[id]?.name||node.getAttribute('data-name')||id, copyName=`${rootName} copy`;
      for(const [old,next] of renamed){const meta=documentModel.metadata[old];if(old===id){documentModel.metadata[next]={...(meta||{}),locked:false,name:copyName};if(clone.hasAttribute('data-name'))clone.setAttribute('data-name',copyName);}else if(meta)documentModel.metadata[next]={...meta,locked:false};}
      refreshDocument(clone.getAttribute('id'));
      return true;
    },
    delete(id) { return previewOrder.authored(() => { const node=documentModel.getNode(id);if(!node)return false;history.snapshot();node.remove();delete documentModel.metadata[id];refreshDocument();return true; }); },
    group(id) { return previewOrder.authored(() => { const node=documentModel.getNode(id);if(!node||node===documentModel.root)return false;history.snapshot();const group=document.createElementNS('http://www.w3.org/2000/svg','g');node.parentNode.insertBefore(group,node);group.appendChild(node);refreshDocument();store.mutateSession('selectedId',state=>{state.selectedId=group.getAttribute('id');});return true; }); },
    ungroup(id) { return previewOrder.authored(() => { const node=documentModel.getNode(id);if(!node||node.localName!=='g'||!node.parentNode)return false;history.snapshot();const parent=node.parentNode;while(node.firstChild)parent.insertBefore(node.firstChild,node);node.remove();refreshDocument();return true; }); },
    frameDiagnostic(id) {
      const node=documentModel.getNode(id), applied=node ? lastApplied.get(node)?.transform : undefined;
      return { requested:lastRequested.get(id) ? [...lastRequested.get(id)] : null, applied:applied ? [...applied] : null, domTransform:node?.getAttribute('transform') || null };
    },
    applyFrame(frame, values = null) {
      // A mesh with a driver is two shapes and a parameter between them, so it
      // is redrawn with the frame rather than only when it is edited
      // (runtime/mesh-warp.js). A mesh being dragged is left alone: the
      // pointer owns it until it is let go.
      if (values) applyMeshesToDom(rootGroup.node.querySelector('svg'), store.getDocument().meshes, values, { skip: meshGesture.preview()?.target || null });
      // A warp drag owns the outline while it lasts: what is drawn is the
      // lattice under the pointer, and the compiled frame still says what the
      // document says, which is where the shape was before the drag started.
      const warping = warpGesture.active()?.target || null;
      Object.entries(frame.paths || {}).forEach(([id, d]) => { if (id === warping) return; const wrapper=wrapperFor(id),node=wrapper?.node;if(node&&wrapper.type==='path'){const previous=lastApplied.get(node)||{};if(previous.path!==d){wrapper.attr('d',d);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,path:d});}} });
      // A hierarchy resolves to one matrix; only a flat element uses channels.
      Object.entries(frame.matrices || {}).forEach(([id, matrix]) => {const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;drewMatrix(id);const next=matrixToString(matrix),previous=lastApplied.get(node)||{};if(previous.matrix!==next){wrapper.attr('transform',next);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,matrix:next,transform:null});}});
      // `scale 0` means collapsed, so only a missing or broken number falls back
      // to 1 -- `|| 1` kept a part the rig had closed open on the canvas alone.
      // Whether this frame moved the piece the author has selected, so its
      // selection box can follow it. Recorded rather than compared afterwards
      // because `lastRequested` is overwritten in the same pass.
      let movedSelection = false;
      Object.entries(frame.transforms || {}).forEach(([id, transform]) => {if(frame.matrices?.[id])return;const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const next=[transform.x,transform.y,transform.rotation,transform.scaleX,transform.scaleY,transform.pivotX,transform.pivotY].map((value,index)=>{const fallback=index===3||index===4?1:0;return value==null||!Number.isFinite(Number(value))?fallback:Number(value);});lastRequested.set(id,[...next]);const previous=lastApplied.get(node)||{};if(!previous.transform||next.some((value,index)=>Math.abs(value-previous.transform[index])>1e-6)){const [x,y,rotation,scaleX,scaleY,pivotX,pivotY]=next;wrapper.attr('transform',`translate(${x} ${y}) rotate(${rotation} ${pivotX} ${pivotY}) translate(${pivotX} ${pivotY}) scale(${scaleX} ${scaleY}) translate(${-pivotX} ${-pivotY})`);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,transform:next});if(id===selectedId)movedSelection=true;}});
      if (puppet) schedulePuppetPlacement();
      /**
       * The selection box goes where the frame just put the piece.
       *
       * A mascot being designed is posable, so a frame moves the artwork under
       * a box that was drawn for the pose before it: turning the head left the
       * nose painted seventy-four pixels from its own handles
       * (`core/artwork/pose-transform.js`). Only when this frame actually moved
       * the selected piece, and never mid-drag, where the pointer owns the box
       * and the frame is a stale account of where the piece was.
       */
      if (movedSelection && !gizmo.dragging) gizmo.render();
      Object.entries(frame.opacity || {}).forEach(([id, opacity]) => {const wrapper=wrapperFor(id),node=wrapper?.node;if(!node)return;const previous=lastApplied.get(node)||{},next=Number(opacity);if(!Number.isFinite(previous.opacity)||Math.abs(next-previous.opacity)>1e-6){wrapper.attr('opacity',next);diagnostics.increment('canvas.domWrites');lastApplied.set(node,{...previous,opacity:next});}});
      // Depth reaches the paint order here exactly as it does in the exported
      // mascot: a hand behind the body, the far thumb behind the palm. The
      // artwork's own order is put back before the document is ever read.
      const bands = {};
      for (const [id, item] of Object.entries(frame.frames || {})) if (item?.depthBand) bands[id] = item.depthBand;
      if (previewOrder.draw(bands)) diagnostics.increment('canvas.domWrites');
    },
    /**
     * The author's own move, painted straight onto the piece.
     *
     * It records what it painted in `lastApplied`, and that is not bookkeeping:
     * `applyFrame` skips a write when the frame matches what it believes the
     * node carries, and this writes the same attribute behind its back. An
     * undo restored the document, the next frame computed the resting
     * transform, the cache still said "resting" from before the drag -- so
     * nothing was written and the piece stayed where the drag had left it. The
     * numbers said one thing and the mascot showed another.
     *
     * `matrix: null` for the same reason: a channel transform replaces any
     * composed matrix the node was carrying, so claiming it still has one
     * would skip the next matrix write too.
     */
    /**
     * The document says what the drawing says.
     *
     * For the callers that write `elements` and the DOM and nothing else — a
     * typed field, the arrow keys, a multi-selection drag. Once per finished
     * gesture, never per step of one.
     */
    commitTransforms() { commitTransforms(); },
    applyElementTransform(id, element) {
      const node = wrapperFor(id); if (!node || store.getDocument().layerMetadata[id]?.locked) return;
      const values = transformValues(element.baseTransform || element);
      node.attr('transform', transformAttribute(element.baseTransform || element));
      lastApplied.set(node.node, { ...(lastApplied.get(node.node) || {}), transform: values, matrix: null });
      // This *is* what the piece is drawn with now, pose and all: writing the
      // authored transform straight to the DOM is what this call does. Saying
      // so is what keeps the selection box on the piece (`lastRequested`).
      drewWith(id, element.baseTransform || element);
      documentModel.captureAuthoringNode(id);
      // And the box goes with it. Typing a number in the Inspector moved the
      // artwork and left the handles behind, because nothing on this path ever
      // asked the overlay to redraw: a frame did it, a drag did it, a typed
      // field did not. Never mid-drag, where the pointer owns the box.
      //
      // The gizmo alone: this runs once per piece, and the frames around a
      // multi-selection measure every piece in it, so drawing those here would
      // be a square of the work on every step of a drag. The gestures that move
      // several pieces redraw them once, when the pointer has finished.
      if (!gizmo.dragging && id === selectedId) gizmo.render();
    },
    applyPathData(id, d) { const node = wrapperFor(id); if (node?.type !== 'path') return; node.attr('d', d); documentModel.captureAuthoringNode(id); commitDocument(); },
    syncLayerOrder(tree) { return previewOrder.authored(() => api.syncLayerOrderNow(tree)); },
    syncLayerOrderNow(tree) {
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
