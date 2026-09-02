# UX-08 — Preview test bench and readiness foundation

## Baseline

UX-08 builds on UX-07 on branch `claude/boop-mascotte-ux-ui-audit-50d5b3` (Verify and Browser E2E green in hosted CI on `95a5691`).

## Goal

Make Preview a real test bench that never writes to the project, and derive plain-language readiness per task with stable codes and deep links, without introducing new product entities (Expressions, Reactions and Motions arrive later).

```text
Preview                         [Reset mascot] [Focus]
Live controls   [Gaze pad]  Gaze · Look left / right ━━●━━  Head · Tilt ━━●━━  [Center]
Poses           [idle] [happy] [surprised]
Animations      ▶ Look Around  ▶ Blink  ▶ Happy …
Automatic       ☑ Blink  ☑ Idle   (preview only)
Ready?          ✓ Artwork 1 layer · Go
                ⚠ Face parts 6 / 8 assigned · missing left eyebrow… · Fix
                ⚠ Movements 8 on · default ranges, none calibrated · Fix
                · Animate 5 animations · 3 poses · Go
                ✓ Export Ready to export · Go
```

## Readiness model

`core/validation/task-readiness.js` derives five sections from `ProjectDocument` plus the canonical validation issues: **artwork**, **faceSetup** (Face parts checklist), **movements**, **animate** (optional counts) and **export** (blocking issues). Each section carries `status` (`ready`, `warning`, `error`, `todo`, `optional`), a summary, an optional stable `code` (`artwork.missing`, `face.roles.none`, `face.roles.missing`, `face.movements.none`, `face.movements.uncalibrated`, `export.blocked`), a suggested `action`, and a `route` for the Task Router (task plus optional typed target, e.g. the first enabled movement as a `semantic-control` target or the blocking diagnostic). `next` is the first section with an action. The projection is frozen and pure; `deriveProjectReadiness` (domain readiness) is unchanged for the export policy and the UX-01 seam.

Consumers:
- Task tab badges now use task readiness (Artwork, Face Setup = worse of face parts and movements, Animate). Symbols: ✓ ready, ⚠ warning, ● error, ○ to do.
- The Problems popover lists the readiness sections first, each with **Go**/**Fix** deep links, then the detailed diagnostics with the existing **Fix** actions.
- The Preview panel ends with the same **Ready?** list.

## Preview test bench

`ui/preview-panel.js` renders the right panel in Preview from the document and `PreviewController` only:
- **Live controls**: XY pads for gaze and head when both axes are on, one slider per enabled basic movement, keyboard support on pads, **Center**. Values are `PreviewSession` live params.
- **Poses**: the existing states, applied through `preview.setState` (transition) or `previewState` (fallback), preview-only.
- **Animations**: play/stop any clip through the controller.
- **Automatic**: behavior toggles are now **preview-only overrides** (`setBehaviorOverride` / `clearBehaviorOverrides` / `getBehaviorOverrides` on the controller, keyed by behavior id or `behavior-<index>`, mirrored in `PreviewSession.behaviorOverrides`). The previous Preview checkboxes authored `behavior/set-enabled`; authoring stays in Animate → Behaviors and later in Idle & Automatic (UX-15).
- **Reset mascot** clears live controls, playback, transitions and overrides and keeps the preview loop running; **Focus** is unchanged.
- The Artwork/Preview “Try your mascot” overlay is hidden in Preview since the panel lists animations.

DoD checks: switching tasks, using every Preview control and resetting change no document, revision, history or dirty state (browser-tested); readiness derivation is deterministic and read-only (unit-tested).

## Compatibility

No schema, runtime, export or router change. `validate-project.js`, `export-policy.js`, the UX-01 `readiness()` seam and the `artwork.missing` recovery journey are unchanged. The `#preview-reset` and `#focus-preview` controls keep their ids; `Reset` is labeled **Reset mascot**.

## Tests

- Unit (`core/tests/task-readiness.test.js`): empty-project codes/routes, progression todo → warning → ready for face parts and movements with deep-link targets, frozen projection, and transient preview behavior overrides with reset.
- Browser (`tests/e2e/ux08-preview-readiness.spec.js`): live pad/slider testing and readiness list with zero document writes, Face Setup badge, Reset mascot, deep link to the Movement Inspector; poses/animations/automatic overrides preview-only and reset together on the Expressive template; Problems readiness rows and deep links on an imported SVG.

## Deferred

The dedicated Export workspace with per-issue fix flows (UX-16), an event simulator (UX-14), and mobile/tablet Preview layouts (UX-19/20).
