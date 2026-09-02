import { createAutomaticCommands } from '../core/behaviors/automatic-commands.js';
import { deriveAutomaticStatus } from '../core/behaviors/automatic-presets.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const STATUS_TEXT = { on: 'On', off: 'Off', disabled: 'Off · kept, turn on to use again' };

/**
 * Automatic panel: Blink, Natural gaze and Idle head movement as outcomes.
 * Toggles author ordinary behaviors through automatic commands; Test uses the
 * preview's transient behavior test; the advanced Behaviors panel stays the
 * place for every other behavior.
 */
export function createAutomaticPanel(host, store, history, preview, editorContext, { navigate = () => {}, onStatus = () => {}, openAdvanced = () => editorContext.update({ authorMode: 'behaviors' }) } = {}) {
  const commands = createAutomaticCommands(store, history);
  let notice = null;
  const doc = () => store.getDocument();
  const fail = (error) => { notice = { tone: 'warn', text: error.message }; render(); };

  host.addEventListener('change', (event) => {
    const id = event.target.dataset.automaticToggle; if (!id) return;
    try {
      const status = deriveAutomaticStatus(doc()).presets.find((item) => item.id === id);
      if (event.target.checked) { commands.enable(id); notice = { tone: 'success', text: `✓ ${status?.title} is on. It runs in Preview and in the exported mascot.` }; onStatus(`${status?.title} turned on.`); }
      else { commands.disable(id); notice = null; onStatus(`${status?.title} turned off.`); }
    } catch (error) { fail(error); }
  });
  host.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
    const data = button.dataset;
    if (data.automaticTest) { const status = deriveAutomaticStatus(doc()).presets.find((item) => item.id === data.automaticTest); if (status?.testId && preview.testBehavior(status.testId)) onStatus(`Testing ${status.title}…`); return; }
    if (data.automaticFixMovements !== undefined) { navigate({ task: 'face-setup' }); return; }
    if (data.automaticAdvanced !== undefined) openAdvanced();
  });

  function render() {
    const state = doc();
    host.dataset.automaticReady = 'true';
    if (!state.svgMarkup) { host.innerHTML = ''; host.dataset.automaticOn = '0'; return; }
    const model = deriveAutomaticStatus(state);
    host.dataset.automaticOn = String(model.on);
    const cards = model.presets.map((item) => `<article class="preset-card automatic-card" data-automatic-card="${item.id}" data-automatic-status="${item.status}"><div><b>${esc(item.title)}</b><small>${esc(item.description)}</small><small class="${item.status === 'unavailable' ? 'preset-missing' : ''}">${item.status === 'unavailable' ? `Needs ${item.missing.map((entry) => esc(entry.label)).join(', ')}` : STATUS_TEXT[item.status]}</small></div><div class="automatic-actions">${item.status === 'unavailable' ? '<button type="button" class="secondary" data-automatic-fix-movements>Face Setup</button>' : `<label class="check automatic-switch"><input type="checkbox" data-automatic-toggle="${item.id}" aria-label="Turn on ${esc(item.title)}" ${item.status === 'on' ? 'checked' : ''}></label>${item.status === 'on' ? `<button type="button" class="secondary" data-automatic-test="${item.id}" aria-label="Test ${esc(item.title)}">Test</button>` : ''}`}</div></article>`).join('');
    host.innerHTML = `<h3 class="automatic-heading">Automatic</h3><p class="small">Always-on life. It runs in Preview and in the exported mascot; Preview can mute it.</p><div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}"><span>${esc(notice.text)}</span></p>` : ''}</div><div class="preset-cards">${cards}</div>${model.other.length ? `<p class="small" data-automatic-other>${model.other.length} advanced behavior${model.other.length === 1 ? '' : 's'} (${model.other.map((item) => esc(item.name)).join(', ')}) · <button type="button" class="link" data-automatic-advanced>Behaviors (advanced)</button></p>` : ''}`;
  }
  return { render, snapshot: () => deriveAutomaticStatus(doc()) };
}
