import { morphPath } from './path-morph.js';

export function applyMorphToElement(element, params, canvas, id) {
  const morph = element.morph;
  if (!morph?.enabled || !morph.pathA || !morph.pathB) return;
  const raw = Number(params[morph.param || 'mouthOpen'] ?? 0);
  const t = Math.max(0, Math.min(1, (raw - (morph.min ?? -1)) / ((morph.max ?? 1) - (morph.min ?? -1) || 1)));
  const d = morphPath(morph.pathA, morph.pathB, t);
  canvas.applyPathData(id, d);
}
