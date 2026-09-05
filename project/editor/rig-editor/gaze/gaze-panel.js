/**
 * The gaze solver, as a panel (docs/FACE_CONTROL_RIG.md).
 *
 * Two decisions live here and nothing else: whether the character *looks at
 * things* rather than having its eyes and head posed separately, and how the
 * work is divided when it does.
 *
 * The panel is deliberately small. Everything it configures has a default that
 * works, the solver contributes nothing until it is switched on, and the place
 * an author actually uses it is the gaze target on the mascot — not here.
 */
import { gazeSolverModel } from '../../core/rig/gaze-rig.js';
import { createGazeRigCommands } from './gaze-commands.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const round = (value) => Math.round(Number(value) * 100) / 100;

export function createGazePanel(host, store, history, { onStatus = () => {} } = {}) {
  const commands = createGazeRigCommands(store, history);
  const doc = () => store.getDocument();

  host.addEventListener('change', (event) => {
    if (event.target.dataset.gazeToggle !== undefined) {
      const on = Boolean(event.target.checked);
      commands.toggle(on);
      onStatus(on
        ? 'Gaze on. Drag the target between the eyes: the eyes go first and the head follows.'
        : 'Gaze off. The eyes and the head are posed on their own again.');
      render();
      return;
    }
    const field = event.target.dataset.gazeField;
    if (!field) return;
    commands.configure({ [field]: Number(event.target.value) });
    render();
  });

  host.addEventListener('input', (event) => {
    const field = event.target.dataset.gazeField;
    if (!field) return;
    // Dragging redraws its own readout and nothing else: rebuilding the panel
    // under the pointer would take the slider away mid-gesture.
    const output = event.target.parentElement?.querySelector?.('output');
    if (output) output.textContent = String(round(event.target.value));
  });

  function field(item) {
    return `<label class="gaze-field">${esc(item.label)}
      <input type="range" data-gaze-field="${esc(item.id)}" min="${item.min}" max="${item.max}" step="${item.step}" value="${item.value}" aria-label="${esc(item.label)}">
      <output>${round(item.value)}${item.unit ? esc(item.unit) : ''}</output>
      ${item.hint ? `<small class="small">${esc(item.hint)}</small>` : ''}
    </label>`;
  }

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const model = gazeSolverModel(state);
    host.hidden = false;
    host.dataset.gazeEnabled = String(model.enabled);
    host.innerHTML = `<div class="gaze-panel" data-gaze-panel>
      <p class="small">A gaze is one decision, not two: the character wants to look somewhere, the eyes go first because they are light, and the head follows because the eyes run out of socket.</p>
      <label class="check"><input type="checkbox" data-gaze-toggle ${model.enabled ? 'checked' : ''} aria-label="Look at a target">
        <span>Look at a target</span></label>
      ${model.missing.length ? `<p class="notice" data-tone="warn">The solver has nowhere to send ${esc(model.missing.join(' and '))}: turn those movements on first.</p>` : ''}
      ${model.enabled
        ? `<p class="small">The target lives between the eyes on the mascot. <b>Look left / right</b> and <b>Move left / right</b> stay yours — the solver adds to them, it never overwrites them.</p>
           <div class="gaze-fields">${model.fields.map(field).join('')}</div>`
        : '<p class="small">Off: the eyes and the head are posed on their own, exactly as they always were.</p>'}
    </div>`;
  }

  return { render };
}
