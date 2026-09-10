/**
 * Brows, a pair each, above the template's eyes (the line at 81, the inner
 * ends near the nose at 110 and 130). `sign` mirrors one drawing into the
 * other so the two are exact mirrors, as the template's are.
 */
const HAIR = '#a6603c';
const round = (value) => Math.round(value * 100) / 100;
const x = (sign, offset) => round(120 + sign * offset);

const brow = (slug, name, description, draw, box, paint = 'stroke') => Object.freeze({
  id: `eyebrows.${slug}`, category: 'eyebrows', name, description, origin: 'builtin',
  artwork: `<g id="brows-${slug}" data-name="Brows">${draw(-1, 'Left')}${draw(1, 'Right')}</g>`,
  roles: Object.freeze({ leftBrow: 'browLeft', rightBrow: 'browRight' }),
  capabilities: Object.freeze(['browRaise', 'browTilt']),
  paletteRoles: Object.freeze({ browLeft: Object.freeze({ [paint]: 'hair' }), browRight: Object.freeze({ [paint]: 'hair' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'brows',
  palette: Object.freeze(['hair'])
});

export const BROWS_THIN = brow('thin', 'Thin', 'A thin arched line.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${x(sign, 12)} 84 Q${x(sign, 35)} 72 ${x(sign, 60)} 80" fill="none" stroke="${HAIR}" stroke-width="3.5" stroke-linecap="round" />`,
  { x: 60, y: 72, width: 120, height: 14 });
export const BROWS_THICK = brow('thick', 'Thick', 'A thick, tapered brow.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${x(sign, 10)} 88 Q${x(sign, 34)} 70 ${x(sign, 62)} 78 L${x(sign, 58)} 84 Q${x(sign, 34)} 78 ${x(sign, 12)} 92 Z" fill="${HAIR}" />`,
  { x: 58, y: 70, width: 124, height: 22 }, 'fill');
export const BROWS_FLAT = brow('flat', 'Flat', 'A straight, level brow.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${x(sign, 12)} 81 L${x(sign, 60)} 81" fill="none" stroke="${HAIR}" stroke-width="5" stroke-linecap="round" />`,
  { x: 60, y: 78, width: 120, height: 6 });

export const BROWS_NORMAL = brow('normal', 'Normal', 'A medium arched brow.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${x(sign, 12)} 84 Q${x(sign, 36)} 74 ${x(sign, 60)} 80" fill="none" stroke="${HAIR}" stroke-width="4.5" stroke-linecap="round" />`,
  { x: 60, y: 74, width: 120, height: 12 });
export const BROWS_EXPRESSIVE = brow('expressive', 'Expressive', 'A bold brow, angled up at the outer end.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${x(sign, 10)} 86 Q${x(sign, 36)} 78 ${x(sign, 62)} 70 L${x(sign, 60)} 80 Q${x(sign, 36)} 86 ${x(sign, 12)} 92 Z" fill="${HAIR}" />`,
  { x: 58, y: 70, width: 124, height: 22 }, 'fill');

export const BROW_SETS = Object.freeze([BROWS_THIN, BROWS_NORMAL, BROWS_THICK, BROWS_FLAT, BROWS_EXPRESSIVE]);
