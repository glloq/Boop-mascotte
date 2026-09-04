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
| **M3** | Head + hands UX | VNX-16 → 24 | VNX-16, 17, 21 done; 18, 20, 22, 23 partial and each with its gap named; 19, 24 open |
| **M4** | New animation system | VNX-25 → 36 | — |
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
| VNX-10 | ◐ **Publish** workspace: the readiness of the whole project sits beside the mascot being tested — every step with its status, every blocker with the way out of it, and one button that ships. Export and Problems stop being toolbar buttons that are always there and therefore never about anything. Performance and the integration snippets are still to come |
| VNX-11 | ◐ Inspector driven only by the selection (`VNEXT_INSPECTOR.md`). Audited end to end: seven of thirteen selections were already right, two landed on something generic or empty and are fixed, four need a session identity that does not exist yet and are written down with what each would take. One rule replaced the special cases: an adapter is revealed **or** the empty line names what is selected, never neither |
| VNX-12 | ✅ Progressive disclosure: `ui/disclosure.js` gives `Basic → More → Advanced`, where **Basic is not a collapsed section** — it is what the author sees with no click — and an empty section renders nothing at all. Adopted by the hand inspector, the roadmap's own worked example. A guard test pins all 44 of that panel's control hooks, so a tier can move a control but never lose one |
| VNX-13 | ✅ Already true, verified rather than assumed: the phrase *add a semantic part* exists nowhere in the editor. Face Setup is a checklist of eight roles — press *Assign next: Head*, the canvas says **Click the head**, and you click it. `face-role-detection.js` suggests artwork by name and geometry, acceptable one at a time or as one undoable batch, and falls back to canvas picking when the artwork is unnamed |
| VNX-14 | ✅ Universal visual controllers. The kind is **derived from the handle's own resolved axes** — free `orbit` only → `arc`, both linear axes free → `pad`, one → `slider`, one stepped into ≤ 9 stops → `chips`, nothing free → `locked` — so no second table of part types and no parameter-name matching. Locking the mouth's `x` turns it into a slider; stepping `eyeOpen` by 0.5 turns it into chips. An author overrides it through the same sparse record as the shape, and `rig.json` is still byte-identical for a project that authored nothing |
| VNX-15 | Calibration mode: neutral → maximum → test, with no binding ever shown |

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
| VNX-19 | Hand mode: click a hand and manipulate hand, anchor and reach ellipse directly |
| VNX-20 | ◐ `installHands` already detects, places, reaches and mirrors in one undo step — but it measures the **artboard**, not the body. On the shipped template the face fills the artboard so the two agree; on an imported SVG whose mascot occupies half the canvas, the hands land relative to the drawing area rather than beside the character. The fix is to pass the measured artwork bounds (`canvas.getArtworkBounds()`) into it, falling back to the artboard |
| VNX-21 | ✅ delivered by VNX-12: the curls live behind `More ▸ Fingers` and the panel opens on artwork, anchor and poses |
| VNX-22 | ◐ the catalogue exists (`SUGGESTED_HAND_POSES`, plus every pose an author added), and a pose is applied from a chip. What is missing is the *making*: a pose today is declared by pointing it at a shape key or an artwork variant, never by **posing the fingers and saving what you see**. That is the item, and it is also where the create/remove asymmetry noted in `VNEXT_COMPONENTS.md` gets fixed |
| VNX-23 | ◐ the distinction already exists in the data — a reaction raises `gestures` (a side and a pose) alongside its expression and its clip, and the reaction studio reads them back as a sentence. What is missing is an editor for a gesture as an **animation** rather than a raised pose |
| VNX-24 | Gesture library, drag and drop |

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
| VNX-27 | Simple action editor: an animation with no timeline at all |
| VNX-28 | Action tracks by category: face, head, eyes, mouth, body, hand left, hand right, accessories |
| VNX-29 | Multi-clip timeline — the runtime layers motions already, the editor has no multi-clip view yet |
| VNX-30 | Clip operations: move, trim, duplicate, loop, reverse, speed, amplitude, fade in/out, crossfade |
| VNX-31 | Animation layers: each action declares its channels, the mixer combines contributions |
| VNX-32 | Conflict handling: two clips driving `handRX` warn, with override / add / blend / priority |
| VNX-33 | Timeline **Selected only** by default |
| VNX-34 | Timeline groups: `Right hand ▸ transform ▸ fingers ▸ pose`, not fifteen raw parameters |
| VNX-35 | Auto Key everywhere: head, hand, expression, finger — the canvas can already key, extend the principle |
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
