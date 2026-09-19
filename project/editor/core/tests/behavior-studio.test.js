import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createProjectDocument } from '../state/project-document.js';
import { createExportRig } from '../export/export-rig.js';
import { autoLayoutNodes } from '../state-machine/graph-layout.js';
import {
  BOARD_NODE, allTransitions, autoLayoutBoard, boardEdges, boardNodes, boardPositions,
  deriveBoard, outgoingKeys, readNodeId, readTransitionKey, triggerSignature
} from '../behavior-graph/behavior-graph.js';
import { createBoardCommands } from '../behavior-graph/board-commands.js';
import {
  DURATION_STOPS, behaviorTrace, durationLabel, easeValue, easingPath,
  nearestDurationStop, timingSegments, traceWindow, tracePath
} from '../behavior-graph/motion-shapes.js';
import { renderBoard } from '../../ui/behavior-studio/board.js';
import { renderAutomaticTuning, renderStateTuning, renderTransitionTuning } from '../../ui/behavior-studio/tuning.js';
import { renderTransitionTable, tableRows } from '../../ui/behavior-studio/transition-table.js';
import { easingValue } from '../../../runtime/runtime.js';

/**
 * The Behavior studio (docs/BEHAVIOR_STUDIO.md).
 *
 * The audit this suite belongs to found four things, and each section below is
 * one of them:
 *
 * ```text
 * §1.2  three screens, three interaction models  ->  one board, four kinds of node
 * §1.4  a transition could not be picked in bulk ->  a selection of several edges
 * §1.5  every animation was numbers, no picture  ->  curves and waveforms, sampled
 * §1.6  one array, two editors                   ->  one rail, from the selection
 * ```
 *
 * The rule that survives all of it, and the one worth breaking a build over:
 * **a position is authored data and the runtime never sees it.** The board has
 * three more kinds of node than the state machine had, and not one of them may
 * reach `rig.json`.
 */

const project = (extra = {}) => createProjectDocument({
  svgMarkup: '<svg><path id="head" d="M0 0"/></svg>',
  params: { headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 } },
  states: { idle: {}, talk: {}, sleep: {} },
  transitions: { idle: ['talk', 'sleep'], talk: ['idle'] },
  transitionSettings: {
    'idle->talk': { duration: 300, easing: 'easeInOut' },
    'idle->sleep': { duration: 900, easing: 'linear' },
    'talk->idle': { duration: 300, easing: 'easeInOut' }
  },
  activeState: 'idle',
  expressions: [{ id: 'happy', name: 'Happy', controls: {} }],
  reactions: [
    { id: 'wave', name: 'Wave', trigger: { type: 'click' }, expression: { id: 'happy', weight: 1 }, after: 'return', enabled: true, timing: { attack: .1, hold: .4, release: .2 }, priority: 0, interrupt: 'replace', conditions: [{ kind: 'state', state: 'idle', operator: '==' }], gestures: [] },
    { id: 'hello', name: 'Hello', trigger: { type: 'click' }, expression: { id: 'happy', weight: 1 }, after: 'return', enabled: true, timing: { attack: .1, hold: .4, release: .2 }, priority: 0, interrupt: 'replace', conditions: [], gestures: [] },
    { id: 'snooze', name: 'Snooze', trigger: { type: 'idle', after: 8 }, expression: null, motion: null, after: 'return', enabled: false, timing: { attack: .1, hold: .4, release: .2 }, priority: 0, interrupt: 'replace', conditions: [], gestures: [] }
  ],
  behaviors: [
    { id: 'auto-blink', type: 'blink', name: 'Blink', parameter: 'eyeOpen', enabled: true, intervalMin: 2, intervalMax: 4, duration: .12, closedValue: 0 },
    { id: 'auto-sway', type: 'oscillator', name: 'Idle sway', parameter: 'headY', enabled: true, amplitude: .05, frequency: .3, offset: 0 }
  ],
  ...extra
});

const editor = (document = project()) => {
  const store = createEditorStore(document), history = createHistory(store);
  return { store, history, commands: createBoardCommands(store, history) };
};

// ---------------------------------------------------------------------------
// §1.2 — one board, four kinds of node
// ---------------------------------------------------------------------------

test('the board carries the whole workspace, not only the state machine', () => {
  const board = deriveBoard(project());
  assert.deepEqual(board.counts, { trigger: 2, reaction: 3, state: 3, automatic: 2 },
    'two distinct triggers over three reactions, three states and two behaviours');

  // A trigger is one node per *signature*: three reactions on a click are one
  // thing that happens and three things done about it.
  const triggers = board.nodes.filter((node) => node.kind === 'trigger');
  assert.deepEqual(triggers.map((node) => node.key).sort(), ['click', 'idle:8']);
  assert.equal(triggers.find((node) => node.key === 'click').detail, '2 reactions');
  assert.equal(triggerSignature({ type: 'timer', interval: 5 }), 'timer:5');
  assert.equal(triggerSignature({ type: 'custom', name: 'yes' }), 'custom:yes');

  // Every edge the model can draw, and the kind it is: a transition, a trigger
  // firing a reaction, and a reaction gated on a state.
  const kinds = board.edges.reduce((count, edge) => ({ ...count, [edge.kind]: (count[edge.kind] || 0) + 1 }), {});
  assert.deepEqual(kinds, { transition: 3, fires: 3, guard: 1 });
  const guard = board.edges.find((edge) => edge.kind === 'guard');
  assert.deepEqual([guard.from, guard.to, guard.text], ['do:wave', 'idle', 'only if']);

  // The regression that made every transition unclickable: the geometry used
  // to answer with a key called `kind`, which overwrote the edge's own.
  assert.equal(board.edges.find((edge) => edge.key === 'idle->talk').kind, 'transition');
  assert.equal(board.edges.find((edge) => edge.key === 'idle->talk').shape, 'link');

  // A behaviour that is off is drawn, and says so: a card that is not there is
  // a behaviour nobody remembers switching off.
  assert.equal(board.nodes.find((node) => node.id === 'do:snooze').enabled, false);
});

test('a lens shows one part of the workspace and its edges follow their ends', () => {
  const states = deriveBoard(project(), { lens: 'states' });
  assert.deepEqual([...new Set(states.nodes.map((node) => node.kind))], ['state']);
  assert.deepEqual([...new Set(states.edges.map((edge) => edge.kind))], ['transition'],
    'a guard onto a state is not drawn when the reaction at its other end is not');

  const automatic = deriveBoard(project(), { lens: 'automatic' });
  assert.deepEqual(automatic.nodes.map((node) => node.key), ['auto-blink', 'auto-sway']);
  assert.equal(automatic.edges.length, 0);

  const reactions = deriveBoard(project(), { lens: 'reactions' });
  assert.deepEqual([...new Set(reactions.nodes.map((node) => node.kind))].sort(), ['reaction', 'state', 'trigger']);
  assert.equal(reactions.edges.filter((edge) => edge.kind === 'fires').length, 3);

  // An unknown lens is the whole board rather than an empty one.
  assert.equal(deriveBoard(project(), { lens: 'nonsense' }).nodes.length, deriveBoard(project()).nodes.length);
});

test('nothing on the board moves a state that was already laid out', () => {
  const document = project();
  const states = autoLayoutNodes(document);
  const placed = autoLayoutBoard(document);
  for (const [name, point] of Object.entries(states)) {
    assert.deepEqual(placed[name], point, `${name} is exactly where the state machine put it`);
  }
  // The three new kinds go around that block: triggers and reactions to its
  // left, at negative x, and the behaviours underneath.
  assert.ok(placed['when:click'].x < 0);
  assert.ok(placed['do:wave'].x < 0);
  assert.ok(placed['when:click'].x < placed['do:wave'].x, 'what happens is left of what is done about it');
  assert.ok(placed['auto:auto-blink'].y > Math.max(...Object.values(states).map((point) => point.y)));
  assert.notDeepEqual(placed['auto:auto-blink'], placed['auto:auto-sway'], 'two behaviours never land on each other');

  // And a box per kind, so a reaction's sentence is not clipped into a state's.
  assert.equal(BOARD_NODE.state.width, 112);
  assert.ok(BOARD_NODE.reaction.width > BOARD_NODE.state.width);
});

test('a position is authored for every kind of node, and never leaves the editor', () => {
  const { store, history, commands } = editor();
  const before = boardPositions(store.getDocument());
  commands.moveNodes(['do:wave'], { x: 40, y: 24 });
  const after = boardPositions(store.getDocument());
  assert.deepEqual(after['do:wave'], { x: before['do:wave'].x + 40, y: before['do:wave'].y + 24 },
    'a reaction is dragged like a state — which `graph-commands.moveNodes` would have dropped');
  assert.deepEqual(after.idle, before.idle, 'and everything else is written down where it already was');
  assert.ok('when:click' in store.getDocument().graphLayout.nodes);

  history.undo();
  assert.deepEqual(store.getDocument().graphLayout.nodes, {}, 'one gesture, one history step');
  assert.equal(commands.moveNodes([], { x: 5, y: 5 }), false);
  assert.equal(commands.moveNodes(['do:wave'], { x: 0, y: 0 }), false);

  // The rule the whole diagram rests on: the runtime runs a machine, it does
  // not draw one.
  commands.moveNodes(['do:wave', 'auto-blink'], { x: 8, y: 8 });
  assert.equal(createExportRig(store.getDocument()).graphLayout, undefined);
});

test('Arrange puts every kind back, in one step', () => {
  const { store, history, commands } = editor();
  commands.moveNodes(['do:wave', 'sleep'], { x: 400, y: 400 });
  commands.arrange();
  assert.deepEqual(store.getDocument().graphLayout.nodes, autoLayoutBoard(store.getDocument()));
  history.undo();
  assert.notDeepEqual(store.getDocument().graphLayout.nodes, autoLayoutBoard(store.getDocument()),
    'and one press of undo is enough to get the scatter back');
});

test('an id says what it stands for, both ways', () => {
  assert.deepEqual(readNodeId('idle'), { kind: 'state', key: 'idle' });
  assert.deepEqual(readNodeId('do:wave'), { kind: 'reaction', key: 'wave' });
  assert.deepEqual(readNodeId('when:timer:5'), { kind: 'trigger', key: 'timer:5' });
  assert.deepEqual(readNodeId('auto:auto-blink'), { kind: 'automatic', key: 'auto-blink' });
  assert.deepEqual(readTransitionKey('idle->talk'), { from: 'idle', to: 'talk' });
  assert.equal(readTransitionKey('idle'), null);
  // A state whose name contains the arrow is the one case a split would get
  // wrong; the key is read from the first arrow, which is where it is written.
  assert.deepEqual(readTransitionKey('a->b->c'), { from: 'a', to: 'b->c' });
});

// ---------------------------------------------------------------------------
// §1.4 — a transition you can actually pick, and pick several of
// ---------------------------------------------------------------------------

test('a selection lights what it touches and dims the rest', () => {
  const board = deriveBoard(project(), { lens: 'states', selection: ['idle'] });
  const dimmed = board.nodes.filter((node) => node.dim).map((node) => node.id);
  assert.deepEqual(dimmed, [], 'idle reaches every other state, so nothing recedes here');

  const sleep = deriveBoard(project(), { lens: 'states', selection: ['sleep'] });
  assert.deepEqual(sleep.nodes.filter((node) => node.dim).map((node) => node.id), ['talk']);
  assert.deepEqual(sleep.edges.filter((edge) => !edge.dim).map((edge) => edge.key), ['idle->sleep']);

  // Nothing picked dims nothing: focus is a consequence of a selection, never
  // a mode.
  assert.equal(deriveBoard(project(), { lens: 'states' }).nodes.some((node) => node.dim), false);
});

test('Tab walks the transitions leaving a state, which is what a diagram is bad at', () => {
  assert.deepEqual(outgoingKeys(project(), 'idle'), ['idle->talk', 'idle->sleep']);
  assert.deepEqual(outgoingKeys(project(), 'sleep'), []);
  assert.deepEqual(outgoingKeys(project(), 'ghost'), []);
});

test('several transitions are set together, in one history step', () => {
  const { store, history, commands } = editor();
  const revision = store.getDocument().revision;
  assert.equal(commands.setTransitions(['idle->talk', 'idle->sleep'], { duration: 200, easing: 'easeOut' }), 2);
  for (const key of ['idle->talk', 'idle->sleep']) {
    assert.deepEqual(store.getDocument().transitionSettings[key], { duration: 200, easing: 'easeOut' }, key);
  }
  assert.equal(store.getDocument().transitionSettings['talk->idle'].duration, 300, 'and nothing else moves');

  history.undo();
  assert.equal(store.getDocument().transitionSettings['idle->sleep'].duration, 900, 'one press of undo, whatever the count');
  assert.equal(store.getDocument().revision, revision);

  // A refusal is raised before history moves, so a failed edit is not a step.
  assert.throws(() => commands.setTransitions(['idle->talk'], { easing: 'wobble' }), /Invalid transition easing/);
  assert.throws(() => commands.setTransitions(['idle->talk'], { duration: -5 }), /zero or greater/);
  assert.throws(() => commands.setTransitions(['idle->ghost'], { duration: 100 }), /no longer exists/);
  assert.equal(commands.setTransitions([], { duration: 100 }), false);
  assert.equal(commands.setTransitions(['idle->talk'], {}), false);
  // And setting what is already set is not a step: a number field fires
  // `input` *and* `change` for one edit, and two steps make one press of undo
  // look as if it did nothing.
  const steps = store.getDocument().revision;
  assert.equal(commands.setTransitions(['idle->talk'], { duration: 300, easing: 'easeInOut' }), false);
  assert.equal(store.getDocument().revision, steps);
});

test('several transitions are deleted together, and a bad one stops all of them', () => {
  const { store, commands } = editor();
  assert.throws(() => commands.deleteTransitions(['idle->talk', 'idle->ghost']), /no longer exists/);
  assert.deepEqual(store.getDocument().transitions.idle, ['talk', 'sleep'], 'nothing half-deleted');

  assert.equal(commands.deleteTransitions(['idle->talk', 'talk->idle']), 2);
  assert.deepEqual(store.getDocument().transitions.idle, ['sleep']);
  assert.deepEqual(store.getDocument().transitions.talk, []);
  assert.equal(store.getDocument().transitionSettings['idle->talk'], undefined);
});

test('the markup keeps the hooks a transition is picked by', () => {
  const html = renderBoard(project(), { lens: 'all', edges: ['idle->sleep'], selection: ['do:wave'] });
  // The fat transparent path is what makes an 8 px curve a target.
  assert.match(html, /class="graph-link-hit" d="[^"]+" data-select-transition="idle-&gt;sleep"/);
  assert.match(html, /class="graph-link link-transition selected[^"]*"/);
  assert.match(html, /class="graph-link-label link-transition selected"/);
  assert.match(html, /data-board-selection="2"/, 'a node and an edge picked at once is two things');
  // Only what a link may start from gets a handle: dragging from a trigger
  // would draw the one edge the model does not let an author author.
  const ports = [...html.matchAll(/data-graph-port="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ports.filter((id) => id.startsWith('when:')), []);
  assert.equal(ports.filter((id) => id.startsWith('do:')).length, 3);
  // The board counts the states and the transitions, which is what the browser
  // specs assert on.
  assert.match(html, /data-graph-nodes="3"/);
  assert.match(html, /data-graph-links="3"/);
  assert.match(renderBoard(project(), { lens: 'automatic' }), /data-graph-nodes="0"/);
});

// ---------------------------------------------------------------------------
// §1.5 — every animation, as a shape
// ---------------------------------------------------------------------------

test('the easing drawn is the easing the runtime runs', () => {
  for (const easing of ['linear', 'easeIn', 'easeOut', 'easeInOut']) {
    for (const t of [0, .1, .25, .5, .75, .9, 1]) {
      assert.ok(Math.abs(easeValue(t, easing) - easingValue(t, easing)) < 1e-12, `${easing} at ${t}`);
    }
  }
  // Out of range is clamped rather than extrapolated: a picture of a curve
  // running past its own end is a lie about what the mascot does.
  assert.equal(easeValue(-1, 'easeIn'), 0);
  assert.equal(easeValue(2, 'easeIn'), 1);

  // Drawn bottom-left to top-right, which is how a curve is read.
  const path = easingPath('linear', { width: 100, height: 50, samples: 2 });
  assert.equal(path, 'M 0 50 L 50 25 L 100 0');
  // And the four are four different pictures, which is the whole point.
  const shapes = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut'].map((id) => easingPath(id, { width: 60, height: 30, samples: 8 })));
  assert.equal(shapes.size, 4);
});

test('a duration is a word before it is a number', () => {
  assert.equal(DURATION_STOPS[nearestDurationStop(300)].label, 'Normal');
  assert.equal(DURATION_STOPS[nearestDurationStop(310)].label, 'Normal', 'the slider still lands on the nearest stop');
  assert.equal(durationLabel(300), 'Normal · 300 ms');
  assert.equal(durationLabel(340), '340 ms', 'and a value between stops keeps its own number');
  assert.equal(durationLabel('nonsense'), 'Instant · 0 ms');
  assert.deepEqual(DURATION_STOPS.map((stop) => stop.ms), [...DURATION_STOPS.map((stop) => stop.ms)].sort((a, b) => a - b));
});

test('a reaction is three segments that add up to what it is worth', () => {
  const { total, parts } = timingSegments({ attack: .1, hold: .4, release: .2 });
  assert.equal(total, .7);
  assert.deepEqual(parts.map((part) => part.key), ['attack', 'hold', 'release']);
  assert.ok(Math.abs(parts.reduce((sum, part) => sum + part.share, 0) - 100) < .05);
  assert.ok(parts[1].share > parts[0].share, 'a "fast" reaction spends most of its life holding, which three fields never said');
  // Nothing at all is three equal segments rather than a division by zero.
  assert.deepEqual(timingSegments({}).parts.map((part) => part.share), [33.33, 33.33, 33.33]);
});

test('a behaviour is sampled through the runtime, so the picture is what it will do', () => {
  const params = { eyeOpen: { min: 0, max: 1, default: 1 }, headY: { min: -1, max: 1, default: 0 } };

  // A blink is a pulse train: open at rest, closed for `duration`, more than
  // once inside the window.
  const blink = behaviorTrace({ type: 'blink', parameter: 'eyeOpen', intervalMin: 1, intervalMax: 1, duration: .3, closedValue: 0 }, params.eyeOpen, { seconds: 6, samples: 240 });
  assert.equal(blink.base, 1);
  assert.deepEqual([...new Set(blink.points)].sort(), [0, 1], 'it is closed or open, never a quarter shut');
  const closes = blink.points.filter((value, index) => value === 0 && blink.points[index - 1] === 1).length;
  assert.ok(closes >= 3, `${closes} closes in six seconds at one a second`);

  // An oscillator is a sine about its offset, inside its amplitude.
  const sway = behaviorTrace({ type: 'oscillator', parameter: 'headY', amplitude: .5, frequency: .5, offset: 0 }, params.headY, { seconds: 4, samples: 160 });
  assert.ok(Math.max(...sway.points) > .49 && Math.max(...sway.points) <= .5);
  assert.ok(Math.min(...sway.points) < -.49 && Math.min(...sway.points) >= -.5);

  // A drift rests between moves and never leaves its amplitude — which is the
  // whole difference between looking alive and looking like it is shivering.
  const drift = behaviorTrace({ type: 'drift', parameter: 'headY', amplitude: .08, travelMin: 1, travelMax: 2, intervalMin: 1, intervalMax: 2 }, params.headY, { seconds: 12, samples: 300 });
  assert.ok(Math.max(...drift.points.map(Math.abs)) <= .0801, 'inside ±amplitude');
  assert.ok(new Set(drift.points.map((value) => value.toFixed(3))).size > 10, 'and it moves, rather than sitting at rest');

  // Seeded: the same behaviour draws the same picture twice, so a test can
  // assert on it and an author is not shown a different one on every render.
  const again = behaviorTrace({ type: 'drift', parameter: 'headY', amplitude: .08, travelMin: 1, travelMax: 2, intervalMin: 1, intervalMax: 2 }, params.headY, { seconds: 12, samples: 300 });
  assert.deepEqual(again.points, drift.points);

  // The window is as long as it takes to show what a behaviour does: a slow
  // oscillator is a flat line inside a fixed one.
  assert.ok(traceWindow({ type: 'oscillator', frequency: .1 }) > traceWindow({ type: 'oscillator', frequency: 2 }));
  assert.ok(traceWindow({ type: 'blink', intervalMax: 9 }) >= 19);

  assert.match(tracePath(sway, { width: 100, height: 40 }), /^M 0 /);
  assert.equal(tracePath({ points: [] }), '');
});

// ---------------------------------------------------------------------------
// §1.6 — one rail, from the selection
// ---------------------------------------------------------------------------

test('the rail answers for one transition and for twenty', () => {
  const one = renderTransitionTuning(project(), ['idle->talk']);
  assert.match(one, /data-tune-count="1"/);
  assert.match(one, /<b>idle<\/b> → <b>talk<\/b>/);
  assert.match(one, /data-tune-easing="easeInOut"[^>]*aria-pressed="true"/);
  assert.match(one, /data-tune-duration[^>]*value="300"/);
  assert.doesNotMatch(one, /tune-mixed/);

  const many = renderTransitionTuning(project(), ['idle->talk', 'idle->sleep']);
  assert.match(many, /data-tune-count="2"/);
  assert.match(many, /<b>2 transitions<\/b>/);
  // Mixed says so rather than showing the first one and quietly overwriting
  // the rest on the next keystroke.
  assert.match(many, /Mixed easing/);
  assert.match(many, /Mixed durations/);
  assert.match(many, /Delete all 2/);
});

test('the rail answers for a state and for an automatic behaviour', () => {
  const state = renderStateTuning(project(), 'idle');
  assert.match(state, /data-tune-kind="state"/);
  assert.match(state, /where the mascot starts/);
  assert.match(state, /data-tune-state-param="headY"/);
  assert.match(state, /data-tune-initial disabled/, 'the state it already starts at cannot be made the start again');
  assert.equal(renderStateTuning(project(), 'ghost'), '');

  const behavior = renderAutomaticTuning(project(), 'auto-blink');
  assert.match(behavior, /data-tune-wave="blink"/, 'the waveform comes before the numbers');
  assert.match(behavior, /data-tune-behavior-field="intervalMin"/);
  assert.doesNotMatch(behavior, /data-tune-behavior-field="frequency"/, 'and only the fields a blink has');
  assert.match(renderAutomaticTuning(project(), 'auto-sway'), /data-tune-behavior-field="frequency"/);

  // A behaviour whose movement the mascot has lost says so instead of drawing
  // a flat line and calling it a waveform.
  const orphan = project({ behaviors: [{ id: 'x', type: 'oscillator', name: 'Ghost', parameter: 'nothing', enabled: true, amplitude: .1, frequency: .3, offset: 0 }] });
  assert.match(renderAutomaticTuning(orphan, 'x'), /does not have/);
  assert.equal(renderAutomaticTuning(project(), 'missing'), '');
});

test('the table lists every transition, filters, and offers the bulk edit at two', () => {
  const document = project();
  assert.deepEqual(allTransitions(document).map((row) => row.key).sort(), ['idle->sleep', 'idle->talk', 'talk->idle']);
  assert.deepEqual(tableRows(document).map((row) => row.key), ['idle->sleep', 'idle->talk', 'talk->idle'], 'read the way a machine is read');
  assert.deepEqual(tableRows(document, 'sleep').map((row) => row.key), ['idle->sleep']);
  assert.deepEqual(tableRows(document, 'SLEEP').map((row) => row.key), ['idle->sleep'], 'and case is not a search term');
  // `idle->` is what leaves idle; `idle` is everything it touches. Both are
  // things somebody types into a box labelled Find.
  assert.deepEqual(tableRows(document, 'idle->').map((row) => row.key), ['idle->sleep', 'idle->talk']);
  assert.deepEqual(tableRows(document, 'idle').map((row) => row.key), ['idle->sleep', 'idle->talk', 'talk->idle']);

  const table = renderTransitionTable(document, { selected: ['idle->talk'] });
  assert.match(table, /data-transition-table="3"/);
  assert.match(table, /data-table-duration="idle-&gt;sleep"[^>]*value="900"/);
  assert.doesNotMatch(table, /data-table-bulk="/, 'one row picked is not a bulk edit');

  const bulk = renderTransitionTable(document, { selected: ['idle->talk', 'talk->idle'] });
  assert.match(bulk, /data-table-bulk="2"/);
  assert.match(bulk, /data-table-bulk-duration/);
  assert.match(bulk, /Delete 2/);

  assert.match(renderTransitionTable(project({ transitions: {}, transitionSettings: {} }), {}), /No transitions yet/);
  assert.match(renderTransitionTable(document, { filter: 'zzz' }), /Nothing matches that/);
});

// ---------------------------------------------------------------------------
// What the board must never do
// ---------------------------------------------------------------------------

test('a project written before the board opens exactly where it was left', () => {
  // The whole reason the three new kinds are keyed with a prefix and laid out
  // at negative x: an authored state layout is untouched by any of them.
  const authored = project({ graphLayout: { nodes: { idle: { x: 500, y: 40 }, talk: { x: 700, y: 40 }, sleep: { x: 900, y: 40 } }, groups: [], comments: [] } });
  const positions = boardPositions(authored);
  assert.deepEqual(positions.idle, { x: 500, y: 40 });
  assert.deepEqual(positions.talk, { x: 700, y: 40 });
  // And the kinds it has never heard of are placed rather than dropped at the
  // origin on top of one another.
  assert.notDeepEqual(positions['do:wave'], positions['do:hello']);
  assert.notDeepEqual(positions['when:click'], { x: 0, y: 0 });
});

test('a document with nothing in it is a board with nothing on it, and says so', () => {
  const empty = { states: {}, transitions: {}, reactions: [], behaviors: [] };
  assert.deepEqual(boardNodes(empty), []);
  assert.deepEqual(boardEdges(empty), []);
  const board = deriveBoard(empty);
  assert.deepEqual(board.bounds, { x: 0, y: 0, width: 640, height: 360 }, 'a viewport nobody can fit to is not a crash');
  assert.match(renderBoard(empty, { lens: 'states' }), /No states yet/);
  assert.match(renderBoard(empty, { lens: 'automatic' }), /Nothing runs by itself yet/);
  assert.match(renderBoard(empty, { lens: 'reactions' }), /No reactions yet/);
  // A reaction with no id is not a node with no name; it is not a node.
  assert.deepEqual(boardNodes({ reactions: [{ name: 'nameless' }], behaviors: [{ name: 'nameless' }] }), []);
});
