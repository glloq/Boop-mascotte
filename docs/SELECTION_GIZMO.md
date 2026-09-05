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

## Nested parts

A mascot's parts overlap: the mouth is inside the head's box. Pressing inside
the box but on *other rigged artwork* selects that artwork instead of dragging
the selection. Handles are always the gizmo's; the body is only the gizmo's
when the press lands on the selection's own art.

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

`gizmo-geometry.test.js` (31 cases) covers the transform round trip, handle
layout, the rotate handle following rotation, zoom-independent handle size, hit
testing including a rotated box, all four drags, shift behaviour, rotation
unwrapping, the zero-scale guard, pivot compensation across rotated and scaled
elements, and cancel.

`transform-gizmo.test.js` (19 cases) covers the overlay's structure and
transparency, the transient-then-one-command lifecycle, click-without-drag,
Escape, handle-implied modes, mode keys and their guards, hover cursors, zoom,
and teardown. It runs against a small stub DOM so gizmo behaviour is checked by
`npm run verify`, not only in a browser.
