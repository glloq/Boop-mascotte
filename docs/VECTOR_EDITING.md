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
