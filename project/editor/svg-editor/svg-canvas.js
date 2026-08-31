import SVG from 'svg.js';
import 'svg.select.js';
import 'svg.resize.js';
import 'svg.draggable.js';
import { sanitizeSvgMarkup } from '../core/security/sanitize-svg.js';
import { SvgDocument } from '../core/svg-document/svg-document.js';

function parseTransform(element) {
  const matrix = element.transform();
  return { x: matrix.translateX || 0, y: matrix.translateY || 0, rotation: matrix.rotate || 0,
    scaleX: matrix.scaleX || 1, scaleY: matrix.scaleY || 1, pivotX: matrix.originX || 0, pivotY: matrix.originY || 0 };
}

export function createSvgCanvas(container, store, history, pluginRegistry) {
  // SVG.js 2.x creates/attaches a drawing with SVG(container). addTo() is a
  // SVG.js 3 API and leaves the v2 plugins with an invalid parent (`put`).
  const draw = SVG(container).size('100%', '100%');
  let rootGroup = draw.group();
  const documentModel = new SvgDocument();
  let loadedMarkup = '';

  const wrapperFor = (id) => {
    const node = documentModel.getNode(id);
    return node ? SVG.adopt(node) : null;
  };

  function attachBehavior(element) {
    element.selectize({ deepSelect: false, rotationPoint: true }).resize().draggable();
    element.on('click', (event) => { event.stopPropagation(); store.setState((state) => { state.selectedId = element.id(); }); });
    element.on('dragstart resizestart', (event) => { if (store.getState().layerMetadata[element.id()]?.locked) event.preventDefault(); });
    element.on('dragend resize', () => {
      const id = element.id();
      if (store.getState().layerMetadata[id]?.locked) return;
      history.snapshot();
      store.setState((state) => { state.elements[id] ||= {}; state.elements[id].baseTransform = parseTransform(element); });
      documentModel.captureAuthoringNode(id);
      commitDocument();
    });
  }

  function updateElementInteractionState(id) {
    const element = wrapperFor(id); if (!element) return;
    const locked = Boolean(store.getState().layerMetadata[id]?.locked);
    element.draggable(!locked);
    if (locked) element.selectize(false);
    else element.selectize({ deepSelect: false, rotationPoint: true }).resize();
  }

  function loadSvgText(svgText, metadata = {}) {
    const safeMarkup = sanitizeSvgMarkup(svgText);
    rootGroup.remove();
    rootGroup = draw.group().svg(safeMarkup);
    const svgRoot = rootGroup.node.querySelector('svg');
    const tree = documentModel.load(svgRoot, metadata);
    loadedMarkup = documentModel.serialize();
    history.snapshot();
    store.setState((state) => {
      state.layers = tree;
      state.layerMetadata = structuredClone(documentModel.metadata);
      state.elements = {};
      const visit = (items) => items.forEach((item) => {
        const node = wrapperFor(item.id);
        const plugin = pluginRegistry.getByNode(node);
        if (plugin) { state.elements[item.id] = plugin.createRigData(node, parseTransform(node)); attachBehavior(node); }
        visit(item.children);
      });
      visit(tree);
      state.svgMarkup = documentModel.serialize();
      state.svgWarnings = [...documentModel.warnings];
    });
  }

  function commitDocument(updateStore = true) {
    const markup = documentModel.serialize();
    loadedMarkup = markup;
    if (updateStore) store.setState((state) => { state.svgMarkup = markup; state.layers = documentModel.getTree(); state.layerMetadata = structuredClone(documentModel.metadata); });
    return markup;
  }

  draw.on('click', () => { store.setState((state) => { state.selectedId = null; }); });
  return {
    async loadSvgFromFile(file) { loadSvgText(await file.text()); },
    loadSvgFromText: loadSvgText,
    serializeCurrentSvg() { return commitDocument(false); },
    getTree() { return documentModel.getTree(); },
    getWarnings() { return [...documentModel.warnings]; },
    reconcileState(state) {
      if (!state.svgMarkup || state.svgMarkup === loadedMarkup) return;
      rootGroup.remove(); rootGroup = draw.group().svg(sanitizeSvgMarkup(state.svgMarkup));
      const svgRoot = rootGroup.node.querySelector('svg');
      documentModel.load(svgRoot, state.layerMetadata || {}); loadedMarkup = documentModel.serialize();
      Object.keys(state.elements || {}).forEach((id) => { const node = wrapperFor(id); if (node) attachBehavior(node); });
    },
    reorder(id, direction) { const changed = documentModel.reorder(id, direction); if (changed) commitDocument(); return changed; },
    setVisibility(id, visible) { const changed = documentModel.setVisibility(id, visible); if (changed) commitDocument(); return changed; },
    setLocked(id, locked) { const changed = documentModel.setLocked(id, locked); if (changed) { commitDocument(); updateElementInteractionState(id); } return changed; },
    setName(id, name) { const changed = documentModel.setName(id, name); if (changed) commitDocument(); return changed; },
    setExpanded(id, expanded) { documentModel.setExpanded(id, expanded); commitDocument(); },
    applyFrame(frame) {
      Object.entries(frame.paths || {}).forEach(([id, d]) => { const node = wrapperFor(id); if (node?.type === 'path') node.attr('d', d); });
      Object.entries(frame.transforms || {}).forEach(([id, transform]) => wrapperFor(id)?.transform({ translateX: transform.x, translateY: transform.y, rotate: transform.rotation, scaleX: transform.scaleX, scaleY: transform.scaleY, originX: transform.pivotX, originY: transform.pivotY }));
      Object.entries(frame.opacity || {}).forEach(([id, opacity]) => wrapperFor(id)?.attr('opacity', opacity));
    },
    applyElementTransform(id, element) {
      const node = wrapperFor(id); if (!node || store.getState().layerMetadata[id]?.locked) return;
      const transform = element.baseTransform || element;
      node.transform({ translateX: transform.x, translateY: transform.y, rotate: transform.rotation, scaleX: transform.scaleX, scaleY: transform.scaleY, originX: transform.pivotX, originY: transform.pivotY });
      documentModel.captureAuthoringNode(id); commitDocument();
    },
    applyPathData(id, d) { const node = wrapperFor(id); if (node?.type !== 'path') return; node.attr('d', d); documentModel.captureAuthoringNode(id); commitDocument(); },
    syncLayerOrder(tree) {
      documentModel.metadata = structuredClone(store.getState().layerMetadata || {});
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
}
