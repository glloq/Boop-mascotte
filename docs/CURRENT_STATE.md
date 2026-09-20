# Boop Mascotte — the state of the editor, now

**This is the authoritative description of what the editor does today.** Where
any other document in `docs/` disagrees with this one, this one is right and
the other is history. Every row below was read out of the code and the tests at
the commit named here, not out of an older document.

- **Baseline:** `main` at `f5b4945` (merge of #160, *The board is the workspace*).
- **Audited:** 2026-09-19.
- **Method:** code first, tests second, documents third. 2306 unit tests pass
  (`npm test`); 69 Playwright spec files exist under `tests/e2e/`.
- **Why a new document:** `docs/UX_UI_CURRENT_AUDIT.md` (2026-09-02) and
  `docs/V4_AUDIT.md` describe editors that no longer exist, and
  `docs/KNOWN_LIMITATIONS.md` carries at least one claim the code has
  outgrown (§4 below). Those stay as history. This is the present tense.

---

## 1. The shape of the thing

The architecture is settled and is **not** in question. `ui/task-router.js`
holds it, and it is already the target architecture:

```text
DESIGN     Assemble · Draw [advanced] · Hands
RIG        Assign · Controls · Head 2.5D · Deform [advanced]
ANIMATE    Expressions · Motions · Timeline [advanced]
BEHAVIOR   Reactions · Automatic · States
GLOBAL     Preview · Export · Advanced · Command palette
```

Three words do three different jobs, and the file is explicit about it:
a **workspace** is one of the four questions, a **mode** is a route inside one,
a **surface** is the column of panels a mode mounts. Several modes share one
surface — `rig.assign` and `rig.controls` are two screens over the same nine
panels, gated by `data-mode` in CSS. Nothing about this needs rebuilding.

One store (`core/state/store.js`), one history, one canvas, one Inspector host.
Routes, selection, zoom and panel widths live in `EditorSession` or in
`localStorage` preferences — **never** in `ProjectDocument`. Verified: there is
no `workspace`, `selectedId`, `zoom` or `layout` key anywhere in
`core/state/project-document.js`.

---

## 2. Capability matrix

`Auth UI` = can an author do it from a panel without hand-editing JSON.
`E2E` names the spec file that actually walks the workflow.

| Capability | Route | Implementation | Runtime dep. | Auth UI | Known UX limitation **(verified)** | Unit tests | E2E |
|---|---|---|---|---|---|---|---|
| Assemble a mascot from the library | `design.assemble` | `rig-editor/semantic-parts/face-library-panel.js`, `core/face-library/*` | — | yes | **Fixed by UX-50 PR 7.** The category follows the selection (`resolveLibraryCategory`), a pressed tab outranks it until the selection moves, drawings that keep this face working sort first, and *Limited animation* names what a drawing would switch off **before** the press. Was: opened on `eyes` and stayed; cost reported only after the press. | `face-part-install.test.js`, `library-context.test.js` | `ux36-create`, `ux50-contextual-selection` |
| Add a part with no library drawing | `design.assemble` | `ui/sidebar-sections.js` | — | yes | Three cards only (eyebrows, eyelids, hands) — correct, by design. | `templates.test.js` | `ux36-create` |
| Vector drawing / nodes / pen | `design.artwork` | `svg-editor/svg-canvas.js` (4755 lines), `draw-tools.js` | — | yes | Still on `svg.select.js` / `svg.resize.js` / `svg.draggable.js` for the rig pose tools. No boolean ops, no gradient editor — deliberate. | `svg-document.test.js` and 20 others | `ux30`, `ux39-drawing-tools-complete` |
| Multi-selection move / align / group | `design.artwork` | `svg-canvas.js:2229‑2380` | — | yes | **Rotate and scale refuse >1 piece** (`svg-canvas.js:1392`). Copy/paste/duplicate act on the piece in hand only. | `selection.test.js` | `ux38-multi-selection` |
| Step into a piece | both Design screens | `svg-canvas.js` (`insidePiece`, `enterSelection`, `stackAt`, `selectInside`) | — | yes | **Finished by UX-50 PR 1.** Double-click enters, `Enter` enters from the keyboard, Escape and an outside click leave, Alt+click reaches behind, and *Select inside…* in the right-click menu names every layer under the pointer. | — | `ux31-canvas-menu`, `ux50-contextual-selection` |
| Piece actions | Design, Hands | `ui/piece-actions.js` (17 actions, `simple`/`more`/`advanced`) | — | yes | Catalogue is shared by canvas menu, floating bar and keyboard. **`Replace…` rejoined it in UX-50 PR 7**, gated on the library having drawings for that part; it had left with the Character Builder, which was the only thing that could answer it at the time. | `piece-actions.test.js` | `ux31-canvas-menu` |
| Hands as drawings | `design.hands` | `ui/hands/*`, `core/hands/*` | `runtime/hands.js` | yes | Library-of-drawings model, as intended. Context is **not** carried across `Hands → Draw → Hands`: side, state and framing are re-derived on return. | `hands.test.js`, `hand-style-install.test.js` | `ux32-hands`, `ux47-hand-workshop` |
| Assign artwork to face roles | `rig.assign` | `rig-editor/semantic-parts/face-setup-panel.js`, `face-role-detection.js` | — | yes | Simple and correct. Auto-detection with confidence, manual confirm, canvas highlight. No bindings/formulas leak here. | `face-setup.test.js`, `face-role-detection.test.js` | `ux05`, `ux06` |
| Turn movements on / off | `rig.controls` | `face-movements-panel.js` + `face-movements.js` | — | yes | **Fixed by UX-50 PR 2.** Shows the band of the part in hand, quick movements open and the rest folded, with the families as a strip to switch parts and `Show all controls` to restore the inventory. Was: all 26 in 5 bands, always, whatever was selected. | `face-movements.test.js`, `face-control-rig.test.js` | `ux07-face-movements`, `ux50-contextual-selection` |
| Pose the mascot on the canvas | `rig.controls` | `core/puppet/puppet-handles.js`, `ui/rig-controls/*` (pad, arc, radial, cage, target) | — | yes | Handles exist and are good. They are not presented as *the* way to pose — the column of sliders is what the screen opens on. | `puppet-handles.test.js`, `rig-handles.test.js` | `ux26-direct-controls`, `ux34-handle-board` |
| Calibrate a movement | `rig.controls` → Inspector | `rig-panel.js:101`, `face-movements.js` (`calibrationSteps`) | — | yes | The step model **exists and is good** (`calibrationSteps` returns rest-first, titled, hinted steps). The Inspector renders it as a flat list of `Edit pose` buttons plus a `Calculate movement` button — not as the guided one-step-at-a-time capture §11 asks for. | `face-control-rig.test.js` | `ux07` |
| Head 2.5D | `rig.head2d` | `rig-editor/head-pose/head-pose-panel.js`, `core/head-pose/head-pose-turn.js` | `runtime.js` keyforms | yes | Grid capture works. Axis configuration is fixed; no Simple/Standard/Custom ladder. | `head-pose-turn.test.js`, `head-pose-panel.test.js` | `ux24-head-turn`, `ux41-pseudo-3d` |
| Pins | `rig.deform` | `rig-editor/holding/holding-panel.js`, `core/rig/pin-model.js` | `runtime.js` | yes | Placed and dragged **on the canvas** (`svg-canvas.js:1043`), reach handles too. **No Shift-select, no marquee, no multi-drag** — the only multi-pin operation is the `group-pins` checkbox form. | `rig-pins.test.js` | `ux43-rig-relationships` |
| Attachment points | `rig.deform` | `holding-panel.js` (`data-point-field`), `core/rig/attachment-model.js` | `runtime.js` | **numeric only** | **Not drawn on the canvas at all.** A point is moved by typing X and Y. No `Pick on canvas`. | `rig-constraint-authoring.test.js` | `ux43` |
| Holds (source → target) | `rig.deform` | `holding-panel.js`, `holding-commands.js` | `runtime.js` | list only | No graphical source→target relation; no visual move of their points. | `rig-constraints.test.js` | `ux43` |
| Warps | `rig.deform` | `rig-editor/warp/warp-panel.js`, canvas lattice at `svg-canvas.js:825` | `runtime.js` | yes | Full canvas lattice with keyboard nudge. This one is done. | `warp-grid.test.js`, `warp-panel.test.js` | `ux42-warp` |
| Meshes | `rig.deform` | canvas lattice at `svg-canvas.js:942` | `runtime.js` | yes | Pictures only, 3×3 or 4×4, one parameter. Deliberate. | `mesh-warp.test.js`, `mesh-handles.test.js` | `ux42` |
| Shape keys | — | `core/shape-keys/shape-key-model.js`, `part-model.js:278` | `runtime.js` | **no** | The runtime plays them, the semantic rig writes them when a movement's method is `shapeKey`, and `Advanced → Deformation` *lists* them read-only. **There is no shape-key editor**: no list, no new/rename/duplicate/reset, no canvas nodes for a selected key, no test value. Re-editing one means switching the movement's method to force a capture session. | `shape-keys.test.js` | — |
| Depth / parallax | — | `core/projection/pseudo-projector.js`, `normalize-rig.js` | `runtime.js` | **no** | Played and imported; `Advanced → Deformation` lists it. No band visualisation, no way to move a piece between planes. | `pseudo-projector.test.js` | `ux41` |
| Expressions | `animate.expressions` | `ui/expression-studio.js` | `runtime.js` | yes | Solid. Record-current-pose, presets, intensity. | `expressions.test.js` | `ux09`, `ux10` |
| Visemes | `animate.expressions` | `core/expressions/*` (`viseme` flag) | `runtime.js` | yes | Stored as expressions with a `viseme` flag — correct model, but the UI does not name the distinction clearly. | `face-states.test.js` | `ux09` |
| Motions | `animate.motions` | `ui/motion-studio.js` | `runtime.js` | yes | Presets are the entry point; Timeline is not required. Correct. | `motions.test.js` | `ux11`, `ux12` |
| Timeline | `animate.timeline` | `animation-editor/timeline/timeline-panel.js` | `runtime.js` | yes | Selecting a key writes `activeSemanticPartId`/`activeControl` (`timeline-panel.js:152`) — selection flows *out*. It does not flow *in*: tracks are never filtered by what is selected, and there is no `Reveal keys for selection`. | `timeline-dope-sheet.test.js`, `timeline-focus.test.js` | `rig-timeline`, `ux12` |
| Behavior board | all three Behavior routes | `ui/behavior-studio/board.js`, `transition-table.js`, `tuning.js` | `runtime.js` | yes | The board is mounted in the **canvas column** (`shell/canvas-column.js:22`), sized `off`/`small`/`large`. One selection drives board, list, table and Inspector via `boardSelectionPatch`. This is recent (#160) and largely matches the target. | `behavior-studio.test.js`, `behavior-vocabulary.test.js` | `ux48-behavior-studio`, `ux39-state-graph` |
| Reactions | `behavior.reactions` | `ui/reaction-studio.js` | `runtime.js` | yes | Conditions supported (`reaction:condition` in `requires`). | `reactions.test.js` | `ux13` |
| Automatic | `behavior.automatic` | `ui/automatic-panel.js` | `runtime.js` | yes | Has its own route since UIR-01. Label is `Automatic`. | `behaviors.test.js` | `ux15` |
| Preview | `preview` | `ui/preview-panel.js`, `app/services/preview-service.js` | `runtime.js` | yes | Writes no document mutations — verified: `preview-service.js` only calls `setLiveParam` and preview-session writes. Background/size/tests present; the advanced testing surface is not folded away. | `preview-runtime-parity.test.js`, `preview-service.test.js` | `ux08`, `ux14` |
| Export | `export` | `core/export/exporter.js`, `runtime-bundle.js` | — | yes | `rig.json` + `mascot.svg` + `runtime.js`. Untouched by this programme. | `export-service.test.js`, `export-readiness.test.js` and 4 others | `ux16` |
| Command palette | global | `ui/command-palette.js`, `command-registry.js` | — | yes | Registry has scope rules and shows a **reason** for disabled entries rather than hiding them — already what §22 asks for. Nine groups indexed. Object coverage depends on registered indexes. | `command-registry.test.js` | `ux18` |
| Panel widths | all | `ui/panel-split.js`, `shell/panel-splitter.js` | — | yes | Per-screen defaults in `MODES[*].layout`; drag and double-click-to-default exist (`panel-splitter.js:135`). | `panel-split.test.js` | `ux22-layout`, `panel-layout` |
| Responsive | all | `ui/responsive-shell.js`, `mobile-capabilities.js` | — | yes | desktop / tablet / mobile policy implemented with explicit capability gating. | `mobile-capabilities.test.js` | `ux19`, `ux20` |
| Accessibility | all | throughout | — | — | Focus return, aria labels, XY pads by keyboard. Forced-colors and 200 % zoom still follow-ups. | — | `ux21-accessibility` |

---

## 3. Selection: what is shared and what is not

There is **one** selection, in `EditorSession`, and it is correctly session
state. It has two halves that do not meet:

```text
artwork half     selectedId, selectedIds        core/state/selection.js
semantic half    activeSemanticPartId, activeControl
behavior half    activeStateId, activeTransitionKeys, activeBehaviorId, activeTriggerId
animate half     activeExpressionId, activeReactionId, selectedTrackParameter, selectedKey
```

`ui/selection-context.js` resolves these into **one** context per surface, and
`ui/context-inspector.js` shows exactly one adapter for it. That part is right
and is the model to finish rather than replace.

What is missing is the **bridge from the artwork half to the semantic half**.
It exists in exactly one place — `rig-panel.js:97` does
`findSemanticPartByElement(state, session.selectedId)` and adopts it — and that
one place is a side effect of a `render()`, so:

- `face-movements-panel.js` never reads it, and shows all 26 movements always;
- `face-library-panel.js` never reads it, and shows eyes always;
- `face-states-panel.js`, `gaze-panel.js`, `handle-board` never read it;
- the Timeline writes the semantic half but never reads it.

**PR 1 added that shared derivation**, and not a new store:
`core/selectors/selection-subject.js` answers *what part of the face is in
hand?* from both halves, in a fixed order — the piece in hand when it **is** a
part (a role of one, or the group a library drawing was installed as), then the
active part, then the piece's containing part — and everything contextual
downstream is a consumer of that one answer. `rig-panel.js` reads it too, so its
Inspector no longer disagrees with the canvas: its old precedence put the active
part first, and a bare canvas click writes only `selectedId`, so clicking the
mouth while the eyes were active left the Inspector on the eyes.

One thing the audit had not seen: **`activeSemanticPartId` is not always a
selection.** `rig-panel.js` writes its own fallback back into the session so its
navigator has a row to highlight, so a freshly loaded template reports `head`
while the author has touched nothing. The derivation therefore requires a
`selectedId` before it will answer at all — otherwise the movements panel opened
on the head's movements and the library opened on heads, in answer to a choice
nobody made.

`SESSION_RENDER_PLAN` now covers `activeSemanticPartId` and `activeControl`, and
the contextual panels are in both selection plans. That was the other half of
the bug: a panel that is never told the selection changed has no choice but to
show everything.

Still open: there is no `selectionScope` field in the session, and `insidePiece`
(the hierarchy scope) is readable from `svg-canvas.js` but is not session state,
so no panel can show where in the hierarchy the author is.

---

## 4. Documents that contradict the code

| Document | Claim | Reality |
|---|---|---|
| `KNOWN_LIMITATIONS.md` | "The state graph … is drawn in the left sidebar column, about 260 px wide, so a four-state machine fits at just under half size — the geometry is sized for that, but the diagram wants the canvas." | **False since #160.** The board is in the canvas column (`shell/canvas-column.js`), with `off`/`small`/`large` sizing. Corrected in this pass. |
| `KNOWN_LIMITATIONS.md` | "only warps and keyforms have an authoring panel" | True for shape keys, deformers and depth. Meshes also have a full canvas lattice, and pins/attachments/holds have a panel. The sentence understates what exists and overstates what is missing; sharpened in this pass. |
| `UX_UI_CURRENT_AUDIT.md` (2026‑09‑02) | whole document | Describes the four-stage navigation that UIR-01 replaced. Marked historical. |
| `V4_AUDIT.md`, `V3_UX_AUDIT.md`, `V1_UX_AUDIT.md`, `INITIAL_UI_AUDIT.md` | whole documents | Each is a snapshot of an editor two or more refits ago. Marked historical. |
| `task-router.js` doc comment | "`design.artwork` … is where the editor opens" (in the `DEFAULT_MODE` prose) | The prose argues its way to the right answer and says so at the end; `DEFAULT_MODE` is `design.assemble`. Confusing but not wrong. Left alone. |

Everything else in `KNOWN_LIMITATIONS.md` that this pass checked — multi-select
rotate/scale, the legacy morph slot, mesh limits, raster formats, the top bar
having no slack, the marquee's containment rule — **is accurate**.

---

## 5. The gaps this programme closes, in priority order

Ranked by how badly each one breaks *"the screen says the task, the selection
says what to show"*.

1. ~~**Rig ▸ Controls is a permanent inventory.**~~ **Done, PR 2.**
2. ~~**Nothing downstream of the canvas knows what part is in hand.**~~ **Done, PR 1.**
3. ~~**Assemble does not follow the selection.**~~ **Done, PR 7** (contextual
   replace; multi-selection transforms and Hands continuity remain).
4. **Deform's attachment points are numeric-only** and its pins have no
   multi-selection. (§13; PR 4.) — *next*
5. **Shape keys have no editor at all.** (§13; PR 5.)
6. **Calibration is a flat list, not a guided capture.** (§11; PR 3.)
7. **Depth/parallax has no authoring surface.** (§13; PR 6.)
8. **Timeline does not filter by selection.** (§17; PR 9.)
9. **Head 2.5D has no Simple/Standard/Custom ladder.** (§12; PR 8.)
10. **Preview shows its advanced testing inline.** (§19; PR 11.)
11. **Hands lose their context across a round trip to Draw.** (§8; PR 7.)
12. ~~**`Replace` is missing from the piece-action catalogue.**~~ **Done, PR 7.**
13. ~~**No `Enter` to descend and no "Select inside…" menu entry.**~~ **Done, PR 1.**

---

## 6. Regression baseline

Anything this programme does must keep these true. Measured at `f5b4945`:

```text
npm test                     2306 pass, 0 fail          ~23 s
npm run build                clean
npm run check:conflicts      clean
tests/e2e/                   69 spec files
```

After the first slice (PR 0, 1, 2 and the contextual half of 7):

```text
npm test                     2333 pass, 0 fail
npm run build                clean
tests/e2e/                   70 spec files (ux50-contextual-selection.spec.js)
```

Four E2E specs fail locally **and fail identically on `f5b4945`**, so they are
this repository's state rather than this slice's doing. They were measured by
building `origin/main` in a second worktree and running the same specs against
it:

```text
@pages                        asks a deployed GitHub Pages build for its assets
ux14-event-simulator:74       hover reaction does not clear within 4 s
ux33-artboard:113             the clip paragraph does not name `headShape`
ux38-publish:41               Home is still open, so the project never loaded
```

The last three are unexplained and worth a look of their own; none of them
touches a surface this programme has changed.

Invariants, none of which any slice below may touch: old projects open, import
works, `.boop` round-trips, Save/Open, undo/redo, `rig.json`, `mascot.svg`,
`runtime.js`, the public runtime API, GitHub Pages, browser-only operation, the
sanitizer, and schema migration. No UI preference may enter `ProjectDocument`.
