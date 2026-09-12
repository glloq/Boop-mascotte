/**
 * Whether an asset may enter the library (docs/FACE_PART_LIBRARY.md, roadmap
 * phase 24).
 *
 * Every refusal is an issue with a code, a message and the field it is about,
 * so a plugin registering a pack and, later, the *Create from selection* flow
 * can show the author exactly what to fix. Errors keep an asset out; warnings
 * let it in and are what the compatibility badge reads.
 *
 * Nothing here cleans markup. The executable-content check asks the sanitizer
 * what it *would* remove (`findUnsafeSvg`), and installing the artwork still
 * runs it through `sanitizeSvgMarkup` -- one set of rules, in two places that
 * cannot drift.
 */
import { findUnsafeSvg } from '../security/sanitize-svg.js';
import { HEAD_TURN_PROFILE_KEYS, HEAD_TURN_PROFILE_NUMBERS, HEAD_TURN_PROFILE_SIDES } from '../head-pose/head-pose-turn.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { DRIVER_PROPERTIES, FACE_MOUNT_POINTS, FACE_PART_ID, FACE_STYLE_ID, FACE_TAG, PALETTE_TOKENS, describeFacePartCapabilities, facePartCategory, normalizeFacePart, scanArtwork } from './face-part-model.js';
import { FACE_MORPHOLOGY_IDS, faceMorphology, faceSlot } from './face-morphologies.js';

const issue = (severity, code, message, field = null) => ({ severity, code, message, field });
const error = (code, message, field) => issue('error', code, message, field);
const warning = (code, message, field) => issue('warning', code, message, field);

/** A driver hint names a movement the drawing claims, a property a binding can write, and roles the part has. */
function checkDrivers(issues, drivers, definition, label, capabilities, roles, field) {
  for (const [control, hint] of Object.entries(drivers || {})) {
    if (!capabilities.includes(control)) issues.push(error('driver-unknown', `A driver for "${control}", which ${label} does not claim as a movement here.`, `${field}.${control}`));
    else if (definition && !definition.controls.includes(control)) issues.push(error('driver-unknown', `${label} has no movement called "${control}".`, `${field}.${control}`));
    if (!DRIVER_PROPERTIES.includes(hint.property)) issues.push(error('driver-property-unknown', `A driver writes one of ${DRIVER_PROPERTIES.join(', ')}, not "${hint.property || '?'}".`, `${field}.${control}.property`));
    // A shape driver is the shape at the movement's end; every other driver is a number.
    if (hint.property === 'shapeKey') { if (!hint.posePath) issues.push(error('driver-pose-missing', `The driver for "${control}" deforms a shape, so it needs a posePath: the shape as drawn at the movement's end.`, `${field}.${control}.posePath`)); }
    else if (!Number.isFinite(hint.amplitude)) issues.push(error('driver-amplitude-invalid', `The driver for "${control}" needs a finite amplitude.`, `${field}.${control}.amplitude`));
    else if (hint.offset !== null && !Number.isFinite(hint.offset)) issues.push(error('driver-offset-invalid', `The driver for "${control}" needs a finite offset, or none (the property's own rest).`, `${field}.${control}.offset`));
    for (const role of Object.keys(hint.roles)) if (!roles.includes(role)) issues.push(error('driver-role-unknown', `The driver for "${control}" names a role "${role}" the asset does not draw.`, `${field}.${control}.roles.${role}`));
  }
}

/**
 * A turn profile says how one role the asset draws behaves when the head turns
 * (docs/HEAD_POSE_2_5D.md, "Which parts turn").
 *
 * The one refusal worth more than the others is the empty profile: a flag
 * spelled wrong is dropped on the way in, so a profile that says nothing is
 * almost always a profile that meant to say something.
 */
function checkTurn(issues, turn, roles, field) {
  for (const [role, profile] of Object.entries(turn || {})) {
    if (!roles.includes(role)) issues.push(error('turn-role-unknown', `A turn profile for "${role}", a role the asset does not draw.`, `${field}.${role}`));
    if (!Object.keys(profile).length) issues.push(error('turn-empty', `The turn profile for "${role}" says none of ${HEAD_TURN_PROFILE_KEYS.join(', ')}.`, `${field}.${role}`));
    for (const key of HEAD_TURN_PROFILE_NUMBERS) if (key in profile && !Number.isFinite(profile[key])) issues.push(error('turn-value-invalid', `The turn profile for "${role}" needs a finite ${key}.`, `${field}.${role}.${key}`));
    if (profile.side && !HEAD_TURN_PROFILE_SIDES.includes(profile.side)) issues.push(error('turn-side-unknown', `A part turns as its ${HEAD_TURN_PROFILE_SIDES.join(' or its ')} half, or as neither: "${profile.side}" is no side of a face.`, `${field}.${role}.side`));
  }
}

/**
 * A host names a part of the rig and one of its roles, and it is a *different*
 * part: a drawing that hangs on its own category would be a drawing hanging on
 * itself, and the install that parents one inside the other would have nowhere
 * to put it.
 */
function checkHost(issues, host, category) {
  if (!host) return;
  const definition = SEMANTIC_PART_REGISTRY[host.part];
  if (!definition) issues.push(error('host-unknown', `The drawing hangs on "${host.part || '?'}", and there is no semantic part called that.`, 'host.part'));
  else if (!definition.roles.includes(host.role)) issues.push(error('host-role-unknown', `${definition.displayName} has no role called "${host.role || '?'}" to hang on.`, 'host.role'));
  if (category && host.part === category.part) issues.push(error('host-own', `${category.label} cannot hang on itself.`, 'host.part'));
}

/**
 * A variant restyles one drawing of the same category into one style
 * (docs/FACE_PART_LIBRARY.md, "The style axis").
 *
 * Three rules keep resolving a style a lookup rather than a walk, and keep
 * an author from being handed two answers: the drawing restyled exists and
 * is of the same category; it is not itself a restyle, so the chain is one
 * link long; and no other drawing already restyles it into that style. The
 * library is what knows the last two, so a validator called without one
 * checks the shape and leaves them, exactly as it does with a taken id.
 */
function checkVariant(issues, asset, library) {
  const variant = asset.variant;
  if (!variant) return;
  if (!variant.of) issues.push(error('variant-asset-missing', 'A variant restyles a drawing: name the asset it is a style of.', 'variant.of'));
  if (!variant.style) issues.push(error('variant-style-missing', `A variant is a drawing in one style: name the style "${variant.of || '?'}" is restyled into.`, 'variant.style'));
  else if (!FACE_STYLE_ID.test(variant.style)) issues.push(error('variant-style-format', `"${variant.style}" is not a style name: lower-case letters, digits and dashes.`, 'variant.style'));
  if (!variant.of) return;
  if (variant.of === asset.id) { issues.push(error('variant-own', 'A drawing cannot be a style of itself.', 'variant.of')); return; }
  const base = library?.get?.(variant.of) || null;
  if (!library) return;
  if (!base) { issues.push(error('variant-unknown', `There is no asset called "${variant.of}" for this to be a style of.`, 'variant.of')); return; }
  if (base.category !== asset.category) issues.push(error('variant-category', `"${variant.of}" is a ${base.category} asset, and this is a ${asset.category} one: a style restyles the same part.`, 'variant.of'));
  if (base.variant) issues.push(error('variant-chained', `"${variant.of}" is itself a style of "${base.variant.of}": a style restyles a drawing, not another style of it.`, 'variant.of'));
  const already = variant.style ? library?.variant?.(variant.of, variant.style) : null;
  if (already && already.id !== asset.id) issues.push(error('variant-taken', `"${already.id}" is already the ${variant.style} style of "${variant.of}".`, 'variant.style'));
}

/**
 * Where an author is offered the drawing, what kinds of face it suits, and the
 * words they can find it by (MASC-02).
 *
 * All three are optional, and an asset that says none of them is a complete
 * asset: it is offered under its own category, in every kind of face. That is
 * the contract that lets the field arrive with no migration — every drawing
 * written before today says nothing.
 *
 * What is refused is saying something that cannot be true. A slot belongs to
 * one category, so a `beak` drawn as a pair of ears would be offered where it
 * cannot install; a morphology is one of five, so a typo would quietly hide a
 * drawing in every kind of face there is. Neither is a thing to discover by its
 * absence from a list.
 */
function checkMorphology(issues, asset, category) {
  if (asset.slot) {
    const slot = faceSlot(asset.slot);
    if (!slot) issues.push(error('slot-unknown', `There is no slot called "${asset.slot}".`, 'slot'));
    else if (category && slot.category !== asset.category) issues.push(error('slot-category', `The "${slot.label}" slot holds ${slot.category} drawings, and this is a ${asset.category} one.`, 'slot'));
  }
  for (const id of asset.morphologies) {
    if (id === '*') continue;
    if (!faceMorphology(id)) issues.push(error('morphology-unknown', `There is no kind of face called "${id}": it is one of ${FACE_MORPHOLOGY_IDS.join(', ')}, or "*" for every kind.`, 'morphologies'));
  }
  // "Every kind" and a list of kinds are two different claims, and an asset
  // making both has said nothing anyone can act on.
  if (asset.morphologies.includes('*') && asset.morphologies.length > 1) issues.push(error('morphology-mixed', 'An asset is either for every kind of face ("*") or for the kinds it names, not both.', 'morphologies'));
  for (const tag of asset.tags) if (!FACE_TAG.test(tag)) issues.push(error('tag-format', `"${tag}" is not a tag: lower-case letters, digits and dashes.`, 'tags'));
}

/**
 * @param {object} input the asset as handed in
 * @param {{ taken?: (id: string) => boolean, library?: { get: (id: string) => object|null, variant?: (of: string, style: string) => object|null }|null }} [options]
 *   `taken` is whether an id is already in the registry; `library` is the registry the asset is
 *   joining, which is what a variant's own drawing is checked against
 * @returns {{ ok: boolean, asset: object, issues: object[], errors: object[], warnings: object[] }}
 */
export function validateFacePart(input, { taken = () => false, library = null } = {}) {
  const asset = normalizeFacePart(input);
  const issues = [];
  const category = facePartCategory(asset.category);

  if (!asset.id) issues.push(error('id-missing', 'An asset needs an id, like "mouth.cartoon-wide".', 'id'));
  else if (!FACE_PART_ID.test(asset.id)) issues.push(error('id-format', `"${asset.id}" is not a valid id: lower-case letters, digits and dashes, as category.name.`, 'id'));
  // An id is lower case by definition; a category such as `facialHair` is not.
  else if (category && asset.id.split('.')[0] !== category.id.toLowerCase()) issues.push(error('id-category', `"${asset.id}" should start with its category, "${category.id.toLowerCase()}.".`, 'id'));
  if (asset.id && taken(asset.id)) issues.push(error('id-taken', `An asset called "${asset.id}" is already registered.`, 'id'));

  if (!category) issues.push(error('category-unknown', `Unknown category "${asset.category}".`, 'category'));
  else if (!category.installable) issues.push(warning('not-installable', `${category.label} has no semantic part yet: the asset is listed but cannot be installed.`, 'category'));

  if (!asset.name) issues.push(error('name-missing', 'An asset needs a name people will read.', 'name'));

  const scan = scanArtwork(asset.artwork);
  const roots = scan.elements.filter((item) => item.depth === 0);
  if (!asset.artwork) issues.push(error('artwork-missing', 'An asset needs artwork: an SVG fragment.', 'artwork'));
  else if (!scan.balanced || !scan.elements.length) issues.push(error('artwork-malformed', 'The artwork is not well-formed SVG markup.', 'artwork'));
  else if (roots.length !== 1) issues.push(error('artwork-malformed', `The artwork must be one element, usually a <g>, and it is ${roots.length}.`, 'artwork'));
  else if (roots[0].tag.toLowerCase() === 'svg') issues.push(error('artwork-malformed', 'The artwork is a fragment drawn inside the mascot, not a whole <svg> document.', 'artwork'));
  // The root is the instance: what the builder selects, moves and takes out
  // again. A root with no id is a root nothing can name.
  else if (!roots[0].id) issues.push(error('artwork-root-id', 'The artwork\'s root element needs an id: it is what the part is known by once installed.', 'artwork'));
  for (const unsafe of findUnsafeSvg(asset.artwork)) issues.push(error('artwork-unsafe', `The artwork carries ${unsafe.kind === 'script' ? 'a script' : unsafe.kind === 'event-handler' ? `an event handler (${unsafe.detail})` : unsafe.kind === 'external-reference' ? `an external reference (${unsafe.detail})` : unsafe.kind === 'foreign-object' ? 'a foreignObject' : unsafe.kind === 'external-css' ? 'external CSS' : unsafe.kind === 'javascript-url' ? 'a javascript: URL' : unsafe.detail}, which the sanitizer would remove.`, 'artwork'));
  const ids = scan.elements.map((item) => item.id).filter((id) => id !== null);
  for (const id of ids.filter((id, index) => ids.indexOf(id) !== index).filter((id, index, all) => all.indexOf(id) === index)) issues.push(error('artwork-duplicate-id', `The artwork draws "${id}" twice.`, 'artwork'));
  // A piece painted behind the face is lifted out of the fragment whole, so it
  // has to be a piece of its own: a direct child of the root.
  for (const id of asset.behind) {
    const found = scan.elements.find((item) => item.id === id);
    if (!found) issues.push(error('behind-unknown', `"${id}" is listed as painted behind, and the artwork draws no element with that id.`, 'behind'));
    else if (found.depth !== 1) issues.push(error('behind-nested', `"${id}" is painted behind, so it must sit directly inside the root, not ${found.depth === 0 ? 'be the root' : 'inside another piece'}.`, 'behind'));
  }

  if (category) {
    for (const [role, elementId] of Object.entries(asset.roles)) {
      if (!category.roles.includes(role)) issues.push(error('role-unknown', `${category.label} has no role called "${role}".`, `roles.${role}`));
      else if (!ids.includes(elementId)) issues.push(error('role-artwork-missing', `The role "${role}" names "${elementId}", and the artwork draws no element with that id.`, `roles.${role}`));
    }
    for (const role of category.required) if (!asset.roles[role]) issues.push(error('role-required-missing', `${category.label} needs its "${role}" role.`, `roles.${role}`));
    const shared = Object.entries(asset.roles).filter(([, elementId], index, all) => all.findIndex(([, other]) => other === elementId) !== index);
    for (const [role, elementId] of shared) issues.push(error('role-shared', `"${elementId}" plays "${role}" and another role; one shape plays one role.`, `roles.${role}`));

    const capabilities = describeFacePartCapabilities(asset);
    for (const control of capabilities.unsupported) issues.push(error('capability-unsupported', `${category.label} has no movement called "${control}".`, 'capabilities'));
    if (capabilities.missing.length && category.installable) issues.push(warning('capabilities-incomplete', `Limited animation: ${capabilities.missing.join(', ')} ${capabilities.missing.length === 1 ? 'is' : 'are'} not carried by this drawing.`, 'capabilities'));
    checkDrivers(issues, asset.drivers, category.part ? SEMANTIC_PART_REGISTRY[category.part] : null, category.label, asset.capabilities, Object.keys(asset.roles), 'drivers');
    checkTurn(issues, asset.turn, Object.keys(asset.roles), 'turn');

    // The other parts the drawing carries: each a real part, not the
    // category's own, with roles it has, on shapes the artwork draws, each
    // shape playing one role in the whole asset.
    const taken = new Map(Object.entries(asset.roles).map(([role, elementId]) => [elementId, role]));
    for (const [type, part] of Object.entries(asset.parts)) {
      const definition = SEMANTIC_PART_REGISTRY[type];
      if (!definition) { issues.push(error('parts-unknown', `There is no semantic part called "${type}".`, `parts.${type}`)); continue; }
      if (type === category.part) { issues.push(error('parts-own', `${category.label} is the asset's own part; its roles go under "roles".`, `parts.${type}`)); continue; }
      for (const [role, elementId] of Object.entries(part.roles)) {
        if (!definition.roles.includes(role)) issues.push(error('parts-role-unknown', `${definition.displayName} has no role called "${role}".`, `parts.${type}.roles.${role}`));
        else if (!ids.includes(elementId)) issues.push(error('role-artwork-missing', `The role "${role}" of ${definition.displayName} names "${elementId}", and the artwork draws no element with that id.`, `parts.${type}.roles.${role}`));
        if (taken.has(elementId)) issues.push(error('role-shared', `"${elementId}" plays "${role}" of ${definition.displayName} and "${taken.get(elementId)}"; one shape plays one role.`, `parts.${type}.roles.${role}`));
        else taken.set(elementId, role);
      }
      for (const control of part.capabilities) if (!definition.controls.includes(control)) issues.push(error('capability-unsupported', `${definition.displayName} has no movement called "${control}".`, `parts.${type}.capabilities`));
      checkDrivers(issues, part.drivers, definition, definition.displayName, part.capabilities, Object.keys(part.roles), `parts.${type}.drivers`);
      checkTurn(issues, part.turn, Object.keys(part.roles), `parts.${type}.turn`);
    }
  }

  if (asset.mountPoint && !FACE_MOUNT_POINTS.includes(asset.mountPoint)) issues.push(error('mount-point-unknown', `Unknown mount point "${asset.mountPoint}".`, 'mountPoint'));
  checkHost(issues, asset.host, category);
  checkVariant(issues, asset, library);
  checkMorphology(issues, asset, category);
  const box = asset.referenceBox;
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) issues.push(error('reference-box-invalid', 'The reference box needs a finite x and y and a positive width and height: the box the artwork was drawn against.', 'referenceBox'));
  for (const token of asset.palette) if (!PALETTE_TOKENS.includes(token)) issues.push(error('palette-token-unknown', `Unknown palette token "${token}".`, 'palette'));
  if (asset.depth !== null && (asset.depth < -1 || asset.depth > 1)) issues.push(error('depth-out-of-range', 'A depth sits between -1 (behind) and 1 (in front).', 'depth'));
  for (const [id, roles] of Object.entries(asset.paletteRoles)) {
    if (!ids.includes(id)) issues.push(error('palette-role-unknown', `"${id}" plays a palette token, and the artwork draws no element with that id.`, `paletteRoles.${id}`));
    for (const [property, token] of Object.entries(roles)) if (!PALETTE_TOKENS.includes(token)) issues.push(error('palette-token-unknown', `Unknown palette token "${token}".`, `paletteRoles.${id}.${property}`));
  }

  const errors = issues.filter((item) => item.severity === 'error'), warnings = issues.filter((item) => item.severity === 'warning');
  return { ok: errors.length === 0, asset, issues, errors, warnings };
}
