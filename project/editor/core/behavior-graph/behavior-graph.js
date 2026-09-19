/**
 * The Behavior board: one diagram for everything the workspace answers for
 * (docs/BEHAVIOR_STUDIO.md).
 *
 * The state machine was already a diagram, with authored positions, pan, zoom,
 * groups and notes — and it was the only one. The reactions were a list, the
 * automatic behaviours were cards, and the three surfaces that answer the same
 * question ("when does the mascot do things?") shared nothing at all.
 *
 * So the graph becomes the workspace, and every other thing in it becomes a
 * node:
 *
 * ```text
 *   when:click ──fires──▶ do:wave ╌╌guard╌╌▶ idle ──transition──▶ talk
 *                                            ▲                     │
 *                                            └─────────────────────┘
 *   auto:blink        (ambient — it runs under all of it)
 * ```
 *
 * Pure, like `graph-layout.js` beside it: every position, box and path here is
 * a function of the document and the lens, so the whole layout is testable in
 * Node and the view is left with the pointer work.
 *
 * ## What is *not* re-decided here
 *
 * A state's box is still `GRAPH_NODE`, its auto-layout is still
 * `autoLayoutNodes`, and its stored position is still the bare state name in
 * `graphLayout.nodes`. Triggers, reactions and behaviours take **prefixed**
 * keys in the same map and lay out at negative x — to the left of the state
 * block — so no state moves and every diagram authored before this release
 * opens exactly where it was left.
 */
import { GRAPH_GAP, GRAPH_NODE, autoLayoutNodes, linkBows, normalizeGraphLayout } from '../state-machine/graph-layout.js';
import { triggerLabel } from '../reactions/reaction-model.js';

/** A box per kind. The state keeps the geometry the state graph already had. */
export const BOARD_NODE = Object.freeze({
  state: GRAPH_NODE,
  trigger: Object.freeze({ width: 132, height: 46 }),
  reaction: Object.freeze({ width: 156, height: 56 }),
  automatic: Object.freeze({ width: 148, height: 52 })
});

/**
 * How a node of each kind is keyed in `graphLayout.nodes`.
 *
 * A state is keyed by its own name and nothing else, because that is what
 * every project written before this release holds. The three new kinds are
 * prefixed, so nothing can collide with a state called `wave`.
 */
export const NODE_PREFIX = Object.freeze({ trigger: 'when:', reaction: 'do:', automatic: 'auto:' });

/** The lenses the board can be looked at through. `all` is the whole workspace. */
export const BOARD_LENSES = Object.freeze([
  Object.freeze({ id: 'all', label: 'All', hint: 'Everything that decides when the mascot moves' }),
  Object.freeze({ id: 'reactions', label: 'Reactions', hint: 'What the page makes it do' }),
  Object.freeze({ id: 'automatic', label: 'Automatic', hint: 'What it does when it is left alone' }),
  Object.freeze({ id: 'states', label: 'States', hint: 'The poses it holds and the moves between them' })
]);

/** The lens a Behavior screen opens on, so a route and a chip say the same thing. */
export const LENS_FOR_MODE = Object.freeze({
  'behavior.reactions': 'reactions', 'behavior.automatic': 'automatic', 'behavior.stateMachine': 'states'
});

export const normalizeLens = (value) => (BOARD_LENSES.some((entry) => entry.id === value) ? value : 'all');

/** Which kinds a lens draws. Edges follow their ends: an edge is drawn when both are. */
const LENS_KINDS = Object.freeze({
  all: Object.freeze(['trigger', 'reaction', 'state', 'automatic']),
  reactions: Object.freeze(['trigger', 'reaction', 'state']),
  automatic: Object.freeze(['automatic']),
  states: Object.freeze(['state'])
});

export const boardNodeId = (kind, key) => (kind === 'state' ? String(key) : `${NODE_PREFIX[kind] || ''}${key}`);

/**
 * One trigger node per *signature*, not per reaction.
 *
 * Three reactions on a click are one thing that happens and three things done
 * about it, and a diagram that draws three identical "Clicked" boxes is
 * telling the author the opposite.
 */
export function triggerSignature(trigger = {}) {
  const type = typeof trigger === 'string' ? trigger : trigger?.type || 'click';
  if (type === 'timer') return `timer:${Number(trigger.interval) || 5}`;
  if (type === 'idle') return `idle:${Number(trigger.after) || 8}`;
  if (type === 'custom') return `custom:${trigger.name || 'custom'}`;
  if (type === 'unsupported') return `unsupported:${trigger.of || ''}`;
  return type;
}

/** What a behaviour's card says under its name: the movement it moves, and how. */
const AUTOMATIC_DETAIL = {
  blink: (item) => `every ${item.intervalMin}–${item.intervalMax} s`,
  randomIdle: (item) => `every ${item.intervalMin}–${item.intervalMax} s`,
  oscillator: (item) => `${item.frequency} Hz · ±${item.amplitude}`,
  drift: (item) => `±${item.amplitude} · ${item.travelMin}–${item.travelMax} s`
};

/** What a reaction's node says under its name. The list's own sentence, shortened. */
function reactionDetail(reaction, document) {
  const parts = [];
  if (reaction.expression) parts.push((document.expressions || []).find((item) => item.id === reaction.expression.id)?.name || reaction.expression.id);
  if (reaction.motion) parts.push((document.animationClips || []).find((item) => item.id === reaction.motion.clipId)?.name || reaction.motion.clipId);
  for (const gesture of reaction.gestures || []) parts.push(`${gesture.side} hand`);
  return parts.length ? parts.join(' + ') : 'does nothing yet';
}

/**
 * Every node the board could draw, before a lens is applied.
 *
 * Each carries the **key it is stored under** and the box it wants, so the
 * layout below is one pass over one list whatever the kinds are.
 */
export function boardNodes(document = {}) {
  const nodes = [];
  for (const name of Object.keys(document.states || {})) {
    const outgoing = (document.transitions?.[name] || []).length;
    const incoming = Object.values(document.transitions || {}).filter((targets) => (targets || []).includes(name)).length;
    nodes.push({
      id: name, kind: 'state', key: name, name,
      detail: `${incoming} in · ${outgoing} out`,
      initial: name === document.activeState, incoming, outgoing
    });
  }
  const triggers = new Map();
  for (const reaction of document.reactions || []) {
    if (!reaction?.id) continue;
    const signature = triggerSignature(reaction.trigger);
    if (!triggers.has(signature)) {
      triggers.set(signature, {
        id: boardNodeId('trigger', signature), kind: 'trigger', key: signature,
        name: triggerLabel(reaction.trigger), detail: '', fires: []
      });
    }
    triggers.get(signature).fires.push(reaction.id);
  }
  for (const trigger of triggers.values()) {
    trigger.detail = `${trigger.fires.length} reaction${trigger.fires.length === 1 ? '' : 's'}`;
    nodes.push(trigger);
  }
  for (const reaction of document.reactions || []) {
    if (!reaction?.id) continue;
    nodes.push({
      id: boardNodeId('reaction', reaction.id), kind: 'reaction', key: reaction.id,
      name: reaction.name || reaction.id, detail: reactionDetail(reaction, document),
      enabled: reaction.enabled !== false, after: reaction.after || 'return'
    });
  }
  for (const behavior of document.behaviors || []) {
    if (!behavior?.id) continue;
    nodes.push({
      id: boardNodeId('automatic', behavior.id), kind: 'automatic', key: behavior.id,
      name: behavior.name || behavior.id,
      detail: `${behavior.parameter} · ${(AUTOMATIC_DETAIL[behavior.type] || (() => behavior.type))(behavior)}`,
      enabled: behavior.enabled !== false, type: behavior.type
    });
  }
  return nodes;
}

/** Every edge the board could draw, as ends and a kind. Geometry comes later. */
export function boardEdges(document = {}) {
  const edges = [];
  for (const [from, targets] of Object.entries(document.transitions || {})) {
    for (const to of targets || []) {
      const key = `${from}->${to}`;
      const settings = document.transitionSettings?.[key] || {};
      edges.push({
        key, kind: 'transition', from, to, transition: key,
        duration: settings.duration ?? 300, easing: settings.easing || 'easeInOut',
        text: `${settings.duration ?? 300} ms`
      });
    }
  }
  for (const reaction of document.reactions || []) {
    if (!reaction?.id) continue;
    const target = boardNodeId('reaction', reaction.id);
    edges.push({
      key: `fires:${reaction.id}`, kind: 'fires',
      from: boardNodeId('trigger', triggerSignature(reaction.trigger)), to: target, text: ''
    });
    // A condition on a state is the one thing a reaction says about the state
    // machine, so it is the one thing worth a line between the two halves.
    for (const [index, condition] of (reaction.conditions || []).entries()) {
      if (condition?.kind !== 'state' || !condition.state) continue;
      edges.push({
        key: `guard:${reaction.id}:${index}`, kind: 'guard', from: target, to: condition.state,
        text: condition.operator === '!=' ? 'unless' : 'only if'
      });
    }
  }
  return edges;
}

/**
 * The grid every laid-out position lands on, so a dragged node still lines up
 * with the ones nobody has touched. `autoLayoutNodes` snaps the states; these
 * three kinds have to snap to the same grid or a board would be almost aligned
 * for ever after.
 */
const GRID = 8;
const snap = (value) => Math.round(value / GRID) * GRID + 0;


/**
 * How many nodes of one kind stack before a second column is started.
 *
 * The template ships twenty-one reactions. In one column that is a
 * twenty-one-node stack, and the zoom that fits it is 33 % — a board where
 * every label is four pixels tall. Eight is what fits beside a state block
 * without the board becoming taller than it is wide.
 */
const LANE_ROWS = 8;

/**
 * Where a node goes when nobody has dragged it.
 *
 * States keep `autoLayoutNodes` exactly — same coordinates, same determinism —
 * and the other three kinds are laid out around that block:
 *
 * ```text
 *   triggers   reactions      states…          (x grows to the right)
 *   ◀── negative x ──▶ │ 0
 *                      │
 *                      automatic, under it all
 * ```
 *
 * Reactions are ordered by the trigger that fires them, so a trigger's fan-out
 * lands on neighbours rather than on eight rows spread down the board.
 */
export function autoLayoutBoard(document = {}, nodes = boardNodes(document)) {
  const states = autoLayoutNodes(document);
  const placed = {};
  for (const [name, point] of Object.entries(states)) placed[name] = point;

  const top = Math.min(0, ...Object.values(states).map((point) => point.y));
  const bottom = Math.max(0, ...Object.values(states).map((point) => point.y + GRAPH_NODE.height));

  const triggers = nodes.filter((node) => node.kind === 'trigger');
  const reactions = nodes.filter((node) => node.kind === 'reaction');
  const ambient = nodes.filter((node) => node.kind === 'automatic');

  const gap = GRAPH_GAP.rank;
  const columns = (count) => Math.max(1, Math.ceil(count / LANE_ROWS));
  const reactionColumns = columns(reactions.length);
  const reactionLeft = -gap - BOARD_NODE.reaction.width - (reactionColumns - 1) * (BOARD_NODE.reaction.width + gap);

  /** One band of nodes, filling top to bottom and then rightmost column first. */
  const band = (items, size, rightEdge) => items.forEach((node, index) => {
    const column = Math.floor(index / LANE_ROWS), row = index % LANE_ROWS;
    placed[node.id] = {
      x: snap(rightEdge - size.width - column * (size.width + gap)),
      y: snap(top + row * (size.height + GRAPH_GAP.row))
    };
  });

  // By trigger, so what one event sets off reads as one group.
  const order = new Map(triggers.map((trigger, index) => [trigger.id, index]));
  const byTrigger = [...reactions].sort((a, b) =>
    (order.get(boardNodeId('trigger', triggerSignature(reactionOf(document, a.key)?.trigger))) ?? 0)
    - (order.get(boardNodeId('trigger', triggerSignature(reactionOf(document, b.key)?.trigger))) ?? 0));

  band(byTrigger, BOARD_NODE.reaction, -gap);
  band(triggers, BOARD_NODE.trigger, reactionLeft - gap);
  ambient.forEach((node, index) => {
    const column = index % LANE_ROWS, row = Math.floor(index / LANE_ROWS);
    placed[node.id] = {
      x: snap(column * (BOARD_NODE.automatic.width + GRAPH_GAP.row)),
      y: snap(bottom + gap + row * (BOARD_NODE.automatic.height + GRAPH_GAP.row))
    };
  });
  return placed;
}

const reactionOf = (document, id) => (document?.reactions || []).find((item) => item.id === id) || null;

/** Where every node actually is: what was authored, and the layout for the rest. */
export function boardPositions(document = {}, layout = null, nodes = boardNodes(document)) {
  const stored = normalizeGraphLayout(layout ?? document.graphLayout).nodes;
  const missing = nodes.some((node) => !stored[node.id]);
  const fallback = missing ? autoLayoutBoard(document, nodes) : {};
  return Object.fromEntries(nodes.map((node) => [node.id, stored[node.id] || fallback[node.id] || { x: 0, y: 0 }]));
}

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const round = (value) => Math.round(value * 100) / 100;

/** Where a ray leaving a box's centre crosses its edge. */
function edgePoint(box, dx, dy) {
  const middle = centre(box), hw = box.width / 2, hh = box.height / 2;
  if (!dx && !dy) return middle;
  const scale = Math.min(Math.abs(dx) ? hw / Math.abs(dx) : Infinity, Math.abs(dy) ? hh / Math.abs(dy) : Infinity);
  return { x: middle.x + dx * scale, y: middle.y + dy * scale };
}

/**
 * The curve between two boxes and the point its label sits on.
 *
 * `linkGeometry` in `graph-layout.js` does this for two state-sized boxes; the
 * board has four sizes, so the box is an argument rather than a constant. The
 * three shapes are the same three, for the same three reasons: a self-link has
 * no length as a straight line, a pair drawn through the same points is one
 * line, and everything else leaves and arrives sideways.
 */
export function edgeGeometry(from, to, { bow = 0 } = {}) {
  if (!from || !to) return null;
  const a = centre(from), b = centre(to);
  if (from === to || (a.x === b.x && a.y === b.y)) {
    const lift = 46, x = from.x + from.width / 2;
    return { shape: 'self', d: `M ${x - 18} ${from.y} C ${x - 26} ${from.y - lift} ${x + 26} ${from.y - lift} ${x + 18} ${from.y}`, label: { x, y: round(from.y - lift * .72) } };
  }
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
  const start = edgePoint(from, dx, dy), end = edgePoint(to, -dx, -dy);
  const offset = bow * 26, normal = { x: -dy / length, y: dx / length };
  const handle = Math.max(40, Math.abs(end.x - start.x) * .5);
  const c1 = { x: start.x + handle, y: start.y + normal.y * offset };
  const c2 = { x: end.x - handle, y: end.y + normal.y * offset };
  return {
    // `shape`, never `kind`: an edge already has a kind — transition, fires,
    // guard — and a geometry that called its own answer `kind` would overwrite
    // it on the way into the model, which is how every transition on the board
    // once came out drawn as an unclickable "link".
    shape: 'link',
    d: `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.x)} ${round(end.y)}`,
    label: {
      x: round((start.x + 3 * c1.x + 3 * c2.x + end.x) / 8),
      y: round((start.y + 3 * c1.y + 3 * c2.y + end.y) / 8)
    }
  };
}

/** What the whole board occupies, with room to breathe. */
export function boardBounds(nodes, comments = [], margin = 36) {
  const boxes = [...nodes.map((node) => node.box), ...comments];
  if (!boxes.length) return { x: 0, y: 0, width: 640, height: 360 };
  const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left - margin, y: top - margin, width: right - left + margin * 2, height: bottom - top + margin * 2 };
}

/** Every node a marquee touches. Touching, not containing, as on the state graph. */
export function nodesInBox(nodes, marquee) {
  const left = Math.min(marquee.x, marquee.x + marquee.width), right = Math.max(marquee.x, marquee.x + marquee.width);
  const top = Math.min(marquee.y, marquee.y + marquee.height), bottom = Math.max(marquee.y, marquee.y + marquee.height);
  return nodes.filter((node) => node.box.x < right && node.box.x + node.box.width > left && node.box.y < bottom && node.box.y + node.box.height > top)
    .map((node) => node.id);
}

/**
 * Everything the board draws, derived once.
 *
 * Exported because it *is* the layout decision: a test that has to read it out
 * of an HTML string is a test about string formatting.
 *
 * @param {object} document
 * @param {{lens?: string, selection?: string[], edges?: string[], layout?: object}} view
 */
export function deriveBoard(document = {}, { lens = 'all', selection = [], edges: chosenEdges = [], layout = null } = {}) {
  const shown = new Set(LENS_KINDS[normalizeLens(lens)]);
  const stored = normalizeGraphLayout(layout ?? document.graphLayout);
  const all = boardNodes(document);
  const positions = boardPositions(document, stored, all);
  const pickedNodes = new Set(selection), pickedEdges = new Set(chosenEdges);

  const nodes = all.filter((node) => shown.has(node.kind)).map((node) => {
    const size = BOARD_NODE[node.kind], point = positions[node.id] || { x: 0, y: 0 };
    return { ...node, box: { x: point.x, y: point.y, width: size.width, height: size.height }, selected: pickedNodes.has(node.id) };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const bows = linkBows(document.transitions || {});
  const edges = boardEdges(document).flatMap((edge) => {
    const from = byId.get(edge.from), to = byId.get(edge.to);
    if (!from || !to) return [];
    const geometry = edgeGeometry(from.box, to.box, { bow: edge.kind === 'transition' ? (bows.get(edge.key) || 0) : 0 });
    return geometry ? [{ ...edge, ...geometry, selected: pickedEdges.has(edge.key) }] : [];
  });

  // What a focused selection keeps lit: the picked nodes and everything one
  // edge away from them. A twelve-state machine is unreadable without it.
  const near = new Set(pickedNodes);
  for (const edge of edges) {
    if (pickedEdges.has(edge.key)) { near.add(edge.from); near.add(edge.to); }
    if (pickedNodes.has(edge.from)) near.add(edge.to);
    if (pickedNodes.has(edge.to)) near.add(edge.from);
  }
  const focused = Boolean(pickedNodes.size || pickedEdges.size);
  for (const node of nodes) node.dim = focused && !near.has(node.id);
  for (const edge of edges) edge.dim = focused && !(pickedEdges.has(edge.key) || pickedNodes.has(edge.from) || pickedNodes.has(edge.to));

  const groups = stored.groups
    .map((group) => ({ ...group, box: groupBoxOf(group, byId) }))
    .filter((group) => group.box);

  return {
    lens: normalizeLens(lens), nodes, edges, groups, comments: stored.comments,
    bounds: boardBounds(nodes, stored.comments),
    counts: Object.fromEntries(['trigger', 'reaction', 'state', 'automatic'].map((kind) => [kind, all.filter((node) => node.kind === kind).length]))
  };
}

/** Every box a group wraps, padded, or null when it holds nothing on screen. */
function groupBoxOf(group, byId, padding = 20) {
  const boxes = group.members.map((name) => byId.get(name)?.box).filter(Boolean);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width)), bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left - padding, y: top - padding - 16, width: right - left + padding * 2, height: bottom - top + padding * 2 + 16 };
}

/** The kind and key a board id stands for, which is how a click becomes a selection. */
export function readNodeId(id) {
  for (const [kind, prefix] of Object.entries(NODE_PREFIX)) if (typeof id === 'string' && id.startsWith(prefix)) return { kind, key: id.slice(prefix.length) };
  return { kind: 'state', key: String(id ?? '') };
}

/** The two ends of a transition key, or null for anything that is not one. */
export const readTransitionKey = (key) => {
  const at = typeof key === 'string' ? key.indexOf('->') : -1;
  return at > 0 ? { from: key.slice(0, at), to: key.slice(at + 2) } : null;
};

/**
 * The transitions leaving a state, in the order `Tab` walks them.
 *
 * Cycling the edges of the node in hand is the answer to the one thing a
 * diagram is bad at: picking a curve out of several that leave the same box.
 */
export const outgoingKeys = (document, state) => (document?.transitions?.[state] || []).map((to) => `${state}->${to}`);

/** Every transition in the document, for the table that lists them all. */
export function allTransitions(document = {}) {
  return boardEdges(document).filter((edge) => edge.kind === 'transition')
    .map(({ key, from, to, duration, easing }) => ({ key, from, to, duration, easing }));
}

/** Whether a transition names two states that exist, which is what the table greys. */
export const transitionIsWhole = (document, key) => {
  const ends = readTransitionKey(key);
  return Boolean(ends && document?.states?.[ends.from] && document?.states?.[ends.to]);
};
