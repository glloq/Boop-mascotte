# Changelog

## Unreleased — UX refonte (UX-01 → UX-23.1)

- Task-based shell: Home, Artwork, Face Setup, Expressions, Animate, Reactions and Preview with a contextual Inspector, progressive disclosure and an Advanced hub for expert tools.
- Face Setup checklist with role suggestions, Basic movements with visual pose calibration, and a Preview test bench with readiness and an event simulator.
- New product entities exported for the runtime: Expressions (`rig.json.expressions`, `mascot.setExpression`), Motions compiled to editable clips (`rig.json.animations`, `mascot.playAnimation`) and Reactions (`rig.json.reactions`, `mascot.trigger`, `mascot.bindEvents`); schema version stays 3.
- Readiness-driven Export with deep links, command palette (Ctrl/Cmd+K), Save Project shortcut (Ctrl/Cmd+S), tablet drawer and bottom sheet, mobile priority mode, and an accessibility and keyboard gate (landmarks, skip link, shortcut help, Escape order, reduced motion).
- Visual, layout, stability and stress gates; legacy Canvas empty state and demo bar removed with fixture parity; extended suite realigned onto the new shell.
- Fixes surfaced along the way: SVG.js 2 transform parsing for group calibration and import, idempotent Timeline key edits, overflow-free layouts at 320–1440 px.

## 1.0.0

- Browser-only SVG editor with nested layers, transforms, rig parameters and bindings.
- States, transitions, blink and idle behaviors with live preview.
- Local project persistence plus SVG, rig and standalone runtime exports.
- Sanitized SVG imports, safe expression evaluation and schema migrations.
- GitHub Pages production build, runtime demo and cross-browser Playwright checks.

## v1 release closure
- Added atomic Basic, Expressive, and Talking Face project templates.
- Added Semantic Rig method/morph authoring and dedicated Rig/Timeline browser coverage.
- Scoped editor rendering by data domain and debounced cached background validation.
- Corrected Face Builder semantic compatibility, registry-driven calibration, exposed method validation, built-in blink geometry, real state-chip transitions, numeric key collision handling, and scrub override cleanup.
- Added release browser contracts and bounded workflow timeouts with retained Playwright reports, screenshots, traces, and test results.
