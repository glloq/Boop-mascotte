# UX-09 — Expressions: contract and vertical slice

## Baseline

UX-09 builds on UX-08 on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`. Its contract is `docs/ADR_EXPRESSIONS.md` (accepted): an Expression is a named set of target values for semantic controls, applied at an intensity, distinct from runtime States.

## Goal

Let a user create **Happy** from their movements, preview it at any intensity, keep it in the project and export it, without States, transitions or the Timeline.

```text
Expressions (task tab)                     Expression Inspector — Happy
New expression [Happy      ] [Create]      Name [Happy]  id happy · 1 control · mascot.setExpression('happy')
[Capture current face as expression]       Test intensity ━━━●━━ 50%
• Happy          1 control                 Face at full intensity
• Surprised      1 control                   Mouth · Smile     ━━━━━● 1.00  ×
                                             Gaze · Look …     ━━●━━ neutral
                                           [Capture current face] [Duplicate] [Delete]
```

## Delivered

### Schema and runtime (additive, per ADR)
- `ProjectDocument.expressions` with its own `expressions` domain/revision; clean state, snapshot (`document.editor.expressions`, version 3 unchanged, older snapshots load as `[]`) and export (`rig.json.expressions`).
- `runtime.js`: `normalizeExpressions`, `composeExpressionParams` (shared composition: `base + Σ weight × (target − neutral)`, clamped), and engine methods `setExpression(id, weight)`, `clearExpression`, `clearExpressions`, `getExpressions`; `getParams` and the frame loop include active expressions. No existing runtime behavior changes.
- Validation: non-blocking warnings when an expression references movements that no longer exist, with a deep link to the expression.

### Editor
- `core/expressions/expression-model.js` and `expression-commands.js`: create (slug ids, unique), rename, duplicate, remove, set/forget one control, capture from face values (only values away from neutral are stored). Commands are atomic and undoable; failures leave no history.
- `PreviewController`: transient expression layer (`setExpression`, `clearExpression(s)`, `getExpressionWeights`, mirrored in `PreviewSession.expressionWeights`), composed after states/clips and before behaviors and live controls, using the runtime helper so preview equals export.
- New **Expressions** task (workspace `expressions`, tab between Face Setup and Animate) with `EditorSession.activeExpressionId`, typed `expression` route targets and an `Expression Inspector` adapter in the single contextual Inspector.
- `ui/expression-studio.js`: list with create-by-name and **Capture current face as expression**; inspector with name, test intensity (preview-only), one slider per enabled basic movement (drag previews through a live param, release commits one command; **×** forgets a control), Capture current face, Duplicate, Delete. Leaving the task clears the preview layer.
- Preview panel: **Expressions** section with chips and an intensity slider (preview-only; Reset mascot clears it). Task badge and readiness section (`expressions`, optional until one exists, deep link to the first expression).

## Compatibility

Old projects and exports load unchanged; `rig.json` gains an optional block that older runtimes ignore. States, transitions, clips, behaviors and the Face Setup flows are untouched. Rollback: hide the Expressions tab; stored expressions stay inert.

## Tests

- Unit (`core/tests/expressions.test.js`): slug/sanitize/capture semantics and validation warning; atomic undoable commands with no state-machine writes; snapshot round-trip, legacy snapshot and additive export; editor preview vs exported engine numeric parity at several intensities, stacking and clamping, reset.
- Existing suites updated for the new task, inspector adapter and readiness section.
- Browser (`tests/e2e/ux09-expressions.spec.js`): create Happy by name, shape it with the Smile slider (one command), test intensity without authoring, apply and vary it in Preview, export it in `rig.json`; capture from live controls, rename (stable id), duplicate, delete, undo, save/open round trip and re-apply.

## Deferred

Presets catalogue, per-expression default intensity and missing-control guidance (UX-10); reactions that trigger expressions (UX-13); Emote Pack import/export (later).
