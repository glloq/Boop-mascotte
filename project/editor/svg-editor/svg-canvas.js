import SVG from 'svg.js';
import 'svg.select.js';
import 'svg.resize.js';
import 'svg.draggable.js';

function parseTransform(element) {
  const matrix = element.transform();
  return {
    x: matrix.translateX || 0,
    y: matrix.translateY || 0,
    rotation: matrix.rotate || 0,
    scaleX: matrix.scaleX || 1,
    scaleY: matrix.scaleY || 1,
    pivotX: matrix.originX || 0,
    pivotY: matrix.originY || 0
  };
}

export function createSvgCanvas(container, store, history, pluginRegistry) {
  const draw = SVG().addTo(container).size('100%', '100%');
  let rootGroup = draw.group();

  function attachBehavior(element) {
    element.selectize({ deepSelect: false, rotationPoint: true }).resize().draggable();
    element.on('click', (event) => {
      event.stopPropagation();
      store.setState((state) => { state.selectedId = element.id(); });
    });
    element.on('dragend resize', () => {
      const id = element.id();
      history.snapshot();
      store.setState((state) => {
        state.elements[id] = { ...(state.elements[id] || {}), ...parseTransform(element) };
      });
    });
  }

  function syncLayerOrder(layerIds) {
    layerIds.forEach((id) => {
      const node = rootGroup.findOne(`#${id}`);
      if (node) node.front();
    });
  }

  function loadSvgText(svgText) {
    rootGroup.remove();
    rootGroup = draw.group().svg(svgText);
    history.snapshot();
    store.setState((state) => {
      state.svgMarkup = svgText;
      state.layers = [];
      state.elements = {};
      rootGroup.find('[id]').forEach((node, index) => {
        const id = node.id() || `layer-${index}`;
        if (!node.id()) node.id(id);
        state.layers.push(id);
        const transform = parseTransform(node);
        const plugin = pluginRegistry.getByNode(node);
        state.elements[id] = plugin.createRigData(node, transform);
        attachBehavior(node);
      });
    });
  }

  draw.on('click', () => { store.setState((state) => { state.selectedId = null; }); });

  return {
    async loadSvgFromFile(file) { loadSvgText(await file.text()); },
    loadSvgFromText(svgText) { loadSvgText(svgText); },

    applyFrame(frame) {
      Object.entries(frame.paths || {}).forEach(([id, d]) => {
        const node = rootGroup.findOne(`#${id}`);
        if (node && node.type === 'path') node.attr('d', d);
      });
      Object.entries(frame.transforms || {}).forEach(([id, transform]) => {
        const node = rootGroup.findOne(`#${id}`);
        if (!node) return;
        node.transform({
          translateX: transform.x,
          translateY: transform.y,
          rotate: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          originX: transform.pivotX,
          originY: transform.pivotY
        });
      });
    },
    applyElementTransform(id, transform) {
      const node = rootGroup.findOne(`#${id}`);
      if (!node) return;
      node.transform({
        translateX: transform.x,
        translateY: transform.y,
        rotate: transform.rotation,
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
        originX: transform.pivotX,
        originY: transform.pivotY
      });
    },
    applyPathData(id, d) {
      const node = rootGroup.findOne(`#${id}`);
      if (!node || node.type !== 'path') return;
      node.attr('d', d);
    },
    syncLayerOrder,
    getNode(id) { return rootGroup.findOne(`#${id}`); }
  };
}
