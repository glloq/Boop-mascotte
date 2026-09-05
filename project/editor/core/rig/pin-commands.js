/**
 * Pins, as commands (docs/FACE_CONTROL_RIG.md).
 *
 * A pin is document geometry, like a warp's control point and unlike a puppet
 * handle: a whole drag is one command and one undo step, never one per frame
 * (`core/warp/warp-commands.js` makes the same bargain for the same reason).
 */
import { configureRigPin, createRigPin, driveRigPin, moveRigPin, removeRigPin } from './pin-model.js';

export function createPinCommands(store, history) {
  const run = (type, apply) => { history?.snapshot(); return store.execute({ type, source: 'pins', domains: ['keyforms'], apply }); };
  const guarded = (type, apply) => {
    try { run(type, apply); return { ok: true }; }
    catch (error) { return { ok: false, message: error.message }; }
  };
  return {
    /** Put a pin on a piece of artwork, at a point in its own coordinates. */
    create(target, position, options = {}) {
      let id = null;
      const result = guarded('pins/create', (document) => { id = createRigPin(document, { target, position, ...options }).id; });
      return result.ok ? { ok: true, id } : result;
    },
    /** One drag, one command: the artwork bends live in between. */
    move: (id, position) => guarded('pins/move', (document) => { moveRigPin(document, id, position); }),
    /** Its reach, its softness, its kind, or the axis it is allowed to use. */
    configure: (id, changes) => guarded('pins/configure', (document) => { configureRigPin(document, id, changes); }),
    /** What moves it. */
    drive: (id, motion) => guarded('pins/drive', (document) => { driveRigPin(document, id, motion); }),
    remove: (id) => guarded('pins/remove', (document) => { removeRigPin(document, id); })
  };
}
