import { exportBlockingIssues } from '../../core/validation/validate-project.js';

/**
 * Owns the three flows that turn a validation result into a destination: the
 * readiness sections (UX-08), the Problems panel and the Export panel (UX-16).
 * They belong together because they share one vocabulary — a readiness section,
 * an issue, and the `fix` context an issue names — and because Back to Export
 * only makes sense if the same object decides when the export was left.
 *
 * Every collaborator is injected — store, exporter, validation cache, the
 * readiness source, the router and the shell callbacks — so the whole flow runs
 * in Node without a DOM. `main.js` keeps the wiring only: the shell buttons and
 * the command palette call these entry points, and `configure()` hands the
 * export panel its sources once the cache and the router exist.
 */
export function createExportService({
  store, exporter, validationCache, readiness,
  navigate, updateContext,
  // Shell surfaces, as callbacks rather than the shell itself: a status line, the
  // Problems panel, and the Back to Export affordance.
  setStatus = () => {}, showProblems: renderProblems = () => {}, setReturnToExport = () => {}
} = {}) {
  // Two readings on purpose, kept exactly as the editor had them. The cache is
  // keyed on the document domain revisions and ignores its argument, so both
  // return the same issues; which one is passed only decides what a cold run
  // validates, and that is not a difference worth changing here.
  const stateIssues = () => validationCache.run(store.getState());
  const documentIssues = () => validationCache.run(store.getDocument());

  // `goToReadiness` and `fixProblem` are the same move over different targets:
  // go somewhere, then put the editor in the context the issue's fix names.
  // `workspace` is the route the fix would take on its own, so it is peeled off
  // rather than pushed into the editor context. The issue arrives as a thunk to
  // keep the original order: navigate first, resolve the issue afterwards, so
  // nothing validates before the move and a lookup that finds nothing still
  // leaves the user where the route said.
  const routeToFix = (route, resolveIssue) => {
    navigate(route);
    const issue = resolveIssue?.();
    if (!issue?.fix) return;
    const { workspace, ...context } = issue.fix;
    updateContext(context);
  };

  // A readiness section without a route has nowhere to send anyone. The lookup
  // sits behind `issueId` so a section that names no issue never runs validation
  // just to navigate.
  const goToReadiness = (item) => {
    if (!item?.route) return;
    routeToFix(item.route, item.issueId ? () => documentIssues().find((candidate) => candidate.id === item.issueId) : null);
  };

  // The diagnostic target is what makes the destination panel highlight the
  // problem instead of merely opening. Artwork is the fallback because an issue
  // with no workspace is almost always about missing artwork.
  const fixProblem = (issue) => {
    if (!issue?.fix) return;
    routeToFix({ task: issue.fix.workspace || 'artwork', target: { kind: 'diagnostic', diagnosticId: issue.id } }, () => issue);
  };

  const showProblems = () => {
    const issues = stateIssues();
    renderProblems(readiness(), issues, fixProblem, goToReadiness);
  };

  // Opening Export is the arrival, so Back to Export goes away first. The panel
  // opens even when the export is blocked: it is the surface that explains what
  // blocks it, and the status line repeats the first blocker for anyone who
  // reached Export from a button rather than from the readiness list.
  const openExport = () => {
    setReturnToExport(false);
    const blocking = exportBlockingIssues(stateIssues());
    exporter.render();
    exporter.open();
    if (blocking.length) setStatus(`Cannot export yet: ${blocking[0].message}`, 'error');
  };

  // Both export deep links leave the panel, so Back to Export has to be raised
  // before the navigation, not after it.
  const configure = () => exporter.configure({
    readiness,
    issues: documentIssues,
    onFix: (issue) => { setReturnToExport(true); fixProblem(issue); },
    onGo: (section) => { setReturnToExport(true); goToReadiness(section); }
  });

  return { goToReadiness, fixProblem, showProblems, openExport, configure };
}
