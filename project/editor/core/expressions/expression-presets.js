// Expression presets: named faces described over basic semantic controls.
// A preset is instantiated only with the controls the project has; the
// missing ones are reported so the UI can guide the user to Face Setup.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';
import { sanitizeControls } from './expression-model.js';

export const EXPRESSION_PRESETS = Object.freeze([
  Object.freeze({ id: 'happy', name: 'Happy', description: 'Wide smile, bright eyes.', controls: { smile: 1, eyeOpen: .9, browRaise: .25 } }),
  Object.freeze({ id: 'sad', name: 'Sad', description: 'Mouth down, eyes lowered, head slightly down.', controls: { smile: -.8, eyeOpen: .7, browRaise: -.3, browTilt: .4, headY: .3 } }),
  Object.freeze({ id: 'angry', name: 'Angry', description: 'Brows down and inward, tight mouth.', controls: { smile: -.6, eyeOpen: .65, browRaise: -.8, browTilt: -.6 } }),
  Object.freeze({ id: 'surprised', name: 'Surprised', description: 'Mouth open, eyes and brows up.', controls: { mouthOpen: 1, eyeOpen: 1, browRaise: 1 } }),
  Object.freeze({ id: 'sleepy', name: 'Sleepy', description: 'Half-closed eyes, small yawn, head tilted.', controls: { eyeOpen: .25, mouthOpen: .15, browRaise: -.2, headTilt: .3 } }),
  Object.freeze({ id: 'confused', name: 'Confused', description: 'One brow up, head tilted, unsure mouth.', controls: { browTilt: .8, browRaise: .3, smile: -.2, headTilt: -.4 } }),
  Object.freeze({ id: 'excited', name: 'Excited', description: 'Big smile, mouth slightly open, head up.', controls: { smile: 1, eyeOpen: 1, mouthOpen: .5, browRaise: .6, headY: -.3 } })
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
  const controls = sanitizeControls(document, source.controls);
  const missing = Object.keys(source.controls).filter((name) => !(name in controls)).map((name) => ({ control: name, label: movementLabel(name), part: BASIC_MOVEMENTS.find((item) => item.id === name)?.part || null }));
  return { id: source.id, name: source.name, description: source.description, controls, missing, usable: Object.keys(controls).length > 0 };
}

/** Availability of every preset for the current project (for the catalogue UI). */
export function presetAvailability(document) {
  return EXPRESSION_PRESETS.map((preset) => instantiatePreset(document, preset));
}
