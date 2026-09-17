// Face Setup checklist: the eight basic roles a beginner assigns by clicking
// artwork on the Canvas, and `FACE_ROLE_EXTRAS` -- everything else the registry
// knows -- below them. This is presentation/derivation metadata only. The
// authored truth remains `semanticParts[*].roles`, so nothing here is persisted.
import { FACE_ROLE_VOCABULARY } from './face-role-vocabulary.js';

/** Beginner order: head first, then paired features left/right, then mouth. */
export const FACE_ROLE_CHECKLIST = Object.freeze([
  Object.freeze({ id: 'head', part: 'head', role: 'head', label: 'Head', side: null, hint: 'The whole face or head shape.' }),
  Object.freeze({ id: 'leftEye', part: 'eyes', role: 'leftEye', label: 'Left eye', side: 'left', hint: 'The eye on the left side of the canvas.' }),
  Object.freeze({ id: 'rightEye', part: 'eyes', role: 'rightEye', label: 'Right eye', side: 'right', hint: 'The eye on the right side of the canvas.' }),
  Object.freeze({ id: 'leftPupil', part: 'gaze', role: 'leftPupil', label: 'Left pupil', side: 'left', hint: 'Inside the left eye. It moves when the mascot looks around.' }),
  Object.freeze({ id: 'rightPupil', part: 'gaze', role: 'rightPupil', label: 'Right pupil', side: 'right', hint: 'Inside the right eye.' }),
  Object.freeze({ id: 'leftBrow', part: 'eyebrows', role: 'leftBrow', label: 'Left eyebrow', side: 'left', hint: 'Above the left eye. Optional if the face has no brows.' }),
  Object.freeze({ id: 'rightBrow', part: 'eyebrows', role: 'rightBrow', label: 'Right eyebrow', side: 'right', hint: 'Above the right eye.' }),
  Object.freeze({ id: 'mouth', part: 'mouth', role: 'mouth', label: 'Mouth', side: null, hint: 'The mouth shape. It opens and smiles.' })
]);

/**
 * Everything else a piece of artwork can be.
 *
 * The eight above are the ones a beginner is walked through, and the count
 * they complete is about those eight. The registry knows sixteen more --
 * eyelids, a nose, ears, hair, a jaw, a tongue, teeth, a mouth cavity, facial
 * hair -- and for a long time none of them had a row anywhere: an author with
 * `cheveux.png` on the canvas had nowhere in Face Setup to say what it was,
 * and the only way in was *Rig ▸ Deform ▸ All parts*, an advanced screen
 * inside a collapsed section behind a *+ Add Part* menu.
 *
 * So they are here, as a second group that is **optional and says so**: the
 * same Assign and Clear, the same canvas picking, and no effect at all on
 * whether the face reads as complete.
 *
 * Derived from the shared vocabulary rather than written out again
 * (`face-role-vocabulary.js`), so a part the registry gains is assignable the
 * day it exists. The two hands are not in it: a hand is drawn as a pair from
 * Design ▸ Hands and is not a role to hand out (docs/HAND_RIGGING.md).
 */
export const FACE_ROLE_EXTRAS = Object.freeze(FACE_ROLE_VOCABULARY
  .filter((entry) => !FACE_ROLE_CHECKLIST.some((basic) => basic.part === entry.part && basic.role === entry.role))
  .map((entry) => Object.freeze({
    id: entry.id, part: entry.part, role: entry.role, label: entry.label, hint: entry.hint,
    partLabel: entry.partLabel, side: /^left/i.test(entry.role) ? 'left' : /^right/i.test(entry.role) ? 'right' : null,
    optional: true
  })));

export const FACE_ROLE_STATUSES = Object.freeze(['missing', 'assigned', 'invalid']);

/**
 * One row by id, basic or extra.
 *
 * Both lists on purpose: the panel's picking, assigning and clearing are
 * written once against an entry, so an extra role goes through exactly the
 * code the eight do rather than a second path beside it.
 */
export const faceRoleEntry = (id) => FACE_ROLE_CHECKLIST.find((entry) => entry.id === id)
  || FACE_ROLE_EXTRAS.find((entry) => entry.id === id) || null;

/** Basic part types are unique per project, so the first match owns the role. */
export function findFacePartByType(document, type) {
  return Object.values(document?.semanticParts || {}).find((part) => part.type === type) || null;
}

function findLayer(items, id) {
  for (const item of items || []) {
    if (item.id === id) return item;
    const nested = findLayer(item.children, id);
    if (nested) return nested;
  }
  return null;
}

/** Human display name for artwork: layer name first, raw ID only as a fallback. */
export function elementDisplayName(document, elementId) {
  if (!elementId) return '';
  return document?.layerMetadata?.[elementId]?.name || findLayer(document?.layers, elementId)?.name || elementId;
}

/** Elements that may be assigned manually, in layer (paint) order. */
export function listAssignableElements(document) {
  const out = [];
  const visit = (items) => {
    for (const item of items || []) {
      if (document?.elements?.[item.id]) out.push({ id: item.id, name: item.name || item.id, type: item.type });
      visit(item.children);
    }
  };
  visit(document?.layers);
  return out;
}

/**
 * Derive the checklist from a ProjectDocument. Pure and allocation-light: it
 * never mutates or normalizes the document.
 */
export function deriveFaceRoleChecklist(document) {
  const items = FACE_ROLE_CHECKLIST.map((entry) => {
    const part = findFacePartByType(document, entry.part);
    const elementId = part?.roles?.[entry.role] || null;
    const status = !elementId ? 'missing' : document?.elements?.[elementId] ? 'assigned' : 'invalid';
    return { ...entry, partId: part?.id || null, elementId, elementName: elementId ? elementDisplayName(document, elementId) : '', status };
  });
  const assigned = items.filter((item) => item.status === 'assigned').length;
  const next = nextMissingFaceRole(items);
  return { items, assigned, total: items.length, complete: assigned === items.length, next: next?.id || null };
}

/**
 * The optional rows, derived the same way as the eight.
 *
 * Separate from `deriveFaceRoleChecklist` rather than folded into it, because
 * the checklist's `assigned / total` is what the heading, the readiness badge
 * and the guided journey all read: a face with no ears is finished, and a
 * count that said 8 / 24 would call every mascot unfinished for ever.
 */
export function deriveFaceRoleExtras(document) {
  const items = FACE_ROLE_EXTRAS.map((entry) => {
    const part = findFacePartByType(document, entry.part);
    const elementId = part?.roles?.[entry.role] || null;
    const status = !elementId ? 'missing' : document?.elements?.[elementId] ? 'assigned' : 'invalid';
    return { ...entry, partId: part?.id || null, elementId, elementName: elementId ? elementDisplayName(document, elementId) : '', status };
  });
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.part)) groups.set(item.part, { part: item.part, label: item.partLabel, items: [] });
    groups.get(item.part).items.push(item);
  }
  return { items, groups: [...groups.values()], assigned: items.filter((item) => item.status === 'assigned').length, total: items.length };
}

/** Next role still needing artwork, scanning after `afterId` and wrapping around. */
export function nextMissingFaceRole(itemsOrDocument, afterId = null) {
  const items = Array.isArray(itemsOrDocument) ? itemsOrDocument : deriveFaceRoleChecklist(itemsOrDocument).items;
  const index = afterId ? items.findIndex((item) => item.id === afterId) : -1;
  const start = index >= 0 ? index + 1 : 0;
  const ordered = [...items.slice(start), ...items.slice(0, start)];
  return ordered.find((item) => item.status !== 'assigned') || null;
}

/**
 * Which other role **of the eight** already uses this artwork, if any.
 *
 * The eight and no more, on purpose. One drawing playing two roles across two
 * parts is not a mistake and the template does it: the head shape is also the
 * `jaw`, because on a face with no separate chin the whole head is what drops
 * when the mouth opens, and a mouth that draws its own tongue is the mouth's
 * `tongue` role and the tongue part's own (docs/FACE_CONTROL_RIG.md §12).
 * Widening this to the whole vocabulary made every one of those a refusal.
 *
 * What it is for is two of the eight sharing a drawing — a left eye that is
 * also the right eye — which is a mistake with no reading. Everything else is
 * left to the rig, which refuses one drawing in two roles of *one* part and
 * nothing else (`assignSemanticRole`), so the checklist and the Inspector
 * agree about what is allowed.
 */
export function findFaceRoleUsage(document, elementId, exceptId = null) {
  if (!elementId) return null;
  return deriveFaceRoleChecklist(document).items.find((item) => item.id !== exceptId && item.elementId === elementId) || null;
}
