/**
 * A wide grin with a row of teeth inside it, in the template face's frame.
 * The teeth are their own shape, so the mouth's `teeth` movement has
 * something to show; there is no tongue, and the asset says so.
 */
export const MOUTH_WIDE = Object.freeze({
  id: 'mouth.wide',
  category: 'mouth',
  name: 'Wide',
  description: 'A wide grin with a row of teeth.',
  origin: 'builtin',
  artwork: '<g id="mouth-wide" data-name="Mouth"><path id="mouth" data-name="Mouth" d="M80 170 Q120 178 160 170 Q120 198 80 170 Z" fill="#7a2d35" stroke="#b4525c" stroke-width="3" stroke-linejoin="round" /><path id="teeth" data-name="Teeth" d="M86 171.5 Q120 178 154 171.5 Q120 184 86 171.5 Z" fill="#ffffff" /></g>',
  roles: Object.freeze({ mouth: 'mouth', teeth: 'teeth' }),
  capabilities: Object.freeze(['mouthOpen', 'smile', 'mouthWidth', 'teeth']),
  referenceBox: Object.freeze({ x: 80, y: 168, width: 80, height: 22 }),
  mountPoint: 'mouth.center',
  palette: Object.freeze(['mouth', 'teeth'])
});
