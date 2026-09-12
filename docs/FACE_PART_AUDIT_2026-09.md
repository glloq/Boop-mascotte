# Face parts, end to end: eyelids, tongue, teeth and the rest

A part of a face has to exist in seven places before an author can use it, and
it can be missing from any one of them while looking perfectly present in the
other six:

```text
1  category       is it a thing the library installs?          face-part-model.js
2  semantic part  does the rig know what it is and what it does?  part-registry.js
3  artwork        does any drawing actually draw it?           face-library/builtin/
4  movement       is there a row that switches it on and off?  face-movements.js
5  palette        does it have a colour token of its own?      palette-model.js
6  panel          can the author reach it?                     character-builder/, face-*-panel.js
7  runtime        is it applied on a frame?                    project/runtime/
```

This is the state of all eight of them. Most of it holds up; what did not is
listed at the end, with what was done about it.

## What each part has

| part | category | semantic part | drawn by | movement | token | panel | runtime | template |
|---|---|---|---|---|---|---|---|---|
| **eyelids** | yes (no assets of its own) | `eyelids` — four lid roles, `eyeOpen`, sided | the eye sets, as a composite (`builtin/eyes.js`) | `eyeOpen`, shared with the eyes | none of its own; seeds `skin` + `outline` | Builder row, no cards; no Face Setup row | generic bindings, plus `eyelidFollowAmount` | drawn and rigged, per-side offsets |
| **tongue** | **no** | two: the mouth's `tongue` (does it show) and a `tongue` part (`tongueX/Y/Out/Curl`) | `mouth.cartoon` only | `tongue` + the four | `tongue` | Movements group, glyph, palette | generic; carried by the lip line in the turn | drawn, rigged, three shape keys |
| **teeth** | no (comes with the mouth) | the mouth's `teeth` role | `mouth.wide`, `mouth.cartoon` | `teeth` | `teeth` | glyph, "limited animation" badge when a mouth lacks it | generic | drawn, rigged, three shape keys |
| **pupils** | yes (no assets of its own) | `gaze` — `lookX/lookY/pupilScale` | the eye sets, as a composite | three rows | `pupil` | Builder row, Face Setup rows, detection | the gaze solver writes them | drawn and rigged |
| **jaw** | no | `jaw` — `jawOpen` | every head, as a composite with the skull rule | `jawOpen` | seeds `skin` + `outline` | glyph; no Builder category | generic shape key | rigged on `mouthOpen + jawOpen` |
| **ears** | yes | `ears` — `earWiggle` | three sets | `earWiggle` | seeds `skin` + `outline` | Builder row | generic; own turn profile | drawn and rigged |
| **nose** | yes | `nose` — `noseScrunch` | four | `noseScrunch` | `skinShadow` | Builder row | generic; turns with the head | drawn and rigged |
| **eyebrows** | yes | `eyebrows` — `browRaise`, `browTilt` | five sets | two rows | `hair` | Builder row, Face Setup rows, detection | generic + brow-end pins | drawn and rigged |

Two things are worth saying plainly, because they look like holes and are not:

* **The runtime knows nothing about any of this.** Nothing under
  `project/runtime/` reads `semanticParts`. Every movement above is applied by
  the same generic binding, shape-key and pin compiler, which is why the list
  has no runtime gaps in it and why adding a part costs no runtime work.
* **Eyelids and pupils ship no assets of their own on purpose.** They arrive as
  composites of an eye set, which is the only way they can be drawn in register
  with the eye they belong to.

## What was wrong, and what was done

| | found | done |
|---|---|---|
| 1 | Switching *Eyes · Open / close* off left all four lid bindings live — the face went on blinking with its movement gone. The lids are their own part carrying the same `eyeOpen`, and the panel had one row, on the eyes. | A row may name the other parts sharing its control (`also`); enabling and disabling reach all of them in one undo step. The jaw's *Drop* now reaches facial hair the same way. A test walks the registry and fails on any control with no row. |
| 2 | The two **lower** lids are bound by hand (they close upwards) and carried no `generatedBy` stamp, so no movement owned them and nothing could switch them off. | Stamped as the eyelids' `eyeOpen`. No change to how they move; `mascot.svg` is byte for byte what it was. |
| 3 | The registry said teeth and tongue are shape keys; the installer writes an **opacity** for a library mouth that draws its own. The Movement Inspector then refused the method the installer had just written. | `opacity` is a strategy for both. Both ways are real: the template deforms bands out of its lip curves, a drawn mouth fades its teeth in. |
| 4 | A shaped movement reported *On · ready* from its **method**, not its keys — so Teeth switched on by hand over a face with no keys claimed to be ready. | `movementMoves` knows about shape keys: *ready* when they exist, *not set up yet* when they do not. |
| 5 | Ten assets declared palette tokens they never paint (glasses claiming two colours, a bald head claiming hair), and the Movements panel kept a second table of part names that knew five of ten — so Nose, Jaw, Tongue, Hair and Ears read "Assign the artwork first" without saying which. | `palette` is derived from `paletteRoles`, with a test holding every asset to it. One table of part names, in `face-movements.js`. |

## What stands, and why

These are gaps in the **library and the panels**, not faults in the wiring.
Each is a decision to make rather than a bug to fix, so none was changed here.

1. **No eyelid assets, and no way to assign lids in Face Setup.** The `eyelids`
   category is real and empty, so the Builder falls back to "assign it in Face
   Setup" — and `FACE_ROLE_CHECKLIST` has no lid row, so that button leads
   somewhere that cannot do it. The only route is the advanced *All parts*
   catalogue. Either the category should ship lid assets, or the checklist
   should grow the four roles, or the button should not offer what it cannot do.
2. **`tongueX`, `tongueY`, `tongueOut`, `tongueCurl` are template-only.** They
   are declared, listed, labelled, drawn a glyph and used by presets (*yawn*,
   *cheeky*, *silly*), but no library asset names the standalone `tongue` part's
   role and there is no `tongue` category — so outside the shipped face they are
   unreachable. The same holds for the mouth's optional `cavity` role.
3. **`smile`, `mouthWidth`, `teeth` and `tongue` have no calibration poses.**
   `mouth.calibration` covers `mouthOpen` alone, so a library mouth whose smile
   is a `translateY` offers no capture steps and no visual range tuning.
4. **Detection knows five features.** `face-role-detection.js` looks for
   pupil, brow, eye, mouth and head; an imported SVG with layers named "nose" or
   "ears" gets no suggestion, though both are full categories with assets.
5. **Four of the six face presets ship a mouth with neither teeth nor tongue.**
   Installing one switches those movements off, so the expressions that need
   them (*excited*, *laughing*, *cheeky*, *silly*) and the motions (*yawn*,
   *laugh*) degrade on two thirds of the shipped faces.
6. **A head declares its jaw with an empty role map**, which is legal only
   because the installer has a hard-coded case for the skull rule. A second part
   wanting the same pattern would need a second special case.

## Seeing it rather than reading it

```sh
npm run face:snapshots      # 25 poses of the template through the real runtime
```

`blink`, `half-blink` and `wink` are the lids; `mouth-open`, `mouth-open-teeth`
and `laugh` are the teeth; `jaw-open` is the skull's own pose. They are a review
aid and are not checked in — the invariants worth defending live in
`face-artwork.test.js` and `face-movements.test.js`, which need no browser.
