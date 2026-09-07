/**
 * The mascot face — Basic Face V2.
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
 * The eyes are clipped to their socket. That is what lets a pupil sit *behind*
 * the eyelid rather than fading out as the eye closes — the lid is an ordinary
 * skin-coloured shape parked above the eye, and everything outside the socket
 * is simply not drawn.
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
  lidUpperOutline: 2.6,
  lidLowerOutline: 2.2,
  /** Cartoon shading: present, never noticed. V1's cheek slabs were at .5. */
  shadeOpacity: 0.22,
  hairShadeOpacity: 0.13,
  highlightOpacity: 0.16,
  glintOpacity: 0.92,
  sparkOpacity: 0.66,
  earFoldOpacity: 0.55
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
 * How far a lid travels between shut and open.
 *
 * Derived rather than tuned: a lid has to clear the socket *including its own
 * curved edge*, so the distance is the half-socket plus the bulge plus a
 * little. Tuned constants were what made V1's lids need re-tuning by hand
 * whenever the eye changed size.
 */
const LID = Object.freeze({ bulge: 8, dip: 6, margin: 8, overlap: 1 });
export const LID_TRAVEL = Object.freeze({
  upper: round(EYE.ry + LID.overlap + LID.bulge * 2 + LID.margin),
  lower: round(EYE.ry - LID.overlap + LID.dip * 2 + LID.margin)
});

/**
 * A lid, drawn where it sits with the eye **open**.
 *
 * V1 drew both lids shut and let the rig lift them, which means the artwork on
 * its own — the file an author opens, the thumbnail on the home screen, the
 * `mascot.svg` that Export writes — is a mascot with its eyes closed. The
 * drawing is the neutral pose now, and closing the eye is what the rig does to
 * it: the binding carries an offset so `eyeOpen 1` lands on the drawing and
 * `eyeOpen 0` brings the lid all the way down (`template-project.js`).
 *
 * @param {number} cx        the middle of the eye
 * @param {number} shut      the height the two lids meet at
 * @param {number} reach     how far the lid extends past the socket sideways
 * @param {1|-1} way         1 for the lower lid, -1 for the upper
 */
const lid = (cx, shut, reach, way) => {
  const travel = way < 0 ? -LID_TRAVEL.upper : LID_TRAVEL.lower;
  const curve = way < 0 ? LID.bulge * 2 : -LID.dip * 2;
  const left = round(cx - reach), right = round(cx + reach);
  const edge = round(shut + travel), back = round(shut + travel + way * 30);
  // Absolute commands throughout: a relative `h`/`q` is a path the editor's own
  // node tools decline to edit, and an author reshaping an eyelid is exactly
  // the kind of thing this template is meant to be taken apart for.
  return `M${left} ${back} L${right} ${back} L${right} ${edge} Q${cx} ${round(edge + curve)} ${left} ${edge} Z`;
};

/**
 * Left and right are the viewer's, which is how an author points at them.
 *
 * The clip is on the eye group itself, not on a wrapper inside it, so it
 * travels with the eye: the 2.5D turn moves the whole assembly -- socket,
 * white, pupil, lids and outline -- as one, instead of sliding the contents out
 * from under a socket pinned to the face. Everything the lids push past the
 * socket edge is simply not drawn.
 *
 * The second catchlight is the one detail added to the eye. It is a third of
 * the size of the first and sits on the opposite side of the pupil, which is
 * what stops a large flat pupil from reading as a hole.
 */
const eye = (side, cx) => {
  const { cy, rx, ry } = EYE, shut = round(cy + LID.overlap), reach = round(rx + 22);
  return `<g id="eye${side}" data-name="${side} eye" clip-path="url(#eyeSocket${side})">
      <ellipse id="eyeWhite${side}" data-name="${side} eye white" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${FACE_PALETTE.eyeWhite}" />
      <circle id="pupil${side}" data-name="${side} pupil" cx="${cx}" cy="${cy}" r="${PUPIL.r}" fill="${FACE_PALETTE.pupil}" />
      <circle id="glint${side}" data-name="${side} eye glint" cx="${round(cx - 4.2)}" cy="${round(cy - 4.6)}" r="3.6" fill="${FACE_PALETTE.glint}" opacity="${FACE_STYLE.glintOpacity}" />
      <circle id="spark${side}" data-name="${side} eye catchlight" cx="${round(cx + 4.4)}" cy="${round(cy + 3.6)}" r="1.7" fill="${FACE_PALETTE.glint}" opacity="${FACE_STYLE.sparkOpacity}" />
      <path id="lidUpper${side}" data-name="${side} upper eyelid" d="${lid(cx, shut, reach, -1)}" fill="${FACE_PALETTE.skin}" stroke="${FACE_PALETTE.outlinePrimary}" stroke-width="${FACE_STYLE.lidUpperOutline}" stroke-linejoin="round" />
      <path id="lidLower${side}" data-name="${side} lower eyelid" d="${lid(cx, shut, reach, 1)}" fill="${FACE_PALETTE.skin}" stroke="${FACE_PALETTE.outlinePrimary}" stroke-width="${FACE_STYLE.lidLowerOutline}" stroke-linejoin="round" />
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
const MOUTH = Object.freeze({
  cx: 120, half: 33, cornerY: 172.5,
  lipY: 176, floorY: 183.5,
  smileRise: 8, smileDrop: 13, smileSpread: 2, openDrop: 62
});

/** Where the mouth's four control points are for one pose. */
export function mouthGeometry({ open = 0, smile = 0 } = {}) {
  const cornerY = MOUTH.cornerY - MOUTH.smileRise * smile;
  return {
    left: { x: MOUTH.cx - MOUTH.half - MOUTH.smileSpread * smile, y: cornerY },
    right: { x: MOUTH.cx + MOUTH.half + MOUTH.smileSpread * smile, y: cornerY },
    top: { x: MOUTH.cx, y: MOUTH.lipY + MOUTH.smileDrop * smile },
    bottom: { x: MOUTH.cx, y: MOUTH.floorY + MOUTH.smileDrop * smile + MOUTH.openDrop * open }
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
 * teeth hang off the upper lip, the tongue sits on the lower one. Inside by
 * construction, which is the whole reason the cavity used to come apart — a
 * shape that only happens to line up stops lining up the moment anything moves.
 *
 * `show` is how far they come out, and at 0 the two edges of the band lie
 * exactly on top of each other: the shape encloses nothing and nothing is
 * painted, so closed lips have nothing behind them to hide. (Its *box* is a
 * unit or two tall, because the neutral lip line curves now — the band traces
 * that curve out and back along itself.)
 *
 * The band is no longer *parallel* to the lip it hangs from. V1 dropped every
 * point of the upper lip by the same amount, which draws a strip of constant
 * height: a white rectangle across an open mouth, which is what teeth looked
 * like. Here the ends come out much less than the middle, so the row of teeth
 * is deepest in the middle and tapers into the corners the way a row of teeth
 * does; the tongue does the same and reads as a dome.
 */
const BAND = Object.freeze({
  from: 0.13, to: 0.87,
  teeth: 0.44, tongue: 0.66,
  /** How far each end of a band comes out, against its middle. */
  teethEnd: 0.3, teethMiddle: 1.3, tongueEnd: 0.34, tongueMiddle: 1.35
});

const mouthDepth = (g) => (g.bottom.y - g.top.y) / 2;

export function teethPath({ open = 0, smile = 0, show = 0 } = {}) {
  const g = mouthGeometry({ open, smile });
  const lip = (t) => quad(g.left, g.top, g.right, t);
  const a = lip(BAND.from), b = lip(BAND.to), control = through(a, lip(0.5), b);
  const drop = mouthDepth(g) * BAND.teeth * show;
  const down = (p, share) => ({ x: p.x, y: p.y + drop * share });
  return `M${point(a)} Q${point(control)} ${point(b)}`
    + ` L${point(down(b, BAND.teethEnd))} Q${point(down(control, BAND.teethMiddle))} ${point(down(a, BAND.teethEnd))} Z`;
}

export function tonguePath({ open = 0, smile = 0, show = 0 } = {}) {
  const g = mouthGeometry({ open, smile });
  // The lower lip, walked right to left, so the tongue is wound the same way
  // round as the teeth and the two shapes stay comparable.
  const lip = (t) => quad(g.right, g.bottom, g.left, t);
  const a = lip(BAND.from), b = lip(BAND.to), control = through(a, lip(0.5), b);
  const rise = mouthDepth(g) * BAND.tongue * show;
  const up = (p, share) => ({ x: p.x, y: p.y - rise * share });
  return `M${point(a)} Q${point(control)} ${point(b)}`
    + ` L${point(up(b, BAND.tongueEnd))} Q${point(up(control, BAND.tongueMiddle))} ${point(up(a, BAND.tongueEnd))} Z`;
}

export const MOUTH_REST = mouthPath();
export const TEETH_REST = teethPath();
export const TONGUE_REST = tonguePath();

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
 * folded onto its axis" (docs/HAND_REPRESENTATIONS_STUDY.md). A rotation has
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
export const hairBackPath = () => path([
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
export const hairTopPath = () => path([
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
 * x 140 — well off the middle line — and then one long sweep across the whole
 * forehead, falling past the left temple and out of the silhouette. Everything
 * the sweep passes over (both brows) stays clear of it, which is the
 * constraint that decides where it can go at all: a fringe that touches a brow
 * takes half the face's expressions with it.
 */
export const hairFrontPath = () => path([
  // over the top, all of it outside the silhouette and clipped away
  [4, 108], [2, 50], [26, 20], [70, 4], [120, 0], [174, 4], [216, 26], [237, 68], [238, 106],
  // the far side of the parting, and the short lock over the right temple
  [228, 76], [214, 54], [206, 50], [200, 64], [197, 79], [191, 71], [185, 58], [172, 46],
  // the parting
  [148, 39], [138, 42],
  // and the long sweep: across the forehead, past the left temple, out
  [124, 50], [106, 57], [86, 63], [68, 71], [50, 84], [34, 99], [18, 117], [6, 134]
]);

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
  // A lid turns about the edge of the socket it swings from, not about its own
  // middle: the shape is mostly the parking space above the eye.
  lidUpperLeft: { x: EYE.left, y: round(EYE.cy - EYE.ry) }, lidUpperRight: { x: EYE.right, y: round(EYE.cy - EYE.ry) },
  lidLowerLeft: { x: EYE.left, y: round(EYE.cy + EYE.ry) }, lidLowerRight: { x: EYE.right, y: round(EYE.cy + EYE.ry) },
  // The brow turns about the middle of its own box, so `browTilt` rotates it
  // rather than swinging it off the face.
  browLeft: { x: round(HEAD.cx - (BROW.inner + BROW.outer) / 2), y: round((BROW.peak + BROW.outerY) / 2) },
  browRight: { x: round(HEAD.cx + (BROW.inner + BROW.outer) / 2), y: round((BROW.peak + BROW.outerY) / 2) },
  nose: { x: NOSE_CENTRE.x, y: NOSE_CENTRE.y },
  mouth: { x: MOUTH.cx, y: MOUTH.cornerY },
  // The same centre as the mouth on purpose: they narrow together on a turn.
  teeth: { x: MOUTH.cx, y: MOUTH.cornerY }, tongue: { x: MOUTH.cx, y: MOUTH.cornerY },
  earLeft: { x: round(headEdgeAt(EAR.cy, 'left') + EAR.inset), y: EAR.cy },
  earRight: { x: round(headEdgeAt(EAR.cy, 'right') - EAR.inset), y: EAR.cy },
  // The hair swings from where it is attached, which is the crown and not the
  // middle of the shape: a fringe pivoting about its own centre slides off the
  // forehead instead of swaying.
  hair: { x: HEAD.cx, y: 52 }, hairTop: { x: HEAD.cx, y: 44 }, hairBack: { x: HEAD.cx, y: 60 }
});

/**
 * The face, as markup.
 *
 * Takes the palette so a future "change the mascot's colours" has somewhere to
 * go without any of this being restructured; everything else is geometry, and
 * geometry lives in the constants above.
 *
 * @param {{ palette?: object }} [options]
 * @returns {string}
 */
export function buildMascotFaceSvg({ palette = FACE_PALETTE } = {}) {
  const c = { ...FACE_PALETTE, ...palette };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Cartoon mascot face">
  <defs>
    <clipPath id="eyeSocketLeft"><ellipse cx="${EYE.left}" cy="${EYE.cy}" rx="${EYE.rx}" ry="${EYE.ry}" /></clipPath>
    <clipPath id="eyeSocketRight"><ellipse cx="${EYE.right}" cy="${EYE.cy}" rx="${EYE.rx}" ry="${EYE.ry}" /></clipPath>
    <clipPath id="headShape"><path d="${HEAD_REST}" /></clipPath>
  </defs>
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
    <path id="mouth" data-name="Mouth" d="${MOUTH_REST}" fill="${c.mouthInterior}" stroke="${c.lip}" stroke-width="${FACE_STYLE.mouthOutline}" stroke-linejoin="round" />
    <path id="tongue" data-name="Tongue" d="${TONGUE_REST}" fill="${c.tongue}" />
    <path id="teeth" data-name="Teeth" d="${TEETH_REST}" fill="${c.teeth}" />
    ${eye('Left', EYE.left)}
    ${eye('Right', EYE.right)}
    <g id="eyebrows" data-name="Eyebrows" fill="${c.hairShadow}" stroke="${c.hairShadow}" stroke-width="${FACE_STYLE.browEdge}" stroke-linejoin="round">
      <path id="browLeft" data-name="Left eyebrow" d="${BROW_RESTS.browLeft}" />
      <path id="browRight" data-name="Right eyebrow" d="${BROW_RESTS.browRight}" />
    </g>
    <path id="nose" data-name="Nose" d="${NOSE_REST}" fill="none" stroke="${c.outlineSecondary}" stroke-width="${FACE_STYLE.noseOutline}" stroke-linecap="round" stroke-linejoin="round" />
    <path id="hairTop" data-name="Hair top" d="${hairTopPath()}" fill="${c.hairHighlight}" />
    <g id="hairFront" data-name="Hair front" clip-path="url(#headShape)"><path id="hair" data-name="Fringe" d="${hairFrontPath()}" fill="${c.hairBase}" /></g>
  </g>
</svg>`;
}

export const MASCOT_FACE_SVG = buildMascotFaceSvg();
