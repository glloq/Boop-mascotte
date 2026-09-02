import runtimeSource from '../../../runtime/runtime.js?raw';
import { createExportRig } from './export-rig.js';
import { createExportArtifacts as buildExportArtifacts, createExportUiModel } from './export-policy.js';
import { createExportReadinessModel } from './export-readiness.js';
import { READINESS_SYMBOLS } from '../validation/task-readiness.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function createExporter(host, store, canvas, options = {}) {
  if (!host) throw new Error('Missing required UI element: #export-panel');
  // Readiness sources and deep-link handlers are configured once the validation cache and router exist (UX-16).
  let config = { readiness: () => null, issues: () => [], onFix: () => {}, onGo: () => {}, ...options };
  let current = null;

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
    const fixId=event.target.dataset.fixProblem; if (fixId !== undefined) { const entry=[...(current?.blockers||[]),...(current?.warnings||[]),...(current?.info||[])].find(item=>item.id===fixId); host.hidden=true; if (entry) config.onFix(entry.issue); return; }
    const go=event.target.dataset.readinessGo; if (go) { const section=(current?.sections||[]).find(item=>item.id===go); host.hidden=true; if (section) config.onGo(section); return; }
    const name=event.target.dataset.downloadArtifact;
    if (!name) return;
    const artifact=createExportArtifacts().find(item=>item.name===name);
    if (artifact) download(artifact);
  });

  return {
    configure(next) { config = { ...config, ...next }; },
    render() {
      const model = createExportUiModel(store.getState());
      const readiness = createExportReadinessModel(config.readiness(), config.issues(), { available: model.available });
      current = readiness;
      const enabled = model.available && readiness.canExport;
      host.dataset.exportState = enabled ? 'ready' : 'blocked';
      host.dataset.exportWarnings = String(readiness.counts.warnings);
      const row = (item) => `<li data-readiness-section="${item.id}" data-readiness-status="${item.status}"><span class="readiness-symbol" aria-hidden="true">${READINESS_SYMBOLS[item.status] || '○'}</span><span class="readiness-copy"><b>${esc(item.label)}</b><small>${esc(item.summary)}</small></span>${item.route && item.id !== 'export' ? `<button type="button" class="secondary" data-readiness-go="${item.id}" aria-label="Go to ${esc(item.label)}">${item.action ? 'Fix' : 'Go'}</button>` : ''}</li>`;
      const entry = (item, attr) => `<article class="manager-card export-issue" ${attr}="${esc(item.id)}"><b>${item.severity === 'error' ? '● Error' : item.severity === 'warning' ? '⚠ Warning' : '· Note'}</b><p>${esc(item.message)}</p><small>${esc(item.fix.explanation)}</small>${item.fix.available ? `<button type="button" data-fix-problem="${esc(item.id)}">Fix</button>` : ''}</article>`;
      host.innerHTML = `
        <div class="card-title"><h3 id="export-heading">Export files</h3><button class="icon" data-close-export aria-label="Close export">×</button></div>
        <p class="export-headline" data-export-headline data-export-status="${readiness.status}">${readiness.status === 'blocked' ? '●' : readiness.status === 'warnings' ? '⚠' : '✓'} ${esc(readiness.headline)}</p>
        <p class="small export-counts"><span data-export-count="errors">${readiness.counts.errors}</span> error${readiness.counts.errors === 1 ? '' : 's'} · <span data-export-count="warnings">${readiness.counts.warnings}</span> warning${readiness.counts.warnings === 1 ? '' : 's'} · <span data-export-count="info">${readiness.counts.info}</span> note${readiness.counts.info === 1 ? '' : 's'}</p>
        ${readiness.blockers.length ? `<section class="export-blockers"><h4>Blocking</h4>${readiness.blockers.map((item) => entry(item, 'data-export-blocker')).join('')}</section>` : ''}
        <ol class="readiness-rows readiness-list export-readiness" aria-label="Task readiness">${readiness.sections.map(row).join('')}</ol>
        ${readiness.warnings.length ? `<details class="export-warnings" open><summary>${readiness.counts.warnings} warning${readiness.counts.warnings === 1 ? '' : 's'} (export still works)</summary>${readiness.warnings.map((item) => entry(item, 'data-export-warning')).join('')}</details>` : ''}
        ${readiness.info.length ? `<details class="export-notes"><summary>${readiness.counts.info} note${readiness.counts.info === 1 ? '' : 's'}</summary>${readiness.info.map((item) => entry(item, 'data-export-note')).join('')}</details>` : ''}
        <p class="small" data-export-status>${enabled ? model.message : readiness.status === 'blocked' && model.available ? 'Fix the blocking problems above, then download.' : model.message}</p>
        <div class="export-manifest">${model.artifacts.map(({name,description})=>`<p><b>${name}</b> — ${description}</p>`).join('')}</div>
        <div class="export-actions">${model.artifacts.map(({name})=>`<button data-download-artifact="${name}" ${enabled?'':'disabled'}>Download ${name}</button>`).join('')}</div>
        ${store.getState().animationClips?.length ? '<p class="small"><b>Note:</b> Animations are exported in rig.json and play with <code>mascot.playAnimation(id)</code> or through Reactions.</p>' : ''}
        ${store.getState().reactions?.length ? "<p class=\"small\"><b>Reactions:</b> after <code>start()</code>, call <code>mascot.bindEvents()</code> so clicks and hovers trigger them, or fire your own with <code>mascot.trigger('custom', { name })</code>.</p>" : ''}
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
