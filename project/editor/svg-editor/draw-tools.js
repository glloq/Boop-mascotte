/**
 * The drawing tools, as one controller (docs/VECTOR_EDITING.md).
 *
 * ```text
 *   pointer ──► artwork point ──► tool state ──► preview spec ──► canvas
 *                                      │
 *                                      └──► commit spec ──► artwork
 * ```
 *
 * Every tool is a small state machine over pointer events in **artwork
 * units**: the canvas turns a pointer into a point and a spec into a preview
 * or a shape, and knows nothing about pens, stars or text. That split is what
 * keeps this file free of the DOM and the canvas free of drawing rules.
 *
 * Tools: `pen` (click for a corner, drag for a curve, click the first point to
 * close, Backspace removes the last point, Enter or a double-click finishes),
 * `line`, `rect`, `ellipse`, `polygon` (a star with the option on) and `text`.
 * Shift constrains a line or a pen segment to 45°, squares a rectangle, rounds
 * an ellipse into a circle and locks a polygon's rotation; Alt draws a shape
 * out from its centre.
 */
import { anchorsToPath, constrainAngle, linePath, mirrorHandle, polygonPath, shapeBox } from '../core/path/path-build.js';

export const DRAW_TOOLS = Object.freeze(['pen', 'line', 'rect', 'ellipse', 'polygon', 'text']);

/** Every shape needs *something* visible; a fill and a stroke both set to none get this stroke. */
const FALLBACK_STROKE = '#1f2937';

const distance = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));

/**
 * @param {object} deps
 * @param {(event: PointerEvent) => {x: number, y: number}|null} deps.point  artwork point under the pointer
 * @param {(spec: object|null) => void} deps.preview        draw (or clear) what is being drawn
 * @param {(spec: object) => string|null} deps.commit       turn a spec into artwork; returns the new id
 * @param {() => object} deps.options                       fill, stroke, strokeWidth, sides, star, inner, fontSize, cornerRadius
 * @param {(point: {x, y}) => {x, y}} [deps.snap]           grid snapping, when it is on
 * @param {() => number} [deps.tolerance]                    how far a "same point" reaches, in artwork units
 * @param {(message: string|null) => void} [deps.status]    the mode banner
 */
export function createDrawTools({ point, preview, commit, options, snap = (p) => p, tolerance = () => 6, status = () => {} }) {
  let drawing = null;

  const paint = (closed) => {
    const opts = options() || {};
    const fill = closed ? (opts.fill || 'none') : 'none';
    let stroke = opts.stroke || 'none';
    if (fill === 'none' && stroke === 'none') stroke = FALLBACK_STROKE;
    const width = Math.max(0, Number(opts.strokeWidth) || 0) || (stroke !== 'none' ? 2 : 0);
    const attrs = { fill };
    if (stroke !== 'none') Object.assign(attrs, { stroke, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    return attrs;
  };

  /** Anchors drawn as a pen preview, with the handles of the point being placed. */
  const penSpec = (anchors, cursor, { closing = false } = {}) => {
    const list = cursor ? [...anchors, { x: cursor.x, y: cursor.y }] : anchors;
    if (list.length < 2 && !closing) return list.length ? { name: 'circle', label: 'Path', attrs: { cx: list[0].x, cy: list[0].y, r: 1.5, fill: FALLBACK_STROKE } } : null;
    const d = anchorsToPath(list, { close: closing });
    const guides = [];
    for (const anchor of anchors.slice(-2)) {
      for (const side of ['in', 'out']) {
        const handle = anchor[side];
        if (!handle) continue;
        guides.push({ name: 'line', attrs: { x1: anchor.x, y1: anchor.y, x2: handle.x, y2: handle.y, class: 'draw-guide' } });
        guides.push({ name: 'circle', attrs: { cx: handle.x, cy: handle.y, r: 2, class: 'draw-guide-dot' } });
      }
    }
    if (anchors.length > 2) guides.push({ name: 'circle', attrs: { cx: anchors[0].x, cy: anchors[0].y, r: 3, class: closing ? 'draw-guide-close draw-guide-close-ready' : 'draw-guide-close' } });
    return { name: 'path', label: 'Path', attrs: { d, ...paint(closing) }, guides };
  };

  const shapeSpec = (tool, start, end, modifiers) => {
    const box = shapeBox(start, end, { square: modifiers.shift, fromCenter: modifiers.alt });
    if (tool === 'ellipse') return { name: 'ellipse', label: 'Ellipse', attrs: { cx: box.x + box.width / 2, cy: box.y + box.height / 2, rx: box.width / 2, ry: box.height / 2, ...paint(true) } };
    const radius = Math.max(0, Number(options()?.cornerRadius) || 0);
    return { name: 'rect', label: 'Rectangle', attrs: { x: box.x, y: box.y, width: box.width, height: box.height, ...(radius ? { rx: Math.min(radius, box.width / 2, box.height / 2) } : {}), ...paint(true) } };
  };

  const polygonSpec = (center, cursor, modifiers) => {
    const opts = options() || {};
    const radius = distance(center, cursor);
    let rotation = (Math.atan2(cursor.y - center.y, cursor.x - center.x) * 180) / Math.PI;
    if (modifiers.shift) rotation = Math.round(rotation / 15) * 15;
    const star = Boolean(opts.star);
    const d = polygonPath(center, radius, opts.sides || 5, { star, inner: opts.inner ?? 0.5, rotation });
    return d ? { name: 'path', label: star ? 'Star' : 'Polygon', attrs: { d, ...paint(true) } } : null;
  };

  const lineSpec = (start, end) => ({ name: 'path', label: 'Line', attrs: { d: linePath(start, end), ...paint(false) } });

  const textSpec = (at) => {
    const opts = options() || {};
    const fill = opts.fill && opts.fill !== 'none' ? opts.fill : FALLBACK_STROKE;
    return { name: 'text', label: 'Text', text: String(opts.text || 'Text'), attrs: { x: at.x, y: at.y, 'font-size': Math.max(1, Number(opts.fontSize) || 24), 'font-family': 'Inter, system-ui, sans-serif', fill } };
  };

  const modifiersOf = (event) => ({ shift: Boolean(event?.shiftKey), alt: Boolean(event?.altKey) });

  /** Finish the pen: trailing anchors a double-click stacked on the same spot are dropped. */
  function finishPen({ close = false } = {}) {
    if (drawing?.tool !== 'pen') return null;
    const anchors = [...drawing.anchors];
    while (anchors.length > 1 && distance(anchors.at(-1), anchors.at(-2)) < tolerance()) anchors.pop();
    const spec = anchors.length > 1 ? penSpec(anchors, null, { closing: close && anchors.length > 2 }) : null;
    cancel();
    return spec ? commit({ name: spec.name, label: spec.label, attrs: spec.attrs }) : null;
  }

  function cancel() {
    const had = Boolean(drawing);
    drawing = null;
    preview(null);
    status(null);
    return had;
  }

  return {
    /** @returns {boolean} whether the tool took the press */
    pointerDown(event, tool) {
      if (!DRAW_TOOLS.includes(tool)) return false;
      const raw = point(event);
      if (!raw) return false;
      const modifiers = modifiersOf(event);
      if (tool === 'pen') {
        const anchors = drawing?.tool === 'pen' ? drawing.anchors : [];
        const first = anchors[0];
        if (first && anchors.length > 2 && distance(raw, first) < tolerance()) { finishPen({ close: true }); return true; }
        const last = anchors.at(-1);
        const placed = snap(modifiers.shift && last ? constrainAngle(last, raw) : raw);
        const anchor = { x: placed.x, y: placed.y, in: null, out: null };
        drawing = { tool: 'pen', anchors: [...anchors, anchor], pending: anchor, pressed: placed };
        preview(penSpec(drawing.anchors, null));
        status(anchors.length ? 'Click for a corner, drag for a curve. Click the first point to close, Enter or double-click to finish, Backspace removes the last point.' : 'Click to place the next point, drag to pull a curve out of it.');
        return true;
      }
      if (tool === 'text') {
        const id = commit(textSpec(snap(raw)));
        cancel();
        return Boolean(id);
      }
      drawing = { tool, start: snap(raw), moved: false, modifiers };
      return true;
    },
    pointerMove(event) {
      if (!drawing) return false;
      const raw = point(event);
      if (!raw) return false;
      const modifiers = modifiersOf(event);
      if (drawing.tool === 'pen') {
        const { anchors, pending } = drawing;
        if (pending) {
          // Still pressed: pulling the handle out of the point just placed.
          if (distance(raw, drawing.pressed) >= tolerance() / 2 || pending.out) {
            const out = snap(modifiers.shift ? constrainAngle(pending, raw) : raw);
            pending.out = out;
            pending.in = mirrorHandle(pending, out);
          }
          preview(penSpec(anchors, null));
          return true;
        }
        const last = anchors.at(-1);
        const cursor = snap(modifiers.shift && last ? constrainAngle(last, raw) : raw);
        const closing = anchors.length > 2 && distance(raw, anchors[0]) < tolerance();
        preview(closing ? penSpec(anchors, null, { closing: true }) : penSpec(anchors, cursor));
        return true;
      }
      if (!drawing.moved && distance(raw, drawing.start) < tolerance() / 2) return true;
      drawing.moved = true;
      drawing.modifiers = modifiers;
      drawing.end = snap(drawing.tool === 'line' && modifiers.shift ? constrainAngle(drawing.start, raw) : raw);
      preview(drawing.tool === 'line' ? lineSpec(drawing.start, drawing.end)
        : drawing.tool === 'polygon' ? polygonSpec(drawing.start, drawing.end, modifiers)
          : shapeSpec(drawing.tool, drawing.start, drawing.end, modifiers));
      return true;
    },
    pointerUp(event) {
      if (!drawing) return false;
      if (drawing.tool === 'pen') {
        // The point is placed; its handle, if any, was pulled while pressed.
        drawing.pending = null;
        preview(penSpec(drawing.anchors, point(event) || null));
        return true;
      }
      // A press that never moved is a press, not a drawing.
      const spec = drawing.moved
        ? (drawing.tool === 'line' ? lineSpec(drawing.start, drawing.end)
          : drawing.tool === 'polygon' ? polygonSpec(drawing.start, drawing.end, drawing.modifiers)
            : shapeSpec(drawing.tool, drawing.start, drawing.end, drawing.modifiers))
        : null;
      cancel();
      if (spec) commit(spec);
      return true;
    },
    /** A double-click finishes a pen run. */
    doubleClick() { return drawing?.tool === 'pen' ? finishPen() !== null || true : false; },
    /** Enter finishes a pen run; Backspace takes the last point back. */
    keyDown(event) {
      if (drawing?.tool !== 'pen') return false;
      if (event.key === 'Enter') { event.preventDefault(); finishPen(); return true; }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        drawing.anchors.pop();
        drawing.pending = null;
        if (!drawing.anchors.length) { cancel(); return true; }
        preview(penSpec(drawing.anchors, null));
        return true;
      }
      return false;
    },
    finish() { return drawing?.tool === 'pen' ? finishPen() : null; },
    cancel,
    isDrawing: () => Boolean(drawing),
    /** For tests and the status line: what is being drawn right now. */
    state: () => (drawing ? { tool: drawing.tool, anchors: drawing.anchors ? drawing.anchors.length : undefined, moved: drawing.moved } : null)
  };
}
