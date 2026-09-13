/**
 * The six things to do to the piece in hand, on the piece in hand.
 *
 * ```text
 *        ┌ ─ ─ ─ ─ ─ ─ ─ ┐
 *        │   selection   │
 *        └ ─ ─ ─ ─ ─ ─ ─ ┘
 *          ⧉  ⇄  ⇋  ↑  ↓  🗑
 * ```
 *
 * Every one of these actions existed; all six lived in a right-click menu that
 * two screens out of six offered, or in an inspector column three hundred
 * pixels to the right. Nobody guesses `Ctrl+D`, and a beginner does not
 * right-click a cartoon face to see what happens. So the actions come to the
 * canvas, where the attention already is — and because they are the *same six*
 * `ui/piece-actions.js` puts in the menu and the inspector, learning one place
 * teaches the other two.
 *
 * Six is a decision. A seventh button is one more thing to read every time
 * anything is selected, and the full catalogue is one keystroke away in the
 * menu. What is on the bar is in `BAR_ACTIONS`, not here.
 *
 * Thin DOM layer: it is told where the selection is and which actions apply,
 * and it reports presses. It reads no document and owns no state beyond its own
 * placement.
 */
import { BAR_ACTIONS } from './piece-actions.js';
import { esc } from './escape-html.js';

/** Clear of the gizmo's own corner handles, which sit on the box's edge. */
const CLEARANCE = 16;
/** Enough of the bar visible to be worth flipping for. */
const MARGIN = 8;

/**
 * @param {HTMLElement} host the canvas container, which is `position:relative`
 * @param {{ onAction?: (id: string) => void }} [options]
 */
export function createSelectionActions(host, { onAction = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: the canvas container');
  const node = host.ownerDocument.createElement('div');
  node.className = 'selection-actions';
  node.dataset.selectionActions = '';
  node.setAttribute('role', 'toolbar');
  node.setAttribute('aria-label', 'Actions on the selected piece');
  node.hidden = true;
  host.append(node);

  let signature = '';

  node.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-piece-action]');
    if (!button || button.disabled) return;
    // The press must not also reach the canvas underneath and reselect
    // whatever is behind the bar.
    event.stopPropagation();
    onAction(button.dataset.pieceAction);
  });
  // Nor may a press *start* on the bar and be read as the beginning of a drag
  // on the artwork below it: the gizmo listens on the container.
  node.addEventListener('pointerdown', (event) => event.stopPropagation());

  /** Draw the buttons, and only when the set of them has actually changed. */
  function renderButtons(allowed) {
    const offered = BAR_ACTIONS.filter((action) => allowed.has(action.id));
    const next = offered.map((action) => action.id).join(',');
    if (next === signature) return offered.length > 0;
    signature = next;
    node.innerHTML = offered.map((action) => {
      const title = action.hint ? `${action.label} — ${action.hint}` : action.label;
      const keys = action.keys ? ` (${action.keys})` : '';
      return `<button type="button" data-piece-action="${esc(action.id)}"${action.danger ? ' class="danger"' : ''} aria-label="${esc(action.label)}" title="${esc(title + keys)}"><span aria-hidden="true">${action.glyph}</span></button>`;
    }).join('');
    return offered.length > 0;
  }

  /**
   * Put the bar under the selection, in the container's own coordinates.
   *
   * Under, not over: over is where the rotation handle is, and a bar there
   * would cover the thing it acts on the moment the selection is near the top
   * of the canvas. If under would fall off the bottom it flips above, and if
   * the box is wider than the canvas it simply centres — the same rule
   * `ui/canvas-menu.js` follows, so the two never disagree about where the
   * edge of the canvas is.
   */
  function place(box) {
    const frame = host.getBoundingClientRect();
    const size = node.getBoundingClientRect();
    const centre = box.x - frame.left + box.width / 2;
    const below = box.y - frame.top + box.height + CLEARANCE;
    const above = box.y - frame.top - size.height - CLEARANCE;
    const y = below + size.height + MARGIN > frame.height && above > MARGIN ? above : below;
    const x = Math.max(MARGIN, Math.min(centre - size.width / 2, frame.width - size.width - MARGIN));
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(Math.max(MARGIN, Math.min(y, frame.height - size.height - MARGIN)))}px`;
  }

  return {
    node,
    /**
     * Show the bar for one piece.
     *
     * @param {{x, y, width, height}|null} box  the selection, in client coordinates
     * @param {string[]} actions  the ids that apply, from `pieceActionsFor`
     * @returns {boolean} whether anything is showing
     */
    show(box, actions = []) {
      if (!box || !actions.length) return this.hide();
      const any = renderButtons(new Set(actions));
      if (!any) return this.hide();
      node.hidden = false;
      place(box);
      return true;
    },
    hide() {
      if (node.hidden) return false;
      node.hidden = true;
      return false;
    },
    isOpen: () => !node.hidden,
    destroy() { node.remove(); }
  };
}
