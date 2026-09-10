/**
 * The arrow keys in the Character Builder (docs/CHARACTER_BUILDER.md,
 * "Keyboard and small screens"; roadmap phase 50).
 *
 * A row of cards, a row of chips, the colour rows and the category rows are
 * each a ring: Right and Down go to the next button, Left and Up to the
 * previous, wrapping; Home and End to the ends. Tab still reaches every
 * button as it did -- nothing is taken out of the tab order -- so this is
 * the faster way through a row, never the only one. Keys with a modifier,
 * keys in a field, and every other key are left to the browser.
 */

/**
 * Where a key goes in a ring of `count` buttons from `index`; null when the
 * key is not one of the ring's, or the button is not in the ring.
 *
 * @param {number} count
 * @param {number} index
 * @param {string} key  `event.key`
 * @returns {number|null}
 */
export function ringTarget(count, index, key) {
  if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(index) || index < 0 || index >= count) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * The ring a button belongs to: the nearest group or list around it. In the
 * parts list itself (the categories' `role="list"`), the ring is the
 * category rows only, not the buttons of the open category's body.
 *
 * @returns {{ buttons: Element[], index: number } | null}
 */
export function ringOf(button) {
  const ring = button?.closest?.('[role="group"],[role="list"]');
  if (!ring) return null;
  const selector = ring.classList?.contains?.('part-browser') ? '.part-category-button:not([disabled])' : 'button:not([disabled])';
  const buttons = Array.from(ring.querySelectorAll?.(selector) || []);
  const index = buttons.indexOf(button);
  return index < 0 ? null : { buttons, index };
}

/**
 * A `keydown` listener for a panel host: moves the focus along the ring and
 * says so; false when the key was left alone.
 */
export function walkRing(event) {
  if (!event || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const button = event.target?.closest?.('button');
  if (!button) return false;
  const ring = ringOf(button);
  if (!ring) return false;
  const target = ringTarget(ring.buttons.length, ring.index, event.key);
  if (target === null) return false;
  event.preventDefault?.();
  ring.buttons[target]?.focus?.();
  return true;
}
