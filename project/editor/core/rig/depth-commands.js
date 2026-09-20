/**
 * Depth and parallax, as commands (docs/DEPTH_PARALLAX.md).
 *
 * There is no Z axis and no camera: every element carries a scalar `depth`, the
 * head pose nudges it sideways by a fraction of that, and crossing a band
 * reorders the drawing. The runtime has done all of this since 3D-03.
 *
 * What it has never had is an author. `element.depth` is set by the face
 * library on the two pieces that ship with one — the glasses and the hat — and
 * by the hand rig, and by nothing else: no screen in the editor could give a
 * piece a depth, read the one it has, or turn the parallax off. §12 of the
 * redesign brief lists *Depth* as one of Rig ▸ Deform's capabilities, and this
 * is the half of it that writes.
 */
import { clampDepth, normalizeParallax } from '../../../runtime/runtime.js';

export function createDepthCommands(store, history) {
  const run = (type, domains, apply) => { history?.snapshot(); return store.execute({ type, source: 'depth', domains, apply }); };
  return {
    /**
     * How far in front of or behind the face a piece sits, from −1 to 1.
     *
     * `artwork` because the element record changed, `hierarchy` because that is
     * the domain the draw order and the parallax are drawn from.
     */
    setElementDepth(id, depth) {
      const element = store.getDocument().elements?.[id];
      if (!element) return { ok: false, message: `No piece called “${id}”.` };
      const next = clampDepth(Number(depth) || 0);
      if (clampDepth(Number(element.depth) || 0) === next) return { ok: true };
      run('depth/element', ['artwork', 'hierarchy'], (document) => { document.elements[id].depth = next; });
      return { ok: true };
    },
    /** Back to flat: the piece keeps its place in the markup and stops drifting. */
    clearElementDepth(id) { return this.setElementDepth(id, 0); },
    /**
     * The settings the nudge is made of: whether it runs at all, how far it
     * goes, and whether crossing a band is allowed to reorder the drawing.
     */
    setParallax(patch = {}) {
      const current = store.getDocument().parallax || {};
      const next = normalizeParallax({ ...current, ...patch });
      if (JSON.stringify(next) === JSON.stringify(normalizeParallax(current))) return { ok: true };
      run('depth/parallax', ['hierarchy'], (document) => { document.parallax = next; });
      return { ok: true };
    }
  };
}
