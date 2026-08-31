export function easeValue(t, easing) {
  if (easing === 'easeInOut') {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }
  return t;
}

export function interpolateParams(fromParams, toParams, progress, easing = 'linear') {
  const clamped = Math.max(0, Math.min(1, progress));
  const eased = easeValue(clamped, easing);
  const keys = new Set([...Object.keys(fromParams || {}), ...Object.keys(toParams || {})]);
  const next = {};
  keys.forEach((key) => {
    const from = Number(fromParams?.[key] ?? 0);
    const to = Number(toParams?.[key] ?? from);
    next[key] = from + (to - from) * eased;
  });
  return next;
}
