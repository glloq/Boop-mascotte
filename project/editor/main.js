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
const layers = createLayersPanel(shell.leftSidebarEl, store);
const inspector = createInspector(shell.inspectorEl, store, history, canvas);
const states = createStateMachineEditor(shell.leftSidebarEl, store, history);
const preview = createPreviewPlayer(shell.leftSidebarEl, store, canvas);
const exporter = createExporter(shell.leftSidebarEl, store, canvas);

const AUTOSAVE_KEY = 'boop-mascotte-autosave-v1';

function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function restoreSnapshot(snapshot, sourceLabel) {
  if (snapshot?.document?.svgMarkup) {
    await canvas.loadSvgFromText(snapshot.document.svgMarkup);
  }
  history.snapshot();
  store.setState((state) => {
    applyProjectSnapshot(state, snapshot);
  });
  preview.applyBindings();
  shell.setStatus(`${sourceLabel} restored.`);
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
  await canvas.loadSvgFromFile(file);
  shell.setStatus(`Loaded SVG: ${file.name}`);
  canvas.syncLayerOrder(store.getState().layers);
  inspector.render();
  states.render();
  layers.render();
});

shell.bindLoadSample(() => {
  canvas.loadSvgFromText(DEFAULT_SAMPLE_SVG);
  shell.setStatus('Loaded built-in sample mascot.');
});

shell.bindGenerateFace((options) => {
  canvas.loadSvgFromText(buildFaceSvg(options));
  shell.setStatus('Generated face from builder options.');
});

shell.bindApplyPreset((presetId) => {
  const preset = PRESET_LIBRARY[presetId];
  if (!preset) return;
  canvas.loadSvgFromText(preset.svg);
  shell.setStatus(`Preset loaded: ${preset.label}`);
});

shell.bindSaveProject(() => {
  const snapshot = createProjectSnapshot(store.getState());
  downloadJson('mascot-project.json', snapshot);
  shell.setStatus('Project snapshot exported.');
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

store.subscribe((state) => {
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

  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(createProjectSnapshot(state)));
});

preview.render();
states.render();
exporter.render();
layers.render();
shell.setStatus('Import an SVG to start rigging.', 'warn');


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
      state.params = { ...state.states[nextState] };
    });
    shell.setStatus(`State switched: ${nextState}`);
  }
});
