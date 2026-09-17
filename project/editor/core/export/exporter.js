import numericSource from '../../../runtime/numeric.js?raw';
import transform2dSource from '../../../runtime/transform-2d.js?raw';
import pathVectorSource from '../../../runtime/path-vector.js?raw';
import warpGridSource from '../../../runtime/warp-grid.js?raw';
import keyformsSource from '../../../runtime/keyforms.js?raw';
import shapeKeysSource from '../../../runtime/shape-keys.js?raw';
import depthSource from '../../../runtime/depth.js?raw';
import handVocabularySource from '../../../runtime/hand-vocabulary.js?raw';
import handSpriteSource from '../../../runtime/hand-sprite.js?raw';
import handsSource from '../../../runtime/hands.js?raw';
import inertiaSource from '../../../runtime/inertia.js?raw';
import followersSource from '../../../runtime/followers.js?raw';
import mixerSource from '../../../runtime/mixer.js?raw';
import transitionsSource from '../../../runtime/transitions.js?raw';
import deformersSource from '../../../runtime/deformers.js?raw';
import drawOrderSource from '../../../runtime/draw-order.js?raw';
import rigPinsSource from '../../../runtime/rig-pins.js?raw';
import rigConstraintsSource from '../../../runtime/rig-constraints.js?raw';
import rigAttachmentsSource from '../../../runtime/rig-attachments.js?raw';
import gazeSolverSource from '../../../runtime/gaze-solver.js?raw';
import effectiveParamsSource from '../../../runtime/effective-params.js?raw';
import runtimeModuleSource from '../../../runtime/runtime.js?raw';
import assetReferenceSource from '../../../runtime/asset-reference.js?raw';
import assetPaintSource from '../../../runtime/asset-paint.js?raw';
import assetResolverSource from '../../../runtime/asset-resolver.js?raw';
import meshWarpSource from '../../../runtime/mesh-warp.js?raw';
import reactionConditionsSource from '../../../runtime/reaction-conditions.js?raw';
import partStatesSource from '../../../runtime/part-states.js?raw';
import { bundleRuntimeSource } from './runtime-bundle.js';
import { createExportRig } from './export-rig.js';
import { EXPORT_BUNDLE, createExportArtifacts as buildExportArtifacts, createExportUiModel } from './export-policy.js';
import { writeZip } from './zip.js';
import { createExportReadinessModel } from './export-readiness.js';
import { READINESS_SYMBOLS } from '../validation/task-readiness.js';

// The panels share one escaper (`ui/escape-html.js`); `core` keeps its own
// copy rather than importing upwards out of the layer it is the bottom of.
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function createExporter(host, store, canvas, options = {}) {
  if (!host) throw new Error('Missing required UI element: #export-panel');
  // Readiness sources and deep-link handlers are configured once the validation cache and router exist (UX-16).
  let config = { readiness: () => null, issues: () => [], onFix: () => {}, onGo: () => {}, assetBytes: async () => null, ...options };
  let current = null;

  const createExportArtifacts = (assetBytes = () => null) => {
    return buildExportArtifacts({
      state: store.getState(),
      serializeSvg: () => canvas.serializeCurrentSvg(),
      createRig: createExportRig,
      assetBytes,
      // One standalone file even though the runtime is authored as modules.
      runtimeSource: bundleRuntimeSource([
        { name: 'numeric.js', source: numericSource },
        { name: 'transform-2d.js', source: transform2dSource },
        { name: 'path-vector.js', source: pathVectorSource },
        { name: 'warp-grid.js', source: warpGridSource },
        { name: 'keyforms.js', source: keyformsSource },
        { name: 'shape-keys.js', source: shapeKeysSource },
        { name: 'depth.js', source: depthSource },
        { name: 'hand-vocabulary.js', source: handVocabularySource },
        { name: 'hand-sprite.js', source: handSpriteSource },
        { name: 'hands.js', source: handsSource },
        { name: 'inertia.js', source: inertiaSource },
        { name: 'followers.js', source: followersSource },
        { name: 'mixer.js', source: mixerSource },
        { name: 'transitions.js', source: transitionsSource },
        { name: 'deformers.js', source: deformersSource },
        { name: 'draw-order.js', source: drawOrderSource },
        { name: 'rig-pins.js', source: rigPinsSource },
        { name: 'rig-constraints.js', source: rigConstraintsSource },
        { name: 'rig-attachments.js', source: rigAttachmentsSource },
        { name: 'gaze-solver.js', source: gazeSolverSource },
        { name: 'effective-params.js', source: effectiveParamsSource },
        // Everything `runtime.js` reaches for. A module missing from this list
        // is not a build error: the bundler strips the import and the name is
        // simply undefined at the moment something calls it, which is a
        // standalone runtime that throws on a mascot made of pictures while
        // working perfectly on one made of paths.
        { name: 'asset-reference.js', source: assetReferenceSource },
        { name: 'asset-paint.js', source: assetPaintSource },
        { name: 'asset-resolver.js', source: assetResolverSource },
        { name: 'mesh-warp.js', source: meshWarpSource },
        { name: 'part-states.js', source: partStatesSource },
        { name: 'reaction-conditions.js', source: reactionConditionsSource },
        { name: 'runtime.js', source: runtimeModuleSource }
      ])
    });
  };
  host.addEventListener('click', (event) => {
    if (event.target.dataset.closeExport !== undefined) { host.hidden=true; return; }
    const fixId=event.target.dataset.fixProblem; if (fixId !== undefined) { const entry=[...(current?.blockers||[]),...(current?.warnings||[]),...(current?.info||[])].find(item=>item.id===fixId); host.hidden=true; if (entry) config.onFix(entry.issue); return; }
    const go=event.target.dataset.readinessGo; if (go) { const section=(current?.sections||[]).find(item=>item.id===go); host.hidden=true; if (section) config.onGo(section); return; }
    const name=event.target.dataset.downloadArtifact;
    if (!name) return;
    // Reading the pictures out of the store is asynchronous, so every download
    // is: a mascot of paths asks for nothing and resolves at once.
    void (async () => {
      const held = new Map();
      for (const id of Object.keys(store.getDocument?.()?.assets || {})) {
        const bytes = await config.assetBytes?.(id);
        if (bytes) held.set(id, bytes);
      }
      const artifacts = createExportArtifacts((id) => held.get(id) ?? null);
      if (name === EXPORT_BUNDLE.name) {
        const bytes = await writeZip(artifacts.map((item) => ({
          name: item.name,
          bytes: typeof item.content === 'string' ? new TextEncoder().encode(item.content) : item.content,
          // A picture is compressed already; deflating it costs time to grow it.
          compress: !item.name.startsWith('assets/') || item.type === 'image/svg+xml'
        })));
        download({ name, type: 'application/zip', content: bytes });
        return;
      }
      const artifact = artifacts.find((item) => item.name === name);
      if (artifact) download(artifact);
    })();
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
