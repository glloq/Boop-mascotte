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
import { assignSemanticRole, createSemanticPart, enableSemanticControl, enableSemanticSideControl, setSemanticControlMethod } from '../../../rig-editor/semantic-parts/part-model.js';
import { enableMouthRig } from '../../rig/mouth-rig.js';
import { createShapeKey, upsertShapeKey } from '../../shape-keys/shape-key-model.js';
import { HEAD_REST, MOUTH_REST, TEETH_REST, TONGUE_REST, headPath, mouthPath, teethPath, tonguePath } from './face-artwork.js';
import { normalizeBehavior } from '../../../../runtime/runtime.js';
import { headTurnBindings, headTurnKeyforms, headTurnPivots } from '../../head-pose/head-pose-turn.js';
import { suggestedFollowers } from '../../followers/follower-model.js';

const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const params = {
  headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1),
  lookX: number(-1, 1), lookY: number(-1, 1), eyeOpen: number(0, 1, 1),
  browRaise: number(-1, 1), browTilt: number(-1, 1), noseScrunch: number(0, 1),
  mouthOpen: number(0, 1), smile: number(-1, 1), mouthWidth: number(-1, 1),
  teeth: number(0, 1), tongue: number(0, 1), jawOpen: number(0, 1),
  hairSway: number(-1, 1), hairLift: number(-1, 1), earWiggle: number(-1, 1)
};
const base = Object.fromEntries(Object.entries(params).map(([name, param]) => [name, param.default]));

/**
 * Where each part sits in the artwork. The editor measures this from the canvas
 * when an author presses Generate; the template knows it already, because the
 * template drew it.
 */
/**
 * The box the lips occupy at rest, which is what the mouth's own pins are
 * measured from. Written down here for the same reason the centres are: the
 * editor measures it from the canvas, and the template drew it.
 */
const MOUTH_BOX = Object.freeze({ x: 86, y: 160, width: 68, height: 9 });

const CENTERS = Object.freeze({
  faceRoot: { x: 120, y: 120 },
  eyeLeft: { x: 82, y: 98 }, eyeRight: { x: 158, y: 98 },
  pupilLeft: { x: 82, y: 98 }, pupilRight: { x: 158, y: 98 },
  lidUpperLeft: { x: 82, y: 80 }, lidUpperRight: { x: 158, y: 80 },
  lidLowerLeft: { x: 82, y: 120 }, lidLowerRight: { x: 158, y: 120 },
  browLeft: { x: 82, y: 65 }, browRight: { x: 158, y: 65 },
  nose: { x: 117, y: 133 }, mouth: { x: 120, y: 163 },
  // The same centre as the mouth on purpose: they narrow together on a turn.
  teeth: { x: 120, y: 163 }, tongue: { x: 120, y: 163 },
  earLeft: { x: 24, y: 124 }, earRight: { x: 216, y: 124 },
  // The hair swings from where it is attached, which is the crown and not the
  // middle of the shape: a fringe pivoting about its own centre slides off the
  // forehead instead of swaying.
  hair: { x: 120, y: 60 }, hairTop: { x: 120, y: 56 }, hairBack: { x: 120, y: 70 }
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
  const ours = Boolean(state.elements.faceRoot && state.elements.hairFront);
  const headId = state.elements.faceRoot ? 'faceRoot' : 'head';
  add(state, 'head', { head: headId }, ['headX', 'headY', 'headTilt']);
  // `eyeLeft` / `eyeRight` are the whole eye: the socket clip, the white, the
  // pupil, the lids and the outline, so the turn moves them as one assembly.
  // The squash is gentle for the same reason -- the lids inside it do the
  // covering, and a hard squash would shrink them out of the socket.
  const eyes = add(state, 'eyes', { leftEye: 'eyeLeft', rightEye: 'eyeRight' }, ['eyeOpen'], { eyeOpen: { amplitude: .12, offset: .88 } });
  const gaze = add(state, 'gaze', { leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }, ['lookX', 'lookY', 'pupilScale']);
  // Eyelids are ordinary skin-coloured shapes clipped to the eye socket: parked
  // outside it when open, meeting over it when closed. That is what puts a pupil
  // *behind* the lid instead of fading it out as the eye shuts.
  const eyelids = add(state, 'eyelids', { leftUpper: 'lidUpperLeft', rightUpper: 'lidUpperRight', leftLower: 'lidLowerLeft', rightLower: 'lidLowerRight' }, ['eyeOpen'], { eyeOpen: { amplitude: -42, offset: 0 } });
  for (const id of ['lidLowerLeft', 'lidLowerRight']) bind(state, id, 'translateY', 'eyeOpen', 32);
  const eyebrows = add(state, 'eyebrows', { leftBrow: 'browLeft', rightBrow: 'browRight' }, ['browRaise', 'browTilt']);
  // One movement for the pair, and an offset per side on top of it: a blink
  // closes both eyes, a wink closes one. The offsets default to 0, so the
  // shared movement means exactly what it meant before.
  // The lids are what actually close an eye, so they carry the offset too --
  // an eye that squashed without its lid coming down would be a wink of the
  // eyeball alone.
  for (const part of [eyes, eyelids]) if (part) enableSemanticSideControl(state, part.id, 'eyeOpen');
  // The rest of the face control rig's per-side offsets (docs/FACE_CONTROL_RIG.md).
  // Every one of them defaults to 0, so the mascot looks and behaves exactly as
  // it did -- what they buy is that the two eyes and the two brows *can* now
  // disagree: convergence, a wandering eye, a single raised brow, a smirk of
  // the face rather than a symmetric mask.
  if (gaze) for (const control of ['lookX', 'lookY', 'pupilScale']) enableSemanticSideControl(state, gaze.id, control);
  if (eyebrows) for (const control of ['browRaise', 'browTilt']) enableSemanticSideControl(state, eyebrows.id, control);
  add(state, 'nose', { nose: 'nose' }, ['noseScrunch']);
  add(state, 'ears', { leftEar: 'earLeft', rightEar: 'earRight' }, ['earWiggle']);
  // Gentler than the default 8: the fringe is clipped to the head and can move
  // freely, but the crown is the silhouette -- swing it far and the skull
  // shows through underneath.
  add(state, 'hair', { hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' }, ['hairSway', 'hairLift'],
    { hairSway: { amplitude: 4 }, hairLift: { amplitude: 5 } });
  // The jaw is the head's own outline, stretched: a separate chin shape behind
  // the face gave the mascot a double chin the moment it moved, because two
  // outlines cannot be one silhouette.
  const jaw = ours ? add(state, 'jaw', { jaw: 'head' }, ['jawOpen'], { jawOpen: { property: 'shapeKey' } }) : null;
  const mouth = add(state, 'mouth', { mouth: 'mouth', teeth: 'teeth', tongue: 'tongue' }, ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue']);
  // Where the tongue is, as opposed to whether it shows: its own part, because
  // the two questions are different and the mouth already answers the second
  // (docs/FACE_CONTROL_RIG.md, CR-32 … CR-34).
  add(state, 'tongue', { tongue: 'tongue' }, ['tongueX', 'tongueY', 'tongueOut', 'tongueCurl']);
  // Opening and smiling are both shape changes, and they have to happen at the
  // same time: one closed path, two additive shape keys, so a laughing mouth is
  // the sum of the two rather than a fight between them. A transform cannot do
  // this (a scale flattens the smile as it closes) and the legacy morph cannot
  // either (one shape per element).
  if (mouth && ours) {
    for (const control of ['mouthOpen', 'smile']) setSemanticControlMethod(state, mouth.id, control, 'shapeKey');
    state.elements.mouth.restPath = MOUTH_REST;
    for (const [id, name, pose, driver] of [
      ['mouth-open', 'Mouth open', { open: 1 }, { parameter: 'mouthOpen', min: 0, max: 1 }],
      ['mouth-smile', 'Smile', { smile: 1 }, { parameter: 'smile', min: 0, max: 1 }],
      ['mouth-frown', 'Frown', { smile: -1 }, { parameter: 'smile', min: 0, max: -1 }]
    ]) {
      const control = driver.parameter;
      const shape = createShapeKey({ id, target: 'mouth', name, restPath: MOUTH_REST, posePath: mouthPath(pose), driver, generatedBy: { semanticPart: mouth.id, control } });
      if (shape.ok) state.shapeKeys = upsertShapeKey(state.shapeKeys, shape.shapeKey);
    }

    // Teeth and tongue are drawn from the mouth's own curves, so they cannot
    // leave it. `mouthOpen * teeth` is a product rather than a sum: closed
    // lips have nothing behind them to show, however far the control is up.
    for (const [role, rest, draw] of [['teeth', TEETH_REST, teethPath], ['tongue', TONGUE_REST, tonguePath]]) {
      const element = state.elements[role];
      if (!element) continue;
      element.restPath = rest;
      const key = (id, name, posePath, expression) => {
        const shape = createShapeKey({ id, target: role, name, restPath: rest, posePath, driver: { mode: 'expression', expression, curve: 'linear', amplitude: 1, offset: 0 }, generatedBy: { semanticPart: mouth.id, control: role } });
        if (shape.ok) state.shapeKeys = upsertShapeKey(state.shapeKeys, shape.shapeKey);
      };
      key(`${role}-show`, `${role === 'teeth' ? 'Teeth' : 'Tongue'} showing`, draw({ open: 1, show: 1 }), `mouthOpen * ${role}`);
      // The upper lip moves with the smile whether or not anything shows
      // behind it, so this one follows `smile` on its own -- signed, so a
      // frown carries it the other way.
      key(`${role}-follow`, `${role === 'teeth' ? 'Teeth' : 'Tongue'} with the lip`, draw({ smile: 1 }), 'smile');
      // And they widen with the mouth, or a wide grin shows teeth inset from it.
      bind(state, role, 'scaleX', 'mouthWidth', .25, 1);
      pivot(state, role, 120, 163);
    }
  }

  // The jaw opens with the mouth *and* on its own: one shape, one expression.
  // Opening the mouth without lengthening the lower face reads as a hole in a
  // rigid head, and a jaw an author cannot drop by itself is not a jaw.
  if (jaw) {
    state.elements.head.restPath = HEAD_REST;
    const shape = createShapeKey({
      id: 'head-jaw', target: 'head', name: 'Jaw', restPath: HEAD_REST, posePath: headPath({ jaw: 1 }),
      driver: { mode: 'expression', expression: 'mouthOpen + jawOpen', curve: 'linear', amplitude: 1, offset: 0 },
      generatedBy: { semanticPart: jaw.id, control: 'jawOpen' }
    });
    if (shape.ok) state.shapeKeys = upsertShapeKey(state.shapeKeys, shape.shapeKey);
  }

  // Cartoon shading: the side of the face turning away darkens. `baseOpacity`
  // (.5 in the artwork) is the darkest it can get; the binding is the fraction.
  bind(state, 'shadeRight', 'opacity', 'headX', .6, .1);
  bind(state, 'shadeLeft', 'opacity', 'headX', -.6, .1);

  // The eye outline is the socket, so it goes when the lid covers it — a closed
  // cartoon eye is a crease, not a circle with a line through it. This fade is
  // the opposite of the pupil's: the rim really does stop existing, where the
  // pupil is still there behind the lid.
  for (const id of ['rimLeft', 'rimRight']) bind(state, id, 'opacity', 'eyeOpen', 3, -.15);

  // Two corners the mouth can move on its own, and a lower lip the jaw pulls
  // on unless the lips are locked (CR-27 … CR-31). Every offset rests at 0, so
  // the mouth looks and behaves exactly as it did until one is moved.
  if (mouth && ours) enableMouthRig(state, { target: 'mouth', box: MOUTH_BOX });

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
    // And the half of the turn that sells it (3D-10): the hair and the ears
    // arrive a beat after the head instead of with it. Exactly what pressing
    // Generate turn writes, so regenerating with the box cleared removes it.
    state.followers = suggestedFollowers(state);
  }

  state.animationEditor = { activeClipId: state.animationClips[0]?.id || null, playhead: 0, panel: 'preview', autoKey: false };
  state.selectedId = null;
  return state;
}
