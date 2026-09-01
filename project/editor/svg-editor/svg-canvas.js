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
  let workspace = 'create';
  let selectedId = null;

  const wrapperFor = (id) => {
    const node = documentModel.getNode(id);
    return node ? SVG.adopt(node) : null;
  };

  function clearSelection() {
    if (!selectedId) return;
    const previous=wrapperFor(selectedId);
    previous?.selectize(false);
    previous?.node?.removeAttribute('data-editor-selected');
    selectedId=null;
  }

  function showSelection(id) {
    clearSelection();
    if (!id || workspace === 'animate' || workspace === 'preview') return;
    const element=wrapperFor(id);if(!element)return;
    selectedId=id;element.node.setAttribute('data-editor-selected','true');
    if(workspace==='create'&&!store.getState().layerMetadata[id]?.locked) element.selectize({ deepSelect:false,rotationPoint:true }).resize();
  }

  function attachBehavior(element) {
    element.selectize(false).draggable(workspace==='create'&&!store.getState().layerMetadata[element.id()]?.locked);
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
    element.draggable(workspace==='create'&&!locked);
    showSelection(store.getState().selectedId);
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
    setWorkspace(next) {
      workspace=next;clearSelection();
      Object.keys(store.getState().elements||{}).forEach((id)=>wrapperFor(id)?.draggable(workspace==='create'&&!store.getState().layerMetadata[id]?.locked));
      showSelection(store.getState().selectedId);
    },
    syncSelection(id) { if(id!==selectedId)showSelection(id); },
    fitToCanvas(padding=.1) {
      if(!rootGroup?.node)return 1;
      rootGroup.transform({translateX:0,translateY:0,scaleX:1,scaleY:1});
      const box=rootGroup.node.getBBox(),width=container.clientWidth,height=container.clientHeight;
      if(!box.width||!box.height||!width||!height)return 1;
      const scale=Math.min(width*(1-padding*2)/box.width,height*(1-padding*2)/box.height);
      const x=(width-box.width*scale)/2-box.x*scale,y=(height-box.height*scale)/2-box.y*scale;
      rootGroup.transform({translateX:x,translateY:y,scaleX:scale,scaleY:scale,originX:0,originY:0});
      return scale;
    },
    resetView(){rootGroup.transform({translateX:0,translateY:0,scaleX:1,scaleY:1});return 1;},
    zoomView(factor){const matrix=rootGroup.transform();const scale=Math.max(.2,Math.min(5,(matrix.scaleX||1)*factor));rootGroup.transform({scaleX:scale,scaleY:scale,originX:container.clientWidth/2,originY:container.clientHeight/2});return scale;},
    appendArtwork(markup) {
      const svgRoot=rootGroup.node.querySelector('svg');if(!svgRoot)return false;
      svgRoot.insertAdjacentHTML('beforeend',sanitizeSvgMarkup(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`).replace(/^<svg[^>]*>|<\/svg>$/g,''));
      const tree=documentModel.load(svgRoot,documentModel.metadata);loadedMarkup=documentModel.serialize();
      store.setState((state)=>{state.layers=tree;state.layerMetadata=structuredClone(documentModel.metadata);const visit=(items)=>items.forEach((item)=>{if(!state.elements[item.id]){const node=wrapperFor(item.id),plugin=pluginRegistry.getByNode(node);if(plugin){state.elements[item.id]=plugin.createRigData(node,parseTransform(node));attachBehavior(node);}}visit(item.children);});visit(tree);state.svgMarkup=loadedMarkup;});
      return true;
    },
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
