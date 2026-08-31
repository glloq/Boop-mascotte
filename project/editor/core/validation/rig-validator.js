import { BINDING_PROPERTIES, CURVES, normalizeBinding, parseExpression } from '../../../runtime/runtime.js';
import { validateParameter } from '../rig/parameters.js';

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
  return issues;
}
