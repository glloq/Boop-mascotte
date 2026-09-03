# Warp grid

```text
●────●────●
│    │    │
●────●────●
│    │    │
●────●────●
```

A warp grid is the **escape hatch**, not the default. It exists for shapes that
transforms and shape keys cannot animate convincingly:

* a face outline;
* hair;
* a fat cheek;
* some soft accessories.

Everything else should stay on transforms and shape keys. The roadmap is
explicit: a warp grid must never delay head poses, hands, transitions or shape
keys, and it must never become a mesh.

Implementation: `project/runtime/warp-grid.js`.

## Sizes

Recommended `3 × 3` or `4 × 4`; exceptionally `5 × 5`. The engine refuses
anything outside `2 × 2 … 5 × 5`, and validation says so in those words. Dense
grids are not encouraged, and there is no path to one.

## How it works

The grid is a rest lattice over the element's bounding box, with the outer ring
exactly on the box, so no path point ever falls outside it.

```text
SVG path point
      ↓
located once in the rest grid   (cell + fraction)
      ↓
bilinear blend of the four surrounding control points
      ↓
displacement
```

`compileWarpTarget` parses the path and locates every point **once**. Per frame
all that remains is a blend and one string rebuild — and when the grid is at
rest, not even that: `warpDisplacement` returns `null` and the original string
is reused.

## Composing with shape keys

A warp produces a **displacement vector**, not a finished path, so a warped
element can still carry shape keys: both are offsets on the same numeric vector
and they simply add.

```text
final = rest + Σ(shapeDelta × weight) + warpDisplacement
```

A smiling mouth inside a warped cheek smiles and bends at the same time, and
only one string is built for it.

## Driven warps

```js
driver: { parameter: 'wind', min: 0, max: 1 }
```

Optional: the whole grid fades between rest and its authored positions, clamped
at both ends. Without a driver the warp is simply always on.

## Two interpolations, never mixed

| | Domain | Module |
| --- | --- | --- |
| **Parameter** interpolation | `headX × headY` → a value | `keyforms.js` |
| **Spatial** interpolation | `gridX × gridY` → a coordinate | `warp-grid.js` |

Both are bilinear and they look alike; they mean entirely different things.
Separate modules, separate tests, and a test that states the difference.

## Editing

```text
Select element → Add Warp → choose 3×3 / 4×4 → drag handles → Capture
```

Similar in spirit to point-based rigging, enormously simplified: there is no
weight painting, no falloff curve and no topology to maintain.

`project/editor/rig-editor/warp/warp-panel.js` is deliberately **reluctant**:
it lives behind an "advanced" disclosure, it opens by saying what a warp is for
and that "everything else is better without one", and it explains why a shape
cannot take one rather than only greying out a button.

| Action | Behaviour |
| --- | --- |
| Add warp to selection | captures the element's current outline as its rest and builds the lattice over its box, in one undo step |
| Grid | 3×3, 4×4 or 5×5; retuning puts the control points back at rest, because the old ones no longer fit |
| Faded by | pick the parameter that fades the warp, or leave it always on |
| Reset | control points back to rest, warp kept |
| Remove | warp removed; the rest outline stays |

A second warp on the same shape is refused: one grid per shape keeps the
composition with shape keys a simple sum.

## Diagnostics

Structure is validated against **what the author wrote**, not against the
normalized record, because normalization would quietly repair a grid the author
needs to know about: a missing target, a shape with no rest outline, an outline
that cannot be parsed, a size outside the allowed range, the wrong number of
control points, a non-numeric point, an area with no size, a duplicate id, and
a driver parameter that no longer exists.

## Tests

`warp-grid.test.js` covers the rest lattice, size clamping, point location and
clamping, bilinear sampling, the idle no-op, inner and outer control points,
structure preservation, a 4×4 grid, weighting, composition with shape keys, a
warp with no shape keys, a driven warp, a missing rest outline, normalization,
the diagnostics, and the separation from parameter interpolation.
