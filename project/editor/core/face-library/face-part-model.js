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
import { normalizeHeadTurnProfile } from '../head-pose/head-pose-turn.js';

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
 * Facial hair and accessories are *multiple*: a face may wear a moustache
 * and a beard, glasses and a hat, at once. Each is its own semantic part,
 * one per mount point, and a new asset replaces the one at its mount point
 * or joins the others (roadmap phases 11 and 12).
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
  ['facialHair', 'Facial Hair', 'facialHair', 'mouth.center', true],
  ['accessory', 'Accessories', 'accessory', 'head.center', true]
];

export const FACE_PART_CATEGORIES = Object.freeze(CATEGORY_TABLE.map(([id, label, part, mountPoint, multiple = false]) => {
  const definition = part ? SEMANTIC_PART_REGISTRY[part] : null;
  if (part && !definition) throw new Error(`Face part category "${id}" names a semantic part that does not exist: ${part}`);
  return Object.freeze({
    id, label, part, mountPoint, multiple,
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
const roleMap = (value) => Object.freeze(Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {}).filter(([, item]) => typeof item === 'string' && item)));

/** The transform properties a driver hint may write: what a binding writes. */
export const DRIVER_PROPERTIES = Object.freeze(['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity', 'shapeKey']);

/**
 * How a drawing carries a movement, when the registry's default would not
 * do: `{ property, amplitude, offset, roles: { role: { amplitude, offset } } }`,
 * one per control. A binding writes `amplitude × control + offset`, so a lid
 * drawn open travels down by `-amplitude` as the eye shuts, and its lower
 * partner, listed under `roles`, travels up.
 */
function driverHints(value) {
  const out = {};
  for (const [control, hint] of Object.entries(value && typeof value === 'object' ? value : {})) {
    if (!hint || typeof hint !== 'object') continue;
    const roles = {};
    for (const [role, override] of Object.entries(hint.roles && typeof hint.roles === 'object' ? hint.roles : {})) {
      if (override && typeof override === 'object') roles[role] = Object.freeze({ amplitude: finite(override.amplitude), offset: finite(override.offset) });
    }
    // A shape driver carries the shape as drawn at the movement's end, and no amplitude: the pose is the amplitude.
    const posePath = typeof hint.posePath === 'string' && hint.posePath.trim() ? { posePath: hint.posePath.trim() } : {};
    // An offset left out is null, and the binding takes the property's own rest (1 for a scale, 0 otherwise); a NaN would move everything off the page.
    const offset = hint.offset === undefined || hint.offset === null || hint.offset === '' ? null : finite(hint.offset);
    out[control] = Object.freeze({ property: typeof hint.property === 'string' ? hint.property.trim() : '', amplitude: finite(hint.amplitude), offset, roles: Object.freeze(roles), ...posePath });
  }
  return Object.freeze(out);
}

/**
 * How each of the drawing's roles behaves when the head turns, where the role
 * table's own answer would not do (docs/HEAD_POSE_2_5D.md, "Which parts
 * turn"): `{ role: { depth, side, squash, narrow, ear, sweeps, foreshorten,
 * tilt } }`, the same flags and the same meanings.
 *
 * A role left out keeps the table's answer, which is what every asset the
 * library ships does for every role it draws. A profile that says nothing the
 * turn can read is kept as the empty thing it is, so validation can say so
 * rather than a misspelled flag quietly doing nothing.
 */
function turnProfiles(value) {
  const out = {};
  for (const [role, profile] of Object.entries(value && typeof value === 'object' ? value : {})) {
    if (!profile || typeof profile !== 'object') continue;
    out[role] = normalizeHeadTurnProfile(profile) || Object.freeze({});
  }
  return Object.freeze(out);
}

/**
 * The other parts an asset draws (roadmap phase 10: a hair style is one part
 * in the builder and three roles in the rig; a pair of eyes draws its pupils
 * and its lids). Keyed by semantic part type: the roles it names, the
 * movements it carries for that part, and how.
 */
function compositeParts(value) {
  const out = {};
  for (const [type, part] of Object.entries(value && typeof value === 'object' ? value : {})) {
    if (!part || typeof part !== 'object') continue;
    out[type] = Object.freeze({ roles: roleMap(part.roles), capabilities: Object.freeze([...new Set(strings(part.capabilities))]), drivers: driverHints(part.drivers), turn: turnProfiles(part.turn) });
  }
  return Object.freeze(out);
}

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
    roles: roleMap(source.roles),
    capabilities: Object.freeze([...new Set(strings(source.capabilities))]),
    drivers: driverHints(source.drivers),
    // How the drawing takes part in the 2.5D turn, role by role: the asset's
    // own answer where the role table's would not do (a hat and a pair of
    // glasses are both the role `element`, and sit at different depths).
    turn: turnProfiles(source.turn),
    parts: compositeParts(source.parts),
    // Pieces painted behind the face -- the back of a head of hair -- by id,
    // each a direct child of the root, so the canvas can lift it out.
    behind: Object.freeze([...new Set(strings(source.behind))]),
    // Which token each paint plays, by element id, so the drawing is painted
    // in the face's colours as it goes on (docs/FACE_PART_LIBRARY.md,
    // "Palette tokens").
    paletteRoles: paletteRoles(source.paletteRoles),
    // Where the part sits in the stack (docs/DEPTH_PARALLAX.md), for a face
    // with parallax on: null leaves the element's own.
    depth: Number.isFinite(Number(source.depth)) && source.depth !== null && source.depth !== '' ? Number(source.depth) : null,
    referenceBox: Object.freeze({ x: finite(box.x), y: finite(box.y), width: finite(box.width), height: finite(box.height) }),
    mountPoint: typeof source.mountPoint === 'string' && source.mountPoint.trim() ? source.mountPoint.trim() : (known?.mountPoint || ''),
    palette: Object.freeze([...new Set(strings(source.palette).length ? strings(source.palette) : Object.values(paletteRoles(source.paletteRoles)).flatMap((roles) => [roles.fill, roles.stroke]).filter(Boolean))]),
    origin: source.origin === 'builtin' ? 'builtin' : 'custom',
    // The pack it came in with (docs/FACE_PART_LIBRARY.md, "Face packs"), for a card to say so; null for the built-ins and the author's own.
    pack: typeof source.pack === 'string' && source.pack.trim() ? source.pack.trim() : null
  });
}

function paletteRoles(value) {
  const out = {};
  for (const [id, roles] of Object.entries(value && typeof value === 'object' ? value : {})) {
    if (!roles || typeof roles !== 'object') continue;
    const entry = {};
    for (const property of ['fill', 'stroke']) if (typeof roles[property] === 'string' && roles[property].trim()) entry[property] = roles[property].trim();
    if (Object.keys(entry).length) out[id] = Object.freeze(entry);
  }
  return Object.freeze(out);
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
  // Comments and CDATA are not tags; what is left must be tags the scanner
  // can read in full. A tag it cannot -- an attribute with no quotes, two
  // attributes glued together -- is not skipped over: the artwork is malformed,
  // as the XML parser that installs it would say, and a handler glued onto a
  // value cannot slip past the scan.
  const scanned = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  let read = 0;
  for (const [, closing, tag, attributes, selfClosing] of scanned.matchAll(TAG)) {
    read += 1;
    if (closing) {
      if (open.pop() !== tag) balanced = false;
      continue;
    }
    const id = attributes.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    elements.push({ tag, id: id ? (id[1] ?? id[2]) : null, depth: open.length });
    if (!selfClosing) open.push(tag);
  }
  if (open.length) balanced = false;
  if ((scanned.match(/<[A-Za-z/]/g) || []).length !== read) balanced = false;
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
