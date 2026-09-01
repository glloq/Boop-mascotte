/**
 * Coordinates every destructive project change. Candidate preparation must be
 * completed before calling this function, so cancellation and validation errors
 * cannot partially mutate the live editor.
 */
export async function commitProjectReplacement({ hasUnsavedChanges, confirmReplacement, saveProject = () => false, prepare = async () => undefined, captureRollback = () => undefined, stop, resetContext, commit, rollback = async () => {}, clearHistory, establishBaseline }) {
  if (hasUnsavedChanges()) {
    const choice = await confirmReplacement();
    if (choice === false || choice === 'cancel') return false;
    if (choice === 'save' && !(await saveProject())) return false;
  }
  const candidate = await prepare();
  const previous = await captureRollback();
  try {
    stop();
    resetContext();
    await commit(candidate);
  } catch (commitError) {
    try { await rollback(previous); }
    catch (rollbackError) { throw new AggregateError([commitError, rollbackError], 'Project replacement and rollback both failed'); }
    throw commitError;
  }
  clearHistory();
  establishBaseline();
  return true;
}
