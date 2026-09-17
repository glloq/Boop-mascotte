/**
 * The state machine, as a diagram somebody can actually work in
 * (V4-100 … V4-106, docs/V4_ROADMAP.md Phase 10).
 *
 * What it replaces is 43 lines that drew every state on one horizontal line and
 * every transition as a bar in a lane above it. That is legible for four states
 * and unreadable for twelve, and nothing an author moved was kept, because
 * positions were recomputed on every render.
 *
 * ```text
 * V4-100  a node's position is authored data, undone and saved like a transition
 * V4-101  pan, zoom, drag — and a Fit that always gets you back
 * V4-102  links are drawn: a curve with an arrowhead, made by dragging a port
 * V4-103  the state the mascot is in, and the transition currently playing
 * V4-104  triggers fired from the diagram (see `graph-triggers.js`)
 * V4-105  marquee selection, groups, one-press auto-arrange
 * V4-106  notes
 * ```
 *
 * Split in two on purpose: `markup()` is a pure function of the document and
 * the view, so every layout decision is testable in Node, and `attach()` binds
 * the pointer work to the panel's own host — which is stable across the
 * panel's re-renders, so delegated listeners survive them.
 */
import {
  GRAPH_NODE, GRAPH_ZOOM, fitView, graphBounds, groupBox, linkBows, linkGeometry,
  nodeBox, nodesFor, nodesInMarquee, normalizeGraphLayout, toGraph, zoomedBy
} from '../../core/state-machine/graph-layout.js';
import { createGraphCommands } from '../../core/state-machine/graph-commands.js';
import { esc } from '../../ui/escape-html.js';


/**
 * Everything the diagram draws, derived once.
 *
 * Exported because it is the whole of the layout decision, and a test that has
 * to read it out of an HTML string is a test about string formatting.
 */
export function deriveGraph(document = {}, { selection = [], selectedEdge = null } = {}) {
  const layout = normalizeGraphLayout(document.graphLayout);
  const nodes = nodesFor(document, layout);
  const names = Object.keys(nodes);
  const incoming = Object.fromEntries(names.map((name) => [name, 0]));
  const bows = linkBows(document.transitions || {});
  const links = [];
  for (const [from, targets] of Object.entries(document.transitions || {})) {
    for (const to of targets || []) {
      if (!nodes[from] || !nodes[to]) continue;
      incoming[to] += 1;
      const key = `${from}->${to}`;
      const settings = document.transitionSettings?.[key] || {};
      links.push({
        key, from, to, selected: key === selectedEdge,
        duration: settings.duration ?? 300, easing: settings.easing || 'easeInOut',
        ...linkGeometry(nodes[from], nodes[to], { bow: bows.get(key) || 0 })
      });
    }
  }
  const chosen = new Set(selection);
  return {
    nodes, links,
    groups: layout.groups.map((group) => ({ ...group, box: groupBox(group, nodes) })).filter((group) => group.box),
    comments: layout.comments,
    bounds: graphBounds(nodes, layout.comments),
    states: names.map((name) => ({
      name, point: nodes[name], selected: chosen.has(name),
      incoming: incoming[name], outgoing: (document.transitions?.[name] || []).length,
      initial: name === document.activeState
    }))
  };
}

const px = (value) => `${Math.round(value * 100) / 100}px`;
const box = (rect) => `left:${px(rect.x)};top:${px(rect.y)};width:${px(rect.width)};height:${px(rect.height)}`;

/**
 * The diagram as markup.
 *
 * Pure: the same document and the same view produce the same string, which is
 * what lets the panel keep rendering by replacing its own `innerHTML` while the
 * listeners live on the host above it.
 */
export function renderStateGraph(document = {}, {
  view = { x: 0, y: 0, scale: 1 }, selection = [], selectedEdge = null, live = null, firing = null
} = {}) {
  const graph = deriveGraph(document, { selection, selectedEdge });
  const { bounds } = graph;

  const node = (state) => `<button type="button" class="graph-node${state.selected ? ' selected' : ''}${state.name === live ? ' live' : ''}"
    style="${box(nodeBox(state.point))}" data-select-state="${esc(state.name)}" data-graph-node="${esc(state.name)}"
    aria-pressed="${state.selected}" title="${esc(state.name)} · ${state.incoming} in · ${state.outgoing} out">
    <b>${state.initial ? '● ' : ''}${esc(state.name)}</b><small>${state.incoming} in · ${state.outgoing} out</small>
    <span class="graph-port" data-graph-port="${esc(state.name)}" aria-hidden="true" title="Drag to another state to add a transition"></span></button>`;

  // Two paths per link: the one you see, and a fat transparent one you can hit.
  // An 8 px curve is a 2 px target at a readable zoom, which is a link nobody
  // can select without three tries.
  const link = (item) => `<path class="graph-link-hit" d="${item.d}" data-select-transition="${esc(item.key)}" data-graph-link="${esc(item.key)}"></path>
    <path class="graph-link${item.selected ? ' selected' : ''}${item.key === firing ? ' firing' : ''}" d="${item.d}" marker-end="url(#graph-arrow)" data-graph-link-line="${esc(item.key)}"></path>`;

  /**
   * A link's label is drawn *against* the zoom rather than with it.
   *
   * Scaled with the scene it is either eight illegible pixels or a banner
   * across two nodes — and at the zoom a whole machine fits into this column it
   * is the former, which is how a label ends up hidden and the transition it
   * named ends up unclickable. The counter-scale is a custom property on the
   * scene rather than a number baked into each label, because a pan or a zoom
   * writes one style on one element and never re-renders.
   */
  const label = (item) => `<button type="button" class="graph-link-label${item.selected ? ' selected' : ''}" style="left:${px(item.label.x)};top:${px(item.label.y)}"
    data-select-transition="${esc(item.key)}" aria-label="${esc(item.from)} to ${esc(item.to)}">${item.duration} ms</button>`;

  const group = (item) => `<div class="graph-group" data-graph-group="${esc(item.id)}" style="${box(item.box)}">
    <span class="graph-group-head"><b data-graph-group-name="${esc(item.id)}" role="button" tabindex="0" title="Rename this group">${esc(item.name)}</b>
    <button type="button" class="link" data-graph-ungroup="${esc(item.id)}" aria-label="Ungroup ${esc(item.name)}">×</button></span></div>`;

  const comment = (item) => `<div class="graph-comment" data-graph-comment="${esc(item.id)}" style="${box(item)}">
    <textarea data-graph-comment-text="${esc(item.id)}" aria-label="Note" placeholder="What this part of the machine is for…">${esc(item.text)}</textarea>
    <button type="button" class="link graph-comment-remove" data-graph-comment-remove="${esc(item.id)}" aria-label="Delete note">×</button></div>`;

  const empty = graph.states.length
    ? ''
    : '<p class="empty">No states yet. A state is a pose the mascot holds; a transition is a move it is allowed to make between two of them.</p>';

  return `<section class="transition-graph" data-graph data-graph-nodes="${graph.states.length}" data-graph-links="${graph.links.length}" aria-label="State graph">
    <div class="section-heading"><h3>State graph</h3><div class="graph-tools">
      <button type="button" data-graph-zoom="out" aria-label="Zoom out">−</button>
      <output data-graph-scale>${Math.round(view.scale * 100)}%</output>
      <button type="button" data-graph-zoom="in" aria-label="Zoom in">+</button>
      <button type="button" data-graph-fit aria-label="Fit the whole diagram">Fit</button>
      <button type="button" data-graph-arrange aria-label="Arrange every state">Arrange</button>
      <button type="button" data-graph-note aria-label="Add a note">+ Note</button>
      <button type="button" data-graph-group aria-label="Group the selected states"${selection.length > 1 ? '' : ' disabled'}>Group</button>
    </div></div>
    <div class="graph-viewport" data-graph-viewport tabindex="0" role="application" aria-label="State graph: drag a state to move it, drag its handle to another state to add a transition">
      <div class="graph-scene" data-graph-scene style="transform:translate(${px(view.x)},${px(view.y)}) scale(${view.scale});--graph-counter:${Math.round((1 / (view.scale || 1)) * 1000) / 1000}">
        ${graph.groups.map(group).join('')}
        <svg class="graph-links" style="left:${px(bounds.x)};top:${px(bounds.y)};width:${px(bounds.width)};height:${px(bounds.height)}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" aria-hidden="true">
          <defs><marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z"/></marker></defs>
          ${graph.links.map(link).join('')}
          <path class="graph-draft" data-graph-draft hidden></path>
        </svg>
        ${graph.links.map(label).join('')}
        ${graph.states.map(node).join('')}
        ${graph.comments.map(comment).join('')}
      </div>
      <div class="graph-marquee" data-graph-marquee hidden></div>
      ${empty}
    </div>
    <p class="small">Drag a state to move it. Drag the handle on its right to another state to add a transition. Scroll to zoom, drag the background to select, hold Space or the middle button to pan.</p>
  </section>`;
}

/**
 * The pointer half.
 *
 * Bound to the panel's host once, not to the markup: the panel rewrites its own
 * `innerHTML` on every edit, so a listener on a node would be gone the first
 * time anything changed.
 *
 * A drag moves the nodes with a CSS transform and writes **once**, on release.
 * Writing per pointer move would be sixty undo steps for one gesture, and a
 * store notification per frame for a diagram that is already on screen.
 */
export function createGraphView({ store, history, preview = null, onSelectState = () => {}, onStatus = () => {}, requestRender = () => {}, addTransition = () => {} }) {
  const commands = createGraphCommands(store, history);
  let host = null, view = { x: 24, y: 24, scale: 1 }, selection = [], drag = null, fitted = false;
  // Held Space turns a background drag into a pan, which is the gesture every
  // canvas in this editor already uses.
  let panKey = false;

  const q = (selector) => host?.querySelector(selector) || null;
  const viewport = () => q('[data-graph-viewport]');
  const scene = () => q('[data-graph-scene]');
  const visible = () => Boolean(viewport());
  const pointIn = (event) => {
    const rect = viewport()?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: 0, y: 0 };
  };

  /** The transform, written straight onto the scene: a pan must not re-render. */
  const applyView = () => {
    const node = scene();
    if (node) {
      node.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
      // Whatever is drawn against the zoom follows it here, so a pan or a zoom
      // stays one style write on one element.
      node.style.setProperty('--graph-counter', String(Math.round((1 / (view.scale || 1)) * 1000) / 1000));
    }
    const output = q('[data-graph-scale]');
    if (output) output.value = `${Math.round(view.scale * 100)}%`;
  };

  const setSelection = (names, { render = true } = {}) => {
    selection = [...new Set(names)];
    onSelectState(selection[0] || null);
    if (render) requestRender();
  };

  const fit = () => {
    const rect = viewport()?.getBoundingClientRect();
    const graph = deriveGraph(store.getDocument(), { selection });
    if (rect?.width) { view = fitView(graph.bounds, { width: rect.width, height: rect.height }); applyView(); }
  };

  /** Zoom about a point, so the thing under the pointer stays under it. */
  const zoomAt = (point, direction) => {
    const next = zoomedBy(view.scale, direction);
    if (next === view.scale) return;
    const graphPoint = toGraph(point, view);
    view = { scale: next, x: point.x - graphPoint.x * next, y: point.y - graphPoint.y * next };
    applyView();
  };

  /** Where a dragged node is drawn, before anything is written down. */
  const paintDrag = () => {
    if (drag?.kind !== 'nodes') return;
    for (const name of drag.names) {
      const node = q(`[data-graph-node="${CSS.escape(name)}"]`);
      if (node) node.style.translate = `${drag.delta.x}px ${drag.delta.y}px`;
    }
  };
  const clearDragPaint = () => {
    for (const node of host?.querySelectorAll('[data-graph-node]') || []) node.style.translate = '';
  };

  const paintDraft = () => {
    const path = q('[data-graph-draft]');
    if (!path || drag?.kind !== 'link') return;
    const nodes = nodesFor(store.getDocument());
    const from = nodes[drag.from];
    if (!from) return;
    const a = { x: from.x + GRAPH_NODE.width, y: from.y + GRAPH_NODE.height / 2 };
    path.setAttribute('d', `M ${a.x} ${a.y} L ${drag.to.x} ${drag.to.y}`);
    path.removeAttribute('hidden');
  };

  const paintMarquee = () => {
    const node = q('[data-graph-marquee]');
    if (!node || drag?.kind !== 'marquee') return;
    const left = Math.min(drag.origin.x, drag.now.x), top = Math.min(drag.origin.y, drag.now.y);
    node.style.cssText = `left:${left}px;top:${top}px;width:${Math.abs(drag.now.x - drag.origin.x)}px;height:${Math.abs(drag.now.y - drag.origin.y)}px`;
    node.removeAttribute('hidden');
  };

  function onPointerDown(event) {
    if (!visible() || event.button === 2) return;
    const point = pointIn(event);
    const port = event.target.closest?.('[data-graph-port]');
    if (port) {
      event.preventDefault(); event.stopPropagation();
      drag = { kind: 'link', from: port.dataset.graphPort, to: toGraph(point, view) };
      paintDraft();
      return;
    }
    const node = event.target.closest?.('[data-graph-node]');
    if (node) {
      const name = node.dataset.graphNode;
      // Shift or Ctrl adds to the selection; a plain press on something already
      // selected keeps the set, so dragging four nodes does not drop three.
      const additive = event.shiftKey || event.ctrlKey || event.metaKey;
      const next = additive
        ? (selection.includes(name) ? selection.filter((item) => item !== name) : [...selection, name])
        : (selection.includes(name) ? selection : [name]);
      setSelection(next);
      drag = { kind: 'nodes', names: next.includes(name) ? next : [name], origin: point, delta: { x: 0, y: 0 } };
      return;
    }
    if (event.target.closest?.('[data-graph-comment], .graph-group-head, .graph-tools, [data-select-transition]')) return;
    if (!event.target.closest?.('[data-graph-viewport]')) return;
    // Space, middle button or Alt is a pan; a plain drag on the background is a
    // marquee, because selecting is the thing done most often.
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
        try { commands.moveNodes(finished.names, finished.delta); } catch (error) { onStatus(error.message, 'warn'); }
      }
      requestRender();
      return;
    }
    if (finished.kind === 'marquee') {
      const node = q('[data-graph-marquee]');
      if (node) node.hidden = true;
      const a = toGraph(finished.origin, view), b = toGraph(finished.now, view);
      const hit = nodesInMarquee(nodesFor(store.getDocument()), { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y });
      setSelection(finished.additive ? [...selection, ...hit] : hit);
      return;
    }
    if (finished.kind === 'link') {
      const path = q('[data-graph-draft]');
      if (path) path.hidden = true;
      const target = event.target.closest?.('[data-graph-node]');
      const to = target?.dataset.graphNode;
      if (to && to !== finished.from) addTransition(finished.from, to);
      else requestRender();
    }
  }

  const onKeyDown = (event) => {
    if (event.code === 'Space' && visible()) { panKey = true; if (event.target.closest?.('[data-graph-viewport]')) event.preventDefault(); }
  };
  const onKeyUp = (event) => { if (event.code === 'Space') panKey = false; };

  function onWheel(event) {
    if (!event.target.closest?.('[data-graph-viewport]')) return;
    event.preventDefault();
    zoomAt(pointIn(event), event.deltaY < 0 ? 1 : -1);
  }

  function onClick(event) {
    // No containment check: the listener is on the host, so anything that
    // reaches it came from inside it.
    const button = event.target.closest?.('button, [data-graph-group-name]');
    if (!button) return;
    const data = button.dataset;
    try {
      if (data.graphZoom) { const rect = viewport().getBoundingClientRect(); zoomAt({ x: rect.width / 2, y: rect.height / 2 }, data.graphZoom === 'in' ? 1 : -1); return; }
      if (data.graphFit !== undefined) { fit(); return; }
      if (data.graphArrange !== undefined) { commands.arrange(); onStatus('Every state back where the layout puts it.'); requestRender(); fit(); return; }
      if (data.graphNote !== undefined) { const rect = viewport().getBoundingClientRect(); commands.addComment(toGraph({ x: rect.width / 2, y: rect.height / 3 }, view)); requestRender(); return; }
      if (data.graphGroup !== undefined) { commands.group(selection); onStatus(`${selection.length} states grouped.`); requestRender(); return; }
      if (data.graphUngroup) { commands.ungroup(data.graphUngroup); requestRender(); return; }
      if (data.graphCommentRemove) { commands.removeComment(data.graphCommentRemove); requestRender(); return; }
      if (data.graphGroupName) {
        const next = globalThis.prompt?.('Group name', button.textContent.trim());
        if (next) { commands.renameGroup(data.graphGroupName, next); requestRender(); }
      }
    } catch (error) { onStatus(error.message, 'warn'); }
  }

  /** A note is typed, not dialogued: the box on the diagram is the field. */
  function onChange(event) {
    const id = event.target.dataset?.graphCommentText;
    if (!id) return;
    try { commands.updateComment(id, { text: event.target.value }); } catch (error) { onStatus(error.message, 'warn'); }
  }

  return {
    markup(document, { selectedEdge = null } = {}) {
      const session = preview?.getSession?.();
      // A diagram that has never been looked at opens fitted, once: an author
      // arriving at a twelve-state machine should not have to find it first.
      if (!fitted) queueMicrotask(() => { if (!fitted && visible()) { fitted = true; fit(); } });
      // A selection outliving the state it named is a Group button that refuses.
      selection = selection.filter((name) => document.states?.[name]);
      return renderStateGraph(document, {
        view, selection, selectedEdge,
        live: session?.previewState || document.activeState || null,
        firing: session?.transitionEdge || null
      });
    },
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
    },
    detach() {
      globalThis.removeEventListener?.('pointermove', onPointerMove);
      globalThis.removeEventListener?.('pointerup', onPointerUp);
      host = null;
    },
    /**
     * The live highlight (V4-103), written onto the nodes rather than
     * re-rendered.
     *
     * Called from the editor's own frame callback, so it costs nothing while
     * the preview is asleep and never fights an author who is mid-drag.
     */
    syncLive() {
      if (!visible() || drag) return;
      const session = preview?.getSession?.();
      const live = session?.previewState || store.getDocument().activeState || null;
      const firing = session?.transitionEdge || null;
      for (const node of host.querySelectorAll('[data-graph-node]')) node.classList.toggle('live', node.dataset.graphNode === live);
      for (const line of host.querySelectorAll('[data-graph-link-line]')) line.classList.toggle('firing', line.dataset.graphLinkLine === firing);
    },
    select: (names) => setSelection(names, { render: false }),
    getSelection: () => [...selection],
    getView: () => ({ ...view }),
    setView(next) { view = { ...view, ...next, scale: Math.min(GRAPH_ZOOM.max, Math.max(GRAPH_ZOOM.min, next.scale ?? view.scale)) }; applyView(); },
    fit,
    /** Session-only diagnostics, for browser specs. */
    snapshot: () => ({ view: { ...view }, selection: [...selection], dragging: drag?.kind || null })
  };
}
