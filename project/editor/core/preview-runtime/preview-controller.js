import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { compileFrame } from './frame-compiler.js';
import { interpolateParams } from './interpolate-params.js';
import { composeBehaviorParams, createBehaviorController, normalizeBehaviors } from '../../../runtime/runtime.js';

/** The editor's single transient playback pipeline: state -> transition -> clip -> behavior -> live. */
export function createPreviewController({ store, canvas, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now(), onFrame = () => {} }) {
  let raf = 0, running = false, playing = false, time = 0, last = 0, clipId = null, live = {}, transition = null, effective = {};
  const behaviors = createBehaviorController();
  const values = (state) => Object.fromEntries(Object.entries(state.params || {}).map(([name, param]) => [name, state.states?.[state.activeState]?.[name] ?? param.value ?? param.default]));
  function compute(at = time) {
    const state = store.getState(); let result = values(state);
    if (transition) result = { ...result, ...interpolateParams(state.states[transition.from] || {}, state.states[transition.to] || {}, transition.progress, transition.easing) };
    const clip = state.animationClips?.find((item) => item.id === clipId);
    if (clip) result = { ...result, ...evaluateAnimationClip(clip, at, result) };
    const configured = normalizeBehaviors(state);
    result = composeBehaviorParams(result, configured, at, behaviors.evaluate(configured, at));
    effective = { ...result, ...live };
    canvas.applyFrame(compileFrame(state.elements, effective, state.globalConstraints, state.stateConstraints?.[state.activeState]));
    onFrame({ time, params: { ...effective }, playing });
    return effective;
  }
  function tick(timestamp) {
    if (!running) return;
    if (playing) {
      time += Math.max(0, timestamp - last) / 1000;
      const clip = store.getState().animationClips?.find((item) => item.id === clipId);
      if (clip && time >= clip.duration) { if (clip.loop) time %= clip.duration; else { time = clip.duration; playing = false; } }
    }
    last = timestamp; compute(); raf = requestFrame(tick);
  }
  return {
    start() { if (running) return; running = true; last = now(); behaviors.reset(); raf = requestFrame(tick); },
    stop() { running = playing = false; if (raf) cancelFrame(raf); raf = 0; behaviors.reset(); compute(); },
    setState(name) { if (store.getState().states?.[name]) store.setState((state) => { state.activeState = name; }); compute(); },
    setTransition(value) { transition = value; compute(); },
    setClip(id) { clipId = id; time = 0; compute(); },
    playClip() { playing = true; this.start(); }, pauseClip() { playing = false; },
    stopClip() { playing = false; time = 0; compute(); },
    seek(value) { time = Math.max(0, Number(value) || 0); compute(); },
    setLiveParam(name, value) { live[name] = Number(value); compute(); },
    clearLiveParam(name) { delete live[name]; compute(); }, clearLiveParams() { live = {}; compute(); },
    getCurrentTime: () => time, getEffectiveParams: () => ({ ...effective }), isRunning: () => running,
    apply: compute, reset() { clipId = null; time = 0; live = {}; transition = null; playing = false; behaviors.reset(); compute(); },
    destroy() { this.stop(); live = {}; }
  };
}
