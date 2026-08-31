import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { compileFrame } from './frame-compiler.js';
import { canTransition, composeBehaviorParams, createBehaviorController, easingValue, normalizeBehaviors, resolveStateParams } from '../../../runtime/runtime.js';

/** Single transient pipeline: state transition -> tracked clip values -> behaviors -> live overrides. */
export function createPreviewController({ store, canvas, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now(), onFrame = () => {} }) {
  let raf=0, running=false, playing=false, previewElapsed=0, clipTime=0, transitionElapsed=0, last=0, clipId=null, live={}, transition=null, effective={};
  const behaviors=createBehaviorController();
  const baseValues=(state)=>resolveStateParams(state.params,state.states?.[state.activeState]);
  function transitionValues(state){
    if(!transition)return baseValues(state);
    const progress=transition.duration ? Math.min(1,transitionElapsed/transition.duration) : 1;
    const eased=easingValue(progress,transition.easing);
    const result=Object.fromEntries(Object.keys(state.params||{}).map((key)=>[key,(transition.from[key]??0)+((transition.to[key]??0)-(transition.from[key]??0))*eased]));
    if(progress>=1)transition=null;
    return result;
  }
  function compute(){
    const state=store.getState(); let result=transitionValues(state);
    const clip=state.animationClips?.find((item)=>item.id===clipId);
    if(clip)result={...result,...evaluateAnimationClip(clip,clipTime,result)};
    const configured=normalizeBehaviors(state);
    result=composeBehaviorParams(result,configured,previewElapsed,behaviors.evaluate(configured,previewElapsed));
    effective={...result,...live};
    canvas.applyFrame(compileFrame(state.elements,effective,state.globalConstraints,state.stateConstraints?.[state.activeState]));
    onFrame({time:clipTime,previewElapsed,transitionElapsed,params:{...effective},playing}); return effective;
  }
  function tick(timestamp){
    if(!running)return; const delta=Math.max(0,timestamp-last)/1000; previewElapsed+=delta;
    if(transition)transitionElapsed+=delta*1000;
    if(playing){clipTime+=delta;const clip=store.getState().animationClips?.find((item)=>item.id===clipId);if(clip&&clipTime>=clip.duration){if(clip.loop&&clip.duration)clipTime%=clip.duration;else{clipTime=clip.duration;playing=false;}}}
    last=timestamp;compute();raf=requestFrame(tick);
  }
  return {
    start(){if(running)return;running=true;last=now();behaviors.reset();raf=requestFrame(tick);},
    stop(){running=playing=false;if(raf)cancelFrame(raf);raf=0;behaviors.reset();transition=null;transitionElapsed=0;compute();},
    setState(name){const state=store.getState(),fromName=state.activeState;if(!state.states?.[name]||!canTransition(state.transitions,fromName,name))return false;
      const from={...transitionValues(state),...live},to=resolveStateParams(state.params,state.states[name]),settings=state.transitionSettings?.[`${fromName}->${name}`]||{};
      const duration=Math.max(0,Number(settings.duration??300)||0);transitionElapsed=0;transition=duration?{from,to,duration,easing:settings.easing||'easeInOut'}:null;
      store.setState((draft)=>{draft.activeState=name;});if(!duration)effective=to;compute();return true;},
    setTransition(value){transition=value;transitionElapsed=0;compute();},
    setClip(id){if(id===clipId)return false;clipId=id;clipTime=0;compute();return true;},getActiveClipId:()=>clipId,
    playClip(){playing=true;this.start();},pauseClip(){playing=false;compute();},stopClip(){playing=false;clipTime=0;compute();},
    seek(value){clipTime=Math.max(0,Number(value)||0);compute();},setLiveParam(name,value){live[name]=Number(value);compute();},
    clearLiveParam(name){delete live[name];compute();},clearLiveParams(){live={};compute();},
    getCurrentTime:()=>clipTime,getPreviewElapsed:()=>previewElapsed,getTransitionElapsed:()=>transitionElapsed,getEffectiveParams:()=>({...effective}),isRunning:()=>running,isPlaying:()=>playing,
    apply:compute,reset(){clipId=null;clipTime=previewElapsed=transitionElapsed=0;live={};transition=null;playing=false;behaviors.reset();compute();},destroy(){this.stop();live={};}
  };
}
