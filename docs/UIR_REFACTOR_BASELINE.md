# UIR-00 — the baseline the UI refactor is measured against

The interface refactor (§13 of the roadmap) moves panels, splits Face Setup into
four, gives hands a place of their own and takes Preview out of the journey. It
is explicitly **not** allowed to move data: `ProjectDocument`, the commands, the
undo history, the runtime and the exported bundle are fixed points
(§2, "Ce qu'il ne faut surtout pas réécrire").

The risk in a refactor of that shape is not the screen that breaks loudly. It is
the capability that quietly loses its door: a panel moved to a workspace nothing
navigates to, a command left with no button, a deep link that used to open a
section and now opens the page it was on. Nobody notices until somebody needs it.

So before anything moves, this is the inventory: **every capability, where it is
reached from today, what writes it, what it costs at runtime, what already tests
it, and where the refactor is taking it.** A pull request that ends with a row of
this table having no route is not finished, whatever it looks like.

## How to read the matrix

* **Route** — what the author clicks today. `stage ▸ task` as the top bar shows
  it, with the Face Setup section named where the task has nine of them.
* **Writes** — the module that owns the mutation. Not a command *name*: most of
  these build their `type` from a shared `run()` helper, so the module is the
  honest answer and the one a `git log` is taken against.
* **Domain** — the `PROJECT_DOMAINS` key(s) the write declares
  (`core/state/project-document.js`). This is the column the refactor must not
  touch: a UI change that widens a domain makes unrelated panels redraw, and one
  that narrows it makes them go stale.
* **Runtime** — what the exported mascot needs for the capability to mean
  anything on a page. Empty means the capability is authoring-only and never
  reaches `rig.json`.
* **Covered by** — the suite that already fails if the capability breaks.
* **Destination** — the workspace of §4, and the roadmap item that moves it.

## The matrix

| Capability | Route today | Writes | Domain | Runtime | Covered by | Destination |
| --- | --- | --- | --- | --- | --- | --- |
| Face creation | Create ▸ Character | `core/face-library/face-part-commands.js`, `ui/character-builder/` | `artwork`, `layers`, `rig`, `semanticRig`, `keyforms` | `renderer.js`, `draw-order.js` | `ux45-character-builder`, `ux46-face-layout`, `ux36-create` | Design ▸ Face (UIR-04) |
| Hand state creation | Create ▸ Hands | `core/hands/hand-style-install.js`, `core/hands/hand-set-install.js` | `hands`, `artwork`, `layers`, `rig` | `hands.js`, `hand-sprite.js` | `ux47-hand-workshop`, `ux32-hands` | Design ▸ Hands (UIR-05) |
| Hand state SVG editing | Create ▸ Hands ▸ Edit drawing | `core/hands/hand-drawing.js`, `svg-editor/` | `artwork`, `layers` | `hand-sprite.js` | `ux47-hand-workshop`, `ux39-hand-mode` | Design ▸ Hands → scoped Artwork (UIR-05, UIR-06) |
| SVG editing | Create ▸ Artwork | `core/commands/artwork-commands.js`, `svg-editor/` | `artwork`, `layers` | `renderer.js` | `ux25-canvas-editing`, `ux30-drawing-tools`, `ux39-drawing-tools-complete`, `ux40-arrangement` | Design ▸ Artwork Advanced (UIR-06) |
| Face assignment | Create ▸ Face Setup ▸ Face parts | `rig-editor/semantic-parts/` | `semanticRig`, `rig` | `effective-params.js` | `ux05-face-setup`, `ux06-face-detection` | Rig ▸ Assign (UIR-07) |
| Movements | Create ▸ Face Setup ▸ Movements, Gaze, Controls | `rig-editor/semantic-parts/face-movements.js`, `core/puppet/`, `core/rig/gaze-rig.js` | `rig`, `rigHandles`, `keyforms` | `mixer.js`, `gaze-solver.js`, `keyforms.js` | `ux07-face-movements`, `ux26-direct-controls`, `ux34-handle-board`, `ux29-fine-control` | Rig ▸ Controls (UIR-08) |
| Head 2.5D | Create ▸ Face Setup ▸ Head pose | `core/head-pose/head-pose-commands.js` | `keyforms`, `artwork`, and `rig` + `semanticRig` when it generates a turn | `keyforms.js`, `depth.js` | `ux24-head-turn`, `ux41-pseudo-3d`, `ux27-pose-chips` | Rig ▸ Head 2.5D (UIR-09) |
| Pins & holds | Create ▸ Face Setup ▸ Pins & holding | `core/rig/pin-commands.js`, `core/rig/constraint-commands.js`, `core/rig/attachment-model.js` | `keyforms`, `constraints`, `rig` | `rig-pins.js`, `rig-constraints.js`, `rig-attachments.js` | `ux43-rig-relationships` | Rig ▸ Deform Advanced (UIR-10) |
| Warp | Create ▸ Face Setup ▸ Warp | `core/warp/warp-commands.js` | `keyforms`, `artwork` | `warp-grid.js` | `ux42-warp` | Rig ▸ Deform Advanced (UIR-10) |
| Expressions | Animate ▸ Expressions | `core/expressions/expression-commands.js` | `expressions` | `expression-eval.js`, `mixer.js` | `ux09-expressions`, `ux10-expression-presets` | Animate ▸ Expressions (UIR-11) |
| Motions | Animate ▸ Motions | `core/motion/motion-commands.js` | `animation` | `interpolation.js`, `mixer.js` | `ux11-motions`, `ux12-motion-studio`, `ux37-animate-behaviors` | Animate ▸ Motions (UIR-11) |
| Timeline | Animate ▸ Motions ▸ bottom dock | `animation-editor/timeline/` | `animation`, `arrangement` | `interpolation.js` | `rig-timeline`, `ux12-motion-studio` | Animate ▸ Timeline Advanced (UIR-11) |
| Reactions | Behaviors ▸ Reactions | `core/reactions/reaction-commands.js` | `reactions` | `behaviors.js` | `ux13-reactions`, `ux14-event-simulator` | Behavior ▸ Reactions (UIR-12) |
| Automatic | Behaviors ▸ Reactions (same column) | `core/behaviors/automatic-commands.js` | `stateMachine` | `behaviors.js` | `ux15-automatic` | Behavior ▸ Automatic (UIR-12) |
| State machine | Animate ▸ Motions ▸ States & behaviors | `animation-editor/state-machine/` | `stateMachine` | `state-machine.js`, `transitions.js` | `ux37-animate-behaviors` | Behavior ▸ State Machine Advanced (UIR-12) |
| Preview | Publish ▸ Preview | `app/services/preview-service.js`, `core/preview-runtime/` | *(none — session only)* | `mascot-engine.js` | `ux08-preview-readiness`, `ux14-event-simulator` | Global ▸ Preview (UIR-13) |
| Readiness | Problems, in the app bar | *(reads only)* `core/validation/` | *(none)* | — | `ux08-preview-readiness`, `ux16-export-readiness` | Global ▸ Readiness (UIR-14) |
| Export | Export, in the app bar | `core/export/exporter.js`, `app/services/export-service.js` | *(reads all)* | `runtime-bundle.js` | `ux16-export-readiness`, `ux38-publish` | Global ▸ Export (UIR-14) |

Two rows are worth reading twice, because they are the two the refactor is
actually *for*:

* **Automatic** is reached only by scrolling past Reactions in the same column.
  It has no route of its own at all, which is why nobody finds it.
* **State machine** is filed under *Motions*, an accordion inside the step above
  the one whose subject it is. §10 moves it, and it is the single clearest case
  of a capability whose door is in the wrong building.

## The four separations, as tests

`core/tests/uir00-baseline.test.js` writes §16's separations down as assertions
against the models the panels drive, not against the panels:

```text
Hand state ≠ hand state   a state is added and reshaped; no other state moves
Left       ≠ right        two libraries, no mirror link, no bleed
Face       ≠ hands        a face part installs without touching the hands domain
Hand state ≠ face rig     showing another drawing rigs, poses and deforms nothing
```

They are deliberately model-level. A test that drove the Hands panel would have
to be rewritten by UIR-05, which is the pull request most likely to break the
invariant — a safety net that is re-tied by the change it is watching is not one.

The browser suites in the matrix stay as they are through M1 and M2: when a route
moves, its spec's navigation moves with it and its assertions do not. A spec that
needs its *assertions* changed to keep passing is reporting a capability that
moved, and that is the conversation UIR-17 exists to have.

## What UIR-00 deliberately does not do

No panel moves, no route is renamed, no preference shape changes. The point of a
baseline is that everything after it can be compared to something.

## Where UIR-01 put them

The routes above are the baseline — where each capability was reached from
before anything moved. UIR-01 replaced the navigation, and this is the same list
read from the other end. No panel was rewritten to do it: the modes are a route
model over the panels that already existed, and the nine rig sections are filed
under the screen that shows them.

| Capability | Route today |
| --- | --- |
| Face creation | Design ▸ Face |
| Hand state creation, hand SVG editing | Design ▸ Hands |
| SVG editing | Design ▸ Artwork |
| Face assignment | Rig ▸ Assign |
| Movements, gaze, on-canvas controls, hand placement | Rig ▸ Controls |
| Head 2.5D | Rig ▸ Head 2.5D |
| Pins & holds, warp, the part tree | Rig ▸ Deform |
| Expressions | Animate ▸ Expressions |
| Motions | Animate ▸ Motions |
| Timeline | Animate ▸ Timeline |
| Reactions | Behavior ▸ Reactions |
| Automatic | Behavior ▸ Automatic |
| State machine | Behavior ▸ States |
| Preview | beside the four workspaces |
| Readiness, Export | the app bar, on every screen |

Every id in the left-hand column of the baseline still resolves: `MODE_ALIASES`
in `ui/task-router.js` holds the task ids, the surface ids the session stores and
the stage ids before them, and `core/tests/task-router.test.js` walks the whole
table asserting each one lands on a real screen.
