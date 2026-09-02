# UX-02.1 — Contextual Inspector browser gate closure

## Baseline and observed CI

This closure starts from `main` at `7212b34c00db9e93f500955e9c24290fbab9153e` and the observed GitHub Actions run `33640420836`: Verify, Cross-browser Smoke, Stability, and GitHub Pages were green; Chromium Critical had 15 of 17 tests passing. No UX-03 Home/New/Open/Recover work is included.

## Failure A — ambiguous Inspector heading

UX-02 derived a heading by exposing the internal selection kind, producing `artwork Inspector`, while the reused artwork adapter retained its own `Inspector` heading. The legacy non-exact role query consequently matched both. Presentation now maps context kinds to explicit product labels (`Artwork Inspector`, `Face Part Inspector`, `Movement Inspector`, `Keyframe Inspector`, and `State Inspector`). The sanitization test scopes its contract to `#context-inspector`, checks `data-context-kind="artwork"`, and verifies the artwork adapter rather than relying on an ambiguous global heading.

## Failure B — inaccessible first Face Part creation

With freshly imported SVG artwork, Face Setup had no `activeSemanticPartId`, so selection context resolved to `none`. Clicking the navigator's **+ Add Part** rendered the catalog inside `#rig-panel`, but the contextual inspector hid that semantic adapter unless the context kind began with `semantic-`. Thus **Add Head** existed in the DOM inside a hidden ancestor.

The presentation rule now keeps the single semantic adapter visible whenever the active task is Face Setup, including its no-selection state. Its existing onboarding and accessible dialog provide first-part creation. After `createPart` runs through the semantic command, the Rig panel selects the returned ID, synchronizes `EditorSession.activeSemanticPartId`, and the context resolves to `semantic-part`.

## Ownership and impact

Task navigation and catalog open/close remain session/UI-only. The focused browser test pins the ProjectDocument snapshot, version token, domain revisions, history, dirty flag, and document-mutation diagnostic across opening and closing. Choosing **Add Head** is the sole authored action, creates one history-backed document mutation, and makes the new part active.

Files are limited to the contextual presentation resolver, semantic flow tests/helpers, and UX-02 documentation. ProjectDocument schema, runtime, and exports are unchanged.

## Gates

The required commands are `npm ci`, `npm run verify`, Chromium Critical, Cross-browser Smoke, Stability, and GitHub Pages suites. In the local closure environment, the offline dependency cache and Verify pass; browser execution is blocked because Playwright browser binaries are absent and their CDN returns HTTP 403. CI must therefore provide the final browser-gate result. The four UX-01 product journeys retain their original objectives, including Import SVG → Head assignment → Preview.
