/**
 * Face states and their correctives, as commands (docs/FACE_SVG_STATES.md).
 *
 * A corrective is a shape key, so these write the `keyforms` domain the shape
 * keys already live in, and the `rig` domain too when a capture has to record
 * the element's rest outline beside it (`core/rig/pin-commands.js` makes the
 * same bargain for the same reason).
 *
 * Every one is tried on a copy first: a corrective the editor refuses -- an
 * outline posed into a different topology, most often -- costs no undo step
 * and leaves no history entry claiming something happened.
 */
import {
  captureFaceCorrective, clearFaceCorrectives, copyFaceCorrectives,
  mirrorFaceCorrectives, removeFaceCorrective, setFaceCorrectiveWeight
} from './face-correctives.js';
import { installVisemes } from './face-state-install.js';

export function createFaceStateCommands(store, history) {
  const run = (type, apply, domains = ['keyforms']) => {
    history?.snapshot();
    let result;
    store.execute({ type, source: 'face-states', domains, apply: (document) => { result = apply(document); } });
    return result;
  };
  /**
   * `apply` returns `{ ok, ... }` rather than throwing, because the thing that
   * goes wrong here is an author's geometry rather than a programming error --
   * so the dry run reads the result instead of catching.
   */
  const guarded = (type, apply, domains) => {
    let dry;
    try { dry = apply(structuredClone(store.getDocument())); }
    catch (error) { return { ok: false, message: error.message }; }
    if (dry && dry.ok === false) return dry;
    try { return run(type, apply, domains) ?? { ok: true }; }
    catch (error) { return { ok: false, message: error.message }; }
  };
  return {
    /**
     * Record a posed outline as one state's corrective.
     *
     * The base artwork is never replaced: what is stored is the *difference*
     * between the outline as drawn and the outline as posed, which is the
     * whole distinction the panel is built around (EDIT BASE against EDIT
     * CORRECTIVE). The element's `restPath` is written only when it had none,
     * and it is the authored outline rather than the posed one.
     */
    capture: (options) => guarded('face-state/capture', (document) => captureFaceCorrective(document, options), ['keyforms', 'rig']),
    /** Turn one up or down, 0 … 1, without recapturing it. */
    setWeight: (identity, weight) => guarded('face-state/weight', (document) => { setFaceCorrectiveWeight(document, identity, weight); return { ok: true }; }),
    /** Forget one, leaving the state as the plain composition of its controls. */
    remove: (identity) => guarded('face-state/remove', (document) => ({ ok: removeFaceCorrective(document, identity), message: 'That corrective is already gone.' })),
    /** Forget every corrective of one slot, in one step. */
    clear: (slot) => guarded('face-state/clear', (document) => {
      const count = clearFaceCorrectives(document, slot);
      return count ? { ok: true, count } : { ok: false, message: 'There is nothing captured here yet.' };
    }),
    /**
     * The other eye's, from this one's.
     *
     * `mirror` reflects the delta about the vertical axis, which is right for
     * two lids drawn from one shape slid across the face and wrong for two
     * drawn as mirror images of each other -- so the panel offers both and the
     * author picks by looking.
     */
    copy: (options) => guarded('face-state/copy', (document) => {
      const result = (options.mirror ? mirrorFaceCorrectives : copyFaceCorrectives)(document, options);
      return result.copied ? { ok: true, ...result } : { ok: false, message: 'There is nothing on that side to copy.', ...result };
    }),
    /**
     * Give the mouth the speech shapes.
     *
     * Expression records, on the `expressions` domain, because that is what a
     * viseme is (docs/VISEME_SYSTEM.md) -- and the reason a mouth can say
     * something while it smiles.
     */
    installVisemes: (options) => guarded('face-state/install-visemes', (document) => installVisemes(document, options), ['expressions'])
  };
}
