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
  const configured=options.property||definition.drivers?.[control]?.property||Object.values(definition.bindings||{}).find((map)=>map[control])?.[control];
  const roles=Object.keys(definition.bindings||{}).filter((role)=>definition.bindings[role][control]);
  const conflicts=[];
  for(const role of roles){const elementId=part.roles[role],existing=rig.elements?.[elementId]?.bindings?.[configured];if(existing&&!(existing.generatedBy?.semanticPart===part.id&&existing.generatedBy?.control===control))conflicts.push({elementId,property:configured,owner:existing.generatedBy?{semanticPart:existing.generatedBy.semanticPart,control:existing.generatedBy.control}:{manual:true}});}
  if(conflicts.length){const error=new Error(`Semantic binding conflict: ${conflicts[0].elementId}.${conflicts[0].property} is already controlled.`);error.name='SemanticBindingConflict';error.conflicts=conflicts;throw error;}
  rig.params ||= {};
  if (!rig.params[control]) rig.params[control] = structuredClone(parameter);
  for (const state of Object.values(rig.states || {})) if (!(control in state)) state[control] = parameter.default;
  if (!part.controls.includes(control)) part.controls.push(control);
  part.controlDrivers[control]={method:configured==='morph'?'morph':'transform',property:configured,roles};
  const defaults=definition.drivers?.[control]||{};
  for (const role of roles) {
    const element = rig.elements?.[part.roles[role]], property = configured;
    if (!element || !property) continue;
    element.bindings ||= {};
    element.bindings[property] = { enabled: true, mode: 'simple', expression: control, curve: 'linear', amplitude: Number(options.amplitude ?? defaults.amplitude ?? (property.startsWith('scale') ? 1 : 8)), offset: Number(options.offset ?? defaults.offset ?? (property.startsWith('scale') ? 1 : 0)), generatedBy:{semanticPart:part.id,control} };
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
  const part = requiredPart(rig, partId); part.calibration = structuredClone(captures);
  const pointNames={headX:['left','right'],headY:['up','down'],headTilt:['tiltLeft','tiltRight'],lookX:['left','right'],lookY:['up','down'],browRaise:['low','raised'],browTilt:['tiltLeft','tiltRight'],jawOpen:['closed','open'],hairSway:['left','right'],hairLift:['low','high'],mouthOpen:['neutral','open'],eyeOpen:['closed','open']};
  const axes={translateX:'x',translateY:'y',rotation:'rotation',scaleX:'scaleX',scaleY:'scaleY',opacity:'opacity'};
  for(const control of part.controls||[]){const driver=part.controlDrivers?.[control];if(!driver||driver.method==='morph')continue;const property=driver.property,axis=axes[property];if(!axis)continue;const param=rig.params?.[control];if(!param)continue;let samples=captures[control]?.samples;
    for(const role of driver.roles||[]){const element=rig.elements?.[part.roles[role]];if(!element)continue;let roleSamples=samples?.map((sample)=>({value:Number(sample.value),pose:sample.pose?.[role]||sample.pose})).filter((sample)=>Number.isFinite(sample.value)&&sample.pose);
      if(!roleSamples?.length){const [lowName,highName]=pointNames[control]||[];const low=captures[lowName]?.[role],high=captures[highName]?.[role];if(!low&&!high)continue;roleSamples=[{value:param.min,pose:low},{value:param.max,pose:high}].filter((sample)=>sample.pose);}
      if(roleSamples.length<2)continue;const first=roleSamples[0],last=roleSamples.at(-1),neutral=['scaleX','scaleY','opacity'].includes(property)?1:0;const a=Number(first.pose?.[axis]??neutral),b=Number(last.pose?.[axis]??neutral),amplitude=(b-a)/(last.value-first.value||1),offset=a-first.value*amplitude;element.bindings||={};element.bindings[property]={enabled:true,mode:'simple',expression:control,curve:'linear',amplitude,offset,generatedBy:{semanticPart:part.id,control}};
    }
  }
  return part.calibration;
}
function rebuildGeneratedBindings(rig,part){
  for(const element of Object.values(rig.elements||{}))for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===part.id)delete element.bindings[property];
  const def=getSemanticPartDefinition(part.type);for(const control of part.controls||[]){const driver=part.controlDrivers?.[control],defaults=def.drivers?.[control]||{};for(const role of driver?.roles||[]){const element=rig.elements?.[part.roles[role]],property=driver.property||def.bindings?.[role]?.[control];if(!element||!property)continue;element.bindings||={};const existing=element.bindings[property];if(existing&&existing.generatedBy?.semanticPart!==part.id)continue;element.bindings[property]={enabled:true,mode:'simple',expression:control,curve:'linear',amplitude:defaults.amplitude??(property.startsWith('scale')?1:8),offset:defaults.offset??(property.startsWith('scale')?1:0),generatedBy:{semanticPart:part.id,control}};}}
}
export function renameSemanticParameterReferences(rig, from, to) {
  for (const part of Object.values(rig.semanticParts || {})) {part.controls = (part.controls || []).map((name) => name === from ? to : name);if(part.controlDrivers?.[from]){part.controlDrivers[to]=part.controlDrivers[from];delete part.controlDrivers[from];}if(part.calibration?.[from]){part.calibration[to]=part.calibration[from];delete part.calibration[from];}}
}
function requiredPart(rig, id) { const part = rig.semanticParts?.[id]; if (!part) throw new Error(`Semantic part "${id}" does not exist.`); return part; }
function uniqueId(parts, prefix) { let id = prefix, index = 2; while (parts[id]) id = `${prefix}-${index++}`; return id; }
