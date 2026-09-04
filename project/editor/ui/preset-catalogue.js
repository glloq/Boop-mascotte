// Shared markup for the three preset catalogues (Expressions, Motions,
// Reactions) and for the Starter kit that fills all of them at once.
//
// The catalogues grew: twenty-six faces and twenty motions do not fit a 300 px
// panel as one list, so they are shown a group at a time with the first group
// open. The cards themselves stay exactly as each studio renders them.
import { starterKitSummary } from '../core/starter/starter-kit.js';
import { rememberOpen } from './panel-render.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/**
 * One `<details>` per group, in catalogue order.
 *
 * @param {{group: string, presets: object[]}[]} groups
 * @param {(preset: object) => string} card   the studio's own card markup
 * @param {{className: string, open?: number, isOpen?: (group: string, index: number) => boolean}} options
 *        which group starts open (default: the first), or a predicate when the
 *        caller remembers what the author opened
 */
export function presetGroupsMarkup(groups, card, { className, open = 0, isOpen = null } = {}) {
  return groups.map((entry, index) => {
    const usable = entry.presets.filter((preset) => preset.usable).length;
    const shown = isOpen ? isOpen(entry.group, index) : index === open;
    return `<details class="${className} preset-group" data-preset-group="${esc(entry.group)}" data-preset-group-usable="${usable}" ${shown ? 'open' : ''}>
      <summary>${esc(entry.group)}<small>${usable === entry.presets.length ? entry.presets.length : `${usable} of ${entry.presets.length}`}</small></summary>
      <div class="preset-cards">${entry.presets.map(card).join('')}</div>
    </details>`;
  }).join('');
}

/**
 * The same markup, remembering which groups the author opened.
 *
 * A studio rebuilds its list by `innerHTML` on every edit, which destroys the
 * `<details>` elements and takes their `open` state with them: adding a preset
 * from the group you opened snapped the panel back to "first group open".
 *
 * @param {HTMLElement} host the element whose innerHTML the studio rewrites
 * @returns {(groups, card, options) => string} a drop-in `presetGroupsMarkup`
 */
export function createPresetGroups(host, { open = 0 } = {}) {
  const remembered = rememberOpen(host, { attribute: 'data-preset-group' });
  return (groups, card, options = {}) => presetGroupsMarkup(groups, card, { open, ...options, isOpen: (group, index) => remembered.has(group, index === open) });
}

/**
 * The Starter kit card: everything a mascot needs in one press, or nothing at
 * all once the kit is in. It is the same offer in all three studios, so an
 * author meets it wherever they land first.
 */
export function starterKitMarkup(plan) {
  if (!plan || !plan.added) return '';
  const skipped = plan.entries.filter((item) => item.action === 'skip');
  return `<article class="preset-card starter-kit" data-starter-kit data-starter-kit-add-count="${plan.added}">
    <div><b>Starter kit</b><small>One press: ${esc(starterKitSummary(plan))}, ready to use and easy to change.</small>${skipped.length ? `<small class="preset-missing">${skipped.length} item${skipped.length === 1 ? '' : 's'} need movements that are off (${esc(skipped.map((item) => item.name).join(', '))}).</small>` : ''}</div>
    <button type="button" data-starter-kit-add aria-label="Add the starter kit">Add all</button>
  </article>`;
}

/** The one-line result of pressing it, for the studio's notice. */
export const starterKitNotice = (report) => ({
  tone: report.added ? 'success' : 'warn',
  text: report.added
    ? `✓ Starter kit added: ${starterKitSummary(report)}.${report.skipped ? ` ${report.skipped} item${report.skipped === 1 ? '' : 's'} were skipped: turn their movements on in Face Setup.` : ''} Undo removes all of it.`
    : 'Nothing to add: the starter kit is already in this project.'
});
