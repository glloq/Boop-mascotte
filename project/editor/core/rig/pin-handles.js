/**
 * Dragging a pin on the canvas (docs/FACE_CONTROL_RIG.md, CR-20).
 *
 * A pin is placed where the artwork actually is, so it has to be placed *on*
 * the artwork. It follows the warp's control points exactly
 * (`core/warp/warp-handles.js`), because it is the same kind of thing and the
 * same distinction applies: the puppet handles drive parameters, live and
 * non-destructive, while a pin's position is a **document** field — so a whole
 * drag is one command and one undo step, never one per frame.
 *
 * What is different from a warp is what an author is looking at while they
 * drag. A warp bends the artwork under the pointer; a pin at rest bends
 * nothing, and what matters is **what it will hold**. So the preview is the
 * pin's own reach, and the count of points inside it — a pin holding no points
 * is a pin in the wrong place, and that is the mistake this gesture exists to
 * make visible.
 */
import { compilePinTarget, normalizeRigPins, pinInfluence, pinsFor } from '../../../runtime/runtime.js';
import { pinOverlay } from './pin-model.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 100) / 100;

/** The ellipse a pin reaches over, in the artwork's own coordinates. */
export const pinReachEllipse = (pin) => (pin
  ? { cx: pin.position.x, cy: pin.position.y, rx: pin.radius.x, ry: pin.radius.y }
  : null);

/** What a pin would hold, were it here: the number that says a radius is right. */
export function pinReachAt(document, elementId, pinId, position) {
  const restPath = document?.elements?.[elementId]?.restPath;
  const pins = pinsFor(normalizeRigPins(document), elementId);
  const moved = pins.map((pin) => (pin.id === pinId ? { ...pin, position } : pin));
  if (!restPath || !moved.length) return 0;
  try {
    return pinInfluence(compilePinTarget(restPath, moved), moved).find((item) => item.id === pinId)?.reach ?? 0;
  } catch { return 0; }
}

export function createPinGesture({ document: read = () => ({}), commands = {} } = {}) {
  let drag = null;

  return {
    active: () => (drag ? { target: drag.elementId, id: drag.id, moved: drag.moved } : null),
    /** What to draw right now: the pin where the pointer has it, or nothing. */
    preview: () => (drag ? drag.overlay : null),
    begin(elementId, id) {
      const overlay = pinOverlay(read(), elementId);
      const pin = overlay?.pins.find((item) => item.id === id);
      if (!pin) return null;
      drag = { elementId, id, overlay, moved: false, point: null };
      return overlay;
    },
    to(point) {
      if (!drag || !point) return null;
      drag.point = { x: round(point.x), y: round(point.y) };
      drag.moved = true;
      // The reach follows the pointer, and so does what it would hold: an
      // author dragging a pin is deciding what it grabs, not what it bends.
      drag.overlay = {
        ...drag.overlay,
        pins: drag.overlay.pins.map((pin) => (pin.id === drag.id
          ? { ...pin, position: drag.point, reach: pinReachAt(read(), drag.elementId, drag.id, drag.point) }
          : pin))
      };
      return drag.overlay;
    },
    /** One command for the whole gesture. A drag that never moved writes nothing. */
    commit() {
      if (!drag) return false;
      const { id, point, moved } = drag;
      drag = null;
      return moved && point ? Boolean(commands.move?.(id, point)?.ok) : false;
    },
    /** Give up. The document was never written to, so there is nothing to undo. */
    cancel() {
      const had = Boolean(drag);
      drag = null;
      return had;
    },
    /** A keyboard nudge: the same edit, in artwork units, committed on the spot. */
    nudge(elementId, id, { dx = 0, dy = 0 } = {}) {
      if (drag) return false;
      const pin = pinOverlay(read(), elementId)?.pins.find((item) => item.id === id);
      if (!pin) return false;
      return Boolean(commands.move?.(id, { x: round(pin.position.x + number(dx)), y: round(pin.position.y + number(dy)) })?.ok);
    }
  };
}
