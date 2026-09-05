/**
 * Publishing, where the author is already standing (VNX-10, docs/VNEXT_ROADMAP.md).
 *
 * Export and Problems are buttons in the app bar. They are always there, which
 * means they are never *about* anything: an author testing the mascot in
 * Preview has to leave what they are doing, hunt a toolbar, and find out only
 * then that something blocks the export.
 *
 * The Publish stage is where someone decides the mascot is finished, so the
 * readiness of the whole project belongs there, next to the thing being tested:
 * what is done, what blocks, and one button that ships it.
 *
 * Thin DOM layer behind the component lifecycle (docs/VNEXT_COMPONENTS.md).
 * Every number here comes from the same memoised readiness model the badges and
 * the Export panel already share — this is a second view of it, never a second
 * computation.
 */
import { createComponent } from './component.js';

// Accessible names here are deliberately not the visible words. The app bar
// already owns a button named exactly "Export", and a second one broke every
// test — and every screen-reader user — that asked for "the Export button".
// A control that repeats a name another control already owns is ambiguous to
// anyone who cannot see which column it is in. "Open the export panel" is also
// the truth: this button opens Export, the panel writes the files.

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const GLYPH = { ready: '✓', warning: '⚠', error: '●', todo: '○', optional: '·' };

const kb = (bytes) => `${Math.round(bytes / 102.4) / 10} kB`;

export function createPublishPanel(host, {
  readiness = () => null, issues = () => [], onGo = () => {}, onFix = () => {}, onExport = () => {},
  // Weighing the export serializes the SVG and builds the rig. That is far too
  // much to spend on every validation pass for a number nobody asked for, so it
  // happens on request and is remembered until the project actually moves.
  weigh = null, revision = () => 0
} = {}) {
  let view = { sections: [], blocking: [] };
  let weight = null;

  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'click', (event) => {
        const button = event.target.closest?.('button[data-publish]');
        if (!button) return;
        const { publish: action, publishId: id } = button.dataset;
        if (action === 'export') { onExport(); return; }
        if (action === 'fix') { onFix(view.blocking.find((issue) => issue.id === id)); return; }
        if (action === 'go') { onGo(view.sections.find((section) => section.id === id)); return; }
        if (action === 'weigh') { weight = { revision: revision(), files: weigh().map((file) => ({ name: file.name, bytes: (file.contents ?? file.text ?? '').length })) }; render(); }
      });
    },
    render: (model) => {
      if (!model.hasProject) { host.innerHTML = ''; return; }
      host.dataset.publishBlocking = String(model.blockingCount);
      host.innerHTML = `<section class="publish-panel" data-publish-panel>
        <div class="card-title"><h2>Publish</h2><button type="button" data-publish="export" aria-label="Open the export panel"${model.blockingCount ? ' class="secondary"' : ''}>Export files…</button></div>
        <p class="small" data-publish-verdict>${model.blockingCount
          ? `${model.blockingCount} problem${model.blockingCount === 1 ? ' still blocks' : 's still block'} the export.`
          : model.warningCount
            ? `Ready. ${model.warningCount} warning${model.warningCount === 1 ? '' : 's'} — the export works, the mascot may not do everything you meant.`
            : 'Ready. Everything the runtime needs is in the project.'}</p>
        ${model.blocking ? `<ul class="publish-blockers">${model.blocking}</ul>` : ''}
        <ol class="publish-checklist" data-publish-checklist>${model.checklist}</ol>
        ${model.weight
          ? `<p class="small" data-publish-weight>${model.weight}</p>`
          : `<p class="small">${weigh ? '<button type="button" class="secondary" data-publish="weigh" aria-label="Measure the exported files">How big is it?</button>' : ''}</p>`}
      </section>`;
    }
  });

  /** Flat, because that is what the component compares. */
  function model() {
    const report = readiness();
    if (!report) return { hasProject: false, blockingCount: 0, warningCount: 0, blocking: '', checklist: '' };
    const list = issues();
    view = {
      sections: report.order.map((id) => report[id]).filter(Boolean),
      blocking: list.filter((issue) => issue.severity === 'error')
    };
    return {
      hasProject: true,
      blockingCount: view.blocking.length,
      warningCount: list.filter((issue) => issue.severity === 'warning').length,
      blocking: view.blocking.map((issue) => `<li data-publish-blocker="${esc(issue.id)}"><span>${esc(issue.message)}</span>${issue.fix ? `<button type="button" class="secondary" data-publish="fix" data-publish-id="${esc(issue.id)}">Fix</button>` : ''}</li>`).join(''),
      // Stale the moment the project moves: a weight from three edits ago is
      // worse than no weight, because it looks current.
      weight: weight && weight.revision === revision()
        ? `${weight.files.map((file) => `${file.name} ${kb(file.bytes)}`).join(' · ')} — uncompressed; a server sends far less.`
        : '',
      checklist: view.sections.map((section) => `<li data-publish-step="${esc(section.id)}" data-publish-status="${esc(section.status)}"><button type="button" data-publish="go" data-publish-id="${esc(section.id)}" aria-label="Go to ${esc(section.label)} — ${esc(section.summary)}"><span aria-hidden="true">${GLYPH[section.status] || '·'}</span> <b>${esc(section.label)}</b> <small>${esc(section.summary)}</small></button></li>`).join('')
    };
  }

  function render() {
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return { render, destroy: () => component.destroy(), counters: () => component.counters(), isVisible: () => component.isVisible() };
}
