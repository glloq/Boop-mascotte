import runtimeSource from '../../../runtime/runtime.js?raw';
import { createExportRig } from './export-rig.js';
import { hasValidProjectDocument } from '../state/project-snapshot.js';

export function createExporter(host, store, canvas) {
  if (!host) throw new Error('Missing required UI element: #export-panel');

  const createExportArtifacts = () => {
    const state = store.getState();
    if (!hasValidProjectDocument(state, () => canvas.serializeCurrentSvg())) throw new Error('Cannot export a project without a valid SVG document');
    return [
      { name: 'mascot.svg', type: 'image/svg+xml', content: canvas.serializeCurrentSvg() },
      { name: 'rig.json', type: 'application/json', content: JSON.stringify(createExportRig(state), null, 2) },
      { name: 'runtime.js', type: 'text/javascript', content: runtimeSource }
    ];
  };
  host.addEventListener('click', (event) => {
    if (event.target.dataset.closeExport !== undefined) { host.hidden=true; return; }
    const name=event.target.dataset.downloadArtifact;
    if (!name) return;
    const artifact=createExportArtifacts().find(item=>item.name===name);
    if (artifact) download(artifact);
  });

  return {
    render() {
      host.innerHTML = `
        <div class="card-title"><h3 id="export-heading">Export files</h3><button class="icon" data-close-export aria-label="Close export">×</button></div>
        <p class="small">Download each runtime artifact. Individual user actions work reliably in every browser.</p>
        <div class="export-actions">${createExportArtifacts().map(({name})=>`<button data-download-artifact="${name}">Download ${name}</button>`).join('')}</div>
      `;
    },
    open(){host.hidden=false;host.querySelector('[data-download-artifact]')?.focus();},
    createExportArtifacts
  };
}

function download({name,content,type}) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
