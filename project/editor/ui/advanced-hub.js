import { advancedToolRoute, describeAdvancedTools, describeDeformation, flattenDiagnostics } from './advanced-tools.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * Advanced hub (UX-17): one collapsed-by-default entry that lists every
 * expert surface with its availability, routes to it, and hosts the two
 * read-only panels that had no home (Parameters, Diagnostics).
 */
export function createAdvancedHub(host, store, editorContext, { navigate = () => {}, applyRoute = () => {}, openMenu = () => {}, diagnostics = () => ({}), issues = () => [], onStatus = () => {}, layout = () => 'desktop' } = {}) {
  let detail = null;
  const doc = () => store.getDocument();

  host.addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
    if (button.dataset.closeAdvanced !== undefined) { close(); return; }
    if (button.dataset.copyDiagnostics !== undefined) {
      const text = JSON.stringify({ issues: issues().map((issue) => ({ id: issue.id, severity: issue.severity, message: issue.message })), counters: Object.fromEntries(flattenDiagnostics(diagnostics())) }, null, 2);
      try { await navigator.clipboard?.writeText(text); onStatus('Diagnostics copied to the clipboard.'); } catch { onStatus('Copy failed: select the text and copy it manually.', 'warn'); }
      return;
    }
    const id = button.dataset.advancedTool; if (!id) return;
    const plan = advancedToolRoute(id, doc(), editorContext.get(), layout());
    if (!plan) return;
    if (plan.detail) { detail = plan.detail; render(); return; }
    close();
    if (plan.menu) { openMenu(); return; }
    applyRoute(plan);
  });

  function renderDetail() {
    const state = doc();
    if (detail === 'parameters') {
      const params = Object.entries(state.params || {});
      return `<section class="advanced-detail" data-advanced-detail="parameters"><h4>Parameters</h4>${params.length ? `<table class="advanced-table"><thead><tr><th>Control</th><th>Range</th><th>Default</th></tr></thead><tbody>${params.map(([name, param]) => `<tr data-advanced-parameter="${esc(name)}"><td><code>${esc(name)}</code></td><td>${esc(param?.min ?? '')} → ${esc(param?.max ?? '')}</td><td>${esc(param?.default ?? '')}</td></tr>`).join('')}</tbody></table>` : '<p class="small">No controls yet. Turn on movements in Face Setup.</p>'}</section>`;
    }
    if (detail === 'diagnostics') {
      const list = issues(), counters = flattenDiagnostics(diagnostics());
      const count = (severity) => list.filter((issue) => issue.severity === severity).length;
      return `<section class="advanced-detail" data-advanced-detail="diagnostics"><h4>Diagnostics</h4><p class="small"><span data-diagnostics-count="errors">${count('error')}</span> errors · <span data-diagnostics-count="warnings">${count('warning')}</span> warnings · <span data-diagnostics-count="info">${count('info')}</span> notes</p><dl class="advanced-counters">${counters.map(([key, value]) => `<div data-diagnostics-counter="${esc(key)}"><dt>${esc(key)}</dt><dd>${esc(value ?? '')}</dd></div>`).join('')}</dl><button type="button" class="secondary" data-copy-diagnostics>Copy diagnostics</button></section>`;
    }
    if (detail === 'deformation') {
      const rows = describeDeformation(state);
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      return `<section class="advanced-detail" data-advanced-detail="deformation"><h4>Deformation</h4><p class="small">${total ? 'The runtime plays all of these; only the ones with an editor can be changed here.' : 'This project carries none of these. They arrive with an imported rig, or are authored in the panels below where one exists.'}</p><table class="advanced-table"><thead><tr><th>System</th><th>In this project</th><th>Edited in</th></tr></thead><tbody>${rows.map((row) => `<tr data-deformation-row="${esc(row.id)}" data-deformation-count="${row.count}"><td>${esc(row.label)}<br><small><code>${esc(row.doc)}</code></small></td><td>${row.count ? `${row.count}${row.names.length ? `<br><small>${esc(row.names.slice(0, 4).join(', '))}${row.names.length > 4 ? '…' : ''}</small>` : ''}` : '—'}</td><td>${row.editor ? esc(row.editor) : '<small class="preset-missing">No editor yet</small>'}</td></tr>`).join('')}</tbody></table></section>`;
    }
    return '';
  }

  function render() {
    const tools = describeAdvancedTools(doc(), editorContext.get(), layout());
    host.innerHTML = `<div class="card-title"><h3 id="advanced-heading">Advanced tools</h3><button class="icon" data-close-advanced aria-label="Close advanced tools">×</button></div><p class="small">Expert surfaces stay out of the way until you need them. Nothing here is required for a normal mascot.</p><div class="advanced-tools" role="list">${tools.map((tool) => `<article class="preset-card advanced-tool" role="listitem" data-advanced-tool-card="${tool.id}" data-advanced-available="${tool.available}"><div><b>${esc(tool.label)}</b><small>${esc(tool.description)}</small>${tool.reason ? `<small class="${tool.available ? '' : 'preset-missing'}">${esc(tool.reason)}</small>` : ''}</div><button type="button" data-advanced-tool="${tool.id}" ${tool.available ? '' : 'disabled'} aria-label="Open ${esc(tool.label)}">Open</button></article>`).join('')}</div>${renderDetail()}`;
  }
  // The heading exists only while the hub is rendered, so the ARIA reference is set on open and cleared on close.
  function open(toolDetail = null) { detail = toolDetail; render(); host.setAttribute('aria-labelledby', 'advanced-heading'); host.hidden = false; host.querySelector('[data-close-advanced]')?.focus(); }
  function close() { host.hidden = true; host.removeAttribute('aria-labelledby'); }
  return { open, close, render, isOpen: () => !host.hidden, snapshot: () => describeAdvancedTools(doc(), editorContext.get(), layout()).map(({ id, available, reason }) => ({ id, available, reason })) };
}
