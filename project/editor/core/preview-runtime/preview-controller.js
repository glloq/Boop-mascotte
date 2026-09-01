import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { compileFrame } from './frame-compiler.js';
import { canTransition, composeBehaviorParams, createBehaviorController, easingValue, normalizeBehaviors, resolveStateParams } from '../../../runtime/runtime.js';

/** Single transient pipeline: state transition -> tracked clip values -> behaviors -> live overrides. */
export function createPreviewController({ store, canvas, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now(), onFrame = () => {} }) {
  let raf=0, running=false, playing=false, previewElapsed=0, clipTime=0, transitionElapsed=0, last=0, clipId=null, live={}, transition=null, effective={}, authorState=null, testBehavior=null;
  const behaviors=createBehaviorController();
  const baseValues=(state)=>resolveStateParams(state.params,state.states?.[authorState&&state.states?.[authorState]?authorState:state.activeState]);
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
    let configured=normalizeBehaviors(state);
    if(testBehavior){const elapsed=previewElapsed-testBehavior.started;if(elapsed>=testBehavior.window)testBehavior=null;
      else {configured=configured.map(item=>({...item,enabled:item.id===testBehavior.id}));
        if(testBehavior.type==='blink')result[testBehavior.parameter]=elapsed<testBehavior.duration?testBehavior.closedValue:result[testBehavior.parameter];
        if(testBehavior.type==='randomIdle')result[testBehavior.parameter]=(result[testBehavior.parameter]??0)+testBehavior.sample;
      }
    }
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
    previewState(name){const state=store.getState();if(!state.states?.[name])return false;authorState=name;transition=null;compute();return true;},
    testTransition({from,to,duration,easing}={}){const state=store.getState();if(!state.states?.[from]||!state.states?.[to])return false;authorState=from;transitionElapsed=0;transition={from:resolveStateParams(state.params,state.states[from]),to:resolveStateParams(state.params,state.states[to]),duration:Math.max(1,Number(duration)||300),easing:easing||'easeInOut'};this.start();compute();return true;},
    testBehavior(id,{random=Math.random}={}){const state=store.getState(),behavior=normalizeBehaviors(state).find(item=>item.id===id);if(!behavior)return false;const window=behavior.type==='oscillator'?Math.max(1,2/Math.max(.1,behavior.frequency)):behavior.type==='blink'?behavior.duration*2:.6;testBehavior={...behavior,started:previewElapsed,window,sample:behavior.min+random()*(behavior.max-behavior.min)};this.start();compute();return true;},
    setTransition(value){transition=value;transitionElapsed=0;compute();},
    setClip(id){if(id===clipId)return false;clipId=id;clipTime=0;compute();return true;},getActiveClipId:()=>clipId,
    playClip(){playing=true;this.start();},pauseClip(){playing=false;compute();},stopClip(){playing=false;clipTime=0;compute();},
    seek(value){clipTime=Math.max(0,Number(value)||0);compute();},setLiveParam(name,value){live[name]=Number(value);compute();},
    clearLiveParam(name){delete live[name];compute();},clearLiveParams(){live={};compute();},
    getCurrentTime:()=>clipTime,getPreviewElapsed:()=>previewElapsed,getTransitionElapsed:()=>transitionElapsed,getEffectiveParams:()=>({...effective}),isRunning:()=>running,isPlaying:()=>playing,
    apply:compute,reset(){clipId=null;clipTime=previewElapsed=transitionElapsed=0;live={};transition=null;authorState=null;testBehavior=null;playing=false;behaviors.reset();compute();},destroy(){this.stop();live={};}
  };
}
