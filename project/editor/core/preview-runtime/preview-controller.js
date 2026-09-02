import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { compileFrame } from './frame-compiler.js';
import { canTransition, composeBehaviorParams, composeExpressionParams, createBehaviorController, createReactionController, easingValue, normalizeBehaviors, normalizeExpressions, normalizeReactions, resolveStateParams } from '../../../runtime/runtime.js';
import { lifecycleDiagnostics as diagnostics } from '../diagnostics/lifecycle-diagnostics.js';
import { createPreviewSession } from '../state/preview-session.js';

/**
 * Single owner for transient preview playback and clocks.
 * Lifecycle: static setters render once; play/transition/behavior work wakes one
 * generation-guarded RAF; pause/stop/destroy cancel it. No method persists a playhead.
 */
export function createPreviewController({ store, canvas, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now(), onFrame = () => {}, onError = () => {} }) {
  let raf=0, running=false, destroyed=false, playing=false, generation=0, previewElapsed=0, clipTime=0, transitionElapsed=0, last=0, clipId=null, live={}, transition=null, effective={}, authorState=null, testBehavior=null, lastError=null, behaviorOverrides={}, expressionWeights={};
  const session=createPreviewSession();
  const syncSession=()=>Object.assign(session,{running,playing,activeClipId:clipId,clipTime,previewElapsed,transitionElapsed,liveParams:live,effectiveParams:effective,transition,previewState:authorState,testBehavior,lastError,behaviorOverrides:{...behaviorOverrides},expressionWeights:{...expressionWeights},activeReaction:reactionController.getActive()});
  const behaviors=createBehaviorController();
  const reactionController=createReactionController(()=>({reactions:normalizeReactions(store.getDocument()),clips:store.getDocument().animationClips||[]}));
  const baseValues=(state)=>resolveStateParams(state.params,state.states?.[authorState&&state.states?.[authorState]?authorState:state.activeState]);
  // Preview-only enable/disable per behavior (keyed like the Preview panel: id or behavior-<index>).
  const configuredBehaviors=(state)=>{const list=normalizeBehaviors(state);return Object.keys(behaviorOverrides).length?list.map((item,index)=>{const key=item.id||`behavior-${index}`;return key in behaviorOverrides?{...item,enabled:behaviorOverrides[key]}:item;}):list;};
  const continuous=(state=store.getDocument())=>Boolean(playing||transition||testBehavior||reactionController.getActive()||configuredBehaviors(state).some(item=>item.enabled&&['oscillator','blink','randomIdle'].includes(item.type)));
  function transitionValues(state){
    if(!transition)return baseValues(state);
    const progress=transition.duration ? Math.min(1,transitionElapsed/transition.duration) : 1;
    const eased=easingValue(progress,transition.easing);
    const result=Object.fromEntries(Object.keys(state.params||{}).map((key)=>[key,(transition.from[key]??0)+((transition.to[key]??0)-(transition.from[key]??0))*eased]));
    if(progress>=1)transition=null;
    return result;
  }
  function compute(){
    const began=diagnostics.enabled?performance.now():0;
    try {
      const state=store.getDocument(); let result=transitionValues(state);
      const clip=state.animationClips?.find((item)=>item.id===clipId);
      if(clip)result={...result,...evaluateAnimationClip(clip,clipTime,result)};
      // Expressions compose on the base/clip pose exactly like the exported runtime (shared helper).
      // Reactions sequence an expression and a motion over the preview clock (shared runtime sequencer).
      const reaction=reactionController.evaluate(previewElapsed,result);result={...result,...reaction.params};
      const weights={...expressionWeights};for(const [id,weight] of Object.entries(reaction.expressions))weights[id]=Math.max(weights[id]||0,weight);
      if(Object.keys(weights).length)result=composeExpressionParams(result,normalizeExpressions(state),weights,state.params);
      let configured=configuredBehaviors(state);
      if(testBehavior){const elapsed=previewElapsed-testBehavior.started;if(elapsed>=testBehavior.window)testBehavior=null;
        else {configured=configured.map(item=>({...item,enabled:item.id===testBehavior.id}));
          if(testBehavior.type==='blink')result[testBehavior.parameter]=elapsed<testBehavior.duration?testBehavior.closedValue:result[testBehavior.parameter];
          if(testBehavior.type==='randomIdle')result[testBehavior.parameter]=(result[testBehavior.parameter]??0)+testBehavior.sample;
        }
      }
      result=composeBehaviorParams(result,configured,previewElapsed,behaviors.evaluate(configured,previewElapsed));
      effective={...result,...live}; diagnostics.increment('preview.computes');
      const applyStart=diagnostics.enabled?performance.now():0;
      canvas.applyFrame(compileFrame(state.elements,effective,state.globalConstraints,state.stateConstraints?.[state.activeState]));
      diagnostics.increment('preview.applies'); if(diagnostics.enabled)diagnostics.increment('preview.applyMs',performance.now()-applyStart);
      syncSession();onFrame({time:clipTime,previewElapsed,transitionElapsed,params:{...effective},playing});
      lastError=null; diagnostics.set('preview.lastError',null); return effective;
    } catch(error) {
      lastError=error instanceof Error?error:new Error(String(error)); playing=false; transition=null; testBehavior=null;
      diagnostics.set('preview.playing',false);diagnostics.set('preview.lastError',lastError.message);onError(lastError);sleep();return effective;
    } finally { if(diagnostics.enabled)diagnostics.increment('preview.computeMs',performance.now()-began); }
  }
  function schedule(token){if(!running||destroyed||raf||token!==generation)return;diagnostics.increment('preview.rafRequests');raf=requestFrame(timestamp=>tick(timestamp,token));diagnostics.set('preview.activeRaf',1);}
  function sleep(){if(raf){cancelFrame(raf);diagnostics.increment('preview.rafCancellations');}raf=0;running=false;generation++;diagnostics.set('preview.activeRaf',0);}
  function wake(){if(destroyed)return; if(!running){running=true;last=now();generation++;diagnostics.increment('preview.starts');}schedule(generation);}
  function tick(timestamp,token){
    if(token!==generation||!running||destroyed)return;raf=0;diagnostics.set('preview.activeRaf',0);diagnostics.increment('preview.frames');
    const delta=Math.max(0,timestamp-last)/1000;previewElapsed+=delta;
    if(transition)transitionElapsed+=delta*1000;
    if(playing){clipTime+=delta;const clip=store.getDocument().animationClips?.find(item=>item.id===clipId);const duration=Number(clip?.duration);if(clip&&Number.isFinite(duration)&&duration>0&&clipTime>=duration){if(clip.loop)clipTime%=duration;else{clipTime=duration;playing=false;diagnostics.set('preview.playing',false);}}}
    last=timestamp;compute();if(continuous())schedule(token);else{running=false;generation++;diagnostics.increment('preview.stops');}
  }
  const api={
    start(){if(destroyed||running)return false;wake();return true;},
    stop(){const changed=running||playing||raf||transition||testBehavior;playing=false;transition=null;testBehavior=null;transitionElapsed=0;sleep();behaviors.reset();diagnostics.set('preview.playing',false);if(changed)diagnostics.increment('preview.stops');compute();return changed;},
    setState(name){const state=store.getDocument(),fromName=authorState||state.activeState;if(!state.states?.[name]||!canTransition(state.transitions,fromName,name))return false;const from={...transitionValues(state),...live},to=resolveStateParams(state.params,state.states[name]),settings=state.transitionSettings?.[`${fromName}->${name}`]||{};const duration=Math.max(0,Number(settings.duration??300)||0);transitionElapsed=0;transition=duration?{from,to,duration,easing:settings.easing||'easeInOut'}:null;authorState=name;if(!duration)effective=to;compute();if(transition)wake();return true;},
    previewState(name){const state=store.getDocument();if(!state.states?.[name])return false;authorState=name;transition=null;compute();return true;},
    testTransition({from,to,duration,easing}={}){const state=store.getDocument();if(!state.states?.[from]||!state.states?.[to])return false;authorState=from;transitionElapsed=0;transition={from:resolveStateParams(state.params,state.states[from]),to:resolveStateParams(state.params,state.states[to]),duration:Math.max(1,Number(duration)||300),easing:easing||'easeInOut'};compute();wake();return true;},
    testBehavior(id,{random=Math.random}={}){const behavior=normalizeBehaviors(store.getDocument()).find(item=>item.id===id);if(!behavior)return false;const window=behavior.type==='oscillator'?Math.max(1,2/Math.max(.1,behavior.frequency)):behavior.type==='blink'?behavior.duration*2:.6;testBehavior={...behavior,started:previewElapsed,window,sample:behavior.min+random()*(behavior.max-behavior.min)};compute();wake();return true;},
    setTransition(value){transition=value;transitionElapsed=0;compute();if(value)wake();},
    setBehaviorOverride(key,enabled){behaviorOverrides[key]=Boolean(enabled);compute();if(continuous())wake();else sleep();},
    setExpression(id,weight=1){const value=Math.max(0,Math.min(1,Number(weight)));if(value>0)expressionWeights[id]=value;else delete expressionWeights[id];compute();},
    clearExpression(id){delete expressionWeights[id];compute();},clearExpressions(){if(!Object.keys(expressionWeights).length)return;expressionWeights={};compute();},getExpressionWeights:()=>({...expressionWeights}),
    clearBehaviorOverrides(){behaviorOverrides={};compute();if(continuous())wake();},
    getBehaviorOverrides:()=>({...behaviorOverrides}),
    fireReaction(id){const fired=reactionController.fire(id,previewElapsed);if(fired){wake();compute();}return fired;},triggerReaction(event){const id=reactionController.trigger(event,previewElapsed);if(id){wake();compute();}return id;},getActiveReaction:()=>reactionController.getActive(),getStayedExpressions:()=>reactionController.getStayed(),clearReactions(){reactionController.reset();compute();if(!continuous())sleep();},
    setClip(id){if(id===clipId)return false;clipId=id;clipTime=0;compute();return true;},getActiveClipId:()=>clipId,
    playClip(){if(playing)return false;playing=true;diagnostics.set('preview.playing',true);wake();return true;},pauseClip(){if(!playing)return false;playing=false;diagnostics.set('preview.playing',false);compute();if(!continuous())sleep();return true;},stopClip(){const changed=playing||clipTime!==0;playing=false;clipTime=0;diagnostics.set('preview.playing',false);compute();if(!continuous())sleep();return changed;},
    seek(value){clipTime=Math.max(0,Number(value)||0);compute();},setLiveParam(name,value){const n=Number(value);live[name]=Number.isFinite(n)?n:0;compute();},clearLiveParam(name){delete live[name];compute();},clearLiveParams(){live={};compute();},
    getCurrentTime:()=>clipTime,getPreviewElapsed:()=>previewElapsed,getTransitionElapsed:()=>transitionElapsed,getLiveParams:()=>({...live}),getEffectiveParams:()=>({...effective}),getSession:()=>{syncSession();return session;},isRunning:()=>running,isPlaying:()=>playing,getLastError:()=>lastError,
    apply:compute,reset(){playing=false;diagnostics.set('preview.playing',false);sleep();clipId=null;clipTime=previewElapsed=transitionElapsed=0;live={};transition=null;authorState=null;testBehavior=null;behaviorOverrides={};expressionWeights={};reactionController.reset();behaviors.reset();compute();},destroy(){if(destroyed)return;api.stop();destroyed=true;live={};}
  };return api;
}
