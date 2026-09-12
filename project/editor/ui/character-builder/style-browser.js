/**
 * What look the face is drawn in, in Design ▸ Face (MASC-06, MASC-08A).
 *
 * ```text
 * [ Soft Cartoon ]   Current
 * [ Flat         ]   7 of 9 library parts can be redrawn
 * [ Retro        ]   nothing on this face is drawn this way yet
 * ```
 *
 * Unlike Type, this row **acts**: pressing a style redraws the face in it, as
 * one undo step. So each card says beforehand how much of the face it can
 * actually redraw, and the row says afterwards how much it did — "7 parts
 * restyled, 2 already in this style."
 *
 * A style is a wish, and the library grants as much of it as somebody has
 * drawn: a part whose restyle does not exist **stays exactly as it is**. It is
 * never taken off, and never quietly swapped for something else.
 *
 * The four states a card can be in are the point of MASC-08A. *Current* and
 * *Unavailable* look alike from the outside — neither redraws anything — and
 * they mean opposite things. A face entirely in Soft Cartoon told "nothing on
 * this face is drawn this way yet" is being told the opposite of the truth, so
 * the card that has nothing to do because it is already done says so.
 */
import { esc } from '../escape-html.js';

/**
 * @param {{ id, label, description, base?, restyled: number, already: number, kept: number, total: number }} style
 * @returns {'current'|'available'|'partial'|'unavailable'}
 */
export function faceStyleState(style) {
  if (!style?.total) return 'unavailable';
  if (style.already === style.total) return 'current';
  if (!style.restyled) return 'unavailable';
  return style.kept ? 'partial' : 'available';
}

const NOTE = {
  // The base style is where a face *returns* to: the drawings are already
  // there, under the ids every variant points at.
  current: (style) => (style.total === 1 ? 'The one library part on this face is in this style' : 'Current'),
  available: (style) => `${style.restyled} ${style.base ? `part${style.restyled === 1 ? '' : 's'} can return to this style` : `of ${style.total} library part${style.total === 1 ? '' : 's'} can be redrawn`}`,
  partial: (style) => `${style.restyled} of ${style.total} library part${style.total === 1 ? '' : 's'} can be redrawn, ${style.kept} stay${style.kept === 1 ? 's' : ''} as ${style.kept === 1 ? 'it is' : 'they are'}`,
  unavailable: (style) => (style.total ? 'Nothing on this face is drawn this way yet' : 'Nothing on this face comes from the library yet')
};

const TITLE = {
  current: (style) => `${style.label}: every library part on this face is already drawn this way.`,
  available: (style) => `${style.label}: redraws ${style.restyled} of the ${style.total} part${style.total === 1 ? '' : 's'} this face wears from the library. One undo step.`,
  partial: (style) => `${style.label}: redraws ${style.restyled} of the ${style.total} part${style.total === 1 ? '' : 's'} this face wears from the library; the other ${style.kept} stay exactly as they are. One undo step.`,
  unavailable: (style) => `${style.label}: ${style.description || 'nothing on this face is drawn this way yet.'}`
};

/**
 * @param {{ styles?: object[], loaded?: boolean, notice?: string }} view
 */
export function styleBrowserMarkup(view = {}) {
  const styles = view.styles || [];
  if (!view.loaded) return '<p class="small">Start from a face before choosing a style.</p>';
  if (!styles.length) return '<p class="small">No styles yet. A style is a set of drawings that restyle the library’s own; a face pack can bring one.</p>';
  const cards = styles.map((style) => {
    const state = faceStyleState(style);
    // *Current* is disabled because there is nothing for it to do, not because
    // it cannot be done — and the badge is what says which of the two it is.
    const pressable = state === 'available' || state === 'partial';
    return `<button type="button" class="face-style${state === 'current' ? ' face-style-current' : ''}" data-face-style="${esc(style.id)}" data-style-state="${state}" aria-pressed="${state === 'current'}"${pressable ? '' : ' disabled'} title="${esc(TITLE[state](style))}">
      <span class="face-style-name">${esc(style.label)}</span>
      <small class="face-style-note">${esc(NOTE[state](style))}</small>
      ${state === 'current' ? '<small class="part-style-badge">Current</small>' : ''}</button>`;
  }).join('');
  return `<div class="face-styles" role="group" aria-label="Face styles">${cards}</div>
    ${view.notice ? `<p class="face-pick-notice" data-tone="info" data-style-notice>${esc(view.notice)}</p>` : ''}
    <p class="small">A style redraws the parts somebody has drawn in it, and leaves the rest exactly as they are — one undo step, and it always says which is which.</p>`;
}
