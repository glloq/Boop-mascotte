# Depth and parallax

There is no Z axis, no camera and no projection. Each element carries a scalar
`depth`, and the head pose nudges it sideways by a fraction of that.

```text
hairFront   +0.8
nose        +0.6
eyes        +0.3
face         0
ears        -0.2
hairBack    -0.8
```

```js
offsetX = headX * depth * parallaxAmount
offsetY = headY * depth * parallaxAmount
```

Two multiplications per element, and a mascot reads as having volume.

Implementation: `project/runtime/depth.js`.

## Settings

```js
parallax: {
  enabled: true,
  amount: 6,
  parameterX: 'headX',
  parameterY: 'headY',
  bands: [-0.35, 0.35],
  hysteresis: 0.08
}
```

`depth` is clamped to `[-1, 1]`. An element with no depth, or a rig with no
parallax settings, compiles exactly as before — the offset is added alongside
the pose contribution and under the same constraints, so a disabled `translate`
constraint disables parallax with it.

## Draw order

Depth also sorts. The roadmap is explicit about what to avoid:

```text
depth > 0 → front
depth < 0 → behind      ← flickers whenever a depth sits on the boundary
```

Instead there are three discrete **bands** — `behind`, `normal`, `front` — with
**hysteresis**. An element already at the front must come back past the
boundary *plus* a margin before it drops out; symmetrically at the back. A
depth hovering on a boundary therefore stays where it is instead of swapping
order every frame.

`depthOrder()` sorts back to front within the whole set, tie-breaking on id so
equal depths keep a stable order rather than shuffling between frames.

## Every element reports a band

`frame[id].depthBand` — `behind`, `normal` or `front` — is reported for **every**
element, and the engine feeds the previous frame's bands back in, so the
hysteresis above is live for all of them. Since 3D-02 the depth it is computed
from is the *effective* one: the authored depth plus whatever the `depth`
keyform channel adds, so a pose can push a part back and the band follows.

**The offset above is not.** `parallaxOffset` reads the authored depth alone,
because it is the cheap stand-in for a rotation — three multiplications where
`core/projection/pseudo-projector.js` does the real thing — and whatever writes
a depth pose has already done that rotation and reported where the part landed.
Running both displaces the part twice, by two different approximations of one
movement; it visibly broke the left/right symmetry of a generated head turn
when it did. So: **a depth pose says where a part is in the stack, a translate
pose says where it is on screen.**

The head turn is the first thing that writes it: a generated turn reports how
far its projection left each feature from where it was drawn (3D-08,
`docs/PSEUDO_3D_BASELINE.md`), which is what makes a far ear repaint behind the
head instead of over it.

## The band is the paint order (3D-03)

A depth of `-0.8` used to buy a sideways nudge and nothing else: the part still
painted wherever it was drawn, because SVG has no z-index and nothing moved a
node. `runtime/draw-order.js` closes that, under one rule:

> **Reorder only among an element's own siblings, never across parents.**

Within one parent, transform inheritance is identical for every child by
definition, no clip is entered or left, and no group is opened; what changes is
paint order and nothing else. So a *scope* is one parent's own rig elements,
resolved once when the engine is built, and reordering permutes them through
the positions they already occupy — a decoration drawn between two of them
never moves. Inside a band the artwork's own order is kept: this is a stable
partition into three, never a sort. Artwork under `<defs>`, a `<clipPath>`, a
`<mask>`, a `<pattern>`, a `<marker>` or a `<symbol>` is skipped outright.

The DOM is touched only when a band actually changes, which is what the
hysteresis above is for. A hundred frames at the same depth cost zero writes,
and that is asserted rather than asserted-about.

`parallax.drawOrder: false` keeps a rig's artwork stacked exactly as it was
drawn. The default is on, because a depth was authored to mean something.

**The editor canvas is deliberately not reordered.** The canvas DOM *is* the
authored document — `refreshDocument()` reads the live nodes back through
`documentModel.load()` and `serialize()` — so a preview-time reorder that
happened to be in place when the author drew a shape would be written into
`svgMarkup` as their layer order. Occlusion therefore shows in the exported
mascot and on the runtime demo page, not on the authoring canvas. Making it
visible while authoring means giving the canvas a render tree distinct from the
document, which is a much larger change than this one.

## Hands

A hand has its own `depth`, plus a `handLDepth` / `handRDepth` parameter that
animates it. `evaluateHands` runs after the element loop and overwrites both
`depth` and `depthBand` for the two hands, so a hand's band is the hand's and
not its artwork's — hysteresis applies to a hand crossing in front of the body
exactly as it does to hair crossing behind a head. Depth is deliberately
excluded from hand inertia: draw order must not wobble.

## What this is not

No Z buffer, no perspective divide, no per-element camera. If a mascot ever
needs more than this, that is a signal to simplify the mascot, not to add a
renderer — see `docs/FUTURE_OUT_OF_SCOPE.md`.
