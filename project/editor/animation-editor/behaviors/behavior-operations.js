import { normalizeBehavior } from '../../../runtime/behaviors.js';
import { BEHAVIOR_TITLES } from './behavior-catalog.js';
export const addBehavior=(rig,type)=>{const behavior=normalizeBehavior({type,name:BEHAVIOR_TITLES[type]});rig.behaviors||=[];rig.behaviors.push(behavior);return behavior;};
export const duplicateBehavior=(rig,index)=>{const source=rig.behaviors[index];if(!source)throw new Error('Behavior no longer exists.');const copy=normalizeBehavior({...structuredClone(source),id:null,name:`${source.name} Copy`});rig.behaviors.splice(index+1,0,copy);return copy;};
export const deleteBehavior=(rig,index)=>rig.behaviors.splice(index,1);
// A pair typed the wrong way round is a slip, not an intent, so it is put back
// in order rather than reported: the shortest first, for a drift's travel as
// for every type's rest.
export const clampBehavior=(behavior,param)=>{if(!param)return;for(const key of ['closedValue','min','max','offset'])if(Number.isFinite(behavior[key]))behavior[key]=Math.max(param.min,Math.min(param.max,behavior[key]));for(const [low,high] of [['intervalMin','intervalMax'],['travelMin','travelMax']])if(behavior[low]>behavior[high])[behavior[low],behavior[high]]=[behavior[high],behavior[low]];};
