/**
 * Pins, as commands (docs/FACE_CONTROL_RIG.md).
 *
 * A pin is document geometry, like a warp's control point and unlike a puppet
 * handle: a whole drag is one command and one undo step, never one per frame
 * (`core/warp/warp-commands.js` makes the same bargain for the same reason).
 */
import { configureRigPin, createRigPin, driveRigPin, groupRigPins, mirrorRigPin, moveRigPin, removeRigPin } from './pin-model.js';

export function createPinCommands(store, history) {
  const run = (type, apply, domains = ['keyforms']) => { history?.snapshot(); return store.execute({ type, source: 'pins', domains, apply }); };
  // Tried on a copy first: a pin the rig refuses costs no undo step, and no
  // history entry says a thing happened when nothing did.
  const guarded = (type, apply, domains) => {
    try { apply(structuredClone(store.getDocument())); }
    catch (error) { return { ok: false, message: error.message }; }
    try { run(type, apply, domains); return { ok: true }; }
    catch (error) { return { ok: false, message: error.message }; }
  };
  /**
   * A pin holds a drawn path, and a path drawn or imported in the editor has
   * no rest outline of its own until something needs one — the template's
   * paths carry theirs. The caller hands over the authored `d`, and the pin
   * is placed on it in the same undo step; the `rig` domain is told too,
   * because the element record changed.
   */
  const withRest = (document, target, restPath) => {
    const element = document.elements?.[target];
    if (element && typeof element.restPath !== 'string' && typeof restPath === 'string' && restPath.trim()) element.restPath = restPath;
  };
  return {
    /** Put a pin on a piece of artwork, at a point in its own coordinates. */
    create(target, position, { restPath = null, ...options } = {}) {
      let id = null;
      const result = guarded('pins/create', (document) => { withRest(document, target, restPath); id = createRigPin(document, { target, position, ...options }).id; }, restPath ? ['keyforms', 'rig'] : undefined);
      return result.ok ? { ok: true, id } : result;
    },
    /** The same pin on the other side, reflected about a middle in the artwork's own units. */
    mirror(id, options = {}) {
      let twin = null;
      const result = guarded('pins/mirror', (document) => { if (options.target && options.restPath) withRest(document, options.target, options.restPath); twin = mirrorRigPin(document, id, options).id; }, options.restPath ? ['keyforms', 'rig'] : undefined);
      return result.ok ? { ok: true, id: twin } : result;
    },
    /** Several pins moved by one movement, created if the rig has not got it. */
    group(ids, motion) {
      let made = null;
      const result = guarded('pins/group', (document) => { made = groupRigPins(document, ids, motion); }, ['keyforms', 'rig', 'stateMachine']);
      return result.ok ? { ok: true, ...made } : result;
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
