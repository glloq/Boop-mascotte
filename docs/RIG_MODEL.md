# Rig model (schema version 2)

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

`normalizeRig(rawRig)` is the single migration boundary. It upgrades scalar legacy params, top-level element transforms, string bindings, and separate `bindingCurves` into v2. Export always writes `schemaVersion: 2`; reimporting a normalized rig is semantically idempotent. Morph remains a dedicated animation record but its final progress is included in the generic frame.

The editor frame compiler delegates to the exported runtime's `compileRigFrame`, so preview and public runtime share expression, curve, amplitude, constraint, and composition math. Parsed expressions are cached by source string.
