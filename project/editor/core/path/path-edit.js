/**
 * Adding and removing path nodes (docs/VECTOR_EDITING.md).
 *
 * Moving a node reshapes what is drawn. **Adding** one changes the path's
 * topology — its value vector gets longer — and that is what makes it hard:
 * a shape key is a per-point delta measured against `element.restPath`
 * (docs/SHAPE_KEYS.md), so a path with one more point no longer matches the
 * deltas that deform it, and every mouth pose is dropped as a topology
 * mismatch.
 *
 * The way out is that **every one of these edits is a linear map on the value
 * vector**: splitting a curve is de Casteljau, which is weighted sums of the
 * control points; merging two segments and elevating a `Q` to a `C` likewise.
 * So an edit reports its map alongside the new path, and the same map carries
 * the rest outline, every shape-key delta and every stored morph through it.
 * Linear is exactly the property that makes that sound:
 *
 *     remap(rest + delta) === remap(rest) + remap(delta)
 *
 * Pure, and built on the runtime's own `parsePath` / `serializePath`, so no
 * path arithmetic is duplicated.
 */
import { PATH_ARGUMENTS, canParsePath, parsePath, serializePath } from '../../../runtime/path-vector.js';
import { pathNodes } from './path-nodes.js';

/**
 * @typedef {object} PathEdit
 * @property {string} d          the new path
 * @property {string[]} commands its commands
 * @property {number} from       how many values the old path had
 * @property {number} to         how many the new one has
 * @property {[number, number][][]} terms  one entry per new value: the
 *   `[slot, weight]` pairs of old values that make it. Empty means a zero.
 */

const XY_TAIL = new Set(['m', 'l', 'c', 's', 'q', 't', 'a']);
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Where each command's arguments start in the value vector. */
export function pathOffsets(commands) {
  const offsets = [];
  let cursor = 0;
  for (const command of commands) { offsets.push(cursor); cursor += PATH_ARGUMENTS[command.toLowerCase()] || 0; }
  return offsets;
}

/** Carry a vector laid out like the old path through an edit. */
export function remapValues(edit, values) {
  const source = Array.from(values || []);
  return edit.terms.map((term) => term.reduce((total, [slot, weight]) => total + weight * number(source[slot]), 0));
}

/** The identity map for a path that keeps its shape: every value passes through. */
const passThrough = (size) => Array.from({ length: size }, (_, slot) => [[slot, 1]]);

/**
 * Where each anchor's x and y live in the value vector.
 *
 * Only absolute commands have their anchor *in* one slot; a relative one is a
 * sum of everything before it, and a topology edit that had to unroll that sum
 * would be neither readable nor exact enough to trust with an author's mouth.
 * So the split and the merge below work on absolute paths and say so.
 */
function anchorSlots(commands, offsets) {
  const slots = [];
  let x = null, y = null, startX = null, startY = null;
  commands.forEach((command, index) => {
    const key = command.toLowerCase();
    const at = offsets[index];
    const arity = PATH_ARGUMENTS[key] || 0;
    if (command !== command.toUpperCase()) { slots.push(null); return; }
    if (key === 'z') { x = startX; y = startY; }
    else if (key === 'h') x = at;
    else if (key === 'v') y = at;
    else if (XY_TAIL.has(key)) { x = at + arity - 2; y = at + arity - 1; }
    if (key === 'm') { startX = x; startY = y; }
    slots.push({ x, y });
  });
  return slots;
}

/** A weighted sum of slots, as terms. Slots may repeat; zero weights are dropped. */
const mix = (...pairs) => pairs.filter(([slot, weight]) => slot !== null && slot !== undefined && weight !== 0);

/**
 * The segments a path draws, each with the node it ends at.
 *
 * A `Z` is a segment too — the line back to where the subpath started — which
 * is where an author most often wants another point on a closed shape.
 */
export function pathSegments(d) {
  if (!canParsePath(d)) return [];
  const { commands } = parsePath(d);
  const nodes = pathNodes(d);
  const at = (index) => nodes.find((node) => node.index === index) || null;
  const segments = [];
  let start = null, previous = null;
  commands.forEach((command, index) => {
    const key = command.toLowerCase();
    const node = at(index);
    if (key === 'm') { start = node; previous = node; return; }
    if (key === 'z') {
      if (previous && start) segments.push({ index, command, kind: 'close', from: { x: previous.x, y: previous.y }, to: { x: start.x, y: start.y } });
      previous = start;
      return;
    }
    if (!node || !previous) { previous = node || previous; return; }
    const kind = key === 'c' || key === 's' ? 'cubic' : key === 'q' || key === 't' ? 'quad' : key === 'a' ? 'arc' : 'line';
    segments.push({ index, command, kind, from: { x: previous.x, y: previous.y }, to: { x: node.x, y: node.y } });
    previous = node;
  });
  return segments;
}

/**
 * The point on the outline nearest a pointer, and which segment it is on.
 *
 * Sampled and then bisected rather than solved: a closed-form nearest point on
 * a cubic is a quintic, and this is a double-click target, not a fillet.
 */
export function nearestPathPoint(d, point, { samples = 24, refine = 6 } = {}) {
  const segments = pathSegments(d);
  if (!segments.length) return null;
  const parsed = parsePath(d);
  const offsets = pathOffsets(parsed.commands);
  const target = { x: number(point?.x), y: number(point?.y) };
  let best = null;
  for (const segment of segments) {
    const curve = segmentCurve(segment, parsed, offsets);
    if (!curve) continue;
    const distance = (t) => { const at = curve(t); return (at.x - target.x) ** 2 + (at.y - target.y) ** 2; };
    let bestT = 0, bestDistance = Infinity;
    for (let step = 0; step <= samples; step += 1) {
      const t = step / samples, value = distance(t);
      if (value < bestDistance) { bestDistance = value; bestT = t; }
    }
    let span = 1 / samples;
    for (let round = 0; round < refine; round += 1) {
      span /= 2;
      for (const t of [bestT - span, bestT + span]) {
        if (t <= 0 || t >= 1) continue;
        const value = distance(t);
        if (value < bestDistance) { bestDistance = value; bestT = t; }
      }
    }
    if (!best || bestDistance < best.squared) {
      const at = curve(bestT);
      best = { index: segment.index, t: bestT, x: at.x, y: at.y, squared: bestDistance, kind: segment.kind };
    }
  }
  return best ? { ...best, distance: Math.sqrt(best.squared) } : null;
}

/** A segment as a function of t, for measuring. Absolute or relative: it reads the nodes. */
function segmentCurve(segment, parsed, offsets) {
  const { commands, values } = parsed;
  const key = segment.command.toLowerCase();
  const at = offsets[segment.index];
  const relative = segment.command !== segment.command.toUpperCase();
  const point = (ox, oy) => (relative
    ? { x: segment.from.x + number(values[at + ox]), y: segment.from.y + number(values[at + oy]) }
    : { x: number(values[at + ox]), y: number(values[at + oy]) });
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  if (key === 'c') {
    const c1 = point(0, 1), c2 = point(2, 3);
    return (t) => {
      const a1 = lerp(segment.from, c1, t), a2 = lerp(c1, c2, t), a3 = lerp(c2, segment.to, t);
      return lerp(lerp(a1, a2, t), lerp(a2, a3, t), t);
    };
  }
  if (key === 'q') {
    const control = point(0, 1);
    return (t) => lerp(lerp(segment.from, control, t), lerp(control, segment.to, t), t);
  }
  // Lines, closes, and anything whose curvature this does not model: the chord
  // is close enough to pick a segment with, and exact for the ones that matter.
  void commands;
  return (t) => lerp(segment.from, segment.to, t);
}

const refuse = (reason, message) => ({ ok: false, reason, message });

/**
 * Split a segment in two without changing the drawn shape.
 *
 * @param {string} d
 * @param {number} index the command that draws the segment (from `pathSegments`)
 * @param {number} t     where along it, 0…1
 * @returns {PathEdit | {ok: false, reason: string, message: string}}
 */
export function insertPathNode(d, index, t = 0.5) {
  if (!canParsePath(d)) return refuse('unparsable', 'This path cannot be read.');
  const parsed = parsePath(d);
  const { commands, values } = parsed;
  const command = commands[index];
  if (!command) return refuse('not-a-segment', 'There is no segment there.');
  const key = command.toLowerCase();
  if (key === 'a') return refuse('arc', 'This is an arc. Add the point on another segment.');
  if (key === 'm') return refuse('not-a-segment', 'That is where the outline starts, not a segment.');
  if (command !== command.toUpperCase()) return refuse('relative', 'This part of the path is written in relative commands, which cannot be split exactly yet.');
  const split = Math.min(0.98, Math.max(0.02, number(t)));

  const offsets = pathOffsets(commands);
  const anchors = anchorSlots(commands, offsets);
  const previous = anchors[index - 1];
  if (!previous || previous.x === null) return refuse('relative', 'This segment starts from a relative command, which cannot be split exactly yet.');
  const at = offsets[index];
  const size = values.length;

  // Every new value is a weighted sum of old ones: that is what keeps the
  // deltas that deform this path valid across the edit.
  const P0 = { x: [[previous.x, 1]], y: [[previous.y, 1]] };
  const blend = (a, b, k) => a.map(([slot, weight]) => [slot, weight * (1 - k)]).concat(b.map(([slot, weight]) => [slot, weight * k]));
  const slot = (offset) => [[at + offset, 1]];

  let list, terms;
  const head = passThrough(size).slice(0, at);
  const tail = passThrough(size).slice(at + (PATH_ARGUMENTS[key] || 0));

  if (key === 'l' || key === 'z' || key === 'h' || key === 'v') {
    // A `Z` keeps its place: the new point goes on the closing line, before it.
    const end = key === 'z'
      ? { x: [[anchors[index].x, 1]], y: [[anchors[index].y, 1]] }
      : key === 'h' ? { x: slot(0), y: P0.y }
        : key === 'v' ? { x: P0.x, y: slot(0) }
          : { x: slot(0), y: slot(1) };
    const middle = { x: blend(P0.x, end.x, split), y: blend(P0.y, end.y, split) };
    if (key === 'z') {
      list = [...commands.slice(0, index), 'L', ...commands.slice(index)];
      terms = [...passThrough(size).slice(0, at), middle.x, middle.y, ...passThrough(size).slice(at)];
    } else if (key === 'h' || key === 'v') {
      list = [...commands.slice(0, index), command, command, ...commands.slice(index + 1)];
      const half = key === 'h' ? middle.x : middle.y;
      terms = [...head, half, ...slot(0), ...tail];
    } else {
      list = [...commands.slice(0, index), 'L', 'L', ...commands.slice(index + 1)];
      terms = [...head, middle.x, middle.y, ...slot(0), ...slot(1), ...tail];
    }
  } else if (key === 'c' || key === 'q') {
    const control = key === 'c'
      ? [{ x: slot(0), y: slot(1) }, { x: slot(2), y: slot(3) }]
      : [{ x: slot(0), y: slot(1) }];
    const end = key === 'c' ? { x: slot(4), y: slot(5) } : { x: slot(2), y: slot(3) };
    const points = key === 'c' ? [P0, control[0], control[1], end] : [P0, control[0], end];
    // de Casteljau, on terms instead of numbers.
    const step = (level) => level.slice(0, -1).map((point, position) => ({
      x: blend(point.x, level[position + 1].x, split), y: blend(point.y, level[position + 1].y, split)
    }));
    const first = step(points), second = step(first), third = second.length > 1 ? step(second) : second;
    const middle = third[0];
    if (key === 'c') {
      list = [...commands.slice(0, index), 'C', 'C', ...commands.slice(index + 1)];
      terms = [...head,
        first[0].x, first[0].y, second[0].x, second[0].y, middle.x, middle.y,
        second[1].x, second[1].y, first[2].x, first[2].y, end.x, end.y, ...tail];
    } else {
      list = [...commands.slice(0, index), 'Q', 'Q', ...commands.slice(index + 1)];
      terms = [...head, first[0].x, first[0].y, middle.x, middle.y, first[1].x, first[1].y, end.x, end.y, ...tail];
    }
  } else if (key === 's' || key === 't') {
    return refuse('shorthand', 'This is a shorthand curve. Move one of its points first, then add here.');
  } else return refuse('not-a-segment', 'There is nothing to split there.');

  return finish(list, terms.map((term) => (Array.isArray(term[0]) ? term : [term])), values, size);
}

/**
 * Remove a node, merging the two segments that met at it.
 *
 * Unlike adding one, this **does** change the drawn shape — there is no way to
 * keep it and have one fewer point.
 */
export function deletePathNode(d, index) {
  if (!canParsePath(d)) return refuse('unparsable', 'This path cannot be read.');
  const parsed = parsePath(d);
  const { commands, values } = parsed;
  const command = commands[index];
  if (!command) return refuse('not-a-node', 'There is no node there.');
  const key = command.toLowerCase();
  if (key === 'm') return refuse('subpath-start', 'That is where the outline starts. Delete the whole shape instead.');
  if (key === 'z') return refuse('not-a-node', 'That closes the outline rather than being a point on it.');
  if (command !== command.toUpperCase()) return refuse('relative', 'This part of the path is written in relative commands, which cannot be merged exactly yet.');
  const nodes = pathNodes(d);
  if (nodes.length <= 3) return refuse('last-node', 'A shape needs at least three points.');

  const offsets = pathOffsets(commands);
  const at = offsets[index];
  const arity = PATH_ARGUMENTS[key] || 0;
  const size = values.length;
  const following = commands[index + 1];
  const followKey = following?.toLowerCase();
  // The next segment now starts where the previous one did. A straight
  // neighbour simply loses its start; a curve keeps its own arriving handle.
  if (following && following !== following.toUpperCase()) return refuse('relative', 'The next command is relative, which cannot be merged exactly yet.');
  if (followKey === 'a' || key === 'a') return refuse('arc', 'Arcs cannot be merged yet.');
  if (followKey === 's' || followKey === 't') return refuse('shorthand', 'The next curve is a shorthand. Move one of its points first.');

  const list = [...commands.slice(0, index), ...commands.slice(index + 1)];
  const terms = [...passThrough(size).slice(0, at), ...passThrough(size).slice(at + arity)];
  return finish(list, terms, values, size);
}

/** Build the edit, and check the map really does reproduce the path it claims. */
function finish(list, terms, values, size) {
  const edit = { commands: list, from: size, to: terms.length, terms, d: '' };
  edit.d = serializePath(list, remapValues(edit, values));
  return edit;
}

/** Whether an edit changed the shape of the value vector at all. */
export const isTopologyEdit = (edit) => Boolean(edit) && edit.ok !== false && edit.from !== edit.to;
