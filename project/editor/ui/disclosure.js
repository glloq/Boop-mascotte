/**
 * Basic → More → Advanced, for one inspector (VNX-12).
 *
 * Every panel in this editor grew the same way: a new capability arrived, it
 * needed three settings, the three settings went at the bottom, and the panel
 * became a wall of controls with no reading order. The fix is not to hide
 * things — every control stays one click away — it is to say which of them the
 * author is meant to look at **first**.
 *
 * ```text
 * Right hand
 * Position      [pad XY]      ← basic: no summary, nothing to click
 * Pose          [chips]
 * ▸ Fingers                   ← more: a detail, opened when wanted
 * ▸ Motion
 * ▸ Advanced                  ← advanced: names parameters and amplitudes
 * ```
 *
 * That is the whole idea, so this is the whole module: markup for one section
 * and a way to lay a few of them out in tier order. It is not a component and
 * owns no state — an opened section is remembered by `rememberOpen`, through
 * the `data-keep-open` attribute written below, and the panel decides which
 * tier a control belongs to because only the panel knows.
 */

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** The three tiers, in the order an inspector reads. */
export const DISCLOSURE_LEVELS = Object.freeze(['basic', 'more', 'advanced']);

/**
 * One tier of one inspector.
 *
 * `basic` deliberately renders **no** `<details>`: a section the author has to
 * open before seeing anything is not the first thing they see. `more` and
 * `advanced` are collapsed `<details>` carrying `data-keep-open="<id>"`, which
 * is what `rememberOpen` reads, so opening one survives the panel rebuilding
 * itself on the next store change.
 *
 * A section with an empty body renders nothing at all: a hand with no digits
 * rigged should not be offered an empty *Fingers*.
 *
 * @param {object} section
 * @param {string} section.id     unique within the host; the keep-open key
 * @param {string} [section.title] heading (`basic`) or summary (`more`/`advanced`)
 * @param {'basic'|'more'|'advanced'} [section.level]
 * @param {boolean} [section.open] usually `rememberOpen(...).has(id, default)`
 * @param {string} [section.hint] a word or two in the summary, so a closed
 *        section still says what is inside
 * @param {string} [section.body] markup
 * @returns {string} markup
 */
export function disclosureSection({ id = '', title = '', level = 'basic', open = false, hint = '', body = '' } = {}) {
  if (!DISCLOSURE_LEVELS.includes(level)) throw new Error(`Unknown disclosure level: ${level}`);
  const content = String(body ?? '');
  if (!content.trim()) return '';
  const marks = `data-disclosure="${esc(id)}" data-disclosure-level="${level}"`;
  if (level === 'basic') {
    return `<div class="disclosure-basic" ${marks}>${title ? `<h5 class="small">${esc(title)}</h5>` : ''}${content}</div>`;
  }
  return `<details class="disclosure disclosure-${level}" ${marks} data-keep-open="${esc(id)}"${open ? ' open' : ''}>
      <summary>${esc(title || id)}${hint ? ` <span class="small">${esc(hint)}</span>` : ''}</summary>${content}</details>`;
}

/**
 * A few sections, in tier order whatever order they were declared in.
 *
 * The point of sorting rather than trusting the caller: a panel lists its
 * sections in the order it computes them, and the reading order is a property
 * of the tiers, not of the code. Within a tier the declared order stands.
 *
 * @param {object[]} sections descriptors for {@link disclosureSection}
 * @returns {string} markup
 */
export function disclosurePanel(sections = []) {
  const rank = (section) => DISCLOSURE_LEVELS.indexOf(section?.level ?? 'basic');
  return [...sections].filter(Boolean).sort((a, b) => rank(a) - rank(b))
    .map((section) => disclosureSection(section)).join('');
}
