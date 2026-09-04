/**
 * Two small things every panel that rebuilds itself needs.
 *
 * The studios and inspectors render by replacing `innerHTML` whenever the
 * document or the selection changes. That is cheap and predictable, and it has
 * exactly two costs, both of which the author feels:
 *
 * 1. **A `<details>` loses its `open` state**, because the element the author
 *    opened no longer exists. Selecting a preset inside a group closed the
 *    group; ticking "Enabled" inside Advanced closed Advanced.
 * 2. **The panel scrolls**, because all the studios share one scrolling column
 *    and a shorter list makes the browser clamp `scrollTop`.
 *
 * `rememberOpen` fixes the first, `setPanelHtml` the second. Both are the thin
 * DOM layer: no model, no storage, one listener per host.
 */

/**
 * Remember which disclosures the author opened, across rebuilds.
 *
 * Mark each one with the attribute (default `data-keep-open="<id>"`) and ask
 * for its `attr(id)` when rendering. Until the author touches one, the
 * caller's own default wins, so a panel still opens the section it wants to
 * open the first time.
 *
 * `toggle` does not bubble, hence the capture-phase listener on the host.
 *
 * @param {HTMLElement} host the element whose innerHTML is replaced
 * @param {{attribute?: string}} [options]
 */
export function rememberOpen(host, { attribute = 'data-keep-open' } = {}) {
  let opened = null;
  const idOf = (node) => node?.getAttribute?.(attribute) ?? null;
  host?.addEventListener?.('toggle', (event) => {
    const id = idOf(event.target);
    if (id === null) return;
    // Seed from what is on screen, so the first toggle does not also close
    // everything the panel had opened by default.
    opened ||= new Set([...(host.querySelectorAll?.(`[${attribute}][open]`) || [])].map(idOf).filter((item) => item !== null));
    if (event.target.open) opened.add(id); else opened.delete(id);
  }, true);
  return {
    /** Whether that section should be rendered open. */
    has: (id, fallback = false) => (opened ? opened.has(id) : Boolean(fallback)),
    /** ` open` or '', to drop straight into the tag. */
    attr(id, fallback = false) { return this.has(id, fallback) ? ' open' : ''; }
  };
}

/**
 * Rewrite a panel without moving the view.
 *
 * Reading `scrollTop` before the write and putting it back after costs one
 * layout read per render, which is what the panels already pay to render at
 * all.
 */
export function setPanelHtml(host, html) {
  const scroller = host?.closest?.('.panel, .panel-right') || null;
  const top = scroller?.scrollTop || 0;
  host.innerHTML = html;
  if (scroller && top) scroller.scrollTop = top;
}
