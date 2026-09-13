# Drawing a face part

How a drawing becomes a library asset, and how to look at one before there are
fifty of them (MASC-09). The library's own contract is `docs/FACE_PART_LIBRARY.md`;
this is the **geometry** half of it, written down because the seven visual slots
of MASC-08 — Muzzle, Whiskers, Beak, Horns, Crest, Antenna, Panels — have no
drawings yet, and the first person to draw one has nothing to check their work
against.

## The workflow

```text
1. draw the asset, in the reference frame
2. declare its metadata: slot, mount point, reference box, kinds of face, tags
3. npm run face:assets
4. look at it alone      — is the box right? is the pivot where you meant?
5. look at it auto-fitted — does it land where you drew it?
6. look at the fit matrix — does it survive a narrow skull and a wide one?
7. fix the SVG, the reference box or the mount point
8. only then put it in a pack or a preset
```

Steps 4 to 7 are the loop, and they are cheap: the sheet is generated from the
assets and thrown away. Step 8 is the expensive one, which is why it is last.

## The reference frame

Every drawing in this library is authored in **one frame**: the template face's
own. Put the piece where it belongs on that face, and the fit will put it where
it belongs on every other.

```text
artboard      viewBox 0 -60 240 384   (the room above is for hats)
head          x 25.89  y 22  w 188.21  h 188
head centre   120, 116
```

### The anchors

Fifteen mount points, all of them measured from the template's own parts. These
already exist; MASC-09 adds none.

| Mount point | On the template | Read from |
| --- | --- | --- |
| `head.top` | 120, 22 | the top of the skull |
| `head.center` | 120, 116 | the centre of the skull |
| `head.bottom` | 120, 210 | the bottom of the skull |
| `eyes` | 120, 112 | both eyes together |
| `eye.left` / `eye.right` | 83, 112 / 157, 112 | each eye |
| `brows` | 120, 81.3 | both brows together |
| `brow.left` / `brow.right` | 85.3, 81.3 / 154.8, 81.3 | each brow |
| `nose.center` | 120.6, 148 | the nose |
| `mouth.center` | 120, 175.3 | the mouth |
| `ears` | 120, 118 | both ears together |
| `ear.left` / `ear.right` | 26.9, 118 / 213.1, 118 | each ear |
| `hair.top` | 120, 0 | the top of the hair |

A face that has not got the part an anchor is read from still has the anchor:
`layoutFromBoxes` puts it where the template keeps it, **in proportion to that
head**. So a muzzle anchored at `nose.center` lands sensibly on a face with no
nose yet, which is the usual case while a pack is being drawn.

## The geometry contract

An asset carries a `referenceBox`: the box the drawing occupies, in the frame
above. It is the whole of what the layout engine knows about the drawing's
shape, and it answers three questions at once:

```text
centre        the box's centre is the pivot a fit scales about
size          the box's size is what a scale is relative to
offset        the centre's distance from the template anchor is what is kept
```

`fitFacePart(asset, layout)` is one similarity, and nothing else:

```text
template anchor                     where the piece sits on the face it was drawn for
      ↓  the offset from it to the box's centre, kept
scaleReference                      this head's width ÷ the template head's width
      ↓
the same anchor on the target face  where the piece goes
```

In code:

```js
const scale = layout.scaleReference;
const pivot = centre(asset.referenceBox);
const target = { x: to.x + (pivot.x - from.x) * scale, y: to.y + (pivot.y - from.y) * scale };
// → { x: target.x - pivot.x, y: target.y - pivot.y, scaleX: scale, scaleY: scale, pivotX: pivot.x, pivotY: pivot.y }
```

Three consequences worth stating out loud:

* **A drawing authored on the template is not moved on the template.** Its fit
  comes back `x 0, y 0, scale 1`. If it does not, the box is wrong.
* **The scale is the head's, not the piece's.** A muzzle is not resized to fit a
  snout; it is resized the way the whole face is. A piece that needs a different
  proportion on a narrow skull is a piece that needs a second drawing.
* **Rotation is never fitted.** A fit is a translation and a uniform scale.

There is no second anchoring system, and MASC-09 deliberately does not add one.
A new mount point should be added only when a QA sheet shows that no existing
one can place a real drawing — not in advance.

### Reference box rules

```text
in the reference frame       the same coordinates the artwork is drawn in
finite, width and height > 0 or nothing can place the drawing
the centre is the pivot      put it where the piece should turn and scale about
bigger than the ink is fine  a box is where the piece belongs, not its outline
```

The last one matters more than it looks. The template's own brows, noses and
mouths have boxes about twice the height of their ink, because a brow's box is
the room it lives in and not the thickness of its line. `--measure` says so out
loud rather than treating it as an error; see *What the sheet flags* below.

### Mount point rules

```text
name the anchor the piece belongs to, never the nearest one
a piece that hangs on a part names that part as its `host`
the default is the category's, and it is only a default
a mount point survives an edit (MASC-09 §5)
```

That last line is new: *Save as a library part* now offers the anchor the
drawing already uses rather than its semantic category's default, so a muzzle
anchored at `nose.center`, reshaped and saved, is still anchored at
`nose.center`. An author can still change it in the form.

## Where the new slots go

The seven slots of MASC-08 have **candidate** anchors, and nothing more. They
live in one place, `SLOT_ANCHOR_CANDIDATES` in
`core/face-library/face-asset-review.js`, so the sheet, this document and the
tests argue about one table.

| Slot | installs as | candidate anchor | on the template |
| --- | --- | --- | --- |
| Muzzle | `accessory` | `nose.center` | 120.6, 148 |
| Whiskers | `accessory` | `nose.center` | 120.6, 148 |
| Beak | `mouth` | `mouth.center` | 120, 175.3 |
| Horns | `accessory` | `head.top` | 120, 22 |
| Crest | `accessory` | `head.top` *or* `hair.top` | 120, 22 / 120, 0 |
| Antenna | `accessory` | `head.top` | 120, 22 |
| Panels | `accessory` | `head.center` | 120, 116 |

`crest` is the open question: `head.top` is the skull, and `hair.top` is the top
of whatever hair the face has — which on a bird *is* the crest. The sheet draws
both anchors; the first real crest decides.

Nothing in the editor reads this table. What `fitFacePart` fits to is the
asset's own `mountPoint`, and always has been.

## Styles are the same piece in another language

```text
muzzle.short
├── muzzle.short-flat
├── muzzle.short-retro
└── muzzle.short-geometric
```

A style changes **how a piece looks and not where it sits**. A variant inherits
its slot, its kinds of face and its tags from the drawing it restyles
(MASC-08B), so it repeats none of them, and the review model reads them through
the base. What it must not do is move:

```text
mountPoint differs       a restyle would put the piece somewhere else
host differs             a restyle would hang it on something else
slot contradicts         a stated disagreement, unlike silence
centre moved             more than 6% of the base box's longer side
size changed             more than 15% on either axis
```

`variantGeometryIssues(base, variant)` says so, and every one of them is a
**warning on a QA sheet, never a validation error**: the library goes on
registering the variant. The thresholds are `VARIANT_GEOMETRY_TOLERANCE`. Six
percent of a 60-unit muzzle is under four units on a 240-unit face — under the
width of an outline; fifteen percent is a hairline against a heavy stroke, and
no more.

## The sheet

```sh
npm run face:assets                                  # out/face-assets/
node scripts/face-asset-sheet.mjs --slot muzzle
node scripts/face-asset-sheet.mjs --morphology beak
node scripts/face-asset-sheet.mjs --asset accessory.glasses
node scripts/face-asset-sheet.mjs --style flat  out/flat-review
node scripts/face-asset-sheet.mjs --measure          # + a browser's own measurements
```

It writes `index.html` (the whole review) and `assets.svg` (the drawings alone,
as one contact sheet) into `out/face-assets/`, which git ignores. **Nothing here
is a source file**: the assets are the source, the sheet is a view of them, and
deleting it loses nothing.

Each drawing gets three views:

```text
A  alone             its artwork, its reference box, its centre, the template
                     anchor, and the offset between anchor and centre
B  auto-fitted       the same drawing placed by `fitFacePart` over the template
C  the fit matrix    the same fit on Round, Oval, Wide, Narrow and Square
```

with its metadata underneath — slot → category, kinds of face, tags, mount
point, host, reference box, centre, style — and any warnings.

```text
▭  reference box      ●  centre / pivot      ✛  template mount anchor      ┈  the offset
```

The placement in B and C is `fitFacePart` over `layoutFromBoxes`, written
through the same transform string the runtime writes. **Nothing is nudged to
make a nice picture**: a piece that lands badly lands badly on the sheet, which
is the finding.

There is also a **slot reference** page section: the template with every anchor
named, and the seven candidate anchors above. It draws no invented character —
its only job is to answer *where does an artist draw this piece?*

### What the sheet flags

Without a browser:

| Code | Meaning |
| --- | --- |
| `box-missing` | no reference box, or one with no size: nothing can place it |
| `mount-unknown` | an anchor no face has; the fit falls back to `head.center` silently |
| `fit-failed` | the engine refused, or produced something that is not a number |
| `fit-scale` | a scale of zero or less |
| `variant-mount` / `variant-host` / `variant-slot` | a style that would move the piece, or re-hang it |
| `variant-centre` / `variant-size` | a style whose box has drifted past the tolerance |

With `--measure`, a browser measures each fragment's real bounding box:

| Code | Meaning |
| --- | --- |
| `artwork-overflow` | the ink reaches more than 10% of the box outside it |
| `box-slack` | the box is more than 1.5× the ink's width or height |

Both are questions, not rules. A box wider than the ink is often right — a pair
of whiskers whose box is the span they need places better than one hugging four
hairlines. And a **clipped** fragment is never asked the overflow question:
`getBBox` measures geometry and knows nothing of a clip, so a pair of eyes whose
lids are parked outside the socket measures as the lids and would read as
overflowing a box that is exactly right.

### Not the same tool as `face:snapshots`

```text
npm run face:snapshots   the whole mascot, posed through the exported runtime
npm run face:assets      the pieces, and where the layout engine puts them
```

Complementary, and deliberately separate.

## What MASC-10 draws first

The first pilot is one morphology in one style:

```text
Morphology   muzzle
Style        soft-cartoon   (the style the library is drawn in: no `-soft-cartoon` twins)
Species      Cat · Dog · Fox · Bear   — presets inside `muzzle`, not morphologies
```

A species is a **preset**, which is why adding one costs drawings rather than a
release. None of this exists yet, and none of it is in the built-in registry.

### The minimum pilot

Enough to prove the morphology, and no more:

```text
2  heads          a round one and a broad one, for the fit matrix to bite on
2  eye families
2  pupil families
2  brow families
4  ear families   pointed, round, folded, tufted — this is where a species reads
4  muzzles        short, long, blunt, fox
3  noses
3  mouths
3  whiskers
```

plus the universal pieces the library already has. That is about 25 drawings,
each of which should go through the loop at the top of this page **individually**
before any of them reaches a pack.

Four presets then dress those pieces as Cat, Dog, Fox and Bear. They inherit
their morphology from the slots of the drawings they name (MASC-08C), so a
preset naming a muzzle and a pair of whiskers is a `muzzle` preset without
anybody writing it down.
