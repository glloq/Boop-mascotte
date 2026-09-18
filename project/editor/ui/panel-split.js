/**
 * How much of the window the panels get, per screen (UIR-15).
 *
 * ```text
 *   ┌──────────┬──────────────────────────┬──────────┐
 *   │  panels  ║          canvas          ║ inspector│
 *   └──────────╫──────────────────────────╫──────────┘
 *              ↕                          ↕
 *          draggable                  draggable
 * ```
 *
 * One number for each side, in pixels, read by the stylesheet as
 * `--panel-left` and `--panel-right`. Two things set them: the **route**, with
 * the width the screen wants, and the **author**, by dragging. The author wins
 * while their session lasts.
 *
 * ## Why per screen
 *
 * The shell gave every screen the same `300px · 1fr · 310px`, and that was one
 * compromise across screens that want opposite things. Measured at 1440×900:
 *
 * | Screen | Canvas | The panels held |
 * | --- | --- | --- |
 * | Artwork | 830px (58%) | an Inspector with **1341px of content in 836px** |
 * | Hands | 830px (58%) | eight stacked buttons per hand, and an *empty* Inspector |
 *
 * On Hands the canvas showed a face whose hands are behind its head — 58% of
 * the window spent on a drawing of the thing the screen is not about, while
 * the work itself scrolled. Drawing wants a big canvas; picking from a list of
 * drawings wants a big list. A screen is the only thing that knows which it is.
 *
 * ## Why the session and never the project
 *
 * A column width is not something a mascot has. It belongs with the open
 * sections, the current screen and the live pose: session state, kept in
 * `sessionStorage`, gone when the tab closes, and never a revision, a history
 * step or an export (docs/UIR_REFACTOR_BASELINE.md §5, Règle D).
 *
 * Nothing here touches a document. It reads a route, writes two custom
 * properties, and remembers what it wrote.
 */

/** What the shell falls back to: the one compromise every screen used to get. */
export const DEFAULT_SPLIT = Object.freeze({ left: 300, right: 310 });

/**
 * How narrow and how wide a column may be.
 *
 * The floor is a column still worth reading — narrower than this and the
 * *Collapse* button is the honest control, which the shell already has. The
 * ceiling stops one column eating a window on its own; what stops the pair of
 * them eating the canvas is `minCanvas` below.
 */
export const COLUMN = Object.freeze({ min: 200, max: 560 });

/**
 * What the canvas keeps, whatever the columns ask for.
 *
 * A **share** and not a pixel count, because the two columns are pixels: a
 * pair of widths that leaves a comfortable canvas on a 1920px monitor starves
 * one on a 1280px laptop, and the handles the rig draws *on* the canvas — a
 * hand's own slider sits beside the face, outside the artwork — fall behind
 * the panel when it does.
 *
 * The floor under the share is for a window narrow enough that the shell is
 * about to stack the columns anyway.
 */
export const CANVAS_SHARE = 0.52;
export const MIN_CANVAS_PX = 360;
export const minCanvas = (available = 0) => Math.max(MIN_CANVAS_PX, Math.round((available || 0) * CANVAS_SHARE));

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * One side's width, within its own limits and the canvas's.
 *
 * `available` is the window's width; a window too narrow for both columns and
 * a canvas gives the canvas the floor and lets the columns share what is left,
 * which is what the narrow-screen media queries then take over from.
 */
export function clampColumn(width, { other = 0, available = 0 } = {}) {
  const wanted = clamp(number(width, DEFAULT_SPLIT.left), COLUMN.min, COLUMN.max);
  if (!available) return wanted;
  const spare = available - other - minCanvas(available);
  return spare < COLUMN.min ? Math.max(0, Math.min(wanted, Math.max(spare, 0))) : Math.min(wanted, spare);
}

/**
 * Two widths that together leave the canvas its share.
 *
 * When they do not, **both** give way in proportion rather than one being
 * clamped to nothing: a screen that asked for a wide list and a narrow
 * inspector should keep those proportions on a smaller window, not lose the
 * inspector entirely to keep the list.
 */
export function fitPair(left, right, available = 0) {
  const budget = available ? available - minCanvas(available) : Infinity;
  const wanted = { left: clamp(number(left, DEFAULT_SPLIT.left), COLUMN.min, COLUMN.max), right: clamp(number(right, DEFAULT_SPLIT.right), COLUMN.min, COLUMN.max) };
  const total = wanted.left + wanted.right;
  if (!available || total <= budget) return wanted;
  // Both at their floor is the most the shell can offer. Below that the canvas
  // takes the squeeze rather than the columns, because a window this narrow is
  // one where the stylesheet has already stopped putting the three side by
  // side — it stacks them, and these numbers are not read at all.
  if (budget <= COLUMN.min * 2) return { left: Math.min(wanted.left, COLUMN.min), right: Math.min(wanted.right, COLUMN.min) };
  const ratio = budget / total;
  const scaled = { left: Math.max(COLUMN.min, Math.round(wanted.left * ratio)), right: Math.max(COLUMN.min, Math.round(wanted.right * ratio)) };
  // Rounding up to the floor can push the pair back over the budget; the
  // larger column pays for it, because it has the room to.
  const over = scaled.left + scaled.right - budget;
  if (over > 0) {
    const side = scaled.left >= scaled.right ? 'left' : 'right';
    scaled[side] = Math.max(COLUMN.min, scaled[side] - over);
  }
  return scaled;
}

/**
 * The split a screen asks for, falling back a step at a time.
 *
 * A mode's own `layout`, then the workspace's, then the one default. So
 * `design.hands` can want a wide list without every Design screen wanting one,
 * and a mode that says nothing still gets something sensible.
 *
 * @param {object} mode  a `MODES` entry
 * @returns {{left: number, right: number}}
 */
export function splitForMode(mode) {
  const layout = mode?.layout || null;
  return {
    left: number(layout?.left, DEFAULT_SPLIT.left),
    right: number(layout?.right, DEFAULT_SPLIT.right)
  };
}

/**
 * The split to draw: what the screen wants, overridden by what the author
 * dragged on *this* screen, clamped so the canvas survives.
 *
 * Per screen on purpose. An author who widens the list on Hands has not asked
 * for a narrow canvas in Draw, and one global number would mean exactly that.
 */
export function resolveSplit(mode, saved = {}, { available = 0 } = {}) {
  const wanted = splitForMode(mode);
  const override = saved?.[mode?.id] || {};
  return fitPair(number(override.left, wanted.left), number(override.right, wanted.right), available);
}

const KEY = 'boop.panelSplit';

/** What the author has dragged, per screen, for as long as the tab is open. */
export function readSplits(storage = globalThis.sessionStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function writeSplits(splits, storage = globalThis.sessionStorage) {
  // A tab with storage blocked is a tab where the columns are the route's and
  // stay the route's, which is a working editor and not an error to report.
  try { storage?.setItem(KEY, JSON.stringify(splits || {})); return true; } catch { return false; }
}
