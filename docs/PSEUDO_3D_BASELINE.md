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

`diagonalCompounding` is the distance between where the nose lands at
`headX = 1, headY = -1` and where it would land if you simply added the
sideways displacement to the upward one.

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
