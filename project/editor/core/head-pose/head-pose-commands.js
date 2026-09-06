/**
 * Atomic V2 commands for the head-pose grid (docs/HEAD_POSE_2_5D.md).
 *
 * Capture is transactional because the model is immutable: the command builds
 * the next keyform list from the current one and writes it in a single store
 * mutation, so a cancelled capture is simply a command that never ran.
 */
import {
  createHeadPoseAxes, captureHeadPose, headPoseSamplesFromTransforms,
  resetHeadPoseCell, resetHeadPose, pasteHeadPoseCell, mirrorHeadPoseHorizontal, setHeadPoseAxes,
  headPoseKeyformId, headPoseShapeKeyId, headPoseShapeOwner, resetHeadPoseShapes
} from './head-pose-model.js';
import { createShapeKey, upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { headTurnBindings, headTurnKeyforms, headTurnPivots } from './head-pose-turn.js';
import { sameFollowers, suggestedFollowers } from '../followers/follower-model.js';
import { enableSemanticControl } from '../../rig-editor/semantic-parts/part-model.js';

/**
 * The head's own movements, when the grid's axes name controls it does not
 * have yet.
 *
 * A generated turn is *played* by `headX` and `headY`: the grid holds a pose
 * per cell and the parameter is what walks between them. On the template those
 * two are on before anyone presses Generate, so nothing noticed that generating
 * did not turn them on -- and on a face somebody drew, pressing Generate wrote
 * a grid driven by parameters that did not exist. A turn nothing can play.
 */
function missingAxisControls(document, axes) {
  const head = Object.values(document.semanticParts || {}).find((part) => part.type === 'head');
  if (!head) return [];
  return [axes.x?.parameter, axes.y?.parameter]
    .filter((control) => control && !document.params?.[control] && !head.controls?.includes(control))
    .map((control) => ({ partId: head.id, control }));
}

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
     * Store an authored outline in one cell, so `headX` deforms the silhouette
     * and not only the boxes around it (docs/HEAD_POSE_2_5D.md).
     *
     * What it writes is an additive shape key plus the `pathShape` keyform that
     * weights it — the two things the runtime already plays back — in a single
     * command, because a shape whose weight went in a separate undo step would
     * deform the mascot for one keypress of Ctrl+Z.
     *
     * The rest outline is captured alongside it the first time, the way adding
     * a warp does: a delta is measured against `element.restPath`, and an
     * element that has never been deformed carries none.
     *
     * @returns {{ok: true, shapeKey: object} | {ok: false, reason: string, message: string}}
     */
    captureShape(cell, { elementId, posePath, restPath: drawn = null } = {}, { axes = createHeadPoseAxes() } = {}) {
      const document = store.getDocument();
      const element = document.elements?.[elementId];
      if (!element) return { ok: false, reason: 'missing-element', message: 'That artwork is not in this project any more.' };
      // The authored rest outline always wins: every other shape key on this
      // element is measured from it, and a delta measured from anything else
      // would deform a shape that is already deformed. `drawn` is what the
      // caller read off the canvas, for an element that has never carried one.
      const restPath = element.restPath || drawn;
      if (!restPath) return { ok: false, reason: 'missing-rest', message: 'That artwork has no outline to deform.' };
      const id = headPoseShapeKeyId(elementId, cell);
      const created = createShapeKey({
        id, target: elementId, name: `Head pose ${axes.x.values[cell.i]}, ${axes.y.values[cell.j]}`,
        restPath, posePath, driver: { mode: 'none' }, generatedBy: headPoseShapeOwner(cell)
      });
      if (!created.ok) return created;
      // Weight 1 here and nothing else: the transform channels of this cell are
      // whatever the author posed, not six neutrals this capture invented.
      const keyforms = captureHeadPose(document.keyforms || [], { axes, cell, samples: { [elementId]: { [`shape:${id}`]: 1 } }, channels: [] });
      const capturesRest = !element.restPath;
      history?.snapshot();
      store.execute({
        type: 'head-pose/capture-shape', source: 'head-pose', domains: capturesRest ? ['keyforms', 'artwork'] : ['keyforms'],
        apply: (draft) => {
          draft.keyforms = keyforms;
          draft.shapeKeys = upsertShapeKey(draft.shapeKeys || [], created.shapeKey);
          if (capturesRest) draft.elements[elementId].restPath = restPath;
        }
      });
      return { ok: true, shapeKey: created.shapeKey };
    },
    /**
     * Fill the whole grid with a generated cartoon turn. One command, one undo
     * step, and what it writes is ordinary head-pose keyforms — so any cell
     * can be re-posed by hand afterwards.
     */
    generateTurn({ axes = createHeadPoseAxes(), strength = 1, unit = null, headWidth = null, centers = null, trail = true } = {}) {
      const current = store.getDocument();
      // Turning the axes on first, on a copy, so everything below is computed
      // against the document this command is about to write -- the bindings it
      // takes over include the ones enabling `headX` has just created.
      const axisControls = missingAxisControls(current, axes);
      const document = axisControls.length ? structuredClone(current) : current;
      for (const { partId, control } of axisControls) enableSemanticControl(document, partId, control);
      const next = headTurnKeyforms(document.keyforms || [], document, { axes, strength, unit, headWidth, centers });
      if (!next || next === (document.keyforms || [])) return false;
      // Secondary motion (3D-10): hair and ears arrive a beat after the head.
      // It is written by the same action that writes the turn, because it is
      // the same decision -- "make this head turn" -- and a second checkbox in
      // a second place for the half of the movement that sells it is how a
      // feature gets shipped switched off.
      const followers = trail ? suggestedFollowers(document) : [];
      const touchesFollowers = !sameFollowers(followers, document.followers || []);
      // A near/far scale only reads as a turn when each part is scaled around
      // its own middle, so the turn sets those pivots as it writes the grid —
      // one command, one undo, and nothing to correct afterwards.
      const pivots = headTurnPivots(document, { centers });
      // `headX` drove a slide (the head's own translate binding) and a turn (the
      // grid) at the same time, and the slide won every time. The turn takes the
      // bindings over: the outline's bodily shift is now the head layer's own
      // depth, in the grid, where it is proportioned against the parallax and an
      // author can re-pose it. Switched off, not deleted — visible in the
      // inspector, and one undo brings the whole thing back.
      const bindings = headTurnBindings(document);
      const touchesArtwork = Object.keys(pivots).length || bindings.length;
      history?.snapshot();
      store.execute({
        type: 'head-pose/generate-turn', source: 'head-pose',
        // Enabling the axes writes parameters, a driver on the part and a
        // binding on the artwork, so those domains come along when it happens.
        domains: [...(touchesArtwork || axisControls.length ? ['keyforms', 'artwork'] : ['keyforms']), ...(touchesFollowers ? ['hierarchy'] : []), ...(axisControls.length ? ['semanticRig', 'rig', 'stateMachine'] : [])],
        apply: (draft) => {
          for (const { partId, control } of axisControls) enableSemanticControl(draft, partId, control);
          draft.keyforms = next;
          if (touchesFollowers) draft.followers = followers;
          for (const [id, pivot] of Object.entries(pivots)) {
            const element = draft.elements?.[id];
            if (element?.baseTransform) Object.assign(element.baseTransform, pivot);
          }
          for (const { elementId, property, enabled } of bindings) {
            const binding = draft.elements?.[elementId]?.bindings?.[property];
            if (binding && enabled) binding.enabled = false;
          }
        }
      });
      return true;
    },
    /**
     * Take one captured outline back out of a cell, leaving what was posed
     * there alone — the inverse of `captureShape`, so a shape that came out
     * wrong is one button rather than clearing the whole position.
     */
    resetShape(cell, elementId, { axes = createHeadPoseAxes() } = {}) {
      const document = store.getDocument();
      const id = headPoseShapeKeyId(elementId, cell);
      const shapeKeys = (document.shapeKeys || []).filter((shapeKey) => shapeKey.id !== id);
      if (shapeKeys.length === (document.shapeKeys || []).length) return false;
      const keyformId = headPoseKeyformId(elementId, 'pathShape', id);
      const keyforms = (document.keyforms || []).filter((keyform) => keyform.id !== keyformId);
      history?.snapshot();
      store.execute({
        type: 'head-pose/reset-shape', source: 'head-pose', domains: ['keyforms'],
        apply: (draft) => { draft.keyforms = keyforms; draft.shapeKeys = shapeKeys; }
      });
      return true;
    },
    /** Clear one cell, and the outlines only that cell was weighting. */
    resetCell(cell, { axes = createHeadPoseAxes() } = {}) {
      const document = store.getDocument();
      const next = resetHeadPoseCell(document.keyforms || [], axes, cell);
      const shapeKeys = resetHeadPoseShapes(document.shapeKeys || [], cell);
      if (next === (document.keyforms || []) && shapeKeys.length === (document.shapeKeys || []).length) return false;
      history?.snapshot();
      store.execute({
        type: 'head-pose/reset-cell', source: 'head-pose', domains: ['keyforms'],
        apply: (draft) => { draft.keyforms = next; draft.shapeKeys = shapeKeys; }
      });
      return true;
    },
    /**
     * Clear the grid — and hand `headX` / `headY` back to the head's own
     * translate bindings, which generating the turn had switched off. Without
     * that, emptying the grid left the two controls driving nothing at all.
     */
    reset({ axes = createHeadPoseAxes() } = {}) {
      const document = store.getDocument();
      const next = resetHeadPose(document.keyforms || [], axes);
      const shapeKeys = resetHeadPoseShapes(document.shapeKeys || []);
      const restore = headTurnBindings(document).filter((entry) => !entry.enabled);
      if ((!next || next === (document.keyforms || [])) && shapeKeys.length === (document.shapeKeys || []).length && !restore.length) return false;
      history?.snapshot();
      store.execute({
        type: 'head-pose/reset', source: 'head-pose', domains: restore.length ? ['keyforms', 'artwork'] : ['keyforms'],
        apply: (draft) => {
          draft.keyforms = next;
          draft.shapeKeys = shapeKeys;
          for (const { elementId, property } of restore) {
            const binding = draft.elements?.[elementId]?.bindings?.[property];
            if (binding) binding.enabled = true;
          }
        }
      });
      return true;
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
