/**
 * What look the face is drawn in, in the header of Design ▸ Face (MASC-06,
 * MASC-08A).
 *
 * ```text
 * Look [ Soft Cartoon ▾ ]    Flat — 7 of 9 · Retro — nothing drawn this way yet
 * ```
 *
 * Unlike the kind, this one **acts**: choosing a look redraws the face in it,
 * as one undo step. So each option says beforehand how much of the face it can
 * actually redraw, and the line under the control says afterwards how much it
 * did — "7 parts restyled, 2 already in this style."
 *
 * A style is a wish, and the library grants as much of it as somebody has
 * drawn: a part whose restyle does not exist **stays exactly as it is**. It is
 * never taken off, and never quietly swapped for something else.
 *
 * The four states are the point of MASC-08A. *Current* and *Unavailable* look
 * alike from the outside — neither redraws anything — and they mean opposite
 * things. A face entirely in Soft Cartoon told "nothing on this face is drawn
 * this way yet" is being told the opposite of the truth, so the option that has
 * nothing to do *because it is already done* says so.
 *
 * It was a row before, third in a list of the parts of a face, and it is not a
 * part of one: it is a reading of the whole (the audit's §1.4).
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
  current: () => 'on this face now',
  available: (style) => `${style.restyled} ${style.base ? `part${style.restyled === 1 ? '' : 's'} can return to this style` : `of ${style.total} library part${style.total === 1 ? '' : 's'} can be redrawn`}`,
  partial: (style) => `${style.restyled} of ${style.total} can be redrawn, ${style.kept} stay${style.kept === 1 ? 's' : ''} as ${style.kept === 1 ? 'it is' : 'they are'}`,
  unavailable: (style) => (style.total ? 'nothing on this face is drawn this way yet' : 'nothing on this face comes from the library yet')
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
export function styleSelectMarkup(view = {}) {
  const styles = view.styles || [];
  if (!view.loaded || !styles.length) return '';
  const options = styles.map((style) => {
    const state = faceStyleState(style);
    // *Current* is not disabled because it cannot be done — it is the selected
    // option, which is what "already done" looks like in a `<select>`. Only
    // *unavailable* is disabled, and the note is what says which is which.
    return `<option value="${esc(style.id)}"${state === 'current' ? ' selected' : ''}${state === 'unavailable' ? ' disabled' : ''} data-style-state="${state}" title="${esc(TITLE[state](style))}">${esc(style.label)} — ${esc(NOTE[state](style))}</option>`;
  }).join('');
  return `<label class="face-setting" data-face-setting="style"><span>Look</span>
    <select data-face-style aria-label="What look the face is drawn in" title="Redraws the parts somebody has drawn in this look, and leaves the rest exactly as they are. One undo step.">${options}</select>
  </label>${view.notice ? `<p class="face-pick-notice" data-tone="info" data-style-notice>${esc(view.notice)}</p>` : ''}`;
}
