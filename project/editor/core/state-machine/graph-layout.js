/**
 * Where a state machine is drawn (V4-100 … V4-106, docs/V4_ROADMAP.md Phase 10).
 *
 * The graph used to compute its own positions on every render: every state on
 * one horizontal line, every transition a bar in a lane above it
 * (`state-machine/transition-graph.js`, 43 lines). That is legible for four
 * states and unreadable for twelve, and — the part that mattered — there was
 * nothing an author could do about it, because nothing they moved was kept.
 *
 * So a position is **authored data**, in the `stateMachine` domain, undoable
 * like a transition and saved with the project. It is not a viewport: how far
 * somebody has scrolled is session state and stays there. It is a diagram, and
 * a diagram is part of the file in every tool that has one.
 *
 * It never reaches `rig.json`. The runtime runs a state machine; it does not
 * draw one.
 *
 * Everything here is pure, so the whole layout — ranks, boxes, link paths,
 * hit-testing, marquee — is testable without a DOM.
 */

/**
 * A node's box, in graph units. One constant, so the view and the maths agree.
 *
 * Small, because of where this is drawn: the state editor is a column in the
 * left sidebar, about 260 px wide, and a diagram that only fits at the zoom
 * floor is a diagram nobody reads. It is the column that is really wrong — a
 * graph wants the canvas — and until it moves, the geometry is what can be
 * made to fit (docs/V4_ROADMAP.md, Phase 10).
 */
export const GRAPH_NODE = Object.freeze({ width: 112, height: 48 });
/** What a dragged position snaps to. Small enough to feel free, big enough to line up. */
export const GRAPH_GRID = 8;
/** The space auto-layout leaves between ranks and between rows. */
export const GRAPH_GAP = Object.freeze({ rank: 64, row: 24 });
/** How far the view may be zoomed, either way. */
export const GRAPH_ZOOM = Object.freeze({ min: .2, max: 2.5, step: 1.15 });
/** A comment's box when it is first dropped. */
export const GRAPH_COMMENT = Object.freeze({ width: 180, height: 84 });

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
// `+ 0` turns -0 back into 0: a node dragged a few pixels left of where it
// started would otherwise store a value that prints as 0 and equals nothing.
const snap = (value) => Math.round(value / GRAPH_GRID) * GRAPH_GRID + 0;
const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The stored layout, believed only where it is readable.
 *
 * A position for a state that no longer exists is kept rather than dropped:
 * deleting a state is undoable, and a layout that forgets where it was puts the
 * node back in the corner on redo. `nodesFor` is what filters to the states
 * that are actually there, and it does it at read time.
 */
export function normalizeGraphLayout(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const nodes = {};
  for (const [name, point] of Object.entries(source.nodes && typeof source.nodes === 'object' ? source.nodes : {})) {
    if (!name || !point || typeof point !== 'object') continue;
    nodes[name] = { x: finite(point.x), y: finite(point.y) };
  }
  const groups = (Array.isArray(source.groups) ? source.groups : []).map((group, index) => {
    if (!group || typeof group !== 'object') return null;
    const members = [...new Set((Array.isArray(group.members) ? group.members : []).filter((item) => typeof item === 'string' && item))];
    if (!members.length) return null;
    return { id: clean(group.id) || `group-${index + 1}`, name: clean(group.name) || 'Group', members };
  }).filter(Boolean);
  const comments = (Array.isArray(source.comments) ? source.comments : []).map((comment, index) => {
    if (!comment || typeof comment !== 'object') return null;
    return {
      id: clean(comment.id) || `note-${index + 1}`,
      x: finite(comment.x), y: finite(comment.y),
      width: Math.max(80, finite(comment.width, GRAPH_COMMENT.width)),
      height: Math.max(48, finite(comment.height, GRAPH_COMMENT.height)),
      text: typeof comment.text === 'string' ? comment.text : ''
    };
  }).filter(Boolean);
  return { nodes, groups, comments };
}

/** Whether the layout holds anything at all, which is what decides a first auto-arrange. */
export const isEmptyLayout = (layout) => !Object.keys(layout?.nodes || {}).length && !(layout?.groups || []).length && !(layout?.comments || []).length;

/**
 * Rank every state by how far it is from where the mascot starts.
 *
 * A state machine has a beginning — `activeState` — so the graph has a reading
 * direction, and a layout that ignores it is a picture rather than a diagram.
 * Breadth-first from the initial state puts "what happens next" one column to
 * the right of "what is happening".
 *
 * Every state nothing leads to is a root as well, so a project holding two
 * separate machines is two readable blocks rather than one block and a pile.
 * What is left after that walk is a cycle with no way in — genuinely
 * unreachable — and it goes in a column past the end, because a part of a
 * machine that can never run is a fact worth seeing rather than one worth
 * hiding in the middle.
 */
export function rankStates(names, transitions = {}, initial = null) {
  const present = new Set(names);
  const rank = new Map();
  const roots = [initial, ...names.filter((name) => !names.some((from) => (transitions[from] || []).includes(name) && from !== name))]
    .filter((name) => present.has(name) && !rank.has(name));
  // Every component gets a root, so a graph made of two separate machines is
  // two readable blocks rather than one block and a pile.
  const queue = [...new Set(roots.length ? roots : names.slice(0, 1))];
  for (const name of queue) rank.set(name, 0);
  for (let head = 0; head < queue.length; head += 1) {
    const from = queue[head];
    for (const to of transitions[from] || []) {
      if (!present.has(to) || rank.has(to)) continue;
      rank.set(to, rank.get(from) + 1);
      queue.push(to);
    }
  }
  // Whatever the walk never reached: its own column past the end.
  const unreached = names.filter((name) => !rank.has(name));
  const last = rank.size ? Math.max(...rank.values()) + 1 : 0;
  unreached.forEach((name) => rank.set(name, last));
  return rank;
}

/**
 * A position for every state, laid out in ranks and centred per column.
 *
 * Deterministic on purpose: the same machine lays out the same way twice, so
 * pressing Arrange is a thing an author can undo and redo without the diagram
 * wandering.
 */
export function autoLayoutNodes(document = {}) {
  const names = Object.keys(document.states || {});
  const rank = rankStates(names, document.transitions || {}, document.activeState);
  const columns = new Map();
  for (const name of names) {
    const index = rank.get(name) ?? 0;
    if (!columns.has(index)) columns.set(index, []);
    columns.get(index).push(name);
  }
  const tallest = Math.max(1, ...[...columns.values()].map((column) => column.length));
  const rowStep = GRAPH_NODE.height + GRAPH_GAP.row;
  const nodes = {};
  for (const [index, column] of columns) {
    // Centred against the tallest column, so a two-node rank sits beside the
    // middle of a six-node one instead of at its top.
    const top = ((tallest - column.length) * rowStep) / 2;
    column.forEach((name, row) => {
      nodes[name] = { x: snap(index * (GRAPH_NODE.width + GRAPH_GAP.rank)), y: snap(top + row * rowStep) };
    });
  }
  return nodes;
}

/**
 * Where every state actually is: what was authored, and auto-layout for the
 * rest.
 *
 * A state added after the diagram was arranged has no position and must not
 * land on top of another one. It takes the auto-layout's answer, which is a
 * place chosen for it rather than the origin.
 */
export function nodesFor(document = {}, layout = null) {
  const stored = normalizeGraphLayout(layout ?? document.graphLayout).nodes;
  const names = Object.keys(document.states || {});
  const missing = names.filter((name) => !stored[name]);
  const fallback = missing.length ? autoLayoutNodes(document) : {};
  return Object.fromEntries(names.map((name) => [name, stored[name] || fallback[name] || { x: 0, y: 0 }]));
}

/** A node's box, for hit-testing and for drawing. */
export const nodeBox = (point) => ({ x: point.x, y: point.y, width: GRAPH_NODE.width, height: GRAPH_NODE.height });
const centre = (point) => ({ x: point.x + GRAPH_NODE.width / 2, y: point.y + GRAPH_NODE.height / 2 });

/**
 * The curve from one state to another, and the point its label sits on.
 *
 * Three shapes, because three things happen:
 *
 * - **A self-transition** is a loop over the node. A straight line from a box
 *   to itself has no length and cannot be clicked.
 * - **A pair** — `A→B` and `B→A` — is two curves bowed opposite ways. Drawn
 *   through the same points they are one line, and only one of them is ever
 *   clickable, which was true of the old lane renderer too.
 * - **Everything else** is a cubic with horizontal handles, so a link leaves a
 *   node sideways and arrives sideways whatever the vertical offset.
 *
 * The arrowhead is an SVG `marker-end` rather than a point computed here: a
 * marker with `orient="auto"` is aimed by the path's own end tangent, which is
 * the one thing about a Bézier that is easy to get wrong by hand.
 */
export function linkGeometry(from, to, { bow = 0 } = {}) {
  if (!from || !to) return null;
  const a = centre(from), b = centre(to);
  if (from === to || (a.x === b.x && a.y === b.y)) {
    const top = from.y, x = from.x + GRAPH_NODE.width / 2, lift = 46;
    return {
      kind: 'self',
      d: `M ${x - 18} ${top} C ${x - 26} ${top - lift} ${x + 26} ${top - lift} ${x + 18} ${top}`,
      label: { x, y: top - lift * .72 }
    };
  }
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  // Meet the boxes rather than their centres: an arrowhead inside a node reads
  // as an arrow pointing at nothing.
  const start = edgePoint(from, dx, dy), end = edgePoint(to, -dx, -dy);
  const normal = { x: -dy / length, y: dx / length };
  const offset = bow * 26;
  const handle = Math.max(40, Math.abs(end.x - start.x) * .5);
  const c1 = { x: start.x + handle, y: start.y + normal.y * offset };
  const c2 = { x: end.x - handle, y: end.y + normal.y * offset };
  const mid = {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8
  };
  return {
    kind: 'link',
    d: `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.x)} ${round(end.y)}`,
    label: { x: round(mid.x), y: round(mid.y) }
  };
}

const round = (value) => Math.round(value * 100) / 100;

/** Where a ray leaving a box's centre crosses its edge. */
function edgePoint(point, dx, dy) {
  const c = centre(point), hw = GRAPH_NODE.width / 2, hh = GRAPH_NODE.height / 2;
  if (!dx && !dy) return c;
  const scale = Math.min(Math.abs(dx) ? hw / Math.abs(dx) : Infinity, Math.abs(dy) ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

/**
 * Which way each half of a pair bows: −1, 0 or +1.
 *
 * `0` for a link with no opposite, so the ordinary case is a straight-looking
 * curve rather than one that leans for no reason.
 */
export function linkBows(transitions = {}) {
  const bows = new Map();
  for (const [from, targets] of Object.entries(transitions)) {
    for (const to of targets || []) {
      if (from === to) { bows.set(`${from}->${to}`, 0); continue; }
      const paired = (transitions[to] || []).includes(from);
      bows.set(`${from}->${to}`, paired ? (from < to ? 1 : -1) : 0);
    }
  }
  return bows;
}

/** Every box a group wraps, padded, or null when it holds nothing on screen. */
export function groupBox(group, nodes, padding = 20) {
  const boxes = group.members.map((name) => nodes[name]).filter(Boolean).map(nodeBox);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left - padding, y: top - padding - 16, width: right - left + padding * 2, height: bottom - top + padding * 2 + 16 };
}

/** What the whole diagram occupies, with room to breathe. */
export function graphBounds(nodes, comments = [], margin = 40) {
  const boxes = [...Object.values(nodes).map(nodeBox), ...comments];
  if (!boxes.length) return { x: 0, y: 0, width: 480, height: 280 };
  const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left - margin, y: top - margin, width: right - left + margin * 2, height: bottom - top + margin * 2 };
}

/** Every node a marquee touches. Touching, not containing: a lasso that needs to swallow a box whole is a lasso nobody hits. */
export function nodesInMarquee(nodes, marquee) {
  const left = Math.min(marquee.x, marquee.x + marquee.width), right = Math.max(marquee.x, marquee.x + marquee.width);
  const top = Math.min(marquee.y, marquee.y + marquee.height), bottom = Math.max(marquee.y, marquee.y + marquee.height);
  return Object.entries(nodes)
    .filter(([, point]) => point.x < right && point.x + GRAPH_NODE.width > left && point.y < bottom && point.y + GRAPH_NODE.height > top)
    .map(([name]) => name);
}

/** Move a set of nodes by a delta, snapped, leaving the rest alone. */
export function movedNodes(nodes, names, delta) {
  const moving = new Set(names);
  const next = { ...nodes };
  for (const name of moving) {
    if (!next[name]) continue;
    next[name] = { x: snap(next[name].x + delta.x), y: snap(next[name].y + delta.y) };
  }
  return next;
}

/** The zoom one step in or out, clamped where a diagram is still readable. */
export const zoomedBy = (scale, direction) => Math.min(GRAPH_ZOOM.max, Math.max(GRAPH_ZOOM.min,
  direction > 0 ? scale * GRAPH_ZOOM.step : scale / GRAPH_ZOOM.step));

/** The view that fits the whole diagram into a viewport of this size. */
export function fitView(bounds, viewport) {
  if (!viewport?.width || !viewport?.height) return { x: 0, y: 0, scale: 1 };
  const scale = Math.min(GRAPH_ZOOM.max, Math.max(GRAPH_ZOOM.min, Math.min(viewport.width / bounds.width, viewport.height / bounds.height)));
  return {
    scale,
    x: viewport.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: viewport.height / 2 - (bounds.y + bounds.height / 2) * scale
  };
}

/** A point on screen, in graph units. */
export const toGraph = (point, view) => ({ x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale });
