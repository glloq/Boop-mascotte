/**
 * The paint order on the authoring canvas (docs/DEPTH_PARALLAX.md, 3D-03).
 *
 * The exported runtime repaints a piece by its depth band -- hair behind the
 * head, a hand behind the body, the far thumb behind the palm -- and the canvas
 * used to leave every piece where the author drew it, so a depth previewed one
 * way shipped another. The canvas DOM is also the document the editor reads
 * back (`documentModel.load()`, `serialize()`, `getTree()`), which is why a
 * preview-time reorder could never simply be left in place: it would have been
 * written into `svgMarkup` as the author's layer order.
 *
 * So the order is *borrowed*. `draw(bands)` puts the runtime's own paint order
 * on the nodes -- the same `createDrawOrder`, so the two cannot disagree -- and
 * `authored(fn)` puts the artwork's order back for as long as `fn` reads or
 * edits the document, then borrows it again. Nothing the document sees is ever
 * reordered, and a rig with `parallax.drawOrder: false` is never touched.
 *
 * ```text
 * frame  ──draw(bands)──▶  canvas in paint order
 * read   ──authored(fn)──▶ artwork order │ fn │ paint order again
 * ```
 */
import { createDrawOrder } from '../../../runtime/draw-order.js';
import { normalizeParallax } from '../../../runtime/depth.js';

/**
 * @param {{ nodes: () => Map<string, any>, ids: () => string[], parallax: () => object }} source
 *   `nodes` maps every id to its live node, `ids` lists the rig's elements and
 *   `parallax` is the rig's parallax block, each read when the scopes are
 *   resolved so the artwork can change under them.
 */
export function createPreviewOrder({ nodes, ids, parallax = () => ({}) }) {
  let order = null, last = null, reading = 0;
  const on = () => { const config = normalizeParallax(parallax()); return config.enabled && config.drawOrder; };
  const forget = () => { order?.restore(); order = null; };
  const borrow = (bands) => { order ||= createDrawOrder(nodes(), ids()); return order.apply(bands); };
  return {
    /**
     * Paint by `bands` (id → behind | normal | front), as the runtime would.
     * @returns {number} scopes rewritten -- 0 on almost every frame
     */
    draw(bands = {}) {
      if (!on()) { last = null; forget(); return 0; }
      last = bands;
      // The document is being read or edited: it gets the order back once that is done.
      return reading ? 0 : borrow(bands);
    },
    /** Run `fn` against the artwork's own order; the paint order comes back after. */
    authored(fn) {
      reading += 1;
      if (reading === 1) forget();
      try { return fn(); } finally {
        reading -= 1;
        if (!reading && last && on()) borrow(last);
      }
    },
    /** The artwork was rebuilt: the scopes are stale, and nothing needs putting back. */
    reset() { order = null; },
    /** Whether the canvas is showing a borrowed order right now. */
    borrowed: () => Boolean(order)
  };
}
