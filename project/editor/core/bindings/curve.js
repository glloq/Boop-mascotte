export function applyCurve(value, curve = 'linear') {
  const t = Math.max(-1, Math.min(1, value));
  if (curve === 'easeInOut') {
    const s = (t + 1) / 2;
    const eased = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
    return eased * 2 - 1;
  }
  return t;
}
