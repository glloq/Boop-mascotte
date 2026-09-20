
/**
 * The mascot face — Basic Face V2 — and the pair of hands it ships with.
 *
 * The hands are not drawn here: they are the generated glove's drawings
 * (`core/hands/hand-style-art.js`), placed by the same `handPlacement` that
 * `installSpriteHands` rigs them with, so the template ships exactly what pressing
 * **Draw a pair of hands** produces and there is no second set of coordinates
 * to keep in step. What this module owns is that they are *in* the artwork at
 * all, and the taller artboard that leaves them room below the face.
 *
 * One template, deliberately: three starter faces meant three sets of artwork
 * to keep rigged, and the two extra ones were strictly smaller than this. What
 * a beginner needs is a complete face they can strip down, not three partial
 * ones they have to build up.
 *
 * Every id here is wired by `applyTemplateProject`, so the two files are read
 * together. Paint order is the layer order: what is written first is behind.
 * The rest positions the rigging needs are exported from here rather than
 * copied there — the template drew this face, so the template knows where its
 * eyes are (`FACE_CENTRES`, `MOUTH_BOX`, `BROW_BOXES`).
 *
 * **V2 is a redraw, not a new system.** Same ids, same shape keys, same 2.5D
 * turn; what changed is the drawing:
 *
 *   - the silhouette is no longer a circle. A cranium wider than the jaw, the
 *     cheeks drawing in, a small soft chin — one closed outline, so the jaw is
 *     still a shape key on it and there is still no second shape to open a
 *     double chin (see `headPath`);
 *   - the eyes are *rounder* (24 × 22.5, against 26 × 21). Round eyes are the
 *     face's one fixed feature, and V1's were stretched enough to read as
 *     lozenges at small sizes;
 *   - the brows are drawn rather than stroked, so they can be heavy at the
 *     inner end and taper to a point at the outer one. They are the loudest
 *     line on the face, which is what makes an expression readable without
 *     touching the eyes;
 *   - the nose is a small asymmetric hook instead of a wide half circle. A
 *     `U` the width of a mouth, above a mouth, reads as a second mouth;
 *   - the neutral mouth curves. A dead flat lip line reads as a dead face;
 *   - the hair is a swept mass with a parting off the middle line and a curled
 *     tip — a silhouette, rather than a helmet with saw teeth;
 *   - the two slab cheek shadows are gone. What is left is a narrow crescent
 *     inside each edge, a soft shadow under the fringe, and one highlight.
 *
 * **The eyes have no socket** (docs/EYE_BUILDS.md). They had one: a `<clipPath>`
 * in `<defs>`, with the lids drawn open and parked *outside* it. That put a
 * pupil behind the lid instead of fading it out, which was right, and it cost
 * something an author could see: the clip appeared in neither the layer tree nor
 * `document.elements`, so it could not be moved, resized or deleted, and the
 * parked lids made the eye group's box **191 × 281 screen pixels around an eye
 * of 100 × 94** — the selection handles ninety pixels off the eye on every side,
 * and a press in the middle of the box moving nothing at all.
 *
 * A lid is the eye's own ellipse, squashed to a sliver on the rim it swings
 * from and **scaled about that rim** to cover the eye. Scaling an ellipse about
 * its top point gives another ellipse sitting on that edge, so the leading edge
 * is a curve at every opening and lands exactly on the far rim when shut.
 * Nothing is ever outside the eye, so nothing needs clipping and the eye's box
 * is the eye. The pupil still sits *behind* the lid, because the lid is still an
 * opaque shape painted over it.
 *
 * The fringe is clipped the same way, to the head itself, and so are the
 * shadows and the highlight. The clip is `headPath()` — the silhouette's own
 * geometry, not a circle that approximates it, so nothing can show a sliver of
 * itself past an outline it was supposed to be inside of.
 *
 * The hair **overlaps**, it does not abut. Two shapes that share an edge are
 * one drawing only while nothing moves: the back of the hair and the crown used
 * to meet along the same curve and the crown's own lower edge sat exactly on
 * the head's outline, so a few pixels of turn or of secondary motion opened the
 * page between them and drew the head's border across the top of the hair. The
 * back is one solid cap, and the crown reaches a good way inside the head,
 * under the fringe. Whatever moves, hair is behind hair.
 */

/**
 * Every colour the face is drawn in, once.
 *
 * V1 spelled its browns into whichever function needed them, and half the face
 * was the same three heavy browns: the outline, the shading, the crown and the
 * back of the hair were all within a few percent of each other, which is why
 * the mascot read as a brown blob at small sizes. The palette below separates
 * them by *role* — an outline is not a shadow is not hair — and lightens the
 * shadows a long way: a cartoon shadow is a slightly darker skin, not a brown.
 *
 * Changing the mascot's colouring is changing this object: nothing below
 * writes a literal colour, and a test fails on one that does.
 */
export const FACE_PALETTE = Object.freeze({
  skin: '#f9d9b0',
  skinHighlight: '#fff1d9',
  skinShadow: '#eab98a',
  /** The silhouette, the eye rims, the mouth: the lines that carry the face. */
  outlinePrimary: '#a4674a',
  /** Ears, folds, the nose: lines that are there to be read, not noticed. */
  outlineSecondary: '#bd8763',
  hairBase: '#a6603c',
  hairShadow: '#7c4529',
  hairHighlight: '#c8874f',
  pupil: '#2f3a43',
  glint: '#ffffff',
  eyeWhite: '#ffffff',
  lip: '#b4525c',
  mouthInterior: '#6d2831',
  tongue: '#d9707f',
  teeth: '#fff8ec'
});

/**
 * Stroke weights and opacities, once.
 *
 * A cartoon face is read as a hierarchy of lines, not as a set of shapes: the
 * silhouette holds the character, the brows carry the mood, and everything
 * below them is detail. V1 drew the eye rim at 6 and the mouth at 6 — heavier
 * than the silhouette at 4 — so the eyes and the mouth fought the outline and
 * the face read as flat. These weights order them deliberately.
 */
export const FACE_STYLE = Object.freeze({
  silhouette: 4,
  /** The brows are a filled shape; this is how thick it gets at its widest. */
  browWeight: 8.4,
  /** And the hairline stroke that rounds off its own corners. */
  browEdge: 1.4,
  eyeOutline: 4,
  mouthOutline: 3.8,
  noseOutline: 2.8,
  earOutline: 2.6,
  detail: 2.2,
  /**
   * A lid's crease — which is also the seam of a shut eye, because the two are
   * the same line (`creasePath`). Heavier than the old crease was, because it is
   * now the *only* line a closed eye has: the lids are fill and the eye's own rim
   * fades out as they meet.
   *
   * The lower lid's is lighter, as it was: the upper lid is the one a viewer
   * reads a blink from.
   */
  creaseUpper: 3,
  creaseLower: 2.4,
  /** Cartoon shading: present, never noticed. V1's cheek slabs were at .5. */
  shadeOpacity: 0.22,
  hairShadeOpacity: 0.13,
  highlightOpacity: 0.16,
  glintOpacity: 0.92,
  sparkOpacity: 0.66,
  earFoldOpacity: 0.55,
  /** The crease down the tongue: the cavity's own colour, softened into a fold. */
  grooveOpacity: 0.3
});

/** One decimal is plenty for a 240-unit artboard, and keeps the paths short. */
const round = (value) => Math.round(value * 10) / 10;
const point = (p) => `${round(p.x)} ${round(p.y)}`;

/**
 * A smooth path through a list of points.
 *
 * The hair, the shadows and the highlight are *silhouettes*: what matters is
 * where their outline goes, and the tangents in between are nobody's decision.
 * Writing them as cubics meant every tweak was four numbers, and the join
 * between two hand-written segments was a corner unless the control points
 * happened to line up — which is exactly how V1's hair ended up with notches
 * in it.
 *
 * So they are point lists, and this turns a list into a Catmull-Rom spline
 * (expressed as cubics, because SVG has no spline). Smooth by construction:
 * there is no way to write a corner into one of these shapes by accident.
 *
 * @param {{x:number,y:number}[]} points
 * @param {{ closed?: boolean, tension?: number }} [options]
 */
export function spline(points, { closed = true, tension = 1 } = {}) {
  const n = points.length;
  const at = (index) => points[closed ? (index + n) % n : Math.max(0, Math.min(n - 1, index))];
  const last = closed ? n : n - 1;
  let d = `M${point(points[0])}`;
  for (let index = 0; index < last; index += 1) {
    const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2);
    const c1 = { x: p1.x + ((p2.x - p0.x) * tension) / 6, y: p1.y + ((p2.y - p0.y) * tension) / 6 };
    const c2 = { x: p2.x - ((p3.x - p1.x) * tension) / 6, y: p2.y - ((p3.y - p1.y) * tension) / 6 };
    d += ` C${point(c1)} ${point(c2)} ${point(p2)}`;
  }
  return closed ? `${d} Z` : d;
}

/** Point lists read better as pairs than as a wall of `{ x, y }`. */
const path = (pairs, options) => spline(pairs.map(([x, y]) => ({ x, y })), options);

/* ------------------------------------------------------------------ head -- */

/**
 * The silhouette, as points rather than as a string.
 *
 * Written this way because three other things need the *shape* and not the
 * markup: the jaw shape key stretches it, the clip path is it, and the ears
 * have to land their outlines on it (`headEdgeAt`). A path built once from
 * this list is one drawing; a path typed out three times is three drawings
 * that agree until someone edits one of them.
 *
 * Read as: start at the top of the skull, go down the right side, round the
 * chin, back up the left. `midY` is the line the jaw stretches from — nothing
 * above it moves when the mouth opens, which is what keeps a widening face
 * from reading as an inflating one.
 */
const HEAD = Object.freeze({
  cx: 120,
  midY: 116,
  top: 22,
  bottom: 210,
  /** How much longer the lower face gets at a full jaw drop. */
  jawStretch: 0.18
});

/**
 * The outline, as cubic segments from the apex clockwise.
 *
 * The cranium is at its widest around y 114 and the jaw has drawn in to about
 * 60 % of that by y 191, which is the whole difference between this and a
 * circle: a head that is wide at the temples and narrow at the chin reads as a
 * character, where a circle reads as a ball with a face on it.
 */
const HEAD_SEGMENTS = Object.freeze([
  { c1: { x: 162, y: 22 }, c2: { x: 206, y: 48 }, to: { x: 213, y: 100 } },
  { c1: { x: 219, y: 140 }, c2: { x: 200, y: 171 }, to: { x: 170, y: 191 } },
  { c1: { x: 153, y: 204 }, c2: { x: 138, y: 210 }, to: { x: 120, y: 210 } },
  { c1: { x: 102, y: 210 }, c2: { x: 87, y: 204 }, to: { x: 70, y: 191 } },
  { c1: { x: 40, y: 171 }, c2: { x: 21, y: 140 }, to: { x: 27, y: 100 } },
  { c1: { x: 34, y: 48 }, c2: { x: 78, y: 22 }, to: { x: 120, y: 22 } }
]);

/**
 * The head, as one outline that lengthens.
 *
 * It used to be a circle with a wider ellipse hidden behind it, and dropping
 * that ellipse gave the mascot a **double chin**: two arcs crossing at the
 * jaw, because two outlines cannot be one silhouette however carefully they
 * are placed.
 *
 * So there is one outline, and the jaw is a shape key on it: everything below
 * the middle line stretches downwards, which is what a jaw opening looks like
 * from the front. `mouthOpen + jawOpen` drives it, so the mouth takes the face
 * with it and an author can still drop the jaw on its own.
 */
export function headPath({ jaw = 0 } = {}) {
  const grow = 1 + jaw * HEAD.jawStretch;
  // Only the lower half stretches: the temples and the widest points do not.
  const at = ({ x, y }) => `${round(x)} ${round(y > HEAD.midY ? HEAD.midY + (y - HEAD.midY) * grow : y)}`;
  const start = { x: HEAD.cx, y: HEAD.top };
  return `M${at(start)}` + HEAD_SEGMENTS.map((s) => ` C${at(s.c1)} ${at(s.c2)} ${at(s.to)}`).join('') + ' Z';
}

export const HEAD_REST = headPath();

/** A point on a cubic, which is how the ears find the outline they sit on. */
const cubic = (p0, c1, c2, p3, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * t * u * u, c = 3 * t * t * u, d = t * t * t;
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, y: a * p0.y + b * c1.y + c * c2.y + d * p3.y };
};

/**
 * Where the silhouette is, at one height.
 *
 * The ear's outline has to *end on the head's outline* or the silhouette shows
 * a step where the two meet — the ear stops looking like part of the head and
 * starts looking like a sticker on it. Sampling the real curve is what keeps
 * that true after the head is redrawn, which typing the numbers in by hand
 * did not.
 *
 * @param {number} y height in artwork units
 * @param {'left'|'right'} side which side of the face
 * @returns {number} the x the outline crosses that height at
 */
export function headEdgeAt(y, side = 'right') {
  let best = null, from = { x: HEAD.cx, y: HEAD.top };
  for (const segment of HEAD_SEGMENTS) {
    for (let step = 0; step <= 48; step += 1) {
      const at = cubic(from, segment.c1, segment.c2, segment.to, step / 48);
      const near = Math.abs(at.y - y);
      const wanted = side === 'left' ? at.x < HEAD.cx : at.x > HEAD.cx;
      if (!wanted) continue;
      if (!best || near < best.near) best = { near, x: at.x };
    }
    from = segment.to;
  }
  return best ? round(best.x) : HEAD.cx;
}

/** The width the head-turn generator measures its parallax against. */
export const HEAD_WIDTH = round(headEdgeAt(114, 'right') - headEdgeAt(114, 'left'));

/* ------------------------------------------------------------------- eyes -- */

/**
 * The eyes: round, and staying round.
 *
 * `rx` and `ry` are within 7 % of each other (V1 was 24 % apart), because the
 * one thing the mascot is recognised by is a pair of round eyes — and the
 * 2.5D turn already foreshortens them, so a drawing that starts stretched ends
 * up as a lozenge the moment the head moves. The socket, the white, the rim
 * and the lids are all derived from these three numbers, so the eye can be
 * resized without any of them coming apart.
 */
export const EYE = Object.freeze({ cy: 113, rx: 24, ry: 22.5, left: 83, right: 157 });
/**
 * The pupil, and how far the gaze may carry it.
 *
 * `travel` is the binding amplitude the gaze gets (`lookX` / `lookY` at ±1), so
 * `r + travel` is how close the pupil's edge comes to the socket: 18.5 against
 * a 22.5 socket, which leaves the white visible all the way round at any gaze.
 * A pupil that touches the rim reads as an eye rolled back, not as a look.
 */
export const PUPIL = Object.freeze({ r: 10.5, travel: 8 });

/**
 * How a lid is drawn, and how far it has to grow to shut the eye.
 *
 * A lid is the eye's **own ellipse, squashed to a sliver on the rim it swings
 * from** — which is what an open eye actually shows of an eyelid — and scaled
 * about that rim until it covers the eye:
 *
 * ```text
 *   scaleY 1          scaleY cover/2      scaleY cover
 *   ╭─────╮           ╭─────╮            ╭─────╮
 *   │ ⬤   │           ├─────┤            │█████│
 *   ╰─────╯           ╰─────╯            ╰─────╯
 *    open             half                shut
 * ```
 *
 * Scaling an ellipse about its top point gives another ellipse sitting on that
 * edge, so `cover = ry / lidRy` takes the sliver to exactly the eye's own
 * ellipse: the leading edge is a curve at every opening and lands on the far rim
 * when shut, never past it. That is what makes the socket unnecessary
 * (docs/EYE_BUILDS.md).
 *
 * V1 *translated* a lid drawn as a big rectangle parked clear of the eye, and
 * needed a clip to crop it. Twice over, in fact: the travel counted the lid's
 * own curved edge a second time, so a closed eye had the upper lid 8 units below
 * the seam and the lower 6 above — 14 units of overlap on an eye 45 tall, with
 * a crease drawn where no eye closes. The clip hid it.
 */
const LID = Object.freeze({
  /**
   * How tall a lid is drawn, as a fraction of the eye's own half-height.
   *
   * A **hairline**, and it has to be: a lid is drawn on its rim and grown from
   * there, so whatever is drawn is what an open eye shows of it. At a twentieth
   * of the eye that was a band of skin and a crease inside the outline at rest
   * -- an eye that never quite opened, which is what an author sees as *les
   * paupières restent visibles légèrement*. At a seven-thousandth it is a third
   * of a screen pixel, tucked under the outline's own stroke, and the factor it
   * grows by takes up the difference.
   *
   * It is also what makes half a blink cover half the eye: the lid's edge starts
   * at the rim and travels linearly to the seam, so it is at the middle when
   * `eyeOpen` is. Drawn a fifth of the eye deep, half a blink was two thirds.
   */
  slice: 0.007,
  /** A shade below the middle of the eye, which is where a lash line sits. */
  seam: 1,
  /**
   * How far each lid's leading edge bulges, as a fraction of its own half-height.
   *
   * On the sliver rather than on the eye, so a lid that is scaled up carries its
   * shape with it: the edge of a shut lid is the edge of the drawn one, eight
   * times as far from the rim and eight times as curved, which is what a lid
   * sweeping across an eye looks like.
   */
  bulge: 0.55, dip: 0.4,
  /**
   * How far each lid moves at `eyeSquint 1`, and how far the leading edge bends
   * at `eyeCurve ±1`, both **on the drawn sliver**.
   *
   * The lower lid comes up nearly three times as far as the upper comes down,
   * because that is what a squint is: a real one is the cheek pushing the lower
   * lid up, and two lids meeting in the middle is a blink. Getting that
   * symmetric was the difference between *suspicious* and *sleepy*.
   *
   * These are authored against the sliver and therefore scale with it, which is
   * right for the curve and a compromise for the squint. `eyeCurve` is the arc
   * of a **shut** eye, so it matters at `eyeOpen 0` where the scale is
   * `LID_MEET`: 1.05 on the sliver arrives as 11 units of arc on the seam, which
   * is the number the old drawing used. `eyeSquint` matters on a mostly-open
   * eye, where the scale is near 1 and these are the units they look like; at a
   * nearly shut eye it overshoots, and a squint there says nothing `eyeOpen` has
   * not already said.
   */
  squintUpper: 3.5, squintLower: 9,
  /**
   * How far a **shut** eye's seam arcs at `eyeCurve ±1`, in the eye's own
   * units, divided back out by the factor that lid grows by.
   *
   * It used to be authored on the drawn sliver, which tied it to how thick the
   * lid happened to be drawn: thinning the lid to a hairline so that an open
   * eye shows none of it would have multiplied the arc sevenfold. Written
   * where it is read -- on the seam -- it is the same eleven units however the
   * lid is drawn.
   */
  seamArc: 11
});

/**
 * The sliver's own half-height, and the factor that takes each lid to the seam.
 *
 * **To the seam, not across the whole eye.** A library card's eye closes as skin
 * under its own outline, so its upper lid grows until it covers everything
 * (docs/EYE_BUILDS.md). The template's closed eye is a *seam*: two lids that
 * meet on one line, which is the shape `eyeCurve` bends into a happy squeeze or
 * a tired droop. So each one grows until its leading edge lands on that line,
 * and the line sits a shade below the middle of the eye where a lash line does.
 *
 * A lid of drawn height `2 · slice` scaled by `k` about its rim reaches
 * `2 · slice · k` into the eye, so `k` is the distance to the seam over that.
 */
export const LID_SLICE = round(EYE.ry * LID.slice);
export const LID_MEET = Object.freeze({
  upper: round((EYE.ry + LID.seam) / (2 * LID_SLICE)),
  lower: round((EYE.ry - LID.seam) / (2 * LID_SLICE))
});

/** Where each lid swings from: the rim it is drawn on. */
export const LID_PIVOTS = Object.freeze({
  lidUpperLeft: { x: EYE.left, y: round(EYE.cy - EYE.ry) },
  lidUpperRight: { x: EYE.right, y: round(EYE.cy - EYE.ry) },
  lidLowerLeft: { x: EYE.left, y: round(EYE.cy + EYE.ry) },
  lidLowerRight: { x: EYE.right, y: round(EYE.cy + EYE.ry) }
});

/** The circle-to-cubic constant: four cubics draw an ellipse to within a quarter of a unit. */
const ARC = 0.5523;

/**
 * A lid, drawn where it sits with the eye **open**.
 *
 * V1 drew both lids shut and let the rig lift them, which means the artwork on
 * its own — the file an author opens, the thumbnail on the home screen, the
 * `mascot.svg` that Export writes — was a mascot with its eyes closed. The
 * drawing is the neutral pose, and closing the eye is what the rig does to it:
 * the binding rests at `scaleY 1` and reaches `cover` at `eyeOpen 0`.
 *
 * Absolute throughout: a relative `h`/`q` is a path the editor's own node tools
 * decline to edit, and an author reshaping an eyelid is exactly the kind of
 * thing this template is meant to be taken apart for. The **leading edge** —
 * the half facing the pupil — is where the two poses act: `squint` deepens it
 * and `curve` bends its middle, so a narrowed eye and a happy squeeze are the
 * same points read differently.
 *
 * @param {number} cx        the middle of the eye
 * @param {1|-1} way         1 for the lower lid, -1 for the upper
 */
const lid = (cx, way, pose = {}) => {
  const { rim, end } = lidEdge(way, pose);
  const rx = EYE.rx;
  const at = (x, y) => `${round(x)} ${round(y)}`;
  // Along the rim, straight down the side, and back along the leading edge.
  // The flat run and the two vertical sides are what close the corners: they
  // lie outside the socket, the cut takes them away, and the only edge that
  // ever shows is the one facing the pupil.
  return `M${at(cx - rx, rim)} L${at(cx + rx, rim)} L${at(cx + rx, end)}`
    + ` ${leadingEdge(cx, way, pose, { open: false })} Z`;
};

/**
 * Where one lid's leading edge sits, drawn — and why its ends are not level
 * with its middle.
 *
 * A shut eye has to be **shut**: no white left anywhere, including the two
 * corners where the eye is at its widest. Two edges that bulge towards each
 * other meet in the middle and leave a wedge at each end, which is what the
 * first version of this drew — a closed eye with a white sliver at each
 * corner, and no arrangement of bulges fixes it. The corners close only when
 * the two edges land on **one curve**, and they can only do that if each ends
 * where the eye's own widest point is.
 *
 * So the edge is authored by where it has to *arrive*:
 *
 * ```text
 *   end    the eye's widest point, (cx ± rx, cy) — both lids, so the two
 *          edges meet there and the corner has no area left to show
 *   mid    the seam, a shade below the middle — the upper lid reaching a
 *          little further than the lower, which is what a blink looks like
 * ```
 *
 * Divided by the factor that lid grows by, which is what the drawing is: a
 * band a couple of units deep hanging off the rim, whose ends and middle are a
 * tenth of a unit apart. `scaleY` multiplies both, so the ends arrive on the
 * corners and the middle on the seam in the same move.
 */
function lidEdge(way, { squint = 0, curve: bend = 0 } = {}) {
  const meet = way < 0 ? LID_MEET.upper : LID_MEET.lower;
  const rim = round(EYE.cy + way * EYE.ry);
  // A narrowed eye is the two lids coming *towards each other* while the eye
  // stays open: the upper one down a little, the lower one up more.
  const narrow = squint * (way < 0 ? LID.squintUpper : LID.squintLower);
  // And the arc is the *edge* bending while its ends stay put. The **same**
  // sign for both lids, which is the thing that is easy to get wrong: what the
  // viewer reads as the arc is the two edges together, so both have to rise in
  // the middle. The lower lid's is divided by how much less far it grows, or
  // the two arrive at different arcs and a shut eye is two lines apart.
  const arc = -bend * (LID.seamArc / LID_MEET.upper) * (way < 0 ? 1 : LID_MEET.upper / LID_MEET.lower);
  return {
    rim,
    end: round(rim - way * (EYE.ry / meet + narrow)),
    mid: round(rim - way * ((EYE.ry - way * LID.seam) / meet + narrow) + arc)
  };
}

/**
 * The leading half of a lid, from the far corner back to the near one.
 *
 * Written once and read twice: as the second half of the lid's own closed shape,
 * and as the crease, which is this alone with a stroke on it. So a lid and its
 * crease cannot disagree about where the edge is -- there is one piece of
 * arithmetic, not two kept in step.
 *
 * `open: true` starts with a `M`, which is what makes it a line rather than the
 * continuation of a shape.
 */
function leadingEdge(cx, way, pose = {}, { open = true } = {}) {
  const { end, mid } = lidEdge(way, pose);
  const rx = EYE.rx, kx = round(rx * ARC);
  const at = (x, y) => `${round(x)} ${round(y)}`;
  // Flat at the centre and flat at the ends: the curve is all in between, so
  // the seam reads as one line and the corners arrive level with the eye.
  return `${open ? `M${at(cx + rx, end)} ` : ''}C${at(cx + kx, end)} ${at(cx + kx, mid)} ${at(cx, mid)}`
    + ` C${at(cx - kx, mid)} ${at(cx - kx, end)} ${at(cx - rx, end)}`;
}

/**
 * A lid's **crease**: its leading edge, on its own, as a line.
 *
 * The lids themselves carry no outline — a closed shape stroked all the way
 * round draws its rim half too, and the rim half of a sliver sits *inside* the
 * eye at the corners, so each lid read as a lens-shaped ring lying across the
 * eye rather than as skin over it.
 *
 * So the line is its own path: the same two cubics, the same pivot, the same
 * `scaleY`, the same `eyeCurve` shape key. It cannot drift from the lid, because
 * it *is* the lid's edge. With the eye open it is a crease just inside the rim,
 * which is what an eyelid looks like; with the eye shut the two creases have
 * grown onto the seam and read as the one line a closed eye is.
 *
 * The stroke is `non-scaling-stroke`, which is the one detail the growing
 * construction needs: a 3-unit line scaled three times over would arrive as a
 * 10-unit black band across a shut eye.
 */
export function creasePath(role, pose = {}) {
  const side = /Right$/.test(role) ? 'Right' : 'Left';
  const cx = side === 'Right' ? EYE.right : EYE.left;
  return leadingEdge(cx, /^creaseUpper/.test(role) ? -1 : 1, pose);
}

/** The two creases the template draws, and the lines they rest at. */
export const CREASE_ROLES = Object.freeze(['creaseUpperLeft', 'creaseLowerLeft', 'creaseUpperRight', 'creaseLowerRight']);
export const CREASE_RESTS = Object.freeze(Object.fromEntries(CREASE_ROLES.map((role) => [role, creasePath(role)])));

/** Where each crease swings from: the same rim its lid does. */
export const CREASE_PIVOTS = Object.freeze(Object.fromEntries(CREASE_ROLES.map((role) =>
  [role, LID_PIVOTS[role.replace('crease', 'lid')]])));

/**
 * One eyelid's outline for a given state, by role.
 *
 * The rig deforms the drawn lid; this is what it deforms it *to*, and it is the
 * one place the template says what a narrowed or arced lid looks like
 * (`template-project.js` turns each into an additive shape key). Every parameter
 * is 0 at rest, so `lidPath(role)` is the outline in the artwork.
 */
export function lidPath(role, pose = {}) {
  const side = /Right$/.test(role) ? 'Right' : 'Left';
  const cx = side === 'Right' ? EYE.right : EYE.left;
  return lid(cx, /^lidUpper/.test(role) ? -1 : 1, pose);
}

/** The four lids the template draws, and the outlines they rest at. */
export const LID_ROLES = Object.freeze(['lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight']);
export const LID_RESTS = Object.freeze(Object.fromEntries(LID_ROLES.map((role) => [role, lidPath(role)])));

// The socket the lids are cut to, shared with the library's three eye builds.
import { eyeInnerGroup, eyeSocketClip } from '../../face/eye-build.js';

/**
 * Left and right are the viewer's, which is how an author points at them.
 *
 * **Nothing is clipped.** The group used to carry `clip-path` so the 2.5D turn
 * moved the whole assembly -- socket, white, pupil, lids and outline -- as one,
 * which was the right answer to the wrong problem: the lids only needed cropping
 * because they were drawn outside the eye. They are slivers on the rim now
 * (`lid` above), so the group is the eye and there is nothing to crop.
 *
 * **The lids carry no outline.** A closed shape stroked all the way round draws
 * its rim half as well as its leading edge, and the rim half of a sliver sits
 * *inside* the eye at the corners — so each lid read as a lens-shaped ring lying
 * across the eye rather than as skin over it. They are fill only, and the eye's
 * own `rim` is drawn last, on top, so the outline an author sees is the eye's.
 *
 * The line is its own path instead: `creaseUpperLeft` and its three companions,
 * each the leading edge of the lid it belongs to, sharing its pivot, its
 * `scaleY` and its `eyeCurve` shape key. It cannot drift from the lid, because it
 * *is* the lid's edge. Open, it reads as an eyelid crease just inside the rim;
 * shut, the two have grown onto the seam and read as the one line a closed eye
 * is — which is what `eyeCurve` bends into the happy `^ ^` and the tired droop
 * (docs/EYE_BUILDS.md).
 *
 * The second catchlight is the one detail added to the eye. It is a third of
 * the size of the first and sits on the opposite side of the pupil, which is
 * what stops a large flat pupil from reading as a hole.
 */
const eye = (side, cx) => {
  const { cy, rx, ry } = EYE;
  // Everything that sweeps across the eye is cut by the eye's own socket, and
  // the socket is the white: a drawing in the layer tree, with a name and a
  // selection box (`eyeSocketClip`, docs/EYE_BUILDS.md). Without it a lid a
  // quarter shut hangs past the outline on both sides, because scaling an
  // ellipse in `y` alone keeps its full width and the eye is narrower than
  // that everywhere but its middle.
  // Everything but the socket and the outline: the gaze, the catchlights and
  // the lids. The pupil is in here because a gaze carries it across the white
  // and nothing else stops it at the rim (docs/EYE_BUILDS.md).
  const inside = `<circle id="pupil${side}" data-name="${side} pupil" cx="${cx}" cy="${cy}" r="${PUPIL.r}" fill="${FACE_PALETTE.pupil}" />`
      + `<circle id="glint${side}" data-name="${side} eye glint" cx="${round(cx - 4.2)}" cy="${round(cy - 4.6)}" r="3.6" fill="${FACE_PALETTE.glint}" opacity="${FACE_STYLE.glintOpacity}" />`
      + `<circle id="spark${side}" data-name="${side} eye catchlight" cx="${round(cx + 4.4)}" cy="${round(cy + 3.6)}" r="1.7" fill="${FACE_PALETTE.glint}" opacity="${FACE_STYLE.sparkOpacity}" />`
      + `<path id="lidUpper${side}" data-name="${side} upper eyelid" d="${lid(cx, -1)}" fill="${FACE_PALETTE.skin}" />`
      + `<path id="creaseUpper${side}" data-name="${side} upper eyelid crease" d="${creasePath(`creaseUpper${side}`)}" fill="none" stroke="${FACE_PALETTE.outlinePrimary}" stroke-width="${FACE_STYLE.creaseUpper}" stroke-linecap="round" vector-effect="non-scaling-stroke" />`
      + `<path id="lidLower${side}" data-name="${side} lower eyelid" d="${lid(cx, 1)}" fill="${FACE_PALETTE.skin}" />`
      + `<path id="creaseLower${side}" data-name="${side} lower eyelid crease" d="${creasePath(`creaseLower${side}`)}" fill="none" stroke="${FACE_PALETTE.outlinePrimary}" stroke-width="${FACE_STYLE.creaseLower}" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;
  return `<g id="eye${side}" data-name="${side} eye">
      <ellipse id="eyeWhite${side}" data-name="${side} eye socket" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${FACE_PALETTE.eyeWhite}" />
      ${eyeSocketClip(side)}
      ${eyeInnerGroup(side, inside)}
      <ellipse id="rim${side}" data-name="${side} eye outline" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${FACE_PALETTE.outlinePrimary}" stroke-width="${FACE_STYLE.eyeOutline}" />
    </g>`;
};

/* ------------------------------------------------------------------ brows -- */

/**
 * A brow, drawn rather than stroked.
 *
 * A uniform stroke is one weight from end to end, and an eyebrow is not: it is
 * heavy where it meets the nose and it tapers away at the temple. That taper
 * is most of what makes a brow read as *drawn*, and it is the difference
 * between a mascot whose mood is legible at 32 px and one whose mood needs the
 * mouth to explain it.
 *
 * So each brow is a closed path: the top edge out to the outer tip, a point,
 * and the underside back. The outer end is an actual point (a zero-width
 * corner, rounded off by the join) and the inner end is blunt and full weight,
 * which is the cartoon convention and also the end an expression moves most.
 *
 * `sign` is -1 for the viewer's left brow and +1 for the right, so the two are
 * exact mirrors and the pins the brow rig hangs on them land symmetrically.
 */
const BROW = Object.freeze({
  /** From the middle of the face: the end at the nose, and the end at the temple. */
  inner: 12, outer: 60,
  innerY: 80, outerY: 87, peak: 75,
  /** The blunt end is a shade under the arch, which is the brow's widest point. */
  innerWeight: round(FACE_STYLE.browWeight * 0.9)
});

export function browPath(side = 'Left') {
  const sign = side === 'Right' ? 1 : -1;
  const x = (from) => round(HEAD.cx + sign * from);
  const tip = `${x(BROW.outer)} ${BROW.outerY}`;
  const innerTop = `${x(BROW.inner)} ${BROW.innerY}`;
  const innerFoot = `${x(BROW.inner)} ${round(BROW.innerY + BROW.innerWeight)}`;
  return `M${tip}`
    // Over the top: the arch, at its highest a little under half way along.
    + ` C${x(52)} ${round(BROW.peak - 2)} ${x(26)} ${round(BROW.peak - 3)} ${innerTop}`
    // The inner end is blunt and rounded, not cut off square.
    + ` Q${x(7)} ${round(BROW.innerY + BROW.innerWeight / 2)} ${innerFoot}`
    // And back along the underside, which is flatter than the top: that
    // difference *is* the weight, and it is at its greatest under the arch.
    + ` C${x(26)} ${round(BROW.peak + FACE_STYLE.browWeight * 0.65)} ${x(50)} ${round(BROW.peak + FACE_STYLE.browWeight * 0.77)} ${tip} Z`;
}

export const BROW_RESTS = Object.freeze({ browLeft: browPath('Left'), browRight: browPath('Right') });

/**
 * The box each brow occupies, which is what its two end pins are measured
 * from. Written down here rather than in the rigging for the same reason the
 * centres are: the editor measures it off the canvas, and the template drew it.
 */
export const BROW_BOXES = Object.freeze((() => {
  const top = BROW.peak - 1.5, bottom = BROW.innerY + BROW.innerWeight;
  const box = (from) => ({ x: round(HEAD.cx + from), y: round(top), width: BROW.outer - BROW.inner, height: round(bottom - top) });
  return {
    left: Object.freeze({ target: 'browLeft', box: box(-BROW.outer) }),
    right: Object.freeze({ target: 'browRight', box: box(BROW.inner) })
  };
})());

/* ------------------------------------------------------------------- ears -- */

/**
 * An ear: a filled shape, and an outline on its **outer half only**.
 *
 * The ear used to be one stroked ellipse, which is fine while it sits behind
 * the head — the outline only shows where the ear leaves the silhouette. But a
 * turn brings the near ear *in front of* the cheek (docs/HEAD_POSE_2_5D.md),
 * and there the whole ellipse was drawn: a full ring on the side of the face,
 * with the half that runs down the cheek reading as a seam between two pieces
 * of artwork rather than as one head.
 *
 * So the fill and the outline are two elements. The fill is skin on skin and
 * has nothing to draw against the face; the outline is the arc from the top of
 * the ear round the outside to the bottom, and its two ends land on the head's
 * own outline — `headEdgeAt` puts them there rather than a pair of numbers
 * that were right for the head we used to draw. The silhouette then simply
 * detours around the ear, which is how an ear is drawn.
 *
 * V2 shrinks them. An ear is the least interesting thing on a face and V1's
 * were as tall as the eyes are wide, outlined at nearly the weight of the
 * silhouette itself; these are three quarters of the size at two thirds of the
 * weight, with the fold in the secondary colour, so they finish the outline
 * instead of competing with the eyes for it.
 */
export const EAR = Object.freeze({ cy: 118, rx: 14, ry: 21, inset: 1 });

const ear = (side, flip) => {
  const { cy, rx, ry, inset } = EAR;
  const edge = side === 'Left' ? 'left' : 'right';
  const cx = round(headEdgeAt(cy, edge) + (flip ? -inset : inset));
  const top = round(headEdgeAt(cy - ry, edge)), bottom = round(headEdgeAt(cy + ry, edge));
  const fold = flip
    ? `M${round(cx - 1)} ${cy - 9} Q${round(cx + 6)} ${cy} ${round(cx - 1)} ${cy + 9}`
    : `M${round(cx + 1)} ${cy - 9} Q${round(cx - 6)} ${cy} ${round(cx + 1)} ${cy + 9}`;
  return `<g id="ear${side}" data-name="${side} ear">`
    + `<ellipse id="ear${side}Shape" data-name="${side} ear shape" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${FACE_PALETTE.skin}" />`
    + `<path id="ear${side}Edge" data-name="${side} ear outline" d="M${top} ${cy - ry} A${rx} ${ry} 0 0 ${flip} ${bottom} ${cy + ry}" fill="none" stroke="${FACE_PALETTE.outlinePrimary}" stroke-width="${FACE_STYLE.earOutline}" stroke-linecap="round" />`
    + `<path id="ear${side}Fold" data-name="${side} ear fold" d="${fold}" fill="none" stroke="${FACE_PALETTE.outlineSecondary}" stroke-width="${FACE_STYLE.detail}" stroke-linecap="round" opacity="${FACE_STYLE.earFoldOpacity}" /></g>`;
};

/* ------------------------------------------------------------------ mouth -- */

/**
 * The mouth, the teeth and the tongue: `core/face/mouth-build.js`.
 *
 * Moved out so the library's one complete mouth and the sample are the *same*
 * mouth, exactly as the eyes are (docs/MOUTH_BUILD.md, docs/EYE_BUILDS.md).
 * Re-exported here because the template drew this face and everything that reads
 * these numbers reads them from the template.
 */
export {
  MOUTH_BOX, MOUTH_REST, TEETH_REST, TEETH_LOWER_REST, TONGUE_REST, TONGUE_TIP_REST, TONGUE_GROOVE_REST,
  mouthGeometry, mouthPath, teethPath, teethLowerPath, tonguePath, tongueTipPath, tongueGroovePath
} from '../../face/mouth-build.js';
// And imported, because this module draws with them as well as re-exporting them.
import {
  MOUTH, MOUTH_REST, TEETH_REST, TEETH_LOWER_REST, TONGUE_REST, TONGUE_TIP_REST, TONGUE_GROOVE_REST,
  mouthGeometry, mouthPath, teethPath, teethLowerPath, tonguePath, tongueTipPath, tongueGroovePath
} from '../../face/mouth-build.js';


/**
 * The mouth, as the five shapes the rig moves.
 *
 * ```text
 *   mouth                    the lips, and the cavity they enclose
 *   mouthInside  ▸ clipped   tongue · teethLower · teeth
 *   tongueTip                in front of the lips, because that is where it is
 * ```
 *
 * **The order is the drawing.** Inside the cavity, the tongue is behind the
 * lower teeth and both are behind the upper row, because that is the order they
 * are in; and the tip is in front of the lips, because a tongue lapping out
 * lies *over* the lower lip and there is no other way to say that in a flat
 * drawing (§5.2 of the brief).
 *
 * **The clip is the belt to the geometry's braces.** Everything inside the
 * mouth is drawn from the mouth's own curves and stays inside it by
 * construction (docs/MOUTH_BUILD.md) -- but only as long as nothing else moves
 * it. `tongueX` and `tongueY` translate the tongue, `mouthWidth` scales the
 * rows, and a warp or a pin can reach any of them: each of those is a way for
 * an inside to end up on the chin, and each of them used to be. Clipping to the
 * lips answers all of them at once, and it costs one `<use>` because the
 * aperture is already a path: `#mouth` *is* the shape of the hole, so the clip
 * follows every pose of it with nothing to keep in step.
 *
 * The tip and the crease down it are outside the clip on purpose, and they are
 * the only things that are. The crease is drawn in the cavity's own colour at a
 * low opacity, because a fold is the light that does not reach it rather than a
 * colour of its own -- and because the body already reads as two lobes from its
 * silhouette, while a tongue *out* is a flat shape against a chin with nothing
 * to say which way up it is (§5.1 of the V6 brief puts the groove with the
 * front, and this is why).
 */
const mouth = (c) => `<path id="mouth" data-name="Mouth" d="${MOUTH_REST}" fill="${c.mouthInterior}" stroke="${c.lip}" stroke-width="${FACE_STYLE.mouthOutline}" stroke-linejoin="round" />
    <g id="mouthInside" data-name="Inside the mouth" clip-path="url(#mouthAperture)">
      <path id="tongue" data-name="Tongue" d="${TONGUE_REST}" fill="${c.tongue}" />
      <path id="teethLower" data-name="Lower teeth" d="${TEETH_LOWER_REST}" fill="${c.teeth}" />
      <path id="teeth" data-name="Upper teeth" d="${TEETH_REST}" fill="${c.teeth}" />
    </g>
    <path id="tongueTip" data-name="Tongue tip" d="${TONGUE_TIP_REST}" fill="${c.tongue}" />
    <path id="tongueGroove" data-name="Tongue groove" d="${TONGUE_GROOVE_REST}" fill="${c.mouthInterior}" opacity="${FACE_STYLE.grooveOpacity}" />`;

/* ------------------------------------------------------------------- nose -- */

/**
 * The nose: a small hook, seen from the front.
 *
 * It is the base of the nose, drawn the way the rest of this face is drawn --
 * one curve, no shading -- and it is the whole nose: what used to be a hook
 * with a profile per side is a shape that **turns** instead. `headX` rotates
 * it (the template binds `rotation`), so the curve that reads as the underside
 * of the nose from the front comes round to read as its ridge from the side.
 *
 * Turning it is the one thing a shape key could not do. A morph is linear
 * between two drawings, so the way from a curve to its mirror passes through
 * the straight line halfway: the nose flattened into a bar in the middle of
 * every turn -- the wall the hands hit as "a mirror whose midpoint is a hand
 * folded onto its axis". A rotation has
 * no such midpoint: every angle of it is the same curve, seen from further
 * round.
 *
 * V1 drew that curve as a **half circle of radius 9 in the same weight as the
 * eye rims**, sitting on the middle line above the mouth: a small `U`, above a
 * larger `U`, in matching ink. It read as a second mouth. This one is a fifth
 * of the mouth's width against V1's third, a third lighter than the mouth, and
 * deliberately lopsided — the left wing short, the right one carrying on and
 * lifting — so it reads as a nose at the sizes where it is four pixels wide,
 * and disappears politely at the sizes where it is one.
 */
const NOSE = Object.freeze({ cx: 120, cy: 148, span: 7, drop: 4.6 });

/** Where it turns about: the middle of the shape, so a rotation stays put. */
export const NOSE_CENTRE = Object.freeze({ x: NOSE.cx, y: NOSE.cy });

/** How far `headX` turns it, in degrees. Negative, so the curve opens the way the face points. */
export const NOSE_TURN = -70;

export const NOSE_REST = (() => {
  const { cx, cy, span, drop } = NOSE;
  const leftX = round(cx - span * 0.82), rightX = round(cx + span);
  return `M${leftX} ${round(cy - drop)} Q${round(cx - span * 0.92)} ${round(cy + drop * 0.86)} ${round(cx - 0.4)} ${round(cy + drop)}`
    + ` Q${round(cx + span * 0.72)} ${round(cy + drop * 0.92)} ${rightX} ${round(cy - drop * 0.5)}`;
})();

/* ----------------------------------------------------------------- shading -- */

/**
 * The shading, which V1 did not really have.
 *
 * What it had was two slabs the height of the face at half opacity in a brown
 * darker than the hair, and the reason nobody noticed them as shadows is that
 * they are not shadows: they are a second colour on the face. They also had to
 * be drawn *before* the features, so an author moving one found a shape the
 * size of a cheek in the middle of their layer list.
 *
 * V2 keeps the two ids — `headX` still fades them against each other, which is
 * the cheapest volume cue this face has — but they are narrow crescents inside
 * the silhouette in a lighter skin tone. Add the shadow the fringe casts on
 * the forehead and one broad highlight, and the face has a light direction
 * without anything on it reading as a drawn shape.
 *
 * All four live in a `faceShading` group clipped to the head: one folder an
 * author can switch off in a press, and nothing that can escape the outline.
 */
const shade = (side) => {
  const flip = side === 'Right' ? 1 : -1;
  const at = (from, y) => [round(HEAD.cx + flip * from), y];
  const edge = (y) => [headEdgeAt(y, side === 'Right' ? 'right' : 'left'), y];
  // A crescent inside the edge, not a slab over the cheek: it follows the
  // silhouette down, comes back a third of the way in, and is clipped by the
  // head so its outer edge can never be seen as an edge at all.
  const d = path([edge(84), edge(120), edge(160), at(74, 190), at(46, 206),
    at(62, 186), at(72, 152), at(74, 118), at(68, 88)]);
  return `<path id="shade${side}" data-name="${side} cheek shade" d="${d}" fill="${FACE_PALETTE.skinShadow}" opacity="${FACE_STYLE.shadeOpacity}" />`;
};

/** The light on the face: one soft field, over the cheek the fringe leaves open. */
const faceLightPath = () => path([[70, 116], [96, 96], [130, 98], [148, 122], [136, 156], [104, 168], [76, 152]]);

/** And the shadow the fringe drops onto the forehead, a band under its edge. */
const hairShadePath = () => path([[26, 106], [46, 88], [70, 76], [96, 68], [124, 60], [148, 52], [168, 50],
  [150, 62], [124, 71], [96, 79], [70, 90], [48, 104], [32, 118]]);

/* ------------------------------------------------------------------- hair -- */

/**
 * The hair, which is what the mascot is recognised by.
 *
 * V1's was a helmet: a cap of one colour with four triangular notches cut out
 * of its lower edge, symmetric about the middle line. Saw teeth are what hair
 * looks like when it is drawn as an outline to be filled rather than as a mass
 * with a direction, and symmetry is what stops any head of hair from having a
 * parting — which is most of what makes one head of hair different from
 * another.
 *
 * So V2 sweeps. There is a parting well off the middle line (x 138); one long
 * lock carried from it right across the forehead, falling past the left temple
 * and out of the silhouette; a shorter lock on the other side of the parting,
 * over the right temple; and a tuft lifting off the crown. Those are the
 * signature: at 32 px the mascot is a round face with a sweep of hair going one
 * way and a tuft going the other, and that silhouette is legible when none of
 * the features are.
 *
 * Three pieces, as before, because the turn moves them at three different
 * depths (docs/HEAD_POSE_2_5D.md): `hairBack` is behind the head and swings
 * against it, `hairTop` *is* the skull's silhouette and travels with it, and
 * `hairFront` hangs on the front and swings furthest.
 */
const hairBackPath = () => path([
  [32, 130], [10, 92], [14, 46], [46, 20], [88, 4], [136, 2], [180, 20], [216, 56], [226, 104], [218, 130],
  // and back, a long way inside the crown, where nothing can open a gap.
  [200, 92], [180, 58], [150, 36], [110, 30], [74, 46], [46, 76], [34, 106]
]);

/**
 * The crown: the volume on top of the skull, and the tuft on it.
 *
 * Its lower edge reaches a long way *inside* the head, under the fringe, on
 * purpose — the crown is the only piece of hair that is also the silhouette,
 * so an edge that sits on the head's own outline opens a gap the moment either
 * of them moves.
 *
 * The lock lifting off it is half of the mascot's signature (the swept fringe
 * below is the other half). It is deliberately not on the middle line: a
 * symmetric tuft reads as a decoration, and an off-centre one reads as hair
 * that grows a particular way.
 */
const hairTopPath = () => path([
  [22, 104], [16, 64], [34, 34], [64, 14], [102, 4], [134, 5],
  // the tuft
  [150, 2], [165, 1], [175, 8], [176, 19],
  [188, 26], [201, 40], [212, 66], [218, 104],
  // and back, deep inside the head, where the fringe covers the join. This
  // edge is 20-odd units below the head's own outline on purpose: at 2 units,
  // a head that moved by three showed a crescent of skin above the fringe.
  [204, 88], [186, 58], [160, 42], [128, 34], [96, 38], [64, 56], [40, 78], [24, 102]
]);

/**
 * The fringe, clipped to the head.
 *
 * Drawn wider than the head on purpose: whatever the turn or the hair movement
 * does to it, it can neither leave the silhouette nor uncover the hairline.
 *
 * Its lower edge is the drawing. Reading it right to left: down the far side
 * of the parting, a short lock over the right temple, up to the parting at
 * x 138 — well off the middle line — and then one long sweep across the whole
 * forehead, falling past the left temple and out of the silhouette. Everything
 * the sweep passes over (both brows) stays clear of it, which is the
 * constraint that decides where it can go at all: a fringe that touches a brow
 * takes half the face's expressions with it.
 */
const hairFrontPath = () => path([
  // over the top, all of it outside the silhouette and clipped away
  [4, 108], [2, 50], [26, 20], [70, 4], [120, 0], [174, 4], [216, 26], [237, 68], [238, 106],
  // the far side of the parting, and the short lock over the right temple
  [228, 76], [214, 54], [206, 50], [200, 64], [197, 79], [191, 71], [185, 58], [172, 46],
  // the parting
  [148, 39], [138, 42],
  // and the long sweep: across the forehead, past the left temple, out
  [124, 50], [106, 57], [86, 63], [68, 71], [50, 84], [34, 99], [18, 117], [6, 134]
]);

/**
 * The places on the face a hand can be **held**, in the artwork's own units
 * (`docs/HAND_RIGGING.md`, `docs/FACE_CONTROL_RIG.md`).
 *
 * A hold puts one named point on another and, with `orient`, turns the held
 * thing to match — which is a hand's *position and angle* from one number
 * instead of three. What the runtime cannot decide is where the places are, so
 * the template says: it drew this face, so it knows where its chin is.
 *
 * Read off the outline rather than guessed at as fractions of a box: the cheek
 * is where the silhouette actually is at eye level, which a bounding box does
 * not know.
 */
export const FACE_ANCHORS = Object.freeze({
  'face.chin': { x: HEAD.cx, y: HEAD.bottom - 8 },
  'face.cheek.left': { x: round(headEdgeAt(EYE.cy + 37, 'left') + 34), y: EYE.cy + 37 },
  'face.cheek.right': { x: round(headEdgeAt(EYE.cy + 37, 'right') - 34), y: EYE.cy + 37 },
  'face.mouth': { x: MOUTH.cx, y: MOUTH.cornerY },
  'face.forehead': { x: HEAD.cx, y: round(HEAD.top + 46) }
});

/* -------------------------------------------------------------- the artwork -- */

/**
 * Where every rigged part sits at rest.
 *
 * The rigging reads this rather than keeping its own copy: a pivot that
 * disagrees with the artwork is a part that rotates about a point outside
 * itself, and the only way to keep two lists of coordinates in step is to have
 * one list.
 */
export const FACE_CENTRES = Object.freeze({
  faceRoot: { x: HEAD.cx, y: HEAD.midY },
  head: { x: HEAD.cx, y: HEAD.midY },
  eyeLeft: { x: EYE.left, y: EYE.cy }, eyeRight: { x: EYE.right, y: EYE.cy },
  pupilLeft: { x: EYE.left, y: EYE.cy }, pupilRight: { x: EYE.right, y: EYE.cy },
  // A lid is hinged at the edge of the socket it swings from, not at the middle
  // of a shape that is mostly the parking space above the eye: an author who
  // rotates one wants it to move the way an eyelid does.
  lidUpperLeft: { x: EYE.left, y: round(EYE.cy - EYE.ry) }, lidUpperRight: { x: EYE.right, y: round(EYE.cy - EYE.ry) },
  lidLowerLeft: { x: EYE.left, y: round(EYE.cy + EYE.ry) }, lidLowerRight: { x: EYE.right, y: round(EYE.cy + EYE.ry) },
  // The brow turns about the middle of its own box, so `browTilt` rotates it
  // rather than swinging it off the face.
  browLeft: { x: round(HEAD.cx - (BROW.inner + BROW.outer) / 2), y: round((BROW.peak + BROW.outerY) / 2) },
  browRight: { x: round(HEAD.cx + (BROW.inner + BROW.outer) / 2), y: round((BROW.peak + BROW.outerY) / 2) },
  nose: { x: NOSE_CENTRE.x, y: NOSE_CENTRE.y },
  mouth: { x: MOUTH.cx, y: MOUTH.cornerY },
  // The same centre as the mouth on purpose: they narrow together on a turn.
  teeth: { x: MOUTH.cx, y: MOUTH.cornerY }, teethLower: { x: MOUTH.cx, y: MOUTH.cornerY },
  tongue: { x: MOUTH.cx, y: MOUTH.cornerY }, tongueTip: { x: MOUTH.cx, y: MOUTH.cornerY },
  tongueGroove: { x: MOUTH.cx, y: MOUTH.cornerY },
  earLeft: { x: round(headEdgeAt(EAR.cy, 'left') + EAR.inset), y: EAR.cy },
  earRight: { x: round(headEdgeAt(EAR.cy, 'right') - EAR.inset), y: EAR.cy },
  // The hair swings from where it is attached, which is the crown and not the
  // middle of the shape: a fringe pivoting about its own centre slides off the
  // forehead instead of swaying.
  hair: { x: HEAD.cx, y: 52 }, hairTop: { x: HEAD.cx, y: 44 }, hairBack: { x: HEAD.cx, y: 60 }
});

/**
 * The square the face is drawn in.
 *
 * Every coordinate in this file is in it, and so is every reference box in the
 * face part library: it is the frame an asset is drawn against, and the width
 * every face is fitted in proportion to (`face-layout.js`).
 */
const FACE_SQUARE = Object.freeze({ x: 0, y: 0, width: 240, height: 240 });

/**
 * And the room above it, for what a head **wears**.
 *
 * The square is the face, so the head fills it: the top of the skull sits at
 * y 22, which leaves twenty-two units over it. That is not a hat — the top hat
 * the library ships stands 78 — and it is no head of hair with any height to it
 * either. A drawing taller than the page is not cut off politely: a nested
 * `<svg>` clips to its own viewBox, so it is simply not rendered
 * (docs/VECTOR_EDITING.md).
 *
 * The hat was once flattened to fit the page. That is the wrong way round —
 * the page is the thing with no opinion about what a hat looks like — so the
 * frame grows instead, and **upwards**, as a negative `y` on the viewBox.
 * Nothing in the drawing moves: every coordinate here, every reference box in
 * the library, every measured anchor and every keyform is what it was, and the
 * only thing that is somewhere else is the edge of the page. The hands grow it
 * downwards for the same reason and in the same way (`handsArtboard`).
 */
export const FACE_HEADROOM = 60;
const withHeadroom = (box) => Object.freeze({ x: box.x, y: box.y - FACE_HEADROOM, width: box.width, height: box.height + FACE_HEADROOM });

/** The face on its own, headroom and all: the frame a library drawing is drawn in. */
export const FACE_ARTBOARD = withHeadroom(FACE_SQUARE);
/**
 * A document with nothing in it but the square the face fills.
 *
 * What it is for lives elsewhere: `mascot-artwork.js` places a pair of hands
 * against it. It is exported rather than used here because **this module draws
 * a face and nothing else** -- see the note on `buildMascotFaceSvg`.
 */
export const FACE_ONLY = Object.freeze({ svgMarkup: `<svg viewBox="${FACE_SQUARE.x} ${FACE_SQUARE.y} ${FACE_SQUARE.width} ${FACE_SQUARE.height}">`, elements: {} });

/** A box with the headroom added, for whoever composes a page bigger than the face. */
export const withFaceHeadroom = withHeadroom;

/**
 * The face, as markup. **A face, and nothing but a face.**
 *
 * This module used to draw the pair of hands too -- it imported
 * `styleHandsMarkup` and grew its own page to make room for them -- so the
 * module that knows what a cheek looks like also knew what a thumb looks like,
 * and a change to either reached the other. A hand is a piece of its own now,
 * out of a set on disk (docs/HAND_STYLES.md), so the face has no business
 * drawing one: `mascot-artwork.js` puts the two together.
 *
 * Two seams are all that composition needs, and neither mentions a hand:
 *
 * * `box` -- the page. A face fills its own square; a mascot with something
 *   hanging below it needs a bigger one, and the thing hanging below it is the
 *   only thing that knows how much bigger.
 * * `before` -- markup painted **behind** the face, whatever it is. That is
 *   how a pair of hands hides behind the head (docs/HAND_RIGGING.md).
 *
 * Takes the palette so a future "change the mascot's colours" has somewhere to
 * go without any of this being restructured; everything else is geometry, and
 * geometry lives in the constants above.
 *
 * ## The head is the shape that cuts, and it is referenced rather than copied
 *
 * The fringe and the face shading are both cut to `headShape`, which used to be
 * a `<clipPath>` holding its own copy of the head's outline. A copy is a shape
 * nothing can reach: in no layer, in no `elements` record, so an author could
 * not see it, select it or reshape it -- which is the complaint.
 *
 * It was also **frozen**. The head carries the jaw's own shape key (`head-jaw`,
 * driven by `mouthOpen + jawOpen`), so an open jaw lengthens the outline by
 * forty screen pixels -- and the copy stayed where it was, leaving the shading
 * cut to a chin the face no longer had.
 *
 * A `<use>` of `#head` cannot drift: what cuts the fringe is the head an author
 * can see, by name, in the layer tree (docs/VECTOR_EDITING.md). It follows the
 * head all the way, hiding included -- hide the head and the cut keeps nothing,
 * so the fringe goes with it, which is why the row says so.
 *
 * It is written **inside `faceRoot`** rather than in a `<defs>` block, because
 * that is what puts it in the artwork the editor reads rather than in a block
 * nothing walks -- and at the **end** of the group, which is where the canvas's
 * importer moves a `<clipPath>` anyway (the eye sockets have shown this since
 * they were written the same way). Declaring it anywhere else means every
 * element after it is re-inserted on load, which leaves the whitespace between
 * them trailing at the end and `mascot.svg` with the whole face on one line.
 * A `<clipPath>` paints nothing, so its place among its siblings is a matter of
 * reading and of a fixture's diff, never of the drawing.
 *
 * @param {{ palette?: object, box?: object, before?: string }} [options]
 * @returns {string}
 */
export function buildMascotFaceSvg({ palette = FACE_PALETTE, box = FACE_ARTBOARD, before = '' } = {}) {
  const c = { ...FACE_PALETTE, ...palette };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="img" aria-label="Cartoon mascot face">
  ${before}
  <g id="faceRoot" data-name="Face">
    <path id="hairBack" data-name="Hair back" d="${hairBackPath()}" fill="${c.hairShadow}" />
    ${ear('Left', 0)}
    ${ear('Right', 1)}
    <path id="head" data-name="Head shape" d="${HEAD_REST}" fill="${c.skin}" stroke="${c.outlinePrimary}" stroke-width="${FACE_STYLE.silhouette}" stroke-linejoin="round" />
    <g id="faceShading" data-name="Face shading" clip-path="url(#headShape)">
      ${shade('Left')}
      ${shade('Right')}
      <path id="faceLight" data-name="Face highlight" d="${faceLightPath()}" fill="${c.skinHighlight}" opacity="${FACE_STYLE.highlightOpacity}" />
      <path id="shadeHair" data-name="Hairline shadow" d="${hairShadePath()}" fill="${c.skinShadow}" opacity="${FACE_STYLE.hairShadeOpacity}" />
    </g>
    ${mouth(c)}
    ${eye('Left', EYE.left)}
    ${eye('Right', EYE.right)}
    <g id="eyebrows" data-name="Eyebrows" fill="${c.hairShadow}" stroke="${c.hairShadow}" stroke-width="${FACE_STYLE.browEdge}" stroke-linejoin="round">
      <path id="browLeft" data-name="Left eyebrow" d="${BROW_RESTS.browLeft}" />
      <path id="browRight" data-name="Right eyebrow" d="${BROW_RESTS.browRight}" />
    </g>
    <path id="nose" data-name="Nose" d="${NOSE_REST}" fill="none" stroke="${c.outlineSecondary}" stroke-width="${FACE_STYLE.noseOutline}" stroke-linecap="round" stroke-linejoin="round" />
    <path id="hairTop" data-name="Hair top" d="${hairTopPath()}" fill="${c.hairHighlight}" />
    <g id="hairFront" data-name="Hair front" clip-path="url(#headShape)"><path id="hair" data-name="Fringe" d="${hairFrontPath()}" fill="${c.hairBase}" /></g>
    <clipPath id="headShape"><use href="#head" /></clipPath>
    <clipPath id="mouthAperture"><use href="#mouth" /></clipPath>
  </g>
</svg>`;
}

/** The palette a composer paints what it adds in, so the mascot matches itself. */
export const FACE_LINE_WEIGHT = FACE_STYLE.silhouette;
