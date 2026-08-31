export function easeValue(t, easing) {
  const value = Number.isFinite(Number(t)) ? Math.max(0, Math.min(1, Number(t))) : 0;
  if (easing === 'easeInOut') return value < 0.5 ? 2 * value * value : 1 - ((-2 * value + 2) ** 2) / 2;
  return value;
}

export function interpolateParams(fromParams = {}, toParams = {}, progress, easing = 'linear') {
  const eased = easeValue(progress, easing);
  const keys = new Set([...Object.keys(fromParams || {}), ...Object.keys(toParams || {})]);
  const next = {};
  keys.forEach((key) => {
    const rawFrom = Number(fromParams?.[key] ?? 0);
    const from = Number.isFinite(rawFrom) ? rawFrom : 0;
    const rawTo = Number(toParams?.[key] ?? from);
    const to = Number.isFinite(rawTo) ? rawTo : from;
    next[key] = from + (to - from) * eased;
  });
  return next;
}
