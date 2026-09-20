# Shell V2 — what the interface actually does with a window

The first deliverable of the Shell V2 programme (§38 of the brief): the current
shell, measured rather than remembered, and the plan that follows from the
measurements.

- **Baseline:** `main` at `1db5bc7`, plus the three unmerged stillness commits
  on `claude/funny-fermat-ngc33h`.
- **Audited:** 2026-09-20.
- **Method:** `tests/e2e/ux60-shell-metrics.spec.js` drives the real editor with
  the standard template loaded, visits all fourteen screens at three viewports,
  and reads the live DOM. Nothing below is copied from an older document;
  `docs/CURRENT_STATE.md` is the companion audit of *what the editor does*, and
  this one is about *how it is laid out*.

---

## 1. The finding, in one number

`ui/panel-split.js` guarantees the canvas a share of the window:

```js
export const CANVAS_SHARE = 0.52;
export const minCanvas = (available) => Math.max(360, Math.round(available * 0.52));
```

It is a floor, not a ceiling, and no screen sets an upper bound. So the canvas
takes 52 % at 1280 and **grows from there**: the wider the monitor, the more of
it the mascot takes. That is backwards. A bigger window should buy more room for
the work, not a bigger face.

| Screen | 1280×720 | 1440×900 | 1920×1080 |
|---|---|---|---|
| Design ▸ Assemble | 52.0 % | 52.0 % | **62.5 %** |
| Design ▸ Draw | 52.0 % | 55.6 % | **66.7 %** |
| Design ▸ Hands | 52.0 % | 54.9 % | **66.1 %** |
| Rig ▸ Assign | 52.0 % | 52.1 % | **64.1 %** |
| Rig ▸ Controls | 52.0 % | 52.0 % | **62.5 %** |
| Rig ▸ Head 2.5D | 53.1 % | 58.3 % | **68.8 %** |
| Rig ▸ Deform | 52.0 % | 52.0 % | **62.5 %** |
| Animate ▸ Expressions | 52.0 % | 54.2 % | **65.6 %** |
| Animate ▸ Motions | 52.3 % | 57.6 % | **68.2 %** |
| Animate ▸ Timeline | 52.3 % | 57.6 % | **68.2 %** |
| Behavior ▸ Reactions | 14.1 % | 12.5 % | 9.4 % |
| Behavior ▸ Automatic | 14.1 % | 12.5 % | 9.4 % |
| Behavior ▸ States | 14.1 % | 12.5 % | 9.4 % |
| Preview | 75.8 % | 78.5 % | 83.9 % |

Two screens are already right and are the proof the rest can be fixed without a
new framework: **Behavior** (the board took the canvas column at #160, and the
mascot is a 180 px corner) and **Preview** (where a big mascot is the point).

---

## 2. Zoom

Measured from `#zoom-value`, which is what the author sees.

| Screen | 1280×720 | 1440×900 | 1920×1080 |
|---|---|---|---|
| Design ▸ Hands | **246 %** | **240 %** | **246 %** |
| Design ▸ Assemble | 138 % | 120 % | 146 % |
| Design ▸ Draw | 138 % | 120 % | 146 % |
| Behavior (all three) | 129 % | 129 % | 129 % |
| Preview | 129 % | 129 % | 129 % |
| Rig (all four), Animate (all three) | 99 % | 99 % | 99 % |

The brief says "often above 150 % without real need". Hands is at **246 %** —
a pair of hands blown up two and a half times on the screen that is about
choosing which drawing they use. The Rig and Animate screens are already at
99 %, so the fix is not global: it is a *fit* that only ever scales **down**.

---

## 3. Scroll, and what it hides

`scrollHidden` is how far a scrolling region extends past its own bottom — the
content an author can only reach by scrolling. At 1440×900:

| Screen | Scrollers | Hidden below the fold | Worst offender |
|---|---|---|---|
| Behavior ▸ States | 2 | **5 088 px** | `panel-right` |
| Rig (all four) | 2 | **3 206 px** | side-nav section |
| Design ▸ Draw | 1 | 3 208 px | `left` |
| Preview | 1 | 3 099 px | `panel-right` |
| Animate ▸ Timeline | 1 | 2 959 px | `left` |
| Animate ▸ Motions | 1 | 2 805 px | `left` |
| Animate ▸ Expressions | 1 | 2 136 px | `left` |
| Design ▸ Assemble | 1 | 422 px | `left` |
| Design ▸ Hands | 1 | 94 px | `left` |

Three thousand pixels is three and a half windows of content stacked in a
column, and it is *structure* rather than a collection: the Rig column holds
nine sections, one per capability.

---

## 4. What that costs, in controls you can actually see

Counting sliders, movement rows, pose chips, asset cards and motion rows that
are **wholly inside the window**, at 1440×900:

| Screen | Controls rendered | Visible without scrolling |
|---|---|---|
| Animate ▸ Motions | 46 | **0** |
| Animate ▸ Timeline | 46 | **0** |
| Preview | 95 | **0** |
| Rig ▸ Controls | 15 | **4** |
| Behavior ▸ States | 77 | 8 |
| Design ▸ Assemble | 7 | 7 |

Verified directly rather than inferred: on **Animate ▸ Motions** the first
motion control sits at `y = 1539` in a 900 px window — **639 px below the
fold**, with not one of the forty-six even partly in view. On **Rig ▸ Controls**
the fifteen controls start at `y = 528` and run to `y = 949`, so four fit.

---

## 5. `<details>` doing the job of navigation

| Screen | `<details>` visible | Shut by default |
|---|---|---|
| Rig ▸ Controls | **13** | **12** |
| Preview | 27 | 3 |
| Animate (all three) | 9 | 7 |
| Rig ▸ Deform / Head 2.5D | 6 | 5 |
| Rig ▸ Assign | 5 | 3 |

Rig ▸ Controls opens with **twelve of its thirteen disclosures shut**. That is
the §7 complaint exactly: the accordion is the navigation, and the way to find
out what a screen can do is to open everything.

---

## 6. The problem table

| # | Problem | Evidence | Fixed by |
|---|---|---|---|
| P1 | The canvas has a guaranteed share and no ceiling, so it grows with the monitor | `CANVAS_SHARE = 0.52`; 62–69 % at 1920 | PR 1–2: layout registry + Character Stage |
| P2 | Auto-fit scales *up* | Hands at 246 %, Design at 120–146 % | PR 2: `autoZoom: 'down-only'` |
| P3 | Capabilities are found by scrolling | 3 206 px hidden in the Rig column | PR 3–4: capability bar |
| P4 | `<details>` is the primary navigation | 12 of 13 shut on Controls | PR 4, 10 |
| P5 | Controls sit below the fold | Motions: 0 of 46 visible | PR 4, 7 |
| P6 | Width is unused: one column of stacked rows | `left` scroller on every screen | PR 4–7: grids |
| P7 | A permanent third column whether or not it holds anything | `inspector-host` on every screen | PR 1: hidden / compact / open |
| P8 | One universal shell for four kinds of task | `app-shell.js` composes the same regions always | PR 1: four layout primitives |

---

## 7. Screen → target mapping

| Screen | Layout | Stage position / size | Primary area | Capability navigation | Detail strategy |
|---|---|---|---|---|---|
| Design ▸ Assemble | `browse` | right, small (30 %) | asset grid | Head · Eyes · Brows · Nose · Mouth · Hair · Accessories | inline on card |
| Design ▸ Draw | `edit` | centre, large | canvas | tool bar | right drawer, open |
| Design ▸ Hands | `browse` | right, small | two state grids | Left · Right | inline on card |
| Rig ▸ Assign | `control` | right, medium (35 %) | role list, two columns | — (one list) | compact |
| Rig ▸ Controls | `control` | right, medium (35 %) | **Control Deck** grid | Head · Eyes · Brows · Mouth · Hands · Extra | in-deck detail |
| Rig ▸ Head 2.5D | `edit` (50/50) | left, large | pose grid | Simple · Standard · Custom | inline |
| Rig ▸ Deform | `edit` | centre, large | canvas | Pins · Holds · Warp · Shape Keys · Depth | right, open |
| Animate ▸ Expressions | `browse` | right, small | list + editor | — | centre column |
| Animate ▸ Motions | `browse` | right, small | list + settings | — | centre column |
| Animate ▸ Timeline | `graph` | dock right, mini | timeline | Follow selection · Lock · Show all | right, compact |
| Behavior ▸ ×3 | `graph` | mini (off/small/large) | board | Reactions · Automatic · States | right, open |
| Preview | `graph`-ish | centre, 70–80 % | stage | — | folded *Advanced testing* |

---

## 8. Wireframes

**Control layout — Rig ▸ Controls** (P3, P4, P5, P6 all at once):

```text
┌──┬──────────────────────────────────────────────────────────────┐
│  │ BOOP  project.boop   ↶ ↷   ✓ Ready   Preview  Save  Export ⋯ │
│  ├──────────────────────────────────────────────────────────────┤
│D │ [Assign] [Controls] [Head 2.5D] [Deform]                     │
│R ├───────────────────────────────────────────┬──────────────────┤
│A │ Head │ Eyes │ Brows │[Mouth]│ Hands │Extra│                  │
│I │                                           │  CHARACTER       │
│L │ QUICK                                     │  STAGE           │
│  │ ┌─────────────┐ ┌─────────────┐           │                  │
│  │ │ Open/Close  │ │ Smile       │           │      ( ^ ^ )     │
│  │ │ ──●──────   │ │ ────●────   │           │       \___/      │
│  │ │ ✓ Ready     │ │ ✓ Ready     │           │                  │
│  │ └─────────────┘ └─────────────┘           │   handles on     │
│  │ ┌─────────────┐ ┌─────────────┐           │                  │
│  │ │ Width       │ │ Round       │           │  [1:1][Fit][Sel] │
│  │ └─────────────┘ └─────────────┘           │  [-] 100% [+]    │
│  │ POSES  Neutral Smile Grin Laugh Frown     │                  │
│  │ MORE   Teeth  Tongue                      │       35 %       │
└──┴───────────────────────────────────────────┴──────────────────┘
```

**Browse layout — Design ▸ Assemble:**

```text
│ Head │[Eyes]│ Brows │ Nose │ Mouth │ Hair │ Accessories │
│ Search…            Morphology ▾   Style ▾                │  CHARACTER
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │  STAGE
│ │ ◉◉ │ │ ◡◡ │ │ ●● │ │ ◔◔ │ │ ◑◑ │ │ ◓◓ │                │  selected:
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                │  Mouth
│                    70 %                                   │   30 %
```

---

## 9. The four layout primitives

```text
layouts/
  browse-layout.js   collection ≥65 % · stage 25–35 %   Assemble, Hands, Expressions, Motions
  control-layout.js  deck 60–70 %   · stage 30–40 %     Assign, Controls
  edit-layout.js     tools 15–20 % · canvas 55–70 % · details 20–30 %   Draw, Head 2.5D, Deform
  graph-layout.js    board ≥70 %   · detail 25 % · mini stage          Behavior, Timeline
```

Each is a composition function: it owns the CSS grid and where the regions go,
and nothing else. The panels that fill them stay the panels that exist today —
§32 is explicit that this redesign changes composition, not business logic.

```text
shell/
  project-bar.js      simplified topbar
  workspace-rail.js   70–90 px vertical rail
  screen-nav.js       the screens of the current workspace
  task-layout.js      the registry: mode id → layout + stage + capabilities
  character-stage.js  the mascot, sized by the task, `autoZoom` policy
  capability-bar.js   always-visible tabs, keyboard navigable
  detail-panel.js     hidden / compact / open
```

---

## 10. Files this touches

**New:** the eleven above.

**Changed, composition only:**
`shell/app-shell.js` (region composition), `shell/canvas-column.js` → becomes
the stage host, `shell/side-nav.js` (retired last, PR 15), `shell/topbar.js`,
`shell/workspace-nav.js`, `shell/panel-splitter.js`, `ui/panel-split.js` (the
`CANVAS_SHARE` floor goes), `ui/task-router.js` (`layout` / `stage` /
`capabilities` per mode), `ui/responsive-shell.js`, `project/editor/index.html`
(the grid), `app/editor-app.js` (wiring only).

**Deliberately untouched:** every `core/**` command and model, `runtime/**`,
the exporter, the sanitizer, the store, the history, the selection model.

---

## 11. Regression risks

| Risk | Why it is real | Mitigation |
|---|---|---|
| Specs address `#canvas`, `.side-nav`, `[data-workspace]` | ~70 spec files, many measuring absolute coordinates | Keep the ids; change composition around them. Retire the old shell only at PR 15 |
| Canvas geometry feeds the rig | Pins, handles and guides are measured against the canvas box | Stage keeps the same measurement API; PR 2 has its own geometry tests |
| Zoom change moves every canvas coordinate | `dragWithin`, `hitTestablePoint` compute from the box | `autoZoom` is per screen, so it lands screen by screen with that screen's specs |
| A UI preference slipping into the document | New per-screen state (stage size, capability tab) | Session/`sessionStorage` only; the existing "no document write" assertions extend to it |
| Behavior regressing | It is already right and easy to break by standardising | PR 12 adapts it last, and asserts the board stays dominant |
| The top bar has no slack | `KNOWN_LIMITATIONS.md` documents it is already ~8 px over at 1280 | PR 1 *removes* navigation from it — this is the slice that gives the room back |

---

## 12. Roadmap

PR 0 is this document and the ruler. Then PR 1 (shell foundations), PR 2
(Character Stage + `autoZoom`), PR 3–4 (control layout, Rig Controls deck), PR 5
(browse layout + Assemble), PR 6 (Hands), PR 7 (Expressions/Motions), PR 8 (edit
layout + Draw), PR 9 (Head 2.5D), PR 10 (Deform), PR 11 (Timeline), PR 12
(Behavior), PR 13 (Preview), PR 14 (responsive + accessibility), PR 15 (retire
the old shell) — exactly the order in §33, which matches the dependency order:
nothing can be migrated before the registry and the stage exist.

## 13. Success criteria, as numbers

Re-run `@metrics` after each slice. The programme is done when, at 1440×900:

```text
stage on configuration screens     25–35 %      (now 52–58 %)
stage at 1920                      does not grow   (now 62–69 %)
initial zoom                       ≤ 100 %      (now up to 246 %)
capabilities reachable             0 scroll     (now 3 206 px)
Rig Controls quick controls        ≥ 6 visible  (now 4)
Motions controls visible           > 0          (now 0)
`<details>` used for navigation    0            (now 12 shut on Controls)
```
