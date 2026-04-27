export function canTransition(transitions, from, to) {
  const allowed = transitions?.[from];
  if (!Array.isArray(allowed) || !allowed.length) return true;
  return allowed.includes(to);
}
