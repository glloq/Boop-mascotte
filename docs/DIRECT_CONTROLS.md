# Direct controls

Posing a mascot meant finding the right panel, then the right slider, then
reading a number:

```text
Gaze · Look left / right   [————●————]  -0.42
```

The mascot was on screen the whole time, and nobody could touch it.

A **handle** puts a movement back on the part it moves. Drag the pupils to look
around, the eyelid down to close the eyes, the mouth sideways to smile and down
to open it, the head to turn it. The sliders are still there — they are the
precise path, and the accessible one — but they are no longer the only way in.

## What a handle is

`core/puppet/puppet-handles.js` is the model. A handle is one or two of the
**project's own movements**, bound to the artwork those movements move:

| Handle | Sits on | Sideways | Up and down |
| --- | --- | --- | --- |
| Look around | the pupils | `lookX` | `lookY` |
| Open and close | the top of the eye | — | `eyeOpen` (inverted) |
| Eyebrows | the brows | `browTilt` | `browRaise` (inverted) |
| Mouth | the mouth | `smile` | `mouthOpen` |
| Mouth width | beside the mouth, where a corner is | `mouthWidth` | — |
| Jaw | under the chin | — | `jawOpen` |
| Nose | the nose | — | `noseScrunch` (inverted) |
| Hair | where the fringe meets the side of the face | `hairSway` | `hairLift` (inverted) |
| Ears | one ear, not between them | `earWiggle` | — |
| Turn the head | above the face | `headX` | `headY` |
| Tilt the head | beside the head, as an orbit | — | `headTilt` |

**Every movement the project has is on the mascot.** A part with a slider and
no handle is a part an author has to go and look for, so the eleven above cover
the eighteen movements the template ships — the mouth takes two handles because
its middle is already spoken for by opening and smiling, and the head takes two
because a tilt is a turn of the wrist rather than a drag.

A handle only exists when the project has that movement, turned on, with a
parameter behind it. An unrigged project has no handles at all, rather than a
canvas full of controls that do nothing.

Nothing here knows how a movement is *implemented*. A drag sets the same
parameters a slider sets, so a transform-driven mouth and a morph-driven one
behave identically and the runtime is untouched.

## The head, in 2.5D

`headX` and `headY` are what the pose grid interpolates, so the head handle was
already driving the 2.5D turn — it just could not **say so**. Which of the nine
positions you were near, and which ones held a captured pose, lived only in a
3×3 grid inside a panel.

The head handle now carries the grid with it:

- Nine dots around the handle, one per position, coloured by what each holds —
  captured, neutral, or empty — with the one you are on outlined. They appear
  once a turn exists (or while the head is held), and clicking one goes there.
- The handle's value reads `up and right · captured` or
  `between positions, nearest right · this position is not captured`, so the
  state of the turn is legible without opening anything.
- Holding **Shift** while dragging lands on the nearest of the nine, which is
  how you get back onto a captured pose after nudging off it.

`core/puppet/head-pose-handle.js` is that model — the nearest cell, the
distance to it in steps, and each cell's place in the halo as a 0–1 pair, so
the canvas can lay the dots out without knowing what the axis values are.

**Tilt is a turn of the wrist, not a drag.** A second handle beside the head
orbits it: how far the pointer swings around the head is how far `headTilt`
goes, with `throw` degrees covering the whole range. Arrow keys turn it too.

## Groups and their members

A hand has seven controls of its own — place it, turn it, close the fingers,
turn it over, and one per digit — and a mascot has two hands. Fourteen more
dots on a face that already carries eleven is not direct manipulation, it is a
minefield.

So a handle can be a **group**, and a handle can belong to one. The group is
what you reach for first (the hand itself); its members are folded away behind
a small **+** beside it, and appear on the artwork when it is opened. Members
are drawn smaller, so which is which is legible without reading a label.

```text
Left hand  ⊕            ← the group: drag it to place the hand
  ├ turn                  ↻ orbit, like the head's tilt
  ├ grip                  every finger at once
  ├ palm or back          `handLFlip`
  └ thumb · index · middle · ring     one handle per fingertip
```

A member is an ordinary handle: it names a movement the project has, and
setting it is setting a parameter. The finger handles sit on the **fingertips
themselves** rather than on a corner of the hand's box — `handDigitTip` comes
from the same function that draws the outline, so the handle is on the finger
at every pose, every rotation and every size. Any handle may name a point in
the artwork's own coordinates this way.

The face works the same way. `eyeOpen` closes both eyes because one parameter
drives both roles — so each eye and each eyebrow carries a **side offset** on
top of the shared movement (`docs/SEMANTIC_RIGGING.md`), and those are the
members of the pair's handle. Open the eyes group and drag the left one down:
that eye closes and the other does not. Where a part has no side offsets there
is nothing to expand, and no handle is offered that would write nothing.

## The hands

A floating hand is placed with `handLX` / `handLY`, turned with
`handLRotation`, and it lives inside a reach ellipse. That was eight numeric
fields for *where a hand can go*, and no way to simply put it there.

A hand now has two handles — one to place it, one to turn it — and **its range
is its reach**: dragging one radius puts the hand exactly on the edge of its
ellipse, which is what `1` means to the runtime. The ellipse itself is drawn
while the hand is held, from the model's own `handReachEllipse`, so what you
see is what the runtime allows rather than a picture of it.

Assigning artwork to a hand now also places its anchor on that artwork and
sizes the reach from it, so a new hand can be dragged immediately instead of
needing four numbers first.

## Pose chips

A movement is a slider from one end to the other. A **pose** is a place on it
worth having a name: eyebrows go up and they tilt, but what an author wants is
*angry*, *sad*, *curious* — two numbers each, found by fiddling with two
sliders.

Expressions already name whole faces and the handles reach everywhere in
between. This is the rung between them: one row of buttons per part.

Every part of the face has a row, because a part with no movement has no chip
and no slider, which is the same as not being controllable at all:

| Part | Poses |
| --- | --- |
| Head | Straight · Turn left · Turn right · Chin up · Chin down · Tilt · Peek |
| Eyes | Open · Half · Squint · Closed |
| Gaze | Ahead · Left · Right · Up · Down · Sideways |
| Eyebrows | Neutral · Raised · Angry · Sad · Curious · Frowning |
| Nose | Relaxed · Twitch · Scrunched |
| Mouth | Neutral · Smile · Grin · Laugh · Frown · Open · Gasp · Tongue out |
| Jaw | Closed · Slack · Dropped |
| Hair | Still · Blown left · Blown right · Standing up |
| Ears | Still · Perked · Back |

The Mouth row reaches further than the others because an open mouth has things
in it: **Grin** shows teeth, **Laugh** opens wide with teeth and a little
tongue, **Tongue out** is what it says. Those are ordinary movements —
`teeth` and `tongue` — so a chip is only ever a handful of numbers.

`core/puppet/part-poses.js` resolves them against the project, with the same
`usable` / `missing` shape as every other preset catalogue in the editor: a
face with a brow raise but no tilt can still be *raised*, and *angry* says
which movement would finish it. A part with no movements at all is offered no
chips rather than chips that would do nothing. Values are clamped into each
parameter's own range, and a chip shows as pressed when the face is already
standing in its pose.

The same row appears under each group of movements in Face Setup and above the
sliders in Preview, from the same model — pressing one is a live preview, like
every other control there.

### A hand's poses

A hand pose is a parameter the runtime raises: it deforms the neutral hand
through a shape key, or cross-fades to other artwork. `handPosePresets` returns
one row covering both halves of the job — the poses the hand has, and the
suggested ones it does not. Pressing an offer adds that pose; pressing a pose
strikes it, putting the others down. A pose with neither a shape nor its own
artwork is a name and nothing else, and **says so** instead of pretending to
work.

## Posing is animating

With **Auto Key** on, a drag on the mascot writes a key on every control it
moved, at the playhead, as one undo step. Before this the only thing in the
whole editor that could key was a slider in the rig panel: the direct controls
were a poser, and the timeline was somewhere else.

`autoKeyMany` is one command over every track the gesture touched, rather than
`autoKey` per parameter — otherwise dragging the gaze (two parameters) would
land as two undo steps, and one gesture is one undo everywhere else.

## What a drag means

The pointer delta arrives in the artwork's own units and is divided by the
part's own size, so the same gesture feels right on a 40px face and on a
2000px one — `throw` is how much of the part you cross to cover the whole
range. Values are clamped to each parameter's range, so a drag stops at the
end of a movement instead of running away.

Two axes are inverted, and the reason is worth stating once: `eyeOpen` and
`browRaise` rise as the pointer goes **up**, while `headY`, `lookY` and
`mouthOpen` grow **downwards** like every vertical parameter in the rig
(`headY` is calibrated UP at -1). The handles follow the parameter, so
dragging up always moves the part up.

## Where a drag lands

- **Face Setup** and **Preview**: it is a live preview, exactly like the
  sliders and the XY pads. The project is not touched.
- **Expressions**: on release it also writes into the expression being shaped,
  through the same command the sliders use — one gesture, one undo step, and
  only the movements that handle drives.

Handles appear in those three tasks and nowhere else: Artwork is for drawing
and Animate is for timing. The `✋ Handles` button in the canvas toolbar turns
them off for anyone who wants a clean canvas, and the choice is remembered.

## Keyboard

A handle is a control, so it answers like one: arrow keys nudge (hold Shift for
a bigger step), `Home` puts the movement back to rest, and a double-click does
the same with the pointer. Each handle carries its value as `aria-valuetext` in
plain words — `look left / right +0.5`, not `lookX 0.5`.

## Placement

Handles ride the artwork they move: every frame that changes the mascot
schedules one repositioning pass, coalesced to at most one per animation frame
(and to one every 200ms when nothing is being dragged) since placing them reads
layout. Hidden handles schedule nothing at all, so a task that does not pose
costs nothing per frame, and switching tasks hides them rather than rebuilding
them.

A handle that moves a pair sits **between** the two parts, not on one of them:
the gaze between the pupils, the eyes between the eyes. And two handles never
share a spot — the gaze takes the middle, so the eyelid's handle goes to the
top of the eye and the head's floats above the face, where a puppeteer would
hold it. The ears are the exception that proves it: a handle between them would
land on the nose, so it sits on one ear.

**A handle sits on what is seen, not on what was drawn.** An eye is a
group clipped to its socket, with eyelids drawn far wider than the eye — so its
measured box was 375px tall and the eye's handle floated up onto the forehead,
on top of the head's own. Placement intersects the measured box with every clip
on the way up, asking the browser where each clipping shape landed rather than
re-deriving any geometry, which also keeps the fringe's handle on the fringe
instead of out beside the head.
