# Boop VNext — roadmap

V2 built the engine. VNext rebuilds the **editing experience** around simpler
concepts, and does not rewrite the engine that works.

The runtime is already separated from the editor, the store already
distinguishes document from session, and mutations are already organised by
domain (`PROJECT_DOMAINS`). That base is preserved. The work is therefore UX,
editor orchestration, and animation composition.

## The journey a user must be able to follow

```text
New project
    ↓
Create the mascot
    ↓
Configure its movements
    ↓
Create expressions / gestures / animations
    ↓
Define its behaviours
    ↓
Test
    ↓
Export
    ↓
Drive it from the site / backend
```

Without having to understand `parameters`, `bindings`, `shapeKeys`,
`transitionSettings`, `semanticParts`, `keyforms`, `motionBlend`,
`expressionBlend` or `deformers`. Those stay reachable, under **Advanced**.

## The rule that replaces the old one

The pattern that made the editor grow harder to use:

```text
new feature → new panel → new settings → new Advanced section
```

The pattern from here:

```text
new internal capability
        ↓
does it fit Create / Animate / Behaviors / Publish?
        ↓
yes → add it to the workflow that already exists
```

A feature with no home in one of the four workspaces is not finished.

## Milestones

The 92 items are not a sequential chain of 92 pull requests. They group into
eight milestones, and only the first must be complete before the others start.

| Milestone | Subject | Items | Status |
| --- | --- | --- | --- |
| **M1** | Architecture | VNX-00 → 05 | ✅ done, except VNX-03 adoption (contract + 4 panels of 24) |
| **M2** | New editor shell | VNX-06 → 15 | VNX-06, 07, 12, 13 done |
| **M3** | Head + hands UX | VNX-16 → 24 | VNX-16, 17, 19, 20, 21 done; 18 deferred with a reason; **22 → 24 parked** pending a fresh look at how hands are drawn |
| **M4** | New animation system | VNX-25 → 36 | VNX-25 amended; 27, 28, 29, 31, 32, 33, 34, 35 done — VNX-30 and VNX-36 open |
| **M5** | Behavior system | VNX-37 → 47 | — |
| **M6** | Runtime / integration / performance | VNX-48 → 66 | — |
| **M7** | UX polish / templates / responsive | VNX-67 → 81 | — |
| **M8** | Advanced + legacy removal | VNX-82 → 91 | — |

The critical path, if effort is limited:

```text
VNX-00  baseline            VNX-23  gesture editor
VNX-02  main.js split       VNX-25  pose / action / behavior model
VNX-04  selectors           VNX-27  action composer
VNX-05  scoped subscriptions VNX-29 multi-clip timeline
VNX-06  new navigation      VNX-31  layers
VNX-07  Create workspace    VNX-37  behavior builder
VNX-08  Animate workspace   VNX-42  idle composer
VNX-09  Behaviors workspace VNX-48  simplified runtime API
VNX-19  hand mode           VNX-52  event simulator
VNX-22  pose editor         VNX-60  sleep / wake
```

---

## M1 — Architecture

Nothing here changes what the editor does. It changes what the editor is made
of, so the rest of the roadmap is possible.

| Item | Subject | Definition of done |
| --- | --- | --- |
| VNX-00 | Baseline | Every essential capability is pinned to the test that covers it; `npm test`, `npm run verify`, `npm run verify:e2e` green (`VNEXT_BASELINE.md`) |
| VNX-01 | Compatibility contracts | `ProjectDocument`, `rig.json`, `mascot.svg`, `runtime.js` and the runtime API frozen as executable tests, not promises |
| VNX-02 | Split `main.js` | ✅ `main.js` is eight lines and ends at `createEditorApp().mount();`. Autosave, project load/save/replace, preview mode, the readiness/Problems/Export flows, the context fan-out and the browser-test seam are each their own module; module-level mutable state went 12 → 4 before the wiring moved out at all |
| VNX-03 | UI component API | Every panel has `mount / update / show / hide / destroy`; an unused workspace renders nothing and listens to nothing — **contract done, one adopter** (`VNEXT_COMPONENTS.md`) |
| VNX-04 | Selectors / ViewModels | A layer between store and UI; a component re-renders only when its ViewModel changes — **done** (`core/selectors/`) |
| VNX-05 | Scoped subscriptions | ✅ the store already notified per domain; the fan-out is now a checked table (`core/state/render-plan.js`) rather than twelve hand-written closures |

VNX-02 landed as:

```text
editor/
├── main.js            8 lines: createEditorApp().mount()
├── app/
│   ├── editor-app.js  the wiring, and only the wiring
│   ├── workspace-manager.js
│   ├── e2e-hooks.js
│   └── services/      autosave · project · preview · export
└── …
```

`workspaces/` is not there yet: it arrives with VNX-07 → VNX-10, when each
workspace becomes the thing that owns its own panels.

VNX-04 target flow:

```text
ProjectDocument → selector → ViewModel → component
```

The twelve domains VNX-05 exploits already existed, which is why that item
turned out to be about the *fan-out* rather than the subscriptions: `artwork`,
`layers`, `rig`, `stateMachine`, `semanticRig`, `rigHandles`, `animation`,
`keyforms`, `hands`, `hierarchy`, `expressions`, `reactions`. One rig edit
redraws twelve things; the number is pinned by a test so narrowing it is
deliberate and visible.

---

## M2 — New editor shell

| Item | Subject |
| --- | --- |
| VNX-06 | ✅ Navigation model: `CREATE │ ANIMATE │ BEHAVIORS │ PUBLISH`; the six task tabs stay, grouped under the stage they belong to. A stage is a **shortcut into a group, never a gate in front of one** — every task stays one click away from anywhere, and each stage remembers the step last open in it |
| VNX-07 | ✅ **Create** workspace: the three columns exist across the whole Create stage — **Structure** (the layer tree, shared by every step instead of vanishing between Artwork and Face Setup), **Canvas**, **Properties** (the contextual inspector). Movements, hands, head pose and controls were already sections of Face Setup; what was missing was the column that says what you are building |
| VNX-08 | ✅ **Animate** workspace: the expression and motion catalogues are one library, on screen in both steps. What the mascot can do is one question; which of them the author is shaping is what the step decides, not what they are allowed to see |
| VNX-09 | ✅ **Behaviors** workspace. The automatic behaviours moved out of Animate to sit with the reactions, and both now read as one sentence: **When** · **Do** · **Then**. *Timing* and *After* stopped being separate boxes — how long the doing lasts belongs to Do, and what happens afterwards *is* Then. The list row and the inspector print the **same string from the same function**, so they cannot drift. A behaviour with pieces missing reads as a shorter sentence (`When clicked → does nothing yet`), never as empty slots. **IF is deliberately absent**: conditions need a value to test, and the runtime has no inputs at all — what it would take is written down in VNX-39 |
| VNX-10 | ✅ **Publish** workspace: the project's readiness sits beside the mascot being tested — every step with its status, every blocker with the way out of it, one button that ships, and **what the export weighs, measured on request**. Weighing serializes the SVG and builds the rig, so it happens when asked and the answer is forgotten the moment the project moves: a weight from three edits ago is worse than no weight, because it looks current. The integration snippets are the one part still to come (VNX-49 → VNX-51 build them) |
| VNX-11 | ◐ Inspector driven only by the selection (`VNEXT_INSPECTOR.md`). Audited end to end: seven of thirteen selections were already right, two landed on something generic or empty and are fixed, four need a session identity that does not exist yet and are written down with what each would take. One rule replaced the special cases: an adapter is revealed **or** the empty line names what is selected, never neither |
| VNX-12 | ✅ Progressive disclosure: `ui/disclosure.js` gives `Basic → More → Advanced`, where **Basic is not a collapsed section** — it is what the author sees with no click — and an empty section renders nothing at all. Adopted by the hand inspector, the roadmap's own worked example. A guard test pins all 44 of that panel's control hooks, so a tier can move a control but never lose one |
| VNX-13 | ✅ Already true, verified rather than assumed: the phrase *add a semantic part* exists nowhere in the editor. Face Setup is a checklist of eight roles — press *Assign next: Head*, the canvas says **Click the head**, and you click it. `face-role-detection.js` suggests artwork by name and geometry, acceptable one at a time or as one undoable batch, and falls back to canvas picking when the artwork is unnamed |
| VNX-14 | ✅ Universal visual controllers. The kind is **derived from the handle's own resolved axes** — free `orbit` only → `arc`, both linear axes free → `pad`, one → `slider`, one stepped into ≤ 9 stops → `chips`, nothing free → `locked` — so no second table of part types and no parameter-name matching. Locking the mouth's `x` turns it into a slider; stepping `eyeOpen` by 0.5 turns it into chips. An author overrides it through the same sparse record as the shape, and `rig.json` is still byte-identical for a project that authored nothing |
| VNX-15 | ✅ Calibration is a sequence now, in that order. It existed and worked; what it lacked was an order and plain words — **Test came first and the captures second**, which is "here is a control, now go configure it". Rest is derived as the pose sitting at the parameter's own default (an eye rests OPEN, a mouth rests CLOSED) rather than assumed to be the middle of the list. The raw parameter value beside every test slider is gone, progress reads `1 of 2 set` instead of `default range`, and the word *binding* — which the empty Advanced state used to print verbatim — appears nowhere in the rendered markup. A shape-key movement stopped being a dead end that asked for captures it has no cards for |

Create workspace layout:

```text
┌──────────────┬──────────────────────┬────────────────┐
│ Structure    │                      │ Properties     │
│              │      CANVAS          │                │
│ Face         │                      │ selection      │
│ Eyes         │                      │ movement       │
│ Mouth        │                      │ appearance     │
│ Hands        │                      │ advanced       │
└──────────────┴──────────────────────┴────────────────┘
```

---

## M3 — Head + hands UX

| Item | Subject |
| --- | --- |
| VNX-16 | ✅ verified rather than built: the head handle on the mascot already *is* the controller — dragging it writes `headX`/`headY`, it reads back which of the nine positions it is nearest, and Shift snaps to one. Nothing was missing |
| VNX-17 | ✅ The grid opens on **five directions**, not nine chores: a head turned left *and* up is a refinement, and offering it beside "left" made the grid read as a list of tasks. **Standard · 9** is one choice away, and a corner an author captured is always offered whatever the level — hiding a pose someone made would be a lie, not a simplification |
| VNX-18 | ◐ Simple 5 and Standard 9 are done (VNX-17). The **free grid** is deferred with a reason: `createHeadPoseAxes` takes arbitrary values, but a project's grid shape is implicit in its keyforms and nothing stores it, so changing the axis values on a rig that already has captures is a remap — the same class of problem as adding a node to a path, and it deserves the same care rather than a select box |
| VNX-19 | ✅ Hand mode. The anchor and the reach were four number fields; they are geometry, so they are edited by looking at them — an ellipse, a leash and two draggable handles, on the canvas, for the hand being set up. The distinction that shapes it: the puppet handles drive *parameters*, live and non-destructive; the anchor and the reach are *document* fields, so a complete drag is **one command and one undo step**, never one per frame. No new command was needed — `setAnchor` and `setReach` already existed, the drag just had to call one of them once |
| VNX-20 | ✅ Automatic first placement. Four of the five steps already happened — but all four measured the **drawing area**, never the mascot: anchors at 20 % in from each artboard edge, reach at 16 % of it, the artboard grown to a blind 4:3. So a mascot half the size of its canvas got hands in the corners with nothing to reach. Placement is measured from the body now, the artboard grows by exactly the room the pair needs, and the hands scale with the mascot. A project with nothing measurable falls back to the old numbers exactly, asserted rather than hoped |
| VNX-21 | ✅ delivered by VNX-12: the curls live behind `More ▸ Fingers` and the panel opens on artwork, anchor and poses |
| VNX-22 | ⏸ **parked by the author.** How hands are drawn and shaped is a question to reopen on its own terms, and a pose editor built on the current representation would have to be rebuilt with it. The create/remove asymmetry recorded in `VNEXT_COMPONENTS.md` waits here too |
| VNX-23 | ⏸ blocked on VNX-22. The distinction already exists in the data — a reaction raises `gestures` (a side and a pose) beside its expression and its clip — but the *editor* for it is the pose editor's other half, and building it on a representation that is about to change would be building it twice |
| VNX-24 | ⏸ blocked on VNX-23 |

```text
           ↻ rotation
        ┌───────────┐
        │   HAND    │
        └───────────┘
             ●
             │
           anchor
     (reach ellipse)
```

---

## M4 — New animation system

The largest conceptual change: three user-facing concepts instead of eight
internal ones — **the grouping, not the renaming** (see VNX-25 below).

| Item | Subject |
| --- | --- |
| VNX-25 | ✎ **amended.** The three ideas are kept — instantaneous · in time · when — and the **renaming is dropped**. "Pose" already means something else here: a hand pose (`setHandPose`), the pose chips, a calibration pose. Renaming Expression to Pose would give two different things one name, which is the opposite of what the item is for. And the words the item wanted to replace are already plain: what a user should not have to meet is `bindings`, `shapeKeys` and `transitionSettings`, and those are already under Advanced. Expression, Motion and Reaction stay |
| VNX-26 | Moot for the three renamed types (VNX-25 amended); still true for `state`, which stays an advanced concept rather than a fourth thing an author must learn |
| VNX-27 | ✅ Simple action editor: an animation with no timeline at all. The catalogue was Head, Eyes and Face, so a mascot that wiggles its ears had **nothing** in it and its only way to animate that movement was the Timeline, key by key. The shapes the presets are built from are a vocabulary now — Dip · Rise · Sweep · Hold · Pulse · Settle · Tremble, every one already proven in a shipped preset — and *Make your own* pairs one with any movement the project has. `shape:settle:earWiggle` goes in the `motion.preset` field a clip already had, so there is no new document field and everything downstream (amplitude, repeats, *edited*, reset, detach) takes it without knowing. Found on the way and fixed: seven movements the registry declares (ears, hair, jaw, nose, teeth, tongue) had no catalogue entry and read as `Other · earWiggle` in the timeline, the arrangement rows and the palette alike — a guard test now walks the registry |
| VNX-28 | ✅ verified rather than built: the dope sheet already buckets tracks by the part a movement belongs to, with a fold per group — what was missing was that seven of those movements had no name (VNX-27's finding), so ears, hair, jaw, nose, teeth and tongue all read as `Other · earWiggle`. Pinned by an e2e now: four movements from four parts produce four named groups, and folding one hides its rows and nothing else. *Body* and *accessories* are absent because neither exists as a concept in the rig — see 3D-09 in `PSEUDO_3D_BASELINE.md` for what a body would take |
| VNX-29 | ✅ Multi-clip arrangement. The runtime has layered motions since V2; what was missing was any way to **see or author** it. An arrangement is editor-side state that adds no runtime concept, no `rig.json` field and no schema bump — playing one starts each clip through the motion layer that already exists, at the second the author put it. Rows are **subjects derived from what the placed clips actually write**, so a wave and a nod sit apart because they move different parts, not because anyone filed them there |
| VNX-30 | Clip operations: move, trim, duplicate, loop, reverse, speed, amplitude, fade in/out, crossfade |
| VNX-31 | ✅ A motion declares how it meets another that is playing: **Replaces it** (what every clip did, and still does) or **Adds to it**. The mixer has had an `additive` mode all along; what was missing was a clip saying which one it wanted — `createMotionLayer` hard-coded `weightedOverride` for everything, so the motion started last won a shared movement outright. `blend: 'additive'` is written only when it is not the default, so a rig full of ordinary clips exports byte-identically. This is also the resolution VNX-32 recorded as the one the engine *could not* honour: the arrangement's conflict warning now offers it as a button on the later clip, and `SUPPORTED_RESOLUTIONS` went from one to two |
| VNX-32 | ✅ wired: an arrangement is the consumer the model was waiting for. The warning names the movement and the clips in the author's words, over the span they really overlap, and offers only `override` — the one resolution the engine can honour |
| VNX-33 | ✅ **Selected only.** A timeline showing fifteen tracks while the author works on one part is a timeline they have to read past. The filter follows the semantic part being worked on, and falls back to the selected artwork resolved through the *same catalogue the tracks are grouped by*, so the filter can never disagree with the grouping. When it hides everything it says how many and offers the way back, rather than showing an empty sheet |
| VNX-34 | ✅ Groups existed; what was missing was that **a hand's controls are generated, not declared** — `handLX`, `handRGrip`, `handLIndex`, `handRFist` — so no static table could name them and all fifteen fell through to raw ids under *Other*, in the timeline, the palette, the handle board and every message that names a movement. The catalogue reads the naming convention back instead of repeating it, so a pose an author invents lands in that hand's group as words |
| VNX-35 | ✅ Auto Key everywhere. The canvas handles keyed and the rig-panel sliders keyed; the **head-pose pad**, the **Preview test bench** and the **handle board** did not — which is a strange thing to have to know, because from the author's side all of them are *move the mascot* and only some were also *animate it*. Every live surface now ends a gesture the same way: one `onCommit` per finished gesture with everything it moved, one undo step, keys at the playhead. Shaping an expression stays out of it on purpose — that gesture writes into the expression, not the timeline. Found on the way: the readiness pass wrote `Project ready • N layers` 150 ms after every edit, so **every** transient message a panel posted was wiped before it could be read; a routine status now waits for one that was said deliberately |
| VNX-36 | Curves: linear · ease · ease in · ease out · custom, then a bezier editor under Advanced |

```text
           0       1       2       3 sec
FACE       ├ happy ─────────┤
HEAD            ├ nod ┤
EYES       ├look──────┤  ├blink┤
HAND R          ├──── wave ─────┤
```

---

## M5 — Behavior system

| Item | Subject |
| --- | --- |
| VNX-37 | Behavior builder: `WHEN [click] DO [happy] [wave] THEN [return to idle]` |
| VNX-38 | Triggers: click, hover, pointer enter/leave, timer, page visible, page idle, CustomEvent, backend event |
| VNX-39 | Conditions: `[mood] [>] [0.5]`, screen, state, variable. Scoped while building VNX-09, and it is **five changes, not one**: (1) a value to test — the runtime has no inputs at all today, so this waits on VNX-48's `setInput()` or a decision that a condition may only read `params` and `activeState`; (2) `normalizeReaction` gains a `conditions` array with an explicit *unknown variable → false, never throw* rule; (3) both evaluation points — the trigger filter and the timer path — plus a policy on whether an explicit `fire(id)` bypasses conditions and whether a condition is checked once or continuously; (4) **the format is not safely additive here** — an older runtime ignoring `conditions` would fire a reaction whose condition is false, so this needs a schema bump or an explicit `requires` marker; (5) the editor: the patch path, an issue for a condition naming a variable that does not exist, and the simulator setting values to test against |
| VNX-40 | Priority, interruptible, cooldown, repeat, return behavior |
| VNX-41 | Behavior graph, Advanced only |
| VNX-42 | Idle composer: blink · look around · head drift · hand movement · expression variation |
| VNX-43 | Natural randomness per automatic action: interval, min/max, probability, intensity, variation |
| VNX-44 | Anti-repetition: a short `lastActions[]` history lowers the probability of what just played |
| VNX-45 | Target system: `look`, `head`, `leftHand`, `rightHand` — `mascot.setTarget('look', {x, y})` |
| VNX-46 | Pointer targets: eyes follow, head follows, hand reaches, with configurable gain |
| VNX-47 | DOM targets: `mascot.setTargetElement('look', '#buy-button')` |

---

## M6 — Runtime, integration, performance

| Item | Subject |
| --- | --- |
| VNX-48 | Intentional API: `pose()`, `play()`, `trigger()`, `setInput()`, `setTarget()`; old names stay as aliases |
| VNX-49 | CustomEvent adapter |
| VNX-50 | WebSocket adapter, as `examples/integrations/websocket/`, not in the runtime |
| VNX-51 | SSE / backend adapter — a backend must never know `headX` or `handRX` |
| VNX-52 | Simulation panel: click, hover, timer, custom event, backend event, inputs, pointer target |
| VNX-53 | Event log with timestamps |
| VNX-54 | Visual state debugger (Advanced): active behaviors, actions, poses, layers, inputs, targets |
| VNX-55 | Lazy workspaces: `import('./workspaces/animate/index.js')` on demand |
| VNX-56 | Heavy workspaces `destroy()`, not `display:none` |
| VNX-57 | Timeline virtualisation |
| VNX-58 | Layers virtualisation |
| VNX-59 | Local DOM diff instead of wholesale `innerHTML` |
| VNX-60 | Sleep / wake: nothing animating → `cancelAnimationFrame`, wake on event |
| VNX-61 | Visibility API: hidden page suspends non-essential work |
| VNX-62 | IntersectionObserver: off-viewport mascot pauses or drops to 5 fps |
| VNX-63 | Adaptive fps: desktop 60 · mobile 30–60 · battery saver 30 · hidden 0 |
| VNX-64 | Feature analysis at export: hands? warps? shape keys? deformers? |
| VNX-65 | Runtime modules: core · animation · hands · warp · deformation · behaviors |
| VNX-66 | Minimal automatic bundle: a simple face ships core + animation only |

---

## M7 — Design system, onboarding, presets, responsive

| Item | Subject |
| --- | --- |
| VNX-67 | All CSS out of `index.html` into `styles/` (tokens, layout, typography, responsive, components) |
| VNX-68 | UI primitives: button, icon button, slider, XY pad, tree, inspector section, popover, modal, tabs, property row, chip, search |
| VNX-69 | Coherent iconography with tooltips instead of visible text |
| VNX-70 | First-run assistant: create simple face · import SVG · start from template |
| VNX-71 | Guided setup with real progress: `Face setup 4/8` |
| VNX-72 | Contextual help — a tooltip and a *learn more*, not a manual |
| VNX-73 | Mascot templates: simple face, robot, ghost, creature, round character, floating head |
| VNX-74 | Expression library |
| VNX-75 | Action library |
| VNX-76 | Behavior library: follow pointer, greet visitor, react to click, idle alive, show notification, point to CTA |
| VNX-77 | Desktop: the complete interface |
| VNX-78 | Tablet: creation, simple rig, poses, expressions, actions, simple behaviors |
| VNX-79 | Smartphone: preview, expressions, actions, behaviors, small edits, export — precision work stays desktop/tablet |
| VNX-80 | Every canvas controller has a keyboard alternative |
| VNX-81 | Tested at 200 % zoom, forced colors, `prefers-reduced-motion`, landmarks, keyboard only |

---

## M8 — Advanced and legacy removal

| Item | Subject |
| --- | --- |
| VNX-82 | One Advanced panel: parameters, bindings, shape keys, keyforms, warp, hierarchy, parallax, constraints, state machine, raw timeline, diagnostics |
| VNX-83 | Shape key editor — present in the runtime, barely authorable today |
| VNX-84 | Warp handles on the canvas gizmo |
| VNX-85 | Curves editor, only once the new timeline is validated |
| VNX-86 | Local coverage telemetry, tests only: is the old panel reachable, is the new one equivalent |
| VNX-87 | Parity matrix: old function → new interface → tests |
| VNX-88 | Progressive removal: old routes, legacy CSS, old panels, adapters, unused components |
| VNX-89 | Uniform undo: one complete drag is one undo step, never one per frame |
| VNX-90 | Autosave keeps the `ProjectDocument` and not the session (open panels, hover, playback) |
| VNX-91 | Universal search over actions, objects and commands |

Parity matrix shape (VNX-87):

| Old function | New interface | Tests |
| --- | --- | --- |
| Motion Studio | Action editor | — |
| Reaction Studio | Behavior builder | — |
| Hand Setup | Hand mode | — |
| Head Pose | Head controller | — |

---

## Hard constraints, unchanged

The V2 constraints carry over in full (`V2_ROADMAP.md`), and VNext adds none
of its own:

* ES modules, Vite, SVG, SVG.js 2, the existing editor/core/runtime split. No
  React, no rewrite, incremental change only.
* **No duplicated math.** Editor preview and exported runtime call the same
  evaluator.
* `normalizeRig()` stays the single migration boundary. Old projects never
  break.
* The exported runtime embeds no editor code.
* Per frame: never parse a path, never rebuild the SVG, never clone the
  project, never `querySelector` per parameter.

## A layout constraint worth knowing before adding to Face Setup

`ux07-face-movements.spec.js` drives the movement XY pad with **absolute mouse
coordinates**. After VNX-15 put the set-up steps above the test, that pad sits
about 570 px down the inspector column at 1280×720 — the last thing above the
fold. Anything else added above it pushes it off screen and the drag misses.
Add below the pad, or fold what you add into a `more` disclosure.

## What the motion mixer actually does (established for VNX-32)

Worth having written down, because three roadmap items assume otherwise.

| Question | Answer, from the code |
| --- | --- |
| Two layered motions both write `handRX` | **The one started last wins outright.** Not a sum, not an average — `createMotionLayer` emits every clip with `mode: 'weightedOverride'`, and at a settled weight of 1 that is plainly the new value |
| `playMotion(id, {layer: true})` vs a cross-fade | Genuinely different. A cross-fade ramps every other weight to 0, so two clips overlap only for `motionBlend.duration` — a hand-over the author asked for, and **never something to warn about**. `layer: true` is the sustained case |
| Priority | Does not exist on clips. `priority` is a *reaction* field: which reaction may interrupt another, not how two clips combine |
| An additive channel | The mixer implements `additive`, and nothing can ask for it — `createMotionLayer` hard-codes `weightedOverride` |
| An empty track | **Still writes.** `evaluateAnimationClip` back-fills any track key present in the defaults, so `tracks: { handRX: [] }` pins the movement and overrides an earlier clip exactly as hard as a keyed one |

The last row is why the conflict model asks the evaluator which parameters a
clip writes rather than reading `Object.keys(clip.tracks)`.
