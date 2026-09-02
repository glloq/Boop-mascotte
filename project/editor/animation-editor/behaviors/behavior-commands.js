import { addBehavior, clampBehavior, deleteBehavior, duplicateBehavior } from './behavior-operations.js';

const TYPES = new Set(['blink','randomIdle','oscillator']);
const FIELDS = new Set(['name','parameter','intervalMin','intervalMax','duration','closedValue','min','max','amplitude','offset','frequency']);
const NUMERIC = new Set(['intervalMin','intervalMax','duration','closedValue','min','max','amplitude','offset','frequency']);

/** Intent-specific ProjectDocument commands shared by both Behavior UIs. */
export function createBehaviorCommands(store, history) {
  function run(type, preflight, apply) {
    const candidate=structuredClone(store.getDocument());const prepared=preflight(candidate);
    history.snapshot();let result;
    store.execute({type,source:'behaviors',domains:['stateMachine'],apply(document){result=apply(document,prepared);}});
    return result ?? true;
  }
  const existing=(d,index)=>{if(!Number.isInteger(index)||!d.behaviors?.[index])throw new Error('Behavior no longer exists.');return d.behaviors[index];};
  return {
    add(type){return run('behavior/add',()=>{if(!TYPES.has(type))throw new Error('Unsupported Behavior type.');},d=>addBehavior(d,type));},
    duplicate(index){return run('behavior/duplicate',d=>existing(d,index),d=>duplicateBehavior(d,index));},
    delete(index){return run('behavior/delete',d=>existing(d,index),d=>deleteBehavior(d,index));},
    updateField(index,field,value){return run('behavior/update-field',d=>{existing(d,index);if(!FIELDS.has(field))throw new Error('Behavior field is not editable.');if(field==='parameter'&&!d.params?.[value])throw new Error('Behavior target parameter does not exist.');if(NUMERIC.has(field)){value=Number(value);if(!Number.isFinite(value))throw new Error('Behavior value must be numeric.');}return value;},(d,v)=>{const b=existing(d,index);b[field]=v;clampBehavior(b,d.params[b.parameter]);return b;});},
    setEnabled(index,enabled){return run('behavior/set-enabled',d=>existing(d,index),d=>{existing(d,index).enabled=Boolean(enabled);});}
  };
}
