/**
 * Which panel watches which domain, as data (VNX-05, docs/VNEXT_ROADMAP.md).
 *
 * The store has notified per domain for a long time, so `subscribeDocument` is
 * not the problem. The problem is what each callback then does: twelve dense
 * lines in `main.js`, each a hand-written list of renders. Editing a rig
 * parameter re-renders eleven panels, and nothing anywhere says why, or
 * notices when a panel is added to the wrong list — or to none.
 *
 * So the fan-out becomes a table. `main.js` supplies the *targets* (it owns the
 * panels), this file owns the mapping, and both are checked: a domain with no
 * plan and a plan naming a target that does not exist both fail loudly at
 * wiring time rather than quietly at runtime.
 *
 * It is also the seam the ViewModel gate needs (VNX-04): once a target can say
 * "my model did not change", skipping it is a change to one runner rather than
 * to twelve closures.
 */

/**
 * Every target a plan may name. A target is a job to run, not necessarily a
 * panel: reconciling the canvas and refreshing the puppet handles sit in the
 * same fan-out as a panel's `render()`, and pretending otherwise would just
 * move them somewhere less visible.
 */
export const RENDER_TARGETS = Object.freeze([
  'artboardPanel', 'artboardSync', 'automaticPanel', 'canvasMenu', 'canvasSelection', 'canvasState',
  'exporter', 'faceMovements', 'faceSetup', 'gazePanel', 'handSetup', 'handleBoard', 'headPose', 'inspector',
  'layerOrder', 'layers', 'motionStudio', 'previewPanel', 'projectShell', 'puppetHandles', 'puppetHandlesRefresh',
  'previewFrame', 'reactionStudio', 'rigPanel', 'expressionStudio', 'states', 'timeline', 'warpPanel'
]);

/**
 * Document domains → what has to be redrawn. Order matters where one target
 * reads what another just wrote: the canvas reconciles before the panels that
 * measure it, and the layer order is applied before the layer list is drawn.
 */
export const DOCUMENT_RENDER_PLAN = Object.freeze({
  artwork: Object.freeze(['canvasState', 'inspector', 'exporter', 'projectShell', 'faceSetup', 'faceMovements', 'handSetup', 'artboardSync']),
  layers: Object.freeze(['layerOrder', 'layers', 'faceSetup', 'canvasMenu', 'artboardPanel']),
  rig: Object.freeze(['inspector', 'timeline', 'rigPanel', 'faceMovements', 'gazePanel', 'headPose', 'handSetup', 'warpPanel', 'expressionStudio', 'motionStudio', 'automaticPanel', 'handleBoard', 'puppetHandles', 'previewFrame']),
  stateMachine: Object.freeze(['states', 'automaticPanel', 'previewPanel']),
  semanticRig: Object.freeze(['rigPanel', 'faceSetup', 'faceMovements', 'handleBoard', 'projectShell']),
  rigHandles: Object.freeze(['handleBoard', 'puppetHandles']),
  animation: Object.freeze(['timeline', 'motionStudio', 'reactionStudio', 'projectShell']),
  // Only the timeline shows an arrangement; moving a clip in time changes
  // nothing about the clip itself (VNX-29).
  arrangement: Object.freeze(['timeline']),
  // `previewFrame` because a keyform, a shape key and a warp all change what a
  // parameter *produces*: the panels knew, and the mascot on the canvas went on
  // showing the shape it was showing before the edit until something unrelated
  // happened to recompile it.
  keyforms: Object.freeze(['headPose', 'handSetup', 'warpPanel', 'previewFrame', 'puppetHandlesRefresh']),
  // A constraint or a hold changes what the mascot looks like and no panel's
  // own contents, so the frame is the whole of this one.
  constraints: Object.freeze(['previewFrame', 'puppetHandlesRefresh']),
  hands: Object.freeze(['handSetup', 'puppetHandles']),
  // Deformers, the depth parallax and what trails behind the head (3D-10) all
  // change what the mascot *looks* like without changing a panel, so the frame
  // is the whole of this one: it used to be empty, and turning secondary motion
  // on left the canvas exactly as it was until something else recompiled it.
  hierarchy: Object.freeze(['previewFrame']),
  expressions: Object.freeze(['expressionStudio', 'reactionStudio', 'previewPanel']),
  reactions: Object.freeze(['reactionStudio', 'previewPanel'])
});

/**
 * Session keys are not the document: they never mark the project dirty.
 *
 * Head pose is here because a head-pose cell can hold the *outline* of the
 * selected artwork (3D-06), and the panel offers to shape whatever is picked
 * on the canvas — an offer naming a piece that is no longer selected is worse
 * than no offer at all.
 */
export const SESSION_RENDER_PLAN = Object.freeze({
  selectedId: Object.freeze(['canvasSelection', 'layers', 'inspector', 'rigPanel', 'headPose'])
});

/**
 * Bind a plan to the functions that do the work.
 *
 * @param {Record<string, () => void>} targets one function per target name
 * @param {{ onError?: (name: string, error: Error) => void }} [options]
 * @returns {{ run(domain: string, plan?: object): string[], targetsFor(domain: string, plan?: object): readonly string[] }}
 */
export function createRenderPlan(targets, { onError } = {}) {
  const missing = RENDER_TARGETS.filter((name) => typeof targets?.[name] !== 'function');
  if (missing.length) throw new Error(`Render plan is missing targets: ${missing.join(', ')}`);
  const unknown = Object.keys(targets).filter((name) => !RENDER_TARGETS.includes(name));
  if (unknown.length) throw new Error(`Render plan was given targets it does not know: ${unknown.join(', ')}`);

  const targetsFor = (domain, plan = DOCUMENT_RENDER_PLAN) => {
    const list = plan[domain];
    if (!list) throw new Error(`No render plan for "${domain}"`);
    return list;
  };

  return {
    targetsFor,
    /**
     * Run one domain's targets, in order. A target that throws does not stop
     * the ones after it: half a redrawn editor is bad, a frozen one is worse.
     */
    run(domain, plan = DOCUMENT_RENDER_PLAN) {
      const ran = [];
      for (const name of targetsFor(domain, plan)) {
        try { targets[name](); ran.push(name); } catch (error) { onError?.(name, error); }
      }
      return ran;
    }
  };
}
