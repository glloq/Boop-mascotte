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

## The shell after UIR-02 and UIR-03

The regions are the layout of §5 Règle A, one module each, and the two
registries are Règle B:

```text
Workspace + Selection = Inspector        ui/inspector-registry.js
Screen              -> Dock              shell/bottom-dock.js  (one at a time)
```

`core/tests/uir03-registries.test.js` holds both to their tables: every adapter
has a host in the markup and every host an adapter; the registry answers exactly
as the six conditions it replaces did, across every column and every kind of
selection; every dock a screen asks for is registered, and every panel a screen
reveals is one a deep link could also open.

## M2 — Design

| Item | What moved |
| --- | --- |
| UIR-04 | The builder's cards keep thumbnail, name, current and a compatibility *warning*; the per-movement inventory is gone from them. |
| UIR-05 | Hands is one screen, per hand, with the six verbs. `core/hands/hand-state-model.js` adds rename, duplicate, mirror copy and delete; `core/tests/hand-states.test.js` holds each of them to "the other hand never moves". |
| UIR-06 | `ui/artwork-scope.js` derives what the vector tools are open on, and the breadcrumb over the canvas is the way back out of it. |

A state an author made is addressed by `handStateElementId`, never by
`handStyleElementId`: the latter resolves through the shipped set and falls back
to the default drawing for anything it does not know, which is precisely the
case a state of an author's own is.

## M3 — Rig

| Item | What moved |
| --- | --- |
| UIR-07 | Assign shows its progress rather than hiding it in a span. |
| UIR-08 | Movements are filed under Head · Eyes · Brows · Mouth · Extra (`MOVEMENT_BANDS`), each band holding the parts that carry them. |
| UIR-09 | Head 2.5D keeps Simple · 5 / Standard · 9 and names the axis it is *not*: a tilt is a movement, and it is in Controls. |
| UIR-10 | The deformation listing became the bench on Deform: six systems, what the project carries, and the screen each is edited on. |

Five canvas authoring surfaces remain to be built for Deform — attachment-point
handles, hold handles, multi-pin selection, a shape-key editor and a
depth/parallax editor. The bench is where they will appear, and until they do it
says which systems have no editor rather than leaving that to be discovered.

## M4 and M5 — Animate and Behavior

| Item | What moved |
| --- | --- |
| UIR-11 | Opening the Timeline is a navigation: **Show in Timeline** lands on `animate.timeline` rather than opening a dock under a tab that says somewhere else. |
| UIR-12 | A reaction sets a **hand state**, chosen from the states that hand holds, rather than a pose it may not have. |

## M6 — Global

| Item | What moved |
| --- | --- |
| UIR-13 | Preview is a toggle over the four workspaces, not a fifth tab beside them: `▶ Preview` in, `◼ Stop preview` out, back to the screen the author left. |
| UIR-14 | The app bar reads `✓ Ready` or `● 2 issues`, and Problems groups what is left by workspace, Export last. |

Two rules the two items share, and the reason they are one milestone: both are
true on **every** screen, and neither may write anything. Preview's memory of
where the author was is session-only (Règle D), and readiness reads the document
without ever touching it.

`core/tests/task-readiness.test.js` holds the grouping to the navigation: the
five groups arrive in workspace order, every section of the model is filed under
exactly one of them, and a group is as bad as its worst section rather than an
average of them. `tests/e2e/ux08-preview-readiness.spec.js` holds the verdict to
the same model from the other side, and holds Preview to §11's whole test
surface — expressions, motions, hand states, events, reactions, automatic on and
off, and the one reset in the project bar.

## M7 — Responsive, accessible, and one module per question

| Item | What moved |
| --- | --- |
| UIR-15 | The arrow keys walk the navigation, and the capability policy reads as the navigation reads: five groups, and a gate on the screen it gates. |
| UIR-16 | `editor-app.js` went from 1161 lines to 849: a module per workspace, plus the hand-artwork service that belongs to two of them and neither. |

**The keyboard.** Nine buttons stand between the project title and the canvas,
and the only way past them was nine presses of Tab. Left and right walk a row,
Home and End reach its ends, and down and up cross between the four questions
and the screens of the one open. Tab still reaches every button exactly as it
did — this is the faster way, never the only one, which is the rule
`ui/character-builder/ring-keys.js` set and this follows.

**The capability sheet.** It listed thirteen areas in the order they had been
written, named a screen that no longer exists ("Face Setup") and said nothing at
all about three that do. It is grouped by workspace now, with `Everywhere` last
for the handful of things that are true wherever you are, and Hands, Assign,
Head 2.5D and Deform each say what a phone can and cannot do with them. A gate
moved with them: one filed inside a closed `<details>` said nothing until
somebody opened it, which is precisely the screen they were about to find out
about the hard way.

**The workspaces.** Each is a module now — what it builds, what it draws, and
what it does on the way in and out:

```text
app/workspaces/design.js    the face, the hand states, the vector tools' screens
app/workspaces/rig.js       the nine sections, the handle board, applyPoseValues
app/workspaces/animate.js   expressions, motions, the timeline
app/workspaces/behavior.js  reactions, automatic, the state machine
app/hand-artwork.js         putting hand artwork on the canvas — nobody's screen
```

`WORKSPACE_OCCUPANTS` is gone with them. It was a table in
`app/workspace-manager.js` naming which panel of which workspace had a method
called `cancelTransient`, kept in step by hand with four other files; a
workspace answers for its own panels now. The manager hands each one the
**surface**, not a yes or no, because Animate mounts two and they want different
things: Expressions holds a face while it is being shaped and has to let go on
the way to Motions, which is the same workspace.

What deliberately did not move: the canvas, its tools, its menu, the Inspector,
the services and the command surfaces. The canvas is central to every screen
(Règle A) and the Inspector answers for all four (Règle B); filing either under
a workspace would be the lie this refactor removes.

## M8 — UIR-17, what was removed and where it went

The rule the roadmap sets for this milestone is that nothing may be deleted
without a record of **the old capability, the route that answers for it now, and
the test that proves it still does.** This is that record.

### The route vocabulary

| Old capability | New route | Held to it by |
| --- | --- | --- |
| `{ task: 'artwork' }` | `{ mode: 'design.artwork' }` | `core/tests/task-router.test.js` |
| `{ task: 'character' }` | `{ mode: 'design.face' }` | `core/tests/project-service.test.js` |
| `{ task: 'face-setup' }` | `{ mode: 'rig.assign' }` | `core/tests/character-builder.test.js` |
| `{ task: 'face-setup', focus: 'face-movements' }` | `{ mode: 'rig.controls', … }` | `core/tests/task-readiness.test.js` |
| `{ task: 'face-setup', focus: 'head-pose' }` | `{ mode: 'rig.head2d', … }` | `core/tests/guided-journey.test.js` |
| `{ task: 'face-setup', focus: 'hand-setup' }` | `{ mode: 'rig.controls', … }` | `core/tests/reactions.test.js` |
| `{ task: 'expressions' }` | `{ mode: 'animate.expressions' }` | `core/tests/behavior-vocabulary.test.js` |
| `{ task: 'animate' }` | `{ mode: 'animate.motions' }` | `core/tests/reactions.test.js` |
| `{ task: 'reactions' }` | `{ mode: 'behavior.reactions' }` | `core/tests/export-service.test.js` |
| `{ task: 'reactions', focus: 'automatic-panel' }` | `{ mode: 'behavior.automatic' }` | `core/tests/runs-when.test.js` |
| `{ stage: … }` | *(removed: nothing named one)* | `core/tests/task-router.test.js` |

Not one module under `project/editor/` navigates by task any more, and a test
walks the tree to keep it that way. `MODE_ALIASES` stays, smaller, because two
things outside the product code still speak the old words and both are named in
the table's own comment: a **UI preference saved before UIR-01**, whose
`workspace` was a task id, and **`fix.workspace`** in
`core/validation/validate-project.js`, which names a domain in validation's
words rather than a screen in the router's.

### The deprecated hand mechanics

| Old capability | Where it goes now | Held to it by |
| --- | --- | --- |
| A reaction offering a hand's `poses` | The hand's **states** — its own library | `core/tests/studio-lifecycle.test.js`, `behavior-vocabulary.test.js` |
| `handGesture` answering from `hand.poses` | The library, or no gesture at all | `core/tests/hand-gestures.test.js` |
| `#hand-workshop`, render target `handWorkshop` | `#hand-states`, render target `handStates` | `core/tests/render-plan.test.js`, `tests/e2e/ux47-hand-workshop.spec.js` |

A pose was the model *before* drawings: a hand deformed into a shape by a
number. The runtime has resolved a reaction's gesture against the hand's
library — **stepped**, one drawing or another — for as long as hands have had
one, so a pose offered in the editor named a drawing that was not on the hand.
It validated in the editor and did nothing on the page, which is the worst shape
a compatibility path can take. A hand with no library now makes no gesture, and
the panel says so where the choice used to be.

### What was deliberately not deleted

* **`hand.reach`, `hand.inertia`, `hand.softness`** — these are **live** runtime
  mechanics, not deprecated ones: reach bounds a hand's travel, inertia gives it
  lag, softness is how far past the reach it may drift. They are written by the
  hand console, exported in `rig.json` and read by `project/runtime/hands.js` on
  every frame. Deleting them would change what an exported mascot does, which
  §2 puts out of bounds for this refactor.
* **`retireHandDeformation`** — the conversion *off* the deprecated model, not
  part of it. Deleting it would strand every project that still carries the old
  hands with no way forward.
* **The runtime's read-only compatibility paths** — `hand.sprites`,
  `drawing.anim`, `handLFacing`, `swap: 'crossfade'`. They are already read and
  never written, each one line in `project/runtime/`, and they are what lets an
  old `rig.json` still load. `docs/HAND_STYLES.md` lists them.
