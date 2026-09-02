# PR #48 — Visual Authoring V2

## Green base

- Base SHA: `8e5640a227319ca5770f789461623bb7f004d0fe`
- PR #47: merged
- Verify: **SUCCESS**, run `33589256277`
- Browser E2E: **SUCCESS**, run `33589256280`
  - chromium-critical: **SUCCESS**
  - stability: **SUCCESS**
  - cross-browser-smoke: **SUCCESS**
- GitHub Pages: **SUCCESS**, run `33589256272`
  - build: **SUCCESS**
  - deploy: **SUCCESS**
  - smoke / `test:e2e:pages`: **SUCCESS**

The required local pre-change `npm ci` was attempted, but the configured registry returned HTTP 403. The recorded PR #47 Actions baseline above is consequently the authoritative green base.

## Legacy audit before migration

| File / function | Access | Ownership | Domains | History | Compatibility API | V2 target | Status |
|---|---|---|---|---|---|---|---|
| `svg-canvas.js` selection/lock/pose reads | read | persistent + transient | artwork/layers; session selection | no | `getState` | `getDocument` / `getSession` | migrated |
| `svg-canvas.js` gesture/commit/refresh/append | write | authored (selection split out) | artwork, layers | one per gesture | `setState` | artwork sync command + `mutateSession` | migrated |
| `inspector.js` render and all edit handlers | read/write | authored; transient selection | artwork | one logical edit | `getState` / `setState` | artwork commands | migrated |
| `rig-store.js#setPivot` | write | authored | artwork | caller-owned | `setState` | explicit artwork mutation | migrated |
| `semantic-parts/rig-panel.js` navigation | read/write | transient | none | no | flat facade | document/session APIs | migrated |
| `semantic-parts/rig-panel.js` create/role/control/method/calibration/morph/remove | read/write | authored | semanticRig, artwork, rig, stateMachine as declared | one | `setState` / `replaceState` | semantic commands | migrated |
| `semantic-parts/rig-panel.js` live/commit controls | write | preview then authored | rig on commit | one | `setState` | PreviewSession + rig command | migrated |
| `main.js#bindAddFeature` | read/write | authored | artwork, layers, rig, stateMachine, semanticRig, animation | one | `getState` / `setState` | atomic feature command | migrated |
| `main.js` state-machine/behavior and unrelated integration | read/write | mixed | stateMachine/behaviors and compatibility | existing | flat facade | PR #49 commands | deferred |

## Design and invariants

Commands carry explicit type, source and domain metadata. Canvas preparation returns plain authored data and can opt out of persistence. Feature installation preflights collisions and semantic operations against a detached candidate, snapshots only after successful validation, then commits all affected fields in one revision. A failed installation restores the prior Canvas markup; an installed feature is an idempotent no-op.

History remains ProjectDocument snapshot history. Commands do not retain DOM/SVG.js objects. Selection and semantic navigation use EditorSession; live rig values remain PreviewSession-owned until commit. Runtime Compiler, keyforms, expressions/emotes/reactions and schema changes are out of scope.

## Post-migration caller budget

Canvas, Inspector, Semantic Rig, face installation and `rig-store.js` have zero production `setState`/`replaceState` calls and zero flat reads in their migrated files. Remaining production compatibility calls are enumerated by the repository-wide searches and belong primarily to State Machine, Behaviors, layer-panel compatibility, and untouched `main.js` integration. Snapshot history remains deliberately clone-based.
