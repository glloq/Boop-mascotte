/**
 * Transform gizmo controller (docs/SELECTION_GIZMO.md).
 *
 * Owns one drag at a time and turns it into **one** history command:
 *
 * ```text
 * pointerdown → transient changes → pointermove… → pointerup → ONE command
 * ```
 *
 * The geometry lives in `gizmo-geometry.js` and the drawing in
 * `selection-overlay.js`; this file is only the wiring between a pointer, that
 * geometry, and the store.
 */
import {
  gizmoModel, hitTestGizmo, beginGizmoDrag, updateGizmoDrag, cancelGizmoDrag,
  GIZMO_MODES, GIZMO_SHORTCUTS, GIZMO_ALIASES, CORNER_HANDLES, EDGE_HANDLES
} from './gizmo-geometry.js';
import { createSelectionOverlay, cursorForHandle } from './selection-overlay.js';

const SCALE_HANDLES = new Set([...CORNER_HANDLES, ...EDGE_HANDLES]);

/**
 * @param {object} options
 * @param {Element} options.layer     where the overlay is drawn
 * @param {Element} options.surface   where pointer events are listened for
 * @param {() => ({ id, box, transform, pose, scale }|null)} options.getTarget
 *        `transform` is what the piece is *drawn* with and `pose` what the
 *        session adds to its authored transform, so `onCommit` can author the
 *        one without the other.
 * @param {(transform: object) => void} options.onPreview  transient, no history
 * @param {(transform: object) => void} options.onCommit   one history command
 * @param {(point: {x,y}) => {x,y}} options.toCanvas       client → canvas point
 * @param {(event: PointerEvent) => boolean} [options.canDragBody]
 *        Whether a press inside the box should drag the selection. Handles are
 *        always the gizmo's; the body is not, when the press lands on other
 *        artwork the author is more likely trying to select.
 * @param {() => boolean} [options.aliasKeys]
 *        Whether `R` `S` `P` may also pick a mode. True on a surface with no
 *        drawing tools, where those letters mean nothing else (`GIZMO_ALIASES`).
 */
export function createTransformGizmo({ layer, surface, getTarget, onPreview, onCommit, toCanvas, canDragBody = () => true, aliasKeys = () => false }) {
  const overlay = createSelectionOverlay(layer);
  let mode = 'move';
  let drag = null;
  let hover = null;
  let destroyed = false;

  const target = () => (destroyed ? null : getTarget());
  const modelFor = (item) => item && gizmoModel(item.box, item.transform, { scale: item.scale || 1 });

  function render() {
    const item = target();
    if (!item) { overlay.hide(); return; }
    overlay.render(modelFor(item), { mode });
  }

  function setCursor(handle) {
    if (hover === handle) return;
    hover = handle;
    if (surface) surface.style.cursor = handle ? cursorForHandle(handle) : '';
  }

  /** The mode a handle implies, so grabbing a corner scales even in Move. */
  function modeForHandle(handle) {
    if (handle === 'rotate') return 'rotate';
    if (handle === 'pivot') return mode === 'pivot' ? 'pivot' : 'pivot';
    if (SCALE_HANDLES.has(handle)) return 'scale';
    return mode === 'rotate' || mode === 'scale' || mode === 'pivot' ? mode : 'move';
  }

  function onPointerDown(event) {
    if (event.button !== 0) return false;
    const item = target();
    if (!item) return false;
    // The left button only. A right-click used to start a drag and capture the
    // pointer on the canvas, which then swallowed the next click anywhere on
    // it -- including the context menu the right-click had just opened.
    if (event.button !== 0) return false;
    const point = toCanvas(event);
    const handle = hitTestGizmo(modelFor(item), point, { scale: item.scale || 1, mode });
    if (!handle) return false;
    const dragMode = modeForHandle(handle);
    if (dragMode === 'move' && handle !== 'body') return false;
    if (handle === 'body' && !canDragBody(event)) return false;
    drag = beginGizmoDrag({ mode: dragMode, handle, transform: item.transform, box: item.box, point, scale: item.scale || 1 });
    drag.id = item.id;
    // What the session was adding to the authored transform when the drag
    // began, so the commit can take it back out again rather than author it
    // (`core/artwork/pose-transform.js`). Frozen here on purpose: the pose must
    // not be re-read mid-drag, because the drag itself is writing the DOM.
    drag.pose = item.pose || null;
    /**
     * A press on a **handle** is a drag and nothing else, so it is claimed here.
     *
     * A press on the **body** might still be a click, and claiming it kills the
     * click two ways over: `preventDefault` on `pointerdown` suppresses the
     * compatibility mouse events that follow, and `setPointerCapture` sends the
     * ones that survive to the capturing element instead of the artwork. So a
     * selected group swallowed every press inside it, and the click that means
     * "select the shape under the pointer" never arrived.
     *
     * The first `pointermove` claims it instead, which is the moment a press
     * becomes a drag (docs/SELECTION_GIZMO.md).
     */
    if (handle === 'body') drag.unclaimed = event.pointerId;
    else { surface?.setPointerCapture?.(event.pointerId); event.preventDefault(); }
    return true;
  }

  function onPointerMove(event) {
    const item = target();
    if (!drag) {
      if (item) setCursor(hitTestGizmo(modelFor(item), toCanvas(event), { scale: item.scale || 1, mode }));
      return false;
    }
    // Transient only: history sees nothing until the pointer is released.
    drag.moved = true;
    // A body press becomes a drag here, so this is where it is claimed.
    if (drag.unclaimed !== undefined) { surface?.setPointerCapture?.(drag.unclaimed); drag.unclaimed = undefined; }
    onPreview(updateGizmoDrag(drag, toCanvas(event), { shift: event.shiftKey }), drag);
    render();
    event.preventDefault();
    return true;
  }

  function onPointerUp(event) {
    if (!drag) return false;
    const finished = drag;
    drag = null;
    surface?.releasePointerCapture?.(event?.pointerId);
    if (!finished.moved) { onPreview(cancelGizmoDrag(finished), finished); render(); return false; }
    // Exactly one command for the whole gesture.
    onCommit(updateGizmoDrag(finished, toCanvas(event), { shift: event?.shiftKey }), finished);
    render();
    return true;
  }

  function cancel() {
    if (!drag) return false;
    const cancelled = drag;
    drag = null;
    onPreview(cancelGizmoDrag(cancelled), cancelled);
    render();
    return true;
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') return cancel();
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    // The familiar letters too, but only where no drawing tool has claimed
    // them: the caller says whether this surface has any (`aliasKeys`).
    const key = String(event.key).toLowerCase();
    const next = GIZMO_SHORTCUTS[key] || (aliasKeys() ? GIZMO_ALIASES[key] : undefined);
    if (!next || drag) return false;
    mode = next;
    render();
    return true;
  }

  return {
    get mode() { return mode; },
    get dragging() { return Boolean(drag); },
    setMode(next) { if (!GIZMO_MODES.includes(next)) return false; mode = next; render(); return true; },
    render,
    onPointerDown, onPointerMove, onPointerUp, onKeyDown, cancel,
    destroy() { destroyed = true; drag = null; setCursor(null); overlay.destroy(); }
  };
}
