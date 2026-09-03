/**
 * Light transform hierarchy (docs/DEFORMER_MODEL.md).
 *
 * ```text
 * root
 *  └─ body
 *       ├─ head
 *       │   ├─ eyes
 *       │   ├─ eyebrows
 *       │   └─ mouth
 *       ├─ leftHandAnchor
 *       │     └─ leftHand
 *       └─ rightHandAnchor
 *             └─ rightHand
 * ```
 *
 * A deformer is a named transform with a parent — no bones, no weights, no
 * bind poses. It exists so a head can carry its features and an anchor can
 * carry a hand, independently of how the SVG happens to be nested.
 *
 * The order is fixed and is the point of the whole module:
 *
 * ```text
 * rest / local deformation → local transform → parent transform → world
 * ```
 *
 * Local deformation never happens after the world transform.
 */
import { finite } from './numeric.js';
import { transformToMatrix, multiplyMatrix, IDENTITY_MATRIX } from './transform-2d.js';

export function normalizeDeformer(source = {}) {
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    name: typeof source?.name === 'string' && source.name ? source.name : (source?.id || ''),
    parent: typeof source?.parent === 'string' && source.parent ? source.parent : null,
    pivot: { x: finite(source?.pivot?.x, 0), y: finite(source?.pivot?.y, 0) },
    x: finite(source?.x, 0),
    y: finite(source?.y, 0),
    rotation: finite(source?.rotation, 0),
    scaleX: finite(source?.scaleX, 1),
    scaleY: finite(source?.scaleY, 1),
    /** Parameter bindings, evaluated like any other binding. */
    bindings: source?.bindings && typeof source.bindings === 'object' ? { ...source.bindings } : {}
  };
}

export function normalizeDeformers(rig = {}) {
  if (!Array.isArray(rig?.deformers)) return [];
  const seen = new Set();
  return rig.deformers
    .filter((item) => item && typeof item === 'object')
    .map(normalizeDeformer)
    .filter((item) => item.id && !seen.has(item.id) && seen.add(item.id));
}

/**
 * Deformers whose parent chain closes a loop, or points at nothing.
 *
 * A cycle is reported, never followed: an evaluator that walked one would hang
 * the render loop.
 */
export function deformerIssues(deformers = []) {
  const byId = new Map(deformers.map((item) => [item.id, item]));
  const cycles = [];
  const missing = [];
  for (const deformer of deformers) {
    if (deformer.parent && !byId.has(deformer.parent)) missing.push(deformer.id);
    const seen = new Set([deformer.id]);
    let current = deformer.parent;
    while (current) {
      if (seen.has(current)) { cycles.push(deformer.id); break; }
      seen.add(current);
      current = byId.get(current)?.parent || null;
    }
  }
  return { cycles, missing };
}

/**
 * Resolve every deformer to a world matrix, parents before children.
 *
 * A deformer in a cycle resolves to its own local matrix rather than being
 * dropped: a broken hierarchy should look wrong, not make artwork disappear.
 */
export function compileDeformerMatrices(deformers = [], values = {}, evaluateBinding = null) {
  const byId = new Map(deformers.map((item) => [item.id, item]));
  const { cycles } = deformerIssues(deformers);
  const broken = new Set(cycles);
  const world = new Map();

  const local = (deformer) => {
    const channel = (name, fallback) => {
      const binding = deformer.bindings?.[name];
      if (!binding || !evaluateBinding) return fallback;
      return finite(evaluateBinding(binding, values, name), fallback);
    };
    return transformToMatrix({
      x: deformer.x + channel('translateX', 0),
      y: deformer.y + channel('translateY', 0),
      rotation: deformer.rotation + channel('rotation', 0),
      scaleX: deformer.scaleX * channel('scaleX', 1),
      scaleY: deformer.scaleY * channel('scaleY', 1),
      pivotX: deformer.pivot.x,
      pivotY: deformer.pivot.y
    });
  };

  const resolve = (deformer, guard = new Set()) => {
    if (world.has(deformer.id)) return world.get(deformer.id);
    const own = local(deformer);
    const parent = deformer.parent && !broken.has(deformer.id) && !guard.has(deformer.id) ? byId.get(deformer.parent) : null;
    guard.add(deformer.id);
    const matrix = parent ? multiplyMatrix(resolve(parent, guard), own) : own;
    world.set(deformer.id, matrix);
    return matrix;
  };

  for (const deformer of deformers) resolve(deformer);
  return world;
}

/** The world matrix an element inherits, or identity when it has no deformer. */
export function deformerMatrixFor(matrices, elementId, elements = {}) {
  const id = elements?.[elementId]?.deformer;
  return (id && matrices.get(id)) || IDENTITY_MATRIX;
}
