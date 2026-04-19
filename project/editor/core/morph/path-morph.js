// Phase 2-ready helper: interpolate two normalized SVG path strings.
// Assumes identical command layout and numeric arity.
export function morphPath(pathA, pathB, t) {
  const p = Math.max(0, Math.min(1, t));
  const tokensA = tokenize(pathA);
  const tokensB = tokenize(pathB);
  if (tokensA.length !== tokensB.length) {
    throw new Error('Cannot morph paths with different token lengths.');
  }
  return tokensA.map((token, i) => {
    const b = tokensB[i];
    if (typeof token === 'number' && typeof b === 'number') {
      return token + (b - token) * p;
    }
    if (token !== b) {
      throw new Error('Cannot morph paths with different command structure.');
    }
    return token;
  }).join(' ').replace(/\s+,\s+/g, ',');
}

function tokenize(path) {
  return path
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .map((chunk) => {
      const n = Number(chunk);
      return Number.isNaN(n) ? chunk : n;
    });
}
