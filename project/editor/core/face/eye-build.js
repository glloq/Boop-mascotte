/**
 * One way to build an eye, in three sizes of ambition (docs/EYE_BUILDS.md).
 *
 * ```text
 *   dot            simple              iris
 *    ●            ╭─────╮            ╭─────╮
 *                 │ ⬤   │            │ ◎   │
 *                 ╰─────╯            ╰─────╯
 *   a pupil    white · pupil     white · iris · pupil
 *              · lid · rim      · lid · rim
 * ```
 *
 * The library used to ship **twenty-one** pairs of eyes and seventeen of them
 * were this one construction at different radii — round large, round small,
 * sleepy, cartoon, minimal, and the same five again for muzzles and for beaks.
 * The animal file said so in its own header: *"built the way the shipped sets
 * are built"*. An author choosing between them was choosing a size, which is
 * what the scale field is for, and an expression, which is what the controls
 * are for. Three builds is the whole vocabulary: **is there a white, and is
 * there an iris.** Everything else an eye does, it does by moving.
 *
 * ## The socket is the shape you can see
 *
 * Every eye in the editor was cut by a hidden `<clipPath>` holding an
 * anonymous ellipse, with its lids drawn open and **parked outside** that cut.
 * The clip lived in `<defs>` under no name: it appeared in neither the layer
 * tree nor `document.elements`, so an author could not see it, move it, resize
 * it or delete it. And because the parked lids are real geometry, an eye whose
 * white measured 114 × 107 screen pixels had a **bounding box of 219 × 321** —
 * the selection handles sat a hundred pixels away from the eye on every side.
 *
 * Both halves of that are fixed, and they are different fixes.
 *
 * The **box** is fixed by where a lid is drawn. A lid is the eye's own shape
 * squashed to a sliver on the rim it swings from and scaled about that rim, so
 * it is inside the eye at rest and inside it shut — never parked outside, and
 * never counted into a box three times too big.
 *
 * The **cut** is fixed by what does the cutting. There still is one, because a
 * lid sweeping across an ellipse is wider than the ellipse everywhere except
 * its middle: scaling only in `y` keeps the lid's full width, so at a quarter
 * shut it hangs past the outline on both sides. What changed is that the shape
 * doing the cut is now the **eye's own white** — `<clipPath><use href="#eyeWhite…"></clipPath>`
 * — a drawing in the layer tree with a name, a selection box and handles. Move
 * it and the cut moves; resize it and the cut resizes. What you see is what
 * cuts, and there is nothing left that an author cannot find.
 *
 * A lid then grows from a sliver to the seam:
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
 * edge, so the lid's leading edge is a curve at every opening, and the socket
 * trims it to the eye at the corners where it would otherwise hang out.
 *
 * ## A closed eye has styles, and they are controls
 *
 * A shut eye is a **seam**, and which seam is the character: a flat line, the
 * happy `^ ^`, a tired droop, a lash. Those are not four more drawings — they
 * are `eyeCurve` at a value, which is a control the rig already has and which
 * can therefore be animated, keyed and blended (docs/FACE_SVG_STATES.md). The
 * seam fades in as the eye shuts, so it is the closed eye's own line rather
 * than a crease drawn across an open one.
 *
 * Pure geometry and markup. Nothing here reads a document or touches the DOM.
 */

/** The three builds, in the order they are offered. */
export const EYE_BUILDS = Object.freeze(['dot', 'simple', 'iris']);

/** Where the template puts a pair, and the shape it draws them at. */
export const EYE_FRAME = Object.freeze({ cy: 113, left: 83, right: 157 });

export const round = (value) => Math.round(value * 100) / 100;

/**
 * The parts of an eye, per build.
 *
 * `white` and `iris` are the two questions the three builds answer. The rest
 * is the same drawing every time, which is the point.
 */
export const EYE_BUILD_PARTS = Object.freeze({
  dot: Object.freeze({ white: false, iris: false, rim: false, lids: false }),
  simple: Object.freeze({ white: true, iris: false, rim: true, lids: true }),
  iris: Object.freeze({ white: true, iris: true, rim: true, lids: true })
});

/**
 * How a closed eye is drawn, as values of one control.
 *
 * Offered as named styles because *happy* and *tired* are what an author is
 * choosing between, and held as `eyeCurve` because that is what the rig can
 * animate. `lash` is the one that is also a drawing: a thicker seam.
 */
export const CLOSED_EYE_STYLES = Object.freeze([
  Object.freeze({ id: 'seam', name: 'Seam', hint: 'One straight line where the lids meet.', eyeCurve: 0, weight: 1 }),
  Object.freeze({ id: 'happy', name: 'Happy', hint: 'Both lids arc upwards — the classic smiling eye.', eyeCurve: 1, weight: 1 }),
  Object.freeze({ id: 'tired', name: 'Tired', hint: 'The seam droops at the outer corner.', eyeCurve: -1, weight: 1 }),
  Object.freeze({ id: 'lash', name: 'Lashes', hint: 'A heavier seam, with a lash at the outer corner.', eyeCurve: 0.35, weight: 1.9, lash: true })
]);

export const closedEyeStyle = (id) => CLOSED_EYE_STYLES.find((style) => style.id === id) || CLOSED_EYE_STYLES[0];

/**
 * The geometry of one build, from two radii and a pupil.
 *
 * Everything is derived, so an author who scales an eye scales all of it and
 * nothing comes apart — which used to be true of the socket as well, and was
 * the reason the socket had to exist.
 */
export function eyeGeometry({ rx = 24, ry = 22.5, pupil = 10.5, iris = 0, build = 'simple' } = {}) {
  const parts = EYE_BUILD_PARTS[build] || EYE_BUILD_PARTS.simple;
  // A dot has no white to sit in, so its radius *is* the pupil's: the drawing
  // is the pupil and the pair of roles it plays say so.
  const dot = !parts.white;
  const eyeRx = dot ? pupil : rx, eyeRy = dot ? pupil : ry;
  /**
   * How tall a lid is **drawn**, against how tall it has to become.
   *
   * Drawn as the eye's own ellipse squashed to a lid's edge — a shade of skin
   * along the rim, which is what an open eye actually shows — and grown from
   * there. Drawn at full size it would cover the eye, and the artwork on its
   * own would be a face with its eyes shut: V1 did that, and every screen that
   * shows raw artwork had to explain it (`face-artwork.js`, *A lid, drawn where
   * it sits with the eye open*).
   *
   * `cover` is the factor that takes the drawn sliver to the whole eye, so the
   * rig's expression is `1 + (cover - 1) · (1 - eyeOpen)` and needs no other
   * number. Scaling happens about the edge the lid swings from, so the lid's
   * far edge is a curve at every opening and lands exactly on the eye's
   * opposite edge at `cover`.
   */
  /**
   * A **hairline**, and that is the whole of it.
   *
   * A lid is drawn on its rim and grown from there, so whatever is drawn is
   * what an open eye shows of it. At a twentieth of the eye that was a band of
   * skin and a crease inside the outline at rest — an eye that never quite
   * opened. At a hairline it is a third of a screen pixel, tucked under the
   * rim's own stroke, and the eye opens all the way; the factor it grows by
   * takes up the difference.
   */
  const lidRy = round(eyeRy * 0.007);
  // A shade below the middle of the eye, which is where a lash line sits and
  // where the two lids therefore have to meet.
  const seam = round(eyeRy * 0.045);
  return Object.freeze({
    build, ...parts,
    rx: eyeRx, ry: eyeRy,
    lidRy, seam, cover: round(eyeRy / lidRy),
    // What each lid grows by to arrive on the seam. Drawn as a band `2 · lidRy`
    // deep hanging off its rim, so the factor is the distance it has to cover
    // over the distance it is drawn at.
    meetUpper: round((eyeRy + seam) / (2 * lidRy)),
    meetLower: round((eyeRy - seam) / (2 * lidRy)),
    pupil: dot ? pupil : Math.min(pupil, rx * 0.72),
    // An iris is the pupil's own circle, grown: wide enough to read as a
    // colour, never so wide that the white disappears behind it.
    irisR: parts.iris ? Math.max(pupil * 1.7, iris || 0) : 0,
    // How far the gaze may carry the pupil before its edge reaches the rim. A
    // pupil that touches the outline reads as an eye rolled back, not a look.
    //
    // Measured against whatever the gaze actually *moves*, which on the iris
    // build is the iris and not the pupil inside it. Against the pupil, the
    // iris -- nearly twice as wide -- left the eye at a full look, which is
    // what the socket now catches and what this stops needing caught.
    travel: dot ? round(pupil * 0.55) : round(Math.max(0, rx - Math.max(pupil, parts.iris ? Math.max(pupil * 1.7, iris || 0) : 0) - 4))
  });
}

/** The seam a closed eye is, at `eyeCurve 0`: one line across the middle. */
export function seamPath(cx, cy, rx, { curve = 0, reach = 0.82 } = {}) {
  const half = round(rx * reach);
  // The control point carries the whole bend. At `curve 0` it is on the line,
  // so the seam is straight and the same path serves every style.
  const lift = round(-curve * rx * 0.5);
  return `M${round(cx - half)} ${round(cy - lift * 0.25)} Q${round(cx)} ${round(cy + lift)} ${round(cx + half)} ${round(cy - lift * 0.25)}`;
}

/** The circle-to-cubic constant: a cubic draws a quarter ellipse to a quarter unit. */
const ARC = 0.5523;

/**
 * Where one lid's leading edge sits, drawn — and why its ends are not level
 * with its middle.
 *
 * A shut eye has to be **shut**: no white left anywhere, including the two
 * corners where the eye is at its widest. Two edges that bulge towards each
 * other meet in the middle and leave a wedge at each end — no arrangement of
 * bulges fixes it, because near the corner an ellipse's own edge is above its
 * widest point. The corners close only when the two edges land on **one
 * curve**, and they can do that only if each ends where the eye is widest.
 *
 * So the edge is authored by where it has to *arrive*: its ends on `(cx ± rx,
 * cy)`, its middle on the seam. Divided by the factor that lid grows by, which
 * is what gets drawn — a band a couple of units deep hanging off the rim,
 * whose ends and middle are a tenth of a unit apart. One `scaleY` multiplies
 * both, so the ends reach the corners and the middle the seam in the same move.
 */
export function eyeLidEdge(cy, geometry, way) {
  const meet = way < 0 ? geometry.meetUpper : geometry.meetLower;
  const rim = round(cy + way * geometry.ry);
  return {
    rim,
    end: round(rim - way * (geometry.ry / meet)),
    mid: round(rim - way * ((geometry.ry - way * geometry.seam) / meet))
  };
}

/**
 * One lid: along the rim, down the side, and back along the leading edge.
 *
 * The flat run and the two vertical sides lie outside the socket, so the cut
 * takes them away and the only edge that ever shows is the one facing the
 * pupil. They are what close the corners — a lid shaped like the eye cannot.
 */
export function eyeLidPath(cx, cy, geometry, way) {
  const { rim, end, mid } = eyeLidEdge(cy, geometry, way);
  const rx = geometry.rx, kx = round(rx * ARC);
  const at = (x, y) => `${round(x)} ${round(y)}`;
  return `M${at(cx - rx, rim)} L${at(cx + rx, rim)} L${at(cx + rx, end)}`
    + ` C${at(cx + kx, end)} ${at(cx + kx, mid)} ${at(cx, mid)}`
    + ` C${at(cx - kx, mid)} ${at(cx - kx, end)} ${at(cx - rx, end)} Z`;
}

/**
 * The cut, and the drawing that makes it.
 *
 * `<use>` rather than a second ellipse, and that is the whole point: a copy
 * could drift from the white, and an author who resized one would have moved a
 * cut that no longer matched anything. A reference cannot drift — the shape in
 * the layer tree *is* the shape that cuts, carrying its own transform, so
 * moving or resizing the white moves and resizes the cut with it.
 *
 * Which is also what makes it findable. A piece cut by something says what is
 * cutting it, by name, in the menu on the artwork and as an outline on the
 * canvas when it is selected (docs/VECTOR_EDITING.md) — and the name it says is
 * now a drawing an author can go and press.
 */
export const eyeSocketId = (side) => `eyeSocket${side}`;
export const eyeSocketClip = (side) => `<clipPath id="${eyeSocketId(side)}"><use href="#eyeWhite${side}" /></clipPath>`;

/**
 * And the cut goes on a **wrapper**, not on the lids themselves.
 *
 * `clip-path` is resolved in the user space the element establishes, which is
 * the space *after* its own `transform`. Put it on a lid and the lid's own
 * `scaleY` scales the cut with it: at a blink the socket is stretched eight
 * times over and stops cutting anything, which is a mask that does exactly
 * nothing at the moment it is needed. Measured — it is why the first attempt
 * drew an hourglass.
 *
 * So everything inside the eye hangs in a group that nothing transforms, and
 * the group carries the cut. It is a real grouping besides: *inside the eye*
 * is what an author means by everything but the socket and the outline.
 *
 * **The pupil is in it too**, and that was the second thing an author saw. A
 * gaze carries the pupil across the white, and nothing stopped it at the rim:
 * at a full diagonal look the pupil sat on the outline, and on the iris build
 * the iris is wider than the travel was ever measured against, so it left the
 * eye outright. The cut ends the whole class of it — a look, a `pupilScale`, a
 * pupil an author drags, all of them.
 */
export const eyeInnerGroup = (side, inner) =>
  `<g id="eyeInner${side}" data-name="${side} eye, inside" clip-path="url(#${eyeSocketId(side)})">${inner}</g>`;

/**
 * One eye, as markup.
 *
 * `side` is the viewer's, which is how an author points at an eye. Ids are the
 * ones the rig's roles name, so the same drawing serves the template and the
 * library and a role assignment means the same thing in both.
 */
export function eyeMarkup(side, cx, geometry, palette, { seam = 0, lash = false, seamWeight = 1 } = {}) {
  const g = geometry, cy = EYE_FRAME.cy;
  const id = (name) => `${name}${side}`;
  const at = (dx = 0, dy = 0) => `cx="${round(cx + dx)}" cy="${round(cy + dy)}"`;
  const out = side === 'Left' ? -1 : 1;
  const pieces = [];

  // The white is drawn first because everything else sits in it, and it is
  // named as what it is: the socket, which is the shape that cuts.
  if (g.white) {
    pieces.push(`<ellipse id="${id('eyeWhite')}" data-name="${side} eye socket" ${at()} rx="${g.rx}" ry="${g.ry}" fill="${palette.eyeWhite}" />`);
    pieces.push(eyeSocketClip(side));
  }
  /**
   * Everything the socket cuts, in one group that nothing transforms.
   *
   * The pupil is in it for the same reason the lids are: a gaze carries it
   * across the white and nothing used to stop it at the rim. What is *not* in
   * it is the white itself — it is the shape doing the cutting — and the
   * outline, which is drawn over the top so a closing lid passes under it
   * rather than over it.
   */
  const inside = [];
  if (g.iris) inside.push(`<circle id="${id('iris')}" data-name="${side} iris" ${at()} r="${round(g.irisR)}" fill="${palette.iris}" />`);
  inside.push(`<circle id="${id('pupil')}" data-name="${side} pupil" ${at()} r="${round(g.pupil)}" fill="${palette.pupil}" />`);
  inside.push(`<circle id="${id('glint')}" data-name="${side} eye glint" ${at(-g.pupil * 0.4, -g.pupil * 0.45)} r="${round(g.pupil * 0.32)}" fill="${palette.glint}" opacity="0.92" />`);

  /**
   * The lids: the eye's own shape squashed to a hairline on the rim it swings
   * from, and grown from there.
   *
   * Drawn there, an open eye shows **none** of it — the hairline is under the
   * outline's own stroke — so the eye opens all the way, and the artwork on its
   * own is still a face with its eyes open. They carry their own line, which
   * the cut is what makes possible: a closed shape stroked all the way round
   * draws every edge it has, and this lid's other three are outside the socket.
   * So the only stroke that survives is the one facing the pupil. One shape,
   * one line, and they cannot drift apart.
   *
   * `non-scaling-stroke`, because the lid grows seventy times over to reach the
   * seam: a two-unit line would arrive as a black band across a shut eye.
   */
  if (g.lids) {
    const line = `fill="${palette.skin}" stroke="${palette.outline}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
    inside.push(`<path id="${id('lidUpper')}" data-name="${side} upper eyelid" d="${eyeLidPath(cx, cy, g, -1)}" ${line} />`);
    inside.push(`<path id="${id('lidLower')}" data-name="${side} lower eyelid" d="${eyeLidPath(cx, cy, g, 1)}" ${line} />`);
  }
  pieces.push(g.white ? eyeInnerGroup(side, inside.join('')) : inside.join(''));

  /**
   * The seam is the line a shut eye is, drawn over the lids and under the
   * outline. It is the template's, not a library card's: a card can only drive
   * the elements its **roles** name, and there is no role for a seam — while
   * the template has the shape keys that bend it into the happy, tired and
   * lash styles (`CLOSED_EYE_STYLES`, docs/FACE_SVG_STATES.md). A card's eye
   * closes as skin under its own outline, which is how most cartoon eyes close.
   */
  if (seam !== null) {
    pieces.push(`<path id="${id('seam')}" data-name="${side} closed eye line" d="${seamPath(cx, cy, g.rx, { curve: seam })}" fill="none" stroke="${palette.outline}" stroke-width="${round(2.2 * seamWeight)}" stroke-linecap="round" opacity="0" />`);
    if (lash) pieces.push(`<path id="${id('lash')}" data-name="${side} lash" d="M${round(cx + out * g.rx * 0.78)} ${round(cy - 1)} l${round(out * g.rx * 0.3)} ${round(-g.ry * 0.28)}" fill="none" stroke="${palette.outline}" stroke-width="${round(2.2 * seamWeight)}" stroke-linecap="round" opacity="0" />`);
  }
  if (g.rim) pieces.push(`<ellipse id="${id('rim')}" data-name="${side} eye outline" ${at()} rx="${g.rx}" ry="${g.ry}" fill="none" stroke="${palette.outline}" stroke-width="3" />`);

  return `<g id="eye${side}" data-name="${side} eye">${pieces.join('')}</g>`;
}

/**
 * What drives each piece of an eye, as expressions over the rig's controls.
 *
 * Written here rather than in two places, because the template's rig and the
 * library's install both need exactly this and a drift between them is an eye
 * that blinks in the sample and not in a mascot built from a card.
 *
 * `eyeOpen` rests at 1 and a lid's `scaleY` rests at 0, hence `1 - eyeOpen`.
 * The side offsets — `eyeOpenLeft`, `eyeOpenRight` — are what a wink is
 * (docs/FACE_CONTROL_RIG.md §5), so every expression carries its own.
 */
export function eyeDrivers(geometry) {
  // From the sliver a lid is drawn as, to the whole eye. A binding writes
  // `amplitude · control + offset`, and `eyeOpen` rests at 1, so a lid that
  // must read `1` open and `cover` shut is `-(cover - 1) · eyeOpen + cover`.
  const upper = round(geometry.meetUpper - 1), lower = round(geometry.meetLower - 1);
  return Object.freeze({
    /**
     * The upper lid sweeps down from the rim it is drawn on, and the lower one
     * up from its own — each to the seam, where the two edges become one curve
     * and the eye is shut with nothing showing at the corners.
     *
     * Both travel the whole way. It is tempting to bring the lower one up only
     * a third, because a real blink is mostly the upper lid, but a lower lid
     * that stops short leaves the bottom half of the eye white: what reads as
     * "mostly the upper lid" is the *seam sitting below the middle*, which is
     * where the drawing already puts it.
     */
    lidUpper: Object.freeze({ property: 'scaleY', amplitude: -upper, offset: round(1 + upper), pivot: 'top' }),
    lidLower: Object.freeze({ property: 'scaleY', amplitude: -lower, offset: round(1 + lower), pivot: 'bottom' }),
    /** A dot has no lid, so the dot itself flattens onto the line it closes to. */
    dot: Object.freeze({ property: 'scaleY', amplitude: 0.92, offset: 0.08, pivot: 'centre' })
  });
}

/** `pivot: 'top' | 'bottom'` as the point a generated binding rotates and scales about. */
export function eyePivot(where, cx, geometry) {
  const cy = EYE_FRAME.cy;
  if (where === 'top') return { pivotX: round(cx), pivotY: round(cy - geometry.ry) };
  if (where === 'bottom') return { pivotX: round(cx), pivotY: round(cy + geometry.ry) };
  return { pivotX: round(cx), pivotY: round(cy) };
}
