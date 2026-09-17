# V4 — a mascot can be made of pictures

*Release notes for the V4 programme (V4-111, `docs/V4_ROADMAP.md`).*

Until V4, Boop could only animate an SVG. Everything below exists so that a
person with a photograph, a drawing exported as a PNG, or a folder of pieces
from any paint program can build the same mascot — rigged, animated, reacting —
without owning a vector editor or knowing what one is.

## What you can do that you could not

- **Start from a picture.** Home offers it beside *Import an SVG*. Drop a PNG or
  a WebP onto the canvas at any time, or import one as the head or body that
  everything else is placed on.
- **Mix pictures and drawings** in one mascot. A photographed head with drawn
  eyes is an ordinary project.
- **Replace a picture** without losing its rig. The movements, expressions and
  reactions that pointed at it keep pointing at it.
- **Cut a picture to the shape of another**, using its alpha rather than its
  rectangle.
- **Bend a picture** with a small mesh, drag its points on the canvas, and drive
  the bend from a parameter — a mouth that opens is a picture that bends.
- **Save the whole project as one `.boop` file**, pictures included, that
  survives being emailed.
- **Say *only if* on a reaction.** A click that waves when the mascot is idle
  and shrugs when it is busy is two reactions with two conditions.
- **Lay out the state machine** by hand: drag the nodes, draw the transitions,
  group them, annotate them, and watch the state the mascot is in light up.

## What holds it together

Four decisions carry almost all of it. Each is written down where it is
implemented, and each closed several risks at once.

**Artwork never carries binaries.** A raster node is
`<image href="asset:<hash>">`; the bytes live in a store outside the document and
are resolved to an object URL at paint time. Which means the sanitizer's rule —
*no external references* — stays literally true, undo's `structuredClone` stays
cheap whatever the picture weighs, the autosave snapshot stays JSON, and a
`.boop` file is portable. The validation matrix measures this directly: the
asset table costs under 300 bytes per picture, whatever the picture is.

**An asset's id is its content.** The id is the SHA-256 prefix of the stored
bytes, so importing the same file twice stores it once and a reference can never
name the wrong picture. There is no separate hash field to disagree with it.

**A file declares the oldest reader that can open it**, not the newest thing
that wrote it. A paths-only project still says version 3 after being opened by
this editor; it gains 4 when it holds a picture and 5 when it holds a mesh.

**Anything an old runtime would run *wrong* is named in `requires`.** A
`gaze-follow` trigger, an idle trigger and now a reaction condition are not
additive: a runtime that does not know about a condition does not skip the
reaction, it fires it unconditionally. Such a rig is declined by name rather
than played incorrectly.

## What did not get built, and why

- **MIDI and audio triggers** (V4-104). A panel for inputs the runtime does not
  have is UI for something that cannot run — the exact mistake the `requires`
  mechanism exists to prevent. The triggers that do exist are simulated already.
- **JPEG import.** PNG and WebP only. A mascot piece needs an alpha channel, and
  a JPEG's lack of one is a support request rather than a feature.
- **A state graph on the canvas.** The diagram is real now — positions are
  authored, saved and undoable — but it is drawn in a ~260 px sidebar column,
  where a four-state machine fits at just under half size. Moving it is a shell
  change, not a graph change.

## Where to read more

| Subject | Document |
| --- | --- |
| The programme, PR by PR, with what building each phase corrected | `docs/V4_ROADMAP.md` |
| What a project file actually is | `docs/PROJECT_FORMAT.md` |
| Everything still missing | `docs/KNOWN_LIMITATIONS.md` |
| The five reference mascots and the matrix they are run through | `project/editor/core/tests/v4-matrix.test.js` |
