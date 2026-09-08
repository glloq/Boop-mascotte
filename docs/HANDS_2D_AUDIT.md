# Hands: audit before the 2D refit

The floating hands are being taken off a **continuous pseudo-3D turn** and put
onto **static 2D drawings chosen by pose and view**. This is what was there
before that change, what it depended on, and what survives it.

Read with `docs/HAND_RIGGING.md` (what a hand is), `docs/HANDS_2D.md` (what it
becomes) and `docs/HAND_REPRESENTATIONS_STUDY.md` (how the drawing got here).

## What a hand is today

```text
BODY
 └─ anchor ── handLeft (g)              transform: reach · drift · turn · size
                ├─ handLeftPalm         path, restPath + shape keys
                ├─ handLeftRing         ⋮
                ├─ handLeftMiddle
                ├─ handLeftIndex
                ├─ handLeftThumb
                └─ handLeftCuff
```

One group, six paths, and a wall of shape keys over them. The group carries
**where the hand is**; the paths carry **what the hand looks like**, and every
change of look is a deformation of the same six outlines.

### The turn is a morph

`handLFacing`, `-1 … 1`, is the pseudo-3D. `hand-artwork.js` holds three view
tables — `FRONT` (palm to the viewer), `PROFILE` (thumb to the viewer), `FAR`
(the profile turned over) — and `installHands` bakes each non-front view as a
shape key **per part**, weighted by a `pathShape` keyform over the facing axis:

```text
handLFacing  −1 ──────────── 0 ──────────── 1
             FAR            FRONT         PROFILE
             ↑ key per part, weight 1 at its own stop, 0 elsewhere
```

Between two stops every one of the six paths is interpolated point by point.
That is the thing being removed. Its failure is not the stops — they are
drawings, and they read — it is everything **between** them: a palm halfway to
a profile is neither, the thumb slides across the palm as a lozenge, the
knuckle fold stretches, and a hand that moves while it turns wobbles.

A pose that has a profile drawing of its own gets three keys per part gated by
a `pose × facing` grid, so the number of keys on a generated pair is
`6 parts × (2 views + 9 poses × 3 + 4 curls + 1 grip)` — several hundred paths
recomputed whenever anything moves.

### Everything else that deforms

| Parameter | What it deforms |
| --- | --- |
| `handLFacing` | every part, between three view tables |
| `handLFist`, `handLPoint`, `handLPeace`, `handLThumbsUp`, `handLSpread`, `handLRelax`, `handLOk`, `handLPinch`, `handLStop` | one key per part per pose (×3 when the pose has a profile) |
| `handLThumb`, `handLIndex`, `handLMiddle`, `handLRing` | one curl each, per part |
| `handLGrip` | all four curls at once |
| `handLFlip` | legacy: mirrored the single-outline hand. Not written for new pairs |

### Everything that does not deform

| Parameter | What it does |
| --- | --- |
| `handLX`, `handLY` | position inside the reach ellipse, soft-limited |
| `handLRotation` | turn of the whole group |
| `handLScale` | size of the whole group |
| `handLDepth` | draw order band (behind · normal · front) |
| `handLShow` | out from behind the head: translate, scale and depth keyforms |

These are the part worth keeping. They are the Rayman idea — the hand moves,
it does not bend — and the refit is built on them unchanged.

## The files

| File | What it holds | After the refit |
| --- | --- | --- |
| `project/runtime/hands.js` | record, reach, anchor drift, `evaluateHands`, reveal | **kept**, extended with sprite selection |
| `project/runtime/inertia.js` | the spring behind cartoon lag | **kept, untouched** |
| `project/runtime/depth.js` | depth bands and their hysteresis | **kept, untouched** |
| `project/editor/core/hands/hand-model.js` | authoring commands, mirroring, reach guide | **kept**, pose/view commands added |
| `project/editor/core/hands/hand-commands.js` | the undoable wrappers | **kept**, extended |
| `project/editor/core/sample/hand-artwork.js` | the glove geometry and the view tables | **kept as a drawing tool**: it draws the sprites once, at authoring time |
| `project/editor/core/sample/hand-feature.js` | `installHands`, the facing axis, pose capture | **split**: placement kept, facing keyforms replaced by sprites |
| `project/editor/core/sample/hand-set.js` | method B, a drawing per pose | **superseded** — the sprite library is this idea, finished |
| `project/editor/rig-editor/hands/hand-setup-panel.js` | the Hands card, the numeric pose editor | **kept**, pose/view controls replace the facing chips |
| `project/editor/core/puppet/hand-handles.js`, `hand-console.js` | the on-canvas console | **kept**, the facing slider becomes a view row |
| `project/editor/core/projection/pseudo-projector.js` | head turn only | **not a hand file**; unchanged |

Nothing in the head or the face reads a hand parameter, and no hand file
touches `head-pose/`. The two systems meet only at `compileRigFrame`, which
resolves hands after the ordinary elements so an anchor can follow a body that
has already moved.

## Assets

There are none on disk. A hand is **generated** — `handsMarkup` writes the six
paths from the tables, `installHands` rigs them — and `docs/figures/*.svg` are
documentation figures, not runtime assets. The default mascot template ships
the generated pair inline in its artwork.

So the refit has no legacy asset directory to migrate, and no imported artwork
to preserve beyond what a project already carries in its own SVG.

## Presets, clips and bindings

* `HAND_WAVE_CLIP` — rotation, `handLY` and `handLShow`. **No shape at all**:
  a wave is already a turn of a still hand, which is exactly the principle the
  refit is built on.
* `HANDS_UP_CLIP` — show, X, Y and `handLSpread` on both sides. Only the
  spread is a deformation; it becomes a pose swap.
* `HANDS_OUT_EXPRESSION` — both show parameters at 1. Untouched.
* Reactions reach hand gestures by parameter name (`docs/HAND_GESTURES.md`).
  Every name kept by the refit keeps working; the pose names become one
  `handLPose` selector, with the old per-pose parameters bridged.

## Tests

| Suite | What it pins |
| --- | --- |
| `hands.test.js` | record, reach, drift, mirroring, inertia, export |
| `hand-feature.test.js` | the generated pair, the facing keys, pose capture |
| `hand-set.test.js` | method B drawings |
| `hand-placement.test.js` | where a pair lands on an artboard |
| `hand-setup-panel.test.js` | the Hands card |
| `hand-handles.test.js`, `hand-console.test.js` | the on-canvas console |
| `hand-gestures.test.js` | reactions reaching a hand |
| `hand-mode.test.js` | the hand workspace |
| `tests/e2e/ux32-hands.spec.js`, `ux39-hand-mode.spec.js` | the browser journey |

All of them are kept green through the refit: the facing axis stays installed
until the sprite pipeline is proven, and the tests that pin it are only
retired with it.

## What is removed, and when

Removed **only after** the sprite pipeline draws a pair and the browser suite
passes on it:

* the `handLFacing` shape keys and their `pathShape` keyforms;
* the `pose × facing` gates;
* the thumb's depth and opacity grids over the facing axis;
* the facing chips in the Hands card and the facing slider on the console;
* `handLFlip`, which the single-outline hand needed and nothing writes.

Kept for loading old projects, and marked deprecated:

* `hand.legacyPseudo3D`, set by the migration on any hand that carried a facing
  axis, so its keys keep playing and nothing on screen changes until the author
  converts it.

## What migrates

```text
handLFacing  −1 … −0.5   →  view = sideLeft        (thumb away → the far side)
             −0.5 … 0.5  →  view = front
              0.5 … 1    →  view = sideRight
handLFist = 1            →  pose = fist
handLSpread = 1          →  pose = open
```

The facing value is the orientation variable `PHASE 16` asks for, so a
migrated project keeps the hand it had: the same drawing, chosen instead of
morphed.
