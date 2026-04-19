import { evaluateBinding } from '../bindings/expression.js';
import { applyCurve } from '../bindings/curve.js';
import { applyMorphToElement } from '../morph/morph-apply.js';
import { clampByConstraints } from '../rig/constraints.js';

const PARAM_RANGE = {
  headX: [-1, 1],
  headY: [-1, 1],
  eyeOpen: [0, 1],
  mouthOpen: [-1, 1]
};

export function createPreviewPlayer(leftSidebarEl, store, canvas) {
  const host = leftSidebarEl.querySelector('#preview-panel');

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
    Object.entries(state.elements).forEach(([id, element]) => {
      applyMorphToElement(element, state.params, canvas, id);
      const rawTx = evaluateBinding(element.bindings?.translateX || '0', state.params);
      const curve = element.bindingCurves?.translateX || 'linear';
      const tx = applyCurve(rawTx, curve);
      const next = clampByConstraints({
        ...element,
        x: tx,
        y: element.y,
        rotation: element.rotation,
        scaleX: element.scaleX,
        scaleY: element.scaleY
      }, element.constraints || { translate: true, rotate: true, scale: true });
      canvas.applyElementTransform(id, next);
    });
  }

  return {
    applyBindings,
    render() {
      const state = store.getState();
      host.innerHTML = `
        <h3>Preview</h3>
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
  };
}
