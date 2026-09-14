# The stylesheet, on its way out of `index.html`

`project/editor/index.html` is 653 lines, and about ten of them are markup. The
rest is **107 KB of CSS in thirty-five inline `<style>` blocks**, twenty-two of
which sit *after* `</html>` — appended one release at a time, each one the
cheapest place to put the rules a new panel needed.

What that costs, measured:

```text
247   distinct hex values in the file
 11   --ux-* tokens they could have come from
 35   <style> blocks, 22 of them after </html>
 33   uses of #79adff, the selection blue, written out by hand every time
```

So "the same blue" is fourteen blues, a change to the panel background is a
find-and-replace, and nobody can read the cascade well enough to know whether a
rule is still doing anything.

## The migration

One directory, one file per region, and a token layer under all of it.

| File | What it owns | State |
| --- | --- | --- |
| `tokens.css` | the palette, spacing, radii, lift, type, motion | **in place** |
| `gestures.css` | the selection action bar and the actionable toast | **in place** |
| `shell.css` | topbar, navigation, columns, dock | to do |
| `panels.css` | the left column's panels and the inspector | to do |
| `canvas.css` | the canvas, its bars, the overlays | to do |
| `overlays.css` | Home, popovers, dialogs, sheets | to do |

Two rules keep it safe:

1. **The token link goes first in `<head>`.** Everything the inline blocks
   declare still wins, so adding a token can never change a pixel by itself.
   A block is migrated by deleting it and re-expressing its rules here — never
   by both existing at once.
2. **New components are written here from the start**, with selectors nothing
   else declares. `gestures.css` is the first; it cannot collide whatever order
   the browser resolves.

## Using the tokens

Reach for the name, not the value. If no token fits, the honest options are to
use the nearest one or to add a token — never to write a new hex.

```css
/* no */
.thing { background: #101a2d; border: 1px solid #40506b; border-radius: 10px; }

/* yes */
.thing { background: var(--ux-raised); border: 1px solid var(--ux-border-popover); border-radius: var(--ux-radius-3); }
```

The accent and the meaning colours are separate sets on purpose: a state is not
a button. `--ux-warn` never becomes a primary action, and `--ux-accent` never
means "careful".

## Visual snapshots

`tests/e2e/ux22-visual.spec.js` holds baseline screenshots in
`ux22-visual.spec.js-snapshots/`. Any block migrated out of `index.html` must
come with a regenerated set **in the same commit**, so a review can see that the
only thing that changed is the one thing that was meant to:

```bash
npx playwright test --project=chromium --grep @visual --update-snapshots
```
