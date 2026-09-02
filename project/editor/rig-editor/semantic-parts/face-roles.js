// Face Setup checklist: the eight basic roles a beginner assigns by clicking
// artwork on the Canvas. This is presentation/derivation metadata only. The
// authored truth remains `semanticParts[*].roles`, so nothing here is persisted.

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

export const FACE_ROLE_STATUSES = Object.freeze(['missing', 'assigned', 'invalid']);

export const faceRoleEntry = (id) => FACE_ROLE_CHECKLIST.find((entry) => entry.id === id) || null;

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

/** Next role still needing artwork, scanning after `afterId` and wrapping around. */
export function nextMissingFaceRole(itemsOrDocument, afterId = null) {
  const items = Array.isArray(itemsOrDocument) ? itemsOrDocument : deriveFaceRoleChecklist(itemsOrDocument).items;
  const index = afterId ? items.findIndex((item) => item.id === afterId) : -1;
  const start = index >= 0 ? index + 1 : 0;
  const ordered = [...items.slice(start), ...items.slice(0, start)];
  return ordered.find((item) => item.status !== 'assigned') || null;
}

/** Which other basic role already uses this artwork, if any. */
export function findFaceRoleUsage(document, elementId, exceptId = null) {
  if (!elementId) return null;
  return deriveFaceRoleChecklist(document).items.find((item) => item.id !== exceptId && item.elementId === elementId) || null;
}
