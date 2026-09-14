import { createAppShell } from '../shell/app-shell.js';
import { createStore } from '../core/state/store.js';
import { createHistory } from '../core/undo/history.js';
import { createSvgCanvas } from '../svg-editor/svg-canvas.js';
import { createLayersPanel, siblingPosition } from '../svg-editor/layers-panel.js';
import { createArtboardPanel } from '../ui/artboard-panel.js';
import { readArtboard } from '../core/artwork/artboard.js';
import { createPinCommands } from '../core/rig/pin-commands.js';
import { resolveRigHandles } from '../core/puppet/handle-model.js';
import { createInspector } from '../inspector/inspector.js';
import { createPreviewController } from '../core/preview-runtime/preview-controller.js';
import { createExporter } from '../core/export/exporter.js';
import { exportBlockingIssues, validateProject } from '../core/validation/validate-project.js';
import { createPreviewPanel } from '../ui/preview-panel.js';
import { createPublishPanel } from '../ui/publish-panel.js';
import { posesOnCanvas, puppetHandles, puppetReadout } from '../core/puppet/puppet-handles.js';
import { headPoseGrid, headPoseReadout, snapHeadPoseValues } from '../core/puppet/head-pose-handle.js';
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
import { FACE_FEATURES, describeFaceFeature, featureMountPoint, fitFeatureArtwork } from '../core/sample/face-features.js';
import { createHandCommands } from '../core/hands/hand-commands.js';
import { sanitizeSvgMarkup } from '../core/security/sanitize-svg.js';
import { installFaceFeatureCommand } from '../core/sample/face-feature-command.js';
import { createEditorContext } from '../ui/editor-context.js';
import { lifecycleDiagnostics } from '../core/diagnostics/lifecycle-diagnostics.js';
import { DOCUMENT_RENDER_PLAN, SESSION_RENDER_PLAN, createRenderPlan } from '../core/state/render-plan.js';
import { createHandArtwork } from './hand-artwork.js';
import { createWorkspaceManager } from './workspace-manager.js';
import { createDesignWorkspace } from './workspaces/design.js';
import { createRigWorkspace } from './workspaces/rig.js';
import { createAnimateWorkspace } from './workspaces/animate.js';
import { createBehaviorWorkspace } from './workspaces/behavior.js';
import { createExportService } from './services/export-service.js';
import { createPreviewService } from './services/preview-service.js';
import { browserDownload, createProjectService } from './services/project-service.js';
import { MODES, WORKSPACES, createTaskRouter, modeToWorkspace } from '../ui/task-router.js';
import { createContextInspector } from '../ui/context-inspector.js';
import { artworkScopeMarkup, describeArtworkScope } from '../ui/artwork-scope.js';
import { deformBenchMarkup, describeDeformation } from '../ui/advanced-tools.js';
import { artworkIdAt, createCanvasMenu } from '../ui/canvas-menu.js';
import { actionRefusal, deleteConfirmation, deleteMessage, gestureDepth, matchPieceKey, pieceActionsFor, takesGestures } from '../ui/piece-actions.js';
import { createSemanticRigCommands } from '../rig-editor/semantic-parts/semantic-rig-commands.js';
import { createSelectionActions } from '../ui/selection-actions.js';
import { describeStage } from '../ui/preview-stage.js';
import { findSemanticPartByRole } from '../rig-editor/semantic-parts/part-model.js';
import { selectionPatchForTarget } from '../ui/selection-context.js';
import { createAutosaveService } from './services/autosave-service.js';
import { installE2EHooks } from './e2e-hooks.js';
import { createSelector } from '../core/selectors/create-selector.js';
import { createToolOptions, normalizeDrawOptions, readDrawOptions, writeDrawOptions } from '../ui/tool-options.js';
import { createColourPicker, paletteFromSvg } from '../ui/colour-picker.js';
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
 *
 * And since UIR-16, the panels of each workspace have moved as well: a module
 * per question, built here and asked for its render targets and its lifecycle
 * (`app/workspaces/README.md`). What stays is what belongs to no workspace —
 * the canvas and its tools (§5, Règle A), the one Inspector (Règle B), the
 * project services, and the command surfaces that reach every screen.
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
    getMode:shell.getMode,
    setMode:shell.setMode,
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
  // The options bar under the vector toolbar: what a new shape is painted
  // with, a polygon's sides, the grid, and the Node tool's point operations.
  // UI preferences, remembered in the browser, never part of the project.
  let drawOptions=readDrawOptions();
  canvas.setDrawOptions(drawOptions);
  const toolOptions=createToolOptions(document.getElementById('tool-options'),{
    getTool:()=>shell.getDesignTool(),
    getOptions:()=>drawOptions,
    setOptions:(patch)=>{drawOptions=normalizeDrawOptions({...drawOptions,...patch});writeDrawOptions(drawOptions);canvas.setDrawOptions(drawOptions);},
    node:{focused:()=>canvas.focusedNode(),convert:(kind)=>canvas.convertFocusedNode(kind),remove:()=>canvas.deleteFocusedNode()},
    openColour:(options)=>colourPicker.open(options),
    // Several pieces at once: the bar lines them up, spreads them, groups them
    // and cuts them to the shape in front (docs/VECTOR_EDITING.md).
    // Lining pieces up is not a vector-editor idea: two eyes that want the same
    // height want it in Design ▸ Face too, and the bar lived behind
    // `workspace === 'create'` so it was unreachable exactly where the pieces
    // are placed by eye (audit §5). The gate is now "a surface that edits a
    // piece at all", which is the table the gestures read; `#tool-options` is
    // its own element, so this brings the arrange bar without bringing nine
    // drawing tools with it.
    selection:{ids:()=>(takesGestures(shell.getWorkspace())?store.getSession().selectedIds||[]:[]),align:(kind)=>canvas.alignSelection(kind),distribute:(axis)=>canvas.distributeSelection(axis),group:()=>canvas.groupMany(store.getSession().selectedIds||[]),
      focused:()=>(takesGestures(shell.getWorkspace())?store.getSession().selectedId||null:null),
      // Group and Cut restructure the drawing, so they stay in the vector editor.
      vector:()=>shell.getWorkspace()==='create',
      clip:()=>{const result=canvas.setClip(store.getSession().selectedIds||[]);
        // The shape that did the cutting is out of the drawing now, so it is
        // out of the selection too: a selection naming a piece nobody can see
        // is a selection every panel has to guess about.
        if(result.ok&&result.targets?.length)store.mutateSession('selectedIds',state=>{state.selectedIds=result.targets;});
        shell.setStatus(result.ok?'Cut to the shape in front. The shape is now doing the cutting; "Stop cutting" brings it back.':result.message,result.ok?'info':'error');},
      // A cut is drawn on the canvas as a dashed outline, so the way to take it
      // off belongs beside the drawing rather than only in a menu.
      cutOn:(id)=>(shell.getWorkspace()==='create'?canvas.describeClip(id):null),
      release:(id)=>{if(canvas.releaseClip(id))shell.setStatus('The cut is off, and the shape that was doing it is back in the drawing. Redraw it and cut again, or undo.');}}
  });
  const setDesignTool=(tool)=>{canvas.setTool(tool);shell.setDesignTool(tool);toolOptions.render();};
  shell.bindDesignTools(setDesignTool);
  // Drawing a shape hands the canvas back to Select, and the toolbar has to say so.
  canvas.onToolChange?.((tool)=>{shell.setDesignTool(tool);toolOptions.render();});
  canvas.onNodeFocus?.(()=>toolOptions.render());
  // A new text is typed in the Inspector, so the Inspector's text field is where
  // the cursor goes; a shape that reaches past the working area says so.
  canvas.onArtworkCreated?.((id,kind,info)=>{
    if(kind==='text')requestAnimationFrame(()=>{const field=document.querySelector('#inspector [data-text-content]');if(field){field.focus();field.select?.();}});
    if(info?.overflow)shell.setStatus('Part of this shape is outside the working area and will be cut there. Fit to artwork, in the Artwork panel, grows the area around it.','warn');
  });
  toolOptions.render();
  // Leaving Animate stops what the timeline started. The transport is in the
  // timeline, the timeline is only in Animate, and a clip, a layered motion or
  // an arrangement left running has nothing to stop it anywhere else (V3-13).
  //
  // And the mascot holds still where it is being designed, or moves again where
  // it is not (docs/STILL_WHILE_DESIGNING.md): the service owns which workspaces
  // those are, this only tells it which one is open. Session-only in both
  // directions -- no document is read and none is written.
  shell.onWorkspaceChange((workspace)=>{canvas.setWorkspace(workspace);syncPieceModel(workspace);editorContext.update({workspace});syncPuppetHandles();syncArtboard();syncSelectionActions();if(workspace!=='animate')timeline?.stopPlayback();previewService.holdStill(workspace);});
  shell.bindPuppetToggle(()=>syncPuppetHandles());
  shell.bindCanvasView((action)=>action==='fit'?canvas.fitToCanvas():action==='selection'?canvas.zoomToSelection():action==='reset'?canvas.resetView():canvas.zoomView(action==='in'?1.1:1/1.1));
  // The wheel zooms too, so the readout has to follow the canvas, not the
  // buttons -- and so does the bar anchored to the selection. One handler:
  // `onViewChange` holds exactly one, and a second call replaces the first.
  canvas.onViewChange?.((view)=>{shell.setZoomValue(view.scale);syncSelectionActions();});
  const layers = createLayersPanel(shell.leftSidebarEl, store, history, canvas);
  // The working area, drawn on the canvas and resizable in Artwork: a nested
  // `<svg>` clips to its own viewBox, and nothing said so.
  /** The piece Ctrl/Cmd+C remembered, for Ctrl/Cmd+V. Session-only. */
  let artworkClipboard = null;
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
    // What the menu offers is the catalogue, filtered for this piece and for
    // how deep this surface goes (`ui/piece-actions.js`).
    // The whole catalogue, and the menu folds it at this surface's depth: an
    // action a surface does not lead with is one press further down, never
    // gone (audit §5, and UIR-00).
    getActions: (id) => { const piece = pieceContext(id); return piece && gestureDepth(shell.getWorkspace()) ? pieceActionsFor(piece, 'advanced') : []; },
    depth: () => gestureDepth(shell.getWorkspace()) || 'advanced',
    // Every entry runs through the one runner below, which is also what the
    // keyboard and the on-canvas bar call: three doors, one implementation.
    onAction: (action, id, value) => runPieceAction(action, id, { value, from: 'menu' })
  });
  const layerVisible = (items, id) => { for (const item of items || []) { if (item.id === id) return item.visible !== false; const found = layerVisible(item.children, id); if (found !== null) return found; } return null; };
  // Which surfaces take a piece gesture, and how deep their menu goes, is
  // `GESTURE_SURFACES` in `ui/piece-actions.js` -- one table instead of a set
  // here, a set in the key handler and a CSS rule in the stylesheet, which is
  // how Design ▸ Face came to be an editing surface with no editing in it. In
  // Preview the canvas is still a test bench, and a delete there would still be
  // a trap: `takesGestures('preview')` is false.
  const pinCommands = createPinCommands(store, history);
  let menuPoint = null;
  shell.canvasEl.addEventListener('contextmenu', (event) => {
    if (!takesGestures(shell.getWorkspace())) return;
    if (!store.getDocument().svgMarkup || event.target.closest('button,input,select,label,[data-canvas-menu],[data-selection-actions]')) return;
    const id = artworkIdAt(event.target, store.getDocument().elements, shell.canvasEl);
    if (!id) return;
    event.preventDefault();
    menuPoint = { x: event.clientX, y: event.clientY };
    canvasMenu.open(id, { x: event.clientX, y: event.clientY });
  });
  // One dialog for every colour in the editor: the artwork's own palette first
  // (`ui/colour-picker.js`), then a standard set, then a hex field.
  const colourPicker = createColourPicker(shell.colourPickerEl, { palette: () => paletteFromSvg(store.getDocument().svgMarkup) });
  const inspector = createInspector(shell.inspectorEl, store, history, canvas, { openColour: (options) => colourPicker.open(options) });
  // The Character Builder (docs/CHARACTER_BUILDER.md): the parts a person
  // names, on the same canvas and the same document, editing through the same
  // commands the Artwork inspector runs. Its presets load a template through
  // the project service, and a style is the face part command over the
  // canvas (docs/FACE_PART_LIBRARY.md, "Installing"); the service and the
  // preview are built further down and only ever called from a press, hence
  // the wrappers.
  // Hand artwork is nobody's screen: Design draws a state onto a hand, Rig draws
  // the pair, and the canvas's own picker draws one a hand has not got yet
  // (app/hand-artwork.js).
  const handArtwork = createHandArtwork({ store, history, canvas, setStatus: (message, tone) => shell.setStatus(message, tone), applyPreview: () => preview.apply() });
  // DESIGN, as its own module (UIR-16, app/workspaces/README.md).
  const design = createDesignWorkspace({
    store, history, shell, canvas, editorContext,
    navigate: (route) => taskRouter.navigate(route),
    setStatus: (message, tone) => shell.setStatus(message, tone),
    revealInspector: () => responsive.revealInspector(),
    setDesignTool: (tool) => setDesignTool(tool),
    openColour: (options) => colourPicker.open(options),
    loadTemplate: (kind) => projectService.loadTemplate(kind),
    applyPreview: () => preview.apply(),
    drawHandStyle: (side, style) => handArtwork.addStyle(side, style),
    drawHandPair: (look) => handArtwork.drawPair(look),
    download: browserDownload,
    runPieceAction: (action, id) => runPieceAction(action, id, { from: 'inspector' })
  });
  const { characterBuilder, handStates, facePartCommands } = design.panels;

  /**
   * Teach the canvas what a piece is, on the surfaces that have pieces.
   *
   * The canvas knows SVG elements; it does not know that seven of them are one
   * eye. Design ▸ Face and Design ▸ Hands are where a person handles a mascot,
   * and they are exactly the `simple` half of the table the gestures already
   * read (`ui/piece-actions.js`) — so this cannot drift from it. Artwork is the
   * vector editor and Rig assigns roles to named elements: both want the shape
   * under the pointer, and both get null.
   */
  const syncPieceModel = (workspace) => canvas.setPieceModel(gestureDepth(workspace) === 'simple' ? {
    resolve: (id) => characterBuilder.resolvePiece(id),
    contains: (root, id) => characterBuilder.containsPiece(root, id),
    commit: (id, transform) => characterBuilder.commitTransform(id, transform)
  } : null);
  syncPieceModel(shell.getWorkspace());

  /* ── One piece, one set of gestures, every surface ─────────────────────────
   *
   * `ui/piece-actions.js` holds the catalogue and the decisions; this holds the
   * commands. Three doors come through here -- the canvas menu, the bar on the
   * selection, and the keyboard -- so Delete cannot mean one thing in Artwork
   * and nothing at all in Design ▸ Face, which is precisely what it meant
   * before (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §1).
   */

  /**
   * What a piece is, as the catalogue needs to hear it.
   *
   * The Character Builder answers for the library — whether this shape is one
   * of a part's drawings, what hangs on it, how much of the rig it plays — and
   * the canvas answers for the artwork. Neither could answer alone.
   */
  function pieceContext(id) {
    const document_ = store.getDocument();
    if (!id || !document_.elements?.[id]) return null;
    const described = characterBuilder.describePiece?.(id) || null;
    const kind = canvas.elementKind?.(id) || document_.elements[id]?.meta?.nodeType || null;
    return {
      id,
      label: described?.label || document_.layerMetadata?.[id]?.name || id,
      locked: Boolean(document_.layerMetadata?.[id]?.locked),
      visible: layerVisible(document_.layers, id) !== false,
      isolated: canvas.getEditScope?.() === id,
      row: Boolean(described?.row),
      library: Boolean(described?.library),
      part: findSemanticPartByRole(document_, id),
      path: kind === 'path',
      shape: ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(kind),
      clip: canvas.describeClip?.(id) || null,
      group: kind === 'g',
      roles: described?.roles || 0,
      hosted: described?.hosted || 0
    };
  }

  /** Which of the catalogue's actions this piece offers, here, right now. */
  const pieceActionIds = (id) => {
    const piece = pieceContext(id);
    const depth = gestureDepth(shell.getWorkspace());
    return piece && depth ? pieceActionsFor(piece, depth).map((action) => action.id) : [];
  };

  /**
   * Delete, with the one thing that makes it safe to do without asking: a
   * button that takes it back.
   *
   * A library part goes through the face-part command, which takes its artwork,
   * its roles and its movements off together — the path that leaves no dangling
   * `role references missing element` behind it. Anything else is artwork.
   * Confirmation is the exception, not the rule (`deleteConfirmation`): several
   * pieces at once, a piece other parts hang on, or a group carrying two or
   * more movements.
   */
  async function deletePieces(ids) {
    const unlocked = ids.filter((id) => store.getDocument().elements?.[id] && !store.getDocument().layerMetadata?.[id]?.locked);
    if (!unlocked.length) { shell.setStatus(actionRefusal('delete', { locked: true }), 'warn'); return false; }
    const described = unlocked.map((id) => pieceContext(id)).filter(Boolean);
    const first = described[0];
    // Roles across the whole selection: lassoing the eyes and the mouth
    // together is exactly the delete that silently takes four movements with
    // it, and reading only the first piece would have missed it.
    const ask = deleteConfirmation({
      count: unlocked.length,
      hosted: described.reduce((sum, piece) => sum + piece.hosted, 0),
      roles: described.reduce((sum, piece) => sum + piece.roles, 0)
    });
    if (ask.confirm && !(await shell.confirmDelete(ask))) return false;
    const label = first?.label || 'Artwork';
    let hosted = 0;
    if (unlocked.length > 1) canvas.deleteMany(unlocked);
    else {
      const removal = characterBuilder.removePiece?.(unlocked[0]);
      if (removal?.done) hosted = removal.hosted;
      else if (removal?.reason) { shell.setStatus(removal.reason, 'warn'); return false; }
      else canvas.delete(unlocked[0]);
    }
    const said = deleteMessage({ label, count: unlocked.length, hosted });
    shell.setStatus(said.message, 'info', { action: { label: said.action, run: () => undo() } });
    return true;
  }

  /**
   * Run one action on one piece.
   *
   * @param {string} action an id from `PIECE_ACTIONS`, or `rename`
   * @param {string} id
   * @param {{ value?: string, from?: 'menu'|'bar'|'key' }} [options]
   */
  function runPieceAction(action, id, { value, from } = {}) {
    const document_ = store.getDocument();
    if (!id || !document_.elements?.[id]) return false;
    const piece = pieceContext(id);
    // A locked piece does one thing, wherever the press came from.
    if (piece?.locked && action !== 'lock') { shell.setStatus(actionRefusal(action, { locked: true }), 'warn'); return false; }
    const name = () => document_.layerMetadata?.[id]?.name || id;

    if (action === 'rename') { history.snapshot(); canvas.setName(id, value); canvasMenu.refresh(); return true; }
    if (action === 'delete') { deletePieces(store.getSession().selectedIds?.length > 1 ? store.getSession().selectedIds : [id]); return true; }
    if (action === 'duplicate') { canvas.duplicate(id); shell.setStatus('Copy added in front of the original, and selected.', 'info', { action: { label: 'Undo', run: () => undo() } }); return true; }
    if (action === 'replace') { characterBuilder.openReplace?.(id); return true; }
    if (action === 'flip-x' || action === 'flip-y') {
      if (!canvas.flip(id, action === 'flip-x' ? 'x' : 'y')) return false;
      shell.setStatus(`Flipped ${action === 'flip-x' ? 'horizontally' : 'vertically'} around its pivot.`, 'info', { action: { label: 'Undo', run: () => undo() } });
      return true;
    }
    if (action === 'forward' || action === 'backward') {
      // "Forward" is depth, not list order: painted last is painted in front,
      // which is *later* among its siblings.
      const position = siblingPosition(document_.layers, id);
      const room = action === 'forward' ? position && position.index < position.count - 1 : position && position.index > 0;
      if (!room) { shell.setStatus(actionRefusal(action, { room: false })); return false; }
      history.snapshot();
      canvas.reorder(id, action === 'forward' ? 'down' : 'up');
      return true;
    }
    if (action === 'front' || action === 'back') {
      if (!canvas.reorderToEnd(id, action)) { shell.setStatus(actionRefusal(action, { room: false })); return false; }
      return true;
    }
    // The menu stays open on a toggle: a hidden piece cannot be right-clicked
    // again, so closing on Hide would make Show unreachable from the canvas.
    if (action === 'visibility') { history.snapshot(); canvas.setVisibility(id, !layerVisible(document_.layers, id)); canvasMenu.refresh(); return true; }
    if (action === 'lock') { history.snapshot(); canvas.setLocked(id, !document_.layerMetadata?.[id]?.locked); canvasMenu.refresh(); return true; }
    if (action === 'isolate') {
      const on = canvas.getEditScope?.() === id;
      canvas.setEditScope?.(on ? null : id);
      shell.setStatus(on ? 'Everything is showing again.' : `Working on ${name()} alone. The rest of the mascot is dimmed; press Isolate again to bring it back.`);
      return true;
    }
    if (action === 'reset-position') { characterBuilder.resetPart?.(id, 'position'); return true; }
    if (action === 'points') { taskRouter.navigate('artwork'); setDesignTool('node'); return true; }
    if (action === 'pin') {
      // Where the menu was opened is where the pin goes.
      const at = menuPoint ? canvas.artworkPointAt(menuPoint.x, menuPoint.y) : null;
      const point = at || (() => { const box = canvas.measureElement?.(id); return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null; })();
      const result = point ? pinCommands.create(id, point, { restPath: canvas.authoredPath?.(id) }) : { ok: false, message: 'Nowhere to put it.' };
      if (!result.ok) { shell.setStatus(result.message, 'error'); return false; }
      taskRouter.navigate({ mode: 'rig.deform', focus: 'holding-panel' });
      store.mutateSession('selectedId', state => { state.selectedId = id; });
      shell.setStatus(`Pin added on ${name()}. Drag it where it should hold; the small squares set its reach.`);
      return true;
    }
    if (action === 'to-path') {
      const result = canvas.convertToPath?.(id) || { ok: false, message: 'Not here.' };
      shell.setStatus(result.ok ? `${name()} is a path now: it can be reshaped point by point, pinned and warped.` : result.message, result.ok ? 'info' : 'error');
      return result.ok;
    }
    if (action === 'release-clip') {
      if (!canvas.releaseClip(id)) return false;
      shell.setStatus('The cut is off, and the shape that was doing it is back in the drawing.', 'info', { action: { label: 'Undo', run: () => undo() } });
      return true;
    }
    if (action === 'part' || action === 'assign') {
      const part = findSemanticPartByRole(document_, id);
      if (part) {
        // The same door the checklist opens, so the Inspector arrives on Setup
        // and reveals itself on a narrow screen.
        taskRouter.navigate({ mode: 'rig.assign', target: { kind: 'semantic-part', id: part.id } });
        rigPanel.openPart(part.id, 'setup');
        responsive.revealInspector();
        return true;
      }
      // Nothing owns this piece yet: the checklist is where artwork is given a
      // part, so go there with the piece selected rather than to a blank panel.
      taskRouter.navigate({ mode: 'rig.assign', focus: 'face-setup-checklist', target: { kind: 'artwork-element', id } });
      shell.setStatus('Choose the face part this artwork should play.');
      return true;
    }
    return false;
  }

  /**
   * The six actions, on the piece, on the canvas (`ui/selection-actions.js`).
   *
   * It follows the selection rather than the gizmo, because it has to appear
   * for a locked piece too — with one button, Unlock — and the gizmo
   * deliberately does not.
   */
  const selectionActions = createSelectionActions(shell.canvasEl, { onAction: (action) => runPieceAction(action, store.getSession().selectedId, { from: 'bar' }) });
  function syncSelectionActions() {
    const id = store.getSession().selectedId;
    const many = (store.getSession().selectedIds || []).length > 1;
    // *Selection* zooms to what is in hand, so it is offered exactly while
    // there is something in hand — including a multi-selection, which is when
    // it is most useful (audit §5).
    shell.setZoomToSelection?.(Boolean(id) && Boolean(store.getDocument().svgMarkup));
    if (!id || many || !takesGestures(shell.getWorkspace()) || !store.getDocument().svgMarkup) { selectionActions.hide(); return; }
    selectionActions.show(canvas.clientBox?.(id), pieceActionIds(id));
  }
  // A bar anchored to a box has to leave while the box is moving: a drag, a
  // marquee and a pan all move it, and a bar lagging a frame behind the artwork
  // it belongs to reads as a bug in the drag. It comes back where the gesture
  // left the piece.
  shell.canvasEl.addEventListener('pointerdown', (event) => { if (!event.target.closest?.('[data-selection-actions]')) selectionActions.hide(); });
  shell.canvasEl.addEventListener('pointerup', () => requestAnimationFrame(syncSelectionActions));


  let timeline;
  let lastReactionId=null;
  const preview = createPreviewController({ store, canvas, onError: error=>shell.setStatus(`Preview stopped: ${error.message}`,'error'), onFrame: ({ time }) => { const output=shell.previewEl.querySelector('#current-time'); if(output) output.textContent=time.toFixed(2); const playhead=shell.previewEl.querySelector('#playhead'); if(playhead) playhead.value=String(time); if(preview.isArrangementPlaying?.()&&!timeline.syncArrangementPlayhead())timeline.requestRender();const activeReaction=preview.getActiveReaction()?.id||null; if(activeReaction!==lastReactionId){lastReactionId=activeReaction;if(shell.getWorkspace()==='preview'&&!shell.previewPanelEl.querySelector(':focus'))previewPanel.render();} } });
  /**
   * Undo and redo put the numbers back; these put the mascot back.
   *
   * The canvas paints a move and *then* writes the document -- every mutation
   * site is `commands.setTransform(...)` followed by
   * `api.applyElementTransform(...)` -- so nothing ever read the document back
   * into the drawing. `history.undo()` replaces the document wholesale, and the
   * artwork stayed exactly where the drag had left it: the inspector's numbers
   * said one thing and the mascot showed another, and the only way to see an
   * undo was to leave the screen and come back.
   *
   * That is what hid it for so long. Every test that pressed Ctrl+Z happened to
   * change workspace afterwards, and the editor opened on Artwork, so the one
   * surface where a person drags a piece and presses Ctrl+Z without going
   * anywhere -- Design ▸ Face, which is now where the editor opens -- was the
   * one nothing covered.
   *
   * `preview.apply()` is the right repaint rather than writing transforms
   * directly: the runtime owns that attribute while a reaction or a motion is
   * playing, and composes the authored transform with the live pose. Writing
   * the base transform underneath it would stamp out whatever was playing.
   */
  const undo = () => { history.undo(); preview.apply(); };
  const redo = () => { history.redo(); preview.apply(); };

  // Two of the four questions, each as its own module (UIR-16,
  // app/workspaces/README.md): what it builds, what it draws, and what it does
  // on the way in and out. Their panels are destructured under the names the
  // render plan and the rest of the wiring already know them by.
  const workspaceContext = { store, history, shell, preview, editorContext, navigate: (route) => taskRouter.navigate(route), setStatus: (message, tone) => shell.setStatus(message, tone) };
  const animate = createAnimateWorkspace({ ...workspaceContext, isMobile: () => responsive.layout === 'mobile' });
  const behavior = createBehaviorWorkspace(workspaceContext);
  const { expressionStudio, motionStudio } = animate.panels;
  const { states, reactionStudio, automaticPanel } = behavior.panels;
  timeline = animate.panels.timeline;
  canvas.setHandPicker({ addStyle: (side, style) => handArtwork.addStyle(side, style) });
  // RIG, as its own module (UIR-16, app/workspaces/README.md).
  const rig = createRigWorkspace({
    store, history, shell, canvas, preview, editorContext,
    navigate: (route) => taskRouter.navigate(route),
    setStatus: (message, tone) => shell.setStatus(message, tone),
    revealInspector: () => responsive.revealInspector(),
    autoKey: (name, value, options) => timeline.autoKey(name, value, options),
    autoKeyMany: (values) => timeline.autoKeyMany(values),
    refreshPreviewPanel: () => previewPanel?.render?.(),
    handArtwork
  });
  const { rigPanel, faceSetup, faceMovements, handleBoard, headPosePanel } = rig.panels;
  const applyPoseValues = rig.applyPose;

  const contextInspector=createContextInspector(shell.contextInspectorEl,editorContext,()=>taskRouter.currentMode);
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
    // A new project is a new drawing: the Character Builder's edit scope, if one was set, does not carry over to an element that happens to share the id.
    resetContext: () => { editorContext.reset(shell.getWorkspace()); canvas.setEditScope?.(null); },
    exitPreviewMode: () => previewService.setLive(false)
  });
  const { restoreSnapshot, saveProject } = projectService;




  const renderPluginStatus = () => shell.setPluginStatus(`Plugins: ${pluginRegistry.list().map((p) => `${p.type}:${p.enabled ? 'on' : 'off'}`).join(' • ')}`);
  renderPluginStatus();
  shell.bindUndoRedo(() => undo(), () => redo());
  history.subscribe((s) => shell.setUndoRedoState(s));
  shell.bindPluginToggles((type, enabled) => {
    pluginRegistry.setEnabled(type, enabled);
    renderPluginStatus();
    shell.setStatus(`Plugin ${type} ${enabled ? 'enabled' : 'disabled'} (applies to next imports).`, 'warn');
  });



  shell.bindLoadSvg((file) => projectService.loadSvgFile(file));

  shell.bindLoadSample((kind) => projectService.loadTemplate(kind));

  // The one-minute path (docs/CHARACTER_BUILDER.md, "The one-minute path";
  // roadmap phase 47): the same rigged template, landing in the Character
  // Builder with the presets open. A preset and a few swaps make a character;
  // nothing of the rig has to be touched.
  const newCharacter = async () => {
    if (!(await projectService.loadTemplate('basic', { mode: 'design.face' }))) return false;
    characterBuilder.openCategory('presets');
    shell.setStatus('Pick a preset, then swap any part for another style. The hands and Preview are one press away.');
    return true;
  };
  shell.bindNewCharacter(newCharacter);

  /** The boxes a preset part is fitted to: the eyes it belongs on, or the head. */
  const featureBoxes=(document_)=>{
    const roles=(type)=>Object.values(document_.semanticParts||{}).find(part=>part?.type===type)?.roles||{};
    const union=(...ids)=>{const boxes=ids.filter(Boolean).map(id=>canvas.measureElement?.(id)).filter(Boolean);if(!boxes.length)return null;
      const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
      return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};};
    // Both eyes or neither: one eye's box would put the pair of brows over one
    // eye, at half the size.
    const eyes=roles('eyes');
    return {eyes:eyes.leftEye&&eyes.rightEye?union(eyes.leftEye,eyes.rightEye):null,head:union(roles('head').head)};
  };
  shell.bindAddFeature((featureId)=>{if(featureId==='hands'){handArtwork.drawPair();return;}const feature=FACE_FEATURES[featureId],before=store.getDocument();const offer=describeFaceFeature(before,featureId);if(!feature||!offer.available){if(offer.reason)shell.setStatus(offer.reason,'warn');return;}try{
    // Fitted to this face and drawn where this face is drawn: the artwork is
    // the template's, and a mascot somebody drew is any size, anywhere.
    const artwork=canvas.appendArtwork(fitFeatureArtwork(featureId,featureBoxes(before)),featureMountPoint(before),{updateStore:false});if(!artwork)return;if(!installFaceFeatureCommand(store,history,featureId,artwork))return;preview.apply();shell.setStatus(`${feature.name} added with ready-to-try examples.`);}catch(error){canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});shell.setStatus(`Could not add ${feature.name}: ${error.message}`,'error');}});

  function renderProjectUi(){syncPuppetHandles();shell.renderProjectUi(selectors.projectShell(store.getPersistentRevision(),store.getDocument()));previewPanel.render();}

  /* ── Direct controls (docs/DIRECT_CONTROLS.md) ─────────────────────────────
   * Handles on the mascot itself, in the four tasks where posing is the point.
   * A drag sets the same parameters the sliders set; in Expressions it also
   * writes them into the expression being shaped, as one undoable step, and in
   * Animate it writes a key at the playhead (V3-13).
   */
  /** Artwork is the task that draws, so it is the task that shows the edges. */
  function syncArtboard() {
    const drawing = shell.getWorkspace() === 'create';
    canvas.showArtboardFrame(drawing);
    if (drawing) artboard.render();
  }

  /**
   * A pose made in Animate that kept nothing says why.
   *
   * The drag moves the mascot either way -- the live values are set before this
   * is reached -- but in Animate the gesture was authoring, and Auto Key off or
   * no motion open makes it a gesture that is quietly forgotten. Everywhere
   * else posing is trying the mascot on, and a warning per drag would be noise.
   */
  const announceAutoKey = (result) => { if (!result?.keyed && result?.message && shell.getWorkspace() === 'animate') shell.setStatus(result.message, 'warn'); };

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
        if (commit) announceAutoKey(timeline.autoKeyMany(values));
        previewPanel.syncPads?.();
      }
    });
    canvas.showPuppetHandles(posesOnCanvas(shell.getWorkspace()) && shell.isPuppetVisible());
  }

  shell.bindGenerateFace((options) => projectService.generateFace(options));


  shell.bindSaveProject(() => projectService.saveProject());

  shell.bindLoadProject((file) => projectService.loadProjectFile(file));
  shell.bindLoadRig((file) => projectService.importRigFile(file));
  // A face pack (docs/FACE_PART_LIBRARY.md, "Face packs"; roadmap phase 44):
  // parts and presets from a JSON file into the library, all or nothing,
  // kept with the author's own; the builder's cards show them at once.
  shell.bindLoadFacePack(async (file) => {
    let pack;
    try { pack = JSON.parse(await file.text()); } catch { shell.setStatus(`Not a face pack: ${file.name} is not JSON.`, 'error'); return; }
    const result = facePartCommands.installPack(pack);
    if (!result.ok) { shell.setStatus(`Face pack refused: ${result.reason}`, 'error'); return; }
    characterBuilder.render();
    const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    shell.setStatus(`Face pack "${result.pack.name}" installed: ${count(result.parts.length, 'part')}, ${count(result.presets.length, 'preset')}, kept in this browser. They are cards in the Character Builder, marked Pack.`);
  });

  shell.bindNew(() => shell.showHome({ focus: 'new' }));
  const validationCache=createValidationCache(validateProject, ()=>['artwork','rig','stateMachine','semanticRig','animation','expressions','reactions'].map(domain=>store.getDomainRevision(domain)).join(':'));
  // Task readiness: plain-language sections with stable codes and deep-link routes (UX-08).
  // Memoized per document revision so badges, Preview, Problems and Export share one readiness object.
  const taskReadiness=()=>{const document=store.getDocument();return selectors.readiness(store.getPersistentRevision(),document,validationCache.run(document));};
  // Readiness deep links, Problems and Export share one vocabulary -- a section,
  // an issue, and the `fix` context an issue names -- so they are one service
  // (app/services/export-service.js, VNX-02). main.js keeps the wiring only.
  const exportService=createExportService({store,exporter,validationCache,readiness:taskReadiness,navigate:route=>taskRouter.navigate(route),updateContext:context=>editorContext.update(context),setStatus:(message,tone,options)=>shell.setStatus(message,tone,options),showProblems:(readiness,issues,onFix,onGo,onRepair)=>shell.showProblems(readiness,issues,onFix,onGo,onRepair),setReturnToExport:visible=>shell.setReturnToExport(visible),focusPanel:id=>shell.focusPanel(id),showTimeline:()=>{shell.showTimeline();timeline.requestRender();},openAuthorEditor:()=>{states.render();shell.openAuthorEditor();},
    // The repairs Project check can perform rather than navigate to (audit §4.2).
    repair:{clearRole:(partId,role)=>Boolean(createSemanticRigCommands(store,history).assignRole(partId,role,null))},undo:()=>undo()});
  /**
   * What the mascot is being tested against: a ground, and a size
   * (`ui/preview-stage.js`).
   *
   * Session state, held here rather than in the document: which background an
   * author checked their mascot on is not a fact about the mascot. The canvas
   * reads it through `data-preview-ground` / `--preview-size` on the root, so
   * the stylesheet does the painting and nothing re-renders the artwork.
   */
  let previewStage = { ground: 'checker', size: 'fit' };
  const applyPreviewStage = () => {
    const stage = describeStage(previewStage, previewArtwork());
    root.dataset.previewGround = stage.ground;
    root.style.setProperty('--preview-size', stage.fitted ? '' : `${stage.pixels}px`);
    root.dataset.previewSized = String(!stage.fitted);
  };
  /** The thinnest outline on the mascot, and how big the artboard is: what a size warning is measured from. */
  const previewArtwork = () => {
    const markup = store.getDocument().svgMarkup || '';
    const strokes = [...markup.matchAll(/stroke-width\s*[:=]\s*"?'?\s*([\d.]+)/g)].map((match) => Number(match[1])).filter((width) => width > 0);
    const board = readArtboard(store.getDocument());
    return { strokes, artboard: Math.max(Number(board?.width) || 0, Number(board?.height) || 0) };
  };
  const previewPanel=createPreviewPanel(shell.previewPanelEl,store,preview,{navigate:route=>taskRouter.navigate(route),readiness:taskReadiness,onCommit:(values)=>timeline.autoKeyMany(values),
    stage: () => previewStage,
    artwork: previewArtwork,
    onStage: (patch) => { previewStage = { ...previewStage, ...patch }; applyPreviewStage(); }});
  applyPreviewStage();
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
    onExport: () => exportService.openExport(),
    weigh: () => exporter.createExportArtifacts(),
    revision: () => store.getPersistentRevision()
  });
  // The panels that draw the *live* layer rather than the document: after a
  // reset each one is showing a number the mascot no longer has. Through the
  // render plan, so one panel that throws cannot leave the rest undrawn; the
  // Preview panel is not here because `previewService.reset` already redraws it.
  const LIVE_SURFACES=Object.freeze({live:Object.freeze(['rigPanel','faceMovements','headPose','handleBoard','puppetHandlesRefresh'])});
  /**
   * Put the face back: the one reset, in the project bar, on every tab
   * (docs/STILL_WHILE_DESIGNING.md).
   *
   * It clears the whole session layer over the document and *only* that -- the
   * live pose the puppet handles, the pads and the sliders write, the
   * preview-only behaviour switches, the previewed state and expressions, the
   * transports and the reactions in flight. The artwork, the rig, the
   * expressions, the clips and the parts on the face are the author's work: a
   * button in the project bar does not get to throw those away, so this writes
   * no command, opens no history transaction and moves no revision, and needs no
   * confirmation because there is nothing to confirm. Undo is unchanged by it.
   *
   * Holding still is not cleared either: a reset pressed in the Character
   * Builder must not be the thing that starts the face blinking.
   */
  const resetMascot=()=>{previewService.reset();renderPlan.run('live',LIVE_SURFACES);};
  shell.bindResetMascot(resetMascot);
  shell.bindValidate(() => exportService.showProblems());
  shell.bindPreview((enabled) => previewService.setLive(enabled));
  // Export (UX-16): the panel itself explains what blocks it and deep-links to the fix; Back to Export returns here.
  exportService.configure();
  shell.bindExport(exportService.openExport);
  shell.bindReturnToExport(exportService.openExport);
  // Edit Shape from the Character Builder limits the visible edit to the piece
  // (docs/CHARACTER_BUILDER.md); the chip shows while it does, and brings the
  // author back to the builder with that piece in hand.
  /**
   * The breadcrumb over the canvas, and the way out of a scope (UIR-06).
   *
   * A scope is derived rather than stored: the canvas knows which element it is
   * limited to, the document knows what that element is, and the words come
   * from the two of them. The old chip said "Back to Character" whatever was
   * being edited, which was wrong the moment a hand's drawing could be opened.
   */
  /**
   * The expert bench on Rig ▸ Deform (UIR-10): the six systems that bend
   * artwork, what this project carries in each, and the screen that edits it.
   * Read-only, and honest about the three that have no editor yet.
   */
  const renderDeformBench=()=>{shell.deformBenchEl.innerHTML=deformBenchMarkup(describeDeformation(store.getDocument()));shell.deformBenchEl.hidden=!store.getDocument().svgMarkup;};
  shell.deformBenchEl.addEventListener('click',(event)=>{const panel=event.target.closest('[data-deform-open]')?.dataset.deformOpen;if(panel)taskRouter.navigate({focus:panel});});
  for(const domain of ['keyforms','constraints','hierarchy','artwork'])store.subscribeDocument(domain,renderDeformBench);
  renderDeformBench();
  const renderArtworkScope=()=>{const scope=describeArtworkScope(store.getDocument(),canvas.getEditScope?.()||null);shell.setArtworkScope(artworkScopeMarkup(scope));};
  canvas.onEditScopeChange?.(()=>renderArtworkScope());
  renderArtworkScope();
  // Back the way you came in, with what you were editing still in hand: the
  // piece selected in the builder, or the state selected on its hand.
  shell.bindArtworkScopeBack((mode)=>{
    const id=canvas.getEditScope?.()||null;
    const scope=describeArtworkScope(store.getDocument(),id);
    canvas.setEditScope?.(null);
    if(scope.kind==='hand-state'){taskRouter.navigate({mode});handStates.select(scope.side,scope.stateId);return;}
    taskRouter.navigate(id?{mode,target:{kind:'artwork-element',id}}:{mode});
  });
  // Advanced hub (UX-17): expert surfaces stay collapsed in the project menu; routes reuse the task router and author modes.
  const advancedHub=createAdvancedHub(shell.advancedEl,store,editorContext,{applyRoute:plan=>{if(plan.route)taskRouter.navigate(plan.route);if(plan.inspectorTab){inspector.openAdvanced(plan.inspectorTab);responsive.revealInspector();}if(plan.authorMode){editorContext.update({authorMode:plan.authorMode});states.render();shell.openAuthorEditor();}if(plan.timeline){shell.showTimeline();timeline.requestRender();}},openMenu:()=>shell.openProjectMenuAdvanced(),diagnostics:()=>lifecycleDiagnostics.snapshot(),issues:()=>validationCache.run(store.getDocument()),onStatus:(message,tone)=>shell.setStatus(message,tone),layout:()=>responsive.layout});
  shell.bindOpenAdvanced(()=>advancedHub.open());
  // Command palette (UX-18): one registry of actions and searchable items; every run goes through existing handlers or commands.
  const commandRegistry=createCommandRegistry();
  const paletteContext=()=>({document:store.getDocument(),session:store.getSession(),history:history.getState(),blocking:exportBlockingIssues(validationCache.run(store.getDocument()))});
  const needsProject=(context)=>context.document.svgMarkup?{ok:true}:{ok:false,reason:'Add artwork first.'};
  // Every screen the navigation offers, under the name its tab carries and the
  // words somebody would actually type for it (UIR-01). Built from the route
  // model rather than listed here, so a screen added to the navigation is in
  // the palette by the same edit.
  const PALETTE_KEYWORDS={'design.face':['builder','parts','face','simple','character'],'design.hands':['hand','gesture','drawing','set'],'design.artwork':['svg','draw','vector','artwork','create'],'rig.assign':['roles','assign','face setup','head','eyes','mouth'],'rig.controls':['movements','calibrate','handles','gaze','reach'],'rig.head2d':['turn','2.5d','head pose','grid','pseudo-3d'],'rig.deform':['pins','warp','holds','morph','shape keys','constraints'],'animate.expressions':['expression','happy','sad','face'],'animate.motions':['motion','animation','clip','nod','blink'],'animate.timeline':['timeline','keys','dope sheet','keyframes'],'behavior.reactions':['reaction','trigger','click','when'],'behavior.automatic':['automatic','idle','blink','breathe','on its own'],'behavior.stateMachine':['state machine','states','transitions','behaviors'],preview:['test','play','try','simulate']};
  for(const mode of Object.values(MODES).filter(item=>item.navigable)){
    const workspace=modeToWorkspace(mode.id),group=workspace?WORKSPACES[workspace].label:'Go to';
    commandRegistry.register({id:`go:${mode.id}`,title:workspace?`${group} → ${mode.label}`:`Go to ${mode.label}`,group:'Go to',keywords:['go to','screen','workspace',mode.label,...(PALETTE_KEYWORDS[mode.id]||[])],run:()=>taskRouter.navigate({mode:mode.id})});
  }
  commandRegistry.register({id:'action:export',title:'Export files',group:'Actions',keywords:['download','rig.json','mascot.svg','runtime.js'],enabled:(context)=>!context.document.svgMarkup?{ok:false,reason:'Add artwork first.'}:context.blocking.length?{ok:false,reason:`Export is blocked: ${context.blocking[0].message}`}:{ok:true},run:exportService.openExport});
  // The nine rig panels by name. The route names the panel and the screen that
  // shows it follows (`PANEL_MODES`), so these keep working unchanged as the
  // panels move between screens.
  for(const [id,label,keywords] of [['face-setup-checklist','Face parts',['roles','assign','head','eyes','mouth']],['face-movements','Movements',['calibrate','poses','slider']],['gaze-panel','Gaze',['look','target','eyes']],['head-pose','Head pose',['turn','2.5d','grid']],['hand-setup','Hand placement',['fingers','wave','grip','reach']],['handle-board','Controls',['handles','limits','links','cages']],['holding-panel','Pins & holding',['pin','reach','hold','attachment','relationship','constraint']],['warp-panel','Warp',['lattice','grid','bend']],['rig-parts','All parts',['parts','add part','tongue','accessory']]])commandRegistry.register({id:`go:face-setup:${id}`,title:`Rig → ${label}`,group:'Rig',keywords:['rig','face setup',...keywords],enabled:needsProject,run:()=>taskRouter.navigate({focus:id})});
  // The drawing tools, in the one place that answers "where is X?". They are a
  // row of glyphs on a bar that only exists in Artwork, so an author who has
  // not found that bar yet had nowhere to ask; searching "curve" or "corner"
  // now lands on the Pen and the Node tool rather than on nothing.
  for(const [tool,title,keywords] of [
    ['select','Select tool',['pick','move','arrange','multiple']],
    ['node','Node tool',['points','curve','corner','smooth','straight','reshape','handles']],
    ['pen','Pen tool',['draw','curve','path','bezier']],
    ['line','Line tool',['straight','segment']],
    ['rect','Rectangle tool',['square','box','corner radius']],
    ['ellipse','Ellipse tool',['circle','oval']],
    ['polygon','Polygon tool',['star','sides','triangle','hexagon']],
    ['text','Text tool',['type','label','words']],
    ['hand','Hand tool',['pan','move the view']]
  ])commandRegistry.register({id:`tool:${tool}`,title,group:'Draw',keywords:['tool','draw','artwork',...keywords],enabled:needsProject,run:()=>{taskRouter.navigate({mode:'design.artwork'});setDesignTool(tool);}});
  // Artwork operations whose only home is a selection on the canvas.
  const selectionOf=()=>store.getSession().selectedIds||[];
  commandRegistry.register({id:'artwork:group',title:'Group the selected pieces',group:'Draw',shortcut:'Ctrl+G',keywords:['group','together'],enabled:(context)=>((context.session.selectedIds||[]).length>1?{ok:true}:{ok:false,reason:'Select two or more pieces first.'}),run:()=>canvas.groupMany(selectionOf())});
  commandRegistry.register({id:'artwork:ungroup',title:'Ungroup the selected group',group:'Draw',shortcut:'Ctrl+Shift+G',keywords:['ungroup','split'],enabled:(context)=>(context.session.selectedId?{ok:true}:{ok:false,reason:'Select a group first.'}),run:()=>{if(!canvas.ungroup(store.getSession().selectedId))shell.setStatus('Select a group to ungroup it.','warn');}});
  commandRegistry.register({id:'artwork:clip',title:'Cut to the shape in front',group:'Draw',keywords:['clip','mask','cut','crop'],enabled:(context)=>((context.session.selectedIds||[]).length>1?{ok:true}:{ok:false,reason:'Select the piece to cut and the shape in front of it.'}),run:()=>{const result=canvas.setClip(selectionOf());shell.setStatus(result.ok?'Cut to the shape in front. "Stop cutting it" on the piece brings the shape back.':result.message,result.ok?'info':'error');}});
  commandRegistry.register({id:'action:problems',title:'Project check (Problems)',group:'Actions',keywords:['readiness','validate','problems','check'],run:()=>exportService.showProblems()});
  commandRegistry.register({id:'action:save',title:'Save Project',group:'Actions',keywords:['download','json','project'],enabled:needsProject,run:()=>saveProject()});
  commandRegistry.register({id:'action:new',title:'New Project',group:'Actions',keywords:['home','templates','start'],run:()=>shell.showHome({focus:'new'})});
  commandRegistry.register({id:'action:new-character',title:'New Character',group:'Actions',keywords:['character','preset','builder','face','start','new'],run:()=>{newCharacter();}});
  commandRegistry.register({id:'action:undo',title:'Undo',group:'Actions',shortcut:'Ctrl+Z',enabled:(context)=>context.history.canUndo?{ok:true}:{ok:false,reason:'Nothing to undo.'},run:()=>undo()});
  commandRegistry.register({id:'action:redo',title:'Redo',group:'Actions',shortcut:'Ctrl+Y',enabled:(context)=>context.history.canRedo?{ok:true}:{ok:false,reason:'Nothing to redo.'},run:()=>redo()});
  // No navigation any more: the reset works where the author is standing, so
  // sending them to Preview to press it would be the one thing it is not for.
  commandRegistry.register({id:'action:reset-mascot',title:'Reset mascot',group:'Actions',keywords:['preview','clear','live','pose','rest','default'],enabled:needsProject,run:resetMascot});
  commandRegistry.register({id:'action:advanced',title:'Advanced tools',group:'Advanced',keywords:['parameters','bindings','constraints','morphs','state machine','diagnostics','plugins'],run:()=>advancedHub.open()});
  commandRegistry.register({id:'action:timeline',title:'Timeline',group:'Advanced',keywords:['keys','dope sheet','animation','keyframes'],enabled:needsProject,run:()=>{taskRouter.navigate({mode:'animate.timeline'});shell.showTimeline();timeline.requestRender();}});
  commandRegistry.registerIndex(({document})=>[
    ...(document.expressions||[]).map(item=>({id:`expression:${item.id}`,title:item.name,group:'Expressions',subtitle:'Expression',keywords:['expression','face'],run:()=>taskRouter.navigate({mode:'animate.expressions',target:{kind:'expression',id:item.id}})})),
    ...(document.animationClips||[]).map(item=>({id:`motion:${item.id}`,title:item.name,group:'Motions',subtitle:'Motion',keywords:['motion','animation','clip'],run:()=>taskRouter.navigate({mode:'animate.motions',target:{kind:'animation-clip',id:item.id}})})),
    ...(document.reactions||[]).map(item=>({id:`reaction:${item.id}`,title:item.name,group:'Reactions',subtitle:'Reaction',keywords:['reaction','trigger','click'],run:()=>taskRouter.navigate({mode:'behavior.reactions',target:{kind:'reaction',id:item.id}})})),
    ...Object.values(document.semanticParts||{}).map(part=>({id:`part:${part.id}`,title:part.name||part.type||part.id,group:'Face parts',subtitle:'Face part',keywords:['face','part',String(part.type||'')],run:()=>taskRouter.navigate({mode:'rig.assign',target:{kind:'semantic-part',id:part.id}})})),
    ...Object.keys(document.states||{}).map(name=>({id:`state:${name}`,title:name,group:'States',subtitle:'State (advanced)',keywords:['state','pose'],run:()=>{taskRouter.navigate({mode:'behavior.stateMachine',target:{kind:'state',id:name}});editorContext.update({authorMode:'states'});states.render();shell.openAuthorEditor();}})),
    ...(document.layers||[]).slice(0,40).map(layer=>({id:`layer:${layer.id}`,title:layer.name||layer.id,group:'Artwork',subtitle:'Artwork element',keywords:['layer','element','svg'],run:()=>taskRouter.navigate({mode:'design.artwork',target:{kind:'artwork-element',id:layer.id}})}))
  ]);
  const palette=createCommandPalette(shell.paletteEl,commandRegistry,{context:paletteContext,onStatus:(message,tone)=>shell.setStatus(message,tone)});
  shell.bindSearch(()=>palette.open());

  const validationTask=createDebouncedTask(()=>{const state=store.getDocument(),issues=validationCache.run(state),blocking=exportBlockingIssues(issues);lifecycleDiagnostics.increment('validation.runs');shell.setReadiness(taskReadiness(),issues);shell.setSetupSections(selectors.setupSections(store.getPersistentRevision(),state));previewPanel.render();publishPanel.render();if(!state.layers.length)shell.setStatus('Import SVG artwork or start from a template.','warn',{routine:true});else if(blocking.length)shell.setStatus(`${blocking.length} problem(s): ${blocking[0].message}`,'warn',{routine:true});else shell.setStatus(`Project ready • ${taskReadiness().artwork.summary}`,'info',{routine:true});},150);
  const onPersistent=()=>{const state=store.getState();shell.setProjectLoaded(Boolean(state.svgMarkup));shell.setProjectActionsEnabled(hasValidProjectDocument(state));validationTask.schedule();autosave.schedule();};
  // Which panel watches which domain is a table now (docs/VNEXT_ROADMAP.md,
  // VNX-05). `render-plan.js` owns the mapping, this file owns the panels, and
  // the two are checked against each other: a domain with no plan, or a plan
  // naming a panel that is gone, fails here at wiring time rather than quietly
  // at runtime. It is also the one place a ViewModel gate will need to skip a
  // target whose model did not change (VNX-04).
  const renderTargets = {
    // Each workspace answers for its own panels (UIR-16); what is left here is
    // the canvas, the Inspector and the surfaces every screen shares.
    ...design.targets,
    ...rig.targets,
    ...animate.targets,
    ...behavior.targets,
    artboardPanel: () => artboard.render(),
    artboardSync: () => syncArtboard(),
    canvasMenu: () => canvasMenu.refresh(),
    canvasSelection: () => canvas.syncSelection(store.getSession().selectedId, store.getSession().selectedIds),
    canvasState: () => canvas.reconcileState(store.getState()),
    exporter: () => exporter.render(),
    inspector: () => inspector.render(),
    layerOrder: () => canvas.syncLayerOrder(store.getDocument().layers),
    layers: () => layers.render(),
    previewPanel: () => { previewPanel.render(); publishPanel.render(); },
    previewFrame: () => preview.refresh(),
    projectShell: () => renderProjectUi(),
    // Rebuilding the handle set and moving the handles already drawn are not the
    // same job, and the pose grid only ever needs the cheap one.
    puppetHandles: () => syncPuppetHandles(),
    puppetHandlesRefresh: () => canvas.refreshPuppetHandles(),
    selectionActions: () => syncSelectionActions(),
    toolOptions: () => toolOptions.render()
  };
  const renderPlan = createRenderPlan(renderTargets, { onError: (name, error) => shell.setStatus(`${name} could not redraw: ${error.message}`, 'error') });
  workspaceManager = createWorkspaceManager({
    workspaces: [design, rig, animate, behavior],
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

  animate.render();
  rig.render();
  behavior.render();
  globalThis.__boopLayoutChanged=()=>{motionStudio.render();advancedHub.render?.();};
  // Preview: clicking the mascot triggers its click reactions (preview-only, shared runtime sequencer).
  previewService.bindCanvas(shell.canvasEl);
  // The shell dispatches no change for the workspace it opens in, so the mascot
  // is told where it is once, here (docs/STILL_WHILE_DESIGNING.md).
  previewService.holdStill();
  contextInspector.render();
  exporter.render();
  layers.render();
  design.render();
  syncArtboard();
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
    // Last of all, because everything above is a surface *over* the work and
    // this is the work: with nothing open, Escape drops the selection. The
    // inspector then says "Pick a part on the left, or click the mascot", the
    // bar of actions goes, and the gizmo with it — which is what Escape means
    // in every editor and what it did nowhere here.
    // Out of the piece before out of the selection: a double-click stepped
    // inside an eye to reach its pupil, and Escape is how you come back up a
    // level before it is how you let go (audit §2.1).
    if(canvas.insidePiece?.()){const root=canvas.insidePiece();canvas.leavePiece();canvas.selectMany([root]);return true;}
    if(store.getSession().selectedId||(store.getSession().selectedIds||[]).length){canvas.selectMany([]);return true;}
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
      undo();
      return;
    }
    if (shortcut === 'redo') {
      event.preventDefault();
      redo();
      return;
    }
    // The mascot back to rest from the keyboard, on every tab (UX-21): the
    // topbar button, the palette and this key are one action.
    if (shortcut === 'reset-mascot') { event.preventDefault(); if (store.getDocument().svgMarkup) resetMascot(); return; }
    if (meta && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); return; }
    // Several pieces at once (docs/SELECTION_GIZMO.md): select them all, group
    // them, take a group apart. Grouping stays with the vector editor -- a
    // group is an SVG `<g>`, and there is nothing for it to mean in a list of
    // face parts -- but selecting everything is just a selection.
    if(shortcut==='select-all'&&takesGestures(shell.getWorkspace())){event.preventDefault();canvas.selectAll();return;}
    if(shortcut==='group'&&shell.getWorkspace()==='create'){event.preventDefault();const ids=store.getSession().selectedIds||[];if(ids.length)canvas.groupMany(ids);return;}
    if(shortcut==='ungroup'&&shell.getWorkspace()==='create'){event.preventDefault();const id=store.getState().selectedId;if(id&&!canvas.ungroup(id))shell.setStatus('Select a group to ungroup it.','warn');return;}
    // The keyboard route to the canvas menu (UX-21): no gesture is mouse-only.
    if((event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))&&store.getState().selectedId&&takesGestures(shell.getWorkspace())){
      event.preventDefault();
      const box=canvas.clientBox?.(store.getState().selectedId);
      canvasMenu.open(store.getState().selectedId, box?{x:box.x+box.width/2,y:box.y+box.height/2}:{x:0,y:0});
      return;
    }
    // Copy and paste, the way every vector editor spells "duplicate": Ctrl+C
    // remembers the selected piece, Ctrl+V puts a copy of it in front of the
    // original — even after the selection moved on to something else.
    if (meta && event.key.toLowerCase()==='c' && takesGestures(shell.getWorkspace()) && !event.target.closest?.('#timeline-panel')) { const id=store.getState().selectedId;if(id&&store.getDocument().elements[id]){event.preventDefault();artworkClipboard=id;shell.setStatus('Copied. Ctrl/Cmd+V pastes a copy.');}return; }
    if (meta && event.key.toLowerCase()==='v' && takesGestures(shell.getWorkspace()) && !event.target.closest?.('#timeline-panel')) { if(artworkClipboard&&store.getDocument().elements[artworkClipboard]){event.preventDefault();canvas.duplicate(artworkClipboard);shell.setStatus('Pasted a copy in front of the original, and selected it.','info',{action:{label:'Undo',run:()=>undo()}});}else if(artworkClipboard){shell.setStatus('The copied piece is gone from the project.','warn');}return; }
    // Arrow keys move the selected artwork by one unit, ten with Shift, when
    // nothing more specific (a path node, a handle, the layer tree) has the
    // keyboard. Every other kind of handle already nudged; the selection did not.
    const nudgeSelection=()=>{const nudge={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!nudge||!store.getState().selectedId||canvas.getNodeEdit?.()||shell.getDesignTool?.()!=='select'||!(event.target===document.body||event.target===shell.canvasEl))return false;event.preventDefault();const amount=event.shiftKey?10:1;const ids=store.getSession().selectedIds||[];if(ids.length>1)canvas.nudgeMany(ids,nudge[0]*amount,nudge[1]*amount);else canvas.nudge(store.getState().selectedId,nudge[0]*amount,nudge[1]*amount);return true;};

    /* ── The gestures of one piece, on every surface that edits one ──────────
     *
     * This block used to be two, and the difference between them is the whole
     * of the audit's first finding: `character` got the arrows and the gizmo
     * keys, `create` got those *and* Delete, Ctrl+D, Ctrl+C/V, Ctrl+A and the
     * drawing tools. So the screen built for somebody who does not know what an
     * SVG is was the one screen where Delete did nothing at all.
     *
     * One block now, gated by `takesGestures` — the same table the canvas menu
     * and the on-canvas bar read, so a gesture cannot be wired to one door and
     * not the others (`ui/piece-actions.js`).
     */
    if (takesGestures(shell.getWorkspace())) {
      const id = store.getState().selectedId;
      if (!meta && nudgeSelection()) return;
      // With something selected, G/R/S/P pick the gizmo mode
      // (docs/SELECTION_GIZMO.md). They share no letter with the vector tools:
      // the shape just drawn is selected, and R must still mean Rectangle —
      // which is why the gizmo keys are only read when the canvas is not
      // holding a drawing tool.
      // Shift+F fills the view with what is in hand. `F` alone is free, but a
      // bare letter that moves the view is a letter somebody will hit while
      // reaching for a tool.
      if (!meta && event.shiftKey && event.key.toLowerCase() === 'f' && id) { event.preventDefault(); shell.setZoomValue(canvas.zoomToSelection()); return; }
      if (!meta && id && canvas.getGizmoMode && canvas.handleGizmoKey(event)) { event.preventDefault(); return; }
      // Two things own these keys before the selection does, and both only
      // exist in the vector editor: a pen run owns Enter and Backspace, and a
      // focused path node owns Delete.
      if (!meta && canvas.isDrawing?.() && canvas.handleDrawKey?.(event)) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && canvas.focusedNode?.()) { event.preventDefault(); canvas.deleteFocusedNode(); return; }
      const piece = matchPieceKey(event);
      if (piece && id) { event.preventDefault(); runPieceAction(piece, id, { from: 'key' }); return; }
      // The drawing tools are the vector editor's alone: `V N P L R O S T H`
      // in Design ▸ Face would put a beginner into the Pen with no way back.
      if (!meta && shell.getWorkspace() === 'create') {
        const tool={v:'select',n:'node',p:'pen',l:'line',r:'rect',o:'ellipse',s:'polygon',t:'text',h:'hand'}[event.key.toLowerCase()];
        if(tool){event.preventDefault();setDesignTool(tool);return;}
      }
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
        validationCache, taskReadiness, diagnostics: lifecycleDiagnostics, autosave, project: projectService,
        panels: { faceSetup, faceMovements, motionStudio, reactionStudio, automaticPanel, advancedHub, palette, characterBuilder }
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
