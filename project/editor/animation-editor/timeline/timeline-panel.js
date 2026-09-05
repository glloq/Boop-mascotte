import { createClip, duplicateClip, removeClip, addTrack, removeTrack, upsertKeyframe, moveKeyframe, setClipDuration } from './clip-operations.js';
import { availableControlGroups, controlMeta } from '../../ui/control-catalog.js';
import { focusCovers, focusLabelFor } from '../../core/puppet/control-groups.js';
import { createTimelineState } from './timeline-state.js';
import { createTimelineLayout, rulerTicks, snapTime } from './timeline-layout.js';
import { selectKey, selectInRect } from './timeline-selection.js';
import { copyKeys, pasteKeys } from './timeline-clipboard.js';
import { moveSelectedKeys, deleteSelectedKeys, duplicateSelectedKeys, setSelectedEasing } from './timeline-operations.js';
import { lifecycleDiagnostics as diagnostics } from '../../core/diagnostics/lifecycle-diagnostics.js';
import { createTimelineCommands } from './timeline-commands.js';
import { arrangementDuration, arrangementPlacements } from '../../core/animation/arrangement.js';
import { arrangementLanes } from '../../core/animation/arrangement-lanes.js';
import { createArrangementCommands } from '../../core/animation/arrangement-commands.js';
import { findClipConflicts, mergeClipConflicts } from '../../core/animation/clip-conflicts.js';
import { createMotionCommands } from '../../core/motion/motion-commands.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>a.parameter===b.parameter&&Math.abs(a.time-b.time)<1e-6;
/**
 * Which part the author is working on, for "Selected only" (VNX-33).
 *
 * A semantic part is the strong answer; a selected piece of artwork is the
 * fallback, resolved through the same catalogue the tracks are grouped by, so
 * the filter can never disagree with the grouping.
 */
export function selectionFocus(session={},editorContext=null){
  const part=editorContext?.get?.().activeSemanticPartId;
  if(part)return part;
  const id=session.selectedId;
  return id?controlMeta(id).part||null:null;
}
// The cage an author is posing, not the part a control happens to belong to
// (docs/FACE_CONTROL_RIG.md, CR-45).
const focusLabel=(focus)=>focusLabelFor(focus);
export function createTimelinePanel(host,store,history,preview,editorContext=null,notify=()=>{}){
  const ui=createTimelineState();let transientPlayhead=null,confirmAction=null,pendingRender=0,rendering=false,generation=0;
  const commands=createTimelineCommands(store,history);
  // The arrangement's conflict warning offers the one resolution the mixer can
  // honour, and that resolution is a property of the clip (VNX-31).
  const motionCommands=createMotionCommands(store,history);
  const arrangement=createArrangementCommands(store,history);
  const active=(document=store.getDocument(),id=store.getSession().animationEditor.activeClipId)=>document.animationClips.find(c=>c.id===id);
  const mutate=fn=>commands.mutate('edit',fn);
  const updateAnimationEditor=apply=>store.mutateSession('animationEditor',session=>apply(session.animationEditor));
  const playhead=()=>transientPlayhead??store.getSession().animationEditor.playhead;
  const snapPlayhead=time=>{if(!ui.snap)return time;const clip=active();const keys=Object.values(clip?.tracks||{}).flat().map(frame=>frame.time);return snapTime(time,{fps:ui.fps,keyTimes:keys,threshold:8/(160*ui.zoom)}).time;};
  const seek=time=>{const clip=active();time=Math.max(0,Math.min(clip?.duration||0,time));transientPlayhead=time;preview.seek(time);const display=host.querySelector('#current-time');if(display)display.textContent=time.toFixed(2);const input=host.querySelector('#playhead');if(input)input.value=time;const head=host.querySelector('.playhead');if(head)head.style.left=`${time*(160*ui.zoom)}px`;};
  const commitSeek=()=>{const value=playhead();updateAnimationEditor(editor=>{editor.playhead=value;});transientPlayhead=null;};
  const selectClip=id=>{ui.selectedKeys=[];ui.selectedTrack=null;updateAnimationEditor(editor=>{editor.activeClipId=id;editor.playhead=0;});preview.setClip(id);};
  host.addEventListener('click',event=>{const button=event.target.closest('button');const clip=active();
    if(button?.dataset.action==='new-clip'){let id;commands.create(d=>{const n=d.animationClips.length+1,c=createClip(d.animationClips,`Motion ${n}`);id=c.id;});updateAnimationEditor(editor=>{editor.activeClipId=id;editor.playhead=0;});preview.setClip(id);}
    if(button?.dataset.clipId)selectClip(button.dataset.clipId);
    if(button?.id==='duplicate-clip'&&clip){let id;commands.duplicate(d=>{id=duplicateClip(d.animationClips,clip.id).id;});updateAnimationEditor(editor=>{editor.activeClipId=id;});preview.setClip(id);}
    if(button?.id==='delete-clip'&&clip){const count=Object.values(clip.tracks||{}).reduce((n,k)=>n+k.length,0);if(count)openConfirm(`Delete “${clip.name}”?`,`${Object.keys(clip.tracks).length} tracks · ${count} keyframes`,deleteClip);else deleteClip();}
    if(button?.id==='confirm-delete'){const action=confirmAction;confirmAction=null;host.querySelector('#timeline-confirm')?.close();action?.();}
    if(button?.dataset.action==='add-track'&&clip){const p=host.querySelector('#track-param')?.value;if(p)mutate(d=>addTrack(active(d),p));}
    if(button?.dataset.removeTrack){const p=button.dataset.removeTrack,count=clip.tracks[p]?.length||0;if(!count)mutate(d=>removeTrack(active(d),p));else openConfirm(`Remove “${controlMeta(p).label}”?`,`This removes ${count} keyframes from this motion.`,()=>mutate(d=>removeTrack(active(d),p)));}
    if(button?.dataset.addKey){const p=button.dataset.addKey,value=preview.getEffectiveParams()[p]??store.getDocument().params[p]?.value??0;mutate(d=>upsertKeyframe(active(d),p,playhead(),value));ui.selectedKeys=[{parameter:p,time:playhead()}];}
    if(button?.dataset.group){const group=button.dataset.group;ui.collapsedGroups.has(group)?ui.collapsedGroups.delete(group):ui.collapsedGroups.add(group);render();}
    if(button?.id==='delete-key'){deleteSelection();}
    if(button?.id==='clip-play'){preview.setClip(clip?.id);preview.seek(playhead());preview.playClip();}
    if(button?.id==='clip-pause')preview.pauseClip();
    if(button?.id==='clip-stop'){preview.stopClip();seek(0);commitSeek();render();}
    if(button?.dataset.frame){const direction=Number(button.dataset.frame),frame=Math.round(playhead()*ui.fps);seek((frame+direction)/ui.fps);commitSeek();render();}
    if(button?.dataset.keyNav)navigateKey(Number(button.dataset.keyNav));
    if(button?.id==='snap-toggle'){ui.snap=!ui.snap;render();}
    if(button?.id==='show-all-tracks'){ui.selectedOnly=false;render();return;}
    if(button?.dataset.view){ui.view=button.dataset.view==='arrangement'?'arrangement':'keys';ui.selectedPlacement=null;render();return;}
    if(button?.dataset.action==='place-clip'){
      const id=host.querySelector('[data-arrangement-clip]')?.value;
      const result=arrangement.place(id,playhead());
      if(!result.ok){notify(result.message,'warn');return;}
      ui.selectedPlacement=result.id;render();return;
    }
    if(button?.dataset.action==='play-arrangement'){
      // Playing an arrangement is the Preview transport, so it takes over from
      // the single-clip scrub the way `playMotion` does.
      preview.playArrangement(arrangementPlacements(store.getDocument()),{from:playhead()});
      render();return;
    }
    if(button?.dataset.action==='stop-arrangement'){preview.stopArrangement();render();return;}
    if(button?.dataset.action==='clear-arrangement'){const result=arrangement.clear();if(!result.ok)notify(result.message,'warn');ui.selectedPlacement=null;render();return;}
    // The one resolution the mixer can honour, offered where the clash is seen
    // (VNX-31/VNX-32): the later clip adds its distance from neutral instead of
    // winning the movement outright.
    if(button?.dataset.arrangementAdd){motionCommands.setClipBlend(button.dataset.arrangementAdd,'additive');notify('That motion adds to the others now instead of replacing them. Undo puts it back.');render();return;}
    if(button?.dataset.placement&&!ui.drag){ui.selectedPlacement=button.dataset.placement;render();return;}
    if(button?.dataset.zoom){if(button.dataset.zoom==='fit'){const width=host.querySelector('.dope-viewport')?.clientWidth||500;ui.zoom=Math.max(.25,Math.min(8,width/Math.max(1,clip.duration*160)));ui.scrollLeft=0;}else ui.zoom=Math.max(.25,Math.min(8,ui.zoom+Number(button.dataset.zoom)));render();}
  });
  function openConfirm(title,message,action){const dialog=host.querySelector('#timeline-confirm');dialog.querySelector('b').textContent=title;dialog.querySelector('p').textContent=message;confirmAction=action;dialog.showModal();}
  function deleteClip(){const clip=active();if(!clip)return;let id;commands.remove(d=>{removeClip(d.animationClips,clip.id);id=d.animationClips[0]?.id||null;});updateAnimationEditor(editor=>{editor.activeClipId=id;});preview.setClip(id);ui.selectedKeys=[];host.querySelector('#timeline-confirm')?.close();}
  function deleteSelection(){if(!ui.selectedKeys.length)return;mutate(d=>deleteSelectedKeys(active(d),ui.selectedKeys));ui.selectedKeys=[];}
  function navigateKey(direction){const clip=active();if(!clip)return;const tracks=ui.selectedTrack?[clip.tracks[ui.selectedTrack]||[]]:Object.values(clip.tracks||{});const times=[...new Set(tracks.flat().map(k=>k.time))].sort((a,b)=>a-b),now=playhead();const next=direction<0?[...times].reverse().find(t=>t<now-1e-6):times.find(t=>t>now+1e-6);if(next!==undefined){seek(next);commitSeek();render();}}
  host.addEventListener('input',event=>{if(event.target.id==='playhead')seek(Number(event.target.value));});
  host.addEventListener('change',event=>{
    // Filtering the view is not editing a clip, so it must work before one exists.
    if(event.target.id==='selected-only'){ui.selectedOnly=event.target.checked;render();return;}
    const clip=active();if(!clip)return;
    if(event.target.id==='clip-name')mutate(d=>{active(d).name=event.target.value.trim()||clip.name;});
    if(event.target.id==='clip-duration'&&Number(event.target.value)>0){const next=Number(event.target.value),affected=Object.values(clip.tracks).flat().filter(k=>k.time>next).length;if(!affected)mutate(d=>setClipDuration(active(d),next));else openConfirm('Shorten motion?',`Shortening to ${next.toFixed(2)} s will clamp ${affected} keyframes.`,()=>mutate(d=>setClipDuration(active(d),next)));}
    if(event.target.id==='clip-loop')mutate(d=>{active(d).loop=event.target.checked;});
    if(event.target.id==='auto-key'){updateAnimationEditor(editor=>{editor.autoKey=event.target.checked;});if(event.target.checked)notify('Auto Key is on. Move the playhead and change a mascot control to create keys.');}
    if(event.target.id==='playhead'){seek(Number(event.target.value));commitSeek();render();}
    if(event.target.dataset.keyEdit==='easing'){mutate(d=>setSelectedEasing(active(d),ui.selectedKeys,event.target.value));}
    if(event.target.dataset.keyEdit==='value'&&ui.selectedKeys.length===1){const key=ui.selectedKeys[0],value=Number(event.target.value),current=clip.tracks[key.parameter]?.find(x=>Math.abs(x.time-key.time)<1e-6);if(!current||current.value===value)return;mutate(d=>{const f=active(d).tracks[key.parameter].find(x=>Math.abs(x.time-key.time)<1e-6);f.value=value;});}
    if(event.target.dataset.keyEdit==='time'&&ui.selectedKeys.length===1){const key=ui.selectedKeys[0],time=Number(event.target.value),current=clip.tracks[key.parameter]?.find(x=>Math.abs(x.time-key.time)<1e-6);if(!current||Math.abs(current.time-time)<1e-6)return;mutate(d=>{const f=moveKeyframe(active(d),key.parameter,key.time,Number(event.target.value));ui.selectedKeys=f?[{parameter:key.parameter,time:f.time}]:[];});}
  });
  host.addEventListener('scroll',event=>{if(event.target.classList.contains('dope-viewport'))ui.scrollLeft=event.target.scrollLeft;},true);
  host.addEventListener('pointerdown',event=>{
    const bar=event.target.closest('.arrangement-bar');
    if(bar){
      // One drag is one command and one undo step; `move` is called at the end,
      // and the bar is pushed around with a style until then.
      event.preventDefault();
      const start=Number(bar.style.left.replace('px',''))||0;
      ui.selectedPlacement=bar.dataset.placement;
      ui.drag={type:'placement',pointerId:event.pointerId,id:bar.dataset.placement,startX:event.clientX,left:start,node:bar};
      bar.setPointerCapture?.(event.pointerId);
      render();
      return;
    }
const keyEl=event.target.closest('[data-key]'),lane=event.target.closest('.key-lane'),ruler=event.target.closest('.time-ruler');
    if(keyEl){event.preventDefault();const [parameter,time]=keyEl.dataset.key.split('|'),key={parameter,time:Number(time)};ui.selectedKeys=selectKey(ui.selectedKeys,key,{toggle:event.metaKey||event.ctrlKey,add:event.shiftKey});ui.selectedTrack=parameter;const meta=controlMeta(parameter);editorContext?.update({selectedTrackParameter:parameter,activeControl:parameter,activeSemanticPartId:meta.part});keyEl.setPointerCapture?.(event.pointerId);ui.drag={type:'keys',pointerId:event.pointerId,startX:event.clientX,selection:structuredClone(ui.selectedKeys),delta:0,keyEl};render();return;}
    if(ruler){const rect=ruler.getBoundingClientRect(),layout=createTimelineLayout({duration:active()?.duration,pixelsPerSecond:160*ui.zoom,scrollLeft:ui.scrollLeft});seek(snapPlayhead(layout.xToTime(event.clientX-rect.left)));ui.drag={type:'playhead',pointerId:event.pointerId,rect};return;}
    if(lane){const sheet=host.querySelector('.dope-sheet'),rect=sheet.getBoundingClientRect();ui.drag={type:'marquee',pointerId:event.pointerId,startX:event.clientX-rect.left,startY:event.clientY-rect.top,rect,previous:structuredClone(ui.selectedKeys),mode:event.shiftKey?'add':(event.metaKey||event.ctrlKey?'toggle':'replace')};ui.marquee={left:ui.drag.startX,top:ui.drag.startY,width:0,height:0};render();}
  });
  host.addEventListener('pointermove',event=>{const drag=ui.drag;if(!drag||drag.pointerId!==event.pointerId)return;
    if(drag.type==='placement'){const left=Math.max(0,drag.left+(event.clientX-drag.startX));drag.node.style.left=`${left}px`;drag.seconds=left/(160*ui.zoom);return;}
    if(drag.type==='playhead'){const layout=createTimelineLayout({duration:active()?.duration,pixelsPerSecond:160*ui.zoom,scrollLeft:ui.scrollLeft});seek(snapPlayhead(layout.xToTime(event.clientX-drag.rect.left)));}
    if(drag.type==='keys'){let delta=(event.clientX-drag.startX)/(160*ui.zoom);if(ui.snap){const first=drag.selection[0]?.time||0,keys=Object.values(active().tracks).flat().map(k=>k.time);delta=snapTime(first+delta,{fps:ui.fps,keyTimes:keys.filter(t=>!drag.selection.some(k=>Math.abs(k.time-t)<1e-6)),threshold:8/(160*ui.zoom)}).time-first;}drag.delta=delta;host.querySelectorAll('.key.selected').forEach(el=>el.style.transform=`translateX(calc(-50% + ${delta*160*ui.zoom}px))`);}
    if(drag.type==='marquee'){const x=event.clientX-drag.rect.left,y=event.clientY-drag.rect.top;ui.marquee={left:Math.min(x,drag.startX),top:Math.min(y,drag.startY),width:Math.abs(x-drag.startX),height:Math.abs(y-drag.startY)};const all=[...host.querySelectorAll('[data-key]')].map(el=>{const r=el.getBoundingClientRect();return {parameter:el.dataset.key.split('|')[0],time:Number(el.dataset.key.split('|')[1]),x:r.left+r.width/2-drag.rect.left,y:r.top+r.height/2-drag.rect.top};});ui.selectedKeys=selectInRect(all,{left:ui.marquee.left,right:ui.marquee.left+ui.marquee.width,top:ui.marquee.top,bottom:ui.marquee.top+ui.marquee.height},drag.previous,drag.mode);const m=host.querySelector('.marquee');if(m)Object.assign(m.style,{left:`${ui.marquee.left}px`,top:`${ui.marquee.top}px`,width:`${ui.marquee.width}px`,height:`${ui.marquee.height}px`});}
  });
  const finish=event=>{const drag=ui.drag;if(!drag||event.pointerId!==drag.pointerId)return;ui.drag=null;if(drag.type==='placement'){const result=arrangement.move(drag.id,drag.seconds??(drag.left/(160*ui.zoom)));if(!result.ok)notify(result.message,'warn');render();return;}if(drag.type==='playhead')commitSeek();if(drag.type==='keys'&&Math.abs(drag.delta)>1e-6)mutate(d=>{ui.selectedKeys=moveSelectedKeys(active(d),drag.selection,drag.delta).selection;});ui.marquee=null;render();};host.addEventListener('pointerup',finish);host.addEventListener('pointercancel',finish);
  host.addEventListener('wheel',event=>{if(!(event.ctrlKey||event.metaKey))return;event.preventDefault();ui.zoom=Math.max(.25,Math.min(8,ui.zoom*(event.deltaY<0?1.15:.87)));render();},{passive:false});
  host.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.target.isContentEditable)return;const mod=event.ctrlKey||event.metaKey;
    if(event.key==='Escape'){ui.selectedKeys=[];ui.marquee=null;ui.drag=null;render();}else if(['Delete','Backspace'].includes(event.key)&&ui.selectedKeys.length){event.preventDefault();deleteSelection();}else if(mod&&event.key.toLowerCase()==='c'){ui.clipboard=copyKeys(active(),ui.selectedKeys);event.preventDefault();}else if(mod&&event.key.toLowerCase()==='v'&&ui.clipboard){event.preventDefault();mutate(d=>{const result=pasteKeys(active(d),ui.clipboard,playhead(),{validParameters:Object.keys(d.params)});ui.selectedKeys=result.pasted;if(result.skipped.length)notify(`Skipped unavailable controls: ${result.skipped.join(', ')}`);});}else if(mod&&event.key.toLowerCase()==='d'&&ui.selectedKeys.length){event.preventDefault();mutate(d=>{const result=duplicateSelectedKeys(active(d),ui.selectedKeys,1/ui.fps);ui.selectedKeys=result.selection;if(result.skipped)notify(`${result.skipped} key${result.skipped===1?'':'s'} not duplicated: a key is already there.`);});}else if(event.code==='Space'){event.preventDefault();preview.isPlaying()?preview.pauseClip():preview.playClip();}else if(event.key==='Home'){seek(0);commitSeek();render();}else if(event.key==='End'){seek(active()?.duration||0);commitSeek();render();}
  });

  /**
   * Several clips, seen at once (VNX-29).
   *
   * One row per subject, derived from what the placed clips actually write, so
   * a wave and a nod sit on different lines because they move different parts
   * of the mascot -- not because anyone filed them there. A clip that reaches
   * outside its row says so rather than being drawn twice or hidden.
   */
  function arrangementMarkup(state,pps){
    const lanes=arrangementLanes(state);
    const playingArrangement=preview.isArrangementPlaying?.();
    const at=preview.getArrangementTime?.();
    const seconds=Math.max(arrangementDuration(state),1);
    const width=Math.max(seconds*pps,500);
    const clips=state.animationClips||[];
    if(!clips.length)return `<div class="timeline-empty"><p>No motions yet. Make one, then place it here to run it beside the others.</p><button data-action="new-clip">+ New motion</button></div>`;
    const warnings=mergeClipConflicts(findClipConflicts(state,{placements:arrangementPlacements(state)}));
    const bar=(placement,laneId)=>{
      const reaches=placement.subjects&&placement.subjects.length>1;
      const span=placement.loop?seconds-placement.start:placement.duration;
      return `<button type="button" class="arrangement-bar${ui.selectedPlacement===placement.id?' selected':''}" data-placement="${esc(placement.id)}" data-lane="${esc(laneId)}"
        style="left:${placement.start*pps}px;width:${Math.max(span*pps,14)}px"
        aria-label="${esc(placement.name)} from ${placement.start.toFixed(2)} seconds${placement.loop?', looping':`, for ${placement.duration.toFixed(2)} seconds`}${reaches?', and it moves more than this row':''}"
        title="${esc(placement.name)} · ${placement.start.toFixed(2)}s${placement.loop?' · loops':''}">${esc(placement.name)}${placement.loop?' ↻':''}${reaches?' <i aria-hidden="true">↕</i>':''}</button>`;
    };
    return `<div class="arrangement" data-arrangement data-arrangement-lanes="${lanes.length}" data-arrangement-placements="${lanes.reduce((n,l)=>n+l.placements.length,0)}">
      <div class="arrangement-add"><label>Place<select data-arrangement-clip aria-label="Animation to place">${clips.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><button type="button" data-action="place-clip">+ Place at playhead</button>${lanes.length?`<button type="button" data-action="${playingArrangement?'stop-arrangement':'play-arrangement'}">${playingArrangement?'■ Stop':'▶ Play together'}</button>`:''}${lanes.length?'<button type="button" class="secondary" data-action="clear-arrangement">Clear</button>':''}</div>
      ${warnings.map(w=>{const later=w.clips.at(-1),clip=clips.find(item=>item.id===later?.id),layered=clip?.blend==='additive';
        return `<p class="arrangement-warning" data-arrangement-warning="${esc(w.parameter)}" role="status">⚠ ${esc(w.message)}${clip&&!layered?` <button type="button" class="secondary" data-arrangement-add="${esc(clip.id)}">Make “${esc(clip.name)}” add instead</button>`:''}${layered?' <span class="small">— it adds to the others instead of replacing them.</span>':''}</p>`;}).join('')}
      ${lanes.length?`<div class="arrangement-grid"><div class="property-column"><div class="column-title">PART</div>${lanes.map(l=>`<div class="arrangement-lane-name" data-lane="${esc(l.id)}">${esc(l.label)}</div>`).join('')}</div><div class="dope-viewport"><div class="dope-content" style="width:${width}px"><div class="time-ruler" aria-label="Time ruler">${rulerTicks(seconds,pps).map(t=>`<span style="left:${t*pps}px">${t.toFixed(t<1?2:1)}</span>`).join('')}</div>${lanes.map(l=>`<div class="arrangement-lane" data-lane="${esc(l.id)}">${l.placements.map(p=>bar(p,l.id)).join('')}</div>`).join('')}${at===null||at===undefined?'':`<div class="playhead" style="left:${at*pps}px" aria-label="Arrangement at ${at.toFixed(2)} seconds"><i></i></div>`}</div></div></div>`:`<p class="small">Nothing arranged yet. Pick an animation and place it: several can run at once, and the one started last wins a movement they share.</p>`}
    </div>`;
  }

  function render(){if(rendering){diagnostics.increment('timeline.reentrantRenderPrevented');requestRender();return;}rendering=true;const renderStarted=diagnostics.enabled?performance.now():0;diagnostics.increment('timeline.renders');const document=store.getDocument(),session=store.getSession(),state={...document,animationEditor:session.animationEditor},clip=active(document);if(preview.getActiveClipId()!==(clip?.id||null))preview.setClip(clip?.id||null);const pps=160*ui.zoom,layout=createTimelineLayout({duration:clip?.duration||1,pixelsPerSecond:pps,scrollLeft:ui.scrollLeft});const focus=selectionFocus(session,editorContext);const groups=new Map();let hiddenTracks=0;for(const [parameter,frames] of Object.entries(clip?.tracks||{})){const meta=controlMeta(parameter);
    // "Selected only" (VNX-33): a timeline showing fifteen tracks when the
    // author is working on one part is a timeline they have to read past.
    if(ui.selectedOnly&&focus&&!focusCovers(focus,meta.part)){hiddenTracks++;continue;}
    if(!groups.has(meta.group))groups.set(meta.group,[]);groups.get(meta.group).push({parameter,frames,meta});}const available=availableControlGroups(state.params,Object.keys(clip?.tracks||{}));const selected=ui.selectedKeys.map(key=>({key,frame:clip?.tracks[key.parameter]?.find(f=>Math.abs(f.time-key.time)<1e-6)})).filter(x=>x.frame),easing=selected.length&&selected.every(x=>x.frame.easing===selected[0].frame.easing)?selected[0].frame.easing:'';
    host.innerHTML=`<div class="timeline-shell" tabindex="0"><aside class="animation-nav"><b>MOTIONS</b><div role="listbox" aria-label="Motions">${state.animationClips.map(c=>`<button role="option" aria-selected="${c===clip}" class="animation-item ${c===clip?'active':''}" data-clip-id="${esc(c.id)}">${c===clip?'▶ ':''}${esc(c.name)}</button>`).join('')}</div><button data-action="new-clip">+ New motion</button><div class="timeline-view" role="group" aria-label="Timeline view"><button type="button" data-view="keys" aria-pressed="${ui.view!=='arrangement'}">Keys</button><button type="button" data-view="arrangement" aria-pressed="${ui.view==='arrangement'}">Arrangement</button></div></aside><section class="timeline-editor">${ui.view==='arrangement'?arrangementMarkup(state,pps):clip?`<header class="timeline-head"><label>Name<input id="clip-name" value="${esc(clip.name)}"></label><label>Duration<input id="clip-duration" type="number" min=".01" step=".1" value="${clip.duration}"></label><label class="check"><input id="clip-loop" type="checkbox" ${clip.loop?'checked':''}>Loop</label></header><div class="timeline-toolbar" role="toolbar" aria-label="Timeline playback and view"><button data-key-nav="-1" aria-label="Previous key">|◀</button><button data-frame="-1" aria-label="Previous frame">◀</button><button id="clip-play" aria-label="Play">▶</button><button id="clip-pause" aria-label="Pause">Ⅱ</button><button id="clip-stop" aria-label="Stop">■</button><button data-frame="1" aria-label="Next frame">▶</button><button data-key-nav="1" aria-label="Next key">▶|</button><label>Time <input id="playhead" type="number" step=".01" min="0" max="${clip.duration}" value="${playhead().toFixed(2)}"> s <output id="current-time">${playhead().toFixed(2)}</output></label><label class="auto-key ${state.animationEditor.autoKey?'active':''}"><input id="auto-key" type="checkbox" ${state.animationEditor.autoKey?'checked':''}>${state.animationEditor.autoKey?'● AUTO KEY':'○ Auto Key'}</label><button id="snap-toggle" aria-pressed="${ui.snap}">Snap ${ui.snap?'ON':'OFF'}</button><label class="check" title="${focus?`Show only what ${esc(focusLabel(focus))} moves`:'Select a part to filter the timeline by it'}"><input id="selected-only" type="checkbox" ${ui.selectedOnly?'checked':''} ${focus?'':'disabled'}>Selected only</label><button data-zoom="-.25" aria-label="Zoom out">−</button><output>${Math.round(ui.zoom*100)}%</output><button data-zoom=".25" aria-label="Zoom in">+</button><button data-zoom="fit">Fit</button></div><div class="add-control"><select id="track-param" aria-label="Control to add">${[...available].map(([g,items])=>`<optgroup label="${esc(g)}">${items.map(i=>`<option value="${esc(i.id)}">${esc(i.label)} (${esc(i.id)})</option>`).join('')}</optgroup>`).join('')}</select><button id="timeline-add-track" data-action="add-track" ${available.size?'':'disabled'}>+ Add Control</button></div>${!groups.size&&hiddenTracks?`<div class="timeline-empty" data-timeline-filtered><p>${hiddenTracks} control${hiddenTracks===1?'':'s'} hidden: none of them belong to ${esc(focusLabel(focus))}.</p><button type="button" id="show-all-tracks">Show every control</button></div>`:''}${groups.size?`<div class="dope-sheet"><div class="property-column"><div class="column-title">PROPERTY</div>${[...groups].map(([g,rows])=>`<button class="track-group" data-group="${esc(g)}" aria-expanded="${!ui.collapsedGroups.has(g)}">${ui.collapsedGroups.has(g)?'▶':'▼'} ${esc(g)}</button>${ui.collapsedGroups.has(g)?'':rows.map(({parameter,frames,meta})=>`<div class="property-row ${ui.selectedTrack===parameter?'active':''}" data-track="${esc(parameter)}" title="${esc(parameter)}"><span>${esc(meta.label)} <small>${frames.length} ◆</small></span><button data-add-key="${esc(parameter)}" aria-label="Add ${esc(meta.label)} key">+◆</button><button data-remove-track="${esc(parameter)}" aria-label="Remove ${esc(meta.label)} track">×</button></div>`).join('')}`).join('')}</div><div class="dope-viewport"><div class="dope-content" style="width:${Math.max(layout.contentWidth,500)}px"><div class="time-ruler" aria-label="Time ruler">${rulerTicks(clip.duration,pps).map(t=>`<span style="left:${t*pps}px">${t.toFixed(t<1?2:1)}</span>`).join('')}</div>${[...groups].map(([g,rows])=>ui.collapsedGroups.has(g)?`<div class="group-lane"></div>`:rows.map(({parameter,frames,meta})=>`<div class="track"><span hidden>${esc(parameter)}</span><div class="key-lane" data-track="${esc(parameter)}">${frames.map(f=>`<button class="key ${ui.selectedKeys.some(k=>same(k,{parameter,time:f.time}))?'selected':''}" style="left:${f.time*pps}px" data-testid="timeline-key" data-key="${esc(parameter)}|${f.time}" aria-pressed="${ui.selectedKeys.some(k=>same(k,{parameter,time:f.time}))}" aria-label="${esc(meta.label)} key at ${f.time.toFixed(2)} seconds, value ${f.value}" title="${f.time.toFixed(2)}s · ${f.value} · ${f.easing||'linear'}">◆</button>`).join('')}</div></div>`).join('')).join('')}<div class="playhead" style="left:${playhead()*pps}px" aria-label="Playhead at ${playhead().toFixed(2)} seconds"><i></i></div></div></div>${ui.marquee?'<div class="marquee"></div>':''}</div>`:`<div class="timeline-empty"><p>“${esc(clip.name)}” has no controls yet.</p><button id="timeline-empty-add-track" data-action="add-track">+ Add Control</button></div>`}${selected.length?`<fieldset class="key-editor"><legend>${selected.length===1?'KEYFRAME':`${selected.length} KEYFRAMES`}</legend>${selected.length===1?`<label>Track <output>${esc(controlMeta(selected[0].key.parameter).label)}</output></label><label>Time<input data-key-edit="time" type="number" step=".01" value="${selected[0].key.time}"></label><label>Value<input data-key-edit="value" type="number" step=".01" value="${selected[0].frame.value}"></label>`:''}<label>Interpolation<select data-key-edit="easing"><option value="" ${easing?'':'selected'} disabled>Mixed</option><option value="linear" ${easing==='linear'?'selected':''}>Linear</option><option value="easeIn" ${easing==='easeIn'?'selected':''}>Ease In</option><option value="easeOut" ${easing==='easeOut'?'selected':''}>Ease Out</option><option value="easeInOut" ${easing==='easeInOut'?'selected':''}>Ease In Out</option></select></label><button id="delete-key" class="danger">Delete selected</button></fieldset>`:''}`:`<div class="timeline-empty"><p>No motion selected.</p><p>Create your first motion to make this mascot move.</p><button data-action="new-clip">+ New motion</button></div>`}</section><dialog id="timeline-confirm"><b></b><p></p><form method="dialog"><button>Cancel</button><button type="button" id="confirm-delete" class="danger">Delete</button></form></dialog></div>`;
    const viewport=host.querySelector('.dope-viewport');if(viewport)viewport.scrollLeft=ui.scrollLeft;if(diagnostics.enabled)diagnostics.increment('timeline.renderMs',performance.now()-renderStarted);rendering=false;
  }
  function autoKey(parameter,value,{snapshot=true}={}){const document=store.getDocument(),session=store.getSession(),clip=active(document);if(!clip||!session.animationEditor.autoKey)return;const time=playhead();if(snapshot)commands.autoKey(d=>{addTrack(active(d),parameter);upsertKeyframe(active(d),parameter,time,value);});else store.mutateDocument({type:'animation/auto-key',domains:['animation'],source:'timeline',apply:d=>{addTrack(active(d),parameter);upsertKeyframe(active(d),parameter,time,value);}});notify(`◆ Key added at ${time.toFixed(2)} s`);}
  function requestRender(){diagnostics.increment('timeline.renderRequests');if(pendingRender){diagnostics.increment('timeline.renderCoalesced');return;}const requestedGeneration=generation;diagnostics.set('timeline.pendingRenders',1);pendingRender=requestAnimationFrame(()=>{pendingRender=0;diagnostics.set('timeline.pendingRenders',0);if(requestedGeneration!==generation||!host.isConnected)return;render();});}
  /**
   * Move the arrangement playhead, do not redraw for it.
   *
   * Rebuilding the panel every frame put a fresh Stop button under the pointer
   * sixty times a second -- unclickable, and the same "never rebuild per frame"
   * mistake the canvas is careful to avoid. One element, one attribute.
   */
  function syncArrangementPlayhead(){
    if(ui.view!=='arrangement')return false;
    const node=host.querySelector('.arrangement .playhead');
    const at=preview.getArrangementTime?.();
    if(!node)return at!==null&&at!==undefined;
    if(at===null||at===undefined){node.remove();return false;}
    node.style.left=`${at*160*ui.zoom}px`;
    node.setAttribute('aria-label',`Arrangement at ${at.toFixed(2)} seconds`);
    return true;
  }

  function reset(){generation++;if(pendingRender)cancelAnimationFrame(pendingRender);pendingRender=0;diagnostics.set('timeline.pendingRenders',0);ui.selectedKeys=[];ui.drag=null;ui.marquee=null;transientPlayhead=null;}
  /**
   * Key several controls at once, as one undo step.
   *
   * Dragging the mascot moves two parameters at a time, and `autoKey` takes a
   * snapshot per parameter — so one gesture became two undo steps. An
   * animation tool keys what the pose is, in one go.
   */
  function autoKeyMany(values,{snapshot=true}={}){
    const document=store.getDocument(),session=store.getSession(),clip=active(document);
    const names=Object.keys(values||{}).filter(name=>document.params?.[name]);
    if(!clip||!session.animationEditor.autoKey||!names.length)return false;
    const time=playhead();
    const write=d=>{for(const name of names){addTrack(active(d),name);upsertKeyframe(active(d),name,time,Number(values[name]));}};
    if(snapshot)commands.autoKey(write);else store.mutateDocument({type:'animation/auto-key',domains:['animation'],source:'timeline',apply:write});
    notify(`◆ ${names.length} key${names.length===1?'':'s'} added at ${time.toFixed(2)} s`);
    return true;
  }

  return {
    syncArrangementPlayhead,render,requestRender,autoKey,autoKeyMany,togglePlayback(){preview.isPlaying()?preview.pauseClip():preview.playClip();},reset};
}
