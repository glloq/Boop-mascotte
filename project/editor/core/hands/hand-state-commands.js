/**
 * The four things an author does to a hand's states, as one document
 * revision each (UIR-05, docs/UIR_REFACTOR_BASELINE.md).
 *
 * Every one of them touches artwork *and* rig — a state is a drawing and an
 * entry in the library that indexes it — so every one declares both domains and
 * takes one undo step. Half-applying one is how a hand ends up with an entry
 * pointing at a drawing that is not there.
 */
import { deleteHandState, duplicateHandState, mirrorHandState, renameHandState } from './hand-state-model.js';

/** Artwork, its records, the hands and the parameter that indexes them. */
const FIELDS = Object.freeze(['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states']);
const DOMAINS = Object.freeze(['artwork', 'layers', 'hands', 'rig', 'stateMachine']);

export function createHandStateCommands(store, history, { measure = null } = {}) {
  const run = (type, operation) => {
    const draft = structuredClone(store.getDocument());
    if (operation(draft) === false) return false;
    history?.snapshot();
    store.execute({ type, source: 'hand-states', domains: DOMAINS, apply: (document) => { for (const field of FIELDS) document[field] = draft[field]; } });
    return true;
  };
  const options = () => ({ measure: measure || undefined });
  return {
    rename: (side, id, name) => run('hand-state/rename', (draft) => renameHandState(draft, side, id, name)),
    remove: (side, id) => run('hand-state/delete', (draft) => deleteHandState(draft, side, id)),
    duplicate: (side, id) => run('hand-state/duplicate', (draft) => duplicateHandState(draft, side, id, options())),
    /** The other hand gains this drawing, mirrored, and owns it from then on. */
    mirror: (side, id) => run('hand-state/mirror', (draft) => mirrorHandState(draft, side, id, options()))
  };
}
