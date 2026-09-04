# Editing on the canvas

Everything a person does to artwork happens here: select, move, resize, rotate,
reshape, and move the view. Four things in this path were broken, and together
they made the canvas feel like nothing worked.

## A drag wrote NaN into the artwork

`toCanvas(event)` returned the browser's own point object. An `SVGPoint` keeps
`x` and `y` on its **prototype**, so `{ ...point }` in `beginGizmoDrag` copied
no properties at all: every drag started from `undefined`, and

```text
translate(undefined - 594 …)  →  translate(NaN NaN)
```

went into the element's `transform`. That is not a wrong position — it is an
invalid attribute. The element disappears, the console fills with
`Expected number`, and `documentModel.serialize()` carries the damage into the
saved project, where `baseTransform.x` is `null` forever.

The unit tests passed throughout, because a test hands the gizmo a plain
`{ x, y }` object. So the fix is three layers, not one:

1. `toCanvas` returns a plain object, as its own contract already said.
2. `beginGizmoDrag` reads **every** field through `finite()` once, so neither a
   live DOM point nor a transform with missing fields can reach the arithmetic.
3. The canvas checks every number on the way out (`finiteTransform`), so no
   future path can write an unparseable attribute or store one.

## A stroked line had no selection box

`getBBox()` measures geometry and ignores the stroke. The mouth of every
template is a stroked curve, so it measured **zero height**: the selection box
collapsed to a flat line with all ten handles stacked on each other, and the
rotate handle landed exactly on the outline. Nothing could be grabbed.

The canvas now inflates the measured box by the stroke and enforces a minimum
size, and `gizmoModel` keeps the rotate handle above a degenerate box instead
of on it.

## Rotation happened around the corner of the canvas

An unconfigured pivot is `(0, 0)` — the origin of the artwork's own
coordinates, usually nowhere near the part. Rotating and scaling around that is
never what the author means, so an unset pivot now defaults to the middle of
the selection. The pivot handle still moves it anywhere, but **only in Pivot
mode**: it sits in the middle of the selection, which is exactly where a person
presses to drag the thing.

## Two tools were buttons that turned Select off

`Node` and `Hand` were advertised in the toolbar and implemented nowhere.
Choosing either switched the canvas out of `select`, which turns off the gizmo
and dragging, and put nothing in their place: the canvas went inert.

- **Node** now edits a path directly. `core/path/path-nodes.js` is the model: a
  node is an on-curve anchor (the point a command ends at), built on the
  runtime's own `parsePath` / `serializePath` so path arithmetic is not
  duplicated. Control points, arc radii and flags are not nodes and are left
  alone. Dragging a relative command's anchor compensates the next one, so one
  node moves rather than the whole tail; `h` and `v` are promoted to `l` when
  dragged off their axis, because dropping half a gesture is worse than
  changing a command. Arrow keys nudge the focused node, and one drag or nudge
  is one undoable command.
- **Hand** pans, as do space-drag and the middle button — so the view can be
  moved without leaving whatever tool is in hand.
- **Escape** leaves any tool for Select. A tool you cannot get out of is a trap.

## The shape tools drew somewhere else

Rectangle, Ellipse and Pen were four separate bugs, and all four showed on the
first press:

| What happened | Why |
| --- | --- |
| a shape landed off the artboard, three times too big | it was measured in the outer group's coordinates and appended inside the imported `<svg>`, which has a viewBox of its own |
| pressing another tool, or a zoom button, left a shape behind | the toolbar is inside the canvas element, so a press on a button was also a press on the drawing surface |
| nothing appeared until the gesture ended | there was no preview |
| clicking the new shape drew another one on top of it | the tool stayed armed |

So: one function measures a pointer in the **artwork's** own units
(`artworkPoint`), one builds a shape from two corners (`shapeSpec`) and is used
for the preview and for the artwork alike, and chrome is excluded from the
drawing surface by name. A press that never moves is a press, not a drawing —
the 2 × 2 pixel shapes are gone. When the gesture ends the canvas hands itself
back to **Select** with the new shape selected, so the obvious next move moves
it.

The preview lives in a layer of its own above the artwork, like the gizmo:
anything drawn inside the document would be serialized into it the moment
another panel reconciled mid-drag.

**Pen** is a run of points now rather than a single segment: press to add one,
press the first point again to close the outline, `Enter` or a double-click to
finish, `Escape` to throw the run away (and `Escape` again to leave the tool).

While fixing the coordinates it turned out that **drawing re-framed the
canvas**: `refreshDocument` set `loadedMarkup` after telling the store, and the
store notifies synchronously, so `reconcileState` still believed the old markup
and rebuilt the artwork — losing the zoom and pan every time. The order is
fixed, and a rebuild now restores the view it had, so an undo or another
panel's write no longer moves the camera either.

## Right-click edits the piece under the pointer

A mascot is thirty shapes, and the only way to reach one of them was the Layers
tree. Right-clicking a piece of artwork selects it and opens a small dialog
over it (`ui/canvas-menu.js`) carrying its name, the face part that owns it,
and what one does to a piece of artwork:

```text
Name  [ Lip line          ]
Part of Mouth
  Open Mouth        Face Setup
  Edit points       Node tool
  Duplicate
  Bring forward · Send backward
  Hide · Lock
  Delete
```

Every action is one the Layers panel already had — the menu adds no new way to
change the document, only a shorter way to reach the existing ones. `Shift+F10`
and the context-menu key open it for the current selection, so it is not a
mouse-only gesture, and `Escape` closes it. It is a `dialog` rather than a
`menu` because renaming is a text field, and a menu with an input in it is
neither one thing nor the other.

Artwork and Face Setup only: in Preview the canvas is a test bench, and a
delete there would be a trap.

## The view was never translated

Zoom and pan went through SVG.js's `transform({ translateX, translateY, … })`.
Those are the **3.x** names and the project is on 2.x, which silently ignored
them: `Fit` only scaled (the mascot was never centred — the visible centring
was the scale-about-bbox-centre side effect), zoom drifted, and panning did
nothing at all.

There is now one function that writes the view, as a plain matrix
(`setView`), and one that reads it (`viewTransform`). `Fit` centres, zoom keeps
the middle of the viewport fixed, and pan moves by exactly the pointer delta.

## The Timeline waits to be asked

Animate opened with the Timeline filling the bottom third of the window:
tracks, keys, a playhead, Auto Key, Snap, Add Control. It is the most complex
surface in the editor and it was the first thing an author saw, in the task
whose simple path is *pick a preset, press Test, move three sliders*.

It starts closed now, and what the author chooses is remembered. Two things
open it: the footer button — which says `⌃ Edit key by key` instead of
`Timeline`, so it names what it does — and *Open in Timeline* in the Motion
Inspector, which is where the thought "I want to change one key" actually
occurs.

The collapsed state also had to be made to work at all: `.timeline-collapsed`
is a class selector and it was fighting `#app[data-workspace=animate]`, an id
selector, so the row stayed 210px tall in the one workspace where collapsing
matters; and the footer kept a 190px floor that spilled it over the canvas.
