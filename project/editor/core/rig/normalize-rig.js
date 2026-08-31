import { RIG_SCHEMA_VERSION, BINDING_PROPERTIES, normalizeBinding, normalizeBehaviors } from '../../../runtime/runtime.js';
import { normalizeParameter } from './parameters.js';

export function normalizeRig(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid rig: expected an object.');
  const params = Object.fromEntries(Object.entries(raw.params || {}).map(([name, param]) => [name, normalizeParameter(param)]));
  const states = Object.fromEntries(Object.entries(raw.states || {}).map(([name, state]) => [name,
    Object.fromEntries(Object.keys(params).map((key) => [key, Number.isFinite(Number(state?.[key])) ? Number(state[key]) : params[key].default]))
  ]));
  const elements = Object.fromEntries(Object.entries(raw.elements || {}).map(([id, source]) => {
    const base = source.baseTransform || source.transform || source;
    const bindings = {};
    BINDING_PROPERTIES.forEach((property) => {
      if (source.bindings?.[property] !== undefined) bindings[property] = normalizeBinding(source.bindings[property], source.bindingCurves?.[property]);
    });
    return [id, { ...source,
      baseTransform: { x: finite(base.x, 0), y: finite(base.y, 0), rotation: finite(base.rotation, 0), scaleX: finite(base.scaleX, 1), scaleY: finite(base.scaleY, 1), pivotX: finite(base.pivotX ?? source.pivotX, 0), pivotY: finite(base.pivotY ?? source.pivotY, 0) },
      baseOpacity: finite(source.baseOpacity ?? source.opacity, 1), bindings,
      constraints: { translate: true, rotate: true, scale: true, ...(source.constraints || {}) }
    }];
  }));
  const activeState = states[raw.activeState] ? raw.activeState : Object.keys(states)[0];
  const transitions = Object.fromEntries(Object.entries(raw.transitions || {}).map(([from, targets]) =>
    [from, Array.isArray(targets) ? [...new Set(targets.filter((target) => states[target]))] : []]));
  const transitionSettings = Object.fromEntries(Object.entries(raw.transitionSettings || {}).map(([key, value]) => [key, {
    duration: Math.max(1, finite(value?.duration, 300)), easing: ['linear', 'easeIn', 'easeOut', 'easeInOut'].includes(value?.easing) ? value.easing : 'easeInOut'
  }]));
  return { ...raw, schemaVersion: RIG_SCHEMA_VERSION, params, states, elements, activeState, transitions, behaviors: normalizeBehaviors(raw), transitionSettings,
    globalConstraints: { translate: 1, rotate: 1, scale: 1, ...(raw.globalConstraints || {}) },
    stateConstraints: Object.fromEntries(Object.keys(states).map((name) => [name, { translate: 1, rotate: 1, scale: 1, ...(raw.stateConstraints?.[name] || {}) }])) };
}
function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
