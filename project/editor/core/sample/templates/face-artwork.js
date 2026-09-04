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
const SHADE = '#8a5a3c', LIP = '#a8404b', MOUTH = '#5e1f27', DARK = '#263238';

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
export function mouthPath({ open = 0, smile = 0 } = {}) {
  const round = (value) => Math.round(value * 10) / 10;
  const cornerY = round(163 - 7 * smile);        // the corners lift into a smile
  const topY = round(163 + 12 * smile);          // and the upper lip bows the other way
  const bottomY = round(169 + 12 * smile + 76 * open);
  return `M86 ${cornerY} Q120 ${topY} 154 ${cornerY} Q120 ${bottomY} 86 ${cornerY} Z`;
}

export const MOUTH_REST = mouthPath();

export const MASCOT_FACE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Cartoon mascot face">
  <defs>
    <clipPath id="eyeSocketLeft"><ellipse cx="82" cy="98" rx="26" ry="21" /></clipPath>
    <clipPath id="eyeSocketRight"><ellipse cx="158" cy="98" rx="26" ry="21" /></clipPath>
    <clipPath id="headShape"><circle cx="120" cy="120" r="100" /></clipPath>
  </defs>
  <g id="faceRoot" data-name="Face">
    <path id="hairBack" data-name="Hair back" d="M24 118 Q18 30 92 18 Q176 6 214 84 Q222 108 216 132 Q206 74 150 58 Q84 44 40 92 Z" fill="${HAIR_BACK}" />
    <g id="earLeft" data-name="Left ear"><ellipse id="earLeftShape" data-name="Left ear shape" cx="24" cy="124" rx="18" ry="27" fill="${SKIN}" stroke="${LINE}" stroke-width="4" /><path id="earLeftFold" data-name="Left ear fold" d="M26 112 Q16 124 26 136" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" opacity=".7" /></g>
    <g id="earRight" data-name="Right ear"><ellipse id="earRightShape" data-name="Right ear shape" cx="216" cy="124" rx="18" ry="27" fill="${SKIN}" stroke="${LINE}" stroke-width="4" /><path id="earRightFold" data-name="Right ear fold" d="M214 112 Q224 124 214 136" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" opacity=".7" /></g>
    <ellipse id="chin" data-name="Chin" cx="120" cy="142" rx="92" ry="76" fill="${SKIN}" stroke="${LINE}" stroke-width="4" />
    <circle id="head" data-name="Head shape" cx="120" cy="120" r="100" fill="${SKIN}" stroke="${LINE}" stroke-width="4" />
    <path id="shadeLeft" data-name="Left cheek shade" d="M20 120 Q26 66 60 34 Q34 88 40 150 Q44 194 74 214 Q34 190 20 120 Z" fill="${SHADE}" opacity=".5" />
    <path id="shadeRight" data-name="Right cheek shade" d="M220 120 Q214 66 180 34 Q206 88 200 150 Q196 194 166 214 Q206 190 220 120 Z" fill="${SHADE}" opacity=".5" />
    <path id="browShade" data-name="Forehead shade" d="M34 80 Q120 40 206 80 Q120 60 34 80 Z" fill="${SHADE}" opacity=".2" />
    <path id="mouth" data-name="Mouth" d="${MOUTH_REST}" fill="${MOUTH}" stroke="${LIP}" stroke-width="6" stroke-linejoin="round" />
    ${eye('Left', 82)}
    ${eye('Right', 158)}
    <g id="eyebrows" data-name="Eyebrows" fill="none" stroke="#57382b" stroke-width="8" stroke-linecap="round">
      <path id="browLeft" data-name="Left eyebrow" d="M58 72 Q82 58 106 72" />
      <path id="browRight" data-name="Right eyebrow" d="M134 72 Q158 58 182 72" />
    </g>
    <path id="nose" data-name="Nose" d="M120 122 Q110 142 124 145" fill="none" stroke="${LINE}" stroke-width="4.5" stroke-linecap="round" />
    <g id="hairFront" data-name="Hair front" clip-path="url(#headShape)"><path id="hair" data-name="Fringe" d="M8 96 Q10 14 112 6 Q214 8 232 94 Q214 44 160 42 L148 66 Q130 42 104 46 L96 68 Q70 40 42 54 Q18 66 8 96 Z" fill="${HAIR}" /></g>
  </g>
</svg>`;
