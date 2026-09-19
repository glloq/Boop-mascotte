/**
 * The Behavior column: what this workspace *has*, listed (docs/BEHAVIOR_STUDIO.md).
 *
 * This panel used to be the whole screen — the list, the pose sliders, the
 * diagram, the transition list, the transition inspector, the problems and the
 * parameters, stacked in a 300 px column behind a disclosure marked *advanced*
 * — and it rebuilt every one of them, diagram included, inside an `input`
 * handler.
 *
 * It is a **library** now. The board draws the machine, the tuning rail edits
 * whatever is picked on it, and what is left here is the one thing a diagram is
 * bad at: an alphabet of everything that exists, with the presses that make
 * more of it. Picking anything in it picks it on the board, so there is one
 * selection and one editor for it.
 */
import { renderBehaviorsPanel } from '../behaviors/behaviors-panel.js';
import { createBehaviorCommands } from '../behaviors/behavior-commands.js';
import { renderStateList } from './state-list.js';
import { stateProblems, transitionImpact } from './state-operations.js';
import { createStateMachineCommands } from './state-machine-commands.js';
import { renderTransitionList } from './transition-graph.js';
import { boardSelectionPatch } from '../../ui/selection-context.js';
import { setPanelHtml } from '../../ui/panel-render.js';
import { esc } from '../../ui/escape-html.js';

/**
 * The one sentence each list opens with. `behaviors` says its own, in
 * `behaviors-panel.js`, because that panel is rendered whole.
 */
const STATES_INTRO = '<b>STATE</b> is a persistent pose. <b>TRANSITION</b> is an allowed directed movement. Pick one here or on the board; the Inspector tunes it.';

export function createStateMachinePanel(leftSidebarEl, store, history, preview = null, editorContext = null, onStatus = () => {}, options = {}) {
  const host = leftSidebarEl.querySelector('#state-editor');
  const { onSelect = () => {}, onLens = () => {} } = options;
  const stateCommands = createStateMachineCommands(store, history);
  const behaviorCommands = createBehaviorCommands(store, history);
  let catalog = false, error = '';

  const doc = () => store.getDocument();
  const session = () => editorContext?.get() || {};
  const selectedState = () => { const state = doc(); const name = session().activeStateId; return state.states?.[name] ? name : state.activeState || Object.keys(state.states || {})[0] || null; };
  const selectedEdge = () => session().activeTransitionKeys?.[0] || null;
  const selectedBehavior = () => session().activeBehaviorId || null;

  const command = (fn) => { try { const result = fn(); error = ''; return result; } catch (failure) { error = failure.message; render(); return undefined; } };

  const dialog = (title, body, confirm, action) => {
    let box = host.querySelector('dialog');
    if (!box) { box = globalThis.document.createElement('dialog'); host.append(box); }
    box.innerHTML = `<form method="dialog"><h2>${title}</h2>${body}<div class="dialog-actions"><button value="cancel">Cancel</button><button value="confirm" class="primary">${confirm}</button></div></form>`;
    box.addEventListener('close', () => { if (box.returnValue === 'confirm') action(box); }, { once: true });
    box.showModal();
  };

  /**
   * One pick, written once. The column writes the session and then tells the
   * studio to follow: the board, the table and the tuning rail all read the
   * same three keys, so a second writer here is a selection model disagreeing
   * with itself.
   */
  const pick = (picked) => { editorContext?.update(boardSelectionPatch(picked)); onSelect(picked); render(); };
  const pickState = (name) => { pick({ state: name }); preview?.previewState(name); };
  const pickEdge = (key) => pick({ transitions: [key] });
  const pickBehavior = (id) => pick({ behavior: id });

  host.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action],[data-author-mode],[data-select-state],[data-select-transition],[data-select-behavior],[data-add-behavior]');
    if (!target) return;
    const data = target.dataset;
    if (data.authorMode) { editorContext?.update({ authorMode: data.authorMode }); onLens(data.authorMode === 'behaviors' ? 'automatic' : 'states'); render(); return; }
    if (data.selectState) { pickState(data.selectState); return; }
    if (data.selectTransition) { pickEdge(data.selectTransition); return; }
    if (data.selectBehavior) { catalog = false; pickBehavior(data.selectBehavior); return; }
    if (data.addBehavior) {
      const added = command(() => behaviorCommands.add(data.addBehavior));
      catalog = false;
      if (added) pickBehavior(added.id); else render();
      return;
    }
    const state = doc(), name = selectedState();
    if (data.action === 'new-state') {
      dialog('New State',
        `<label>Name<input name="name" required value="NewState"></label><label>Start from<select name="source"><option value="current">Current pose (recommended)</option><option value="defaults">Default pose</option>${Object.keys(state.states).map((item) => `<option value="${esc(item)}">Existing · ${esc(item)}</option>`).join('')}</select></label><p class="field-error"></p>`,
        'Create', (box) => {
          const next = box.querySelector('[name=name]').value.trim();
          if (command(() => stateCommands.create(next, box.querySelector('[name=source]').value)) !== undefined) pickState(next);
        });
    }
    if (data.action === 'delete-state') {
      const impact = transitionImpact(state, name);
      dialog(`Delete “${esc(name)}”?`, `<p>${impact.outgoing} outgoing transitions<br>${impact.incoming} incoming transitions</p><p>These links will also be removed.</p>`, 'Delete', () => {
        if (command(() => stateCommands.delete(name)) !== undefined) pickState(Object.keys(doc().states)[0] || null);
      });
    }
    if (data.action === 'add-transition') {
      dialog('Add Transition', `<p>From <b>${esc(name)}</b></p><label>To<select name="to">${Object.keys(state.states).filter((item) => item !== name).map((item) => `<option>${esc(item)}</option>`).join('')}</select></label>`, 'Add', (box) => {
        const to = box.querySelector('select').value;
        if (command(() => stateCommands.addTransition(name, to)) !== undefined) pickEdge(`${name}->${to}`);
      });
    }
    if (data.action === 'show-behavior-catalog') { catalog = true; render(); }
  });

  host.addEventListener('change', (event) => {
    const data = event.target.dataset;
    if (data.behaviorEnabled) {
      const index = (doc().behaviors || []).findIndex((item) => item.id === data.behaviorEnabled);
      command(() => behaviorCommands.setEnabled(index, event.target.checked));
      render();
      return;
    }
    if (data.initialState !== undefined) { command(() => stateCommands.setInitial(event.target.value)); render(); }
  });

  /**
   * A mode set by a deep link (Problems, the Advanced hub, "Behaviors
   * (advanced)") unfolds the column's disclosure, so the route never ends on a
   * panel that is out of sight.
   */
  let lastMode = session().authorMode || 'states';
  const unfold = () => { const details = host.closest('details'); if (details && !details.open) details.open = true; };

  function render() {
    const state = doc(), mode = session().authorMode === 'behaviors' ? 'behaviors' : 'states';
    if (mode !== lastMode) { lastMode = mode; unfold(); }
    const nav = `<nav class="author-nav" aria-label="What this column lists"><b>LISTS</b>
      <button data-author-mode="states" class="${mode === 'states' ? 'active' : ''}" aria-pressed="${mode === 'states'}">States</button>
      <button data-author-mode="behaviors" class="${mode === 'behaviors' ? 'active' : ''}" aria-pressed="${mode === 'behaviors'}">By itself</button></nav>`;
    let body;
    if (mode === 'behaviors') {
      body = renderBehaviorsPanel(state, selectedBehavior(), catalog);
    } else {
      const name = selectedState(), problems = stateProblems(state);
      body = `<div class="author-intro">${STATES_INTRO}</div>
        ${renderStateList(state, name)}
        <label>Initial State<select data-initial-state>${Object.keys(state.states || {}).map((item) => `<option ${item === state.activeState ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label>
        ${renderTransitionList(state, name, selectedEdge())}
        ${problems.length ? `<div class="notice error">${problems.map(esc).join('<br>')}</div>` : ''}
        <details class="advanced-parameters" data-keep-open="parameters"><summary>Advanced · Parameters</summary>${Object.entries(state.params || {}).map(([item, param]) => `<article><b>${esc(item)}</b><small>Range ${param.min} → ${param.max} · Default ${param.default}</small></article>`).join('')}</details>`;
    }
    setPanelHtml(host, `${nav}${error ? `<div class="notice error">${esc(error)}</div>` : ''}<div class="author-surface">${body}</div>`);
  }

  return {
    render,
    reset() { catalog = false; error = ''; render(); }
  };
}
