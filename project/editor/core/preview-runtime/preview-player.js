import { compileFrame } from './frame-compiler.js';
import { canTransition } from '../state/transition-guard.js';

const PARAM_RANGE = {
  headX: [-1, 1],
  headY: [-1, 1],
  eyeOpen: [0, 1],
  mouthOpen: [-1, 1]
};

export function createPreviewPlayer(leftSidebarEl, store, canvas) {
  const host = leftSidebarEl.querySelector('#preview-panel');
  let transitionStatus = '';

  host.addEventListener('click', (event) => {
    if (event.target.id === 'preview-reset') {
      store.setState((state) => {
        state.params = { ...state.states[state.activeState] };
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
    if (!event.target.dataset.param) return;
    const key = event.target.dataset.param;
    store.setState((state) => {
      state.params[key] = Number(event.target.value);
    });
    applyBindings();
  });

  function applyBindings() {
    const state = store.getState();
    const frame = compileFrame(state.elements, state.params);
    canvas.applyFrame(frame);
  }

  function render() {
    const state = store.getState();
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
