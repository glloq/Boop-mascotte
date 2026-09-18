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
 * ## No socket, and why that matters
 *
 * Every eye in the editor was clipped to a hidden `<clipPath>`, with its lids
 * drawn open and **parked outside** that clip. The clip lived in `<defs>`, so
 * it appeared in neither the layer tree nor `document.elements`: an author
 * could not see it, move it, resize it or delete it. And because the parked
 * lids are real geometry, an eye whose white measured 114 × 107 screen pixels
 * had a **bounding box of 219 × 321** — so the selection handles sat a hundred
 * pixels away from the eye on every side, and resizing one meant dragging a box
 * three times too big whose contents were cropped by a mask that was not there.
 *
 * A lid here is the **eye's own shape, scaled about the rim it sits on**. It is
 * drawn as a sliver along that rim — which is what an open eye shows — and
 * grows to cover the eye:
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
 * edge, so the lid's leading edge is a curve at every opening and lands exactly
 * on the far rim at `cover`. Nothing is ever outside the eye, so nothing needs
 * clipping, and the eye's bounding box is the eye. That is the whole fix: one
 * pivot instead of one hidden mask.
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
  const lidRy = round(eyeRy * 0.12);
  return Object.freeze({
    build, ...parts,
    rx: eyeRx, ry: eyeRy,
    lidRy, cover: round(eyeRy / lidRy),
    pupil: dot ? pupil : Math.min(pupil, rx * 0.72),
    // An iris is the pupil's own circle, grown: wide enough to read as a
    // colour, never so wide that the white disappears behind it.
    irisR: parts.iris ? Math.max(pupil * 1.7, iris || 0) : 0,
    // How far the gaze may carry the pupil before its edge reaches the rim. A
    // pupil that touches the outline reads as an eye rolled back, not a look.
    travel: dot ? round(pupil * 0.55) : round(Math.max(0, rx - pupil - 4))
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

  if (g.white) pieces.push(`<ellipse id="${id('eyeWhite')}" data-name="${side} eye white" ${at()} rx="${g.rx}" ry="${g.ry}" fill="${palette.eyeWhite}" />`);
  if (g.iris) pieces.push(`<circle id="${id('iris')}" data-name="${side} iris" ${at()} r="${round(g.irisR)}" fill="${palette.iris}" />`);
  pieces.push(`<circle id="${id('pupil')}" data-name="${side} pupil" ${at()} r="${round(g.pupil)}" fill="${palette.pupil}" />`);
  pieces.push(`<circle id="${id('glint')}" data-name="${side} eye glint" ${at(-g.pupil * 0.4, -g.pupil * 0.45)} r="${round(g.pupil * 0.32)}" fill="${palette.glint}" opacity="0.92" />`);

  /**
   * The lids: the eye's own ellipse squashed to a lid's edge, sitting on the
   * rim it swings from.
   *
   * Drawn open, so the artwork on its own is a face with its eyes open — which
   * is what an author expects on the canvas and what the rest of the editor
   * assumes about a rest pose. The rig grows each one by `cover` to shut the
   * eye, about the rim it is drawn on, so it sweeps across the eye and stops
   * exactly on the far edge.
   */
  if (g.lids) {
    pieces.push(`<ellipse id="${id('lidUpper')}" data-name="${side} upper eyelid" ${at(0, -(g.ry - g.lidRy))} rx="${g.rx}" ry="${g.lidRy}" fill="${palette.skin}" />`);
    pieces.push(`<ellipse id="${id('lidLower')}" data-name="${side} lower eyelid" ${at(0, g.ry - g.lidRy)} rx="${g.rx}" ry="${g.lidRy}" fill="${palette.skin}" />`);
  }
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
  const reach = round(geometry.cover - 1);
  // A blink brings the lower lid up a little as well. A third, because a real
  // blink is the upper lid: two lids meeting in the middle is what a *squint*
  // looks like, and getting that asymmetry right is the difference between
  // sleepy and suspicious.
  const lower = round(reach * 0.3);
  return Object.freeze({
    /** The upper lid sweeps down from the rim it is drawn on. */
    lidUpper: Object.freeze({ property: 'scaleY', amplitude: -reach, offset: round(1 + reach), pivot: 'top' }),
    /** And the lower one up, from its own. */
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
