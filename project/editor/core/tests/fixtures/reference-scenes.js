/**
 * The scene shapes V4 has to stay fast in, as rigs rather than as timings.
 *
 * The raster program changes what a mascot is made of (docs/V4_ROADMAP.md):
 * where a vector mascot is a hundred paths that deform, a raster one is a
 * pile of `<image>` nodes that only ever move, plus a handful of meshes that
 * do deform. Those are different costs, and a single "is the mascot fast?"
 * number hides which of them moved.
 *
 * So there are three scenes, and the budgets are counted per scene:
 *
 * - `manyRigidNodes` — the raster mascot: many nodes, transforms only, no
 *   deformation at all. What Phase 2 must not make slow.
 * - `fewDeformingNodes` — the mesh mascot: a handful of nodes whose shape is
 *   rebuilt every frame. What Phase 7 must not make slow.
 * - the frozen `template-face` project — today's vector mascot, the thing
 *   that must not regress while the other two are being built.
 *
 * The counts are the ones the roadmap names: a lot of simple images, few
 * active meshes.
 */
import { shapeDeltaFromPaths } from '../../shape-keys/shape-key-model.js';

export const RIGID_NODES = 200;
export const DEFORMING_NODES = 8;

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });

const REST = 'M0 0 L20 0 L20 10 L0 10 Z';
const OPEN = 'M0 -2 L20 -2 L20 16 L0 16 Z';

/**
 * A mascot made of pieces that only move: what a rigid raster scene compiles
 * to, whether the artwork behind each node is a path or a picture. Every node
 * answers the head, because a node that answers nothing costs nothing and
 * would flatter the measurement.
 */
export function manyRigidNodes(count = RIGID_NODES) {
  const elements = {};
  for (let index = 0; index < count; index += 1) {
    elements[`node${index}`] = {
      baseTransform: transform({ x: (index % 20) * 12, y: Math.floor(index / 20) * 12 }),
      baseOpacity: 1,
      depth: ((index % 11) - 5) / 10,
      bindings: {
        translateX: { expression: 'headX', amplitude: 6 },
        translateY: { expression: 'headY', amplitude: 4 },
        rotation: { expression: 'headTilt', amplitude: 3 }
      }
    };
  }
  return { elements, shapeKeys: [], keyforms: [], warps: [], deformers: [], parallax: { enabled: true, strength: 1 } };
}

/** A few pieces whose shape is rebuilt every frame: the mesh scene's cost. */
export function fewDeformingNodes(count = DEFORMING_NODES) {
  const elements = {}, shapeKeys = [];
  for (let index = 0; index < count; index += 1) {
    const id = `mesh${index}`;
    elements[id] = { baseTransform: transform({ x: index * 24 }), baseOpacity: 1, restPath: REST };
    shapeKeys.push({ id: `${id}-open`, target: id, name: 'Open', driver: { mode: 'range', parameter: 'mouthOpen', min: 0, max: 1 }, delta: shapeDeltaFromPaths(REST, OPEN) });
  }
  return { elements, shapeKeys, keyforms: [], warps: [], deformers: [], parallax: null };
}

/** The values a scene is driven with, as a frame's worth of movement. */
export const sceneParams = (phase = 0) => ({
  headX: Math.sin(phase / 20), headY: Math.cos(phase / 17), headTilt: Math.sin(phase / 13),
  mouthOpen: (phase % 7) / 7, eyeOpen: 1
});

export const sceneOptions = (scene) => ({ keyforms: scene.keyforms, shapeKeys: scene.shapeKeys, warps: scene.warps, deformers: scene.deformers, parallax: scene.parallax });
