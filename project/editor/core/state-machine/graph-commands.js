/**
 * Authoring the diagram (V4-100 … V4-106, docs/V4_ROADMAP.md Phase 10).
 *
 * Moving a node is a project change, which means it is one history step, it is
 * undoable, and it is saved. That is the whole difference between a diagram and
 * a rendering: the old graph recomputed its positions on every render, so there
 * was no such thing as moving a node, only watching it be placed.
 *
 * Every write goes through `run`, the same preflight-then-execute shape the
 * rest of the state-machine commands use: a refusal is raised from a clone, so
 * a failed edit never reaches history.
 */
import { GRAPH_COMMENT, autoLayoutNodes, movedNodes, nodesFor, normalizeGraphLayout } from './graph-layout.js';

const uniqueId = (used, root) => {
  let id = `${root}-1`, n = 1;
  while (used.has(id)) id = `${root}-${++n}`;
  return id;
};

export function createGraphCommands(store, history) {
  const run = (type, apply) => {
    // Preflight on a clone: an edit that throws throws before history moves.
    apply(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'state-machine', domains: ['stateMachine'], apply: (document) => { result = apply(document); } });
    return result ?? true;
  };
  // Every write reads the layout back through the same normalizer the document
  // does, so a project opened from a file and one edited in place are the same
  // shape by the time anything writes to them.
  const layoutOf = (document) => normalizeGraphLayout(document.graphLayout);
  const write = (document, layout) => { document.graphLayout = normalizeGraphLayout(layout); };

  return {
    /**
     * Move a set of nodes by a delta.
     *
     * Everything that has no stored position is written down at the same time,
     * with the position it was already being drawn at. Otherwise dragging one
     * node of an auto-laid-out graph pins that one and leaves the rest free to
     * jump the moment a state is added.
     */
    moveNodes(names, delta) {
      const moving = (Array.isArray(names) ? names : [names]).filter(Boolean);
      if (!moving.length || (!delta?.x && !delta?.y)) return false;
      return run('graph/move', (document) => {
        const layout = layoutOf(document);
        write(document, { ...layout, nodes: movedNodes(nodesFor(document, layout), moving, { x: delta.x || 0, y: delta.y || 0 }) });
      });
    },

    /** Every node back where the layout would have put it. One step, undoable. */
    arrange() {
      return run('graph/arrange', (document) => {
        write(document, { ...layoutOf(document), nodes: autoLayoutNodes(document) });
      });
    },

    /** A note on the diagram, at a point in graph units. */
    addComment(point = { x: 0, y: 0 }, text = '') {
      return run('graph/comment-add', (document) => {
        const layout = layoutOf(document);
        const id = uniqueId(new Set(layout.comments.map((item) => item.id)), 'note');
        write(document, { ...layout, comments: [...layout.comments, { id, x: point.x, y: point.y, ...GRAPH_COMMENT, text }] });
        return id;
      });
    },

    updateComment(id, patch = {}) {
      return run('graph/comment-update', (document) => {
        const layout = layoutOf(document);
        if (!layout.comments.some((item) => item.id === id)) throw new Error('That note is no longer on the diagram.');
        write(document, { ...layout, comments: layout.comments.map((item) => (item.id === id ? { ...item, ...patch, id } : item)) });
      });
    },

    removeComment(id) {
      return run('graph/comment-remove', (document) => {
        const layout = layoutOf(document);
        if (!layout.comments.some((item) => item.id === id)) throw new Error('That note is no longer on the diagram.');
        write(document, { ...layout, comments: layout.comments.filter((item) => item.id !== id) });
      });
    },

    /**
     * Put a set of states in a named box.
     *
     * A group is a label over a region, not a container: the states stay where
     * they are and stay individually selectable. What it buys is a name for a
     * part of a machine — "asleep", "talking" — which is the thing a diagram of
     * twelve states is missing.
     */
    group(names, name = 'Group') {
      const members = [...new Set((Array.isArray(names) ? names : [names]).filter(Boolean))];
      if (members.length < 2) throw new Error('Select at least two states to group them.');
      return run('graph/group', (document) => {
        const layout = layoutOf(document);
        for (const member of members) if (!document.states?.[member]) throw new Error(`State "${member}" does not exist.`);
        const id = uniqueId(new Set(layout.groups.map((item) => item.id)), 'group');
        // A state belongs to one group: a box inside a box is a diagram that
        // needs its own diagram.
        const groups = layout.groups
          .map((group) => ({ ...group, members: group.members.filter((item) => !members.includes(item)) }))
          .filter((group) => group.members.length);
        write(document, { ...layout, groups: [...groups, { id, name: String(name).trim() || 'Group', members }] });
        return id;
      });
    },

    renameGroup(id, name) {
      const next = String(name ?? '').trim();
      if (!next) throw new Error('Give the group a name.');
      return run('graph/group-rename', (document) => {
        const layout = layoutOf(document);
        if (!layout.groups.some((item) => item.id === id)) throw new Error('That group is no longer on the diagram.');
        write(document, { ...layout, groups: layout.groups.map((item) => (item.id === id ? { ...item, name: next } : item)) });
      });
    },

    ungroup(id) {
      return run('graph/ungroup', (document) => {
        const layout = layoutOf(document);
        if (!layout.groups.some((item) => item.id === id)) throw new Error('That group is no longer on the diagram.');
        write(document, { ...layout, groups: layout.groups.filter((item) => item.id !== id) });
      });
    }
  };
}
