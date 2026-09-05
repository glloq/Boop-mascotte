/**
 * The bezier handles of a path node (docs/VECTOR_EDITING.md).
 *
 * `path-nodes.js` knows the anchors — where a command ends — and the Node tool
 * could only drag those. A curve is shaped by the control points on either
 * side of an anchor, and these are them: which value slots hold the handle
 * arriving at a node and the one leaving it, how to move one (mirroring the
 * other when the node is smooth), and how to turn a straight node into a
 * curved one and back. The last two change the path's topology, so they come
 * out as a `PathEdit` with the linear map every shape key follows through
 * (`path-edit.js`); the rest are plain value edits.
 *
 * Absolute commands only, like every other topology edit here: a relative
 * command's control points are sums of everything before them.
 */
import { PATH_ARGUMENTS, canParsePath, parsePath, serializePath } from '../../../runtime/path-vector.js';
import { pathNodes } from './path-nodes.js';
import { pathOffsets, remapValues } from './path-edit.js';

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const isAbsolute = (command) => command === command.toUpperCase();

/**
 * Every node with the handles it has.
 *
 * `in` is the last control point of the segment arriving at the node — for a
 * `C` its second control, for a `Q` its only one, for an `S` its explicit one.
 * `out` is the first control of the segment leaving it — a `C`'s first
 * control or a `Q`'s. A shorthand (`S`, `T`) leaving a node has no editable
 * out-handle: it is the reflection of the handle before it by definition.
 *
 * @returns {{ index: number, x: number, y: number, command: string,
 *            in: {x: number, y: number, slots: [number, number]}|null,
 *            out: {x: number, y: number, slots: [number, number]}|null,
 *            smooth: boolean }[]}
 */
export function pathControls(d) {
  if (!canParsePath(d)) return [];
  const { commands, values } = parsePath(d);
  const offsets = pathOffsets(commands);
  const nodes = pathNodes(d);
  const at = (slot) => number(values[slot]);
  const control = (slot) => ({ x: at(slot), y: at(slot + 1), slots: [slot, slot + 1] });
  return nodes.map((node) => {
    const command = commands[node.index], key = command.toLowerCase(), offset = offsets[node.index];
    const absolute = isAbsolute(command);
    let incoming = null, outgoing = null;
    if (absolute && key === 'c') incoming = control(offset + 2);
    else if (absolute && key === 'q') incoming = control(offset);
    else if (absolute && key === 's') incoming = control(offset);
    const next = commands[node.index + 1], nextKey = next?.toLowerCase(), nextOffset = offsets[node.index + 1];
    if (next && isAbsolute(next) && nextKey === 'c') outgoing = control(nextOffset);
    else if (next && isAbsolute(next) && nextKey === 'q') outgoing = control(nextOffset);
    const smooth = Boolean(incoming && outgoing) && collinear(node, incoming, outgoing);
    return { index: node.index, x: node.x, y: node.y, command, in: incoming, out: outgoing, smooth };
  });
}

/** Whether two handles are opposite each other through the anchor. */
function collinear(anchor, a, b, tolerance = 0.5) {
  const ax = a.x - anchor.x, ay = a.y - anchor.y, bx = b.x - anchor.x, by = b.y - anchor.y;
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  if (!la || !lb) return false;
  // Unit vectors pointing away from the anchor should be opposite.
  return Math.hypot(ax / la + bx / lb, ay / la + by / lb) < tolerance;
}

/**
 * Move one handle of a node.
 *
 * @param {string} d
 * @param {number} index      the node's command index
 * @param {'in'|'out'} side
 * @param {{x: number, y: number}} point
 * @param {{ mirror?: 'symmetric'|'angle'|false }} [options]
 *        `symmetric` puts the other handle exactly opposite at the same length,
 *        `angle` keeps the other handle's own length on the opposite line, and
 *        `false` leaves it alone (a corner).
 * @returns {string} the new `d`, or the original when nothing could move
 */
export function movePathControl(d, index, side, point, { mirror = false } = {}) {
  const source = String(d ?? '');
  const node = pathControls(source).find((item) => item.index === index);
  const handle = node?.[side];
  if (!node || !handle) return source;
  const x = number(point?.x), y = number(point?.y);
  const { commands, values } = parsePath(source);
  const next = Array.from(values);
  next[handle.slots[0]] = x; next[handle.slots[1]] = y;
  const other = node[side === 'in' ? 'out' : 'in'];
  if (mirror && other) {
    const dx = node.x - x, dy = node.y - y;
    const length = Math.hypot(dx, dy);
    if (mirror === 'symmetric' || !length) { next[other.slots[0]] = node.x + dx; next[other.slots[1]] = node.y + dy; }
    else {
      const keep = Math.hypot(other.x - node.x, other.y - node.y);
      next[other.slots[0]] = node.x + (dx / length) * keep; next[other.slots[1]] = node.y + (dy / length) * keep;
    }
  }
  return serializePath(commands, next);
}

/**
 * Make a node smooth without changing its handles' lengths: the out-handle is
 * put on the line of the in-handle (or the reverse when only one exists).
 * A node with no handles at all is left for `convertNode`.
 */
export function smoothNode(d, index) {
  const node = pathControls(d).find((item) => item.index === index);
  if (!node || (!node.in && !node.out)) return String(d ?? '');
  if (node.in && node.out) return movePathControl(d, index, 'in', node.in, { mirror: 'angle' });
  return String(d ?? '');
}

const passThrough = (size) => Array.from({ length: size }, (_, slot) => [[slot, 1]]);
const refuse = (reason, message) => ({ ok: false, reason, message });

/**
 * Turn the segments meeting at a node into curves (`'curve'`) or into
 * straight lines (`'straight'`).
 *
 * Both change the value vector, so both come out as a `PathEdit`: a straight
 * segment becomes a cubic whose controls sit a third of the way along it
 * (which draws exactly the same line, so nothing moves until a handle is
 * dragged), and a cubic or quadratic becomes the line between its ends.
 *
 * @param {string} d
 * @param {number} index
 * @param {'curve'|'straight'} kind
 */
export function convertNode(d, index, kind) {
  if (!canParsePath(d)) return refuse('unparsable', 'This path cannot be read.');
  const parsed = parsePath(d);
  const { commands, values } = parsed;
  if (!commands[index]) return refuse('not-a-node', 'There is no node there.');
  const offsets = pathOffsets(commands);
  const anchors = anchorSlotsOf(commands, offsets);
  const size = values.length;
  const list = [...commands];
  const terms = passThrough(size).map((term) => [term]);
  // Segments arriving at and leaving the node, each converted on its own.
  const targets = [index, index + 1].filter((position) => commands[position]);
  let changed = false;
  for (const position of targets) {
    const command = commands[position], key = command.toLowerCase();
    if (!isAbsolute(command)) return refuse('relative', 'This part of the path is written in relative commands, which cannot be converted exactly yet.');
    const from = anchors[position - 1], to = anchors[position];
    if (!from || !to || from.x === null || to.x === null) continue;
    const at = offsets[position], arity = PATH_ARGUMENTS[key] || 0;
    if (kind === 'curve' && key === 'l') {
      list[position] = 'C';
      const blend = (k) => [[[from.x, 1 - k], [to.x, k]], [[from.y, 1 - k], [to.y, k]]];
      terms[position] = { replace: [...blend(1 / 3), ...blend(2 / 3), [[at, 1]], [[at + 1, 1]]], at, arity };
      changed = true;
    } else if (kind === 'straight' && (key === 'c' || key === 'q' || key === 's')) {
      list[position] = 'L';
      terms[position] = { replace: [[[at + arity - 2, 1]], [[at + arity - 1, 1]]], at, arity };
      changed = true;
    }
  }
  if (!changed) return refuse('nothing', kind === 'curve' ? 'These segments are already curves.' : 'These segments are already straight.');
  // Rebuild the term list command by command, so the slots line up.
  const flat = [];
  commands.forEach((command, position) => {
    const at = offsets[position], arity = PATH_ARGUMENTS[command.toLowerCase()] || 0;
    const conversion = terms[position]?.replace ? terms[position] : null;
    if (conversion) flat.push(...conversion.replace);
    else for (let slot = at; slot < at + arity; slot += 1) flat.push([[slot, 1]]);
  });
  const edit = { commands: list, from: size, to: flat.length, terms: flat, d: '' };
  edit.d = serializePath(list, remapValues(edit, values));
  return edit;
}

/** Where each anchor's x and y live in the value vector, absolute commands only. */
function anchorSlotsOf(commands, offsets) {
  const slots = [];
  let x = null, y = null, startX = null, startY = null;
  commands.forEach((command, position) => {
    const key = command.toLowerCase();
    const at = offsets[position], arity = PATH_ARGUMENTS[key] || 0;
    if (!isAbsolute(command)) { slots.push(null); x = null; y = null; return; }
    if (key === 'z') { x = startX; y = startY; }
    else if (key === 'h') x = at;
    else if (key === 'v') y = at;
    else if (['m', 'l', 'c', 's', 'q', 't', 'a'].includes(key)) { x = at + arity - 2; y = at + arity - 1; }
    if (key === 'm') { startX = x; startY = y; }
    slots.push({ x, y });
  });
  return slots;
}
