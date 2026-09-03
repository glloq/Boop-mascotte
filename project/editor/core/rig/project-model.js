import { createParameter } from './parameters.js';

export function addParameter(rig, name, options = {}) {
  if (rig.params?.[name]) throw new Error(`Parameter "${name}" already exists.`);
  rig.params ||= {};
  rig.params[name] = createParameter(name, options);
  Object.values(rig.states || {}).forEach((state) => { state[name] = rig.params[name].default; });
  return rig.params[name];
}

export function parameterReferences(rig, name) {
  const refs = { bindings: [], states: [], morphs: [], behaviors: [], semanticParts: [], semanticDrivers: [], animationTracks: [], keyforms: [] };
  Object.entries(rig.elements || {}).forEach(([id, element]) => {
    Object.entries(element.bindings || {}).forEach(([property, binding]) => {
      const expression = typeof binding === 'object' ? binding.expression : binding;
      if (new RegExp(`\\b${escapeRegex(name)}\\b`).test(String(expression)) || binding?.generatedBy?.control === name) refs.bindings.push(`${id}.${property}`);
    });
    if (element.morph?.param === name || element.morph?.generatedBy?.control === name) refs.morphs.push(id);
  });
  Object.entries(rig.states || {}).forEach(([stateName, values]) => { if (name in values) refs.states.push(stateName); });
  (rig.behaviors || []).forEach((behavior, index) => { if (behavior.parameter === name) refs.behaviors.push(index); });
  Object.entries(rig.semanticParts || {}).forEach(([partId, part]) => {
    if (part.controls?.includes(name)) refs.semanticParts.push(partId);
    if (part.controlDrivers && Object.prototype.hasOwnProperty.call(part.controlDrivers, name)) refs.semanticDrivers.push(partId);
  });
  (rig.animationClips || []).forEach((clip, index) => {
    if (Object.prototype.hasOwnProperty.call(clip.tracks || {}, name)) refs.animationTracks.push(clip.id || index);
  });
  // A keyform axis is a parameter reference exactly like a binding expression is.
  (rig.keyforms || []).forEach((keyform, index) => {
    if ((keyform.axes || []).some((axis) => axis?.parameter === name)) refs.keyforms.push(keyform.id || index);
  });
  return refs;
}

export function renameParameter(rig, from, to) {
  if (!rig.params?.[from]) throw new Error(`Parameter "${from}" does not exist.`);
  if (rig.params[to]) throw new Error(`Parameter "${to}" already exists.`);
  const collision = (rig.animationClips || []).find((clip) => clip.tracks?.[from] && clip.tracks?.[to]);
  if (collision) throw new Error(`Cannot rename parameter: animation clip "${collision.name || collision.id}" already has a "${to}" track.`);
  createParameter(to);
  rig.params[to] = rig.params[from]; delete rig.params[from];
  Object.values(rig.states || {}).forEach((state) => { if (from in state) { state[to] = state[from]; delete state[from]; } });
  Object.values(rig.elements || {}).forEach((element) => {
    Object.values(element.bindings || {}).forEach((binding) => {
      if (binding && typeof binding === 'object') binding.expression = replaceIdentifier(binding.expression, from, to);
    });
    if (element.morph?.param === from) element.morph.param = to;
    if (element.morph?.generatedBy?.control === from) element.morph.generatedBy.control = to;
    Object.values(element.bindings || {}).forEach((binding) => { if (binding?.generatedBy?.control === from) binding.generatedBy.control = to; });
  });
  (rig.behaviors || []).forEach((behavior) => { if (behavior.parameter === from) behavior.parameter = to; });
  Object.values(rig.semanticParts || {}).forEach((part) => {
    part.controls = (part.controls || []).map((control) => control === from ? to : control);
    if (part.controlDrivers?.[from]) { part.controlDrivers[to] = part.controlDrivers[from]; delete part.controlDrivers[from]; }
    if (part.calibration?.[from]) { part.calibration[to] = part.calibration[from]; delete part.calibration[from]; }
    for (const entry of Object.values(part.calibration || {})) {
      if (entry && typeof entry === 'object' && entry.control === from) entry.control = to;
    }
  });
  for (const clip of rig.animationClips || []) if (clip.tracks?.[from]) { clip.tracks[to] = clip.tracks[from]; delete clip.tracks[from]; }
  for (const keyform of rig.keyforms || []) for (const axis of keyform.axes || []) if (axis.parameter === from) axis.parameter = to;
  return rig;
}

export function deleteParameter(rig, name) {
  const refs = parameterReferences(rig, name);
  delete rig.params?.[name];
  Object.values(rig.states || {}).forEach((state) => delete state[name]);
  Object.values(rig.elements || {}).forEach((element) => {
    Object.entries(element.bindings || {}).forEach(([property, binding]) => {
      const expression = typeof binding === 'object' ? binding.expression : binding;
      if (new RegExp(`\\b${escapeRegex(name)}\\b`).test(String(expression)) || binding?.generatedBy?.control === name) delete element.bindings[property];
    });
    if (element.morph?.param === name || element.morph?.generatedBy?.control === name) delete element.morph;
  });
  rig.behaviors = (rig.behaviors || []).filter((behavior) => behavior.parameter !== name);
  Object.values(rig.semanticParts || {}).forEach((part) => {
    part.controls = (part.controls || []).filter((control) => control !== name);
    delete part.controlDrivers?.[name];
    delete part.calibration?.[name];
    for (const [key, entry] of Object.entries(part.calibration || {})) if (entry?.control === name) delete part.calibration[key];
  });
  for (const clip of rig.animationClips || []) delete clip.tracks?.[name];
  // A pose grid whose axis parameter is gone can no longer be evaluated, so the
  // whole record goes rather than leaving an axis pointing at nothing.
  rig.keyforms = (rig.keyforms || []).filter((keyform) => !(keyform.axes || []).some((axis) => axis?.parameter === name));
  return refs;
}

export function addState(rig, name, source = 'defaults') {
  validateName(rig.states, name, 'State');
  let values = Object.fromEntries(Object.entries(rig.params || {}).map(([key, param]) => [key, param.default]));
  if (source === 'current') values = Object.fromEntries(Object.entries(rig.params || {}).map(([key, param]) => [key, param.value]));
  else if (rig.states?.[source]) values = { ...rig.states[source] };
  rig.states ||= {}; rig.states[name] = values; rig.transitions ||= {}; rig.transitions[name] = [];
  return values;
}
export function duplicateState(rig, from, to) { if (!rig.states?.[from]) throw new Error(`State "${from}" does not exist.`); return addState(rig, to, from); }
export function renameState(rig, from, to) {
  if (!rig.states?.[from]) throw new Error(`State "${from}" does not exist.`); validateName(rig.states, to, 'State');
  rig.states[to] = rig.states[from]; delete rig.states[from];
  rig.transitions[to] = rig.transitions[from] || []; delete rig.transitions[from];
  Object.keys(rig.transitions).forEach((key) => { rig.transitions[key] = rig.transitions[key].map((name) => name === from ? to : name); });
  rig.transitionSettings = Object.fromEntries(Object.entries(rig.transitionSettings || {}).map(([key, value]) => {
    const [source, target] = key.split('->');
    return [[source === from ? to : source, target === from ? to : target].join('->'), value];
  }));
  if (rig.activeState === from) rig.activeState = to;
}
export function deleteState(rig, name) {
  delete rig.states?.[name]; delete rig.transitions?.[name];
  Object.keys(rig.transitions || {}).forEach((key) => { rig.transitions[key] = rig.transitions[key].filter((target) => target !== name); });
  rig.transitionSettings = Object.fromEntries(Object.entries(rig.transitionSettings || {}).filter(([key]) => {
    const [from, to] = key.split('->'); return from !== name && to !== name;
  }));
  if (rig.activeState === name) rig.activeState = Object.keys(rig.states || {})[0];
}
export function setTransition(rig, from, to, settings = {}) {
  if (!rig.states?.[from] || !rig.states?.[to]) throw new Error('Transition states must exist.');
  rig.transitions[from] ||= []; if (!rig.transitions[from].includes(to)) rig.transitions[from].push(to);
  rig.transitionSettings ||= {}; rig.transitionSettings[`${from}->${to}`] = { duration: Math.max(0, Number(settings.duration) || 300), easing: settings.easing || 'easeInOut' };
}
function replaceIdentifier(expression, from, to) { return String(expression).replace(new RegExp(`\\b${escapeRegex(from)}\\b`, 'g'), to); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function validateName(collection = {}, name, label) { if (!/^[A-Za-z_][\w-]*$/.test(name)) throw new Error(`${label} name is invalid.`); if (collection[name]) throw new Error(`${label} "${name}" already exists.`); }
