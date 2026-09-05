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

/**
 * Change its reach, its softness, its kind or the axis it is allowed to use.
 *
 * A reach is an **ellipse** (`runtime/rig-pins.js`): a mouth is ten times wider
 * than it is tall, and a circular reach that covers its corners also covers its
 * upper lip. `radiusX` and `radiusY` therefore change one axis and leave the
 * other alone — a panel that offered one number and wrote it as a circle would
 * silently flatten the very ellipse the mouth and the brows depend on. A plain
 * `radius` still means what it says: the same reach in both directions.
 */
export function configureRigPin(rig, id, changes = {}) {
  const axis = (pin) => {
    const x = Number.isFinite(Number(changes.radiusX)) ? Number(changes.radiusX) : pin.radius.x;
    const y = Number.isFinite(Number(changes.radiusY)) ? Number(changes.radiusY) : pin.radius.y;
    return { radius: { x, y } };
  };
  return patchRigPin(rig, id, (pin) => ({
    ...pin,
    ...(RIG_PIN_TYPES.includes(changes.type) ? { type: changes.type } : {}),
    ...(PIN_FALLOFFS.includes(changes.falloff) ? { falloff: changes.falloff } : {}),
    ...(Number.isFinite(Number(changes.radius)) ? { radius: Number(changes.radius) } : {}),
    ...(changes.radiusX !== undefined || changes.radiusY !== undefined ? axis(pin) : {}),
    ...(Number.isFinite(Number(changes.strength)) ? { strength: Number(changes.strength) } : {}),
    ...(changes.direction ? { direction: changes.direction } : {}),
    ...(changes.motion !== undefined ? { motion: changes.motion } : {})
  }));
}

/** What moves it: the same `expression · amplitude + offset` a binding uses. */
export function driveRigPin(rig, id, motion) {
  return patchRigPin(rig, id, (pin) => ({ ...pin, motion }));
}

/** A direction as an angle in degrees, 0° to the right and 90° down, the way the artwork's y runs. */
export const pinAngle = (pin) => (pin?.direction ? Math.round((Math.atan2(pin.direction.y, pin.direction.x) * 180) / Math.PI * 10) / 10 : 90);
export const pinDirection = (degrees) => { const angle = (Number(degrees) || 0) * Math.PI / 180; return { x: Math.cos(angle), y: Math.sin(angle) }; };

/**
 * The same pin on the other side.
 *
 * A face is symmetric and a rig is written twice: a pin on the left mouth
 * corner wants its twin on the right, reflected about the middle of the
 * artwork it holds, going the other way sideways. The twin holds the same
 * artwork (or another piece, for a pair of eyelids), reaches as far, lets go
 * as softly, and is moved by the same movements with the sideways amount
 * turned around — a left corner that widens to the left has a right corner
 * that widens to the right.
 */
export function mirrorRigPin(rig, id, { about, target = null, name = null } = {}) {
  const source = list(rig).find((pin) => pin.id === id);
  if (!source) throw new Error(`There is no pin called "${id}".`);
  const axis = Number(about);
  if (!Number.isFinite(axis)) throw new Error('A mirror needs a middle to reflect about.');
  const flip = (motion) => (motion?.grid ? motion : Object.fromEntries(Object.entries(motion || {}).map(([key, entry]) => [key, key === 'x' && entry ? { ...entry, amplitude: -Number(entry.amplitude || 0), offset: -Number(entry.offset || 0) } : entry])));
  const twinName = name || (/left/i.test(id) ? id.replace(/left/i, (word) => (word[0] === 'L' ? 'Right' : 'right')) : /right/i.test(id) ? id.replace(/right/i, (word) => (word[0] === 'R' ? 'Left' : 'left')) : `${id}-mirror`);
  const twinId = list(rig).some((pin) => pin.id === twinName) ? pinIdFrom(target || source.target, twinName.replace(`${source.target}-`, ''), list(rig).map((pin) => pin.id)) : twinName;
  return createRigPin(rig, {
    ...structuredClone(source), id: twinId, target: target || source.target,
    position: { x: axis * 2 - source.position.x, y: source.position.y },
    direction: source.direction ? { x: -source.direction.x, y: source.direction.y } : undefined,
    motion: flip(source.motion)
  });
}

/**
 * Several pins moved by one movement: a cheek that puffs, a lip that curls,
 * a jowl that sags — three pins, one sentence. Each pin keeps the axis it is
 * not told about, so a corner still rises with the smile while its width now
 * follows the new movement. A movement the rig does not have yet is created,
 * resting at 0, so the moment the group exists there is a thing to key.
 *
 * @param {object} motion  `{ parameter, x?: amount, y?: amount }` — an axis left out is left alone, an amount of 0 clears it
 */
export function groupRigPins(rig, ids, { parameter, x = null, y = null, range = [-1, 1] } = {}) {
  const name = String(parameter || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('A movement needs a name made of letters and digits, like cheekPuff.');
  const targets = (ids || []).filter((id) => list(rig).some((pin) => pin.id === id));
  if (!targets.length) throw new Error('Pick at least one pin to move together.');
  if (x === null && y === null) throw new Error('Say how far the pins go, sideways or up and down.');
  rig.params ||= {};
  if (!rig.params[name]) {
    rig.params[name] = { type: 'number', min: Number(range[0]), max: Number(range[1]), default: 0, value: 0 };
    for (const pose of Object.values(rig.states || {})) if (!(name in pose)) pose[name] = 0;
  }
  const axisEntry = (amount) => (Number(amount) ? { expression: name, amplitude: Number(amount), offset: 0 } : null);
  for (const id of targets) {
    patchRigPin(rig, id, (pin) => {
      const motion = pin.motion?.grid ? {} : { ...(pin.motion || {}) };
      for (const [axis, amount] of [['x', x], ['y', y]]) {
        if (amount === null) continue;
        const entry = axisEntry(amount);
        if (entry) motion[axis] = entry; else delete motion[axis];
      }
      return { ...pin, motion: Object.keys(motion).length ? motion : null };
    });
  }
  return { parameter: name, pins: targets };
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
