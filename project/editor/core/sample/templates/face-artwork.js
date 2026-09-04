/**
 * The mascot face.
 *
 * One template, deliberately: three starter faces meant three sets of artwork
 * to keep rigged, and the two extra ones were strictly smaller than this. What
 * a beginner needs is a complete face they can strip down, not three partial
 * ones they have to build up.
 *
 * Every id here is wired by `applyTemplateProject`, so the two files are read
 * together. Paint order is the layer order: what is written first is behind.
 *
 * The eyes are clipped to their socket. That is what lets a pupil sit *behind*
 * the eyelid rather than fading out as the eye closes — the lid is an ordinary
 * skin-coloured shape parked above the eye, and everything outside the socket
 * is simply not drawn.
 *
 * The fringe is clipped the same way, to the head itself. It is drawn wider
 * than the head on purpose: whatever the turn or the hair movement does to it,
 * it can neither leave the silhouette nor uncover the hairline.
 */
const SKIN = '#f6d6ad', LINE = '#9a6544', HAIR = '#6b4430', HAIR_BACK = '#563527';
const SHADE = '#8a5a3c', LIP = '#a8404b', MOUTH = '#5e1f27', TONGUE = '#c9566e', TEETH = '#fffdf7', DARK = '#263238';

/**
 * Left and right are the viewer's, which is how an author points at them.
 *
 * The clip is on the eye group itself, not on a wrapper inside it, so it
 * travels with the eye: the 2.5D turn moves the whole assembly -- socket,
 * white, pupil, lids and outline -- as one, instead of sliding the contents out
 * from under a socket pinned to the face. Everything the lids push past the
 * socket edge is simply not drawn.
 */
const eye = (side, cx) => `<g id="eye${side}" data-name="${side} eye" clip-path="url(#eyeSocket${side})">
      <ellipse id="eyeWhite${side}" data-name="${side} eye white" cx="${cx}" cy="98" rx="26" ry="21" fill="#ffffff" />
      <circle id="pupil${side}" data-name="${side} pupil" cx="${cx}" cy="98" r="10" fill="${DARK}" />
      <circle id="glint${side}" data-name="${side} eye glint" cx="${cx - 4}" cy="93" r="3.4" fill="#ffffff" opacity=".9" />
      <path id="lidUpper${side}" data-name="${side} upper eyelid" d="M${cx - 46} 50 h92 v50 q-46 12 -92 0 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="3" />
      <path id="lidLower${side}" data-name="${side} lower eyelid" d="M${cx - 46} 146 h92 v-46 q-46 -10 -92 0 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="2.5" />
      <ellipse id="rim${side}" data-name="${side} eye outline" cx="${cx}" cy="98" rx="26" ry="21" fill="none" stroke="${LINE}" stroke-width="6" />
    </g>`;

/** One decimal is plenty for a 240-unit artboard, and keeps the paths short. */
const round = (value) => Math.round(value * 10) / 10;

/** A circle as four cubics: `k` is the arc constant that makes them round. */
const HEAD = Object.freeze({ cx: 120, cy: 120, r: 100, k: 55.23 });

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
  const { cx, cy, r, k } = HEAD;
  // The lower half stretches; the upper half and the widest points do not.
  const grow = 1 + jaw * 0.16;
  const below = (y) => round(cy + (y - cy) * grow);
  const top = cy - r, bottom = below(cy + r);
  return `M${cx} ${top} C${round(cx + k)} ${top} ${cx + r} ${round(cy - k)} ${cx + r} ${cy}`
    + ` C${cx + r} ${below(cy + k)} ${round(cx + k)} ${bottom} ${cx} ${bottom}`
    + ` C${round(cx - k)} ${bottom} ${cx - r} ${below(cy + k)} ${cx - r} ${cy}`
    + ` C${cx - r} ${round(cy - k)} ${round(cx - k)} ${top} ${cx} ${top} Z`;
}

export const HEAD_REST = headPath();

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
 */

/** Where the mouth's four control points are for one pose. */
export function mouthGeometry({ open = 0, smile = 0 } = {}) {
  const cornerY = 163 - 7 * smile;
  return {
    left: { x: 86, y: cornerY },
    right: { x: 154, y: cornerY },
    top: { x: 120, y: 163 + 12 * smile },
    bottom: { x: 120, y: 169 + 12 * smile + 76 * open }
  };
}

/** A point on a quadratic, so what goes inside the mouth can sit on its own lips. */
const quad = (p0, c, p2, t) => {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y };
};
/** The control point of the quadratic through three points, which is how a band follows a lip. */
const through = (a, mid, b) => ({ x: 2 * mid.x - (a.x + b.x) / 2, y: 2 * mid.y - (a.y + b.y) / 2 });
const point = (p) => `${round(p.x)} ${round(p.y)}`;

export function mouthPath(pose = {}) {
  const g = mouthGeometry(pose);
  return `M${point(g.left)} Q${point(g.top)} ${point(g.right)} Q${point(g.bottom)} ${point(g.left)} Z`;
}

/**
 * Teeth and tongue.
 *
 * Both are drawn *from the mouth's own curves* rather than beside them: the
 * teeth hang off the upper lip, the tongue sits on the lower one. Inside by
 * construction, which is the whole reason the cavity used to come apart — a
 * shape that only happens to line up stops lining up the moment anything moves.
 *
 * `show` is how far they come out, and at 0 the shape is a flat line with no
 * height at all: closed lips have nothing behind them to hide.
 */
const BAND = Object.freeze({ from: 0.2, to: 0.8, teeth: 0.3, tongue: 0.52 });

const mouthDepth = (g) => (g.bottom.y - g.top.y) / 2;

export function teethPath({ open = 0, smile = 0, show = 0 } = {}) {
  const g = mouthGeometry({ open, smile });
  const lip = (t) => quad(g.left, g.top, g.right, t);
  const a = lip(BAND.from), b = lip(BAND.to), control = through(a, lip(0.5), b);
  const drop = mouthDepth(g) * BAND.teeth * show;
  const down = (p) => ({ x: p.x, y: p.y + drop });
  return `M${point(a)} Q${point(control)} ${point(b)} L${point(down(b))} Q${point(down(control))} ${point(down(a))} Z`;
}

export function tonguePath({ open = 0, smile = 0, show = 0 } = {}) {
  const g = mouthGeometry({ open, smile });
  // The lower lip, walked right to left, so the tongue is wound the same way
  // round as the teeth and the two shapes stay comparable.
  const lip = (t) => quad(g.right, g.bottom, g.left, t);
  const a = lip(BAND.from), b = lip(BAND.to), control = through(a, lip(0.5), b);
  const rise = mouthDepth(g) * BAND.tongue * show;
  const up = (p) => ({ x: p.x, y: p.y - rise });
  return `M${point(a)} Q${point(control)} ${point(b)} L${point(up(b))} Q${point(up(control))} ${point(up(a))} Z`;
}

export const MOUTH_REST = mouthPath();
export const TEETH_REST = teethPath();
export const TONGUE_REST = tonguePath();

export const MASCOT_FACE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Cartoon mascot face">
  <defs>
    <clipPath id="eyeSocketLeft"><ellipse cx="82" cy="98" rx="26" ry="21" /></clipPath>
    <clipPath id="eyeSocketRight"><ellipse cx="158" cy="98" rx="26" ry="21" /></clipPath>
    <clipPath id="headShape"><circle cx="120" cy="120" r="100" /></clipPath>
  </defs>
  <g id="faceRoot" data-name="Face">
    <path id="hairBack" data-name="Hair back" d="M14 132 C0 44 52 0 120 0 C188 0 240 44 226 132 L216.1 92.4 C230 44 184 4 120 4 C56 4 10 44 23.9 92.4 Z" fill="${HAIR_BACK}" />
    <g id="earLeft" data-name="Left ear"><ellipse id="earLeftShape" data-name="Left ear shape" cx="24" cy="124" rx="18" ry="27" fill="${SKIN}" stroke="${LINE}" stroke-width="4" /><path id="earLeftFold" data-name="Left ear fold" d="M26 112 Q16 124 26 136" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" opacity=".7" /></g>
    <g id="earRight" data-name="Right ear"><ellipse id="earRightShape" data-name="Right ear shape" cx="216" cy="124" rx="18" ry="27" fill="${SKIN}" stroke="${LINE}" stroke-width="4" /><path id="earRightFold" data-name="Right ear fold" d="M214 112 Q224 124 214 136" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" opacity=".7" /></g>
    <path id="head" data-name="Head shape" d="${HEAD_REST}" fill="${SKIN}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />
    <path id="shadeLeft" data-name="Left cheek shade" d="M20 120 Q26 66 60 34 Q34 88 40 150 Q44 194 74 214 Q34 190 20 120 Z" fill="${SHADE}" opacity=".5" />
    <path id="shadeRight" data-name="Right cheek shade" d="M220 120 Q214 66 180 34 Q206 88 200 150 Q196 194 166 214 Q206 190 220 120 Z" fill="${SHADE}" opacity=".5" />
    <path id="mouth" data-name="Mouth" d="${MOUTH_REST}" fill="${MOUTH}" stroke="${LIP}" stroke-width="6" stroke-linejoin="round" />
    <path id="tongue" data-name="Tongue" d="${TONGUE_REST}" fill="${TONGUE}" />
    <path id="teeth" data-name="Teeth" d="${TEETH_REST}" fill="${TEETH}" />
    ${eye('Left', 82)}
    ${eye('Right', 158)}
    <g id="eyebrows" data-name="Eyebrows" fill="none" stroke="#57382b" stroke-width="8" stroke-linecap="round">
      <path id="browLeft" data-name="Left eyebrow" d="M58 72 Q82 58 106 72" />
      <path id="browRight" data-name="Right eyebrow" d="M134 72 Q158 58 182 72" />
    </g>
    <path id="nose" data-name="Nose" d="M120 122 Q110 142 124 145" fill="none" stroke="${LINE}" stroke-width="4.5" stroke-linecap="round" />
    <path id="hairTop" data-name="Hair top" d="M23.9 92.4 C10 44 56 4 120 4 C184 4 230 44 216.1 92.4 C203.8 49.5 164.6 20 120 20 C75.4 20 36.2 49.5 23.9 92.4 Z" fill="${HAIR}" />
    <g id="hairFront" data-name="Hair front" clip-path="url(#headShape)"><path id="hair" data-name="Fringe" d="M8 96 Q10 14 112 6 Q214 8 232 94 Q214 44 160 42 L148 66 Q130 42 104 46 L96 68 Q70 40 42 54 Q18 66 8 96 Z" fill="${HAIR}" /></g>
  </g>
</svg>`;
