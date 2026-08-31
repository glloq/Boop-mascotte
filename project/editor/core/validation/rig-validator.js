export function validateElementRig(element) {
  const issues = [];
  const expr = element.bindings?.translateX || '0';
  if (!/^[\w\s()+\-*/.]*$/.test(expr)) {
    issues.push('Binding translateX contains unsupported characters.');
  }
  for (const [key, value] of Object.entries(element)) {
    if (typeof value === 'number' && !Number.isFinite(value)) issues.push(`${key} must be finite.`);
  }

  if (element.morph?.enabled) {
    if (!element.morph.pathA || !element.morph.pathB) {
      issues.push('Morph is enabled but pathA/pathB is missing.');
    }
    if ((element.morph.max ?? 1) === (element.morph.min ?? -1)) {
      issues.push('Morph min and max cannot be equal.');
    }
  }
  return issues;
}

export function validateRig(state) {
  const issues = [];
  Object.entries(state.elements || {}).forEach(([id, element]) => {
    validateElementRig(element).forEach((issue) => issues.push(`${id}: ${issue}`));
  });
  if (!state.states?.[state.activeState]) issues.push(`Active state "${state.activeState}" does not exist.`);
  Object.entries(state.transitions || {}).forEach(([from, targets]) => {
    if (!state.states?.[from]) issues.push(`Transition source "${from}" does not exist.`);
    if (!Array.isArray(targets)) issues.push(`Transitions for "${from}" must be an array.`);
    else targets.forEach((target) => { if (!state.states?.[target]) issues.push(`Transition target "${target}" does not exist.`); });
  });
  Object.entries(state.elements || {}).forEach(([id, element]) => {
    if (element.symmetryPeer && !state.elements[element.symmetryPeer]) issues.push(`${id}: symmetryPeer does not exist.`);
  });
  return issues;
}
