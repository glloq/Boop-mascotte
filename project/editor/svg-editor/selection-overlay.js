/**
 * Selection overlay (docs/SELECTION_GIZMO.md).
 *
 * A separate SVG layer drawn on top of the artwork. It is never a child of the
 * drawing, never has an opaque fill, and never intercepts a pointer event it
 * was not asked for — the problem it replaces is exactly an overlay that hid
 * the thing being edited.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

const CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  rotate: 'grab', pivot: 'move', body: 'move'
};

export function createSelectionOverlay(parent) {
  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('data-gizmo', 'overlay');
  layer.setAttribute('pointer-events', 'none');
  layer.setAttribute('fill', 'none');
  layer.hidden = true;
  parent.append(layer);

  const outline = node('polygon', { 'data-gizmo-part': 'outline', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
  const stem = node('line', { 'data-gizmo-part': 'stem', stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
  const rotate = node('circle', { 'data-gizmo-handle': 'rotate', fill: 'var(--surface, #fff)', stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
  const pivot = node('g', { 'data-gizmo-handle': 'pivot' });
  const pivotRing = node('circle', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
  const pivotCrossX = node('line', { stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
  const pivotCrossY = node('line', { stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
  pivot.append(pivotRing, pivotCrossX, pivotCrossY);
  const handles = {};
  layer.append(outline, stem, rotate);
  for (const name of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    handles[name] = node('rect', { 'data-gizmo-handle': name, fill: 'var(--surface, #fff)', stroke: 'currentColor', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
    layer.append(handles[name]);
  }
  layer.append(pivot);

  return {
    node: layer,
    hide() { layer.hidden = true; layer.setAttribute('visibility', 'hidden'); },
    /** @param {object} model from `gizmoModel` */
    render(model, { mode = 'move' } = {}) {
      if (!model) return this.hide();
      layer.hidden = false;
      layer.removeAttribute('visibility');
      layer.dataset.gizmoMode = mode;
      const r = model.handleRadius;
      outline.setAttribute('points', model.outline.map((point) => `${round(point.x)},${round(point.y)}`).join(' '));
      stem.setAttribute('x1', round(model.handles.n.x)); stem.setAttribute('y1', round(model.handles.n.y));
      stem.setAttribute('x2', round(model.rotate.x)); stem.setAttribute('y2', round(model.rotate.y));
      rotate.setAttribute('cx', round(model.rotate.x)); rotate.setAttribute('cy', round(model.rotate.y)); rotate.setAttribute('r', round(r));
      for (const [name, point] of Object.entries(model.handles)) {
        const handle = handles[name];
        handle.setAttribute('x', round(point.x - r)); handle.setAttribute('y', round(point.y - r));
        handle.setAttribute('width', round(r * 2)); handle.setAttribute('height', round(r * 2));
      }
      pivotRing.setAttribute('cx', round(model.pivot.x)); pivotRing.setAttribute('cy', round(model.pivot.y)); pivotRing.setAttribute('r', round(r * 1.4));
      pivotCrossX.setAttribute('x1', round(model.pivot.x - r * 2)); pivotCrossX.setAttribute('y1', round(model.pivot.y));
      pivotCrossX.setAttribute('x2', round(model.pivot.x + r * 2)); pivotCrossX.setAttribute('y2', round(model.pivot.y));
      pivotCrossY.setAttribute('x1', round(model.pivot.x)); pivotCrossY.setAttribute('y1', round(model.pivot.y - r * 2));
      pivotCrossY.setAttribute('x2', round(model.pivot.x)); pivotCrossY.setAttribute('y2', round(model.pivot.y + r * 2));
    },
    destroy() { layer.remove(); }
  };
}

export function cursorForHandle(handle) {
  return CURSORS[handle] || 'default';
}

function node(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}
