# Shape keys

A shape key is a **difference**: the numbers that turn an element's rest outline
into a posed one. Weights add up, so several keys apply to the same element at
the same time.

```text
REST
 ├─ SmileDelta × smile
 ├─ OpenDelta  × mouthOpen
 ├─ AngryDelta × angry
 └─ PoseDelta  × headPose

finalShape = restShape + Σ(deltaShape × weight)
```

This is what lifts V1's one-morph-per-element limit. A mouth can smile, be open,
and be corrected by the head pose simultaneously — the essential V2 criterion.

Implementation: `project/runtime/shape-keys.js` and
`project/runtime/path-vector.js`, re-exported by
`project/editor/core/shape-keys/`. One implementation, shared by preview and
the exported runtime.

## Paths are parsed once

A `d` string is never parsed inside the render loop.

```text
"M0 0 L10 0 Z"  ──parse once──►  commands:  ['M','L','Z']
                                 values:    Float64Array [0,0,10,0]
                                 signature: 'M L Z'
```

`parsePath` handles the awkward parts of the grammar — comma or whitespace
separators, `-1-2` run together, `.5.5`, exponents, implicit repeats (a repeated
`M` group continues as `L`, per the spec), and arc flags written without
separators (`a5 5 0 011 1`). Results are cached by source string, FIFO-bounded
at 512 entries. A malformed path raises `PathParseError` at authoring time
rather than producing silent rubbish at render time.

`signature` is the command layout with coordinates removed. It is the
compatibility key: two paths can be blended only when their signatures match.

## Records

```js
{
  id: 'mouth-smile',
  target: 'mouth',
  name: 'Smile',
  driver: { mode: 'range', parameter: 'smile', min: 0, max: 1, clamp: true },
  delta: [0, -2, 0, 0, 0, 0]
}
```

The rest outline lives on the element as `element.restPath`.

### Drivers

| Mode | Weight |
| --- | --- |
| `range` | `clamp((parameter − min) / (max − min), 0, 1)` — the friendly default, and what a legacy morph converts to |
| `expression` | the binding maths: `curve(expression) × amplitude + offset` — no second parser |
| `none` | driven only by a `pathShape` keyform |

A key's final weight is its driver **plus** whatever a `pathShape` keyform
contributed for it this frame, **plus** whatever a hand pose raised it by, so a
head pose can nudge a mouth that a parameter is already shaping, and a Fist and
a curled finger compose on one hand.

A `range` driver reads its span in either direction: `min: 0, max: -1` gives a
key that comes in as the parameter goes negative, which is how one parameter
carries a smile one way and a frown the other.

### Generated shapes carry their owner

`generatedBy: { semanticPart, control }` marks a shape key a semantic control
owns, exactly as a generated binding is marked. Switching that control to
another method takes its shapes with it; without the mark they would stay,
still deforming the artwork, with nothing pointing at them
(`docs/SEMANTIC_RIGGING.md`).

### Generated shapes are exactly compatible

Both places that ship shape keys — the mascot's mouth and the generated hands —
draw the rest outline **and** every pose from one parametric function
(`mouthPath`, `handPath`). Compatibility is then a property of the code rather
than something to check afterwards: there is no way to author a Fist whose
topology differs from the open hand, and a mouth built from an affine
parameterisation reproduces any combination of its keys exactly.

## Incompatible topology never crashes

When a delta does not match its target's rest vector, the key is excluded from
compilation and listed in `incompatible`. The record stays in the project and
validation explains it in the author's language:

> Shape key "Smile": its outline no longer matches the rest shape of "mouth".
> Capture it again from the current shape.

The same applies to a target with no rest outline (`missing-rest`) and to a rest
outline that cannot be parsed (`unparsable-rest`).

## Per-frame cost

`compileShapeKeys` parses each rest path once and allocates the scratch buffers.
Per frame, `evaluateShapeTarget`:

1. compares the new weight vector with the previous one;
2. returns the previous string unchanged when nothing moved — **an idle mascot
   does no string work at all**;
3. otherwise sums `rest + Σ delta × weight` into a reused `Float64Array` and
   rebuilds exactly one `d` string.

## Legacy morphs

`element.morph` (one A/B pair per element, driven by one parameter through a
`min`/`max` window) keeps working exactly as before. `normalizeRig` does **not**
convert it: an old project renders through the original morph path until an
author chooses to upgrade.

The upgrade is explicit and tested:

```js
shapeKeyFromLegacyMorph(elementId, morph)  // → { restPath, shapeKey }
migrateLegacyMorphs(state)                 // → { shapeKeys, restPaths, skipped }
```

`pathA` becomes the rest outline, `pathB − pathA` the delta, and the
`param`/`min`/`max` window becomes a `range` driver — the same geometry the
legacy morph produced. Morphs whose two paths have different command layouts
are reported in `skipped` with the author-facing reason, not silently lost.

The legacy code stays until several versions have shipped with the converter.

## Authoring API

| Function | Purpose |
| --- | --- |
| `createShapeKey({ id, target, restPath, posePath, driver })` | capture; returns `{ ok, shapeKey }` or `{ ok: false, reason, message }` |
| `previewShapeKey` / `previewShapeKeys` | show one key, or several together |
| `upsertShapeKey` / `removeShapeKey` / `setShapeKeyDriver` | immutable record edits |
| `shapeKeysForTarget` | keys attached to one element |
| `shapeKeyFromLegacyMorph` / `migrateLegacyMorphs` | opt-in legacy upgrade |

Capture never throws at a UI: it returns a reason and a sentence an author can
act on.

## Tests

`path-vector.test.js` and `shape-keys.test.js` cover parsing (separators, signs,
exponents, implicit repeats, arc flags, round-trip, malformed input), one key,
several keys, zero and negative weights, full weight, topology mismatch, missing
rest, range and expression drivers, keyform-driven weights, the no-rebuild fast
path, normalization, diagnostics, legacy conversion and legacy geometry parity.
