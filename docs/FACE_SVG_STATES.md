# The states an eye and a mouth can be in

A cartoon eye has to be able to be open, half open, shut, narrowed, squeezed
happily shut, and tired. A cartoon mouth has to be able to be shut, open,
smiling, puckered, stretched, and saying eight different things. The obvious way
to get there is a drawing each:

```text
eye-neutral.svg   eye-happy.svg   eye-angry.svg   eye-closed.svg
eye-look-left.svg eye-look-right.svg
mouth-A.svg  mouth-E.svg  mouth-O.svg  mouth-smile.svg  mouth-angry.svg
```

That is eleven files for one face, and it is the wrong architecture for three
reasons that all bite at once. It cannot **compose** — `happy` and `look left`
are two files and there is no third for both. It cannot **interpolate** — going
from `A` to `O` means swapping one file for another, which is a pop. And it
cannot be **maintained** — a change to the line weight is eleven edits, and the
twelfth file somebody adds is the one that gets forgotten.

So there is one set of artwork, and a state is **data**: a handful of values for
movements the face already has, plus an optional corrective where the movements
cannot hold a shape on their own.

```text
 one drawing  +  semantic controls  +  optional corrective  =  every state
```

This document is the contract. Where a rule is enforced by a test, the test is
named; `core/tests/face-states.test.js` carries the numbered list.

---

## 1. Four levels, and which one a thing belongs to

| Level | What it is | Where it lives |
| --- | --- | --- |
| **Asset** | the neutral geometry the author drew | `svgMarkup`, `elements[*].restPath` |
| **Semantic control** | `eyeOpen`, `lookX`, `mouthOpen`, `smile` | `rig.params`, driven by the semantic parts |
| **State / preset** | `closed`, `happyClosed`, `AE`, `OO` | `core/face-library/face-states.js` |
| **Corrective** | a local shape fix where the controls are not enough | `rig.shapeKeys`, marked `faceState` |

The rule that decides where something goes is: **a state is a set of control
values, and nothing else, until it visibly is not**. Only then does it earn a
corrective, and the corrective is an addition rather than a replacement.

---

## 2. The eyes

### 2.1 What the artwork is

An eye is a group of roles, and the registry's own:

```text
leftEye / rightEye     the socket, the white, the rim  (semantic part `eyes`)
leftPupil / rightPupil the pupil                       (semantic part `gaze`)
leftUpper  / leftLower  the two lids                   (semantic part `eyelids`)
rightUpper / rightLower
```

Nothing here imposes a number of paths. A mascot whose eye is one shape has an
`eyes` part and no `eyelids` part; it keeps `eyeOpen` and loses the two lid
axes, which is the same graceful loss a simple mouth takes for `teeth`.

### 2.2 The controls

`eyeOpen`, `lookX`, `lookY` and `pupilScale` are unchanged, and they stay the
**structural** layer. Two axes are new, and both are the *lids'* rather than the
eyes':

| Control | Range | Rests at | Why it is not `eyeOpen` |
| --- | --- | --- | --- |
| `eyeSquint` | 0 … 1 | 0 | a narrowed eye is the **lower** lid coming up nearly three times as far as the upper comes down; a half-shut one is both lids meeting in the middle. `eyeOpen` cannot say the asymmetry, and a rig that tried would read *suspicious* as *sleepy* |
| `eyeCurve` | −1 … 1 | 0 | **which** shut eye. `eyeOpen 0` is a shut eye whatever the curve; the curve says whether the seam arcs up (a happy squeeze), lies flat, or droops (tired). Without it, `closed` and `happyClosed` are the same numbers and only one of them can exist |

Both are shaped rather than transformed, because `translateY` on a lid is
spoken for by the blink and a squint that slid the whole lid would be a blink
under another name. Both are **sided**, through the mechanism the wink already
uses: the shape key's driver reads `eyeSquint + eyeSquintLeft`, exactly as a
binding reads `eyeOpen + eyeOpenLeft` (docs/FACE_CONTROL_RIG.md §5).

Three sliders, not ten. There is deliberately no `eyeHappy`, no `eyeAngry` and
no `eyeSleepy`: an emotion is not an axis, and a face with one slider per mood
cannot be in two moods at once.

### 2.3 The eight states

```text
             eyeOpen  eyeSquint  eyeCurve   also
 neutral        1         0          0
 wide           1         0          0      pupilScale 1.4
 halfOpen      .5         0          0
 closed         0         0          0
 squint        .45       .85         0
 happyClosed    0         0         +1
 tired         .38       .3        −.65
 suspicious    .5        .7        −.25     browRaise −0.4
```

Eight distinct *drawn* eyes from one pair of lids, which is asserted rather than
claimed: the test poses all eight and fails if any two come out identical.

### 2.4 The gaze is orthogonal

**No state names a gaze parameter, and none ever will.** `lookX` / `lookY` aim
the pupils and the states shape the lids, so every combination is a composition
rather than something somebody has to author:

```text
happy + look left        works
angry + look up          works
halfOpen + look right    works
```

A state that encoded a direction would be the eleven-files problem again, one
level up.

### 2.5 Blink and wink

The sided mechanism is untouched. `eyeOpen` closes both eyes because one
parameter drives every role that carries it; `eyeOpenLeft` closes one. A state
applied to one side is written as **that side's offset**, computed from the
shared control's own rest:

```text
eyePoseValues(doc, 'closed')          → { eyeOpen: 0, eyeSquint: 0, eyeCurve: 0 }
eyePoseValues(doc, 'closed', 'left')  → { eyeOpenLeft: −1, eyeSquintLeft: 0, eyeCurveLeft: 0 }
```

So a wink *is* a state on one side, and it composes with a gaze and with an
expression because it is three numbers rather than a pose.

`eyeOpen` was deliberately **not** replaced by a global shape key. A shape key
has one weight and the lids have two sides; swapping the structural closure for
one would have taken the wink with it.

---

## 3. The mouth

### 3.1 What the artwork is

```text
mouth         the lips — required, and the only required one
cavity        the inside, when the artwork draws it separately
teeth         the upper row                            optional
teethLower    the lower row                            optional  (V6)
tongue        the body of it, inside the cavity        optional
tongueTip     the part that laps over the lower lip    optional  (V6)
tongueGroove  the crease down the middle of that part  optional  (V6)
```

A mascot whose mouth is a single stroked line works: it opens, smiles and
widens by moving as a whole. Everything inside the lips is optional, and what
the optional pieces buy is that the 2.5D turn carries them with the lip line
and that Teeth and Tongue become movements like any other.

The three V6 added are **roles and not movements**: the lower row shows on the
same `teeth` control as the upper one, and the tip and its crease come out on
the tongue part's own `tongueOut`. A mouth that draws none of them behaves
exactly as it did, which is every mouth in every project written before V6
(docs/MOUTH_BUILD.md).

### 3.2 Closed to open, without a pop

The template's mouth is **one closed path** whose four control points are
affine in every control it has:

```text
mouthOpen 0        ────────         a lens a few units tall
mouthOpen > 0      ╭──────╮
                   ╰──────╯         the fill is the cavity, the stroke the lips
```

Because it is one path and every deformation is an additive shape key, there is
no swap, no fade and no return to neutral anywhere between the two. Everything
inside is drawn **from the mouth's own curves**, so it cannot leave them; at rest
each is a closed path whose second half retraces its first exactly, enclosing
nothing, so closed lips have nothing behind them to hide by construction rather
than by arithmetic.

Since V6 the template also **clips** the insides to the aperture. That is belt to
the geometry's braces rather than a second mechanism: the shapes stay inside by
construction, but `tongueX` and `tongueY` translate the tongue, `mouthWidth`
scales the rows, and a warp or a pin can reach any of them. The clip is one
`<use>` of `#mouth`, which *is* the shape of the hole, so it follows every pose
with nothing to keep in step. The tongue's **tip** is outside it on purpose, and
is the only thing that is: a tongue hanging out lies over the lower lip.

### 3.3 `mouthRound`

One new control, 0 … 1, resting at 0.

`mouthWidth` narrows a mouth by **scaling** it, which turns a wide shallow lens
into a *small* wide shallow lens. An `OO` is the opposite of shallow. What
rounds a mouth is the corners coming in while the lip line bows out above and
below them, and no combination of opening and narrowing says that. It is the
whole axis between `AE` and `OO`, and it is the only mouth control added.

### 3.4 `mouthSkew` (V6)

One more control, −1 … 1, resting at 0, and signed.

The rig has had asymmetric **corners** since CR-28 — two pins, one per end of the
lip line (docs/FACE_CONTROL_RIG.md §12). What they cannot do is take the lip line
between them with them: a pin moves the artwork near it and lets go, so pulling
one corner up leaves the curve where it was. A smirk is the whole mouth
**leaning**, which is a shape: one corner up, the other down by as much, and the
lip line following them. Lifting both would be half a smile.

### 3.5 What a library mouth can say

A face part declares its `capabilities`, and a drawing that cannot pucker does
not claim `mouthRound`. Installing such a mouth over a face that had it turns
the movement **off** and keeps the parameter — the same thing that already
happens to `teeth` on a mouth with none. The visemes then resolve without it
and report it as missing, which is a slightly less round `OO` rather than no
`OO` at all.

---

## 4. Correctives

A corrective is **an additive shape key and nothing else**: the same record, the
same driver, the same stage of the pipeline (evaluation order 14,
docs/FACE_CONTROL_RIG.md §14). There is no corrective engine.

```text
eyeOpen 0              already a shut eye, geometrically
   + closed 1          the arc that makes it a *nice* shut eye
```

### 4.1 A slot is a sentence about the controls

The obvious design is one corrective per named state. It does not work: a viseme
reaches the rig as *weighted deltas on the mouth's own movements*
(docs/VISEME_SYSTEM.md), so by the time the artwork is posed there is no "how
much `AE`" left to read — and a parameter per viseme would be nine new movements
to buy what the mouth already says.

So a slot carries an **activation sentence** over the semantic controls and
corrects the geometry of *that combination*, however it was reached. A mouth
puckered by `OO` and one puckered by hand get the same correction because they
are the same mouth.

| Eye slot | Sentence | Corrects |
| --- | --- | --- |
| `closed` | `1 - eyeOpen` | the shut seam |
| `squint` | `eyeSquint` | the narrowed lid |
| `curve` | `eyeCurve` | the lid's arc — signed |
| `closedCurve` | `eyeCurve * (1 - eyeOpen)` | the arc of a *shut* eye |
| `wide` | `pupilScale - 1` | the lids pulled back as the pupils dilate |

| Mouth slot | Sentence | Reached by |
| --- | --- | --- |
| `open` | `mouthOpen` | `AE`, `OH`, `L` |
| `round` | `mouthRound` | `OO`, `OH`, `WQ` |
| `smile` | `smile` | a grin, a grimace — signed |
| `wide` | `mouthWidth` | `EE` — signed |
| `openRound` | `mouthOpen * mouthRound` | `OH` |
| `openWide` | `mouthOpen * mouthWidth` | `AE`, `EE` |
| `skew` | `mouthSkew` | a smirk — signed (V6) |
| `openSmile` | `mouthOpen * smile` | a grin (V6) |
| `smileWide` | `smile * mouthWidth` | a grin stretched across the face (V6) |
| `lock` | `mouthLock` | `MBP` |
| `lipTeeth` | `teeth - teeth * mouthOpen` | `FV` |
| `tongueTeeth` | `0 - tongue * tongueY` | `L` |
| `tongueOut` | `mouthOpen * tongue * tongueOut` | a tongue out of an **open** mouth (V6) |

The four V6 added are the pairs the arithmetic is least kind to rather than
pairs somebody listed. `openSmile` is the combination a mouth is asked for more
than any other: `mouthOpen` drops the lower lip sixty-two units while `smile`
lifts the corners and deepens the lip line, and added they draw an aperture that
is correct and, at the top of the range, wider across the corners than a face
actually opens. `smileWide` is the other pair that fights — `mouthWidth` is a
`scaleX`, and a scale applied to a curve a smile has already bowed flattens the
bow. And `tongueOut` tells a laugh from a blep: the tip needs no open mouth to
come out (docs/MOUTH_BUILD.md), so a tongue between the lips and a tongue over a
lower lip that has dropped away from it are genuinely two drawings.

Each sentence is a **distinct monomial** in the controls, so two correctives can
never double-count the same shape: `closed` is linear in `eyeOpen` and
`closedCurve` is the cross-term, and a face carrying both is corrected once. A
signed slot serves both directions from one capture, which is what the
template's own Smile and Frown keys already do.

The named states map onto combinations: `happyClosed` is `closed` + `closedCurve`,
`tired` is `squint` + a negative `curve`.

### 4.2 Optional, and free

Every sentence is 0 at rest. A project with no corrective renders identically to
one that has never heard of them — which is a property of the arithmetic rather
than of a migration. The template ships **none**: a corrective is authored,
never generated.

### 4.3 Topology

A corrective is a delta against the element's rest outline, so the two have to
share a command layout. The capture compares them and **refuses** before
touching the project:

```text
Corrective geometry is incompatible with the base path topology.
Move the existing points instead of adding or removing any, then capture again.
```

A refused capture costs no undo step and never rewrites the base `d`. The canvas
gives the author a **morph pose** — node handles on one path with its topology
locked — which is the same bargain the head pose makes (docs/HEAD_POSE_2_5D.md)
and for the same reason: an author who added a point would strand every
corrective already measured against the old count. There is deliberately no
path-normalizing converter; that is out of scope and would be a second SVG
engine.

---

## 5. Authoring

**Rig ▸ Controls → Face states**, beside Movements, because a state is made of
the movements listed above it. There is no wizard and no builder.

```text
 EYES     left ⟷ right      neutral · wide · half · closed · squint · …
          correctives       closed ▓▓▓░  narrowed ░░░░  curve ▓░░░

 MOUTH    visemes           REST · MBP · FV · AE · EE · OH · OO · L
          together          Happy + AE at 0.65
          correctives       open ▓▓▓░  round ░░░░  …
```

A state chip writes **live preview values** and authors nothing: posing the
mascot is what Auto Key is for, and the panel hands its values to the same
`applyPose` every other rig panel uses. Only *Shape it*, the weight slider and
*Forget* touch the project.

### The distinction the panel is built around

```text
 EDIT BASE        changes the neutral drawing      → the SVG editor
 EDIT CORRECTIVE  records a difference from it     → this panel
```

It is said in as many words on the panel, because a tool that silently edits the
neutral face is a tool an author cannot trust.

A corrective row shows how strongly the pose on screen is asking for its slot
(`▓▓▓░ 0.85`), so the lit rows are the ones this face is using rather than nine
sentences to work through. *Copy to the other eye* copies the delta as it is,
for two lids drawn as mirror images; *Copy, reflected* turns the sideways
component around, for two drawn from one shape slid across the face.

---

## 6. The format

Everything added is an **optional field in a structure that already existed**.
No new root, no migration.

### A corrective

```json
{
  "id": "faceState:eye:closed:left:lidUpperLeft",
  "target": "lidUpperLeft",
  "name": "Closed · left",
  "driver": { "mode": "expression", "expression": "1 - eyeOpen - eyeOpenLeft",
              "curve": "linear", "amplitude": 1, "offset": 0 },
  "faceState": { "kind": "eye", "slot": "closed", "side": "left" },
  "delta": [0, 0, 0, 0, 0, 0, 0, -11, 0, 0]
}
```

An ordinary `rig.shapeKeys` entry. `faceState` is the only new field, it is
editor metadata (a frame never reads it — the driver expression is the whole of
what a corrective does), and it is absent on every shape key written before it.
`amplitude` is the weight, 0 … 1.

The id is `faceState:<kind>:<slot>[:<side>]:<target>`, prefixed and
colon-separated like the head pose's own generated keyforms, so a corrective is
findable by name and can never collide with a shape key an author made.

### A viseme

An expression record with one extra field. See docs/VISEME_SYSTEM.md §4.

### Fallback for an older project

| Absent | Reads as |
| --- | --- |
| `faceState` on a shape key | an ordinary shape key, as before |
| `viseme` on an expression | an ordinary face |
| `eyeSquint` / `eyeCurve` / `mouthRound` | not a parameter of that rig; every sentence naming one reads 0 |
| every corrective | the state is the plain composition of its controls |

Proved rather than promised: `project-roundtrip.test.js` renders two frozen
project files — one of them reduced to what the first format could express — and
compares a digest of every frame.

---

## 7. Where it lives

| File | Holds |
| --- | --- |
| `core/face-library/face-states.js` | the eight eye states, the nine visemes, and how a state resolves against a project |
| `core/face-library/face-correctives.js` | the corrective slots, their sentences, and the authoring operations |
| `core/face-library/face-state-install.js` | giving a mouth the speech shapes |
| `core/face-library/face-state-commands.js` | the same, as undoable commands |
| `core/face-library/face-state-model.js` | what the panel shows, as data |
| `rig-editor/semantic-parts/face-states-panel.js` | the panel |
| `runtime/visemes.js` | the speech vocabulary and the naming rule |
| `core/sample/templates/face-artwork.js` | `lidPath`, and `mouthGeometry`'s pucker |
| `core/puppet/part-poses.js` | the eye states as pose chips |

Tests: `core/tests/face-states.test.js` (the brief's numbered list),
`core/tests/project-roundtrip.test.js` (older projects, unchanged),
`core/tests/demo-assets.test.js` (what the template ships).
