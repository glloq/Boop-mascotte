# The mascot template

One template ships: **Mascot Face**. `face-artwork.js` draws it,
`template-project.js` rigs it, and the two files are read together — every id
in the drawing is wired by the rig, and nothing in the rig points at an id the
drawing does not have.

## Why one

There were three (Basic, Expressive, Talking). The other two were strictly
*smaller* than this one — fewer parts, fewer movements, the same shapes — so a
beginner picking one of them started with less and had no way of knowing it.
Three sets of artwork also meant three rigs to keep working every time the
model changed.

What a beginner needs is **a complete face they can strip down**, not three
partial faces they have to build up. Deleting a part in Artwork takes one
press; drawing an eyebrow does not.

## What it draws

240 × 240, 36 elements, cartoon flat colour. Paint order is the layer order, so
what is written first is behind:

```text
hairBack                         the hair seen behind the head
earLeft · earRight               a shape and a fold each; on the turn axis, so they tuck behind the head
chin                             a wide ellipse under the head: the lower face, and the jaw
head                             the outline
shadeLeft · shadeRight           cheek shading, one per side
browShade                        a soft band under the hairline
mouth                            one closed shape: the fill is the inside, the stroke is the lips
tongue · teeth                   drawn from the mouth's own curves, so they cannot leave it
eyeLeft · eyeRight               each a clipped group: white · pupil · glint · upper lid · lower lid · rim
eyebrows (browLeft · browRight)
nose
hairFront > hair                 the fringe, clipped to the head
```

There is no blush. It was two ellipses that never moved and never meant
anything, and a face reads better without a permanent flush.

## The eye is a clipped group

`eyeLeft` and `eyeRight` are not the whites — they are the whole eye, a group
carrying `clip-path="url(#eyeSocketLeft|Right)"` and holding the white, the
pupil, the glint, the two eyelids and the outline.

That is what makes a closed eye behave. The eyelids are ordinary skin-coloured
shapes parked above and below the socket; `eyeOpen` drives their `translateY`
so they meet over the middle as the eye shuts. The pupil does not fade — it is
still there, **behind the lid**, exactly as it would be on paper. Everything
the lids push past the socket edge is simply not drawn.

The previous face faded the pupil out with `opacity`, which is why a closing
eye looked like a pupil dissolving rather than an eyelid coming down.

The fringe is clipped the same way, to the head itself — `hairFront` carries
`clip-path="url(#headShape)"` and the fringe is drawn *wider than the head on
purpose*. Whatever the turn or `hairSway` does to it, it can neither leave the
silhouette nor slide off the hairline: it used to do both, sticking out past
the outline on one side and uncovering the forehead on the other.

**The clip has to travel with the eye.** A `clip-path` is applied to an
element's content in its own space and then transformed with it, so the clip
follows the element it is *on* and not the elements *inside* it. With the clip
on a wrapper, a turn moved the white and the pupil out from under a socket
pinned to the face, and the eye came apart. On the group, socket, white, pupil,
lids and rim turn as one assembly — which is also why the rim is inside the
clip (drawn at double stroke width, since a clip cuts a boundary stroke in
half) and why the `eyeOpen` squash is gentle: it scales everything in the
group, and a hard squash would pull the lids out of the socket.

`clipPath` survives the whole pipeline, which was verified before the artwork
was drawn on that assumption: the sanitizer keeps it (internal `#` references
are allowed), the DOM keeps `clip-path="url(#…)"`, `defs` children with no id
are excluded from `elements` and from the layer tree, and it round-trips
through save and export unchanged.

### One fade that is legitimate

`rimLeft` / `rimRight` *do* fade with `eyeOpen` (amplitude 3, offset −0.15, so
they are gone only at the very end of the close). The rim is the socket
outline: a closed cartoon eye is a crease, not a circle with a line through it.
The rim really does stop existing; the pupil does not. That is the difference
between the two, and it is why one is a fade and the other is a clip.

## The mouth is one shape

It was two: a stroked lip line that morphed for the smile, and a filled cavity
that scaled for the opening. Two shapes deforming under two different systems
cannot agree — a smile put the lip corners outside the cavity, and half-open
the lip lay across the hole like a stick.

One closed path has no such seam. The **fill is the inside of the mouth** and
the **stroke is the lips**, so every pose is a mouth:

```js
mouthPath({ open, smile })   // one function, four shapes
```

| Shape key | Drawn as | Driven by |
| --- | --- | --- |
| rest | `mouthPath()` | — the outline the others deform |
| `mouth-open` | `mouthPath({ open: 1 })` | `mouthOpen` 0 → 1 |
| `mouth-smile` | `mouthPath({ smile: 1 })` | `smile` 0 → 1 |
| `mouth-frown` | `mouthPath({ smile: -1 })` | `smile` 0 → −1 |

Every control point is **affine** in `open` and `smile`, so the additive shape
keys reproduce any combination exactly rather than approximately: a laughing
mouth is `mouthPath({ open: 1, smile: 1 })` to the last unit, and the unit test
asserts that.

Neither a transform nor the legacy morph can do this. A scale that closes the
mouth flattens the smile with it, and the legacy A/B morph is one shape per
element — which is why the Mouth's `mouthOpen` and `smile` controls use the
`shapeKey` method (`docs/SEMANTIC_RIGGING.md`). `mouthWidth` stays an honest
`scaleX`.

### Teeth and a tongue

Both are drawn from the mouth's **own curves** — the teeth hang off the upper
lip, the tongue sits on the lower one — so they are inside it by construction.
A shape that only happens to line up stops lining up the moment anything moves,
which is exactly how the old cavity came apart.

| Shape key | Driver | Why an expression |
| --- | --- | --- |
| `teeth-show` | `mouthOpen * teeth` | a **product**: closed lips have nothing behind them to show, however far the control is up |
| `teeth-follow` | `smile` | the upper lip moves with the smile whether or not anything shows behind it — signed, so a frown carries it the other way |
| `tongue-show` | `mouthOpen * tongue` | the same product |
| `tongue-follow` | `smile` | the same follow |

`teeth` and `tongue` are the Mouth part's optional roles, so the 2.5D turn
carries them with the lip line, and they are ordinary movements: a slider, a
pose chip, an animation track, a reaction.

### The jaw is its own movement

The `chin` drops through one binding whose expression is `mouthOpen + jawOpen`
(16 units each). Opening the mouth without lengthening the lower face reads as
a hole in a rigid head — and a jaw an author cannot drop by itself is not a
jaw. One binding, two ways to move it.

## Cartoon shading

`shadeLeft` and `shadeRight` are crescents down the sides of the face, drawn at
`opacity=".5"` — that is the *darkest* they get, because the binding multiplies
`baseOpacity`. Each is bound to `headX` (`amplitude ±0.6, offset 0.1`), so the
side turning **away** darkens and the side coming forward clears, which is the
second-strongest depth cue after the foreshortening itself.

`browShade` is static: it gives the flat colour some modelling without needing
to be rigged.

## What it ships switched on

- **Every face part assigned**: head, eyes, gaze, eyelids, eyebrows, nose,
  jaw, ears, hair, mouth.
- **Every movement on and calibrated**, eighteen of them: `headX/Y/Tilt`,
  `lookX/Y`, `eyeOpen`, `browRaise/Tilt`, `noseScrunch`, `mouthOpen`, `smile`,
  `mouthWidth`, `teeth`, `tongue`, `jawOpen`, `hairSway/Lift`, `earWiggle`.
  Every one of them has a row of pose chips (`docs/DIRECT_CONTROLS.md`).
- **The automatic life running**: blink, natural gaze on both axes, idle head
  movement. A mascot that arrives frozen reads as broken.
- **Six motions**: Look Around, Blink, Smile, Head Nod, Head Turn, Simple Talk.
- **The 2.5D turn generated** — see below.
- Three states (idle, happy, surprised) with transitions.

## 3D by default

`headX` turns the head from the first frame. `applyTemplateProject` generates
the same 3 × 3 grid the **Generate turn** button writes
(`headTurnKeyforms` / `headTurnPivots` / `headTurnBindings` — the shared
generator, not a copy), so a template turn and an authored one are the same 96
keyforms and either can replace the other.

Pressing **Reset all** in the Head pose panel is the exact inverse: the grid
clears *and* the head's own `translateX` / `translateY` bindings come back on,
so `headX` slides the head again rather than being left driving nothing. That
is also the state an imported drawing starts in.

The Face Builder generates faces through this same `applyTemplateProject`, and
those keep the plain head movement until their author presses **Generate
turn**: a generated face has no measured centres, and the parallax needs them.

## Extending it

`add(state, type, roles, controls)` skips a role whose element the artwork does
not draw, and creates no part at all when none of its roles is present. So the
rig above is written once and serves both the full template and whatever subset
the Face Builder produced. Adding a part to the drawing and a line to the rig is
all a new feature costs.
