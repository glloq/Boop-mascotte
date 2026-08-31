import { easingValue } from '../../../runtime/runtime.js';

export function evaluateAnimationClip(clip, time, defaults = {}) {
  const duration = Number(clip?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return {};
  const numericTime = Number.isFinite(Number(time)) ? Number(time) : 0;
  const t = clip.loop ? ((numericTime % duration) + duration) % duration : Math.max(0, Math.min(duration, numericTime));
  const result = {};
  for (const [parameter, frames] of Object.entries(clip.tracks || {})) {
    if (!frames.length) continue;
    if (t <= frames[0].time) { result[parameter] = frames[0].value; continue; }
    if (t >= frames.at(-1).time) { result[parameter] = frames.at(-1).value; continue; }
    const rightIndex = frames.findIndex((frame) => frame.time >= t), left = frames[rightIndex - 1], right = frames[rightIndex];
    const progress = easingValue((t - left.time) / (right.time - left.time), right.easing);
    result[parameter] = left.value + (right.value - left.value) * progress;
  }
  return { ...Object.fromEntries(Object.keys(clip.tracks || {}).filter((key) => !(key in result) && key in defaults).map((key) => [key, defaults[key]])), ...result };
}
