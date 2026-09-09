/**
 * A nose that is a dot, on the middle line where the template draws its own.
 * One shape, one role, one movement.
 */
export const NOSE_DOT = Object.freeze({
  id: 'nose.dot',
  category: 'nose',
  name: 'Dot',
  description: 'A small round nose.',
  origin: 'builtin',
  artwork: '<g id="nose-dot" data-name="Nose"><circle id="nose" data-name="Nose" cx="120" cy="148" r="4.5" fill="#e8b48e" stroke="#9a6544" stroke-width="2" /></g>',
  roles: Object.freeze({ nose: 'nose' }),
  capabilities: Object.freeze(['noseScrunch']),
  referenceBox: Object.freeze({ x: 114.5, y: 142.5, width: 11, height: 11 }),
  mountPoint: 'nose.center',
  palette: Object.freeze(['skinShadow', 'outline'])
});
