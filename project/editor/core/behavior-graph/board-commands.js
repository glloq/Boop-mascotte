/**
 * Authoring the Behavior board (docs/BEHAVIOR_STUDIO.md).
 *
 * Two things `state-machine/graph-commands.js` cannot do, because it was
 * written when a node was always a state:
 *
 * 1. **Move a node of any kind.** Its `moveNodes` reads positions back through
 *    `nodesFor`, which filters to `document.states` — so a trigger or a
 *    reaction dragged across the board would be silently dropped on the way to
 *    the store.
 * 2. **Edit several transitions at once.** `updateTransition` takes one edge,
 *    so "every transition out of Idle at 200 ms" was *n* trips through a number
 *    field and *n* history steps, which is *n* presses of undo to change your
 *    mind.
 *
 * Same shape as its neighbours: preflight on a clone so a refusal never moves
 * history, one `store.execute` per intent, `stateMachine` domain.
 */
import { normalizeGraphLayout } from '../state-machine/graph-layout.js';
import { autoLayoutBoard, boardNodes, boardPositions, readTransitionKey } from './behavior-graph.js';

const EASINGS = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut']);
const GRID = 8;
// `+ 0` turns -0 back into 0: a node nudged a few pixels left of where it
// started would otherwise store a value that prints as 0 and equals nothing.
const snap = (value) => Math.round(value / GRID) * GRID + 0;

export function createBoardCommands(store, history) {
  const run = (type, apply) => {
    apply(structuredClone(store.getDocument()));
    history?.snapshot();
    let result;
    store.execute({ type, source: 'behavior-board', domains: ['stateMachine'], apply: (document) => { result = apply(document); } });
    return result ?? true;
  };

  return {
    /**
     * Move a set of board nodes, of whatever kind, by a delta.
     *
     * Every node on the board is written down at the same time, at the place it
     * was already being drawn: otherwise dragging one node of an auto-laid-out
     * board pins that one and leaves the rest free to jump the moment a
     * reaction is added.
     */
    moveNodes(ids, delta) {
      const moving = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));
      if (!moving.size || (!delta?.x && !delta?.y)) return false;
      return run('board/move', (document) => {
        const layout = normalizeGraphLayout(document.graphLayout);
        const nodes = boardNodes(document);
        const positions = boardPositions(document, layout, nodes);
        const next = { ...layout.nodes };
        for (const node of nodes) {
          const point = positions[node.id];
          if (!point) continue;
          next[node.id] = moving.has(node.id)
            ? { x: snap(point.x + (delta.x || 0)), y: snap(point.y + (delta.y || 0)) }
            : { x: point.x, y: point.y };
        }
        document.graphLayout = normalizeGraphLayout({ ...layout, nodes: next });
      });
    },

    /**
     * Everything back where the layout puts it, in **one** step.
     *
     * `graph-commands.arrange` answers for the states and knows nothing about
     * the other three kinds, so arranging used to be its step plus a second
     * one that cleared the rest — two presses of undo for one press of
     * Arrange.
     */
    arrange() {
      return run('board/arrange', (document) => {
        const layout = normalizeGraphLayout(document.graphLayout);
        document.graphLayout = normalizeGraphLayout({ ...layout, nodes: autoLayoutBoard(document) });
      });
    },

    /**
     * One setting, across every transition picked. One history step, whatever
     * the count, which is what makes trying a whole machine at 200 ms a
     * decision an author can take back.
     */
    setTransitions(keys, patch = {}) {
      const edges = [...new Set((Array.isArray(keys) ? keys : [keys]).filter(Boolean))];
      if (!edges.length) return false;
      const fields = {};
      if (patch.duration !== undefined) {
        const duration = Number(patch.duration);
        if (!Number.isFinite(duration) || duration < 0) throw new Error('Transition duration must be zero or greater.');
        fields.duration = Math.round(duration);
      }
      if (patch.easing !== undefined) {
        if (!EASINGS.has(patch.easing)) throw new Error('Invalid transition easing.');
        fields.easing = patch.easing;
      }
      if (!Object.keys(fields).length) return false;
      // An edit that changes nothing is not a history step. A number field
      // fires `input` *and* `change` for one edit, so without this a single
      // change to 200 ms is two steps and one press of undo appears to do
      // nothing at all.
      const current = store.getDocument().transitionSettings || {};
      const moves = edges.some((key) => Object.entries(fields)
        .some(([field, value]) => (current[key]?.[field] ?? (field === 'duration' ? 300 : 'easeInOut')) !== value));
      if (!moves) return false;
      return run('transition/update-many', (document) => {
        document.transitionSettings ||= {};
        for (const key of edges) {
          const ends = readTransitionKey(key);
          if (!ends || !(document.transitions?.[ends.from] || []).includes(ends.to)) throw new Error(`Transition ${key} no longer exists.`);
          document.transitionSettings[key] = { duration: 300, easing: 'easeInOut', ...document.transitionSettings[key], ...fields };
        }
        return edges.length;
      });
    },

    /** Delete every transition picked, in one step. */
    deleteTransitions(keys) {
      const edges = [...new Set((Array.isArray(keys) ? keys : [keys]).filter(Boolean))];
      if (!edges.length) return false;
      return run('transition/delete-many', (document) => {
        for (const key of edges) {
          const ends = readTransitionKey(key);
          if (!ends || !(document.transitions?.[ends.from] || []).includes(ends.to)) throw new Error(`Transition ${key} no longer exists.`);
        }
        for (const key of edges) {
          const { from, to } = readTransitionKey(key);
          document.transitions[from] = (document.transitions[from] || []).filter((item) => item !== to);
          delete document.transitionSettings?.[key];
        }
        return edges.length;
      });
    }
  };
}
