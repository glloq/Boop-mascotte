/**
 * The working area, as a thing you can see and change (docs/VECTOR_EDITING.md).
 *
 * "Il y a des soucis avec la plage de travail: si j'utilise des cheveux plus
 * haut ils sont coupés sans raison apparente." There were two invisible edges
 * doing the cutting — the artboard itself (a nested `<svg>` clips to its own
 * `viewBox`) and any `clip-path` on the artwork. The canvas draws both now;
 * this is where the artboard is resized, and where the editor says out loud
 * that something is being cut.
 *
 * Thin DOM layer: the model is `core/artwork/artboard.js`, the measuring is the
 * canvas's, and every change goes through the artwork command.
 *
 * First adopter of the component lifecycle (VNX-03, docs/VNEXT_ROADMAP.md).
 * The working area is redrawn on every `layers` notification and almost never
 * actually changes, so it is the cheapest place to show what the contract buys:
 * the panel derives a flat model, and the component decides whether that model
 * is worth any DOM at all.
 */
import { describeOverflow } from '../core/artwork/artboard.js';
import { createComponent } from './component.js';

const round = (value) => Math.round(Number(value) || 0);

export function createArtboardPanel(host, { canvas, onStatus = () => {} } = {}) {
  let report = null;

  const commit = (box, message) => { canvas.setArtboard(box); if (message) onStatus(message); render(); };

  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'click', (event) => {
        const action = event.target.closest?.('[data-artboard-action]')?.dataset.artboardAction;
        if (action === 'fit' && report) commit(report.fitted, 'The working area now holds the whole drawing.');
      });
      // Enter or a blur commits, like every other numeric field in the editor.
      listen(host, 'change', (event) => {
        const field = event.target.closest?.('[data-artboard-field]')?.dataset.artboardField;
        if (!field || !report) return;
        commit({ ...report.box, [field]: Math.max(1, round(event.target.value)) });
      });
    },
    render: (model) => {
      if (!model.measured) { host.innerHTML = ''; return; }
      host.innerHTML = `<section class="artboard-panel" data-artboard>
      <div class="section-heading"><h3>Working area</h3><button type="button" class="secondary" data-artboard-action="fit"${model.cut ? '' : ' disabled'} title="Grow the working area until it holds everything drawn">Fit to artwork</button></div>
      <div class="artboard-size">
        <label>Width<input type="number" min="1" step="1" data-artboard-field="width" aria-label="Working area width" value="${model.width}"></label>
        <label>Height<input type="number" min="1" step="1" data-artboard-field="height" aria-label="Working area height" value="${model.height}"></label>
      </div>
      ${model.cut
        ? `<p class="artboard-notice" data-artboard-overflow role="status">The drawing reaches ${model.cut} px outside the working area, and is cut there. <b>Fit to artwork</b> makes room.</p>`
        : '<p class="small" data-artboard-overflow>Everything drawn is inside it. Anything outside would be cut.</p>'}
    </section>`;
    }
  });

  /** Flat on purpose: this is what the component compares to decide to redraw. */
  const model = () => (report
    ? { measured: true, width: round(report.box.width), height: round(report.box.height), cut: report.overflow.any ? describeOverflow(report.overflow) : '' }
    : { measured: false, width: 0, height: 0, cut: '' });

  function render() {
    report = canvas.artboardReport?.() || null;
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return { render, report: () => report, destroy: () => component.destroy(), counters: () => component.counters() };
}
