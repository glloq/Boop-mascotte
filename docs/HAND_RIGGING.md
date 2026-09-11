# Hand rigging

```text
BODY
 │
 ├─ leftHandAnchor
 │       └─ LEFT HAND  (g)
 │            └─ one static drawing per style, one of them visible
 │
 └─ rightHandAnchor
         └─ RIGHT HAND (g)
```

> **What a hand looks like is a style**, and a style is a whole drawing that
> never deforms: see [hand styles](HAND_STYLES.md). This page is everything
> else — anchors, reach, inertia, mirroring, hiding behind the head, holds and
> the console.

Boop's hands are **floating artwork**, Rayman-style. There are no arms, no
elbows, no wrists, no skeleton and no IK. A hand hangs off an anchor point on
the body: the anchor follows whatever the body does, and the hand keeps its own
local animation on top of that.

That is the roadmap's decision rule in practice — an anchor plus XY, rotation
and a spring gets 80–90 % of the reaching-hand result for a fraction of a
skeleton's machinery.

Implementation: `project/runtime/hands.js`, `project/runtime/inertia.js`,
authoring in `project/editor/core/hands/hand-model.js`, placement and hiding in
`project/editor/core/sample/hand-feature.js`, the drawings in
`project/editor/core/hands/hand-style-art.js` and
`project/editor/core/hands/hand-style-install.js`.

## The record

```js
hands: {
  left: {
    side: 'left',
    element: 'handLeft',        // artwork: one group, holding its drawings
    parent: 'body',             // what the anchor follows
    anchor: { x: -20, y: 40 },  // in the parent's own coordinates
    restOffset: { x: 0, y: 0 },
    reach: { x: 40, y: 30, rotation: 30, scale: 0.2 },
    softness: 0.25,
    depth: 0,
    parameters: { x: 'handLX', y: 'handLY', rotation: 'handLRotation',
                  scale: 'handLScale', depth: 'handLDepth',
                  style: 'handLStyle' },   // only a hand with drawings names it
    styles: { set: 'defaultCartoon', showing: 'relaxed', swap: 'cut',
              pivot: [x, y], library: [{ id, label, element, mirrored }] },
    inertia: { enabled: false, stiffness: 0.25, damping: 0.65,
               maxOvershoot: 0.35, followAmount: 1 }
  },
  right: { … }
}
```

Parameters are normalized `-1…1`; `reach` converts them into user units, degrees
and a scale factor. One idea — "how far this hand can go" — covers translation,
rotation and size.

## Anchors

The reach guide is drawn where the hand *rests*: its anchor, plus whatever
the artwork's own base transform moves it by -- the Character Builder places
a hand by that transform, and the rig adds its movement on top -- so a hand
moved there is where hand mode shows it, and a drag of the anchor maps back
through the same move (`handReachEllipse`, `handAnchorFromPoint`).

The anchor is a point in the body's own coordinates. Each frame the runtime maps
it through the body's **rest** transform and its **current** transform and adds
the difference to the hand:

```text
drift = parentTransform(anchor) − parentRestTransform(anchor)
hand  = rest + localOffset + drift
```

So "the body moves, the anchors move with it" and "the hand keeps its own local
animation" are both true at once, and the anchor follows rotation and scale, not
only translation.

## Reach

```text
((x / reachX)² + (y / reachY)²) ≤ 1
```

The limit is **soft**, not a clamp: outside the ellipse the radius eases towards
`1 + softness` instead of stopping dead, so a cartoon hand can overshoot a
little. `softness: 0` restores a hard limit for anyone who wants one.

`handReachEllipse` returns the guide to draw around the anchor.

## Which drawing a hand shows

One parameter — `handLStyle` — indexes the hand's own library, and that is the
whole of what decides its shape. It is a **choice**: keyframed with `step`
easing, never blended, and never derived from an angle. See
[hand styles](HAND_STYLES.md).

A project written before the refit carries `hand.poses` instead — a parameter
per gesture that deformed six paths. Those records are still read, so the
migration can map each onto the style nearest to it, and the runtime never
deforms a hand for one.

## Mirroring

```js
mirrorHand(hands, 'left', { mirrorX: 100, element: 'handRight',
                            shapeKeys: { 'handLeft-wave': 'handRight-wave' } })
```

Anchors and rest offsets mirror around the artboard centre line, the rotation
range flips sign so a "wave outwards" stays outwards, and poses carry over under
the other side's parameter names with their tables. Shape keys and variants are
only carried when a mapping is supplied, because the mirrored hand usually has
its own artwork. A generated pair draws both sides itself.

## Inertia

```js
velocity += (target - position) * stiffness;
velocity *= damping;
position += velocity;
```

One under-damped follower per parameter — **not** a physics engine. It gives the
small lag, overshoot and settle that make a hand feel alive.

| Setting | Effect |
| --- | --- |
| `stiffness` | how hard it chases the target |
| `damping` | how quickly the swing dies down |
| `maxOvershoot` | hard cap, in parameter units, on how far past the target it may swing |
| `followAmount` | dials the whole effect down without retuning the spring |

The defaults are stable, `enabled: false` makes the group a pass-through, and
`engine.setHandInertiaEnabled(side, false)` switches it off at runtime. Timing
is rescaled from a 60 fps reference and capped at four substeps, so a hidden tab
cannot launch a hand across the screen. Depth is deliberately excluded from
inertia: draw order must not wobble.

The same follower can later serve ears, antennae, simple hair, accessories and a
simple tail. It stops there — see `docs/FUTURE_OUT_OF_SCOPE.md`.

### Coming to rest

Nothing in a hand's carry integrates. `handOffset`, `anchorDrift` and the
soft reach limit are pure functions of the frame they are given, the reveal
lands exactly on the value it was asked for, and a hand whose parameters are
held still is still — to the last bit, for as long as you watch.

A hand that *never* came to rest was measured against the exported mascot, and
the cause was one line away from here: the engine composed the **behaviours
after the live override layer**, so a behaviour won the parameter it drives and
a page calling `mascot.setParameter('handRY', 0)` got Idle hands added straight
back on top, every frame, for ever — while `getParams()` reported the value it
had asked for. `docs/PARAMETER_MIXER.md` declares live control as the *last*
layer and the editor preview always ran it that way; the engine does now too.

Two doors, then, and both of them are parameters: a hand's own movements, and
whatever moves the thing its anchor hangs from. A mascot with Idle head
movement on carries its hands with its head, because that is what an anchor is
for; hold `headY` and the hands hold still with it.

## Drawing a pair

Hand Setup can *give* you a pair rather than only rig one: **✋ Draw a pair of
hands** appends the artwork and rigs it in one undo step. What it appends is
the six static drawings of [the library](HAND_STYLES.md), a group per hand,
placed by `handPlacement` — measured from the body when there is a canvas to
measure with, and in the lower corners when there is not.

Everything it writes is ordinary: a group the runtime already moves, and one
parameter that says which of its children is visible. Nothing about a hand is a
special case afterwards.

The pair also brings two clips — a **Wave** and **Hands up** — and a "Hands
out" expression. Both clips are transforms and a stepped change of drawing;
neither deforms anything.

### Held to the face

Placing a hand is `handLX`, `handLY` and `handLRotation` — three numbers, and
getting all three right for *"a hand on the chin"* is something an author does
by nudging sliders and looking. A **hold** is the same thing as one number.

```text
hand.left.palm ──held on──► face.chin        orient: true
                            offset −20, +38  weight: handLOnChin
```

The machinery is the rig's own (`runtime/rig-attachments.js`,
`docs/FACE_CONTROL_RIG.md` CR-35 … CR-38): a named point on one piece of artwork
put on a named point on another, faded by a parameter, and with `orient` the
held thing takes the anchor's rotation as well as its place. What the runtime
cannot decide is *where* the places are, so the template says: it drew this
face, so it knows where its chin is (`FACE_ANCHORS`, read off the outline rather
than guessed at as fractions of a box).

Basic Face ships five places — chin, both cheeks, mouth, forehead — and eight
holds, one per hand per place:

| Parameter | Puts the hand |
| --- | --- |
| `handLOnChin` / `handROnChin` | under the chin, fingers up — thinking |
| `handLOnCheek` / `handROnCheek` | cupping its own side's cheek |
| `handLOnMouth` / `handROnMouth` | over the mouth — a giggle behind it |
| `handLOnForehead` / `handROnForehead` | on the forehead — a facepalm |

Three things make them work, and each of them is one line:

* **The palm is the pivot.** A hand's attachment point is the middle of its
  palm, which `installStyleHands` has just made its `pivotX`/`pivotY` — so `orient`
  turns the hand about the very point the hold is holding it by, and the two
  never fight.
* **The hand comes to the front.** A hand rests *behind* the head, and
  `handLShow` only lifts it from the `behind` band to `normal` — which is the
  band the face is in and the paint order it was drawn in. A hold that only
  moved it would put a hand on a forehead and hide it there, so each hold
  carries a `depth` keyform of its own over its weight (`0 → 0.6`), past the
  band edge, and the runtime repaints it in front (`docs/DEPTH_PARALLAX.md`).
* **A hold does not show the hand.** Coming out from behind the head and being
  held to a place are two questions, and the motions that use a hold answer
  both: every one of them raises `handLShow` beside the hold's own weight.

The control catalogue reads `handLOnChin` back as *Left hand · On the chin*,
under a **Held to** section of its own, so a panel does not offer it beside the
movements that place the hand.

### Behind the head

A pair drawn by **Draw a pair of hands** rests **behind the head** and comes out
only when something asks for it: a reaction, the Wave, or the page calling
`mascot.showHands()`. Nothing about the hand changes for that — its anchor and
reach are measured at the rest place, as ever — it is one more parameter and
three ordinary keyforms:

```text
handLShow   0 ──────────── 0.7 ────── 1
            tucked behind the head    out, at the rest place
translate   hidden − rest             0        `handLeft-show-x`, `-y`
depth       −1        −1  ──────────  0        `handLeft-show-depth`
scale       0.6       0.88 ────────── 1        `handLeft-show-scaleX`, `-scaleY`
```

`handHiddenPoint` picks the hiding place from the measured body — the lower
half of the head, a little towards the hand's own side. A hiding place is a
*point*, though, and a hand large enough to read beside the mascot is larger
than the gap between that point and the outline: the pair used to rest with its
fingertips showing past the silhouette. So the glove **shrinks as it goes
back**, to `HIDDEN_SCALE` where it hides. It reads as the hand being further
away rather than as a cheat, and it holds for any head, whatever shape it is.
`templates.test.js` asserts it by flattening the head outline and checking
every point of both gloves is inside the polygon at `handShow` 0.

The depth stays at `−1` until the
hand is nearly clear of the head, so the band flips (`docs/DEPTH_PARALLAX.md`)
where nothing overlaps. `evaluateHands` adds the artwork's depth to the hand's
own, which is what lets a keyform on the group sink the hand; the canvas
paints the same order as the exported mascot.

**It travels, it never appears.** The show parameter is an ordinary
parameter, so anything can set it in one frame — a page calling
`setParameter`, a pose chip, a state change, an expression with no blend
span — and a hand that *appeared* at its rest place would look as if it had
never been behind the head. So the runtime and the editor preview both run
`createHandReveal` (`runtime/hands.js`): whatever value is asked for, the
drawn value eases towards it over `HAND_REVEAL_SECONDS` (0.45 s, ease in and
out) from wherever the hand is, and a hand sent back halfway out turns round
from there. The engine steps it in its tick after the cartoon lag; the preview
steps it with the frame delta and keeps its loop awake while a hand is on its
way. A parameter that is already animated — the Wave's own track — is followed
with the same lag, which only makes its slide a beat longer.

On the canvas, the parameter has a **slider of its own beside the face**, on
the hand's own side, running downwards: slide it down and the hand comes down
from under the head. While the pair is hidden it is the only hand control drawn
at all — see "The console" below and `docs/DIRECT_CONTROLS.md`.

What raises the parameter:

* the **"Hands out" expression** (`hands-out`, both show parameters at 1),
  written with the pair — a reaction picks it like any expression, the
  Expressions panel lists it, and `mascot.setExpression('hands-out')` is what
  `mascot.showHands()` does when the rig has it (`{ duration, easing }` ramp
  it; `{ side }` limits a rig without the expression to one hand);
* **any expression that uses the hands**: every preset in the catalogue
  carries what its face does with its hands (`hands` in
  `expression-presets.js` — out and up and spread for *Surprised*, fists for
  *Angry*, a hand to the chin for *Thinking*, thumbs up for *Proud*…), taken
  in when the project has the controls and never reported missing when it
  does not; the show parameter is among them, so the face brings the hands
  out with it;
* the **Wave** and **Hands up** clips the pair comes with, whose show tracks
  bring the hands out at the start and send them back at the end, so a
  reaction that plays one needs nothing else — a track for a movement the
  mascot does not have (the cheer's head bounce) is left out at install;
* a reaction's **gesture** (`gestures: [{ side, pose }]`): the runtime raises
  the hand's show parameter with the pose, over the reaction's own envelope,
  so the hand comes out for its thumbs up and goes back with it; the reaction
  presets name a drawn pair's own poses first (*Cheer* → Hands up and thumbs
  up, *Surprise* → spread, *Grumble* → a fist, *Ponder* → a hand to the chin),
  and a project with no hands is never asked to draw some for a reaction's
  sake;
* **Hand Setup** itself: a hand that rests behind the head comes out while it
  is posed there — a pose chip, a View chip, a finger slider, a capture, or
  opening the card raises its show parameter with the pose — so the author
  sees the gesture and not the back of a head.

The tick **Rests behind the head, out on request** is on every hand's card;
untick it and the parameter, the keyforms and the hand's share of the
expression go, and the hand rests in the open as before (one undo step). A
hand of the author's own artwork can be tucked the same way: the hiding place
is measured from the body it hangs from. `installHands(state, { hidden: false })`
draws a pair that rests in the open.

### Which way a hand hangs, and where

The drawings are made with the fingers up and the wrist below, which is the one
orientation a hand beside a mascot never has. Half a turn fixes both at once:
fingers down, and the thumb carried across to the inner edge — thumbs towards
the middle, which is what makes a pair read as a pair rather than as two left
hands. `HAND_REST_TILT` is 180° ± 20 so they fan outwards instead of hanging
parallel like a doll's, and it is an ordinary `baseTransform.rotation` on the
group, so the reach adds to it and every drawing inside is carried by it.

**Adding hands adds room — measured from the mascot (VNX-20), not from the
artboard.** A face drawn to fill its artboard leaves nowhere below it, so the
pair landed across the chin. `handsArtboard` grows the artboard by exactly the
room the pair needs in the same undo step, the hands hang in the new band, the
reach is a share of the mascot's own size with a **full half-turn** of rotation,
and the hand is the mascot's size rather than the artboard's. A hand is grabbed
by its **wrist** on the canvas — a fixed point on every drawing, so the grip
does not move when the drawing does — leaving the anchor at the middle of its
palm free for hand mode.

### The console

Everything an author does to a hand on the canvas is laid out on a dial around
it, from the reach the hand already has (`core/puppet/hand-console.js`):

```text
                 ╭─────────╮
            ◆─┤     ✋    ├─◆         the turn, round the ring the hand
      ▲       ╰─────────╯             already reaches inside
      │            ▬▬▬▬▬              how far forward it is painted
      ▼                               ◀ beside the face: how far out it is
      ▣ ▣ ▣ ▣ ▣ ▣                     and which drawing it shows
```

There is nothing on the ring for a finger, a curl, a grip or an angle: a hand
is a whole drawing, and which drawing is picked from the column beside the face
(`core/puppet/hand-picker.js`) rather than slid. The **turn** takes the ring
instead — a turn dragged around a ring is the turn itself rather than a line
that stands for one — and shares it with the **holds** when a hand has any, so
the two are never drawn over each other.

The holds are offered to **every** hand that has them. They used to be kept from
a hand with drawings of its own — four sliders that each put the palm on a named
spot of the face looked like four ways to do what dragging the hand does in one
— and that had it backwards: a hold is *one* number for a place that takes three
to find by dragging, and the drawn pair is the recommended hand, so the rule
left the recommended hand as the only one that could not do it (V3-11).

Both hands get the same console, mirrored about the mascot's own middle -- but
a control turns the same way round the ring on both. The mirror decides where a
slider is, never which way it goes; a control that closed one hand and opened
the other for the same gesture would be a control nobody could learn.

The geometry is pure and the canvas only draws it: `handConsoleLayout` places
the slots, `handTrackPoint` says where a value puts a knob, `handTrackDirection`
and `handTrackLength` turn a drag along the track into a value, and
`handTrackPath` is the line drawn under it. `hand-console.test.js` checks the
lot as geometry — on the ring, in order, never overlapping, mirrored, and
reversible.

While `handShow` is at rest the console is not drawn: every one of its sliders
carries the condition `handLShow > 0.05`, and the way out beside the face is
the one control that carries none.

## Setup workflow

```text
Select artwork → Place anchor → Give it drawings → Adjust reach → Test
```

`project/editor/rig-editor/hands/hand-setup-panel.js` walks exactly those steps
and always says **what to do next**, not only what is wrong:

> Choose the artwork that draws this hand.
> Choose the body part the hand hangs from.
> Place the anchor point on the body.
> Give it drawings, so it has a style to show. A drawn pair rests behind the
> head: a reaction, the Wave or `mascot.showHands()` brings it out ("Behind the
> head" above).
> Ready. Put it somewhere, below.

**The last step is a control, not a signpost.** It used to read *"Ready. Test it
from Preview"* — and Preview had nothing for a hand in it: its movement
checklist is the *face* parts, and `leftHand` declares no controls, so no hand
parameter ever reached that panel (V3-11). The card ends in **Where it goes**
instead: the hand's own named places, and the places it can be held to, one
press each, from the same `handPosePresets` the Preview bench now uses
(`docs/DIRECT_CONTROLS.md`). **Hand style** is beside it, in the same basic
tier, showing either the drawings this hand holds or the offer to give it some
— a hand with none used to be offered them three disclosures down under
*Advanced*, which is not where anybody looks for a hand's shape. A hand drawn as
a single shape is **given a group** and then its drawings, in one undo step,
rather than turned away with "group this artwork first".

Assigning a hand creates the parameters it needs in the same undo step: a hand
that exists but cannot be moved would be a trap. Mirroring does the same for
the other side — its **placement**, never its drawings: the two hands hold their
own libraries and choose from them independently. Selecting a hand on the canvas
opens hand mode for it.

## Diagnostics

Missing artwork, an anchor pointing at a deleted body part, a reach of zero, a
drawing whose artwork is gone, a hand resting on a drawing it does not have, a
movement parameter that no longer exists, and inertia settings that would never
settle — all reported in the author's language, in the `hands` validation
domain.

## Tests

`hands.test.js` covers assignment per side, independence of the two hands, body
movement moving the anchors while local movement survives, anchors following
rotation and scale, rotation and scale ranges, reach mapping, soft limits and
the diagonal case, showing exactly one drawing and never deforming it,
mirroring, spring lag/overshoot/settling, the overshoot cap, long stalls,
switchability, `followAmount`, snapshots, export and diagnostics.
`hand-style-art.test.js` covers the six drawings, their shared pivot and radius,
the mirror and the shipped files; `hand-style-runtime.test.js` the frame — a
style sequence, a whole gesture, two independent hands and a hidden swap;
`hand-style-install.test.js` the install and the migration off an old save;
`hand-feature.test.js` the placement, the look and the reveal from behind the
head; `hands.test.js` also holds the headline one — *a hand left alone reaches a
resting position and stays there*, driven through the exported engine the way a
page drives it. `hand-style-panel.test.js` and `hand-setup-panel.test.js` the
panel, `preview-hands.test.js` the bench;
`hand-placement.test.js`, `hand-mode.test.js`, `hand-handles.test.js` and
`hand-picker.test.js` the placement, hand mode, the handles and the picker.
`tests/e2e/ux32-hands.spec.js` draws the pair in a browser and works it.
