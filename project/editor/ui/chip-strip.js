/**
 * A strip of chips, and the one pane that answers to it (UX-60 PR 7).
 *
 * This redesign says the same thing at five levels of the same screen — the
 * capabilities of a screen, the bands of the Control Deck, the groups of a
 * preset catalogue, the movement groups of a state's pose, the sections of
 * Preview — and each of those is a panel that re-renders, so each owns its own
 * copy of the flip.
 *
 * This is the sixth, for markup the shell writes **once**: a strip declared in
 * HTML, with no render to hang the state on. `data-strip-pick="<group>:<id>"`
 * on a chip, `data-strip-pane="<group>:<id>"` on what it shows, and the rest is
 * a `hidden` flag.
 *
 * Which chip is pressed is where the author is standing: session state, on the
 * DOM, never in the document (§ invariants).
 */

/**
 * Bind every strip inside `root`, now and for as long as it lives.
 *
 * One delegated listener, so a strip that is re-rendered or added later keeps
 * working without being rebound.
 *
 * @param {HTMLElement} root
 * @returns {() => void} unbind
 */
export function wireChipStrip(root) {
  if (!root) return () => {};
  const onClick = (event) => {
    const chip = event.target.closest?.('[data-strip-pick]');
    if (!chip || !root.contains(chip)) return;
    const wanted = chip.dataset.stripPick, [group] = wanted.split(':');
    const strip = chip.closest('[data-strip]') || chip.parentElement;
    for (const button of strip.querySelectorAll('[data-strip-pick]')) {
      const on = button === chip;
      button.classList.toggle('chip-active', on);
      button.setAttribute('aria-pressed', String(on));
    }
    // The panes are the strip's siblings, which is what lets a strip sit above
    // blocks that were already in the markup rather than wrapping them.
    for (const pane of (strip.parentElement || root).querySelectorAll(`[data-strip-pane^="${CSS.escape(group)}:"]`)) {
      pane.hidden = pane.dataset.stripPane !== wanted;
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
