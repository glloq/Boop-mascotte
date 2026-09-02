// Simple Motion presets: named movements over time described over basic
// semantic controls. A preset compiles deterministically to an ordinary
// animation clip (keyframe tracks); the clip keeps its preset settings so the
// Motion Inspector can change amplitude, duration and repeats without the
// Timeline (docs/ADR_MOTIONS.md). Presets are data; nothing is authored
// until the user adds one.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';

const shape = (...keys) => Object.freeze(keys.map(([t, v, easing = 'easeInOut']) => Object.freeze({ t, v, easing })));
const slot = (control, fallbacks, keys) => Object.freeze({ control, fallbacks: Object.freeze(fallbacks), shape: keys });

export const MOTION_PRESETS = Object.freeze([
  Object.freeze({ id: 'nod', name: 'Nod', description: 'The head dips and comes back.', slots: [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.5, 1], [1, 0]))], defaults: Object.freeze({ amplitude: .5, duration: .8, repeats: 1 }) }),
  Object.freeze({ id: 'shake', name: 'Shake', description: 'The head turns left, right and back.', slots: [slot('headX', ['headTilt'], shape([0, 0, 'linear'], [.25, -1], [.75, 1], [1, 0]))], defaults: Object.freeze({ amplitude: .5, duration: .8, repeats: 2 }) }),
  Object.freeze({ id: 'bounce', name: 'Bounce', description: 'The head hops up and settles.', slots: [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.25, -1, 'easeOut'], [.55, 0, 'easeIn'], [.75, -.35, 'easeOut'], [1, 0, 'easeIn']))], defaults: Object.freeze({ amplitude: .6, duration: .7, repeats: 1 }) }),
  Object.freeze({ id: 'tilt', name: 'Tilt', description: 'The head leans to one side, holds, and returns.', slots: [slot('headTilt', [], shape([0, 0, 'linear'], [.35, 1, 'easeOut'], [.65, 1, 'linear'], [1, 0]))], defaults: Object.freeze({ amplitude: .5, duration: 1, repeats: 1 }) }),
  Object.freeze({ id: 'look-around', name: 'Look Around', description: 'The eyes sweep left, then right, glancing up.', slots: [slot('lookX', [], shape([0, 0, 'linear'], [.2, -1], [.5, -1, 'linear'], [.7, 1], [1, 0])), slot('lookY', [], shape([0, 0, 'linear'], [.35, -.5], [.65, -.5, 'linear'], [1, 0]))], defaults: Object.freeze({ amplitude: .8, duration: 2, repeats: 1 }) }),
  Object.freeze({ id: 'eye-dart', name: 'Eye Dart', description: 'A quick glance to the side and back.', slots: [slot('lookX', ['lookY'], shape([0, 0, 'linear'], [.12, 1, 'easeOut'], [.4, 1, 'linear'], [.52, 0, 'easeOut'], [1, 0, 'linear']))], defaults: Object.freeze({ amplitude: .9, duration: .6, repeats: 1 }) }),
  Object.freeze({ id: 'head-pop', name: 'Head Pop', description: 'The head jumps up while the mouth opens briefly.', slots: [slot('headY', ['headTilt'], shape([0, 0, 'linear'], [.2, -1, 'easeOut'], [.5, 0, 'easeIn'], [1, 0, 'linear'])), slot('mouthOpen', [], shape([0, 0, 'linear'], [.2, 1, 'easeOut'], [.6, 0, 'easeIn'], [1, 0, 'linear']))], defaults: Object.freeze({ amplitude: .7, duration: .6, repeats: 1 }) })
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
    return { id: preset.id, name: preset.name, description: preset.description, defaults: preset.defaults, controls, missing, usable: Object.keys(controls).length > 0 };
  });
}
