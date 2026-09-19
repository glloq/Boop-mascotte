/**
 * BEHAVIOR — when does it do it? (docs/BEHAVIOR_STUDIO.md)
 *
 * One studio, not three screens:
 *
 * ```text
 *   library (left)      the board (centre)          tuning (right)
 *   what exists    →    how it is wired        →    how it feels
 *   #reactions-panel    #behavior-board             #behavior-inspector
 *   #automatic-panel    #behavior-table
 *   #state-editor
 * ```
 *
 * The three screens are **lenses** over the one board rather than three
 * unrelated surfaces, and the mascot is a stage docked in its corner rather
 * than 58 % of the window showing the thing the screen is not about.
 *
 * Everything shares one selection: picking a state in the column picks it on
 * the board and opens its pose in the rail; picking four transitions on the
 * board tunes all four at once. That is the difference this module exists to
 * make — the old workspace had three selections, two of them strings, and no
 * inspector registered for any of them.
 */
import { createReactionStudio } from '../../ui/reaction-studio.js';
import { createAutomaticPanel } from '../../ui/automatic-panel.js';
import { createStateMachinePanel } from '../../animation-editor/state-machine/state-machine-panel.js';
import { createBehaviorBoard } from '../../ui/behavior-studio/board.js';
import { createTuningRail } from '../../ui/behavior-studio/tuning.js';
import { createTransitionTable } from '../../ui/behavior-studio/transition-table.js';
import { createBoardCommands } from '../../core/behavior-graph/board-commands.js';
import { createStateMachineCommands } from '../../animation-editor/state-machine/state-machine-commands.js';
import { LENS_FOR_MODE, normalizeLens } from '../../core/behavior-graph/behavior-graph.js';
import { boardSelectionPatch } from '../../ui/selection-context.js';

export function createBehaviorWorkspace({ store, history, shell, preview, editorContext, navigate, setStatus, fitCanvas = () => {} }) {
  const boardCommands = createBoardCommands(store, history);
  const stateCommands = createStateMachineCommands(store, history);

  /* ── One selection, shared by the column, the board, the table and the rail ── */
  const session = () => editorContext.get();
  const select = (picked = {}) => {
    editorContext.update(boardSelectionPatch(picked));
    follow(picked);
  };

  /** The studio catching up with a pick somebody else already wrote down. */
  const follow = ({ state = null, transitions = [], behavior = null, trigger = null, reaction = null } = {}) => {
    board.select({ nodes: nodeIdsFor({ state, behavior, trigger, reaction }), edges: [...transitions] }, { announce: false });
    tuning.render();
    table.render();
  };

  /** The board ids a session selection stands for, so the three stay in step. */
  const nodeIdsFor = ({ state, behavior, trigger, reaction }) => [
    ...(state ? [state] : []), ...(behavior ? [`auto:${behavior}`] : []),
    ...(trigger ? [`when:${trigger}`] : []), ...(reaction ? [`do:${reaction}`] : [])
  ];

  const getSelection = () => ({
    edges: session().activeTransitionKeys || [],
    primary: session().activeTransitionKeys?.length ? null
      : session().activeBehaviorId ? { kind: 'automatic', key: session().activeBehaviorId }
        : session().activeTriggerId ? { kind: 'trigger', key: session().activeTriggerId }
          : session().activeStateId ? { kind: 'state', key: session().activeStateId } : null,
    nodes: []
  });

  /* ── The board ───────────────────────────────────────────────────────────── */
  const board = createBehaviorBoard({
    store, history, preview, onStatus: setStatus,
    getLens: () => normalizeLens(session().boardLens),
    setLens: (lens) => showLens(lens),
    getStage: () => shell.getBoardStage(),
    setStage: (stage) => { const next = shell.setBoardStage(stage); requestAnimationFrame(() => fitCanvas()); return next; },
    /**
     * What a board pick means to the rest of the editor. A reaction is handed
     * to the reaction studio, which already owns the sentence editor; the other
     * three are the tuning rail's.
     */
    onSelect(picked) {
      const primary = picked.nodes[0] || null;
      editorContext.update(boardSelectionPatch({
        transitions: picked.edges,
        state: primary?.kind === 'state' ? primary.key : null,
        behavior: primary?.kind === 'automatic' ? primary.key : null,
        trigger: primary?.kind === 'trigger' ? primary.key : null,
        reaction: primary?.kind === 'reaction' ? primary.key : null
      }));
      if (primary?.kind === 'state') preview?.previewState(primary.key);
      tuning.render();
      table.render();
      states.render();
      reactionStudio.render();
    },
    /**
     * A link dragged between two nodes. State → state is a transition; a
     * reaction dropped on a state is the "only if the mascot is in this state"
     * a condition row used to be the only way to write.
     */
    addTransition(from, to) {
      if (from.kind === 'state' && to.kind === 'state') {
        try { stateCommands.addTransition(from.key, to.key); select({ transitions: [`${from.key}->${to.key}`] }); }
        catch (error) { setStatus(error.message, 'warn'); board.render(); }
        return;
      }
      if (from.kind === 'reaction' && to.kind === 'state') {
        const reaction = (store.getDocument().reactions || []).find((item) => item.id === from.key);
        if (!reaction) return;
        const conditions = [...(reaction.conditions || []), { kind: 'state', state: to.key, operator: '==' }];
        try {
          store.execute({
            type: 'reaction/condition-add', source: 'behavior-board', domains: ['reactions'],
            apply: (document) => { const item = (document.reactions || []).find((entry) => entry.id === from.key); if (item) item.conditions = conditions; }
          });
          setStatus(`“${reaction.name}” now runs only while the mascot is ${to.key}.`);
        } catch (error) { setStatus(error.message, 'warn'); }
        board.render();
        return;
      }
      setStatus('A link goes from a state to a state, or from a reaction onto the state it needs.', 'warn');
      board.render();
    },
    deleteTransitions(keys) {
      try { boardCommands.deleteTransitions(keys); select({}); setStatus(`${keys.length} transition${keys.length === 1 ? '' : 's'} deleted.`); }
      catch (error) { setStatus(error.message, 'warn'); }
    }
  });

  const tuning = createTuningRail({
    host: shell.behaviorInspectorEl, store, history, preview, onStatus: setStatus,
    getSelection,
    onSelectReaction: (id) => select({ reaction: id })
  });

  const table = createTransitionTable({
    host: shell.behaviorTableEl, store, history, preview, onStatus: setStatus,
    getSelection, onSelect: (edges) => select({ transitions: edges }),
    getLens: () => normalizeLens(session().boardLens)
  });

  /* ── The library column ──────────────────────────────────────────────────── */
  const states = createStateMachinePanel(shell.leftSidebarEl, store, history, preview, editorContext, setStatus, {
    // The column writes the session itself; the studio only has to follow.
    onSelect: follow,
    onLens: showLens
  });
  const reactionStudio = createReactionStudio({
    listHost: shell.reactionsEl, inspectorHost: shell.reactionInspectorEl, store, history, preview, editorContext, onStatus: setStatus, navigate
  });
  const automaticPanel = createAutomaticPanel(shell.automaticEl, store, history, preview, editorContext, {
    navigate, onStatus: setStatus,
    // "Behaviors (advanced)" is the same board, looked at through the lens that
    // shows them, with the column listing them beside it.
    openAdvanced: () => {
      navigate({ mode: 'behavior.stateMachine' });
      editorContext.update({ authorMode: 'behaviors', boardLens: 'automatic' });
      states.render(); board.render();
      shell.openAuthorEditor();
    }
  });

  /**
   * A lens **is** a screen, and pressing one goes there.
   *
   * The chips on the board and the tabs in the project bar were two controls
   * for one thing, which is the duplication this redesign set out to remove: a
   * lens that only changed what the board drew left the column listing
   * something else. So the chip navigates, the tab sets the lens, and the
   * column follows both. *All* is the exception — it is a wider view of the
   * screen you are on rather than a screen of its own, so it changes nothing
   * but the board.
   */
  function showLens(value) {
    const lens = normalizeLens(value);
    editorContext.update({ boardLens: lens, ...(lens === 'all' ? {} : { authorMode: lens === 'automatic' ? 'behaviors' : 'states' }) });
    const mode = Object.entries(LENS_FOR_MODE).find(([, id]) => id === lens)?.[0];
    if (mode && mode !== shell.getMode?.()) navigate({ mode });
    else { board.render(); states.render(); }
    return lens;
  }

  /**
   * Arriving with something in hand.
   *
   * A selection-driven inspector over an empty selection is a column that says
   * "pick something" — which is the right sentence once, and a waste of a third
   * of the window every time after that. So a screen whose subject is a single
   * obvious thing opens on it: States on the state the mascot starts in,
   * Automatic on the first behaviour. Reactions is left alone, because the
   * reaction studio's own invitation is the better first sentence there.
   *
   * Nothing is picked if the author already has something picked, and nothing
   * is created: an empty project still opens empty.
   */
  function openOnSomething(lens) {
    const current = session();
    if (current.activeTransitionKeys?.length || current.activeStateId || current.activeBehaviorId || current.activeTriggerId) return;
    const state = store.getDocument();
    if (lens === 'states') {
      const name = state.states?.[state.activeState] ? state.activeState : Object.keys(state.states || {})[0];
      if (name) select({ state: name });
      return;
    }
    if (lens === 'automatic') {
      const first = (state.behaviors || [])[0];
      if (first) select({ behavior: first.id });
    }
  }

  board.attach(shell.behaviorBoardEl);

  /**
   * The screen the lens was last pointed at.
   *
   * `enter` runs on **every** context change, not only on arrival — the
   * workspace manager tells all four workspaces where the author is whenever
   * anything in the session moves. Setting the lens unconditionally therefore
   * undid the author's own press of *All* on the next render, which is the
   * whole of the bug this line exists to prevent: the screen chooses the lens
   * when the screen changes, and never again.
   */
  let lastMode = null;

  return {
    id: 'behavior',
    surfaces: ['reactions'],
    panels: { states, reactionStudio, automaticPanel, board, tuning, table },
    targets: {
      states: () => states.render(),
      reactionStudio: () => reactionStudio.render(),
      automaticPanel: () => automaticPanel.render(),
      behaviorBoard: () => { board.render(); table.render(); tuning.render(); }
    },
    /**
     * Arriving on a Behavior screen points the board at what that screen is
     * about. The lens is session state, so an author who then presses *All* on
     * the board keeps it until they leave.
     */
    enter() {
      const mode = shell.getMode?.() || null;
      const arrived = mode !== lastMode;
      lastMode = mode;
      const lens = LENS_FOR_MODE[mode] || null;
      if (arrived && lens && lens !== session().boardLens) editorContext.update({ boardLens: lens });
      shell.setBoardStage(shell.getBoardStage());
      if (arrived) openOnSomething(lens);
      board.render(); table.render(); tuning.render();
      // The stage is a fifth of the width the canvas has everywhere else, so
      // the mascot is re-framed into it once the layout has settled.
      requestAnimationFrame(() => fitCanvas());
    },
    /** The live highlight on the board, driven from the editor's frame callback. */
    syncLive() { board.syncLive(); },
    /** A reaction being tested stops when the author goes somewhere else. */
    leave() { lastMode = null; reactionStudio.leave(); },
    render() { states.render(); reactionStudio.render(); automaticPanel.render(); board.render(); table.render(); tuning.render(); },
    destroy() { reactionStudio.destroy?.(); automaticPanel.destroy?.(); board.destroy?.(); tuning.destroy?.(); table.destroy?.(); }
  };
}
