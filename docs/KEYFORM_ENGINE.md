# Keyform engine

A **keyform** binds one channel of one target to one or two parameter axes and
stores a value at grid positions the author captured. Between captures the
engine interpolates; outside them it clamps. That is the whole idea, and it is
what makes head poses, cartoon corrections and pose-driven shape keys possible
without a mesh or a skeleton.

Implementation: `project/runtime/keyforms.js` (canonical, DOM-free) re-exported
by `project/editor/core/keyforms/`. **There is one implementation**, so editor
preview and an exported mascot cannot drift. See `docs/OSS_REFERENCES.md` for
the concept's provenance.

## 1D

```text
Smile:

  -1 ---------- 0 ---------- +1
  sad        neutral       smile
```

```js
interpolate1D([-1, 0, 1], [-8, 0, 8], 0.5) // → 4
```

Axes are **irregular by design**. `[-1, -0.4, 0, 0.7, 1]` is as valid as
`[-1, 0, 1]`, and nothing in the engine hardcodes the symmetric triple.

## 2D

```text
K00 ───────── K10
 │             │
 │      P      │
 │             │
K01 ───────── K11
```

Two axes — typically `headX × headY` — produce a grid. A point inside a cell is
resolved by interpolating along X inside each of the two bracketing rows, then
blending those two results along Y. On a fully captured grid that is exactly
bilinear interpolation; the separable formulation is what lets the same code
handle a partially captured grid.

```js
interpolate2D([-1, 0, 1], [-1, 0, 1], [[0, 1, 2], [3, 4, 5], [6, 7, 8]], 0.5, 0.5) // → 6
```

`grid[j][i]`: `j` indexes the Y axis, `i` the X axis. Axes on the two sides are
independent and may have different lengths and different spacings.

## Sparse grids

An author captures the cells they care about. Missing cells are **holes, not
zeros**:

* along an axis, the blend runs between the nearest *captured* neighbours, so a
  gap in the middle is interpolated across;
* a row with no captures at all is skipped and the blend runs between the
  nearest captured rows;
* a single capture holds for the entire axis;
* an entirely empty keyform resolves to the channel's neutral value.

`null`, `undefined` and non-finite entries are all holes. A non-finite
*parameter* reads as the neutral `0` rather than throwing.

## Extrapolation

| Mode | Outside the axis |
| --- | --- |
| `clamp` (default) | hold the outermost captured value |
| `linear` | extend the outermost segment |

## Records

```js
{
  id: 'head-face-pose',
  target: { kind: 'element', id: 'face' },
  channel: 'translateX',
  axes: [
    { parameter: 'headX', values: [-1, 0, 1] },
    { parameter: 'headY', values: [-1, 0, 1] }
  ],
  keyforms: [
    { at: [0, 1], value: -6 },
    { at: [1, 1], value: 0 },
    { at: [2, 1], value: 6 }
  ],
  extrapolation: 'clamp'
}
```

`at` holds **grid indices**, never parameter values. Two consequences: no float
is ever compared for equality, and retuning an axis is an explicit editor
operation (`setKeyformAxis`) that drops the captures which no longer fit rather
than silently mismatching them.

### Channels

`translateX`, `translateY`, `rotation`, `scaleX`, `scaleY`, `opacity`,
`pathShape`. Neutral values are `0` except `scaleX`, `scaleY` and `opacity`,
which are `1`. `warpGrid` and `depth` may join later.

## Compilation

`compileKeyform(record)` freezes a record into what the render loop needs:

```text
record ──► compileKeyform ──► { parameters, width, height,
                                samples: Float64Array,
                                layout: { xValues, yValues, rows, rowIndices } }
```

`layout` records, once, which cells of each row hold a sample. Per frame the
engine only locates the parameter on two small arrays and sums at most four
weighted samples — no scanning, no allocation of the grid, no string work.

## Two interpolations, never mixed

| | Domain | Module |
| --- | --- | --- |
| **Parameter** interpolation | `headX × headY` → a value | `keyforms.js` |
| **Spatial** interpolation | `gridX × gridY` → a coordinate | `warp-grid.js` |

They look alike and are deliberately kept in separate modules with separate
tests. See `docs/WARP_GRID.md`.

## Authoring helpers

`project/editor/core/keyforms/keyform-model.js` is pure and immutable — every
call returns a new record, so undo keeps working by snapshot and a cancelled
capture restores the exact previous state.

| Function | Purpose |
| --- | --- |
| `createKeyform` | empty record for a target/channel/axes |
| `setKeyformCell` / `clearKeyformCell` / `clearKeyformCells` | capture and reset |
| `getKeyformCell` / `hasKeyformCell` / `keyformCellState` | read; state is `empty` \| `neutral` \| `captured` |
| `keyformCells` | every cell in row-major order, for grid rendering |
| `copyKeyformCell` / `pasteKeyformCell` | clipboard between cells |
| `mirrorKeyformHorizontal` | swap columns; flip sign for `translateX`/`rotation` |
| `setKeyformAxis` | retune an axis, dropping captures that no longer fit |

Mirroring maps an index to the one whose axis value is its negation, so an
asymmetric axis mirrors onto the samples it actually has, and falls back to the
reversed position when no opposite exists.

## Tests

`keyforms-1d.test.js`, `keyforms-2d.test.js`, `keyform-model.test.js` cover
exact samples, blends, both clamps, irregular axes, a single keyform, holes,
invalid input, linear extrapolation, weight normalisation, sparse rows,
compilation, mirroring, and copy/paste.
