export function applyCurve(value, curve = 'linear') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  // Bindings contain their amplitude (for example `headX * 8`).  Values
  // outside the normalized curve domain must therefore not be clamped.
  if (curve === 'linear' || Math.abs(numeric) > 1) return numeric;
  const t = numeric;
  if (curve === 'easeInOut') {
    const s = (t + 1) / 2;
    const eased = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
    return eased * 2 - 1;
  }
  return numeric;
}
