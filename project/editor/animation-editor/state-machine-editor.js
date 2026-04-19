const PARAM_KEYS = ['headX', 'headY', 'eyeOpen', 'mouthOpen'];

export function createStateMachineEditor(leftSidebarEl, store, history) {
  const host = leftSidebarEl.querySelector('#state-editor');

  host.addEventListener('input', (event) => {
    if (event.target.id === 'active-state') {
      const nextState = event.target.value;
      history.snapshot();
      store.setState((state) => {
        state.activeState = nextState;
        state.params = { ...state.states[nextState] };
      });
      return;
    }

    if (event.target.id === 'runtime-idle-motion') {
      history.snapshot();
      store.setState((state) => {
        state.runtimeConfig.idleMotion = Number(event.target.value);
      });
      return;
    }

    if (event.target.id === 'runtime-blink') {
      history.snapshot();
      store.setState((state) => {
        state.runtimeConfig.blink = event.target.checked;
      });
      return;
    }

    const key = event.target.dataset.stateParam;
    if (!key) return;
    const value = Number(event.target.value);
    history.snapshot();
    store.setState((state) => {
      state.states[state.activeState][key] = value;
      state.params[key] = value;
    });
  });

  return {
    render() {
      const state = store.getState();
      const active = state.states[state.activeState] || {};
      host.innerHTML = `
        <h3>States</h3>
        <label>Active State</label>
        <select id="active-state">
          ${Object.keys(state.states).map((name) => `<option value="${name}" ${name === state.activeState ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
        ${PARAM_KEYS.map((key) => `
          <label>${key} (${state.activeState})</label>
          <input type="number" step="0.1" data-state-param="${key}" value="${active[key] ?? 0}" />
        `).join('')}
        <h4>Runtime behavior</h4>
        <label><input id="runtime-blink" type="checkbox" ${state.runtimeConfig?.blink ? 'checked' : ''}/> Auto blink</label>
        <label>Idle Motion</label>
        <input id="runtime-idle-motion" type="number" step="0.01" min="0" max="1" value="${state.runtimeConfig?.idleMotion ?? 0.15}" />
      `;
    }
  };
}
