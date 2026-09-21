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
 * point and the lower lip's, moved by five numbers — `open`, `smile`, `arc`,
 * `round` and `skew` — and everything a mouth has *inside* it drawn from those
 * same curves rather than beside them. Inside by construction, which is the
 * whole reason a cavity drawn as its own shape comes apart: a shape that only
 * happens to line up stops lining up the moment anything moves.
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
 * ## The five shapes (V6)
 *
 * ```text
 *   mouth         the lips, and the cavity: one closed path, fill inside, stroke lips
 *   teeth         the upper row, hung off the upper lip, its biting edge scalloped
 *   teethLower    the lower row, the same band from the lower lip, shallower
 *   tongue        the body: two lobes with a groove between them, inside the cavity
 *   tongueTip     the lobe that laps **over** the lower lip when the tongue comes out
 *   tongueGroove  the crease down the middle of that lobe
 * ```
 *
 * The first three and the body are drawn *inside the aperture* and the template
 * clips them to it; the tip and its groove are drawn in front of the lips on
 * purpose, because a tongue hanging out is in front of the lip it hangs over and
 * nothing else about a cartoon face is as unmistakable.
 *
 * ## The rule every shape here obeys
 *
 * **Every point is affine in every pose number, separately.** A band's anchors
 * come from the lip curve, which is affine in `open`, `smile`, `arc`, `round`
 * and `skew`; its offsets are constants times `show`, `out` or `curl`. There is
 * no cross-term anywhere, which is what lets the rig drive each number with its
 * own additive shape key and have the sum be *exactly* the drawing rather than
 * an approximation of it (docs/SHAPE_KEYS.md). It is also why `BAND_REACH` is a
 * constant and not this mouth's own height: derived from the pose it would make
 * every offset a product of `open` and `show`, and a product is not the sum of
 * its ends.
 *
 * **And every shape is empty at rest.** Each of the four insides is a closed
 * path whose second half retraces its first exactly when its own number is 0:
 * the same points, the same control points, in reverse. It encloses nothing and
 * paints nothing, so a shut mouth has nothing behind it to hide — by
 * construction rather than by arithmetic, and without an `opacity` a binding
 * would then have to multiply back up.
 *
 * The animal ω, the six beaks and the four robot grilles stay where they are.
 * A muzzle's mouth is two curves meeting under a nose, a beak is a rigid wedge
 * that hinges, and a grille is a lit panel: different constructions, not this one
 * at another radius.
 *
 * Pure geometry. Nothing here reads a document or touches the DOM.
 */

/**
 * Two decimals, where V5 kept one.
 *
 * A row of teeth is now several segments where it was two, and each of them is
 * rounded on its own: at one decimal the rounding of a crown's control point no
 * longer cancels the rounding of the gum edge's, and a shape that is empty by
 * construction came out enclosing a sliver a fiftieth of a unit thick. Invisible,
 * and untrue -- and "empty at rest" is a property the rest of this module leans
 * on rather than a nicety.
 */
const round = (value) => Math.round(value * 100) / 100;
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
  roundPull: 19, roundTop: 7, roundFloor: 9,
  /**
   * The smirk, in two numbers (`mouthSkew`).
   *
   * Every expression that is not a mask is the two halves of the face
   * disagreeing, and the rig has had asymmetric *corners* since CR-28 — two
   * pins, one per end of the lip line. What it had no way to say is the
   * whole mouth **leaning**: a pin moves the artwork near it and lets go, so
   * pulling one corner up leaves the lip line between them where it was.
   *
   * `skewRise` lifts one corner and drops the other by as much, and
   * `skewLean` leans the lip line after them, which is what turns two moved
   * corners into one crooked mouth. Signed, so one shape key serves both
   * directions, and 0 at `mouthSkew 0` — which is every mouth that has never
   * been asked to smirk.
   */
  skewRise: 6, skewLean: 4
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
export function mouthGeometry({ open = 0, smile = 0, arc = 0, round: pucker = 0, skew = 0 } = {}) {
  const cornerY = MOUTH.cornerY - MOUTH.smileRise * smile - MOUTH.arcRise * arc;
  const half = MOUTH.half - MOUTH.roundPull * pucker;
  // One corner up, the other down by as much: a lean, never a lift, so a skew
  // on its own never reads as half a smile.
  const tilt = MOUTH.skewRise * skew;
  const lean = MOUTH.skewLean * skew;
  return {
    left: { x: MOUTH.cx - half - MOUTH.smileSpread * smile, y: cornerY + tilt },
    right: { x: MOUTH.cx + half + MOUTH.smileSpread * smile, y: cornerY - tilt },
    top: { x: MOUTH.cx + lean, y: MOUTH.lipY + MOUTH.smileDrop * smile - MOUTH.roundTop * pucker },
    bottom: { x: MOUTH.cx + lean, y: MOUTH.floorY + MOUTH.smileDrop * smile + MOUTH.openDrop * open + MOUTH.roundFloor * pucker }
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

/** The upper lip, left corner to right, as a function of how far along it. */
const upperLip = (g) => (t) => quad(g.left, g.top, g.right, t);
/** And the lower one, the same way round, so a band on either reads left to right. */
const lowerLip = (g) => (t) => quad(g.left, g.bottom, g.right, t);

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

/* ------------------------------------------------------------------ teeth -- */

/**
 * The two rows.
 *
 * Each is **a band hung off a lip whose biting edge is scalloped into crowns**,
 * and the scallop is the whole of the V6 change. A single arc back along the
 * lip draws a white slab with a curved bottom: at any size it reads as a bar of
 * light behind the lips rather than as teeth, which is why every cartoon mouth
 * ever drawn puts *some* division in it. Four crowns per row is the fewest that
 * reads as a row and the most that survives being 60 px wide on a page — the
 * brief's "simple, lisible, cartoon propre", and the reason there is no attempt
 * here to draw an individual tooth with an individual outline.
 *
 * A crown is one quadratic through three points of the lip, its middle pushed
 * to the full depth and its ends to `valley` of it. The envelope over the top
 * of that — `crown()` below — is what tapers the row away before the corners,
 * the way a row of upper teeth does and a slab does not.
 */
export const TEETH = Object.freeze({
  /** Where each row starts and ends along its lip, as a fraction of it. */
  from: 0.14, to: 0.86,
  // The lower row is shorter as well as shallower: it is what shows over a
  // lower lip, and a lower row as long as the upper one reads as a grimace.
  lowerFrom: 0.22, lowerTo: 0.78,
  /**
   * How deep each row is in the middle, as a fraction of the cavity a fully
   * open mouth has. These are depths *on the drawn edge*, not control-point
   * offsets: every point of a crown is placed where it is wanted and the
   * control is solved for, which is the only way a scalloped edge lands where
   * the numbers say.
   */
  upper: 0.32, lower: 0.08,
  /**
   * How far the near edge sits inside the lip, as a fraction of the far one.
   * The lip's outline is 3.8 units wide and centred on the path, so a band
   * whose edge lies exactly on it paints over the inner half and the lip goes
   * thin where the teeth are.
   */
  tuck: 0.05,
  /**
   * How far a row hangs **clear of the lip it grows from**, in units, at full
   * show.
   *
   * `tuck` keeps the band's middle off the stroke; its *ends* were still on
   * the lip, so the row of teeth was drawn over the top of the upper lip and
   * the lip went missing behind it. The lip's outline is 3.8 units wide and
   * centred on the path, so anything nearer than 1.9 is painting on it.
   *
   * **Exactly that, and not a unit more.** At 3.4 the row cleared the stroke
   * and then cleared a unit and a half of cavity as well, and a strip of dark
   * between an upper lip and the teeth under it does not read as *inside the
   * mouth* -- it reads as a hole where a gum should be. Teeth grow out of the
   * lip; the only thing between them is the lip's own outline.
   *
   * Multiplied by `show` and nothing else, so the shape is still exactly empty
   * at `show 0` and the one shape key still interpolates it linearly.
   */
  clear: 2, lowerClear: 2,
  /** How many crowns a row is divided into, and how far the valleys between them come back. */
  crowns: 4, valley: 0.82
});

/**
 * The envelope over a row: full across the middle, nothing at the ends.
 *
 * `sin(πu)` alone tapers far too early and draws a lens; the root pulls the
 * shoulders up so the row keeps its depth almost to the ends and then goes,
 * which is what a row of teeth does behind a lip.
 */
const crownEnvelope = (u) => Math.sin(Math.PI * u) ** 0.45;

/**
 * One row: a gum edge tucked just inside the lip, and a scalloped biting edge
 * back along it.
 *
 * At `depth`, `tuck` and `lift` all 0 the gum edge is the exact sub-arc of the
 * lip between `from` and `to`, and each crown is the exact sub-arc of *that*:
 * a quadratic restricted to a sub-interval is a quadratic, and `through` builds
 * the one that passes through the lip's own point at the middle of it. So the
 * biting edge retraces the gum edge exactly, the row encloses nothing and a
 * shut mouth has nothing behind it — by construction, not by arithmetic.
 */
const teethBand = (lip, { from, to, depth, tuck, lift, crowns, valley }) => {
  const at = (t, dy = 0) => { const p = lip(t); return { x: p.x, y: p.y + lift + dy }; };
  const span = to - from;
  const a = at(from), b = at(to);
  let d = `M${point(a)} Q${point(through(a, at((from + to) / 2, tuck), b))} ${point(b)}`;
  // How far the biting edge is from the lip at one point of it: the row's own
  // envelope, drawn back to `valley` where two crowns meet.
  const edge = (t, share) => at(t, depth * crownEnvelope((t - from) / span) * share);
  for (let i = crowns; i > 0; i -= 1) {
    const start = edge(from + span * i / crowns, valley);
    const end = edge(from + span * (i - 1) / crowns, valley);
    const belly = edge(from + span * (i - 0.5) / crowns, 1);
    d += ` Q${point(through(start, belly, end))} ${point(end)}`;
  }
  return `${d} Z`;
};

export function teethPath({ open = 0, smile = 0, arc = 0, show = 0, round: pucker = 0, skew = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker, skew });
  const depth = BAND_REACH * TEETH.upper * show;
  return teethBand(upperLip(g), {
    from: TEETH.from, to: TEETH.to, depth, tuck: depth * TEETH.tuck,
    lift: TEETH.clear * show, crowns: TEETH.crowns, valley: TEETH.valley
  });
}

/**
 * The lower row, which exists for exactly one reason: a wide open mouth with
 * teeth only along its top is a face with a hole under its nose.
 *
 * Shallower, shorter and — where the rig installs it — shown later than the
 * upper row, because a mouth barely parted shows its upper teeth and nothing
 * else. Everything below the lip is negative: the band hangs *up* off the lower
 * lip, the way the upper one hangs down.
 */
export function teethLowerPath({ open = 0, smile = 0, arc = 0, show = 0, round: pucker = 0, skew = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker, skew });
  const depth = -BAND_REACH * TEETH.lower * show;
  return teethBand(lowerLip(g), {
    from: TEETH.lowerFrom, to: TEETH.lowerTo, depth, tuck: depth * TEETH.tuck,
    lift: -TEETH.lowerClear * show, crowns: TEETH.crowns, valley: TEETH.valley
  });
}

/* ----------------------------------------------------------------- tongue -- */

/**
 * The tongue, in two shapes, because it does two things in two places.
 *
 * ```text
 *          ╭──╮╭──╮          tongue      the body: two lobes and the groove
 *   ───────┤        ├──────  the lower lip, where both are anchored
 *           ╲____╱           tongueTip   the lobe that laps over it
 * ```
 *
 * **Why two.** A tongue that is out is *in front of the lower lip*, and a
 * tongue that is in is *behind* it — one element cannot be both, and the one
 * that used to try was drawn in front of the lips always, which is why it had
 * to be kept narrow enough never to reach a corner. Split, the body is drawn
 * inside the aperture and clipped to it, so nothing it is asked to do can push
 * it through a lip; the tip is drawn in front of everything, because that is
 * where a tongue hanging out belongs.
 *
 * **The groove.** V5 drew the back as one arch, on purpose: a single cubic with
 * a node in its middle pulled up on both sides of it and came out as a
 * butterfly. One arch has one peak, and one peak is a hill rather than a
 * tongue. Two arches — a lobe per half, meeting at a node that stops short of
 * their peaks — have two peaks and a groove between them, which is what a
 * tongue looks like and what the butterfly was reaching for. It costs nothing
 * at the rig: it is the same shape key, two segments longer.
 *
 * **`out` and `curl` are shapes, not transforms** (docs/FACE_CONTROL_RIG.md,
 * CR-32 … CR-34). `tongueOut` was a `scaleY` about the tongue's middle, which
 * stretches the root as much as the tip and grows a tongue *upwards into the
 * skull* as readily as out of the mouth; `tongueCurl` was a rotation of the
 * whole shape, which swings the root out through the cheek. Here `out` extends
 * the **tip** past the lip and moves nothing else — the body behind it is what
 * is *in* the mouth, and flattening it as the tip reached made the two halves of
 * one tongue answer to different numbers — and `curl` lifts and draws in the
 * tip's free edge and touches nothing else either. Which is what those two
 * words mean.
 */
export const TONGUE = Object.freeze({
  /** Where the body is read off the lower lip: the stations its own edges
   *  take their *height* from, short of the corners so the lip goes on
   *  reading as a lip behind it. Its *width* is its own -- see `width`. */
  from: 0.27, to: 0.73,
  /**
   * Half the tongue's own width, as a fraction of the reach, and how much of
   * the mouth's own half-span it adds to that (`grip`).
   *
   * A tongue used to be the lip curve between `from` and `to`, which meant a
   * mouth pursed into an OO drew a tongue *58 % narrower* -- a pink spike out
   * of a small round hole, where what a pursed mouth actually shows is the
   * same tongue through a smaller opening. A tongue is a piece of the face,
   * not a share of the aperture, so its width is mostly a number of its own
   * and the mouth has a quarter of the say: enough that a pucker still reads
   * as one, far short of taking the roundness off the end of it.
   *
   * Both terms are affine in the pose numbers -- a constant, and a quarter of
   * a span that is itself affine -- so the shape keys still add up exactly.
   */
  width: 0.24, grip: 0.45,
  /** How far each lobe rises into the cavity, as a fraction of the cavity a
   *  fully open mouth has. Over the lower row of teeth, clearly -- a tongue
   *  that only just clears them reads as a pink line rather than as a tongue --
   *  and well short of the upper row, or it swallows the mouth. */
  up: 0.56,
  /**
   * How far the groove between the two lobes comes back off their peaks.
   *
   * Small, and that is the point of it. At 0.3 the two lobes and the notch
   * between them drew a capital **M**: a shape with a corner in it, which a
   * tongue does not have. The dip is a fold in a soft thing, so it is a
   * shallow one -- enough that the silhouette says *two* lobes, not enough
   * that the eye reads a letter.
   */
  groove: 0.14,
  /** Where each lobe's controls sit inside its half: what makes it round
   *  rather than square, and -- spread wider than the 0.28 the M was drawn
   *  with -- what turns the climb out of each corner into a slope rather
   *  than a shoulder. */
  shoulder: 0.42,
  /** How far the body's underside hangs below the lip it rests on. Small: the
   *  lip is its floor, and the dark line of it is what says the tongue is in a
   *  mouth rather than being the floor of one. */
  seat: 0.05,

  /**
   * The tip is drawn in the **body's own seat** -- the same centre, the same
   * width -- because it is the same tongue. It used to have a seat of its own,
   * two thirds as wide, and what that drew was a step in the silhouette right
   * where the tongue crosses the lip: a tongue with a shoulder in it.
   */
  tipShoulder: 0.3,
  /** How far past the lip the tip laps at `tongueOut 1`. */
  reach: 0.34,
  /**
   * And how far its root is drawn back **up into the mouth**, so that a tongue
   * that is out is one shape from its root to its end.
   *
   * This is the number that stops the tongue breaking in two. The tip is
   * outside the clip and the body is inside it, so what joins them is however
   * much of the tip is painted *above* the lip -- and at 0.1 that was three and
   * a half units, less than the lower row of teeth stands (four), and less than
   * `tongueY` moves the whole tongue down (six). Any of those opened a gap
   * across the middle of the tongue.
   *
   * At 0.3 it reaches ten units back: over the lower row it laps across, and
   * far enough that the aim cannot pull the two apart. Not further, because the
   * tip is painted in **front** of the lips and a root deep enough for an open
   * mouth is a pink blot over a shut one -- at 0.42 a blep covered the lip line
   * it was supposed to be poking between.
   *
   * It is still a multiple of `out` and nothing else, so a tongue that is in
   * has no tip at all.
   */
  root: 0.3,
  /** The soft dimple at the very end: a cartoon tongue is *round*, so this is
   *  a hint of a cleft rather than one -- at 0.14 the end had a corner in it. */
  notch: 0.05,
  /**
   * A curl: the **middle** of the free edge lifts, the shoulders barely, and
   * the lobe draws in behind it. Nothing here moves the root, which is what
   * stops a curl swinging the tongue out through a cheek.
   *
   * The shoulders matter as much as the middle. Lifting the whole free edge by
   * one number is not a curl, it is the tongue going back in: at `tongueCurl 1`
   * there was nothing left lapping over the lip. Lifting the middle and holding
   * the sides turns the end up and leaves the tongue as long as it was, which
   * is what curling is -- and, signed, the same key droops it.
   */
  curlLift: 0.16, curlShoulder: 1, curlPinch: 0.05,

  /**
   * The crease down the middle of the tip, in three numbers: how far back into
   * the mouth it starts, how far down it runs as a share of the tip's own
   * reach, and how wide it is.
   *
   * It belongs to the **front** rather than to the body (§5.1 of the V6 brief
   * puts `tongue-groove` under `tongue-front`), and that is a drawing decision
   * rather than a filing one: the body already reads as two lobes because its
   * silhouette dips between them, and a tongue *out* has no silhouette to dip
   * -- it is a flat pink shape against a chin, and a line down it is the only
   * thing that says which way up it is.
   */
  grooveRoot: 0.06, grooveRun: 0.62, grooveWidth: 0.05
});

/**
 * A cubic reaches `(a + 3c₁ + 3c₂ + b) / 8` at its middle, so the control
 * offset that puts a lobe's peak exactly where it is wanted is this.
 *
 * Linear in all three, which is what keeps the whole shape affine in the pose
 * numbers and therefore exactly reproducible by additive shape keys.
 */
const lobeControl = (peak, a, b) => (8 * peak - a - b) / 6;

/**
 * The frame a tongue is drawn in: where it sits, how wide it is, and how high
 * the lip is under each point across it.
 *
 * `u` runs from −1 at the left edge to +1 at the right. The **x** is the
 * tongue's own half-width either side of the middle of the lip it grows from;
 * the **y** is the lip's own height at the station that `u` corresponds to, so
 * the tongue still sits on a lip that is smiling, open, puckered or leaning,
 * and still leans with it.
 *
 * Splitting the two is the whole of it. A tongue whose edges *were* two points
 * on the lip curve had no width of its own: pursing the mouth took the corners
 * in and the tongue came with them, and `mouthRound 1` drew a spike. Reading
 * the height there and the width from a number of its own gives a tongue that
 * keeps its shape through the pose and an opening that can still be any size.
 *
 * Every term is affine in every pose number — `centre` and the lip heights are
 * points on a quadratic whose controls are affine, `span` is a difference of
 * two of them — so the rig's additive shape keys still reproduce any
 * combination exactly.
 */
const tongueSeat = (lip, from, to, width) => {
  const mid = (from + to) / 2;
  const centre = lip(mid), span = (lip(to).x - lip(from).x) / 2;
  const half = BAND_REACH * width + TONGUE.grip * span;
  return (u, dy = 0, dx = 0) => ({ x: centre.x + half * u + dx, y: lip(mid + (to - mid) * u).y + dy });
};

/**
 * The body: two lobes over the cavity, and the same two back underneath.
 *
 * The underside uses the back's own control *parameters* in reverse, which is
 * what makes the shape exactly empty when every offset is 0: the second half
 * retraces the first point for point, and a path that encloses nothing paints
 * nothing at any opacity.
 */
export function tonguePath({ open = 0, smile = 0, arc = 0, show = 0, round: pucker = 0, skew = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker, skew });
  const at = tongueSeat(lowerLip(g), TONGUE.from, TONGUE.to, TONGUE.width);
  // Up is negative. `out` is deliberately not here: the body is what is *in*
  // the mouth, and flattening it as the tip reaches made the two halves of one
  // tongue answer to different numbers -- at `tongue 0` and `tongueOut 1` it
  // drew a slab below the lip that only the clip was hiding.
  const peak = -BAND_REACH * TONGUE.up * show;
  const dip = peak * (1 - TONGUE.groove);
  const seat = BAND_REACH * TONGUE.seat * show;
  // The four control stations, a pair inside each half.
  const s = TONGUE.shoulder, u = [-1 + s, -s, s, 1 - s];
  const backLobe = lobeControl(peak, 0, dip);
  const underLobe = lobeControl(seat, 0, seat);
  return `M${point(at(-1))}`
    // The two lobes, and the shallow fold where they meet.
    + ` C${point(at(u[0], backLobe))} ${point(at(u[1], backLobe))} ${point(at(0, dip))}`
    + ` C${point(at(u[2], backLobe))} ${point(at(u[3], backLobe))} ${point(at(1))}`
    // And back underneath, through the same stations in reverse.
    + ` C${point(at(u[3], underLobe))} ${point(at(u[2], underLobe))} ${point(at(0, seat))}`
    + ` C${point(at(u[1], underLobe))} ${point(at(u[0], underLobe))} ${point(at(-1))} Z`;
}

/**
 * The tip: the lobe that laps over the lower lip, and nothing else.
 *
 * Empty at `out 0` — every offset in it is a multiple of `out` or of `curl`,
 * and the underside retraces the upper edge when both are 0 — so a mouth whose
 * tongue is in has no tip to hide. Its root is drawn *back into* the mouth so
 * it meets the body under the lip; the lip's own stroke is 3.8 units wide and
 * centred on the path, and the root clears half of that and then some.
 *
 * `curl` moves the free edge and never the root: the end lifts and the lobe
 * draws in behind it, which is a tongue curling. It is applied to the underside
 * alone, and that is deliberate — a pinch applied to both edges alike would
 * retrace and the movement would come out as nothing at all.
 */
export function tongueTipPath({ open = 0, smile = 0, arc = 0, round: pucker = 0, skew = 0, out = 0, curl = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker, skew });
  const at = tongueSeat(lowerLip(g), TONGUE.from, TONGUE.to, TONGUE.width);
  const s = TONGUE.tipShoulder, u = [-1 + s, -s, s, 1 - s];
  // Back into the mouth at the root, out past the lip at the free edge, and
  // the cleft short of it in the middle.
  const root = -BAND_REACH * TONGUE.root * out;
  const lap = BAND_REACH * TONGUE.reach * out, lift = BAND_REACH * TONGUE.curlLift * curl;
  const reach = lap - lift * TONGUE.curlShoulder;
  const cleft = lap * (1 - TONGUE.notch) - lift;
  const pinch = BAND_REACH * TONGUE.curlPinch * curl;
  const rootLobe = lobeControl(root, 0, root);
  const freeLobe = lobeControl(reach, 0, cleft);
  return `M${point(at(-1))}`
    // The upper edge, tucked back under the lip.
    + ` C${point(at(u[0], rootLobe))} ${point(at(u[1], rootLobe))} ${point(at(0, root))}`
    + ` C${point(at(u[2], rootLobe))} ${point(at(u[3], rootLobe))} ${point(at(1))}`
    // And the free edge back, past the lip: the curl lifts it and draws it in.
    + ` C${point(at(u[3], freeLobe, -pinch))} ${point(at(u[2], freeLobe, -pinch))} ${point(at(0, cleft))}`
    + ` C${point(at(u[1], freeLobe, pinch))} ${point(at(u[0], freeLobe, pinch))} ${point(at(-1))} Z`;
}

/**
 * The crease down the tongue's tip.
 *
 * A slim lens from just inside the mouth to short of the tip's cleft, drawn in
 * the cavity's own colour at a low opacity: a groove is a fold, and a fold is
 * the shadow the light does not reach rather than a colour of its own. Painting
 * it with the palette's `mouth` token is what keeps it in step with the inside
 * of the mouth it is a fold of, on any face and in any palette.
 *
 * Every offset is a multiple of `out` or of `curl`, so at `tongueOut 0` its two
 * ends are the same point, its two controls are that point, and it encloses
 * nothing — a tongue that is in has no crease to show, by the same construction
 * as everything else inside this mouth.
 *
 * It rides the curl: its foot is a share of the tip's own cleft, so turning the
 * end of the tongue up carries the crease with it rather than leaving a line
 * painted across a lip.
 */
export function tongueGroovePath({ open = 0, smile = 0, arc = 0, round: pucker = 0, skew = 0, out = 0, curl = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker, skew });
  const at = lowerLip(g)((TONGUE.from + TONGUE.to) / 2);
  const lap = BAND_REACH * TONGUE.reach * out, lift = BAND_REACH * TONGUE.curlLift * curl;
  const head = { x: at.x, y: at.y - BAND_REACH * TONGUE.grooveRoot * out };
  const foot = { x: at.x, y: at.y + (lap * (1 - TONGUE.notch) - lift) * TONGUE.grooveRun };
  const wide = BAND_REACH * TONGUE.grooveWidth * out;
  const waist = (side) => point({ x: at.x + wide * side, y: (head.y + foot.y) / 2 });
  return `M${point(head)} Q${waist(-1)} ${point(foot)} Q${waist(1)} ${point(head)} Z`;
}

/* ------------------------------------------------------------------ uvula -- */

/**
 * The uvula: the drop that hangs at the back of a shouting cartoon mouth.
 *
 * It is the one thing in here that is *not* about being read as anatomy. A
 * mouth wide open with nothing in the dark of it reads as a hole; the same
 * mouth with one small shape swinging at the back of it reads as a **shout**,
 * and every cartoon ever drawn knows it. That is why it is offered and why it
 * is off by default: it is a register, not a feature, and a mascot talking
 * quietly should not have one.
 *
 * Drawn from the **upper** lip, at its middle, hanging down into the cavity —
 * so it follows the lip line, the pucker and the lean like everything else in
 * here, and it is the first thing painted inside the aperture because it is
 * the furthest away.
 */
export const UVULA = Object.freeze({
  /** Where along the upper lip it hangs from: the middle of it, which is the
   *  back of the throat once the mouth is read as a mouth. */
  at: 0.5,
  /**
   * How far down the cavity it is hung from, and how far it then hangs, as
   * fractions of the cavity a fully open mouth has.
   *
   * It hangs from *below the upper row of teeth*, not from the lip. Two things
   * pushed it there. The lip's outline is 3.8 units wide and centred on the
   * path, so a shape hung from the line itself is painted over the inner half
   * of it -- and the first pass hung it upwards from there, which put the top
   * of the uvula on top of the upper lip, a drop growing out of the outside of
   * a mouth. Then, hung just below the lip, the row of teeth swallowed it
   * whole: they reach thirteen units in and it only reached ten.
   *
   * At `hang 0.4` it starts a unit below where a full row of teeth ends, which
   * is where a uvula is: at the back of the throat, behind everything and
   * under the roof of the mouth. Both numbers scale with the same `show`, and
   * so do the teeth, so the two stay in that order at every opening.
   */
  hang: 0.4, drop: 0.28, wide: 0.18,
  /**
   * What makes it a **drop falling** rather than a lens: narrow where it is
   * attached, widest low, round at the bottom. `neck` is the share of the full
   * width the upper pair of controls gets, and `belly` is how far down the
   * lower pair sits.
   */
  neck: 0.3, shoulder: 0.3, belly: 0.82
});

/**
 * A drop: two cubics, out and back, from a point on the upper lip.
 *
 * Empty at `show 0` like everything else inside this mouth — every offset is a
 * multiple of `show`, so its four points and its four controls are the same
 * point on the lip and it encloses nothing.
 */
export function uvulaPath({ open = 0, smile = 0, arc = 0, show = 0, round: pucker = 0, skew = 0 } = {}) {
  const g = mouthGeometry({ open, smile, arc, round: pucker, skew });
  const lip = upperLip(g)(UVULA.at);
  const run = BAND_REACH * UVULA.drop * show, wide = BAND_REACH * UVULA.wide * show;
  const head = { x: lip.x, y: lip.y + BAND_REACH * UVULA.hang * show };
  const foot = { x: lip.x, y: head.y + run };
  const side = (at, s, w) => ({ x: lip.x + w * s, y: head.y + (foot.y - head.y) * at });
  return `M${point(head)}`
    + ` C${point(side(UVULA.shoulder, -1, wide * UVULA.neck))} ${point(side(UVULA.belly, -1, wide))} ${point(foot)}`
    + ` C${point(side(UVULA.belly, 1, wide))} ${point(side(UVULA.shoulder, 1, wide * UVULA.neck))} ${point(head)} Z`;
}

export const MOUTH_REST = mouthPath();
export const TEETH_REST = teethPath();
export const TEETH_LOWER_REST = teethLowerPath();
export const TONGUE_REST = tonguePath();
export const TONGUE_TIP_REST = tongueTipPath();
export const TONGUE_GROOVE_REST = tongueGroovePath();
export const UVULA_REST = uvulaPath();
