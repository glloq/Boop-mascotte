import { compileRigFrame } from '../../../runtime/runtime.js';
import { morphPath } from '../morph/path-morph.js';

/** Compatibility wrapper. `frames` is the canonical final representation. */
export function compileFrame(elements = {}, params = {}, globalConstraints = {}, stateConstraints = {}) {
  const frames = compileRigFrame(elements, params, globalConstraints, stateConstraints);
  const transforms = {}, paths = {}, opacity = {};
  Object.entries(frames).forEach(([id, frame]) => {
    transforms[id] = frame.transform;
    opacity[id] = frame.opacity;
    if (frame.morph?.pathA && frame.morph?.pathB) {
      try { paths[id] = morphPath(frame.morph.pathA, frame.morph.pathB, frame.morph.progress); } catch { /* retain SVG path */ }
    }
  });
  return { frames, transforms, paths, opacity };
}
