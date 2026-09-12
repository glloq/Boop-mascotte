/**
 * The mascot the editor ships: **a face, and a pair of hands**, put together.
 *
 * ```text
 *  face-artwork.js        a face, on its own square          knows nothing about hands
 *  core/hands/*           a pair of hands, from the set      knows nothing about faces
 *          │
 *          ▼  here        one page, the hands behind the head
 * ```
 *
 * The face module used to draw the hands itself: it imported `styleHandsMarkup`
 * and grew its own page to make room for them, so the module that knows what a
 * cheek looks like also knew what a thumb looks like. A hand is a piece of its
 * own now, out of a set on disk (docs/HAND_STYLES.md) that an author can add
 * to, so it has no business being drawn by the face — and the face has no
 * business knowing how much room one needs.
 *
 * What is left of the coupling is what genuinely belongs to the *mascot* rather
 * than to either half of it:
 *
 * * **the page** — a face fills its own square, and a pair hanging below it
 *   needs a bigger one (`handsArtboard`);
 * * **the paint** — the hands are dressed in the face's own palette and its own
 *   line weight, so a hand beside a warm face is not a white glove;
 * * **the paint order** — the pair goes down *before* the face, which is what
 *   puts it behind the head it hides behind (docs/HAND_RIGGING.md).
 *
 * Three facts about a mascot, in one place, instead of a face module that
 * imports the hands.
 */
import { handsArtboard } from '../hand-feature.js';
import { styleHandsMarkup } from '../../hands/hand-style-install.js';
import { FACE_LINE_WEIGHT, FACE_ONLY, FACE_PALETTE, buildMascotFaceSvg, withFaceHeadroom } from './face-artwork.js';

/** The artboard the template ships: the face's square, the hands' room below it, the headroom above. */
export const TEMPLATE_ARTBOARD = withFaceHeadroom(handsArtboard(FACE_ONLY));

/**
 * The pair, in the mascot's own colours, placed against the face's square.
 *
 * `FACE_ONLY` rather than the whole page: the hands are placed against the
 * **face**, and the page is then grown to hold them. Measuring them against a
 * page that is already big enough for them would be circular.
 */
export const mascotHandsMarkup = (palette = FACE_PALETTE) => styleHandsMarkup(FACE_ONLY, {
  look: { fill: palette.skin, line: palette.outlinePrimary, width: FACE_LINE_WEIGHT }
});

/**
 * The whole mascot: the face on a page big enough for its hands, with the pair
 * painted behind it.
 *
 * @param {{ palette?: object }} [options]
 * @returns {string}
 */
export function buildMascotArtwork({ palette = FACE_PALETTE } = {}) {
  const c = { ...FACE_PALETTE, ...palette };
  return buildMascotFaceSvg({ palette, box: TEMPLATE_ARTBOARD, before: mascotHandsMarkup(c) });
}

/** The mascot the template opens with. */
export const MASCOT_FACE_SVG = buildMascotArtwork();
