# Behavior Studio — audit and redesign

> Scope: the **Behavior** workspace and everything under it — Reactions,
> Automatic, States & transitions — plus every surface that tunes an animation
> those three run. Nothing in Design, Rig or Animate moves.

## 1. The audit

### 1.1 The one diagram in the editor was given the narrowest column

`core/state-machine/graph-layout.js` says it in its own words:

```text
Small, because of where this is drawn: the state editor is a column in the left
sidebar, about 260 px wide, and a diagram that only fits at the zoom floor is a
diagram nobody reads. It is the column that is really wrong — a graph wants the
canvas — and until it moves, the geometry is what can be made to fit.
```

A node is 112 × 48 px **because of the column**, not because that is a good
size for a state. Measured at 1440 × 900 on `behavior.stateMachine`:

| Region | Width | What it held |
| --- | --- | --- |
| Left column | 300 px | the state list, the pose sliders, **the graph**, the transition list, the transition inspector, the problems, the parameters |
| Canvas | ~790 px | a drawing of the mascot, which is not what the screen is about |
| Inspector | 310 px | nothing — no adapter answers for a state |

58 % of the window showed the thing the screen was *not* about, and the diagram
— the one surface that genuinely wants space — was folded inside a `<details>`
marked *advanced*, at the bottom of a column, under six other sections.

### 1.2 Three screens, three unrelated interaction models

| Screen | Model | Selection |
| --- | --- | --- |
| Reactions | list of sentences + inspector | one reaction |
| Automatic | cards with switches | none |
| States | diagram **and** list **and** inspector | one state, one edge, as strings |

They answer one question — *when does the mascot do things* — and share no
surface, no selection, no vocabulary for time. An author tuning "the blink is
too fast" and "the transition to Sleep is too slow" is in two unrelated UIs.

### 1.3 The states screen carried a second navigation

`state-machine-panel.js` drew its own `AUTHOR · States | Behaviors` nav inside
a workspace that already has `Reactions | Automatic | States` in the topbar.
Two navigations, overlapping words, one of them invisible until a disclosure is
opened.

### 1.4 A transition was hard to select and impossible to select in bulk

- The only ways in were an 8 px curve, its label, or a list filtered to the
  selected state's outgoing edges.
- `selectedEdge` was one string, `"from->to"`. There was no multiple selection,
  so "make every transition out of Idle 200 ms" was *n* trips through a number
  field, *n* history steps.
- The transition inspector was a third section **below** the diagram in a
  300 px column: selecting an edge scrolled its own editor out of view.
- Nothing dimmed: on a twelve-state machine every edge looked equally relevant.

### 1.5 Animation tuning was numbers with no picture

Everything the Behavior workspace tunes is a **shape in time**, and not one of
them was drawn:

| What | The control it had | What it is |
| --- | --- | --- |
| Transition | `duration` number in ms, `easing` select of four | a curve |
| Reaction | attack / hold / release, three numbers | three segments |
| Blink | intervalMin, intervalMax, duration, closedValue | a pulse train |
| Oscillator | amplitude, offset, frequency | a sine |
| Random idle | intervalMin, intervalMax, min, max | a step-hold |
| Drift | amplitude, travelMin/Max, intervalMin/Max | an eased random walk |

The only visual feedback in the whole surface was the literal string `∿ ∿ ∿`.
`easeInOut` and `easeOut` were two words in a `<select>`; an author had to press
**Test** and watch the mascot to find out which is which — and the mascot was
across the window, in the column that was 58 % of it.

### 1.6 One data model, two editors

`document.behaviors` is edited by the **Automatic** cards (by preset, with
switches) *and* by the advanced **Behaviors** panel (by index, with raw
fields). Same array, two vocabularies, and the cards link to the other editor
with a line that says "Behaviors (advanced)".

### 1.7 Re-render on every keystroke

`state-machine-panel.js` rebuilds its whole column — diagram included — inside
an `input` handler. `graph-view.js` is full of careful work to survive that:
`setSelection` compares before re-rendering, drags paint with CSS transforms
and write once on release, `syncLive` patches classes instead of redrawing.
The care is real and correct; the cause was the panel above it.

---

## 2. What good looks like

Surveying the tools that solve this exact problem — state-machine and
behaviour authoring with tunable timing — three conventions are universal, and
all three were missing here:

1. **The graph is the document, at document size.** Unity's Animator, Unreal's
   Blueprint / State Tree, Godot's `AnimationTree`, Spine's animation state,
   Live2D's motion groups, Rive's State Machine: in every one of them the node
   graph occupies the main working area and the character preview is a small
   docked viewport. Rive is the closest analogue to this editor and it is
   explicit about it — the *Stage* shrinks, the state machine takes the window.
2. **Timing is drawn, not typed.** Every one of these tools shows the easing as
   a curve and lets you scrub it; none asks you to choose between the words
   "ease in" and "ease in out" with nothing to look at.
3. **One inspector, driven by the selection.** Click a node → its settings.
   Click a transition → its settings. Click five transitions → their shared
   settings. Never a third panel below the diagram.

This editor already *has* the third one as an architecture
(`ui/inspector-registry.js`: `panels on screen + selection = inspector`) — the
Behavior workspace simply never registered an adapter.

---

## 3. The redesign

### 3.1 The board replaces the canvas on Behavior

```text
┌─────────────┬──────────────────────────────────────────┬────────────────┐
│  LIBRARY    │  BOARD          [All·Reactions·Auto·States]│  TUNING        │
│             │                                           │                │
│ #reactions- │    ╭───────╮        ╭────────╮            │  the selection │
│  panel      │    │Clicked│───────▶│ Wave   │            │  and the shape │
│ #automatic- │    ╰───────╯        ╰────────╯            │  of its time:  │
│  panel      │                                           │  easing curve, │
│ #state-     │      ╭────╮  ⇄  ╭────╮   ╭─────╮          │  duration,     │
│  editor     │      │idle│─────│talk│──▶│sleep│          │  waveform,     │
│             │      ╰────╯     ╰────╯   ╰─────╯          │  timing bar    │
│             │   ┌────────┐                               │                │
│             │   │ mascot │ ← the stage, 180 px           │  ▶ Test        │
│             │   └────────┘                               │                │
├─────────────┴──────────────────────────────────────────┴────────────────┤
│  TRANSITIONS — every edge as a row, inline duration and easing, bulk edit │
└───────────────────────────────────────────────────────────────────────────┘
```

The mascot is **not removed**: it is a live stage docked in the board's corner,
at Off / Small / Large, so what is being tuned is visible beside the controls
that tune it rather than across the window from them. That is the whole of
"reduce the mascot to the minimum": minimum *size*, maximum *proximity*.

### 3.2 One graph engine, four kinds of node

The state graph's machinery — authored positions, pan, zoom, fit, marquee,
groups, notes, link-dragging, the live highlight — is **the** interaction model
for the workspace, and every other thing the workspace holds becomes a node in
it:

| Node | From | Reads |
| --- | --- | --- |
| `trigger` | a reaction's `trigger`, grouped by signature | *Clicked*, *Every 5 s*, *Left alone 8 s* |
| `reaction` | `document.reactions` | what it does, as the sentence it already had |
| `state` | `document.states` | the pose, in / out counts, the initial mark |
| `automatic` | `document.behaviors` | the ambient movement, with its waveform |

| Edge | From | Drawn |
| --- | --- | --- |
| `transition` | `document.transitions` | a solid curve with its duration on it |
| `fires` | trigger → reaction | a solid curve |
| `guard` | reaction → state | dashed: *only if the mascot is in this state* |

Triggers and reactions lay out in bands to the **left** of the state block, at
negative x, so no state moves and every layout authored before this release
opens exactly where it was left. A band wraps at eight rows: the template ships
twenty-one reactions, and twenty-one in one column is a board whose only
readable zoom is 32 %. Reactions are ordered by the trigger that fires them, so
one event's fan-out lands on neighbours.

**Fit and open are different questions.** *Fit* means "show me all of it" and
keeps meaning that. Arriving is not a request for the overview, so a board too
large to be read at its fit opens at a readable zoom, centred on what is
selected — or on the state the mascot starts in.

### 3.3 Selecting a transition

- Click the curve, its label, or its row in the table below.
- **Shift-click** adds — the tuning rail then edits *every* selected transition
  at once, in one history step.
- Selecting a node **focuses** it: its own edges stay lit, the rest dim, which
  is what makes a twelve-state machine readable.
- `Tab` from a selected state cycles its outgoing transitions.
- The **transitions table** lists every edge whatever is selected, with its
  duration and easing editable in place — the way to tune a machine without
  hunting on the canvas.

### 3.4 Tuning, as shapes

One rail, one selection, and every control is a picture of the thing it sets:

- **Easing** — the four curves drawn as four thumbnails, the chosen one large,
  with a playhead that runs the real easing over the real duration.
- **Duration** — a slider over named stops (Instant · Snappy · Quick · Normal ·
  Smooth · Slow · Lazy) with the millisecond value beside it.
- **Behaviour waveform** — blink, oscillator, random idle and drift sampled
  through `createBehaviorController`, *the runtime's own scheduler*, so the
  picture is what will happen and not an illustration of it.
- **Reaction timing** — attack / hold / release as three proportional segments.

Every one of them is a *picture of the runtime*, not an illustration: the
easing is `runtime/transitions.js`'s own four curves and the waveform is
sampled through `createBehaviorController`, the scheduler the exported mascot
runs, with a seeded random so the same behaviour draws the same picture twice.

### 3.5 One inspector

`behavior` joins `ui/inspector-registry.js` as an adapter over the `reactions`
subject for the kinds `state`, `transition` and `automatic`; `reaction` keeps
its own. The rail in the diagram above *is* the right-hand inspector — there is
no fourth panel.

---

### 3.6 Where the work is kept

```text
core/behavior-graph/behavior-graph.js   the typed model, the layout, the geometry
core/behavior-graph/board-commands.js   moving any node, and editing edges in bulk
core/behavior-graph/motion-shapes.js    easing curves, duration stops, waveforms
ui/behavior-studio/board.js             the board: markup (pure) and pointers
ui/behavior-studio/tuning.js            the rail, from the selection
ui/behavior-studio/transition-table.js  every edge as a row
app/workspaces/behavior.js              one selection, shared by all four
```

Covered by `core/tests/behavior-studio.test.js` (the model, the commands, the
maths, the markup) and `tests/e2e/ux48-behavior-studio.spec.js` (the board in a
browser: the stage, the lenses, the bulk edit, the waveform, one inspector).

## 4. What deliberately did not change

- **The runtime.** Not one behaviour type, transition field or reaction clause
  was added. This is an authoring surface over the model that already exists.
- **`graphLayout`.** Still `{nodes, groups, comments}`, still the `stateMachine`
  domain, still undone and saved like a transition, still absent from
  `rig.json`. New node kinds take prefixed keys (`do:`, `when:`, `auto:`) in
  the same map, so an old project opens unchanged and a new one still exports
  the same rig.
- **The reaction sentence.** *When · Only if · Do · Then* was the one part of
  this workspace that was already right; the board draws it and the inspector
  keeps editing it.
- **`#reactions-panel`, `#automatic-panel`, `#state-editor`.** They are the
  library rail now instead of the whole screen, and they keep their ids, their
  contracts and their mutual exclusivity per screen.
