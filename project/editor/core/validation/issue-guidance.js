// Plain-language guidance for a validation issue: where the fix lives, whether
// the deep link lands on the exact entity, and what to do when it cannot.
// Pure presentation model shared by the Problems panel and the Export panel.
// The screen a fix opens, in the words on its tab (UIR-01). A fix names the
// surface it writes to; these say where that is in the navigation.
const WORKSPACE_LABELS = { create: 'Design → Artwork', rig: 'Rig', expressions: 'Animate → Expressions', animate: 'Animate → Motions', reactions: 'Behavior → Reactions', preview: 'Preview' };
// The states and the automatic behaviours are Behavior's, whichever surface the
// fix writes to: the editor that opens is `Behavior → States`.
const AUTHOR_MODE_LABELS = { states: 'States', behaviors: 'Behaviors' };
const RIG_TASK_LABELS = { hands: 'Controls → Hands', headPose: 'Head 2.5D', calibrate: 'Controls', setup: 'Assign', hierarchy: 'Deform → All parts' };

/** Where a fix navigates, in words, and whether it targets the exact entity. */
export function describeFix(issue) {
  const fix = issue?.fix;
  if (!fix) return { available: false, label: 'No automatic fix', where: null, precise: false, explanation: `Nothing to open automatically: ${issue?.message || 'see the message above'}.` };
  // The screen, then what is open on it. An author mode names the States editor
  // wherever the fix writes, and a rig task names one of Rig's four screens --
  // both outrank the surface, because both *are* the destination.
  const workspace = fix.authorMode ? 'Behavior' : fix.timeline ? 'Animate' : WORKSPACE_LABELS[fix.workspace] || 'Design → Artwork';
  // Assign is where Rig opens anyway, so only the other screens are worth
  // naming after the arrow.
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
