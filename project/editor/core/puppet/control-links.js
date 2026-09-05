/**
 * Linking the two sides of a control (docs/FACE_CONTROL_RIG.md, CR-10).
 *
 * A face rig has one movement for the pair and an offset for each side --
 * `eyeOpen` closes both eyes, `eyeOpenLeft` closes one (docs/SEMANTIC_RIGGING.md).
 * Both are useful and neither is what an animator wants *all the time*: some
 * of the day you are blinking, some of the day you are winking, and switching
 * between them should not mean finding a different control.
 *
 * ```text
 * 🔗 linked     drag the left eyelid  →  writes eyeOpen      (both eyes)
 * ⛓ unlinked   drag the left eyelid  →  writes eyeOpenLeft  (that eye)
 * ```
 *
 * **A link is a rule about manipulation, not a new parameter.** Nothing about
 * the rig changes: the same handle writes a different one of two parameters
 * the project already has, so an author can link, pose, unlink, pose again,
 * and the runtime never learns that any of it happened.
 *
 * Off by default, and deliberately: a per-side handle exists precisely to move
 * one side, and the shared movement already has a control of its own. Linking
 * is the deviation, so it is the thing an author asks for.
 *
 * Pure: it reads the document and reports which links are on.
 */

/**
 * The links a face can have, and the shared movements each one covers.
 *
 * `controls` are the shared parameters. A link is on for a handle when that
 * handle offsets one of them -- which is how a link written for the eyelids
 * reaches the eyes and the eyelids parts at once, since both carry `eyeOpen`.
 */
export const RIG_CONTROL_LINKS = Object.freeze([
  Object.freeze({ id: 'eyelids', label: 'Eyelids', controls: Object.freeze(['eyeOpen']), group: 'eye-rig' }),
  Object.freeze({ id: 'eyeTargets', label: 'Eye targets', controls: Object.freeze(['lookX', 'lookY']), group: 'eye-rig' }),
  Object.freeze({ id: 'pupils', label: 'Pupil size', controls: Object.freeze(['pupilScale']), group: 'eye-rig' }),
  // Four movements, not two: an eyebrow raises, turns, and each of its two ends
  // moves on its own (CR-19). Linking the brows links all of it, because
  // "the brows move together" is one sentence and not four switches.
  Object.freeze({ id: 'brows', label: 'Eyebrows', controls: Object.freeze(['browRaise', 'browTilt', 'browInner', 'browOuter']), group: 'brow-rig' }),
  // The mouth's two corners are pins rather than bindings (docs/FACE_CONTROL_RIG.md,
  // CR-28), and the rule is the same one: linked, dragging a corner writes the
  // shared movement and both corners go; unlinked, it writes that corner's own
  // offset. Every pair of sides in the rig can be linked, and they are linked
  // the same way.
  Object.freeze({ id: 'mouthCorners', label: 'Mouth corners', controls: Object.freeze(['smile', 'mouthWidth']), group: 'mouth-rig' })
]);

const LINK_IDS = new Set(RIG_CONTROL_LINKS.map((link) => link.id));

/** The links stored on a project, with anything unknown dropped. */
export function normalizeRigLinks(candidate) {
  const list = Array.isArray(candidate?.rigLinks) ? candidate.rigLinks : [];
  return [...new Set(list.filter((id) => typeof id === 'string' && LINK_IDS.has(id)))];
}

/** Whether this link is on for this project. */
export const rigLinkOn = (document, id) => normalizeRigLinks(document).includes(id);

/** The link that covers one shared movement, if any. */
export const linkForControl = (control) => RIG_CONTROL_LINKS.find((link) => link.controls.includes(control)) || null;

/**
 * Which parameter a per-side control writes right now.
 *
 * @param {object} document
 * @param {string} shared the movement the side offsets -- `eyeOpen`
 * @param {string} offset the side's own parameter -- `eyeOpenLeft`
 * @returns {string} `shared` while the link is on, `offset` otherwise
 */
export function linkedParameter(document, shared, offset) {
  if (!shared || !offset) return offset || shared || null;
  const link = linkForControl(shared);
  return link && rigLinkOn(document, link.id) ? shared : offset;
}

/**
 * Every link a project can offer, with what it is set to.
 *
 * A link whose movements the project has not got is not offered: linking the
 * pupil sizes of a mascot whose pupils do not scale would be a switch that
 * does nothing.
 */
export function rigLinkModel(document = {}) {
  const on = new Set(normalizeRigLinks(document));
  const params = document.params || {};
  return RIG_CONTROL_LINKS
    .filter((link) => link.controls.some((control) => params[control]))
    .map((link) => ({
      id: link.id, label: link.label, group: link.group,
      linked: on.has(link.id),
      controls: link.controls.filter((control) => params[control])
    }));
}

/** Turn one link on or off, returning the list a project should store. */
export function toggleRigLink(document, id, linked) {
  if (!LINK_IDS.has(id)) return normalizeRigLinks(document);
  const on = new Set(normalizeRigLinks(document));
  const wanted = linked === undefined ? !on.has(id) : Boolean(linked);
  if (wanted) on.add(id); else on.delete(id);
  return RIG_CONTROL_LINKS.filter((link) => on.has(link.id)).map((link) => link.id);
}
