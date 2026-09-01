/**
 * Coordinates every destructive project change. Candidate preparation must be
 * completed before calling this function, so cancellation and validation errors
 * cannot partially mutate the live editor.
 */
export async function commitProjectReplacement({ hasUnsavedChanges, confirmReplacement, prepare = async () => undefined, captureRollback = () => undefined, stop, resetContext, commit, rollback = async () => {}, clearHistory, establishBaseline }) {
  if (hasUnsavedChanges() && !confirmReplacement()) return false;
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
