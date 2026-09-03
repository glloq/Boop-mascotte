/**
 * Guide bar (docs/GUIDED_JOURNEY.md).
 *
 * One line under the tabs that always answers "what do I do next?", with a
 * button that goes there. Expanding it shows the whole journey, so a user can
 * see what is done, what is left, and jump to any of it.
 *
 * It owns no project data: it renders a `deriveGuide` model and navigates.
 */
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * @param {Element} host
 * @param {object} options
 * @param {() => object} options.guide      the `deriveGuide` model
 * @param {(route: object) => void} options.navigate
 * @param {() => boolean} options.isDismissed
 * @param {(dismissed: boolean) => void} options.setDismissed
 */
export function createGuideBar(host, { guide, navigate, isDismissed = () => false, setDismissed = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: #guide-bar');
  let expanded = false;

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { guideAction, guideStep } = button.dataset;
    if (guideAction === 'go') {
      const step = guide().steps.find((item) => item.id === guideStep) || guide().next;
      // Collapse on the way out: the list covered the panel it just opened.
      if (expanded) { expanded = false; render(); }
      if (step?.route) navigate(step.route);
      return;
    }
    if (guideAction === 'toggle') { expanded = !expanded; render(); return; }
    if (guideAction === 'dismiss') { setDismissed(true); render(); return; }
    if (guideAction === 'restore') { setDismissed(false); expanded = true; render(); }
  });

  function render() {
    const model = guide();
    const dismissed = isDismissed();
    host.dataset.guideDone = String(model.done);
    host.dataset.guideTotal = String(model.total);
    host.dataset.guideComplete = String(model.complete);
    host.dataset.guideExpanded = String(expanded && !dismissed);
    host.hidden = false;

    if (dismissed) {
      // Never gone for good: a small handle brings the journey back.
      host.innerHTML = `<button type="button" class="guide-restore" data-guide-action="restore"
        aria-label="Show the guided steps, ${model.done} of ${model.total} done">Steps ${model.done}/${model.total}</button>`;
      return;
    }

    const next = model.next;
    const percent = Math.round((model.done / model.total) * 100);
    host.innerHTML = `
      <div class="guide-line">
        <span class="guide-progress" role="img" aria-label="${model.done} of ${model.total} steps done">
          <span class="guide-progress-fill" style="width:${percent}%"></span>
        </span>
        <span class="guide-count">${model.done}/${model.total}</span>
        ${next
          ? `<span class="guide-text"><b>${esc(next.label)}</b> <span class="guide-hint">${esc(next.hint || '')}</span></span>
             <button type="button" class="guide-go" data-guide-action="go" data-guide-step="${esc(next.id)}">${model.blocker ? 'Fix it' : 'Take me there'}</button>`
          : '<span class="guide-text"><b>Every step is done.</b> <span class="guide-hint">Export when you are ready.</span></span>'}
        <button type="button" class="guide-toggle" data-guide-action="toggle" aria-expanded="${expanded}"
          aria-label="${expanded ? 'Hide all steps' : 'Show all steps'}">${expanded ? '▴' : '▾'}</button>
        <button type="button" class="guide-dismiss" data-guide-action="dismiss" aria-label="Hide the guide">×</button>
      </div>
      ${expanded ? `<ol class="guide-steps">${model.steps.map((step) => `
        <li data-guide-item="${esc(step.id)}" data-guide-state="${step.done ? 'done' : step.current ? 'current' : 'todo'}">
          <button type="button" data-guide-action="go" data-guide-step="${esc(step.id)}">
            <span class="guide-mark" aria-hidden="true">${step.done ? '✓' : step.current ? '→' : '○'}</span>
            <span class="guide-step-label">${esc(step.label)}${step.required ? '' : ' <em>optional</em>'}</span>
            <span class="guide-step-hint">${esc(step.hint)}</span>
          </button>
        </li>`).join('')}</ol>` : ''}`;
  }

  return { render, get expanded() { return expanded; }, expand() { expanded = true; render(); } };
}
