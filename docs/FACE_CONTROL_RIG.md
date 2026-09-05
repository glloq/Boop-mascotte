# The face control rig

Posing Boop meant finding a panel, then a slider, then reading a number:

```text
Gaze · Look left / right   [————●————]  -0.42
Gaze · Look up / down      [———●—————]  -0.18
Eyes · Open / close        [————————●]   1.00
```

Every one of those is a real movement and none of them is a *decision an
animator makes*. An animator decides that the character **looks at something**,
that one eye is **half shut**, that the smile is **crooked**. This document is
the vocabulary and the contracts for a rig that can be told those things.

It is the contract, not a plan: nothing here describes work that has not
landed. Where a rule is enforced by a test, the test is named.

---

## 1. The vocabulary

A control's **shape says what it does**. That is the whole rule, and everything
below follows from it.

| Widget | Glyph | Drives | Drawn as |
| --- | --- | --- | --- |
| Target | `●` | two axes | a reticle: rings out from the centre, a dot where the value is |
| Pad | `▦` | two axes | a field with both ends of both axes labelled |
| Slider | `◆│` | one axis | a range, the accessible path to everything else |
| Radial | `○` | one axis | a ring: out is bigger, in is smaller |
| Arc | `↻` | one orbit axis | a dial swept over the movement's own `throw` |
| Cage | `▭` | nothing | a frame around the controls of one part of the face |
| Pin | `◇` | nothing directly | a structural point artwork is deformed around |
| Attachment | — | nothing directly | a named point on the artwork that other things can hold |

A **target** and a **pad** both drive two axes and they are not the same thing.
A pad says "two movements worth moving together" — a brow that raises *and*
tilts. A target says "a place, and the character is pointed at it" — which is
why it is drawn with rings and a centre, and why a gaze gets one.

A **cage** drives nothing. It is a frame that says *these controls are the
eyes*, so a face carrying twenty controls reads as four things to pose.

### Where each one lives

- The vocabulary itself: `core/puppet/handle-record.js` (`RIG_CONTROL_WIDGETS`).
- Which shape a control gets: `core/puppet/handle-model.js` (`handleController`).
- How each shape is drawn: `ui/rig-controls/`, one module per shape, all pure.
- The maths they share: `ui/rig-controls/control-geometry.js`.

A control's kind is **derived** from the axes it ended up with — two free axes
is a pad, one is a slider, an orbit is an arc — so a control on a mascot the
registry has never seen still gets the shape its movement deserves. A
definition may *ask* for a target or a ring, and gets it only where the axes can
carry it: a target with one axis locked is a slider, because half a target
would be a lie about what it does.

An author's own choice overrules both (`widget.controller` on the record).

---

## 2. The four modes

| Mode | For | On screen |
| --- | --- | --- |
| **Simple** | posing quickly | one control per part of the face |
| **Detailed** | posing precisely | every control the part has, one side at a time included |
| **Rig** | building the rig | limits, locks, links, cages, pins |
| **Animate** | keys and time | the same controls, writing keys as they move |

Simple and Detailed are a property of *looking*, not of the rig: they are
session state, and no project stores which cages were open
(`core/puppet/control-groups.js`, `RIG_CONTROL_MODES`).

---

## 3. Composite controls

```text
Simple                          Detailed
 ╭──────── EYES ────────╮        ┃◆                  ◆┃
 │          ●           │        ┃    ◉    ●    ◉     ┃
 ╰──────────────────────╯        ╰─────── ○ ──────────╯
```

A control names the cage it belongs to with `visualParent`. `rigControlGroups`
turns that into Simple (the cage's own controls) and Detailed (the members that
refine them).

**`visualParent` is presentation and nothing else.** It changes no parameter,
no binding and no evaluation order, and no runtime hears about it. That is
deliberate: a visual hierarchy that quietly became a transform hierarchy would
be a second parent system competing with the deformers
(`docs/DEFORMER_MODEL.md`).

The cages are `head-rig`, `eye-rig`, `brow-rig`, `mouth-rig`, `hand-rig`, and
`loose` for everything with no group of its own.

On the mascot a cage is an **editor overlay**, measured from where the handles
ended up — so it follows a turn, a zoom and a pose without knowing about any of
them. It is never artwork.

---

## 4. Interactions

The same gesture means the same thing on every control.

| Gesture | Does |
| --- | --- |
| drag | move it |
| double-click | back to rest |
| `Home` | back to rest |
| arrow keys | one step, or a twentieth of the range |
| `Shift` + arrows | five steps |
| `Shift` + drag | snap (the head's captured positions) |
| `Alt` + drag | a fifth of a step, for precision |
| ring drag | out is bigger, in is smaller — never up or down |
| arc drag | turn around the part |
| link click | the two sides move together, or apart |
| lock | the axis stops being a direction |

Everything works with a pointer, with touch, and with a keyboard. A slider is
kept beside every other shape because a target, a ring and an arc are pointer
gestures first, and a range input is what a keyboard and a screen reader can
always reach (`docs/UX21_ACCESSIBILITY.md`).

---

## 5. The eye rig

```text
        ╭──────────── EYES ─────────────╮
   ◆    │      ◉         ●        ◉     │    ◆
        ╰────────────── ○ ──────────────╯
   lid       left eye  common   right eye   lid
                        gaze
```

| Control | Drives | Shape |
| --- | --- | --- |
| Look around | `gazeX` / `gazeY`, or `lookX` / `lookY` with no solver | target |
| Left / right eye target | `lookXLeft` / `lookYLeft`, and the right pair | target |
| Pupil size | `pupilScale` | radial |
| Left / right pupil size | `pupilScaleLeft` / `pupilScaleRight` | radial |
| Open and close | `eyeOpen` | slider |
| Left / right eye | `eyeOpenLeft` / `eyeOpenRight` | slider |

### Per-eye offsets

`lookX` moves both pupils because one parameter drives every role that carries
it. Each side gets an **offset** added inside its own binding —
`lookX + lookXLeft` — so the shared control keeps exactly the meaning it had,
each offset rests at 0, and convergence, divergence, a wandering eye, a cartoon
squint and any asymmetric expression stop being impossible.

The mechanism is the one that already let one eye wink
(`docs/SEMANTIC_RIGGING.md`); what is new is that the gaze, the pupil size and
the brow tilt use it too.

### Pupil size

A pupil that dilates has to write **both** scale axes — one alone is an oval —
so a registry binding may name a pair of properties, and the driver stores
`properties` when there is more than one. Every driver saved before that keeps
its shape byte for byte.

`pupilScale` runs 0.4 → 1.6 and rests at 1.

### Link / unlink

```text
🔗 linked     drag the left eyelid  →  writes eyeOpen      (both eyes)
⛓ unlinked   drag the left eyelid  →  writes eyeOpenLeft  (that eye)
```

**A link is a rule about manipulation, not a new parameter.** Nothing about the
rig changes: the control writes a different one of two parameters the project
already has, so the drag, the keyboard, the board and Auto Key all follow, and
an author can link, pose, unlink and pose again without the runtime learning
that any of it happened.

Off by default, deliberately: a per-side control exists precisely to move one
side, and the shared movement already has a control of its own. The links are
`eyelids`, `eyeTargets`, `pupils` and `brows` (`core/puppet/control-links.js`).

---

## 6. The gaze solver

```text
                  gazeX / gazeY
                        │
                  ┌─────┴─────┐
                  │  solver   │
                  └─────┬─────┘
            ┌───────────┴───────────┐
            ▼                       ▼
    eye contribution         head contribution
    (adds to lookX/Y)        (adds to headX/Y, late)
```

`gazeX` / `gazeY` are **the point the character wants to look at**. `lookX` /
`lookY` stay the eyes' own manual correction and `headX` / `headY` the head's,
because every project that exists uses them that way and every clip that exists
keys them.

### The split, in degrees

The solver reasons in angles, not artwork units. What the degrees are worth in
pixels is the pseudo-3D turn's business (`docs/HEAD_POSE_2_5D.md`).

```text
range     = eyeLimit + headLimit                 the angle at gaze = ±1
desired   = gaze × range
threshold = max(deadZone × range, eyeLimit × comfort)
overflow  = max(0, |desired| − threshold)
head      = min(overflow × headFollow, headLimit)
eye       = clamp(desired − head, ±eyeLimit)
```

Worked: 30° wanted, the eyes comfortable to 15°, the head willing — the head
takes 15° and the eyes take the remaining 15°, and the two add back up to the
30° that was asked for. Below the threshold the head does not move at all: a
glance is not a turn.

Piecewise linear and continuous, so a sweep of the target produces no jump
anywhere.

### The head is late

```text
0 ms      the eyes are already there
~100 ms   the head starts to move
~250 ms   the head has arrived
```

Two exponential lags in series, not one. A single lag starts at full speed the
instant the target moves, which reads as the head being yanked; cascading two
makes the response start at zero velocity, so the head builds up and settles —
an S curve, with no overshoot to ring and nothing to iterate.

### Settings

| Field | Default | Decides |
| --- | --- | --- |
| `enabled` | `false` | whether the decomposition runs at all |
| `headFollow` | `0.5` | how much of the overflow the head takes |
| `deadZoneX` / `deadZoneY` | `0.15` / `0.2` | the gaze the head ignores |
| `eyeYawLimit` / `eyePitchLimit` | `35` / `25` | degrees the eyes reach alone |
| `eyeComfortX` / `eyeComfortY` | `0.6` | fraction of that reached before the head helps |
| `headYawLimit` / `headPitchLimit` | `55` / `35` | degrees the head turns |
| `headLag` | `0.1` | seconds before the head starts |
| `headSettle` | `0.25` | seconds for the head to arrive |
| `eyelidFollowX` / `eyelidFollowY` | `0` | how far the lids ride the gaze |

---

## 7. The effective parameter layer

```text
rawParams        what the author, the timeline and the states say
    ↓
solvers          gaze decomposition, eyelid follow
    ↓
effectiveParams  what the artwork is posed from, this frame only
```

A solver that writes `headX` into the parameters an author keyed destroys their
animation and then compounds the drift by solving from its own output next
frame. So it does not:

```js
raw.headX             = 0.2   // forever
gaze.headContribution = 0.3
effective.headX       = 0.5   // for exactly as long as the gaze asks
```

Nothing downstream — bindings, keyforms, warps, shape keys — knows the
difference, because they were only ever handed a bag of numbers.

The layer is **inert by default**: with no solver configured and no eyelid
follow, `step()` returns the very object it was given. No allocation, no copy,
no behaviour change.

The engine and the editor preview each own one and call it in the same place,
between the mixer and `compileRigFrame`, so they cannot drift.

`getParams()` stays the authored truth; `getEffectiveParams()` is what the
artwork is showing.

### Eyelid follow

Looking **up** opens the eye a little and looking **down** closes it — the
upper lid follows the pupil, which is the cheapest thing that makes a cartoon
face read as looking somewhere rather than staring. Looking hard sideways
narrows it, so that term reads the *distance* from centre and not the
direction.

The follow is applied to the shared `eyeOpen`, and per side only as the
*difference* where the two eyes disagree — so a rig without per-eye targets
never writes a side offset at all.

---

## 8. The eyebrow rig

```text
       ↻                             ↻
  ─────◇─────                   ─────◇─────
   left brow                     right brow
```

One controller per brow, the way a 3D facial rig has one: the centre moves it,
the arc turns it. `browRaiseLeft` / `browRaiseRight` were already there;
`browTiltLeft` / `browTiltRight` complete the pair, so a single raised, turned
brow is one control rather than an accident of two shared ones.

---

## 9. Evaluation order

Frozen here, and tested. A stage that moves changes what a saved project looks
like, so moving one is a deliberate act with a diff.

```text
 1  base parameters
 2  animation / timeline
 3  expression / state mixing
 4  gaze solver
 5  semantic control solvers
 6  manual offsets
 7  effective params
 8  hierarchy transforms
 9  pseudo-3D projection
10  constraints
11  surface pins
12  soft pins
13  warps
14  shape-key correctives
15  attachments
16  secondary / inertia
17  depth
18  draw order
19  render
```

Stages 1–3 are the mixer (`docs/PARAMETER_MIXER.md`). Stages 4–7 are this
document. Stages 8–19 are `compileRigFrame` and the engine's own loop.

---

## 10. Compatibility

Every project that predates the control rig must produce the identical frame.
That is guaranteed by defaults, not by a migration:

```text
gaze solver          disabled → zero contribution
individual offsets   0
pupil scale          1
links                none
pins                 []
constraints          []
attachments          []
```

A project with no gaze solver keeps `lookX` / `lookY` as the eyes' own control,
and the common gaze target drives them directly — the fallback is the same
control, pointed at a different parameter, rather than a different rig.

Nothing is written into a project until an author changes something: the handle
records stay sparse, the links list stays empty, and improving a default still
reaches every project that already exists.

---

## 11. Where it lives

| File | Holds |
| --- | --- |
| `runtime/gaze-solver.js` | the angular decomposition and the head's lag |
| `runtime/effective-params.js` | raw → solvers → effective |
| `core/rig/gaze-rig.js` | the document side: parameters and settings |
| `core/puppet/puppet-handles.js` | which control drives what, and where it sits |
| `core/puppet/handle-model.js` | resolving a control, and which shape it gets |
| `core/puppet/control-groups.js` | cages, Simple / Detailed, the four modes |
| `core/puppet/control-links.js` | what moves together |
| `ui/rig-controls/` | one module per shape |
| `rig-editor/gaze/` | the panel and its commands |

Tests: `core/tests/gaze-solver.test.js`, `core/tests/face-control-rig.test.js`,
`core/tests/handle-controllers.test.js`, `core/tests/puppet-handles.test.js`.
