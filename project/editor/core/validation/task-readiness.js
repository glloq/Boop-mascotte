// Task-level readiness: plain-language status per product task, derived from the
// ProjectDocument and the canonical validation issues. Pure and stable: codes
// and routes are contracts for badges, the readiness panel and deep links.
import { deriveFaceRoleChecklist } from '../../rig-editor/semantic-parts/face-roles.js';
import { deriveMovementChecklist } from '../../rig-editor/semantic-parts/face-movements.js';

export const TASK_READINESS_ORDER = Object.freeze(['artwork', 'faceSetup', 'movements', 'expressions', 'animate', 'reactions', 'export']);
export const READINESS_STATUSES = Object.freeze(['ready', 'warning', 'error', 'todo', 'optional']);
const RANK = Object.freeze({ error: 4, warning: 3, todo: 2, optional: 1, ready: 0 });
export const READINESS_SYMBOLS = Object.freeze({ ready: '✓', warning: '⚠', error: '●', todo: '○', optional: '' });

/**
 * The workspace each readiness section belongs to (UIR-14,
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * Readiness is transversal: it is not a step of the project, it is a reading of
 * the whole of it, taken from the app bar wherever an author is. Grouping it by
 * workspace is what makes the reading actionable -- "⚠ 2 in Rig" is somewhere
 * to go, where seven flat rows are a list to read.
 *
 * `export` belongs to no workspace on purpose: it is the reading of all four.
 */
export const READINESS_WORKSPACES = Object.freeze({
  artwork: 'design', faceSetup: 'rig', movements: 'rig',
  expressions: 'animate', animate: 'animate', reactions: 'behavior', export: null
});

/**
 * Readiness by workspace, in navigation order, each with the worse of its
 * sections' statuses and the sections themselves.
 *
 * @returns {{ id: string|null, label: string, status: string, sections: object[] }[]}
 */
export function groupReadiness(readiness, labels = { design: 'Design', rig: 'Rig', animate: 'Animate', behavior: 'Behavior' }) {
  const groups = new Map();
  for (const id of readiness.order || TASK_READINESS_ORDER) {
    const section = readiness[id];
    if (!section) continue;
    const workspace = READINESS_WORKSPACES[id] ?? null;
    const key = workspace || 'export';
    if (!groups.has(key)) groups.set(key, { id: workspace, label: workspace ? labels[workspace] || workspace : 'Export', sections: [] });
    groups.get(key).sections.push(section);
  }
  return [...groups.values()].map((group) => ({ ...group, status: worstStatus(...group.sections.map((section) => section.status)) }));
}

/** The one word the app bar shows: what the whole project is, right now. */
export function readinessVerdict(readiness) {
  const status = worstStatus(...(readiness.order || TASK_READINESS_ORDER).map((id) => readiness[id]?.status).filter(Boolean));
  const counted = (readiness.order || TASK_READINESS_ORDER)
    .map((id) => readiness[id]?.status)
    .filter((item) => item === 'error' || item === 'warning').length;
  return { status, count: counted, label: counted ? `${READINESS_SYMBOLS[status] || '●'} ${counted} issue${counted === 1 ? '' : 's'}` : '✓ Ready' };
}

const countLayers = (layers) => (Array.isArray(layers) ? layers : []).reduce((total, layer) => total + 1 + countLayers(layer?.children), 0);
const section = (id, label, status, summary, extra = {}) => Object.freeze({ id, label, status, summary, code: null, action: null, route: null, ...extra });
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The worse of two statuses, for combined badges (Face Setup = face parts + movements). */
export function worstStatus(...statuses) {
  return statuses.filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] || 'ready';
}

export function deriveTaskReadiness(document, issues = []) {
  const hasArtwork = Boolean(String(document?.svgMarkup || '').trim());
  const layers = countLayers(document?.layers);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const artwork = hasArtwork
    ? section('artwork', 'Artwork', 'ready', plural(layers, 'layer'), { route: { mode: 'design.artwork' } })
    : section('artwork', 'Artwork', 'error', 'No artwork yet', { code: 'artwork.missing', action: 'Import an SVG or start from a template', route: { mode: 'design.artwork' } });

  const roles = deriveFaceRoleChecklist(document);
  const missing = roles.items.filter((item) => item.status !== 'assigned');
  const faceSetup = !hasArtwork
    ? section('faceSetup', 'Face parts', 'todo', 'Add artwork first', { route: { mode: 'rig.assign', focus: 'face-setup-checklist' } })
    : roles.complete
      ? section('faceSetup', 'Face parts', 'ready', `${roles.assigned} / ${roles.total} assigned`, { route: { mode: 'rig.assign', focus: 'face-setup-checklist' } })
      : roles.assigned === 0
        ? section('faceSetup', 'Face parts', 'todo', 'No face parts assigned yet', { code: 'face.roles.none', action: 'Assign the head, eyes, pupils and mouth', route: { mode: 'rig.assign', focus: 'face-setup-checklist' } })
        : section('faceSetup', 'Face parts', 'warning', `${roles.assigned} / ${roles.total} assigned · missing ${missing.map((item) => item.label.toLowerCase()).join(', ')}`, { code: 'face.roles.missing', action: `Assign ${missing[0].label.toLowerCase()}`, route: { mode: 'rig.assign', focus: 'face-setup-checklist' }, missing: missing.map((item) => item.id) });

  const moves = deriveMovementChecklist(document);
  const firstOff = moves.items.find((item) => item.status === 'off');
  const firstOn = moves.items.find((item) => item.enabled && item.partId);
  const target = (item) => (item ? { kind: 'semantic-control', part: item.partId, control: item.id } : undefined);
  const movements = !hasArtwork || !moves.available
    ? section('movements', 'Movements', 'todo', hasArtwork ? 'Assign face parts to unlock movements' : 'Add artwork first', { route: { mode: 'rig.controls', focus: 'face-movements' } })
    : !moves.enabled
      ? section('movements', 'Movements', 'todo', 'No movement turned on', { code: 'face.movements.none', action: `Turn on ${firstOff?.label || 'a movement'}`, route: { mode: 'rig.controls', focus: 'face-movements' } })
      : moves.calibrated
        ? section('movements', 'Movements', 'ready', `${moves.enabled} on · ${moves.calibrated} set up`, { route: { mode: 'rig.controls', target: target(firstOn), focus: 'face-movements' } })
        : section('movements', 'Movements', 'warning', `${moves.enabled} on · none set up yet`, { code: 'face.movements.uncalibrated', action: `Calibrate ${firstOn?.label || 'a movement'}`, route: { mode: 'rig.controls', target: target(firstOn), focus: 'face-movements' } });

  const expressionCount = document?.expressions?.length || 0;
  const expressions = !hasArtwork ? section('expressions', 'Expressions', 'todo', 'Add artwork first', { route: { mode: 'animate.expressions' } })
    : expressionCount ? section('expressions', 'Expressions', 'ready', plural(expressionCount, 'expression'), { route: { mode: 'animate.expressions', target: { kind: 'expression', id: document.expressions[0].id } } })
      : section('expressions', 'Expressions', 'optional', 'Optional: create Happy, Sad, Surprised…', { route: { mode: 'animate.expressions' } });
  const clips = document?.animationClips?.length || 0, states = Object.keys(document?.states || {}).length, behaviors = document?.behaviors?.length || 0;
  const parts = [clips ? plural(clips, 'motion') : null, states > 1 ? plural(states, 'pose') : null, behaviors ? plural(behaviors, 'automatic behavior') : null].filter(Boolean);
  const animate = section('animate', 'Motions', parts.length ? 'ready' : 'optional', parts.join(' · ') || 'Optional: motions and automatic behaviors', { route: { mode: 'animate.motions' } });

  const reactionCount = document?.reactions?.length || 0, reactionWarnings = issues.filter((item) => item.domain === 'reactions' && item.severity === 'warning');
  const reactions = !hasArtwork ? section('reactions', 'Reactions', 'todo', 'Add artwork first', { route: { mode: 'behavior.reactions' } })
    : reactionWarnings.length ? section('reactions', 'Reactions', 'warning', reactionWarnings[0].message, { code: 'reactions.incomplete', action: 'Fix the reaction', route: { mode: 'behavior.reactions', target: { kind: 'reaction', id: reactionWarnings[0].target?.reactionId } }, issueId: reactionWarnings[0].id })
      : reactionCount ? section('reactions', 'Reactions', 'ready', plural(reactionCount, 'reaction'), { route: { mode: 'behavior.reactions', target: { kind: 'reaction', id: document.reactions[0].id } } })
        : section('reactions', 'Reactions', 'optional', 'Optional: make the mascot react to a click', { route: { mode: 'behavior.reactions' } });
  const blocker = errors[0];
  // `fix.workspace` is validation's own vocabulary, not the router's: a domain
  // said in the words `core/validation/validate-project.js` uses. The router's
  // compatibility table is where the two meet (ui/task-router.js), so this stays
  // as the only route in the model that does not name a mode.
  const blockerRoute = blocker?.fix ? { task: blocker.fix.workspace || 'artwork', target: { kind: 'diagnostic', diagnosticId: blocker.id } } : { mode: 'design.artwork' };
  const exportSection = errors.length
    ? section('export', 'Export', 'error', `${plural(errors.length, 'blocking problem')}: ${blocker.message}`, { code: 'export.blocked', action: 'Fix the blocking problem', route: blockerRoute, issueId: blocker.id })
    : warnings.length
      ? section('export', 'Export', 'warning', `Ready · ${plural(warnings.length, 'warning')}`, { route: { mode: 'animate.motions' } })
      : section('export', 'Export', 'ready', 'Ready to export', { route: { mode: 'preview' } });

  const sections = { artwork, faceSetup, movements, expressions, animate, reactions, export: exportSection };
  const next = TASK_READINESS_ORDER.map((id) => sections[id]).find((item) => item.action) || null;
  return Object.freeze({ ...sections, order: TASK_READINESS_ORDER, blocking: errors.length, next });
}
