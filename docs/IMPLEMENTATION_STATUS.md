# Implementation Status

Updated: 2026-08-31

## DONE

- Create, Rig, Animate, and Preview workspace navigation with contextual panels and lightweight first-use guidance.
- Timeline disclosure only in Animate, clean Preview/focus mode, persistent panel collapse, and canvas zoom/fit controls.
- Visual template cards, simpler Face Control language, template auto-rig reuse, and Advanced/plugin disclosure.
- UI-only workspace preference and human-label tests without runtime v3, engine, or snapshot schema changes.

- Release baseline is audited main `12284cae9369270fe95e14adf131fc1a94957371` (the PR #18 merge).
- Preview now has independent preview elapsed, clip, and transition clocks. Pausing a clip leaves behaviors active; interrupted timed transitions capture current effective values.
- All transform-capable semantic parts have generic driver defaults and generated-binding ownership. Role reassignment rebuilds owned bindings, deletion preserves manual/shared references, and asymmetric calibration solves amplitude/offset.
- Head and Gaze use pointer/touch XY pads. Timeline no longer resets the same clip, scrub is transient until commit, missing Auto Key tracks are created, easing selection is correct, duration shrink clamps/deduplicates, and ruler/zoom controls are present.
- Starter SVG/example/preset loads clear project state before applying the next asset.
- Unified `PreviewController` owns the RAF and composes state, clip, behaviors, and live overrides without frame-rate store writes.
- Graphical Semantic Part panel: registry-driven add/delete, role assignment from canvas selection, validation, control enablement, sliders, blink test, and reversible transform capture.
- Timeline MVP: clip CRUD, track CRUD, sorted/upserted keyframes, key fields, playhead scrub, playback, loop, and Auto Key on committed graphical controls.
- Basic Face, Expressive Face, and Talking Face configured starters with editable clips.
- Snapshot v3 continues to preserve semantic parts, calibration, clips, selected clip, playhead, and Auto Key metadata. Runtime clip export remains deliberately editor-only.
- Unit regression coverage for clip operations, exact-time upsert, and PreviewController composition/non-persistence/one-loop behavior.

## IN PROGRESS

- Semantic Rig and Timeline browser release contracts are implemented and covered by Playwright; the release verdict still depends on the current GitHub browser gates.
- Complete template modules and atomic switching now cover Look Around, Smile, Blink, Happy, Surprised, Head Nod, and Simple Talk.
- Domain-scoped panel rendering, cached/debounced validation, and transient autosave isolation are implemented.

## NOT STARTED

- Runtime schema v4 clip promotion (deferred in favor of stable editor metadata).
- Pose insertion helper and resizable timeline.

## Last checkpoint

- Local unit tests and production verification pass. Browser binaries cannot be downloaded in this container because its outbound proxy rejects the Playwright CDN; GitHub Actions remains the browser gate.
- Method selection now switches owned transform/morph drivers atomically; mouth and eye path poses capture without raw path input, reject incompatible layouts safely, and persist ownership metadata.
- Next exact task: run the suite in Chromium/Firefox/WebKit via GitHub Actions, repair any observed failures, then verify Pages.

## Consolidated editor contract (2026-09-01)

Project data owns SVG, layers, rig parameters, states, behaviors, semantic roles, and clips. `editorContext` owns workspace, semantic/control focus, timeline track/key focus, and state-authoring mode; `selectedId` remains a transient store field shared by canvas and Layers and is excluded from runtime export. Every project replacement resets preview/live playback and this transient context. Legacy hidden template, save, sample, autosave, and rig-import adapters were removed.
