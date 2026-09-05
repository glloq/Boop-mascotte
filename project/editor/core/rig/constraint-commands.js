/**
 * Constraints, as commands (docs/FACE_CONTROL_RIG.md, §10).
 *
 * Atomic, like every other command boundary here: one `history.snapshot()`,
 * one `store.execute` over the `constraints` domain — which is the domain the
 * rig's relationships already live in, so the render plan needs no new entry.
 */
import { configureRigConstraint, createRigConstraint, moveRigConstraint, removeRigConstraint } from './constraint-model.js';

export function createConstraintCommands(store, history) {
  const run = (type, apply) => {
    history?.snapshot();
    return store.execute({ type, source: 'constraints', domains: ['constraints', 'rig', 'stateMachine'], apply });
  };
  const guarded = (type, apply) => {
    let made = null;
    try { run(type, (document) => { made = apply(document); }); return { ok: true, id: made?.id ?? null }; }
    catch (error) { return { ok: false, message: error.message }; }
  };
  return {
    create: (target, type, source, options) => guarded('constraints/create', (document) => createRigConstraint(document, { target, type, source, ...options })),
    configure: (id, changes) => guarded('constraints/configure', (document) => configureRigConstraint(document, id, changes)),
    reorder: (id, to) => guarded('constraints/reorder', (document) => { moveRigConstraint(document, id, to); }),
    remove: (id) => guarded('constraints/remove', (document) => { removeRigConstraint(document, id); })
  };
}
