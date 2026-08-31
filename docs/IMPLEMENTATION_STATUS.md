# Implementation Status

Updated: 2026-08-31

## DONE

- Release baseline inspected at main `6b7accb91529cc9d77cf461dd452a10f4ae6c926`; GitHub Actions could not be queried because both `gh` authentication and outbound GitHub API access are unavailable.
- Unified `PreviewController` owns the RAF and composes state, clip, behaviors, and live overrides without frame-rate store writes.
- Graphical Semantic Part panel: registry-driven add/delete, role assignment from canvas selection, validation, control enablement, sliders, blink test, and reversible transform capture.
- Timeline MVP: clip CRUD, track CRUD, sorted/upserted keyframes, key fields, playhead scrub, playback, loop, and Auto Key on committed graphical controls.
- Basic Face, Expressive Face, and Talking Face configured starters with editable clips.
- Snapshot v3 continues to preserve semantic parts, calibration, clips, selected clip, playhead, and Auto Key metadata. Runtime clip export remains deliberately editor-only.
- Unit regression coverage for clip operations, exact-time upsert, and PreviewController composition/non-persistence/one-loop behavior.

## IN PROGRESS

- Browser-level validation of the new Rig and Timeline workflow.
- Full calibration calculation UI for Head and Mouth; Gaze metadata capture is present and the model can calculate bindings, but the panel does not yet expose a final Calculate/Test action.
- Keyframe pointer dragging and gesture-level coalescing beyond slider commit semantics.
- Complete preset catalog (current starters cover Look Around, Smile, Blink, Head Nod, and Simple Talk).

## NOT STARTED

- Runtime schema v4 clip promotion (deferred in favor of stable editor metadata).
- Pose insertion helper and resizable timeline.

## BLOCKED

- `npm ci`: registry proxy returns HTTP 403 for `playwright-core-1.55.0.tgz`.
- `npm run build` / `npm run verify`: dependencies were removed by failed `npm ci`; Vite is unavailable.
- `npm run test:e2e`: Playwright is unavailable after the failed install, so Chromium, Firefox, and WebKit are unverified locally.
- `npm audit --omit=dev`: registry advisory endpoint returns HTTP 403.
- Real GitHub Actions (`Verify`, `Browser E2E`, `Pages`): no `GH_TOKEN`, and the outbound API tunnel returns HTTP 403. No result is inferred.

## Last checkpoint

- Last commit: `b4ef541` (`feat: add semantic rig and timeline preview workflow`).
- Last successful command: `npm test` — 56/56 tests pass.
- Next exact task: restore npm registry access, run the complete release/browser gate, fix any application failures, then add Chromium authoring E2E and cross-browser timeline smoke coverage.
