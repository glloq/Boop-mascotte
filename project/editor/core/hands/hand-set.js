/**
 * A **hand set**: a manifest and one drawing per gesture, read from disk
 * (docs/HAND_STYLES.md, "A gesture is a file").
 *
 * ```text
 * project/assets/hands/<set>/
 *   manifest.json      what the set is: pivot, scale, radius, its gestures
 *   open.svg           one <g> of named layers
 *   fist.svg           …
 * ```
 *
 * A gesture used to be a table of numbers in a module, so a ninth one was a
 * code change. It is a **file** now: the editor reads the set, an author edits
 * a drawing layer by layer, and adding a gesture is adding a drawing. The
 * geometry that seeded the eight shipped ones lives in `scripts/hand-set-seed.mjs`
 * and nothing imports it.
 *
 * This module is the data model and the registry, and it is **pure**: it takes
 * a manifest and the text of the files, and gives back normalized, validated
 * records. Who read the files — the bundler, `node:fs`, or a file the author
 * picked — is the caller's business, which is what lets the same code serve the
 * shipped set, a Node test and an import at runtime.
 *
 * It is the face part library transposed (`core/face-library/`), deliberately:
 * the same shape of asset, the same artwork rules, the same all-or-nothing
 * install. A hand is a piece like any other piece.
 */
import { scanArtwork } from '../face-library/face-part-model.js';
import { findUnsafeSvg } from '../security/sanitize-svg.js';
import { HAND_SETS } from './sets/index.js';

export const HAND_SET_FORMAT = 'boop-hand-set';
export const HAND_SET_VERSION = 1;

const round = (value) => Math.round(Number(value) * 100) / 100;
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const error = (code, message, field) => ({ severity: 'error', code, message, field });

/** A gesture id: lower case, digits and dashes, the way a file is named. */
export const HAND_GESTURE_ID = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/* ── From a file's own frame into the drawing's ────────────────────────────── */

/**
 * The numbers in a gesture file are where they are **in the file**: a 200 box
 * with the pivot in the middle, so the drawing opens as a proper icon. The
 * drawing's own frame has the pivot at the origin and one unit to a unit, which
 * is what everything downstream places, scales and mirrors in.
 *
 * Converting between them is arithmetic on every coordinate, because a path
 * written with `M`, `C`, `L` and `Z` has nothing in it but coordinates. A file
 * that uses an arc or a relative command is refused by the validator rather
 * than mis-read here.
 */
export function pathToDrawingUnits(d, pivot = [0, 0], scale = 1) {
  let index = 0;
  return String(d ?? '').replace(/[A-Za-z]|-?\d+(?:\.\d+)?/g, (token) => {
    if (/[A-Za-z]/.test(token)) { index = 0; return token; }
    const even = index % 2 === 0;
    index += 1;
    return String(round((Number(token) - pivot[even ? 0 : 1]) / scale));
  });
}

/** The same, over a whole fragment: every `d`, and the line weight with them. */
function artworkToDrawingUnits(markup, pivot, scale) {
  return String(markup ?? '')
    .replace(/\sd="([^"]*)"/g, (all, d) => ` d="${pathToDrawingUnits(d, pivot, scale)}"`)
    .replace(/\sstroke-width="([^"]*)"/g, (all, width) => ` stroke-width="${round(finite(width, 0) / scale)}"`);
}

/** The `<g>` a gesture file draws, without the `<svg>` around it. */
export function gestureFragment(file) {
  const source = String(file ?? '');
  const open = source.indexOf('<g');
  const close = source.lastIndexOf('</g>');
  if (open < 0 || close < 0) return '';
  return source.slice(open, close + 4).trim();
}

/* ── One gesture ───────────────────────────────────────────────────────────── */

/**
 * A gesture, as the registry keeps it.
 *
 * `artwork` is in the **drawing's own units** — the pivot at the origin — so a
 * reader places it without knowing which file it came from or what box that
 * file used.
 */
export function normalizeHandGesture(source = {}, { pivot = [0, 0], scale = 1, set = '' } = {}) {
  const raw = source?.artwork ?? '';
  const fragment = raw.includes('<svg') ? gestureFragment(raw) : text(raw);
  const roles = source?.roles && typeof source.roles === 'object' ? source.roles : {};
  const paletteRoles = source?.paletteRoles && typeof source.paletteRoles === 'object' ? source.paletteRoles : {};
  const anchors = source?.anchors && typeof source.anchors === 'object' ? source.anchors : {};
  return Object.freeze({
    id: text(source?.id),
    label: text(source?.label) || text(source?.id),
    src: text(source?.src),
    set: text(set),
    // Already in drawing units when the caller says so: an author's own gesture
    // saved back out of a mascot never went through a file's frame.
    artwork: source?.placed ? fragment : artworkToDrawingUnits(fragment, pivot, scale),
    roles: Object.freeze({ ...roles }),
    paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles)
      .map(([id, paint]) => [id, Object.freeze({ ...paint })]))),
    anchors: Object.freeze(Object.fromEntries(Object.entries(anchors)
      .filter(([, at]) => Array.isArray(at) && at.length === 2)
      .map(([part, at]) => [part, Object.freeze([round(at[0]), round(at[1])])]))),
    mirrorable: source?.mirrorable !== false,
    origin: text(source?.origin) || 'builtin'
  });
}

/**
 * What a gesture has to be before it is allowed near a mascot.
 *
 * The artwork rules are the face library's, to the letter
 * (`face-part-validation.js`): one root, the root has an id, nothing a
 * sanitizer would strip, no id drawn twice. A drawing an author brings is a
 * drawing a stranger wrote.
 */
export function validateHandGesture(input = {}, { taken = () => false, pivot, scale, set } = {}) {
  const gesture = Object.isFrozen(input) && input.artwork !== undefined && input.id !== undefined && input.origin
    ? input
    : normalizeHandGesture(input, { pivot, scale, set });
  const issues = [];
  if (!gesture.id) issues.push(error('id-missing', 'A gesture needs an id.', 'id'));
  else if (!HAND_GESTURE_ID.test(gesture.id)) issues.push(error('id-invalid', `"${gesture.id}" is not a gesture id: letters, digits and dashes, starting with a letter.`, 'id'));
  else if (taken(gesture.id)) issues.push(error('id-taken', `A gesture called "${gesture.id}" is already registered.`, 'id'));
  if (!gesture.label) issues.push(error('label-missing', 'A gesture needs a name people will read.', 'label'));

  const scan = scanArtwork(gesture.artwork);
  const roots = scan.elements.filter((item) => item.depth === 0);
  if (!gesture.artwork) issues.push(error('artwork-missing', 'A gesture needs artwork: one <g> of layers.', 'artwork'));
  else if (!scan.balanced || !scan.elements.length) issues.push(error('artwork-malformed', 'The artwork is not well-formed SVG markup.', 'artwork'));
  else if (roots.length !== 1) issues.push(error('artwork-malformed', `A gesture is one element, a <g> of layers, and this is ${roots.length}.`, 'artwork'));
  else if (roots[0].tag.toLowerCase() === 'svg') issues.push(error('artwork-malformed', 'The artwork is the fragment inside the file, not the whole <svg>.', 'artwork'));
  else if (!roots[0].id) issues.push(error('artwork-root-id', "The artwork's root needs an id: it is what the drawing is known by once installed.", 'artwork'));
  else if (scan.elements.length < 2) issues.push(error('artwork-empty', 'A gesture draws at least one layer inside its group.', 'artwork'));
  for (const unsafe of findUnsafeSvg(gesture.artwork)) {
    issues.push(error('artwork-unsafe', `The artwork carries ${unsafe.kind} (${unsafe.detail || ''}), which the sanitizer would remove.`, 'artwork'));
  }
  const ids = scan.elements.map((item) => item.id).filter((id) => id !== null);
  for (const id of [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]) {
    issues.push(error('artwork-duplicate-id', `The artwork draws "${id}" twice.`, 'artwork'));
  }
  // Every layer inside the root has to be nameable: the layer tree, the roles
  // and the palette all address a layer by its id.
  for (const item of scan.elements.filter((entry) => entry.depth >= 1)) {
    if (!item.id) issues.push(error('layer-id-missing', `A ${item.tag} layer has no id, so nothing can name it.`, 'artwork'));
  }
  for (const id of Object.keys(gesture.roles)) {
    if (!ids.includes(id)) issues.push(error('role-unknown', `"${id}" is given a name, and the artwork draws no layer with that id.`, 'roles'));
  }
  for (const id of Object.keys(gesture.paletteRoles)) {
    if (!ids.includes(id)) issues.push(error('palette-role-unknown', `"${id}" is painted by a token, and the artwork draws no layer with that id.`, 'paletteRoles'));
  }
  // A path is placed by arithmetic on its coordinates, so every number in it
  // has to *be* a coordinate: an arc or a relative command would be moved
  // wrongly and silently.
  for (const match of String(gesture.artwork).matchAll(/\sd="([^"]*)"/g)) {
    const commands = (match[1].match(/[A-Za-z]/g) || []).filter((letter) => !'MCLZ'.includes(letter));
    if (commands.length) issues.push(error('artwork-path-commands', `A drawing is written with M, C, L and Z, and this one uses "${commands[0]}".`, 'artwork'));
  }
  const errors = issues.filter((item) => item.severity === 'error');
  return { ok: errors.length === 0, gesture, issues, errors, warnings: issues.filter((item) => item.severity !== 'error') };
}

/* ── A whole set ───────────────────────────────────────────────────────────── */

/**
 * A set, from its manifest and the text of its files.
 *
 * @param {object} manifest the parsed `manifest.json`
 * @param {Record<string,string>} files the gesture files by `src`, as text
 */
export function normalizeHandSet(manifest = {}, files = {}) {
  const pivot = Array.isArray(manifest?.pivot) && manifest.pivot.length === 2
    ? [finite(manifest.pivot[0], 0), finite(manifest.pivot[1], 0)] : [0, 0];
  const scale = finite(manifest?.scale, 1) || 1;
  const set = text(manifest?.set);
  const listed = Array.isArray(manifest?.gestures) ? manifest.gestures : [];
  return Object.freeze({
    format: text(manifest?.format) || HAND_SET_FORMAT,
    version: finite(manifest?.version, HAND_SET_VERSION),
    set,
    name: text(manifest?.name) || set,
    look: text(manifest?.look) || 'glove',
    viewBox: text(manifest?.viewBox),
    pivot: Object.freeze(pivot),
    scale,
    radius: finite(manifest?.radius, 0),
    defaultScale: finite(manifest?.defaultScale, 1),
    fallback: text(manifest?.fallback) || text(listed[0]?.id),
    gestures: Object.freeze(listed.map((entry) => normalizeHandGesture(
      { ...entry, artwork: files?.[entry?.src] ?? files?.[`${entry?.id}.svg`] ?? '' },
      { pivot, scale, set }
    )))
  });
}

/** A set, checked whole: the manifest's own fields, then every gesture in it. */
export function validateHandSet(set = {}) {
  const issues = [];
  if (set.format !== HAND_SET_FORMAT) issues.push(error('set-format', `A hand set says format "${HAND_SET_FORMAT}".`, 'format'));
  if (!(set.version <= HAND_SET_VERSION)) issues.push(error('set-version', `This editor reads hand sets up to version ${HAND_SET_VERSION}.`, 'version'));
  if (!set.set) issues.push(error('set-id', 'A hand set needs an id.', 'set'));
  if (!set.name) issues.push(error('set-name', 'A hand set needs a name people will read.', 'name'));
  if (!set.gestures?.length) issues.push(error('set-empty', 'A hand set with no gestures in it installs nothing.', 'gestures'));
  if (!(set.radius > 0)) issues.push(error('set-radius', 'A hand set says the radius its drawings fit inside.', 'radius'));
  const seen = new Set();
  (set.gestures || []).forEach((gesture, index) => {
    const check = validateHandGesture(gesture, { taken: (id) => seen.has(id) });
    seen.add(gesture.id);
    for (const issue of check.issues) issues.push({ ...issue, field: `gestures[${index}].${issue.field}` });
  });
  if (set.fallback && !seen.has(set.fallback)) issues.push(error('set-fallback', `The set falls back to "${set.fallback}", which it does not draw.`, 'fallback'));
  const errors = issues.filter((item) => item.severity === 'error');
  return { ok: errors.length === 0, set, issues, errors, warnings: issues.filter((item) => item.severity !== 'error') };
}

/** Thrown by a registry that refuses, with the issues attached. */
export class HandSetError extends Error {
  constructor(message, issues = []) { super(message); this.name = 'HandSetError'; this.issues = issues; }
}

/**
 * The gestures the editor can draw, and what the set they came from says about
 * itself.
 *
 * One registry, one set at a time plus whatever an author has added to it: a
 * hand's drawings all have to share a pivot and a radius, so two sets at once
 * would be two different sizes of hand on one mascot.
 */
export function createHandSetRegistry() {
  const gestures = new Map();
  let info = null;
  const registry = {
    get info() { return info; },
    get size() { return gestures.size; },
    has: (id) => gestures.has(id),
    get: (id) => gestures.get(id) || null,
    ids: () => [...gestures.keys()],
    list: () => [...gestures.values()],
    /** One gesture, validated on the way in. */
    register(source, options = {}) {
      const check = validateHandGesture(source, { taken: (id) => gestures.has(id), ...options });
      if (!check.ok) throw new HandSetError(check.errors[0].message, check.issues);
      gestures.set(check.gesture.id, check.gesture);
      return check.gesture;
    },
    /**
     * A whole set: all of it or none of it.
     *
     * A set that half-installs is a mascot whose hand has three drawings and a
     * gap, so the previous one goes back if anything in the new one is refused.
     */
    install(set) {
      const check = validateHandSet(set);
      if (!check.ok) throw new HandSetError(check.errors[0].message, check.issues);
      const before = new Map(gestures), previous = info;
      try {
        gestures.clear();
        for (const gesture of set.gestures) gestures.set(gesture.id, gesture);
        info = Object.freeze({
          set: set.set, name: set.name, look: set.look, viewBox: set.viewBox, pivot: set.pivot,
          scale: set.scale, radius: set.radius, defaultScale: set.defaultScale, fallback: set.fallback
        });
      } catch (failure) {
        gestures.clear();
        for (const [id, gesture] of before) gestures.set(id, gesture);
        info = previous;
        throw failure;
      }
      return registry;
    },
    remove: (id) => gestures.delete(id)
  };
  return registry;
}

/**
 * The one the editor uses, with the shipped set already in it.
 *
 * Installed at module scope, the way the face library registers its built-ins
 * (`face-part-registry.js:96`): a hand library that fills in asynchronously is
 * a mascot with no hands for the first frames.
 */
export const HAND_SET_LIBRARY = createHandSetRegistry();
for (const source of HAND_SETS) HAND_SET_LIBRARY.install(normalizeHandSet(source.manifest, source.files));

/**
 * The layers of one gesture, in paint order, as `{ part, d }` in the drawing's
 * own units.
 *
 * The order **is** the paint order, which is the whole reason a gesture is more
 * than one shape: a finger before the palm grows out of it, a thumb after it
 * lies on it.
 */
export function gestureLayers(gesture) {
  if (!gesture?.artwork) return [];
  const out = [];
  for (const match of gesture.artwork.matchAll(/<(path|circle|ellipse|rect)\b([^>]*)>/g)) {
    const attributes = match[2];
    const id = /\sid="([^"]*)"/.exec(attributes)?.[1] || '';
    const d = /\sd="([^"]*)"/.exec(attributes)?.[1] || '';
    if (d) out.push({ part: id, d, fillRule: /\sfill-rule="([^"]*)"/.exec(attributes)?.[1] || null });
  }
  return out;
}
