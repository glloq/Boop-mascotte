import { addTrack, deleteKeyframe, upsertKeyframe } from './clip-operations.js';
const find=(clip,key)=>clip.tracks?.[key.parameter]?.find(frame=>Math.abs(frame.time-key.time)<1e-6);
export function moveSelectedKeys(clip,selection,delta){const frames=selection.map(key=>({key,frame:find(clip,key)})).filter(item=>item.frame);if(!frames.length)return {selection:[],delta:0};const min=Math.min(...frames.map(item=>item.frame.time)),max=Math.max(...frames.map(item=>item.frame.time));const applied=Math.max(-min,Math.min(Number(clip.duration)-max,Number(delta)||0));const payload=frames.map(({key,frame})=>({parameter:key.parameter,time:frame.time+applied,value:frame.value,easing:frame.easing||'linear'}));for(const {key} of frames)deleteKeyframe(clip,key.parameter,key.time);for(const key of payload)upsertKeyframe(clip,key.parameter,key.time,key.value,key.easing);return {selection:payload.map(({parameter,time})=>({parameter,time})),delta:applied};}
export function deleteSelectedKeys(clip,selection){for(const key of selection)deleteKeyframe(clip,key.parameter,key.time);return selection.length;}
export function setSelectedEasing(clip,selection,easing){let count=0;for(const key of selection){const frame=find(clip,key);if(frame){frame.easing=easing;count++;}}return count;}
/**
 * Copy each selected key one step later. A copy that would land on a key that
 * is already there is skipped rather than replacing it: `upsertKeyframe`
 * overwrites, so duplicating a run of adjacent keys used to destroy the very
 * keys it was copying, and a key at the end of the clip clamped onto itself and
 * silently did nothing.
 *
 * @returns {{selection: {parameter,time}[], skipped: number}}
 */
export function duplicateSelectedKeys(clip,selection,step=1/30){
  const duration=Number(clip.duration)||0,created=[];let skipped=0;
  for(const key of selection){
    const frame=find(clip,key);
    if(!frame){skipped++;continue;}
    const time=Math.min(duration,frame.time+step);
    const occupied=(clip.tracks?.[key.parameter]||[]).some(other=>Math.abs(other.time-time)<1e-6);
    if(occupied){skipped++;continue;}
    addTrack(clip,key.parameter);
    upsertKeyframe(clip,key.parameter,time,frame.value,frame.easing||'linear');
    created.push({parameter:key.parameter,time});
  }
  return {selection:created,skipped};
}
