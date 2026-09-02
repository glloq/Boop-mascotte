// Face-role detection: rank artwork candidates for the eight basic roles from
// SVG ids, layer names, hierarchy and (optional) Canvas geometry. It is pure
// and never mutates or commits anything; the Face Setup checklist shows the
// result with its confidence and reasons, and only the user's Accept authors.
import { FACE_ROLE_CHECKLIST, deriveFaceRoleChecklist, listAssignableElements } from './face-roles.js';

const FEATURES = Object.freeze({
  pupil: { keywords: ['pupil', 'pupils', 'iris'], exclude: ['highlight', 'shine', 'glow', 'reflection'] },
  brow: { keywords: ['brow', 'brows', 'eyebrow', 'eyebrows'], exclude: [] },
  eye: { keywords: ['eye', 'eyes', 'eyeball', 'sclera', 'eyewhite'], exclude: ['lid', 'lids', 'eyelid', 'eyelids', 'brow', 'brows', 'eyebrow', 'eyebrows', 'pupil', 'pupils', 'iris', 'lash', 'lashes', 'shadow', 'socket', 'glow', 'shine', 'highlight'] },
  mouth: { keywords: ['mouth', 'lips', 'lip', 'smile', 'grin'], exclude: ['moustache', 'mustache', 'beard', 'base', 'shadow'] },
  head: { keywords: ['head', 'face', 'skull', 'faceroot'], exclude: ['hair', 'shadow', 'highlight'] }
});
const FEATURE_ORDER = ['pupil', 'brow', 'eye', 'mouth', 'head'];
const NEVER_HEAD = ['background', 'bg', 'backdrop', 'frame', 'border', 'shadow', 'canvas'];
const SIDES = Object.freeze({ left: ['left', 'l', 'lft', 'gauche', '1'], right: ['right', 'r', 'rgt', 'droite', '2'] });
const ROLE_FEATURE = Object.freeze({ head: 'head', leftEye: 'eye', rightEye: 'eye', leftPupil: 'pupil', rightPupil: 'pupil', leftBrow: 'brow', rightBrow: 'brow', mouth: 'mouth' });
const ROLE_SIDE = Object.freeze({ leftEye: 'left', rightEye: 'right', leftPupil: 'left', rightPupil: 'right', leftBrow: 'left', rightBrow: 'right' });
const CONFIDENCE_RANK = Object.freeze({ high: 3, medium: 2, low: 1 });

/** Split ids and layer names into lowercase words: `journeyEyeL` → journey, eye, l. */
export function tokenize(value) {
  return String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function featureOf(tokens) {
  for (const feature of FEATURE_ORDER) {
    const { keywords, exclude } = FEATURES[feature];
    if (tokens.some((token) => keywords.includes(token)) && !tokens.some((token) => exclude.includes(token))) return feature;
  }
  return null;
}
function sideOf(tokens) {
  const left = tokens.some((token) => SIDES.left.includes(token)), right = tokens.some((token) => SIDES.right.includes(token));
  if (left && !right) return 'left';
  if (right && !left) return 'right';
  return null;
}
const area = (frame) => (frame ? Math.max(0, frame.width) * Math.max(0, frame.height) : 0);
const containsCenter = (outer, inner) => Boolean(outer && inner && inner.cx >= outer.x && inner.cx <= outer.x + outer.width && inner.cy >= outer.y && inner.cy <= outer.y + outer.height);

/**
 * Describe every assignable element once: tokens from id + layer name,
 * detected feature/side, group flag and optional geometry frame.
 */
export function describeElements(document, geometry = () => null) {
  return listAssignableElements(document).map((element, order) => {
    const tokens = [...new Set([...tokenize(element.id), ...tokenize(element.name)])];
    const frame = geometry(element.id) || null;
    return { id: element.id, name: element.name, order, tokens, feature: featureOf(tokens), side: sideOf(tokens), isGroup: element.type === 'g', frame, exact: tokens.length <= 2 };
  });
}

/**
 * Suggest artwork for missing basic roles.
 * `geometry(id)` may return `{ x, y, width, height, cx, cy }` in one shared
 * coordinate space (Canvas pixels); without it only name-based evidence is used.
 */
export function suggestFaceRoles(document, { geometry = () => null } = {}) {
  const checklist = deriveFaceRoleChecklist(document);
  const used = new Set(checklist.items.map((item) => item.elementId).filter(Boolean));
  const elements = describeElements(document, geometry).filter((element) => !used.has(element.id));
  const suggestions = {};
  const taken = new Set();
  const missing = (role) => checklist.items.find((item) => item.id === role)?.status !== 'assigned';
  const propose = (role, element, confidence, reasons) => {
    if (!element || taken.has(element.id) || !missing(role)) return;
    taken.add(element.id);
    suggestions[role] = { elementId: element.id, elementName: element.name, confidence, reasons };
  };
  const byPreference = (a, b) => Number(a.isGroup) - Number(b.isGroup) || Number(b.exact) - Number(a.exact) || area(b.frame) - area(a.frame) || a.order - b.order;

  // Head: prefer a named container that holds the other face features, then the largest named shape.
  const headNamed = elements.filter((element) => element.feature === 'head');
  const featureShapes = elements.filter((element) => element.feature && element.feature !== 'head' && element.frame);
  const containment = (element) => featureShapes.filter((shape) => shape.id !== element.id && containsCenter(element.frame, shape.frame)).length;
  if (headNamed.length) {
    const [best] = [...headNamed].sort((a, b) => containment(b) - containment(a) || area(b.frame) - area(a.frame) || Number(b.exact) - Number(a.exact) || a.order - b.order);
    const reasons = [`Name says “${best.name}”`];
    if (containment(best)) reasons.push('Contains the other face parts');
    propose('head', best, headNamed.length === 1 || containment(best) ? 'high' : 'medium', reasons);
  } else {
    const others = elements.filter((element) => element.frame && !element.tokens.some((token) => NEVER_HEAD.includes(token)));
    const containers = others.map((element) => ({ element, count: others.filter((other) => other.id !== element.id && containsCenter(element.frame, other.frame)).length })).filter(({ count }) => count >= 3 && count >= (others.length - 1) / 2);
    if (containers.length) {
      const [best] = containers.sort((a, b) => b.count - a.count || area(b.element.frame) - area(a.element.frame) || a.element.order - b.element.order);
      propose('head', best.element, 'medium', [`Contains ${best.count} other shapes`]);
    }
  }

  // Mouth: unique feature match is high; several matches choose the largest exact one.
  const mouths = elements.filter((element) => element.feature === 'mouth' && !taken.has(element.id)).sort(byPreference);
  if (mouths.length) propose('mouth', mouths[0], mouths.length === 1 ? 'high' : 'medium', [`Name says “${mouths[0].name}”`, ...(mouths.length > 1 ? [`${mouths.length} mouth-like shapes; largest chosen`] : [])]);

  // Paired features: explicit side names first, then geometry ordering, then explicit low confidence.
  for (const feature of ['eye', 'pupil', 'brow']) {
    const roles = FACE_ROLE_CHECKLIST.filter((entry) => ROLE_FEATURE[entry.id] === feature).map((entry) => entry.id);
    const pool = elements.filter((element) => element.feature === feature && !taken.has(element.id));
    for (const role of roles) {
      const side = ROLE_SIDE[role];
      const sided = pool.filter((element) => element.side === side && !taken.has(element.id)).sort(byPreference);
      if (sided.length) propose(role, sided[0], 'high', [`Name says “${sided[0].name}” (${side})`]);
    }
    const unsided = pool.filter((element) => !element.side && !taken.has(element.id)).sort(byPreference);
    const open = roles.filter((role) => missing(role) && !suggestions[role]);
    if (!unsided.length || !open.length) continue;
    const withFrames = unsided.filter((element) => element.frame);
    if (withFrames.length >= 2 && withFrames.length === unsided.length && open.length === 2) {
      const ordered = [...withFrames].sort((a, b) => a.frame.cx - b.frame.cx);
      const pair = withFrames.length === 2 ? ordered : null;
      if (pair) {
        propose(open[0], pair[0], 'medium', [`Name says “${pair[0].name}”`, 'Left of the other one on the canvas']);
        propose(open[1], pair[1], 'medium', [`Name says “${pair[1].name}”`, 'Right of the other one on the canvas']);
        continue;
      }
    }
    if (open.length === 1 && withFrames.length === 1) {
      const role = open[0], other = checklist.items.find((item) => item.id === roles.find((candidate) => candidate !== role));
      const otherFrame = other?.elementId ? geometry(other.elementId) : suggestions[roles.find((candidate) => candidate !== role)] ? geometry(suggestions[roles.find((candidate) => candidate !== role)].elementId) : null;
      if (otherFrame) {
        const expectedLeft = ROLE_SIDE[role] === 'left';
        const isLeft = withFrames[0].frame.cx < otherFrame.cx;
        if (isLeft === expectedLeft) { propose(role, withFrames[0], 'medium', [`Name says “${withFrames[0].name}”`, `${expectedLeft ? 'Left' : 'Right'} of the other one on the canvas`]); continue; }
      }
    }
    for (const role of open) {
      const candidate = unsided.find((element) => !taken.has(element.id));
      if (candidate) propose(role, candidate, 'low', [`Name says “${candidate.name}” but not which side`]);
    }
  }

  // Checklist order keeps accepted batches creating parts in the beginner order (head, eyes, gaze, eyebrows, mouth).
  const acceptable = FACE_ROLE_CHECKLIST.map((entry) => entry.id).filter((role) => suggestions[role] && CONFIDENCE_RANK[suggestions[role].confidence] >= CONFIDENCE_RANK.medium);
  return { suggestions, acceptable };
}

export const confidenceLabel = (confidence) => ({ high: 'Likely', medium: 'Probable', low: 'Uncertain' })[confidence] || confidence;
