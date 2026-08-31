import { getSemanticPartDefinition } from './part-registry.js';

export function createSemanticPart(rig, type, options = {}) {
  const definition = getSemanticPartDefinition(type);
  rig.semanticParts ||= {};
  const id = options.id || uniqueId(rig.semanticParts, type);
  if (rig.semanticParts[id]) throw new Error(`Semantic part "${id}" already exists.`);
  const part = { id, type, name: options.name || definition.displayName, roles: {}, controls: [], controlDrivers: {}, calibration: {}, advanced: false };
  rig.semanticParts[id] = part;
  return part;
}

export function assignSemanticRole(rig, partId, role, elementId) {
  const part = requiredPart(rig, partId), definition = getSemanticPartDefinition(part.type);
  if (!definition.roles.includes(role)) throw new Error(`Role "${role}" is not supported by ${part.type}.`);
  if (elementId && !rig.elements?.[elementId]) throw new Error(`Element "${elementId}" does not exist.`);
  const old=part.roles[role]; if (elementId) part.roles[role] = elementId; else delete part.roles[role];
  if(old!==elementId) rebuildGeneratedBindings(rig,part);
  return part;
}

export function enableSemanticControl(rig, partId, control, options = {}) {
  const part = requiredPart(rig, partId), definition = getSemanticPartDefinition(part.type);
  if (!definition.controls.includes(control)) throw new Error(`Control "${control}" is not supported by ${part.type}.`);
  const parameter = definition.parameters[control];
  rig.params ||= {};
  if (!rig.params[control]) rig.params[control] = structuredClone(parameter);
  for (const state of Object.values(rig.states || {})) if (!(control in state)) state[control] = parameter.default;
  if (!part.controls.includes(control)) part.controls.push(control);
  const configured=options.property||Object.values(definition.bindings||{}).find((map)=>map[control])?.[control];
  part.controlDrivers[control]={method:configured==='morph'?'morph':'transform',property:configured,roles:Object.keys(definition.bindings||{}).filter((role)=>definition.bindings[role][control])};
  for (const [role, mapping] of Object.entries(definition.bindings || {})) {
    const element = rig.elements?.[part.roles[role]], property = mapping[control];
    if (!element || !property) continue;
    element.bindings ||= {};
    element.bindings[property] = { enabled: true, mode: 'simple', expression: control, curve: 'linear', amplitude: Number(options.amplitude ?? (property.startsWith('scale') ? 1 : 8)), offset: Number(options.offset ?? (property.startsWith('scale') ? 1 : 0)), generatedBy:{semanticPart:part.id,control} };
  }
  return rig.params[control];
}

export function removeSemanticPart(rig, partId) {
  const part = requiredPart(rig, partId); delete rig.semanticParts[partId];
  for(const element of Object.values(rig.elements||{}))for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===partId)delete element.bindings[property];
  for(const element of Object.values(rig.elements||{}))if(element.morph?.generatedBy?.semanticPart===partId)delete element.morph;
  for (const control of part.controls || []) {
    const referenced = Object.values(rig.semanticParts || {}).some((candidate) => candidate.controls?.includes(control)) ||
      Object.values(rig.elements||{}).some((element)=>Object.values(element.bindings||{}).some((binding)=>binding.expression===control)) ||
      Object.values(rig.elements||{}).some((element)=>element.morph?.param===control) || (rig.animationClips || []).some((clip) => control in (clip.tracks || {})) ||
      (rig.behaviors||[]).some((behavior)=>behavior.parameter===control);
    if (!referenced){delete rig.params?.[control];for(const pose of Object.values(rig.states||{}))delete pose[control];}
  }
  return part;
}
export function calibrateSemanticPart(rig, partId, captures) {
  const part = requiredPart(rig, partId); part.calibration = structuredClone(captures); const center = captures.center || captures.neutral || {};
  for (const [role, elementId] of Object.entries(part.roles)) {
    const element = rig.elements?.[elementId]; if (!element) continue; const c = center[role] || {};
    const set = (property, parameter, a, b, axis,low=-1,high=1) => { if (!a && !b) return;const neutral=property.startsWith('scale')||property==='opacity'?1:0;const av=a?.[axis]??c[axis]??neutral,bv=b?.[axis]??c[axis]??neutral; element.bindings ||= {}; element.bindings[property] = { enabled:true,mode:'simple',expression:parameter,curve:'linear',amplitude:(bv-av)/(high-low||1),offset:av-low*(bv-av)/(high-low||1),generatedBy:{semanticPart:part.id,control:parameter} }; };
    set('translateX', 'lookX', captures.left?.[role], captures.right?.[role], 'x');
    set('translateY', 'lookY', captures.up?.[role], captures.down?.[role], 'y');
  }
  return part.calibration;
}
function rebuildGeneratedBindings(rig,part){
  for(const element of Object.values(rig.elements||{}))for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===part.id)delete element.bindings[property];
  const def=getSemanticPartDefinition(part.type);for(const control of part.controls||[]){const driver=part.controlDrivers?.[control];for(const role of driver?.roles||[]){const element=rig.elements?.[part.roles[role]],property=driver.property||def.bindings?.[role]?.[control];if(!element||!property)continue;element.bindings||={};element.bindings[property]={enabled:true,mode:'simple',expression:control,curve:'linear',amplitude:property.startsWith('scale')?1:8,offset:property.startsWith('scale')?1:0,generatedBy:{semanticPart:part.id,control}};}}
}
export function renameSemanticParameterReferences(rig, from, to) {
  for (const part of Object.values(rig.semanticParts || {})) part.controls = (part.controls || []).map((name) => name === from ? to : name);
}
function requiredPart(rig, id) { const part = rig.semanticParts?.[id]; if (!part) throw new Error(`Semantic part "${id}" does not exist.`); return part; }
function uniqueId(parts, prefix) { let id = prefix, index = 2; while (parts[id]) id = `${prefix}-${index++}`; return id; }
