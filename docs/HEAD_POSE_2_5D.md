# Head pose 2.5D

```text
              HEAD X

        -1      0      +1

      ┌──────┬──────┬──────┐
 +1   │  ↖   │  ↑   │  ↗   │
      ├──────┼──────┼──────┤
  0   │  ←   │  ●   │  →   │
      ├──────┼──────┼──────┤
 -1   │  ↙   │  ↓   │  ↘   │
      └──────┴──────┴──────┘

              HEAD Y
```

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
