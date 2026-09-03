# UX-23 — Legacy UI removal

## Baseline

UX-23 closes the refonte program on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`. Every replacement surface (Home, task-based navigation, studios, Preview bench, Export readiness, Advanced hub, palette, responsive layouts, accessibility gate) shipped with its own tests between UX-02 and UX-22, so the legacy surfaces that were kept as rollback paths can be deleted with parity evidence instead of telemetry.

## Removed

| Legacy surface | Controls | Replacement (slice) | Parity evidence |
| --- | --- | --- | --- |
| Canvas empty state (`#empty-state`, `.empty-actions`, `.primary-start`) | Start with Basic Face (`[data-use-template=basic]`) | Home “Basic Face” card `[data-template-id=basic]` (UX-03) | `startBasicFace` helper used by the critical suite; `ux23-legacy-removal.spec.js` |
| | Expressive Face / Talking Face (`[data-use-template]`) | Home cards; Artwork → “More templates and tools” (`#empty-expressive`, `#empty-talking`) | `ux23-legacy-removal.spec.js` |
| | Import SVG (`#empty-svg`) | Home “Import Artwork” (`#home-svg-file`); Artwork “Import / Replace SVG” (`#artwork-svg-file`); Project menu (`#svg-file`) | `ux03-home.spec.js`, `ux04-artwork.spec.js`, import journeys |
| | Open Project (`#empty-project`) | Home “Open Project” (`#home-project-file`); Project menu (`#project-file`) | save/open round trip journeys |
| | Build a Face (`#empty-face`) | Artwork → Add / Create artwork → More templates and tools → Face builder (`#face-builder`, `#generate-face`) | `ux23-legacy-removal.spec.js`, existing face-builder journey |
| Demo bar (`.try-animations`, `#example-buttons`, `data-demo-clip`, `bindDemoClip`) | Play/stop curated clips from Artwork and Preview | Preview → Animations chips (`[data-preview-clip]`, UX-08); Motion Studio Play/Stop (`data-motion-play`, UX-11); palette `motion:` entries (UX-18) | `ux08-preview-readiness.spec.js`, `ux11-motions.spec.js`, `ux23-legacy-removal.spec.js` |
| `core/sample/example-registry.js` (`availableExamples`) | Icon-curated subset of clips | Preview lists every clip in the document; no curated subset | `basic-polish.test.js` (registry test removed) |

Also removed: the `#empty-state` / `.try-animations` CSS blocks (including their 700 px media query and the per-workspace hide rules), the `examples` / `playingId` inputs of `shell.renderProjectUi`, and the canvas-click exclusions for the deleted overlays.

## Kept on purpose

- `LEGACY_TASK_ALIASES` in the task router: workspace ids (`create`, `rig`, `animate`) are stable test and CSS contracts, not user-facing UI.
- The `state()` E2E seam and `store.setState` (diagnostic-counted): used by editor and timeline specs to build fixtures.
- The preset library and Face builder in Artwork: expert authoring paths consolidated by UX-17, not legacy.
- `.more-examples` styling: the Artwork “More templates and tools” disclosure still uses it.

## Fixture parity

`tests/e2e/fixtures/basic-face.rig.json` and `basic-face.mascot.svg` were captured from the export of a fresh Basic Face before any removal. The UX-23 spec exports the same project after the removal and asserts byte-identical `rig.json` and `mascot.svg`; runtime.js is untouched by this slice.

## Compatibility

No schema or runtime change. No document field, command or export artifact changed; the Artwork visual baselines were regenerated because the demo bar no longer overlaps the canvas toolbar.

## Tests

- `tests/e2e/ux23-legacy-removal.spec.js` (critical): removed selectors absent on Home, in Artwork and in Preview; Home/Artwork/Preview replacements present and functional; export fixtures identical.
- Full local gates: `npm run verify`, Chromium `@critical`, `@stability`, `pages.spec.js`, all `ux*.spec.js` slices, visual baselines refreshed and reviewed.

## Deferred

The extended nightly suite (`npm run test:e2e:extended`) still carries 13 pre-existing stale expectations that predate the UX program and are unchanged by it: `editor.spec.js` “runtime resolves CSS-significant SVG ids by exact id” and “essential editor controls remain available on phone and tablet”, plus the eleven `rig-timeline.spec.js` journeys from “Head calibration and controls update the real SVG transform” through “Talking Face authors, drags, saves, reloads and plays a real morph clip”. They encode the pre-UX-02 shell (direct `Create/Rig/Animate` surfaces, the old timeline layout and the dynamic runtime import path) rather than product regressions; they were realigned in `docs/UX23_1_EXTENDED_SUITE_REALIGNMENT.md`.
