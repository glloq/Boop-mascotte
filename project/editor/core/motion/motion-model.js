// Motion model over ordinary animation clips (docs/ADR_MOTIONS.md).
// A "simple motion" is a clip whose tracks equal the deterministic compilation
// of its stored preset settings; editing keys in the Timeline turns it into an
// "edited" clip; clips without preset metadata are "custom".
import { normalizeMotionBlend } from '../../../runtime/runtime.js';
import { normalizeAnimationClip } from '../../animation-editor/timeline/clip-model.js';
import { duplicateClip, removeClip } from '../../animation-editor/timeline/clip-operations.js';
import { compileMotionTracks, normalizeMotionSettings, presetById, resolveMotionControls } from './motion-presets.js';

const uid = (clips, base = 'motion') => {
  let id = String(base).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'motion', n = 2;
  const used = new Set(clips.map((clip) => clip.id));
  const root = id;
  while (used.has(id)) id = `${root}-${n++}`;
  return id;
};

export const findClip = (document, id) => (document?.animationClips || []).find((clip) => clip.id === id) || null;

const requireClip = (document, id) => { const clip = findClip(document, id); if (!clip) throw new Error(`Animation "${id}" does not exist.`); return clip; };
const requirePreset = (clip) => { const preset = clip.motion && presetById(clip.motion.preset); if (!preset) throw new Error(`"${clip.name}" is not a preset motion.`); return preset; };

/** Create a clip from a preset using the movements the project has. */
export function createMotionClip(document, presetId, options = {}) {
  const preset = presetById(presetId);
  if (!preset) throw new Error(`Unknown motion preset "${presetId}".`);
  const { controls, missing } = resolveMotionControls(preset, document.params || {});
  if (!Object.keys(controls).length) throw new Error(`${preset.name} needs a movement that is off: ${missing.map((item) => item.label).join(', ')}. Turn it on in Face Setup first.`);
  const settings = normalizeMotionSettings(preset, options);
  const clips = document.animationClips ||= [];
  const clip = normalizeAnimationClip({ id: uid(clips, options.id || preset.id), name: String(options.name || preset.name).trim() || preset.name, duration: settings.duration, loop: Boolean(options.loop), tracks: compileMotionTracks(preset, settings, controls, document.params) });
  clip.motion = { preset: preset.id, amplitude: settings.amplitude, repeats: settings.repeats, controls };
  clips.push(clip);
  return clip;
}

/** Change amplitude / duration / repeats (and optionally loop): tracks are regenerated from the preset. */
export function updateMotionSettings(document, id, patch = {}) {
  const clip = requireClip(document, id), preset = requirePreset(clip);
  const settings = normalizeMotionSettings(preset, { amplitude: patch.amplitude ?? clip.motion.amplitude, repeats: patch.repeats ?? clip.motion.repeats, duration: patch.duration ?? clip.duration });
  clip.duration = settings.duration;
  clip.tracks = compileMotionTracks(preset, settings, clip.motion.controls, document.params);
  clip.motion = { ...clip.motion, amplitude: settings.amplitude, repeats: settings.repeats };
  if (patch.loop !== undefined) clip.loop = Boolean(patch.loop);
  return clip;
}

/** Rebuild the tracks from the stored preset settings (discards key edits). */
export function resetMotion(document, id) { return updateMotionSettings(document, id, {}); }

/** Forget the preset: the clip becomes a custom Timeline animation with the same keys. */
export function detachMotion(document, id) {
  const clip = requireClip(document, id);
  if (!clip.motion) throw new Error(`"${clip.name}" is already a custom animation.`);
  delete clip.motion;
  return clip;
}

export function setClipLoop(document, id, loop) { const clip = requireClip(document, id); clip.loop = Boolean(loop); return clip; }

export function renameClip(document, id, name) {
  const clip = requireClip(document, id), next = String(name ?? '').trim();
  if (!next) throw new Error('Give the motion a name.');
  clip.name = next;
  return clip;
}

export function duplicateMotionClip(document, id) { const copy = duplicateClip(document.animationClips || [], id); if (!copy) throw new Error(`Animation "${id}" does not exist.`); return copy; }
export function removeMotionClip(document, id) { const removed = removeClip(document.animationClips || [], id); if (!removed) throw new Error(`Animation "${id}" does not exist.`); return removed; }

const sameFrames = (a = [], b = []) => a.length === b.length && a.every((frame, index) => Math.abs(frame.time - b[index].time) < 1e-6 && Math.abs(frame.value - b[index].value) < 1e-6 && (frame.easing || 'linear') === (b[index].easing || 'linear'));
export function tracksEqual(a = {}, b = {}) {
  const keys = Object.keys(a), other = Object.keys(b);
  return keys.length === other.length && keys.every((key) => key in b && sameFrames(a[key], b[key]));
}

/** 'simple' (tracks match the preset), 'edited' (preset clip changed in the Timeline) or 'custom' (no preset). */
export function classifyClip(document, clip) {
  const preset = clip?.motion && presetById(clip.motion.preset);
  if (!preset) return 'custom';
  const expected = compileMotionTracks(preset, { amplitude: clip.motion.amplitude, repeats: clip.motion.repeats, duration: clip.duration }, clip.motion.controls || {}, document?.params || {});
  return tracksEqual(clip.tracks || {}, expected) ? 'simple' : 'edited';
}

/** Presentation summary used by the Motion Studio and the E2E seam. */
export function motionSummary(document, clip) {
  const kind = classifyClip(document, clip), preset = clip.motion ? presetById(clip.motion.preset) : null;
  const tracks = Object.keys(clip.tracks || {}), keys = Object.values(clip.tracks || {}).reduce((total, frames) => total + frames.length, 0);
  return { id: clip.id, name: clip.name, kind, preset: preset?.id || null, presetName: preset?.name || null, amplitude: clip.motion?.amplitude ?? null, repeats: clip.motion?.repeats ?? null, duration: clip.duration, loop: Boolean(clip.loop), controls: clip.motion ? Object.values(clip.motion.controls || {}) : tracks, tracks: tracks.length, keys };
}

/**
 * How long one motion takes to become another (docs/ADR_MOTION_LAYERING.md).
 * Read by the shared motion layer, so the preview and the exported mascot hand
 * over identically; 0 ms cuts, as it always did.
 */
export function setMotionBlend(document, patch = {}) {
  document.motionBlend = normalizeMotionBlend({ ...(document.motionBlend || {}), ...patch });
  return document.motionBlend;
}

/** The stored blend, normalized — `null` reads as an instant cut. */
export const motionBlend = (document) => normalizeMotionBlend(document?.motionBlend || {});
