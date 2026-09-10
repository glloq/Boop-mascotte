/**
 * Noses, on the template's middle line at 148, beside `nose.dot`.
 */
const LINE = '#9a6544', SKIN = '#e8b48e';

const nose = (slug, name, description, shape, box, paletteRoles = { nose: { stroke: 'outline' } }) => Object.freeze({
  id: `nose.${slug}`, category: 'nose', name, description, origin: 'builtin',
  artwork: `<g id="nose-${slug}" data-name="Nose">${shape}</g>`,
  roles: Object.freeze({ nose: 'nose' }),
  capabilities: Object.freeze(['noseScrunch']),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, roles]) => [id, Object.freeze({ ...roles })]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'nose.center',
  palette: Object.freeze(['skinShadow', 'outline'])
});

export const NOSE_HOOK = nose('hook', 'Hook', 'A hooked line, down and back.', `<path id="nose" data-name="Nose" d="M117 137 Q129 146 123 155 L114 155" fill="none" stroke="${LINE}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />`, { x: 113, y: 136, width: 16, height: 20 });
export const NOSE_SOFT = nose('soft', 'Soft', 'A soft curve under the nose.', `<path id="nose" data-name="Nose" d="M111 151 Q120 159 129 151" fill="none" stroke="${LINE}" stroke-width="2.8" stroke-linecap="round" />`, { x: 110, y: 150, width: 20, height: 8 });
export const NOSE_CARTOON = nose('cartoon', 'Cartoon', 'A big round cartoon nose.', `<ellipse id="nose" data-name="Nose" cx="120" cy="150" rx="11" ry="9" fill="${SKIN}" stroke="${LINE}" stroke-width="2.4" />`, { x: 109, y: 141, width: 22, height: 18 }, { nose: { fill: 'skinShadow', stroke: 'outline' } });

export const NOSES = Object.freeze([NOSE_HOOK, NOSE_SOFT, NOSE_CARTOON]);
