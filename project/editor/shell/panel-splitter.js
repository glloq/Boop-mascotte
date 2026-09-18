/**
 * The two boundaries an author can drag (UIR-15).
 *
 * ```text
 *   ┌──────────┬╢──────────────────────────╟┬──────────┐
 *   │  panels  │║          canvas          ║│ inspector│
 *   └──────────┴╢──────────────────────────╟┴──────────┘
 *               ↑                          ↑
 *          data-splitter="left"      data-splitter="right"
 * ```
 *
 * Each screen arrives at the width it asked for (`ui/panel-split.js`), and
 * this is how an author disagrees. Dragging is per screen and lasts the
 * session: widening the list on Hands is not a request for a narrow canvas in
 * Draw, and one global number would mean exactly that.
 *
 * ## Why they float rather than sit in the grid
 *
 * `.workspace` is a three-column grid and those three columns are read by a
 * great many selectors. A handle as a fourth child would be a fourth column
 * every one of them would have to learn about, so the handles are positioned
 * **over** the borders instead — `left: var(--panel-left)` and
 * `right: var(--panel-right)`, the same two properties the grid reads, so a
 * handle cannot drift from the edge it moves.
 *
 * ## The keyboard
 *
 * A separator that only answers to a pointer is a layout somebody cannot
 * change. Arrow keys move it a step, `Page` keys a bigger step, `Home` puts
 * the screen's own width back — and so does a double-click, which is the
 * gesture everybody tries first.
 */
import { COLUMN, clampColumn, readSplits, resolveSplit, splitForMode, writeSplits } from '../ui/panel-split.js';

/** One nudge, and the bigger one. */
const STEP = 16;
const PAGE = 64;

export const panelSplitterMarkup = () => ['left', 'right'].map((side) => `<div class="panel-splitter" data-splitter="${side}" role="separator" aria-orientation="vertical" tabindex="0" aria-label="${side === 'left' ? 'Width of the panel column' : 'Width of the inspector'}" title="Drag to resize · double-click for this screen’s own width"></div>`).join('');

/**
 * @param {object} deps
 * @param {HTMLElement} deps.root      `#app`
 * @param {() => object} deps.mode     the `MODES` entry that is open
 * @param {Storage} [deps.storage]     where a drag is remembered; the session's
 */
export function wirePanelSplitter({ root, mode, storage = globalThis.sessionStorage }) {
  const workspace = root.querySelector('.workspace');
  let splits = readSplits(storage);
  let drag = null;

  const handles = () => [...root.querySelectorAll('.panel-splitter')];
  const available = () => workspace?.getBoundingClientRect().width || 0;

  /**
   * Put the numbers on the element the stylesheet reads them from, and say
   * where the handles now are.
   *
   * `data-split` is for the tests and for anybody wondering why a column is
   * the width it is: the attribute says which screen's number this is.
   */
  function paint() {
    const current = mode() || null;
    const { left, right } = resolveSplit(current, splits, { available: available() });
    root.style.setProperty('--panel-left', `${left}px`);
    root.style.setProperty('--panel-right', `${right}px`);
    root.dataset.splitLeft = String(left);
    root.dataset.splitRight = String(right);
    root.dataset.splitFor = current?.id || '';
    for (const handle of handles()) {
      const side = handle.dataset.splitter;
      const width = side === 'left' ? left : right;
      handle.style[side] = `${width}px`;
      handle.setAttribute('aria-valuenow', String(Math.round(width)));
      handle.setAttribute('aria-valuemin', String(COLUMN.min));
      handle.setAttribute('aria-valuemax', String(COLUMN.max));
    }
  }

  /** Remember one side's width for the screen that is open, and repaint. */
  function set(side, width) {
    const current = mode();
    if (!current?.id) return;
    const other = side === 'left' ? Number(root.dataset.splitRight) : Number(root.dataset.splitLeft);
    const next = clampColumn(width, { other, available: available() });
    splits = { ...splits, [current.id]: { ...(splits[current.id] || {}), [side]: next } };
    writeSplits(splits, storage);
    paint();
  }

  /** Back to what the screen asked for: the override is forgotten, not zeroed. */
  function reset(side) {
    const current = mode();
    if (!current?.id || !splits[current.id]) return paint();
    const kept = { ...splits[current.id] };
    delete kept[side];
    splits = { ...splits, [current.id]: kept };
    if (!Object.keys(kept).length) { splits = { ...splits }; delete splits[current.id]; }
    writeSplits(splits, storage);
    paint();
  }

  root.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest?.('.panel-splitter');
    if (!handle || event.button !== 0) return;
    const side = handle.dataset.splitter;
    drag = { side, from: event.clientX, width: Number(root.dataset[side === 'left' ? 'splitLeft' : 'splitRight']) || splitForMode(mode())[side] };
    handle.setPointerCapture?.(event.pointerId);
    handle.dataset.splitterDragging = 'true';
    // A drag over the canvas must not also draw on it, and text must not
    // select while the pointer travels.
    root.classList.add('splitting');
    event.preventDefault();
  });

  root.addEventListener('pointermove', (event) => {
    if (!drag) return;
    // The right column grows as the pointer goes *left*, which is the one sign
    // to get right and the reason this is not a shared expression.
    const travel = event.clientX - drag.from;
    set(drag.side, drag.width + (drag.side === 'left' ? travel : -travel));
    event.preventDefault();
  });

  const end = (event) => {
    if (!drag) return;
    root.querySelector(`[data-splitter="${drag.side}"]`)?.removeAttribute('data-splitter-dragging');
    root.querySelector(`[data-splitter="${drag.side}"]`)?.releasePointerCapture?.(event?.pointerId);
    root.classList.remove('splitting');
    drag = null;
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  root.addEventListener('dblclick', (event) => {
    const handle = event.target.closest?.('.panel-splitter');
    if (!handle) return;
    reset(handle.dataset.splitter);
    event.preventDefault();
  });

  root.addEventListener('keydown', (event) => {
    const handle = event.target.closest?.('.panel-splitter');
    if (!handle) return;
    const side = handle.dataset.splitter;
    const width = Number(root.dataset[side === 'left' ? 'splitLeft' : 'splitRight']) || 0;
    // Left and right mean *narrower* and *wider* rather than a direction on
    // screen, because on the right-hand handle those are opposites.
    const grow = side === 'left' ? 1 : -1;
    const move = { ArrowLeft: -STEP * grow, ArrowRight: STEP * grow, PageUp: PAGE, PageDown: -PAGE }[event.key];
    if (move !== undefined) { set(side, width + move); event.preventDefault(); return; }
    if (event.key === 'Home') { reset(side); event.preventDefault(); }
  });

  // A window that narrows takes the columns with it: the clamp keeps a canvas
  // to draw on, so the split has to be recomputed rather than left as it was.
  const onResize = () => paint();
  globalThis.addEventListener?.('resize', onResize);

  paint();
  return { paint, reset, destroy() { globalThis.removeEventListener?.('resize', onResize); } };
}
