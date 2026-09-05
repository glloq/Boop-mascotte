# UX-16 — Readiness deep links and Export workspace

## Baseline

UX-16 builds on the readiness foundation (UX-08) and the validation contracts on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

Make Export the place that says exactly what blocks it, sends the user to the fix, and brings them back, without changing the exported files.

```text
Export files                                          ● Export is blocked: Create or open a project before exporting.
  1 error · 0 warnings · 2 notes
  Artwork ● No artwork yet ............................. [Fix]
  Face parts ○ Add artwork first ....................... [Go]
  …
  Blocking
    ● Create or open a project before exporting.  Opens Artwork.   [Fix]
  [Download mascot.svg] [Download rig.json] [Download runtime.js]   (disabled while blocked)
↩ Back to Export   (after a Fix, until the panel is reopened)
```

## Delivered

- `core/validation/issue-guidance.js`: `describeFix(issue)` says where a fix navigates (task and sub-panel), whether it lands on the exact item, and otherwise how to find it; issues without a target say so explicitly. `summarizeIssues` gives stable counts.
- `core/export/export-readiness.js`: `createExportReadinessModel(readiness, issues, { available })` → status (blocked / warnings / ready), headline, counts, blockers, warnings, notes and the task sections. Pure and frozen; artifacts untouched.
- Export panel: headline and counts, the task readiness rows with Go / Fix, the blocking list with Fix (or the explanation when nothing can be opened), warnings and notes as disclosures, downloads disabled while blocked. `data-export-state` is `ready` or `blocked`; `data-export-warnings` carries the count. The topbar Export button opens this panel even when blocked (the status toast still names the blocker).
- Return: leaving Export through Fix or Go shows a **↩ Back to Export** chip that reopens the panel with fresh readiness; it hides once Export is open again.
- Readiness memo: task readiness is derived once per document revision; badges, Preview, Problems and Export share the same object.

## Compatibility

No schema, runtime or artifact change; the Problems panel keeps its contracts.

## Tests

- Unit (`core/tests/export-readiness.test.js`): guidance for precise, coarse and missing fixes; export model blocked / warnings / ready, headline, counts, sections and determinism.
- Browser (`tests/e2e/ux16-export-readiness.spec.js`): blank editor → Export blocked with the reason and Fix → Artwork → Basic Face → Back to Export → ready with seven sections, enabled downloads and unchanged artifact names; Go from a section also arms the return chip; a reaction that does nothing yet shows as a warning in the topbar and the panel, downloads stay enabled, Fix lands on the reaction, and fixing it clears the warning on return.

## Deferred

A full-page Export workspace with per-target previews (later shell work, UX-17/UX-23); Problems panel retirement once every entry point routes through Export.
