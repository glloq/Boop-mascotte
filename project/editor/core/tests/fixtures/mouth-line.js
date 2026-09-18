/**
 * A mouth that carries **less** than the library's does.
 *
 * The library has one mouth now and it can do everything: open, smile, widen,
 * pucker, and show its teeth and its tongue (docs/MOUTH_BUILD.md). That is the
 * point of it, and it makes it useless for the tests that are *about* a drawing
 * carrying less than the rig asks for — a movement going off, a role the asset
 * does not draw, a refusal.
 *
 * So the lesser mouth lives here, as a fixture rather than as a card nobody
 * could reach. It is the old `mouth.simple`: one stroked curve, one role, three
 * movements, no pucker and nothing inside it.
 */
export const MOUTH_LINE = Object.freeze({
  id: 'mouth.line', category: 'mouth', name: 'Line', description: 'One curved line.', origin: 'builtin',
  artwork: '<g id="mouth-line" data-name="Mouth"><path id="mouth" data-name="Mouth" d="M96 174 Q120 186 144 174" fill="none" stroke="#b4525c" stroke-width="3.8" stroke-linecap="round" /></g>',
  roles: Object.freeze({ mouth: 'mouth' }),
  capabilities: Object.freeze(['mouthOpen', 'smile', 'mouthWidth']),
  paletteRoles: Object.freeze({ mouth: Object.freeze({ stroke: 'mouth' }) }),
  referenceBox: Object.freeze({ x: 96, y: 173, width: 48, height: 13 }),
  mountPoint: 'mouth.center',
  palette: Object.freeze(['mouth'])
});
