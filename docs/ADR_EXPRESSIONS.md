# ADR — Expressions as a first-class product entity

Status: accepted for UX-09. Scope: editor schema (additive), project snapshot (additive), export `rig.json` (additive), runtime composition helper and engine API (additive).

## Context

The product needs named facial poses (Happy, Sad, Surprised…) that a beginner creates from semantic controls, previews at any intensity, and applies at runtime through `mascot.setExpression('happy', { weight })`. The existing **States** are runtime graph nodes with identity, transitions and constraints; aliasing them as Expressions would leak graph semantics into a pose concept and make intensity ambiguous (`docs/UX_UI_PRODUCT_ARCHITECTURE.md`). Expressions must also survive artwork changes because they reference semantic controls (parameters), not SVG ids.

## Decision

### Entity

```json
{ "id": "happy", "name": "Happy", "controls": { "smile": 1, "eyeOpen": 0.8 }, "source": "manual" }
```

- `id` is a unique slug; `name` is free text; `source` is `manual`, `capture` or `preset` (informational).
- `controls` maps a parameter name to its **target value at full intensity**. Missing parameters are simply not driven; unknown parameters are ignored at composition time and reported as a warning by validation.

### Composition (intensity)

For a base pose `base` (state parameters after transitions/clips), neutral values `neutral[p] = params[p].default` and active expressions `{ id: weight }`:

```text
effective[p] = clamp(base[p] + Σ weight_e × (controls_e[p] − neutral[p]), min_p, max_p)
```

Intensity 0 is the base pose, 1 is the authored target; several expressions stack additively. The function `composeExpressionParams(base, expressions, active, params)` lives in `project/runtime/runtime.js` and is used by **both** the editor `PreviewController` and `createMascotEngine`, so preview and export are numerically identical.

### Storage

- `ProjectDocument.expressions: Expression[]` (new document domain `expressions`, its own revision counter and command scope).
- Project snapshot: `document.editor.expressions` (optional; version stays 3; older snapshots load with `[]`).
- Export: `rig.json.expressions` (optional block; runtimes that predate it ignore unknown fields through `normalizeRig`'s spread).

### Runtime API (additive)

`createMascotEngine` gains `setExpression(id, weight = 1)`, `clearExpression(id)`, `clearExpressions()` and `getExpressions()`. The exported runtime stays independent of the editor UI; no existing method changes behavior.

### What Expressions are not

They do not create or alter States, transitions or constraints; they are never persisted in `states`. Motions (time) and Reactions (orchestration) stay separate entities (UX-11, UX-13).

## Consequences

- Authoring goes through explicit commands (`expression/create`, `rename`, `duplicate`, `remove`, `set-control`, `capture`) on the `expressions` domain; history and dirty tracking apply.
- Validation adds non-blocking warnings for expressions that reference unknown parameters; export policy is unchanged.
- Presets (UX-10) are catalogued over basic control names and instantiated only with controls the project has.
- Rollback: hide the Expressions task; stored expressions stay inert data readable by older editors (ignored) and runtimes (ignored).

## Alternatives rejected

- **Expression = State alias**: intensity would require synthesizing states per level; transitions and `activeState` semantics would leak into a pose concept.
- **Expression stored as animation clip**: time-based, requires Timeline vocabulary, and cannot stack cleanly with Motions.
- **Editor-only expressions (no runtime)**: the product promise (`setExpression` in the exported mascot) would be broken; the composition helper is small and shared.
