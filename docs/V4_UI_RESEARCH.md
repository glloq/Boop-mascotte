# Making a mascot from pictures should feel like making one

*Research into what still makes the picture path harder than the vector path,
and what to build about it. Written by walking the path in a real browser and
counting, not by reading the plan.*

V4 made every piece of the picture path work. This is about the path itself.

---

## 1. The walk, counted

Here is what a person does today, from an empty editor and a folder containing
`head.png`, `eye.png` and `mouth.png`, to a mascot that blinks, follows the
pointer and reacts to a click. Each line is one interaction; the count is what
matters, not the exact number.

| | Vector path | Picture path |
| --- | --- | --- |
| Get a rigged mascot on screen | **1 press** — *Start from the ready-made face* | **~18** — import, drag, resize, per piece |
| Make it yours | swap parts in Design ▸ Face | already yours |
| Assign face roles | already assigned | **8** — Rig ▸ Assign, four roles |
| Turn on movements | already on | **4+** — Rig ▸ Controls |
| Expressions, automatic life, a reaction | ~5 | ~5 |
| **Total to a moving mascot** | **~7** | **~35** |

Both paths end in the same place. One of them starts there.

**This asymmetry is the whole finding.** Every other item below is a detail of
it. The vector author gets a rigged, assigned, moving mascot in one press and
then personalises it; the picture author gets an empty canvas and a file picker,
and has to build the same structure by hand — while the editor already knows
exactly what structure it wants, because it ships one.

## 2. What the walk actually showed

Each of these was observed in Chromium against the current build, not inferred.

### 2.1 Every picture lands in the same place

`placeImageInArtboard` centres each import at 0.6 of the artboard's shorter
side. Importing a head, two eyes and a mouth puts four pictures on top of one
another in the middle of the canvas:

```text
head   96,104  48×32
eye   112,112  16×16
mouth 108,111  24×17
```

The author's first act after every import is to drag the thing out from under
the last thing. With five pieces that is five drags and five resizes before
anything looks like a face.

### 2.2 The editor knows the file names and ignores them

Face-role detection (`rig-editor/semantic-parts/face-role-detection.js`) is
good: it tokenises ids and layer names, understands `eye`, `brow`, `pupil`,
`mouth`, `head`, and reads sides from `left`/`l`/`gauche`/`1`. A node called
`eye-left` is detected with high confidence.

An imported picture's node id **is** its file name (`imageNodeId`), so somebody
who names their files `eye-left.png` already gets everything — and nobody is
ever told that. Somebody whose files are `Layer 4 copy.png` gets nothing, and
the checklist says every role is `missing` with no hint that the name was the
lever.

### 2.3 The Inspector notices, and cannot help

Select an imported picture and the first line of the Inspector reads:

> alpha-16x16 — **No face part uses this piece**

That is the right observation in the right place, with no action attached to it.
The author has to know that *Rig ▸ Assign* exists, go there, and find the same
piece in a different list.

### 2.4 The same file could not be added twice

**Found and fixed during this research.** `<input type="file">` fires `change`
when its *value* changes, so choosing the same file again fired nothing: the
picker opened, the file was chosen, and the editor did not move. Nobody notices
for *Open Project*; everybody notices for *Add picture*, because a face has two
eyes and they come out of one `eye.png`. One line in `shell/topbar.js`, plus a
browser test. It affected every file picker in the editor.

### 2.5 A piece added on top of a base has no depth

`addBaseImageFile` sets `depth: 0` so everything else is painted in front.
`addImageFile` sets no depth at all, so pieces placed on a photographed head
share the base's plane and the pseudo-3D parallax has nothing to work with until
somebody finds the field in Advanced.

### 2.6 Three buttons that describe the model, not the job

The Artwork column offers *Import / Replace SVG*, *Import head / base*, *Add
picture*. The difference between the second and the third is real and load
bearing — one is the plane everything sits on, the other is a piece placed in
front — and neither name says so to somebody who has not read the roadmap.

---

## 3. What to build, in order

Each proposal names where it goes and roughly what it costs. Cost is relative to
this codebase: **S** is a day's work in one module, **M** touches two or three,
**L** is a new surface.

### P1 — A face built from your pictures (L) · *the one that matters*

A picture-native counterpart to *New mascot*: a short flow that asks for the
pieces **by role** rather than by file.

```text
    Build a face from your pictures

    Head or body      [ head.png        ]  ✓
    Left eye          [ eye.png         ]  ✓
    Right eye         [ same as left ▾  ]
    Mouth             [ mouth.png       ]  ✓
    Eyebrows          [ optional        ]

              [ Build it ]
```

On *Build it*: import each file, place it where its role goes, scale it to the
role's share of the head, name the node after the role, assign the face roles,
and enable the movements that role carries. One press, one undo step, a rigged
mascot — the same ending the vector path already has.

**This is mostly orchestration of commands that exist.** `assets.import`,
`placeBaseInArtboard`, `placeImageInArtboard`, `canvas.appendArtwork`,
`semanticRigCommands.assignFaceRoles`, `enableControl` — `editor-app.js`'s own
`createMascot()` already composes the last two for the vector path. What is new
is the surface and a small table of role → position, size and controls.

It also disposes of 2.1, 2.2, 2.3, 2.5 and 2.6 in one move, because a piece that
arrives knowing its role needs none of them.

Where: a sibling of `ui/new-mascot/`, reached from Home beside *Start from a
picture* and from Design ▸ Artwork.

### P2 — Place a picture where its name says it goes (S)

When an imported file's name tokenises to a role, place it at that role's
position instead of the centre, at that role's size. `tokenize()` and
`featureOf()` already exist and are already pure; the rest is a table.

`eye-left.png` lands where a left eye goes. `IMG_2043.png` lands in the middle,
exactly as today. Nothing is guessed that is not already being guessed by the
role detector one screen away.

Where: `core/assets/asset-placement.js`, reading
`rig-editor/semantic-parts/face-role-detection.js`.

### P3 — "Use as…" where the Inspector already says the piece is unused (S)

The line *No face part uses this piece* becomes a line with a `<select>`:
*Use as [ Left eye ▾ ]*. Choosing one runs the same `assignFaceRoles` command
the checklist runs.

The observation is already made in the right place at the right moment. This
only attaches the action to it.

Where: `inspector/inspector.js`, beside the existing artwork header.

### P4 — Drop a folder, place a face (S, on top of P2)

Multi-file drop already works (`picturesIn` returns every picture in the drop,
in order). With P2 in place, dropping a folder of well-named pieces assembles a
face rather than a stack. Without P2 it assembles a stack, which is what it does
today.

The status line should say what it placed and what it could not name: *"Placed
head, left eye, right eye. `IMG_2043.png` has no role in its name — drag it
where it goes."*

### P5 — Mirror a piece (S)

*Duplicate and flip* on a selected picture, which is how the second eye is made
from the first. Duplicate exists; flip exists; the pair as one action, placed
across the artboard's vertical centre, does not.

Where: `ui/selection-actions.js`.

### P6 — A centre line and a mirror guide while dragging (M)

Two eyes placed by eye are never symmetric. A vertical centre guide, and — when
a piece has a mirror twin by role — a guide at its reflection, with snapping.

The canvas already has snapping for the drawing tools; this is a second source
of snap targets rather than a new mechanism.

Where: `svg-editor/svg-canvas.js`, beside the existing snap logic.

### P7 — Depth follows placement (S)

A picture added onto a base takes a depth in front of it rather than none, the
way `addBaseImageFile` already gives the base `depth: 0`. Pseudo-3D then works
on a photographed face without a trip to Advanced.

Where: `app/services/project-service.js`, `addImageFile`.

### P8 — Say what the two import buttons are for (S)

*Import head / base* → **"The picture everything sits on"**.
*Add picture* → **"A piece placed in front"**.
The existing `<small>` under each label is where this goes; the topbar's own
menu already uses that pattern (*Open Project — A .boop package or a .json
snapshot*).

### P9 — The state graph on the canvas (L) · *from the audit*

Not about pictures, but the largest remaining UI debt: the state machine is
drawn in a ~260 px sidebar column, where a four-state machine fits at 47 %. The
diagram is real now — positions are authored, saved and undoable — and it wants
the room the canvas has. This is a shell change (a dock, like the Timeline),
not a graph change.

---

## 4. What not to build

- **Background removal.** The obvious request for "a mascot from a photo", and
  the wrong thing for this editor to own: it needs either a model or a magic
  wand tool, both of which are a product of their own, and both of which do a
  worse job than the tool the author already used to cut the picture out.
  Refusing it is cheaper than doing it badly. Saying so in the import copy —
  *"pictures with transparent backgrounds work best"* — is the whole fix.
- **JPEG import.** Refused because a mascot piece needs alpha. The right change
  is the refusal message, not the format list.
- **A second canvas for pictures.** Everything in this document happens on the
  canvas the editor already has. A raster mode would double the number of places
  every future feature has to work.
- **Automatic face detection from a photograph.** Finding eyes in a photo is a
  model; finding a file called `eye.png` is a string. P1 and P2 get most of the
  value for none of the cost.

---

## 5. If only one thing is built

**P1.** It is the only proposal that closes the asymmetry in §1 rather than
narrowing it, and it is the one the rest fall out of: a piece that arrives
knowing what it is needs no clever placement, no name parsing, no *Use as…*, no
depth guess and no explanation of which import button to press.
