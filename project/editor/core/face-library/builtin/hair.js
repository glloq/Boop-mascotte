/**
 * Hair: one part in the builder, up to three roles in the rig -- the
 * fringe (`hair`, required), the volume above the skull (`hairTop`) and
 * what shows behind it (`hairBack`), which is painted behind the face
 * (`behind`), so a long style falls down the sides of the head rather
 * than over it. Drawn over the template's skull (the crown at 22, the
 * sides at 26 and 214).
 */
const HAIR = '#a6603c', SHADOW = '#874a2b', SHINE = '#ffffff';

const PAINTS = Object.freeze({ hair: Object.freeze({ fill: 'hair' }), hairTop: Object.freeze({ fill: 'hair' }), hairBack: Object.freeze({ fill: 'hairShadow' }) });

const hair = (slug, name, description, { pieces, behind = [], roles, box, paletteRoles = null }) => Object.freeze({
  id: `hair.${slug}`, category: 'hair', name, description, origin: 'builtin',
  artwork: `<g id="hair-${slug}" data-name="Hair">${pieces}</g>`,
  roles: Object.freeze(roles),
  capabilities: Object.freeze(['hairSway', 'hairLift']),
  // Gentler than the registry's eight, as the template's own hair is: the
  // crown is the silhouette, and swung far the skull shows through under it.
  drivers: Object.freeze({ hairSway: Object.freeze({ property: 'rotation', amplitude: -4, offset: 0 }), hairLift: Object.freeze({ property: 'translateY', amplitude: -5, offset: 0 }) }),
  behind: Object.freeze(behind),
  // Every piece is painted as the hair, the back as its shadow; a shine is no colour of the face.
  paletteRoles: Object.freeze(paletteRoles ?? Object.fromEntries(Object.keys(roles).filter((role) => roles[role] !== 'hair' || slug !== 'bald').map((role) => [roles[role], PAINTS[role]]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'hair.top',
  palette: Object.freeze(['hair', 'hairShadow'])
});

/** A cap over the crown: from one temple over the top to the other, back along the hairline. */
const CAP = 'M30 108 C28 62 66 16 120 16 C174 16 212 62 210 108 C202 82 170 64 120 64 C70 64 38 82 30 108 Z';

export const HAIR_SHORT = hair('short', 'Short', 'A short cap of hair.', {
  paletteRoles: { hair: { fill: 'hair' } },
  pieces: `<path id="hair" data-name="Fringe" d="${CAP}" fill="${HAIR}" /><path id="hairTop" data-name="Hair top" d="M70 40 C90 24 150 24 170 40 C150 34 90 34 70 40 Z" fill="${SHINE}" opacity="0.25" />`,
  roles: { hair: 'hair', hairTop: 'hairTop' }, box: { x: 30, y: 16, width: 180, height: 92 }
});

// Spikes stand *off* the head: the tallest of them reaches two units above the
// origin, which is the drawing it was made as. It was trimmed flat to the page
// once; the artboard has room over the head now, so it is hair again.
export const HAIR_SPIKY = hair('spiky', 'Spiky', 'Spikes standing up from the crown.', {
  pieces: `<path id="hair" data-name="Fringe" d="M30 108 C30 70 50 40 62 36 L56 8 L82 30 L92 0 L108 28 L120 -2 L132 28 L148 0 L158 30 L184 8 L178 36 C190 40 210 70 210 108 C202 82 170 66 120 66 C70 66 38 82 30 108 Z" fill="${HAIR}" />`,
  roles: { hair: 'hair' }, box: { x: 30, y: -2, width: 180, height: 110 }
});

export const HAIR_CURLY = hair('curly', 'Curly', 'A crown of curls.', {
  paletteRoles: { hair: { fill: 'hair' }, hairTop: { fill: 'hairShadow' } },
  pieces: `<path id="hairTop" data-name="Hair top" d="M28 100 C18 84 22 60 40 52 C34 36 50 22 66 28 C68 12 90 6 102 16 C110 2 134 2 142 16 C154 6 176 12 178 28 C194 22 210 36 204 52 C222 60 226 84 216 100 C206 76 172 64 120 64 C68 64 38 76 28 100 Z" fill="${SHADOW}" /><path id="hair" data-name="Fringe" d="M36 106 C40 82 70 70 120 70 C170 70 200 82 204 106 C180 92 150 88 120 90 C90 88 60 92 36 106 Z" fill="${HAIR}" />`,
  roles: { hair: 'hair', hairTop: 'hairTop' }, box: { x: 22, y: 6, width: 200, height: 100 }
});

export const HAIR_LONG = hair('long', 'Long', 'Long hair down the sides, behind the face.', {
  paletteRoles: { hair: { fill: 'hair' }, hairBack: { fill: 'hairShadow' } },
  pieces: `<path id="hairBack" data-name="Hair back" d="M18 96 C14 44 62 6 120 6 C178 6 226 44 222 96 L232 200 C232 214 206 222 194 214 L186 132 L54 132 L46 214 C34 222 8 214 8 200 Z" fill="${SHADOW}" /><path id="hair" data-name="Fringe" d="${CAP}" fill="${HAIR}" /><path id="hairTop" data-name="Hair top" d="M64 44 C90 26 150 26 176 44 C150 38 90 38 64 44 Z" fill="${SHINE}" opacity="0.25" />`,
  behind: ['hairBack'],
  roles: { hair: 'hair', hairTop: 'hairTop', hairBack: 'hairBack' }, box: { x: 8, y: 6, width: 224, height: 216 }
});

export const HAIR_BALDING = hair('balding', 'Balding', 'Hair at the sides, a bare crown.', {
  paletteRoles: { hair: { fill: 'hair' } },
  pieces: `<path id="hair" data-name="Sides" d="M30 108 C26 80 34 60 46 54 L52 66 C42 74 38 90 40 108 Z M210 108 C214 80 206 60 194 54 L188 66 C198 74 202 90 200 108 Z" fill="${HAIR}" /><path id="hairTop" data-name="Shine" d="M84 40 C96 28 144 28 156 40" fill="none" stroke="${SHINE}" stroke-width="5" stroke-linecap="round" opacity="0.45" />`,
  roles: { hair: 'hair', hairTop: 'hairTop' }, box: { x: 26, y: 28, width: 188, height: 80 }
});

export const HAIR_BALD = hair('bald', 'Bald', 'No hair: a shine on the crown.', {
  pieces: `<path id="hair" data-name="Shine" d="M84 40 C96 28 144 28 156 40" fill="none" stroke="${SHINE}" stroke-width="5" stroke-linecap="round" opacity="0.45" />`,
  roles: { hair: 'hair' }, box: { x: 82, y: 28, width: 76, height: 16 }
});

export const HAIR_STYLES = Object.freeze([HAIR_SHORT, HAIR_SPIKY, HAIR_CURLY, HAIR_LONG, HAIR_BALDING, HAIR_BALD]);
