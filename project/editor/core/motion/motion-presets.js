// Simple Motion presets: named movements over time described over basic
// semantic controls. A preset compiles deterministically to an ordinary
// animation clip (keyframe tracks); the clip keeps its preset settings so the
// Motion Inspector can change amplitude, duration and repeats without the
// Timeline (docs/ADR_MOTIONS.md). Presets are data; nothing is authored
// until the user adds one.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';

const shape = (...keys) => Object.freeze(keys.map(([t, v, easing = 'easeInOut']) => Object.freeze({ t, v, easing })));
const slot = (control, fallbacks, keys) => Object.freeze({ control, fallbacks: Object.freeze(fallbacks), shape: keys });

/** Group order, used by the catalogue UI. The first one opens by default. */
export const MOTION_PRESET_GROUPS = Object.freeze(['Head', 'Eyes', 'Face']);

const motion = (group, id, name, description, slots, defaults) => Object.freeze({ id, name, description, group, slots, defaults: Object.freeze(defaults) });

export const MOTION_PRESETS = Object.freeze([
  // Head: the movements a whole mascot makes.
  motion('Head', 'nod', 'Nod', 'The head dips and comes back.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.5, 1], [1, 0]))], { amplitude: .5, duration: .8, repeats: 1 }),
  motion('Head', 'shake', 'Shake', 'The head turns left, right and back.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, -1], [.75, 1], [1, 0]))], { amplitude: .5, duration: .8, repeats: 2 }),
  motion('Head', 'bounce', 'Bounce', 'The head hops up and settles.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.55, 0, 'easeIn'], [.75, -.35, 'easeOut'], [1, 0, 'easeIn']))], { amplitude: .6, duration: .7, repeats: 1 }),
  motion('Head', 'tilt', 'Tilt', 'The head leans to one side, holds, and returns.', [slot('headTilt', [], shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.65, 1, 'linear'], [1, 0]))], { amplitude: .5, duration: 1, repeats: 1 }),
  motion('Head', 'head-pop', 'Head Pop', 'The head jumps up while the mouth opens briefly.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.2, -1, 'easeOut'], [.5, 0, 'easeIn'], [1, 0, 'linear'])), slot('mouthOpen', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.6, 0, 'easeIn'], [1, 0, 'linear']))], { amplitude: .7, duration: .6, repeats: 1 }),
  // A full circle: the clearest way to show a 2.5D head turn off.
  motion('Head', 'head-roll', 'Head Roll', 'The head rolls all the way around, once.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, 1], [.5, 0], [.75, -1], [1, 0])), slot('headY', [], shape([0, 0, 'linear'], [.125, -1], [.375, 0], [.625, 1], [.875, 0], [1, 0]))], { amplitude: .5, duration: 1.6, repeats: 1 }),
  motion('Head', 'double-take', 'Double Take', 'A glance away, then a sharp look back.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.15, .6, 'easeOut'], [.3, 0, 'easeIn'], [.45, -1, 'easeOut'], [.7, -.9, 'linear'], [1, 0]))], { amplitude: .7, duration: 1, repeats: 1 }),
  motion('Head', 'wobble', 'Wobble', 'The head rocks side to side and settles.', [slot('headTilt', ['headX'], shape([0, 0, 'linear'], [.2, 1], [.45, -.7], [.7, .4], [1, 0]))], { amplitude: .5, duration: .9, repeats: 1 }),
  motion('Head', 'peek', 'Peek', 'The head leans out to one side, looks, and comes back.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.7, 1, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.4, repeats: 1 }),
  motion('Head', 'shiver', 'Shiver', 'A fast little tremble.', [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.15, 1, 'linear'], [.35, -1, 'linear'], [.55, 1, 'linear'], [.75, -1, 'linear'], [1, 0, 'linear']))], { amplitude: .12, duration: .5, repeats: 3 }),

  // Eyes: gaze and lids only, so they layer over anything the head is doing.
  motion('Eyes', 'look-around', 'Look Around', 'The eyes sweep left, then right, glancing up.', [slot('lookX', [], shape([0, 0, 'linear'], [.2, -1], [.5, -1, 'linear'], [.7, 1], [1, 0])), slot('lookY', [], shape([0, 0, 'linear'], [.35, -.5], [.65, -.5, 'linear'], [1, 0]))], { amplitude: .8, duration: 2, repeats: 1 }),
  motion('Eyes', 'eye-dart', 'Eye Dart', 'A quick glance to the side and back.', [slot('lookX', ['lookY'], shape([0, 0, 'linear'], [.12, 1, 'easeOut'], [.4, 1, 'linear'], [.52, 0, 'easeOut'], [1, 0, 'linear']))], { amplitude: .9, duration: .6, repeats: 1 }),
  motion('Eyes', 'look-up', 'Look Up', 'The eyes go up, hold, and come back.', [slot('lookY', ['lookX'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.7, -1, 'linear'], [1, 0]))], { amplitude: .8, duration: 1.2, repeats: 1 }),
  motion('Eyes', 'blink', 'Blink', 'The eyes close and open again.', [slot('eyeOpen', [], shape([0, 0, 'linear'], [.3, -1, 'easeIn'], [.5, -1, 'linear'], [.8, 0, 'easeOut'], [1, 0, 'linear']))], { amplitude: 1, duration: .35, repeats: 1 }),

  // Face: brows and mouth, the small beats that sell a reaction.
  motion('Face', 'brow-flash', 'Brow Flash', 'The brows jump up and drop back: hello, or surprise.', [slot('browRaise', [], shape([0, 0, 'linear'], [.25, 1, 'easeOut'], [.55, 1, 'linear'], [1, 0]))], { amplitude: .8, duration: .5, repeats: 1 }),
  motion('Face', 'smile-flash', 'Smile', 'A smile grows, holds, and relaxes.', [slot('smile', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.6, 1, 'linear'], [1, 0]))], { amplitude: .9, duration: 1.2, repeats: 1 }),
  motion('Face', 'gasp', 'Gasp', 'The mouth opens and the brows shoot up as the head pulls back.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.6, .8, 'linear'], [1, 0])), slot('browRaise', [], shape([0, 0, 'linear'], [.15, 1, 'easeOut'], [.6, .9, 'linear'], [1, 0])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.15, -.35, 'easeOut'], [.6, -.3, 'linear'], [1, 0]))], { amplitude: .9, duration: .8, repeats: 1 }),
  motion('Face', 'yawn', 'Yawn', 'A long open mouth with the eyes shut and the head rolling back.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.3, 1, 'easeOut'], [.6, 1, 'linear'], [1, 0])), slot('eyeOpen', [], shape([0, 0, 'linear'], [.3, -1], [.7, -1, 'linear'], [1, 0])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.3, -.6], [.7, .3], [1, 0]))], { amplitude: .9, duration: 2, repeats: 1 }),
  motion('Face', 'laugh', 'Laugh', 'The mouth pulses open while the head bobs.', [slot('mouthOpen', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.5, .2, 'easeIn'], [.75, .9, 'easeOut'], [1, 0, 'easeIn'])), slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.5, 0, 'easeIn'], [.75, -.6, 'easeOut'], [1, 0, 'easeIn']))], { amplitude: .7, duration: .9, repeats: 2 }),
  motion('Face', 'sigh', 'Sigh', 'A breath in, then the head and brows drop.', [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -.4, 'easeOut'], [.7, .6, 'easeIn'], [1, 0])), slot('mouthOpen', [], shape([0, 0, 'linear'], [.25, .5, 'easeOut'], [.7, 0, 'easeIn'], [1, 0, 'linear'])), slot('browRaise', [], shape([0, 0, 'linear'], [.3, -.6], [.75, -.3, 'linear'], [1, 0]))], { amplitude: .6, duration: 1.8, repeats: 1 })
]);

export const MOTION_SETTING_LIMITS = Object.freeze({
  amplitude: Object.freeze({ min: 0, max: 1, step: .05 }),
  duration: Object.freeze({ min: .1, max: 10, step: .1 }),
  repeats: Object.freeze({ min: 1, max: 10, step: 1 })
});

export const presetById = (id) => MOTION_PRESETS.find((preset) => preset.id === id) || null;

const round = (value) => Number(Number(value).toFixed(4));
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const movementLabel = (control) => { const entry = BASIC_MOVEMENTS.find((item) => item.id === control); return entry ? `${entry.group} · ${entry.label}` : control; };

/** Clamp settings to their limits; missing values fall back to the preset defaults. */
export function normalizeMotionSettings(preset, settings = {}) {
  const pick = (key) => { const limit = MOTION_SETTING_LIMITS[key]; const value = finite(settings[key], preset.defaults[key]); return Math.max(limit.min, Math.min(limit.max, value)); };
  return { amplitude: round(pick('amplitude')), duration: round(pick('duration')), repeats: Math.round(pick('repeats')) };
}

/**
 * Map each preset slot to a parameter the project has (the slot control or
 * one of its fallbacks). `pinned` keeps a previously stored mapping stable.
 */
export function resolveMotionControls(preset, params = {}, pinned = {}) {
  const controls = {}, missing = [];
  for (const item of preset.slots) {
    const name = pinned[item.control] || [item.control, ...item.fallbacks].find((candidate) => params[candidate]);
    if (name) controls[item.control] = name;
    else missing.push({ control: item.control, label: movementLabel(item.control), part: BASIC_MOVEMENTS.find((entry) => entry.id === item.control)?.part || null });
  }
  return { controls, missing };
}

/**
 * Deterministic compiler: one cycle of each slot shape is tiled `repeats`
 * times across `duration`; normalized values scale by `amplitude` within the
 * parameter range around its neutral value. Keys at cycle boundaries keep the
 * easing that arrives at them.
 */
export function compileMotionTracks(preset, settings, controls, params = {}) {
  const { amplitude, duration, repeats } = normalizeMotionSettings(preset, settings);
  const tracks = {};
  for (const item of preset.slots) {
    const name = controls[item.control];
    if (!name) continue;
    const param = params[name] || {}, min = finite(param.min, -1), max = finite(param.max, 1), neutral = Math.max(min, Math.min(max, finite(param.default, 0)));
    const frames = [];
    for (let cycle = 0; cycle < repeats; cycle++) {
      for (const key of item.shape) {
        const time = round(((cycle + key.t) / repeats) * duration);
        if (frames.some((frame) => Math.abs(frame.time - time) < 1e-6)) continue;
        const value = round(key.v >= 0 ? neutral + key.v * amplitude * (max - neutral) : neutral + key.v * amplitude * (neutral - min));
        frames.push({ time, value, easing: key.easing });
      }
    }
    tracks[name] = frames.sort((a, b) => a.time - b.time);
  }
  return tracks;
}

/** Availability of every preset for the current project (for the catalogue UI). */
export function motionAvailability(document) {
  return MOTION_PRESETS.map((preset) => {
    const { controls, missing } = resolveMotionControls(preset, document?.params || {});
    return { id: preset.id, name: preset.name, description: preset.description, group: preset.group || MOTION_PRESET_GROUPS[0], defaults: preset.defaults, controls, missing, usable: Object.keys(controls).length > 0 };
  });
}

/** The same availability, bucketed in catalogue order; empty groups are dropped. */
export function motionAvailabilityGroups(document) {
  const resolved = motionAvailability(document);
  return MOTION_PRESET_GROUPS.map((group) => ({ group, presets: resolved.filter((item) => item.group === group) })).filter((entry) => entry.presets.length);
}
