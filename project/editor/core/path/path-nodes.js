/**
 * Path nodes for direct editing (docs/VECTOR_EDITING.md).
 *
 * The Node tool in the canvas toolbar was a dead button: it switched the canvas
 * out of Select — which turns off dragging and the gizmo — and put nothing in
 * their place, so the canvas went inert and editing looked broken.
 *
 * This is the model behind it. A **node** is an on-curve anchor: the point a
 * command ends at, which is what a person means when they drag "a node".
 * Control points, arc radii and flags are not nodes and are left alone.
 *
 * Pure, and built on the runtime's own parser (`parsePath` / `serializePath`),
 * so path arithmetic is not duplicated anywhere and a malformed path reports
 * instead of producing rubbish.
 */
import { PATH_ARGUMENTS, canParsePath, parsePath, serializePath } from '../../../runtime/path-vector.js';

/** Commands whose last two arguments are the anchor point. */
const XY_TAIL = new Set(['m', 'l', 'c', 's', 'q', 't', 'a']);

/**
 * Every draggable anchor in a path, in order.
 *
 * @param {string} d
 * @returns {{index: number, command: string, x: number, y: number, relative: boolean}[]}
 *          `index` is the command's position, and the point is absolute in the
 *          element's own coordinates whatever the command's own convention.
 */
export function pathNodes(d) {
  if (!canParsePath(d)) return [];
  const { commands, values } = parsePath(d);
  const nodes = [];
  let cursor = 0, x = 0, y = 0, startX = 0, startY = 0;
  commands.forEach((command, index) => {
    const key = command.toLowerCase();
    const arity = PATH_ARGUMENTS[key] || 0;
    const relative = command !== command.toUpperCase();
    const argument = (offset) => values[cursor + offset];
    if (key === 'z') { x = startX; y = startY; }
    else if (key === 'h') { x = relative ? x + argument(0) : argument(0); }
    else if (key === 'v') { y = relative ? y + argument(0) : argument(0); }
    else if (XY_TAIL.has(key)) {
      const dx = argument(arity - 2), dy = argument(arity - 1);
      x = relative ? x + dx : dx;
      y = relative ? y + dy : dy;
    }
    if (key === 'm') { startX = x; startY = y; }
    if (key !== 'z') nodes.push({ index, command, x, y, relative });
    cursor += arity;
  });
  return nodes;
}

/**
 * Move one node to a new absolute point.
 *
 * A relative command's neighbour is compensated, so dragging one node moves
 * that node and nothing else — otherwise every following point in a relative
 * path would travel along with it, which is never what the author meant.
 *
 * `h` and `v` are promoted to `l` when dragged off their axis, because a
 * horizontal line cannot hold a vertical move and silently dropping half the
 * gesture is worse than changing the command.
 *
 * @param {string} d
 * @param {number} index the node's command index, from `pathNodes`
 * @param {{x: number, y: number}} point absolute, in the element's own space
 * @returns {string} the new `d`, or the original when nothing can be moved
 */
export function movePathNode(d, index, point) {
  const source = String(d ?? '');
  const node = pathNodes(source).find((item) => item.index === index);
  if (!node || !Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) return source;

  const dx = Number(point.x) - node.x;
  const dy = Number(point.y) - node.y;
  if (!dx && !dy) return source;

  const { commands, values } = parsePath(source);
  const list = [...commands];
  const next = Array.from(values);
  const key = node.command.toLowerCase();
  const absolute = node.command === node.command.toUpperCase();
  const at = offsetsOf(commands)[index];
  const arity = PATH_ARGUMENTS[key] || 0;

  if (key === 'h' || key === 'v') {
    // A horizontal line cannot hold a vertical move: promote it rather than
    // silently dropping half of the gesture.
    const nodes = pathNodes(source);
    const previous = nodes[nodes.findIndex((item) => item.index === index) - 1] || { x: 0, y: 0 };
    const target = { x: node.x + dx, y: node.y + dy };
    list[index] = absolute ? 'L' : 'l';
    next.splice(at, arity, ...(absolute ? [target.x, target.y] : [target.x - previous.x, target.y - previous.y]));
  } else if (XY_TAIL.has(key)) {
    next[at + arity - 2] += dx;
    next[at + arity - 1] += dy;
  } else return source;

  if (node.relative) {
    // Everything after a relative command is chained to it, so pull the next
    // relative command back by the same amount: one node moves, not the tail.
    const offsets = offsetsOf(list);
    const following = list.findIndex((command, position) =>
      position > index && command !== command.toUpperCase() && PATH_ARGUMENTS[command.toLowerCase()]);
    if (following > -1) {
      const base = offsets[following];
      const followKey = list[following].toLowerCase();
      const followArity = PATH_ARGUMENTS[followKey];
      if (followKey === 'h') next[base] -= dx;
      else if (followKey === 'v') next[base] -= dy;
      else if (XY_TAIL.has(followKey)) { next[base + followArity - 2] -= dx; next[base + followArity - 1] -= dy; }
    }
  }
  return serializePath(list, next);
}

/** Where each command's arguments start in the value vector. */
function offsetsOf(commands) {
  const offsets = [];
  let cursor = 0;
  for (const command of commands) { offsets.push(cursor); cursor += PATH_ARGUMENTS[command.toLowerCase()] || 0; }
  return offsets;
}
