/**
 * What a face part *is*, in the library (docs/FACE_PART_LIBRARY.md).
 *
 * An asset is a description, not a behaviour: a piece of artwork, which of
 * its shapes plays which role of a semantic part, which movements it can
 * carry, the box it was drawn against, and where on a face it mounts. The
 * runtime never sees any of this. It sees the semantic part the asset becomes
 * once installed, so `smile = 0.8` means the same thing on every mouth the
 * library will ever hold (roadmap phase 4).
 *
 * The categories read the semantic part registry rather than repeating it:
 * the roles a mouth asset may name, the ones it must name and the movements
 * it may claim are the mouth part's own, so a control added to the rig is a
 * control an asset may claim, with nothing to update here.
 */
import { SEMANTIC_PART_REGISTRY, requiredSemanticRoles } from '../../rig-editor/semantic-parts/part-registry.js';

/**
 * Where a part mounts on a face (roadmap phase 5). Names only, for now: the
 * layout context that resolves them to coordinates arrives with auto-fit.
 */
export const FACE_MOUNT_POINTS = Object.freeze([
  'head.top', 'head.center', 'head.bottom',
  'eyes', 'eye.left', 'eye.right',
  'brows', 'brow.left', 'brow.right',
  'nose.center', 'mouth.center',
  'ears', 'ear.left', 'ear.right',
  'hair.top'
]);

/** The colours a face is painted with, as names (roadmap phase 9). An asset says which it uses. */
export const PALETTE_TOKENS = Object.freeze([
  'skin', 'skinShadow', 'outline', 'hair', 'hairShadow', 'eyeWhite', 'pupil', 'mouth', 'tongue', 'teeth', 'accessoryPrimary', 'accessorySecondary'
]);

/**
 * The categories, in the order the builder lists them: what a person calls
 * the part, which semantic part it becomes, and where it mounts by default.
 *
 * Facial hair has no semantic part yet (roadmap phase 11): it is listed so an
 * asset can be described under it, and marked as not installable until the
 * part exists.
 */
const CATEGORY_TABLE = [
  ['head', 'Head', 'head', 'head.center'],
  ['eyes', 'Eyes', 'eyes', 'eyes'],
  ['pupils', 'Pupils', 'gaze', 'eyes'],
  ['eyelids', 'Eyelids', 'eyelids', 'eyes'],
  ['eyebrows', 'Brows', 'eyebrows', 'brows'],
  ['nose', 'Nose', 'nose', 'nose.center'],
  ['mouth', 'Mouth', 'mouth', 'mouth.center'],
  ['ears', 'Ears', 'ears', 'ears'],
  ['hair', 'Hair', 'hair', 'head.top'],
  ['facialHair', 'Facial Hair', null, 'mouth.center'],
  ['accessory', 'Accessories', 'accessory', 'head.center']
];

export const FACE_PART_CATEGORIES = Object.freeze(CATEGORY_TABLE.map(([id, label, part, mountPoint]) => {
  const definition = part ? SEMANTIC_PART_REGISTRY[part] : null;
  if (part && !definition) throw new Error(`Face part category "${id}" names a semantic part that does not exist: ${part}`);
  return Object.freeze({
    id, label, part, mountPoint,
    roles: Object.freeze([...(definition?.roles || [])]),
    required: Object.freeze([...(definition ? requiredSemanticRoles(definition) : [])]),
    controls: Object.freeze([...(definition?.controls || [])]),
    installable: Boolean(definition)
  });
}));

export const FACE_PART_CATEGORY_IDS = Object.freeze(FACE_PART_CATEGORIES.map((category) => category.id));

export const facePartCategory = (id) => FACE_PART_CATEGORIES.find((category) => category.id === id) || null;

/** `category.slug`: the category first, so a listing sorts by it and a mismatch is visible. */
export const FACE_PART_ID = /^[a-z][a-z0-9]*\.[a-z0-9][a-z0-9-]*$/;

const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : NaN);
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []);

/**
 * An asset with every field in its place and its defaults filled, frozen.
 *
 * Normalising is not validating: a missing name comes back as `''` and a
 * missing box as `NaN`s, and `validateFacePart` says so. Splitting the two
 * keeps every consumer reading one shape whatever it was handed.
 */
export function normalizeFacePart(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const category = typeof source.category === 'string' ? source.category.trim() : '';
  const known = facePartCategory(category);
  const box = source.referenceBox && typeof source.referenceBox === 'object' ? source.referenceBox : {};
  return Object.freeze({
    id: typeof source.id === 'string' ? source.id.trim() : '',
    category,
    name: typeof source.name === 'string' ? source.name.trim() : '',
    description: typeof source.description === 'string' ? source.description.trim() : '',
    artwork: typeof source.artwork === 'string' ? source.artwork.trim() : '',
    roles: Object.freeze(Object.fromEntries(Object.entries(source.roles && typeof source.roles === 'object' ? source.roles : {}).filter(([, value]) => typeof value === 'string' && value))),
    capabilities: Object.freeze([...new Set(strings(source.capabilities))]),
    referenceBox: Object.freeze({ x: finite(box.x), y: finite(box.y), width: finite(box.width), height: finite(box.height) }),
    mountPoint: typeof source.mountPoint === 'string' && source.mountPoint.trim() ? source.mountPoint.trim() : (known?.mountPoint || ''),
    palette: Object.freeze([...new Set(strings(source.palette))]),
    origin: source.origin === 'builtin' ? 'builtin' : 'custom'
  });
}

/**
 * The elements an artwork fragment draws, in document order, with the depth
 * each sits at.
 *
 * A small scanner for markup this repository writes and validates: one
 * element per tag, attributes in double or single quotes. It is what the
 * template's own build-time parser is (`template-export.js`); user SVG still
 * goes through the sanitized DOM import.
 *
 * @returns {{ elements: {tag: string, id: string|null, depth: number}[], balanced: boolean }}
 */
export function scanArtwork(markup) {
  const text = String(markup ?? '');
  const elements = [];
  const open = [];
  let balanced = true;
  const TAG = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  for (const [, closing, tag, attributes, selfClosing] of text.matchAll(TAG)) {
    if (closing) {
      if (open.pop() !== tag) balanced = false;
      continue;
    }
    const id = attributes.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    elements.push({ tag, id: id ? (id[1] ?? id[2]) : null, depth: open.length });
    if (!selfClosing) open.push(tag);
  }
  if (open.length) balanced = false;
  return { elements, balanced };
}

/** Every id the artwork carries, in order, duplicates included. */
export const artworkIds = (markup) => scanArtwork(markup).elements.map((item) => item.id).filter((id) => id !== null);

/**
 * Which of the part's movements an asset carries (roadmap phase 26).
 *
 * `missing` is what the badge calls *Limited animation*: movements the part
 * has that this drawing does not claim. `unsupported` is a claim the part
 * cannot honour, which validation refuses.
 */
export function describeFacePartCapabilities(asset) {
  const normalized = normalizeFacePart(asset);
  const category = facePartCategory(normalized.category);
  const controls = category?.controls || [];
  const supported = normalized.capabilities.filter((control) => controls.includes(control));
  return {
    controls: [...controls],
    supported,
    missing: controls.filter((control) => !normalized.capabilities.includes(control)),
    unsupported: normalized.capabilities.filter((control) => !controls.includes(control)),
    complete: controls.length > 0 && controls.every((control) => normalized.capabilities.includes(control))
  };
}
