# Design is two screens

> **Assemble** is where a mascot comes from. **Draw** is the vector editor.
> They were one screen, and it opened on the most advanced thing in the editor
> while the simplest was the hardest thing to find.

```text
  DESIGN   Assemble · Hands   › Draw (advanced)

  ┌─ Assemble ──────────────┐   ┌─ Draw ──────────────────┐
  │ Face parts library      │   │ ↖ ◇ ✒ ╱ □ ○ ⬠ T ✋      │
  │  ┌──┐┌──┐┌──┐┌──┐       │   │ Working area            │
  │  │◉◉││◡◡││▬▬││●●│  ×21  │   │ Structure               │
  │  └──┘└──┘└──┘└──┘       │   │  ▾ Left hand            │
  │ Bring a picture         │   │    ▾ Relaxed            │
  │ Add a part              │   │      Index · Middle …   │
  │ ▸ Start over            │   │  (130 layers)           │
  └─────────────────────────┘   └─────────────────────────┘
```

## What was wrong

One screen, `design.artwork`, held two answers to *how do I start?* — "bring me
your pictures" and "here is a Bézier node editor" — and it was where the editor
opened. So the first thing anybody saw was nine vector tools, a hundred and
thirty layers and an Inspector of geometry, bindings and morph targets.

Meanwhile the **drawings the editor ships** were inside a
collapsed disclosure called *Add / Create artwork*, under three cards, at the
bottom of the column. An author's own words for it: *il n'y a rien non plus pour
l'ajout des yeux ou bouche svg*.

The history is worth keeping, because the value has moved before and the reason
changed each time:

| Editor opens on | Why |
| --- | --- |
| `design.artwork` | the pieces a mascot is made of are where the work is |
| `design.face` (V3) | a Pen and a node tool are not what somebody wanting *a mascot* should meet; the Character Builder's screen is |
| `design.artwork` (V5) | the answer to "how do I start" became **bring your pieces**, and Artwork is where pieces arrive |
| `design.assemble` (UIR-18) | **both of those**, on one screen — the library *and* the pieces you bring — with the vector editor beside it rather than under it |

## What is on which

| | Assemble | Draw |
| --- | --- | --- |
| Face parts library (132 drawings) | ● first | |
| Bring a picture (3 ways in) | ● | |
| Add a part (eyebrows, eyelids, hands) | ● | |
| Ready · Continue to Rig | ● | |
| Start over (3 cards, folded) | ● last | |
| Face guides on the canvas | ● | ● |
| The nine vector tools | | ● |
| Working area | | ● |
| Structure (the layer tree) | | ● |
| The Inspector | ● | ● |

The Inspector is on both because it is about the piece in hand rather than
about a screen — and *What it is*, the role field, is the question an imported
picture is asked the moment it lands (docs/FACE_ROLE_ASSIGNMENT.md).

Two orderings are deliberate:

- **The library is first.** It is the only one of these that shows pictures
  rather than words, and it is what an author reaches for most.
- **Start over is last, and folded.** Every card in it replaces the artwork the
  author has. A destructive act does not belong at the top of a column, and
  Home already offers the same three to somebody who has nothing yet.

The guides are on **both**, and on nothing else, for the same reason the
Inspector is: they are about making a mascot rather than about a screen. A head
with no face on it gets a named, dashed box where each missing part goes, and a
card under the pointer frames where that drawing will land
(docs/FACE_GUIDES.md). Everywhere else the mascot is being tried on, and a
dashed box over a finished one is clutter.

The layer tree is not on Assemble. A hundred and thirty layers is the opposite
of the point of the screen; a piece brought in arrives selected and the
Inspector asks what it is, and picking one out of the tree is Draw's job, one
tab away.

## How it is built

**One surface, two modes.** `design.assemble` and `design.artwork` both mount
the `create` surface, so every panel host, the render plan and all the wiring
are exactly as they were — nothing in them knows this happened. Which *groups*
of them show is gated on `data-mode` in the stylesheet, the same way the
workspaces have always been gated on `data-workspace`, and the side nav wraps
them in `.assemble-tools` and `.draw-tools`.

This is the same shape Rig has used since UIR-01, where four screens sit over
one column of panels.

**Assemble is first in `MODES`**, which is what makes it the answer to
`surfaceToMode('create')`, the screen the DESIGN tab opens, and `DEFAULT_MODE`.
**Draw is `advanced`**, so it sits behind the workspace's chevron — folded,
never removed: it keeps its tab, its route, its deep link and its entry in
*Advanced tools* (UIR-00), and any route to it opens the chevron.

## Where a project lands

`DEFAULT_MODE`, written once and read by every path that puts a project on the
canvas: a template, a generated face, an SVG import, a restored snapshot, a
recovered draft. The project service has never had an opinion of its own and
still has not.

One exception, and its own card says why: **a blank canvas lands on Draw**.
*"An empty working area to draw your own, with the Pen, shape and Text tools"* —
somebody who asked for nothing and a set of drawing tools should not then have
to go and find the drawing tools.

*Add picture* with no project yet makes a blank artboard first, and names
`DEFAULT_MODE` explicitly so it stays where the author already is: being moved
to the vector editor for having pressed *Add picture* is a screen change nobody
asked for.

## Older names

Every id that was ever navigable still resolves (`MODE_ALIASES`), and two
changed meaning here:

- `character` — Design ▸ Face, the Character Builder's screen — now lands on
  **Assemble**, which is the screen that dresses a face out of the library,
  which is what the Builder was for.
- `create` and `artwork` still name **Draw**, because that is the screen they
  named: the surface id and the task id of the vector editor.

`PANEL_MODES` gained `face-library` and moved `face-builder` to Assemble, so a
deep link into either — from *Advanced tools*, Problems, the command palette or
a validation *Fix* — opens the screen it is on rather than landing on a panel
out of sight. `face-builder` had **two entries** in that table, the second
silently shadowing the first; there is one now.

## What is held to

```text
project/editor/ui/task-router.js            the two modes, DEFAULT_MODE, the aliases, PANEL_MODES
project/editor/shell/side-nav.js            .assemble-tools and .draw-tools
project/editor/ui/sidebar-sections.js       the ways to start, the parts that go on whole
project/editor/index.html                   the data-mode gating
project/editor/app/services/project-service.js   where a project lands, and the blank-canvas exception
project/editor/core/tests/task-router.test.js    the routing, the aliases, the panel table
project/editor/core/tests/project-service.test.js  that the service names DEFAULT_MODE and not a screen
tests/e2e/design-screens.spec.js            which controls are on which screen, in a browser
```

The browser spec is not a duplicate: the split *is* a stylesheet gating groups
on an attribute, and a unit test cannot see a `display: none`.
