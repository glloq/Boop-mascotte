/**
 * A mouth that is one curved line, drawn in the template face's own frame
 * (240 × 240, the lips on the middle line under the nose). Nothing inside it:
 * it opens, smiles and widens by moving as a whole, so it carries those three
 * and says nothing about teeth or a tongue.
 */
export const MOUTH_SIMPLE = Object.freeze({
  id: 'mouth.simple',
  category: 'mouth',
  name: 'Simple',
  description: 'One curved line: a smile with nothing inside it.',
  origin: 'builtin',
  artwork: '<g id="mouth-simple" data-name="Mouth"><path id="mouth" data-name="Mouth" d="M87 172 Q120 190 153 172" fill="none" stroke="#b4525c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" /></g>',
  roles: Object.freeze({ mouth: 'mouth' }),
  capabilities: Object.freeze(['mouthOpen', 'smile', 'mouthWidth']),
  referenceBox: Object.freeze({ x: 87, y: 170, width: 66, height: 13 }),
  mountPoint: 'mouth.center',
  palette: Object.freeze(['mouth'])
});
