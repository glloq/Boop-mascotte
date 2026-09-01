# PR 39 browser and stability gate closure

## Baseline and initial reproduction

- Base: `84022e0511945089b4b872a963cd214200aa334b`.
- Reported initial CI: Verify green; Chromium critical, Stability,
  Firefox/WebKit smoke, and Pages red.
- Production entry points under review: `/Boop-mascotte/` and
  `/Boop-mascotte/?e2e=1`.

The startup call sequence was reproduced by code-path inspection at the pinned
base: `main.js` invoked `exporter.render()` for the clean project;
`exporter.render()` invoked `createExportArtifacts()` while constructing its
button markup; and the artifact guard threw:

```text
Error: Cannot export a project without a valid SVG document
```

Because this happened during top-level module evaluation, all statements after
the initial renderer block were skipped. In particular, the `?e2e=1` branch
that installs `window.__BOOP_E2E__` was never reached. The normal blank state
was therefore incorrectly treated as an invalid application state.

A local browser capture of the failing base could not be completed. Online
`npm ci` first returned HTTP 403, after which the same locked dependencies were
successfully restored from the local npm cache. Playwright then could not
download Chromium, Firefox, or WebKit because every browser CDN fallback
returned HTTP 403. This is recorded as an environment limitation rather than
browser evidence.

## Corrected export lifecycle

Export now has two explicit boundaries:

1. `createExportUiModel(state)` is pure, does not serialize the canvas, and
   safely returns disabled `mascot.svg`, `rig.json`, and `runtime.js` actions
   with the blank-state message.
2. `createExportArtifacts(...)` runs only for a requested download or the E2E
   export diagnostic. It serializes once, validates the actual SVG, and throws
   the original strict exception for a blank/invalid document.

The top Save and Export controls continue to use the document-validity policy,
so their state transitions blank → valid → blank without probing snapshot or
artifact creation.

## Boot and E2E readiness

Initial renderers now complete on a clean state. The editor publishes
`data-editor-ready="true"` after startup rendering and, for `?e2e=1`, after
installing `window.__BOOP_E2E__`. The browser helper waits for that stable
readiness marker and then verifies the seam when requested. Normal URLs do not
install the seam.

## Regression coverage

Unit coverage proves blank UI-model generation, strict blank artifact refusal,
and successful three-file creation for a valid SVG. Critical browser coverage
checks a clean blank boot, workspace controls, Problems access, disabled
Save/Export, diagnostics opt-in, blank → Basic Face enablement, and Basic Face →
New restoration of the blank action state.

Logic-level tests, Verify, and the production build passed locally. Browser
critical, stability, cross-browser, Pages, and extended stress commands were
invoked, but no scenario could launch because the Playwright browser binaries
were unavailable and their CDN downloads returned HTTP 403. CI must execute
those gates; they must not be inferred green from the unit result. Both npm
audit commands were also attempted, but the registry advisory endpoint returned
HTTP 403, so no local advisory result can be claimed.
