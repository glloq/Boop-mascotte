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
 */
import { describeOverflow } from '../core/artwork/artboard.js';

const round = (value) => Math.round(Number(value) || 0);

export function createArtboardPanel(host, { canvas, onStatus = () => {} } = {}) {
  let report = null;

  host.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-artboard-action]')?.dataset.artboardAction;
    if (!action || !report) return;
    if (action === 'fit') {
      canvas.setArtboard(report.fitted);
      onStatus('The working area now holds the whole drawing.');
      render();
    }
  });

  // Enter or a blur commits, like every other numeric field in the editor.
  host.addEventListener('change', (event) => {
    const field = event.target.closest?.('[data-artboard-field]')?.dataset.artboardField;
    if (!field || !report) return;
    const value = Math.max(1, round(event.target.value));
    canvas.setArtboard({ ...report.box, [field]: value });
    render();
  });

  function render() {
    report = canvas.artboardReport?.() || null;
    if (!report) { host.innerHTML = ''; return; }
    const { box, overflow } = report;
    const cut = overflow.any ? describeOverflow(overflow) : '';
    host.innerHTML = `<section class="artboard-panel" data-artboard>
      <div class="section-heading"><h3>Working area</h3><button type="button" class="secondary" data-artboard-action="fit"${cut ? '' : ' disabled'} title="Grow the working area until it holds everything drawn">Fit to artwork</button></div>
      <div class="artboard-size">
        <label>Width<input type="number" min="1" step="1" data-artboard-field="width" aria-label="Working area width" value="${round(box.width)}"></label>
        <label>Height<input type="number" min="1" step="1" data-artboard-field="height" aria-label="Working area height" value="${round(box.height)}"></label>
      </div>
      ${cut
        ? `<p class="artboard-notice" data-artboard-overflow role="status">The drawing reaches ${cut} px outside the working area, and is cut there. <b>Fit to artwork</b> makes room.</p>`
        : '<p class="small" data-artboard-overflow>Everything drawn is inside it. Anything outside would be cut.</p>'}
    </section>`;
  }

  return { render, report: () => report };
}
