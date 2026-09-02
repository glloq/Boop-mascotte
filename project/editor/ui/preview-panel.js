import { deriveMovementChecklist } from '../rig-editor/semantic-parts/face-movements.js';
import { normalizeBehaviors } from '../../runtime/runtime.js';
import { READINESS_SYMBOLS } from '../core/validation/task-readiness.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const behaviorKey = (behavior, index) => behavior?.id || `behavior-${index}`;
const PADS = [['lookX', 'lookY', 'Gaze'], ['headX', 'headY', 'Head']];

/**
 * Preview test bench (right panel in Preview). Everything here is transient:
 * live params, pose/clip playback and behavior overrides live in the
 * PreviewController session; readiness rows only navigate.
 */
export function createPreviewPanel(host, store, preview, { navigate = () => {}, readiness = () => null } = {}) {
  const doc = () => store.getDocument();
  const setOutput = (name, value) => { const output = host.querySelector(`[data-preview-output="${CSS.escape(name)}"]`); if (output) output.value = Number(value).toFixed(2); const input = host.querySelector(`[data-preview-control="${CSS.escape(name)}"]`); if (input && document.activeElement !== input) input.value = String(value); };
  const applyPad = (pad, event) => {
    const [xName, yName] = pad.dataset.previewXy.split(':'), box = pad.getBoundingClientRect(), clamp = (v) => Math.max(-1, Math.min(1, v));
    const x = clamp(((event.clientX - box.left) / box.width) * 2 - 1), y = clamp(((event.clientY - box.top) / box.height) * 2 - 1);
    preview.setLiveParam(xName, x); preview.setLiveParam(yName, y);
    pad.style.setProperty('--x', `${(x + 1) * 50}%`); pad.style.setProperty('--y', `${(y + 1) * 50}%`);
    setOutput(xName, x); setOutput(yName, y);
  };
  let padActive = null;
  host.addEventListener('pointerdown', (event) => { const pad = event.target.closest('[data-preview-xy]'); if (!pad || event.button !== 0) return; event.preventDefault(); pad.setPointerCapture(event.pointerId); padActive = pad; applyPad(pad, event); });
  host.addEventListener('pointermove', (event) => { if (padActive && padActive.hasPointerCapture(event.pointerId)) applyPad(padActive, event); });
  host.addEventListener('pointerup', (event) => { if (!padActive) return; padActive.releasePointerCapture?.(event.pointerId); padActive = null; });
  host.addEventListener('keydown', (event) => {
    const pad = event.target.closest?.('[data-preview-xy]'); if (!pad) return;
    const step = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[event.key]; if (!step) return;
    event.preventDefault();
    const [xName, yName] = pad.dataset.previewXy.split(':'), live = preview.getLiveParams(), clamp = (v) => Math.max(-1, Math.min(1, v));
    preview.setLiveParam(xName, clamp((live[xName] ?? 0) + step[0])); preview.setLiveParam(yName, clamp((live[yName] ?? 0) + step[1]));
    render(); host.querySelector(`[data-preview-xy="${pad.dataset.previewXy}"]`)?.focus();
  });
  host.addEventListener('input', (event) => { const name = event.target.dataset.previewControl; if (!name) return; preview.setLiveParam(name, Number(event.target.value)); setOutput(name, Number(event.target.value)); syncPads(); });
  host.addEventListener('change', (event) => { const key = event.target.dataset.previewBehavior; if (key === undefined) return; preview.setBehaviorOverride(key, event.target.checked); render(); });
  host.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
    const { previewState, previewClip, previewCenter, previewGo } = button.dataset;
    if (previewState) { if (!preview.setState(previewState)) preview.previewState(previewState); render(); return; }
    if (previewClip) { if (preview.isPlaying() && preview.getActiveClipId() === previewClip) preview.stopClip(); else { preview.setClip(previewClip); preview.stopClip(); preview.playClip(); } render(); return; }
    if (previewCenter !== undefined) { preview.clearLiveParams(); render(); return; }
    if (previewGo) { const model = readiness(); const target = model?.[previewGo]; if (target?.route) navigate(target.route); return; }
    if (button.dataset.previewExpression) { const id = button.dataset.previewExpression, weights = preview.getExpressionWeights(); if (weights[id]) preview.clearExpression(id); else preview.setExpression(id, Number(host.querySelector('[data-preview-intensity]')?.value ?? 1)); render(); }
  });
  host.addEventListener('input', (event) => { if (event.target.dataset.previewIntensity === undefined) return; const value = Number(event.target.value); for (const id of Object.keys(preview.getExpressionWeights())) preview.setExpression(id, value); const output = host.querySelector('[data-preview-intensity-output]'); if (output) output.value = `${Math.round(value * 100)}%`; });
  function syncPads() { const live = preview.getLiveParams(); for (const pad of host.querySelectorAll('[data-preview-xy]')) { const [x, y] = pad.dataset.previewXy.split(':'); pad.style.setProperty('--x', `${((live[x] ?? 0) + 1) * 50}%`); pad.style.setProperty('--y', `${((live[y] ?? 0) + 1) * 50}%`); } }

  function render() {
    const state = doc();
    host.dataset.previewPanelReady = 'true';
    if (!state.svgMarkup) { host.innerHTML = '<p class="small">Add artwork to test a mascot here.</p>'; return; }
    const live = preview.getLiveParams(), moves = deriveMovementChecklist(state), enabled = moves.items.filter((item) => item.enabled);
    const pads = PADS.filter(([x, y]) => enabled.some((item) => item.id === x) && enabled.some((item) => item.id === y)).map(([x, y, label]) => `<div class="xy-pad" data-preview-xy="${x}:${y}" role="application" tabindex="0" aria-label="${esc(label)} test pad. Use arrow keys or drag." style="--x:${((live[x] ?? 0) + 1) * 50}%;--y:${((live[y] ?? 0) + 1) * 50}%"><i></i></div>`).join('');
    const sliders = enabled.map((item) => { const param = state.params[item.id], value = live[item.id] ?? param?.default ?? 0; return `<label>${esc(item.group)} · ${esc(item.label)} <output data-preview-output="${item.id}">${Number(value).toFixed(2)}</output><input type="range" data-preview-control="${item.id}" aria-label="${esc(item.group)} ${esc(item.label)}" min="${param?.min ?? -1}" max="${param?.max ?? 1}" step=".01" value="${value}"></label>`; }).join('');
    const weights = preview.getExpressionWeights(), intensity = Object.values(weights)[0] ?? 1;
    const expressions = (state.expressions || []).length ? `<section class="preview-section" data-preview-section="expressions"><h3>Expressions</h3><div class="chip-row">${state.expressions.map((item) => `<button type="button" class="chip${weights[item.id] ? ' chip-active' : ''}" data-preview-expression="${esc(item.id)}" aria-pressed="${Boolean(weights[item.id])}">${esc(item.name)}</button>`).join('')}</div><label>Intensity <output data-preview-intensity-output>${Math.round(intensity * 100)}%</output><input type="range" data-preview-intensity aria-label="Expression intensity" min="0" max="1" step=".05" value="${intensity}"></label></section>` : '';
    const stateNames = Object.keys(state.states || {}), activeState = preview.getSession().previewState || state.activeState;
    const poses = stateNames.length > 1 ? `<section class="preview-section" data-preview-section="poses"><h3>Poses</h3><div class="chip-row">${stateNames.map((name) => `<button type="button" class="chip${name === activeState ? ' chip-active' : ''}" data-preview-state="${esc(name)}" aria-pressed="${name === activeState}">${esc(name)}</button>`).join('')}</div></section>` : '';
    const clips = state.animationClips || [], playing = preview.isPlaying() ? preview.getActiveClipId() : null;
    const animations = clips.length ? `<section class="preview-section" data-preview-section="animations"><h3>Animations</h3><div class="preview-example-list">${clips.map((clip) => `<button type="button" data-preview-clip="${esc(clip.id)}" aria-pressed="${playing === clip.id}" class="${playing === clip.id ? 'chip-active' : ''}">${playing === clip.id ? '■' : '▶'} ${esc(clip.name)}</button>`).join('')}</div></section>` : '';
    const behaviors = normalizeBehaviors(state), overrides = preview.getBehaviorOverrides();
    const automatic = behaviors.length ? `<section class="preview-section" data-preview-section="automatic"><h3>Automatic</h3>${behaviors.map((behavior, index) => { const key = behaviorKey(behavior, index), on = key in overrides ? overrides[key] : behavior.enabled !== false; return `<label class="check"><input type="checkbox" data-preview-behavior="${esc(key)}" ${on ? 'checked' : ''}> ${esc(behavior.name || behavior.type)}${key in overrides ? ' <small>(preview only)</small>' : ''}</label>`; }).join('')}<p class="small">Changes here are preview-only. Edit behaviors in Animate.</p></section>` : '';
    const model = readiness();
    const rows = model ? model.order.map((id) => { const item = model[id]; return `<li data-readiness-section="${id}" data-readiness-status="${item.status}"><span class="readiness-symbol" aria-hidden="true">${READINESS_SYMBOLS[item.status] || '○'}</span><span class="readiness-copy"><b>${esc(item.label)}</b><small>${esc(item.summary)}</small>${item.action ? `<small class="readiness-action">${esc(item.action)}</small>` : ''}</span>${item.route ? `<button type="button" class="secondary" data-preview-go="${id}" aria-label="Go to ${esc(item.label)}">${item.action ? 'Fix' : 'Go'}</button>` : ''}</li>`; }).join('') : '';
    host.innerHTML = `<section class="preview-section" data-preview-section="live"><h3>Live controls</h3>${enabled.length ? `${pads}${sliders}<button type="button" class="secondary" data-preview-center>Center</button>` : '<p class="small">Turn on movements in Face Setup to test them live.</p>'}</section>${expressions}${poses}${animations}${automatic}<section class="preview-section" data-preview-section="readiness"><h3>Ready?</h3><ol class="readiness-rows" aria-label="Project readiness">${rows}</ol></section>`;
  }

  return { render, syncPads };
}
