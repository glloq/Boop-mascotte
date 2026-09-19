# Selection and transform gizmo

```text
                 ○
            rotate handle
                 │

        □────────────────□
        │                │
        │       ⊕        │
        │      pivot     │
        │                │
        □────────────────□
```

The V1 selection came from `svg.select.js` / `svg.resize.js` /
`svg.draggable.js`: readable enough on a rectangle, hard to read on overlapping
mascot parts, and with a pivot that lived only in the Inspector. V2 replaces it
with a gizmo Boop owns.

| File | Responsibility |
| --- | --- |
| `gizmo-geometry.js` | pure geometry: handles, hit testing, the four drags |
| `selection-overlay.js` | the drawing, on its own SVG layer |
| `transform-gizmo.js` | pointer and keyboard wiring, one history command per drag |

## The overlay never hides the artwork

* it is a sibling layer above the drawing, never a child of it, so it is
  outside the serialized document;
* it has `fill="none"` and `pointer-events: none` — it draws, it does not
  intercept;
* strokes are `vector-effect: non-scaling-stroke` and handles are sized in
  canvas units divided by the zoom, so they keep a constant screen size instead
  of becoming a speck or swallowing the artwork.

Its coordinate space is the selected element's **parent** — the space a
`baseTransform` maps into. Nested groups, `viewBox` scaling and canvas zoom all
come out right without a special case for any of them.

## Modes

```text
G = Move    R = Rotate    S = Scale    P = Pivot    Esc = Cancel
```

A compact toolbar mirrors the same four modes and only appears while something
is selected. Grabbing a handle implies its mode regardless of the current one,
so a corner scales and the rotate handle rotates even in Move.

The mode keys are **G** (Move), **E** (Rotate), **K** (Scale) and **A**
(Pivot, the anchor). They share no letter with the vector tools
(V/N/P/L/R/O/T/H): the shape just drawn is always the selection, so when R
meant both Rectangle and Rotate, the second rectangle rotated the first. The
tool keys always switch tools; the mode keys act only while something is
selected under the Select tool. Escape cancels a drag in progress.

### Shift

| Mode | Shift |
| --- | --- |
| Move | constrain to the dominant axis, then snap to an 8-unit grid |
| Rotate | snap to 15° |
| Scale | keep proportions on a corner; snap to 0.1 on an edge |
| Pivot | snap to the grid |

## Drags

Each drag is a function from *(transform at pointer-down, start point, current
point)* to a new transform, which is what makes the whole interaction testable
without a browser:

* **Move** — translate by the pointer delta.
* **Rotate** — the angle swept around the pivot, added to the starting
  rotation. Readings are unwrapped against the previous one, so a drag past
  ±180° keeps turning the way the hand is going instead of snapping the long
  way round.
* **Scale** — resolved in the space that has been scaled but not yet rotated,
  so the grabbed handle lands under the pointer even on a rotated element and
  the pivot stays put. Scale can never reach zero, which a drag could not
  recover from.
* **Pivot** — the pivot lands under the pointer and **the artwork does not
  move**. Changing the pivot only changes the transform's translation
  component, so compensating one reference point compensates every point
  exactly.

## Nested parts, and who owns a press

A mascot's parts overlap: the mouth is inside the head's box. Handles are
always the gizmo's. The **body** is decided by paint order:

| Under the pointer | What a press does |
| --- | --- |
| the selection, or something inside it | drags the selection |
| a piece painted **in front of** the selection | selects that piece |
| a piece painted **behind** it, or nothing | drags the selection |

The rule used to be "anything else means select that instead", which is right
for the mouth inside the head's box and wrong for everything thin: the
template's nose is a stroked arc with no fill, so the middle of its own box is
the cheek showing through, and pressing the middle of the piece you had just
selected deselected it and picked the face. What is behind the selection is
background — the box is the author's claim on that area. What is in front of it
is a piece they can see and are more likely reaching for.

A handle on the box never swallows the body either. The grab radius is eight
screen pixels, which is right for a head and a wide net for an ear seen at a
quarter zoom — thirty-two artwork units, three times the piece — so every point
on it was within reach of some handle and it could be scaled from anywhere and
moved from nowhere. The eight handles on the box give way to it: a third of its
shorter side, at most. A box with no side at all, which is what a stroked line
measures, keeps the full reach so its handles stay grabbable, and so does the
rotate handle, which floats outside the box and competes with nothing.

## Several pieces

The gizmo frames one piece. With several selected — Shift + click, a marquee
on empty canvas, Ctrl/Cmd + A — the canvas draws a thin frame around each and
one box around them all (`[data-multi-select]`, in the outer svg's own
coordinates), and a drag on any of them moves them all as one history
command. Align, Spread and Group live in the bar above the canvas; the
selection model and the geometry are in `core/state/selection.js` and
`core/artwork/arrange.js` (`docs/VECTOR_EDITING.md`, "Several pieces at
once"). A set moves only: to rotate or scale several pieces, group them and
transform the group.

## The box is drawn where the piece is *painted*

A mascot being designed stays posable, so the transform a piece is drawn with
is not the one the project holds. The canvas therefore remembers what it last
drew each piece with, and the box is built from that
(`core/artwork/pose-transform.js`).

Which only works if **everything** that writes a transform says so. A preview
frame did; a typed field in the Inspector, the arrange commands and the gizmo's
own drag did not — so typing a number moved the artwork and left the handles a
hundred pixels behind, where they stayed, because re-selecting the piece read
the same stale answer. Every writer records now, a rebuilt drawing forgets what
its old nodes were drawn with, and moving a piece asks the overlay to redraw.

## An edit reaches the document, once

```text
edit ──▶ the DOM moves ──▶ `elements` ──▶ markup ──▶ the store
                                                      │
                            reconcileState ◀──────────┘
                            (rebuild, if this is not what the canvas loaded)
```

`reconcileState` rebuilds the whole drawing when the store's markup is not the
markup the canvas loaded — that is how an undo, or another panel's edit, reaches
the artwork. So a canvas that writes markup and forgets to record what it wrote
has armed a rebuild against itself: the next unrelated change reloads the
drawing from the markup it wrote earlier, and every edit made since is rolled
back without anybody asking. An author sees a move come undone the moment they
click something else, which is exactly what one reported.

Two writers had forgotten — the gizmo's commit and the legacy drag plugin's —
and two gestures (a multi-selection drag, the arrow keys) wrote `elements`
without ever refreshing the markup, so the drawing the store held was a drawing
with the move missing from it. Every canvas-side write goes through one door
now (`syncDocument`), and a transform gesture finishes by putting the drawing
back in the document (`commitTransforms`).

## Undo

```text
pointerdown
 ↓
transient changes      ← the DOM moves, the store and history do not
 ↓
pointermove…
 ↓
pointerup
 ↓
ONE history command
```

A drag that never moved commits nothing. Escape mid-drag re-applies the
transform captured at pointer-down — the exact previous state — and commits
nothing, because the starting transform is never mutated.

## Legacy selection

`svg.select.js`, `svg.resize.js` and `svg.draggable.js` are still used by the
rig calibration pose tools (`beginTransformPose`). They are no longer used for
ordinary selection. Removing the dependency belongs to a later step, once those
tools move onto the gizmo too.

## Tests

`selection.test.js` covers the selection set and `arrange.test.js` the
marquee rule, align, spread and the parent-space vectors;
`ux38-multi-selection.spec.js` does the same in the browser.

`gizmo-geometry.test.js` (32 cases) covers the transform round trip, handle
layout, the rotate handle following rotation, zoom-independent handle size, hit
testing including a rotated box and a piece smaller than its own handles, all
four drags, shift behaviour, rotation unwrapping, the zero-scale guard, pivot
compensation across rotated and scaled elements, and cancel.

`selection-pose.spec.js` holds the two properties an author reported missing: a
typed edit moves the artwork, takes its box with it and is still there after
looking at something else; and the middle of a selected piece drags it even
where another piece shows through.

`transform-gizmo.test.js` (19 cases) covers the overlay's structure and
transparency, the transient-then-one-command lifecycle, click-without-drag,
Escape, handle-implied modes, mode keys and their guards, hover cursors, zoom,
and teardown. It runs against a small stub DOM so gizmo behaviour is checked by
`npm run verify`, not only in a browser.
