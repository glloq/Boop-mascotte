# Rig model (schema version 5)

The v2 rig is browser-only data: it needs no server, filesystem API, `eval`, or dynamic code generation. `params` is a map of arbitrary names to number descriptors (`min`, `max`, `default`, and current `value`). A state stores numeric targets by parameter name; a missing target deterministically resolves to that parameter's default.

Each element owns an immutable-by-animation `baseTransform` (`x`, `y`, `rotation`, `scaleX`, `scaleY`, `pivotX`, `pivotY`) and `baseOpacity`. Translation uses SVG user units (pixel-equivalent in the editor), rotation uses degrees, and animated scale has identity 1.

Bindings are property records for `translateX`, `translateY`, `rotation`, `scaleX`, `scaleY`, and `opacity`:

```js
{ enabled: true, expression: 'lookX', curve: 'easeInOut', amplitude: 8, offset: 0 }
```

The safe arithmetic parser supports variables, numbers, parentheses, `+ - * /`, and unary minus. The compiled pipeline is:

```text
expression(parameter values) → curve → × amplitude → + offset
→ global constraint × state constraint → element category flag
→ animation delta → base transform → final frame
```

Curves shape normalized signed input before amplitude. They never clamp an already amplified legacy expression. Translation and rotation add to the base. Scale multiplies the base (`finalScale = baseScale × animationScale`); absent or disabled scale is 1. Opacity multiplies `baseOpacity` by its animated factor and is finally clamped to `[0,1]`. Constraints affect animation only. Pivot is copied to the final frame unchanged.

`normalizeRig(rawRig)` is the single migration boundary. It upgrades scalar legacy params, top-level element transforms, string bindings, and separate `bindingCurves` into v2. Export always writes `schemaVersion: 5` (`RIG_SCHEMA_VERSION`); versions 1 to 4 are read and upgraded; reimporting a normalized rig is semantically idempotent. Morph remains a dedicated animation record but its final progress is included in the generic frame.

The editor frame compiler delegates to the exported runtime's `compileRigFrame`, so preview and public runtime share expression, curve, amplitude, constraint, and composition math. Parsed expressions are cached by source string.

## Schema version 4 — keyforms

v4 adds one additive top-level block, `keyforms`, and changes nothing else. A
v1/v2/v3 rig normalizes to v4 with `keyforms: []`, and a runtime that predates
the block ignores it, so old projects and old embeds keep working.

```js
keyforms: [
  { id: 'head-face-x',
    target: { kind: 'element', id: 'face' },
    channel: 'translateX',
    axes: [{ parameter: 'headX', values: [-1, 0, 1] },
           { parameter: 'headY', values: [-1, 0, 1] }],
    keyforms: [{ at: [0, 1], value: -6 }, { at: [2, 1], value: 6 }],
    extrapolation: 'clamp' }
]
```

Keyforms **compose with** bindings rather than replacing them, inside the same
`compileRigFrame` pass and under the same constraints:

```text
translateX / translateY / rotation   binding + Σ keyforms
scaleX / scaleY / opacity            binding × Π keyforms
pathShape                            frame.shapeWeights[shapeKey] += keyform
```

A rig with no keyforms therefore compiles to exactly the frame it compiled to
in v3. Evaluation itself lives in `project/runtime/keyforms.js`
(`docs/KEYFORM_ENGINE.md`); the engine compiles the records once at
construction and the editor preview passes the same records to the same
compiler, so preview and export cannot disagree.

`parameterReferences()` reports the poses that use a parameter,
`renameParameter()` retargets their axes, and `deleteParameter()` removes the
poses that could no longer be evaluated.

### Exported runtime

`runtime.js` is authored as modules (`keyforms.js`, then `runtime.js`) but
exported as **one standalone file**: `project/editor/core/export/runtime-bundle.js`
strips the intra-runtime import statements and concatenates the modules in
dependency order. A runtime module may never import editor code, which is
enforced by test.

## Schema version 5 — triggers a runtime may not have

v5 is the first bump since 4, and the first change to this format that is **not
safely additive**. Every block added between 3 and 5 — expressions, reactions,
keyforms, shape keys, hands, warps, followers — could be ignored by an older
runtime with no harm: it simply did less. A **reaction trigger** cannot. An
older runtime meeting `{ type: 'idle' }` could not tell it from a typo, and
`normalizeReaction` turned anything it did not recognise into a `click` — so a
reaction meant to run when the page had been left alone fired the moment
someone touched the mascot. Mis-firing is worse than not running (VNX-39).

Two things change, and a rig written before either is read exactly as it was.

**The rig says what it needs.** `requires` is a sorted list of feature markers,
and only the two new triggers put anything in it:

```js
requires: ['trigger:gaze-follow', 'trigger:idle']   // or [], which is most rigs
```

`RUNTIME_FEATURES` is what a build provides, `rigRequirements(rig)` is what a
rig uses, and `unsupportedRequirements(rig)` is the difference — empty when the
build can run the rig. `load()` refuses a rig it cannot honour, by name rather
than by version number, which is what a split runtime build (VNX-65) will need.
A rig with no `requires` field is judged on its contents instead of waved
through.

**An unknown trigger declines instead of guessing.** From v5 on,
`normalizeReaction` maps anything outside `REACTION_TRIGGERS` to
`{ type: 'unsupported', of: '<what was written>' }`. Nothing fires it — not
`trigger()`, and not `fire(id)`, which is the one call that otherwise bypasses
the trigger filter — and the editor reports it as a reaction that needs a newer
runtime rather than silently rewriting what its author wrote. A missing trigger
is still a `click`, exactly as before.

The two new triggers themselves:

| Trigger | Field | What it waits for |
| --- | --- | --- |
| `idle` | `after` (seconds, ≥ 1, default 8) | nothing happening for that long. `notifyActivity()` restarts the clock; `bindEvents` calls it on every event the mascot sees |
| `gaze-follow` | — | the pointer being on the page. While it holds, the runtime writes `gazeX` / `gazeY` from the pointer and the gaze solver decides what the eyes take and what the head does |

`hover` and `gaze-follow` are **held** triggers (`HELD_REACTION_TRIGGERS`): they
begin when the condition begins and release when it ends, rather than running a
fixed envelope. `release(type)` ends one; `bindEvents` binds `pointerleave` for
the first time, which is what a hover had been missing since UX-13.
