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
import { createPluginRegistry } from './core/plugins/plugin-registry.js';
import { defaultElementPlugin } from './core/plugins/builtin/default-plugin.js';
import { pathElementPlugin } from './core/plugins/builtin/path-plugin.js';

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

shell.bindApplyPreset((presetId) => {
  const preset = PRESET_LIBRARY[presetId];
  if (!preset) return;
  canvas.loadSvgFromText(preset.svg);
  shell.setStatus(`Preset loaded: ${preset.label}`);
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
    history.snapshot();
    store.setState((state) => {
      state.activeState = nextState;
      state.params = { ...state.states[nextState] };
    });
    shell.setStatus(`State switched: ${nextState}`);
  }
});
