import { addTransition, copyState, createState, moveState, removeState, removeTransition } from './state-operations.js';

const EASINGS = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut']);

/** Intent-specific ProjectDocument commands for State and Transition authoring. */
export function createStateMachineCommands(store, history) {
  function run(type, preflight, apply) {
    const candidate = structuredClone(store.getDocument());
    const prepared = preflight(candidate);
    history.snapshot();
    let result;
    store.execute({ type, source: 'state-machine', domains: ['stateMachine'], apply(document) { result = apply(document, prepared); } });
    return result ?? true;
  }
  const state = name => { if (!store.getDocument().states?.[name]) throw new Error(`State "${name}" does not exist.`); return name; };
  const edge = (from, to) => { state(from); state(to); if (from === to) throw new Error('A State is already active; choose a different destination.'); return `${from}->${to}`; };
  return {
    create(name, source='current') { name=name.trim(); return run('state/create', d=>createState(d,name,source), d=>createState(d,name,source)); },
    rename(from, to) { to=to.trim(); return run('state/rename', d=>moveState(d,from,to), d=>moveState(d,from,to)); },
    duplicate(name) { return run('state/duplicate', d=>copyState(d,name), d=>copyState(d,name)); },
    delete(name) { return run('state/delete', d=>removeState(d,name), d=>removeState(d,name)); },
    reset(name) { return run('state/reset', d=>{state.call(null,name); return Object.keys(d.params);}, (d,keys)=>{for(const key of keys)d.states[name][key]=d.params[key].default;}); },
    setParameter(name, parameter, value) {
      const preflight=d=>{if(!d.states?.[name])throw new Error(`State "${name}" does not exist.`);const p=d.params?.[parameter];if(!p)throw new Error(`Parameter "${parameter}" does not exist.`);const n=Number(value);if(!Number.isFinite(n))throw new Error('State parameter value must be numeric.');return Math.max(p.min,Math.min(p.max,n));};
      return run('state/set-parameter', preflight, (d,n)=>{d.states[name][parameter]=n;return n;});
    },
    setInitial(name) { return run('state/set-initial', d=>{if(!d.states?.[name])throw new Error(`State "${name}" does not exist.`);}, d=>{d.activeState=name;}); },
    addTransition(from,to) { return run('transition/add', ()=>edge(from,to), d=>addTransition(d,from,to)); },
    deleteTransition(from,to) { return run('transition/delete', d=>{edge(from,to);if(!(d.transitions?.[from]||[]).includes(to))throw new Error('Transition no longer exists.');}, d=>removeTransition(d,from,to)); },
    updateTransition(from,to,field,value) {
      const preflight=d=>{edge(from,to);if(!(d.transitions?.[from]||[]).includes(to))throw new Error('Transition no longer exists.');if(field==='duration'){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error('Transition duration must be zero or greater.');return n;}if(field==='easing'&&EASINGS.has(value))return value;throw new Error('Invalid transition setting.');};
      return run('transition/update-settings',preflight,(d,v)=>{d.transitionSettings[`${from}->${to}`]||={duration:300,easing:'easeInOut'};d.transitionSettings[`${from}->${to}`][field]=v;});
    }
  };
}
