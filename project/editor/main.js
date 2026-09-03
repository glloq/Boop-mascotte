import { createAppShell } from './ui/app-shell.js';
import { createCleanProjectState, createStore } from './core/state/store.js';
import { createHistory } from './core/undo/history.js';
import { createSvgCanvas } from './svg-editor/svg-canvas.js';
import { createLayersPanel } from './svg-editor/layers-panel.js';
import { createInspector } from './inspector/inspector.js';
import { createStateMachineEditor } from './animation-editor/state-machine-editor.js';
import { createPreviewController } from './core/preview-runtime/preview-controller.js';
import { compileFrame } from './core/preview-runtime/frame-compiler.js';
import { createRigPanel } from './rig-editor/semantic-parts/rig-panel.js';
import { createFaceSetupPanel } from './rig-editor/semantic-parts/face-setup-panel.js';
import { createFaceMovementsPanel } from './rig-editor/semantic-parts/face-movements-panel.js';
import { createHeadPosePanel } from './rig-editor/head-pose/head-pose-panel.js';
import { createHandSetupPanel } from './rig-editor/hands/hand-setup-panel.js';
import { createWarpPanel } from './rig-editor/warp/warp-panel.js';
import { createTimelinePanel } from './animation-editor/timeline/timeline-panel.js';
import { createExporter } from './core/export/exporter.js';
import { validateRig } from './core/validation/rig-validator.js';
import { deriveProjectReadiness, exportBlockingIssues, validateProject } from './core/validation/validate-project.js';
import { deriveTaskReadiness, worstStatus } from './core/validation/task-readiness.js';
import { deriveGuide } from './core/validation/guide.js';
import { deriveSetupSections } from './core/validation/setup-sections.js';
import { createGuideBar } from './ui/guide-bar.js';
import { createPreviewPanel } from './ui/preview-panel.js';
import { createExpressionStudio } from './ui/expression-studio.js';
import { puppetHandles, puppetReadout } from './core/puppet/puppet-handles.js';
import { headPoseGrid, headPoseReadout, snapHeadPoseValues } from './core/puppet/head-pose-handle.js';
import { createMotionStudio } from './ui/motion-studio.js';
import { createReactionStudio } from './ui/reaction-studio.js';
import { createAutomaticPanel } from './ui/automatic-panel.js';
import { createAdvancedHub } from './ui/advanced-hub.js';
import { createCommandRegistry } from './ui/command-registry.js';
import { createCommandPalette } from './ui/command-palette.js';
import { createResponsiveShell } from './ui/responsive-shell.js';
import { createCapabilitySheet } from './ui/capability-sheet.js';
import { isTextTarget, matchShortcut, shortcutHelpMarkup } from './ui/shortcuts.js';
import { createDebouncedTask, createValidationCache } from './core/validation/validation-cache.js';
import { PROJECT_TEMPLATES } from './core/sample/templates/index.js';
import { loadProjectTemplate } from './core/sample/template-loader.js';
import { PRESET_LIBRARY } from './core/assets/preset-library.js';
import { buildFaceProjectTemplate } from './core/assets/face-builder.js';
import { createPluginRegistry } from './core/plugins/plugin-registry.js';
import { defaultElementPlugin } from './core/plugins/builtin/default-plugin.js';
import { pathElementPlugin } from './core/plugins/builtin/path-plugin.js';
import { canTransition } from './core/state/transition-guard.js';
import { applyProjectSnapshot, createProjectSnapshot, hasValidProjectDocument, prepareProjectSnapshot } from './core/state/project-snapshot.js';
import { commitProjectReplacement } from './core/state/project-replacement.js';
import { FACE_FEATURES, isFaceFeatureInstalled } from './core/sample/face-features.js';
import { installFaceFeatureCommand } from './core/sample/face-feature-command.js';
import { createEditorContext } from './ui/editor-context.js';
import { lifecycleDiagnostics } from './core/diagnostics/lifecycle-diagnostics.js';
import { createProjectDocument } from './core/state/project-document.js';
import { createEditorSession } from './core/state/editor-session.js';
import { createE2EDocumentSnapshot, createE2EReadinessSnapshot, createE2ESessionSnapshot, createE2EStateSnapshot } from './core/diagnostics/e2e-state-snapshot.js';
import { createTaskRouter } from './ui/task-router.js';
import { createContextInspector } from './ui/context-inspector.js';
import { selectionPatchForTarget } from './ui/selection-context.js';
import { discardLocalRecovery, readLocalRecovery, writeLocalRecovery } from './core/state/local-recovery.js';

const store = createStore();
const history = createHistory(store);
const shell = createAppShell(document.getElementById('app'));
// Responsive shell (UX-19): drawer + one bottom sheet on compact layouts; session-only UI preference.
const LAYOUT_PREFERENCE='boop.layoutMode';
const responsive=createResponsiveShell(document.getElementById('app'),{onChange:state=>{shell.setDrawerState(state.drawerOpen);globalThis.__boopLayoutChanged?.(state);},readPreference:()=>{try{return localStorage.getItem(LAYOUT_PREFERENCE)||'auto';}catch{return 'auto';}},writePreference:mode=>{try{localStorage.setItem(LAYOUT_PREFERENCE,mode);}catch{}}});
const capabilitySheet=createCapabilitySheet(document.getElementById('capability-panel'),{layout:()=>responsive.snapshot(),onForce:mode=>{responsive.forceLayout(mode);shell.setStatus(mode==='desktop'?'Desktop layout on. Both panels are shown; nothing is gated.':'Automatic layout restored.');}});
shell.bindCapabilities(()=>capabilitySheet.isOpen()?capabilitySheet.close():capabilitySheet.open());
shell.bindDrawer(()=>responsive.toggleDrawer(),()=>responsive.closeDrawer());
shell.bindSheet(detent=>responsive.setSheet(detent));
let lastContextKind='none',lastWorkspace=null;
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
shell.onWorkspaceChange((workspace)=>{canvas.setWorkspace(workspace);editorContext.update({workspace});syncPuppetHandles();});
shell.bindPuppetToggle(()=>syncPuppetHandles());
shell.bindCanvasView((action)=>action==='fit'?canvas.fitToCanvas():action==='reset'?canvas.resetView():canvas.zoomView(action==='in'?1.1:1/1.1));
const layers = createLayersPanel(shell.leftSidebarEl, store, history, canvas);
const inspector = createInspector(shell.inspectorEl, store, history, canvas);
let previewMode = false;
let timeline;
let lastReactionId=null;
const preview = createPreviewController({ store, canvas, onError: error=>shell.setStatus(`Preview stopped: ${error.message}`,'error'), onFrame: ({ time }) => { const output=shell.previewEl.querySelector('#current-time'); if(output) output.textContent=time.toFixed(2); const playhead=shell.previewEl.querySelector('#playhead'); if(playhead) playhead.value=String(time); const activeReaction=preview.getActiveReaction()?.id||null; if(activeReaction!==lastReactionId){lastReactionId=activeReaction;if(shell.getWorkspace()==='preview'&&!shell.previewPanelEl.querySelector(':focus'))previewPanel.render();} } });
const activateState = (name) => previewMode ? preview.setState(name) : preview.previewState(name);
const states = createStateMachineEditor(shell.leftSidebarEl, store, history, preview, editorContext);
timeline = createTimelinePanel(shell.previewEl, store, history, preview, editorContext, message=>shell.setStatus(message));
const rigPanel = createRigPanel(shell.rigEl, store, history, preview, (name, value, options) => timeline.autoKey(name, value, options), canvas, editorContext, shell.rigPartsEl);
const faceSetup=createFaceSetupPanel(shell.faceSetupEl,store,history,canvas,editorContext,{openPart:(id,tab)=>{rigPanel.openPart(id,tab);responsive.revealInspector();},geometry:id=>canvas.getElementFrame(id),highlight:id=>canvas.setSuggestedArtwork(id)});
const faceMovements=createFaceMovementsPanel(shell.faceMovementsEl,store,history,editorContext,{openMovement:(id,control)=>{rigPanel.openMovement(id,control);responsive.revealInspector();}});
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
const handSetupPanel=createHandSetupPanel(shell.handSetupEl,store,history,{
  onSelect:(id)=>{if(id)editorContext.update({selectedId:id});},
  artboardWidth:()=>Number(canvas.getElementBounds?.(Object.keys(store.getDocument().elements||{})[0])?.width)||0,
  measure:(id)=>canvas.getElementBounds(id)
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
editorContext.subscribe((context)=>{if(context.workspace!=='rig'){rigPanel.cancelTransient();faceSetup.cancelTransient();}if(context.workspace!=='expressions')expressionStudio.leave();else expressionStudio.enter();if(context.workspace!=='reactions')reactionStudio.leave();rigPanel.render();faceSetup.render();faceMovements.render();headPosePanel.render();handSetupPanel.render();warpPanel.render();expressionStudio.render();motionStudio.render();reactionStudio.render();timeline.requestRender();const inspectorContext=contextInspector.render();shell.setSheetSubject(context.workspace==='preview'?'Preview':document.getElementById('context-inspector-heading').textContent);const switchedWorkspace=context.workspace!==lastWorkspace;lastWorkspace=context.workspace;const contextKey=`${inspectorContext.kind}:${inspectorContext.id||inspectorContext.part||inspectorContext.parameter||''}`;if(!switchedWorkspace&&responsive.isCompact()&&inspectorContext.kind!=='none'&&contextKey!==lastContextKind)responsive.revealInspector();lastContextKind=contextKey;});
const exporter = createExporter(shell.exportEl, store, canvas);

let hasUnsavedChanges = false;
let savedVersionToken=store.getDocumentVersionToken();
let autosaveTimer;
let autosaveStatus = 'idle';
function reportFatalError(error) {
  console.error(error);
  shell.setStatus('Something went wrong. Your project autosave has not been deleted.', 'error');
}
window.addEventListener('error', (event) => reportFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => reportFatalError(event.reason));
const cancelAutosave = () => { clearTimeout(autosaveTimer); autosaveTimer = null; autosaveStatus = 'idle'; };
const getRecoveryState = () => readLocalRecovery(localStorage, snapshot => prepareProjectSnapshot(snapshot, svg => canvas.prepareSvgImport(svg)));
const refreshRecovery = () => shell.setRecoveryState(getRecoveryState());
const discardRecovery = () => { if (!discardLocalRecovery(localStorage)) shell.setStatus('Browser storage is unavailable. Automatic local recovery may not work.', 'warn'); refreshRecovery(); };
const markSaved = ({ keepRecovery = false } = {}) => { cancelAutosave(); savedVersionToken=store.getDocumentVersionToken(); hasUnsavedChanges = false; shell.setDirty(false); if (!keepRecovery) discardRecovery(); };
const replaceProject = (commit, { keepRecovery = false } = {}) => commitProjectReplacement({
  hasUnsavedChanges: () => hasUnsavedChanges,
  confirmReplacement: () => shell.confirmProjectReplacement(),
  saveProject: () => saveProject(),
  stop: () => { timeline.reset(); preview.stop(); preview.reset(); previewMode = false; document.getElementById('app').classList.remove('preview-mode'); },
  resetContext: () => editorContext.reset(shell.getWorkspace()),
  captureRollback: () => ({ document: structuredClone(store.getDocument()), session: structuredClone(store.getSession()), markup: hasValidProjectDocument(store.getDocument()) ? canvas.serializeCurrentSvg() : '' }),
  commit,
  rollback: async (previous) => { if (previous.markup) await canvas.loadSvgFromText(previous.markup, previous.document.layerMetadata, { recordHistory:false,updateStore:false }); store.replaceProject(previous.document,previous.session,{source:'rollback'}); preview.apply(); },
  clearHistory: () => history.clear(), establishBaseline: () => markSaved({ keepRecovery })
});
function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function restoreSnapshot(snapshot, sourceLabel, { recovered = false } = {}) {
  const committed = await replaceProject(async () => {
    await canvas.loadSvgFromText(snapshot.document.svgMarkup, snapshot.document.layerMetadata, {recordHistory:false,updateStore:false});
    const nextState=createCleanProjectState();applyProjectSnapshot(nextState,snapshot);
    const document=createProjectDocument(nextState),session=createEditorSession(nextState);
    store.replaceProject(document,session,{source:'project-snapshot'});
    preview.setClip(session.animationEditor.activeClipId);
    preview.seek(session.animationEditor.playhead);
    preview.apply();
  }, { keepRecovery: recovered });
  if (!committed) return false;
  taskRouter.navigate('artwork');
  shell.setProjectLoaded(true);
  shell.closeHome();
  shell.setStatus(`${sourceLabel} restored.`);
  if (recovered) { hasUnsavedChanges=true; shell.setDirty(true); shell.setStatus('Recovered local copy — unsaved changes.', 'warn'); }
  return true;
}



const renderPluginStatus = () => shell.setPluginStatus(`Plugins: ${pluginRegistry.list().map((p) => `${p.type}:${p.enabled ? 'on' : 'off'}`).join(' • ')}`);
renderPluginStatus();
shell.bindUndoRedo(() => history.undo(), () => history.redo());
history.subscribe((s) => shell.setUndoRedoState(s));
shell.bindPluginToggles((type, enabled) => {
  pluginRegistry.setEnabled(type, enabled);
  renderPluginStatus();
  shell.setStatus(`Plugin ${type} ${enabled ? 'enabled' : 'disabled'} (applies to next imports).`, 'warn');
});



shell.bindLoadSvg(async (file) => {
  try {
    const prepared = canvas.prepareSvgImport(await file.text());
    const committed = await replaceProject(async () => {
      const artwork=await canvas.loadSvgFromText(prepared, {}, {recordHistory:false,updateStore:false});
      const candidate=Object.assign(createCleanProjectState(),artwork);
      store.replaceProject(createProjectDocument(candidate),createEditorSession(candidate),{source:'svg-import'});
      preview.apply();
    });
    if (!committed) return;
    shell.setProjectLoaded(true);
    taskRouter.navigate('artwork');
    shell.closeHome();
    requestAnimationFrame(() => canvas.fitToCanvas());
    shell.setStatus(`Loaded SVG: ${file.name}`);
  } catch {
    shell.setStatus(`Invalid or unsupported SVG: ${file.name}`, 'error');
  }
});

shell.bindLoadSample(async (kind) => {
  const template = PROJECT_TEMPLATES[kind] || PROJECT_TEMPLATES.expressive;
  const committed = await replaceProject(() => loadProjectTemplate(template,{store,canvas,history,preview,validate:validateRig}));
  if (!committed) return;
  shell.setProjectLoaded(true);
  taskRouter.navigate('artwork'); shell.closeHome();
  requestAnimationFrame(()=>canvas.fitToCanvas());
  shell.setStatus(`${template.name || 'Mascot'} created.`);
});

shell.bindAddFeature((featureId)=>{const feature=FACE_FEATURES[featureId],before=store.getDocument();if(!feature||isFaceFeatureInstalled(before,featureId))return;try{const artwork=canvas.appendArtwork(feature.artwork,feature.mountPoint,{updateStore:false});if(!artwork)return;if(!installFaceFeatureCommand(store,history,featureId,artwork))return;preview.apply();shell.setStatus(`${feature.name} added with ready-to-try examples.`);}catch(error){canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});shell.setStatus(`Could not add ${feature.name}: ${error.message}`,'error');}});

function renderProjectUi(){const state=store.getDocument(),parts=Object.values(state.semanticParts||{});const ready=(type)=>{const part=parts.find(item=>item.type===type),roles=part&&Object.values(part.roles||{});return Boolean(roles?.length&&roles.every(id=>state.elements?.[id]));};const head=parts.find(part=>part.type==='head');const featureCompatible=Boolean(state.elements?.faceRoot&&Object.values(head?.roles||{}).includes('faceRoot'));syncPuppetHandles();shell.renderProjectUi({loaded:Boolean(state.svgMarkup),features:Object.fromEntries(Object.keys(FACE_FEATURES).map(id=>[id,isFaceFeatureInstalled(state,id)])),featureCompatible,core:[['head','Face'],['eyes','Eyes'],['gaze','Gaze'],['mouth','Mouth']].map(([type,label])=>({label,ready:ready(type)}))});previewPanel.render();}

/* ── Direct controls (docs/DIRECT_CONTROLS.md) ─────────────────────────────
 * Handles on the mascot itself, in the three tasks where posing is the point.
 * A drag sets the same parameters the sliders set; in Expressions it also
 * writes them into the expression being shaped, as one undoable step.
 */
const PUPPET_TASKS = new Set(['rig', 'expressions', 'preview']);
const liveFaceValues = () => preview.getEffectiveParams();
// Which handles exist depends only on the rig, so it is derived once per
// document revision rather than on every task switch and every render.
let puppetMemo = { revision: -1, value: [] };
const projectPuppetHandles = () => {
  const revision = store.getPersistentRevision();
  if (puppetMemo.revision !== revision) puppetMemo = { revision, value: puppetHandles(store.getDocument()) };
  return puppetMemo.value;
};
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
      previewPanel.syncPads?.();
    }
  });
  canvas.showPuppetHandles(PUPPET_TASKS.has(shell.getWorkspace()) && shell.isPuppetVisible());
}

shell.bindGenerateFace(async (options) => {
  const committed=await replaceProject(()=>loadProjectTemplate(buildFaceProjectTemplate(options),{store,canvas,history,preview,validate:validateRig}));
  if(committed){shell.setProjectLoaded(true);shell.setStatus('Generated face from builder options.');}
});

shell.bindApplyPreset(async (presetId) => {
  const preset = PRESET_LIBRARY[presetId];
  if (!preset) return;
  const prepared=canvas.prepareSvgImport(preset.svg);
  const committed=await replaceProject(async()=>{const artwork=await canvas.loadSvgFromText(prepared, {}, {recordHistory:false,updateStore:false});const candidate=Object.assign(createCleanProjectState(),artwork);store.replaceProject(createProjectDocument(candidate),createEditorSession(candidate),{source:'preset'});});
  if(committed)shell.setStatus(`Preset loaded: ${preset.label}`);
});

const saveProject = () => {
  if (!hasValidProjectDocument(store.getState(), () => canvas.serializeCurrentSvg())) { shell.setStatus('Add valid SVG artwork before saving.', 'warn'); return false; }
  const snapshot = createProjectSnapshot(store.getState(), () => canvas.serializeCurrentSvg());
  downloadJson('mascot-project.json', snapshot);
  shell.setStatus('Project snapshot exported.');
  markSaved();
  return true;
};
shell.bindSaveProject(saveProject);

shell.bindLoadProject(async (file) => {
  try {
    const imported = JSON.parse(await file.text());
    const prepared = prepareProjectSnapshot(imported, (svg) => canvas.prepareSvgImport(svg));
    await restoreSnapshot(prepared, `Project ${file.name}`);
  } catch {
    shell.setStatus(`Invalid project snapshot: ${file.name}`, 'error');
  }
});

shell.bindNew(() => shell.showHome({ focus: 'new' }));
const validationCache=createValidationCache(validateProject, ()=>['artwork','rig','stateMachine','semanticRig','animation','expressions','reactions'].map(domain=>store.getDomainRevision(domain)).join(':'));
// Task readiness: plain-language sections with stable codes and deep-link routes (UX-08).
// Memoized per document revision so badges, Preview, Problems and Export share one readiness object.
let readinessMemo={revision:null,value:null};
const taskReadiness=()=>{const revision=store.getPersistentRevision();if(readinessMemo.revision===revision&&readinessMemo.value)return readinessMemo.value;const document=store.getDocument(),model=deriveTaskReadiness(document,validationCache.run(document));readinessMemo={revision,value:{...model,faceSetupBadge:worstStatus(model.faceSetup.status,model.movements.status)}};return readinessMemo.value;};
const goToReadiness=(item)=>{if(!item?.route)return;taskRouter.navigate(item.route);if(item.issueId){const issue=validationCache.run(store.getDocument()).find(candidate=>candidate.id===item.issueId);if(issue?.fix){const {workspace,...context}=issue.fix;editorContext.update(context);}}};
// The guided journey: one canonical answer to "what do I do next?" (docs/GUIDED_JOURNEY.md).
let guideMemo={revision:null,value:null};
const projectGuide=()=>{const revision=store.getPersistentRevision();if(guideMemo.revision===revision&&guideMemo.value)return guideMemo.value;guideMemo={revision,value:deriveGuide(store.getDocument(),taskReadiness())};return guideMemo.value;};
const guideBar=createGuideBar(shell.guideBarEl,{
  guide:projectGuide,
  navigate:route=>taskRouter.navigate(route),
  isDismissed:()=>shell.isGuideDismissed(),
  setDismissed:value=>shell.setGuideDismissed(value)
});
const previewPanel=createPreviewPanel(shell.previewPanelEl,store,preview,{navigate:route=>taskRouter.navigate(route),readiness:taskReadiness});
shell.bindPreviewReset(()=>{preview.reset();if(previewMode)preview.start();previewPanel.render();shell.setStatus('Mascot reset. Live controls and preview-only changes were cleared.');});
const fixProblem=(issue)=>{if(!issue?.fix)return;const {workspace,...context}=issue.fix;taskRouter.navigate({task:workspace||'artwork',target:{kind:'diagnostic',diagnosticId:issue.id}});editorContext.update(context);};
shell.bindValidate(() => { const issues=validationCache.run(store.getState()); shell.showProblems(taskReadiness(),issues,fixProblem,goToReadiness); });
shell.bindPreview((enabled) => { if(enabled)responsive.revealInspector(); previewMode=Boolean(enabled); document.getElementById('app').classList.toggle('preview-mode',previewMode); previewMode ? preview.start() : preview.stop(); if(previewMode){previewPanel.render();shell.setStatus('Preview is live. Changes here are non-destructive.');} });
// Export (UX-16): the panel itself explains what blocks it and deep-links to the fix; Back to Export returns here.
exporter.configure({readiness:taskReadiness,issues:()=>validationCache.run(store.getDocument()),onFix:issue=>{shell.setReturnToExport(true);fixProblem(issue);},onGo:section=>{shell.setReturnToExport(true);goToReadiness(section);}});
const openExport=()=>{shell.setReturnToExport(false);const blocking=exportBlockingIssues(validationCache.run(store.getState()));exporter.render();exporter.open();if(blocking.length)shell.setStatus(`Cannot export yet: ${blocking[0].message}`,'error');};
shell.bindExport(openExport);
shell.bindReturnToExport(openExport);
// Advanced hub (UX-17): expert surfaces stay collapsed in the project menu; routes reuse the task router and author modes.
const advancedHub=createAdvancedHub(shell.advancedEl,store,editorContext,{applyRoute:plan=>{if(plan.route)taskRouter.navigate(plan.route);if(plan.authorMode){editorContext.update({authorMode:plan.authorMode});states.render();}if(plan.timeline){shell.showTimeline();timeline.requestRender();}},openMenu:()=>shell.openProjectMenuAdvanced(),diagnostics:()=>lifecycleDiagnostics.snapshot(),issues:()=>validationCache.run(store.getDocument()),onStatus:(message,tone)=>shell.setStatus(message,tone),layout:()=>responsive.layout});
shell.bindOpenAdvanced(()=>advancedHub.open());
// Command palette (UX-18): one registry of actions and searchable items; every run goes through existing handlers or commands.
const commandRegistry=createCommandRegistry();
const paletteContext=()=>({document:store.getDocument(),session:store.getSession(),history:history.getState(),blocking:exportBlockingIssues(validationCache.run(store.getDocument()))});
const needsProject=(context)=>context.document.svgMarkup?{ok:true}:{ok:false,reason:'Add artwork first.'};
for(const [id,label] of [['artwork','Artwork'],['face-setup','Face Setup'],['expressions','Expressions'],['animate','Animate'],['reactions','Reactions'],['preview','Preview']])commandRegistry.register({id:`go:${id}`,title:`Go to ${label}`,group:'Go to',keywords:['task','workspace',label],run:()=>taskRouter.navigate({task:id})});
commandRegistry.register({id:'action:export',title:'Export files',group:'Actions',keywords:['download','rig.json','mascot.svg','runtime.js'],enabled:(context)=>!context.document.svgMarkup?{ok:false,reason:'Add artwork first.'}:context.blocking.length?{ok:false,reason:`Export is blocked: ${context.blocking[0].message}`}:{ok:true},run:openExport});
commandRegistry.register({id:'action:problems',title:'Project check (Problems)',group:'Actions',keywords:['readiness','validate','problems','check'],run:()=>{const issues=validationCache.run(store.getState());shell.showProblems(taskReadiness(),issues,fixProblem,goToReadiness);}});
commandRegistry.register({id:'action:save',title:'Save Project',group:'Actions',keywords:['download','json','project'],enabled:needsProject,run:()=>saveProject()});
commandRegistry.register({id:'action:new',title:'New Project',group:'Actions',keywords:['home','templates','start'],run:()=>shell.showHome({focus:'new'})});
commandRegistry.register({id:'action:undo',title:'Undo',group:'Actions',shortcut:'Ctrl+Z',enabled:(context)=>context.history.canUndo?{ok:true}:{ok:false,reason:'Nothing to undo.'},run:()=>history.undo()});
commandRegistry.register({id:'action:redo',title:'Redo',group:'Actions',shortcut:'Ctrl+Y',enabled:(context)=>context.history.canRedo?{ok:true}:{ok:false,reason:'Nothing to redo.'},run:()=>history.redo()});
commandRegistry.register({id:'action:reset-mascot',title:'Reset mascot (Preview)',group:'Actions',keywords:['preview','clear','live'],enabled:needsProject,run:()=>{taskRouter.navigate({task:'preview'});preview.reset();if(previewMode)preview.start();previewPanel.render();}});
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

const validationTask=createDebouncedTask(()=>{const state=store.getDocument(),issues=validationCache.run(state),blocking=exportBlockingIssues(issues);lifecycleDiagnostics.increment('validation.runs');shell.setReadiness(taskReadiness(),issues);shell.setSetupSections(deriveSetupSections(state));guideBar.render();previewPanel.render();if(!state.layers.length)shell.setStatus('Import SVG artwork or start from a template.','warn');else if(blocking.length)shell.setStatus(`${blocking.length} problem(s): ${blocking[0].message}`,'warn');else shell.setStatus(`Project ready • ${taskReadiness().artwork.summary}`,'info');},150);
const scheduleAutosave=()=>{hasUnsavedChanges=store.getDocumentVersionToken()!==savedVersionToken;shell.setDirty(hasUnsavedChanges);if(!hasUnsavedChanges)return;autosaveStatus='pending';lifecycleDiagnostics.increment('autosave.schedules');clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{try{writeLocalRecovery(localStorage,createProjectSnapshot(store.getState(),()=>canvas.serializeCurrentSvg()));lifecycleDiagnostics.increment('autosave.writes');autosaveStatus='saved';shell.setDirty(true,true);refreshRecovery();}catch{shell.setStatus('Autosave unavailable (browser storage is full or disabled).','warn');}},500);};
const onPersistent=()=>{const state=store.getState();shell.setProjectLoaded(Boolean(state.svgMarkup));shell.setProjectActionsEnabled(hasValidProjectDocument(state));validationTask.schedule();scheduleAutosave();};
store.subscribeDocument('artwork',(state)=>{canvas.reconcileState(store.getState());inspector.render();exporter.render();renderProjectUi();faceSetup.render();faceMovements.render();handSetupPanel.render();onPersistent();});
store.subscribeDocument('layers',(state)=>{canvas.syncLayerOrder(state.layers);layers.render();faceSetup.render();onPersistent();});
store.subscribeDocument('keyforms',()=>{headPosePanel.render();handSetupPanel.render();warpPanel.render();canvas.refreshPuppetHandles();onPersistent();});
store.subscribeDocument('hands',()=>{handSetupPanel.render();syncPuppetHandles();onPersistent();});
store.subscribeDocument('hierarchy',()=>{onPersistent();});
store.subscribeDocument('rig',()=>{inspector.render();timeline.requestRender();rigPanel.render();faceMovements.render();headPosePanel.render();handSetupPanel.render();warpPanel.render();expressionStudio.render();motionStudio.render();automaticPanel.render();syncPuppetHandles();onPersistent();});
store.subscribeDocument('expressions',()=>{expressionStudio.render();reactionStudio.render();previewPanel.render();onPersistent();});
store.subscribeDocument('reactions',()=>{reactionStudio.render();previewPanel.render();onPersistent();});
store.subscribeDocument('stateMachine',()=>{states.render();automaticPanel.render();previewPanel.render();onPersistent();});
store.subscribeDocument('semanticRig',()=>{rigPanel.render();faceSetup.render();faceMovements.render();renderProjectUi();onPersistent();});
store.subscribeDocument('animation',()=>{timeline.requestRender();motionStudio.render();reactionStudio.render();renderProjectUi();onPersistent();});
store.subscribeSession('selectedId',(session)=>{canvas.syncSelection(session.selectedId);layers.render();inspector.render();rigPanel.render();});
store.subscribeSession('animationEditor',()=>timeline.requestRender());

refreshRecovery();
shell.bindRecoverAutosave(async()=>{const recovery=getRecoveryState();if(recovery.status!=='available'){shell.setStatus('This local draft could not be read. Your current project was not changed.','error');refreshRecovery();return;}try{await restoreSnapshot(recovery.snapshot,'Local draft',{recovered:true});}catch{shell.setStatus('This local draft could not be read. Your current project was not changed.','error');}});
shell.bindDiscardRecovery(()=>{discardRecovery();shell.setStatus('Local draft discarded.');});
window.addEventListener('beforeunload',(event)=>{if(!hasUnsavedChanges)return;event.preventDefault();event.returnValue='';});

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
shell.canvasEl.addEventListener('click',event=>{if(shell.getWorkspace()!=='preview'||event.target.closest('button,input,select,label,.canvas-toolbar,.design-toolbar'))return;if(preview.triggerReaction({type:'click'}))previewPanel.render();});
shell.canvasEl.addEventListener('pointerenter',()=>{if(shell.getWorkspace()!=='preview')return;const state=store.getDocument();if(!(state.reactions||[]).some(item=>item.enabled!==false&&item.trigger?.type==='hover'))return;if(preview.triggerReaction({type:'hover'}))previewPanel.render();});
contextInspector.render();
states.render();
exporter.render();
layers.render();
shell.setStatus('Import an SVG or start from a template.', 'warn');
shell.setProjectLoaded(false); shell.setDirty(false); shell.setProjectActionsEnabled(false); shell.showHome({ focus: 'new' });
renderProjectUi();


// Escape closes the topmost surface first (UX-21): menu, palette, help, popovers (focus returns to their opener), drawer, sheet, Home, Focus Preview.
const closeTopSurface=()=>{
  if(canvas.cancelGizmoDrag?.())return true;
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
  if (meta && event.key.toLowerCase()==='d' && shell.getWorkspace()==='create') { const id=store.getState().selectedId;if(id){event.preventDefault();canvas.duplicate(id);}return; }
  if (shell.getWorkspace()==='create'&&!meta) {
    // With something selected under the Select tool, G/R/S/P drive the
    // transform gizmo (docs/SELECTION_GIZMO.md). Deselect and the same keys go
    // back to switching vector tools, so neither shortcut is ever unreachable.
    const id=store.getState().selectedId;
    if(id&&canvas.getGizmoMode&&canvas.handleGizmoKey(event)){event.preventDefault();return;}
    const tool={v:'select',n:'node',p:'pen',r:'rect',o:'ellipse',h:'hand'}[event.key.toLowerCase()];
    if(tool){event.preventDefault();setDesignTool(tool);return;}
    if(id&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();canvas.delete(id);return;}
  }

  const index = Number(event.key) - 1;
  const nextState = ['animate','preview'].includes(shell.getWorkspace())&&Number.isInteger(index) && index >= 0 ? Object.keys(store.getState().states)[index] : undefined;
  if (nextState) {
    const current = store.getState().activeState;
    if (previewMode && !canTransition(store.getState().transitions, current, nextState)) {
      shell.setStatus(`Transition blocked: ${current} → ${nextState}`, 'warn');
      return;
    }
    if (activateState(nextState)) shell.setStatus(`State switched: ${nextState}`);
  }
});

// Deliberately opt-in browser-test seam. It is absent from normal editor URLs.
if (new URLSearchParams(location.search).has('e2e')) {
  let exposedDocumentToken = store.getDocumentVersionToken(), exposedDocumentTokenId = 1;
  const documentVersionToken = () => {
    const token = store.getDocumentVersionToken();
    if (token !== exposedDocumentToken) { exposedDocumentToken = token; exposedDocumentTokenId++; }
    return exposedDocumentTokenId;
  };
  window.__BOOP_E2E__ = {
    document: () => createE2EDocumentSnapshot(store.getDocument()),
    session: () => createE2ESessionSnapshot(store.getSession()),
    // Compatibility composite used by legacy E2E tests.
    // New owner-specific invariants should prefer document() or session().
    state: () => createE2EStateSnapshot(store.getDocument(), store.getSession()),
    documentVersionToken,
    documentRevisions: () => ({ persistent:store.getPersistentRevision(), domains:store.getDomainRevisions() }),
    dirty: () => hasUnsavedChanges,
    readiness: () => { const issues=validationCache.run(store.getDocument());return createE2EReadinessSnapshot(deriveProjectReadiness(store.getDocument(),issues),issues); },
    taskReadiness: () => structuredClone(taskReadiness()),
    previewOverrides: () => preview.getBehaviorOverrides(),
    expressionWeights: () => preview.getExpressionWeights(),
    mutate: (recipe) => store.setState(recipe),
    setAuthoredPath: (id, d) => canvas.applyPathData(id, d),
    nodeEdit: () => canvas.getNodeEdit(),
    panView: (dx, dy) => canvas.panView(dx, dy),
    setAuthoredTransform: (id, patch) => { store.setState((state) => Object.assign(state.elements[id].baseTransform, patch)); canvas.applyElementTransform(id, store.getState().elements[id]); },
    setLiveParam: (name, value) => preview.setLiveParam(name, value),
    clearLiveParam: (name) => preview.clearLiveParam(name),
    effectiveParams: () => structuredClone(preview.getEffectiveParams()),
    controlState: (name) => {
      const input=document.querySelector(`[data-control="${CSS.escape(name)}"]`),live=preview.getLiveParams(),effective=preview.getEffectiveParams();
      const compiled=compileFrame(store.getState().elements,effective,store.getState().globalConstraints,store.getState().stateConstraints?.[store.getState().activeState],{keyforms:store.getState().keyforms,shapeKeys:store.getState().shapeKeys,warps:store.getState().warps,hands:store.getState().hands,deformers:store.getState().deformers,parallax:store.getState().parallax});
      const frame=id=>compiled.frames[id]?.transform?structuredClone(compiled.frames[id].transform):null;
      return {matches:document.querySelectorAll(`[data-control="${CSS.escape(name)}"]`).length,visible:Boolean(input?.checkVisibility()),inputValue:input?.value??null,disabled:Boolean(input?.disabled),liveValue:live[name]??null,effectiveValue:effective[name]??null,compiled:{pupilLeft:frame('pupilLeft'),pupilRight:frame('pupilRight')}};
    },
    hitStack: (x,y) => document.elementsFromPoint(x,y).map(node=>({tag:node.tagName,id:node.id||'',class:node.getAttribute?.('class')||''})),
    frameFor: (id) => {
      const state=store.getState(),effective=preview.getEffectiveParams();
      const compiled=compileFrame(state.elements,effective,state.globalConstraints,state.stateConstraints?.[state.activeState],{keyforms:state.keyforms,shapeKeys:state.shapeKeys,warps:state.warps,hands:state.hands,deformers:state.deformers,parallax:state.parallax});
      return { effectiveParams:structuredClone(effective), compiled:structuredClone(compiled.frames[id] || null), canvas:canvas.frameDiagnostic(id) };
    },
    transitionTo: (name) => preview.setState(name),
    diagnostics: () => lifecycleDiagnostics.snapshot(),
    history: () => structuredClone(history.getState()),
    task: () => taskRouter.currentTask,
    faceSetup: () => faceSetup.snapshot(),
    faceMovements: () => faceMovements.snapshot(),
    motions: () => motionStudio.snapshot(),
    reactions: () => reactionStudio.snapshot(),
    automatic: () => automaticPanel.snapshot(),
    advancedTools: () => advancedHub.snapshot(),
    palette: () => palette.snapshot(),
    layout: () => responsive.snapshot(),
    capabilities: () => capabilitySheet.isOpen(),
    previewSession: () => structuredClone(preview.getSession()),
    activeReaction: () => preview.getActiveReaction(),
    triggerReaction: (event) => preview.triggerReaction(event),
    eventLog: () => preview.getEventLog(),
    navigate: route => taskRouter.navigate(route),
    selectionContext: () => contextInspector.render(),
    resetDiagnostics: () => lifecycleDiagnostics.reset(),
    exportArtifacts: () => exporter.createExportArtifacts().map(item=>({...item}))
  };
}

// Published only after every required renderer and the optional E2E seam exist.
// Browser tests and integrations can use this instead of racing arbitrary delays.
document.getElementById('app').dataset.editorReady = 'true';
