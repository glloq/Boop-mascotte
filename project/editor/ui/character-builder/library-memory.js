/**
 * What the author keeps coming back to (audit §8.3).
 *
 * The library holds a hundred and fifty drawings and had no memory at all: the
 * mouth you picked for the last three mascots was as far down the row as the
 * one you have never used. Two lists fix that, and they are the two every
 * library has — the ones you starred, and the ones you just used.
 *
 * Pure, apart from one `Storage` argument. The lists are a **preference**, not
 * project data: they say what this author reaches for, not what this mascot is
 * made of, so they never touch the document and never travel with a save.
 */

export const LIBRARY_MEMORY_KEY = 'boop.libraryUse.v1';

/** Eight, because it is a row of a grid and not a history. */
export const RECENT_LIMIT = 8;

const clean = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item) : []);

/** @returns {{ recent: string[], favourite: string[] }} */
export function readLibraryMemory(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(LIBRARY_MEMORY_KEY) || '{}');
    return { recent: clean(saved.recent).slice(0, RECENT_LIMIT), favourite: clean(saved.favourite) };
  } catch { return { recent: [], favourite: [] }; }
}

/**
 * @returns the memory a reader will actually see.
 *
 * Not the one we meant to write: a browser with storage off (a private window,
 * blocked site data) throws here, and handing back the intended list would have
 * the row sort itself by a memory that does not exist and will be gone on the
 * next read. Nothing breaks without a memory; pretending is what breaks.
 */
function write(storage, memory) {
  try { storage?.setItem(LIBRARY_MEMORY_KEY, JSON.stringify(memory)); } catch { return readLibraryMemory(storage); }
  return memory;
}

/**
 * Most recent first, no duplicates, eight at most.
 *
 * Using a drawing that is already in the list moves it to the front rather than
 * adding it twice: the list is "what I reach for", and reaching for the same
 * thing again is the strongest possible vote.
 */
export function rememberUse(storage, assetId) {
  if (!assetId) return readLibraryMemory(storage);
  const memory = readLibraryMemory(storage);
  return write(storage, { ...memory, recent: [assetId, ...memory.recent.filter((id) => id !== assetId)].slice(0, RECENT_LIMIT) });
}

/** Starred or unstarred; returns the list as it now stands. */
export function toggleFavourite(storage, assetId) {
  if (!assetId) return readLibraryMemory(storage);
  const memory = readLibraryMemory(storage);
  const on = memory.favourite.includes(assetId);
  return write(storage, { ...memory, favourite: on ? memory.favourite.filter((id) => id !== assetId) : [...memory.favourite, assetId] });
}

/**
 * The order a row is offered in: starred first, then recently used, then the
 * library's own order.
 *
 * Sorting inside the row rather than adding a "Favourites" block above it is
 * deliberate: the row is already a grid the eye scans, and a block would cost a
 * hundred pixels of a column this audit has spent its time shortening. The
 * drawings you use rise to the top of the row you are already looking at.
 *
 * Stable within each band, so two starred drawings keep the library's order
 * between them and nothing jumps about as the memory grows.
 */
export function orderByMemory(items = [], memory = { recent: [], favourite: [] }) {
  const favourite = new Set(memory.favourite || []);
  const recent = new Map((memory.recent || []).map((id, index) => [id, index]));
  const band = (item) => (favourite.has(item?.id) ? 0 : recent.has(item?.id) ? 1 : 2);
  return items
    .map((item, index) => ({ item, index, band: band(item), rank: recent.get(item?.id) ?? 0 }))
    .sort((a, b) => a.band - b.band || (a.band === 1 ? a.rank - b.rank : 0) || a.index - b.index)
    .map((entry) => entry.item);
}
