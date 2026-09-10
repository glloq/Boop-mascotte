/**
 * More mouths, beside `mouth.simple` and `mouth.wide`, on the template's
 * lip line at 176. A mouth with teeth or a tongue draws them: the movement
 * is then whether they show (docs/FACE_PART_LIBRARY.md, "Installing").
 */
const LIP = '#b4525c', INSIDE = '#7a2d35', TEETH = '#fff8ec', TONGUE = '#d9707f';

const mouth = (slug, name, description, shapes, { roles, capabilities, box, palette, paletteRoles }) => Object.freeze({
  id: `mouth.${slug}`, category: 'mouth', name, description, origin: 'builtin',
  artwork: `<g id="mouth-${slug}" data-name="Mouth">${shapes}</g>`,
  roles: Object.freeze(roles),
  capabilities: Object.freeze(capabilities),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, entry]) => [id, Object.freeze({ ...entry })]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'mouth.center',
  palette: Object.freeze(palette)
});

export const MOUTH_SMALL = mouth('small', 'Small', 'A small curved line.',
  `<path id="mouth" data-name="Mouth" d="M108 174 Q120 183 132 174" fill="none" stroke="${LIP}" stroke-width="3.5" stroke-linecap="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 108, y: 173, width: 24, height: 9 }, palette: ['mouth'], paletteRoles: { mouth: { stroke: 'mouth' } } });
export const MOUTH_CARTOON = mouth('cartoon', 'Cartoon', 'An open cartoon grin with teeth and a tongue.',
  `<path id="mouth" data-name="Mouth" d="M90 172 Q120 166 150 172 Q120 198 90 172 Z" fill="${INSIDE}" stroke="${LIP}" stroke-width="3" stroke-linejoin="round" />`
  + `<path id="teeth" data-name="Teeth" d="M97 173.5 Q120 169 143 173.5 Q120 181 97 173.5 Z" fill="${TEETH}" />`
  + `<path id="tongue" data-name="Tongue" d="M107 185 Q120 179 133 185 Q120 194 107 185 Z" fill="${TONGUE}" />`,
  { roles: { mouth: 'mouth', teeth: 'teeth', tongue: 'tongue' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue'], box: { x: 90, y: 166, width: 60, height: 32 }, palette: ['mouth', 'teeth', 'tongue'], paletteRoles: { mouth: { fill: 'mouth' }, teeth: { fill: 'teeth' }, tongue: { fill: 'tongue' } } });
export const MOUTH_EXPRESSIVE = mouth('expressive', 'Expressive', 'Full lips, drawn as one shape.',
  `<path id="mouth" data-name="Mouth" d="M88 174 Q104 168 120 173 Q136 168 152 174 Q136 188 120 189 Q104 188 88 174 Z" fill="${INSIDE}" stroke="${LIP}" stroke-width="3" stroke-linejoin="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 88, y: 168, width: 64, height: 21 }, palette: ['mouth'], paletteRoles: { mouth: { fill: 'mouth' } } });

export const MOUTHS = Object.freeze([MOUTH_SMALL, MOUTH_CARTOON, MOUTH_EXPRESSIVE]);
