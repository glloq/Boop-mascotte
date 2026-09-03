# Head pose 2.5D

```text
              HEAD X

        -1      0      +1

      ┌──────┬──────┬──────┐
 -1   │  ↖   │  ↑   │  ↗   │
      ├──────┼──────┼──────┤
  0   │  ←   │  ●   │  →   │
      ├──────┼──────┼──────┤
 +1   │  ↙   │  ↓   │  ↘   │
      └──────┴──────┴──────┘

              HEAD Y
```

`headY` grows **downwards**, like every vertical parameter in the rig: the head
movement is calibrated UP at `-1` and DOWN at `+1`, and so is `lookY`. The grid
and the live pad follow that, so the top row is where the head looks up and
dragging the pad up moves the head up. (Both used to be inverted, which made
dragging up move the head down.) The pad's readout says the direction rather
than the sign: `up 0.96`, not `headY -0.96`.

An author poses the mascot at a cell and captures it. Between cells the keyform
engine interpolates, and the head reads as turning.

**This is a cartoon illusion of rotation, not a 3D rotation.** Nothing projects,
nothing has a camera, and no mesh exists. That is the whole point: 80–90 % of
the effect for a fraction of the machinery.

Implementation: `project/editor/core/head-pose/head-pose-model.js` and
`head-xy-pad.js`.

## Stored as ordinary keyforms

A head pose is not a new runtime concept. Each (element, channel) pair becomes
one v4 keyform over `headX × headY`:

```text
headPose:face:translateX
headPose:nose:translateX
headPose:earLeft:opacity
headPose:mouth:pathShape:smile
```

The runtime therefore needs no head-pose code at all — it evaluates keyforms,
as it does for everything else, and preview and export agree by construction.

## What a cell captures

Simultaneously, for as many parts as the author posed:

head outline · face · eyes · pupils · eyebrows · nose · mouth · ears · hair ·
attached accessories

Per element a cell can hold `translateX`, `translateY`, `rotation`, `scaleX`,
`scaleY`, `opacity`, and any number of shape-key weights.

`headPoseSamplesFromTransforms` converts posed transforms into what a cell
stores, matching how the frame compiler composes keyforms:

| Channel | Stored as |
| --- | --- |
| `translateX`, `translateY`, `rotation` | difference from rest |
| `scaleX`, `scaleY`, `opacity` | factor over rest |
| shape keys | weight |

So a captured cell reproduces exactly the transform that was posed.

## A cartoon turn

For `headX = +1`:

```text
face     → small translation
nose     → stronger translation
near eye → slightly larger scale
far eye  → slightly smaller scale
near ear → more visible
far ear  → less visible
mouth    → translation + a small shape key
hair     → slight offset
```

That is enough to feel like volume.

## Generating one

Nothing ever put a turn in the grid: every template shipped with it empty, so
`headX` only ran its own binding — a plain sideways translation. **Turning the
head slid it.** Filling nine cells by hand, on artwork that has to be posed part
by part, is not a starting point.

`core/head-pose/head-pose-turn.js` builds the table above out of the semantic
parts the project already has. One button in the Head pose panel, one atomic
command, one undo step — and what it writes is ordinary head-pose keyforms, so a
generated cell and a hand-posed one are the same thing afterwards and either can
replace the other.

| It knows | Because |
| --- | --- |
| how far each part travels | the role it plays: the nose is closest to the viewer (`depth: 1`), the ears sit on the axis (`0.15`) |
| which half is coming towards you | `leftEye` / `rightEye` and the sign of `headX`; turning right brings the left side forward |
| how big the whole effect is | the head's measured width (about 5 % of it), or what the head movement itself travels when nothing can be measured |
| whether a part already moves with the head | the layer tree: a feature drawn inside the head group inherits its motion, a sibling has to carry it itself |

### Scaling has to happen around a part's own middle

The near/far foreshortening is what reads as volume, and a scale happens around
the element's stored pivot. Most artwork carries none — `(0, 0)`, the corner of
the drawing — so scaling there throws the part across the face.

The first version corrected that with a translation
(`pivot + s·(c − pivot) + t = c`, which does hold the centre still). It was
right arithmetic and wrong design: the correction grows with the distance from
the origin, so it swamped the parallax and the two halves of a face travelled
completely differently — one pupil moved 0.9 units and the other 26.5. All that
read as, on screen, was the head sliding sideways: **exactly the symptom the
2.5D turn exists to remove.**

Generating a turn now sets the pivot instead, once, for the parts it scales and
only where none was configured. On an element that is not yet rotated or scaled
— which is what an unset pivot means in practice — moving the pivot changes
nothing on screen, and from then on there is nothing to correct: each part
travels by its parallax and scales around itself. The correction stays for a
pivot the author placed by hand, where it is small and correct.

Two limits are deliberate:

- **A scale needs to know where the part is.** Scaling happens around the
  element's stored pivot, which for most artwork is `(0, 0)` — the corner of the
  canvas — so scaling there flings the part across the drawing. The near/far
  scale is therefore only generated when the editor could measure the part, and
  it comes with the translation that keeps that measured centre still
  (`pivot + s·(c − pivot) + t = c`). Unmeasured, the turn is translation plus
  the fading far ear, which needs no geometry.
- **Only assigned face parts take part.** Hands are not on the head, and a
  generic accessory could be anything. Decoration drawn inside the head still
  travels with the group; it just does not gain any parallax of its own.

Vertical travel is 60 % of horizontal: looking up or down reads mostly through
the outline, and overdoing it walks the mouth into whatever is drawn above it.

## Grid actions

| Action | Behaviour |
| --- | --- |
| **Capture** | write every posed channel for every posed element into one cell |
| **Reset** | clear one cell, or the whole grid; keyforms left empty are removed |
| **Copy / Paste** | move a whole cell, all elements included, to another cell |
| **Mirror Horizontal** | swap columns, flip `translateX`/`rotation`, trade paired elements |

Cell state, for the grid UI:

| State | Meaning |
| --- | --- |
| `empty` | nothing captured here |
| `neutral` | captured, and every channel is at rest |
| `captured` | captured, and something moved |

### Mirroring

Mirroring maps a column to the one whose axis value is its negation (so an
asymmetric axis mirrors onto the samples it has), flips the sign of
direction-dependent channels, and swaps paired elements — otherwise a left ear
would fade on the right side of the face.

```js
mirrorHeadPoseHorizontal(keyforms, axes, { earLeft: 'earRight' })
```

`onto` (default) writes the mirrored cells over the grid and keeps what the
mirror does not reach — pose one side, get the other. `replace` discards the
original grid, which is how a whole rig is flipped.

## Capture is transactional

Every function returns a **new** keyform list and never mutates the one it was
given. Cancelling a capture is therefore simply keeping the previous list: the
exact previous state, with no undo bookkeeping of its own.

## The panel

`project/editor/rig-editor/head-pose/head-pose-panel.js` renders the grid, the
actions and the pad. It owns no pose data: it reads the keyform list and writes
through atomic commands, so undo, redo and cancel all work without it taking
part.

Capture is a **transient canvas pose session**, not a read of the authored
transforms. Pressing Capture puts the canvas into pose mode; the author moves
the artwork; pressing Capture on the canvas banner records the difference from
where each part started. Cancel restores the artwork exactly and writes
nothing, and a command that would change nothing does not write at all — so
undo always corresponds to something the author actually did.

Cells are labelled by direction (`↖ ↑ ↗ / ← ● → / ↙ ↓ ↘`) and coloured by
state, and each carries a spoken label — "Head 1 across, 0 up. captured, 5
parts" — so the grid is usable without seeing the colours.

## Head XY pad

```text
      ↑
      │
←─────●─────→
      │
      ↓
```

`head-xy-pad.js` is pure geometry, shared by pointer, touch and keyboard so the
three cannot drift:

| Function | Purpose |
| --- | --- |
| `padValueFromPoint` | pointer/touch position → parameters (clamped) |
| `padPointFromValue` | parameters → handle position |
| `padKeyboardValue` | arrow keys nudge, Shift coarsens, Home/Escape recentre; returns `null` for keys the pad does not own |
| `padCenter` | the axis position nearest rest |

The pad's Y axis points up, the way the grid is drawn, while screen coordinates
grow downwards. That conversion happens in this module and nowhere else.

## Axes

The default grid is `headX = [-1, 0, 1]` by `headY = [-1, 0, 1]`, but the axes
are ordinary keyform axes: irregular and any length. `setHeadPoseAxes` retunes
the grid, dropping the captures that no longer fit, exactly as elsewhere.

## Tests

`head-pose.test.js` covers a neutral pose left unchanged, headX left/right,
headY up/down, diagonal interpolation, exact cells, between-cell blends,
clamping outside the grid, multi-element capture, shape-key capture, cancelled
capture, reset, copy/paste, both mirror modes, axis retuning, and the pad's
pointer/keyboard/round-trip behaviour.
