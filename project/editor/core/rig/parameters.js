export function createParameter(name, options = {}) {
  if (!/^[A-Za-z_]\w*$/.test(name)) throw new Error(`Invalid parameter name "${name}".`);
  return normalizeParameter(options);
}

export function normalizeParameter(value = {}) {
  if (typeof value === 'number') return { type: 'number', min: -1, max: 1, default: value, value };
  const min = finite(value.min, -1), max = finite(value.max, 1);
  const low = Math.min(min, max), high = Math.max(min, max);
  const defaultValue = clamp(finite(value.default, 0), low, high);
  return { type: 'number', min, max, default: defaultValue, value: clamp(finite(value.value, defaultValue), low, high) };
}

export function validateParameter(name, param) {
  const issues = [];
  if (!/^[A-Za-z_]\w*$/.test(name)) issues.push(`Parameter name "${name}" is invalid.`);
  if (!Number.isFinite(Number(param?.min)) || !Number.isFinite(Number(param?.max))) issues.push(`Parameter "${name}" bounds must be finite.`);
  else if (Number(param.min) > Number(param.max)) issues.push(`Parameter "${name}" has min greater than max.`);
  if (Number(param?.default) < Number(param?.min) || Number(param?.default) > Number(param?.max)) issues.push(`Parameter "${name}" default is outside its range.`);
  return issues;
}

export function clampParameterValue(param, value) { return clamp(finite(value, param.default), param.min, param.max); }
export function getParameterDefault(param) { return finite(param?.default, 0); }
export function resolveStateParameter(param, state, name) { return clampParameterValue(param, state?.[name] ?? getParameterDefault(param)); }
export function addParam(params, name, options) { if (params[name]) throw new Error(`Parameter "${name}" already exists.`); params[name] = createParameter(name, options); return params; }
export function removeParam(params, name) { delete params[name]; return params; }
export function renameParam(params, from, to) { if (!params[from]) throw new Error(`Parameter "${from}" does not exist.`); if (params[to]) throw new Error(`Parameter "${to}" already exists.`); createParameter(to); params[to] = params[from]; delete params[from]; return params; }
function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
