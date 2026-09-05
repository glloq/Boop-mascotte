/**
 * Authoring constraints (docs/FACE_CONTROL_RIG.md, §10, CR-25, CR-26).
 *
 * The runtime knows how to keep a relationship true (`runtime/rig-constraints.js`).
 * This is the half an author touches: saying which piece of artwork must stay
 * in a relationship to which, what kind of relationship it is, and — the part
 * that makes it an animator's tool rather than a rigger's switch — the movement
 * that fades it in and out.
 *
 * ```text
 *  parent        copy where that one is
 *  distance      stay this far from it
 *  orientation   face the same way it does
 *  axis          only move along this line
 *  limit         never go past here
 *  slide         follow it, but only along this line
 * ```
 *
 * Order is the whole semantics: they are solved in the order they are listed,
 * each reading the frame as it stands. So a list an author can reorder is not a
 * convenience here, it is the only way to say what happens — hence `moveRigConstraint`.
 *
 * Pure document operations: they mutate the rig they are handed, and the
 * command layer wraps each one in a single undo step.
 */
import { RIG_CONSTRAINT_LABELS, RIG_CONSTRAINT_TYPES, normalizeRigConstraint, normalizeRigConstraints } from '../../../runtime/runtime.js';

export { RIG_CONSTRAINT_LABELS, RIG_CONSTRAINT_TYPES } from '../../../runtime/runtime.js';

/**
 * Which kinds need a second piece of artwork to be about.
 *
 * `axis` and `limit` are relationships between an element and the rig's own
 * geometry rather than between two elements, so asking for a source would be
 * asking a question with no answer.
 */
export const CONSTRAINT_NEEDS_SOURCE = Object.freeze(['parent', 'distance', 'orientation', 'slide']);

/** What each kind is actually set by, so a panel shows those fields and no others. */
export const CONSTRAINT_FIELDS = Object.freeze({
  parent: Object.freeze(['source', 'offset', 'copy']),
  distance: Object.freeze(['source', 'distance', 'axis']),
  orientation: Object.freeze(['source', 'offset']),
  axis: Object.freeze(['axis']),
  limit: Object.freeze(['limits']),
  slide: Object.freeze(['source', 'axis', 'offset'])
});

const list = (rig) => normalizeRigConstraints(rig);

/** A readable id from what it holds and what it holds it to, unique in the rig. */
export function constraintIdFrom(target, type, taken = []) {
  const base = `${String(target || 'part')}-${String(type || 'parent')}`
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'constraint';
  if (!taken.includes(base)) return base;
  for (let index = 2; index < 99; index += 1) if (!taken.includes(`${base}-${index}`)) return `${base}-${index}`;
  return `${base}-${Date.now()}`;
}

/**
 * Add one.
 *
 * A kind that is about two pieces of artwork is refused without the second one,
 * rather than stored as a constraint that silently never fires: `applyParent`
 * returns false with no source, and a rule that does nothing and says nothing
 * is the worst thing a rig can contain.
 */
export function createRigConstraint(rig, { target, type = 'parent', source = null, ...rest } = {}) {
  if (!rig?.elements?.[target]) throw new Error(`There is no artwork called "${target}".`);
  if (!RIG_CONSTRAINT_TYPES.includes(type)) throw new Error(`"${type}" is not a kind of constraint.`);
  if (CONSTRAINT_NEEDS_SOURCE.includes(type)) {
    if (!source) throw new Error(`“${RIG_CONSTRAINT_LABELS[type]}” is a relationship to another piece of artwork, so it needs one.`);
    if (!rig.elements[source]) throw new Error(`There is no artwork called "${source}".`);
    if (source === target) throw new Error('A piece of artwork cannot be held to itself.');
  }
  const existing = list(rig);
  const id = rest.id || constraintIdFrom(target, type, existing.map((item) => item.id));
  if (existing.some((item) => item.id === id)) throw new Error(`A constraint called "${id}" already exists.`);
  const constraint = normalizeRigConstraint({ ...rest, id, target, type, source });
  rig.rigConstraints = [...existing, constraint];
  return constraint;
}

/**
 * Change one.
 *
 * The whole record is re-normalized rather than patched field by field, so a
 * change of kind lands with every field its new kind needs already filled in.
 */
export function configureRigConstraint(rig, id, changes = {}) {
  const existing = list(rig);
  const index = existing.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`There is no constraint called "${id}".`);
  const type = changes.type === undefined ? existing[index].type : changes.type;
  if (!RIG_CONSTRAINT_TYPES.includes(type)) throw new Error(`"${type}" is not a kind of constraint.`);
  const source = changes.source === undefined ? existing[index].source : (changes.source || null);
  if (CONSTRAINT_NEEDS_SOURCE.includes(type) && source && !rig?.elements?.[source]) {
    throw new Error(`There is no artwork called "${source}".`);
  }
  if (source && source === existing[index].target) throw new Error('A piece of artwork cannot be held to itself.');
  const next = normalizeRigConstraint({ ...existing[index], ...changes, id, type, source });
  if (!next) throw new Error('That change would leave the constraint with nothing to hold.');
  rig.rigConstraints = existing.map((item, at) => (at === index ? next : item));
  // The parameter that fades it is created with it, so an author has something
  // to key the moment they name one (the same rule a hold's weight follows).
  if (next.weight) {
    rig.params ||= {};
    if (!rig.params[next.weight]) rig.params[next.weight] = { type: 'number', min: 0, max: 1, default: 1, value: 1 };
    for (const pose of Object.values(rig.states || {})) if (!(next.weight in pose)) pose[next.weight] = 1;
  }
  return next;
}

/**
 * Put one earlier or later in the list.
 *
 * Not a nicety: constraints are solved in list order, each reading the frame as
 * it stands, so the order *is* the rule. A list an author cannot reorder is a
 * rule they cannot write.
 */
export function moveRigConstraint(rig, id, to) {
  const existing = list(rig);
  const from = existing.findIndex((item) => item.id === id);
  if (from < 0) throw new Error(`There is no constraint called "${id}".`);
  const index = Math.max(0, Math.min(existing.length - 1, Math.trunc(Number(to))));
  if (index === from) return existing;
  const next = [...existing];
  next.splice(index, 0, next.splice(from, 1)[0]);
  rig.rigConstraints = next;
  return next;
}

export function removeRigConstraint(rig, id) {
  const before = list(rig);
  rig.rigConstraints = before.filter((item) => item.id !== id);
  return rig.rigConstraints.length < before.length;
}

/**
 * Every constraint a project has, in solve order, with what a panel needs.
 *
 * A constraint whose artwork the project has lost is still reported: losing
 * artwork is an accident, and silently dropping the rule built on it makes the
 * accident unrecoverable.
 */
export function rigConstraintModel(document = {}) {
  const elements = document.elements || {};
  return list(document).map((constraint, order) => ({
    ...constraint,
    order,
    label: RIG_CONSTRAINT_LABELS[constraint.type] || constraint.type,
    fields: CONSTRAINT_FIELDS[constraint.type] || [],
    missing: !elements[constraint.target],
    // A relationship whose other half is gone does nothing at all, and the
    // solver says so by returning false rather than by complaining.
    unanchored: CONSTRAINT_NEEDS_SOURCE.includes(constraint.type) && !elements[constraint.source]
  }));
}
