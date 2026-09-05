/**
 * The selection, as the session keeps it (docs/SELECTION_GIZMO.md).
 *
 * `selectedId` is the piece in hand — the one the Inspector shows and the
 * gizmo frames — and `selectedIds` is everything selected, in the order it was
 * picked, with the piece in hand last. Every reader that knows one selection
 * keeps working: the piece in hand is always a member of the set, so a plain
 * `selectedId` write (a click, a panel, an older test) is a selection of one.
 */
export function normalizeSelection({ selectedId, selectedIds } = {}) {
  const primary = typeof selectedId === 'string' && selectedId ? selectedId : null;
  const list = Array.isArray(selectedIds) ? selectedIds.filter((id, index, all) => typeof id === 'string' && id && all.indexOf(id) === index) : [];
  if (!primary) return { selectedId: null, selectedIds: [] };
  if (!list.includes(primary)) return { selectedId: primary, selectedIds: [primary] };
  return { selectedId: primary, selectedIds: [...list.filter((id) => id !== primary), primary] };
}

/** Everything selected, the piece in hand last. */
export const selectionOf = (session) => normalizeSelection(session || {}).selectedIds;

/** One piece, or nothing. */
export const selectOnly = (id) => normalizeSelection({ selectedId: id || null, selectedIds: id ? [id] : [] });

/** Several pieces; the piece in hand is the last one unless said otherwise. */
export const selectMany = (ids, primary = null) => {
  const list = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id) : [];
  return normalizeSelection({ selectedId: primary && list.includes(primary) ? primary : list.at(-1) || null, selectedIds: list });
};

/** Shift+click: add a piece, or take a selected one back out. The last one picked is in hand. */
export function toggleSelected(session, id) {
  if (typeof id !== 'string' || !id) return normalizeSelection(session || {});
  const ids = selectionOf(session);
  const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  return normalizeSelection({ selectedId: next.at(-1) || null, selectedIds: next });
}
