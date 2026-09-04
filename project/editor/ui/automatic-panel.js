import { createAutomaticCommands } from '../core/behaviors/automatic-commands.js';
import { deriveAutomaticStatus } from '../core/behaviors/automatic-presets.js';
import { createComponent } from './component.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const STATUS_TEXT = { on: 'On', off: 'Off', disabled: 'Off · kept, turn on to use again' };

// The separator the signatures below join on. A NUL cannot occur in a preset
// id, a title, a movement label or a behavior name, so a joined string stays
// one-to-one with the list it came from and two lists cannot collide into one
// model.
const SEP = '\u0000';

/**
 * Automatic panel: Blink, Natural gaze and Idle head movement as outcomes.
 * Toggles author ordinary behaviors through automatic commands; Test uses the
 * preview's transient behavior test; the advanced Behaviors panel stays the
 * place for every other behavior.
 *
 * Behind the component lifecycle since VNX-03 step 2 (docs/VNEXT_COMPONENTS.md):
 * every `rig` and `stateMachine` notification reaches this panel, and almost
 * none of them changes a preset's status, so the panel hands a flat model to
 * the component and lets it decide.
 */
export function createAutomaticPanel(host, store, history, preview, editorContext, { navigate = () => {}, onStatus = () => {}, openAdvanced = () => editorContext.update({ authorMode: 'behaviors' }) } = {}) {
  const commands = createAutomaticCommands(store, history);
  let notice = null;
  const doc = () => store.getDocument();
  const fail = (error) => { notice = { tone: 'warn', text: error.message }; render(); };

  // The two lists the markup walks, kept beside the model rather than inside
  // it: the component compares models with `shallowEqual`, and a rebuilt array
  // is never equal to the last one. `render()` recomputes this and the model
  // together, so the signatures below always describe this exact status.
  let view = { ready: false, on: 0, presets: [], other: [] };

  const component = createComponent({
    host,
    onMount: ({ listen }) => {
      listen(host, 'change', (event) => {
        const id = event.target.dataset.automaticToggle; if (!id) return;
        try {
          const status = deriveAutomaticStatus(doc()).presets.find((item) => item.id === id);
          if (event.target.checked) { commands.enable(id); notice = { tone: 'success', text: `✓ ${status?.title} is on. It runs in Preview and in the exported mascot.` }; onStatus(`${status?.title} turned on.`); }
          else { commands.disable(id); notice = null; onStatus(`${status?.title} turned off.`); }
        } catch (error) { fail(error); }
      });
      listen(host, 'click', (event) => {
        const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
        const data = button.dataset;
        if (data.automaticTest) { const status = deriveAutomaticStatus(doc()).presets.find((item) => item.id === data.automaticTest); if (status?.testId && preview.testBehavior(status.testId)) onStatus(`Testing ${status.title}…`); return; }
        if (data.automaticFixMovements !== undefined) { navigate({ task: 'face-setup', focus: 'face-movements' }); return; }
        if (data.automaticAdvanced !== undefined) openAdvanced();
      });
    },
    render: (model) => {
      host.dataset.automaticReady = 'true';
      if (!model.ready) { host.innerHTML = ''; host.dataset.automaticOn = '0'; return; }
      host.dataset.automaticOn = String(model.on);
      const cards = view.presets.map((item) => `<article class="preset-card automatic-card" data-automatic-card="${item.id}" data-automatic-status="${item.status}"><div><b>${esc(item.title)}</b><small>${esc(item.description)}</small><small class="${item.status === 'unavailable' ? 'preset-missing' : ''}">${item.status === 'unavailable' ? `Needs ${item.missing.map((entry) => esc(entry.label)).join(', ')}` : STATUS_TEXT[item.status]}</small></div><div class="automatic-actions">${item.status === 'unavailable' ? '<button type="button" class="secondary" data-automatic-fix-movements>Face Setup</button>' : `<label class="check automatic-switch"><input type="checkbox" data-automatic-toggle="${item.id}" aria-label="Turn on ${esc(item.title)}" ${item.status === 'on' ? 'checked' : ''}></label>${item.status === 'on' ? `<button type="button" class="secondary" data-automatic-test="${item.id}" aria-label="Test ${esc(item.title)}">Test</button>` : ''}`}</div></article>`).join('');
      host.innerHTML = `<h3 class="automatic-heading">Automatic</h3><p class="small">Always-on life. It runs in Preview and in the exported mascot; Preview can mute it.</p><div role="status" aria-live="polite">${model.notice ? `<p class="face-pick-notice" data-tone="${model.tone}"><span>${esc(model.notice)}</span></p>` : ''}</div><div class="preset-cards">${cards}</div>${view.other.length ? `<p class="small" data-automatic-other>${view.other.length} advanced behavior${view.other.length === 1 ? '' : 's'} (${view.other.map((item) => esc(item.name)).join(', ')}) · <button type="button" class="link" data-automatic-advanced>Behaviors (advanced)</button></p>` : ''}`;
    }
  });

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * `testId` and `behaviorIds` are the two derived fields deliberately left
   * out. Neither reaches the markup — the Test button carries the preset id and
   * the click handler derives the status again — so a behavior renamed under a
   * preset that is already on is not a redraw.
   */
  const model = () => ({
    ready: view.ready,                      // no artwork: the panel is empty, and says so through data-automatic-on
    on: view.on,                            // written to the host as data-automatic-on
    tone: notice ? notice.tone : '',
    notice: notice ? notice.text : '',
    otherCount: view.other.length,          // the "N advanced behaviors" line, plural included
    // Five fields per preset, always in that order, which is every value a card
    // reads: the id and the two texts, the status that picks the toggle, the
    // Test button or the Face Setup button, and the movements a blocked preset
    // is waiting for. Fixed arity keeps one flat join unambiguous.
    presets: view.presets.flatMap((item) => [item.id, item.title, item.description, item.status, item.missing.map((entry) => entry.label).join(', ')]).join(SEP),
    other: view.other.map((item) => item.name).join(SEP)
  });

  function render() {
    const state = doc();
    // Derived only when there is artwork, exactly as before: an empty project
    // renders an empty panel without asking what its behaviors are doing.
    const status = state.svgMarkup ? deriveAutomaticStatus(state) : { presets: [], other: [], on: 0 };
    view = { ready: Boolean(state.svgMarkup), ...status };
    const next = model();
    return component.isMounted() ? component.update(next) : component.mount(next);
  }

  return { render, snapshot: () => deriveAutomaticStatus(doc()), destroy: () => component.destroy(), counters: () => component.counters() };
}
