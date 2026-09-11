/**
 * The browser-test seam (VNX-02, docs/VNEXT_ROADMAP.md).
 *
 * Sixty-odd lines of it used to sit at the bottom of `main.js`, which made the
 * orchestrator look twice as complicated as it is: none of this wires the
 * editor, it only reads it. Moving it out is the cheapest honest step towards
 * `main.js` being wiring and nothing else.
 *
 * It stays opt-in and absent from normal editor URLs, exactly as before: the
 * seam appears only for `?e2e=1`, and the exported runtime has never contained
 * any of it.
 */
import { compileFrame } from '../core/preview-runtime/frame-compiler.js';
import { deriveProjectReadiness } from '../core/validation/validate-project.js';
import { createE2EDocumentSnapshot, createE2EReadinessSnapshot, createE2ESessionSnapshot, createE2EStateSnapshot } from '../core/diagnostics/e2e-state-snapshot.js';

/**
 * What `loadSvgFile` and `loadProjectFile` actually read off a `File`: a name
 * for the status line and the text. Built here rather than with `new File`
 * because the seam is also exercised in Node, and because the two service
 * paths have never needed anything more.
 */
const fileOf = (name, text) => ({ name, text: async () => text });

/**
 * Install the seam when the URL asks for it.
 *
 * @returns {object|null} the hooks, or null when this is a normal editor URL.
 */
export function installE2EHooks(deps, { search = globalThis.location?.search || '', target = globalThis } = {}) {
  if (!new URLSearchParams(search).has('e2e')) return null;
  const hooks = createE2EHooks(deps);
  target.__BOOP_E2E__ = hooks;
  return hooks;
}

/** The seam itself, with every collaborator injected so it can be exercised. */
export function createE2EHooks({
  store, canvas, preview, history, exporter, taskRouter, contextInspector, responsive, capabilitySheet,
  validationCache, taskReadiness, diagnostics, autosave, project, panels = {}, dom = globalThis.document
}) {
  // Version tokens are opaque and change shape; tests only ever need "did it
  // change", so the seam hands out a counter instead of the token itself.
  let exposedToken = store.getDocumentVersionToken(), exposedTokenId = 1;
  const documentVersionToken = () => {
    const token = store.getDocumentVersionToken();
    if (token !== exposedToken) { exposedToken = token; exposedTokenId += 1; }
    return exposedTokenId;
  };

  const compile = (state, effective) => compileFrame(state.elements, effective, state.globalConstraints,
    state.stateConstraints?.[state.activeState],
    { keyforms: state.keyforms, shapeKeys: state.shapeKeys, warps: state.warps, hands: state.hands, deformers: state.deformers, parallax: state.parallax });

  return {
    /**
     * A project, without going through Home (V3-07, docs/V3_ROADMAP.md).
     *
     * Forty-four browser specs used to reach their starting document by
     * clicking a card on Home, which made Home's markup a contract the whole
     * suite depended on: it could not be narrowed without breaking most of the
     * suite at once. These four are the same four calls Home's controls make,
     * on the same project service -- the same replacement confirmation, the
     * same rollback, the same `openProject` tail that closes Home and routes --
     * so a spec that only needs a mascot on the canvas asks for one instead of
     * navigating for it. A spec that is *about* Home still presses Home.
     *
     * Each returns the service's own boolean: `false` is a refused or failed
     * replacement, and is exactly as interesting to a test as `true`.
     */
    openProject: {
      template: (kind, options) => project.loadTemplate(kind, options),
      face: (options) => project.generateFace(options),
      svg: (name, text) => project.loadSvgFile(fileOf(name, text)),
      snapshot: (name, text) => project.loadProjectFile(fileOf(name, text))
    },
    document: () => createE2EDocumentSnapshot(store.getDocument()),
    session: () => createE2ESessionSnapshot(store.getSession()),
    // Compatibility composite used by legacy E2E tests.
    // New owner-specific invariants should prefer document() or session().
    state: () => createE2EStateSnapshot(store.getDocument(), store.getSession()),
    documentVersionToken,
    documentRevisions: () => ({ persistent: store.getPersistentRevision(), domains: store.getDomainRevisions() }),
    dirty: () => autosave.isDirty(),
    readiness: () => { const issues = validationCache.run(store.getDocument()); return createE2EReadinessSnapshot(deriveProjectReadiness(store.getDocument(), issues), issues); },
    taskReadiness: () => structuredClone(taskReadiness()),
    previewOverrides: () => preview.getBehaviorOverrides(),
    expressionWeights: () => preview.getExpressionWeights(),
    motionWeights: () => preview.getMotionWeights(),
    mutate: (recipe) => store.setState(recipe),
    setAuthoredPath: (id, d) => canvas.applyPathData(id, d),
    nodeEdit: () => canvas.getNodeEdit(),
    editScope: () => canvas.getEditScope?.() ?? null,
    panView: (dx, dy) => canvas.panView(dx, dy),
    setAuthoredTransform: (id, patch) => { store.setState((state) => Object.assign(state.elements[id].baseTransform, patch)); canvas.applyElementTransform(id, store.getState().elements[id]); },
    setLiveParam: (name, value) => preview.setLiveParam(name, value),
    clearLiveParam: (name) => preview.clearLiveParam(name),
    effectiveParams: () => structuredClone(preview.getEffectiveParams()),
    controlState: (name) => {
      const selector = `[data-control="${CSS.escape(name)}"]`;
      const input = dom.querySelector(selector), live = preview.getLiveParams(), effective = preview.getEffectiveParams();
      const compiled = compile(store.getState(), effective);
      const frame = (id) => (compiled.frames[id]?.transform ? structuredClone(compiled.frames[id].transform) : null);
      return { matches: dom.querySelectorAll(selector).length, visible: Boolean(input?.checkVisibility()), inputValue: input?.value ?? null, disabled: Boolean(input?.disabled), liveValue: live[name] ?? null, effectiveValue: effective[name] ?? null, compiled: { pupilLeft: frame('pupilLeft'), pupilRight: frame('pupilRight') } };
    },
    hitStack: (x, y) => dom.elementsFromPoint(x, y).map((node) => ({ tag: node.tagName, id: node.id || '', class: node.getAttribute?.('class') || '' })),
    frameFor: (id) => {
      const state = store.getState(), effective = preview.getEffectiveParams();
      const compiled = compile(state, effective);
      return { effectiveParams: structuredClone(effective), compiled: structuredClone(compiled.frames[id] || null), canvas: canvas.frameDiagnostic(id) };
    },
    transitionTo: (name) => preview.setState(name),
    diagnostics: () => diagnostics.snapshot(),
    history: () => structuredClone(history.getState()),
    task: () => taskRouter.currentTask,
    faceSetup: () => panels.faceSetup.snapshot(),
    faceMovements: () => panels.faceMovements.snapshot(),
    motions: () => panels.motionStudio.snapshot(),
    reactions: () => panels.reactionStudio.snapshot(),
    automatic: () => panels.automaticPanel.snapshot(),
    advancedTools: () => panels.advancedHub.snapshot(),
    character: () => panels.characterBuilder.snapshot(),
    palette: () => panels.palette.snapshot(),
    layout: () => responsive.snapshot(),
    capabilities: () => capabilitySheet.isOpen(),
    previewSession: () => structuredClone(preview.getSession()),
    activeReaction: () => preview.getActiveReaction(),
    triggerReaction: (event) => preview.triggerReaction(event),
    eventLog: () => preview.getEventLog(),
    navigate: (route) => taskRouter.navigate(route),
    selectionContext: () => contextInspector.render(),
    resetDiagnostics: () => diagnostics.reset(),
    exportArtifacts: () => exporter.createExportArtifacts().map((item) => ({ ...item }))
  };
}
