# Pseudo-3D baseline (3D-01)

The head turn is generated, so *"it looks better"* is not a claim anyone can
check. This is the measured **before**: nine poses, on the real canvas, read off
the boxes a viewer actually sees rather than the transforms we wrote.

Reproduce with `npx playwright test --project=chromium tests/e2e/ux41-pseudo-3d.spec.js`;
the spec prints the line below and asserts the properties a turn must already
have.

## Measured, template mascot, 1280×720

```json
{"noseTravel":{"left":76,"right":76},"headTravel":{"left":12.7,"right":12.7},
 "far":"eyeRight","farEyeWidth":0.585,"nearEyeWidth":1.008,
 "headWidth":0.9,"nod":50.8,"diagonalCompounding":0}
```

| Measure | Now | Reading |
| --- | --- | --- |
| Nose travel vs head travel | 76 px vs 12.7 px | **6×** — the parallax works; this is not a slide |
| Far eye width | 0.585 | it compresses hard, the strongest existing rotation cue |
| Near eye width | **1.008** | it does **not** grow. Nothing comes *towards* the viewer |
| Head width | 0.90 | the outline narrows a little (`HEAD_SQUASH = 0.1`) |
| Nod | 50.8 px | the vertical axis works |
| **Diagonal compounding** | **0.00** | see below |

## The one number that names the problem

`diagonalCompounding` is the largest distance, over every measured part,
between where it lands at `headX = 1, headY = -1` and where it would land if
you simply added the sideways displacement to the upward one.

(The first version of this measured the nose's `cx` alone. That number is
structurally zero in any model — a nod cannot move a point sideways — so it
could never have shown the fix. The spec measures both axes and every part now;
the **before** value is still 0, and provably rather than by measurement, for
the reason immediately below.)

It is **exactly zero**, which is not an approximation — it is the arithmetic
signature of the generator's formula:

```js
sample.translateX = round(x * (unit * layer.depth * push + carry.x));
sample.translateY = round(y * (unit * layer.depth * VERTICAL_DEPTH * push + carry.y));
```

`x` and `y` never meet. A diagonal is two independent slides added together, so
a head turned up-and-right is not a head that rotated about two axes; it is a
head that slid twice. Turning a real volume yaw-then-pitch does **not** commute
with adding two displacements, and the gap between them is exactly what a
pseudo-projection would introduce.

Together with `nearEyeWidth: 1.008`, that is the honest summary of the current
turn: **very good parallax, no rotation.**

## What this baseline does not assert

Deliberately. These are the gaps 3D-02 → 3D-08 exist to close, and a failing
test everyone learns to ignore is worse than a gap that is named:

| Gap | Why it is not a test yet |
| --- | --- |
| Asymmetric silhouette | the outline narrows uniformly (`scaleX`); a turned head's far cheek should come in and its near cheek should not |
| Real occlusion | nothing in the runtime reorders a single SVG node — see below |
| Near-side growth | `nearEyeWidth` should exceed 1 once features have a virtual Z |
| Shape deformation | the nose, eyes and mouth keep their drawn shape; only their boxes move |

## Occlusion is absent, not partial

Verified by reading the runtime, because it changes what 3D-02 and 3D-03 are for:

* `compileRigFrame` sets `frame[id].depth` and **never** sets `depthBand` for an
  ordinary element;
* `depthBand()` is called in exactly one place in the whole runtime —
  `hands.js:182`, for the two hands;
* the map those bands are collected into feeds **nothing except its own
  hysteresis on the next frame**;
* there is no `insertBefore` anywhere in `project/runtime/`.

So depth drives the parallax offset and has never driven draw order. An ear
cannot pass behind a head today, whatever its depth says.

## What is safe to reorder (design note for 3D-03)

The audit flags reordering as the risky item — *"sinon on risque de casser
clipPath, mask, nested groups, transform inheritance"*. Measured on the template
rather than assumed, the risk is smaller than it looks, and one rule removes it
entirely.

The template's structure:

```text
faceRoot
├── earLeft, earRight          groups
├── hairBack, head, …          paths
├── eyeLeft, eyeRight          groups, each clip-path="url(#eyeSocket…)"
├── eyebrows                   group
└── hairFront                  group, clip-path="url(#headShape)"
```

Three clip-paths, and every one of them sits **on the element that is clipped**,
referring to a `<clipPath>` in `<defs>` **by id**. A `url(#…)` reference does not
care where its user sits in the tree, so moving a clipped group among its
siblings carries its clip with it, unchanged.

The rule that makes reordering safe is therefore one line:

> **Reorder only among an element's own siblings, never across parents.**

Within one parent, transform inheritance is identical for every child by
definition, no clip is entered or left, and no nested group is opened. What
changes is paint order and nothing else — which is exactly and only what
occlusion needs.

Two constraints follow, both already available:

* **order within a band is the document's own order.** Bands are coarse
  (`behind` / `normal` / `front`); inside one, the artist's stacking is the
  answer, so a reorder is a stable partition rather than a sort;
* **touch the DOM only when a band changes.** `depthBand()` already has
  hysteresis (a sticky middle) for precisely this: a feature hovering on a
  threshold must not swap places every frame.

## The rest of the audit, checked

| Claim | Verdict |
| --- | --- |
| The generator displaces linearly, `translateX ≈ headX · unit · depth` | **Confirmed** verbatim (`head-pose-turn.js:284`), with `carry` for inherited group motion |
| `FAR_NARROW 0.35`, `HEAD_SQUASH 0.1`, `CENTRE_NARROW 0.15` | **Confirmed** — and `HEAD_SQUASH` is the one of the three that 3D-05 replaced rather than kept (see *After*, below) |
| A warp's driver is only `{parameter, min, max}` | **Confirmed** (`warp-grid.js:163`) — a warp is one deformation whose intensity is modulated, not a grid of configurations. 3D-11 is correctly last |
| `compileRigFrame` budget | **Confirmed**: the stress test asserts under **4 ms** per frame |
| Shape keys have no authoring | **Narrower than that, and it matters** — see below |

### Shape-key authoring is not missing; it is only reachable one way

A semantic movement can already be given the `shapeKey` method
(`part-model.js:158`), and calibrating it captures the shape. So capture,
ownership (`generatedBy`), regeneration and the node-edit migration all exist and
are tested.

What does *not* exist is capturing a shape key for anything the **registry does
not know**. A shape key can be "the mouth's `mouthOpen` movement"; it cannot be
"this path, deformed for `headX = +1`", because there is no registered part or
control to hang it on.

That is what 3D-06 has to add, and it is much less than a shape-key editor: the
engine, the capture, the ownership and the migration are all there. The missing
piece is **a second owner for a shape key — a head-pose cell instead of a
semantic control.** 3D-07's automatic perspective corrections are then writes
through that same door.

---

# After 3D-05: the same nine poses, one rotation

`3D-04` added the projector (`core/projection/pseudo-projector.js`); `3D-05`
wired the generator to it. Re-measured the same way, same fixture, same spec:

```json
{"noseTravel":{"left":73.6,"right":73.6},"headTravel":{"left":12.7,"right":12.7},
 "far":"eyeRight","farEyeWidth":0.563,"nearEyeWidth":0.97,
 "headWidth":0.866,"nod":51.7,"diagonalCompounding":32.97}
```

| Measure | Before | After | Reading |
| --- | --- | --- | --- |
| **Diagonal compounding** | **0.00** | **32.97 px** | the point of the change: a corner pose is no longer the two edge poses added up |
| Head width | 0.900 | 0.866 | `cos(30°)` — derived from the sweep instead of tuned |
| Far eye width | 0.585 | 0.563 | both eyes now also carry the outline's honest cosine |
| Near eye width | 1.008 | 0.970 | the near/far *ratio* is unchanged at 1.72; the common factor moved |
| Nose travel | 76 px | 73.6 px | −3 %, and it is the outline's narrower squash, not less parallax |
| Nod | 50.8 px | 51.7 px | `sin(18°)` against the old linear `0.6` |

## What actually changed in the generator

Three things, and only these:

1. **The displacement is a rotation.** `projectFeature` yaws then pitches the
   part's centre about the head's, so `headX` and `headY` meet inside one
   transform. That is where the 33 px comes from: a part already swung round by
   the turn has spent depth it no longer has to spend on the nod.
2. **The outline's squash is the turn's own cosine.** `HEAD_SQUASH = 0.1` is
   gone; the head narrows by `cos(yaw)` and shortens by `cos(pitch)`. This is
   not a look change (0.900 → 0.866). It is what lets a feature drawn *inside*
   the head subtract exactly what the head already does to it.
3. **Nesting subtracts placements, not depths.** `carriedFrom` still computes a
   differential depth, but the sample is now written as the part's own
   projection minus what every part it is drawn inside already does *at this
   part's centre* — translate and scale about that part's centre both. The old
   subtraction of depths was exact only because the old displacement was
   `unit · depth` and so identical for parts at equal depth; a rotation also
   turns a part's offset from the axis, and subtracting depths would have left
   an eye pulled inwards twice.

Point 3 is what keeps the change honest, and it is worth stating as a property:
**the composed screen motion of a part does not depend on whether it is drawn
inside the head group or beside it.** That is asserted directly (*"the near and
far halves of a pair no longer travel the same distance"*), and it is why the
whole of the existing unit suite passed unchanged — every invariant the linear
formula guaranteed still holds, exactly, to the last decimal the samples store.

The visible gain on a nested rig is the diagonal and the far/near swing
(the far eye's screen travel drops from 16.6 px to 15.3 px while the near eye's
rises from 24.2 px to 25.5 px, so the swing widens from 1.46× to 1.66×). On a
**flat** rig — features drawn beside the head rather than inside it — the gain is
much larger, because nothing was supplying the cosine at all: the two eyes used
to travel identically and now differ by 10 px.

## Deliberately still open

* **`virtualZ` is computed and dropped.** The projector reports where a part
  ended along the depth axis, negative once it has passed behind the head's
  centre. 3D-02 built the `depth` keyform channel that is its home, but nothing
  reorders yet, so writing it would be storing a number no one reads. It lands
  with 3D-03, as a difference from the element's authored depth.
* **The silhouette is still symmetric** and there is still no real occlusion —
  both named as gaps above, both unchanged by this item.
