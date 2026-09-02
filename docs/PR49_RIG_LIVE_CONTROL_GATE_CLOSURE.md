# PR #49 — Rig live-control gate closure

## Exact merged-main baseline

Base `main` SHA: `d6a6d365700ca6c44161ab631b631c2dfbdb455a`.

| Workflow | Run | Job | Merged-main result |
| --- | ---: | --- | --- |
| Verify | 33590505787 | Verify | SUCCESS |
| Browser E2E | 33590505748 | chromium-critical | FAILURE (10 passed, 2 failed) |
| Browser E2E | 33590505748 | stability | SUCCESS |
| Browser E2E | 33590505748 | cross-browser-smoke | FAILURE (8 passed, 2 failed) |
| GitHub Pages | 33590505685 | build | SUCCESS |
| GitHub Pages | 33590505685 | deploy | SUCCESS |
| GitHub Pages | 33590505685 | smoke | SUCCESS |

PR #48 retained a green Verify, stability, and Pages baseline, but was **not fully green**: its Chromium critical and Firefox/WebKit public Expressive gaze journeys failed.

## Reproduction and event-sequence diagnosis

The public `lookX = +0.8` range interaction was traced through the pre-fix handlers and PreviewController. Values below describe the failing active `idle` state used by the template journey.

| Stage | `params.lookX.value` | `states.idle.lookX` | live `lookX` | effective `lookX` | pupil transform | persistent / rig revision / history |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Before interaction | 0 | 0 | absent | 0 | identity | unchanged |
| Native `input` event | 0 | 0 | not yet set | 0 | identity | unchanged |
| after `preview.setLiveParam()` | 0 | 0 | 0.8 | 0.8 | displaced | unchanged |
| before blur/change | 0 | 0 | 0.8 | 0.8 | displaced | unchanged |
| inside old `change` handler | 0 | 0 | 0.8 | 0.8 | displaced | unchanged |
| after old `commands.commitParams()` | 0.8 | 0 | 0.8 | 0.8 | displaced | +1 / +1 / +1 snapshot |
| after old `preview.clearLiveParam()` | 0.8 | 0 | absent | 0 | identity | already advanced |
| final `PreviewController.compute()` | 0.8 | 0 | absent | 0 | `translate(0 0) rotate(0 0 0) translate(0 0) scale(1 1) translate(0 0)` | already advanced |

The hypothesis is confirmed by source-level tracing and the supplied browser observations: `commitParams()` authored a legacy parameter `value`, then blur/change removed the only preview override. `resolveStateParams()` correctly chose the active authored state (`idle.lookX = 0`), so the pupil returned to center. This is a caller ownership bug, not a Chromium input quirk. The fix does not change PreviewController base-value priority.

## Ownership contract

- Parameter definitions (`min`, `max`, `default`) belong to `ProjectDocument.params`.
- Authored poses belong to `ProjectDocument.states[state]`.
- Test values from ordinary Rig controls belong to `PreviewSession.liveParams`; effective values and rendered SVG are derived preview state.
- Auto Key writes a key to `ProjectDocument.animationClips` in the `animation` domain. It does not write `params.value`, an active state pose, or the `rig` domain.
- A legacy `params[name].value` is not the canonical current pose in schema V3.

## Corrected control and reset lifecycle

`input` immediately calls `setLiveParam()`. `change` reasserts the live value (covering native keyboard/change paths), leaves it live after blur, and invokes Timeline Auto Key. With Auto Key off, the callback returns without persistence. With Auto Key on, Timeline owns one normal animation command and one history snapshot.

**Reset Part** clears only that Part's live controls. **Reset all rig controls** clears all live controls. Both re-render range values from live values or parameter defaults and never edit the ProjectDocument. Calibration calculation, cancelling a transient calibration/pick session, project replacement, template/load/new-project replacement, and `PreviewController.reset()` retain their existing meaningful clear lifecycles. Workspace-transition behavior was not changed by PR #49.

## `commitParams()` audit

Before PR #49 there were three references: the command declaration, ordinary range `change`, and the shared Reset Part/Reset All helper. All represented preview testing/recentering; none had a schema-V3 authored owner. All references were removed. The operation was not renamed or replaced with an active-state write.

## Coverage and invariants

The critical Build-a-Face journey and the existing cross-browser Expressive journey now assert reversible `+0.8`/`-0.8` effective values and pupil translations after the real fill/keyboard/fill/blur helper. The Basic Face cross-browser journey additionally asserts that the ProjectDocument, document mutation count, history, autosave schedules, and validation runs do not change. Unit coverage fixes the priority contract (`params.value=.8`, active state `0`, no live value => `0`; live `.8` => `.8`) and checks 10,000 live updates leave every store revision unchanged.

Calibration, morph capture/interpolation, method switching, conflict handling, atomic Face Features, Canvas, Inspector, Timeline, Save/Open, and Export architecture are left intact. Visual Authoring V2 remains in place; no `store.setState`, flat-facade clone, Preview fallback, state authoring, schema migration, Runtime Compiler, Keyforms, Expressions, or Reactions work is introduced.

## Local environment note

The required baseline `npm ci` could not fetch `@playwright/test@1.55.0` because the registry returned HTTP 403. Since `npm ci` first removed installed dependencies, Vite and Playwright were unavailable for local build/browser gates. This is an environment limitation, never recorded as PASS; exact PR-head Actions and post-merge `main` checks remain mandatory.

## Security audit decision

Run `npm audit` and `npm audit --omit=dev` at the final head. Record package, advisory, direct/transitive status, production/dev scope, and compatible fix availability. Do not use `npm audit fix --force`; dependency migration is outside this ownership repair unless a production vulnerability has a safe compatible fix.

## Deferred work

State Machine and Behaviors remain future V2 command migrations. Layer-panel facade cleanup, remaining `main.js` compatibility reads, and patch history remain debt. Runtime Compiler, Keyforms/blend shapes, Expressions, and Reactions are **not started**.
