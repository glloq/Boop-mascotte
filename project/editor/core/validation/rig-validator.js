import { BINDING_PROPERTIES, CURVES, KEYFORM_CHANNELS, canParsePath, compileShapeKeys, normalizeBinding, parseExpression } from '../../../runtime/runtime.js';
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
  validateKeyforms(state).forEach((issue) => issues.push(issue));
  validateShapeKeys(state).forEach((issue) => issues.push(issue));
  return issues;
}

/**
 * Pose-grid diagnostics (docs/KEYFORM_ENGINE.md). Messages are written for
 * someone building a mascot, not for someone reading the schema.
 */
export function validateKeyforms(state = {}) {
  const issues = [];
  const seen = new Set();
  (state.keyforms || []).forEach((keyform, index) => {
    const label = `Pose "${keyform?.id || index + 1}"`;
    if (!keyform?.id) issues.push(`${label}: needs an identifier.`);
    else if (seen.has(keyform.id)) issues.push(`${label}: another pose already uses this identifier.`);
    else seen.add(keyform.id);
    const targetId = keyform?.target?.id;
    if (!targetId) issues.push(`${label}: is not attached to a shape yet.`);
    else if (state.elements && !state.elements[targetId]) issues.push(`${label}: the shape "${targetId}" it poses no longer exists.`);
    if (!KEYFORM_CHANNELS.includes(keyform?.channel)) issues.push(`${label}: uses an unknown movement "${keyform?.channel}".`);
    if (keyform?.channel === 'pathShape' && !keyform?.shapeKey) issues.push(`${label}: a shape pose must name the shape key it drives.`);
    const axes = Array.isArray(keyform?.axes) ? keyform.axes : [];
    if (axes.length === 0 || axes.length > 2) issues.push(`${label}: needs one or two movement axes.`);
    axes.forEach((axis, position) => {
      const which = axes.length > 1 ? (position === 0 ? 'first' : 'second') : 'only';
      if (!axis?.parameter) issues.push(`${label}: its ${which} axis is not linked to a movement.`);
      else if (state.params && !state.params[axis.parameter]) issues.push(`${label}: its ${which} axis uses a movement that no longer exists: "${axis.parameter}".`);
      const values = Array.isArray(axis?.values) ? axis.values : [];
      if (values.length < 1) issues.push(`${label}: its ${which} axis has no positions.`);
      if (values.some((value) => !Number.isFinite(Number(value)))) issues.push(`${label}: its ${which} axis contains a position that is not a number.`);
      if (new Set(values.map(Number)).size !== values.length) issues.push(`${label}: its ${which} axis repeats a position.`);
    });
    // An empty grid is incomplete, not broken: validateProject reports it as a
    // warning so an in-progress pose never blocks export.
    const captured = Array.isArray(keyform?.keyforms) ? keyform.keyforms : [];
    captured.forEach((cell) => {
      if (!Number.isFinite(Number(cell?.value))) issues.push(`${label}: a captured cell holds a value that is not a number.`);
      const at = Array.isArray(cell?.at) ? cell.at : [];
      if (at.length !== axes.length) issues.push(`${label}: a captured cell does not match the number of axes.`);
      at.forEach((position, dimension) => {
        const size = Array.isArray(axes[dimension]?.values) ? axes[dimension].values.length : 0;
        if (!Number.isInteger(position) || position < 0 || position >= size) issues.push(`${label}: a captured cell is outside the grid.`);
      });
    });
  });
  return issues;
}

/**
 * Shape-key diagnostics (docs/SHAPE_KEYS.md). A shape whose outline no longer
 * matches its rest path is reported, never dropped: the project keeps the key
 * so the author can supply a compatible shape.
 */
export function validateShapeKeys(state = {}) {
  const issues = [];
  const seen = new Set();
  const records = Array.isArray(state.shapeKeys) ? state.shapeKeys : [];
  records.forEach((key, index) => {
    const label = `Shape key "${key?.name || key?.id || index + 1}"`;
    if (!key?.id) issues.push(`${label}: needs an identifier.`);
    else if (seen.has(key.id)) issues.push(`${label}: another shape key already uses this identifier.`);
    else seen.add(key.id);
    if (!key?.target) issues.push(`${label}: is not attached to a shape yet.`);
    else if (state.elements && !state.elements[key.target]) issues.push(`${label}: the shape "${key.target}" it deforms no longer exists.`);
    else if (state.elements && !String(state.elements[key.target]?.restPath || '').trim()) issues.push(`${label}: the shape "${key.target}" has no rest outline captured yet.`);
    else if (!canParsePath(state.elements[key.target].restPath)) issues.push(`${label}: the rest outline of "${key.target}" is not a path this editor can deform.`);
    if (!Array.isArray(key?.delta) || key.delta.length === 0) issues.push(`${label}: has no captured deformation.`);
    else if (key.delta.some((value) => !Number.isFinite(Number(value)))) issues.push(`${label}: contains a deformation value that is not a number.`);
    const driver = key?.driver;
    if (driver?.mode === 'range') {
      if (!driver.parameter) issues.push(`${label}: is not linked to a movement.`);
      else if (state.params && !state.params[driver.parameter]) issues.push(`${label}: uses a movement that no longer exists: "${driver.parameter}".`);
      if (Number(driver.min) === Number(driver.max)) issues.push(`${label}: its movement range cannot start and end at the same value.`);
    }
    if (driver?.mode === 'expression') {
      try {
        const parsed = parseExpression(String(driver.expression ?? '0'));
        parsed.variables.filter((name) => state.params && !state.params[name]).forEach((name) => issues.push(`${label}: uses a movement that no longer exists: "${name}".`));
      } catch (error) { issues.push(`${label}: its formula cannot be read (${error.message}).`); }
    }
  });
  if (records.length && state.elements) {
    for (const entry of compileShapeKeys(records, state.elements).incompatible) {
      if (entry.reason !== 'topology-mismatch') continue;
      const key = records.find((item) => item.id === entry.id);
      issues.push(`Shape key "${key?.name || entry.id}": its outline no longer matches the rest shape of "${entry.target}". Capture it again from the current shape.`);
    }
  }
  return issues;
}
