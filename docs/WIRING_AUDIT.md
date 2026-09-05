# Is it wired? — an audit of capability against interface

A feature that exists in `core/` or `runtime/` and cannot be reached from the
editor is not a feature; it is a liability that reads as one. This is the
method used to look for those, and what it found.

## Method

Four passes, each mechanical enough to repeat:

1. **Exports nothing consumes.** Every exported name in `project/`, checked
   against every other production module. Noisy on its own — an internal helper
   that is also exported looks identical to a dead one — so it is a lead, not a
   verdict.
2. **Commands nothing calls.** Every method returned by a `create*Commands`
   factory, checked against every production caller. Commands are the
   authoritative list of *things an author can do*, so a command with no caller
   is a capability with no interface. This is the pass that found things.
3. **Rig blocks nothing authors.** Every block `createExportRig` writes, against
   the panel that would create it.
4. **Domains that redraw nothing.** Every entry in `DOCUMENT_RENDER_PLAN`
   against its target list — a domain that fans out to nothing is a domain
   whose edits are invisible until something unrelated happens to repaint.

## What was sound

* **Every panel is wired by construction.** `createRenderPlan` throws when a
  declared target is missing and when it is handed one it does not know, so
  "the panel exists but nothing renders it" cannot happen quietly. Pass 4's
  first half found nothing.
* **Every rig block except one has an author.** Params, states, elements,
  bindings, expressions, animations, reactions, keyforms, shape keys, hands,
  followers, both blends — each has a panel that creates it.

## What was not

### 1. A warp could be added and never shaped  — *fixed*

`warp-commands.movePoint` existed, `warp-grid.js` bent paths correctly, the
panel could add, size, drive, reset and remove a warp, and the runtime played
one. **Nothing in the editor could move a control point.** The canvas drew no
handles; `movePoint` had no caller; no e2e spec mentioned warps at all.

So every warp an author added did precisely nothing — while the panel told them
*"Warp added. Drag its handles on the canvas."* and its own header drew the flow
as `Add Warp → 3×3 / 4×4 → drag handles → Capture`. A false promise is worse
than a missing feature: the author looks for the thing.

`core/warp/warp-handles.js` is the missing gesture, built like the hand rig
(`core/puppet/hand-handles.js`) because it is the same kind of thing: a control
point is **document** geometry, so a whole drag is one command and one undo
step, never one per frame. The outline bends live in between — the target is
compiled once when the drag starts and `applyWarp` is asked for a path per
move, which is the call the render loop already makes.

Found while wiring it, and worth writing down: a warp point sits exactly where
the piece's own **posing** handle is, and the posing handle was winning the
press. The rule is now explicit in the stylesheet — the lattice is what the
author opened Warp to edit, so it goes above the posing handles, and it is only
ever drawn on the selected piece in the task that sets a warp up.

### 2. Two domains changed the document and redrew nothing — *fixed*

`keyforms` notified four panels and **not the mascot**: capturing a shape key or
moving a warp point left the canvas painting the shape it painted before the
edit, until something unrelated recompiled it. `hierarchy` — deformers, the
depth parallax, and what trails behind the head — fanned out to *nothing at
all*, so switching secondary motion on changed the picture only by accident.

Both now run `previewFrame`, a target that asks the preview to recompile the
frame onto the canvas. The general rule is a test: **no document domain may
redraw nothing.**

### 3. Commands with no interface — *recorded, not fixed*

| Command | State |
| --- | --- |
| `head-pose setAxes` | VNX-18, deferred **with a reason**: a project's grid shape is implicit in its keyforms, so changing the axis values on a rig that already has captures is a remap, not a select box |
| `head-pose captureSamples` | an internal seam that is also exported; `capture` and `captureShape` are what the panel uses |
| `handles setHint`, `setLayer` | a per-handle hint and layer, authorable through no surface |

### 4. An element's resting depth is authorable only for a hand

`element.depth` decides the parallax offset and, since 3D-03, the **draw-order
band** — whether a piece paints in front of or behind its siblings. Nothing in
the editor can set it except a hand's own slider; `ui/advanced-tools.js` says so
plainly (*"Read-only: imported or hand-authored"*), and that was written when
depth bought a sideways nudge and nothing else.

A generated head turn writes depth *poses*, so the far ear does go behind the
head on any rig that has been through Face Setup — that path is live. What an
author cannot say is *"this piece is behind, always"*, which is the other half
of what the band is for.
