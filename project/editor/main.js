import { createAppShell } from './ui/app-shell.js';
import { createCleanProjectState, createStore } from './core/state/store.js';
import { createHistory } from './core/undo/history.js';
import { createSvgCanvas } from './svg-editor/svg-canvas.js';
import { createLayersPanel } from './svg-editor/layers-panel.js';
import { createInspector } from './inspector/inspector.js';
import { createStateMachineEditor } from './animation-editor/state-machine-editor.js';
import { createPreviewController } from './core/preview-runtime/preview-controller.js';
import { createRigPanel } from './rig-editor/semantic-parts/rig-panel.js';
import { createTimelinePanel } from './animation-editor/timeline/timeline-panel.js';
import { createExporter } from './core/export/exporter.js';
import { validateRig } from './core/validation/rig-validator.js';
import { deriveProjectReadiness, exportBlockingIssues, validateProject } from './core/validation/validate-project.js';
import { createDebouncedTask, createValidationCache, validationRevision } from './core/validation/validation-cache.js';
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
import { FACE_FEATURES, installFaceFeature, isFaceFeatureInstalled } from './core/sample/face-features.js';
import { availableExamples } from './core/sample/example-registry.js';
import { createEditorContext } from './ui/editor-context.js';
import { lifecycleDiagnostics } from './core/diagnostics/lifecycle-diagnostics.js';

const store = createStore();
const history = createHistory(store);
const shell = createAppShell(document.getElementById('app'));
const editorContext=createEditorContext(shell.getWorkspace());
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
editorContext.subscribe((context)=>{if(context.workspace!=='rig')rigPanel.cancelTransient();rigPanel.render();timeline.render();});
const exporter = createExporter(shell.exportEl, store, canvas);

const AUTOSAVE_KEY = 'boop-mascotte-autosave-v1';
let hasUnsavedChanges = false;
let autosaveTimer;
let autosaveStatus = 'idle';
function reportFatalError(error) {
  console.error(error);
  shell.setStatus('Something went wrong. Your project autosave has not been deleted.', 'error');
}
window.addEventListener('error', (event) => reportFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => reportFatalError(event.reason));
const cancelAutosave = () => { clearTimeout(autosaveTimer); autosaveTimer = null; autosaveStatus = 'idle'; };
const discardRecovery = () => { localStorage.removeItem(AUTOSAVE_KEY); shell.setRecoveryAvailable(false); };
const markSaved = ({ keepRecovery = false } = {}) => { cancelAutosave(); hasUnsavedChanges = false; shell.setDirty(false); if (!keepRecovery) discardRecovery(); };
const replaceProject = (commit) => commitProjectReplacement({
  hasUnsavedChanges: () => hasUnsavedChanges,
  confirmReplacement: () => shell.confirmProjectReplacement(),
  saveProject: () => saveProject(),
  stop: () => { preview.stop(); preview.reset(); previewMode = false; document.getElementById('app').classList.remove('preview-mode'); },
  resetContext: () => editorContext.reset(shell.getWorkspace()),
  captureRollback: () => ({ state: structuredClone(store.getState()), markup: hasValidProjectDocument(store.getState()) ? canvas.serializeCurrentSvg() : '' }),
  commit,
  rollback: async (previous) => { if (previous.markup) await canvas.loadSvgFromText(previous.markup, previous.state.layerMetadata, { recordHistory: false }); store.replaceState(previous.state); preview.apply(); },
  clearHistory: () => history.clear(), establishBaseline: () => markSaved()
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
    await canvas.loadSvgFromText(snapshot.document.svgMarkup, snapshot.document.layerMetadata, { recordHistory: false });
    const nextState=createCleanProjectState();applyProjectSnapshot(nextState,snapshot);store.replaceState(nextState);
    preview.apply();
  });
  if (!committed) return false;
  shell.setStatus(`${sourceLabel} restored.`);
  shell.setProjectLoaded(true);
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
      store.replaceState(createCleanProjectState());
      await canvas.loadSvgFromText(prepared, {}, { recordHistory: false });
      preview.apply();
    });
    if (!committed) return;
    shell.setStatus(`Loaded SVG: ${file.name}`);
    shell.setProjectLoaded(true);
    requestAnimationFrame(() => canvas.fitToCanvas());
  } catch {
    shell.setStatus(`Invalid or unsupported SVG: ${file.name}`, 'error');
  }
});

shell.bindLoadSample(async (kind) => {
  const template = PROJECT_TEMPLATES[kind] || PROJECT_TEMPLATES.expressive;
  const committed = await replaceProject(() => loadProjectTemplate(template,{store,canvas,history,preview,validate:validateRig}));
  if (!committed) return;
  shell.setProjectLoaded(true);
  requestAnimationFrame(()=>canvas.fitToCanvas());
  shell.setStatus('Loaded built-in sample mascot.');
});

shell.bindDemoClip((clipId)=>{const clip=store.getState().animationClips.find(item=>item.id===clipId);if(!clip)return;if(preview.isPlaying()&&preview.getActiveClipId()===clipId){preview.stopClip();shell.setStatus(`Stopped ${clip.name}.`);}else{preview.setClip(clipId);preview.stopClip();preview.playClip();shell.setStatus(`Playing ${clip.name}.`);}renderProjectUi();});
shell.bindAddFeature((featureId)=>{const feature=FACE_FEATURES[featureId];if(!feature||isFaceFeatureInstalled(store.getState(),featureId))return;history.snapshot();if(!canvas.appendArtwork(feature.artwork,feature.mountPoint))return;store.setState(state=>installFaceFeature(state,featureId));preview.apply();shell.setStatus(`${feature.name} added with ready-to-try examples.`);});

function renderProjectUi(){const state=store.getState(),parts=Object.values(state.semanticParts||{});const ready=(type)=>{const part=parts.find(item=>item.type===type),roles=part&&Object.values(part.roles||{});return Boolean(roles?.length&&roles.every(id=>state.elements?.[id]));};const head=parts.find(part=>part.type==='head');const featureCompatible=Boolean(state.elements?.faceRoot&&Object.values(head?.roles||{}).includes('faceRoot'));shell.renderProjectUi({loaded:Boolean(state.svgMarkup),examples:availableExamples(state),features:Object.fromEntries(Object.keys(FACE_FEATURES).map(id=>[id,isFaceFeatureInstalled(state,id)])),playingId:preview.isPlaying()?preview.getActiveClipId():null,featureCompatible,core:[['head','Face'],['eyes','Eyes'],['gaze','Gaze'],['mouth','Mouth']].map(([type,label])=>({label,ready:ready(type)})),states:Object.keys(state.states||{}),activeState:state.activeState,behaviors:state.behaviors||[]});}
shell.bindPreviewState((name)=>{preview.setState(name);renderProjectUi();});
shell.bindBehaviorToggle((index,enabled)=>{history.snapshot();store.setState(state=>{if(state.behaviors[index])state.behaviors[index].enabled=enabled;});preview.apply();});

shell.bindGenerateFace(async (options) => {
  const committed=await replaceProject(()=>loadProjectTemplate(buildFaceProjectTemplate(options),{store,canvas,history,preview,validate:validateRig}));
  if(committed){shell.setProjectLoaded(true);shell.setStatus('Generated face from builder options.');}
});

shell.bindApplyPreset(async (presetId) => {
  const preset = PRESET_LIBRARY[presetId];
  if (!preset) return;
  const prepared=canvas.prepareSvgImport(preset.svg);
  const committed=await replaceProject(async()=>{store.replaceState(createCleanProjectState());await canvas.loadSvgFromText(prepared, {}, { recordHistory: false });});
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

shell.bindNew(() => replaceProject(() => { location.reload(); }));
const validationCache=createValidationCache(validateProject, validationRevision);
const fixProblem=(issue)=>{if(!issue?.fix)return;const {workspace,...context}=issue.fix;shell.setWorkspace(workspace||'create');editorContext.update({workspace:workspace||shell.getWorkspace(),...context});};
shell.bindValidate(() => { const issues=validationCache.run(store.getState()); shell.showProblems(deriveProjectReadiness(store.getState(),issues),issues,fixProblem); });
shell.bindPreview((enabled) => { previewMode=Boolean(enabled); document.getElementById('app').classList.toggle('preview-mode',previewMode); previewMode ? preview.start() : preview.stop(); if(previewMode)shell.setStatus('Preview is live. Changes here are non-destructive.'); });
shell.bindExport(() => { const issues=validationCache.run(store.getState()),blocking=exportBlockingIssues(issues);if(blocking.length){shell.showProblems(deriveProjectReadiness(store.getState(),issues),issues,fixProblem);shell.setStatus(`Cannot export: ${blocking[0].message}`,'error');return;} exporter.render();exporter.open(); });

let previousDomains={};let previousPersistent='';
const signature=(value)=>JSON.stringify(value);
const validationTask=createDebouncedTask(()=>{const state=store.getState(),issues=validationCache.run(state),blocking=exportBlockingIssues(issues);shell.setReadiness(deriveProjectReadiness(state,issues),issues);if(!state.layers.length)shell.setStatus('Import SVG artwork or start from a template.','warn');else if(blocking.length)shell.setStatus(`${blocking.length} problem(s): ${blocking[0].message}`,'warn');else shell.setStatus(`Project ready • ${state.layers.length} layer(s)`,'info');},150);
store.subscribe((state) => {
  const domains={document:signature([state.svgMarkup,state.elements]),selection:state.selectedId,layers:signature([state.layers,state.layerMetadata]),rig:signature([state.params,state.globalConstraints,state.stateConstraints]),stateMachine:signature([state.states,state.transitions,state.transitionSettings,state.behaviors,state.activeState]),semanticRig:signature(state.semanticParts),animation:signature(state.animationClips)};
  const changed=Object.fromEntries(Object.keys(domains).map(key=>[key,domains[key]!==previousDomains[key]]));previousDomains=domains;
  if(changed.document){canvas.reconcileState(state);exporter.render();}
  if(changed.layers){canvas.syncLayerOrder(state.layers);layers.render();}
  else if(changed.selection)layers.render();
  if(changed.selection)canvas.syncSelection(state.selectedId);
  if(changed.selection||changed.document||changed.rig){inspector.render();}
  if(changed.stateMachine)states.render();
  if(changed.animation||changed.rig)timeline.render();
  if(changed.semanticRig||changed.selection||changed.rig)rigPanel.render();
  shell.setProjectLoaded(Boolean(state.svgMarkup));shell.setProjectActionsEnabled(hasValidProjectDocument(state));if(changed.document||changed.rig||changed.stateMachine||changed.semanticRig||changed.animation)validationTask.schedule();
  if(changed.document||changed.animation||changed.semanticRig)renderProjectUi();
  const persistent=signature([state.svgMarkup,state.elements,state.layers,state.layerMetadata,state.params,state.states,state.transitions,state.transitionSettings,state.behaviors,state.semanticParts,state.animationClips,{...state.animationEditor,playhead:0}]);
  if(persistent===previousPersistent)return;previousPersistent=persistent;hasUnsavedChanges=true;autosaveStatus='pending';shell.setDirty(true);clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{try{localStorage.setItem(AUTOSAVE_KEY,JSON.stringify({savedAt:new Date().toISOString(),projectSnapshot:createProjectSnapshot(store.getState(),()=>canvas.serializeCurrentSvg())}));autosaveStatus='saved';shell.setDirty(true,true);shell.setRecoveryAvailable(true);}catch{shell.setStatus('Autosave unavailable (browser storage is full or disabled).','warn');}},500);
});

shell.setRecoveryAvailable(Boolean(localStorage.getItem(AUTOSAVE_KEY)));
shell.bindRecoverAutosave(async()=>{try{const saved=JSON.parse(localStorage.getItem(AUTOSAVE_KEY));const prepared=prepareProjectSnapshot(saved?.projectSnapshot||saved,(svg)=>canvas.prepareSvgImport(svg));await restoreSnapshot(prepared,'Local autosave',{recovered:true});}catch{shell.setStatus('Local autosave is invalid.','error');}});
window.addEventListener('beforeunload',(event)=>{if(!hasUnsavedChanges)return;event.preventDefault();event.returnValue='';});

timeline.render();
  rigPanel.render();
states.render();
exporter.render();
layers.render();
shell.setStatus('Import an SVG to start rigging.', 'warn');
shell.setProjectLoaded(false); shell.setDirty(false); shell.setProjectActionsEnabled(false);
renderProjectUi();


window.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && (event.target.matches('input, textarea, select') || event.target.isContentEditable)) return;
  const meta = event.ctrlKey || event.metaKey;
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
  window.__BOOP_E2E__ = {
    state: () => structuredClone(store.getState()),
    mutate: (recipe) => store.setState(recipe),
    setAuthoredPath: (id, d) => canvas.applyPathData(id, d),
    setAuthoredTransform: (id, patch) => { store.setState((state) => Object.assign(state.elements[id].baseTransform, patch)); canvas.applyElementTransform(id, store.getState().elements[id]); },
    setLiveParam: (name, value) => preview.setLiveParam(name, value),
    clearLiveParam: (name) => preview.clearLiveParam(name),
    effectiveParams: () => structuredClone(preview.getEffectiveParams()),
    transitionTo: (name) => preview.setState(name),
    diagnostics: () => lifecycleDiagnostics.snapshot(),
    resetDiagnostics: () => lifecycleDiagnostics.reset(),
    exportArtifacts: () => exporter.createExportArtifacts().map(item=>({...item}))
  };
}
