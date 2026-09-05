import { driverProperties, getSemanticPartDefinition, semanticDriverProperties, sideParameterName, sideParametersFor, supportsSideControl } from './part-registry.js';
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
  // A control usually writes one property; a pupil that scales writes two.
  const properties=semanticDriverProperties(definition,control,options);
  const configured=properties[0];
  const roles=Object.keys(definition.bindings||{}).filter((role)=>definition.bindings[role][control]);
  const conflicts=[];
  for(const role of roles)for(const property of properties){const elementId=part.roles[role],existing=rig.elements?.[elementId]?.bindings?.[property];if(existing&&!(existing.generatedBy?.semanticPart===part.id&&existing.generatedBy?.control===control))conflicts.push({elementId,property,owner:existing.generatedBy?{semanticPart:existing.generatedBy.semanticPart,control:existing.generatedBy.control}:{manual:true}});}
  if(conflicts.length){const error=new Error(`Semantic binding conflict: ${conflicts[0].elementId}.${conflicts[0].property} is already controlled.`);error.name='SemanticBindingConflict';error.conflicts=conflicts;throw error;}
  rig.params ||= {};
  if (!rig.params[control]) rig.params[control] = structuredClone(parameter);
  for (const state of Object.values(rig.states || {})) if (!(control in state)) state[control] = parameter.default;
  if (!part.controls.includes(control)) part.controls.push(control);
  const method=driverMethod(configured);
  // `properties` is written only when there is more than one, so every driver a
  // project already carries keeps exactly the shape it was saved with.
  part.controlDrivers[control]={method,property:configured,...(properties.length>1?{properties}:{}),roles};
  const defaults=definition.drivers?.[control]||{};
  // A shaped control writes no transform: the shape keys are the movement.
  if (method !== 'transform') return rig.params[control];
  for (const role of roles) for (const property of properties) {
    const element = rig.elements?.[part.roles[role]];
    if (!element || !property) continue;
    element.bindings ||= {};
    element.bindings[property] = { enabled: true, mode: 'simple', expression: controlExpression(definition, part, control, role), curve: 'linear', amplitude: Number(options.amplitude ?? defaults.amplitude ?? (property.startsWith('scale') ? 1 : 8)), offset: Number(options.offset ?? defaults.offset ?? (property.startsWith('scale') ? 1 : 0)), generatedBy:{semanticPart:part.id,control} };
  }
  return rig.params[control];
}

/**
 * What a generated binding is driven by.
 *
 * The shared control on its own, or the shared control plus this side's own
 * offset once an author has asked for per-side movement. Adding rather than
 * multiplying keeps the shared control's meaning exactly as it was, and keeps
 * a rig that has never heard of side parameters behaving identically.
 */
export function controlExpression(definition, part, control, role) {
  const side = definition?.sides?.[role];
  return side && part?.sides?.[control] ? `${control} + ${sideParameterName(control, side)}` : control;
}

/**
 * Let one side of a symmetric movement move on its own.
 *
 * A blink closes both eyes because one parameter drives every role that
 * carries it. A **wink** needs the two eyes to disagree, so each side gets an
 * offset parameter that is added inside its own binding's expression. The
 * shared control keeps its meaning and its range; the offsets default to 0, so
 * turning this on changes nothing until an author moves one.
 */
export function enableSemanticSideControl(rig, partId, control) {
  const part = requiredPart(rig, partId), definition = getSemanticPartDefinition(part.type);
  if (!supportsSideControl(definition, control)) throw new Error(`"${control}" has no sides to move on their own.`);
  if (!part.controls?.includes(control)) throw new Error(`Control "${control}" is not enabled.`);
  if (part.controlDrivers?.[control]?.method !== 'transform') throw new Error('Only a movement that writes a transform can move one side on its own.');
  const shared = rig.params?.[control] || definition.parameters[control];
  // The offset that can take one side from any point of the shared range to
  // any other, which is what a wink from a fully open eye needs.
  const span = Number(shared.max) - Number(shared.min);
  const parameter = { type: 'number', min: -span, max: span, default: 0, value: 0 };
  rig.params ||= {};
  for (const name of sideParametersFor(definition, control)) {
    if (!rig.params[name]) rig.params[name] = structuredClone(parameter);
    for (const pose of Object.values(rig.states || {})) if (!(name in pose)) pose[name] = 0;
  }
  part.sides ||= {};
  part.sides[control] = true;
  rebuildGeneratedBindings(rig, part);
  return sideParametersFor(definition, control);
}

/** Back to one movement for both sides, taking the offsets with it. */
export function disableSemanticSideControl(rig, partId, control) {
  const part = requiredPart(rig, partId), definition = getSemanticPartDefinition(part.type);
  if (!part.sides?.[control]) return false;
  delete part.sides[control];
  if (!Object.keys(part.sides).length) delete part.sides;
  rebuildGeneratedBindings(rig, part);
  for (const name of sideParametersFor(definition, control)) dropUnreferencedParameter(rig, name);
  return true;
}

/** Which movements of this part currently move one side at a time. */
export const semanticSideControls = (part) => Object.keys(part?.sides || {});

const humanControl=(control)=>String(control).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,(c)=>c.toUpperCase());

export function setSemanticControlMethod(rig, partId, control, property) {
  const part=requiredPart(rig,partId), definition=getSemanticPartDefinition(part.type);
  if(!part.controls.includes(control))throw new Error(`Control "${control}" is not enabled.`);
  const strategies=definition.strategies?.[control]||semanticDriverProperties(definition,control);
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
    Object.values(rig.elements||{}).some((element)=>Object.values(element.bindings||{}).some((binding)=>new RegExp(`\\b${control}\\b`).test(String(binding.expression||'')))) ||
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
  // Reset is the one rebuild that *is* about how far it moves: back to the
  // registry's own numbers, not to whatever the calibration solved.
  rebuildGeneratedBindings(rig, part, { amplitudes: 'default' });
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
  const part = requiredPart(rig, partId), def = getSemanticPartDefinition(part.type);
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
  // Every property the driver writes is solved from the same captures: a
  // two-axis movement has one calibration and two bindings, not two records.
  const properties=driverProperties(driver).filter((name)=>axes[name]);if(!properties.length)return record;
  for(const role of driver.roles||[])for(const property of properties){const axis=axes[property],element=rig.elements?.[part.roles[role]];if(!element)continue;const roleSamples=samples.map((sample)=>({value:Number(sample.value),pose:sample.pose?.[role]})).filter((sample)=>sample.pose);
    if(roleSamples.length<2)continue;const first=roleSamples[0],last=roleSamples.at(-1),neutral=['scaleX','scaleY','opacity'].includes(property)?1:0;const a=Number(first.pose?.[axis]??neutral),b=Number(last.pose?.[axis]??neutral),amplitude=(b-a)/(last.value-first.value||1),offset=a-first.value*amplitude;element.bindings||={};element.bindings[property]={enabled:true,mode:'simple',expression:controlExpression(def,part,control,role),curve:'linear',amplitude,offset,generatedBy:{semanticPart:part.id,control}};
  }
  return record;
}
/**
 * Rewrite the bindings a part owns, keeping how far each one moves.
 *
 * A rebuild is about *what drives* a binding -- a role reassigned, a side
 * offset switched on -- never about how much it moves. Rewriting the amplitude
 * from the registry defaults threw a calibration away, and a template's own
 * numbers with it: the eyelids travel 42 units and the default is 8, so
 * turning on the wink used to leave the eyes unable to close.
 */
function rebuildGeneratedBindings(rig,part,{amplitudes='keep'}={}){
  // What each owned binding was set to, before they are cleared: the rebuild
  // decides what drives them, not how far they move.
  const previous=new Map();
  for(const [elementId,element] of Object.entries(rig.elements||{}))for(const [property,binding] of Object.entries(element.bindings||{}))if(binding.generatedBy?.semanticPart===part.id){previous.set(`${elementId}:${property}`,binding);delete element.bindings[property];}
  const def=getSemanticPartDefinition(part.type);for(const control of part.controls||[]){const driver=part.controlDrivers?.[control],defaults=def.drivers?.[control]||{};if(driver&&driver.method!=='transform')continue;for(const role of driver?.roles||[])for(const property of (driverProperties(driver).length?driverProperties(driver):semanticDriverProperties(def,control))){const elementId=part.roles[role],element=rig.elements?.[elementId];if(!element||!property)continue;element.bindings||={};const kept=amplitudes==='keep'?(element.bindings[property]||previous.get(`${elementId}:${property}`)):null;const existing=element.bindings[property]||kept;if(existing&&existing.generatedBy?.semanticPart!==part.id)continue;element.bindings[property]={enabled:true,mode:'simple',expression:controlExpression(def,part,control,role),curve:kept?.curve||'linear',amplitude:kept?.amplitude??defaults.amplitude??(property.startsWith('scale')?1:8),offset:kept?.offset??defaults.offset??(property.startsWith('scale')?1:0),generatedBy:{semanticPart:part.id,control}};}}
}
export function renameSemanticParameterReferences(rig, from, to) {
  for (const part of Object.values(rig.semanticParts || {})) {part.controls = (part.controls || []).map((name) => name === from ? to : name);if(part.controlDrivers?.[from]){part.controlDrivers[to]=part.controlDrivers[from];delete part.controlDrivers[from];}if(part.calibration?.[from]){part.calibration[to]=part.calibration[from];delete part.calibration[from];}}
}
function requiredPart(rig, id) { const part = rig.semanticParts?.[id]; if (!part) throw new Error(`Semantic part "${id}" does not exist.`); return part; }
function uniqueId(parts, prefix) { let id = prefix, index = 2; while (parts[id]) id = `${prefix}-${index++}`; return id; }
