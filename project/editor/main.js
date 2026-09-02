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
import { createTimelinePanel } from './animation-editor/timeline/timeline-panel.js';
import { createExporter } from './core/export/exporter.js';
import { validateRig } from './core/validation/rig-validator.js';
import { deriveProjectReadiness, exportBlockingIssues, validateProject } from './core/validation/validate-project.js';
import { deriveTaskReadiness, worstStatus } from './core/validation/task-readiness.js';
import { createPreviewPanel } from './ui/preview-panel.js';
import { createExpressionStudio } from './ui/expression-studio.js';
import { createMotionStudio } from './ui/motion-studio.js';
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
import { availableExamples } from './core/sample/example-registry.js';
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
const editorContext=createEditorContext(shell.getWorkspace(),store);
const taskRouter=createTaskRouter({
  getWorkspace:shell.getWorkspace,
  setWorkspace:shell.setWorkspace,
  applyTarget(target){
    const patch=selectionPatchForTarget(target);
    if(patch.animationEditor)patch.animationEditor={...editorContext.get().animationEditor,...patch.animationEditor};
    editorContext.update(patch);
  }
});
shell.bindTaskNavigation(route=>taskRouter.navigate(route));
const pluginRegistry = createPluginRegistry();
pluginRegistry.register(defaultElementPlugin);
pluginRegistry.register(pathElementPlugin);
const canvas = createSvgCanvas(shell.canvasEl, store, history, pluginRegistry);
canvas.setWorkspace(shell.getWorkspace());
const setDesignTool=(tool)=>{canvas.setTool(tool);shell.setDesignTool(tool);};
shell.bindDesignTools(setDesignTool);
shell.onWorkspaceChange((workspace)=>{canvas.setWorkspace(workspace);editorContext.update({workspace});});
shell.bindCanvasView((action)=>action==='fit'?canvas.fitToCanvas():action==='reset'?canvas.resetView():canvas.zoomView(action==='in'?1.1:1/1.1));
const layers = createLayersPanel(shell.leftSidebarEl, store, history, canvas);
const inspector = createInspector(shell.inspectorEl, store, history, canvas);
let previewMode = false;
let timeline;
const preview = createPreviewController({ store, canvas, onError: error=>shell.setStatus(`Preview stopped: ${error.message}`,'error'), onFrame: ({ time }) => { const output=shell.previewEl.querySelector('#current-time'); if(output) output.textContent=time.toFixed(2); const playhead=shell.previewEl.querySelector('#playhead'); if(playhead) playhead.value=String(time); } });
const activateState = (name) => previewMode ? preview.setState(name) : preview.previewState(name);
const states = createStateMachineEditor(shell.leftSidebarEl, store, history, preview, editorContext);
timeline = createTimelinePanel(shell.previewEl, store, history, preview, editorContext, message=>shell.setStatus(message));
const rigPanel = createRigPanel(shell.rigEl, store, history, preview, (name, value, options) => timeline.autoKey(name, value, options), canvas, editorContext, shell.rigPartsEl);
const faceSetup=createFaceSetupPanel(shell.faceSetupEl,store,history,canvas,editorContext,{openPart:(id,tab)=>rigPanel.openPart(id,tab),geometry:id=>canvas.getElementFrame(id),highlight:id=>canvas.setSuggestedArtwork(id)});
const faceMovements=createFaceMovementsPanel(shell.faceMovementsEl,store,history,editorContext,{openMovement:(id,control)=>rigPanel.openMovement(id,control)});
const expressionStudio=createExpressionStudio({listHost:shell.expressionsEl,inspectorHost:shell.expressionInspectorEl,store,history,preview,editorContext,onStatus:(message,tone)=>shell.setStatus(message,tone),navigate:route=>taskRouter.navigate(route)});
const motionStudio=createMotionStudio({listHost:shell.motionsEl,inspectorHost:shell.motionInspectorEl,store,history,preview,editorContext,onStatus:(message,tone)=>shell.setStatus(message,tone),navigate:route=>taskRouter.navigate(route),openTimeline:()=>{shell.showTimeline();timeline.requestRender();shell.previewEl.querySelector('.timeline-shell')?.focus();}});
const contextInspector=createContextInspector(shell.contextInspectorEl,editorContext,()=>taskRouter.currentTask);
editorContext.subscribe((context)=>{if(context.workspace!=='rig'){rigPanel.cancelTransient();faceSetup.cancelTransient();}if(context.workspace!=='expressions')expressionStudio.leave();else expressionStudio.enter();rigPanel.render();faceSetup.render();faceMovements.render();expressionStudio.render();motionStudio.render();timeline.requestRender();contextInspector.render();});
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

shell.bindDemoClip((clipId)=>{const clip=store.getDocument().animationClips.find(item=>item.id===clipId);if(!clip)return;if(preview.isPlaying()&&preview.getActiveClipId()===clipId){preview.stopClip();shell.setStatus(`Stopped ${clip.name}.`);}else{preview.setClip(clipId);preview.stopClip();preview.playClip();shell.setStatus(`Playing ${clip.name}.`);}renderProjectUi();});
shell.bindAddFeature((featureId)=>{const feature=FACE_FEATURES[featureId],before=store.getDocument();if(!feature||isFaceFeatureInstalled(before,featureId))return;try{const artwork=canvas.appendArtwork(feature.artwork,feature.mountPoint,{updateStore:false});if(!artwork)return;if(!installFaceFeatureCommand(store,history,featureId,artwork))return;preview.apply();shell.setStatus(`${feature.name} added with ready-to-try examples.`);}catch(error){canvas.loadSvgFromText(before.svgMarkup,before.layerMetadata,{recordHistory:false,updateStore:false});shell.setStatus(`Could not add ${feature.name}: ${error.message}`,'error');}});

function renderProjectUi(){const state=store.getDocument(),parts=Object.values(state.semanticParts||{});const ready=(type)=>{const part=parts.find(item=>item.type===type),roles=part&&Object.values(part.roles||{});return Boolean(roles?.length&&roles.every(id=>state.elements?.[id]));};const head=parts.find(part=>part.type==='head');const featureCompatible=Boolean(state.elements?.faceRoot&&Object.values(head?.roles||{}).includes('faceRoot'));shell.renderProjectUi({loaded:Boolean(state.svgMarkup),examples:availableExamples(state),features:Object.fromEntries(Object.keys(FACE_FEATURES).map(id=>[id,isFaceFeatureInstalled(state,id)])),playingId:preview.isPlaying()?preview.getActiveClipId():null,featureCompatible,core:[['head','Face'],['eyes','Eyes'],['gaze','Gaze'],['mouth','Mouth']].map(([type,label])=>({label,ready:ready(type)}))});previewPanel.render();}

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
const validationCache=createValidationCache(validateProject, ()=>['artwork','rig','stateMachine','semanticRig','animation','expressions'].map(domain=>store.getDomainRevision(domain)).join(':'));
// Task readiness: plain-language sections with stable codes and deep-link routes (UX-08).
const taskReadiness=()=>{const document=store.getDocument(),model=deriveTaskReadiness(document,validationCache.run(document));return {...model,faceSetupBadge:worstStatus(model.faceSetup.status,model.movements.status)};};
const goToReadiness=(item)=>{if(!item?.route)return;taskRouter.navigate(item.route);if(item.issueId){const issue=validationCache.run(store.getDocument()).find(candidate=>candidate.id===item.issueId);if(issue?.fix){const {workspace,...context}=issue.fix;editorContext.update(context);}}};
const previewPanel=createPreviewPanel(shell.previewPanelEl,store,preview,{navigate:route=>taskRouter.navigate(route),readiness:taskReadiness});
shell.bindPreviewReset(()=>{preview.reset();if(previewMode)preview.start();previewPanel.render();shell.setStatus('Mascot reset. Live controls and preview-only changes were cleared.');});
const fixProblem=(issue)=>{if(!issue?.fix)return;const {workspace,...context}=issue.fix;taskRouter.navigate({task:workspace||'artwork',target:{kind:'diagnostic',diagnosticId:issue.id}});editorContext.update(context);};
shell.bindValidate(() => { const issues=validationCache.run(store.getState()); shell.showProblems(taskReadiness(),issues,fixProblem,goToReadiness); });
shell.bindPreview((enabled) => { previewMode=Boolean(enabled); document.getElementById('app').classList.toggle('preview-mode',previewMode); previewMode ? preview.start() : preview.stop(); if(previewMode){previewPanel.render();shell.setStatus('Preview is live. Changes here are non-destructive.');} });
shell.bindExport(() => { const issues=validationCache.run(store.getState()),blocking=exportBlockingIssues(issues);if(blocking.length){shell.showProblems(taskReadiness(),issues,fixProblem,goToReadiness);shell.setStatus(`Cannot export: ${blocking[0].message}`,'error');return;} exporter.render();exporter.open(); });

const validationTask=createDebouncedTask(()=>{const state=store.getDocument(),issues=validationCache.run(state),blocking=exportBlockingIssues(issues);lifecycleDiagnostics.increment('validation.runs');shell.setReadiness(taskReadiness(),issues);previewPanel.render();if(!state.layers.length)shell.setStatus('Import SVG artwork or start from a template.','warn');else if(blocking.length)shell.setStatus(`${blocking.length} problem(s): ${blocking[0].message}`,'warn');else shell.setStatus(`Project ready • ${state.layers.length} layer(s)`,'info');},150);
const scheduleAutosave=()=>{hasUnsavedChanges=store.getDocumentVersionToken()!==savedVersionToken;shell.setDirty(hasUnsavedChanges);if(!hasUnsavedChanges)return;autosaveStatus='pending';lifecycleDiagnostics.increment('autosave.schedules');clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{try{writeLocalRecovery(localStorage,createProjectSnapshot(store.getState(),()=>canvas.serializeCurrentSvg()));lifecycleDiagnostics.increment('autosave.writes');autosaveStatus='saved';shell.setDirty(true,true);refreshRecovery();}catch{shell.setStatus('Autosave unavailable (browser storage is full or disabled).','warn');}},500);};
const onPersistent=()=>{const state=store.getState();shell.setProjectLoaded(Boolean(state.svgMarkup));shell.setProjectActionsEnabled(hasValidProjectDocument(state));validationTask.schedule();scheduleAutosave();};
store.subscribeDocument('artwork',(state)=>{canvas.reconcileState(store.getState());inspector.render();exporter.render();renderProjectUi();faceSetup.render();faceMovements.render();onPersistent();});
store.subscribeDocument('layers',(state)=>{canvas.syncLayerOrder(state.layers);layers.render();faceSetup.render();onPersistent();});
store.subscribeDocument('rig',()=>{inspector.render();timeline.requestRender();rigPanel.render();faceMovements.render();expressionStudio.render();motionStudio.render();onPersistent();});
store.subscribeDocument('expressions',()=>{expressionStudio.render();previewPanel.render();onPersistent();});
store.subscribeDocument('stateMachine',()=>{states.render();onPersistent();});
store.subscribeDocument('semanticRig',()=>{rigPanel.render();faceSetup.render();faceMovements.render();renderProjectUi();onPersistent();});
store.subscribeDocument('animation',()=>{timeline.requestRender();motionStudio.render();renderProjectUi();onPersistent();});
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
expressionStudio.render();
motionStudio.render();
contextInspector.render();
states.render();
exporter.render();
layers.render();
shell.setStatus('Import an SVG or start from a template.', 'warn');
shell.setProjectLoaded(false); shell.setDirty(false); shell.setProjectActionsEnabled(false); shell.showHome({ focus: 'new' });
renderProjectUi();


window.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return;
  const meta = event.ctrlKey || event.metaKey;
  if(event.key==='Escape'&&shell.isHomeOpen()){if(shell.closeHome())event.preventDefault();return;}
  if(event.key==='Escape'&&shell.isFocus()){event.preventDefault();shell.exitFocus();return;}
  if(event.code==='Space'&&shell.getWorkspace()==='animate'){event.preventDefault();timeline.togglePlayback();return;}
  if (meta && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    history.undo();
    return;
  }
  if (meta && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    history.redo();
    return;
  }
  if (meta && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); return; }
  if (meta && event.key.toLowerCase()==='d' && shell.getWorkspace()==='create') { const id=store.getState().selectedId;if(id){event.preventDefault();canvas.duplicate(id);}return; }
  if (shell.getWorkspace()==='create'&&!meta) {
    const tool={v:'select',n:'node',p:'pen',r:'rect',o:'ellipse',h:'hand'}[event.key.toLowerCase()];
    if(tool){event.preventDefault();setDesignTool(tool);return;}
    const id=store.getState().selectedId;
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
    setAuthoredTransform: (id, patch) => { store.setState((state) => Object.assign(state.elements[id].baseTransform, patch)); canvas.applyElementTransform(id, store.getState().elements[id]); },
    setLiveParam: (name, value) => preview.setLiveParam(name, value),
    clearLiveParam: (name) => preview.clearLiveParam(name),
    effectiveParams: () => structuredClone(preview.getEffectiveParams()),
    controlState: (name) => {
      const input=document.querySelector(`[data-control="${CSS.escape(name)}"]`),live=preview.getLiveParams(),effective=preview.getEffectiveParams();
      const compiled=compileFrame(store.getState().elements,effective,store.getState().globalConstraints,store.getState().stateConstraints?.[store.getState().activeState]);
      const frame=id=>compiled.frames[id]?.transform?structuredClone(compiled.frames[id].transform):null;
      return {matches:document.querySelectorAll(`[data-control="${CSS.escape(name)}"]`).length,visible:Boolean(input?.checkVisibility()),inputValue:input?.value??null,disabled:Boolean(input?.disabled),liveValue:live[name]??null,effectiveValue:effective[name]??null,compiled:{pupilLeft:frame('pupilLeft'),pupilRight:frame('pupilRight')}};
    },
    hitStack: (x,y) => document.elementsFromPoint(x,y).map(node=>({tag:node.tagName,id:node.id||'',class:node.getAttribute?.('class')||''})),
    frameFor: (id) => {
      const state=store.getState(),effective=preview.getEffectiveParams();
      const compiled=compileFrame(state.elements,effective,state.globalConstraints,state.stateConstraints?.[state.activeState]);
      return { effectiveParams:structuredClone(effective), compiled:structuredClone(compiled.frames[id] || null), canvas:canvas.frameDiagnostic(id) };
    },
    transitionTo: (name) => preview.setState(name),
    diagnostics: () => lifecycleDiagnostics.snapshot(),
    history: () => structuredClone(history.getState()),
    task: () => taskRouter.currentTask,
    faceSetup: () => faceSetup.snapshot(),
    faceMovements: () => faceMovements.snapshot(),
    motions: () => motionStudio.snapshot(),
    navigate: route => taskRouter.navigate(route),
    selectionContext: () => contextInspector.render(),
    resetDiagnostics: () => lifecycleDiagnostics.reset(),
    exportArtifacts: () => exporter.createExportArtifacts().map(item=>({...item}))
  };
}

// Published only after every required renderer and the optional E2E seam exist.
// Browser tests and integrations can use this instead of racing arbitrary delays.
document.getElementById('app').dataset.editorReady = 'true';
