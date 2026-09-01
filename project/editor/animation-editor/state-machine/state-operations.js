import { addState, deleteState, duplicateState, renameState, setTransition } from '../../core/rig/project-model.js';

export const uniqueCopyName = (states, name) => {
  let candidate = `${name}-Copy`, suffix = 2;
  while (states[candidate]) candidate = `${name}-Copy-${suffix++}`;
  return candidate;
};
export const transitionImpact = (rig, name) => ({
  outgoing: (rig.transitions?.[name] || []).length,
  incoming: Object.values(rig.transitions || {}).filter(targets => targets?.includes(name)).length
});
export const createState = (rig, name, source = 'current') => addState(rig, name.trim(), source);
export const copyState = (rig, name) => { const copy=uniqueCopyName(rig.states, name); duplicateState(rig,name,copy); return copy; };
export const moveState = (rig, from, to) => renameState(rig, from, to.trim());
export const removeState = (rig, name) => { if(Object.keys(rig.states||{}).length<=1)throw new Error('The last State cannot be deleted.'); return deleteState(rig,name); };
export const addTransition = (rig, from, to) => { if(from===to)throw new Error('A State is already active; choose a different destination.'); setTransition(rig,from,to,{duration:300,easing:'easeInOut'}); };
export const removeTransition = (rig, from, to) => { rig.transitions[from]=(rig.transitions[from]||[]).filter(x=>x!==to); delete rig.transitionSettings?.[`${from}->${to}`]; };
export function stateProblems(rig) {
  const problems=[];
  for(const [from,targets] of Object.entries(rig.transitions||{})) for(const to of targets||[]) if(!rig.states?.[from]||!rig.states?.[to])problems.push(`Transition ${from} → ${to} points to a missing State.`);
  for(const [key,value] of Object.entries(rig.transitionSettings||{})){const [from,to]=key.split('->');if(!(rig.transitions?.[from]||[]).includes(to))problems.push(`Settings for ${from} → ${to} have no edge.`);if(!Number.isFinite(Number(value.duration))||Number(value.duration)<0)problems.push(`${key} has an invalid duration.`);if(!['linear','easeIn','easeOut','easeInOut'].includes(value.easing))problems.push(`${key} has invalid easing.`);}
  return problems;
}
