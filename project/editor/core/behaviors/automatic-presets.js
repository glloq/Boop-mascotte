// Automatic presets: the always-on "life" outcomes a beginner recognizes
// (Blink, Natural gaze, Idle head movement), each mapped exactly onto the
// runtime behavior types that already exist (blink, randomIdle, oscillator).
// No new runtime semantics: a preset is one or more ordinary behaviors with
// stable ids and sensible values; detection is by type + parameter so hand
// authored behaviors are recognized too.
import { BASIC_MOVEMENTS } from '../../rig-editor/semantic-parts/face-movements.js';

export const AUTOMATIC_PRESETS = Object.freeze([
  Object.freeze({ id: 'blink', title: 'Blink', description: 'The eyes close briefly every few seconds.', behaviors: [Object.freeze({ id: 'auto-blink', type: 'blink', name: 'Blink', parameter: 'eyeOpen', intervalMin: 2, intervalMax: 6, duration: .12, closedValue: 0 })] }),
  Object.freeze({ id: 'natural-gaze', title: 'Natural gaze', description: 'The eyes glance around now and then.', behaviors: [
    Object.freeze({ id: 'auto-gaze-x', type: 'randomIdle', name: 'Natural gaze (left / right)', parameter: 'lookX', intervalMin: 1.5, intervalMax: 4, min: -.4, max: .4 }),
    Object.freeze({ id: 'auto-gaze-y', type: 'randomIdle', name: 'Natural gaze (up / down)', parameter: 'lookY', intervalMin: 2, intervalMax: 5, min: -.25, max: .25, optional: true })
  ] }),
  Object.freeze({ id: 'idle-head', title: 'Idle head movement', description: 'A slow, gentle sway, like breathing.', behaviors: [Object.freeze({ id: 'auto-idle-head', type: 'oscillator', name: 'Idle head movement', parameter: 'headY', amplitude: .05, frequency: .3, offset: 0 })] })
]);

export const automaticPresetById = (id) => AUTOMATIC_PRESETS.find((preset) => preset.id === id) || null;

const movementLabel = (control) => { const entry = BASIC_MOVEMENTS.find((item) => item.id === control); return entry ? `${entry.group} · ${entry.label}` : control; };

/** The project behavior that plays the role of a preset behavior (same type on the same parameter). */
export const matchBehavior = (document, spec) => (document?.behaviors || []).find((item) => item && item.type === spec.type && item.parameter === spec.parameter) || null;

/**
 * Status of every preset for the project:
 * - unavailable: a required movement is missing (with labels for guidance);
 * - off: no matching behavior yet;
 * - on: every available preset behavior exists and is enabled;
 * - disabled: matching behaviors exist but at least one is off (kept, so tweaks survive).
 * `other` lists behaviors that map to no preset (advanced).
 */
export function deriveAutomaticStatus(document) {
  const params = document?.params || {}, claimed = new Set();
  const presets = AUTOMATIC_PRESETS.map((preset) => {
    const required = preset.behaviors.filter((spec) => !spec.optional);
    const missing = required.filter((spec) => !params[spec.parameter]).map((spec) => ({ control: spec.parameter, label: movementLabel(spec.parameter) }));
    const available = preset.behaviors.filter((spec) => params[spec.parameter]);
    const matched = available.map((spec) => matchBehavior(document, spec)).filter(Boolean);
    for (const item of matched) claimed.add(item);
    const requiredMatched = required.map((spec) => params[spec.parameter] ? matchBehavior(document, spec) : null);
    const status = missing.length ? 'unavailable' : !requiredMatched.some(Boolean) ? 'off' : matched.every((item) => item.enabled !== false) && requiredMatched.every(Boolean) ? 'on' : 'disabled';
    return { id: preset.id, title: preset.title, description: preset.description, status, missing, behaviorIds: matched.map((item) => item.id), testId: matched.find((item) => item.enabled !== false)?.id || null };
  });
  const other = (document?.behaviors || []).filter((item) => item && !claimed.has(item)).map((item) => ({ id: item.id, name: item.name, type: item.type, parameter: item.parameter, enabled: item.enabled !== false }));
  return { presets, other, on: presets.filter((item) => item.status === 'on').length };
}
