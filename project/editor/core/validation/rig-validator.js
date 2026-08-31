import { BINDING_PROPERTIES, CURVES, normalizeBinding, parseExpression } from '../../../runtime/runtime.js';
import { validateParameter } from '../rig/parameters.js';
import { SUPPORTED_SEMANTIC_DRIVER_PROPERTIES } from '../../rig-editor/semantic-parts/part-registry.js';

export function validateElementRig(element, id = 'element', params = {}) {
  const issues = [];
  for (const property of BINDING_PROPERTIES) {
    if (element.bindings?.[property] === undefined) continue;
    const raw = element.bindings[property], binding = normalizeBinding(raw, element.bindingCurves?.[property]);
    if (typeof raw === 'object' && !Number.isFinite(Number(raw.amplitude))) issues.push(`binding ${property} amplitude must be finite.`);
    if (typeof raw === 'object' && !Number.isFinite(Number(raw.offset))) issues.push(`binding ${property} offset must be finite.`);
    if (typeof raw === 'object' && !CURVES.includes(raw.curve)) issues.push(`binding ${property} has unknown curve "${raw.curve}".`);
    try {
      const parsed = parseExpression(binding.expression);
      parsed.variables.filter((name) => !(name in params)).forEach((name) => issues.push(`binding ${property} references unknown parameter "${name}".`));
    } catch (error) { issues.push(`binding ${property} expression contains unsupported characters or ${error.message}.`); }
  }
  const base = element.baseTransform || element;
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'pivotX', 'pivotY']) if (!Number.isFinite(Number(base[key]))) issues.push(`baseTransform.${key} must be finite.`);
  if (Number(base.scaleX) === 0 || Number(base.scaleY) === 0) issues.push('base scale cannot be zero.');
  if (element.morph?.enabled && (!element.morph.pathA || !element.morph.pathB)) issues.push('Morph is enabled but pathA/pathB is missing.');
  if (element.morph?.enabled && element.morph.max === element.morph.min) issues.push('Morph min and max cannot be equal.');
  return issues;
}

export function validateRig(state) {
  const issues = [];
  Object.entries(state.params || {}).forEach(([name, param]) => validateParameter(name, param).forEach((issue) => issues.push(issue)));
  Object.entries(state.elements || {}).forEach(([id, element]) => {
    validateElementRig(element, id, state.params).forEach((issue) => issues.push(`Element "${id}": ${issue}`));
    if (element.symmetryPeer && !state.elements[element.symmetryPeer]) issues.push(`Element "${id}": symmetryPeer "${element.symmetryPeer}" does not exist.`);
  });
  if (!state.states?.[state.activeState]) issues.push(`Active state "${state.activeState}" does not exist.`);
  Object.entries(state.states || {}).forEach(([name, values]) => Object.keys(values).filter((key) => !(key in state.params)).forEach((key) => issues.push(`State "${name}" references unknown parameter "${key}".`)));
  Object.entries(state.transitions || {}).forEach(([from, targets]) => {
    if (!state.states?.[from]) issues.push(`Transition source "${from}" does not exist.`);
    if (!Array.isArray(targets)) issues.push(`Transitions for "${from}" must be an array.`);
    else targets.forEach((target) => { if (!state.states?.[target]) issues.push(`Transition target "${target}" does not exist.`); });
  });
  for (const [index, behavior] of (state.behaviors || []).entries()) {
    const prefix = `Behavior ${index + 1}`;
    if (!['blink', 'oscillator', 'randomIdle'].includes(behavior.type)) issues.push(`${prefix}: unknown behavior type "${behavior.type}".`);
    if (!state.params?.[behavior.parameter]) issues.push(`${prefix}: parameter "${behavior.parameter}" does not exist.`);
    if (behavior.type === 'blink') {
      if (!Number.isFinite(Number(behavior.duration)) || Number(behavior.duration) <= 0) issues.push(`${prefix}: duration must be finite and greater than 0.`);
      if (!Number.isFinite(Number(behavior.intervalMin)) || Number(behavior.intervalMin) < 0 || !Number.isFinite(Number(behavior.intervalMax)) || Number(behavior.intervalMax) < Number(behavior.intervalMin)) issues.push(`${prefix}: intervals must be finite, non-negative, and intervalMin must be less than or equal to intervalMax.`);
      if (!Number.isFinite(Number(behavior.closedValue))) issues.push(`${prefix}: closedValue must be finite.`);
    }
    if (behavior.type === 'randomIdle') {
      if (!Number.isFinite(Number(behavior.intervalMin)) || Number(behavior.intervalMin) < 0 || !Number.isFinite(Number(behavior.intervalMax)) || Number(behavior.intervalMax) < Number(behavior.intervalMin)) issues.push(`${prefix}: random idle intervals are invalid.`);
      if (!Number.isFinite(Number(behavior.min)) || !Number.isFinite(Number(behavior.max)) || Number(behavior.min) > Number(behavior.max)) issues.push(`${prefix}: random idle min/max are invalid.`);
    }
    if (behavior.type === 'oscillator') {
      if (!Number.isFinite(Number(behavior.frequency)) || Number(behavior.frequency) < 0) issues.push(`${prefix}: frequency must be finite and non-negative.`);
      if (!Number.isFinite(Number(behavior.amplitude))) issues.push(`${prefix}: amplitude must be finite.`);
    }
  }
  Object.entries(state.transitionSettings || {}).forEach(([key, settings]) => {
    if (!/^[^>]+->[^>]+$/.test(key)) issues.push(`Transition setting "${key}": key must use from->to format.`);
    const [from, to] = key.split('->');
    if (!state.states?.[from]) issues.push(`Transition setting "${key}": source state does not exist.`);
    if (!state.states?.[to]) issues.push(`Transition setting "${key}": target state does not exist.`);
    if (!state.transitions?.[from]?.includes(to)) issues.push(`Transition setting "${key}": corresponding transition is not allowed.`);
    if (!Number.isFinite(Number(settings.duration)) || Number(settings.duration) <= 0) issues.push(`Transition setting "${key}": duration must be finite and greater than 0.`);
    if (!CURVES.includes(settings.easing)) issues.push(`Transition setting "${key}": unsupported easing "${settings.easing}".`);
  });
  for(const [partId,part] of Object.entries(state.semanticParts||{})){
    for(const [role,elementId] of Object.entries(part.roles||{}))if(!state.elements?.[elementId])issues.push(`Semantic part "${partId}": role "${role}" references missing element "${elementId}".`);
    for(const control of part.controls||[])if(!state.params?.[control])issues.push(`Semantic part "${partId}": control "${control}" references an unknown parameter.`);
    for(const [control,driver] of Object.entries(part.controlDrivers||{})){
      if(!state.params?.[control])issues.push(`Semantic part "${partId}": driver "${control}" references an unknown parameter.`);
      if(!SUPPORTED_SEMANTIC_DRIVER_PROPERTIES.includes(driver.property))issues.push(`Semantic part "${partId}": driver "${control}" uses unsupported property "${driver.property}".`);
      for(const role of driver.roles||[]){const elementId=part.roles?.[role],binding=state.elements?.[elementId]?.bindings?.[driver.property];if(binding&&binding.generatedBy&&(binding.generatedBy.semanticPart!==partId||binding.generatedBy.control!==control))issues.push(`Semantic ownership conflict at ${elementId}.${driver.property}: ${partId}/${control} conflicts with ${binding.generatedBy.semanticPart}/${binding.generatedBy.control}.`);}
    }
  }
  for(const clip of state.animationClips||[])for(const parameter of Object.keys(clip.tracks||{}))if(!state.params?.[parameter])issues.push(`Animation clip "${clip.name||clip.id}": track references unknown parameter "${parameter}".`);
  return issues;
}
