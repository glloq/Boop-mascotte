/**
 * Heads: a skull each, drawn where the template's is (the face's middle at
 * 120, 116; the template skull 188 wide). On a face whose head is a lone
 * shape the skull *is* the head that turns; on the template, whose head is
 * the whole face, the skull goes inside that face and the jaw takes it
 * (docs/FACE_PART_LIBRARY.md, "The skull rule"). The jaw movement the
 * template drew as a shape is not carried: the parameter stays, the jaw
 * waits for a pose these drawings do not ship yet.
 */
const SKIN = '#f9d9b0', LINE = '#a4674a';

const head = (slug, name, description, shape, box) => Object.freeze({
  id: `head.${slug}`, category: 'head', name, description, origin: 'builtin',
  artwork: `<g id="head-${slug}" data-name="Head">${shape}</g>`,
  roles: Object.freeze({ head: 'skull' }),
  capabilities: Object.freeze(['headX', 'headY', 'headTilt']),
  referenceBox: Object.freeze(box),
  mountPoint: 'head.center',
  palette: Object.freeze(['skin', 'outline'])
});

export const HEAD_ROUND = head('round', 'Round', 'A round skull.', `<circle id="skull" data-name="Skull" cx="120" cy="116" r="94" fill="${SKIN}" stroke="${LINE}" stroke-width="4" />`, { x: 26, y: 22, width: 188, height: 188 });
export const HEAD_OVAL = head('oval', 'Oval', 'A tall oval skull.', `<ellipse id="skull" data-name="Skull" cx="120" cy="116" rx="84" ry="96" fill="${SKIN}" stroke="${LINE}" stroke-width="4" />`, { x: 36, y: 20, width: 168, height: 192 });
export const HEAD_SQUARE_SOFT = head('square-soft', 'Square', 'A square skull with soft corners.', `<rect id="skull" data-name="Skull" x="30" y="24" width="180" height="184" rx="46" fill="${SKIN}" stroke="${LINE}" stroke-width="4" />`, { x: 30, y: 24, width: 180, height: 184 });
export const HEAD_NARROW = head('narrow', 'Narrow', 'A narrow, long skull.', `<ellipse id="skull" data-name="Skull" cx="120" cy="116" rx="72" ry="98" fill="${SKIN}" stroke="${LINE}" stroke-width="4" />`, { x: 48, y: 18, width: 144, height: 196 });

export const HEADS = Object.freeze([HEAD_ROUND, HEAD_OVAL, HEAD_SQUARE_SOFT, HEAD_NARROW]);
