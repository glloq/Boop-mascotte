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
import { assetRef, parseAssetRef } from '../../../runtime/asset-reference.js';

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
  'skin', 'skinShadow', 'outline', 'hair', 'hairShadow', 'eyeWhite', 'iris', 'pupil', 'mouth', 'tongue', 'teeth', 'accessoryPrimary', 'accessorySecondary'
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

/** A style's name, the one value of the style axis: lower case, digits and dashes, as a preset id is. */
export const FACE_STYLE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** How a drawing behaves when a face wears two of it (UI-REDESIGN-04). */
export const FACE_SYMMETRY = Object.freeze(['mirror', 'independent', 'single']);

/** A tag: a word an author searches by. Lower case, digits and dashes, as everything else that is an id here. */
export const FACE_TAG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The words a drawing is tagged with, read the way everything else reads them
 * (MASC-08C): lower case, deduped, in the order they were written, and `[]` for
 * a drawing that says nothing.
 *
 * It works on a raw asset as well as a normalised one, which is the point: the
 * save form fills its Tags field from whatever the piece came from, and a pack's
 * asset has not been through `normalizeFacePart` when it is being read.
 */
export const assetTags = (asset) => [...new Set((Array.isArray(asset?.tags) ? asset.tags : [])
  .filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim().toLowerCase()))];

/** Whether a drawing carries one tag. */
export const assetHasTag = (asset, tag) => assetTags(asset).includes(String(tag ?? '').trim().toLowerCase());

/**
 * What an author typed into a Tags field, as tags: `Cat, fox  Pointed` becomes
 * `['cat', 'fox', 'pointed']`.
 *
 * Separating is all it does. A word that is not a tag -- `cat!`, `Béa` -- comes
 * back as it was typed, so `validateFacePart` refuses it by name rather than
 * this quietly dropping it: a tag an author typed and never saw again would be
 * worse than one they are told about.
 */
export const parseFaceTags = (text) => [...new Set(String(text ?? '').split(/[,\s]+/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

/**
 * The point a generated binding turns and scales about, as a word.
 *
 * An install measures each piece of a fragment and pivots it at its own middle,
 * which is right for everything that rotates or slides and wrong for the one
 * thing that *grows*: an eyelid is the eye's own ellipse scaled about the rim
 * it sits on, so a lid pivoted at its middle opens away from the eye in both
 * directions at once instead of sweeping across it
 * (docs/EYE_BUILDS.md, *No socket*).
 *
 * Words rather than coordinates, because the asset does not know where the
 * install will put its drawing — the fit may move and scale the whole fragment.
 * `top` is the top of the piece's own measured box, and the installer resolves
 * it after the fit, so it holds wherever the drawing lands.
 */
export const DRIVER_PIVOTS = Object.freeze(['top', 'bottom', 'left', 'right', 'centre']);

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
/** A pivot word the installer knows, or nothing: an unknown word leaves the piece at its middle, as every drawing without one is. */
const pivotOf = (hint) => (DRIVER_PIVOTS.includes(hint?.pivot) ? { pivot: hint.pivot } : {});

function driverHints(value) {
  const out = {};
  for (const [control, hint] of Object.entries(value && typeof value === 'object' ? value : {})) {
    if (!hint || typeof hint !== 'object') continue;
    const roles = {};
    for (const [role, override] of Object.entries(hint.roles && typeof hint.roles === 'object' ? hint.roles : {})) {
      if (!override || typeof override !== 'object') continue;
      // A side's own shape, where the movement is shaped rather than
      // transformed: a mouth's teeth and its tongue pucker as the lips they are
      // drawn from do, and each needs its own pose (docs/MOUTH_BUILD.md).
      const rolePose = typeof override.posePath === 'string' && override.posePath.trim() ? { posePath: override.posePath.trim() } : {};
      roles[role] = Object.freeze({ amplitude: finite(override.amplitude), offset: finite(override.offset), ...pivotOf(override), ...rolePose });
    }
    // A shape driver carries the shape as drawn at the movement's end, and no amplitude: the pose is the amplitude.
    const posePath = typeof hint.posePath === 'string' && hint.posePath.trim() ? { posePath: hint.posePath.trim() } : {};
    // An offset left out is null, and the binding takes the property's own rest (1 for a scale, 0 otherwise); a NaN would move everything off the page.
    const offset = hint.offset === undefined || hint.offset === null || hint.offset === '' ? null : finite(hint.offset);
    // The sentence the movement is driven by, where the drawing needs one of its
    // own. A band drawn *from* a lip shows only when the lip parts, which is
    // `mouthOpen * teeth` -- a product -- while a card drawing a finished row of
    // teeth and fading it in wants `teeth` alone (docs/MOUTH_BUILD.md). Only
    // words the part itself moves are allowed, which validation checks.
    const expression = typeof hint.expression === 'string' && hint.expression.trim() ? { expression: hint.expression.trim() } : {};
    out[control] = Object.freeze({ property: typeof hint.property === 'string' ? hint.property.trim() : '', amplitude: finite(hint.amplitude), offset, roles: Object.freeze(roles), ...posePath, ...expression, ...pivotOf(hint) });
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
 * The part a drawing *belongs to*, rather than merely sits near: a semantic
 * part type and one of its roles, `{ part: 'ears', role: 'leftEar' }`.
 *
 * A mount point is an anchor, resolved once when the asset is fitted, and
 * nothing afterwards remembers it; a host is a **parent**. The install draws
 * the artwork inside the host's own group, so the host's every movement --
 * `earWiggle`, the head turn, a follower's lag -- composes onto it the way SVG
 * composes any nesting, with nothing to solve and nothing to run per frame.
 * Naming half of it names none of it: a part with no role, or a role with no
 * part, is no host, and validation says which half is missing.
 */
function hostReference(value) {
  const source = value && typeof value === 'object' ? value : {};
  const part = typeof source.part === 'string' ? source.part.trim() : '';
  const role = typeof source.role === 'string' ? source.role.trim() : '';
  return part || role ? Object.freeze({ part, role }) : null;
}

/**
 * The drawing this one *restyles*, and the style it restyles it into:
 * `{ of: 'accessory.glasses', style: 'robot' }` (docs/FACE_PART_LIBRARY.md,
 * "The style axis").
 *
 * A variant is the same part in another look: the same category, the same
 * roles, the same movements, another drawing. It is reached through the
 * drawing it restyles -- a preset that names `accessory.glasses` and asks
 * for the style `robot` gets this one -- and never on its own, so six
 * restyles of a pair of glasses are six drawings and one card.
 *
 * Naming half of it names none of it, as a host: a variant with no style,
 * or a style restyling nothing, is no variant, and validation says which
 * half is missing.
 */
function variantReference(value) {
  const source = value && typeof value === 'object' ? value : {};
  const of = typeof source.of === 'string' ? source.of.trim() : '';
  const style = typeof source.style === 'string' ? source.style.trim().toLowerCase() : '';
  return of || style ? Object.freeze({ of, style }) : null;
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

/**
 * A reference to a stored picture, or null.
 *
 * Null rather than a repaired object for the same reason an asset record is
 * (core/assets/asset-model.js): a part whose picture cannot be addressed is a
 * part that would install as a hole, and keeping it out is better than drawing
 * one.
 */
function pictureReference(input) {
  if (!input || typeof input !== 'object') return null;
  const reference = typeof input.assetId === 'string' ? input.assetId.trim() : '';
  const id = parseAssetRef(reference) ?? (/^[0-9a-f]{8,64}$/i.test(reference) ? reference.toLowerCase() : null);
  if (!id) return null;
  const side = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : 0);
  const width = side(input.width), height = side(input.height);
  if (!width || !height) return null;
  return Object.freeze({ assetId: id, width, height });
}

/**
 * What draws this part: its own markup, or a picture out of the store.
 *
 * The question every caller that used to assume SVG has to ask now, in one
 * place so that they cannot each answer it differently.
 */
export const partRenderer = (part) => (part?.picture ? 'image' : 'svg');

/**
 * The single element a picture-drawn part installs as.
 *
 * A markup part carries its own root id; a picture has no markup to carry one
 * in, so it borrows the id of the one role it plays. That is also why such a
 * part may only play one: a picture is one rectangle, and a drawing that has
 * to be an upper lid *and* a lower one is a drawing, not a picture.
 */
export const pictureNodeId = (part) => {
  const ids = [...new Set(Object.values(part?.roles || {}))].filter(Boolean);
  return ids.length === 1 ? ids[0] : '';
};

const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * What a part puts on the canvas, whichever way it is drawn.
 *
 * The one place that used to be "the part's markup" and is now a question.
 * A picture becomes an `<image>` at the size the part was authored against --
 * its `referenceBox` where it has one, its own pixels otherwise -- which is
 * what the installer then fits onto the face like any other fragment.
 */
export function partArtworkMarkup(part) {
  if (!part?.picture) return part?.artwork || '';
  const id = pictureNodeId(part);
  if (!id) return '';
  const box = part.referenceBox?.width && part.referenceBox?.height ? part.referenceBox : { x: 0, y: 0, width: part.picture.width, height: part.picture.height };
  return `<image id="${escapeAttribute(id)}" href="${escapeAttribute(assetRef(part.picture.assetId))}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet"/>`;
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
    /* ── What the part is drawn with (docs/V4_ROADMAP.md, Phase 5) ────────
     *
     * `artwork` is an SVG fragment and always was. `picture` is the other
     * answer: a reference into the project's asset store, drawn as an
     * `<image>`.
     *
     * Added beside `artwork` rather than by widening it. `artwork` is read as
     * a string in the installer, the validator, the scanner and the pack
     * reader; making it sometimes an object would have been a type change
     * across a subsystem to express something a second field expresses
     * exactly. A part has one or the other, and `partRenderer` is the one
     * place that asks which.
     */
    picture: pictureReference(source.picture),
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
    // The part this drawing hangs on, if it hangs on one: an anchor says where
    // it lands, a host says what carries it afterwards.
    host: hostReference(source.host),
    // The drawing this one restyles, and into which style: a variant is
    // reached through it, never listed beside it.
    variant: variantReference(source.variant),
    /* ── What kind of face, and where in it (MASC-02) ───────────────────
     *
     * All three are optional, and "said nothing" is preserved as such rather
     * than filled in: the slot an asset is offered in is derived from its
     * category when it names none (`assetSlot`), and an asset naming no
     * morphology is universal (`compatibleMorphologies`). Normalising them to
     * a guess would write that guess into the author's saved parts, where it
     * could never be told from a choice.
     */
    // The slot Design offers it in, where that is not simply its category:
    // `beak` for a mouth, `muzzle` or `whiskers` for an accessory.
    slot: typeof source.slot === 'string' ? source.slot.trim() : '',
    // The kinds of face it suits. Empty is every kind there is.
    morphologies: Object.freeze([...new Set(strings(source.morphologies).map((id) => id.trim()))]),
    /* ── How it behaves in a pair, and how many a face may wear (UI-REDESIGN-04)
     *
     * Both optional, both silent by default, for the same reason `morphologies`
     * is: a drawing written before they existed must keep working untouched.
     *
     * The pair is **reconstructed** today, at run time, from the names of the
     * rig's roles (`leftEye`, `rightEar`…) — which works for the eleven
     * categories the rig knows and for nothing else, so a piece somebody drew
     * or a pack's accessory has no pair at all. `symmetry` is how a drawing
     * says so itself:
     *
     *   mirror       the two are one: X and rotation are mirrored
     *   independent  two of them, never linked
     *   single       one only, never doubled (a nose, a beak)
     *   null         what the roles say, which is today's behaviour
     */
    symmetry: FACE_SYMMETRY.includes(source.symmetry) ? source.symmetry : null,
    /**
     * How many the face may wear. `0` means "what the category says", which is
     * `multiple` — and that is wrong for a dedicated slot: a muzzle installs as
     * an `accessory`, so the category says many, and a face wears one.
     */
    maxInstances: Number.isInteger(Number(source.maxInstances)) && Number(source.maxInstances) > 0 ? Number(source.maxInstances) : 0,
    // Words an author searches by: `cat`, `pointed`, `wolf`. Free vocabulary on
    // purpose — a tag nobody has used yet is how the next species starts.
    tags: Object.freeze([...new Set(strings(source.tags).map((tag) => tag.trim().toLowerCase()))]),
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
