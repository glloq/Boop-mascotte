# How much of the window each screen gets

> Per-screen column widths, two draggable boundaries, and a canvas that keeps
> looking at the same thing when it changes size. Written after an author said
> the view took far too much room and the settings not enough — which was
> measurable, and worse on the two Design screens than anywhere else.

```text
  ┌──────────┬╢──────────────────────────╟┬──────────┐
  │  panels  │║          canvas          ║│ inspector│
  └──────────┴╢──────────────────────────╟┴──────────┘
               ↑                          ↑
        --panel-left               --panel-right
        draggable · per screen · session only
```

## What was measured

At 1440×900, before any of this:

| Screen | Panels | Canvas | Inspector | The problem |
| --- | --- | --- | --- | --- |
| Artwork | 300px | **830px (58%)** | 285px | the Inspector held **1341px of content in an 836px column** |
| Hands | 300px | **830px (58%)** | 285px | the canvas showed a face whose hands are *behind its head*; the Inspector was **empty**; the 8 states of each hand were 8 stacked 64px buttons, so a pair of hands was 16 rows of scrolling |

One `300px · 1fr · 310px` for every screen is a single compromise across
screens that want opposite things. Drawing wants the canvas. Choosing among a
library of drawings wants the list. A screen is the only thing that
knows which it is.

## The numbers live on the route

`MODES` in `ui/task-router.js` already carries what a screen mounts, which
sections it is the screen for and whether it is advanced. `layout: { left,
right }` joins them:

| Screen | left | right | Why |
| --- | --- | --- | --- |
| `design.artwork` | 300 | 340 | drawing keeps the canvas; the Inspector is the widest column in the editor |
| `design.hands` | 400 | 250 | the work is a list of drawings; the Inspector says nothing until a hand's own shape is selected |
| `rig.assign` | 360 | 330 | naming parts is panel work |
| `rig.controls` | 400 | 320 | movements, gaze, face states, the hands |
| `rig.deform` | 380 | 340 | pins, warps, holds |
| `rig.head2d` | 300 | 300 | nine poses of a face, judged by eye |
| `animate.expressions` | 340 | 320 | |

A screen that declares nothing gets `DEFAULT_SPLIT`, which is the one
compromise every screen used to get, so nothing moves under a screen that has
not asked to.

## They are preferences, not pixels

A pair of widths that is comfortable on a 1920px monitor **starves a 1280px
laptop**, and starving the canvas is not cosmetic: the rig draws handles *on*
it, and a hand's own *out* slider sits beside the face, outside the artwork.
Fixed widths put it fourteen pixels behind the panel, where nobody could reach
it. So:

- The canvas keeps `CANVAS_SHARE` (52%) of the window, with a pixel floor for
  windows narrow enough that the shell is about to stack the columns anyway.
- When the two columns do not fit in what is left, **both give way in
  proportion** (`fitPair`). A screen that wanted a wide list and a narrow
  inspector keeps those proportions on a smaller window rather than losing the
  inspector to keep the list.
- Neither column goes below `COLUMN.min` (200px). Narrower than that, the
  honest control is *Collapse*, which the shell already has.

| Window | Artwork | Hands | rig.controls |
| --- | --- | --- | --- |
| 1280 | 288 · 666 · 326 | 378 · 666 · 236 | 341 · 666 · 273 |
| 1440 | 300 · 800 · 340 | 400 · 790 · 250 | 384 · 749 · 307 |
| 1920 | 300 · 1280 · 340 | 400 · 1270 · 250 | 400 · 1200 · 320 |

## The two boundaries

`shell/panel-splitter.js`. They are positioned **over** the column edges at
`left: var(--panel-left)` and `right: var(--panel-right)` rather than added to
the grid, because `.workspace` is a three-column grid read by a great many
selectors and a fourth child would be a fourth column every one of them would
have to learn about.

- Drag, or arrow keys (16px), or the `Page` keys (64px).
- `Home`, and a double-click, put the screen's own width back — the override is
  *forgotten*, not set to the default.
- `role="separator"`, with `aria-valuenow/min/max`, because a boundary only a
  pointer can move is a layout somebody cannot change.
- Hidden where there is no boundary to move: a collapsed column, Preview's
  missing left column, and every layout narrow enough to stack the columns.

A drag is remembered **per screen, for the session**, in `sessionStorage`.
Widening the list on Hands is not a request for a narrow canvas in Artwork, and
one global number would mean exactly that. A column width is not something a
mascot has: it belongs with the open sections, the current screen and the live
pose (docs/UIR_REFACTOR_BASELINE.md §5, Règle D). A tab with storage blocked
gets the route's widths and keeps working.

## A canvas that changes size

Two things the canvas learned, both of which only became reachable once its
width started changing between screens.

**The view stays on what it was looking at.** The view is a matrix from the
artwork into the container, so its translation is measured from the container's
top-left corner: narrow the container and the mascot slides towards the
right-hand edge and off it. Half the difference now goes into the translation.
The zoom is deliberately untouched — an author working at 240% chose that, and
a re-fit on every drag would throw it away.

**A view that *is* a framing is re-framed.** `frameElements(ids, padding)`
frames named pieces by what is *painted* — each node's client rect, mapped back
into the artwork's own space — rather than by `getBBox`, which is a piece's own
untransformed geometry and says nothing about where the rig has placed it. The
canvas remembers that intent, so a dragged boundary keeps the hand filling the
view instead of leaving it half outside. Any other way of changing the view —
*Fit*, *Selection*, the wheel, a pan — drops it, because every other way is the
author saying where they want to look.

## Design ▸ Hands shows a hand

The screen for designing a hand showed a face, because a hand rests **behind
the head** until something asks for it (docs/HAND_RIGGING.md). Arriving now
brings the pair out and frames the one in hand; picking a state of the other
hand turns to that hand; leaving puts the parameters back.

Both acts are session-only and both are things an author can already do by
hand: the show parameters are a live pose like a puppet handle or the head-pose
pad (docs/STILL_WHILE_DESIGNING.md, *What does not stop*), and a view is not
part of a project at all. Nothing is authored, and the browser test asserts
that no revision is written.

A hand does not appear at its rest place — it travels there over
`HAND_REVEAL_SECONDS`. Framing the first frame of that framed a hand still
behind the head and left the view pointing under the chin while the hand walked
out of shot, so the view is taken again once the travel is over, and stands
down if the author has looked somewhere else in the meantime.

## Density

Two lists that were one column of full-width rows:

- **Inspector ▸ Transform.** Seven numbers, each a label above an input, at the
  top of the column — so anybody looking for Appearance or Bindings scrolled
  past a third of a screen of number boxes. X and Y are one quantity said
  twice, and so are the pivot and the scale, so they pair: 1341px of content
  becomes 1173px. Rotate stays alone, because a lone half-width box beside an
  empty one reads as a field somebody forgot to fill in.
- **A palette of drawings** (`.part-styles`, the hand states and the face part
  styles). `repeat(auto-fill, minmax(96px, 1fr))`, so the eight states of a
  hand are 242px of grid instead of 512px of rows, and the same list is four
  across in a wide column and two in a narrow one — which is what the
  draggable boundary is for.

## What is held to

```text
project/editor/ui/panel-split.js            the numbers: splitForMode, fitPair, minCanvas, resolveSplit, the session store
project/editor/shell/panel-splitter.js      the two boundaries, the pointer and the keyboard
project/editor/ui/task-router.js            `layout` on each route
project/editor/index.html                   --panel-left / --panel-right, .panel-splitter, .field-pair, .part-styles
project/editor/svg-editor/svg-canvas.js     frameElements, isFraming, keepViewCentred
project/editor/app/workspaces/design.js     Design ▸ Hands brings the pair out and frames one
project/editor/core/tests/panel-split.test.js   the arithmetic, at 1280, 1440 and 1920
tests/e2e/panel-layout.spec.js              the four screens, a drag, and the hand, in a browser
```
