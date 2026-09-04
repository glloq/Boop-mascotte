/**
 * Guide bar (docs/GUIDED_JOURNEY.md).
 *
 * One line under the tabs that always answers "what do I do next?", with a
 * button that goes there. Expanding it shows the whole journey, so a user can
 * see what is done, what is left, and jump to any of it.
 *
 * It owns no project data: it renders a `deriveGuide` model and navigates.
 *
 * Behind the component lifecycle since VNX-03 step 2 (docs/VNEXT_COMPONENTS.md).
 * It is redrawn after every validation pass, and the journey rarely moves; the
 * one thing to be careful with is that the expanded list is state this panel
 * owns rather than state the guide supplies, so it has to be in the model —
 * see `model()` below.
 */
import { createComponent } from './component.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// The separator the step signature joins on. A NUL cannot occur in a step id
// or in the label and hint text the guide writes, so the joined string stays
// one-to-one with the steps it came from.
const SEP = '\u0000';

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

  // The guide as it was when the model was last derived. The steps are objects,
  // and the component compares models with `shallowEqual`, so a rebuilt array
  // could never be equal to the last one: the list stays here and its signature
  // goes in the model. `render()` refreshes both in the same breath.
  let view = { steps: [], next: null, done: 0, total: 0, complete: false, blocker: null };

  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'click', (event) => {
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
    },
    render: (model) => {
      host.dataset.guideDone = String(model.done);
      host.dataset.guideTotal = String(model.total);
      host.dataset.guideComplete = String(model.complete);
      host.dataset.guideExpanded = String(model.expanded && !model.dismissed);
      host.hidden = false;

      if (model.dismissed) {
        // Never gone for good: a small handle brings the journey back.
        host.innerHTML = `<button type="button" class="guide-restore" data-guide-action="restore"
        aria-label="Show the guided steps, ${model.done} of ${model.total} done">Steps ${model.done}/${model.total}</button>`;
        return;
      }

      const percent = Math.round((model.done / model.total) * 100);
      host.innerHTML = `
      <div class="guide-line">
        <span class="guide-progress" role="img" aria-label="${model.done} of ${model.total} steps done">
          <span class="guide-progress-fill" style="width:${percent}%"></span>
        </span>
        <span class="guide-count">${model.done}/${model.total}</span>
        ${model.hasNext
          ? `<span class="guide-text"><b>${esc(model.nextLabel)}</b> <span class="guide-hint">${esc(model.nextHint)}</span></span>
             <button type="button" class="guide-go" data-guide-action="go" data-guide-step="${esc(model.nextId)}">${model.blocker ? 'Fix it' : 'Take me there'}</button>`
          : '<span class="guide-text"><b>Every step is done.</b> <span class="guide-hint">Export when you are ready.</span></span>'}
        <button type="button" class="guide-toggle" data-guide-action="toggle" aria-expanded="${model.expanded}"
          aria-label="${model.expanded ? 'Hide all steps' : 'Show all steps'}">${model.expanded ? '▴' : '▾'}</button>
        <button type="button" class="guide-dismiss" data-guide-action="dismiss" aria-label="Hide the guide">×</button>
      </div>
      ${model.expanded ? `<ol class="guide-steps">${view.steps.map((step) => `
        <li data-guide-item="${esc(step.id)}" data-guide-state="${step.done ? 'done' : step.current ? 'current' : 'todo'}">
          <button type="button" data-guide-action="go" data-guide-step="${esc(step.id)}">
            <span class="guide-mark" aria-hidden="true">${step.done ? '✓' : step.current ? '→' : '○'}</span>
            <span class="guide-step-label">${esc(step.label)}${step.required ? '' : ' <em>optional</em>'}</span>
            <span class="guide-step-hint">${esc(step.hint)}</span>
          </button>
        </li>`).join('')}</ol>` : ''}`;
    }
  });

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * `expanded` and `dismissed` are in it for the same reason the guide is. They
   * are not project data, but they are the two things this markup swings on:
   * left out, opening the list would derive an identical model and be skipped,
   * and the next unrelated validation pass would redraw the bar collapsed,
   * closing a list the user opened. Internal state that must survive a
   * re-render is part of the model.
   */
  const model = () => ({
    expanded,
    dismissed: isDismissed(),
    done: view.done,                        // also the progress bar's width and its label
    total: view.total,
    complete: view.complete,                // written to the host as data-guide-complete
    blocker: Boolean(view.blocker),         // "Fix it" rather than "Take me there"
    hasNext: Boolean(view.next),            // no next step at all is its own line
    nextId: view.next?.id || '',
    nextLabel: view.next?.label || '',
    nextHint: view.next?.hint || '',
    // Six fields per step, always in that order, which is every value a <li>
    // reads: the id it navigates by, the two texts, and the three flags that
    // pick its mark, its state and its "optional". Fixed arity is what keeps
    // one flat join unambiguous. The signature is derived even while the list
    // is collapsed, so a step that moves under a closed list is still a change
    // waiting on screen when it opens. A step's `route` is absent on purpose:
    // the click handler reads it from a fresh `guide()`, never from the markup.
    steps: (view.steps || []).flatMap((step) => [step.id, step.label, step.hint, step.done, step.current, step.required]).join(SEP)
  });

  function render() {
    view = guide();
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return {
    render,
    get expanded() { return expanded; },
    expand() { expanded = true; return render(); },
    destroy: () => component.destroy(),
    counters: () => component.counters()
  };
}
