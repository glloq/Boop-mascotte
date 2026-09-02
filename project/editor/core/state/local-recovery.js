export const AUTOSAVE_KEY = 'boop-mascotte-autosave-v1';

const invalid = (reason = 'invalid') => ({ status: 'invalid', savedAt: null, snapshot: null, reason });

export function readLocalRecovery(storage, prepareSnapshot) {
  let raw;
  try { raw = storage?.getItem(AUTOSAVE_KEY); } catch { return invalid('storage-unavailable'); }
  if (raw == null) return { status: 'none', savedAt: null, snapshot: null };
  let record;
  try { record = JSON.parse(raw); } catch { return invalid('invalid-json'); }
  const wrapped = record?.projectSnapshot && typeof record.projectSnapshot === 'object';
  try {
    const snapshot = prepareSnapshot(wrapped ? record.projectSnapshot : record);
    const date = wrapped && typeof record.savedAt === 'string' ? new Date(record.savedAt) : null;
    return { status: 'available', savedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null, snapshot };
  } catch { return invalid('invalid-snapshot'); }
}

export function writeLocalRecovery(storage, snapshot, savedAt = new Date().toISOString()) {
  storage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt, projectSnapshot: snapshot }));
}

export function discardLocalRecovery(storage) {
  try { storage?.removeItem(AUTOSAVE_KEY); return true; } catch { return false; }
}
