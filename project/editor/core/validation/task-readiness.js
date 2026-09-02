// Task-level readiness: plain-language status per product task, derived from the
// ProjectDocument and the canonical validation issues. Pure and stable: codes
// and routes are contracts for badges, the readiness panel and deep links.
import { deriveFaceRoleChecklist } from '../../rig-editor/semantic-parts/face-roles.js';
import { deriveMovementChecklist } from '../../rig-editor/semantic-parts/face-movements.js';

export const TASK_READINESS_ORDER = Object.freeze(['artwork', 'faceSetup', 'movements', 'expressions', 'animate', 'reactions', 'export']);
export const READINESS_STATUSES = Object.freeze(['ready', 'warning', 'error', 'todo', 'optional']);
const RANK = Object.freeze({ error: 4, warning: 3, todo: 2, optional: 1, ready: 0 });
export const READINESS_SYMBOLS = Object.freeze({ ready: '✓', warning: '⚠', error: '●', todo: '○', optional: '' });

const section = (id, label, status, summary, extra = {}) => Object.freeze({ id, label, status, summary, code: null, action: null, route: null, ...extra });
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The worse of two statuses, for combined badges (Face Setup = face parts + movements). */
export function worstStatus(...statuses) {
  return statuses.filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] || 'ready';
}

export function deriveTaskReadiness(document, issues = []) {
  const hasArtwork = Boolean(String(document?.svgMarkup || '').trim());
  const layers = document?.layers?.length || 0;
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const artwork = hasArtwork
    ? section('artwork', 'Artwork', 'ready', plural(layers, 'layer'), { route: { task: 'artwork' } })
    : section('artwork', 'Artwork', 'error', 'No artwork yet', { code: 'artwork.missing', action: 'Import an SVG or start from a template', route: { task: 'artwork' } });

  const roles = deriveFaceRoleChecklist(document);
  const missing = roles.items.filter((item) => item.status !== 'assigned');
  const faceSetup = !hasArtwork
    ? section('faceSetup', 'Face parts', 'todo', 'Add artwork first', { route: { task: 'face-setup' } })
    : roles.complete
      ? section('faceSetup', 'Face parts', 'ready', `${roles.assigned} / ${roles.total} assigned`, { route: { task: 'face-setup' } })
      : roles.assigned === 0
        ? section('faceSetup', 'Face parts', 'todo', 'No face parts assigned yet', { code: 'face.roles.none', action: 'Assign the head, eyes, pupils and mouth', route: { task: 'face-setup' } })
        : section('faceSetup', 'Face parts', 'warning', `${roles.assigned} / ${roles.total} assigned · missing ${missing.map((item) => item.label.toLowerCase()).join(', ')}`, { code: 'face.roles.missing', action: `Assign ${missing[0].label.toLowerCase()}`, route: { task: 'face-setup' }, missing: missing.map((item) => item.id) });

  const moves = deriveMovementChecklist(document);
  const firstOff = moves.items.find((item) => item.status === 'off');
  const firstOn = moves.items.find((item) => item.enabled && item.partId);
  const target = (item) => (item ? { kind: 'semantic-control', part: item.partId, control: item.id } : undefined);
  const movements = !hasArtwork || !moves.available
    ? section('movements', 'Movements', 'todo', hasArtwork ? 'Assign face parts to unlock movements' : 'Add artwork first', { route: { task: 'face-setup' } })
    : !moves.enabled
      ? section('movements', 'Movements', 'todo', 'No movement turned on', { code: 'face.movements.none', action: `Turn on ${firstOff?.label || 'a movement'}`, route: { task: 'face-setup' } })
      : moves.calibrated
        ? section('movements', 'Movements', 'ready', `${moves.enabled} on · ${moves.calibrated} calibrated`, { route: { task: 'face-setup', target: target(firstOn) } })
        : section('movements', 'Movements', 'warning', `${moves.enabled} on · default ranges, none calibrated`, { code: 'face.movements.uncalibrated', action: `Calibrate ${firstOn?.label || 'a movement'}`, route: { task: 'face-setup', target: target(firstOn) } });

  const expressionCount = document?.expressions?.length || 0;
  const expressions = !hasArtwork ? section('expressions', 'Expressions', 'todo', 'Add artwork first', { route: { task: 'expressions' } })
    : expressionCount ? section('expressions', 'Expressions', 'ready', plural(expressionCount, 'expression'), { route: { task: 'expressions', target: { kind: 'expression', id: document.expressions[0].id } } })
      : section('expressions', 'Expressions', 'optional', 'Optional: create Happy, Sad, Surprised…', { route: { task: 'expressions' } });
  const clips = document?.animationClips?.length || 0, states = Object.keys(document?.states || {}).length, behaviors = document?.behaviors?.length || 0;
  const parts = [clips ? plural(clips, 'animation') : null, states > 1 ? plural(states, 'pose') : null, behaviors ? plural(behaviors, 'automatic behavior') : null].filter(Boolean);
  const animate = section('animate', 'Animate', parts.length ? 'ready' : 'optional', parts.join(' · ') || 'Optional: animations and automatic behaviors', { route: { task: 'animate' } });

  const reactionCount = document?.reactions?.length || 0, reactionWarnings = issues.filter((item) => item.domain === 'reactions' && item.severity === 'warning');
  const reactions = !hasArtwork ? section('reactions', 'Reactions', 'todo', 'Add artwork first', { route: { task: 'reactions' } })
    : reactionWarnings.length ? section('reactions', 'Reactions', 'warning', reactionWarnings[0].message, { code: 'reactions.incomplete', action: 'Fix the reaction', route: { task: 'reactions', target: { kind: 'reaction', id: reactionWarnings[0].target?.reactionId } }, issueId: reactionWarnings[0].id })
      : reactionCount ? section('reactions', 'Reactions', 'ready', plural(reactionCount, 'reaction'), { route: { task: 'reactions', target: { kind: 'reaction', id: document.reactions[0].id } } })
        : section('reactions', 'Reactions', 'optional', 'Optional: make the mascot react to a click', { route: { task: 'reactions' } });
  const blocker = errors[0];
  const blockerRoute = blocker?.fix ? { task: blocker.fix.workspace || 'artwork', target: { kind: 'diagnostic', diagnosticId: blocker.id } } : { task: 'artwork' };
  const exportSection = errors.length
    ? section('export', 'Export', 'error', `${plural(errors.length, 'blocking problem')}: ${blocker.message}`, { code: 'export.blocked', action: 'Fix the blocking problem', route: blockerRoute, issueId: blocker.id })
    : warnings.length
      ? section('export', 'Export', 'warning', `Ready · ${plural(warnings.length, 'warning')}`, { route: { task: 'animate' } })
      : section('export', 'Export', 'ready', 'Ready to export', { route: { task: 'preview' } });

  const sections = { artwork, faceSetup, movements, expressions, animate, reactions, export: exportSection };
  const next = TASK_READINESS_ORDER.map((id) => sections[id]).find((item) => item.action) || null;
  return Object.freeze({ ...sections, order: TASK_READINESS_ORDER, blocking: errors.length, next });
}
