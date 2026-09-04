/**
 * Rigging for the one template (`face-artwork.js` draws it; the two files are
 * read together).
 *
 * Everything a beginner would otherwise have to build is here and switched on:
 * every face part assigned, the movements calibrated, the automatic life
 * running, and the 2.5D turn already generated — `headX` turns the head from
 * the first frame instead of sliding it (docs/HEAD_POSE_2_5D.md).
 */
import { createCleanProjectState } from '../../state/store.js';
import { assignSemanticRole, createSemanticPart, enableSemanticControl, setSemanticControlMethod } from '../../../rig-editor/semantic-parts/part-model.js';
import { normalizeBehavior } from '../../../../runtime/runtime.js';
import { headTurnBindings, headTurnKeyforms, headTurnPivots } from '../../head-pose/head-pose-turn.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const params = {
  headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1),
  lookX: number(-1, 1), lookY: number(-1, 1), eyeOpen: number(0, 1, 1),
  browRaise: number(-1, 1), browTilt: number(-1, 1),
  mouthOpen: number(0, 1), smile: number(-1, 1), mouthWidth: number(-1, 1),
  hairSway: number(-1, 1), hairLift: number(-1, 1)
};
const base = Object.fromEntries(Object.entries(params).map(([name, param]) => [name, param.default]));

/**
 * Where each part sits in the artwork. The editor measures this from the canvas
 * when an author presses Generate; the template knows it already, because the
 * template drew it.
 */
const CENTERS = Object.freeze({
  faceRoot: { x: 120, y: 120 },
  eyeLeft: { x: 82, y: 98 }, eyeRight: { x: 158, y: 98 },
  pupilLeft: { x: 82, y: 98 }, pupilRight: { x: 158, y: 98 },
  lidUpperLeft: { x: 82, y: 80 }, lidUpperRight: { x: 158, y: 80 },
  lidLowerLeft: { x: 82, y: 120 }, lidLowerRight: { x: 158, y: 120 },
  browLeft: { x: 82, y: 65 }, browRight: { x: 158, y: 65 },
  nose: { x: 117, y: 133 }, mouth: { x: 120, y: 163 },
  earLeft: { x: 24, y: 124 }, earRight: { x: 216, y: 124 },
  hair: { x: 120, y: 60 }
});
const HEAD_WIDTH = 200;

const clips = {
  look: { id: 'look-around', name: 'Look Around', duration: 2.4, loop: false, tracks: { lookX: [{ time: 0, value: 0, easing: 'linear' }, { time: .5, value: -.75, easing: 'easeInOut' }, { time: .9, value: 0, easing: 'easeInOut' }, { time: 1.5, value: .75, easing: 'easeInOut' }, { time: 2.4, value: 0, easing: 'easeInOut' }] } },
  blink: { id: 'blink-clip', name: 'Blink', duration: .3, loop: false, tracks: { eyeOpen: [{ time: 0, value: 1, easing: 'linear' }, { time: .15, value: 0, easing: 'easeIn' }, { time: .3, value: 1, easing: 'easeOut' }] } },
  smile: { id: 'smile', name: 'Smile', duration: 1, loop: false, tracks: { smile: [{ time: 0, value: 0, easing: 'linear' }, { time: .5, value: 1, easing: 'easeInOut' }, { time: 1, value: 0, easing: 'easeInOut' }] } },
  nod: { id: 'head-nod', name: 'Head Nod', duration: 1, loop: false, tracks: { headY: [{ time: 0, value: 0, easing: 'linear' }, { time: .5, value: .5, easing: 'easeInOut' }, { time: 1, value: 0, easing: 'easeInOut' }] } },
  turn: { id: 'head-turn', name: 'Head Turn', duration: 1.6, loop: false, tracks: { headX: [{ time: 0, value: 0, easing: 'linear' }, { time: .5, value: -.9, easing: 'easeInOut' }, { time: 1.1, value: .9, easing: 'easeInOut' }, { time: 1.6, value: 0, easing: 'easeInOut' }] } },
  talk: { id: 'simple-talk', name: 'Simple Talk', duration: 1, loop: true, tracks: { mouthOpen: [{ time: 0, value: 0, easing: 'linear' }, { time: .25, value: 1, easing: 'easeOut' }, { time: .5, value: 0, easing: 'easeIn' }, { time: .75, value: .7, easing: 'easeOut' }, { time: 1, value: 0, easing: 'easeIn' }] } }
};

/**
 * The always-on life, with the ids the Automatic panel recognises.
 *
 * Normalized here, not on load: a partially written behaviour makes a saved
 * project differ from the one that authored it, because opening it fills the
 * rest in.
 */
const behaviors = [
  { id: 'auto-blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 6, duration: .12, closedValue: 0 },
  { id: 'auto-gaze-x', type: 'randomIdle', name: 'Natural gaze (left / right)', enabled: true, parameter: 'lookX', intervalMin: 1.5, intervalMax: 4, min: -.4, max: .4 },
  { id: 'auto-gaze-y', type: 'randomIdle', name: 'Natural gaze (up / down)', enabled: true, parameter: 'lookY', intervalMin: 2, intervalMax: 5, min: -.25, max: .25 },
  { id: 'auto-idle-head', type: 'oscillator', name: 'Idle head movement', enabled: true, parameter: 'headY', amplitude: .05, frequency: .3, offset: 0, waveform: 'sine' }
].map(normalizeBehavior);

/**
 * Assign a part from whichever of its roles the artwork actually draws.
 *
 * The Face Builder generates a smaller face through this same function, so a
 * missing element skips its role rather than throwing, and a part with nothing
 * to point at is not created at all.
 */
const add = (state, type, roles, controls = [], options = {}) => {
  const present = Object.entries(roles).filter(([, id]) => state.elements[id]);
  if (!present.length) return null;
  const part = createSemanticPart(state, type);
  for (const [role, id] of present) assignSemanticRole(state, part.id, role, id);
  for (const control of controls) enableSemanticControl(state, part.id, control, options[control] || {});
  return part;
};
/** A binding the registry has no opinion about: the template wires it by hand. */
const bind = (state, id, property, expression, amplitude, offset = 0, curve = 'linear') => {
  const element = state.elements[id];
  if (element) (element.bindings ||= {})[property] = { enabled: true, mode: 'simple', expression, curve, amplitude, offset };
};
const pivot = (state, id, x, y) => { const element = state.elements[id]; if (element) Object.assign(element.baseTransform, { pivotX: x, pivotY: y }); };

export function applyTemplateProject(state) {
  const artwork = { svgMarkup: state.svgMarkup, elements: state.elements, layers: state.layers, layerMetadata: state.layerMetadata, svgWarnings: state.svgWarnings };
  Object.assign(state, createCleanProjectState(), artwork);
  for (const element of Object.values(state.elements)) { element.bindings = {}; delete element.morph; }

  state.params = structuredClone(params);
  state.states = { idle: { ...base }, happy: { ...base, smile: 1 }, surprised: { ...base, mouthOpen: 1, browRaise: 1 } };
  state.transitions = { idle: ['happy', 'surprised'], happy: ['idle'], surprised: ['idle'] };
  state.transitionSettings = { 'idle->happy': { duration: 350, easing: 'easeInOut' } };
  state.activeState = 'idle';
  state.stateConstraints = Object.fromEntries(Object.keys(state.states).map((name) => [name, { translate: 1, rotate: 1, scale: 1 }]));

  // Our own artwork, as opposed to a face the Face Builder generated through
  // this same function: only ours carries the parts the extras below need.
  const ours = Boolean(state.elements.faceRoot && state.elements.chin);
  const headId = state.elements.faceRoot ? 'faceRoot' : 'head';
  add(state, 'head', { head: headId }, ['headX', 'headY', 'headTilt']);
  // `eyeLeft` / `eyeRight` are the whole eye: the socket clip, the white, the
  // pupil, the lids and the outline, so the turn moves them as one assembly.
  // The squash is gentle for the same reason -- the lids inside it do the
  // covering, and a hard squash would shrink them out of the socket.
  add(state, 'eyes', { leftEye: 'eyeLeft', rightEye: 'eyeRight' }, ['eyeOpen'], { eyeOpen: { amplitude: .12, offset: .88 } });
  add(state, 'gaze', { leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }, ['lookX', 'lookY']);
  // Eyelids are ordinary skin-coloured shapes clipped to the eye socket: parked
  // outside it when open, meeting over it when closed. That is what puts a pupil
  // *behind* the lid instead of fading it out as the eye shuts.
  add(state, 'eyelids', { leftUpper: 'lidUpperLeft', rightUpper: 'lidUpperRight', leftLower: 'lidLowerLeft', rightLower: 'lidLowerRight' }, ['eyeOpen'], { eyeOpen: { amplitude: -42, offset: 0 } });
  for (const id of ['lidLowerLeft', 'lidLowerRight']) bind(state, id, 'translateY', 'eyeOpen', 32);
  add(state, 'eyebrows', { leftBrow: 'browLeft', rightBrow: 'browRight' }, ['browRaise', 'browTilt']);
  add(state, 'nose', { nose: 'nose' });
  add(state, 'ears', { leftEar: 'earLeft', rightEar: 'earRight' });
  add(state, 'hair', { hair: 'hair' }, ['hairSway', 'hairLift']);
  // The lip line only thickens a little as the mouth opens: the opening itself
  // is the cavity below it and the chin dropping, not a fatter stroke.
  const mouth = add(state, 'mouth', { mouth: 'mouth', cavity: 'mouthInner' }, ['mouthOpen', 'smile', 'mouthWidth'], { mouthOpen: { amplitude: .3, offset: 1 } });
  // The smile is a shape change, not a nudge: a stroked line that only moves
  // reads as a line moving, never as a mouth.
  if (mouth && ours) {
    setSemanticControlMethod(state, mouth.id, 'smile', 'morph');
    state.elements.mouth.morph = { enabled: true, param: 'smile', min: -1, max: 1, pathA: 'M86 168 Q120 144 154 168', pathB: 'M86 160 Q120 190 154 160', compatible: true, generatedBy: { semanticPart: mouth.id, control: 'smile' } };
  }

  // Opening the mouth opens a cavity and drops the chin, so the whole lower face
  // lengthens instead of a hole appearing in a rigid head.
  bind(state, 'mouthInner', 'scaleY', 'mouthOpen', 1, 0);
  pivot(state, 'mouthInner', 120, 161);
  bind(state, 'chin', 'translateY', 'mouthOpen', 16);

  // Cartoon shading: the side of the face turning away darkens. `baseOpacity`
  // (.5 in the artwork) is the darkest it can get; the binding is the fraction.
  bind(state, 'shadeRight', 'opacity', 'headX', .6, .1);
  bind(state, 'shadeLeft', 'opacity', 'headX', -.6, .1);

  // The eye outline is the socket, so it goes when the lid covers it — a closed
  // cartoon eye is a crease, not a circle with a line through it. This fade is
  // the opposite of the pupil's: the rim really does stop existing, where the
  // pupil is still there behind the lid.
  for (const id of ['rimLeft', 'rimRight']) bind(state, id, 'opacity', 'eyeOpen', 3, -.15);

  for (const [id, centre] of Object.entries(CENTERS)) pivot(state, id, centre.x, centre.y);
  state.behaviors = structuredClone(behaviors);
  state.animationClips = structuredClone(ours ? [clips.look, clips.blink, clips.smile, clips.nod, clips.turn, clips.talk] : [clips.look, clips.blink, clips.smile]);

  // 2.5D from the first frame. The author can regenerate, re-pose any cell or
  // undo it like any other head-pose edit; this only saves them the first press.
  // A generated face has no measured centres, so it keeps the plain head
  // movement until its author presses Generate turn.
  if (ours) {
    state.keyforms = headTurnKeyforms(state.keyforms || [], state, { headWidth: HEAD_WIDTH, centers: CENTERS });
    for (const [id, values] of Object.entries(headTurnPivots(state, { centers: CENTERS }))) Object.assign(state.elements[id].baseTransform, values);
    for (const { elementId, property } of headTurnBindings(state)) state.elements[elementId].bindings[property].enabled = false;
  }

  state.animationEditor = { activeClipId: state.animationClips[0]?.id || null, playhead: 0, panel: 'preview', autoKey: false };
  state.selectedId = null;
  return state;
}
