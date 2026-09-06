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
- **So does leaving Artwork.** The tools are scoped to it — the toolbar is not
  even drawn elsewhere — but the tool stayed armed: the Node tool's handles
  were *rebuilt* on the way into Face Setup and left behind in Preview, still
  rewriting the path they were dragged on, and the Hand tool took its pan and
  its grab cursor into every task. Switching task now puts the canvas back to
  Select the way finishing a shape does, which cancels a half-drawn pen run
  with it.
- The Node tool refuses a **locked** path, which the gizmo already did.

### Points can be added and removed

Moving the points a shape already has is not editing a shape. **Double-click
the outline** (or press `Insert` with a point focused) to add one where the
pointer is; `Delete` removes the focused one. A split is de Casteljau, so the
curve does not move at all — the shape gains a point and looks identical.

`core/path/path-edit.js` is the model: `pathSegments`, `nearestPathPoint`,
`insertPathNode`, `deletePathNode`. Arcs, shorthand curves (`S`/`T`) and
relative commands refuse with a sentence rather than being split approximately.

### Why adding a point was hard, and what it fixes

A shape key is a **per-point delta** against `element.restPath`
(`docs/SHAPE_KEYS.md`). A path with one more point no longer matches the deltas
that deform it, so every mouth pose would be dropped as a topology mismatch.

Two things were already broken because of it:

1. **A node edit on a face shape was silently reverted.** The commit wrote the
   drawn `d` and never touched `restPath`, and the runtime redraws a shape
   target from `restPath + Σ deltas` on the next frame. Every drag on the
   mouth, the head, the teeth, the tongue or a hand was undone by the frame
   after it.
2. **Dragging an `h`/`v` node off its axis promotes it to `l`** — which is a
   topology change, made silently, that left the deltas one value short.

The way out is that every one of these edits is a **linear map on the value
vector**: a split is weighted sums of control points, a merge and a `Q`→`C`
elevation likewise. So an edit reports its map, and `core/path/path-topology.js`
applies the same map to the rest outline, to every shape-key delta, to a legacy
morph's two paths and to every captured calibration pose. Linearity is what
makes that exact:

```text
remap(rest) + remap(delta) === remap(rest + delta)
```

Verified on the real case, to the last decimal: split `MOUTH_REST` and carry
`mouth-smile` through the same map, and the result is character-for-character
the posed shape split the same way.

A node drag now writes the **outline**, not the pose that happens to be on
screen, and it is one undo step across artwork, keyforms and the semantic rig.
Where the map cannot be exact — an arc, or a rest outline that already
disagrees with what is drawn — the edit is refused with a sentence, because a
half-migrated rig is worse than an edit that did not happen.

## The shape tools drew somewhere else

Rectangle, Ellipse and Pen were four separate bugs, and all four showed on the
first press:

| What happened | Why |
| --- | --- |
| a shape landed off the artboard, three times too big | it was measured in the outer group's coordinates and appended inside the imported `<svg>`, which has a viewBox of its own |
| pressing another tool, or a zoom button, left a shape behind | the toolbar was inside the canvas element, so a press on a button was also a press on the drawing surface (it is docked above the canvas now, and the zoom controls that stayed are excluded by name) |
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
drag to pull a curve out of it, press the first point again to close the
outline, `Backspace` to take the last point back, `Enter` or a double-click to
finish, `Escape` to throw the run away (and `Escape` again to leave the tool).

While fixing the coordinates it turned out that **drawing re-framed the
canvas**: `refreshDocument` set `loadedMarkup` after telling the store, and the
store notifies synchronously, so `reconcileState` still believed the old markup
and rebuilt the artwork — losing the zoom and pan every time. The order is
fixed, and a rebuild now restores the view it had, so an undo or another
panel's write no longer moves the camera either.

## The preview drifted, and reached past the working area

"L'outil trait affiche un tracé en dehors de la fenêtre et pas aligné avec ce
qui est dessiné une fois fini." Two causes. The draw layer's transform was
measured once, at the first press, from the artwork's screen matrix; a wheel
pan or a Ctrl + wheel zoom in the middle of a pen run — the natural thing to
do while placing points — left every later preview offset from where the
shape then landed. And the preview lived in the outer svg, unclipped, while
the artwork sits inside a viewBox that cuts at the working area: the preview
showed a line running off the artboard, and the committed line stopped at
its edge.

Now one function says where the artwork is on screen: the view (zoom and pan)
times the viewBox rule of the artwork's own `<svg>` — `meet`, `slice` or
`none`, and its alignment — computed in `core/artwork/viewport.js` rather
than read off the DOM. The draw layer takes that matrix on every gesture and
every view change (`syncDrawLayer`), a pointer becomes an artwork point
through its inverse (`artworkPoint`), and the layer is clipped to the
working area with a `<clipPath>` that follows the artboard, so the preview
stops exactly where the shape will. A shape that still reaches past the
working area says so when it lands, and points at **Fit to artwork**.

## The tools, complete

```text
  Select  Node  Pen  Line  Rectangle  Ellipse  Polygon  Text  Hand
    V      N     P    L       R         O                 T     H
  ─────────────────────────────────────────────────────────────────
  Fill ■ None   Stroke ■ None   Width 2   Sides 5 ☐ Star   Grid ☐ Snap ☐
  Click for a corner, drag for a curve. Click the first point to close…
```

The tools are one controller (`svg-editor/draw-tools.js`), a small state
machine per tool over pointer events in **artwork units**: the canvas turns a
pointer into a point and a spec into a preview or a shape, and knows nothing
about pens, stars or text. That split keeps the tool file free of the DOM and
the canvas free of drawing rules, and it is what made the rest cheap:

| Tool | Gesture | Shift | Alt |
| --- | --- | --- | --- |
| Pen | click for a corner, drag for a curve; click the first point to close; Backspace, Enter, double-click | the next segment snaps to 45° | — |
| Line | drag | 45° steps | — |
| Rectangle | drag | a square | from the centre |
| Ellipse | drag | a circle | from the centre |
| Polygon / Star | drag from the centre outwards; the drag sets the rotation | rotation in 15° steps | — |
| Text | click; the Inspector's text field takes the cursor | — | — |

The toolbar, its options and the view controls are **docked above the working
area**, not floating over it. They used to hang inside the canvas element as
overlays — two cards at the top and a zoom pill in the corner — and what they
covered was the artwork being edited. They are the canvas column's own bar now
(`.canvas-column`, `.canvas-tools`): the vector tools on the first line, the
tool's options and the view controls (Handles, Fit, zoom) on the second, and
the working area starts under them with nothing on top of it. Outside Artwork
the tools are gone and the bar is one thin line holding the view controls.

Its height is fixed, and that is not cosmetic: the bar sits in the layout now,
so a row that grew — the tool's fields, the Arrange group appearing with a
selection — would resize the canvas under the pointer and move the artwork
between measuring it and pressing on it. The options line is one line, always,
and scrolls sideways if a tool brings more than fits. The hint rides on it and
gives way to an ellipsis first.

The **options bar** under the toolbar (`ui/tool-options.js`) holds what a new
shape is painted with — fill, stroke, width, with *None* for either — a
rectangle's corner radius, a polygon's sides and its star's inner radius, the
text and its size, and the **grid** with **Snap**. Every shape used to arrive
blue with rounded corners and the first thing after drawing was a trip to the
Inspector. The options are UI preferences, remembered in the browser
(`boop.drawOptions.v1`), never part of the project. A fill and a stroke both
set to none get a dark stroke anyway: a shape has to be visible to be picked
up.

The **working area is painted white** under the artwork now. The canvas is
dark, the default stroke is dark, and the first line anyone drew on a blank
canvas looked like nothing had happened; the file will be seen on white
pages far more often than on dark ones, so the paper says what the export
will look like.

## Curves: the pen's handles and the Node tool's

A pen point placed with a drag carries an outgoing handle and its mirror; the
run is serialized as `C` segments between points that have handles and `L`
segments between points that do not (`core/path/path-build.js`). The Node
tool then shows, for the point in hand, the two control points that shape the
curve on either side of it, joined to it by a line (`core/path/path-controls.js`).
Dragging one moves the other with it while the point is smooth; **Alt**
breaks the pair for that drag, and **Corner** breaks it for good. The bar
offers **Curve** (the segments at the point become curves, with control
points a third of the way along), **Straight** (they become lines), **Smooth**
(the handles line up) and **Delete point** — the key `Delete` does the same,
and reaches the shape itself only when no point is in hand. Curve and Straight
change the path's topology, so they go through the same migration as adding
a point: the shape keys, morph and captured poses on that element are
remapped by the linear maps of the edit (`convertNode` returns `terms`).

## Several pieces at once

Shift + click adds a piece to the selection (Ctrl/Cmd + click too), a drag
on empty canvas draws a marquee and selects what it surrounds, and Ctrl/Cmd + A
takes every unlocked, visible piece at the top of the artwork. The session
keeps the set next to the piece in hand — `selectedIds` beside `selectedId`,
the piece in hand always a member and always last (`core/state/selection.js`)
— so every panel that knows one selection keeps working, and a plain
`selectedId` write is a selection of one.

The marquee picks the *highest* pieces wholly inside it and looks into the
ones it only crosses (`core/artwork/arrange.js`): a marquee around the two
eyes of a face picks the eyes, not the face, because in nested artwork the
root touches everything. A drag on any selected piece moves them all, as one
undo step; each moves by the screen vector turned into its own parent's
space, so a piece inside a rotated group goes where the pointer went. The bar
above the canvas lines them up (**Align** left, centre, right, top, middle,
bottom — one piece lines up on the working area instead), spreads three or
more with equal gaps (**Spread**), and makes them one **Group** (Ctrl/Cmd + G;
Shift + G takes a group apart); the pieces have to share a parent, because a
group that pulled a pupil out of its eye would take it out of the eye's turn.
Arrow keys nudge the set and Delete removes it, one undo step each. The gizmo
frames one piece; a set gets a thin frame per piece and one box around them
all, and moves only — rotate or scale several by grouping them first.

## Starting from nothing

Home has a **Blank canvas** beside the face: the same 240 × 240 working area
with nothing on it and the least rig that validates — one resting state,
nothing bound — so it saves, autosaves and exports the moment it opens, the
way an empty file is a file. `hasValidProjectDocument` asks for an `<svg>`
and no longer for artwork inside it; an *import* still asks for artwork,
because an SVG with nothing in it is almost always the wrong file.

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

**Forward is depth, not list order.** *Bring forward* and *Send backward* were
wired to the Layers panel's `up` / `down`, which move a row in a tree; painted
last is painted in front, so each button did the opposite of its label. A move
that cannot happen — a piece already at the front of its group — now says so
instead of leaving an undo step that undoes nothing.

The dialog also keeps what you type. A press anywhere else used to close it
before the field's `change` fired, and a press on another button in the menu
was swallowed by the rebuild that the first press triggered: the name is
committed on close now, and a refresh of the same piece patches the dialog
rather than replacing it. It stays open after **Hide**, because a hidden piece
cannot be right-clicked again and *Show* would be unreachable.

Every action is one the Layers panel already had — the menu adds no new way to
change the document, only a shorter way to reach the existing ones. `Shift+F10`
and the context-menu key open it for the current selection, so it is not a
mouse-only gesture, and `Escape` closes it. It is a `dialog` rather than a
`menu` because renaming is a text field, and a menu with an input in it is
neither one thing nor the other.

Artwork and Face Setup only: in Preview the canvas is a test bench, and a
delete there would be a trap.

## The working area was invisible, and it cuts

"Il y a des soucis avec la plage de travail: si j'utilise des cheveux plus
hauts ils sont coupés sans raison apparente."

Two edges were doing the cutting, and neither was drawn:

1. **The artboard.** The artwork is loaded as a nested `<svg>`, and a nested
   `<svg>` establishes a viewport that **clips to its own `viewBox`**. Anything
   drawn outside it is not hidden, it is simply not rendered. Hair taller than
   the 240 × 240 box was gone above `y = 0`, with nothing on screen to say so.
2. **`clip-path`.** The fringe is deliberately clipped to the head so it cannot
   cross the outline (`docs/MASCOT_TEMPLATE.md`) — a good rig decision, and an
   invisible one. Redraw the fringe taller and the clip eats the difference.

Both are now visible and both can be changed:

- The canvas draws the **artboard edge** as a dashed rectangle, in the
  artwork's own units, in the Artwork task.
- Selecting a clipped piece draws **the shape it is cut against**, in orange.
- The Artwork panel carries the working area's width and height, a **Fit to
  artwork** button, and a notice that says *"the drawing reaches 30 past the
  top, and is cut there"* when anything is outside. Fit only ever grows the
  box: cropping a drawing is a decision, not a repair.
- The canvas menu on a clipped piece names the clip and offers **Stop cutting
  it**, which removes the `clip-path` in one undo step.

`core/artwork/artboard.js` is the model — read, write, grow, and report the
overflow per edge. The measuring belongs to the canvas, because only the DOM
knows how big a path really is; the model never guesses geometry.

Adding a pair of hands already grew the artboard for the same reason
(`docs/HAND_RIGGING.md`); this is that idea made general and put in the
author's hands.

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

## The Inspector stopped eating the field you were typing in

Every Inspector field wrote the document on `input`, and every document write
redrew the Inspector by `innerHTML`. Typing `none` into Fill wrote `fill="n"`
and the field was gone; a slider drag pushed one full undo snapshot per frame,
enough to evict the whole undo stack on one opacity drag (system audit,
`docs/SYSTEM_AUDIT_2026-09.md`).

Text and number fields commit on `change`. Colour pickers and sliders preview
live, inside one history transaction that opens when the field takes focus and
closes when it leaves, so a drag is one undo step. And the panel does not
rebuild while it has focus: its own edits are the only thing changing the
document then, the fields already show what was typed, and it catches up when
focus leaves.

## Appearance is a surface now, not four fields

Fill and stroke each get a colour, a free value — `url(#gradient)` works — and a
**None** switch, so a swatch is never shown for a paint that is not there.
With a stroke come width, opacity, line ends, corners and dashes; a rectangle
has a width, height and corner radius, a circle a radius, an ellipse two, a
text its words, font size and anchor. Values are read from the element and
then from its computed style, never from svg.js's defaults (which answer
`#000000` for a shape with no fill attribute). Writing a value removes a
conflicting inline `style` property first, so imported Illustrator and Figma
shapes respond; a rule in an imported `<style>` block still wins over an
attribute, and `docs/KNOWN_LIMITATIONS.md` says so.

## The rest of the vocabulary

Arrow keys nudge the selection by a unit (ten with Shift); Ctrl/Cmd + C and V
copy and paste it — paste is a duplicate of the remembered piece, in front of
the original, with fresh `-copy` ids for it and its children and its name
carried over; **Bring to front** / **Send to back** and **Flip horizontally /
vertically** sit in the canvas menu and under the selected Layers row, whose
**Bring forward** / **Send backward** now mean the same direction as the menu's
(they were the reverse). The wheel pans; Ctrl/Cmd + wheel — which is also how
a browser reports a trackpad pinch — zooms about the pointer, and the readout
follows. A Node-mode double-click adds a point only within fourteen screen
pixels of the outline. Unlocking a piece no longer switches the legacy
`svg.draggable` plugin back on beside the gizmo.
