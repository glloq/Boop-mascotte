/**
 * One way to build a mouth, and it is the only one a mascot needs
 * (docs/MOUTH_BUILD.md).
 *
 * ```text
 *        closed              open              smiling            rounded
 *      ╭────────╮         ╭────────╮         ╭────────╮         ╭──────╮
 *      ╰────────╯         │  ▁▁▁▁  │         ╰──────╯           │  ▁▁  │
 *                         │  ▔▔▔▔  │          ╰────╯            │  ▔▔  │
 *                         ╰────────╯                            ╰──────╯
 *       mouthOpen 0        mouthOpen 1         smile 1          mouthRound 1
 * ```
 *
 * **Four points and one closed path.** The corners, the upper lip's control
 * point and the lower lip's, moved by four numbers — `open`, `smile`, `arc` and
 * `round` — and the teeth and the tongue drawn *from those same curves* rather
 * than beside them. Inside by construction, which is the whole reason a cavity
 * drawn as its own shape comes apart: a shape that only happens to line up stops
 * lining up the moment anything moves.
 *
 * The library used to hold five human mouths and not one of them could **speak**.
 * `mouthRound` is the control the visemes turn on — the difference between AE
 * and OO is the aperture *puckering*, and narrowing a lens is not rounding it
 * (docs/VISEME_SYSTEM.md) — and none of the five claimed it, because none of them
 * could: a shaped movement needs the asset to ship the shape, and the installer
 * only knew how to build one for a jaw. Five drawings of a curve, and no vowels
 * between them.
 *
 * So there is one mouth, and it is this: the construction the template has
 * always drawn with, moved out here so a card and the sample are the same mouth
 * — exactly as `core/face/eye-build.js` is the same eye (docs/EYE_BUILDS.md).
 *
 * The animal ω, the six beaks and the four robot grilles stay where they are.
 * A muzzle's mouth is two curves meeting under a nose, a beak is a rigid wedge
 * that hinges, and a grille is a lit panel: different constructions, not this one
 * at another radius.
 *
 * Pure geometry. Nothing here reads a document or touches the DOM.
 */
const round = (value) => Math.round(value * 10) / 10;
const point = (p) => `${round(p.x)} ${round(p.y)}`;

/**
 * The mouth, as one closed shape.
 *
 * It used to be two: a stroked lip line that morphed for the smile, and a
 * filled cavity that scaled for the opening. Two shapes deforming under two
 * different systems cannot agree — a smile put the lip corners outside the
 * cavity, and half-open the lip sat across the hole like a stick. One closed
 * path has no such seam: the fill *is* the inside of the mouth and the stroke
 * *is* the lips, so every pose is a mouth.
 *
 * Every control point is affine in `open` and `smile`, which is what lets the
 * two additive shape keys reproduce any combination exactly rather than
 * approximately (docs/SHAPE_KEYS.md).
 *
 * **The neutral is not flat.** V1's rest pose put the upper lip's control
 * point level with its corners, which draws a straight bar: technically
 * neutral, and it read as a face with nothing behind it. Here the corners sit
 * a little above the middle of the lip line, which is the amount a relaxed
 * mouth actually curves — far short of a smile, and enough that the face is
 * alive when nothing is driving it.
 */
export const MOUTH = Object.freeze({
  cx: 120, half: 33, cornerY: 172.5,
  lipY: 176, floorY: 183.5,
  smileRise: 8, smileDrop: 13, smileSpread: 2, openDrop: 62,
  /** How far the corners lift when the head looks down. See `arc` below. */
  arcRise: 5,
  /**
   * A pucker, in three numbers (docs/VISEME_SYSTEM.md).
   *
   * `mouthWidth` narrows the mouth by *scaling* it, which makes a small lens
   * out of a large one — and a small lens is not an O. What rounds a mouth is
   * the corners coming **in** while the lip line bows **out** above and below
   * them: the aperture stops being wide and shallow and becomes tall for its
   * width, which is the whole difference between `AE` and `OO`.
   *
   * So `roundPull` draws the corners towards the middle, `roundTop` pushes the
   * upper lip up away from them and `roundFloor` pushes the lower lip down.
   * Every one of them is 0 at `mouthRound 0`, which is every mouth that has
   * never been asked to pucker.
   */
  roundPull: 19, roundTop: 7, roundFloor: 9
});

/**
 * Where the mouth's four control points are for one pose.
 *
 * `arc` is the mouth **following the curve of the skull**, and it is not an
 * expression: the head-pose turn rotates every feature by the amount the
 * surface under it has turned (`featureTilt`), which makes the two halves of a
 * pair read as one bow across the face — and does nothing at all for a feature
 * on the middle line, where the surface tilt is zero by symmetry. A mouth does
 * not tilt when a head looks down. It *bows*, and a rigid element cannot, so
 * the shape does it: the corners lift as the head drops and fall as it rises,
 * driven by `headY` through a shape key like every other change to this mouth.
 *
 * Only the corners move, which is what keeps it a bow rather than a smile.
 */
export function mouthGeometry({ open = 0, smile = 0, arc = 0, round: pucker = 0 } = {}) {
  const cornerY = MOUTH.cornerY - MOUTH.smileRise * smile - MOUTH.arcRise * arc;
  const half = MOUTH.half - MOUTH.roundPull * pucker;
  return {
    left: { x: MOUTH.cx - half - MOUTH.smileSpread * smile, y: cornerY },
    right: { x: MOUTH.cx + half + MOUTH.smileSpread * smile, y: cornerY },
    top: { x: MOUTH.cx, y: MOUTH.lipY + MOUTH.smileDrop * smile - MOUTH.roundTop * pucker },
    bottom: { x: MOUTH.cx, y: MOUTH.floorY + MOUTH.smileDrop * smile + MOUTH.openDrop * open + MOUTH.roundFloor * pucker }
  };
}

/** A point on a quadratic, so what goes inside the mouth can sit on its own lips. */
const quad = (p0, c, p2, t) => {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y };
};
/** The control point of the quadratic through three points, which is how a band follows a lip. */
const through = (a, mid, b) => ({ x: 2 * mid.x - (a.x + b.x) / 2, y: 2 * mid.y - (a.y + b.y) / 2 });

export function mouthPath(pose = {}) {
  const g = mouthGeometry(pose);
  return `M${point(g.left)} Q${point(g.top)} ${point(g.right)} Q${point(g.bottom)} ${point(g.left)} Z`;
}

/**
 * The box the lips occupy at rest, which is what the mouth's own pins are
 * measured from.
 *
 * Measured off the *control points* rather than off the drawn curve: the pin
 * that lets the jaw pull the lower lip has to reach the point that draws the
 * lower lip, and that point sits below the curve it bends. A box drawn round
 * the visible lips is a box the lower-lip pin cannot see out of, and the jaw
 * then opens the face without opening the mouth.
 */
export const MOUTH_BOX = Object.freeze((() => {
  const g = mouthGeometry();
  const top = round(Math.min(g.left.y, g.top.y) - 3);
  return { x: round(g.left.x), y: top, width: round(g.right.x - g.left.x), height: round(g.bottom.y - top) };
})());

/**
 * Teeth and tongue.
 *
 * Both are drawn *from the mouth's own curves* rather than beside them: the
 * teeth hang off the upper lip, the tongue rests just above the lower one.
 * Inside by construction, which is the whole reason the cavity used to come
 * apart — a shape that only happens to line up stops lining up the moment
 * anything moves.
 *
 * Each is **two quadratics that share their ends on the lip**, one with its
 * control point pushed into the mouth. `show` is how far. At 0 the two are the
 * same curve traced twice: the shape encloses nothing and nothing is painted,
 * so closed lips have nothing behind them to hide, by construction rather than
 * by arithmetic.
 *
 * That shared end is the whole of the redesign. The first version gave each
 * band an end of its own, a fraction of the way out, and joined the two with a
 * straight `L` — a vertical cut a few units tall at each end, with a step where
 * it met the lip. What it drew was a white slab with square corners and, under
 * it, a pink slab with square corners, the tongue being the worse of the two
 * because it was as wide as the mouth and half as deep: an open mouth was two
 * coloured blocks. Now the teeth taper into nothing before the corners the way
 * a row of upper teeth does, and the tongue is a narrow dome.
 */
export const BAND = Object.freeze({
  /** Where each band starts and ends along its lip, as a fraction of it. */
  teethFrom: 0.14, teethTo: 0.86,
  // Much narrower than the mouth: a tongue is a shape *in* the cavity, and one
  // that reaches the corners is the cavity's floor instead.
  tongueFrom: 0.29, tongueTo: 0.71,
  /**
   * How thick each is in the middle, as a fraction of the drawn cavity. A
   * quadratic reaches half its control point's offset, hence the doubling
   * where these are used.
   */
  teeth: 0.3, tongue: 0.48,
  /**
   * How far the near edge sits inside the lip, as a fraction of the far one.
   * The lip's outline is 3.8 units wide and centred on the path, so a band
   * whose edge lies exactly on it paints over the inner half and the lip goes
   * thin where the teeth are.
   */
  tuck: 0.2,
  /**
   * The tongue's own two: how far it floats off the lower lip -- the dark line
   * under it is what makes it a tongue in a mouth rather than the floor of one
   * -- and how far its underside flattens towards the chord, which is what
   * makes the shape a dome instead of a symmetric lens.
   */
  tongueLift: 0.1, tongueBase: 0.22
});

/**
 * How far a band reaches at full stretch: half the cavity of a fully open
 * mouth, and a **constant**.
 *
 * Deriving it from the pose (`(bottom - top) / 2` of *this* mouth) made every
 * point of a band a product of `open` and `show`, and the rig drives the two
 * separately: one shape key moves the band down with the lip, another brings it
 * out. A product is not the sum of its ends, so a tongue at half `tongue` on a
 * wide open mouth came out half-sized *and halfway up the cavity*, floating
 * clear of the lip it grows from. Constant here, scaled by the driver there,
 * and the two keys add up to exactly the drawing.
 */
const BAND_REACH = (MOUTH.floorY + MOUTH.openDrop - MOUTH.lipY) / 2;

/**
 * One band: two quadratics sharing their ends on the lip, one control point
 * pushed `offset` into the mouth and the other `tuck`.
 *
 * A quadratic reaches half its control point's offset, so the drawn thickness
 * in the middle is half the difference. `tuck` is what keeps the near edge off
 * the lip's own stroke: the outline is 3.8 units wide and centred on the path,
 * so a band whose edge lies exactly on that path paints over the inner half of
 * it and the lip goes thin where the teeth are. The ends still pinch to the
 * lip, which is what makes the band taper away instead of stopping.
 *
 * `lift` moves the whole band, ends and all, off the lip it hangs from — the
 * tongue's, so that a dark line of cavity shows under it. At `show 0` every one
 * of the three is 0, which is what keeps the empty shape empty.
 */
const band = (lip, from, to, offset, tuck, lift = 0) => {
  const a = lip(from), b = lip(to), control = through(a, lip((from + to) / 2), b);
  const at = (delta) => point({ x: control.x, y: control.y + lift + delta });
  return `M${point({ x: a.x, y: a.y + lift })} Q${at(tuck)} ${point({ x: b.x, y: b.y + lift })}`
    + ` Q${at(offset)} ${point({ x: a.x, y: a.y + lift })} Z`;
};

export function teethPath({ open = 0, smile = 0, arc = 0, show = 0, round: pucker = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker });
  const drop = BAND_REACH * BAND.teeth * show * 2;
  return band((t) => quad(g.left, g.top, g.right, t), BAND.teethFrom, BAND.teethTo, drop, drop * BAND.tuck);
}

export function tonguePath({ open = 0, smile = 0, arc = 0, show = 0, round: pucker = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker });
  const rise = -BAND_REACH * BAND.tongue * show * 2;
  // The lower lip, walked right to left, so the tongue is wound the same way
  // round as the teeth and the two shapes stay comparable. It rests *above* the
  // lip rather than on it: a tongue whose edge is the lip is the floor of the
  // mouth, and the dark line under it is what makes it a tongue in a mouth.
  return band((t) => quad(g.right, g.bottom, g.left, t), BAND.tongueFrom, BAND.tongueTo, rise * (1 - BAND.tongueLift), rise * BAND.tongueBase, rise * BAND.tongueLift);
}

export const MOUTH_REST = mouthPath();
export const TEETH_REST = teethPath();
export const TONGUE_REST = tonguePath();
