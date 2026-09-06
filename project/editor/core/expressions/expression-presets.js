// Expression presets: named faces described over basic semantic controls.
// A preset is instantiated only with the controls the project has; the
// missing ones are reported so the UI can guide the user to Face Setup.
//
// The catalogue is deliberately large: an author should find the face they
// mean rather than build it slider by slider. Presets carry a `group` so a
// 300 px panel can show them a handful at a time instead of one long list.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';
import { sanitizeControls } from './expression-model.js';

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
  preset('Everyday', 'sad', 'Sad', 'Mouth down, eyes lowered, head slightly down.', { smile: -.8, eyeOpen: .7, browRaise: -.3, browTilt: .4, headY: .3 }, hands({ y: .15, x: -.1, relax: 1 })),
  preset('Everyday', 'angry', 'Angry', 'Brows down and inward, tight mouth.', { smile: -.6, eyeOpen: .65, browRaise: -.8, browTilt: -.6 }, hands({ y: -.35, x: .1, fist: 1 })),
  preset('Everyday', 'surprised', 'Surprised', 'Mouth open, eyes and brows up.', { mouthOpen: 1, eyeOpen: 1, browRaise: 1 }, hands({ y: -1, x: .35, spread: 1 })),
  preset('Everyday', 'calm', 'Calm', 'A soft, resting smile.', { smile: .3, eyeOpen: .75, browRaise: .05 }),
  preset('Everyday', 'curious', 'Curious', 'Brows up, head tilted, looking a little up.', { browRaise: .6, eyeOpen: 1, headTilt: .35, lookY: -.15 }),

  // Playful: the big, cartoon reactions.
  preset('Playful', 'excited', 'Excited', 'Big smile, mouth slightly open, head up.', { smile: 1, eyeOpen: 1, mouthOpen: .5, browRaise: .6, headY: -.3 }, hands({ y: -1, x: .45, spread: 1 })),
  preset('Playful', 'laughing', 'Laughing', 'Mouth wide, eyes squeezed shut, head back.', { smile: 1, mouthOpen: .8, eyeOpen: .15, browRaise: .4, headY: -.2 }, hands({ y: -.5, x: .3, relax: .8 })),
  preset('Playful', 'cheeky', 'Cheeky', 'A sideways grin with one brow down.', { smile: .8, eyeOpen: .55, browTilt: -.5, headTilt: .25, lookX: .5 }, hands({ side: 'right', y: -.6, x: .2, thumbsUp: 1 })),
  preset('Playful', 'silly', 'Silly', 'Crooked brows, open mouth, eyes off to the side.', { smile: .6, mouthOpen: .6, browTilt: .7, headTilt: -.35, lookX: -.6, lookY: -.3 }, hands({ y: -.4, x: .6, turn: .6, spread: 1 })),
  preset('Playful', 'proud', 'Proud', 'Chin up, small confident smile.', { smile: .7, eyeOpen: .65, browRaise: .3, headY: -.35 }, hands({ y: -.55, x: .2, thumbsUp: 1 })),
  preset('Playful', 'adoring', 'Adoring', 'Soft eyes, warm smile, head leaning in.', { smile: .9, eyeOpen: .45, browRaise: .5, headTilt: .3 }, hands({ y: -.2, x: -.45, relax: 1 })),

  // Thinking: faces that read as "working something out".
  preset('Thinking', 'confused', 'Confused', 'One brow up, head tilted, unsure mouth.', { browTilt: .8, browRaise: .3, smile: -.2, headTilt: -.4 }, hands({ y: -.3, x: .5, turn: .5, spread: .9 })),
  preset('Thinking', 'thinking', 'Thinking', 'Looking away and up, mouth undecided.', { browTilt: .5, browRaise: .15, smile: -.1, headTilt: .3, lookX: -.7, lookY: -.4 }, hands({ side: 'right', y: -.85, x: -.55, pinch: 1 })),
  preset('Thinking', 'skeptical', 'Skeptical', 'One brow up, eyes narrowed, mouth flat.', { browRaise: .35, browTilt: -.7, eyeOpen: .55, smile: -.3, headTilt: -.2 }),
  preset('Thinking', 'determined', 'Determined', 'Brows down, eyes steady, chin forward.', { browRaise: -.5, browTilt: -.2, eyeOpen: .85, smile: -.1, headY: -.1 }, hands({ fist: 1 })),
  preset('Thinking', 'idea', 'Idea!', 'Brows up, eyes wide, a small delighted “oh”.', { browRaise: 1, eyeOpen: 1, smile: .6, mouthOpen: .3, headY: -.25 }, hands({ side: 'right', y: -1, x: .25, point: 1 })),

  // Quiet: low energy, small movements.
  preset('Quiet', 'sleepy', 'Sleepy', 'Half-closed eyes, small yawn, head tilted.', { eyeOpen: .25, mouthOpen: .15, browRaise: -.2, headTilt: .3 }),
  preset('Quiet', 'bored', 'Bored', 'Heavy lids, flat mouth, looking away.', { eyeOpen: .45, browRaise: -.35, smile: -.25, lookX: .6, headTilt: .25 }),
  preset('Quiet', 'shy', 'Shy', 'A small smile, eyes to the side, head down.', { smile: .4, eyeOpen: .5, browRaise: .3, browTilt: .3, headY: .25, headTilt: .3, lookX: -.7 }, hands({ y: .1, x: -.4, relax: .8 })),
  preset('Quiet', 'sulking', 'Sulking', 'Mouth down, brows low, looking away.', { smile: -.7, browRaise: -.4, mouthOpen: .1, headY: .2, lookX: -.5 }, hands({ y: .1, fist: 1 })),
  preset('Quiet', 'relieved', 'Relieved', 'Eyes almost shut, a long, easy smile.', { smile: .5, eyeOpen: .3, browRaise: -.1, headTilt: .15 }),

  // Strong: the alarmed and the unimpressed.
  preset('Strong', 'scared', 'Scared', 'Eyes wide, brows up and inward, head back.', { eyeOpen: 1, browRaise: .9, browTilt: .6, smile: -.7, mouthOpen: .4, headY: .2 }, hands({ y: -.75, x: .3, stop: 1 })),
  preset('Strong', 'worried', 'Worried', 'Brows tilted up, mouth turned down.', { eyeOpen: .8, browRaise: .5, browTilt: .6, smile: -.5, headTilt: .2 }, hands({ y: -.35, x: -.4, pinch: .6 })),
  preset('Strong', 'annoyed', 'Annoyed', 'Half-lidded eyes, one brow down, looking away.', { eyeOpen: .6, browRaise: -.5, browTilt: -.3, smile: -.35, headTilt: .2, lookX: .4 }),
  preset('Strong', 'disgusted', 'Disgusted', 'Brows down, mouth pulled aside, leaning back.', { smile: -.6, eyeOpen: .5, browRaise: -.4, browTilt: -.4, mouthOpen: .2, headTilt: -.2 }, hands({ y: -.45, x: .55, stop: 1 }))
]);

export const presetById = (id) => EXPRESSION_PRESETS.find((preset) => preset.id === id) || null;

const movementLabel = (control) => { const entry = BASIC_MOVEMENTS.find((item) => item.id === control); return entry ? `${entry.group} · ${entry.label}` : control; };

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
