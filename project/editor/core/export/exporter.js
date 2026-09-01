import runtimeSource from '../../../runtime/runtime.js?raw';
import { createExportRig } from './export-rig.js';
import { createExportArtifacts as buildExportArtifacts, createExportUiModel } from './export-policy.js';

export function createExporter(host, store, canvas) {
  if (!host) throw new Error('Missing required UI element: #export-panel');

  const createExportArtifacts = () => {
    return buildExportArtifacts({
      state: store.getState(),
      serializeSvg: () => canvas.serializeCurrentSvg(),
      createRig: createExportRig,
      runtimeSource
    });
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
      const model = createExportUiModel(store.getState());
      host.innerHTML = `
        <div class="card-title"><h3 id="export-heading">Export files</h3><button class="icon" data-close-export aria-label="Close export">×</button></div>
        <p class="small" data-export-status>${model.message}</p>
        <div class="export-manifest">${model.artifacts.map(({name,description})=>`<p><b>${name}</b> — ${description}</p>`).join('')}</div>
        <div class="export-actions">${model.artifacts.map(({name,enabled})=>`<button data-download-artifact="${name}" ${enabled?'':'disabled'}>Download ${name}</button>`).join('')}</div>
        ${store.getState().animationClips?.length ? '<p class="small"><b>Note:</b> Timeline animations are saved in the editable project but are not included in runtime rig.json in V1.</p>' : ''}
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
