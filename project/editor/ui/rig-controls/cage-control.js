/**
 * The cage `▭` — a group of controls (docs/FACE_CONTROL_RIG.md, CR-03, CR-04).
 *
 * A cage is the only widget here that drives nothing. It is a frame drawn
 * around the controls that belong to one part of the face, with a name, a
 * summary of what is inside it, a Simple/Detailed switch, and the links that
 * decide whether its two sides move together.
 *
 * ```text
 * ╭──── EYES ──────────────── open / close -0.7 ── + ─╮
 * │   ●          ◆                                    │
 * │   🔗 Eyelids   🔗 Eye targets   🔗 Pupil size      │
 * ╰───────────────────────────────────────────────────╯
 * ```
 *
 * Presentation only: opening a cage changes what is on screen and nothing
 * about the rig (`core/puppet/control-groups.js`).
 */
import { esc } from './control-geometry.js';

/**
 * The link chips along the bottom of a cage (CR-10).
 *
 * A link is a rule about manipulation — *drag one eyelid, both move* — so it
 * belongs on the frame that holds both of them rather than on either control.
 */
export function renderLinkChips(group) {
  if (!group.links?.length) return '';
  return `<div class="cage-links" role="group" aria-label="What moves together in ${esc(group.label)}">${group.links.map((link) => `
    <button type="button" class="chip${link.linked ? ' chip-active' : ''}" data-rig-link="${esc(link.id)}" aria-pressed="${link.linked}"
      title="${link.linked ? 'Moving together: dragging one side moves both.' : 'Moving apart: each side moves on its own.'}">${link.linked ? '🔗' : '⛓'} ${esc(link.label)}</button>`).join('')}</div>`;
}

/**
 * @param {object} group one entry from `rigControlGroups`
 * @param {{summary?:string, collapsed?:boolean, body?:string, detail?:string}} options
 */
export function renderCage(group, { summary = '', collapsed = true, body = '', detail = '' } = {}) {
  const id = esc(group.id);
  return `<section class="rig-cage" data-rig-cage="${id}" data-rig-detail="${collapsed ? 'simple' : 'detailed'}">
    <header class="cage-head">
      <b>${esc(group.label)}</b>
      <small class="cage-summary">${esc(summary)}</small>
      ${group.detail?.length ? `<button type="button" class="secondary cage-toggle" data-rig-expand="${id}" aria-expanded="${!collapsed}"
        aria-label="${collapsed ? 'Show every control' : 'Show the common controls only'} for ${esc(group.label)}">${collapsed ? '+' : '−'}</button>` : ''}
    </header>
    <p class="small cage-hint">${esc(group.hint || '')}</p>
    <div class="cage-body">${body}</div>
    ${collapsed ? '' : `<div class="cage-detail">${detail}</div>`}
    ${renderLinkChips(group)}
  </section>`;
}
