# PR 42 — Final browser baseline closure

Base: `e2f7d5a3d780de060caab8ca1f71fb370234b43b`  
Branch: `codex/final-browser-baseline-closure`

## Initial CI evidence

The initial matrix below records Browser E2E run `33561911517` and Pages run `33561911502` as reported for the base commit. The local environment cannot download Playwright browser binaries (the CDN returns HTTP 403), so final browser and exact-HEAD Actions results must remain pending until CI runs the committed head. Pages was green on the base and its routing/deployment configuration is unchanged.

| Test | Browser | Observed result | Expected result | Classification | Root cause | Production fix | Test fix | Regression coverage |
|---|---|---|---|---|---|---|---|---|
| dirty New Project supports Cancel, Discard, and Save | Chromium | Timed out finding `New Project` after Cancel | Menu open and command visible on every request | HELPER BUG | Helper blindly toggled an already-open `<details>` menu closed | None | State-aware `openProjectMenu()` | Critical journey retains all three decisions |
| rendered editor IDs and touched ARIA references are valid | Chromium | Began without a deterministic blank editor | Blank and populated audits start from known state | TEST BUG | Test omitted `openFreshEditor` | None | Explicit fresh E2E editor setup | Critical ARIA journey |
| Build a Face generates an honest valid project | Chromium | `#empty-face` existed but was hidden | Enter through visible empty-state UI | HELPER BUG | CTA is inside closed **More examples** details | None | Open details before visible click | Critical Face Builder journey |
| timeline project metadata persists and remains playable after reload | Chromium | effective `lookX ≈ -0.75`; pupil DOM stayed at identity | Restored stopped playhead visibly applies a nonzero frame | RENDER PIPELINE BUG | Canvas passed SVG.js 3-style `translateX`/`rotate`/`originX` keys to SVG.js 2.7. SVG.js 2 selects its scale branch first, ignores those keys, and emits identity | Apply the canonical composed transform explicitly with SVG attributes | Assert numeric translation | Unit compiler and critical reload DOM journey |
| cross-browser template, Rig, Timeline, Save and Export | Chromium, Firefox, WebKit | semantic gaze changed but pupils remained identity | Both pupils move and reverse | RENDER PIPELINE BUG | Same SVG.js 2 transform API mismatch | Same canvas fix | Numeric transform helper; effective-param and direction checks | Critical Chromium plus Firefox/WebKit smoke |
| repeated SVG selection attaches one handler set | Chromium | Intended mouth click could select `faceRoot`; counters stayed flat | Every visible target click selects requested artwork | LIFECYCLE BUG | `clearSelection()` removed only metadata; SVG.js select/resize/drag helpers on the previous wrapper remained active | Explicitly deactivate old plugins, except during owned transform-pose sessions | Recompute a painted hit point immediately before every real click | 100-cycle stability journey and one-selected-element assertion |

## Gaze pipeline trace

For generated Basic/Expressive rigs, both pupil bindings are enabled `translateX` bindings to `lookX`, with amplitude `8`, no zero clamp, and valid pupil IDs. Isolated compilation gives `x = 0` at `lookX = 0`, `x = 6.4` at `+0.8`, and `x = -6.4` at `-0.8` for both pupils. Thus semantic input, effective parameters, binding resolution, `compileRigFrame`, and editor `compileFrame` were correct.

The loss occurred at `canvas.applyFrame`: the requested numeric frame was correct, but `element.transform({ translateX, translateY, rotate, scaleX, scaleY, originX, originY })` does not match SVG.js 2.7's object contract (`x`, `y`, `rotation`, `cx`, `cy`). Because scale keys were present, SVG.js took the scale branch and ignored translation and rotation, yielding an identity matrix. `lastApplied` then cached the requested nonzero frame even though the DOM was unchanged. It was not a stale-node cache invalidation bug.

The canvas now writes one deterministic transform containing authoring translation/rotation/scale and pivot. The existing node-keyed weak cache remains intact. Under `?e2e=1`, read-only `frameFor(id)` exposes effective params, compiled frame, last requested/applied arrays, and the DOM transform. It provides no mutation capability.

## Lifecycle and state semantics

Live gaze remains transient: it calls `PreviewController.setLiveParam`, computes and applies one frame, and does not write the Store, history, or dirty state. Seeking while stopped already calls `compute()` synchronously and does not wake a permanent RAF. Selection deactivation removes select/resize/drag ownership from the prior normal selection while preserving active transform-pose ownership.

Schema remains `RIG_SCHEMA_VERSION = 3`. No Store, history, routing, Pages, or architecture-v2 work is included.

## Local result record

- Unit/integration: 120/120 passed, including reversible gaze on both pupils.
- Build and verify: see final command record in the PR/report.
- Browser suites: pending CI because browser installation is blocked locally by HTTP 403.
- Extended stress: pending normal browser suites/CI; it must not be reported green without execution.
- Exact PR-head Actions and post-merge main: pending publication/merge.

## Merge gate

**NOT READY TO MERGE** until Actions on the exact PR head reports Verify, chromium-critical, stability, and cross-browser-smoke successful. Pages build/deploy/smoke must also remain successful. Post-merge validation must be performed on the resulting main SHA.
