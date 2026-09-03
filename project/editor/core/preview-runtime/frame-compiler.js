import { compileRigFrame } from '../../../runtime/runtime.js';
import { morphPath } from '../morph/path-morph.js';

/** Compatibility wrapper. `frames` is the canonical final representation. */
export function compileFrame(elements = {}, params = {}, globalConstraints = {}, stateConstraints = {}, options = {}) {
  const frames = compileRigFrame(elements, params, globalConstraints, stateConstraints, options);
  const transforms = {}, paths = {}, opacity = {}, matrices = {};
  Object.entries(frames).forEach(([id, frame]) => {
    transforms[id] = frame.transform;
    if (frame.matrix) matrices[id] = frame.matrix;
    opacity[id] = frame.opacity;
    // Shape keys own the shape when present; legacy A/B morph still applies otherwise.
    if (frame.path) paths[id] = frame.path;
    else if (frame.morph?.pathA && frame.morph?.pathB) {
      try { paths[id] = morphPath(frame.morph.pathA, frame.morph.pathB, frame.morph.progress); } catch { /* retain SVG path */ }
    }
  });
  return { frames, transforms, paths, opacity, matrices };
}
