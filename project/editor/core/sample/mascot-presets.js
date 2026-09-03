/**
 * Mascot presets and the setup assistant (docs/V2_ROADMAP.md §53–§54).
 *
 * A preset is not artwork: it is a **starting configuration** — which parts a
 * mascot of this kind has, and therefore what is still missing. Artwork comes
 * from a template or from the author's own SVG; the preset says what to do
 * with it.
 *
 * Everything here is pure: it reads a document and reports, and the caller
 * decides what to author.
 */
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';

/** Face only → Face + Hands → Full cartoon mascot, in increasing ambition. */
export const MASCOT_PRESETS = Object.freeze([
  Object.freeze({
    id: 'face-only', title: 'Face only',
    description: 'A head that looks around, blinks and smiles.',
    parts: Object.freeze(['head', 'eyes', 'gaze', 'eyebrows', 'mouth']),
    hands: false, headPose: true,
    behaviors: Object.freeze(['blink', 'eye-wander'])
  }),
  Object.freeze({
    id: 'face-hands', title: 'Face and hands',
    description: 'A face plus two floating hands that can wave and point.',
    parts: Object.freeze(['head', 'eyes', 'gaze', 'eyebrows', 'mouth', 'leftHand', 'rightHand']),
    hands: true, headPose: true,
    behaviors: Object.freeze(['blink', 'eye-wander', 'hand-drift'])
  }),
  Object.freeze({
    id: 'full-cartoon', title: 'Full cartoon mascot',
    description: 'A whole character: body, hair, face, hands and accessories.',
    parts: Object.freeze(['head', 'eyes', 'gaze', 'eyebrows', 'mouth', 'hair', 'ears', 'leftHand', 'rightHand', 'accessory']),
    hands: true, headPose: true,
    behaviors: Object.freeze(['blink', 'eye-wander', 'head-drift', 'breathing', 'hand-drift'])
  })
]);

export const mascotPresetById = (id) => MASCOT_PRESETS.find((preset) => preset.id === id) || null;

const partLabel = (type) => SEMANTIC_PART_REGISTRY[type]?.displayName || type;

/** Semantic part types the project has at least one assigned role for. */
export function assignedPartTypes(document = {}) {
  return new Set(Object.values(document.semanticParts || {})
    .filter((part) => Object.keys(part.roles || {}).length > 0)
    .map((part) => part.type));
}

/**
 * How far a project has come towards a preset.
 *
 * Hands count as present when the `hands` block has them, not when a semantic
 * part exists: the hands block is what actually animates them.
 */
export function mascotPresetStatus(document = {}, presetId) {
  const preset = mascotPresetById(presetId);
  if (!preset) return null;
  const assigned = assignedPartTypes(document);
  const missing = [];
  for (const type of preset.parts) {
    if (type === 'leftHand') { if (!document.hands?.left?.element) missing.push({ type, label: 'Left hand' }); continue; }
    if (type === 'rightHand') { if (!document.hands?.right?.element) missing.push({ type, label: 'Right hand' }); continue; }
    if (!assigned.has(type)) missing.push({ type, label: partLabel(type) });
  }
  const total = preset.parts.length;
  return {
    id: preset.id, title: preset.title, description: preset.description,
    missing, done: total - missing.length, total,
    status: missing.length === 0 ? 'complete' : missing.length === total ? 'empty' : 'partial'
  };
}

/** Every preset's status, plus the one the project is closest to finishing. */
export function mascotPresetOverview(document = {}) {
  const presets = MASCOT_PRESETS.map((preset) => mascotPresetStatus(document, preset.id));
  const complete = presets.filter((item) => item.status === 'complete');
  // The best match is the most ambitious preset that is complete, or failing
  // that the one with the fewest pieces still missing.
  const closest = complete.length ? complete[complete.length - 1]
    : [...presets].sort((a, b) => a.missing.length - b.missing.length || b.done - a.done)[0];
  return { presets, closest: closest || null };
}

/* ── Setup assistant ─────────────────────────────────────────────────────── */

/**
 * The ten steps of the roadmap's assistant, as a checklist derived from the
 * document. Each step reports whether it is done and what to do next, so the
 * UI can say "here is the next thing" rather than only "this is invalid".
 */
export function setupAssistantSteps(document = {}, presetId = 'face-only') {
  const preset = mascotPresetById(presetId) || MASCOT_PRESETS[0];
  const status = mascotPresetStatus(document, preset.id);
  const assigned = assignedPartTypes(document);
  const keyforms = document.keyforms || [];
  const headPose = keyforms.filter((item) => String(item.id).startsWith('headPose:'));
  const hands = document.hands || {};
  const steps = [
    { id: 'import', title: 'Import SVG', done: Boolean(String(document.svgMarkup || '').trim()), next: 'Import or draw the artwork.' },
    { id: 'parts', title: 'Identify parts', done: assigned.size > 0, next: 'Assign at least one face part.' },
    { id: 'face', title: 'Configure face', done: ['eyes', 'gaze', 'mouth'].every((type) => assigned.has(type)), next: 'Assign the eyes, pupils and mouth.' },
    { id: 'head-pose', title: 'Configure head pose', done: headPose.length > 0, next: 'Capture at least one head position.' },
    { id: 'hands', title: 'Configure hands', done: !preset.hands || Boolean(hands.left?.element && hands.right?.element), next: 'Assign both hands and place their anchors.' },
    { id: 'expressions', title: 'Create expressions', done: (document.expressions || []).length > 0, next: 'Create an expression, such as Happy.' },
    { id: 'motions', title: 'Create motions', done: (document.animationClips || []).length > 0, next: 'Record a motion.' },
    { id: 'reactions', title: 'Create reactions', done: (document.reactions || []).length > 0, next: 'Add a reaction, such as a click that waves.' },
    { id: 'preview', title: 'Preview', done: (document.behaviors || []).length > 0, next: 'Turn on an automatic behaviour and watch it in Preview.' },
    { id: 'export', title: 'Export', done: false, next: 'Export the mascot when you are happy with it.' }
  ];
  const firstPending = steps.find((step) => !step.done) || null;
  return {
    preset: status,
    steps: steps.map((step) => ({ ...step, current: step === firstPending })),
    done: steps.filter((step) => step.done).length,
    total: steps.length,
    next: firstPending ? { id: firstPending.id, title: firstPending.title, text: firstPending.next } : null
  };
}
