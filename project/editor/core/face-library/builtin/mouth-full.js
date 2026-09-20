/**
 * **The** mouth: one card, every state (docs/MOUTH_BUILD.md).
 *
 * ```text
 *   mouthOpen    how far the jaw drops
 *   smile        the corners up, or down
 *   mouthWidth   wider or narrower
 *   mouthRound   the pucker — and with it the vowels
 *   mouthSkew    the lean — one corner up, the other down
 *   teeth        the two rows, showing
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
import {
  MOUTH_REST, TEETH_REST, TEETH_LOWER_REST, TONGUE_REST, TONGUE_TIP_REST, TONGUE_GROOVE_REST, UVULA_REST,
  mouthPath, teethPath, teethLowerPath, tonguePath, tongueTipPath, tongueGroovePath, uvulaPath
} from '../../face/mouth-build.js';

const LIP = '#b4525c', INSIDE = '#6d2831', TEETH = '#fff8ec', TONGUE = '#d9707f';
/** A fold is the light that does not reach it, so the crease is the cavity's own colour, softened. */
const GROOVE_OPACITY = 0.3;

/**
 * The six shapes, in the order they are painted, and why each is where it is.
 *
 * ```text
 *   mouth                    the lips, and the cavity they enclose
 *   mouth-full-inside  ▸ clipped to the aperture
 *       uvula · tongue · teethLower · teeth
 *   tongueTip                in front of the lips, because that is where it is
 *   tongueGroove             and the crease down it
 * ```
 *
 * The lower row is in **front** of the tongue, which is where a lower row is;
 * what goes over it is the tongue on its way *out*, and that is `tongueTip` --
 * a shape that exists only when the tongue is out, painted in front of the lips
 * (docs/MOUTH_BUILD.md, "The order"). The uvula is painted first because it is
 * the furthest away.
 *
 * All five insides are **empty at rest**: each is a closed path whose second
 * half retraces its first exactly when its own number is 0, so the shape
 * encloses nothing and paints nothing. A closed mouth therefore has nothing
 * behind it to hide, by construction rather than by arithmetic — which is what
 * lets each be drawn from the lip it sits behind rather than being a second
 * mouth with a cavity of its own.
 *
 * And it is why none of them carries `opacity="0"`. A frame's opacity is the
 * drawn one **multiplied** by the binding's, so a shape drawn at 0 could never
 * be brought out at all. Drawn at full opacity they paint nothing anyway,
 * because there is nothing enclosed to paint: what brings them out is the shape
 * key below, which gives them something to enclose.
 *
 * **The clip is the belt to that geometry's braces** (§6.2 of the V6 brief).
 * Nothing drawn from the lips can leave them by deforming — but `tongueX` and
 * `tongueY` translate the tongue, `mouthWidth` scales the rows, and a warp or a
 * pin can reach any of them. Clipping the insides to `#mouth` answers all of
 * those at once, and it costs one `<use>` because the aperture is already a
 * path: `#mouth` *is* the shape of the hole, so the clip follows every pose of
 * it with nothing to keep in step. The ids are the card's own and the installer
 * renames them with everything else it takes, so two mouths on one page clip to
 * their own lips.
 *
 * The tip and its crease are outside the clip, and they are the only things
 * that are: a tongue hanging out lies over the lower lip, and that is the point
 * of it.
 */
const artwork = `<g id="mouth-full" data-name="Mouth">`
  + `<path id="mouth" data-name="Mouth" d="${MOUTH_REST}" fill="${INSIDE}" stroke="${LIP}" stroke-width="3.8" stroke-linejoin="round" />`
  + `<g id="mouth-full-inside" data-name="Inside the mouth" clip-path="url(#mouth-full-aperture)">`
  + `<path id="uvula" data-name="Uvula" d="${UVULA_REST}" fill="${TONGUE}" />`
  + `<path id="tongue" data-name="Tongue" d="${TONGUE_REST}" fill="${TONGUE}" />`
  + `<path id="teethLower" data-name="Lower teeth" d="${TEETH_LOWER_REST}" fill="${TEETH}" />`
  + `<path id="teeth" data-name="Upper teeth" d="${TEETH_REST}" fill="${TEETH}" />`
  + `</g>`
  + `<path id="tongueTip" data-name="Tongue tip" d="${TONGUE_TIP_REST}" fill="${TONGUE}" />`
  + `<path id="tongueGroove" data-name="Tongue groove" d="${TONGUE_GROOVE_REST}" fill="${INSIDE}" opacity="${GROOVE_OPACITY}" />`
  + `<clipPath id="mouth-full-aperture"><use href="#mouth" /></clipPath>`
  + `</g>`;

/**
 * Everything drawn from the lips, as the same pose moves each of it.
 *
 * Every inside pinches back onto the lip it hangs off, so a movement of the
 * lips is a different delta on each of them and each needs its own drawing of
 * it. The installer builds a shape key per role the card ships a pose for —
 * which is how a movement the registry binds to the lips alone reaches all five
 * (`installShapedControl`; docs/MOUTH_BUILD.md).
 */
const insides = (pose) => Object.freeze({
  uvula: Object.freeze({ posePath: uvulaPath(pose) }),
  teeth: Object.freeze({ posePath: teethPath(pose) }),
  teethLower: Object.freeze({ posePath: teethLowerPath(pose) }),
  tongue: Object.freeze({ posePath: tonguePath(pose) }),
  tongueTip: Object.freeze({ posePath: tongueTipPath(pose) }),
  tongueGroove: Object.freeze({ posePath: tongueGroovePath(pose) })
});

export const MOUTH_FULL = Object.freeze({
  id: 'mouth.full', category: 'mouth', name: 'Mouth', origin: 'builtin',
  description: 'Opens, smiles, widens, puckers, leans, and shows its teeth and its tongue — in the mouth or out over the lip. The one mouth a mascot needs.',
  artwork,
  roles: Object.freeze({ mouth: 'mouth', uvula: 'uvula', teeth: 'teeth', teethLower: 'teethLower', tongue: 'tongue', tongueTip: 'tongueTip', tongueGroove: 'tongueGroove' }),
  capabilities: Object.freeze(['mouthOpen', 'smile', 'mouthWidth', 'mouthRound', 'mouthSkew', 'teeth', 'tongue', 'uvula']),
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
   * here too, and so are `mouthSkew`, `teeth` and `tongue` — six of the seven,
   * each for the reason written at it below. Only `mouthWidth` takes the
   * registry's own driver, a `scaleX`, which is the one movement a transform
   * says honestly: a wider mouth really is this mouth, wider.
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
     * numbers kept in step.
     *
     * The registry binds these two to the **lips and nothing else**, because both
     * are transforms by default and a transform on an inside collides with the
     * tongue part's own. What reaches the insides is this card's own pose: one
     * per role, because each pinches back onto the lip it hangs off and a
     * movement of the lips is therefore a different delta on each of them. The
     * installer builds a key for every role a shaped movement ships a pose for.
     *
     * `smile` is shaped for the same reason and buys more besides: the geometry
     * lifts the corners *and* deepens the lip line, where a `translateY` moves
     * the whole curve and leaves its shape alone. Until V6 it reached none of
     * the insides, and a broad grin therefore showed a row of teeth two and a
     * half units above the lip it hangs from.
     */
    mouthOpen: Object.freeze({ property: 'shapeKey', posePath: mouthPath({ open: 1 }), roles: insides({ open: 1 }) }),
    smile: Object.freeze({ property: 'shapeKey', posePath: mouthPath({ smile: 1 }), roles: insides({ smile: 1 }) }),
    mouthRound: Object.freeze({
      property: 'shapeKey',
      posePath: mouthPath({ round: 1 }),
      // Each shape puckers as its own lip does, because each is drawn from it.
      roles: insides({ round: 1 })
    }),
    /**
     * And the lean, which is the one movement the corner pins could never make.
     *
     * The rig has had asymmetric corners since CR-28 — two pins, one per end of
     * the lip line — and a pin moves the artwork near it and lets go, so pulling
     * one corner up leaves the curve between them where it was. A skew is the
     * whole mouth leaning, which is a shape.
     */
    mouthSkew: Object.freeze({
      property: 'shapeKey',
      posePath: mouthPath({ skew: 1 }),
      roles: insides({ skew: 1 })
    }),
    /**
     * And the insides **grow** rather than fade.
     *
     * `DRAWN_DRIVERS` would make each an opacity movement, which is right for a
     * card that draws a finished row of teeth and hides it. These are drawn
     * *empty* — a closed path whose halves retrace each other — so an opacity
     * could never bring them out: a shape that encloses nothing paints nothing
     * at any opacity.
     *
     * The pose is the band **shown**, and the sentence is a product:
     * `mouthOpen * teeth`. Both halves of that matter.
     *
     * The product is what keeps a closed mouth honest — closed lips have nothing
     * behind them to show, however far the control is up — and it is the
     * construction's rule rather than the part's, which is why it is said here
     * and not in the registry: a card drawing a finished row of teeth and fading
     * it in wants `teeth` alone.
     *
     * Until V6 the opening was folded into this pose as well (`{ open: 1, show:
     * 1 }`), because it was the only way to reach a band with a movement the
     * registry binds to the lips: drawn at the closed lip line, a band stayed
     * there while the lips dropped sixty units, which is a row of teeth over the
     * chin. Now `mouthOpen` ships a pose per role of its own, so the two
     * questions are two keys — travelling with the lip, and being shown — which
     * is what the template has always done and what makes a card and the sample
     * the same mouth.
     *
     * The **lower** row is the same pose on the same control, with a sentence of
     * its own: `mouthOpen * mouthOpen * teeth`, so it arrives after the upper
     * one. A mouth barely parted shows its top row and nothing else, and a lower
     * row that came up with it read as a grimace at every small opening.
     */
    teeth: Object.freeze({
      property: 'shapeKey', posePath: teethPath({ show: 1 }), expression: 'mouthOpen * teeth',
      roles: Object.freeze({
        teethLower: Object.freeze({ posePath: teethLowerPath({ show: 1 }), expression: 'mouthOpen * mouthOpen * teeth' })
      })
    }),
    tongue: Object.freeze({ property: 'shapeKey', posePath: tonguePath({ show: 1 }), expression: 'mouthOpen * tongue' }),
    /**
     * And the drop at the back of a shouting mouth, on a control of its own so
     * it can be left out. It rests at nothing, so a mascot that never asks for
     * one draws exactly what it drew before there was one -- the rule every
     * inside here obeys, and the reason an expressive extra can be added
     * without changing a single existing face (docs/MOUTH_BUILD.md).
     */
    uvula: Object.freeze({ property: 'shapeKey', posePath: uvulaPath({ show: 1 }), expression: 'mouthOpen * uvula' })
  }),
  /**
   * The tongue is a part of the rig in its own right, and this card draws the
   * two shapes it moves (docs/FACE_CONTROL_RIG.md, CR-32 … CR-34).
   *
   * It names **no roles at all**. Both shapes are this asset's own — the mouth's
   * `tongue` control is what shows the body, and its `mouthOpen` and `smile`
   * keep the tip on the lip — and one shape plays one role, so naming either
   * here as well is refused at the door. The installer hands the tongue part
   * every role it plays that this asset drew, which is how it ends up with both;
   * the hints below name them because by then it has them.
   *
   * `tongueOut` and `tongueCurl` are shapes here, where the registry used to
   * make them a `scaleY` and a `rotation`: a scale stretches the root as far as
   * the tip and grows the tongue up into the skull, and a rotation *of the
   * whole drawing about its own middle* swings the root out through a cheek.
   *
   * `tongueX` **is** a rotation, and that is a different thing: about the
   * mouth's own centre, which is where a tongue is hinged, so a tongue that is
   * out swings rather than slides. `tongueY` stays a translate, because a
   * mouth speaking moves its tongue up and down and no rotation does that.
   */
  parts: Object.freeze({
    tongue: Object.freeze({
      roles: Object.freeze({}),
      capabilities: Object.freeze(['tongueX', 'tongueY', 'tongueOut', 'tongueCurl']),
      drivers: Object.freeze({
        // Out between lips that need not be open at all, which is the whole of a
        // blep; and the body behind it reaches with it, but only while there is
        // a body -- `mouthOpen * tongue` is what draws one.
        tongueOut: Object.freeze({
          property: 'shapeKey', posePath: tongueTipPath({ out: 1 }), expression: 'tongue * tongueOut',
          roles: Object.freeze({
            tongueTip: Object.freeze({ posePath: tongueTipPath({ out: 1 }), expression: 'tongue * tongueOut' }),
            tongueGroove: Object.freeze({ posePath: tongueGroovePath({ out: 1 }), expression: 'tongue * tongueOut' }),
            tongue: Object.freeze({ posePath: tonguePath({ out: 1 }), expression: 'mouthOpen * tongue * tongueOut' })
          })
        }),
        // And the curl is the tip's alone, scaled by how far out it is: curling
        // a tongue that is still in the mouth is not a movement. The crease
        // rides it, because a fold turns with what it is a fold of.
        tongueCurl: Object.freeze({
          property: 'shapeKey', posePath: tongueTipPath({ curl: 1 }), expression: 'tongue * tongueOut * tongueCurl',
          roles: Object.freeze({
            tongueTip: Object.freeze({ posePath: tongueTipPath({ curl: 1 }), expression: 'tongue * tongueOut * tongueCurl' }),
            tongueGroove: Object.freeze({ posePath: tongueGroovePath({ curl: 1 }), expression: 'tongue * tongueOut * tongueCurl' })
          })
        })
      })
    })
  }),
  paletteRoles: Object.freeze({
    mouth: Object.freeze({ fill: 'mouth' }),
    teeth: Object.freeze({ fill: 'teeth' }),
    teethLower: Object.freeze({ fill: 'teeth' }),
    tongue: Object.freeze({ fill: 'tongue' }),
    tongueTip: Object.freeze({ fill: 'tongue' }),
    // A fold is the cavity showing through, so the crease takes the mouth's own
    // colour: one token fewer, and it stays in step on any face.
    tongueGroove: Object.freeze({ fill: 'mouth' }),
    // The uvula is flesh at the back of the throat, so it takes the tongue's
    // colour rather than a token of its own.
    uvula: Object.freeze({ fill: 'tongue' })
  }),
  // The lips, and the room the cavity needs when it is fully open: the teeth and
  // the tongue are drawn from the lips, so they are inside this by construction.
  referenceBox: Object.freeze({ x: 87, y: 169.5, width: 66, height: 14 }),
  mountPoint: 'mouth.center',
  palette: Object.freeze(['mouth', 'teeth', 'tongue'])
});
