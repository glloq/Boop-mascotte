# Implementation Status

Updated: 2026-08-31

## DONE

- Property-aware additive/multiplicative binding neutrals.
- Correct scale influence constraints and multiplicative opacity semantics.
- Neutral default/path SVG import plugins.
- Clean and sample project factories.
- Shared deterministic behavior scheduler used by preview and runtime.
- Semantic Part registry/model, parameter and generic-binding generation.
- Snapshot v3 editor metadata migration with v1/v2 compatibility.
- Pure Animation Clip normalization/evaluation foundation.
- Core regression and round-trip tests.

## IN PROGRESS

- Semantic graphical Part Rig panel and timeline workspace.
- One unified PreviewController for transitions, clips, behaviors, and overrides.

## NOT STARTED

- Full calibration capture UI and all graphical controllers.
- Complete timeline keyframe editing UI and project example gallery.
- Scoped store subscriptions and all inspector transaction refinements.

## Known failures

- `npm ci` cannot download Playwright in this environment (registry HTTP 403), so Vite build and browser E2E cannot be rerun locally after the dependency directory was cleared.

## Last successful commands

- `npm test` — 54/54 tests pass. `git diff --check` passes.

## Next exact task

- Implement a single PreviewController that evaluates the active clip, shared behaviors, transition, and live overrides, then connect the Rig and Timeline panels to it.
