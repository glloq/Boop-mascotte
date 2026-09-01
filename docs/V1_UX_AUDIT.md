# V1 UX audit

Audited against `f83f5e22332c36723c2f708ad70284be1e26f4d9` on 2026-09-01. The audit followed only visible controls from a fresh load.

| Journey step | Before | Consolidation result |
| --- | --- | --- |
| Open application | **CONFUSING** — the starter route was prominent but SVG and project files were not explained | **CLEAR** — template, Import SVG (artwork only), and Open Project (complete editable project) are distinct |
| Create/open artwork | **CLEAR** templates; **HIDDEN** blank/import alternatives | **CLEAR** starter and import routes remain visible |
| Edit SVG | **CLEAR** | Vector tools remain in Create; raw structure is Advanced |
| Rig Parts | **CLEAR** once entered; **MISSING FEEDBACK** globally | Readiness and Problems now expose rig errors and link to Rig context |
| Configure movement | **CLEAR** | Human control labels remain catalog-driven; generated details remain Advanced |
| Animate | **CLEAR** | Animations remain visibly grouped in Animate |
| States/transitions | **CONFUSING** relationship to Animate | States are an Animate authoring mode; transitions stay under States |
| Behaviors | **HIDDEN** behind author navigation | Readiness and contextual Fix links open Behaviors directly |
| Preview | **CLEAR** | State, animation, behavior controls, Reset, and Focus remain non-persistent |
| Problems | **HIDDEN** under Advanced and raw-string-only | **CLEAR** first-class action, readiness summary, normalized severity, and contextual Fix |
| Save/Open | **INCONSISTENT** top action said “Save” | **CLEAR** “Save Project” and file descriptions distinguish editable JSON from SVG |
| Export | **MISSING FEEDBACK** warnings used `confirm()` and files lacked descriptions | **CLEAR** blocking errors open Problems; manifest explains all three artifacts and V1 clip scope |
| Standalone demo | **CLEAR** through documentation/Pages | Remains schema-v3 and browser-only |

## Canonical workflow

**Create → Rig → Animate → States → Behaviors → Preview → Export.** States and Behaviors are optional authoring modes inside Animate. Users can change workspace at any time; this is guidance, not a wizard.

## Remaining manual audit

Precision authoring at phone width, modal focus trapping across every legacy dialog, and the full four-viewport visual matrix remain release-gate checks. See `V1_RELEASE_STATUS.md`; these are not represented as automated passes.
