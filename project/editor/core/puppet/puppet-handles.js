/**
 * Puppet handles (docs/DIRECT_CONTROLS.md).
 *
 * Posing a mascot meant finding the right panel, then the right slider, then
 * reading a number: `lookX -0.42`. The thing itself was on screen the whole
 * time, and nobody could touch it.
 *
 * A **handle** puts a movement back where it belongs — on the part it moves.
 * Drag the pupils to look around, the eyes to close them, the mouth up to
 * smile, the head to turn it. Each handle is one or two of the project's own
 * movements, so nothing new is authored and nothing here knows how a movement
 * is implemented: it sets the same parameters the sliders set.
 *
 * Pure: it reads the document and reports handles; the canvas draws them and
 * feeds pointer deltas back through `puppetDragValues`.
 */
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';
import { deriveMovementChecklist, movementEntry } from '../../rig-editor/semantic-parts/face-movements.js';
import { handPuppetHandles } from './hand-handles.js';

/**
 * What each handle grabs.
 *
 * `x` and `y` name the movement each axis drives, `invertY` marks the ones
 * where dragging **up** should raise the value (a brow raises as the pointer
 * goes up, but `headY` grows downwards like every vertical parameter).
 * `throw` is how far the pointer travels, as a fraction of the part's own
 * size, to cover the movement's whole range — so the same gesture feels right
 * on a 40px face and on a 2000px one.
 */
export const PUPPET_HANDLES = Object.freeze([
  Object.freeze({ id: 'gaze', part: 'gaze', roles: ['leftPupil', 'rightPupil'], label: 'Look around',
    x: 'lookX', y: 'lookY', invertY: false, throw: 1, at: 'centre', hint: 'Drag to look around' }),
  Object.freeze({ id: 'eyes', part: 'eyes', roles: ['leftEye', 'rightEye'], label: 'Open and close',
    // On the eyelid, not the middle of the eye: the gaze handle lives there.
    x: null, y: 'eyeOpen', invertY: true, throw: 0.8, at: 'top', hint: 'Drag down to close the eyes' }),
  Object.freeze({ id: 'eyebrows', part: 'eyebrows', roles: ['leftBrow', 'rightBrow'], label: 'Eyebrows',
    x: 'browTilt', y: 'browRaise', invertY: true, throw: 1, at: 'centre', hint: 'Drag up to raise, sideways to tilt' }),
  Object.freeze({ id: 'mouth', part: 'mouth', roles: ['mouth'], label: 'Mouth',
    x: 'smile', y: 'mouthOpen', invertY: false, throw: 0.6, at: 'centre', hint: 'Drag down to open, sideways to smile' }),
  Object.freeze({ id: 'head', part: 'head', roles: ['head'], label: 'Turn the head',
    // Above the face, where a puppeteer would hold it, and clear of the
    // features' own handles.
    x: 'headX', y: 'headY', invertY: false, throw: 0.35, at: 'top', grid: true,
    hint: 'Drag to turn the head · Shift snaps to a captured position' }),
  Object.freeze({ id: 'headTilt', part: 'head', roles: ['head'], label: 'Tilt the head',
    // A tilt is a turn of the wrist, not a drag: this handle orbits the head.
    mode: 'orbit', orbit: 'headTilt', x: null, y: null, invertY: false, throw: 120, at: 'right',
    hint: 'Turn around the head to tilt it' }),
  // The rest of the face. Every movement the project has should be reachable
  // on the mascot itself: a part with a slider and no handle is a part an
  // author has to go and look for.
  Object.freeze({ id: 'mouthWidth', part: 'mouth', roles: ['mouth'], label: 'Mouth width',
    // Beside the mouth, where a corner is: the mouth's own handle already owns
    // its middle for smiling and opening.
    x: 'mouthWidth', y: null, invertY: false, throw: 0.5, at: 'right',
    hint: 'Drag sideways to widen or narrow the mouth' }),
  Object.freeze({ id: 'jaw', part: 'jaw', roles: ['jaw'], label: 'Jaw',
    x: null, y: 'jawOpen', invertY: false, throw: 0.25, at: 'bottom',
    hint: 'Drag down to drop the jaw' }),
  Object.freeze({ id: 'nose', part: 'nose', roles: ['nose'], label: 'Nose',
    x: null, y: 'noseScrunch', invertY: true, throw: 1.4, at: 'centre',
    hint: 'Drag up to scrunch the nose' }),
  Object.freeze({ id: 'hair', part: 'hair', roles: ['hair'], label: 'Hair',
    // Where the fringe meets the side of the face: the top of the hair is the
    // top of the head, where the head's own handle already is.
    x: 'hairSway', y: 'hairLift', invertY: true, throw: 0.5, at: 'bottomLeft',
    hint: 'Drag sideways to sway the hair, up to lift it' }),
  Object.freeze({ id: 'ears', part: 'ears', roles: ['leftEar'], label: 'Ears',
    // One ear, not both: a handle between them would sit in the middle of the
    // face, on top of the nose.
    x: 'earWiggle', y: null, invertY: false, throw: 1.2, at: 'centre',
    hint: 'Drag sideways to wiggle the ears' })
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value) => Number(Number(value).toFixed(4));
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * One parameter, as a handle axis. Exported because the hands build their
 * handles from the same shape without going through the face movements.
 */
export function parameterAxis(params, control, label = control) {
  const parameter = control ? params?.[control] : null;
  if (!parameter) return null;
  return {
    control, label,
    min: number(parameter.min, -1),
    max: number(parameter.max, 1),
    rest: number(parameter.default, 0)
  };
}

/** A movement is grabbable when the project has it, turned on, as a parameter. */
function axisFor(control, movements, params) {
  if (!control) return null;
  const item = movements.items.find((entry) => entry.id === control);
  if (!item?.enabled) return null;
  return parameterAxis(params, control, movementEntry(control)?.label || control);
}

/**
 * Every handle the project can offer, with the artwork each one sits on.
 *
 * A handle needs at least one enabled movement and one element to sit on, so
 * an unrigged project simply has no handles rather than a canvas full of
 * controls that do nothing.
 *
 * @param {object} document
 * @returns {{id,label,hint,partId,elements:string[],anchor:string,x,y,invertY,throw}[]}
 */
export function puppetHandles(document = {}) {
  const movements = deriveMovementChecklist(document);
  const params = document.params || {};
  const handles = [];
  for (const definition of PUPPET_HANDLES) {
    const part = Object.values(document.semanticParts || {}).find((item) => item.type === definition.part);
    if (!part) continue;
    const elements = definition.roles.map((role) => part.roles?.[role]).filter((id) => id && document.elements?.[id]);
    if (!elements.length) continue;
    const x = axisFor(definition.x, movements, params);
    const y = axisFor(definition.y, movements, params);
    const orbit = axisFor(definition.orbit, movements, params);
    if (!x && !y && !orbit) continue;
    handles.push({
      id: definition.id, label: definition.label, hint: definition.hint,
      partId: part.id, elements, anchor: elements[0], at: definition.at,
      mode: definition.mode || 'drag', grid: Boolean(definition.grid),
      x, y, orbit, invertY: definition.invertY, throw: definition.throw
    });
  }
  // The hands are not face parts, but they are grabbed the same way.
  return handles.concat(handPuppetHandles(document));
}

/**
 * Where a drag has taken the parameters.
 *
 * The pointer delta is in the artwork's own units, and `size` is the part's
 * own size in those units, so the gesture scales with the drawing instead of
 * with the screen.
 *
 * @param {object} handle from `puppetHandles`
 * @param {{dx:number, dy:number}} delta pointer travel, in artwork units
 * @param {{start?: object, size?: number}} [options] the values the drag began
 *        from, and the part's size
 * @returns {Record<string, number>} the parameters to set, clamped to range
 */
export function puppetDragValues(handle, { dx = 0, dy = 0 } = {}, { start = {}, size = 40 } = {}) {
  if (!handle) return {};
  // A handle whose range is geometry — a hand's reach — carries its own span
  // per axis; everything else covers a fraction of the part it sits on.
  const fallback = Math.max(8, number(size, 40) * number(handle.throw, 1));
  const spanFor = (which) => Math.max(4, number(handle.span?.[which], fallback));
  const values = {};
  const apply = (axis, travel, invert, which) => {
    if (!axis) return;
    const from = clamp(number(start[axis.control], axis.rest), axis.min, axis.max);
    const range = axis.max - axis.min;
    const moved = (invert ? -travel : travel) / spanFor(which) * range;
    values[axis.control] = round(clamp(from + moved, axis.min, axis.max));
  };
  apply(handle.x, number(dx), false, 'x');
  apply(handle.y, number(dy), handle.invertY, 'y');
  return values;
}

/**
 * Where a turn of the wrist has taken the parameter.
 *
 * `angle` is how far the pointer has swung around the part, in degrees, and
 * the handle's `throw` is how many degrees cover the whole range.
 *
 * @param {object} handle a handle whose `mode` is `orbit`
 * @param {number} angle degrees, signed clockwise
 * @param {{start?: object}} [options]
 */
export function puppetOrbitValues(handle, angle = 0, { start = {} } = {}) {
  const axis = handle?.orbit;
  if (!axis) return {};
  const span = Math.max(5, Math.abs(number(handle.throw, 120)));
  const from = clamp(number(start[axis.control], axis.rest), axis.min, axis.max);
  const range = axis.max - axis.min;
  return { [axis.control]: round(clamp(from + (number(angle) / span) * range, axis.min, axis.max)) };
}

/** The rest pose for a handle, for the double-click that puts it back. */
export function puppetRestValues(handle) {
  const values = {};
  for (const axis of [handle?.x, handle?.y, handle?.orbit]) if (axis) values[axis.control] = round(axis.rest);
  return values;
}

/** What a handle is set to, in plain words rather than `lookX -0.42`. */
export function puppetReadout(handle, values = {}) {
  const parts = [];
  for (const axis of [handle?.x, handle?.y, handle?.orbit]) {
    if (!axis) continue;
    const value = clamp(number(values[axis.control], axis.rest), axis.min, axis.max);
    if (Math.abs(value - axis.rest) < 0.005) continue;
    parts.push(`${axis.label.toLowerCase()} ${value > 0 ? '+' : ''}${round(value)}`);
  }
  return parts.length ? parts.join(' · ') : 'at rest';
}

/** The part's own name, so a caller never has to know the part types. */
export const puppetPartLabel = (handle) =>
  SEMANTIC_PART_REGISTRY[PUPPET_HANDLES.find((item) => item.id === handle?.id)?.part]?.displayName || handle?.label || '';
