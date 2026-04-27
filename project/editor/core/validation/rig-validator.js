export function validateElementRig(element) {
  const issues = [];
  const expr = element.bindings?.translateX || '0';
  if (!/^[\w\s()+\-*/.]*$/.test(expr)) {
    issues.push('Binding translateX contains unsupported characters.');
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
  return issues;
}
