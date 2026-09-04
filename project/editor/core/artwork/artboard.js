/**
 * The working area (docs/VECTOR_EDITING.md).
 *
 * An SVG's `viewBox` is its artboard, and a nested `<svg>` **clips to it**:
 * anything drawn outside is simply not there. That is invisible in an editor
 * that never draws the edge — taller hair came back cut off "for no reason".
 *
 * So the artboard is a thing you can see and change: this is the model (read
 * it, write it, grow it around what is drawn), the canvas draws its edge, and
 * the Artwork panel offers its size and a **Fit** that puts the border back
 * around everything.
 *
 * Pure string and number work. The measuring is the canvas's job, because only
 * the DOM knows how big a path actually is.
 */

const DEFAULT = Object.freeze({ x: 0, y: 0, width: 240, height: 240 });
const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 100) / 100;

/** The artboard of a piece of SVG markup, or a sane default. */
export function readArtboard(svgMarkup = '') {
  const match = /<svg[^>]*\sviewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/i.exec(String(svgMarkup || ''));
  if (!match) return { ...DEFAULT };
  const box = { x: number(match[1]), y: number(match[2]), width: number(match[3]), height: number(match[4]) };
  return box.width > 0 && box.height > 0 ? box : { ...DEFAULT };
}

/** The same markup with a different artboard. Nothing else about the root is touched. */
export function writeArtboard(svgMarkup = '', box = DEFAULT) {
  const next = normalizeArtboard(box);
  const value = `${round(next.x)} ${round(next.y)} ${round(next.width)} ${round(next.height)}`;
  const markup = String(svgMarkup || '');
  if (/<svg[^>]*\sviewBox="[^"]*"/i.test(markup)) return markup.replace(/(<svg[^>]*\sviewBox=")[^"]*(")/i, `$1${value}$2`);
  return markup.replace(/<svg\b/i, `<svg viewBox="${value}"`);
}

/** A box that is a box: positive, finite, and rounded to something an author can read. */
export function normalizeArtboard(box = {}) {
  // A negative or zero side is not a small artboard, it is a missing one.
  const side = (value, fallback) => { const size = round(value); return size > 0 ? size : fallback; };
  return {
    x: round(box.x), y: round(box.y),
    width: side(box.width, DEFAULT.width),
    height: side(box.height, DEFAULT.height)
  };
}

/**
 * The artboard that holds everything drawn, plus a margin.
 *
 * Growing only: **Fit** puts the border back around artwork that has escaped,
 * it does not crop the drawing to what is there. Shrinking an artboard is a
 * decision (it throws part of the drawing away), so it stays a number an
 * author types.
 */
export function artboardAround(box = DEFAULT, content = null, margin = 0) {
  const current = normalizeArtboard(box);
  if (!content || !(number(content.width) > 0) || !(number(content.height) > 0)) return current;
  const room = Math.max(0, number(margin));
  const left = Math.min(current.x, number(content.x) - room);
  const top = Math.min(current.y, number(content.y) - room);
  const right = Math.max(current.x + current.width, number(content.x) + number(content.width) + room);
  const bottom = Math.max(current.y + current.height, number(content.y) + number(content.height) + room);
  return normalizeArtboard({ x: left, y: top, width: right - left, height: bottom - top });
}

/**
 * How far the drawing reaches outside the artboard, per edge.
 *
 * Zero on every edge means nothing is being cut. Anything else is what the
 * Artwork panel says out loud, because the cut itself is invisible.
 */
export function artboardOverflow(box = DEFAULT, content = null) {
  const current = normalizeArtboard(box);
  if (!content) return { top: 0, right: 0, bottom: 0, left: 0, any: false };
  const edges = {
    left: Math.max(0, round(current.x - number(content.x))),
    top: Math.max(0, round(current.y - number(content.y))),
    right: Math.max(0, round(number(content.x) + number(content.width) - (current.x + current.width))),
    bottom: Math.max(0, round(number(content.y) + number(content.height) - (current.y + current.height)))
  };
  return { ...edges, any: Object.values(edges).some((value) => value > 0.5) };
}

/** "12 px past the top and 4 past the left", for a notice a person can act on. */
export function describeOverflow(overflow = {}) {
  const named = [['top', 'the top'], ['bottom', 'the bottom'], ['left', 'the left'], ['right', 'the right']]
    .filter(([key]) => number(overflow[key]) > 0.5)
    .map(([key, label]) => `${Math.round(number(overflow[key]))} past ${label}`);
  return named.length ? named.join(', ') : '';
}
