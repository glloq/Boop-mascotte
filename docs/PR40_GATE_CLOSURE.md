# PR #40 gate closure

## Evidence and failure matrix

Baseline: `main` at `3952e667f835cf50a60763c39fad76a661472302`.

The GitHub CLI is not authenticated in this environment and the Actions log archive endpoint is blocked by the network proxy. The matrix therefore records the exact run IDs and failures reported by those runs in the PR brief, correlated with the failing test source. Results are updated only after a test actually runs.

- Browser E2E run: `33547207943` (Verify passed; Chromium critical 6 passed / 4 failed; Stability 2 passed / 2 failed; cross-browser smoke 8 passed / 2 failed).
- Pages run: `33547207929` (build passed; deploy passed; deployed browser smoke failed).

| suite | browser | test | failure | classification | root cause | production fix? | test fix? | result after fix |
|---|---|---|---|---|---|---|---|---|
| critical | Chromium | blank editor boots safely | test expects Discard after replacing a project whose template load is clean | WRONG UX CONTRACT | clean New Project correctly replaces immediately; the test conflates clean and dirty replacement | no | split clean and genuinely dirty flows | pending |
| critical | Chromium | Build a Face generates a valid project | `Build a Face` is hidden inside current Templates UI | STALE TEST | test bypasses the public More templates → Face Builder disclosure workflow | no | use `openFaceBuilder` | pending |
| critical | Chromium | timeline track workflow | strict locator finds duplicate `#add-track` | PRODUCT BUG | toolbar and empty-state CTA render the same ID simultaneously | yes, unique IDs and shared semantic action | migrate test to semantic action | pending |
| critical | Chromium | shared Rig journey | timeout waiting for `[data-semantic-part-id="gaze"]` | PRODUCT BUG | Basic Face guarantees Gaze, but the rendered navigator omitted its public semantic-Part hook and readiness state | yes, restore semantic hooks/readiness | make helper fail fast and select through the Part button | pending browser run |
| stability | Chromium | repeated Space and preview toggling | test looks for authoring `Animate` while Preview focus mode is active | WRONG UX CONTRACT | test does not use the canonical Exit Preview control | no | exit Preview before authoring navigation; retain lifecycle invariants | pending |
| stability | Chromium | repeated SVG selection | raw SVG locator is intercepted by `#canvas` | POINTER LAYER BUG | test bypasses the canvas' intended delegated pointer input / coordinate hit path | only if public Select mode is broken | exercise public input layer without `force` | pending |
| smoke | Firefox | shared Rig journey | timeout waiting for semantic Part | PRODUCT BUG | same missing shared navigator contract as Chromium, not engine-specific | yes, shared production fix | deterministic shared helper | pending browser run |
| smoke | WebKit | shared Rig journey | timeout waiting for semantic Part | PRODUCT BUG | same missing shared navigator contract as Chromium, not engine-specific | yes, shared production fix | deterministic shared helper | pending browser run |
| Pages smoke | Chromium | deployed editor previews and exports | no `[data-semantic-part-id]` is rendered | PAGES BUG | deployed smoke shares the obsolete local semantic-Part selector contract; build and deploy succeeded | no Pages-only workaround | use the same deterministic local/Pages Rig journey | pending |

## Semantic Part contract investigation

Source verification answers the contract question **YES**: Basic Face guarantees a Gaze semantic Part. `applyTemplateProject(state, 'basic')` creates `head`, `gaze`, `mouth`, then `eyes`; Gaze assigns `leftPupil` to `pupilLeft` and `rightPupil` to `pupilRight`. The Basic Face SVG includes `faceRoot`, `head`, `eyeLeft`, `eyeRight`, `pupilLeft`, `pupilRight`, and `mouth`. Rig auto-setup is expected for this deterministic template. Expressive Face has the same four core Parts plus eyelids, eyebrows, nose, jaw, and hair. Face Builder guarantees `head`, `eyes`, `gaze`, `eyebrows`, and `mouth`. The catalog remains available for imported/unrigged SVGs, where zero semantic Parts is valid and now renders an explicit empty state.

## Security audit

`npm audit` and `npm audit --omit=dev` could not reach the registry advisory endpoint (HTTP 403). Both offline audit commands report 0 known vulnerabilities in the installed lockfile metadata. The baseline claim of two high-severity advisories cannot be independently attributed in this environment, so no dependency was changed and no reachability claim is made.

## Final gate evidence

No gate is marked green until its command or PR-head Actions job completes successfully.
