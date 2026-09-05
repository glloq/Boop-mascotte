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
import { gazeSolverEnabled } from '../rig/gaze-rig.js';
import { linkForControl, linkedParameter, rigLinkOn } from './control-links.js';
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
  // The common gaze target (CR-06). With the solver on it drives `gazeX` /
  // `gazeY` -- *the point the character wants to look at* -- and the solver
  // decides how much of that the eyes do and how much the head does. With the
  // solver off it drives the eyes directly, exactly as it always did, which is
  // what makes every project that predates the solver behave identically
  // (docs/FACE_CONTROL_RIG.md, CR-53).
  Object.freeze({ id: 'gaze', part: 'gaze', roles: ['leftPupil', 'rightPupil'], label: 'Look around',
    x: 'lookX', y: 'lookY', solverX: 'gazeX', solverY: 'gazeY', controller: 'target', visualParent: 'eye-rig',
    invertY: false, throw: 1, at: 'centre', hint: 'Drag to look around' }),
  Object.freeze({ visualParent: 'eye-rig', id: 'eyes', part: 'eyes', roles: ['leftEye', 'rightEye'], label: 'Open and close',
    // On the eyelid, not the middle of the eye: the gaze handle lives there.
    x: null, y: 'eyeOpen', invertY: true, throw: 0.8, at: 'top', hint: 'Drag down to close the eyes' }),
  Object.freeze({ visualParent: 'brow-rig', id: 'eyebrows', part: 'eyebrows', roles: ['leftBrow', 'rightBrow'], label: 'Eyebrows',
    x: 'browTilt', y: 'browRaise', invertY: true, throw: 1, at: 'centre', hint: 'Drag up to raise, sideways to tilt' }),
  Object.freeze({ visualParent: 'mouth-rig', id: 'mouth', part: 'mouth', roles: ['mouth'], label: 'Mouth',
    x: 'smile', y: 'mouthOpen', invertY: false, throw: 0.6, at: 'centre', hint: 'Drag down to open, sideways to smile' }),
  Object.freeze({ visualParent: 'head-rig', id: 'head', part: 'head', roles: ['head'], label: 'Turn the head',
    // Above the face, where a puppeteer would hold it, and clear of the
    // features' own handles.
    x: 'headX', y: 'headY', invertY: false, throw: 0.35, at: 'top', grid: true,
    hint: 'Drag to turn the head · Shift snaps to a captured position' }),
  Object.freeze({ visualParent: 'head-rig', id: 'headTilt', part: 'head', roles: ['head'], label: 'Tilt the head',
    // A tilt is a turn of the wrist, not a drag: this handle orbits the head.
    mode: 'orbit', orbit: 'headTilt', x: null, y: null, invertY: false, throw: 120, at: 'right',
    hint: 'Turn around the head to tilt it' }),
  // The rest of the face. Every movement the project has should be reachable
  // on the mascot itself: a part with a slider and no handle is a part an
  // author has to go and look for.
  Object.freeze({ visualParent: 'mouth-rig', id: 'mouthWidth', part: 'mouth', roles: ['mouth'], label: 'Mouth width',
    // Beside the mouth, where a corner is: the mouth's own handle already owns
    // its middle for smiling and opening.
    x: 'mouthWidth', y: null, invertY: false, throw: 0.5, at: 'right',
    hint: 'Drag sideways to widen or narrow the mouth' }),
  Object.freeze({ visualParent: 'mouth-rig', id: 'jaw', part: 'jaw', roles: ['jaw'], label: 'Jaw',
    x: null, y: 'jawOpen', invertY: false, throw: 0.25, at: 'bottom',
    hint: 'Drag down to drop the jaw' }),
  // The mouth's own corners (CR-28, CR-29). `smile` moves both because it is
  // one shape key on one closed path; each corner's offset moves that corner
  // alone, which is where a smirk, a grimace and a lip pulled by a word live.
  // Sideways widens, up smiles -- the two directions a corner actually has.
  Object.freeze({ visualParent: 'mouth-rig', id: 'mouthCornerLeft', part: 'mouth', roles: ['mouth'], group: 'mouth', label: 'Left mouth corner',
    x: 'mouthWidthLeft', y: 'smileLeft', standalone: true, controller: 'target', invertY: true, throw: 0.5, at: 'left',
    hint: 'Drag up to raise this corner on its own, sideways to widen it' }),
  Object.freeze({ visualParent: 'mouth-rig', id: 'mouthCornerRight', part: 'mouth', roles: ['mouth'], group: 'mouth', label: 'Right mouth corner',
    x: 'mouthWidthRight', y: 'smileRight', standalone: true, controller: 'target', invertY: true, throw: 0.5, at: 'right',
    hint: 'Drag up to raise this corner on its own, sideways to widen it' }),
  // How hard the lips refuse to follow the jaw (CR-31): tension, anticipation,
  // and every cartoon line delivered through closed teeth.
  Object.freeze({ visualParent: 'mouth-rig', id: 'mouthLock', part: 'mouth', roles: ['mouth'], group: 'mouth', label: 'Lips stay together',
    x: null, y: 'mouthLock', standalone: true, invertY: true, throw: 0.6, at: 'top',
    hint: 'Drag up to keep the lips together however far the jaw drops' }),
  // The tongue: where it is, how far it comes out, and how it curls (CR-32 … CR-34).
  Object.freeze({ visualParent: 'mouth-rig', id: 'tongue', part: 'tongue', roles: ['tongue'], label: 'Tongue',
    x: 'tongueX', y: 'tongueY', controller: 'target', invertY: false, throw: 1, at: 'centre',
    hint: 'Drag to aim the tongue' }),
  Object.freeze({ visualParent: 'mouth-rig', id: 'tongueOut', part: 'tongue', roles: ['tongue'], group: 'tongue', label: 'Tongue out',
    x: null, y: 'tongueOut', invertY: false, throw: 0.8, at: 'bottom',
    hint: 'Drag down to stick the tongue out' }),
  Object.freeze({ visualParent: 'mouth-rig', id: 'tongueCurl', part: 'tongue', roles: ['tongue'], group: 'tongue', label: 'Tongue curl',
    mode: 'orbit', orbit: 'tongueCurl', x: null, y: null, controller: 'arc', invertY: false, throw: 120, at: 'right',
    hint: 'Turn around the tongue to curl it' }),
  Object.freeze({ id: 'nose', part: 'nose', roles: ['nose'], label: 'Nose',
    x: null, y: 'noseScrunch', invertY: true, throw: 1.4, at: 'centre',
    hint: 'Drag up to scrunch the nose' }),
  Object.freeze({ id: 'hair', part: 'hair', roles: ['hair'], label: 'Hair',
    // Where the fringe meets the side of the face: the top of the hair is the
    // top of the head, where the head's own handle already is.
    x: 'hairSway', y: 'hairLift', invertY: true, throw: 0.5, at: 'bottomLeft',
    hint: 'Drag sideways to sway the hair, up to lift it' }),
  // One side at a time. `eyeOpen` closes both eyes because one parameter drives
  // both roles; a **side offset** moves one of them on its own
  // (docs/SEMANTIC_RIGGING.md), and these are the handles for it — members of
  // the pair's own group, so the face is not covered in dots until asked.
  // The eye rig's detailed controls (CR-07 … CR-09). Each one is a member of
  // the control it refines, so the face carries three dots and a slider until
  // an author opens the group -- and then it carries a target, a ring and a
  // lid slider per eye, which is the rig a facial animator expects.
  Object.freeze({ visualParent: 'eye-rig', id: 'gazeLeft', part: 'gaze', roles: ['leftPupil'], group: 'gaze', label: 'Left eye target',
    x: 'lookXLeft', y: 'lookYLeft', sideOf: 'lookX', controller: 'target', invertY: false, throw: 1, at: 'centre',
    hint: 'Drag to aim this eye on its own · converge, diverge or squint' }),
  Object.freeze({ visualParent: 'eye-rig', id: 'gazeRight', part: 'gaze', roles: ['rightPupil'], group: 'gaze', label: 'Right eye target',
    x: 'lookXRight', y: 'lookYRight', sideOf: 'lookX', controller: 'target', invertY: false, throw: 1, at: 'centre',
    hint: 'Drag to aim this eye on its own · converge, diverge or squint' }),
  // A ring, because a scale is a size and not a direction: drag away from the
  // middle to dilate, towards it to contract.
  Object.freeze({ visualParent: 'eye-rig', id: 'pupilScale', part: 'gaze', roles: ['leftPupil', 'rightPupil'], group: 'gaze', label: 'Pupil size',
    x: null, y: 'pupilScale', controller: 'radial', invertY: true, throw: 1, at: 'right',
    hint: 'Drag out to widen the pupils, in to shrink them' }),
  Object.freeze({ visualParent: 'eye-rig', id: 'pupilLeft', part: 'gaze', roles: ['leftPupil'], group: 'gaze', label: 'Left pupil size',
    x: null, y: 'pupilScaleLeft', sideOf: 'pupilScale', controller: 'radial', invertY: true, throw: 1, at: 'bottom',
    hint: 'Drag out to widen this pupil on its own' }),
  Object.freeze({ visualParent: 'eye-rig', id: 'pupilRight', part: 'gaze', roles: ['rightPupil'], group: 'gaze', label: 'Right pupil size',
    x: null, y: 'pupilScaleRight', sideOf: 'pupilScale', controller: 'radial', invertY: true, throw: 1, at: 'bottom',
    hint: 'Drag out to widen this pupil on its own' }),
  Object.freeze({ visualParent: 'eye-rig', id: 'eyeLeft', part: 'eyes', roles: ['leftEye'], group: 'eyes', label: 'Left eye',
    x: null, y: 'eyeOpenLeft', sideOf: 'eyeOpen', invertY: true, throw: 0.8, at: 'top',
    hint: 'Drag down to close this eye on its own' }),
  Object.freeze({ visualParent: 'eye-rig', id: 'eyeRight', part: 'eyes', roles: ['rightEye'], group: 'eyes', label: 'Right eye',
    x: null, y: 'eyeOpenRight', sideOf: 'eyeOpen', invertY: true, throw: 0.8, at: 'top',
    hint: 'Drag down to close this eye on its own' }),
  Object.freeze({ visualParent: 'brow-rig', id: 'browLeft', part: 'eyebrows', roles: ['leftBrow'], group: 'eyebrows', label: 'Left eyebrow',
    x: null, y: 'browRaiseLeft', sideOf: 'browRaise', invertY: true, throw: 1, at: 'centre',
    hint: 'Drag up to raise this eyebrow on its own' }),
  Object.freeze({ visualParent: 'brow-rig', id: 'browRight', part: 'eyebrows', roles: ['rightBrow'], group: 'eyebrows', label: 'Right eyebrow',
    x: null, y: 'browRaiseRight', sideOf: 'browRaise', invertY: true, throw: 1, at: 'centre',
    hint: 'Drag up to raise this eyebrow on its own' }),
  // One controller per brow, the way a 3D facial rig has one (CR-18): the
  // centre moves it, the arc turns it. A brow that can only raise reads as a
  // pair of eyebrows; a brow that can turn reads as an expression.
  Object.freeze({ visualParent: 'brow-rig', id: 'browTiltLeft', part: 'eyebrows', roles: ['leftBrow'], group: 'eyebrows', label: 'Left eyebrow tilt',
    mode: 'orbit', orbit: 'browTiltLeft', sideOf: 'browTilt', x: null, y: null, controller: 'arc', invertY: false, throw: 120, at: 'left',
    hint: 'Turn around this eyebrow to tilt it on its own' }),
  Object.freeze({ visualParent: 'brow-rig', id: 'browTiltRight', part: 'eyebrows', roles: ['rightBrow'], group: 'eyebrows', label: 'Right eyebrow tilt',
    mode: 'orbit', orbit: 'browTiltRight', sideOf: 'browTilt', x: null, y: null, controller: 'arc', invertY: false, throw: 120, at: 'right',
    hint: 'Turn around this eyebrow to tilt it on its own' }),
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
 * The shared movement a side offset offsets: `eyeOpenLeft` → `eyeOpen`.
 *
 * Read back from the naming rule (`sideParameterName`) rather than listed, so
 * every offset a part can generate resolves -- including ones added long after
 * this file was written.
 */
export function sharedOfSideParameter(control) {
  const match = /^([a-z]\w*?)(Left|Right)$/.exec(String(control || ''));
  return match ? match[1] : null;
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
  // With the gaze solver on, the common target stops driving the eyes and
  // starts driving the *point being looked at* (CR-06, CR-11).
  const solving = gazeSolverEnabled(document);
  const handles = [];
  for (const definition of PUPPET_HANDLES) {
    const part = Object.values(document.semanticParts || {}).find((item) => item.type === definition.part);
    if (!part) continue;
    const elements = definition.roles.map((role) => part.roles?.[role]).filter((id) => id && document.elements?.[id]);
    if (!elements.length) continue;
    /**
     * A side offset is not a movement of its own: it rides the movement it
     * offsets, so it exists exactly when that one is on and the part has been
     * asked to move its sides separately. When the two sides are **linked**,
     * the same control writes the shared movement instead -- the drag, the
     * keyboard, the board and Auto Key all follow, because the only thing that
     * changed is which parameter the axis names (CR-10).
     */
    const sideAxis = (control) => {
      const shared = sharedOfSideParameter(control);
      if (!shared || !part.sides?.[shared]) return null;
      if (!movements.items.find((item) => item.id === shared)?.enabled) return null;
      const name = linkedParameter(document, shared, control);
      return parameterAxis(params, name, name === shared ? (movementEntry(shared)?.label || shared) : definition.label);
    };
    const resolve = (control, solverControl) => {
      if (!control) return null;
      if (definition.sideOf) return sideAxis(control);
      // A control the rig *generated* rather than the checklist declared: a
      // mouth corner's own offset, a lock. It exists exactly when its
      // parameter does, which is when the rig that makes it has been built.
      if (definition.standalone) return parameterAxis(params, control, movementEntry(control)?.label || definition.label);
      // The solver's own parameter is not a face movement, so it is read from
      // the project's parameters directly rather than from the checklist.
      if (solving && solverControl && params[solverControl]) {
        return { ...parameterAxis(params, solverControl, solverControl === 'gazeX' ? 'Look at · left / right' : 'Look at · up / down'), solver: true };
      }
      return axisFor(control, movements, params);
    };
    const x = resolve(definition.x, definition.solverX);
    const y = resolve(definition.y, definition.solverY);
    const orbit = definition.sideOf ? sideAxis(definition.orbit) : axisFor(definition.orbit, movements, params);
    if (!x && !y && !orbit) continue;
    const shared = definition.sideOf ? linkForControl(sharedOfSideParameter(definition.x || definition.y || definition.orbit)) : null;
    handles.push({
      id: definition.id, label: definition.label, hint: definition.hint,
      partId: part.id, elements, anchor: elements[0], at: definition.at,
      mode: definition.mode || 'drag', grid: Boolean(definition.grid),
      group: definition.group || null,
      // Which cage this control is drawn inside, and whether the two sides it
      // belongs to are currently moving together (docs/FACE_CONTROL_RIG.md).
      visualParent: definition.visualParent || null,
      link: shared?.id || null, linked: Boolean(shared && rigLinkOn(document, shared.id)),
      controller: definition.controller || null,
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
    // A locked axis is a decision an author made about this control: the drag
    // simply does not reach it.
    if (!axis || axis.locked) return;
    const from = clamp(number(start[axis.control], axis.rest), axis.min, axis.max);
    const range = axis.max - axis.min;
    const moved = (invert ? -travel : travel) / spanFor(which) * range;
    const landed = clamp(from + moved, axis.min, axis.max);
    // `min`/`max` are the handle's limits, already narrowed to whatever the
    // author allowed, so clamping to them is what makes a limit a limit.
    const step = number(axis.snap, 0);
    values[axis.control] = round(step > 0 ? clamp(Math.round(landed / step) * step, axis.min, axis.max) : landed);
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
  if (!axis || axis.locked) return {};
  const span = Math.max(5, Math.abs(number(handle.throw, 120)));
  const from = clamp(number(start[axis.control], axis.rest), axis.min, axis.max);
  const range = axis.max - axis.min;
  const landed = clamp(from + (number(angle) / span) * range, axis.min, axis.max);
  const step = number(axis.snap, 0);
  return { [axis.control]: round(step > 0 ? clamp(Math.round(landed / step) * step, axis.min, axis.max) : landed) };
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
