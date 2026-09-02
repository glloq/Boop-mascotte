# UX/UI implementation roadmap

## Sequencing rules

This roadmap is recalculated from the live V2 dependencies. It favors vertical slices, keeps legacy routes operational until replacement gates pass, and does **not** authorize schema/runtime changes. Every schema/runtime proposal starts with an ADR and migration/parity tests. Feature flags or route adapters provide rollback; deletion occurs only in the final cleanup.

**Cross-cutting invariant for every PR:** no UI preference in `ProjectDocument`; authored mutations use explicit domain-scoped commands/history; preview is session-only; exported runtime stays UI-independent; browser-only/GitHub Pages remain green.

## Final sequence

```text
UX-01 journey contracts
  → UX-02 navigation/selection foundation
    → UX-03 Home/New/Open vertical slice
    → UX-04 Artwork consolidation
      → UX-05 Face Setup assignment vertical slice
        → UX-06 detection review
        → UX-07 controls + visual calibration
          → UX-08 Preview/readiness foundation
            → UX-09 Expressions ADR + vertical slice
              → UX-10 Expression studio/presets
            → UX-11 Motion adapter + preset vertical slice
              → UX-12 Motion studio/Timeline bridge
            → UX-13 Reactions ADR/runtime vertical slice (needs 09,11)
              → UX-14 Reaction builder + simulator
            → UX-15 Idle & Automatic
          → UX-16 Readiness deep links + Export workspace
  → UX-17 Advanced consolidation
  → UX-18 Search/command registry
  → UX-19 Tablet adaptation
  → UX-20 Mobile job mode
  → UX-21 accessibility/keyboard gate
  → UX-22 visual regression/performance/polish
  → UX-23 legacy removal
```

This is 23 slices rather than the prompt's 32: Inspector is part of the selection foundation; Preview and readiness foundations arrive before new entities; each new product abstraction begins with its contract and a usable vertical slice; tablet/mobile follow stable semantics; Timeline is bridged with Motion rather than independently rebuilt.

## PR specifications

### UX-01 — Product-journey contracts and baseline E2E
- **Goal:** encode current supported journeys and target-facing semantic test helpers without changing UI.
- **Dependencies:** UX-00 only.
- **Likely files:** `tests/e2e/`, editor helper/snapshot diagnostics, test docs.
- **Schema/runtime impact:** none / none.
- **UI changes:** none except stable test attributes if indispensable.
- **Unit tests:** workspace/session ownership and diagnostic helper contracts.
- **E2E:** Basic Face→gaze→Preview→Export; import→assign role; blocked export recovery baseline; save/open.
- **DoD:** deterministic Chromium journeys, current limitations explicitly asserted, no implementation of new UX.
- **Risks:** brittle text/selectors, accidental specification of legacy IA.
- **Rollback:** remove new specs/helpers; production behavior untouched.

### UX-02 — Task router, centralized selection and contextual Inspector foundation
- **Goal:** introduce UI-only route/selection contracts and one Inspector outlet while adapting legacy panels.
- **Dependencies:** UX-01.
- **Likely files:** `ui/app-shell.js`, `ui/workspace-state.js`, `ui/editor-context.js`, `main.js`, inspector adapters, tests.
- **Schema/runtime:** none / none. **UI:** task navigation skeleton and compatible legacy routes.
- **Unit/E2E:** preference normalization, route→selection→inspector; history/project revisions unchanged by navigation.
- **DoD:** one active inspector context, deep-link API, legacy workspaces reachable.
- **Risks:** focus loss/local panel selection drift. **Rollback:** feature flag to legacy shell.

### UX-03 — Home / New / Open / Recover vertical slice
- **Goal:** give first-run and returning users one safe project entry surface.
- **Dependencies:** UX-02.
- **Files:** template/preset UI, project replacement/snapshot adapters, autosave UI, E2E.
- **Schema/runtime:** none / none. **UI:** Home cards, template capabilities, recent local recovery.
- **Tests:** local metadata normalization; cancel/failure atomicity; new/open/recover E2E.
- **DoD:** create/open/recover without current-project data loss; privacy/local-only copy.
- **Risks:** stale/quota storage. **Rollback:** retain existing empty state/file menu.

### UX-04 — Artwork workspace consolidation
- **Goal:** combine import, Face Builder, Layers and element editing around Canvas.
- **Dependencies:** UX-03.
- **Files:** `svg-editor/`, asset UI, Inspector, shell CSS modules.
- **Schema/runtime:** none / none. **UI:** Artwork task, stable layer collection/context inspector.
- **Tests:** command/history for edits; import, layer keyboard, transform E2E.
- **DoD:** all existing artwork operations remain reachable; Canvas stays dominant.
- **Risks:** feature loss during panel move. **Rollback:** legacy Create adapter.

### UX-05 — Face Setup assignment vertical slice
- **Goal:** rename/reframe Rig and complete required role assignment by direct Canvas picking.
- **Dependencies:** UX-04.
- **Files:** semantic rig panel/model/commands, Canvas role mode, contextual Inspector.
- **Schema/runtime:** none / none. **UI:** eight-role checklist, next-role flow, manual validation.
- **Tests:** assignments command/undo/duplicate guard; imported SVG role journey.
- **DoD:** head/eyes/pupils/brows/mouth assignable without IDs/bindings vocabulary.
- **Risks:** left/right ambiguity/nested selection. **Rollback:** legacy Rig tabs remain behind Advanced.

### UX-06 — Face-role detection and review
- **Goal:** suggest roles from IDs/names/hierarchy/position/geometry with confidence and manual confirmation.
- **Dependencies:** UX-05.
- **Files:** new editor detection service/tests, Face Setup review UI.
- **Schema/runtime:** transient editor data only / none. **UI:** candidate highlight/reason/confirm.
- **Tests:** deterministic fixtures, ambiguity and no auto-commit; E2E accept/correct.
- **DoD:** suggestions never mutate until confirmed; low confidence is explicit.
- **Risks:** false confidence, mascot-left errors. **Rollback:** disable detection; manual flow remains.

### UX-07 — Basic controls and visual calibration
- **Goal:** enable/test Basic controls and capture low/neutral/high poses using V2 semantic commands.
- **Dependencies:** UX-05 (UX-06 optional enhancement).
- **Files:** semantic registry/panel/commands, Canvas capture modes, PreviewController adapters.
- **Schema/runtime:** none initially / none. **UI:** Basic/More controls, Capture, XY test.
- **Tests:** capture command/undo/generated driver parity; gaze calibration E2E.
- **DoD:** normal gaze requires no formula/binding editing; cancel restores artwork.
- **Risks:** transform/morph ownership conflicts. **Rollback:** legacy Calibrate tab.

### UX-08 — Preview and readiness foundation
- **Goal:** organize existing preview capabilities and derive section readiness without new product entities.
- **Dependencies:** UX-02, UX-05, UX-07.
- **Files:** preview UI/controller, validation/cache, route metadata.
- **Schema/runtime:** none / none. **UI:** reset/focus/live controls; Artwork/Face Setup readiness.
- **Tests:** zero document writes, reset composition, readiness purity; E2E deep link prototype.
- **DoD:** test gaze/mouth/clip/state/behavior in coherent groups; stable readiness codes begin.
- **Risks:** authored/transient confusion. **Rollback:** legacy Preview/Problems adapters.

### UX-09 — Expression contract ADR and vertical slice
- **Goal:** define Expression distinct from State, migration/runtime mapping, then create/apply/capture one Expression end-to-end.
- **Dependencies:** UX-07, UX-08.
- **Files:** new ADR/schema normalization/commands, expression UI, preview/runtime adapter as approved.
- **Schema/runtime:** **schema evolution expected** / runtime mapping possibly required.
- **Tests:** migrations, commands/history, intensity parity; create Happy E2E.
- **DoD:** Neutral/Happy CRUD/capture/apply; old projects/export remain compatible.
- **Risks:** State aliasing/export compatibility. **Rollback:** version-gated entity and read adapter; no destructive migration.

### UX-10 — Expression Studio, presets and intensity
- **Goal:** complete reusable Expression authoring.
- **Dependencies:** UX-09.
- **Files:** expression collection/inspector/preset catalog/Preview.
- **Schema/runtime:** uses UX-09 / uses UX-09.
- **UI:** presets, intensity, duplicate/rename/delete, missing-control guidance.
- **Tests:** preset availability/normalization; CRUD and intensity E2E.
- **DoD:** eight named presets offered only where supportable; custom values preserved.
- **Risks:** presets look wrong across rigs. **Rollback:** hide incompatible presets; custom slice remains.

### UX-11 — Simple Motion contract and preset vertical slice
- **Goal:** define lossless relationship to clips and create/test Nod without Timeline.
- **Dependencies:** UX-07, UX-08.
- **Files:** ADR, clip adapter/compiler, Motion commands/UI.
- **Schema/runtime:** editor/schema metadata possible / existing clip runtime preferred.
- **Tests:** deterministic preset→clip, round trip/history; Nod E2E.
- **DoD:** amplitude/duration/speed/loop Nod is export-compatible; complex clips untouched.
- **Risks:** destructive regeneration/manual-key loss. **Rollback:** generated clips isolated/versioned; Timeline remains.

### UX-12 — Motion Studio and Advanced Timeline bridge
- **Goal:** add remaining presets and explicit simple→complex editing transition.
- **Dependencies:** UX-11.
- **Files:** Motion UI/presets, timeline routing/selection.
- **Schema/runtime:** per UX-11 / none expected.
- **Tests:** preset compilers, conversion warning; open/edit/play E2E.
- **DoD:** seven presets; complex badge; Timeline feature parity.
- **Risks:** two editors fighting ownership. **Rollback:** read-only summary for complex clips.

### UX-13 — Reaction contract and runtime vertical slice
- **Goal:** specify trigger/expression/motion/timing/priority/interrupt/return and ship Click→Surprised end-to-end.
- **Dependencies:** UX-09, UX-11, UX-08.
- **Files:** ADR/schema/runtime engine/commands/Reaction UI/export tests.
- **Schema/runtime:** **both expected**.
- **Tests:** migration, interruption/return determinism, exported runtime parity; click reaction E2E.
- **DoD:** one Click reaction authorable/testable/exportable; custom event contract documented.
- **Risks:** concurrency/state restoration. **Rollback:** schema feature-gated; runtime ignores unknown optional block safely per ADR.

### UX-14 — Reaction Builder and event simulator
- **Goal:** complete friendly Reaction CRUD and local triggers/logging.
- **Dependencies:** UX-13.
- **Files:** Reaction inspector/list, Preview simulator/session, runtime adapter.
- **Schema/runtime:** uses UX-13 / may add approved triggers.
- **Tests:** trigger matrix/priority; click/hover/timer/custom E2E.
- **DoD:** When/Do/Timing/After complete; simulator never authors data.
- **Risks:** browser event semantics/timer flake. **Rollback:** simulator types feature-flagged individually.

### UX-15 — Idle & Automatic vertical slice
- **Goal:** present blink/oscillator as outcomes and add only approved new automatic behaviors.
- **Dependencies:** UX-08; Reaction work not required.
- **Files:** behaviors UI/catalog/commands/runtime only if ADR adds types.
- **Schema/runtime:** none for existing; evolution for new semantics / same.
- **Tests:** normalization/composition; toggle/test/export E2E.
- **DoD:** Blink, Natural gaze, Idle head movement labels accurately map behavior; preview transient.
- **Risks:** misleading generic oscillator mapping. **Rollback:** show only exact supported cards.

### UX-16 — Readiness deep links and Export workspace
- **Goal:** replace Problems with complete actionable readiness and dedicated compatible export.
- **Dependencies:** UX-08, UX-10, UX-12, UX-14 (can show optional categories absent).
- **Files:** validator/cache/export policy/UI/router.
- **Schema/runtime:** none / none. **UI:** sections, counts, blocking reason, Fix/return.
- **Tests:** stable code/route payload and cache; blocked→fix→export E2E.
- **DoD:** every blocking diagnostic deep-links or explicitly explains no automatic target; artifacts unchanged.
- **Risks:** stale targets/incorrect blocking. **Rollback:** retain legacy Problems/export popover adapter.

### UX-17 — Advanced tools consolidation
- **Goal:** house Parameters/Bindings/Constraints/Morphs/Timeline/State Machine/Diagnostics coherently.
- **Dependencies:** UX-04, UX-12, UX-16.
- **Files:** shell routes and existing editor panels.
- **Schema/runtime:** none / none. **Tests:** route/feature parity; advanced authoring E2E.
- **DoD:** no existing expert capability lost; Advanced collapsed by default.
- **Risks:** obscure necessary fixes. **Rollback:** direct legacy routes remain until UX-23.

### UX-18 — Search and command palette
- **Goal:** central action registry powers search, routes and discoverable shortcuts.
- **Dependencies:** UX-02, stable routes through UX-17.
- **Files:** UI command registry/index/palette, entity adapters.
- **Schema/runtime:** none / none.
- **Tests:** scope/disabled reasons/focus; keyboard navigation E2E.
- **DoD:** actions use commands; search state session-only; no execution while unsafe.
- **Risks:** duplicated shortcuts/stale index. **Rollback:** disable palette; direct navigation remains.

### UX-19 — Tablet adaptation
- **Goal:** implement drawer + contextual bottom sheet and touch-safe supported authoring.
- **Dependencies:** UX-16, UX-17.
- **Files:** shell/layout CSS, gestures, panel primitives, responsive E2E.
- **Schema/runtime:** none / none.
- **Tests:** preference/detent/focus; portrait/landscape touch journeys.
- **DoD:** Canvas dominant; no stacked sidebars; 44 px targets; full stated tablet jobs.
- **Risks:** gesture conflict/virtual keyboard. **Rollback:** responsive feature flag to laptop overlay.

### UX-20 — Mobile priority mode
- **Goal:** deliver Preview/Expressions/Reactions/small edits/Export and explicit limitations.
- **Dependencies:** UX-19, feature studios.
- **Files:** mobile nav/sheets/capability guards/E2E.
- **Schema/runtime:** none / none.
- **Tests:** capability policy and safe handoff; 320/390 px journeys.
- **DoD:** no inaccessible save/export; one sheet; unsupported precision tools clearly gated.
- **Risks:** accidental feature hiding/data loss perception. **Rollback:** “desktop layout” escape option during rollout.

### UX-21 — Accessibility and keyboard release gate
- **Goal:** close semantic, focus, contrast, reduced-motion and keyboard gaps across completed IA.
- **Dependencies:** UX-18–20; accessibility criteria were already required in every slice.
- **Files:** all UI primitives, tests/docs.
- **Schema/runtime:** none / none.
- **Tests:** automated accessibility tooling if adopted, keyboard E2E, manual screen reader matrix.
- **DoD:** documented WCAG 2.2 AA audit; Canvas alternatives; shortcut help.
- **Risks:** late structural fixes—mitigated by per-slice gates. **Rollback:** fixes individually revertible; never roll back essential accessibility without replacement.

### UX-22 — Visual regression, performance and UX polish
- **Goal:** lock responsive visual baselines and budgets after behavior stabilizes.
- **Dependencies:** UX-21.
- **Files:** Playwright snapshots, budgets, CSS/token cleanup.
- **Schema/runtime:** none / none.
- **Tests:** multi-viewport screenshots, performance/long-project stress, cross-browser.
- **DoD:** reviewed baselines, no critical overflow, budget recorded, reduced-motion stable.
- **Risks:** flaky snapshots/browser fonts. **Rollback:** narrow snapshots; never weaken functional assertions.

### UX-23 — Legacy UI removal
- **Goal:** delete adapters/routes/styles only after parity evidence and migration telemetry substitute (test evidence in this local app).
- **Dependencies:** all prior gates.
- **Files:** `index.html`, `main.js`, legacy panel glue/CSS/tests/docs.
- **Schema/runtime:** none beyond approved prior migrations / none.
- **Tests:** full unit, critical/cross-browser/extended E2E, Pages build.
- **DoD:** capability map proves parity; no dead selectors/routes; docs updated; export/runtime fixtures identical where expected.
- **Risks:** hidden expert regression. **Rollback:** last pre-removal commit/adapter branch; keep change isolated.

## Next PR: UX-01 precisely

UX-01 is **not** the new shell. It is a small test-only contract PR: add semantic Playwright helpers and stable journeys for (1) Basic Face→gaze test→three-artifact export readiness, (2) SVG import→manual semantic assignment→Preview, (3) blocked export diagnostic discovery/recovery where currently possible, and (4) save/open round trip. Record current action/surface counts as test annotations or companion fixtures, assert preview/session actions do not increment persistent revisions, and avoid selectors that encode `Create/Rig/Animate` as the future IA. Production changes are limited to minimal stable `data-testid`/diagnostic hooks when no semantic selector exists.

## Program gates

A slice merges only with `npm ci`, `npm run verify`, relevant Chromium journeys, and—when it touches shell/input/runtime/export—the cross-browser `npm run verify:e2e`. Schema/runtime slices additionally require old fixture migration, editor/runtime parity and standalone export tests. GitHub Pages base-path build is never optional.

## Delivery log

| Slice | Status | Record |
| --- | --- | --- |
| UX-04.2 | merged into branch, test-only gate closure | `docs/UX04_2_BROWSER_GATE_CLOSURE.md` |
| UX-05 Face Setup assignment | delivered | `docs/UX05_FACE_SETUP.md` |
| UX-06 Face-role detection and review | delivered | `docs/UX06_FACE_ROLE_DETECTION.md` |
| UX-07 Basic movements and visual calibration | delivered | `docs/UX07_FACE_MOVEMENTS.md` |
| UX-08 Preview test bench and readiness foundation | delivered | `docs/UX08_PREVIEW_READINESS.md` |
| UX-09 Expressions contract and vertical slice | delivered | `docs/ADR_EXPRESSIONS.md`, `docs/UX09_EXPRESSIONS.md` |
| UX-10 Expression presets and guidance | delivered | `docs/UX10_EXPRESSION_PRESETS.md` |

Next: UX-11 Simple Motion contract and preset vertical slice.
