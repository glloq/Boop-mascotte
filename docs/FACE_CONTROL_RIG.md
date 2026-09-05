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
`eyelids`, `eyeTargets`, `pupils`, `brows` and `mouthCorners`
(`core/puppet/control-links.js`) — **every** pair of sides in the rig, linked
the same way, including the mouth corners and the eyebrow ends, which are pins
rather than bindings and obey the rule regardless. One link covers every
movement of the pair it names: `brows` links the raise, the tilt and both ends,
because "the brows move together" is one sentence and not four switches.

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
   ◇────●────◇                   ◇────●────◇
 outer     inner               inner     outer
      left brow                     right brow
```

One controller per brow, the way a 3D facial rig has one: the centre moves it,
the arc turns it. `browRaiseLeft` / `browRaiseRight` were already there;
`browTiltLeft` / `browTiltRight` complete the pair, so a single raised, turned
brow is one control rather than an accident of two shared ones.

That much is still a **rigid bar hinged in the middle**, and half of what
eyebrows do is not available to it. Worry is the inner ends going up while the
outer ends stay put. Anger is the inner ends going down. Neither is a rotation
and neither is a translation: they are *the two ends of one brow disagreeing* —
the same sentence the mouth's two corners ask, and it gets the same answer.
Each end is a **directional pin** on the drawn brow (§9), so the artwork between
them follows a little and the far end does not follow at all. A raised end whose
middle stayed exactly put reads as a kink rather than an eyebrow.

Only two pins, not three. A centre pin would hold what the raise and the tilt
already move, and a pin that fights a binding is a rig nobody can predict.

Each end is a shared movement plus a side offset, like every other pair of sides
in this rig (§5): `browInner` lifts both inner ends — worry, with one number —
and `browInnerLeft` lifts one of them. The two are summed inside the pin's own
expression, which is the one place that can see both. Linking the brows (§5)
covers all four movements at once, because "the brows move together" is one
sentence and not four switches.

The end controls are **detailed**: a face carrying two brow controls is a face an
author can pose, and one carrying six is one they have to read. Each is grabbed
where it is drawn, so "inner" is the right-hand end of the left brow and the
left-hand end of the right one — and the tilt arc moved above the brow, because
the two places beside a brow are now controls of their own.

---

## 9. Pins

```text
         .
      .  ●  .        a soft pin: the artwork inside its reach follows,
         .           less and less the further out it is

   ◇━━━━━━━━━━━▶     a directional pin: it may only move along its own axis
```

Everything the rig could do to a shape moved *all of it*: a transform slides
the whole mouth, a shape key swaps the whole outline, a warp pushes a rectangle
of space. None of those can say "this corner of the mouth, and the artwork near
it", which is the sentence a facial rig is made of.

A pin has a position, a reach and a softness, and the weights fall out of those
three numbers. The reach is an **ellipse**, not a circle: a mouth is ten times
wider than it is tall, and a circular reach that covers its corners also covers
its upper lip. The panel therefore edits the two axes separately — one number
written as a circle would silently flatten the shallow reach the mouth's
corners and the brows' ends are built on, and the author would only find out on
the canvas.

```text
distance vertex → pin  →  falloff  →  weight  →  normalise  →  Σ ≤ 1
```

**There is no weight painting.** Overlapping pins share a point rather than
moving it twice; a point outside every reach stays exactly where it was drawn,
which is what makes this a face rig and not a skin.

| Kind | Holds | For |
| --- | --- | --- |
| `hard` | its reach, rigidly | a jaw hinge |
| `soft` | its reach, fading outwards | a cheek, a mouth corner |
| `directional` | only the movement along its axis | a brow that may only raise |
| `slide` | the whole movement, re-aimed along its axis | a corner riding a lip line |
| `surface` | a point on the head's logical surface | a feature that turns with the head |

### The reach is an ellipse

A circular reach is the wrong shape for most of a face. A mouth is sixty units
wide and six tall, so *any* circle that covers its corners also covers its
upper lip — and a jaw that dropped took the whole mouth with it. A radius may
be `{ x, y }`, and the distance is measured in units of it. A plain number
still means the circle it always meant.

### Surface pins

An outline that only shifts and narrows is a card being turned. A surface pin
carries `(u, v, virtualZ)` on the head's own volume, and what is baked is what
that point does **beyond what its element already does to it** — so the near
cheek comes round while the far one compresses, and the chin swings.

Sampled over the head-pose grid at authoring time and read back by the same
bilinear interpolation the head pose uses. The projector is trigonometry and
never runs per frame.

### On the canvas

A pin is a place on artwork, so it is placed and dragged there: a `◇` handle
with its reach drawn beside it, one command per drag. It says what it is
holding — "a soft pin holding 4 points" — because a pin holding none is a pin
in the wrong place, and a dot cannot say that on its own.

---

## 10. Constraints

A binding says *this parameter moves that element*. A constraint says what a
binding cannot: **this element must stay in a relationship to that one**,
whatever moved either of them.

```text
 parent        copy where that one is
 distance      stay this far from it
 orientation   face the same way it does
 axis          only move along this line
 limit         never go past here
 slide         follow it, but only along this line
```

Solved in the order they are listed, each reading the frame as it stands — the
same rule the mixer uses, and for the same reason: an order an author can read
beats an order that emerges. One pass, no relaxation, nothing that can
oscillate, no physics.

Each carries an influence, and each may be faded by a parameter — which is what
makes a constraint something an animator keys rather than a switch somebody
flipped while rigging. The parameter is created with it and rests **fully on**,
because a relationship an author has just written is one they mean; a hold's
contact rests at 0 for the opposite reason, a hand that snapped to a cheek the
moment the hold existed would jump.

They are authored in the same panel as the pins and the holds, and a row shows
the fields **its own kind** is set by and no others: a distance has a distance,
an axis has a line, a limit has bounds, a follow has what it copies. A panel
that shows every field of every kind is a panel where the two that matter are
invisible. A limit an author leaves blank is *no limit* rather than a limit of
nothing — the same `null`, and the same trap, as the normalizer's.

The list can be reordered, and that is not a convenience: they are solved top
to bottom, each reading the frame as the ones above it left it, so "follow the
head, then never go past here" and "never go past here, then follow the head"
are different rigs and only the order says which.

---

## 11. Holding

```text
  Approach   ──▶   CONTACT   ──▶   Hold   ──▶   Release
  hold 0            hold 1         hold 1        hold 0
```

A hand touching a cheek exposes every shortcut in a rig: the hand is placed by
its own controls, the cheek is moved by a turn, a pin and a warp, and the two
have no idea about each other.

An **attachment point** is a named place — `face.cheek.left`,
`hand.left.indexTip` — resolved from where the artwork *ended up*, after the
pins deformed it and after its transform was applied. A **hold** puts one on
another.

The points a face and a pair of hands are usually held by are proposed from the
parts the project already has, and every one of them is a *starting place*
rather than a decision: a cheek is a fraction of the way across a head, and the
fraction that is right for one mascot is wrong for the next, so a point can be
moved. A mascot with a snout, a tail or a hat has places no list could have
guessed, so it can name its own — at the middle of the artwork it is on, which
is a place the editor can find and the author can move it from. Nothing is
generated behind an author's back: a rig full of points nobody chose is a rig
nobody can read.

Space switching and hold-and-release are the same mechanism rather than two.
The hold's weight is an ordinary parameter, and both ends of the blend are
computed every frame, so 0 → 1 is a straight line between two things that are
each true right now:

```text
0 %    where the hand's own controls put it       (world)
50 %   halfway — no jump: both ends are live
100 %  exactly on the cheek                       (head space)
```

There is no second positioning system and no space hierarchy to keep in sync.

The weight is created with the hold and named after the two points it joins —
`contactIndexTipNose` — so an author has something to key the moment the hold
exists. It appears on the timeline under **Holding**, as "Contact · index tip
nose": the row a shot with a hand on a cheek is actually built from, and the
one place approach, contact, hold and release are four keys rather than four
ideas.

Holds run **last**, after the deformation, because "where did the cheek end up"
is only a question with an answer at that point.

---

## 12. The mouth

```text
      ╭────────────────────╮
      │ ◇──────●──────◇    │   corners, centre
      ╰────────◆───────────╯
               │
              JAW
```

`smile` is one number, and a face that can only smile symmetrically has one
expression where it should have a dozen. Every smirk, grimace and lip pulled by
a word is *the two corners disagreeing*.

The eyes solved this with side offsets on their bindings, because an eye is two
pieces of artwork. A mouth is one closed path, so its corners are two **pins**
on the same shape: `smile` moves both through the shape key, and each corner's
own offset moves that corner alone. The two compose because they are offsets on
the same numeric vector.

**Mouth lock** is the other half of a talking mouth. A jaw that drops takes the
lower lip with it, which is right for a yawn and wrong for tension, for
anticipation, and for every line delivered through closed teeth. `mouthLock`
lives inside the lower lip's own pin expression, so nothing else has to know.

The tongue is a part of its own — `tongueX`, `tongueY`, `tongueOut`,
`tongueCurl` — because the mouth's `tongue` control answers a different
question (whether it shows).

---

## 13. Hands

A hand reaching for a place gets a **target**, like a gaze, and both hands'
controls belong to the Hands cage.

Two things the roadmap asks for are already true of this rig, and are recorded
here rather than rebuilt:

- **A finger's joints are distributed from one curl.** `digitGeometry` turns
  and shortens the drawn finger from a single number, so an author has one
  control per finger and the joints live in the drawing
  (`core/sample/hand-artwork.js`).
- **The grip closes each digit by its own coefficient** — the thumb less than
  the fingers (`HAND_GRIP_CURL`).

What a fingertip needed was not a pin but a **name**, so it can hold something:
`hand.left.indexTip` comes from the same function that draws the finger.

---

## 14. Evaluation order

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

## 15. Compatibility

Every project that predates the control rig must produce the identical frame.
That is guaranteed by defaults, not by a migration:

```text
gaze solver          disabled → zero contribution
individual offsets   0
pupil scale          1
mouth corners        0
mouth lock           0
links                none
pins                 []
constraints          []
attachments          []
holds                []
```

Proved rather than promised: `control-rig-order.test.js` compiles the same
frame from the same rig with and without every block the control rig added, and
fails on any difference. It also checks that normalizing twice is normalizing
once — a saved project is normalized on the way out, on the way in and by the
runtime, and a normalizer that cannot read its own output silently loses what
it rewrote.

A project with no gaze solver keeps `lookX` / `lookY` as the eyes' own control,
and the common gaze target drives them directly — the fallback is the same
control, pointed at a different parameter, rather than a different rig.

Nothing is written into a project until an author changes something: the handle
records stay sparse, the links list stays empty, and improving a default still
reaches every project that already exists.

---

## 16. Where it lives

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
| `runtime/rig-pins.js` | holding artwork by a point, and the weights |
| `runtime/rig-constraints.js` | the relationships the rig keeps true |
| `runtime/rig-attachments.js` | named points, and one thing holding another |
| `core/rig/pin-model.js` | placing and configuring a pin |
| `core/rig/constraint-model.js` | writing a relationship, and its order |
| `core/rig/surface-pins.js` | the head's silhouette, baked from the projector |
| `core/rig/mouth-rig.js` | two corners, a lower lip and the lock |
| `core/rig/brow-rig.js` | the two ends of each eyebrow |
| `core/rig/attachment-model.js` | which points a project can offer |
| `rig-editor/gaze/` | the gaze panel and its commands |
| `rig-editor/holding/` | pins, points and holds |

Tests: `core/tests/gaze-solver.test.js`, `core/tests/face-control-rig.test.js`,
`core/tests/rig-pins.test.js`, `core/tests/rig-constraints.test.js`,
`core/tests/mouth-rig.test.js`, `core/tests/brow-rig.test.js`,
`core/tests/rig-constraint-authoring.test.js`,
`core/tests/control-rig-order.test.js`,
`core/tests/handle-controllers.test.js`, `core/tests/puppet-handles.test.js`.
