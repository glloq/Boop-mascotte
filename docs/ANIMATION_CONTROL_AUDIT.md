# Audit — animations, transitions and the fine-control surfaces

> **Status: every finding below is fixed**, § 1 included. That last one was a
> design decision rather than a patch; it was taken and implemented as
> `docs/ADR_MOTION_LAYERING.md` records. Each finding carries a **Fixed** note
> saying what changed and which test holds it, and the findings are kept in full
> — the evidence is why the fix looks the way it does.

Scope: how motions play and hand over to one another, what the control
interface actually writes, and every surface that claims to give precise
control. Findings marked **verified** were reproduced by running the code, not
by reading it; the probe is quoted so it can be re-run.

Findings already listed in `docs/KNOWN_LIMITATIONS.md` (no clip blending or
layering, no F-curve editor, head pose fixed at 3 × 3, warp handles not on the
canvas) are noted as context, not re-reported as news.

---

## 1. The shape of the problem

The runtime has three time-varying layers. Two of them ramp; one snaps.

| Layer | Machinery | Ramps? |
| --- | --- | --- |
| State → State | `setState` + `transitionSettings[from->to]` (duration, easing) | Yes, and the UI exposes it |
| Expression → Expression | `createWeightBlender` (`runtime/transitions.js`) | Machinery yes — **but see 3.1** |
| Motion clip → Motion clip | none | **No** |

`docs/CONTINUOUS_TRANSITIONS.md` states the failure the architecture exists to
prevent:

```text
Animation A → RESET NEUTRAL → Animation B
```

That failure is still reachable through two paths that bypass the blender
(§ 2.3) and through motion clips, which never had one.

### Motion clips have no handover at all

`runtime/runtime.js` holds exactly one clip:

```js
let animation = null;
playAnimation(id) { …; animation = { clip, started: seconds(now()) }; return true; }
stopAnimation()   { const had = Boolean(animation); animation = null; return had; }
```

Consequences, all structural:

- **Playing a second motion kills the first mid-flight.** The motion layer's
  value jumps from A-at-its-current-time to B-at-zero in one frame.
- **Stopping snaps.** `animation = null` removes the layer; the parameter
  returns to the base pose instantly.
- **Ending snaps too.** Verified: `evaluateAnimationClip` holds the last key
  past `duration`, so a clip ending at −1 with a base of 0 pops by a full unit
  on the frame the engine drops it. A clip that ends at neutral hides this; a
  hand-authored one will not.
- **Two motions can never run together.** A head nod and an eye dart are
  mutually exclusive, even though they touch disjoint parameters.

There is also no UI anywhere to sequence or chain two motions: States
interpolate poses and do not trigger clips (documented), and a reaction plays
exactly one clip.

**Fixed** (`docs/ADR_MOTION_LAYERING.md`). `createMotionLayer` in the runtime
holds motions, weights them and hands them over, and both the engine and the
editor preview use it. `playMotion(id)` cross-fades from whatever is playing,
`{ layer: true }` runs a motion alongside, stopping fades, and a non-looping clip
releases at its end instead of popping. The span is `motionBlend` on the
document, authored under the motion list, with a per-call `fade` override.
`core/tests/motion-layering.test.js` + `ux29-fine-control.spec.js`.

---

## 2. Confirmed bugs

### 2.1 A stayed hand gesture is wiped by any reaction carrying a motion — **verified**

`createReactionController.evaluate` builds `params` from the gestures that
stayed, then **replaces the whole object** when a clip is active:

```js
let params = {};
for (const [name, value] of Object.entries(stayedGestures)) params[name] = value;
if (active) {
  …
  if (clip && …) params = evaluateAnimationClip(clip, elapsed, base);   // ← replaces
  for (const gesture of reaction.gestures) params[name] = …             // only the active ones come back
}
```

Probe — a `Wave` reaction with `after: 'stay'`, then a `Nod` reaction with a
motion:

```text
after wave stays: {"handRWave":1}
during nod      : {"headY":0.25}      ← the wave is gone
after  nod      : {"handRWave":1}     ← and comes back
```

The hand drops to neutral for the whole length of the motion and then pops back
up.

**Fixed.** `evaluate` now layers every contribution onto one `params` object
instead of reassigning it. `reactions.test.js` → *a stayed gesture survives a
reaction that carries a motion*.

### 2.2 The reaction timing envelope does not apply to the motion — **verified**

The Reaction Inspector presents **Speed** (Fast / Normal / Slow, or custom
attack / hold / release) as governing the reaction. It shapes the expression
and the gestures. It does not shape the motion: the clip is written raw.

```js
if (reaction.expression) expressions[id] = … reaction.expression.weight * weight;
if (clip && …)           params = evaluateAnimationClip(clip, elapsed, base);   // no × weight
for (const gesture of reaction.gestures) params[name] = … gesture.weight * weight;
```

Probe — `attack .5 / hold .5 / release .5` on a clip that holds `headY: 1`:

```text
t     phase    expression      motion
0.00  attack   {"e":0}         {"headY":1}   ← in at full while the face ramps from 0
0.25  attack   {"e":0.75}      {"headY":1}
2.00  release  {"e":1}         {"headY":1}
2.10  release  {"e":0.96}      {}            ← out in one frame while the face is still fading
```

So a "Slow" reaction still snaps its movement in and out. This is the clearest
case of a control that does not control what it says it does.

**Fixed.** A new `contribute()` blends the clip from the pose underneath toward
its keys by the envelope weight — the mixer's `weightedOverride` rule — so the
motion rides exactly the curve the expression rides. A clip past its duration
now holds its last pose and fades out with the release instead of vanishing,
which is what the Inspector's "hold 1.2 s (or as long as the motion)" always
claimed. `reactions.test.js` → *the timing envelope shapes the motion exactly as
it shapes the expression*.

### 2.3 One reaction replacing another passes through neutral — **verified**

`fire()` reassigns `active` outright, and reaction expressions are merged into
the blender's output *after* the blender (`weights[id] = Math.max(…)`), so the
outgoing reaction's expression is not handed to the blender to ramp down — it
simply stops being contributed.

Probe — reaction A held at weight 1, then B fired:

```text
t=1.00 (A held)   {"ea":1}
t=1.00 after swap {"eb":0}      ← A gone in the same frame, B starts at 0
t=1.05 after swap {"eb":0.4375}
t=1.20 after swap {"eb":1}
```

Between the two frames the face is at neutral. This is exactly the failure
`CONTINUOUS_TRANSITIONS.md` was written to prevent, on the path most users will
hit (two click reactions in a row).

**Fixed.** A replaced reaction is moved to a bounded `retiring` list and keeps
releasing from the weight it was showing, so the two overlap. `reactions.test.js`
→ *one reaction replacing another cross-fades instead of passing through
neutral*.

### 2.4 Duplicating a keyframe can overwrite a neighbour

`duplicateSelectedKeys(clip, selection, step = 1/30)` writes each copy at
`frame.time + step` through `upsertKeyframe`, which **replaces** an existing key
at that time. Two consequences:

- Duplicating a key that is one frame before another silently destroys that
  other key's value and easing.
- Duplicating a key at the very end of the clip clamps to `duration`, lands on
  the source key, and silently does nothing.

The returned selection uses `Math.min(clip.duration, time)`, so after the
second case the UI reports a selection on a key that was never created.

**Fixed.** A copy that would land on an existing key is skipped rather than
written, the function returns `{ selection, skipped }`, and the Timeline says so.
`animation-control-audit.test.js` → *duplicating keys never overwrites a key that
is already there*.

### 2.5 Two `<option>` lists render literal commas

`state-machine-panel.js` interpolates arrays without `.join('')` in the **Add
Transition** dialog and the **Initial State** select:

```js
`<select>${Object.keys(s.states).map(n => `<option>${esc(n)}</option>`)}</select>`
// → <select><option>Idle</option>,<option>Happy</option>,<option>Angry</option></select>
```

Verified by evaluating the template: stray `,` text nodes appear between the
options.

**Fixed.** Both lists join.

### 2.6 An undo transaction can stay open and swallow later edits

`state-machine-panel.js` opens a transaction on `focusin` of any range/number
input and closes it on **any** `change` in the panel. Tabbing onto a slider
without moving it opens a transaction that no `change` closes; from then on
`history.snapshot()` is suppressed, so every subsequent edit — creating a state,
deleting a transition — folds into the one snapshot taken before the focus. Undo
granularity silently disappears until some input fires `change`.

**Fixed.** The transaction also commits on `focusout` of the field that opened
it.

---

## 3. Capability that exists but cannot be reached

### 3.1 `expressionBlend` has no authoring UI

The cross-fade duration for expressions is normalized, stored, snapshotted,
exported and consumed by both the runtime and the preview:

```js
// runtime.js
const activeExpressions = createWeightBlender(normalizeExpressionBlend(rig.expressionBlend));
// normalizeExpressionBlend defaults duration to 0
```

No editor surface writes it. `store.js` seeds `expressionBlend: null`, so **every
project made in the editor blends expressions over 0 ms** — i.e. they snap. The
whole `createWeightBlender` / `transitionToExpression` system, and the document
that sells it, are dark unless someone hand-edits the JSON.

A duration + easing pair next to the expression list would light up work that is
already written, tested and shipped.

**Fixed.** `setExpressionBlend` / `commands.setBlend` and a **Switching between
expressions** disclosure under the expression list. The stored default stays 0 ms
so no existing rig changes; whether a *new* project should start non-zero is the
sub-decision in `docs/ADR_MOTION_LAYERING.md`. `animation-control-audit.test.js`
+ `ux29-fine-control.spec.js`.

### 3.2 Shape keys, deformers and depth/parallax have no UI at all

`shapeKeys`, `deformers` and `parallax` are normalized, composed by
`compileFrame`, exported, and documented (`SHAPE_KEYS.md`, `DEFORMER_MODEL.md`,
`DEPTH_PARALLAX.md`). Nothing in `project/editor` writes them, and they are not
listed in the Advanced hub (`advanced-tools.js` lists seven tools; these three
are not among them), so a user cannot even discover that they exist. The only
way in is importing a rig or editing project JSON.

**Partly fixed — discoverability only.** A **Deformation** entry in the Advanced
hub lists what the project carries in each of the five systems and where each one
is edited, saying "No editor yet" where there is none. Authoring surfaces for
shape keys, deformers and depth stay out of scope; this is the difference between
"not editable here" and "invisible".

`createParameterTransition` (`runtime/transitions.js`) is in the same position:
exported and unit-tested, called by nothing in production. It is the tool that
would fix § 1.

---

## 4. Editor ↔ runtime parity

### 4.1 The preview poses the mascot with a clip the runtime would not play

```js
// preview-controller.js — no `playing` check
const clip = state.animationClips?.find((item) => item.id === clipId);
if (clip) result = { ...result, ...evaluateAnimationClip(clip, clipTime, result) };
```

Selecting a clip and pressing Stop leaves the clip applied at `clipTime = 0`
forever. The exported runtime applies a clip only while `playAnimation` is
active. Any clip whose t=0 is not neutral therefore looks different in Preview
than in the export — and a track whose first key is late is worse: verified,
`evaluateAnimationClip` returns the first key's value from t=0, so a `smile`
track starting at 0.5 s overrides the base pose for the whole first half.

**Fixed.** The controller tracks whether the selected clip poses the mascot.
Selecting or scrubbing turns it on (that is how a key is authored); Preview and
the Motion Inspector stop with `stopClip({ pose: false })`, which puts the mascot
back exactly as the exported runtime does. `animation-control-audit.test.js` →
*a stopped clip poses the mascot for the Timeline and not for Preview*.

### 4.2 The preview bypasses the declared mixer for two layers

`PARAMETER_MIXER.md` and the runtime's own comment say layers are "declared and
ordered, never spread-merged ad hoc". The runtime obeys. The preview does not:

```js
if (clip) result = { ...result, ...evaluateAnimationClip(…) };   // motion
result = { ...result, ...reaction.params };                       // reaction
```

Same net result today (both layers are `override` at weight 1), but the two
implementations will drift the moment a mode or a weight is introduced — which
is precisely what fixing § 2.2 requires.

**Fixed.** The preview composes the motion and reaction layers through
`mixParameters` with declared sources, evaluating the clip once per frame.

---

## 5. The control interface

### 5.1 No precision modifier anywhere on the canvas

Puppet handles (`svg-canvas.js`):

- Keyboard nudge is `PUPPET_NUDGE = 0.05`; `Shift` multiplies it by 4, i.e.
  **coarser**. There is no finer step, so 0.05 of a parameter's span is the
  smallest adjustment a handle can make.
- During a *drag* there is no precision modifier at all. `Shift` is taken for
  snap-to-grid, and only on grid handles — for hands, brows, mouth and gaze it
  does nothing.

The sliders (step 0.01) are five times finer than the handles, and they live in
a different panel. The direct-manipulation surface is the coarse one.

**Fixed.** **Alt** is the precision modifier on every handle: a fifth of the
keyboard step (0.01, matching the sliders) and a fifth of the drag distance,
rebased whenever the modifier changes so pressing or releasing Alt mid-drag does
not jump. Shift stays snap-to-grid, so the two never fight.

### 5.2 The XY pads ignore the parameter's declared range

`applyPad` clamps to −1…1 and writes that value, while the sliders next to it
read `param.min` / `param.max`. Harmless for the built-in movements (all of
`headX`, `headY`, `lookX`, `lookY` are −1…1 in `part-registry.js`), but an
imported rig may declare any range, and `mixParameters` is called with
`clampToBounds` off — so the pad would drive the parameter out of its own
bounds. Latent, not currently firing.

**Fixed.** The pad maps its square onto each parameter's declared range in both
directions, and arrow keys move a tenth of the pad with Shift as the fine step.

### 5.3 Preview live controls cannot be typed

Every live control is a range plus a read-only `<output>`. There is no numeric
entry, so an exact value (0.35, not "about a third") cannot be set in Preview at
all. The XY pad's arrow-key step is fixed at 0.1 with no modifier.

**Fixed.** The read-only `<output>` is now a number field: the slider and the
field are two ends of one control, and typing is clamped to the parameter.
`ux29-fine-control.spec.js` → *a live control can be typed, not only dragged*.

### 5.4 Hand anchors step by whole pixels

`hand-setup-panel.js` anchor and reach fields are `type="number" step="1"`.
Decimals can be typed but arrow keys move a pixel at a time. The Artwork
inspector is similar: `x`, `y` and `rotation` declare no `step` (so 1), while
`scaleX` / `scaleY` use 0.1.

**Fixed.** Positions, pivots, rotation and the hand anchor/rest offsets step by
0.5. Reach and turn range stay whole units — they are spans, not positions.

---

## 6. Timeline

The dope sheet is the strongest fine-control surface in the product:
multi-select, marquee, snapping, zoom (0.25×–8×, ctrl-wheel, Fit), key
navigation, per-key numeric time and value, per-key easing, copy/paste,
duplicate, auto-key, frame stepping, and a confirm dialog before destructive
edits. Two gaps:

- **Snap does not apply to the playhead.** `ui.snap` is consulted when dragging
  keys, but the ruler drag calls `layout.xToTime` raw and `data-frame` steps
  from wherever the playhead already is. So with **Snap ON**, "add key at the
  playhead" still produces off-grid keys — the one place snapping matters most.
  **Fixed.** Dragging the ruler snaps to the frame grid and to existing keys, and
  the frame-step buttons round onto the grid. Typing a time still means that time.
- **Value editing needs exactly one selected key.** There is no offset or scale
  across a multi-selection, so retiming a whole track's amplitude is key by key.

No F-curve or tangent editor is a documented limitation, not a finding. Worth
noting that the dope sheet never shows a value: the only way to see what a key
holds is to select it or hover for the tooltip.

---

## 7. States and transitions

The transition model itself is sound — per-edge duration and easing, a Test
button, and `createParameterTransition`-style ramping in both the engine and the
preview. The editing surface is the weak part:

- **The graph is one horizontal row** (`y = 70`, `x = 75 + i*150`). Every edge
  button is drawn at the same `top`, spanning between its two nodes, so on any
  graph past three states the edges overlap. `A→B` and `B→A` land on exactly the
  same rectangle, so only one of the pair is ever clickable; `A→C` is drawn
  across `B`. The transition *list* below is the only reliable way to select an
  edge.
  **Fixed.** `assignEdgeLanes` gives each edge the lowest free lane, the node row
  moves down by the height of the stack so nothing is clipped, and the canvas
  grows to match. `animation-control-audit.test.js` → *transition edges take
  separate lanes so every one of them is clickable*.
- Duration is `step="10"` ms with no upper bound and no preview of the curve.

---

## 8. What is solid

Worth recording so a fix does not undo it:

- The mixer (`mixParameters` / `orderLayers`) is explicit, ordered, documented
  and tested — the right foundation for everything above.
- `evaluateAnimationClip` is shared between the editor and the export, so keys
  play identically in both.
- Motion presets compile deterministically and the `simple → edited → custom`
  transition is explicit, reversible and explained in the Inspector.
- Undo is one step per gesture everywhere it matters: a slider drag, a key drag,
  a preset add, the whole starter kit.
- Reaction priority and `interrupt: replace | ignore` are real and tested; the
  event log in Preview reports `fired` / `blocked by` / `no listener`.

---

## 9. Where this landed

Everything in this audit is fixed on this branch, with a regression test each:
`core/tests/reactions.test.js` (§ 2.1–2.3),
`core/tests/animation-control-audit.test.js` (§ 2.4, § 3.1, § 4.1, § 7),
`core/tests/motion-layering.test.js` (§ 1) and
`tests/e2e/ux29-fine-control.spec.js` (the authoring surfaces).

Two things were deliberately scoped out rather than done:

- Authoring surfaces for shape keys, deformers and depth (§ 3.2). Only their
  discoverability was fixed.
- Shipping a non-zero cross-fade in *new* projects. Both blends store 0, so
  nothing changes until an author asks; the sub-decision is recorded at the end
  of `docs/ADR_MOTION_LAYERING.md`.
