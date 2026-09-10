/**
 * Ears, a pair each, where the template's sit: on the sides of the skull at
 * 118, painted behind it, so half of each shows.
 */
const SKIN = '#f9d9b0', LINE = '#a4674a';
const CENTRES = Object.freeze({ Left: 27, Right: 213 });

const ears = (slug, name, description, draw, box) => Object.freeze({
  id: `ears.${slug}`, category: 'ears', name, description, origin: 'builtin',
  artwork: `<g id="ears-${slug}" data-name="Ears">${draw('Left')}${draw('Right')}</g>`,
  roles: Object.freeze({ leftEar: 'earLeft', rightEar: 'earRight' }),
  capabilities: Object.freeze(['earWiggle']),
  paletteRoles: Object.freeze({ earLeft: Object.freeze({ fill: 'skin', stroke: 'outline' }), earRight: Object.freeze({ fill: 'skin', stroke: 'outline' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'ears',
  palette: Object.freeze(['skin', 'outline'])
});

export const EARS_ROUND = ears('round', 'Round', 'Round ears.',
  (side) => `<circle id="ear${side}" data-name="${side} ear" cx="${CENTRES[side]}" cy="118" r="15" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" />`,
  { x: 12, y: 103, width: 216, height: 30 });
export const EARS_LARGE = ears('large', 'Large', 'Big oval ears.',
  (side) => `<ellipse id="ear${side}" data-name="${side} ear" cx="${CENTRES[side]}" cy="118" rx="17" ry="27" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" />`,
  { x: 10, y: 91, width: 220, height: 54 });
export const EARS_SMALL = ears('small', 'Small', 'Small tucked ears.',
  (side) => `<ellipse id="ear${side}" data-name="${side} ear" cx="${side === 'Left' ? 30 : 210}" cy="118" rx="10" ry="14" fill="${SKIN}" stroke="${LINE}" stroke-width="3" />`,
  { x: 20, y: 104, width: 200, height: 28 });

export const EAR_SETS = Object.freeze([EARS_ROUND, EARS_LARGE, EARS_SMALL]);
