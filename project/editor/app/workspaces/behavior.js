/**
 * BEHAVIOR — when does it do it? (UIR-16, docs/UIR_REFACTOR_BASELINE.md)
 *
 * Three screens over one column: the reactions, the automatic behaviours, and
 * the state machine that used to be filed under Motions. They share a surface
 * and an inspector, which is why they are one module and not three.
 */
import { createReactionStudio } from '../../ui/reaction-studio.js';
import { createAutomaticPanel } from '../../ui/automatic-panel.js';
import { createStateMachineEditor } from '../../animation-editor/state-machine-editor.js';

export function createBehaviorWorkspace({ store, history, shell, preview, editorContext, navigate, setStatus }) {
  const states = createStateMachineEditor(shell.leftSidebarEl, store, history, preview, editorContext);
  const reactionStudio = createReactionStudio({ listHost: shell.reactionsEl, inspectorHost: shell.reactionInspectorEl, store, history, preview, editorContext, onStatus: setStatus, navigate });
  // "Behaviors (advanced)" is in the Reactions column and the editor it opens is
  // the State machine's own screen: it has to travel there, or it changes a mode
  // nobody can see.
  const automaticPanel = createAutomaticPanel(shell.automaticEl, store, history, preview, editorContext, {
    navigate, onStatus: setStatus,
    openAdvanced: () => { navigate({ mode: 'behavior.stateMachine' }); editorContext.update({ authorMode: 'behaviors' }); states.render(); shell.openAuthorEditor(); }
  });

  return {
    id: 'behavior',
    surfaces: ['reactions'],
    panels: { states, reactionStudio, automaticPanel },
    targets: {
      states: () => states.render(),
      reactionStudio: () => reactionStudio.render(),
      automaticPanel: () => automaticPanel.render()
    },
    enter() {},
    /** A reaction being tested stops when the author goes somewhere else. */
    leave() { reactionStudio.leave(); },
    render() { states.render(); reactionStudio.render(); automaticPanel.render(); },
    destroy() { reactionStudio.destroy?.(); automaticPanel.destroy?.(); states.destroy?.(); }
  };
}
