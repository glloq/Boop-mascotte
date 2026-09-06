# Every tool, and where it is

> "il reste des outils non accessible pour la creation/modification … il faut
> rechercher tout les outils qu'on a et verifier qu'ils sont tous accessible
> facilement pour la contruction d'une mascotte"

An editor that can *play* something it cannot *author* is the failure this page
exists to catch. So: everything the document model can carry, where an author
reaches it, and — at the end — the short list of things that still have no
editor, said out loud rather than left to be discovered.

## Drawing

| Tool | Where | Key |
| --- | --- | --- |
| Select · Node · Pen · Line · Rectangle · Ellipse · Polygon/Star · Text · Hand | the toolbar above the working area (Artwork), and the command palette | `V N P L R O S T H` |
| Fill, stroke, stroke width, corner radius, sides / star, font size, text | the options line under the toolbar, for the tool in hand | — |
| Colour | the swatch beside Fill and Stroke, in the Inspector and in the options line → the colour dialog | — |
| Grid, snap, grid size | the options line, always | — |
| Curve · Straight · Smooth · Corner · Delete point | the options line, with the Node tool and a point in hand | `Delete` |
| Align, Spread, Group, **Cut to top** | the options line, with two or more pieces selected | `Ctrl/Cmd + G` |
| Ungroup | the selected row in Layers, the palette | `Ctrl/Cmd + Shift + G` |
| Duplicate, Bring forward / Send backward / To front / To back, Flip, Hide, Lock, Rename, Delete | right-click on the canvas, and the selected row in Layers | — |
| Convert to a path | right-click; **or just click the shape with the Node tool** | — |
| Stop cutting it (release a clip) | right-click on a cut piece | — |
| Working area, Fit to artwork | the Artwork panel | — |
| Import / replace SVG | the Artwork panel, the ••• menu, Home | — |
| Add a part: Eyebrows, Eyelids, Hands | Artwork → Add / Create artwork | — |

Three of those rows were the gaps. **Cut to top** did not exist: a clip could be
shown and released and never made. The **colour dialog** did not exist: a colour
was the operating system's picker, which knows nothing about the drawing. And
the **Node tool refused a shape** — "that is not a path" — when rounding the
corner of a rectangle you have just drawn is exactly what it is for; it converts
now, in one undo step, wherever the tool meets a shape.

## Rigging

| Tool | Where |
| --- | --- |
| Face parts: assign, replace, clear | Face Setup → Face parts. Click the artwork on the canvas, or choose it from the layer list |
| Movements: on/off, method, calibration poses, one side at a time | Face Setup → Movements, and the part's own Controls / Calibrate tabs |
| Shape capture (morph) | the Calibrate tab: move the nodes into the target shape and press Capture |
| Gaze target and limits | Face Setup → Gaze |
| The 2.5D turn: generate, pose, capture, mirror, reset | Face Setup → Head pose |
| Hands: draw a pair, anchor, reach, poses, drawings per pose | Face Setup → Hands, and hand mode on the canvas |
| Handles on the mascot: which exist, their limits and links | Face Setup → Controls |
| Pins, holding, relationships | Face Setup → Pins & holding |
| Warp lattice | Face Setup → Warp |
| Parts of any kind (jaw, ears, hair, accessories…) | Face Setup → All parts → **+ Add Part** |

**Generating the turn now turns its own axes on.** The template has `headX` and
`headY` before anyone presses Generate, so nothing noticed that generating did
not create them — and on a face drawn from the blank canvas the press wrote a
full nine-cell grid driven by parameters that did not exist. A turn nothing
could play.

**A preset part is fitted to the face it joins.** Eyebrows and Eyelids are drawn
against the template's own face, and adding them was refused outright on
anything else ("compatible starter faces"). The reference box — the template's
eye pair, or its head when the eyes are not assigned yet — is mapped onto the
measured one, so the brows sit above the eyes of any face, at its size, and they
are drawn in whatever group holds the head rather than in a `faceRoot` that a
drawn mascot does not have.

## Animation, and everything after it

Expressions, Motions (presets, *Make your own*, and the Timeline key by key),
States & behaviours, Reactions, Preview, Problems, Export and Save are each one
click from the task bar; the palette (`Ctrl/Cmd + K`) finds all of them by name.
The Advanced hub (••• → Advanced) lists the expert surfaces with their
availability: Parameters, Bindings, Timeline, State machine, Behaviors,
Diagnostics, Plugins.

## What still has no editor

The Advanced hub's **Deformation** table says this per project, and it is worth
saying here too:

| System | Authorable? |
| --- | --- |
| Shape keys | Only as a by-product: the template ships them, Head pose captures them, and the Morph method covers the one-shape-per-element case. There is no shape-key editor |
| Deformers | No. Imported or hand-authored |
| Depth / parallax bands | No. The generated turn writes depth; the bands themselves are project data |
| Keyforms | Through Head pose only |
| Path booleans (union, subtract), gradients | Not in the product |

Everything else on this page can be created and changed in the editor.
