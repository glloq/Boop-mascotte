import { getSemanticPartDefinition } from './part-registry.js';
import { canMorphPaths } from '../../core/morph/path-morph.js';

function layerContains(items, ancestorId, elementId, inside = false) {
  for (const item of items || []) {
    const nextInside = inside || item.id === ancestorId;
    if (nextInside && item.id === elementId) return true;
    if (layerContains(item.children, ancestorId, elementId, nextInside)) return true;
  }
  return false;
}

/** The part this exact artwork plays a role in, if any. */
export function findSemanticPartByRole(state, elementId) {
  if (!elementId) return null;
  return Object.values(state?.semanticParts || {}).find((part) => Object.values(part.roles || {}).includes(elementId)) || null;
}

/**
 * Return the most specific semantic Face Part that owns clicked artwork.
 *
 * Clicking anything inside a part's group means that part, which is what
 * selection wants. When the question is "what is *this shape*", ask
 * `findSemanticPartByRole` instead: everything drawn on a face is inside the
 * head group, so the containing part would answer "the head" for all of it.
 */
export function findSemanticPartByElement(state, elementId) {
  if (!elementId) return null;
  const parts = Object.values(state.semanticParts || {});
  const exact = findSemanticPartByRole(state, elementId);
  if (exact) return exact;
  return parts.find((part) => Object.values(part.roles || {}).some((roleId) => layerContains(state.layers, roleId, elementId))) || null;
}

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
  const occupied = elementId && Object.entries(part.roles || {}).find(([candidate, id]) => candidate !== role && id === elementId);
  if (occupied) throw new Error(`This artwork is already used by ${occupied[0]}. Choose another element.`);
  const old=part.roles[role]; if (elementId) part.roles[role] = elementId; else delete part.roles[role];
  if(old!==elementId) rebuildGeneratedBindings(rig,part);
  return part;
}

/**
 * How a control reaches the artwork.
 *
 * `transform` writes a generated binding; `morph` owns the element's single
 * legacy A/B shape; `shapeKey` owns V2 shape keys, which are additive — a
 * mouth can carry Open and Smile at once, which two transforms or one morph
 * cannot do.
 */
const driverMethod = (property) => (property === 'morph' ? 'morph' : property === 'shapeKey' ? 'shapeKey' : 'transform');

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
  const method=driverMethod(configured);
  part.controlDrivers[control]={method,property:configured,roles};
  const defaults=definition.drivers?.[control]||{};
  // A shaped control writes no transform: the shape keys are the movement.
  if (method !== 'transform') return rig.params[control];
  for (const role of roles) {
    const element = rig.elements?.[part.roles[role]], property = configured;
    if (!element || !property) continue;
    element.bindings ||= {};
    element.bindings[property] = { enabled: true, mode: 'simple', expression: control, curve: 'linear', amplitude: Number(options.amplitude ?? defaults.amplitude ?? (property.startsWith('scale') ? 1 : 8)), offset: Number(options.offset ?? defaults.offset ?? (property.startsWith('scale') ? 1 : 0)), generatedBy:{semanticPart:part.id,control} };
  }
  return rig.params[control];
}

const humanControl=(control)=>String(control).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,(c)=>c.toUpperCase());

export function setSemanticControlMethod(rig, partId, control, property) {
  const part=requiredPart(rig,partId), definition=getSemanticPartDefinition(part.type);
  if(!part.controls.includes(control))throw new Error(`Control "${control}" is not enabled.`);
  const strategies=definition.strategies?.[control]||[definition.drivers?.[control]?.property].filter(Boolean);
  if(!strategies.includes(property))throw new Error(`Method "${property}" is not supported by ${control}.`);
  const roles=Object.keys(definition.bindings||{}).filter((role)=>definition.bindings[role][control]);
  if(property==='shapeKey'){
    // Both shape methods deform a path; only the legacy one is limited to one
    // per element, so a shape key needs no ownership check.
    const invalid=roles.map((role)=>part.roles[role]).filter((id)=>id&&rig.elements?.[id]?.meta?.nodeType!=='path');
    if(invalid.length){const error=new Error('Shape keys deform an SVG path.');error.name='SemanticMorphEligibilityError';throw error;}
  } else if(property==='morph'){
    const invalid=roles.map((role)=>part.roles[role]).filter((id)=>id&&rig.elements?.[id]?.meta?.nodeType!=='path');
    if(invalid.length){const error=new Error('Morph requires an SVG path.');error.name='SemanticMorphEligibilityError';throw error;}
    // One shape slot per element: a morph owned by another control (or authored by hand) must be freed first, never replaced silently.
    const owned=roles.map((role)=>part.roles[role]).filter(Boolean).map((elementId)=>({elementId,morph:rig.elements?.[elementId]?.morph})).filter(({morph})=>morph&&!(morph.generatedBy?.semanticPart===part.id&&morph.generatedBy?.control===control));
    if(owned.length){const owner=owned[0].morph.generatedBy;const error=new Error(`${owned[0].elementId} shape is already used by ${owner?.control?humanControl(owner.control):'a manual morph'}. Switch it to another method first.`);error.name='SemanticMorphOwnershipConflict';error.conflicts=owned.map(({elementId,morph})=>({elementId,property:'morph',owner:morph.generatedBy||{manual:true}}));throw error;}
  } else {
    const conflicts=roles.map((role)=>part.roles[role]).filter(Boolean).map((elementId)=>({elementId,binding:rig.elements?.[elementId]?.bindings?.[property]})).filter(({binding})=>binding&&!(binding.generatedBy?.semanticPart===part.id&&binding.generatedBy?.control===control));
    if(conflicts.length){const error=new Error(`${conflicts[0].elementId}.${property} is already controlled.`);error.name='SemanticBindingConflict';error.conflicts=conflicts.map(({elementId,binding})=>({elementId,property,owner:binding.generatedBy?binding.generatedBy:{manual:true}}));throw error;}
  }
  cleanupOwnedDriver(rig,part.id,control);
  part.controlDrivers[control]={method:driverMethod(property),property,roles};
  delete part.calibration?.[control];
  if(driverMethod(property)==='transform') rebuildGeneratedBindings(rig,part);
  return part.controlDrivers[control];
}

export function captureSemanticMorph(rig, partId, control, pose, pathByRole) {
  const part=requiredPart(rig,partId),driver=part.controlDrivers?.[control];
  if(driver?.method!=='morph')throw new Error(`${control} is not using Morph.`);
  const orientation=control==='eyeOpen'?{closed:'pathA',open:'pathB'}:{neutral:'pathA',closed:'pathA',open:'pathB'};
  const slot=orientation[pose];if(!slot)throw new Error(`Unknown morph pose "${pose}".`);
  part.calibration[control]||={};part.calibration[control][pose]=structuredClone(pathByRole);
  for(const role of driver.roles){const id=part.roles[role],element=rig.elements?.[id],path=pathByRole[role];if(!id||!element||element.meta?.nodeType!=='path'||!path)continue;
    const previous=element.morph?.generatedBy?.semanticPart===part.id&&element.morph.generatedBy.control===control?element.morph:{};
    element.morph={...previous,enabled:false,param:control,min:0,max:1,[slot]:path,generatedBy:{semanticPart:part.id,control}};
    if(element.morph.pathA&&element.morph.pathB){element.morph.compatible=canMorphPaths(element.morph.pathA,element.morph.pathB);element.morph.enabled=element.morph.compatible;}
  }
  return driver.roles.every((role)=>{const morph=rig.elements?.[part.roles[role]]?.morph;return morph?.enabled&&morph.compatible;});
}

export function resetSemanticMorph(rig,partId,control){const part=requiredPart(rig,partId);cleanupOwnedDriver(rig,part.id,control);delete part.calibration?.[control];}

function cleanupOwnedDriver(rig,partId,control){
  for(const element of Object.values(rig.elements||{})){for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===partId&&binding.generatedBy?.control===control)delete element.bindings[property];if(element.morph?.generatedBy?.semanticPart===partId&&element.morph.generatedBy?.control===control)delete element.morph;}
  // Shape keys are owned the same way, so switching a control's method takes
  // its shapes with it rather than leaving them deforming the artwork.
  if(Array.isArray(rig.shapeKeys))rig.shapeKeys=rig.shapeKeys.filter((key)=>!(key?.generatedBy?.semanticPart===partId&&key?.generatedBy?.control===control));
}

export function removeSemanticPart(rig, partId) {
  const part = requiredPart(rig, partId); delete rig.semanticParts[partId];
  for(const element of Object.values(rig.elements||{}))for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===partId)delete element.bindings[property];
  for(const element of Object.values(rig.elements||{}))if(element.morph?.generatedBy?.semanticPart===partId)delete element.morph;
  for (const control of part.controls || []) dropUnreferencedParameter(rig, control);
  return part;
}

/** Parameters stay while any part, binding, morph, clip or behavior still uses them. */
export function isParameterReferenced(rig, control) {
  return Object.values(rig.semanticParts || {}).some((candidate) => candidate.controls?.includes(control)) ||
    Object.values(rig.elements||{}).some((element)=>Object.values(element.bindings||{}).some((binding)=>binding.expression===control)) ||
    Object.values(rig.elements||{}).some((element)=>element.morph?.param===control) || (rig.shapeKeys||[]).some((key)=>key?.driver?.parameter===control) || (rig.animationClips || []).some((clip) => control in (clip.tracks || {})) ||
    (rig.behaviors||[]).some((behavior)=>behavior.parameter===control);
}
function dropUnreferencedParameter(rig, control) {
  if (isParameterReferenced(rig, control)) return false;
  delete rig.params?.[control];
  for (const pose of Object.values(rig.states || {})) delete pose[control];
  return true;
}

/** Inverse of enableSemanticControl: removes the owned driver, its calibration and an orphaned parameter. */
export function disableSemanticControl(rig, partId, control) {
  const part = requiredPart(rig, partId);
  if (!part.controls?.includes(control)) throw new Error(`Control "${control}" is not enabled.`);
  cleanupOwnedDriver(rig, part.id, control);
  part.controls = part.controls.filter((name) => name !== control);
  delete part.controlDrivers?.[control];
  delete part.calibration?.[control];
  dropUnreferencedParameter(rig, control);
  return part;
}

/** Forget captured poses and regenerate the registry default movement for one transform control. */
export function resetSemanticCalibration(rig, partId, control) {
  const part = requiredPart(rig, partId), driver = part.controlDrivers?.[control];
  if (!driver) throw new Error(`Control "${control}" is not enabled.`);
  if (driver.method === 'morph' || driver.method === 'shapeKey') { resetSemanticMorph(rig, partId, control); return part; }
  delete part.calibration?.[control];
  rebuildGeneratedBindings(rig, part);
  return part;
}
/**
 * Solve one transform control from its canonical calibration record.
 *
 * Calibration is intentionally control-scoped.  Callers must never pass the
 * old, ambiguous `{ left, center, right }` capture bag: each control owns a
 * `{ samples: [{ key, value, pose: { [role]: transform } }] }` record.
 */
export function calibrateSemanticPart(rig, partId, control, calibration = null) {
  const part = requiredPart(rig, partId);
  if (typeof control !== 'string') throw new TypeError('A calibration control name is required.');
  const driver=part.controlDrivers?.[control];
  if(!driver||driver.method==='morph')throw new Error(`Control "${control}" does not use transform calibration.`);
  const record=structuredClone(calibration || part.calibration?.[control]);
  if(!record||!Array.isArray(record.samples))throw new TypeError(`Calibration for "${control}" must contain samples.`);
  const samples=record.samples.filter(sample=>Number.isFinite(Number(sample?.value))&&sample?.pose).sort((a,b)=>Number(a.value)-Number(b.value));
  if(samples.length<2)throw new Error(`Calibration for "${control}" requires at least two samples.`);
  record.samples=samples;
  part.calibration ||= {};
  part.calibration[control]=record;
  const axes={translateX:'x',translateY:'y',rotation:'rotation',scaleX:'scaleX',scaleY:'scaleY',opacity:'opacity'};
  const property=driver.property,axis=axes[property];if(!axis)return record;
  for(const role of driver.roles||[]){const element=rig.elements?.[part.roles[role]];if(!element)continue;const roleSamples=samples.map((sample)=>({value:Number(sample.value),pose:sample.pose?.[role]})).filter((sample)=>sample.pose);
    if(roleSamples.length<2)continue;const first=roleSamples[0],last=roleSamples.at(-1),neutral=['scaleX','scaleY','opacity'].includes(property)?1:0;const a=Number(first.pose?.[axis]??neutral),b=Number(last.pose?.[axis]??neutral),amplitude=(b-a)/(last.value-first.value||1),offset=a-first.value*amplitude;element.bindings||={};element.bindings[property]={enabled:true,mode:'simple',expression:control,curve:'linear',amplitude,offset,generatedBy:{semanticPart:part.id,control}};
  }
  return record;
}
function rebuildGeneratedBindings(rig,part){
  for(const element of Object.values(rig.elements||{}))for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===part.id)delete element.bindings[property];
  const def=getSemanticPartDefinition(part.type);for(const control of part.controls||[]){const driver=part.controlDrivers?.[control],defaults=def.drivers?.[control]||{};if(driver&&driver.method!=='transform')continue;for(const role of driver?.roles||[]){const element=rig.elements?.[part.roles[role]],property=driver.property||def.bindings?.[role]?.[control];if(!element||!property)continue;element.bindings||={};const existing=element.bindings[property];if(existing&&existing.generatedBy?.semanticPart!==part.id)continue;element.bindings[property]={enabled:true,mode:'simple',expression:control,curve:'linear',amplitude:defaults.amplitude??(property.startsWith('scale')?1:8),offset:defaults.offset??(property.startsWith('scale')?1:0),generatedBy:{semanticPart:part.id,control}};}}
}
export function renameSemanticParameterReferences(rig, from, to) {
  for (const part of Object.values(rig.semanticParts || {})) {part.controls = (part.controls || []).map((name) => name === from ? to : name);if(part.controlDrivers?.[from]){part.controlDrivers[to]=part.controlDrivers[from];delete part.controlDrivers[from];}if(part.calibration?.[from]){part.calibration[to]=part.calibration[from];delete part.calibration[from];}}
}
function requiredPart(rig, id) { const part = rig.semanticParts?.[id]; if (!part) throw new Error(`Semantic part "${id}" does not exist.`); return part; }
function uniqueId(parts, prefix) { let id = prefix, index = 2; while (parts[id]) id = `${prefix}-${index++}`; return id; }
