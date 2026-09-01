# PR 33 browser release-gate audit

Audited base: `5d9889b079c067e6ca7f6ed012b9f523c7ecb529`.

## Initial failure matrix

The published Chromium failure that motivated this release gate is reproducible from the
suite contract as follows. Local browser execution was also attempted before source edits;
in this container all eight critical tests stopped at browser launch because Playwright's
browser cache was empty and the download endpoints returned HTTP 403. That local limitation
is not a classification of the GitHub-hosted product failure.

| Test | Browser | Failure / selector | Root cause | Classification |
| --- | --- | --- | --- | --- |
| `timeline project metadata persists and remains playable after reload` | Chromium | `selectOption('easeInOut')` could not find `[data-key-edit="easing"]` | Timeline accepted easing changes in its delegated change handler and the interpolation engine supports four curves, but the selected-key editor rendered only Time, Value, and Delete. | **MISSING UI** |
| Tests which inspect Layers immediately after starting a template | Chromium | expected the old always-visible Layers surface | Artwork/Layers deliberately became a disclosure in Create. Tests must open Artwork through its visible summary before inspecting layers. | **STALE TEST** |

The pre-edit local launch failures for all eight critical tests had the same action
(`browserType.launch`) and missing executable. They are recorded as an **environment
limitation**, rather than being used to weaken, retry, or reclassify any product assertion.

## Contract decisions

- Critical authoring journeys use visible controls. `window.__BOOP_E2E__` remains available
  for read-only/deep assertions and engine-focused setup, not as the primary authoring path.
- Navigation belongs in `tests/e2e/editor-helpers.js`; Artwork is explicitly opened before
  layer assertions.
- Dynamic keyframes expose `data-testid="timeline-key"`, while normal navigation continues
  to prefer roles and accessible names.
- The selected keyframe editor exposes only interpolation curves implemented by the runtime:
  Linear, Ease In, Ease Out, and Ease In Out.

## Timeline work intentionally deferred to PR 34

- resizable panel;
- proper playhead;
- fixed track/property column;
- zoom controls and ruler seeking;
- multi-key selection;
- copy/paste;
- snapping;
- group move;
- easing UI completeness beyond the selected-key selector;
- animation navigator;
- timeline scroll/pan.

This release-gate change does not alter the current Timeline architecture.
