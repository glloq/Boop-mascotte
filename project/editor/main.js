import { createAppShell } from './ui/app-shell.js';
import { createStore } from './core/state/store.js';
import { createHistory } from './core/undo/history.js';
import { createSvgCanvas } from './svg-editor/svg-canvas.js';
import { createLayersPanel } from './svg-editor/layers-panel.js';
import { createInspector } from './inspector/inspector.js';
import { createStateMachineEditor } from './animation-editor/state-machine-editor.js';
import { createPreviewPlayer } from './core/preview-runtime/preview-player.js';
import { createExporter } from './core/export/exporter.js';
import { validateRig } from './core/validation/rig-validator.js';
import { DEFAULT_SAMPLE_SVG } from './core/sample/default-mascot.js';
import { PRESET_LIBRARY } from './core/assets/preset-library.js';
import { buildFaceSvg } from './core/assets/face-builder.js';
import { createPluginRegistry } from './core/plugins/plugin-registry.js';
import { defaultElementPlugin } from './core/plugins/builtin/default-plugin.js';
import { pathElementPlugin } from './core/plugins/builtin/path-plugin.js';
import { canTransition } from './core/state/transition-guard.js';
import { applyImportedRig } from './core/state/import-rig.js';
import { applyProjectSnapshot, createProjectSnapshot } from './core/state/project-snapshot.js';

const store = createStore();
const history = createHistory(store);
const shell = createAppShell(document.getElementById('app'));
const pluginRegistry = createPluginRegistry();
pluginRegistry.register(defaultElementPlugin);
pluginRegistry.register(pathElementPlugin);
const canvas = createSvgCanvas(shell.canvasEl, store, history, pluginRegistry);
const layers = createLayersPanel(shell.leftSidebarEl, store, history, canvas);
const inspector = createInspector(shell.inspectorEl, store, history, canvas);
const states = createStateMachineEditor(shell.leftSidebarEl, store, history);
const preview = createPreviewPlayer(shell.leftSidebarEl, store, canvas);
const exporter = createExporter(shell.leftSidebarEl, store, canvas);

const AUTOSAVE_KEY = 'boop-mascotte-autosave-v1';
let dirty = false;
let autosaveTimer;
function reportFatalError(error) {
  console.error(error);
  shell.setStatus('Something went wrong. Your project autosave has not been deleted.', 'error');
}
window.addEventListener('error', (event) => reportFatalError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => reportFatalError(event.reason));
const markSaved = () => { dirty = false; shell.setDirty(false); };

function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function restoreSnapshot(snapshot, sourceLabel) {
  if (snapshot?.document?.svgMarkup) {
    await canvas.loadSvgFromText(snapshot.document.svgMarkup, snapshot.document.layerMetadata);
  }
  history.snapshot();
  store.setState((state) => {
    applyProjectSnapshot(state, snapshot);
  });
  preview.applyBindings();
  shell.setStatus(`${sourceLabel} restored.`);
  shell.setProjectLoaded(Boolean(snapshot?.document?.svgMarkup)); markSaved();
}

function configureStarterRig() {
  store.setState((state) => {
    state.params = {
      lookX:{type:'number',min:-1,max:1,default:0,value:0}, lookY:{type:'number',min:-1,max:1,default:0,value:0},
      eyeOpen:{type:'number',min:0,max:1,default:1,value:1}, mouthOpen:{type:'number',min:0,max:1,default:0,value:0}, smile:{type:'number',min:0,max:1,default:0,value:0}
    };
    const base={lookX:0,lookY:0,eyeOpen:1,mouthOpen:0,smile:0};
    state.states={idle:{...base},happy:{...base,smile:1},sad:{...base,smile:0},surprised:{...base,eyeOpen:1,mouthOpen:1}};
    state.transitions={idle:['happy','sad','surprised'],happy:['idle'],sad:['idle'],surprised:['idle']}; state.activeState='idle';
    state.behaviors=[{id:'blink',type:'blink',name:'Blink',enabled:true,parameter:'eyeOpen',intervalMin:2,intervalMax:6,duration:.12,closedValue:0},{id:'idle-sway',type:'oscillator',name:'Idle sway',enabled:true,parameter:'lookY',amplitude:.05,frequency:.3,offset:0,waveform:'sine'}];
  });
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



shell.bindLoadRig(async (file) => {
  try {
    const imported = JSON.parse(await file.text());
    history.snapshot();
    store.setState((state) => {
      applyImportedRig(state, imported);
    });
    preview.applyBindings();
    shell.setStatus(`Rig imported: ${file.name}`);
  } catch {
    shell.setStatus(`Invalid rig file: ${file.name}`, 'error');
  }
});

shell.bindLoadSvg(async (file) => {
  try {
    await canvas.loadSvgFromFile(file);
    shell.setStatus(`Loaded SVG: ${file.name}`);
    canvas.syncLayerOrder(store.getState().layers);
    inspector.render();
    states.render();
    layers.render();
    shell.setProjectLoaded(true);
  } catch {
    shell.setStatus(`Invalid or unsupported SVG: ${file.name}`, 'error');
  }
});

shell.bindLoadSample(() => {
  canvas.loadSvgFromText(DEFAULT_SAMPLE_SVG); configureStarterRig(); shell.setProjectLoaded(true);
  shell.setStatus('Loaded built-in sample mascot.');
});

shell.bindGenerateFace((options) => {
  canvas.loadSvgFromText(buildFaceSvg(options)); configureStarterRig(); shell.setProjectLoaded(true);
  shell.setStatus('Generated face from builder options.');
});

shell.bindApplyPreset((presetId) => {
  const preset = PRESET_LIBRARY[presetId];
  if (!preset) return;
  canvas.loadSvgFromText(preset.svg);
  shell.setStatus(`Preset loaded: ${preset.label}`);
});

shell.bindSaveProject(() => {
  const snapshot = createProjectSnapshot(store.getState(), () => canvas.serializeCurrentSvg());
  downloadJson('mascot-project.json', snapshot);
  shell.setStatus('Project snapshot exported.');
  markSaved();
});

shell.bindLoadProject(async (file) => {
  try {
    const imported = JSON.parse(await file.text());
    await restoreSnapshot(imported, `Project ${file.name}`);
  } catch {
    shell.setStatus(`Invalid project snapshot: ${file.name}`, 'error');
  }
});

shell.bindRestoreAutosave(async () => {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    shell.setStatus('No autosave found in browser storage.', 'warn');
    return;
  }

  try {
    const snapshot = JSON.parse(raw);
    await restoreSnapshot(snapshot, 'Autosave');
  } catch {
    shell.setStatus('Autosave is corrupted.', 'error');
  }
});

shell.bindNew(() => { if (dirty && !confirm('Discard unsaved changes and create a new project?')) return; location.reload(); });
shell.bindValidate(() => { const issues=validateRig(store.getState()); alert(issues.length ? `${issues.length} issue(s)\n\n${issues.join('\n')}` : '✓ Valid — no rig errors.'); });
shell.bindPreview(() => { document.getElementById('app').classList.toggle('preview-mode'); shell.setStatus('Preview mode toggled. Behaviors use non-destructive parameter overrides.'); });
shell.bindExport(() => { const issues=validateRig(store.getState()); if(issues.length&&!confirm(`The rig contains ${issues.length} error(s). Export anyway?`))return; document.querySelector('#export-panel button')?.click(); });

store.subscribe((state) => {
  dirty = true; shell.setDirty(true); shell.setProjectLoaded(Boolean(state.svgMarkup));
  canvas.syncLayerOrder(state.layers);
  inspector.render();
  states.render();
  preview.render();
  exporter.render();
  layers.render();

  const issues = validateRig(state);
  if (!state.layers.length) shell.setStatus('Import an SVG to start rigging.', 'warn');
  else if (issues.length) shell.setStatus(`${issues.length} validation issue(s): ${issues[0]}`, 'warn');
  else shell.setStatus(`Rig OK • ${state.layers.length} layer(s)`, 'info');

  clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>{ try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(createProjectSnapshot(store.getState(), () => canvas.serializeCurrentSvg()))); shell.setStatus('Autosaved in this browser.'); } catch { shell.setStatus('Autosave unavailable (browser storage is full or disabled).', 'warn'); } },500);
});

preview.render();
states.render();
exporter.render();
layers.render();
shell.setStatus('Import an SVG to start rigging.', 'warn');
shell.setProjectLoaded(false); shell.setDirty(false);


window.addEventListener('keydown', (event) => {
  const meta = event.ctrlKey || event.metaKey;
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
  if (meta && event.key.toLowerCase() === 's') { event.preventDefault(); document.querySelector('#save-project').click(); return; }

  const stateByKey = { '1': 'idle', '2': 'happy', '3': 'sad' };
  const nextState = stateByKey[event.key];
  if (nextState) {
    const current = store.getState().activeState;
    if (!canTransition(store.getState().transitions, current, nextState)) {
      shell.setStatus(`Transition blocked: ${current} → ${nextState}`, 'warn');
      return;
    }
    history.snapshot();
    store.setState((state) => {
      state.activeState = nextState;
      Object.entries(state.params).forEach(([key, param]) => { param.value = state.states[nextState]?.[key] ?? param.default; });
    });
    shell.setStatus(`State switched: ${nextState}`);
  }
});
