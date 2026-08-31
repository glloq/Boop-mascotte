export function canTransition(transitions, from, to) {
  if (from === to) return true;
  const allowed = transitions?.[from];
  return allowed === undefined || (Array.isArray(allowed) && allowed.includes(to));
}
