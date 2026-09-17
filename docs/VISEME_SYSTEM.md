# The speech layer

A mascot that speaks has to keep the face it is wearing. That is the one
requirement, and almost every way of building a speech layer fails it:

```text
setMouth('AE')     →   the smile is gone
setMouth('OO')     →   the smile is still gone
setMouth('REST')   →   back to a neutral face nobody asked for
```

The fix is not a mouth that remembers its expression. It is not treating speech
as a pose at all.

```text
  expression  ──┐
                ├──▶  additive expression mixing  ──▶  semantic controls
  viseme      ──┘
```

**A viseme is an expression record.** The mixer already composes expressions as
*weighted deltas from neutral* and stacks any number of them
(`composeExpressionParams`), so `happy + AE` is happy's smile plus AE's opening,
and `AE → OO` is both deltas live at once. Nothing in this document is an
engine: the blending is `createWeightBlender`, the composition is the mixer, and
both already existed.

This is the graphical representation and the API a lipsync would call. It is
**not** a lipsync: there is no audio, no phoneme recognition and no timeline
here, deliberately.

---

## 1. The nine

Eight are what a cartoon mouth needs to read as speaking. `WQ` is the ninth and
is offered rather than required — a `w` is an `OO` that opens, and a mascot
without it loses a little crispness on *one* and *what*.

| Key | The mouth | For |
| --- | --- | --- |
| `REST` | at rest, lips together | nothing said |
| `MBP` | lips pressed shut | *m*, *b*, *p* |
| `FV` | lower lip against the upper teeth | *f*, *v* |
| `AE` | open wide | *a*, *e* as in *cat*, *bed* |
| `EE` | wide and shallow, corners back | *ee*, *i* |
| `OH` | open and rounded | *o*, *aw* |
| `OO` | small and strongly rounded | *oo*, *u* |
| `L` | tongue up against the upper teeth | *l*, *n*, *d*, *t* |
| `WQ` | rounded and opening | *w*, *qu* |

---

## 2. A viseme is three numbers

```text
          mouthOpen  mouthWidth  mouthRound   also
 REST         0          0           0
 MBP          0        −.1          .1        mouthLock .85
 FV         .16         .1           0        teeth .7
 AE         .75         .3          .15       teeth .4
 EE         .3         .85           0        smile .25, teeth .55
 OH         .6        −.35          .7        teeth .2
 OO         .32       −.7           1
 L          .42        .15           0        teeth .5, tongue .8, tongueY −.55
 WQ         .45       −.6           .9
```

`mouthOpen` is the aperture, `mouthWidth` how far the corners are pulled apart
or drawn in, and `mouthRound` how far the lips pucker — the axis that separates
`AE` from `OO` and the reason that control exists
(docs/FACE_SVG_STATES.md §3.3).

### The rule the whole layer turns on

**A viseme says as little as it can.** Whatever it leaves alone stays the
face's. `smile` appears exactly once, on `EE`, because an *ee* really does pull
the corners back; a viseme that set `smile` anywhere else would fight the
expression it was spoken through. `teeth` and `tongue` are the two other
exceptions, and they earn it: `FV` is the lower lip meeting the upper teeth and
`L` is a tongue against them, and neither reads at all without the artwork
behind the lips showing.

### What it is not

Not a drawing. Not a keyform. Not a pose. Not a `partState`. The mouth is one
closed path throughout, and the template carries **four** shape keys on it —
opening, smiling, frowning, puckering — for all nine visemes, which is the point.

---

## 3. Speech and expression together

```text
happy + AE      smile 1.00   open 0.75   round 0.15
happy + OO      smile 1.00   open 0.32   round 1.00
sad   + AE      smile −0.80  open 0.75   round 0.15
angry + EE      smile −0.35  open 0.30   round 0.00
surprised + OH  smile 0.00   open 1.00   round 0.70
```

The arithmetic is the mixer's, and it is the same arithmetic in the editor
preview, in the authoring panel's readout and in the exported runtime:

```text
effective[p] = clamp( base[p] + Σ weight × (target[p] − neutral[p]) )
```

An expression already at the top of a movement's range cannot open further —
`surprised` has `mouthOpen 1` and `OH` adds 0.6 — and the mixer clamps rather
than wrapping round. That is the only place a combination is not exactly the sum.

Speech **never returns the face to neutral**. `REST` is a viseme like any other
and is only ever reached by being asked for.

---

## 4. The format

A viseme is an expression record with one optional field:

```json
{
  "id": "viseme-ae",
  "name": "Say A · E",
  "source": "viseme",
  "viseme": "AE",
  "controls": { "mouthOpen": 0.75, "mouthWidth": 0.3, "mouthRound": 0.15, "teeth": 0.4 }
}
```

The id is `viseme-<key>`, lower case and prefixed, so a viseme is findable in a
project by name alone and can never collide with a face an author called *AE*.
The rule lives in `runtime/visemes.js` and nowhere else: the editor installs
under it and the runtime looks up through it, which is the only reason
`setViseme('AE')` works on a rig the runtime has never seen before.

`viseme` is derived from the id when absent, and an explicit value wins. An
expression record written before the speech layer has neither, and reads as the
ordinary face it is.

**No new rig block.** The visemes travel in `rig.expressions`, which every
reader already has, so an older runtime plays a speaking mascot's faces and
simply never asks it to speak.

A viseme an author retuned stays retuned: *Add them* installs only what is
missing, and the catalogue's numbers come back only if the author asks
(`installVisemes(document, { retune: true })`).

---

## 5. Transitions

`AE → OO` at 0.5 is **half of each**, which is the mouth halfway between the two
and never the mouth at rest — both deltas are live at once, and their sum is the
straight line from one to the other.

```text
t     mouthOpen  mouthWidth  mouthRound
0        .75        .30         .15      ← AE
.25      .64        .05         .36
.5       .54       −.20         .57
.75      .43       −.45         .79
1        .32       −.70        1.00      ← OO
```

Monotonic on every control, so no value doubles back through its resting point
on the way. That is asserted for `AE → OO`, `MBP → AE` and `OH → EE`, along with
the stronger property that no single step moves more than a fraction of the
whole — a transition that is continuous but jumpy is still a pop.

A viseme sliding into itself is that viseme at full weight rather than two
halves of it, so a lipsync repeating a sound does not stutter.

---

## 6. The API

Three calls, on the exported runtime and on the editor preview alike.

```js
mascot.getVisemes()
// [{ key: 'REST', id: 'viseme-rest', name: 'Say Rest' }, …]
// Empty for a mascot whose mouth was never given the speech shapes, so a
// lipsync can ask once whether there is anything to drive.

mascot.setViseme('AE', 1)
// setExpression with the naming rule applied. The mouth keeps the face it is
// wearing: called while `happy` is set, it gives happy-saying-AE.

mascot.blendVisemes('AE', 'OO', 0.5)
// Where the mouth is between two of them. Both weights live at once.
// A viseme the mascot has not got is ignored rather than refused, so a track
// containing a WQ still plays on a mouth that never learned one.

mascot.clearVisemes()
// Stop speaking, leaving the face exactly as it is.
```

### What a lipsync does with them

It owns the clock and the phoneme track; this owns the mouth. Every frame it
finds the pair either side of the playhead and the fraction between them:

```js
const TRACK = [['MBP', 120], ['EE', 150], ['L', 130], ['OH', 190], ['OO', 170], ['REST', 200]];

function frame(elapsed) {
  let time = elapsed, i = 0;
  while (i < TRACK.length && time > TRACK[i][1]) { time -= TRACK[i][1]; i += 1; }
  if (i >= TRACK.length) return mascot.blendVisemes('OO', 'REST', 1);
  const from = i === 0 ? 'REST' : TRACK[i - 1][0];
  mascot.blendVisemes(from, TRACK[i][0], time / TRACK[i][1]);
}
```

That is the whole integration, and it is what the runtime demo's *Say “hello”*
button runs. Nothing here keeps a clock, holds a queue or schedules anything:
adding those is the lipsync's job and is out of scope on purpose.

`{ duration }` and `{ easing }` pass through to the expression blender, so a
call can ramp instead of arriving — which a lipsync driving every frame does
*not* want, and a page saying one word does.

---

## 7. Correctives

A viseme has no corrective of its own, and cannot: by the time the artwork is
posed there is no "how much `AE`" left to read. A corrective slot carries a
sentence about the **controls**, so `OO` and a mouth puckered by hand get the
same correction because they are the same mouth
(docs/FACE_SVG_STATES.md §4.1).

Which slots each viseme reaches, strongest first:

```text
 MBP  lock .85   round .10
 FV   lipTeeth .59   open .16
 AE   open .75   wide .30   openWide .22
 EE   wide .85   lipTeeth .39   open .30
 OH   round .70   open .60   openRound .42
 OO   round 1.00   wide −.70   open .32
 L    tongueTeeth .44   open .42   lipTeeth .29
 REST nothing
```

The Face states panel shows this, so an author correcting `OO` is shown *Round*
rather than nine sentences to work through.

---

## 8. Authoring

**Rig ▸ Controls → Face states → Mouth.** The nine chips pose the face; the
combined row is the one that matters:

```text
 Face     Happy  ▾
 Saying   AE     ▾
 How far  [————●——]  65%
```

Composed by `composeFaceState`, which is the mixer's own arithmetic — an author
checking *happy + AE at 0.65* is checking what the runtime will do, and a test
holds the two to each other down to the number.

A project without the speech shapes is offered them (*Add them*), which creates
eight expression records and nothing else.

---

## 9. Where it lives

| File | Holds |
| --- | --- |
| `runtime/visemes.js` | the nine keys, the naming rule, and a transition's weights |
| `runtime/runtime.js` | `setViseme`, `blendVisemes`, `getVisemes`, and the `viseme` field |
| `core/face-library/face-states.js` | the nine presets and how one resolves against a project |
| `core/face-library/face-state-install.js` | giving a mouth the shapes |
| `core/starter/starter-kit.js` | the eight the template ships |
| `core/preview-runtime/preview-controller.js` | the same three calls, in the editor |

Tests: `core/tests/face-states.test.js`, `core/tests/demo-assets.test.js`,
`core/tests/starter-kit.test.js`.
