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
  Object.freeze({ id: 'idle-head', title: 'Idle head movement', description: 'A slow, gentle sway, like breathing.', behaviors: [Object.freeze({ id: 'auto-idle-head', type: 'oscillator', name: 'Idle head movement', parameter: 'headY', amplitude: .05, frequency: .3, offset: 0 })] }),
  // V2 cartoon idles (docs/BEHAVIORS.md). Amplitudes are deliberately small:
  // a mascot should look alive, never look like it is shivering.
  Object.freeze({ id: 'eye-wander', title: 'Eye wander', description: 'The gaze drifts and pauses, instead of jumping.', behaviors: [
    Object.freeze({ id: 'auto-wander-x', type: 'drift', name: 'Eye wander (left / right)', parameter: 'lookX', amplitude: .25, travelMin: .5, travelMax: 1.1, intervalMin: 1.2, intervalMax: 3 }),
    Object.freeze({ id: 'auto-wander-y', type: 'drift', name: 'Eye wander (up / down)', parameter: 'lookY', amplitude: .15, travelMin: .6, travelMax: 1.2, intervalMin: 1.8, intervalMax: 4, optional: true })
  ] }),
  Object.freeze({ id: 'head-drift', title: 'Head drift', description: 'The head settles into slightly different angles.', behaviors: [
    Object.freeze({ id: 'auto-head-drift-x', type: 'drift', name: 'Head drift (left / right)', parameter: 'headX', amplitude: .08, travelMin: 1.4, travelMax: 2.6, intervalMin: 1.5, intervalMax: 4 }),
    Object.freeze({ id: 'auto-head-drift-y', type: 'drift', name: 'Head drift (up / down)', parameter: 'headY', amplitude: .06, travelMin: 1.6, travelMax: 3, intervalMin: 2, intervalMax: 5, optional: true })
  ] }),
  Object.freeze({ id: 'breathing', title: 'Breathing', description: 'A slow rise and fall of the body.', behaviors: [
    Object.freeze({ id: 'auto-breathing', type: 'oscillator', name: 'Breathing', parameter: 'bodyBounce', amplitude: .05, frequency: .22, offset: 0 })
  ] }),
  Object.freeze({ id: 'body-bounce', title: 'Tiny body bounce', description: 'A small, quick bounce that keeps the pose from looking frozen.', behaviors: [
    Object.freeze({ id: 'auto-body-bounce', type: 'oscillator', name: 'Tiny body bounce', parameter: 'bodyBounce', amplitude: .03, frequency: .8, offset: 0 })
  ] }),
  Object.freeze({ id: 'hand-drift', title: 'Idle hands', description: 'The hands float and turn a little on their own.', behaviors: [
    Object.freeze({ id: 'auto-hand-l-y', type: 'oscillator', name: 'Left hand float', parameter: 'handLY', amplitude: .06, frequency: .35, offset: 0 }),
    Object.freeze({ id: 'auto-hand-l-rotation', type: 'oscillator', name: 'Left hand turn', parameter: 'handLRotation', amplitude: .05, frequency: .23, offset: 0, optional: true }),
    Object.freeze({ id: 'auto-hand-r-y', type: 'oscillator', name: 'Right hand float', parameter: 'handRY', amplitude: .06, frequency: .31, offset: 0, optional: true }),
    Object.freeze({ id: 'auto-hand-r-rotation', type: 'oscillator', name: 'Right hand turn', parameter: 'handRRotation', amplitude: .05, frequency: .2, offset: 0, optional: true })
  ] })
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
