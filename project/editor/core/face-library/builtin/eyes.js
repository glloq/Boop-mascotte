/**
 * Eyes, as the template draws them: a socket clip, a white, a pupil, a
 * glint, two lids and an outline, one group a side, at the template's eye
 * centres (83 and 157, on the line at 113).
 *
 * An eye is three parts of the rig -- the eyes, the gaze and the lids -- so
 * a pair of eyes is a *composite* asset: it names the pupils and the lids
 * under `parts`, and says how its lids move, because the registry knows a
 * lid's travel only as a shape. The lids are drawn open and parked outside
 * the socket; closing is the movement, so the artwork on its own is a face
 * with its eyes open.
 */
const SKIN = '#f9d9b0', LINE = '#a4674a', WHITE = '#ffffff', PUPIL = '#2f3a43';
const CENTRES = Object.freeze({ Left: 83, Right: 157 });
const CY = 113;
const round = (value) => Math.round(value * 100) / 100;

/** One side. The lids reach past the socket sideways and are clipped to it, as the template's are. */
function eye(side, { rx, ry, pupil, bulge = 6, depth = 22, rest = 0 }) {
  const cx = CENTRES[side], l = cx - rx - 8, r = cx + rx + 8;
  // The upper lid's curved edge touches the top of the eye at rest, `rest`
  // lower for a sleepy eye; the lower lid's touches the bottom.
  const upperEdge = CY - ry + rest, lowerEdge = CY + ry;
  const upper = `M${l} ${round(upperEdge - bulge - depth)} L${r} ${round(upperEdge - bulge - depth)} L${r} ${round(upperEdge - bulge)} Q${cx} ${round(upperEdge + bulge)} ${l} ${round(upperEdge - bulge)} Z`;
  const lower = `M${l} ${round(lowerEdge + bulge + depth)} L${r} ${round(lowerEdge + bulge + depth)} L${r} ${round(lowerEdge + bulge)} Q${cx} ${round(lowerEdge - bulge)} ${l} ${round(lowerEdge + bulge)} Z`;
  return `<g id="eye${side}" data-name="${side} eye" clip-path="url(#socket${side})">`
    + `<ellipse id="eyeWhite${side}" data-name="${side} eye white" cx="${cx}" cy="${CY}" rx="${rx}" ry="${ry}" fill="${WHITE}" />`
    + `<circle id="pupil${side}" data-name="${side} pupil" cx="${cx}" cy="${CY}" r="${pupil}" fill="${PUPIL}" />`
    + `<circle id="glint${side}" data-name="${side} eye glint" cx="${round(cx - pupil * 0.4)}" cy="${round(CY - pupil * 0.45)}" r="${round(pupil * 0.34)}" fill="${WHITE}" opacity="0.9" />`
    + `<ellipse id="rim${side}" data-name="${side} eye outline" cx="${cx}" cy="${CY}" rx="${rx}" ry="${ry}" fill="none" stroke="${LINE}" stroke-width="3" />`
    + `<path id="lidUpper${side}" data-name="${side} upper eyelid" d="${upper}" fill="${SKIN}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
    + `<path id="lidLower${side}" data-name="${side} lower eyelid" d="${lower}" fill="${SKIN}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" />`
    + '</g>';
}

function eyes(slug, name, description, geometry) {
  const { rx, ry, bulge = 6, rest = 0 } = geometry;
  // How far a lid travels to shut the eye: from where its curved edge is drawn
  // -- touching the top of the eye, or the bottom -- to the middle, where the
  // two meet. A shut eye is a seam, so neither lid goes past it: the bulge is
  // the shape of the edge and the drawing already places it, and a travel that
  // carried it as well brought each lid that far through the other. On the
  // round eyes that was thirty units of overlap on a socket forty-five tall,
  // which reads as lids closing well past the middle of the eye.
  const upperTravel = round(ry - rest), lowerTravel = round(ry);
  const clips = ['Left', 'Right'].map((side) => `<clipPath id="socket${side}"><ellipse cx="${CENTRES[side]}" cy="${CY}" rx="${rx + 2}" ry="${ry + 2}" /></clipPath>`).join('');
  return Object.freeze({
    id: `eyes.${slug}`, category: 'eyes', name, description, origin: 'builtin',
    artwork: `<g id="eyes-${slug}" data-name="Eyes"><defs>${clips}</defs>${eye('Left', geometry)}${eye('Right', geometry)}</g>`,
    roles: Object.freeze({ leftEye: 'eyeLeft', rightEye: 'eyeRight' }),
    capabilities: Object.freeze(['eyeOpen']),
    // The lids do the closing; the eye itself only squashes a little with them.
    drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'scaleY', amplitude: 0.12, offset: 0.88 }) }),
    parts: Object.freeze({
      gaze: Object.freeze({ roles: Object.freeze({ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }), capabilities: Object.freeze(['lookX', 'lookY', 'pupilScale']) }),
      eyelids: Object.freeze({
        roles: Object.freeze({ leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' }),
        capabilities: Object.freeze(['eyeOpen']),
        // Drawn at `eyeOpen 1`: the upper lid comes down as it shuts, the lower lid comes up.
        drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'translateY', amplitude: -upperTravel, offset: upperTravel, roles: Object.freeze({ leftLower: Object.freeze({ amplitude: lowerTravel, offset: -lowerTravel }), rightLower: Object.freeze({ amplitude: lowerTravel, offset: -lowerTravel }) }) }) })
      })
    }),
    paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => [
      [`eyeWhite${side}`, Object.freeze({ fill: 'eyeWhite' })], [`pupil${side}`, Object.freeze({ fill: 'pupil' })], [`rim${side}`, Object.freeze({ stroke: 'outline' })],
      [`lidUpper${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })], [`lidLower${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })]
    ]))),
    referenceBox: Object.freeze({ x: CENTRES.Left - rx, y: CY - ry, width: CENTRES.Right - CENTRES.Left + rx * 2, height: ry * 2 }),
    mountPoint: 'eyes',
    palette: Object.freeze(['eyeWhite', 'pupil', 'skin', 'outline'])
  });
}

export const EYES_ROUND_LARGE = eyes('round-large', 'Round, large', 'Big round eyes with a glint.', { rx: 24, ry: 22.5, pupil: 10.5 });
export const EYES_ROUND_SMALL = eyes('round-small', 'Round, small', 'Small round eyes.', { rx: 15, ry: 14, pupil: 7, bulge: 4, depth: 18 });
export const EYES_SLEEPY = eyes('sleepy', 'Sleepy', 'Heavy lids, half over the eye.', { rx: 24, ry: 22.5, pupil: 10.5, rest: 12 });
export const EYES_CARTOON = eyes('cartoon', 'Cartoon', 'Tall oval eyes with big pupils.', { rx: 20, ry: 27, pupil: 12, bulge: 7, depth: 24 });
export const EYES_MINIMAL = eyes('minimal', 'Minimal', 'Two small dots.', { rx: 9, ry: 9, pupil: 6, bulge: 3, depth: 14 });

export const EYE_SETS = Object.freeze([EYES_ROUND_LARGE, EYES_ROUND_SMALL, EYES_SLEEPY, EYES_CARTOON, EYES_MINIMAL]);
