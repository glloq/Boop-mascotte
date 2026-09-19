/**
 * The Behavior board: the workspace's one surface (docs/BEHAVIOR_STUDIO.md).
 *
 * This is `state-machine/graph-view.js` grown up. That view drew one kind of
 * node in a 300 px column; this one draws four kinds across the window, and
 * everything it learned about working in a diagram is kept:
 *
 * ```text
 * a position is authored data, undone and saved like a transition
 * pan, zoom, drag -- and a Fit that always gets you back
 * links are drawn by dragging a port, with a draft line under the pointer
 * the state the mascot is in, and the transition currently playing
 * marquee selection, groups, one-press auto-arrange, notes
 * ```
 *
 * What is new is the part the audit was about:
 *
 * - **four kinds of node** (trigger, reaction, state, automatic) and three of
 *   edge, from one pure model (`core/behavior-graph/behavior-graph.js`);
 * - **a lens**, so the same board answers the three Behavior screens;
 * - **transitions that can be picked**: shift-click to add, `Tab` to cycle the
 *   ones leaving the node in hand, and a focus that dims everything the
 *   selection does not touch;
 * - **selection of more than one thing**, which is what makes tuning a whole
 *   machine at once possible at all.
 *
 * Split the same way as before: `renderBoard()` is a pure function of the
 * document and the view, so every layout decision is testable in Node, and
 * `attach()` binds the pointer work to a host that survives re-renders.
 */
import {
  BOARD_LENSES, deriveBoard, nodesInBox, normalizeLens, outgoingKeys, readNodeId
} from '../../core/behavior-graph/behavior-graph.js';
import { createBoardCommands } from '../../core/behavior-graph/board-commands.js';
import { createGraphCommands } from '../../core/state-machine/graph-commands.js';
import { GRAPH_ZOOM, fitView, toGraph, zoomedBy } from '../../core/state-machine/graph-layout.js';
import { esc } from '../escape-html.js';

const px = (value) => `${Math.round(value * 100) / 100}px`;
const box = (rect) => `left:${px(rect.x)};top:${px(rect.y)};width:${px(rect.width)};height:${px(rect.height)}`;

/** The word over each kind of node, so a board reads without a legend. */
const KIND_WORD = { trigger: 'WHEN', reaction: 'DO', state: 'STATE', automatic: 'BY ITSELF' };

/** What an empty lens says, in the words of the thing that is missing. */
const EMPTY_COPY = {
  all: 'Nothing decides when this mascot moves yet. Add a reaction, an automatic behaviour or a state from the column on the left.',
  reactions: 'No reactions yet. A reaction is one sentence: <b>when</b> clicked, <b>do</b> Surprised, <b>then</b> return to idle.',
  automatic: 'Nothing runs by itself yet. Blink and Natural gaze are one press away in the column on the left.',
  states: 'No states yet. A state is a pose the mascot holds; a transition is a move it is allowed to make between two of them.'
};

/**
 * The board as markup.
 *
 * Pure: the same document and the same view produce the same string, which is
 * what lets the board keep rendering by replacing its own `innerHTML` while the
 * listeners live on the host above it.
 */
export function renderBoard(document = {}, {
  view = { x: 0, y: 0, scale: 1 }, lens = 'all', selection = [], edges: chosenEdges = [],
  live = null, firing = null, stage = 'small'
} = {}) {
  const board = deriveBoard(document, { lens, selection, edges: chosenEdges });
  const { bounds } = board;
  const counter = Math.round((1 / (view.scale || 1)) * 1000) / 1000;

  const node = (item) => {
    const picked = item.kind === 'state'
      ? ` data-select-state="${esc(item.key)}"`
      : ` data-select-${item.kind}="${esc(item.key)}"`;
    const classes = ['graph-node', 'board-node', item.selected ? 'selected' : '', item.dim ? 'dim' : '',
      item.kind === 'state' && item.key === live ? 'live' : '', item.enabled === false ? 'off' : ''].filter(Boolean).join(' ');
    // A port is offered where a link can start: a state (a transition) and a
    // reaction (an "only if" onto a state). Dragging from a trigger would be
    // drawing the one edge the model does not let an author author.
    const port = item.kind === 'state' || item.kind === 'reaction'
      ? `<span class="graph-port" data-graph-port="${esc(item.id)}" aria-hidden="true" title="Drag to a state to link them"></span>` : '';
    return `<button type="button" class="${classes}" style="${box(item.box)}" data-graph-node="${esc(item.id)}" data-board-kind="${item.kind}"${picked}
      aria-pressed="${item.selected}" title="${esc(item.name)} — ${esc(item.detail)}">
      <em>${KIND_WORD[item.kind]}</em><b>${item.initial ? '● ' : ''}${esc(item.name)}</b><small>${esc(item.detail)}</small>${port}</button>`;
  };

  // Two paths per edge: the one you see, and a fat transparent one you can hit.
  // An 8 px curve is a 2 px target at a readable zoom, which is an edge nobody
  // can select without three tries.
  const edge = (item) => {
    const marker = item.kind === 'guard' ? 'board-arrow-soft' : 'graph-arrow';
    const hit = item.kind === 'transition' ? ` data-select-transition="${esc(item.key)}" data-graph-link="${esc(item.key)}"` : ` data-board-edge="${esc(item.key)}"`;
    const line = item.kind === 'transition' ? ` data-graph-link-line="${esc(item.key)}"` : '';
    const classes = ['graph-link', `link-${item.kind}`, item.selected ? 'selected' : '', item.dim ? 'dim' : '',
      item.key === firing ? 'firing' : ''].filter(Boolean).join(' ');
    return `<path class="graph-link-hit" d="${item.d}"${hit}></path>
      <path class="${classes}" d="${item.d}" marker-end="url(#${marker})"${line}></path>`;
  };

  /**
   * A label is drawn *against* the zoom rather than with it.
   *
   * Scaled with the scene it is either eight illegible pixels or a banner
   * across two nodes, and at the zoom a whole board fits into a window it is
   * the former — which is how a label ends up hidden and the transition it
   * named ends up unclickable. The counter-scale is a custom property on the
   * scene rather than a number baked into each label, because a pan or a zoom
   * then writes one style on one element and never re-renders.
   */
  const label = (item) => (item.text
    ? `<button type="button" class="graph-link-label link-${item.kind}${item.selected ? ' selected' : ''}${item.dim ? ' dim' : ''}" style="left:${px(item.label.x)};top:${px(item.label.y)}"
      ${item.kind === 'transition' ? `data-select-transition="${esc(item.key)}"` : `data-board-edge="${esc(item.key)}"`} aria-label="${esc(item.from)} to ${esc(item.to)}">${esc(item.text)}</button>` : '');

  const group = (item) => `<div class="graph-group" data-graph-group="${esc(item.id)}" style="${box(item.box)}">
    <span class="graph-group-head"><b data-graph-group-name="${esc(item.id)}" role="button" tabindex="0" title="Rename this group">${esc(item.name)}</b>
    <button type="button" class="link" data-graph-ungroup="${esc(item.id)}" aria-label="Ungroup ${esc(item.name)}">×</button></span></div>`;

  const comment = (item) => `<div class="graph-comment" data-graph-comment="${esc(item.id)}" style="${box(item)}">
    <textarea data-graph-comment-text="${esc(item.id)}" aria-label="Note" placeholder="What this part of the board is for…">${esc(item.text)}</textarea>
    <button type="button" class="link graph-comment-remove" data-graph-comment-remove="${esc(item.id)}" aria-label="Delete note">×</button></div>`;

  const lensChip = (entry) => `<button type="button" role="tab" class="board-lens${entry.id === board.lens ? ' active' : ''}" data-board-lens="${entry.id}"
    aria-selected="${entry.id === board.lens}" title="${esc(entry.hint)}">${esc(entry.label)}${entry.id === 'all' ? '' : `<small>${board.counts[entry.id === 'reactions' ? 'reaction' : entry.id === 'automatic' ? 'automatic' : 'state']}</small>`}</button>`;

  const states = board.nodes.filter((item) => item.kind === 'state');
  const transitions = board.edges.filter((item) => item.kind === 'transition');
  const empty = board.nodes.length ? '' : `<p class="empty">${EMPTY_COPY[board.lens]}</p>`;
  const picked = selection.length + chosenEdges.length;

  return `<section class="behavior-board" data-graph data-board-showing="${board.lens}" data-board-stage="${stage}"
    data-graph-nodes="${states.length}" data-graph-links="${transitions.length}"
    data-board-selection="${picked}" aria-label="Behavior board">
    <div class="board-bar">
      <div class="board-lenses" role="tablist" aria-label="What the board shows">${BOARD_LENSES.map(lensChip).join('')}</div>
      <div class="graph-tools">
        <button type="button" data-graph-zoom="out" aria-label="Zoom out">−</button>
        <output data-graph-scale>${Math.round(view.scale * 100)}%</output>
        <button type="button" data-graph-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-graph-fit aria-label="Fit the whole board">Fit</button>
        <button type="button" data-graph-arrange aria-label="Arrange everything">Arrange</button>
        <button type="button" data-graph-note aria-label="Add a note">+ Note</button>
        <button type="button" data-graph-group aria-label="Group the selected states"${selection.length > 1 ? '' : ' disabled'}>Group</button>
        <span class="board-stage-switch" role="group" aria-label="Mascot stage">
          ${[['off', 'Off'], ['small', 'S'], ['large', 'L']].map(([id, text]) =>
            `<button type="button" data-board-stage="${id}" class="${stage === id ? 'active' : ''}" aria-pressed="${stage === id}" aria-label="Mascot ${text === 'S' ? 'small' : text === 'L' ? 'large' : 'hidden'}">${text}</button>`).join('')}
        </span>
      </div>
    </div>
    <div class="graph-viewport" data-graph-viewport tabindex="0" role="application"
      aria-label="Behavior board: drag a node to move it, drag its handle to another node to link them, Tab cycles the transitions leaving the selected state">
      <div class="graph-scene" data-graph-scene style="transform:translate(${px(view.x)},${px(view.y)}) scale(${view.scale});--graph-counter:${counter}">
        ${board.groups.map(group).join('')}
        <svg class="graph-links" style="left:${px(bounds.x)};top:${px(bounds.y)};width:${px(bounds.width)};height:${px(bounds.height)}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" aria-hidden="true">
          <defs>
            <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z"/></marker>
            <marker id="board-arrow-soft" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 2 L 9 5 L 0 8 z"/></marker>
          </defs>
          ${board.edges.map(edge).join('')}
          <path class="graph-draft" data-graph-draft hidden></path>
        </svg>
        ${board.edges.map(label).join('')}
        ${board.nodes.map(node).join('')}
        ${board.comments.map(comment).join('')}
      </div>
      <div class="graph-marquee" data-graph-marquee hidden></div>
      ${empty}
    </div>
    <p class="small board-help">Drag a node to move it · drag the handle on its right onto another to link them · click a transition to tune it, <b>shift-click</b> to tune several at once · <b>Tab</b> cycles the transitions leaving a state · scroll to zoom, drag the background to select, hold Space to pan.</p>
  </section>`;
}

/**
 * The board, wired.
 *
 * It owns its host and re-renders itself. The panel above it used to do that —
 * `state-machine-panel.js` rebuilt its whole column, diagram included, inside
 * an `input` handler — and every piece of care in the old view existed to
 * survive it. A board that redraws only itself needs none of that, and keeps
 * the parts that are about pointers rather than about the panel: a drag paints
 * with a CSS transform and writes **once**, on release.
 */
export function createBehaviorBoard({
  store, history, preview = null, onStatus = () => {}, onSelect = () => {},
  getLens = () => 'all', setLens = () => {}, getStage = () => 'small', setStage = () => {},
  addTransition = () => {}, deleteTransitions = () => {}
}) {
  const commands = createBoardCommands(store, history);
  const graphCommands = createGraphCommands(store, history);
  let host = null, view = { x: 24, y: 24, scale: 1 }, drag = null, fitted = false, panKey = false;
  // The zoom below which a node's own name stops being readable. Measured
  // rather than chosen: a board's `<small>` is 9 px, and 9 × .6 is where it
  // stops resolving into letters.
  const READABLE = .6;
  let selection = { nodes: [], edges: [] };
  let painted = { live: null, firing: null };

  const q = (selector) => host?.querySelector(selector) || null;
  const viewport = () => q('[data-graph-viewport]');
  const scene = () => q('[data-graph-scene]');
  const visible = () => Boolean(viewport());
  const doc = () => store.getDocument();
  const pointIn = (event) => {
    const rect = viewport()?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: 0, y: 0 };
  };

  /** The transform, written straight onto the scene: a pan must not re-render. */
  const applyView = () => {
    const node = scene();
    if (node) {
      node.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
      node.style.setProperty('--graph-counter', String(Math.round((1 / (view.scale || 1)) * 1000) / 1000));
    }
    const output = q('[data-graph-scale]');
    if (output) output.value = `${Math.round(view.scale * 100)}%`;
  };

  const sameSelection = (next) => next.nodes.length === selection.nodes.length && next.edges.length === selection.edges.length
    && next.nodes.every((id, index) => id === selection.nodes[index]) && next.edges.every((id, index) => id === selection.edges[index]);

  /**
   * One selection for the whole board.
   *
   * Nodes and edges together, because the inspector answers for both and the
   * old model — one state name and one `"from->to"` string — could not hold
   * "these four transitions", which is the edit this redesign exists to make
   * possible.
   */
  function setSelection(next, { render = true, announce = true } = {}) {
    const chosen = { nodes: [...new Set(next.nodes || [])], edges: [...new Set(next.edges || [])] };
    const same = sameSelection(chosen);
    selection = chosen;
    if (announce) onSelect(getSelection());
    if (render && !same) draw();
  }

  const getSelection = () => {
    const nodes = selection.nodes.map((id) => ({ id, ...readNodeId(id) }));
    return { nodes, edges: [...selection.edges], primary: nodes[0] || null };
  };

  const fit = () => {
    const rect = viewport()?.getBoundingClientRect();
    if (!rect?.width) return;
    const board = deriveBoard(doc(), { lens: getLens(), selection: selection.nodes, edges: selection.edges });
    view = fitView(board.bounds, { width: rect.width, height: rect.height });
    applyView();
  };

  /**
   * Where the board opens, which is not the same question as *Fit*.
   *
   * Fit means "show me all of it" and has to keep meaning that. But a project
   * with twenty-one reactions fits at 32 %, where every label is four pixels
   * tall — so arriving on a board that large opens it **readable and centred
   * on something** instead, and Fit is one press away for the overview.
   */
  function openView() {
    const rect = viewport()?.getBoundingClientRect();
    if (!rect?.width) return;
    const board = deriveBoard(doc(), { lens: getLens(), selection: selection.nodes, edges: selection.edges });
    const fitted = fitView(board.bounds, { width: rect.width, height: rect.height });
    if (fitted.scale >= READABLE) { view = fitted; applyView(); return; }
    const anchor = board.nodes.find((node) => node.selected)
      || board.nodes.find((node) => node.kind === 'state' && node.initial)
      || board.nodes[0];
    const centre = anchor ? { x: anchor.box.x + anchor.box.width / 2, y: anchor.box.y + anchor.box.height / 2 }
      : { x: board.bounds.x + board.bounds.width / 2, y: board.bounds.y + board.bounds.height / 2 };
    view = { scale: READABLE, x: rect.width / 2 - centre.x * READABLE, y: rect.height / 2 - centre.y * READABLE };
    applyView();
  }

  /** Zoom about a point, so the thing under the pointer stays under it. */
  const zoomAt = (point, direction) => {
    const next = zoomedBy(view.scale, direction);
    if (next === view.scale) return;
    const graphPoint = toGraph(point, view);
    view = { scale: next, x: point.x - graphPoint.x * next, y: point.y - graphPoint.y * next };
    applyView();
  };

  const paintDrag = () => {
    if (drag?.kind !== 'nodes') return;
    for (const id of drag.ids) {
      const node = q(`[data-graph-node="${CSS.escape(id)}"]`);
      if (node) node.style.translate = `${drag.delta.x}px ${drag.delta.y}px`;
    }
  };
  const clearDragPaint = () => { for (const node of host?.querySelectorAll('[data-graph-node]') || []) node.style.translate = ''; };

  const paintDraft = () => {
    const path = q('[data-graph-draft]');
    if (!path || drag?.kind !== 'link') return;
    path.setAttribute('d', `M ${drag.origin.x} ${drag.origin.y} L ${drag.to.x} ${drag.to.y}`);
    path.removeAttribute('hidden');
  };

  const paintMarquee = () => {
    const node = q('[data-graph-marquee]');
    if (!node || drag?.kind !== 'marquee') return;
    const left = Math.min(drag.origin.x, drag.now.x), top = Math.min(drag.origin.y, drag.now.y);
    node.style.cssText = `left:${left}px;top:${top}px;width:${Math.abs(drag.now.x - drag.origin.x)}px;height:${Math.abs(drag.now.y - drag.origin.y)}px`;
    node.removeAttribute('hidden');
  };

  const boardNow = () => deriveBoard(doc(), { lens: getLens(), selection: selection.nodes, edges: selection.edges });

  function onPointerDown(event) {
    if (!visible() || event.button === 2) return;
    const point = pointIn(event);
    const port = event.target.closest?.('[data-graph-port]');
    if (port) {
      event.preventDefault(); event.stopPropagation();
      const from = boardNow().nodes.find((item) => item.id === port.dataset.graphPort);
      drag = { kind: 'link', from: port.dataset.graphPort, origin: from ? { x: from.box.x + from.box.width, y: from.box.y + from.box.height / 2 } : toGraph(point, view), to: toGraph(point, view) };
      paintDraft();
      return;
    }
    const node = event.target.closest?.('[data-graph-node]');
    if (node) {
      const id = node.dataset.graphNode;
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      const nodes = additive
        ? (selection.nodes.includes(id) ? selection.nodes.filter((item) => item !== id) : [...selection.nodes, id])
        : (selection.nodes.includes(id) ? selection.nodes : [id]);
      setSelection({ nodes, edges: additive ? selection.edges : [] });
      drag = { kind: 'nodes', ids: nodes.includes(id) ? nodes : [id], origin: point, delta: { x: 0, y: 0 } };
      return;
    }
    // An edge is picked on press, and adds on shift: picking four transitions
    // is four clicks rather than four trips through a number field.
    const line = event.target.closest?.('[data-select-transition]');
    if (line) {
      const key = line.dataset.selectTransition;
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      setSelection({ nodes: [], edges: additive ? (selection.edges.includes(key) ? selection.edges.filter((item) => item !== key) : [...selection.edges, key]) : [key] });
      event.preventDefault();
      return;
    }
    if (event.target.closest?.('[data-graph-comment], .graph-group-head, .board-bar')) return;
    if (!event.target.closest?.('[data-graph-viewport]')) return;
    drag = event.button === 1 || event.altKey || panKey
      ? { kind: 'pan', origin: point, from: { ...view } }
      : { kind: 'marquee', origin: point, now: point, additive: event.shiftKey };
    if (drag.kind === 'marquee') paintMarquee();
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!drag) return;
    const point = pointIn(event);
    if (drag.kind === 'nodes') { drag.delta = { x: (point.x - drag.origin.x) / view.scale, y: (point.y - drag.origin.y) / view.scale }; paintDrag(); return; }
    if (drag.kind === 'pan') { view = { ...view, x: drag.from.x + (point.x - drag.origin.x), y: drag.from.y + (point.y - drag.origin.y) }; applyView(); return; }
    if (drag.kind === 'marquee') { drag.now = point; paintMarquee(); return; }
    if (drag.kind === 'link') { drag.to = toGraph(point, view); paintDraft(); }
  }

  function onPointerUp(event) {
    if (!drag) return;
    const finished = drag;
    drag = null;
    if (finished.kind === 'nodes') {
      clearDragPaint();
      // A press that never moved is a selection, not a move: writing a
      // zero-delta history step for every click would fill undo with nothing.
      if (Math.abs(finished.delta.x) > .5 || Math.abs(finished.delta.y) > .5) {
        try { commands.moveNodes(finished.ids, finished.delta); } catch (error) { onStatus(error.message, 'warn'); }
      }
      draw();
      return;
    }
    if (finished.kind === 'marquee') {
      const node = q('[data-graph-marquee]');
      if (node) node.hidden = true;
      const a = toGraph(finished.origin, view), b = toGraph(finished.now, view);
      const hit = nodesInBox(boardNow().nodes, { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y });
      setSelection({ nodes: finished.additive ? [...selection.nodes, ...hit] : hit, edges: finished.additive ? selection.edges : [] });
      return;
    }
    if (finished.kind === 'link') {
      const path = q('[data-graph-draft]');
      if (path) path.hidden = true;
      const target = event.target.closest?.('[data-graph-node]');
      const to = target?.dataset.graphNode;
      if (to && to !== finished.from) addTransition(readNodeId(finished.from), readNodeId(to));
      else draw();
    }
  }

  /**
   * The keyboard half of picking an edge.
   *
   * A diagram is bad at exactly one thing: picking one curve out of several
   * leaving the same box. `Tab` walks them, in the order they were authored,
   * which is the fix that costs an author nothing to learn.
   */
  function onKeyDown(event) {
    if (!visible()) return;
    if (event.code === 'Space') { panKey = true; if (event.target.closest?.('[data-graph-viewport]')) event.preventDefault(); return; }
    if (!event.target.closest?.('[data-graph-viewport], [data-graph-node]')) return;
    if (event.key === 'Escape') { setSelection({ nodes: [], edges: [] }); return; }
    if (event.key === 'Tab') {
      const from = selection.nodes.map(readNodeId).find((item) => item.kind === 'state')?.key
        || (selection.edges[0] || '').split('->')[0];
      const keys = outgoingKeys(doc(), from);
      if (!keys.length) return;
      event.preventDefault();
      const at = keys.indexOf(selection.edges[0]);
      const next = keys[(at + (event.shiftKey ? keys.length - 1 : 1)) % keys.length];
      setSelection({ nodes: [], edges: [next] });
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selection.edges.length) {
      event.preventDefault();
      deleteTransitions([...selection.edges]);
    }
  }
  const onKeyUp = (event) => { if (event.code === 'Space') panKey = false; };

  function onWheel(event) {
    if (!event.target.closest?.('[data-graph-viewport]')) return;
    event.preventDefault();
    zoomAt(pointIn(event), event.deltaY < 0 ? 1 : -1);
  }

  function onClick(event) {
    const button = event.target.closest?.('button, [data-graph-group-name]');
    if (!button || !host.contains(button)) return;
    const data = button.dataset;
    try {
      if (data.boardLens) { setLens(data.boardLens); draw(); queueMicrotask(openView); return; }
      if (data.boardStage) { setStage(data.boardStage); draw(); return; }
      if (data.graphZoom) { const rect = viewport().getBoundingClientRect(); zoomAt({ x: rect.width / 2, y: rect.height / 2 }, data.graphZoom === 'in' ? 1 : -1); return; }
      if (data.graphFit !== undefined) { fit(); return; }
      if (data.graphArrange !== undefined) { arrange(); return; }
      if (data.graphNote !== undefined) { const rect = viewport().getBoundingClientRect(); graphCommands.addComment(toGraph({ x: rect.width / 2, y: rect.height / 3 }, view)); draw(); return; }
      if (data.graphGroup !== undefined) { graphCommands.group(selection.nodes.filter((id) => readNodeId(id).kind === 'state')); onStatus(`${selection.nodes.length} states grouped.`); draw(); return; }
      if (data.graphUngroup) { graphCommands.ungroup(data.graphUngroup); draw(); return; }
      if (data.graphCommentRemove) { graphCommands.removeComment(data.graphCommentRemove); draw(); return; }
      if (data.graphGroupName) {
        const next = globalThis.prompt?.('Group name', button.textContent.trim());
        if (next) { graphCommands.renameGroup(data.graphGroupName, next); draw(); }
      }
    } catch (error) { onStatus(error.message, 'warn'); }
  }

  /**
   * Arrange puts everything back where the layout puts it — the triggers, the
   * reactions and the behaviours included, which is why it is the board's own
   * command rather than the state machine's: one press, one history step.
   */
  function arrange() {
    try { commands.arrange(); onStatus('Everything back where the layout puts it.'); }
    catch (error) { onStatus(error.message, 'warn'); }
    draw();
    openView();
  }

  /** A note is typed, not dialogued: the box on the board is the field. */
  function onChange(event) {
    const id = event.target.dataset?.graphCommentText;
    if (!id) return;
    try { graphCommands.updateComment(id, { text: event.target.value }); } catch (error) { onStatus(error.message, 'warn'); }
  }

  function draw() {
    if (!host) return;
    const state = doc();
    // A selection outliving what it named is a Group button that refuses and an
    // inspector about nothing.
    const board = deriveBoard(state, { lens: getLens(), selection: selection.nodes, edges: selection.edges });
    const alive = new Set(board.nodes.map((item) => item.id)), edges = new Set(board.edges.map((item) => item.key));
    const kept = { nodes: selection.nodes.filter((id) => alive.has(id)), edges: selection.edges.filter((key) => edges.has(key)) };
    if (!sameSelection(kept)) { selection = kept; onSelect(getSelection()); }
    const session = preview?.getSession?.();
    painted = { live: session?.previewState || state.activeState || null, firing: session?.transitionEdge || null };
    host.innerHTML = renderBoard(state, { view, lens: getLens(), selection: selection.nodes, edges: selection.edges, stage: getStage(), ...painted });
    // A board that has never been looked at opens fitted, once: arriving at a
    // twelve-state machine should not mean finding it first.
    if (!fitted) queueMicrotask(() => { if (!fitted && visible()) { fitted = true; openView(); } });
    else applyView();
  }

  return {
    render: draw,
    attach(element) {
      host = element;
      host.addEventListener('pointerdown', onPointerDown);
      host.addEventListener('wheel', onWheel, { passive: false });
      host.addEventListener('click', onClick);
      host.addEventListener('change', onChange);
      host.addEventListener('keydown', onKeyDown);
      host.addEventListener('keyup', onKeyUp);
      globalThis.addEventListener?.('pointermove', onPointerMove);
      globalThis.addEventListener?.('pointerup', onPointerUp);
      draw();
    },
    destroy() {
      globalThis.removeEventListener?.('pointermove', onPointerMove);
      globalThis.removeEventListener?.('pointerup', onPointerUp);
      if (host) host.innerHTML = '';
      host = null;
    },
    /**
     * The live highlight, written onto the nodes rather than re-rendered.
     *
     * Called from the editor's own frame callback, so it costs nothing while
     * the preview is asleep and never fights an author who is mid-drag.
     */
    syncLive() {
      if (drag || !host) return;
      const session = preview?.getSession?.();
      const live = session?.previewState || doc().activeState || null;
      const firing = session?.transitionEdge || null;
      if (live === painted.live && firing === painted.firing) return;
      if (!visible()) { painted = { live: null, firing: null }; return; }
      painted = { live, firing };
      for (const node of host.querySelectorAll('[data-graph-node][data-board-kind="state"]')) node.classList.toggle('live', node.dataset.graphNode === live);
      for (const line of host.querySelectorAll('[data-graph-link-line]')) line.classList.toggle('firing', line.dataset.graphLinkLine === firing);
    },
    select: (next, options) => setSelection({ nodes: [], edges: [], ...next }, options),
    getSelection,
    getView: () => ({ ...view }),
    setView(next) { view = { ...view, ...next, scale: Math.min(GRAPH_ZOOM.max, Math.max(GRAPH_ZOOM.min, next.scale ?? view.scale)) }; applyView(); },
    fit,
    /** Session-only diagnostics, for browser specs. */
    snapshot: () => ({ view: { ...view }, lens: getLens(), selection: { ...selection }, dragging: drag?.kind || null })
  };
}
