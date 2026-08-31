import runtimeSource from '../../../runtime/runtime.js?raw';
import { createExportRig } from './export-rig.js';

export function createExporter(leftSidebarEl, store, canvas) {
  const host = leftSidebarEl.querySelector('#export-panel');

  host.addEventListener('click', (event) => {
    if (event.target.id !== 'export-btn') return;
    const state = store.getState();

    download('mascot.svg', canvas.serializeCurrentSvg());
    download('rig.json', JSON.stringify(createExportRig(state), null, 2));
    download('runtime.js', runtimeSource);
  });

  return {
    render() {
      host.innerHTML = `
        <h3>Export</h3>
        <button id="export-btn">Export mascot.svg + rig.json + runtime.js</button>
      `;
    }
  };
}

function download(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
