import { compileFrame } from './frame-compiler.js';
import { canTransition } from '../state/transition-guard.js';
import { interpolateParams } from './interpolate-params.js';

const PARAM_RANGE = {
  headX: [-1, 1],
  headY: [-1, 1],
  eyeOpen: [0, 1],
  mouthOpen: [-1, 1]
};

export function createPreviewPlayer(leftSidebarEl, store, canvas) {
  const host = leftSidebarEl.querySelector('#preview-panel');
  let transitionStatus = '';
  let scrubFromState = 'idle';
  let scrubToState = 'happy';
  let scrubProgress = 0;
  let scrubDurationMs = 900;
  let scrubEasing = 'easeInOut';
  let scrubTimer = null;

  host.addEventListener('click', (event) => {
    if (event.target.id === 'preview-reset') {
      store.setState((state) => {
        state.params = { ...(state.states[state.activeState] || {}) };
      });
      applyBindings();
    }

    if (event.target.id === 'preview-random') {
      store.setState((state) => {
        Object.entries(PARAM_RANGE).forEach(([key, [min, max]]) => {
          state.params[key] = min + Math.random() * (max - min);
        });
      });
      applyBindings();
    }

    if (event.target.id === 'preview-play-transition') {
      playTransition();
      return;
    }

    const nextState = event.target.dataset.previewState;
    if (nextState) {
      const current = store.getState().activeState;
      if (!canTransition(store.getState().transitions, current, nextState)) {
        transitionStatus = `Transition blocked: ${current} → ${nextState}`;
      } else {
        store.setState((state) => {
          state.activeState = nextState;
          state.params = { ...state.states[nextState] };
        });
        transitionStatus = `Transition OK: ${current} → ${nextState}`;
      }
      render();
    }
  });

  host.addEventListener('input', (event) => {
    if (event.target.dataset.param) {
      const key = event.target.dataset.param;
      store.setState((state) => {
        state.params[key] = Number(event.target.value);
      });
      applyBindings();
      return;
    }

    if (event.target.id === 'preview-scrub-from') scrubFromState = event.target.value;
    if (event.target.id === 'preview-scrub-to') scrubToState = event.target.value;
    if (event.target.id === 'preview-scrub-duration') scrubDurationMs = Math.max(100, Number(event.target.value) || 900);
    if (event.target.id === 'preview-scrub-easing') scrubEasing = event.target.value;
    if (event.target.id === 'preview-scrub-progress') {
      scrubProgress = Math.max(0, Math.min(1, Number(event.target.value) || 0));
      applyScrubTransition();
    }
    render();
  });

  function applyBindings() {
    const state = store.getState();
    const frame = compileFrame(state.elements, state.params, state.globalConstraints, state.stateConstraints?.[state.activeState]);
    canvas.applyFrame(frame);
  }

  function applyScrubTransition() {
    const state = store.getState();
    const from = state.states[scrubFromState] || {};
    const to = state.states[scrubToState] || {};
    store.setState((draft) => {
      draft.params = interpolateParams(from, to, scrubProgress, scrubEasing);
    });
    applyBindings();
  }

  function playTransition() {
    if (scrubTimer) cancelAnimationFrame(scrubTimer);
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      scrubProgress = Math.min(1, elapsed / scrubDurationMs);
      applyScrubTransition();
      render();
      if (scrubProgress < 1) scrubTimer = requestAnimationFrame(step);
      else scrubTimer = null;
    };
    scrubTimer = requestAnimationFrame(step);
  }

  function render() {
    const state = store.getState();
    const stateOptions = Object.keys(state.states).map((name) => `<option value="${name}" ${name === scrubFromState ? 'selected' : ''}>${name}</option>`).join('');
    const toOptions = Object.keys(state.states).map((name) => `<option value="${name}" ${name === scrubToState ? 'selected' : ''}>${name}</option>`).join('');

    host.innerHTML = `
      <h3>Preview</h3>
      <div class="chip-row">
        ${Object.keys(state.states).map((name) => `<button class="chip ${name === state.activeState ? 'chip-active' : ''}" data-preview-state="${name}">${name}</button>`).join('')}
      </div>
      <div class="small">${transitionStatus || 'Click a state chip to simulate transition rules.'}</div>
      <div class="chip-row">
        <button id="preview-reset" class="chip">Reset to state</button>
        <button id="preview-random" class="chip">Randomize params</button>
      </div>

      <h4>WYSIWYG transition lab</h4>
      <label>From</label>
      <select id="preview-scrub-from">${stateOptions}</select>
      <label>To</label>
      <select id="preview-scrub-to">${toOptions}</select>
      <label>Duration (ms)</label>
      <input id="preview-scrub-duration" type="number" min="100" step="50" value="${scrubDurationMs}" />
      <label>Easing</label>
      <select id="preview-scrub-easing">
        <option value="linear" ${scrubEasing === 'linear' ? 'selected' : ''}>linear</option>
        <option value="easeInOut" ${scrubEasing === 'easeInOut' ? 'selected' : ''}>easeInOut</option>
      </select>
      <label>Progress: ${scrubProgress.toFixed(2)}</label>
      <input id="preview-scrub-progress" type="range" min="0" max="1" step="0.01" value="${scrubProgress}" />
      <button id="preview-play-transition" class="chip">Play transition</button>

      ${Object.entries(PARAM_RANGE).map(([name, [min, max]]) => `
        <div class="param-row">
          <label>${name}: ${Number(state.params[name] || 0).toFixed(2)}</label>
          <input type="range" min="${min}" max="${max}" step="0.01" value="${state.params[name] || 0}" data-param="${name}" />
        </div>
      `).join('')}
    `;
    applyBindings();
  }

  return { applyBindings, render };

}
