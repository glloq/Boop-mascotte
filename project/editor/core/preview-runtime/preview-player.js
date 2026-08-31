import { compileFrame } from './frame-compiler.js';
import { canTransition } from '../state/transition-guard.js';
import { interpolateParams } from './interpolate-params.js';
import { composeBehaviorParams, normalizeBehaviors } from '../../../runtime/runtime.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createPreviewPlayer(leftSidebarEl, store, canvas) {
  const host = leftSidebarEl.querySelector('#preview-panel');
  let transitionStatus = '';
  let scrubFromState = 'idle';
  let scrubToState = 'happy';
  let scrubProgress = 0;
  let scrubDurationMs = 900;
  let scrubEasing = 'easeInOut';
  let scrubTimer = null;
  let previewRaf = 0, previewStarted = 0;

  host.addEventListener('click', (event) => {
    if (event.target.id === 'preview-reset') {
      store.setState((state) => {
        Object.entries(state.params).forEach(([key, param]) => { param.value = state.states[state.activeState]?.[key] ?? param.default; });
      });
      applyBindings();
    }

    if (event.target.id === 'preview-random') {
      store.setState((state) => {
        Object.entries(state.params).forEach(([, param]) => {
          param.value = param.min + Math.random() * (param.max - param.min);
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
          Object.entries(state.params).forEach(([key, param]) => { param.value = state.states[nextState]?.[key] ?? param.default; });
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
        state.params[key].value = Number(event.target.value);
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

  function previewTick(now) {
    const state = store.getState(), behaviors = normalizeBehaviors(state);
    const base = Object.fromEntries(Object.entries(state.params).map(([key, param]) => [key, param.value]));
    const elapsed = (now - previewStarted) / 1000;
    const effective = composeBehaviorParams(base, behaviors, elapsed, { blinkActive: behaviors.some((b) => b.enabled && b.type === 'blink' && elapsed % Math.max(b.intervalMin, .2) < b.duration) });
    canvas.applyFrame(compileFrame(state.elements, effective, state.globalConstraints, state.stateConstraints?.[state.activeState]));
    previewRaf = requestAnimationFrame(previewTick);
  }

  function start() { if (!previewRaf) { previewStarted = performance.now(); previewRaf = requestAnimationFrame(previewTick); } }
  function stop() { if (previewRaf) cancelAnimationFrame(previewRaf); previewRaf = 0; applyBindings(); }

  function applyScrubTransition() {
    const state = store.getState();
    const from = state.states[scrubFromState] || {};
    const to = state.states[scrubToState] || {};
    store.setState((draft) => {
      const values = interpolateParams(from, to, scrubProgress, scrubEasing);
      Object.entries(draft.params).forEach(([key, param]) => { param.value = values[key] ?? param.default; });
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
    const stateOptions = Object.keys(state.states).map((name) => `<option value="${escapeHtml(name)}" ${name === scrubFromState ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
    const toOptions = Object.keys(state.states).map((name) => `<option value="${escapeHtml(name)}" ${name === scrubToState ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');

    host.innerHTML = `
      <h3>Preview</h3>
      <div class="chip-row">
        ${Object.keys(state.states).map((name) => `<button class="chip ${name === state.activeState ? 'chip-active' : ''}" data-preview-state="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('')}
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

      ${Object.entries(state.params).map(([name, param]) => `
        <div class="param-row">
          <label>${escapeHtml(name)}: ${Number(param.value).toFixed(2)}</label>
          <input type="range" min="${param.min}" max="${param.max}" step="0.01" value="${param.value}" data-param="${escapeHtml(name)}" />
        </div>
      `).join('')}
    `;
    applyBindings();
  }

  return { applyBindings, render, start, stop, isRunning: () => Boolean(previewRaf) };

}
