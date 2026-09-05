/**
 * Draw order from depth (3D-03, docs/DEPTH_PARALLAX.md).
 *
 * An element's `depth` used to buy it a parallax offset and nothing else: a
 * part authored at `-0.8` slid the right way and still painted on top of the
 * face, because SVG has no z-index and nothing ever moved a node. Occlusion is
 * one of the strongest volume cues there is, and it was the one the rig
 * described but never drew.
 *
 * So: the paint order follows the depth **band** — `behind`, `normal`,
 * `front` — which `depthBand()` already computes with hysteresis, so a depth
 * hovering on a boundary cannot swap order every frame.
 *
 * ## What makes this safe
 *
 * Reordering SVG nodes is not free: a node carries its position in a clip, a
 * mask, a nested group's transform, and a paint order the artist chose. So the
 * rule is narrow, and it is the whole of the design:
 *
 * > **Reorder only among an element's own siblings, never across parents.**
 *
 * Within one parent, transform inheritance is identical for every child by
 * definition, no clip is entered or left, and no group is opened. What changes
 * is paint order and nothing else — exactly and only what occlusion needs.
 *
 * Three consequences, all of them enforced below:
 *
 * * **unmanaged siblings never move.** A scope permutes the rig's own elements
 *   through the *positions they already occupy*; a decoration, a `<title>` or
 *   an artist's spacer drawn between two of them stays exactly where it is;
 * * **order within a band is the artwork's own order.** Bands are coarse, so
 *   inside one the artist's stacking is the answer: this is a stable partition
 *   into three, never a sort;
 * * **the DOM is touched only when a band changes.** Which, with hysteresis,
 *   is rare — and never once per frame.
 *
 * Scopes inside `<defs>`, a `<clipPath>`, a `<mask>`, a `<pattern>`, a
 * `<marker>` or a `<symbol>` are skipped outright. Order means something else
 * in there (or nothing at all), and it is not worth being clever about.
 *
 * Pure of the rig: this knows about nodes and bands, not about parameters.
 */
import { DEPTH_BANDS } from './depth.js';

/** Where paint order is not what it looks like. */
const OPAQUE_PARENTS = new Set(['defs', 'clippath', 'mask', 'pattern', 'marker', 'symbol']);

const localName = (node) => String(node?.localName || node?.tagName || '').toLowerCase();

/**
 * Elements only. Whitespace between two shapes is not a drawing decision, and
 * dragging text nodes around with the shapes would rewrite the markup for
 * nothing.
 */
const elementChildren = (parent) => Array.from(parent?.children || parent?.childNodes || []);
const after = (node) => (node?.nextElementSibling !== undefined ? node.nextElementSibling : node?.nextSibling || null);

/** True when a node hangs under something that does not paint in document order. */
function inOpaqueParent(node) {
  for (let walk = node?.parentNode; walk; walk = walk.parentNode) {
    if (OPAQUE_PARENTS.has(localName(walk))) return true;
  }
  return false;
}

/**
 * The scopes a rig can reorder, resolved once.
 *
 * @param {Map<string, any>} nodes id → DOM node, as the engine already holds them
 * @param {Iterable<string>} ids the rig's own element ids
 * @returns {{scopes: number, apply: (bands: Record<string, string>) => number}}
 *   `apply` returns how many scopes it actually rewrote, which is 0 on almost
 *   every frame and is what the tests assert against.
 */
export function createDrawOrder(nodes, ids) {
  const byParent = new Map();
  for (const id of ids || []) {
    const node = nodes?.get?.(id);
    // A rig element with no artwork, or artwork inside a definition block.
    if (!node?.parentNode || typeof node.parentNode.insertBefore !== 'function') continue;
    if (inOpaqueParent(node)) continue;
    if (!byParent.has(node.parentNode)) byParent.set(node.parentNode, []);
    byParent.get(node.parentNode).push({ id, node });
  }

  const scopes = [];
  for (const [parent, members] of byParent) {
    // One element in a parent has nothing to be reordered against.
    if (members.length < 2) continue;
    // Document order, not the order the rig happens to list them in: "within a
    // band, the artwork's own order" is only the artwork's order if it is read
    // off the artwork.
    const kids = elementChildren(parent);
    const home = members.slice().sort((a, b) => kids.indexOf(a.node) - kids.indexOf(b.node));
    scopes.push({ parent, members: home, last: new Array(home.length).fill(null) });
  }

  /** Reposition `ordered` into the slots the same nodes already occupy. */
  const place = (scope, ordered) => {
    const parent = scope.parent;
    const kids = elementChildren(parent);
    const slots = [];
    for (let index = 0; index < kids.length; index += 1) {
      if (scope.members.some((member) => member.node === kids[index])) slots.push(index);
    }
    const next = kids.slice();
    slots.forEach((slot, rank) => { next[slot] = ordered[rank]; });
    // Backwards, so each node is placed against a sibling that is already
    // final, and a node already in the right place costs no DOM write at all.
    let anchor = null;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      const node = next[index];
      if (after(node) !== anchor) parent.insertBefore(node, anchor);
      anchor = node;
    }
  };

  return {
    scopes: scopes.length,
    apply(bands = {}) {
      let rewritten = 0;
      for (const scope of scopes) {
        let changed = false;
        for (let index = 0; index < scope.members.length; index += 1) {
          const band = bands[scope.members[index].id] || 'normal';
          if (scope.last[index] !== band) { scope.last[index] = band; changed = true; }
        }
        if (!changed) continue;
        // A stable partition into three, in the artwork's own order inside each.
        const ordered = [];
        for (const band of DEPTH_BANDS) {
          for (let index = 0; index < scope.members.length; index += 1) {
            if (scope.last[index] === band) ordered.push(scope.members[index].node);
          }
        }
        place(scope, ordered);
        rewritten += 1;
      }
      return rewritten;
    }
  };
}
