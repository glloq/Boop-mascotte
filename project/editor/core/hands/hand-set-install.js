/**
 * Adding a gesture, and importing a set (docs/HAND_STYLES.md, "A gesture is a
 * file").
 *
 * ```text
 *  an SVG somebody drew  ──▶  gestureFromFile  ──▶  addHandGesture  ──▶  a card
 *  a set somebody shared ──▶  handSetFromFile  ──▶  installHandSet  ──▶  a library
 * ```
 *
 * The promise the refit has to keep is that **a ninth gesture is a ninth file**
 * -- no code change, no registry row, no table of numbers. This is the door an
 * author comes in through, and it is the face pack's door transposed
 * (`core/face-library/face-pack.js`): the same validation, the same
 * all-or-nothing install with rollback, the same `localStorage` key for what an
 * author has added, the same refusal to keep half of anything.
 *
 * What is here is **reading**: turning the text of a file into the records
 * `hand-set.js` validates. Writing one back out is `handSetPack`, which is how
 * an author shares what they drew.
 *
 * Pure strings and records; no DOM, and storage is whatever the caller hands in.
 */
import {
  HAND_SET_FORMAT, HAND_SET_VERSION, HAND_SET_LIBRARY, HAND_GESTURE_ID, HandSetError,
  gestureFragment, normalizeHandGesture, normalizeHandSet, validateHandGesture, validateHandSet
} from './hand-set.js';

/** Where the gestures an author added are kept, beside `boop.faceParts`. */
export const HAND_SETS_KEY = 'boop.handSets';

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const attribute = (markup, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(markup || '')?.[1] ?? null;

/** An id from a file's name: `Thumbs Up.svg` is `thumbsUp`, because a file is what an author names. */
export function gestureIdFromName(name = '') {
  const stem = String(name).split(/[\\/]/).pop().replace(/\.svg$/i, '');
  const words = stem.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return '';
  const id = words[0].charAt(0).toLowerCase() + words[0].slice(1)
    + words.slice(1).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  return HAND_GESTURE_ID.test(id) ? id : '';
}

/**
 * A gesture from the text of one SVG file.
 *
 * The file says where its pivot is and at what scale it was drawn
 * (`data-hand-pivot`, `data-hand-scale`), because only the file knows; when it
 * does not, the set in the library is assumed, which is what makes a drawing
 * saved out of a mascot and dropped back in work without an author filling
 * anything in.
 *
 * The names come off the drawing too: `data-name` on the group is what the
 * gesture is called, and `data-name` on each layer is what that part is called
 * in the layer tree. A layer with no name is called by its id, which is at
 * least true.
 */
export function gestureFromFile(source = '', { id = '', label = '', set = '', library = HAND_SET_LIBRARY } = {}) {
  const file = String(source ?? '');
  const fragment = gestureFragment(file);
  if (!fragment) return null;
  const info = library?.info || null;
  const declared = attribute(file, 'data-hand-pivot');
  const pivot = declared ? declared.trim().split(/\s+/).map(Number).slice(0, 2) : (info?.pivot ? [...info.pivot] : [0, 0]);
  const scale = Number(attribute(file, 'data-hand-scale')) || info?.scale || 1;
  const open = /<g\b[^>]*>/.exec(fragment)?.[0] || '';
  const roles = {};
  for (const match of fragment.slice(open.length).matchAll(/<[A-Za-z][\w:-]*\s[^>]*>/g)) {
    const layer = match[0];
    const layerId = attribute(layer, 'id');
    if (layerId) roles[layerId] = attribute(layer, 'data-name') || layerId;
  }
  const wanted = text(id) || gestureIdFromName(attribute(open, 'id')?.replace(/^hand-/, '') || '');
  return normalizeHandGesture({
    id: wanted,
    label: text(label) || attribute(open, 'data-name') || wanted,
    src: `${wanted}.svg`,
    artwork: fragment,
    roles,
    mirrorable: attribute(file, 'data-hand-mirrorable') !== 'false',
    origin: 'custom'
  }, { pivot: pivot.length === 2 && pivot.every(Number.isFinite) ? pivot : [0, 0], scale, set: text(set) || info?.set || '' });
}

/**
 * One gesture into the library an author is drawing from.
 *
 * A gesture has to fit the set it joins: the drawings of one hand all share a
 * pivot and a radius, so a gesture drawn at another size would be a hand that
 * changes size when it changes gesture. It is refused rather than rescaled --
 * silently resizing somebody's drawing is worse than telling them.
 */
export function addHandGesture(gesture, { library = HAND_SET_LIBRARY, storage = null, replace = false } = {}) {
  if (!gesture?.id) return { ok: false, reason: 'That file does not draw a gesture: a gesture is one <g> of named layers.', issues: [] };
  if (library.has(gesture.id)) {
    if (!replace) return { ok: false, reason: `A gesture called "${gesture.id}" is already in the set. Rename it, or replace the one that is there.`, issues: [] };
    library.remove(gesture.id);
  }
  const reach = gestureReach(gesture);
  const radius = library.info?.radius || 0;
  if (radius && reach > radius * 1.08) {
    return { ok: false, reason: `That drawing reaches ${reach.toFixed(1)} where this set's drawings fit inside ${radius}: a hand would change size when it changed gesture. Draw it to the set's own size.`, issues: [] };
  }
  try {
    const added = library.register(gesture);
    if (storage) saveCustomGestures(storage, library);
    return { ok: true, gesture: added };
  } catch (error) {
    return { ok: false, reason: error.message, issues: error.issues || [] };
  }
}

/** How far a gesture's drawing reaches from the pivot, in the drawing's own units. */
export function gestureReach(gesture) {
  let out = 0;
  for (const match of String(gesture?.artwork || '').matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
    out = Math.max(out, Math.hypot(Number(match[1]), Number(match[2])));
  }
  return out;
}

/** A gesture an author added, forgotten. A hand wearing it keeps its drawing. */
export function removeHandGesture(id, { library = HAND_SET_LIBRARY, storage = null } = {}) {
  const gesture = library.get(id);
  if (!gesture) return { ok: false, reason: `There is no gesture called "${id}" in the set.` };
  if (gesture.origin !== 'custom') return { ok: false, reason: `${gesture.label} came with the set, so it cannot be forgotten. Replace its drawing instead.` };
  library.remove(id);
  if (storage) saveCustomGestures(storage, library);
  return { ok: true, gesture };
}

/* ── A whole set ───────────────────────────────────────────────────────────── */

/**
 * A set from the text of one file: a manifest with its gestures' drawings in
 * it, the way a set travels between people.
 *
 * ```json
 * { "format": "boop-hand-set", "version": 1, "set": "mine", "name": "My hands",
 *   "pivot": [100, 100], "scale": 2, "radius": 45,
 *   "gestures": [{ "id": "wave", "label": "Wave", "artwork": "<svg …>" }] }
 * ```
 *
 * The drawings ride inside rather than beside, because a file an author picks
 * is one file. A set on disk (`project/assets/hands/<set>/`) is the same
 * records with the drawings in files of their own.
 */
export function handSetFromFile(source = '') {
  let parsed = null;
  try { parsed = JSON.parse(String(source ?? '')); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const files = {};
  for (const gesture of Array.isArray(parsed.gestures) ? parsed.gestures : []) {
    const src = text(gesture?.src) || `${text(gesture?.id)}.svg`;
    if (gesture?.artwork) files[src] = String(gesture.artwork);
  }
  return normalizeHandSet(parsed, files);
}

/**
 * A whole set into the library, all of it or none of it.
 *
 * Installing a set **replaces** the one in use, because a hand's drawings all
 * have to share a pivot and a radius: two sets at once would be two sizes of
 * hand on one mascot. A mascot already wearing drawings keeps them -- what is
 * in the document is the document's -- and the library is what it will be drawn
 * from next.
 */
export function installHandSet(input, { library = HAND_SET_LIBRARY, storage = null } = {}) {
  const set = input?.gestures && Object.isFrozen(input) ? input : normalizeHandSet(input, {});
  const check = validateHandSet(set);
  if (!check.ok) return { ok: false, set, reason: check.errors.map((issue) => issue.message).join(' '), issues: check.issues };
  try {
    library.install(set);
  } catch (error) {
    return { ok: false, set, reason: error.message, issues: error.issues || [] };
  }
  // The author's own gestures are theirs, not the set's: a set that arrives
  // does not take them away, and one that names a gesture they already have
  // wins, because the set is what the pivot and the radius come from.
  if (storage) {
    for (const gesture of loadStoredGestures(storage)) {
      if (library.has(gesture.id)) continue;
      try { library.register(gesture); } catch { /* a gesture this set has no room for */ }
    }
  }
  return { ok: true, set: { id: set.set, name: set.name, gestures: set.gestures.map((gesture) => gesture.id) } };
}

/** The library as a file somebody else can import: the set, with its drawings in it. */
export function handSetPack(library = HAND_SET_LIBRARY) {
  const info = library.info || {};
  return {
    format: HAND_SET_FORMAT,
    version: HAND_SET_VERSION,
    set: info.set || 'hands',
    name: info.name || 'Hands',
    look: info.look || 'glove',
    viewBox: info.viewBox || '',
    pivot: [...(info.pivot || [0, 0])],
    scale: info.scale || 1,
    radius: info.radius || 0,
    defaultScale: info.defaultScale ?? 1,
    fallback: info.fallback || library.ids()[0] || '',
    gestures: library.list().map((gesture) => ({
      id: gesture.id, label: gesture.label, src: gesture.src || `${gesture.id}.svg`,
      mirrorable: gesture.mirrorable, roles: { ...gesture.roles },
      paletteRoles: Object.fromEntries(Object.entries(gesture.paletteRoles).map(([id, paint]) => [id, { ...paint }])),
      anchors: Object.fromEntries(Object.entries(gesture.anchors).map(([part, at]) => [part, [...at]])),
      // Already in the drawing's own units, and said so, so a round trip
      // through a file does not move it through the file's frame twice.
      artwork: gesture.artwork, placed: true
    }))
  };
}

/* ── What an author has added, kept ────────────────────────────────────────── */

/** The gestures in storage, as records; anything the validator refuses now is skipped. */
function loadStoredGestures(storage) {
  let saved = [];
  try { saved = JSON.parse(storage?.getItem?.(HAND_SETS_KEY) || '[]'); } catch { saved = []; }
  const out = [];
  for (const item of Array.isArray(saved) ? saved : []) {
    if (!item?.id) continue;
    const gesture = normalizeHandGesture({ ...item, placed: true, origin: 'custom' });
    if (validateHandGesture(gesture).ok) out.push(gesture);
  }
  return out;
}

/** The gestures an author added, read from storage into the library. */
export function loadCustomGestures(storage, library = HAND_SET_LIBRARY) {
  const loaded = [];
  for (const gesture of loadStoredGestures(storage)) {
    if (library.has(gesture.id)) continue;
    try { loaded.push(library.register(gesture)); } catch { /* a gesture this set has no room for */ }
  }
  return loaded;
}

/** The author's gestures, written to storage: the custom ones only, the set's never. */
export function saveCustomGestures(storage, library = HAND_SET_LIBRARY) {
  const custom = library.list().filter((gesture) => gesture.origin === 'custom')
    .map((gesture) => ({ ...gesture, roles: { ...gesture.roles }, paletteRoles: { ...gesture.paletteRoles }, anchors: { ...gesture.anchors } }));
  try { storage?.setItem?.(HAND_SETS_KEY, JSON.stringify(custom)); return true; } catch { return false; }
}

export { HandSetError };
