# UX-04 — Artwork workspace consolidation

## Baseline and prior gates

UX-04 was implemented from `f5577b58a834b4acc60e848424cba7398248fda3` (PR #60). Its recorded baseline gates were green for Verify, Chromium Critical, Cross-browser Smoke, Stability, and GitHub Pages build/deploy/smoke.

## Composition and compatibility

Previously, the visible **Create** panel mixed starter onboarding, feature cards, Face Builder, presets, and Layers hidden in an “Advanced SVG structure” disclosure. The canonical **Artwork** task now presents the existing import/replace action and the complete Layers collection first, while keeping generators and rarer tools under **Add / Create artwork**. Canvas remains the central surface.

The Task Router remains authoritative: canonical task `artwork` still maps to legacy workspace `create`. Existing `data-workspace`, saved preferences, CSS compatibility, file-menu inputs, and empty-state routes remain intact.

## Ownership contracts

Canvas and Layers share only `EditorSession.selectedId`; selection, focus, filtering, and keyboard traversal never mutate `ProjectDocument` or history. Layers exposes an accessible tree. Arrow Up/Down traverse visible items, Arrow Right expands or enters a child, Arrow Left collapses or reaches the parent, Enter/Space selects, and Home/End reach boundaries. Expansion is transient UI state; persisted legacy expansion metadata remains readable and schema-compatible but keyboard disclosure does not author it.

The single `#context-inspector` owns the Artwork Inspector. Transform (X, Y, rotation, scale, pivot) and Appearance (fill, stroke, stroke width, opacity) are immediately visible. Advanced locally contains Constraints, Bindings, Morph, symmetry, presets, and raw SVG identity. No face-role assignment or detection was introduced.

## Pipelines and history

The Artwork import input binds through the existing `bindLoadSvg` pipeline and therefore keeps sanitization, preparation, atomic `replaceProject`, confirmation, history baseline, routing, and fit behavior. Face Builder remains the one existing DOM instance and existing atomic generation/replacement handler.

Existing layer operations remain available: visibility, lock, reorder, rename, duplicate, group/ungroup, and delete. Authored operations continue through the Canvas adapter and artwork commands. Rename now commits once on `change` rather than once per typed character. Legacy Canvas methods still mutate their internal SVG document before `syncSvg`; this deliberate adapter debt was not rewritten because it already terminates at the V2 command boundary.

## Deferred work

Schema, runtime, and export contracts are unchanged. Face Setup UX-05, role detection UX-06, and global Advanced consolidation UX-17 are explicitly deferred.

## Gates

Run `npm run verify`, the targeted `tests/e2e/ux04-artwork.spec.js` Chromium suite, critical, cross-browser smoke, stability, and Pages suites.
