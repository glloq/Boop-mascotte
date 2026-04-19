import { createAppShell } from './ui/app-shell.js';
import { createStore } from './core/state/store.js';
import { createHistory } from './core/undo/history.js';
import { createSvgCanvas } from './svg-editor/svg-canvas.js';
import { createLayersPanel } from './svg-editor/layers-panel.js';
import { createInspector } from './inspector/inspector.js';
import { createStateMachineEditor } from './animation-editor/state-machine-editor.js';
import { createPreviewPlayer } from './core/preview-runtime/preview-player.js';
import { createExporter } from './core/export/exporter.js';

const store = createStore();
const history = createHistory(store);
const shell = createAppShell(document.getElementById('app'));
const canvas = createSvgCanvas(shell.canvasEl, store, history);
const layers = createLayersPanel(shell.leftSidebarEl, store);
const inspector = createInspector(shell.inspectorEl, store, history, canvas);
const states = createStateMachineEditor(shell.leftSidebarEl, store, history);
const preview = createPreviewPlayer(shell.leftSidebarEl, store, canvas);
const exporter = createExporter(shell.leftSidebarEl, store, canvas);

shell.bindUndoRedo(() => history.undo(), () => history.redo());

shell.bindLoadSvg(async (file) => {
  await canvas.loadSvgFromFile(file);
  canvas.syncLayerOrder(store.getState().layers);
  inspector.render();
  states.render();
  layers.render();
});

store.subscribe((state) => {
  canvas.syncLayerOrder(state.layers);
  inspector.render();
  states.render();
  preview.render();
  exporter.render();
  layers.render();
});

preview.render();
states.render();
exporter.render();
layers.render();
