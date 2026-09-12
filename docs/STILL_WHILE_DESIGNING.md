# Still while designing, and one way back to rest

Two rules about the mascot on the canvas, and both of them are about the
*session* rather than about the project:

1. **Where the face is being designed, it holds still.** In the Character
   Builder and in Artwork nothing the mascot does on its own is allowed to move
   it.
2. **One control puts it back.** *Reset mascot*, in the project bar, on every
   tab.

Nothing either of them does is written down. No `ProjectDocument` field, no
command, no history step, no revision, no export. Close the tab and neither
ever happened.

## 1 · Holding still

### Why

The Character Builder places the parts of the face and Artwork draws them, and
both are done **by clicking the mascot itself** — an eye is picked by clicking
the eye, a point is dragged where it should go. A face that blinks, glances
away and drifts its head under the pointer is a moving target: the piece is not
where it was a moment ago, and the drawing cannot be judged while it is moving.

Every other task either *watches* the mascot (Preview) or *edits what it does*
(Face Setup, Expressions, Motions, Reactions). There the movement is the work,
so there it runs.

| Task | Workspace | The mascot |
| --- | --- | --- |
| **Character** | `character` | holds still |
| **Artwork** | `create` | holds still |
| Face Setup | `rig` | moves |
| Expressions | `expressions` | moves |
| Motions | `animate` | moves |
| Reactions | `reactions` | moves |
| Preview | `preview` | moves |

The table lives once, in `app/services/preview-service.js`
(`STILL_WORKSPACES`). The shell dispatches a workspace, `editor-app.js` hands
it to `previewService.holdStill(workspace)`, and the service sets one flag on
the preview controller. The editor opens without dispatching a change for the
workspace it opens in, so it is also called once at start-up.

### What stops

* **Every automatic behaviour** (`core/behaviors/*`, docs/BEHAVIORS.md): Blink,
  Natural gaze, Eye wander, Idle head movement, Head drift, Idle hands — every
  `blink`, `randomIdle`, `oscillator` and `drift` the project has, whether or
  not it is one of the named presets.
* **Every reaction nobody asked for**: the two unprompted triggers, `timer`
  ("every eight seconds") and `idle` ("eight seconds after you stop"). They are
  the other thing that moves a face nobody is touching.
* **The render loop itself.** With nothing automatic left to compute,
  `continuous()` stops answering yes on their account and the loop sleeps
  instead of painting a still frame sixty times a second.

### What does not stop

The mascot must stay **posable**: the puppet handles are on in Character, and
Artwork is a drawing surface.

* **The live pose** — a puppet handle dragged on the canvas, the head-pose pad,
  the gaze pad, a movement slider. `setLiveParam` recomputes and repaints
  exactly as before; holding still does not gate `compute()`.
* **Deliberate playback and tests** — a clip, a motion, a transition, a *Test*
  press on a behaviour. Holding still is about what the mascot does **by
  itself**, never about what the author asks it to do.
* **A prompted reaction** — a click or a hover is the author asking.
* **Secondary motion, the control rig's easing and a hand on its way**: these
  follow a pose, they do not start one.

### Restoring

The hold is a **flag of its own**, deliberately not a set of behaviour
overrides. `setBehaviorOverride` is the author's per-behaviour switch in the
Preview panel, and the hold mutes *over* those rather than *through* them:
nothing is written into `behaviorOverrides`, so there is nothing to put back.
Leaving the workspace clears one boolean and what was running is exactly what
runs again — including a behaviour the author had switched off, which stays
off.

The behaviour clocks are not reset either, and the preview clock does not
advance while the loop is asleep, so a drift resumes its travel rather than
starting a new one.

## 2 · Reset mascot

`#reset-mascot-top`, in `nav.project-actions` beside Problems, Save Project and
Export. A **⟲** glyph the size of Undo and Redo, named by its `aria-label` and
explained by its `title`: the project bar is one row from 1280px up and has
about fifty pixels of slack there, which a worded button would have spent. Not
gated on a workspace, and disabled only when there is no project to reset.

Also **Ctrl/Cmd + Alt + R** and *Reset mascot* in the command palette — one
action, three routes, and the palette no longer navigates to Preview first,
which was the one thing this control is not for. It replaced the button that
used to sit inside the Preview panel, a tab away from every place the mascot is
actually posed; two controls with one name would also be one control the
browser cannot tell apart.

### What it resets

Everything the session holds over the document, which is the whole of
`preview.reset()`:

| Cleared | Where it came from |
| --- | --- |
| the live pose (`liveParams`) | puppet handles, the head-pose and gaze pads, the movement sliders, expression intensity |
| preview-only behaviour switches | the Preview panel's *Automatic* checkboxes |
| the previewed state and expression weights | Preview's poses and expression chips |
| clip, motion and arrangement transports, and the playhead | the Timeline, the Motion Inspector, Preview |
| reactions in flight, stayed expressions, the simulator's event log | Preview's event simulator |
| the preview clock | itself |

The mascot is then drawn from the document alone: its active state, at rest.

### What it must never touch

The author's work, all of which stays exactly where it was:

* the artwork, and the parts on the face;
* the rig — semantic parts, movements, calibration, pins, warps, hands;
* expressions, motions, clips, arrangements, reactions, behaviours;
* the undo history, the dirty flag, the autosave, the export.

This is why it needs no confirmation and appears on no undo stack: **it writes
no command, opens no history transaction and moves no revision**, so there is
nothing for an author to lose and nothing for Undo to give back. The button
says so, and so does the status line it leaves behind.

Two more things it deliberately leaves alone:

* **The canvas view.** Zoom and pan are the author's window on the mascot, not
  the mascot; the canvas toolbar has its own *Reset view*.
* **Holding still.** A reset pressed in the Character Builder must not be the
  thing that starts the face blinking, so `preview.reset()` keeps the flag.

## Where it lives

```text
project/editor/core/preview-runtime/preview-controller.js  setHeldStill / isHeldStill, and reset()
project/editor/app/services/preview-service.js             STILL_WORKSPACES, holdStill(), reset()
project/editor/app/editor-app.js                           the wiring, and the one reset action
project/editor/ui/app-shell.js                             the project-bar control
project/editor/ui/shortcuts.js                             Ctrl/Cmd + Alt + R
project/editor/core/tests/hold-still.test.js               both contracts, against a document sentinel
tests/e2e/ux15-automatic.spec.js                           the face holds still where it is designed
tests/e2e/ux08-preview-readiness.spec.js                   one reset, on every tab
```
