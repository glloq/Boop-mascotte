# Runtime performance

A mascot is one thing on a page, not the page. The runtime's job is to be
**boringly cheap**: the frame loop reads numbers it prepared earlier and writes
only what changed.

## Priorities

```text
1  compile references once
2  cache parameter indexes
3  parse paths once
4  use numeric arrays
5  dirty flags
6  update only affected elements
7  avoid unnecessary DOM writes
8  cache WarpGrid mappings
```

## What is compiled once

| Block | Compiled to | Keyed on |
| --- | --- | --- |
| Keyforms | a dense `Float64Array` of samples plus a row layout | the records array |
| Shape keys | parsed rest vector, per-key delta arrays, scratch buffers | the records array + elements |
| Warp grids | each path point's cell and fraction in the rest grid | the records array + elements |
| Deformers | the normalized list (matrices are per frame, they must be) | the records array |
| Expressions | parsed expression ASTs, FIFO-capped at 512 entries | the expression source string |
| SVG nodes | an id → node `Map` built at construction | the SVG root |

The caches are `WeakMap`s on the arrays the rig itself holds, so a running
mascot compiles once and then only reads.

## Per frame

```text
parameters
  ↓ two small locates + at most four weighted samples   (per keyform)
  ↓ sum rest + Σ delta × weight                         (per shape target)
  ↓ bilinear blend of four control points               (per warped point)
  ↓ matrix multiply along the parent chain              (per deformer)
  ↓ attribute diff, then write only what changed        (per node)
```

Two fast paths matter most:

* **an unchanged shape rebuilds no string.** `evaluateShapeTarget` compares the
  new weight vector against the previous one and returns *the same string
  instance* when nothing moved — an idle mascot does no string work at all.
* **an idle warp costs nothing.** `warpDisplacement` returns `null` when the
  grid is at rest.

The engine also diffs every attribute against what it last wrote (`applied`
WeakMap), so an unchanged transform or opacity is not written to the DOM.

## Never, per frame

```text
parse a path            rebuild the whole SVG
clone the project       querySelector the document per parameter
```

`runtime-performance.test.js` asserts these as **contracts**, by reading the
source of the render loop and the deformation functions, rather than as
benchmarks that would vary with the machine.

## Renderer levels

| Level | Work | Used for |
| --- | --- | --- |
| 0 | transform only | hands, pupils, accessories, some eyebrows |
| 1 | shape keys | mouth, eyes, outline, ears |
| 2 | small warp grid | only what needs it |

There is no level 3. No mesh, no WebGL — see `docs/FUTURE_OUT_OF_SCOPE.md`.

## Measurements

On the stress fixture (`fixtures/cartoon-mascot.js`: 12 elements, 49 keyforms
across a full 2.5D head pose, three shape keys, two hands with a pose and
inertia, depth parallax and a two-level hierarchy), on the container that runs
this suite:

```text
compileRigFrame   ≈ 0.09 ms per frame
```

That is roughly 1 % of a 60 fps frame budget, which is the point: the ceiling
asserted by the test is 4 ms, generous enough to pass anywhere and still tight
enough to catch an order-of-magnitude regression.

Targets, as intent rather than a guarantee:

| Platform | Target |
| --- | --- |
| Desktop | 60 fps on a normal mascot |
| Mobile | 30–60 fps, depending on hardware |

## Bundle

| Artifact | Raw | Gzip |
| --- | --- | --- |
| exported `runtime.js` | 46.7 kB | 16.2 kB |
| editor | 609.8 kB | 179.2 kB |

The runtime grew from 17.0 kB / 6.6 kB at the V2 baseline, which is the cost of
keyforms, shape keys, path parsing, hands, inertia, the mixer, transitions, the
hierarchy, depth and warp grids. It imports no editor code, and a test proves
it: the exported bundle loads standalone from a `data:` URL.

## Rules for future work

1. Anything derived from records and not from parameters is compiled once.
2. Anything that produces a string compares its inputs first.
3. A new block must leave a rig that does not use it byte-identical — there is
   a test for exactly that.
