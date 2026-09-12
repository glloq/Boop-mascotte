/**
 * ANIMATE — what can its face do? (UIR-16, docs/UIR_REFACTOR_BASELINE.md)
 *
 * Expressions and motions are two screens with two columns; the Timeline is the
 * third, and it is the same column as Motions with the dock open underneath
 * (§9). It is built here because it belongs to this question, and handed out
 * because the transport it owns is what stops when the author leaves.
 */
import { createExpressionStudio } from '../../ui/expression-studio.js';
import { createMotionStudio } from '../../ui/motion-studio.js';
import { createTimelinePanel } from '../../animation-editor/timeline/timeline-panel.js';

export function createAnimateWorkspace({ store, history, shell, preview, editorContext, navigate, setStatus, isMobile }) {
  const timeline = createTimelinePanel(shell.previewEl, store, history, preview, editorContext, setStatus);
  const expressionStudio = createExpressionStudio({ listHost: shell.expressionsEl, inspectorHost: shell.expressionInspectorEl, store, history, preview, editorContext, onStatus: setStatus, navigate });
  const motionStudio = createMotionStudio({
    listHost: shell.motionsEl, inspectorHost: shell.motionInspectorEl, store, history, preview, editorContext, onStatus: setStatus, navigate,
    // Opening the Timeline is a navigation, not a dock that appears under a tab
    // saying somewhere else (UIR-11).
    openTimeline: () => { navigate({ mode: 'animate.timeline' }); timeline.requestRender(); shell.previewEl.querySelector('.timeline-shell')?.focus(); },
    canOpenTimeline: () => !isMobile(),
    timelineOpen: () => shell.isTimelineOpen()
  });
  shell.onTimelineToggle(() => motionStudio.render());

  return {
    id: 'animate',
    surfaces: ['expressions', 'animate'],
    panels: { timeline, expressionStudio, motionStudio },
    targets: {
      expressionStudio: () => expressionStudio.render(),
      motionStudio: () => motionStudio.render(),
      timeline: () => timeline.requestRender()
    },
    /**
     * Expressions is the one screen that holds a face while it is being shaped,
     * so it is the one screen that has to let go on the way out — including on
     * the way to Motions, which is this same workspace.
     */
    enter(surface) { if (surface === 'expressions') expressionStudio.enter(); else expressionStudio.leave(); },
    leave() { expressionStudio.leave(); },
    render() { timeline.render(); expressionStudio.render(); motionStudio.render(); },
    destroy() { expressionStudio.destroy?.(); motionStudio.destroy?.(); timeline.destroy?.(); }
  };
}
