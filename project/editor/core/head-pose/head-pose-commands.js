/**
 * Atomic V2 commands for the head-pose grid (docs/HEAD_POSE_2_5D.md).
 *
 * Capture is transactional because the model is immutable: the command builds
 * the next keyform list from the current one and writes it in a single store
 * mutation, so a cancelled capture is simply a command that never ran.
 */
import {
  createHeadPoseAxes, captureHeadPose, headPoseSamplesFromTransforms,
  resetHeadPoseCell, resetHeadPose, pasteHeadPoseCell, mirrorHeadPoseHorizontal, setHeadPoseAxes
} from './head-pose-model.js';
import { headTurnKeyforms, headTurnPivots } from './head-pose-turn.js';

export function createHeadPoseCommands(store, history) {
  const run = (type, operation) => {
    const current = store.getDocument().keyforms || [];
    const next = operation(store.getDocument());
    // The model returns the list it was given when nothing applies, so an
    // action that changes nothing writes nothing and undo stays meaningful.
    if (!next || next === current) return false;
    history?.snapshot();
    store.execute({ type, source: 'head-pose', domains: ['keyforms'], apply: (document) => { document.keyforms = next; } });
    return true;
  };
  return {
    capture(cell, posed, { axes = createHeadPoseAxes() } = {}) {
      return run('head-pose/capture', (document) =>
        captureHeadPose(document.keyforms || [], { axes, cell, samples: headPoseSamplesFromTransforms(document.elements || {}, posed) }));
    },
    captureSamples(cell, samples, { axes = createHeadPoseAxes() } = {}) {
      return run('head-pose/capture', (document) => captureHeadPose(document.keyforms || [], { axes, cell, samples }));
    },
    /**
     * Fill the whole grid with a generated cartoon turn. One command, one undo
     * step, and what it writes is ordinary head-pose keyforms — so any cell
     * can be re-posed by hand afterwards.
     */
    generateTurn({ axes = createHeadPoseAxes(), strength = 1, unit = null, headWidth = null, centers = null } = {}) {
      const document = store.getDocument();
      const next = headTurnKeyforms(document.keyforms || [], document, { axes, strength, unit, headWidth, centers });
      if (!next || next === (document.keyforms || [])) return false;
      // A near/far scale only reads as a turn when each part is scaled around
      // its own middle, so the turn sets those pivots as it writes the grid —
      // one command, one undo, and nothing to correct afterwards.
      const pivots = headTurnPivots(document, { centers });
      history?.snapshot();
      store.execute({
        type: 'head-pose/generate-turn', source: 'head-pose', domains: Object.keys(pivots).length ? ['keyforms', 'artwork'] : ['keyforms'],
        apply: (draft) => {
          draft.keyforms = next;
          for (const [id, pivot] of Object.entries(pivots)) {
            const element = draft.elements?.[id];
            if (element?.baseTransform) Object.assign(element.baseTransform, pivot);
          }
        }
      });
      return true;
    },
    resetCell(cell, { axes = createHeadPoseAxes() } = {}) {
      return run('head-pose/reset-cell', (document) => resetHeadPoseCell(document.keyforms || [], axes, cell));
    },
    reset({ axes = createHeadPoseAxes() } = {}) {
      return run('head-pose/reset', (document) => resetHeadPose(document.keyforms || [], axes));
    },
    paste(cell, clipboard, { axes = createHeadPoseAxes() } = {}) {
      if (!clipboard) return false;
      return run('head-pose/paste', (document) => pasteHeadPoseCell(document.keyforms || [], axes, cell, clipboard));
    },
    mirror({ axes = createHeadPoseAxes(), pairs = {}, mode = 'onto' } = {}) {
      return run('head-pose/mirror', (document) => mirrorHeadPoseHorizontal(document.keyforms || [], axes, pairs, { mode }));
    },
    setAxes(next, { axes = createHeadPoseAxes() } = {}) {
      return run('head-pose/set-axes', (document) => setHeadPoseAxes(document.keyforms || [], axes, next));
    }
  };
}
