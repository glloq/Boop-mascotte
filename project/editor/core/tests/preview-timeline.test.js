import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createPreviewController } from '../preview-runtime/preview-controller.js';
import { createClip, duplicateClip, addTrack, removeTrack, upsertKeyframe, deleteKeyframe } from '../../animation-editor/timeline/clip-operations.js';

test('clip CRUD and tracks keep one sorted key at an exact playhead time', () => {
  const clips=[]; const clip=createClip(clips,'Hello',2); addTrack(clip,'lookX');
  upsertKeyframe(clip,'lookX',1,1); upsertKeyframe(clip,'lookX',0,-1); upsertKeyframe(clip,'lookX',1,.5);
  assert.deepEqual(clip.tracks.lookX.map((f)=>[f.time,f.value]),[[0,-1],[1,.5]]);
  const copy=duplicateClip(clips,clip.id); assert.notEqual(copy.id,clip.id); deleteKeyframe(clip,'lookX',0); assert.equal(clip.tracks.lookX.length,1); removeTrack(clip,'lookX'); assert.deepEqual(clip.tracks,{});
});

test('PreviewController composes state, clip, behavior and live override without store writes', () => {
  const state=createCleanProjectState(); state.params={eyeOpen:{type:'number',min:0,max:1,default:1,value:1},lookX:{type:'number',min:-1,max:1,default:0,value:0}}; state.states={idle:{eyeOpen:1,lookX:0}}; state.activeState='idle';
  state.animationClips=[{id:'clip',name:'Clip',duration:1,loop:false,tracks:{eyeOpen:[{time:0,value:.8,easing:'linear'}],lookX:[{time:0,value:0,easing:'linear'},{time:1,value:1,easing:'linear'}]}}];
  const store=createStore(); store.replaceState(state); const before=structuredClone(store.getState()); let rendered; const queue=[];
  const preview=createPreviewController({store,canvas:{applyFrame(frame){rendered=frame;}},requestFrame:(fn)=>{queue.push(fn);return queue.length;},cancelFrame:()=>{},now:()=>0});
  preview.setClip('clip'); preview.seek(.5); assert.equal(preview.getEffectiveParams().eyeOpen,.8); assert.equal(preview.getEffectiveParams().lookX,.5);
  preview.setLiveParam('lookX',-1); assert.equal(preview.getEffectiveParams().lookX,-1); assert.ok(rendered); assert.deepEqual(store.getState(),before);
  preview.start(); preview.start(); assert.equal(queue.length,1); preview.stop(); assert.equal(preview.isRunning(),false);
});

test('PreviewController keeps preview, clip, and transition clocks independent',()=>{
  const state=createCleanProjectState();state.params={x:{type:'number',min:-1,max:1,default:0,value:0}};state.states={idle:{x:0},happy:{x:1},surprised:{x:-1}};state.activeState='idle';state.transitions={idle:['happy'],happy:['surprised']};state.transitionSettings={'idle->happy':{duration:500,easing:'linear'},'happy->surprised':{duration:500,easing:'linear'}};state.behaviors=[{id:'idle',type:'oscillator',enabled:true,parameter:'x',amplitude:.5,frequency:1,offset:0,waveform:'sine'}];
  const store=createStore();store.replaceState(state);const queue=[];const preview=createPreviewController({store,canvas:{applyFrame(){}},requestFrame:(fn)=>{queue.push(fn);return queue.length;},cancelFrame:()=>{},now:()=>0});
  preview.start();queue.shift()(125);assert.equal(preview.getCurrentTime(),0);assert.equal(preview.getPreviewElapsed(),.125);assert.notEqual(preview.getEffectiveParams().x,0);store.setState(d=>{d.behaviors[0].enabled=false;});
  assert.equal(preview.setState('happy'),true);queue.shift()(325);const interrupted=preview.getEffectiveParams().x;assert.equal(preview.getTransitionElapsed(),200);assert.equal(preview.setState('surprised'),true);assert.equal(preview.getEffectiveParams().x,interrupted);queue.shift()(825);assert.ok(Math.abs(preview.getEffectiveParams().x+1)<1e-9);preview.stop();
});

test('setting the already active clip does not reset its playhead',()=>{
  const state=createCleanProjectState();state.animationClips=[{id:'a',duration:2,tracks:{}}];const store=createStore();store.replaceState(state);const preview=createPreviewController({store,canvas:{applyFrame(){}},requestFrame:()=>1,cancelFrame:()=>{},now:()=>0});
  preview.setClip('a');preview.seek(1.25);assert.equal(preview.setClip('a'),false);assert.equal(preview.getCurrentTime(),1.25);
});
