/**
 * What look the face is drawn in, in Design ▸ Face (MASC-06).
 *
 * ```text
 * [ Soft Cartoon ]   7 of 9 parts can be redrawn
 * [ Woodcut      ]   nothing on this face is drawn this way yet
 * ```
 *
 * Unlike Type, this row **acts**: pressing a style redraws the face in it, as
 * one undo step. So each card says beforehand how much of the face it can
 * actually redraw, and the row says afterwards how much it did — "7 parts
 * restyled, 2 kept as they are."
 *
 * That second number is the one that matters. A style is a wish, and the
 * library grants as much of it as somebody has drawn: a part whose restyle
 * does not exist **stays exactly as it is**. It is never taken off, and never
 * quietly swapped for something else. An author who was not told which parts
 * stayed would read the difference as something lost, so the count is always
 * both halves and never just the good one.
 */
import { esc } from '../escape-html.js';

/**
 * @param {{ styles?: { id, label, description, restyled: number, total: number }[], loaded?: boolean, notice?: string }} view
 */
export function styleBrowserMarkup(view = {}) {
  const styles = view.styles || [];
  if (!view.loaded) return '<p class="small">Start from a face before choosing a style.</p>';
  if (!styles.length) return '<p class="small">No styles yet. A style is a set of drawings that restyle the library’s own; a face pack can bring one.</p>';
  const cards = styles.map((style) => {
    const can = style.restyled > 0;
    // "of the library parts" rather than "of the parts": a face drawn by hand,
    // or one straight from a template, wears pieces that came from no asset at
    // all, and a style has nothing to look those up by. Counting them in would
    // be promising a redraw that cannot happen.
    const count = can
      ? `${style.restyled} of ${style.total} library part${style.total === 1 ? '' : 's'} can be redrawn`
      : style.total ? 'Nothing on this face is drawn this way yet' : 'Nothing on this face comes from the library yet';
    const title = can
      ? `${style.label}: redraws ${style.restyled} of the ${style.total} part${style.total === 1 ? '' : 's'} this face wears from the library. The rest stay exactly as they are. One undo step.`
      : `${style.label}: ${style.description || 'nothing on this face is drawn this way yet.'}`;
    return `<button type="button" class="face-style" data-face-style="${esc(style.id)}"${can ? '' : ' disabled'} title="${esc(title)}">
      <span class="face-style-name">${esc(style.label)}</span>
      <small class="face-style-note">${esc(count)}</small></button>`;
  }).join('');
  return `<div class="face-styles" role="group" aria-label="Face styles">${cards}</div>
    ${view.notice ? `<p class="face-pick-notice" data-tone="info" data-style-notice>${esc(view.notice)}</p>` : ''}
    <p class="small">A style redraws the parts somebody has drawn in it, and leaves the rest exactly as they are — one undo step, and it always says which is which.</p>`;
}
