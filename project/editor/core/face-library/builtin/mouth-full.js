/**
 * **The** mouth: one card, every state (docs/MOUTH_BUILD.md).
 *
 * ```text
 *   mouthOpen    how far the jaw drops
 *   smile        the corners up, or down
 *   mouthWidth   wider or narrower
 *   mouthRound   the pucker — and with it the vowels
 *   teeth        the upper row, showing
 *   tongue       the tongue, showing
 * ```
 *
 * The library used to hold five human mouths and not one of them could **speak**.
 * `mouthRound` is the control the visemes turn on — the difference between AE and
 * OO is the aperture *puckering*, and narrowing a lens is not rounding it
 * (docs/VISEME_SYSTEM.md) — and none of the five claimed it, because none of them
 * could: a shaped movement needs the asset to ship the shape it deforms to, and
 * the installer only knew how to build one for a jaw. Five drawings of a curve,
 * and no vowels between them. `mouth.simple`, `mouth.wide`, `mouth.small`,
 * `mouth.cartoon` and `mouth.expressive` differed by a radius, a fill and whether
 * the teeth were drawn — which is a size, a palette and a movement.
 *
 * So the vocabulary is one mouth that does everything, built from
 * `core/face/mouth-build.js` — the construction the template has always drawn
 * with, so a card and the sample are the same mouth, exactly as the three eye
 * builds and the template's eyes are the same eye (docs/EYE_BUILDS.md).
 *
 * The animal ω, the six beaks and the four robot grilles stay where they are: a
 * muzzle's mouth is two curves meeting under a nose, a beak is a rigid wedge that
 * hinges, and a grille is a lit panel. Different constructions, not this one at
 * another radius.
 */
import { MOUTH_REST, TEETH_REST, TONGUE_REST, mouthPath, teethPath, tonguePath } from '../../face/mouth-build.js';

const LIP = '#b4525c', INSIDE = '#6d2831', TEETH = '#fff8ec', TONGUE = '#d9707f';

/**
 * The three shapes, and why the teeth and the tongue are drawn at all.
 *
 * Both are **empty at rest**: each is two quadratics sharing their ends on the
 * lip, and at `show 0` the two are the same curve traced twice, so the shape
 * encloses nothing and paints nothing. A closed mouth therefore has nothing
 * behind it to hide, by construction rather than by arithmetic — which is what
 * lets each be one band drawn from the lip it sits behind rather than a second
 * mouth with its own cavity.
 *
 * And it is why neither carries `opacity="0"`. A frame's opacity is the drawn
 * one **multiplied** by the binding's, so a shape drawn at 0 could never be
 * brought out at all. Drawn at full opacity they paint nothing anyway, because
 * there is nothing enclosed to paint: what brings them out is the shape key
 * below, which gives them something to enclose.
 */
const artwork = `<g id="mouth-full" data-name="Mouth">`
  + `<path id="mouth" data-name="Mouth" d="${MOUTH_REST}" fill="${INSIDE}" stroke="${LIP}" stroke-width="3.8" stroke-linejoin="round" />`
  + `<path id="teeth" data-name="Teeth" d="${TEETH_REST}" fill="${TEETH}" />`
  + `<path id="tongue" data-name="Tongue" d="${TONGUE_REST}" fill="${TONGUE}" />`
  + `</g>`;

export const MOUTH_FULL = Object.freeze({
  id: 'mouth.full', category: 'mouth', name: 'Mouth', origin: 'builtin',
  description: 'Opens, smiles, widens, puckers, and shows its teeth and its tongue. The one mouth a mascot needs.',
  artwork,
  roles: Object.freeze({ mouth: 'mouth', teeth: 'teeth', tongue: 'tongue' }),
  capabilities: Object.freeze(['mouthOpen', 'smile', 'mouthWidth', 'mouthRound', 'teeth', 'tongue']),
  /**
   * `mouthRound` is the one that had to be said out loud.
   *
   * It is **shaped**, not transformed: the registry says so
   * (`strategies: { mouthRound: ['shapeKey'] }`) because a pucker is the corners
   * coming in while the lip line bows out above and below them, and no transform
   * can do that to a lens. So the card ships the shape — `posePath`, the lips as
   * drawn at `mouthRound 1` — and the installer builds a shape key from it
   * (`installShapedControl`). The amplitude *is* the pose; there is no number.
   *
   * It turned out not to be the only one. `mouthOpen` and `smile` are shaped
   * here too, and so are `teeth` and `tongue` — five of the six, each for the
   * reason written at it below. Only `mouthWidth` takes the registry's own
   * driver, a `scaleX`, which is the one movement a transform says honestly: a
   * wider mouth really is this mouth, wider.
   */
  drivers: Object.freeze({
    /**
     * The lips open and smile by **shape**, which is what makes the aperture
     * match the bands drawn from it.
     *
     * The registry's own drivers are a `scaleY` and a `translateY`, and on their
     * own they look right: an open mouth *is* a taller aperture. Measured, they
     * are not the same opening the geometry means. `scaleY 2` doubles a lens
     * eleven screen pixels tall; `mouthPath({ open: 1 })` drops the lower lip
     * sixty-two units. So a band drawn at the geometry's fully-open lip reached a
     * third of the way down the chin, because the lips had only doubled.
     *
     * Shaped, both are the same arithmetic over the same four points, so the lips
     * and everything drawn from them agree by construction rather than by two
     * numbers kept in step. The registry binds these two to the **lips alone**,
     * which is why no role override is needed here: the bands carry their own
     * opening in their own pose, below.
     *
     * `smile` is shaped for the same reason and buys more besides: the geometry
     * lifts the corners *and* deepens the lip line, where a `translateY` moves
     * the whole curve and leaves its shape alone.
     */
    mouthOpen: Object.freeze({ property: 'shapeKey', posePath: mouthPath({ open: 1 }) }),
    smile: Object.freeze({ property: 'shapeKey', posePath: mouthPath({ smile: 1 }) }),
    mouthRound: Object.freeze({
      property: 'shapeKey',
      posePath: mouthPath({ round: 1 }),
      roles: Object.freeze({
        // Each shape puckers as its own lip does, because each is drawn from it.
        teeth: Object.freeze({ posePath: teethPath({ round: 1 }) }),
        tongue: Object.freeze({ posePath: tonguePath({ round: 1 }) })
      })
    }),
    /**
     * And the two bands **grow** rather than fade.
     *
     * `DRAWN_DRIVERS` would make each an opacity movement, which is right for a
     * card that draws a finished row of teeth and hides it. These are drawn
     * *empty* — two quadratics sharing their ends — so an opacity could never
     * bring them out: a shape that encloses nothing paints nothing at any
     * opacity.
     *
     * The pose is the band **open and shown** together, and the sentence is a
     * product: `mouthOpen * teeth`. Both halves of that matter.
     *
     * The product is what keeps a closed mouth honest — closed lips have nothing
     * behind them to show, however far the control is up — and it is the
     * construction's rule rather than the part's, which is why it is said here
     * and not in the registry: a card drawing a finished row of teeth and fading
     * it in wants `teeth` alone.
     *
     * Drawing the pose at `open: 1` as well as `show: 1` is what keeps the band
     * *inside* the lips it is drawn from. A control writes one property, so
     * `mouthOpen` cannot be a scale on the lips and a shape on the bands; drawn
     * at the closed lip line the band stayed there while the lips dropped sixty
     * units, which is a row of teeth over the chin. Folded into this one pose it
     * travels with the aperture: the product is 0 with the mouth shut, the whole
     * delta with it open and the control up, and proportional in between.
     */
    teeth: Object.freeze({ property: 'shapeKey', posePath: teethPath({ open: 1, show: 1 }), expression: 'mouthOpen * teeth' }),
    tongue: Object.freeze({ property: 'shapeKey', posePath: tonguePath({ open: 1, show: 1 }), expression: 'mouthOpen * tongue' })
  }),
  paletteRoles: Object.freeze({
    mouth: Object.freeze({ fill: 'mouth' }),
    teeth: Object.freeze({ fill: 'teeth' }),
    tongue: Object.freeze({ fill: 'tongue' })
  }),
  // The lips, and the room the cavity needs when it is fully open: the teeth and
  // the tongue are drawn from the lips, so they are inside this by construction.
  referenceBox: Object.freeze({ x: 87, y: 169.5, width: 66, height: 14 }),
  mountPoint: 'mouth.center',
  palette: Object.freeze(['mouth', 'teeth', 'tongue'])
});
