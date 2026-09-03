import { evaluateAnimationClip } from '../../animation-editor/timeline/clip-evaluator.js';
import { compileFrame } from './frame-compiler.js';
import { canTransition, composeBehaviorParams, composeExpressionParams, createBehaviorController, createMotionLayer, createReactionController, createWeightBlender, easingValue, mixParameters, normalizeBehaviors, normalizeExpressions, normalizeReactions, resolveStateParams } from '../../../runtime/runtime.js';
import { lifecycleDiagnostics as diagnostics } from '../diagnostics/lifecycle-diagnostics.js';
import { createPreviewSession } from '../state/preview-session.js';

/**
 * Single owner for transient preview playback and clocks.
 * Lifecycle: static setters render once; play/transition/behavior work wakes one
 * generation-guarded RAF; pause/stop/destroy cancel it. No method persists a playhead.
 */
export function createPreviewController({ store, canvas, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now(), onFrame = () => {}, onError = () => {} }) {
  let raf=0, running=false, destroyed=false, playing=false, generation=0, previewElapsed=0, clipTime=0, transitionElapsed=0, last=0, clipId=null, live={}, transition=null, effective={}, authorState=null, testBehavior=null, lastError=null, behaviorOverrides={};
  // Whether the selected clip poses the mascot while it is not playing.
  // The Timeline needs it (scrubbing is how you author a key); Preview must not
  // have it, because the exported runtime applies a clip only while it plays.
  let clipPosed=false;
  // Two transports, one for each job. The Timeline scrubs one clip at weight 1
  // with no blending, because that is how a key is authored. Preview and the
  // Motion Inspector play motions through the shared motion layer, which is the
  // same code the exported runtime runs (docs/ADR_MOTION_LAYERING.md). Each one
  // switches the other off, so a clip is never applied twice.
  const motionLayer=createMotionLayer({blend:()=>store.getDocument().motionBlend,clips:()=>store.getDocument().animationClips||[]});
  const scrubbing=()=>playing||clipPosed;
  const anyPlaying=()=>playing||motionLayer.playing().length>0;
  const syncPlaying=()=>diagnostics.set('preview.playing',anyPlaying());
  // Expression weights ramp instead of jumping, from whatever is showing
  // (docs/CONTINUOUS_TRANSITIONS.md). The default span is 0, so a rig that does
  // not configure one previews exactly as before.
  const expressionWeights=createWeightBlender();
  const blendOptions=(options={})=>{const configured=store.getDocument().expressionBlend;return {duration:options.duration??configured?.duration??0,easing:options.easing||configured?.easing||'easeInOut'};};
  const session=createPreviewSession();
  const syncSession=()=>Object.assign(session,{running,playing,activeClipId:clipId,clipPosed,clipTime,previewElapsed,transitionElapsed,liveParams:live,effectiveParams:effective,transition,previewState:authorState,testBehavior,lastError,behaviorOverrides:{...behaviorOverrides},expressionWeights:expressionWeights.values(),activeReaction:reactionController.getActive(),eventLog:eventLog.map(entry=>({...entry}))});
  const behaviors=createBehaviorController();
  const reactionController=createReactionController(()=>({reactions:normalizeReactions(store.getDocument()),clips:store.getDocument().animationClips||[]}));
  // Session-only event log for the Preview simulator (newest first, bounded).
  let eventLog=[];const EVENT_LOG_LIMIT=40;const logEvent=(entry)=>{eventLog=[{at:Number(previewElapsed.toFixed(2)),...entry},...eventLog].slice(0,EVENT_LOG_LIMIT);};
  const hasTimerReaction=(state)=>(state.reactions||[]).some(item=>item.enabled!==false&&item.trigger?.type==='timer');
  const baseValues=(state)=>resolveStateParams(state.params,state.states?.[authorState&&state.states?.[authorState]?authorState:state.activeState]);
  // Preview-only enable/disable per behavior (keyed like the Preview panel: id or behavior-<index>).
  const configuredBehaviors=(state)=>{const list=normalizeBehaviors(state);return Object.keys(behaviorOverrides).length?list.map((item,index)=>{const key=item.id||`behavior-${index}`;return key in behaviorOverrides?{...item,enabled:behaviorOverrides[key]}:item;}):list;};
  const continuous=(state=store.getDocument())=>Boolean(playing||motionLayer.playing().length||!motionLayer.settled()||transition||testBehavior||!expressionWeights.settled()||reactionController.getActive()||hasTimerReaction(state)||configuredBehaviors(state).some(item=>item.enabled&&['oscillator','blink','randomIdle'].includes(item.type)));
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
      const clip=scrubbing()?state.animationClips?.find((item)=>item.id===clipId):null;
      // Declared, ordered layers — never an ad hoc spread (docs/PARAMETER_MIXER.md),
      // so the preview and the exported runtime compose the same way.
      const motions=[...(clip?[{source:'motion',mode:'override',values:evaluateAnimationClip(clip,clipTime,result)}]:[]),...motionLayer.layers(previewElapsed,result)];
      const posed=motions.length?mixParameters(result,motions,state.params):result;
      // Expressions compose on the base/clip pose exactly like the exported runtime (shared helper).
      // Reactions sequence an expression and a motion over the preview clock (shared runtime sequencer).
      const previousActive=reactionController.getActive()?.id||null;
      const reaction=reactionController.evaluate(previewElapsed,posed);
      result=mixParameters(posed,[{source:'reaction',mode:'override',values:reaction.params}],state.params);
      if(reaction.active&&reaction.active.id!==previousActive){const fired=(state.reactions||[]).find(item=>item.id===reaction.active.id);if(fired?.trigger?.type==='timer')logEvent({type:'timer',reactionId:fired.id,reactionName:fired.name,outcome:'fired'});}
      const weights=expressionWeights.values();for(const [id,weight] of Object.entries(reaction.expressions))weights[id]=Math.max(weights[id]||0,weight);
      if(Object.keys(weights).length)result=composeExpressionParams(result,normalizeExpressions(state),weights,state.params);
      let configured=configuredBehaviors(state);
      if(testBehavior){const elapsed=previewElapsed-testBehavior.started;if(elapsed>=testBehavior.window)testBehavior=null;
        else {configured=configured.map(item=>({...item,enabled:item.id===testBehavior.id}));
          if(testBehavior.type==='blink')result[testBehavior.parameter]=elapsed<testBehavior.duration?testBehavior.closedValue:result[testBehavior.parameter];
          if(testBehavior.type==='randomIdle')result[testBehavior.parameter]=(result[testBehavior.parameter]??0)+testBehavior.sample;
        }
      }
      result=composeBehaviorParams(result,configured,previewElapsed,behaviors.evaluate(configured,previewElapsed));
      // Live control is the mixer's last layer (docs/PARAMETER_MIXER.md).
      effective=mixParameters(result,[{source:'override',mode:'override',values:live}],state.params); diagnostics.increment('preview.computes');
      const applyStart=diagnostics.enabled?performance.now():0;
      canvas.applyFrame(compileFrame(state.elements,effective,state.globalConstraints,state.stateConstraints?.[state.activeState],{keyforms:state.keyforms,shapeKeys:state.shapeKeys,warps:state.warps,hands:state.hands,deformers:state.deformers,parallax:state.parallax}));
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
    const delta=Math.max(0,timestamp-last)/1000;previewElapsed+=delta;expressionWeights.advance(delta*1000);motionLayer.advance(delta*1000);
    if(transition)transitionElapsed+=delta*1000;
    if(playing){clipTime+=delta;const clip=store.getDocument().animationClips?.find(item=>item.id===clipId);const duration=Number(clip?.duration);if(clip&&Number.isFinite(duration)&&duration>0&&clipTime>=duration){if(clip.loop)clipTime%=duration;else{clipTime=duration;playing=false;diagnostics.set('preview.playing',false);}}}
    last=timestamp;compute();syncPlaying();if(continuous())schedule(token);else{running=false;generation++;diagnostics.increment('preview.stops');}
  }
  const api={
    start(){if(destroyed||running)return false;wake();return true;},
    stop(){const changed=running||playing||raf||transition||testBehavior;playing=false;transition=null;testBehavior=null;transitionElapsed=0;motionLayer.stop({fade:0});sleep();behaviors.reset();syncPlaying();if(changed)diagnostics.increment('preview.stops');compute();return changed;},
    setState(name){const state=store.getDocument(),fromName=authorState||state.activeState;if(!state.states?.[name]||!canTransition(state.transitions,fromName,name))return false;const from={...transitionValues(state),...live},to=resolveStateParams(state.params,state.states[name]),settings=state.transitionSettings?.[`${fromName}->${name}`]||{};const duration=Math.max(0,Number(settings.duration??300)||0);transitionElapsed=0;transition=duration?{from,to,duration,easing:settings.easing||'easeInOut'}:null;authorState=name;if(!duration)effective=to;compute();if(transition)wake();return true;},
    previewState(name){const state=store.getDocument();if(!state.states?.[name])return false;authorState=name;transition=null;compute();return true;},
    testTransition({from,to,duration,easing}={}){const state=store.getDocument();if(!state.states?.[from]||!state.states?.[to])return false;authorState=from;transitionElapsed=0;transition={from:resolveStateParams(state.params,state.states[from]),to:resolveStateParams(state.params,state.states[to]),duration:Math.max(1,Number(duration)||300),easing:easing||'easeInOut'};compute();wake();return true;},
    testBehavior(id,{random=Math.random}={}){const behavior=normalizeBehaviors(store.getDocument()).find(item=>item.id===id);if(!behavior)return false;const window=behavior.type==='oscillator'?Math.max(1,2/Math.max(.1,behavior.frequency)):behavior.type==='blink'?behavior.duration*2:.6;testBehavior={...behavior,started:previewElapsed,window,sample:behavior.min+random()*(behavior.max-behavior.min)};compute();wake();return true;},
    setTransition(value){transition=value;transitionElapsed=0;compute();if(value)wake();},
    setBehaviorOverride(key,enabled){behaviorOverrides[key]=Boolean(enabled);compute();if(continuous())wake();else sleep();},
    setExpression(id,weight=1,options={}){expressionWeights.set(id,Math.max(0,Math.min(1,Number(weight))),blendOptions(options));compute();if(!expressionWeights.settled())wake();},
    /** Cross-fade to one expression from whatever is showing, never via neutral. */
    transitionToExpression(id,options={}){expressionWeights.transitionTo(id,blendOptions(options));compute();if(!expressionWeights.settled())wake();},
    clearExpression(id,options={}){expressionWeights.clear(id,blendOptions(options));compute();if(!expressionWeights.settled())wake();},
    clearExpressions(options={}){if(!Object.keys(expressionWeights.values()).length)return;expressionWeights.clearAll(blendOptions(options));compute();if(!expressionWeights.settled())wake();},
    getExpressionWeights:()=>expressionWeights.values(),getExpressionTargets:()=>expressionWeights.targets(),
    clearBehaviorOverrides(){behaviorOverrides={};compute();if(continuous())wake();},
    getBehaviorOverrides:()=>({...behaviorOverrides}),
    fireReaction(id){const state=store.getDocument(),reaction=(state.reactions||[]).find(item=>item.id===id);const fired=reactionController.fire(id,previewElapsed);logEvent({type:'test',reactionId:id,reactionName:reaction?.name||id,outcome:fired?'fired':reaction?.enabled===false?'disabled':'blocked',blockedBy:fired?null:reactionController.getActive()?.id||null});if(fired){wake();compute();}else syncSession();return fired;},
    triggerReaction(event){const state=store.getDocument(),type=typeof event==='string'?event:event?.type,name=typeof event==='object'&&event?event.name:undefined;const listeners=(state.reactions||[]).filter(item=>item.enabled!==false&&item.trigger?.type===type&&(type!=='custom'||item.trigger.name===name));const id=reactionController.trigger(event,previewElapsed);logEvent({type,name,reactionId:id,reactionName:id?(state.reactions||[]).find(item=>item.id===id)?.name||id:null,outcome:id?'fired':listeners.length?'blocked':'no-listener',blockedBy:!id&&listeners.length?reactionController.getActive()?.id||null:null});if(id){wake();compute();}else syncSession();return id;},
    getEventLog:()=>eventLog.map(entry=>({...entry})),clearEventLog(){eventLog=[];syncSession();},getActiveReaction:()=>reactionController.getActive(),getStayedExpressions:()=>reactionController.getStayed(),clearReactions(){reactionController.reset();compute();if(!continuous())sleep();},
    setClip(id){if(id===clipId)return false;clipId=id;clipTime=0;clipPosed=Boolean(id);motionLayer.stop({fade:0});compute();return true;},getActiveClipId:()=>clipId,isClipPosed:()=>clipPosed,
    playClip(){if(playing)return false;playing=true;clipPosed=true;motionLayer.stop({fade:0});syncPlaying();compute();if(playing)wake();return true;},pauseClip(){if(!playing)return false;playing=false;syncPlaying();compute();if(!continuous())sleep();return true;},stopClip({pose=true}={}){const changed=playing||clipTime!==0||clipPosed!==pose||Boolean(motionLayer.playing().length);playing=false;clipTime=0;clipPosed=Boolean(pose)&&Boolean(clipId);motionLayer.stop({fade:0});syncPlaying();compute();if(!continuous())sleep();return changed;},
    seek(value){clipTime=Math.max(0,Number(value)||0);if(clipId)clipPosed=true;compute();},setLiveParam(name,value){const n=Number(value);live[name]=Number.isFinite(n)?n:0;compute();},clearLiveParam(name){delete live[name];compute();},clearLiveParams(){live={};compute();},
    /**
     * Play a motion the way the exported mascot does: cross-fade to it from
     * whatever is playing, or `layer: true` to run it alongside. This is the
     * Preview transport; the Timeline keeps setClip / seek / playClip.
     */
    playMotion(id,options={}){
      if(!(store.getDocument().animationClips||[]).some(item=>item.id===id))return false;
      playing=false;clipPosed=false;clipTime=0;clipId=id;
      if(!motionLayer.play(id,previewElapsed,options))return false;
      syncPlaying();compute();wake();return true;
    },
    /** Fade a motion out (or every motion), like `mascot.stopMotion()`. */
    stopMotion(id,options){const stopped=motionLayer.stop(id,options);syncPlaying();compute();if(stopped)wake();else if(!continuous())sleep();return stopped;},
    getMotionWeights:()=>motionLayer.values(),
    getCurrentTime:()=>clipTime,getPreviewElapsed:()=>previewElapsed,getTransitionElapsed:()=>transitionElapsed,getLiveParams:()=>({...live}),getEffectiveParams:()=>({...effective}),getSession:()=>{syncSession();return session;},isRunning:()=>running,isPlaying:anyPlaying,getLastError:()=>lastError,
    apply:compute,reset(){playing=false;sleep();clipId=null;clipPosed=false;motionLayer.reset();syncPlaying();clipTime=previewElapsed=transitionElapsed=0;live={};transition=null;authorState=null;testBehavior=null;behaviorOverrides={};expressionWeights.reset();reactionController.reset();eventLog=[];behaviors.reset();compute();},destroy(){if(destroyed)return;api.stop();destroyed=true;live={};}
  };return api;
}
