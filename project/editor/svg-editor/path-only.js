import { SHAPE_GEOMETRY_ATTRIBUTES } from '../core/path/path-build.js';

/**
 * Why a piece cannot do the thing only a path can, said so the author knows
 * what to do next.
 *
 * Everything that reshapes artwork -- a pin, a warp, a shape key, the Node
 * tool -- works on a path's points. The editor already declined the rest
 * correctly; what it did not do is distinguish between *not a path yet* and
 * *never going to be one*. A rectangle can become a path and the message said
 * how. A picture cannot, and the message said how anyway, which sends its
 * author to a menu item that will tell them no.
 */
export const CONVERTIBLE_SHAPES = Object.freeze(Object.keys(SHAPE_GEOMETRY_ATTRIBUTES));
export const canBecomeAPath = (kind) => CONVERTIBLE_SHAPES.includes(String(kind || '').toLowerCase());

/**
 * @param {string} id the piece the author clicked
 * @param {string} kind its element name — `image`, `rect`, `text`, `g`…
 * @param {string} holds what wanted a path, in words: "a pin holds a path"
 */
export function pathOnlyMessage(id, kind, holds = 'a pin holds a path') {
  const name = String(kind || 'this piece').toLowerCase();
  if (canBecomeAPath(name)) return `${id} is not a path, and ${holds}. Click a path, or convert this shape to one first (Artwork → Inspector → Shape).`;
  if (name === 'image') return `${id} is a picture, and ${holds}. A picture has no outline to hold: move, turn and scale it instead, or use a path drawn over it.`;
  return `${id} is not a path, and ${holds}. Click a path instead — this piece has no outline to hold.`;
}
