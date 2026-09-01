/**
 * Coordinates every destructive project change. Candidate preparation must be
 * completed before calling this function, so cancellation and validation errors
 * cannot partially mutate the live editor.
 */
export async function commitProjectReplacement({ hasUnsavedChanges, confirmReplacement, stop, resetContext, commit, clearHistory, establishBaseline }) {
  if (hasUnsavedChanges() && !confirmReplacement()) return false;
  stop();
  resetContext();
  await commit();
  clearHistory();
  establishBaseline();
  return true;
}
