// Plain-language guidance for a validation issue: where the fix lives, whether
// the deep link lands on the exact entity, and what to do when it cannot.
// Pure presentation model shared by the Problems panel and the Export panel.
const WORKSPACE_LABELS = { create: 'Artwork', rig: 'Face Setup', expressions: 'Expressions', animate: 'Motions', reactions: 'Reactions', preview: 'Preview' };
const AUTHOR_MODE_LABELS = { states: 'States', behaviors: 'Behaviors (advanced)' };
const RIG_TASK_LABELS = { hands: 'Hands', headPose: 'Head pose', calibrate: 'Movements', setup: 'Face parts', hierarchy: 'All parts' };

/** Where a fix navigates, in words, and whether it targets the exact entity. */
export function describeFix(issue) {
  const fix = issue?.fix;
  if (!fix) return { available: false, label: 'No automatic fix', where: null, precise: false, explanation: `Nothing to open automatically: ${issue?.message || 'see the message above'}.` };
  const workspace = WORKSPACE_LABELS[fix.workspace] || 'Artwork';
  // "Face parts" is where Face Setup opens anyway, so only the other sections
  // are worth naming after the arrow.
  const detail = fix.authorMode ? ` → ${AUTHOR_MODE_LABELS[fix.authorMode] || fix.authorMode}` : fix.timeline ? ' → Timeline' : fix.rigTask && fix.rigTask !== 'setup' ? ` → ${RIG_TASK_LABELS[fix.rigTask] || fix.rigTask}` : '';
  const precise = Boolean(fix.activeSemanticPartId || fix.activeExpressionId || fix.activeReactionId || fix.selectedId || fix.activeStateId || fix.activeClipId);
  const entity = issue?.target?.entity || issue?.target?.stateId || issue?.target?.behaviorId || issue?.target?.reactionId || null;
  return {
    available: true, label: 'Fix', where: `${workspace}${detail}`, precise,
    explanation: precise ? `Opens ${workspace}${detail} on the item to fix.` : entity && entity !== 'project' ? `Opens ${workspace}${detail}; find “${entity}” there.` : `Opens ${workspace}${detail}.`
  };
}

/** Issues grouped by severity with the same shape everywhere. */
export function summarizeIssues(issues = []) {
  const errors = issues.filter((issue) => issue.severity === 'error'), warnings = issues.filter((issue) => issue.severity === 'warning'), info = issues.filter((issue) => issue.severity === 'info');
  return { errors, warnings, info, counts: { errors: errors.length, warnings: warnings.length, info: info.length } };
}
