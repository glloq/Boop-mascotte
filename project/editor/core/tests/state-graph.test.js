import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createProjectDocument } from '../state/project-document.js';
import { createProjectSnapshot, applyProjectSnapshot } from '../state/project-snapshot.js';
import { createCleanProjectState } from '../state/store.js';
import { createExportRig } from '../export/export-rig.js';
import { createGraphCommands } from '../state-machine/graph-commands.js';
import {
  GRAPH_NODE, GRAPH_ZOOM, autoLayoutNodes, fitView, graphBounds, groupBox, isEmptyLayout,
  linkBows, linkGeometry, movedNodes, nodesFor, nodesInMarquee, normalizeGraphLayout, rankStates, toGraph, zoomedBy
} from '../state-machine/graph-layout.js';
import { deriveGraph, renderStateGraph } from '../../animation-editor/state-machine/graph-view.js';

/**
 * The state machine as a diagram (V4-100 … V4-106, docs/V4_ROADMAP.md Phase 10).
 *
 * What it replaces computed its positions on every render — every state on one
 * horizontal line — so there was no such thing as moving a node, only watching
 * it be placed. The rule this suite keeps is the one that follows from fixing
 * that: **a position is authored data**. It is undone like a transition, saved
 * like a transition, and it never reaches `rig.json`, because the runtime runs
 * a state machine without drawing one.
 */

const machine = (extra = {}) => createProjectDocument({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>',
  params: { headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 } },
  states: { idle: {}, talk: {}, sleep: {} },
  transitions: { idle: ['talk', 'sleep'], talk: ['idle'] },
  activeState: 'idle',
  ...extra
});

// ---------------------------------------------------------------------------
// Where things go
// ---------------------------------------------------------------------------

test('a layout is read where it is readable and left alone where it is not', () => {
  assert.deepEqual(normalizeGraphLayout(null), { nodes: {}, groups: [], comments: [] });
  assert.deepEqual(normalizeGraphLayout({ nodes: { idle: { x: '40', y: 8 }, broken: 'over there', '': { x: 1 } } }).nodes, { idle: { x: 40, y: 8 } });
  // A group of nothing is not a group; a group names itself when nobody did.
  assert.deepEqual(normalizeGraphLayout({ groups: [{ members: [] }, { members: ['idle', 'idle'] }] }).groups, [{ id: 'group-2', name: 'Group', members: ['idle'] }]);
  const [note] = normalizeGraphLayout({ comments: [{ x: 4, text: 'why' }] }).comments;
  assert.deepEqual(note, { id: 'note-1', x: 4, y: 0, width: 180, height: 84, text: 'why' });
  assert.equal(isEmptyLayout(normalizeGraphLayout(null)), true);
  assert.equal(isEmptyLayout(normalizeGraphLayout({ comments: [{ text: 'hi' }] })), false);

  // A position for a state that is not there is kept rather than dropped:
  // deleting a state is undoable, and a layout that forgot would put the node
  // back in the corner on redo.
  assert.deepEqual(Object.keys(normalizeGraphLayout({ nodes: { gone: { x: 1, y: 2 } } }).nodes), ['gone']);
  assert.deepEqual(Object.keys(nodesFor(machine(), { nodes: { gone: { x: 1, y: 2 } } })), ['idle', 'talk', 'sleep'], 'and read back out at the point of use');
});

test('auto-layout reads left to right from where the mascot starts', () => {
  const document = machine();
  const rank = rankStates(Object.keys(document.states), document.transitions, 'idle');
  assert.equal(rank.get('idle'), 0);
  assert.equal(rank.get('talk'), 1);
  assert.equal(rank.get('sleep'), 1);

  const nodes = autoLayoutNodes(document);
  assert.ok(nodes.talk.x > nodes.idle.x, 'what happens next is one column to the right');
  assert.equal(nodes.talk.x, nodes.sleep.x, 'and two things that happen next share a column');
  assert.notEqual(nodes.talk.y, nodes.sleep.y, 'without landing on each other');
  // Deterministic: pressing Arrange twice is one diagram, so it can be undone.
  assert.deepEqual(autoLayoutNodes(document), nodes);

  // A state nothing leads to starts its own block, so a project holding two
  // separate machines reads as two rather than as one and a pile.
  const two = machine({ states: { idle: {}, talk: {}, other: {}, next: {} }, transitions: { idle: ['talk'], other: ['next'] } });
  const roots = rankStates(Object.keys(two.states), two.transitions, 'idle');
  assert.deepEqual([roots.get('idle'), roots.get('other')], [0, 0]);
  assert.deepEqual([roots.get('talk'), roots.get('next')], [1, 1]);

  // What is left after that walk is a cycle with no way in: genuinely
  // unreachable, and put past the end rather than hidden in the middle.
  const stranded = machine({ states: { idle: {}, a: {}, b: {} }, transitions: { idle: [], a: ['b'], b: ['a'] } });
  const ranks = rankStates(Object.keys(stranded.states), stranded.transitions, 'idle');
  assert.ok(ranks.get('a') > ranks.get('idle'));
});

test('a state added after the diagram was arranged is placed, not dropped at the origin', () => {
  const document = machine({ graphLayout: { nodes: { idle: { x: 500, y: 40 }, talk: { x: 700, y: 40 } } } });
  const nodes = nodesFor(document);
  assert.deepEqual(nodes.idle, { x: 500, y: 40 }, 'what was authored is kept');
  assert.notDeepEqual(nodes.sleep, { x: 0, y: 0 }, 'and what was not gets a place chosen for it');
});

// ---------------------------------------------------------------------------
// How links are drawn
// ---------------------------------------------------------------------------

test('a pair of transitions is two curves, and a self-transition is a loop', () => {
  const a = { x: 0, y: 0 }, b = { x: 300, y: 0 };
  const there = linkGeometry(a, b, { bow: 1 }), back = linkGeometry(b, a, { bow: -1 });
  assert.notEqual(there.d, back.d, 'drawn through the same points they would be one line');
  assert.equal(there.kind, 'link');

  // A straight line from a box to itself has no length and cannot be clicked.
  const loop = linkGeometry(a, a);
  assert.equal(loop.kind, 'self');
  assert.ok(loop.label.y < a.y, 'the loop is drawn over the node');

  // A link meets the boxes, not their centres: an arrowhead inside a node is an
  // arrow pointing at nothing.
  const [, sx, sy] = /^M ([-\d.]+) ([-\d.]+)/.exec(linkGeometry(a, b).d);
  assert.equal(Number(sx), GRAPH_NODE.width, 'it leaves the right edge');
  assert.equal(Number(sy), GRAPH_NODE.height / 2);

  assert.equal(linkGeometry(null, b), null);
  const bows = linkBows({ idle: ['talk', 'sleep'], talk: ['idle'] });
  assert.equal(bows.get('idle->sleep'), 0, 'a link with no opposite leans nowhere');
  assert.equal(bows.get('idle->talk') * bows.get('talk->idle'), -1);
});

test('the diagram carries every state, every link and what each one is worth', () => {
  const graph = deriveGraph(machine({ transitionSettings: { 'idle->talk': { duration: 120, easing: 'linear' } } }), { selectedEdge: 'idle->talk' });
  assert.deepEqual(graph.states.map((item) => item.name), ['idle', 'talk', 'sleep']);
  assert.equal(graph.states.find((item) => item.name === 'idle').initial, true);
  assert.equal(graph.states.find((item) => item.name === 'talk').incoming, 1);
  assert.equal(graph.states.find((item) => item.name === 'idle').outgoing, 2);
  const link = graph.links.find((item) => item.key === 'idle->talk');
  assert.equal(link.duration, 120);
  assert.equal(link.selected, true);
  // A transition naming a state that is gone is not drawn, rather than drawn
  // from nowhere.
  assert.equal(deriveGraph(machine({ transitions: { idle: ['ghost'] } })).links.length, 0);
});

test('the markup says what is live and what is firing', () => {
  const html = renderStateGraph(machine(), { live: 'talk', firing: 'idle->talk', selection: ['sleep'] });
  assert.match(html, /class="graph-node[^"]*\blive\b[^"]*"[^>]*data-select-state="talk"/);
  // `>` inside an attribute is escaped on the way out and unescaped by the
  // parser, so the DOM really does hold `idle->talk`; only a string match sees
  // the entity.
  assert.match(html, /class="graph-link firing" d="[^"]+" marker-end="url\(#graph-arrow\)" data-graph-link-line="idle-&gt;talk"/);
  assert.match(html, /class="graph-node selected"[^>]*data-select-state="sleep"/);
  // Grouping needs two: one selected state is a group of one.
  assert.match(html, /data-graph-group aria-label="Group the selected states" disabled/);
  assert.match(renderStateGraph(machine(), { selection: ['idle', 'talk'] }), /data-graph-group aria-label="Group the selected states">/);
  // Every state gets the handle a link is dragged from (V4-102).
  assert.equal([...html.matchAll(/data-graph-port="/g)].length, 3);
  assert.match(renderStateGraph({ states: {} }, {}), /No states yet/);
});

test('a link label is drawn against the zoom, so it is readable at any of them', () => {
  // Scaled with the scene, a 10 px label is four pixels at the zoom a whole
  // machine fits into this column and a banner across two nodes at the zoom
  // somebody edits at. Counter-scaling is what keeps it one size — and keeps it
  // clickable, which a hidden label is not.
  // On the scene, not on each label: a pan or a zoom writes one style on one
  // element and never re-renders, so the number has to live where that write
  // already lands.
  assert.match(renderStateGraph(machine(), { view: { x: 0, y: 0, scale: 1 } }), /data-graph-scene[^>]*--graph-counter:1"/);
  assert.match(renderStateGraph(machine(), { view: { x: 0, y: 0, scale: .4 } }), /--graph-counter:2\.5"/);
  assert.match(renderStateGraph(machine(), { view: { x: 0, y: 0, scale: 2 } }), /--graph-counter:0\.5"/);
  assert.match(renderStateGraph(machine(), {}), /class="graph-link-label"[^>]*data-select-transition/);
});

// ---------------------------------------------------------------------------
// Moving around
// ---------------------------------------------------------------------------

test('the view zooms about a point and fits what is there', () => {
  assert.ok(zoomedBy(1, 1) > 1);
  assert.equal(zoomedBy(GRAPH_ZOOM.max, 1), GRAPH_ZOOM.max, 'and stops where a diagram is still a diagram');
  assert.equal(zoomedBy(GRAPH_ZOOM.min, -1), GRAPH_ZOOM.min);

  const bounds = graphBounds({ a: { x: 0, y: 0 }, b: { x: 400, y: 200 } });
  const view = fitView(bounds, { width: 600, height: 300 });
  // The centre of what is drawn lands on the centre of what is looked at.
  const middle = toGraph({ x: 300, y: 150 }, view);
  assert.ok(Math.abs(middle.x - (bounds.x + bounds.width / 2)) < 1e-6);
  assert.ok(Math.abs(middle.y - (bounds.y + bounds.height / 2)) < 1e-6);
  assert.deepEqual(fitView(bounds, { width: 0, height: 0 }), { x: 0, y: 0, scale: 1 }, 'a viewport nobody has measured yet changes nothing');
});

test('a marquee takes what it touches, and a move moves only what was dragged', () => {
  const nodes = { idle: { x: 0, y: 0 }, talk: { x: 400, y: 0 } };
  assert.deepEqual(nodesInMarquee(nodes, { x: -10, y: -10, width: 60, height: 60 }), ['idle'], 'touching is enough');
  assert.deepEqual(nodesInMarquee(nodes, { x: 60, y: -10, width: -70, height: 60 }), ['idle'], 'dragged the other way is the same rectangle');
  assert.deepEqual(nodesInMarquee(nodes, { x: -10, y: -10, width: 600, height: 60 }), ['idle', 'talk']);

  const moved = movedNodes(nodes, ['talk'], { x: 11, y: -3 });
  assert.deepEqual(moved.idle, { x: 0, y: 0 });
  assert.deepEqual(moved.talk, { x: 408, y: 0 }, 'snapped to the grid, so two nodes dragged apart still line up');
  assert.deepEqual(movedNodes(nodes, ['ghost'], { x: 10, y: 10 }), nodes);
});

test('a group is a box around what it holds', () => {
  const nodes = { idle: { x: 0, y: 0 }, talk: { x: 200, y: 100 } };
  const box = groupBox({ members: ['idle', 'talk'] }, nodes, 10);
  assert.ok(box.x < 0 && box.y < 0);
  assert.ok(box.x + box.width > 200 + GRAPH_NODE.width);
  assert.equal(groupBox({ members: ['ghost'] }, nodes), null, 'a group with nothing on screen is not drawn');
});

// ---------------------------------------------------------------------------
// What is written down
// ---------------------------------------------------------------------------

const editor = () => {
  const store = createEditorStore(machine()), history = createHistory(store);
  return { store, history, commands: createGraphCommands(store, history) };
};

test('moving a node is one history step, and it is kept', () => {
  const { store, history, commands } = editor();
  const before = nodesFor(store.getDocument());
  commands.moveNodes(['talk'], { x: 40, y: 24 });
  const after = nodesFor(store.getDocument());
  assert.deepEqual(after.talk, { x: before.talk.x + 40, y: before.talk.y + 24 });
  // Everything else is written down at the same time, at the place it was
  // already being drawn: otherwise dragging one node of an auto-laid-out graph
  // pins that one and leaves the rest free to jump when a state is added.
  assert.deepEqual(after.idle, before.idle);
  assert.deepEqual(Object.keys(store.getDocument().graphLayout.nodes).sort(), ['idle', 'sleep', 'talk']);

  history.undo();
  assert.deepEqual(store.getDocument().graphLayout.nodes, {}, 'and back to a diagram nobody had arranged');
  assert.equal(commands.moveNodes([], { x: 5, y: 5 }), false, 'nothing dragged is not a history step');
  assert.equal(commands.moveNodes(['talk'], { x: 0, y: 0 }), false);
});

test('Arrange is one step, and undoes to exactly where things were', () => {
  const { store, history, commands } = editor();
  commands.moveNodes(['talk'], { x: 400, y: 400 });
  const scattered = structuredClone(store.getDocument().graphLayout.nodes);
  commands.arrange();
  assert.deepEqual(store.getDocument().graphLayout.nodes, autoLayoutNodes(store.getDocument()));
  history.undo();
  assert.deepEqual(store.getDocument().graphLayout.nodes, scattered);
});

test('notes and groups are authored on the diagram, and refuse what they cannot hold', () => {
  const { store, commands } = editor();
  const id = commands.addComment({ x: 20, y: 30 }, 'why the mascot sleeps');
  assert.deepEqual(store.getDocument().graphLayout.comments.map((item) => item.text), ['why the mascot sleeps']);
  commands.updateComment(id, { text: 'because nobody is looking' });
  assert.equal(store.getDocument().graphLayout.comments[0].text, 'because nobody is looking');
  assert.throws(() => commands.updateComment('ghost', { text: 'x' }), /no longer on the diagram/);
  commands.removeComment(id);
  assert.deepEqual(store.getDocument().graphLayout.comments, []);

  const group = commands.group(['idle', 'talk'], 'Awake');
  assert.deepEqual(store.getDocument().graphLayout.groups, [{ id: 'group-1', name: 'Awake', members: ['idle', 'talk'] }]);
  // A state belongs to one group: a box inside a box is a diagram that needs
  // its own diagram.
  commands.group(['talk', 'sleep'], 'Busy');
  const groups = store.getDocument().graphLayout.groups;
  assert.deepEqual(groups.map((item) => item.members), [['idle'], ['talk', 'sleep']]);
  assert.throws(() => commands.group(['idle']), /at least two/);
  assert.throws(() => commands.group(['idle', 'ghost']), /does not exist/);
  commands.renameGroup(groups[1].id, 'Awake and busy');
  assert.equal(store.getDocument().graphLayout.groups[1].name, 'Awake and busy');
  assert.throws(() => commands.renameGroup(groups[1].id, '   '), /Give the group a name/);
  commands.ungroup(group);
  assert.equal(store.getDocument().graphLayout.groups.length, 1);
});

test('the diagram is saved with the project and never sent to the runtime', () => {
  const { store, commands } = editor();
  commands.moveNodes(['talk'], { x: 120, y: 64 });
  commands.addComment({ x: 0, y: 0 }, 'a note');
  commands.group(['idle', 'talk'], 'Awake');

  const snapshot = createProjectSnapshot(store.getState(), () => store.getDocument().svgMarkup);
  // Beside the rig, not inside it: it adds no runtime concept.
  assert.ok(snapshot.document.editor.graphLayout.nodes.talk);
  assert.equal(snapshot.document.rig.graphLayout, undefined);
  assert.equal(createExportRig(store.getDocument()).graphLayout, undefined, 'the runtime runs a state machine without drawing one');

  const reopened = createCleanProjectState();
  applyProjectSnapshot(reopened, snapshot);
  assert.deepEqual(reopened.graphLayout, store.getDocument().graphLayout);

  // A project written before the diagram existed opens with none, and every
  // node is placed by auto-layout rather than stacked at the origin.
  const older = createCleanProjectState();
  applyProjectSnapshot(older, { ...snapshot, document: { ...snapshot.document, editor: { ...snapshot.document.editor, graphLayout: undefined } } });
  assert.deepEqual(older.graphLayout, { nodes: {}, groups: [], comments: [] });
});
