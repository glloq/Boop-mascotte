import { createAppShell } from '../ui/app-shell.js';
import { createStore } from '../core/state/store.js';
import { createHistory } from '../core/undo/history.js';
import { createSvgCanvas } from '../svg-editor/svg-canvas.js';
import { createLayersPanel } from '../svg-editor/layers-panel.js';
import { createArtboardPanel } from '../ui/artboard-panel.js';
import { createHandleBoard } from '../ui/handle-board.js';
import { controlMeta } from '../ui/control-catalog.js';
import { createHandleCommands } from '../core/puppet/handle-commands.js';
import { handleBoardModel, resolveRigHandles } from '../core/puppet/handle-model.js';
import { createInspector } from '../inspector/inspector.js';
import { createStateMachineEditor } from '../animation-editor/state-machine-editor.js';
import { createPreviewController } from '../core/preview-runtime/preview-controller.js';
import { createRigPanel } from '../rig-editor/semantic-parts/rig-panel.js';
import { createFaceSetupPanel } from '../rig-editor/semantic-parts/face-setup-panel.js';
import { createFaceMovementsPanel } from '../rig-editor/semantic-parts/face-movements-panel.js';
import { createHeadPosePanel } from '../rig-editor/head-pose/head-pose-panel.js';
import { createHandSetupPanel } from '../rig-editor/hands/hand-setup-panel.js';
import { createWarpPanel } from '../rig-editor/warp/warp-panel.js';
import { createTimelinePanel } from '../animation-editor/timeline/timeline-panel.js';
import { createExporter } from '../core/export/exporter.js';
import { exportBlockingIssues, validateProject } from '../core/validation/validate-project.js';
import { createGuideBar } from '../ui/guide-bar.js';
import { createPreviewPanel } from '../ui/preview-panel.js';
import { createPublishPanel } from '../ui/publish-panel.js';
import { createExpressionStudio } from '../ui/expression-studio.js';
import { puppetHandles, puppetReadout } from '../core/puppet/puppet-handles.js';
import { headPoseGrid, headPoseReadout, snapHeadPoseValues } from '../core/puppet/head-pose-handle.js';
import { createMotionStudio } from '../ui/motion-studio.js';
import { createReactionStudio } from '../ui/reaction-studio.js';
import { createAutomaticPanel } from '../ui/automatic-panel.js';
import { createAdvancedHub } from '../ui/advanced-hub.js';
import { createCommandRegistry } from '../ui/command-registry.js';
import { createCommandPalette } from '../ui/command-palette.js';
import { createResponsiveShell } from '../ui/responsive-shell.js';
import { createCapabilitySheet } from '../ui/capability-sheet.js';
import { isTextTarget, matchShortcut, shortcutHelpMarkup } from '../ui/shortcuts.js';
import { createDebouncedTask, createValidationCache } from '../core/validation/validation-cache.js';
import { createPluginRegistry } from '../core/plugins/plugin-registry.js';
import { defaultElementPlugin } from '../core/plugins/builtin/default-plugin.js';
import { pathElementPlugin } from '../core/plugins/builtin/path-plugin.js';
import { canTransition } from '../core/state/transition-guard.js';
import { createProjectSnapshot, hasValidProjectDocument, prepareProjectSnapshot } from '../core/state/project-snapshot.js';
import { FACE_FEATURES, isFaceFeatureInstalled } from '../core/sample/face-features.js';
import { addHandsCommand, areHandsInstalled, handsMarkup, handsViewBox } from '../core/sample/hand-feature.js';
import { installFaceFeatureCommand } from '../core/sample/face-feature-command.js';
import { createEditorContext } from '../ui/editor-context.js';
import { lifecycleDiagnostics } from '../core/diagnostics/lifecycle-diagnostics.js';
import { DOCUMENT_RENDER_PLAN, SESSION_RENDER_PLAN, createRenderPlan } from '../core/state/render-plan.js';
import { createWorkspaceManager } from './workspace-manager.js';
import { createExportService } from './services/export-service.js';
import { createPreviewService } from './services/preview-service.js';
import { createProjectService } from './services/project-service.js';
import { createTaskRouter } from '../ui/task-router.js';
import { createContextInspector } from '../ui/context-inspector.js';
import { artworkIdAt, createCanvasMenu } from '../ui/canvas-menu.js';
import { findSemanticPartByRole } from '../rig-editor/semantic-parts/part-model.js';
import { selectionPatchForTarget } from '../ui/selection-context.js';
import { createAutosaveService } from './services/autosave-service.js';
import { installE2EHooks } from './e2e-hooks.js';
import { createSelector } from '../core/selectors/create-selector.js';
import { createProjectSelectors } from '../core/selectors/project-selectors.js';


/**
 * The editor, as a thing you build rather than a module that runs (VNX-02,
 * docs/VNEXT_ROADMAP.md).
 *
 * `main.js` used to be six hundred lines that executed on import. That is what
 * made lazy workspaces impossible (VNX-55): a module cannot be loaded on demand
 * if importing it *is* the application starting. Wrapping the wiring in a
 * function does not by itself split anything, but it is the seam every later
 * split needs, and it separates "construct the editor" from "let the page see
 * it".
 *
 * What is left here is wiring: constructing the panels, handing each the narrow
 * callbacks it needs, and connecting the shell's buttons to the services that
 * own the behaviour. Everything with logic of its own has moved to
 * `app/services/`, `core/selectors/`, `core/state/render-plan.js` and
 * `app/workspace-manager.js`.
 */
export function createEditorApp({ root = document.getElementById('app') } = {}) {
  const store = createStore();
  // One memoised set of ViewModels per editor (docs/VNEXT_ROADMAP.md, VNX-04):
  // a panel asks for its model at a revision and gets the same object back until
  // the document actually moves, so an unchanged panel can skip its render.
  const selectors = createProjectSelectors();
  const history = createHistory(store);
  const shell = createAppShell(document.getElementById('app'));
  // Responsive shell (UX-19): drawer + one bottom sheet on compact layouts; session-only UI preference.
  const LAYOUT_PREFERENCE='boop.layoutMode';
  const responsive=createResponsiveShell(document.getElementById('app'),{onChange:state=>{shell.setDrawerState(state.drawerOpen);globalThis.__boopLayoutChanged?.(state);},readPreference:()=>{try{return localStorage.getItem(LAYOUT_PREFERENCE)||'auto';}catch{return 'auto';}},writePreference:mode=>{try{localStorage.setItem(LAYOUT_PREFERENCE,mode);}catch{}}});
  const capabilitySheet=createCapabilitySheet(document.getElementById('capability-panel'),{layout:()=>responsive.snapshot(),onForce:mode=>{responsive.forceLayout(mode);shell.setStatus(mode==='desktop'?'Desktop layout on. Both panels are shown; nothing is gated.':'Automatic layout restored.');}});
  shell.bindCapabilities(()=>capabilitySheet.isOpen()?capabilitySheet.close():capabilitySheet.open());
  shell.bindDrawer(()=>responsive.toggleDrawer(),()=>responsive.closeDrawer());
  shell.bindSheet(detent=>responsive.setSheet(detent));
  const editorContext=createEditorContext(shell.getWorkspace(),store);
  const taskRouter=createTaskRouter({
    getWorkspace:shell.getWorkspace,
    setWorkspace:shell.setWorkspace,
    applyTarget(target){
      const patch=selectionPatchForTarget(target);
      if(patch.animationEditor)patch.animationEditor={...editorContext.get().animationEditor,...patch.animationEditor};
      editorContext.update(patch);
    },
    // "Take me there" has to land on the control, not on the top of a panel that
    // is three screens tall.
    focusPanel:(id)=>shell.focusPanel(id)
  });
  shell.bindTaskNavigation(route=>taskRouter.navigate(route));
  const pluginRegistry = createPluginRegistry();
  pluginRegistry.register(defaultElementPlugin);
  pluginRegistry.register(pathElementPlugin);
  const canvas = createSvgCanvas(shell.canvasEl, store, history, pluginRegistry);
  canvas.setWorkspace(shell.getWorkspace());
  const setDesignTool=(tool)=>{canvas.setTool(tool);shell.setDesignTool(tool);};
  shell.bindDesignTools(setDesignTool);
  // Drawing a shape hands the canvas back to Select, and the toolbar has to say so.
  canvas.onToolChange?.((tool)=>shell.setDesignTool(tool));
  shell.onWorkspaceChange((workspace)=>{canvas.setWorkspace(workspace);editorContext.update({workspace});syncPuppetHandles();syncArtboard();});
  shell.bindPuppetToggle(()=>syncPuppetHandles());
  shell.bindCanvasView((action)=>action==='fit'?canvas.fitToCanvas():action==='reset'?canvas.resetView():canvas.zoomView(action==='in'?1.1:1/1.1));
  const layers = createLayersPanel(shell.leftSidebarEl, store, history, canvas);
  // The working area, drawn on the canvas and resizable in Artwork: a nested
  // `<svg>` clips to its own viewBox, and nothing said so.
  const handleCommands = createHandleCommands(store, history);
  const handleBoard = createHandleBoard(shell.leftSidebarEl.querySelector('#handle-board'), {
    model: () => handleBoardModel(store.getDocument(), preview.getEffectiveParams()),
    commands: handleCommands,
    movements: () => Object.entries(store.getDocument().params || {}).map(([id]) => ({ id, label: controlMeta(id).label })),
    artwork: () => Object.keys(store.getDocument().elements || {}).map((id) => ({ id, name: store.getDocument().layerMetadata?.[id]?.name || id })),
    // Wrapped, not passed: `applyPoseValues` is declared further down the file,
    // and naming it here would read it before it exists.
    applyPose: (values) => applyPoseValues(values),
    selected: () => selectedHandles,
    onSelect: (id, { additive } = {}) => {
      selectedHandles = additive ? (selectedHandles.includes(id) ? selectedHandles.filter((item) => item !== id) : [...selectedHandles, id]) : [id];
      canvas.setSelectedHandles(selectedHandles);
    },
    onStatus: (message, tone) => shell.setStatus(message, tone)
  });
  let selectedHandles = [];
  const artboard = createArtboardPanel(shell.leftSidebarEl.querySelector('#artboard-panel'), { canvas, onStatus: (message) => shell.setStatus(message) });

  /**
   * Right-click a piece of the mascot to edit it where it is drawn.
   *
   * Every action here is one the Layers panel already had; what was missing was
   * reaching them from the artwork instead of from a tree of thirty rows.
   */
  const canvasMenu = createCanvasMenu(shell.canvasEl, {
    getState: () => store.getDocument(),
    getPart: (id) => findSemanticPartByRole(store.getDocument(), id),
    getClip: (id) => canvas.describeClip(id),
    select: (id) => store.mutateSession('selectedId', state => { state.selectedId = id; }),
    onClose: () => shell.canvasEl.focus?.(),
    onAction: (action, id, value) => {
      const document_ = store.getDocument();
      if (action === 'rename') { history.snapshot(); canvas.setName(id, value); canvasMenu.refresh(); return; }
      if (action === 'points') { taskRouter.navigate('artwork'); setDesignTool('node'); return; }
      if (action === 'release-clip') { if (canvas.releaseClip(id)) shell.setStatus('The clip is off: this piece is no longer cut to another shape. Undo puts it back.'); return; }
      if (action === 'duplicate') { canvas.duplicate(id); shell.setStatus('Copy added in front of the original, and selected.'); return; }
      if (action === 'forward' || action === 'backward') {
        // "Forward" is depth, not list order: painted last is painted in front,
        // which is *later* among its siblings. The two used to be wired to the
        // Layers panel's up/down, so both buttons did the opposite.
        const position = siblingPosition(document_.layers, id);
        const room = action === 'forward' ? position && position.index < position.count - 1 : position && position.index > 0;
        if (!room) { shell.setStatus(`Already at the ${action === 'forward' ? 'front' : 'back'} of its group.`); return; }
        history.snapshot();
        canvas.reorder(id, action === 'forward' ? 'down' : 'up');
        return;
      }
      // The menu stays open: a hidden piece cannot be right-clicked again, so
      // closing on Hide would make Show unreachable from the canvas.
      if (action === 'visibility') { history.snapshot(); canvas.setVisibility(id, !layerVisible(document_.layers, id)); canvasMenu.refresh(); return; }
      if (action === 'lock') { history.snapshot(); canvas.setLocked(id, !document_.layerMetadata?.[id]?.locked); canvasMenu.refresh(); return; }
      if (action === 'delete') { canvas.delete(id); shell.setStatus('Artwork deleted. Undo brings it back.'); return; }
      if (action === 'part' || action === 'assign') {
        const part = findSemanticPartByRole(document_, id);
        if (part) {
          // The same door the checklist opens, so the Inspector arrives on Setup
          // and reveals itself on a narrow screen.
          taskRouter.navigate({ task: 'face-setup', target: { kind: 'semantic-part', id: part.id } });
          rigPanel.openPart(part.id, 'setup');
          responsive.revealInspector();
          return;
        }
        // Nothing owns this piece yet: the checklist is where artwork is given a
        // part, so go there with the piece selected rather than to a blank panel.
        taskRouter.navigate({ task: 'face-setup', focus: 'face-setup-checklist', target: { kind: 'artwork-element', id } });
        shell.setStatus('Choose the face part this artwork should play.');
      }
    }
  });
  const layerVisible = (items, id) => { for (const item of items || []) { if (item.id === id) return item.visible !== false; const found = layerVisible(item.children, id); if (found !== null) return found; } return null; };
  /** Where a piece sits among the siblings it is painted with, so a move that cannot happen is not offered as one. */
  function siblingPosition(items, id) {
    const list = items || [];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) return { index, count: list.length };
    for (const item of list) { const found = siblingPosition(item.children, id); if (found) return found; }
    return null;
  }
  // Artwork and Face Setup: the two places where editing a piece is the point.
  // In Preview the canvas is a test bench, and a delete there would be a trap.
  const CANVAS_MENU_WORKSPACES = new Set(['create', 'rig']);
  shell.canvasEl.addEventListener('contextmenu', (event) => {
    if (!CANVAS_MENU_WORKSPACES.has(shell.getWorkspace())) return;
    if (!store.getDocument().svgMarkup || event.target.closest('button,input,select,label,[data-canvas-menu]')) return;
    const id = artworkIdAt(event.target, store.getDocument().elements, shell.canvasEl);
    if (!id) return;
    event.preventDefault();
    canvasMenu.open(id, { x: event.clientX, y: event.clientY });
  });
  const inspector = createInspector(shell.inspectorEl, store, history, canvas);
  let timeline;
  let lastReactionId=null;
  const preview = createPreviewController({ store, canvas, onError: error=>shell.setStatus(`Preview stopped: ${error.message}`,'error'), onFrame: ({ time }) => { const output=shell.previewEl.querySelector('#current-time'); if(output) output.textContent=time.toFixed(2); const playhead=shell.previewEl.querySelector('#playhead'); if(playhead) playhead.value=String(time); const activeReaction=preview.getActiveReaction()?.id||null; if(activeReaction!==lastReactionId){lastReactionId=activeReaction;if(shell.getWorkspace()==='preview'&&!shell.previewPanelEl.querySelector(':focus'))previewPanel.render();} } });
  const states = createStateMachineEditor(shell.leftSidebarEl, store, history, preview, editorContext);
  timeline = createTimelinePanel(shell.previewEl, store, history, preview, editorContext, message=>shell.setStatus(message));
  const rigPanel = createRigPanel(shell.rigEl, store, history, preview, (name, value, options) => timeline.autoKey(name, value, options), canvas, editorContext, shell.rigPartsEl);
  const faceSetup=createFaceSetupPanel(shell.faceSetupEl,store,history,canvas,editorContext,{openPart:(id,tab)=>{rigPanel.openPart(id,tab);responsive.revealInspector();},geometry:id=>canvas.getElementFrame(id),highlight:id=>canvas.setSuggestedArtwork(id)});
  const applyPoseValues=(values)=>{for(const [name,value] of Object.entries(values||{}))if(store.getDocument().params?.[name])preview.setLiveParam(name,value);previewPanel?.render?.();canvas.refreshPuppetHandles();};
  const faceMovements=createFaceMovementsPanel(shell.faceMovementsEl,store,history,editorContext,{openMovement:(id,control)=>{rigPanel.openMovement(id,control);responsive.revealInspector();},applyPose:applyPoseValues,liveValues:()=>preview.getEffectiveParams()});
  // V2 head pose and hands (docs/HEAD_POSE_2_5D.md, docs/HAND_RIGGING.md).
  const headPosePanel=createHeadPosePanel(shell.headPoseEl,store,history,{
    // Capture is a transient canvas pose session: nothing is authored until the
    // author presses Capture, and Cancel restores the artwork exactly.
    beginPose:(ids,{capture,cancel})=>canvas.beginTransformPose(ids,{instruction:'Move the artwork into the head position, then press Capture.',capture:()=>capture(canvas.captureTransformPose()||{}),cancel}),
    measure:(id)=>canvas.getElementBounds(id),
    cancelPose:()=>canvas.cancelRigTool(),
    onPreview:(values)=>{for(const [name,value] of Object.entries(values))if(store.getDocument().params?.[name])preview.setLiveParam(name,value);},
    pairs:()=>{const parts=Object.values(store.getDocument().semanticParts||{});const map={};for(const part of parts){const roles=part.roles||{};for(const [left,right] of [['leftEye','rightEye'],['leftPupil','rightPupil'],['leftBrow','rightBrow'],['leftEar','rightEar']])if(roles[left]&&roles[right])map[roles[left]]=roles[right];}return map;}
  });
  /**
   * Draw a pair of hands rather than asking for an SVG of one.
   *
   * The artwork goes onto the canvas first, exactly as a face feature does, and
   * the rig that follows is one command over it: one undo takes both back.
   */
  function drawHandPair(){
    const before=store.getDocument();
    if(areHandsInstalled(before))return false;
    try{
      const artwork=canvas.appendArtwork(handsMarkup(before),null,{updateStore:false,viewBox:handsViewBox(before)});
      if(!artwork)return false;
      if(!addHandsCommand(store,history,artwork))return false;
      preview.apply();
      shell.setStatus('Two hands drawn and rigged. Try Fist, Point or Peace.');
      return true;
    }catch(error){
      canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});
      shell.setStatus(`Could not draw the hands: ${error.message}`,'error');
      return false;
    }
  }
  const handSetupPanel=createHandSetupPanel(shell.handSetupEl,store,history,{
    onSelect:(id)=>{if(id)editorContext.update({selectedId:id});},
    artboardWidth:()=>Number(canvas.getElementBounds?.(Object.keys(store.getDocument().elements||{})[0])?.width)||0,
    measure:(id)=>canvas.getElementBounds(id),
    applyPose:applyPoseValues,
    liveValues:()=>preview.getEffectiveParams(),
    drawHands:drawHandPair,
    handsDrawn:()=>areHandsInstalled(store.getDocument())
  });
  const warpPanel=createWarpPanel(shell.warpPanelEl,store,history,{
    selectedId:()=>store.getSession().selectedId,
    geometry:(id)=>canvas.getElementBounds(id),
    pathOf:(id)=>store.getDocument().elements?.[id]?.restPath||canvas.getPathData?.(id)||null
  });
  const expressionStudio=createExpressionStudio({listHost:shell.expressionsEl,inspectorHost:shell.expressionInspectorEl,store,history,preview,editorContext,onStatus:(message,tone)=>shell.setStatus(message,tone),navigate:route=>taskRouter.navigate(route)});
  const motionStudio=createMotionStudio({listHost:shell.motionsEl,inspectorHost:shell.motionInspectorEl,store,history,preview,editorContext,onStatus:(message,tone)=>shell.setStatus(message,tone),navigate:route=>taskRouter.navigate(route),openTimeline:()=>{shell.showTimeline();timeline.requestRender();shell.previewEl.querySelector('.timeline-shell')?.focus();},canOpenTimeline:()=>responsive.layout!=='mobile'});
  const reactionStudio=createReactionStudio({listHost:shell.reactionsEl,inspectorHost:shell.reactionInspectorEl,store,history,preview,editorContext,onStatus:(message,tone)=>shell.setStatus(message,tone),navigate:route=>taskRouter.navigate(route)});
  const automaticPanel=createAutomaticPanel(shell.automaticEl,store,history,preview,editorContext,{navigate:route=>taskRouter.navigate(route),onStatus:(message,tone)=>shell.setStatus(message,tone),openAdvanced:()=>{editorContext.update({authorMode:'behaviors'});states.render();}});
  const contextInspector=createContextInspector(shell.contextInspectorEl,editorContext,()=>taskRouter.currentTask);
  // A context change is three jobs, not one dense line: tell the panels whose
  // workspace it is, redraw the ones that follow the context, and decide whether
  // a phone should slide the inspector into view (app/workspace-manager.js).
  // Subscribed here so nothing is missed; the manager needs every panel, so it
  // is built once they all exist.
  let workspaceManager = null;
  editorContext.subscribe((context)=>workspaceManager?.apply(context));
  const exporter = createExporter(shell.exportEl, store, canvas);

  function reportFatalError(error) {
    console.error(error);
    shell.setStatus('Something went wrong. Your project autosave has not been deleted.', 'error');
  }
  window.addEventListener('error', (event) => reportFatalError(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportFatalError(event.reason));
  // Dirty state and the local recovery record live in a service now
  // (docs/VNEXT_ROADMAP.md, VNX-02): the debounce, the saved baseline and the
  // messages both produce are one testable object instead of four module
  // variables and five closures. It is created here so its baseline is taken at
  // the same moment the old `savedVersionToken` was.
  const autosave = createAutosaveService({
    store, storage: localStorage,
    serializeSvg: () => canvas.serializeCurrentSvg(),
    prepareSnapshot: (snapshot) => prepareProjectSnapshot(snapshot, (svg) => canvas.prepareSvgImport(svg)),
    createSnapshot: createProjectSnapshot,
    diagnostics: lifecycleDiagnostics,
    setDirty: (dirty, autosaved) => shell.setDirty(dirty, autosaved),
    setStatus: (message, tone) => shell.setStatus(message, tone),
    setRecoveryState: (recovery) => shell.setRecoveryState(recovery)
  });
  const { discardRecovery, getRecoveryState, refreshRecovery } = autosave;
  // Loading, saving and replacing a project is one service now
  // (app/services/project-service.js, VNX-02): six paths that all confirm,
  // stop, swap, clear undo and re-baseline in the same order, and that can be
  // exercised without a browser.
  const projectService = createProjectService({
    store, history, canvas, preview, timeline, autosave,
    setStatus: (message, tone) => shell.setStatus(message, tone),
    setProjectLoaded: (loaded) => shell.setProjectLoaded(loaded),
    closeHome: () => shell.closeHome(),
    navigate: (route) => taskRouter.navigate(route),
    confirmReplacement: () => shell.confirmProjectReplacement(),
    resetContext: () => editorContext.reset(shell.getWorkspace()),
    exitPreviewMode: () => previewService.setLive(false)
  });
  const { restoreSnapshot, saveProject } = projectService;




  const renderPluginStatus = () => shell.setPluginStatus(`Plugins: ${pluginRegistry.list().map((p) => `${p.type}:${p.enabled ? 'on' : 'off'}`).join(' • ')}`);
  renderPluginStatus();
  shell.bindUndoRedo(() => history.undo(), () => history.redo());
  history.subscribe((s) => shell.setUndoRedoState(s));
  shell.bindPluginToggles((type, enabled) => {
    pluginRegistry.setEnabled(type, enabled);
    renderPluginStatus();
    shell.setStatus(`Plugin ${type} ${enabled ? 'enabled' : 'disabled'} (applies to next imports).`, 'warn');
  });



  shell.bindLoadSvg((file) => projectService.loadSvgFile(file));

  shell.bindLoadSample((kind) => projectService.loadTemplate(kind));

  shell.bindAddFeature((featureId)=>{if(featureId==='hands'){drawHandPair();return;}const feature=FACE_FEATURES[featureId],before=store.getDocument();if(!feature||isFaceFeatureInstalled(before,featureId))return;try{const artwork=canvas.appendArtwork(feature.artwork,feature.mountPoint,{updateStore:false});if(!artwork)return;if(!installFaceFeatureCommand(store,history,featureId,artwork))return;preview.apply();shell.setStatus(`${feature.name} added with ready-to-try examples.`);}catch(error){canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});shell.setStatus(`Could not add ${feature.name}: ${error.message}`,'error');}});

  function renderProjectUi(){syncPuppetHandles();shell.renderProjectUi(selectors.projectShell(store.getPersistentRevision(),store.getDocument()));previewPanel.render();}

  /* ── Direct controls (docs/DIRECT_CONTROLS.md) ─────────────────────────────
   * Handles on the mascot itself, in the three tasks where posing is the point.
   * A drag sets the same parameters the sliders set; in Expressions it also
   * writes them into the expression being shaped, as one undoable step.
   */
  /** Artwork is the task that draws, so it is the task that shows the edges. */
  function syncArtboard() {
    const drawing = shell.getWorkspace() === 'create';
    canvas.showArtboardFrame(drawing);
    if (drawing) artboard.render();
  }

  const PUPPET_TASKS = new Set(['rig', 'expressions', 'preview']);
  const liveFaceValues = () => preview.getEffectiveParams();
  // Which handles exist depends only on the rig, so it is derived once per
  // document revision rather than on every task switch and every render.
  // The generated set, with whatever the author changed about it.
  const puppetHandleSelector = createSelector(resolveRigHandles);
  const projectPuppetHandles = () => puppetHandleSelector(store.getPersistentRevision(), store.getDocument());
  function syncPuppetHandles() {
    const handles = store.getDocument().svgMarkup ? projectPuppetHandles() : [];
    if (!handles.length) { canvas.clearPuppetHandles(); return; }
    canvas.setPuppetHandles(handles, {
      getValues: liveFaceValues,
      // The head handle says where it is in the 2.5D grid; the others say which
      // movement they are on.
      describe: (handle, values) => (handle.grid
        ? headPoseReadout(headPoseGrid(store.getDocument(), values || liveFaceValues()))
        : puppetReadout(handle, values || liveFaceValues())),
      grid: (handle) => (handle.grid ? headPoseGrid(store.getDocument(), liveFaceValues()) : null),
      snap: (values) => snapHeadPoseValues(values),
      generateTurn: () => { headPosePanel.generateTurn(); shell.setStatus('2.5D turn generated from the face parts.'); },
      goToCell: (cell) => { const grid = headPoseGrid(store.getDocument(), liveFaceValues()); const found = grid.cells.find((item) => item.i === cell.i && item.j === cell.j); return found ? { headX: found.x, headY: found.y } : null; },
      onChange: (values, { commit }) => {
        for (const [name, value] of Object.entries(values)) preview.setLiveParam(name, value);
        // Shaping an expression: the gesture lands in it, not only in the preview.
        if (commit && shell.getWorkspace() === 'expressions' && expressionStudio.activeExpressionId()) expressionStudio.writeControls(values);
        // And with Auto Key on, posing the mascot *is* animating it: the drag
        // writes a key on every control it moved, at the playhead, in one step.
        // Until now the only thing that keyed was a slider in the rig panel.
        if (commit) timeline.autoKeyMany(values);
        previewPanel.syncPads?.();
      }
    });
    canvas.showPuppetHandles(PUPPET_TASKS.has(shell.getWorkspace()) && shell.isPuppetVisible());
  }

  shell.bindGenerateFace((options) => projectService.generateFace(options));

  shell.bindApplyPreset((presetId) => projectService.applyPreset(presetId));

  shell.bindSaveProject(() => projectService.saveProject());

  shell.bindLoadProject((file) => projectService.loadProjectFile(file));

  shell.bindNew(() => shell.showHome({ focus: 'new' }));
  const validationCache=createValidationCache(validateProject, ()=>['artwork','rig','stateMachine','semanticRig','animation','expressions','reactions'].map(domain=>store.getDomainRevision(domain)).join(':'));
  // Task readiness: plain-language sections with stable codes and deep-link routes (UX-08).
  // Memoized per document revision so badges, Preview, Problems and Export share one readiness object.
  const taskReadiness=()=>{const document=store.getDocument();return selectors.readiness(store.getPersistentRevision(),document,validationCache.run(document));};
  // Readiness deep links, Problems and Export share one vocabulary -- a section,
  // an issue, and the `fix` context an issue names -- so they are one service
  // (app/services/export-service.js, VNX-02). main.js keeps the wiring only.
  const exportService=createExportService({store,exporter,validationCache,readiness:taskReadiness,navigate:route=>taskRouter.navigate(route),updateContext:context=>editorContext.update(context),setStatus:(message,tone)=>shell.setStatus(message,tone),showProblems:(readiness,issues,onFix,onGo)=>shell.showProblems(readiness,issues,onFix,onGo),setReturnToExport:visible=>shell.setReturnToExport(visible)});
  // The guided journey: one canonical answer to "what do I do next?" (docs/GUIDED_JOURNEY.md).
  const projectGuide=()=>selectors.guide(store.getPersistentRevision(),store.getDocument(),taskReadiness());
  const guideBar=createGuideBar(shell.guideBarEl,{
    guide:projectGuide,
    navigate:route=>taskRouter.navigate(route),
    isDismissed:()=>shell.isGuideDismissed(),
    setDismissed:value=>shell.setGuideDismissed(value)
  });
  const previewPanel=createPreviewPanel(shell.previewPanelEl,store,preview,{navigate:route=>taskRouter.navigate(route),readiness:taskReadiness});
  // Preview mode (app/services/preview-service.js, VNX-02): the flag, what it
  // does to the shell, and the canvas gestures that only mean something while
  // Preview is open.
  const previewService = createPreviewService({
    preview, store,
    getWorkspace: shell.getWorkspace,
    revealInspector: () => responsive.revealInspector(),
    renderPanel: () => previewPanel.render(),
    setStatus: (message, tone) => shell.setStatus(message, tone)
  });
  // Publishing belongs where the author is already standing (VNX-10).
  const publishPanel = createPublishPanel(shell.publishPanelEl, {
    readiness: () => (store.getDocument().svgMarkup ? taskReadiness() : null),
    issues: () => validationCache.run(store.getDocument()),
    onGo: (section) => exportService.goToReadiness(section),
    onFix: (issue) => exportService.fixProblem(issue),
    onExport: () => exportService.openExport()
  });
  shell.bindPreviewReset(() => previewService.reset());
  shell.bindValidate(() => exportService.showProblems());
  shell.bindPreview((enabled) => previewService.setLive(enabled));
  // Export (UX-16): the panel itself explains what blocks it and deep-links to the fix; Back to Export returns here.
  exportService.configure();
  shell.bindExport(exportService.openExport);
  shell.bindReturnToExport(exportService.openExport);
  // Advanced hub (UX-17): expert surfaces stay collapsed in the project menu; routes reuse the task router and author modes.
  const advancedHub=createAdvancedHub(shell.advancedEl,store,editorContext,{applyRoute:plan=>{if(plan.route)taskRouter.navigate(plan.route);if(plan.inspectorTab){inspector.openAdvanced(plan.inspectorTab);responsive.revealInspector();}if(plan.authorMode){editorContext.update({authorMode:plan.authorMode});states.render();}if(plan.timeline){shell.showTimeline();timeline.requestRender();}},openMenu:()=>shell.openProjectMenuAdvanced(),diagnostics:()=>lifecycleDiagnostics.snapshot(),issues:()=>validationCache.run(store.getDocument()),onStatus:(message,tone)=>shell.setStatus(message,tone),layout:()=>responsive.layout});
  shell.bindOpenAdvanced(()=>advancedHub.open());
  // Command palette (UX-18): one registry of actions and searchable items; every run goes through existing handlers or commands.
  const commandRegistry=createCommandRegistry();
  const paletteContext=()=>({document:store.getDocument(),session:store.getSession(),history:history.getState(),blocking:exportBlockingIssues(validationCache.run(store.getDocument()))});
  const needsProject=(context)=>context.document.svgMarkup?{ok:true}:{ok:false,reason:'Add artwork first.'};
  for(const [id,label] of [['artwork','Artwork'],['face-setup','Face Setup'],['expressions','Expressions'],['animate','Animate'],['reactions','Reactions'],['preview','Preview']])commandRegistry.register({id:`go:${id}`,title:`Go to ${label}`,group:'Go to',keywords:['task','workspace',label],run:()=>taskRouter.navigate({task:id})});
  commandRegistry.register({id:'action:export',title:'Export files',group:'Actions',keywords:['download','rig.json','mascot.svg','runtime.js'],enabled:(context)=>!context.document.svgMarkup?{ok:false,reason:'Add artwork first.'}:context.blocking.length?{ok:false,reason:`Export is blocked: ${context.blocking[0].message}`}:{ok:true},run:exportService.openExport});
  commandRegistry.register({id:'action:problems',title:'Project check (Problems)',group:'Actions',keywords:['readiness','validate','problems','check'],run:()=>exportService.showProblems()});
  commandRegistry.register({id:'action:save',title:'Save Project',group:'Actions',keywords:['download','json','project'],enabled:needsProject,run:()=>saveProject()});
  commandRegistry.register({id:'action:new',title:'New Project',group:'Actions',keywords:['home','templates','start'],run:()=>shell.showHome({focus:'new'})});
  commandRegistry.register({id:'action:undo',title:'Undo',group:'Actions',shortcut:'Ctrl+Z',enabled:(context)=>context.history.canUndo?{ok:true}:{ok:false,reason:'Nothing to undo.'},run:()=>history.undo()});
  commandRegistry.register({id:'action:redo',title:'Redo',group:'Actions',shortcut:'Ctrl+Y',enabled:(context)=>context.history.canRedo?{ok:true}:{ok:false,reason:'Nothing to redo.'},run:()=>history.redo()});
  commandRegistry.register({id:'action:reset-mascot',title:'Reset mascot (Preview)',group:'Actions',keywords:['preview','clear','live'],enabled:needsProject,run:()=>{taskRouter.navigate({task:'preview'});previewService.reset({announce:false});}});
  commandRegistry.register({id:'action:advanced',title:'Advanced tools',group:'Advanced',keywords:['parameters','bindings','constraints','morphs','state machine','diagnostics','plugins'],run:()=>advancedHub.open()});
  commandRegistry.register({id:'action:timeline',title:'Timeline',group:'Advanced',keywords:['keys','dope sheet','animation','keyframes'],enabled:needsProject,run:()=>{taskRouter.navigate({task:'animate'});shell.showTimeline();timeline.requestRender();}});
  commandRegistry.registerIndex(({document})=>[
    ...(document.expressions||[]).map(item=>({id:`expression:${item.id}`,title:item.name,group:'Expressions',subtitle:'Expression',keywords:['expression','face'],run:()=>taskRouter.navigate({task:'expressions',target:{kind:'expression',id:item.id}})})),
    ...(document.animationClips||[]).map(item=>({id:`motion:${item.id}`,title:item.name,group:'Motions',subtitle:'Motion',keywords:['motion','animation','clip'],run:()=>taskRouter.navigate({task:'animate',target:{kind:'animation-clip',id:item.id}})})),
    ...(document.reactions||[]).map(item=>({id:`reaction:${item.id}`,title:item.name,group:'Reactions',subtitle:'Reaction',keywords:['reaction','trigger','click'],run:()=>taskRouter.navigate({task:'reactions',target:{kind:'reaction',id:item.id}})})),
    ...Object.values(document.semanticParts||{}).map(part=>({id:`part:${part.id}`,title:part.name||part.type||part.id,group:'Face parts',subtitle:'Face part',keywords:['face','part',String(part.type||'')],run:()=>taskRouter.navigate({task:'face-setup',target:{kind:'semantic-part',id:part.id}})})),
    ...Object.keys(document.states||{}).map(name=>({id:`state:${name}`,title:name,group:'States',subtitle:'State (advanced)',keywords:['state','pose'],run:()=>{taskRouter.navigate({task:'animate',target:{kind:'state',id:name}});editorContext.update({authorMode:'states'});states.render();}})),
    ...(document.layers||[]).slice(0,40).map(layer=>({id:`layer:${layer.id}`,title:layer.name||layer.id,group:'Artwork',subtitle:'Artwork element',keywords:['layer','element','svg'],run:()=>taskRouter.navigate({task:'artwork',target:{kind:'artwork-element',id:layer.id}})}))
  ]);
  const palette=createCommandPalette(shell.paletteEl,commandRegistry,{context:paletteContext,onStatus:(message,tone)=>shell.setStatus(message,tone)});
  shell.bindSearch(()=>palette.open());

  const validationTask=createDebouncedTask(()=>{const state=store.getDocument(),issues=validationCache.run(state),blocking=exportBlockingIssues(issues);lifecycleDiagnostics.increment('validation.runs');shell.setReadiness(taskReadiness(),issues);shell.setSetupSections(selectors.setupSections(store.getPersistentRevision(),state));guideBar.render();previewPanel.render();publishPanel.render();if(!state.layers.length)shell.setStatus('Import SVG artwork or start from a template.','warn');else if(blocking.length)shell.setStatus(`${blocking.length} problem(s): ${blocking[0].message}`,'warn');else shell.setStatus(`Project ready • ${taskReadiness().artwork.summary}`,'info');},150);
  const onPersistent=()=>{const state=store.getState();shell.setProjectLoaded(Boolean(state.svgMarkup));shell.setProjectActionsEnabled(hasValidProjectDocument(state));validationTask.schedule();autosave.schedule();};
  // Which panel watches which domain is a table now (docs/VNEXT_ROADMAP.md,
  // VNX-05). `render-plan.js` owns the mapping, this file owns the panels, and
  // the two are checked against each other: a domain with no plan, or a plan
  // naming a panel that is gone, fails here at wiring time rather than quietly
  // at runtime. It is also the one place a ViewModel gate will need to skip a
  // target whose model did not change (VNX-04).
  const renderTargets = {
    artboardPanel: () => artboard.render(),
    artboardSync: () => syncArtboard(),
    automaticPanel: () => automaticPanel.render(),
    canvasMenu: () => canvasMenu.refresh(),
    canvasSelection: () => canvas.syncSelection(store.getSession().selectedId),
    canvasState: () => canvas.reconcileState(store.getState()),
    exporter: () => exporter.render(),
    expressionStudio: () => expressionStudio.render(),
    faceMovements: () => faceMovements.render(),
    faceSetup: () => faceSetup.render(),
    handSetup: () => handSetupPanel.render(),
    handleBoard: () => handleBoard.render(),
    headPose: () => headPosePanel.render(),
    inspector: () => inspector.render(),
    layerOrder: () => canvas.syncLayerOrder(store.getDocument().layers),
    layers: () => layers.render(),
    motionStudio: () => motionStudio.render(),
    previewPanel: () => { previewPanel.render(); publishPanel.render(); },
    projectShell: () => renderProjectUi(),
    // Rebuilding the handle set and moving the handles already drawn are not the
    // same job, and the pose grid only ever needs the cheap one.
    puppetHandles: () => syncPuppetHandles(),
    puppetHandlesRefresh: () => canvas.refreshPuppetHandles(),
    reactionStudio: () => reactionStudio.render(),
    rigPanel: () => rigPanel.render(),
    states: () => states.render(),
    timeline: () => timeline.requestRender(),
    warpPanel: () => warpPanel.render()
  };
  const renderPlan = createRenderPlan(renderTargets, { onError: (name, error) => shell.setStatus(`${name} could not redraw: ${error.message}`, 'error') });
  workspaceManager = createWorkspaceManager({
    panels: { rigPanel, faceSetup, expressionStudio, reactionStudio },
    targets: renderTargets,
    renderInspector: () => contextInspector.render(),
    setSheetSubject: (text) => shell.setSheetSubject(text),
    isCompact: () => responsive.isCompact(),
    revealInspector: () => responsive.revealInspector(),
    inspectorHeading: () => document.getElementById('context-inspector-heading').textContent
  });

  for (const domain of Object.keys(DOCUMENT_RENDER_PLAN)) store.subscribeDocument(domain, () => { renderPlan.run(domain); onPersistent(); });
  // Selection is session state: it redraws, and it never makes a project dirty.
  for (const key of Object.keys(SESSION_RENDER_PLAN)) store.subscribeSession(key, () => renderPlan.run(key, SESSION_RENDER_PLAN));
  store.subscribeSession('animationEditor',()=>timeline.requestRender());

  refreshRecovery();
  shell.bindRecoverAutosave(async()=>{const recovery=getRecoveryState();if(recovery.status!=='available'){shell.setStatus('This local draft could not be read. Your current project was not changed.','error');refreshRecovery();return;}try{await restoreSnapshot(recovery.snapshot,'Local draft',{recovered:true});}catch{shell.setStatus('This local draft could not be read. Your current project was not changed.','error');}});
  shell.bindDiscardRecovery(()=>{discardRecovery();shell.setStatus('Local draft discarded.');});
  window.addEventListener('beforeunload',(event)=>{if(!autosave.isDirty())return;event.preventDefault();event.returnValue='';});

  timeline.render();
  rigPanel.render();
  faceSetup.render();
  faceMovements.render();
  headPosePanel.render();
  handSetupPanel.render();
  warpPanel.render();
  expressionStudio.render();
  motionStudio.render();
  reactionStudio.render();
  automaticPanel.render();
  globalThis.__boopLayoutChanged=()=>{motionStudio.render();advancedHub.render?.();};
  // Preview: clicking the mascot triggers its click reactions (preview-only, shared runtime sequencer).
  previewService.bindCanvas(shell.canvasEl);
  contextInspector.render();
  states.render();
  exporter.render();
  layers.render();
  syncArtboard();
  handleBoard.render();
  shell.setStatus('Import an SVG or start from a template.', 'warn');
  shell.setProjectLoaded(false); shell.setDirty(false); shell.setProjectActionsEnabled(false); shell.showHome({ focus: 'new' });
  renderProjectUi();


  // Escape closes the topmost surface first (UX-21): menu, palette, help, popovers (focus returns to their opener), drawer, sheet, Home, Focus Preview.
  const closeTopSurface=()=>{
    if(canvasMenu.close())return true;
    if(canvas.cancelGizmoDrag?.())return true;
    // A half-drawn shape goes before the tool does: Escape twice leaves both.
    if(canvas.cancelDrawing?.())return true;
    // Escape leaves a vector tool for Select, which is where every other
    // interaction lives: a tool you cannot get out of is a trap.
    if(canvas.getNodeEdit?.()||shell.getDesignTool?.()!=='select'){setDesignTool('select');return true;}
    if(shell.closeProjectMenu())return true;
    if(palette.isOpen()){palette.close();return true;}
    if(shell.isShortcutHelpOpen()){shell.closeShortcutHelp();return true;}
    if(capabilitySheet.isOpen()){capabilitySheet.close();return true;}
    if(advancedHub.isOpen()){advancedHub.close();return true;}
    if(!shell.exportEl.hidden){shell.exportEl.hidden=true;document.getElementById('export-top')?.focus();return true;}
    if(shell.closeProblems())return true;
    if(responsive.closeTopmost())return true;
    if(shell.isHomeOpen())return shell.closeHome();
    if(shell.isFocus()){shell.exitFocus();return true;}
    return false;
  };
  window.addEventListener('keydown', (event) => {
    const typing = isTextTarget(event.target);
    const shortcut = matchShortcut(event, { typing });
    if (shortcut === 'escape') { if (closeTopSurface()) event.preventDefault(); return; }
    // Save never types a character: it also works from a text field and keeps the browser's own Save dialog away.
    if (shortcut === 'save') { event.preventDefault(); const result = commandRegistry.run('action:save', paletteContext()); if (!result.ok) shell.setStatus(result.reason, 'error'); return; }
    if (typing) return;
    const meta = event.ctrlKey || event.metaKey;
    if(shortcut==='palette'){event.preventDefault();if(palette.isOpen())palette.close();else palette.open();return;}
    if(shortcut==='help'){event.preventDefault();shell.openShortcutHelp(shortcutHelpMarkup());return;}
    if(shortcut==='play'&&shell.getWorkspace()==='animate'){event.preventDefault();timeline.togglePlayback();return;}
    if (shortcut === 'undo') {
      event.preventDefault();
      history.undo();
      return;
    }
    if (shortcut === 'redo') {
      event.preventDefault();
      history.redo();
      return;
    }
    if (meta && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); return; }
    // The keyboard route to the canvas menu (UX-21): no gesture is mouse-only.
    if((event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))&&store.getState().selectedId&&CANVAS_MENU_WORKSPACES.has(shell.getWorkspace())){
      event.preventDefault();
      const box=document.querySelector(`#canvas #${CSS.escape(store.getState().selectedId)}`)?.getBoundingClientRect();
      canvasMenu.open(store.getState().selectedId, box?{x:box.x+box.width/2,y:box.y+box.height/2}:{x:0,y:0});
      return;
    }
    if (meta && event.key.toLowerCase()==='d' && shell.getWorkspace()==='create') { const id=store.getState().selectedId;if(id){event.preventDefault();canvas.duplicate(id);}return; }
    if (shell.getWorkspace()==='create'&&!meta) {
      // With something selected under the Select tool, G/R/S/P drive the
      // transform gizmo (docs/SELECTION_GIZMO.md). Deselect and the same keys go
      // back to switching vector tools, so neither shortcut is ever unreachable.
      const id=store.getState().selectedId;
      if(id&&canvas.getGizmoMode&&canvas.handleGizmoKey(event)){event.preventDefault();return;}
      // Enter closes a pen run, the way every vector editor does.
      if(event.key==='Enter'&&canvas.isDrawing?.()){event.preventDefault();canvas.finishDrawing();return;}
      const tool={v:'select',n:'node',p:'pen',r:'rect',o:'ellipse',h:'hand'}[event.key.toLowerCase()];
      if(tool){event.preventDefault();setDesignTool(tool);return;}
      if(id&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();canvas.delete(id);return;}
    }

    const index = Number(event.key) - 1;
    const nextState = ['animate','preview'].includes(shell.getWorkspace())&&Number.isInteger(index) && index >= 0 ? Object.keys(store.getState().states)[index] : undefined;
    if (nextState) {
      const current = store.getState().activeState;
      if (previewService.isLive() && !canTransition(store.getState().transitions, current, nextState)) {
        shell.setStatus(`Transition blocked: ${current} → ${nextState}`, 'warn');
        return;
      }
      if (previewService.activateState(nextState)) shell.setStatus(`State switched: ${nextState}`);
    }
  });


  /**
   * Go live: publish the optional browser-test seam, then announce readiness.
   *
   * Nothing here is async today, so `mount()` is not either -- an `await` that
   * never waits reads like a promise the code does not keep.
   */
  return {
    mount() {
      // Deliberately opt-in browser-test seam (app/e2e-hooks.js). It is absent from
      // normal editor URLs, and it reads the editor rather than wiring it, which is
      // why it no longer lives here.
      installE2EHooks({
        store, canvas, preview, history, exporter, taskRouter, contextInspector, responsive, capabilitySheet,
        validationCache, taskReadiness, diagnostics: lifecycleDiagnostics, autosave,
        panels: { faceSetup, faceMovements, motionStudio, reactionStudio, automaticPanel, advancedHub, palette }
      });

      // Published only after every required renderer and the optional E2E seam exist.
      // Browser tests and integrations can use this instead of racing arbitrary delays.

      // Published only after every required renderer and the optional E2E seam
      // exist. Browser tests and integrations use this instead of racing delays.
      root.dataset.editorReady = 'true';
      return true;
    }
  };
}
