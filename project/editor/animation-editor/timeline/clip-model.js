import { CURVES } from '../../../runtime/runtime.js';

export function normalizeAnimationClip(source = {}, parameterNames = []) {
  const duration = Number(source.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Animation duration must be greater than zero.');
  const known = new Set(parameterNames), tracks = {};
  for (const [parameter, sourceFrames] of Object.entries(source.tracks || {})) {
    if (known.size && !known.has(parameter)) throw new Error(`Animation track references unknown parameter "${parameter}".`);
    if (!Array.isArray(sourceFrames)) throw new Error(`Animation track "${parameter}" must be an array.`);
    tracks[parameter] = sourceFrames.map((frame) => {
      const time = Number(frame.time), value = Number(frame.value);
      if (!Number.isFinite(time) || time < 0 || time > duration) throw new Error(`Keyframe time for "${parameter}" is outside the clip.`);
      if (!Number.isFinite(value)) throw new Error(`Keyframe value for "${parameter}" must be finite.`);
      return { time, value, easing: CURVES.includes(frame.easing) ? frame.easing : 'linear' };
    }).sort((a, b) => a.time - b.time);
  }
  return { id: String(source.id || `clip-${Date.now()}`), name: String(source.name || 'Untitled animation'), duration, loop: Boolean(source.loop), tracks };
}
