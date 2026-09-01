# PR 41 browser gate closure

Base: `11532ad0c0d9d5ed2cb0589cc686f8d4b62f9917`.

The requested Actions runs could not be downloaded in this environment: `gh run view 33550769240 --log` and `gh run view 33550769258 --log` require GitHub authentication, and outbound GitHub access is blocked. The matrix therefore records the supplied run evidence and local source/runtime investigation; gates remain **unverified**, not PASS, until PR-head CI runs.

| suite | browser | test | observed failure | classification | actual UX contract | root cause | production fix | test fix | final result |
|---|---|---|---|---|---|---|---|---|---|
| critical | Chromium | dirty New Project | `Rectangle (R)` not found | BRITTLE SELECTOR | tool identity is `data-design-tool="rect"`; visible label is Rectangle | title text was treated as accessible name | none | use the semantic design-tool hook and retain real pointer drawing | locally updated; CI pending |
| critical | Chromium | Basic Face setup | duplicate CTA lookup/setup timeout | BRITTLE SELECTOR | blank-project primary action is `[data-use-template="basic"]` | document-wide marketing-text lookup | none | fail-fast helper checks loaded state, SVG/head, and semantic Parts | locally updated; CI pending |
| critical | Chromium | Build a Face | redundant CTA click | WRONG UX CONTRACT | entering from `#empty-face` opens the configured builder | helper and caller disagreed on whether entry occurred | none | `enterFaceBuilder` enters once and verifies all controls | locally updated; CI pending |
| critical/smoke | all | Rig gaze | `[data-xy]` timeout | STALE TEST | select Gaze, open Controls, operate `[data-control="lookX"]` | current Rig uses an accessible range input, not a generic XY pad | none | staged semantic-control helper and public range interaction | locally updated; CI pending |
| smoke | Firefox | Create navigation | mutable accessible name timeout | FLAKY TEST | workspace identity is `data-workspace`; readiness marks may change text | exact visible label ignored status suffixes | none | canonical workspace helper waits on `#app[data-workspace]` | locally updated; CI pending |
| stability | Chromium | Preview toggling | expected Exit Preview after workspace click | WRONG UX CONTRACT | Preview workspace and Focus Preview are independent | test conflated navigation with display mode | none | separate 100-cycle workspace and Focus tests | locally updated; CI pending |
| stability | Chromium | SVG selection | zero selection mutations | POINTER HIT-TEST BUG | clicks must land on painted selectable geometry | bbox centers can be transparent | none proven | sample with `elementFromPoint`, then issue genuine mouse clicks alternating head/mouth | locally updated; CI pending |
| critical | Chromium | Timeline reload | identity at symmetric midpoint | LIFECYCLE BUG | restored active clip must bind to Preview; stopped seeks apply immediately | restore relied indirectly on render subscription; additionally, `-1 → +1` at `t=.5` correctly evaluates to zero, so identity there is not evidence of failure | validate/fallback active clip, clamp playhead, explicitly bind and seek Preview after restore | assert easing/evaluated value and non-identity at `t=.25` (`lookX=-.75`) | unit regression PASS; browser CI pending |

## Active clip and playhead contract

A valid saved `animationEditor.activeClipId` is restored. If it is missing or invalid, the first clip is selected deterministically. The playhead is clamped to that clip. Project restore explicitly binds Preview to that clip and seeks before applying a frame. A manual stopped playhead input evaluates and applies immediately without starting a RAF loop.

The exact midpoint of symmetric keys `-1` and `+1` is zero, including ease-in-out; therefore an identity gaze transform at `t=.5` is mathematically correct. The regression uses `t=.25`, where the configured easing evaluates `lookX` to `-0.75`, so real movement is a meaningful invariant.
