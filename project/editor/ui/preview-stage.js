/**
 * What the mascot is being tested *against*: a ground, and a size.
 *
 * Preview had eight sections — expressions, reactions with an event simulator
 * and a log, poses, animations, automatic behaviours, every live movement as a
 * slider, and the hands — and neither of the two things a person actually
 * checks before they ship a mascot:
 *
 * ```text
 * does it read on the page it is going on?      → a ground
 * does it read at the size it is going at?      → 32 px, not 600
 * ```
 *
 * A mascot is exported to sit in the corner of somebody's site. The canvas
 * shows it at six hundred pixels on a dark blue radial gradient, which is the
 * one context it will never be in. An author could not find out that their
 * three-unit outlines disappear at 32 px, or that their dark line work vanishes
 * on a dark site, without exporting and looking — so the two cheapest,
 * highest-value checks in the product were the two it did not offer
 * (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §11 and 01_ETAT_ACTUEL.md §11).
 *
 * Both are **session state and view only**: they change what the canvas is
 * painted on and how big the mascot is drawn, never the document, never the
 * export. Nothing here reaches a project.
 */

/**
 * The grounds, in the order they are offered.
 *
 * `checker` is first among the neutrals because it is the honest one for an
 * exported SVG: transparency is what the file has, and a checkerboard is how
 * every graphics tool has drawn it for thirty years. `page` is the two real
 * ones — a light site and a dark site — which is where a contrast problem shows
 * up and nowhere else.
 */
export const PREVIEW_GROUNDS = Object.freeze([
  Object.freeze({ id: 'checker', label: 'Transparent', hint: 'What the exported SVG actually has behind it' }),
  Object.freeze({ id: 'light', label: 'Light', hint: 'A light page' }),
  Object.freeze({ id: 'dark', label: 'Dark', hint: 'A dark page' }),
  Object.freeze({ id: 'colour', label: 'Colour', hint: 'A strong background, for a mascot that has to hold against one' })
]);

export const PREVIEW_GROUND_IDS = Object.freeze(PREVIEW_GROUNDS.map((ground) => ground.id));

export const DEFAULT_GROUND = 'checker';

/**
 * The sizes, in pixels, and `fit` for the canvas as it is.
 *
 * Not a slider. Four sizes somebody can name — a favicon, an avatar, a chat
 * bubble, a hero — answer the question "does it read?" better than a continuous
 * control, because the question is not "at what exact size does it break" but
 * "does it survive the sizes it will meet".
 */
export const PREVIEW_SIZES = Object.freeze([
  Object.freeze({ id: 32, label: '32', hint: 'A favicon, or an icon in a list' }),
  Object.freeze({ id: 64, label: '64', hint: 'An avatar' }),
  Object.freeze({ id: 128, label: '128', hint: 'A chat bubble, or a card' }),
  Object.freeze({ id: 256, label: '256', hint: 'A hero, or a header' }),
  Object.freeze({ id: 'fit', label: 'Fit', hint: 'As large as the canvas allows' })
]);

export const PREVIEW_SIZE_IDS = Object.freeze(PREVIEW_SIZES.map((size) => size.id));

export const DEFAULT_SIZE = 'fit';

/** A ground id, from anything. */
export const normalizeGround = (value) => (PREVIEW_GROUND_IDS.includes(value) ? value : DEFAULT_GROUND);

/** A size id, from anything. A number that is not one of the four is the nearest that is. */
export function normalizeSize(value) {
  if (value === 'fit' || value === undefined || value === null) return DEFAULT_SIZE;
  const wanted = Number(value);
  if (!Number.isFinite(wanted)) return DEFAULT_SIZE;
  const numbers = PREVIEW_SIZE_IDS.filter((id) => typeof id === 'number');
  return numbers.reduce((best, id) => (Math.abs(id - wanted) < Math.abs(best - wanted) ? id : best), numbers[0]);
}

/**
 * What the stage is, as the canvas needs to hear it.
 *
 * `scale` is a fraction of the artboard's own size, so a 32 px test is 32 px of
 * *screen* whatever the artwork's units are — the point of the check is what a
 * reader's eye gets, not what the viewBox says.
 *
 * @param {{ ground?: string, size?: number|'fit' }} stage
 * @param {{ artboard?: number }} [options] the artboard's larger side, in its own units
 * @returns {{ ground: string, size: number|'fit', fitted: boolean, pixels: number|null }}
 */
export function describeStage({ ground, size } = {}, { artboard = 0 } = {}) {
  const resolved = normalizeSize(size);
  return {
    ground: normalizeGround(ground),
    size: resolved,
    fitted: resolved === 'fit',
    pixels: resolved === 'fit' ? null : resolved,
    // A mascot drawn smaller than about sixteen pixels is not a test of
    // anything: below that the answer is always "no".
    tooSmall: resolved !== 'fit' && resolved < 16,
    artboard: Number(artboard) || 0
  };
}

/**
 * Whether a mascot this size is worth warning about, and why.
 *
 * One sentence, and only when it is true. The two failures that actually
 * happen at small sizes are a stroke that ends up under a pixel wide and a
 * drawing with so many pieces that none of them survives — and the first is
 * the one an author can do something about.
 *
 * @param {{ size: number|'fit' }} stage
 * @param {{ strokes?: number[], artboard?: number }} artwork
 * @returns {string} '' when there is nothing to say
 */
export function stageWarning(stage, { strokes = [], artboard = 0 } = {}) {
  if (!stage || stage.size === 'fit' || !artboard || !strokes.length) return '';
  const scale = stage.size / artboard;
  const thinnest = Math.min(...strokes.filter((width) => Number(width) > 0));
  if (!Number.isFinite(thinnest)) return '';
  const onScreen = thinnest * scale;
  if (onScreen >= 1) return '';
  return `At ${stage.size} px the thinnest outline on this mascot is ${onScreen.toFixed(2)} px wide, so it will thin out or disappear. Thicker outlines, or fewer of them, survive this size.`;
}
