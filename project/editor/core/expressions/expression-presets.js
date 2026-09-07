// Expression presets: named faces described over basic semantic controls.
// A preset is instantiated only with the controls the project has; the
// missing ones are reported so the UI can guide the user to Face Setup.
//
// The catalogue is deliberately large: an author should find the face they
// mean rather than build it slider by slider. Presets carry a `group` so a
// 300 px panel can show them a handful at a time instead of one long list.
//
// They are written over the *whole* rig, not only the movements a Face Part
// declares. Several of them used to describe one thing and do another --
// "brows up and inward" was `browTilt`, which leans both brows the same way
// rather than lifting their inner ends, and "one brow up" was the same control
// again, which cannot raise one brow at all. The face control rig
// (docs/FACE_CONTROL_RIG.md) has the parameters those sentences meant:
// `browInner` for the inner ends, `browRaiseLeft` for one of them, `smileLeft`
// for one corner of the mouth, `pupilScale` for eyes that widen, `jawOpen`
// for a jaw that drops, `mouthLock` for lips that stay pressed together.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';
import { sanitizeControls } from './expression-model.js';
import { controlMeta } from '../../ui/control-catalog.js';

/** Group order, used by the catalogue UI. The first one opens by default. */
export const EXPRESSION_PRESET_GROUPS = Object.freeze(['Everyday', 'Playful', 'Thinking', 'Quiet', 'Strong']);

const preset = (group, id, name, description, controls, hands = null) => Object.freeze({ id, name, description, group, controls: Object.freeze(controls), hands: Object.freeze(hands || {}) });

/**
 * What a face does with its hands (docs/HAND_RIGGING.md): the generated
 * pair's own controls, for both hands unless a side is named. `x` is outward
 * (the left hand goes left), `y` is up when negative, `turn` is a turn away
 * from the body, and a pose is the generated pose's id at that weight. A pair
 * that rests behind the head comes out with the face (`show`), and a project
 * with no hands keeps the face alone -- these are never reported missing.
 */
const hands = ({ show = 1, x = 0, y = 0, turn = 0, side = null, ...poses } = {}) => {
  const out = {};
  for (const [prefix, sign] of [['handL', -1], ['handR', 1]]) {
    if (side && side !== (prefix === 'handL' ? 'left' : 'right')) continue;
    out[`${prefix}Show`] = show;
    if (x) out[`${prefix}X`] = sign * x;
    if (y) out[`${prefix}Y`] = y;
    if (turn) out[`${prefix}Rotation`] = -sign * turn;
    for (const [pose, weight] of Object.entries(poses)) out[`${prefix}${pose.charAt(0).toUpperCase()}${pose.slice(1)}`] = weight;
  }
  return out;
};

export const EXPRESSION_PRESETS = Object.freeze([
  // Everyday: the faces almost every mascot needs.
  preset('Everyday', 'happy', 'Happy', 'Wide smile, bright eyes.', { smile: 1, eyeOpen: .9, browRaise: .25 }, hands({ y: -.35, x: .15, relax: .6 })),
  preset('Everyday', 'sad', 'Sad', 'Mouth down, inner brows up, head slightly down.', { smile: -.8, eyeOpen: .7, browRaise: -.2, browInner: .8, headY: .3 }, hands({ y: .15, x: -.1, relax: 1 })),
  preset('Everyday', 'angry', 'Angry', 'Brows down and inward, tight mouth.', { smile: -.6, eyeOpen: .65, browRaise: -.5, browInner: -1, mouthWidth: -.4 }, hands({ y: -.35, x: .1, fist: 1 })),
  preset('Everyday', 'surprised', 'Surprised', 'Jaw dropped, pupils wide, brows up.', { mouthOpen: 1, jawOpen: .5, eyeOpen: 1, pupilScale: 1.35, browRaise: 1 }, hands({ y: -1, x: .35, spread: 1 })),
  preset('Everyday', 'calm', 'Calm', 'A soft, resting smile.', { smile: .3, eyeOpen: .75, browRaise: .05 }),
  preset('Everyday', 'curious', 'Curious', 'Brows up, head tilted, looking a little up.', { browRaise: .6, eyeOpen: 1, headTilt: .35, lookY: -.15 }),

  // Playful: the big, cartoon reactions.
  preset('Playful', 'excited', 'Excited', 'Big smile, teeth showing, pupils wide, head up.', { smile: 1, eyeOpen: 1, mouthOpen: .5, teeth: .9, pupilScale: 1.25, browRaise: .6, headY: -.3 }, hands({ y: -1, x: .45, spread: 1 })),
  preset('Playful', 'laughing', 'Laughing', 'Jaw wide on a grin, eyes squeezed shut, head back.', { smile: 1, mouthOpen: .8, jawOpen: .6, teeth: 1, eyeOpen: .15, browRaise: .4, headY: -.2 }, hands({ y: -.5, x: .3, relax: .8 })),
  preset('Playful', 'cheeky', 'Cheeky', 'A one-sided grin with the tongue just showing.', { smile: .5, smileRight: .9, eyeOpen: .55, browRaiseRight: -.5, tongue: .5, mouthOpen: .2, headTilt: .25, lookX: .5 }, hands({ side: 'right', y: -.6, x: .2, thumbsUp: 1 })),
  preset('Playful', 'silly', 'Silly', 'Crooked brows, tongue out, eyes off in two directions.', { smile: .6, mouthOpen: .6, tongue: 1, tongueOut: .7, browRaiseLeft: .8, browRaiseRight: -.5, headTilt: -.35, lookX: -.6, lookXRight: .5, lookY: -.3 }, hands({ y: -.4, x: .6, turn: .6, spread: 1 })),
  preset('Playful', 'proud', 'Proud', 'Chin up, small confident smile.', { smile: .7, eyeOpen: .65, browRaise: .3, headY: -.35 }, hands({ y: -.55, x: .2, thumbsUp: 1 })),
  preset('Playful', 'adoring', 'Adoring', 'Soft eyes, warm smile, head leaning in.', { smile: .9, eyeOpen: .45, browRaise: .5, headTilt: .3 }, hands({ y: -.2, x: -.45, relax: 1 })),

  // Thinking: faces that read as "working something out".
  preset('Thinking', 'confused', 'Confused', 'One brow up, head tilted, mouth pulled to one side.', { browRaiseLeft: .9, browRaiseRight: -.3, browRaise: .2, smile: -.2, smileLeft: .4, headTilt: -.4 }, hands({ y: -.3, x: .5, turn: .5, spread: .9 })),
  preset('Thinking', 'thinking', 'Thinking', 'Looking away and up, one corner of the mouth undecided.', { browInner: .5, browRaise: .15, smile: -.1, smileRight: .35, headTilt: .3, lookX: -.7, lookY: -.4 }, hands({ side: 'right', y: -.85, x: -.55, pinch: 1 })),
  preset('Thinking', 'skeptical', 'Skeptical', 'One brow up, the other down, eyes narrowed.', { browRaiseLeft: 1, browRaiseRight: -.6, eyeOpen: .55, eyeOpenLeft: -.15, smile: -.3, headTilt: -.2 }),
  preset('Thinking', 'determined', 'Determined', 'Brows down and in, eyes steady, chin forward.', { browRaise: -.4, browInner: -.7, eyeOpen: .85, smile: -.1, mouthWidth: -.3, headY: -.1 }, hands({ fist: 1 })),
  preset('Thinking', 'idea', 'Idea!', 'Brows up, eyes wide, a small delighted “oh”.', { browRaise: 1, eyeOpen: 1, smile: .6, mouthOpen: .3, headY: -.25 }, hands({ side: 'right', y: -1, x: .25, point: 1 })),

  // Quiet: low energy, small movements.
  preset('Quiet', 'sleepy', 'Sleepy', 'Half-closed eyes, the jaw going, head tilted.', { eyeOpen: .25, mouthOpen: .15, jawOpen: .3, browRaise: -.2, pupilScale: .8, headTilt: .3 }),
  preset('Quiet', 'bored', 'Bored', 'Heavy lids, flat mouth, looking away.', { eyeOpen: .45, browRaise: -.35, smile: -.25, lookX: .6, headTilt: .25 }),
  preset('Quiet', 'shy', 'Shy', 'A small smile, inner brows up, eyes to the side.', { smile: .4, eyeOpen: .5, browRaise: .2, browInner: .6, headY: .25, headTilt: .3, lookX: -.7 }, hands({ y: .1, x: -.4, relax: .8 })),
  preset('Quiet', 'sulking', 'Sulking', 'Mouth down, brows low, lips pressed together, looking away.', { smile: -.7, browRaise: -.4, browInner: -.3, mouthWidth: -.5, mouthLock: .8, headY: .2, lookX: -.5 }, hands({ y: .1, fist: 1 })),
  preset('Quiet', 'relieved', 'Relieved', 'Eyes almost shut, a long, easy smile.', { smile: .5, eyeOpen: .3, browRaise: -.1, headTilt: .15 }),

  // Strong: the alarmed and the unimpressed.
  preset('Strong', 'scared', 'Scared', 'Pupils wide, brows up and inward, head back.', { eyeOpen: 1, pupilScale: 1.45, browRaise: .9, browInner: .9, smile: -.7, mouthOpen: .4, headY: .2 }, hands({ y: -.75, x: .3, stop: 1 })),
  preset('Strong', 'worried', 'Worried', 'Inner brows climbing, mouth turned down.', { eyeOpen: .8, browRaise: .3, browInner: 1, smile: -.5, headTilt: .2 }, hands({ y: -.35, x: -.4, pinch: .6 })),
  preset('Strong', 'annoyed', 'Annoyed', 'Half-lidded eyes, one brow down, looking away.', { eyeOpen: .6, browRaise: -.3, browRaiseRight: -.6, browInner: -.4, smile: -.35, headTilt: .2, lookX: .4 }),
  preset('Strong', 'disgusted', 'Disgusted', 'Nose wrinkled, brows down, mouth pulled aside.', { smile: -.6, smileLeft: -.5, eyeOpen: .5, browRaise: -.4, browInner: -.5, noseScrunch: .8, mouthOpen: .2, mouthWidthLeft: -.6, headTilt: -.2 }, hands({ y: -.45, x: .55, stop: 1 }))
]);

export const presetById = (id) => EXPRESSION_PRESETS.find((preset) => preset.id === id) || null;

/**
 * A movement's name, for the "turn this on first" message. Falls through to
 * the control catalogue, because the presets also name the control rig's own
 * parameters -- a brow's inner end, one eye's lid, a mouth corner -- and those
 * are named there rather than by a Face Part.
 */
const movementLabel = (control) => {
  const entry = BASIC_MOVEMENTS.find((item) => item.id === control);
  if (entry) return `${entry.group} · ${entry.label}`;
  const meta = controlMeta(control);
  return meta.group && meta.group !== 'Other' ? `${meta.group} · ${meta.label}` : control;
};

/**
 * Resolve a preset against the project's parameters: available controls are
 * kept (clamped), missing ones are listed with their human labels and the part
 * type that would provide them.
 */
export function instantiatePreset(document, preset) {
  const source = typeof preset === 'string' ? presetById(preset) : preset;
  if (!source) throw new Error(`Unknown expression preset "${preset}".`);
  // The hands come along when the project has them, and are never missed when it does not.
  const controls = sanitizeControls(document, { ...(source.hands || {}), ...source.controls });
  const missing = Object.keys(source.controls).filter((name) => !(name in controls)).map((name) => ({ control: name, label: movementLabel(name), part: BASIC_MOVEMENTS.find((item) => item.id === name)?.part || null }));
  return { id: source.id, name: source.name, description: source.description, group: source.group || EXPRESSION_PRESET_GROUPS[0], controls, missing, usable: Object.keys(controls).length > 0 };
}

/** Availability of every preset for the current project (for the catalogue UI). */
export function presetAvailability(document) {
  return EXPRESSION_PRESETS.map((preset) => instantiatePreset(document, preset));
}

/** The same availability, bucketed in catalogue order; empty groups are dropped. */
export function presetAvailabilityGroups(document) {
  const resolved = presetAvailability(document);
  return EXPRESSION_PRESET_GROUPS.map((group) => ({ group, presets: resolved.filter((item) => item.group === group) })).filter((entry) => entry.presets.length);
}
