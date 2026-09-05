/**
 * Authoring pins (docs/FACE_CONTROL_RIG.md, CR-20 … CR-24).
 *
 * The runtime knows how to hold artwork by a point (`runtime/rig-pins.js`).
 * This is the half an author touches: placing one, giving it a reach, saying
 * how softly it lets go, and saying what moves it.
 *
 * Two things are deliberately *not* here.
 *
 * There is **no weight painting**. A pin has a position, a radius and a
 * softness, and the weights fall out of those three numbers. Weight painting is
 * the thing every rigger complains about and every mascot author would simply
 * never do.
 *
 * There is **no automatic pinning**. A pin is a decision about how a face is
 * built; generating a dozen of them from the artwork would produce a rig nobody
 * chose and nobody can read. The one exception is the head's own surface, where
 * the positions come from the projection rather than from taste (`surface-pins.js`).
 *
 * Pure document operations: they mutate the rig they are handed, and the
 * command layer wraps them in one undo step.
 */
import { PIN_FALLOFFS, RIG_PIN_TYPES, compilePinTarget, normalizeRigPin, normalizeRigPins, pinInfluence, pinsFor } from '../../../runtime/runtime.js';

export { PIN_FALLOFFS, PIN_FALLOFF_PRESETS, RIG_PIN_TYPES } from '../../../runtime/runtime.js';

/**
 * How softly a pin lets go, in words rather than an exponent.
 *
 * The order is the order they are offered in, which is firmest first: an
 * author reaching for a pin usually wants it to *hold*, and softens it when
 * the artwork creases.
 */
export const PIN_SOFTNESS_PRESETS = Object.freeze([
  Object.freeze({ id: 'rigid', label: 'Rigid', hint: 'Everything inside the reach moves as one piece.' }),
  Object.freeze({ id: 'firm', label: 'Firm', hint: 'Holds close, lets go quickly.' }),
  Object.freeze({ id: 'smooth', label: 'Smooth', hint: 'Neither creases at the pin nor at the rim. The one to start with.' }),
  Object.freeze({ id: 'soft', label: 'Soft', hint: 'Spreads the movement out over the whole reach.' }),
  Object.freeze({ id: 'verySoft', label: 'Very soft', hint: 'Barely holds: the artwork drifts rather than moves.' })
]);

/** What each kind of pin is for, in the words a panel uses. */
export const PIN_TYPE_LABELS = Object.freeze({
  hard: 'Hard · holds rigidly',
  soft: 'Soft · fades outwards',
  directional: 'Directional · one axis only',
  slide: 'Slide · rides its own line',
  surface: 'Surface · turns with the head'
});

const list = (rig) => (Array.isArray(rig?.rigPins) ? rig.rigPins : []);

/** A readable id from the artwork and what the pin is for, unique in the rig. */
export function pinIdFrom(target, name, taken = []) {
  const base = `${String(target || 'pin')}-${String(name || 'pin')}`
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pin';
  if (!taken.includes(base)) return base;
  for (let index = 2; index < 99; index += 1) if (!taken.includes(`${base}-${index}`)) return `${base}-${index}`;
  return `${base}-${Date.now()}`;
}

/**
 * Put a pin on a piece of artwork.
 *
 * The artwork has to have a rest shape: a pin holds a *path*, and an element
 * with no `restPath` has no points to hold. Saying so here is the difference
 * between a pin that does nothing and a message that says why.
 */
export function createRigPin(rig, { target, position, ...options } = {}) {
  if (!rig?.elements?.[target]) throw new Error(`There is no artwork called "${target}".`);
  if (typeof rig.elements[target].restPath !== 'string' || !rig.elements[target].restPath.trim()) {
    throw new Error('A pin holds a drawn path. This artwork has no shape of its own to hold.');
  }
  const id = options.id || pinIdFrom(target, options.name, list(rig).map((pin) => pin.id));
  if (list(rig).some((pin) => pin.id === id)) throw new Error(`A pin called "${id}" already exists.`);
  const pin = normalizeRigPin({ ...options, id, target, position });
  if (!pin) throw new Error('A pin needs a name and a piece of artwork.');
  rig.rigPins = [...list(rig), pin];
  return pin;
}

/** Move one, in the artwork's own coordinates. */
export function moveRigPin(rig, id, position) {
  return patchRigPin(rig, id, (pin) => ({ ...pin, position: { x: Number(position?.x) || 0, y: Number(position?.y) || 0 } }));
}

/** Change its reach, its softness, its kind or the axis it is allowed to use. */
export function configureRigPin(rig, id, changes = {}) {
  return patchRigPin(rig, id, (pin) => ({
    ...pin,
    ...(RIG_PIN_TYPES.includes(changes.type) ? { type: changes.type } : {}),
    ...(PIN_FALLOFFS.includes(changes.falloff) ? { falloff: changes.falloff } : {}),
    ...(Number.isFinite(Number(changes.radius)) ? { radius: Number(changes.radius) } : {}),
    ...(Number.isFinite(Number(changes.strength)) ? { strength: Number(changes.strength) } : {}),
    ...(changes.direction ? { direction: changes.direction } : {}),
    ...(changes.motion !== undefined ? { motion: changes.motion } : {})
  }));
}

/** What moves it: the same `expression · amplitude + offset` a binding uses. */
export function driveRigPin(rig, id, motion) {
  return patchRigPin(rig, id, (pin) => ({ ...pin, motion }));
}

export function removeRigPin(rig, id) {
  const before = list(rig).length;
  rig.rigPins = list(rig).filter((pin) => pin.id !== id);
  return rig.rigPins.length < before;
}

function patchRigPin(rig, id, change) {
  const index = list(rig).findIndex((pin) => pin.id === id);
  if (index < 0) throw new Error(`There is no pin called "${id}".`);
  const next = normalizeRigPin(change(structuredClone(list(rig)[index])));
  if (!next) throw new Error('That change would leave the pin with nothing to hold.');
  rig.rigPins = list(rig).map((pin, at) => (at === index ? next : pin));
  return next;
}

/**
 * The pins on one piece of artwork, with what each one is actually holding.
 *
 * `reach` is the number of points a pin moves. It is the one number that says
 * whether a radius is doing anything: a pin holding no points is a pin in the
 * wrong place, and a pin holding every point is a transform with extra steps.
 */
export function pinOverlay(document = {}, elementId = null) {
  if (!elementId) return null;
  const pins = pinsFor(normalizeRigPins(document), elementId);
  const restPath = document?.elements?.[elementId]?.restPath;
  if (!pins.length || typeof restPath !== 'string' || !restPath.trim()) return null;
  let influence = [];
  try { influence = pinInfluence(compilePinTarget(restPath, pins), pins); } catch { influence = []; }
  const byId = new Map(influence.map((item) => [item.id, item]));
  return {
    target: elementId,
    restPath,
    pins: pins.map((pin) => ({ ...pin, ...(byId.get(pin.id) || { reach: 0, share: 0 }) }))
  };
}

/**
 * Every pin in the project, grouped by the artwork it holds, for a panel.
 *
 * A pin whose artwork the project has lost is still reported: losing artwork
 * is an accident, and silently dropping the rig built on it makes the accident
 * unrecoverable.
 */
export function rigPinModel(document = {}) {
  const pins = normalizeRigPins(document);
  const groups = new Map();
  for (const pin of pins) {
    if (!groups.has(pin.target)) groups.set(pin.target, []);
    groups.get(pin.target).push(pin);
  }
  return [...groups].map(([target, items]) => ({
    target,
    name: document.layerMetadata?.[target]?.name || target,
    missing: !document.elements?.[target],
    shapeless: Boolean(document.elements?.[target]) && !String(document.elements[target].restPath || '').trim(),
    pins: items.map((pin) => ({ ...pin, label: PIN_TYPE_LABELS[pin.type] || pin.type }))
  }));
}
