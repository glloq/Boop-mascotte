// Export readiness model (UX-16): what blocks the export, what only warns, and
// the task sections a user can jump to. Pure over the readiness model and the
// canonical validation issues; artifacts are untouched.
import { describeFix, summarizeIssues } from '../validation/issue-guidance.js';

export function createExportReadinessModel(readiness, issues = [], { available = true } = {}) {
  const { errors, warnings, info, counts } = summarizeIssues(issues);
  const status = !available || errors.length ? 'blocked' : warnings.length ? 'warnings' : 'ready';
  const item = (issue) => ({ id: issue.id, severity: issue.severity, message: issue.message, domain: issue.domain, fix: describeFix(issue), issue });
  return Object.freeze({
    status, canExport: status !== 'blocked', counts,
    headline: status === 'blocked' ? (errors[0] ? `Export is blocked: ${errors[0].message}` : 'Add or import SVG artwork before exporting.') : status === 'warnings' ? `Ready to export · ${counts.warnings} warning${counts.warnings === 1 ? '' : 's'} worth a look` : 'Ready to export',
    blockers: errors.map(item), warnings: warnings.map(item), info: info.map(item),
    sections: (readiness?.order || []).map((id) => readiness[id]).filter(Boolean)
  });
}
