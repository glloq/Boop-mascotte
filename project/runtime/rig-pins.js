/**
 * Pins: the structural layer under the controls (docs/FACE_CONTROL_RIG.md).
 *
 * Everything the rig could do to a shape until now moved *all of it*: a
 * transform slides the whole mouth, a shape key swaps the whole outline, a warp
 * grid pushes a rectangle of space around. None of those can say "this corner
 * of the mouth, and the artwork near it, comes up" — which is the sentence a
 * facial rig is made of.
 *
 * A **pin** is a point on a piece of artwork that other things can move, and
 * that the artwork near it follows:
 *
 * ```text
 *          .
 *       .  ●  .        a soft pin: the artwork inside its radius follows,
 *          .           less and less the further out it is
 * ```
 *
 * ```text
 *   ◇━━━━━━━━━━━▶      a directional pin: it may only move along its own axis
 * ```
 *
 * The weights are computed once, from the distance between each point of the
 * path and each pin, and normalized so overlapping pins share a point rather
 * than both claiming it. **There is no weight painting.** An author places a
 * pin, gives it a radius and picks how soft it is; the rest is arithmetic.
 *
 * ```text
 * distance vertex → pin  →  falloff  →  weight  →  normalize  →  Σ ≤ 1
 * ```
 *
 * Pure and cheap: compiling is O(points × pins) and happens once per path, and
 * a frame is one multiply-add per point per pin that actually moved. No
 * iteration, no solver, nothing that can fail to converge.
 */
import { clamp, finite, roundTo } from './numeric.js';
import { parsePath, serializePath } from './path-vector.js';
import { interpolate2D } from './keyforms.js';

/**
 * What a pin is.
 *
 * | Type | Holds | For |
 * | --- | --- | --- |
 * | `hard` | everything in its radius, rigidly | a jaw hinge, a bone |
 * | `soft` | its radius, fading outwards | a cheek, a corner of a mouth |
 * | `directional` | the same, but only along its own axis | a brow that may only raise |
 * | `slide` | the same, re-aimed along its axis | a mouth corner riding the lip line |
 * | `surface` | a point on the head's logical surface | a feature that has to turn with the head |
 */
export const RIG_PIN_TYPES = Object.freeze(['hard', 'soft', 'directional', 'slide', 'surface']);

/**
 * How quickly a pin lets go of the artwork around it.
 *
 * The exponent on `(1 − d/r)`. A big exponent releases fast and reads as
 * *firm*; a small one spreads the movement out and reads as *soft*. `smooth`
 * is the smoothstep, which is the one that looks right on a cheek because its
 * slope is zero at both ends — it neither creases at the pin nor at the rim.
 */
export const PIN_FALLOFFS = Object.freeze(['smooth', 'linear', 'rigid', 'firm', 'soft', 'verySoft']);

/** The presets an author picks from, rather than a number nobody can picture. */
export const PIN_FALLOFF_PRESETS = Object.freeze({ rigid: 4, firm: 2, linear: 1, soft: 0.6, verySoft: 0.35 });

const DEFAULT_RADIUS = 24;

const point = (value, fallback = 0) => ({ x: finite(value?.x, fallback), y: finite(value?.y, fallback) });

/**
 * How far a pin reaches, in each direction.
 *
 * A number is a circle, and a circle is the wrong shape for most of a face: a
 * mouth is sixty units wide and six tall, so *any* circular reach that covers
 * its corners also covers its upper lip, and a jaw that drops takes the whole
 * mouth with it. A reach may therefore be an ellipse — `{ x, y }` — and the
 * distance is measured in units of it.
 */
function radiusOf(source) {
  if (source && typeof source === 'object') {
    const x = Math.max(0.5, finite(source.x, DEFAULT_RADIUS) || DEFAULT_RADIUS);
    const y = Math.max(0.5, finite(source.y, x) || x);
    return { x, y };
  }
  const radius = Math.max(0.5, finite(source, DEFAULT_RADIUS) || DEFAULT_RADIUS);
  return { x: radius, y: radius };
}

/** How far a point is from a pin, in units of that pin's own reach. */
export function pinDistance(pin, x, y) {
  return Math.hypot((x - pin.position.x) / pin.radius.x, (y - pin.position.y) / pin.radius.y);
}

/** What a point at that reach follows, before the pin's own strength. */
export const pinWeightAt = (pin, x, y) => {
  const reach = pinDistance(pin, x, y);
  // A hard pin does not fade: everything inside it is one rigid island.
  return pin.type === 'hard' ? (reach <= 1 ? 1 : 0) : pinFalloff(reach, 1, pin.falloff);
};

/** One pin, with everything a partial record leaves out filled in. */
export function normalizeRigPin(source = {}) {
  const id = typeof source?.id === 'string' && source.id.trim() ? source.id.trim() : null;
  const target = typeof source?.target === 'string' && source.target.trim() ? source.target.trim() : null;
  if (!id || !target) return null;
  const type = RIG_PIN_TYPES.includes(source.type) ? source.type : 'soft';
  const falloff = PIN_FALLOFFS.includes(source.falloff) ? source.falloff : 'smooth';
  const pin = {
    id, target, type, falloff,
    position: point(source.position),
    // A radius of 0 is a pin nothing follows, which is a pin that does nothing:
    // it is a mistake rather than a choice, so it falls back to the default.
    radius: radiusOf(source.radius),
    strength: clamp(finite(source.strength, 1), 0, 1),
    // Which way it may move. Normalized here so the solver never has to.
    direction: unit(point(source.direction, 0), { x: 0, y: 1 }),
    motion: motionOf(source.motion)
  };
  // Where it sits on the head's logical surface (CR-24). Kept on the record so
  // the projection can be regenerated when the artwork or the head changes.
  if (type === 'surface' || source.surface) {
    pin.surface = { u: finite(source.surface?.u, 0), v: finite(source.surface?.v, 0), z: finite(source.surface?.z, 0) };
  }
  return pin;
}

/**
 * A pin's own movement.
 *
 * Two forms, and they are not interchangeable. An **expression** — the same
 * `expression · amplitude + offset` a binding uses — is right for anything
 * linear in a parameter: a mouth corner that rises with `smile`.
 *
 * A **grid** is right for a movement that is not. The 2.5D turn is a rotation,
 * and a rotation is sines and cosines: approximating it with `headX · k` is
 * exactly the parallax the pseudo-projector was written to replace
 * (`core/projection/pseudo-projector.js`). So a surface pin carries the
 * projection *sampled* over the head-pose grid and reads it back by bilinear
 * interpolation — the same maths, and the same cells, the head pose itself uses
 * (docs/KEYFORM_ENGINE.md). The projector runs once per cell at authoring time
 * and never per frame.
 */
function motionOf(source) {
  const grid = gridOf(source?.grid);
  if (grid) return { grid };
  const axis = (key) => {
    const entry = source?.[key];
    if (!entry) return null;
    const expression = typeof entry === 'string' ? entry : String(entry.expression ?? '');
    if (!expression.trim()) return null;
    return {
      expression: expression.trim(),
      amplitude: finite(entry.amplitude, 1),
      offset: finite(entry.offset, 0)
    };
  };
  const x = axis('x'), y = axis('y');
  return x || y ? { ...(x ? { x } : {}), ...(y ? { y } : {}) } : null;
}

/** A sampled movement over one or two parameter axes, as the keyforms use. */
function gridOf(source) {
  const axes = (Array.isArray(source?.axes) ? source.axes : []).slice(0, 2)
    .map((axis) => ({
      parameter: String(axis?.parameter ?? ''),
      values: (Array.isArray(axis?.values) ? axis.values : []).map((value) => finite(value, 0))
    }))
    .filter((axis) => axis.parameter && axis.values.length > 1);
  if (!axes.length) return null;
  const rows = (list) => (Array.isArray(list) ? list.map((row) => (Array.isArray(row) ? row.map((value) => (Number.isFinite(Number(value)) ? Number(value) : null)) : [])) : []);
  const x = rows(source?.x), y = rows(source?.y);
  return x.length || y.length ? { axes, x, y } : null;
}

function unit(vector, fallback) {
  const length = Math.hypot(vector.x, vector.y);
  return length > 1e-9 ? { x: roundTo(vector.x / length, 6), y: roundTo(vector.y / length, 6) } : { ...fallback };
}

/** The pins a rig carries, in a stable order, with the rubbish dropped. */
export function normalizeRigPins(candidate) {
  const list = Array.isArray(candidate?.rigPins) ? candidate.rigPins : Array.isArray(candidate) ? candidate : [];
  const seen = new Set();
  const pins = [];
  for (const item of list) {
    const pin = normalizeRigPin(item);
    if (!pin || seen.has(pin.id)) continue;
    seen.add(pin.id);
    pins.push(pin);
  }
  return pins;
}

/** Which pins act on one piece of artwork. */
export const pinsFor = (pins, target) => (pins || []).filter((pin) => pin.target === target);

/**
 * How much a point at `distance` follows a pin of this radius.
 *
 * Outside the radius, nothing: a pin with a reach is a pin an author can
 * picture, and one whose influence never quite ends is one they cannot.
 */
export function pinFalloff(distance, radius, falloff = 'smooth') {
  const span = Math.max(1e-9, radius);
  const at = clamp(1 - distance / span, 0, 1);
  if (at <= 0) return 0;
  if (falloff === 'smooth') return at * at * (3 - 2 * at);
  const exponent = PIN_FALLOFF_PRESETS[falloff] ?? 1;
  return exponent === 1 ? at : at ** exponent;
}

/**
 * Work out, once, how much each point of a path follows each pin.
 *
 * The weights are normalized where they overlap — two pins claiming the same
 * point share it rather than moving it twice — and left alone where they do
 * not, so a point outside every radius stays exactly where it was drawn. That
 * is the difference between a face rig and a skinned mesh: a skin covers
 * everything and a face has bare artwork between its pins.
 *
 * @param {string} restPath the shape as drawn
 * @param {object[]} pins the pins acting on it, already normalized
 * @returns {{commands, rest, scratch, weights: Float64Array[], displacement}|null}
 */
export function compilePinTarget(restPath, pins) {
  if (!Array.isArray(pins) || !pins.length) return null;
  const parsed = parsePath(restPath);
  const count = parsed.values.length / 2;
  const weights = pins.map(() => new Float64Array(count));
  for (let index = 0; index < count; index += 1) {
    const x = parsed.values[index * 2], y = parsed.values[index * 2 + 1];
    let total = 0;
    for (let p = 0; p < pins.length; p += 1) {
      const weight = pinWeightAt(pins[p], x, y) * pins[p].strength;
      weights[p][index] = weight;
      total += weight;
    }
    if (total > 1) for (let p = 0; p < pins.length; p += 1) weights[p][index] /= total;
  }
  return {
    commands: parsed.commands,
    signature: parsed.signature,
    rest: parsed.values,
    weights,
    scratch: new Float64Array(parsed.values.length),
    displacement: new Float64Array(parsed.values.length),
    lastPath: restPath
  };
}

/**
 * Where each pin has been moved to, this frame.
 *
 * A pin's own motion is written the way a binding is — an expression, an
 * amplitude and an offset — so a pin is driven by the same parameters
 * everything else is, and a rig has one way of saying "this moves with that".
 *
 * @param {object[]} pins
 * @param {Record<string, number>} values the effective parameters
 * @param {(binding: object, values: object) => number} evaluate
 * @returns {{x:number,y:number}[]} one offset per pin, in artwork units
 */
export function pinOffsets(pins, values, evaluate) {
  return (pins || []).map((pin) => constrainPinOffset(pin, pinMotion(pin, values, evaluate)));
}

/** Where one pin's own movement puts it, before its type has its say. */
export function pinMotion(pin, values, evaluate) {
  const grid = pin?.motion?.grid;
  if (grid) {
    const [first, second] = grid.axes;
    const x = finite(values?.[first.parameter], 0);
    const y = second ? finite(values?.[second.parameter], 0) : 0;
    const read = (cells) => (cells?.length
      ? interpolate2D(first.values, second ? second.values : [0], cells, x, y, { fallback: 0 })
      : 0);
    return { x: read(grid.x), y: read(grid.y) };
  }
  return {
    x: pin?.motion?.x ? finite(evaluate(pin.motion.x, values), 0) : 0,
    y: pin?.motion?.y ? finite(evaluate(pin.motion.y, values), 0) : 0
  };
}

/**
 * What a pin's type allows it to do with the movement it was given.
 *
 * A directional pin keeps only the part of the movement along its own axis: a
 * brow told to go up and sideways goes up. A sliding pin keeps the *whole*
 * movement but re-aims it along the axis: a mouth corner dragged outwards
 * rides the lip line rather than leaving it. Everything else moves as asked.
 */
export function constrainPinOffset(pin, offset) {
  // `+ 0` so a component that rounds to nothing is 0 rather than -0: a pin
  // offset is compared against rest to decide whether anything moved, and
  // `Object.is(-0, 0)` is false.
  const tidy = (value) => roundTo(value) + 0;
  const raw = { x: finite(offset?.x, 0), y: finite(offset?.y, 0) };
  if (pin?.type !== 'directional' && pin?.type !== 'slide') return { x: tidy(raw.x), y: tidy(raw.y) };
  const axis = pin.direction || { x: 0, y: 1 };
  const along = raw.x * axis.x + raw.y * axis.y;
  if (pin.type === 'directional') return { x: tidy(along * axis.x), y: tidy(along * axis.y) };
  const magnitude = Math.hypot(raw.x, raw.y) * Math.sign(along || 1);
  return { x: tidy(magnitude * axis.x), y: tidy(magnitude * axis.y) };
}

/**
 * The offset every point of the path picks up from the pins.
 *
 * The same `Float64Array` a warp produces, and it is added the same way — so a
 * pinned mouth can still be warped and still carry shape keys, and none of the
 * three has to know about the others (docs/WARP_GRID.md, docs/SHAPE_KEYS.md).
 *
 * Returns `null` when nothing moved, which is the common case and costs one
 * pass over a handful of numbers.
 */
export function pinDisplacement(target, offsets) {
  if (!target || !Array.isArray(offsets) || !offsets.length) return null;
  let moved = false;
  for (const offset of offsets) if (offset && (offset.x || offset.y)) { moved = true; break; }
  if (!moved) return null;
  const out = target.displacement;
  out.fill(0);
  for (let p = 0; p < offsets.length && p < target.weights.length; p += 1) {
    const offset = offsets[p];
    if (!offset || (!offset.x && !offset.y)) continue;
    const weights = target.weights[p];
    for (let index = 0; index < weights.length; index += 1) {
      const weight = weights[index];
      if (!weight) continue;
      out[index * 2] += offset.x * weight;
      out[index * 2 + 1] += offset.y * weight;
    }
  }
  return out;
}

/**
 * How far the pins have moved one arbitrary point of the artwork.
 *
 * The path's own points have their weights precomputed; an **attachment** is a
 * point an author named rather than one the path happens to have, so its
 * weights are worked out on the spot. It is a handful of square roots, once
 * per attachment per frame, and it is what lets a fingertip stay on a cheek
 * that a pin is pushing around (docs/FACE_CONTROL_RIG.md, CR-35).
 */
export function pinDisplacementAt(point, pins, offsets) {
  if (!Array.isArray(pins) || !pins.length) return { x: 0, y: 0 };
  const weights = [];
  let total = 0;
  for (const pin of pins) {
    const weight = pinWeightAt(pin, finite(point?.x, 0), finite(point?.y, 0)) * pin.strength;
    weights.push(weight);
    total += weight;
  }
  const scale = total > 1 ? 1 / total : 1;
  let x = 0, y = 0;
  for (let index = 0; index < pins.length; index += 1) {
    const offset = offsets?.[index];
    if (!offset || !weights[index]) continue;
    x += offset.x * weights[index] * scale;
    y += offset.y * weights[index] * scale;
  }
  return { x: roundTo(x), y: roundTo(y) };
}

/** Convenience: the pinned path on its own, for previews and tests. */
export function applyPins(target, offsets) {
  const displacement = pinDisplacement(target, offsets);
  if (!displacement) return target.lastPath;
  const values = target.scratch;
  values.set(target.rest);
  for (let index = 0; index < values.length; index += 1) values[index] += displacement[index];
  target.lastPath = serializePath(target.commands, values);
  return target.lastPath;
}

/**
 * What each pin is holding, for a panel or a test to read.
 *
 * `reach` is how many points of the path a pin actually moves, which is the
 * one number that says whether a radius is doing anything: a pin holding no
 * points is a pin in the wrong place.
 */
export function pinInfluence(target, pins) {
  if (!target) return [];
  return pins.map((pin, index) => {
    const weights = target.weights[index];
    let reach = 0, total = 0;
    for (let at = 0; at < weights.length; at += 1) if (weights[at] > 0) { reach += 1; total += weights[at]; }
    return { id: pin.id, type: pin.type, reach, share: roundTo(total / Math.max(1, weights.length), 4) };
  });
}
