export function createTimelineState(){return {selectedKeys:[],selectedTrack:null,zoom:1,scrollLeft:0,collapsedGroups:new Set(),selectedOnly:false,view:'keys',selectedPlacement:null,clipboard:null,marquee:null,drag:null,snap:true,fps:30,panelHeight:210};}
export const keyId=({parameter,time})=>`${parameter}|${Number(time)}`;
export function resetTimelineState(state,{keepView=true}={}){state.selectedKeys=[];state.selectedTrack=null;state.marquee=null;state.drag=null;state.clipboard=null;if(!keepView){state.zoom=1;state.scrollLeft=0;state.collapsedGroups.clear();}}
