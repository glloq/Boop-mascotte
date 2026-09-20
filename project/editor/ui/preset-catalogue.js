// Shared markup for the three preset catalogues (Expressions, Motions,
// Reactions) and for the Starter kit that fills all of them at once.
//
// The catalogues grew: twenty-six faces and twenty motions do not fit one list,
// so the groups are a strip and one group's cards show. The cards themselves
// stay exactly as each studio renders them.
import { starterKitSummary } from '../core/starter/starter-kit.js';
import { esc } from './escape-html.js';

/**
 * A strip of groups, and the cards of the one that is showing (UX-60 PR 5).
 *
 * These were a stack of `<details>`, one per group, the first open. Which
 * meant the way to see what a catalogue held was to open every group and
 * scroll — and measured at 1440x900, that is what the three studios cost:
 *
 * ```text
 *   column scroll hidden below its own bottom
 *   Animate ▸ Expressions   1961 px      12 controls visible
 *   Animate ▸ Motions       1921 px      25 controls visible
 *   Behavior ▸ Reactions    1968 px      11 controls visible
 * ```
 *
 * §37 of the brief is explicit that the answer to a crowded column is not
 * another accordion. So the groups are a strip — every one of them named,
 * with how many of its presets this mascot can use — and one group's cards
 * show. The same shape as the capability bar above it and the band strip in
 * the Control Deck, which is the point: one way to choose what you are
 * looking at, at every level of the screen.
 *
 * The cards themselves are untouched; each studio still renders its own.
 *
 * @param {{group: string, presets: object[]}[]} groups
 * @param {(preset: object) => string} card   the studio's own card markup
 * @param {{className: string, open?: number, isOpen?: (group: string, index: number) => boolean}} options
 *        which group starts open (default: the first), or a predicate when the
 *        caller remembers which one the author picked
 */
export function presetGroupsMarkup(groups, card, { className, open = 0, isOpen = null, strip: withStrip = true, only = null } = {}) {
  const list = (groups || []).filter((entry) => entry?.presets?.length);
  if (!list.length) return '';
  // `only` is a caller that has a strip of its own: Behavior ▸ Reactions is
  // organised by *when* from top to bottom, and two strips a page apart
  // reading the same five words is worse than one (UX-60 PR 7).
  const forced = only === null ? -1 : list.findIndex((entry) => entry.group === only);
  const picked = forced >= 0 ? forced : list.findIndex((entry, index) => (isOpen ? isOpen(entry.group, index) : index === open));
  const active = picked >= 0 ? picked : Math.min(open, list.length - 1);
  const count = (entry) => entry.presets.filter((preset) => preset.usable).length;
  const chips = withStrip ? list.map((entry, index) => {
    const usable = count(entry), on = index === active;
    return `<button type="button" class="preset-chip${on ? ' chip-active' : ''}" data-preset-group-pick="${esc(entry.group)}" aria-pressed="${on}" title="${esc(entry.group)}: ${usable === entry.presets.length ? `${entry.presets.length} ready` : `${usable} of ${entry.presets.length} ready to use`}"><b>${esc(entry.group)}</b><small>${usable === entry.presets.length ? entry.presets.length : `${usable}/${entry.presets.length}`}</small></button>`;
  }).join('') : '';
  // Every group's cards stay in the markup, and the ones not chosen are
  // `hidden`: a spec, a deep link or a search that reaches into a card it can
  // still find it, exactly as it could inside a shut `<details>`.
  const panes = list.map((entry, index) => `<div class="${className} preset-group" data-preset-group="${esc(entry.group)}" data-preset-group-usable="${count(entry)}"${index === active || list.length === 1 ? '' : ' hidden'}>
      <div class="preset-cards">${entry.presets.map(card).join('')}</div>
    </div>`).join('');
  return `${chips ? `<div class="preset-groups" role="group" aria-label="Preset groups">${chips}</div>` : ''}${panes}`;
}

/**
 * The same markup, remembering which group the author picked.
 *
 * A studio rebuilds its list by `innerHTML` on every edit, which destroys the
 * strip and the panes with it: adding a preset from the group you were looking
 * at snapped the panel back to the first one. The pick is session state, on
 * this host, and never reaches the document.
 *
 * The press is handled here rather than by each studio, because the strip is
 * this module's and a studio that had to re-render to change which cards show
 * would be three copies of one line.
 *
 * @param {HTMLElement} host the element whose innerHTML the studio rewrites
 * @returns {(groups, card, options) => string} a drop-in `presetGroupsMarkup`
 */
export function createPresetGroups(host, { open = 0 } = {}) {
  let picked = null;
  host?.addEventListener?.('click', (event) => {
    // No `contains` check: the listener is on the host, so anything that
    // reaches it is inside it -- and the studios pass a lifecycle wrapper that
    // exposes `addEventListener` and `querySelectorAll` and nothing else.
    const chip = event.target.closest?.('[data-preset-group-pick]');
    if (!chip) return;
    picked = chip.dataset.presetGroupPick;
    // In place: the cards are already rendered, so showing another group is a
    // `hidden` flag and an `aria-pressed`, not a rebuild of every card in the
    // catalogue.
    const strip = chip.closest('.preset-groups');
    for (const button of strip?.querySelectorAll('[data-preset-group-pick]') || []) {
      const on = button === chip;
      button.classList.toggle('chip-active', on);
      button.setAttribute('aria-pressed', String(on));
    }
    for (const pane of strip?.parentElement?.querySelectorAll('[data-preset-group]') || []) {
      pane.hidden = pane.dataset.presetGroup !== picked;
    }
  });
  return (groups, card, options = {}) => presetGroupsMarkup(groups, card, {
    open, ...options,
    isOpen: (group, index) => (picked === null ? index === open : group === picked)
  });
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
