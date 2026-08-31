export function normalizeBehaviors(rig = {}) {
  if (Array.isArray(rig.behaviors)) return rig.behaviors.map(normalizeBehavior);
  const legacy = rig.runtimeConfig || {}, result = [];
  if (legacy.blink) result.push(normalizeBehavior({ type: 'blink', parameter: 'eyeOpen' }));
  if (Number(legacy.idleMotion) > 0) result.push(normalizeBehavior({ type: 'oscillator', name: 'Idle sway', parameter: 'headY', amplitude: legacy.idleMotion, frequency: 0.3 }));
  return result;
}
export function normalizeBehavior(source = {}) {
  const type = source.type === 'blink' || source.type === 'randomIdle' ? source.type : 'oscillator';
  return { id: source.id || `${type}-${Math.random().toString(36).slice(2, 8)}`, type, name: source.name || ({ blink: 'Blink', randomIdle: 'Random idle', oscillator: 'Oscillator' }[type]), enabled: source.enabled !== false,
    parameter: source.parameter || (type === 'blink' ? 'eyeOpen' : 'headY'), amplitude: finite(source.amplitude, .05), offset: finite(source.offset, 0), frequency: Math.max(0, finite(source.frequency ?? source.speed, .3)), waveform: 'sine',
    intervalMin: Math.max(0, finite(source.intervalMin, 2)), intervalMax: Math.max(0, finite(source.intervalMax, 6)), duration: Math.max(.01, finite(source.duration, .12)), closedValue: finite(source.closedValue, 0), min: finite(source.min, -.2), max: finite(source.max, .2) };
}
export function composeBehaviorParams(base, behaviors, time, runtime = {}) {
  const result = { ...base };
  for (const behavior of behaviors || []) {
    if (!behavior.enabled || !(behavior.parameter in result)) continue;
    if (behavior.type === 'oscillator') result[behavior.parameter] += behavior.offset + Math.sin(time * Math.PI * 2 * behavior.frequency) * behavior.amplitude;
    if (behavior.type === 'blink' && runtime.blinkActive) result[behavior.parameter] = behavior.closedValue;
    if (behavior.type === 'randomIdle' && Number.isFinite(runtime.randomValue)) result[behavior.parameter] += runtime.randomValue;
  }
  return result;
}
function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
