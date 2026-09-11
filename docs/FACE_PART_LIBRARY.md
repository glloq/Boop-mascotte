# Face part library

> The Character Builder's parts come from a library, and the library is a
> registry of *assets*: a description of a piece of artwork and of the
> semantic part it becomes. Roadmap phase 2, delivered as **PR 2 — Face Part
> Registry**; installing one as a replacement, roadmap phase 4, delivered as
> **PR 3 — Replace Part**; where it lands on any face, roadmap phases 5 and
> 6, delivered as **PR 4 — Face Layout / Auto-fit**; the first library of
> heads, eyes, brows, noses, mouths and ears, and the two rules they needed,
> delivered as **PR 6 — Basic Face Library**; hair as one part with a back
> painted behind the face, delivered as **PR 7 — Hair Composite**; the face's
> colours as tokens, delivered as **PR 8 — Palette Tokens**; facial hair as a
> part and several accessories at once, delivered as **PR 9 — Facial Hair &
> Accessories**; six face style presets, delivered as **PR 10 — Face Style
> Presets**.

This page is the data model, the registry, the one command that puts an
asset onto a mascot, and the layout that command fits it with. The rest of
the roadmap reads what is described here and adds nothing to it.

## Why a registry

The editor could already add whole parts: `FACE_FEATURES` (`core/sample/face-features.js`)
holds the eyebrows and the eyelids as artwork plus roles plus controls plus a
reference box, and one command installs one of them. That is the shape of an
asset, and it was written twice by hand. The library generalises it: any
number of assets, in any category, validated the same way, registered by the
editor or by a pack, and read by one installer.

The rule that makes this safe (roadmap phase 4): **the runtime never sees an
asset.** It sees the semantic part the asset becomes — `mouth`, with the
control `smile` — so `smile = 0.8` means the same thing on `mouth.simple`,
`mouth.wide` and every mouth anyone draws later.

## An asset

```js
{
  id: 'mouth.wide',                  // category.name: lower case, digits, dashes
  category: 'mouth',                 // one of FACE_PART_CATEGORIES
  name: 'Wide',
  description: 'A wide grin with a row of teeth.',
  artwork: '<g id="mouth-wide">…</g>',   // one SVG fragment, one root element
  roles: { mouth: 'mouth', teeth: 'teeth' },   // role → id inside the artwork
  capabilities: ['mouthOpen', 'smile', 'mouthWidth', 'teeth'],
  referenceBox: { x: 80, y: 168, width: 80, height: 22 },   // what it was drawn against
  mountPoint: 'mouth.center',        // where it mounts; the category's default when omitted
  palette: ['mouth', 'teeth'],       // the colour tokens it uses
  origin: 'builtin'                  // or 'custom'
}
```

| Field | Meaning |
| --- | --- |
| **id** | `category.name`. The category first, so a listing sorts by it and a mismatch is visible. |
| **category** | What a person calls the part. Decides the semantic part, the roles it may name and the movements it may claim. |
| **artwork** | An SVG fragment drawn in the template face's frame (240 × 240). One root element, usually a `<g>`; ids unique within it. |
| **roles** | Which shape plays which role of the semantic part. Every required role of the part must be named; one shape plays one role. |
| **capabilities** | The movements this drawing carries. A subset of the part's controls; what is left out is *Limited animation* (roadmap phase 26), reported as a warning and shown on the badge. |
| **referenceBox** | The box the artwork was drawn against. Auto-fit (PR 4) maps it onto the measured box of the face it joins, the way `fitFeatureArtwork` already does for the eyebrows. |
| **mountPoint** | One of `FACE_MOUNT_POINTS` (roadmap phase 5): `head.top`, `head.center`, `head.bottom`, `eyes`, `eye.left`, `eye.right`, `brows`, `brow.left`, `brow.right`, `nose.center`, `mouth.center`, `ears`, `ear.left`, `ear.right`, `hair.top`. The layout context resolves it to a point on the face the asset joins ("Layout and auto-fit" below). |
| **palette** | The colour tokens the artwork uses, from `PALETTE_TOKENS` (roadmap phase 9): `skin`, `skinShadow`, `outline`, `hair`, `hairShadow`, `eyeWhite`, `pupil`, `mouth`, `tongue`, `teeth`, `accessoryPrimary`, `accessorySecondary`. Derived from `paletteRoles` when left out. |
| **paletteRoles** | Which token each paint plays, by element id: `{ skull: { fill: 'skin', stroke: 'outline' } }`. On install every such paint takes the face's colour for its token ("Palette tokens" below). |
| **depth** | Optional, `-1` to `1`: where the part sits in the stack (`docs/DEPTH_PARALLAX.md`), written to the root on install for a face with parallax on. Glasses sit at `0.6`, a hat at `0.8`. |
| **drivers** | Optional. How the drawing carries a movement when the registry's default would not do: `{ eyeOpen: { property, amplitude, offset, roles: { leftLower: { amplitude, offset } } } }`; a shape driver is `{ property: 'shapeKey', posePath }`, the shape as drawn at the movement's end, from the same points as the rest shape. A binding writes `amplitude × control + offset`, so a lid drawn open with `amplitude −38, offset 38` sits where it is drawn at `eyeOpen 1` and comes down 38 as the eye shuts; a role listed under `roles` gets its own numbers (the lower lid goes *up*). The property is one of `translateX`, `translateY`, `rotation`, `scaleX`, `scaleY`, `opacity`. |
| **behind** | Optional. Pieces painted *behind the face* — the back of a head of hair — by id, each a direct child of the root. On install the canvas lifts them out of the fragment to the front of the same group ("Pieces painted behind" below). |
| **parts** | Optional. The *other* semantic parts the drawing carries, by type: `{ gaze: { roles: { leftPupil, rightPupil }, capabilities: ['lookX', 'lookY', 'pupilScale'] }, eyelids: { roles: {…}, capabilities: ['eyeOpen'], drivers: {…} } }`. A pair of eyes is three parts of the rig — the eyes, the gaze and the lids — and one asset ("Composite assets" below). |

`normalizeFacePart` fills the defaults and freezes the result; it never
refuses anything. `validateFacePart` does the refusing.

## Categories

The categories read the semantic part registry (`rig-editor/semantic-parts/part-registry.js`)
rather than repeating it: the roles a category's assets may name, the ones
they must name and the movements they may claim are the part's own, so a
control added to the rig is a control an asset may claim with nothing to
update in the library. The Character Builder lists the same categories, in the
same order, from the same table.

| Category | Semantic part | Required roles | Default mount |
| --- | --- | --- | --- |
| head | `head` | head | head.center |
| eyes | `eyes` | leftEye, rightEye | eyes |
| pupils | `gaze` | leftPupil, rightPupil | eyes |
| eyelids | `eyelids` | all four lids | eyes |
| eyebrows | `eyebrows` | leftBrow, rightBrow | brows |
| nose | `nose` | nose | nose.center |
| mouth | `mouth` | mouth (cavity, teeth, tongue optional) | mouth.center |
| ears | `ears` | leftEar, rightEar | ears |
| hair | `hair` | hair (hairTop, hairBack optional) | head.top |
| facialHair | `facialHair` | facialHair | mouth.center (several) |
| accessory | `accessory` | element | head.center (several) |

Facial hair and accessories are *multiple* ("Several at once" below): a
face wears a moustache and a beard, glasses and a hat, at once. The
`facialHair` semantic part (PR 9) has one role and no control yet; a sway
of its own waits until the rest is proven (roadmap phase 11).

## Validation

`validateFacePart(asset, { taken })` returns `{ ok, asset, issues, errors, warnings }`.
Every issue carries a `code`, a `message` a person can act on, and the `field`
it is about. Errors keep an asset out of a registry; warnings let it in.

| Code | Severity | Means |
| --- | --- | --- |
| `id-missing`, `id-format`, `id-category`, `id-taken` | error | the id is absent, malformed, names the wrong category, or is already registered |
| `category-unknown` | error | not one of the eleven |
| `not-installable` | warning | the category has no semantic part yet |
| `name-missing` | error | nothing for a person to read |
| `artwork-missing`, `artwork-malformed` | error | no fragment; not well formed (a tag the scan cannot read in full -- an unquoted attribute, two glued together -- counts as malformed, never skipped); more or less than one root; a whole `<svg>` document |
| `artwork-unsafe` | error | a script, a `foreignObject`, an event handler, an external reference, external CSS or a `javascript:` URL — one issue each |
| `artwork-duplicate-id` | error | an id drawn twice inside the fragment |
| `role-unknown`, `role-artwork-missing`, `role-required-missing`, `role-shared` | error | a role the part has not got; a role naming no shape; a required role left out; one shape playing two roles |
| `capability-unsupported` | error | a movement the part has not got |
| `driver-unknown`, `driver-property-unknown`, `driver-amplitude-invalid`, `driver-offset-invalid`, `driver-pose-missing`, `driver-role-unknown` | error | a driver hint for a movement the asset does not claim, writing an unknown property, with an amplitude or an offset that is not a number (an offset left out is the property's own rest: 1 for a scale, 0 otherwise), a shape driver without its pose, or naming a role the asset does not draw |
| `capabilities-incomplete` | warning | *Limited animation*: movements the part has that this drawing does not claim |
| `mount-point-unknown`, `reference-box-invalid`, `palette-token-unknown` | error | outside the known vocabularies, or a box with no area |

### One sanitizer

The executable-content check is the sanitizer's own rules, not a second list
(roadmap phase 31). `findUnsafeSvg(markup)` in `core/security/sanitize-svg.js`
*names* every removal `sanitizeSvgMarkup` would make, sharing its two
predicates, and cleans nothing. Validation reports what it names; installing
the artwork still runs it through `sanitizeSvgMarkup`, as every fragment the
canvas appends already is.

## The registry

```js
import { FACE_PART_LIBRARY, registerFacePart, registerAccessory, createFacePartRegistry } from 'core/face-library/face-part-registry.js';

FACE_PART_LIBRARY.list('mouth');          // the assets of one category, in registration order
FACE_PART_LIBRARY.categories();           // every category with its count
registerFacePart(asset);                  // from a pack or a plugin (roadmap phase 44); throws FacePartError with .issues
registerAccessory({ id: 'accessory.round-glasses', … });
createFacePartRegistry();                 // a registry of one's own, for a test or a pack
```

A registry validates on the way in and stores the normalised, frozen asset.
`registerMany` is all or nothing: a pack with one bad asset registers none of
them, and says which. Nothing in the registry touches a document; installing
is a command over the document, below.

## Installing

`createFacePartCommands(store, history, canvas, { library, onInstalled })`
gives the builder two calls:

```js
commands.plan('mouth', 'mouth.wide');     // what replacing would do, or why it cannot: no write
commands.replace('mouth', 'mouth.wide');  // the replacement, as one undo step
// → { ok: true, partId, rootId, ids, roles, enabled, disabled, pinned, turned, removed }
// → { ok: false, reason }
```

`replace` is the roadmap's `replaceFacePart(category, assetId)`: one user
action, one undo step, the semantic part kept. It is three halves held
together, two of them pure:

| Half | Where | What it does |
| --- | --- | --- |
| **plan** | `planFacePartReplacement(document, category, asset)` | Which pieces go: the root the last install left, or else every role of the part, each with what is drawn inside it. Where the new drawing lands: the group the old part sat in, painted behind the sibling that followed it; the face group when the part is new. What the author had done to the old part: its base transform. It refuses a part *drawn around* other parts (the template's head holds every feature, its eyes hold the pupils and the lids) rather than taking those with it. |
| **swap** | `canvas.replaceArtwork(removeIds, markup, { mountPoint, before })` | The one primitive added to `svg-canvas.js`: the old nodes out, the sanitized fragment in at the same place, the document read back once. The store is not touched. |
| **apply** | `applyFacePartReplacement(candidate, plan, { asset, artwork, renamed, ids, measure })` | The document after the swap, written into a clone that the store then takes in one `execute`. |

What *apply* does, in order, is the rule the whole thing serves — **changing a
mouth never takes `smile` away**:

1. **Scrub.** Every reference to the old shapes goes with them: their roles
   (on this part and on any other that shared a shape, the tongue part being
   the case), their element records, the shape keys, pose cells, warps, pins,
   constraints, attachment points and the holds on them, followers, and the
   elements of authored handles. A symmetry peer that pointed at one is
   cleared. Scrubbing happens *before* the new artwork is taken in, because
   a new mouth is usually called `mouth` like the one it replaces.
2. **Roles.** The asset's roles are assigned on the new shapes, by their
   (possibly renamed) ids. A part that lost a role of the same name takes
   the new shape: a mouth that draws a tongue gives the tongue part its
   tongue back.
3. **Movements.** For every control the part had: kept where the drawing
   claims it, on a fresh driver — the registry's default transform strategy,
   since the old driver deformed a shape that is gone; `teeth` and `tongue`,
   which the registry knows only as shape keys, become a *drawn* driver, an
   opacity from hidden to shown, so the control does something on day one.
   Switched off the ordinary way (`disableSemanticControl`) where the drawing
   does not claim it — but a **parameter an expression, a clip or a behavior
   still names is kept**, value and poses included: the face keeps meaning
   what it meant, it just has nothing to move here. A part that is new gets
   the asset's capabilities enabled.
4. **Geometry.** Every new piece pivots about its own measured middle; the
   root takes the *fit* ("Layout and auto-fit" below) with the turn and the
   size the author had given the old part on top, so a mouth the author had
   moved and enlarged stays moved and enlarged. The mouth corner pins and
   the brow pins are regenerated on the new shapes when the face had them;
   the head-turn cells are regenerated for the new shapes only, every other
   shape's poses untouched.
5. **Record.** `part.assetId` and `part.assetRoot` say what was installed and
   which node is its instance, so the next replacement knows what to take out
   and the builder can mark the card *Current*; `part.assetFit` is the size
   the fit gave it, so the next replacement can tell the author's size from
   it. None of them is read by the runtime.

If anything refuses between the swap and the write, the canvas is reloaded
from the markup the document still holds, and nothing reaches the history.

### Ids

An asset's ids are its own — every mouth calls its lips `mouth` — and a
document holds each id once. `remapArtworkIds(markup, { taken })` renames a
taken id to `id-2`, `id-3`… and rewrites `url(#…)` and `href="#…"` inside the
fragment with it; the command frees the removed part's ids first, so
installing the same asset twice does not count up. The asset's root must
have an id (`artwork-root-id`): it is what the part is known by once
installed.

### Thumbnails

`facePartThumbnail(asset, { size })` is the asset's artwork inside its own
padded reference box, every id prefixed with `thumb-<asset>-` so the picture
never answers for the mascot's own clips and gradients (roadmap phase 23:
generated from the artwork, never a second file). A picture goes into the
page as markup, so it goes through the same cleaner as every drawing the
editor takes (`safePicture` over `sanitizeSvgMarkup`); one the cleaner
cannot read is no picture. The registration scan is a scan, not a parser:
the cleaner is what stands between an asset and the page.

### In the builder

The open category lists the library's assets for it as cards — a picture, a
name, *Current* on the one the part came from, *Limited* on one that leaves a
movement out, and the reason in the title of one the mascot refuses. A press
is `commands.replace`; the new part is selected, the status bar says which
movements still work and which have nothing to move, and one Undo puts the
old part back. A category with no part yet (accessories on the template)
offers *Add* instead of *Use* and keeps its way to Face Setup.

A part that came from the library is **one piece in the builder: its root**,
the instance the fit placed. Position, Scale and Rotation are the root's,
whichever shape inside it was clicked on the canvas (the inspector says so),
because the next replacement reads the root: a shape moved inside it would
be a move the next mouth does not get. The shapes inside are reached through
Edit Shape and Advanced, as any artwork is.

## Composite assets

An eye is three parts of the rig: the eyes (the groups that squash and
turn), the gaze (the pupils) and the lids. The template draws the pupils
and the lids *inside* the eye groups, which is why replacing the eyes used
to be refused: taking the groups out would take the pupils with them. An
asset that draws those parts itself says so under `parts`, and then it may
take them out, because their new shapes are in the fragment.

On install, each part named under `parts` takes its roles on the new shapes
(the part is made when the mascot has not got it yet) and keeps its
movements exactly as the asset's own part does: kept where the drawing
claims them, on drivers made for it — the registry's, or the asset's
`drivers` where it says how its drawing moves — and switched off where it
does not, with a parameter anything still names kept. A side movement the
face had (`eyeOpenLeft`, `lookXRight`) stays a side movement: the part
remembers its sides, and the new bindings are written with them.

The built-in eyes are composite: a socket clip, a white, a pupil, a glint,
two lids and an outline a side, the lids drawn open and parked outside the
socket with `drivers` that bring the upper one down and the lower one up.
A hair style (PR 7) will be one part with three roles the same way.

## Palette tokens

`core/face-library/palette-model.js` (roadmap phase 9). The face's colours
are twelve *tokens* — skin, skin shadow, outline, hair, hair shadow, eye
white, pupil, mouth, teeth, tongue, accessory, accessory trim — and a token
is a **reading** of the artwork, never a second record of it:

- its **colour** is the colour the part that plays its role is painted
  with: the skull's fill is `skin`, its stroke `outline`, the fringe's fill
  `hair`, the first painted shape inside an eye group `eyeWhite`, a mouth's
  fill or, for a mouth drawn as a line, its stroke (`TOKEN_SEEDS`, in order:
  the first rule whose role is played and painted seeds the token);
- its **uses** are every fill and stroke on the mascot painted that same
  colour, whichever part draws it. A colour belongs to the first token
  seeded with it, in the tokens' order.

`derivePalette(document, paints)` returns the tokens the face has colours
for and the colours nothing claims; `paints` is `canvas.describePaints()`
with no id, every element's fill and stroke. `tokenWrites(palette, token,
colour)` is the list of writes that changes a token everywhere, and
`createFacePartCommands(...).retint(token, colour)` runs them as one history
transaction. A token nothing is painted as — `skinShadow` on the template,
whose nose is a line — is simply not on this face.

**In the builder**, *Colours* is the second row of the parts list: one
swatch per token the face has, with how many pieces use it; a press opens
the colour dialog and the pick is one undo step across every use. The
per-piece swatches in the inspector stay for a colour that is one piece's.

**On install**, an asset's `paletteRoles` say which token each of its paints
plays, and `tintArtwork` paints the fragment in the face's colours before
it goes on: a round head on a green face is a green head. A token the face
has no colour for leaves the asset's own paint; the built-in assets declare
theirs (the skull is skin and outline, the whites are eye white, the brows
are hair, a bald crown's shine is nothing).

## Several at once

Most parts a face has one of, and a category replaces the part it has.
Facial hair and accessories are different: a face wears a moustache *and*
a beard, glasses *and* a hat. Those categories are `multiple`, and the rule
is **one part per mount point**: each installed asset is its own semantic
part, recorded with the mount point it was fitted to (`part.assetMount`);
an asset whose mount point is already worn replaces the part there (a
second pair of glasses replaces the first), any other joins. The built-in
facial hair mounts at the nose (moustache), the mouth (goatee), the chin
(beard) and the ears (sideburns); the accessories at the eyes (glasses),
the top of the head (hat), the left ear (earring) and the chin (bow tie),
so any of them go together.

In the builder such a category's cards always say *Add*; each worn part is
a piece of its own, the one that just went on is in hand, and the
inspector offers **Remove**: `createFacePartCommands(...).remove(partId)`
takes the part's artwork off the canvas, scrubs every reference, and drops
the part, as one undo step. Remove is only for a part that came from the
library in a multiple category; anything else is edited in Face Setup or
Artwork, as before.

## Presets

`core/face-library/face-presets.js` (roadmap phases 13 and 14; the
reader's guide is `docs/FACE_PRESETS.md`). A face style preset is a
**recipe over the library**, never a project:

```js
{ id: 'professor', name: 'Professor',
  parts: { head: 'head.oval', ears: 'ears.round', eyes: 'eyes.round-small', eyebrows: 'eyebrows.thick', nose: 'nose.hook', mouth: 'mouth.small', hair: 'hair.bald', facialHair: 'facialhair.moustache' },
  accessories: ['accessory.glasses'],
  palette: 'warm',
  hands: { left: 'fist', right: 'fist' },                      // optional: what each hand rests on
  placements: { mouth: { x: 5, y: -3, rotation: 4, scale: 1.2 } } }   // optional: a part over its fit; `scale` is both axes, or `scaleX` and `scaleY` (a flip is negative)
```

`FACE_STYLE_PRESETS` ships six — Classic Cartoon, Professor, Young, Old,
Robot, Minimal — and `FACE_PALETTES` four named palettes (warm, cool,
pale, robot), every token a colour. `MASCOT_PRESETS` is untouched: a face
style preset is applied *to the face that is there*.

**Applying** (`createFacePartCommands(...).applyPreset(id)`) is the steps the
builder already runs, in order, inside one history transaction: the
accessories and facial hair from the library that the preset does not name
come off; each named part is replaced *fresh* (where the library puts it on
this head, whatever the author had moved, turned or resized), the skull
first; the accessories go on; each part the preset places goes where it had
it over its fit (`place`: the root and the pieces it paints behind the face,
at the fit plus the move, the fit's size times the size, turned); each hand
the preset names rests on the drawing it names (`restHand`, roadmap phase
28); the palette paints every token the face then has. One undo takes the
whole preset off. A step that refuses stops the rest and is reported -- a
colour nothing is painted as, a hand or a drawing the face has not got, a
placement for a part that did not go on, are not refusals.

**Which preset a face wears** is read from its parts (`presetOfFace`): the
first preset whose every named part, and whose whole set of accessories
and facial hair, is what the face has by `assetId`. Colours are the
author's to change, so they are not read. Nothing is stored.

**Reset** applies the worn preset again — every part back where it puts
it. **Save the face as a preset** (`saveAsPreset({ name })`) reads the face
into a preset of the author's own (`facePresetFromDocument`: the parts it
wears, the colours it is painted in, where each part sits over its fit when
anywhere but on it (`placementOf`), and what each hand rests on) and keeps it in the browser
(`localStorage`, key `boop.facePresets`); the next session reads them back,
skipping any the library no longer honours. Built-in presets stay.

**Thumbnails** (`presetThumbnail`) are the preset's parts drawn where the
library draws them, in the face's paint order, in the preset's colours,
every id prefixed — generated from the same artwork every time.

`registerFacePreset` adds one from a pack (roadmap phase 44); a registry
validates that every asset a preset names is in the library, in the
category it names it for, and that its palette is known.

## Pieces painted behind

A head of hair is one part in the builder and up to three roles in the rig
(roadmap phase 10): the fringe, the crown, and what shows *behind* the
skull. SVG paints in document order and the runtime reorders only among
siblings, so a back piece drawn inside the hair's root would paint over
the face. An asset lists such pieces under `behind`, and the swap puts
them where they belong:

- the canvas primitive takes each listed piece out of the fragment and
  puts it at the front of the same group — where the old part's own back
  piece was (behind the template's ears), or first of all;
- the part records them (`part.assetDetached`), so the next replacement
  takes them out with the root, whether or not they play a role, and the
  builder moves them with it: root
  and back share one pivot and one transform, and a move, a turn or a
  resize in the inspector is written to both as one undo step;
- a group left empty by what went — the template's fringe sat alone in a
  group clipped to the skull — goes with it, rather than lingering as a
  layer with nothing in it.

The built-in hair (`short`, `spiky`, `curly`, `long`, `bald`) uses it for
the long style's back; the rest are a fringe and a crown on top.

## The skull rule

A head asset is a skull, and the template's head is the whole face: the
group every feature sits in, which is what `headX`, `headY` and `headTilt`
turn. Replacing *that* would take the face with it. So when the head that
turns is a group, a head asset replaces the **skull** — the shape the jaw
part moves — inside the group that keeps turning: the asset's `head` role
goes on the jaw, the head part keeps its roles and its movements untouched,
and the head part records the asset (`assetId`, `assetRoot`), so the next
replacement takes the last skull out and the card says *Current*. A face
whose head is a lone shape (one somebody drew, or a library head on a face
that had one) is replaced whole: the skull *is* the head that turns, and
the head's movements move it.

**The jaw.** The template's jaw is a shape key drawn from its own outline,
and every built-in skull ships the same: a path drawn twice from the same
points, at rest and with its chin dropped (`JAW_DROP`, the registry's own
jaw travel), the pose given as a shape driver on the jaw part it names
(`parts.jaw.drivers.jawOpen = { property: 'shapeKey', posePath }`). The
install makes a shape key of it on the skull (`installJawShapeKey`), driven
as the template's, `mouthOpen + jawOpen`, so the mouth opening drops the
chin too; the skull's rest shape is what the markup draws. A skull that
ships no pose (one of the author's own, say) leaves `jawOpen` off on the
jaw part, the parameter staying for the expressions that name it, and the
next skull with a pose brings it back. The fringe and the shading are
clipped to the template's own outline (`headShape`), and stay so.

## Layout and auto-fit

`core/face-library/face-layout.js` (roadmap phases 5 and 6). An asset is
drawn against the template face, and the face it joins is any size,
anywhere. The *layout context* is that face read as anchors:

```js
createFaceLayoutContext(document, measure, { mountPoint })
// → { headBox, centerX, eyeLine, scaleReference, anchors: { 'mouth.center': { x, y, measured }, … }, boxes }
```

| Field | Meaning |
| --- | --- |
| **headBox** | The skull, measured: the head role's shape, or — when the head that turns is a group, as the template's face is — the shape the jaw moves. |
| **centerX**, **eyeLine** | The head's middle; the eyes' line. |
| **scaleReference** | This head's width over the template's (188.21). The size every asset is drawn at, times this, is its size here. |
| **anchors** | One point per mount point. *Measured* from the part that plays the role when the mascot has one (a pair needs both sides); otherwise *placed* where the template keeps it, in proportion to this head. |

Boxes are measured by the canvas in each shape's own space and carried into
the space new artwork is drawn into — the group the part sits in — through
every base transform below it, the way the runtime composes them, so an
anchor is where the shape *is*.

**Fitting** is one similarity. `fitFacePart(asset, layout)` returns the base
transform of the asset's root: the reference box scaled by `scaleReference`
about its own centre, that centre put on the mount point's anchor, keeping
the offset the asset was drawn at from the template's own anchor (a nose
drawn a little above the anchor stays a little above it, in proportion). A
face with no head to measure gets nothing fitted: the asset lands where it
was drawn, which on the template's artboard is the right place.

**Replacing again.** A measured anchor is the centre of what is drawn, and a
library mouth is drawn a little below the template's anchor — replacing it
from that centre would put the next mouth lower still. So for a part that
came from the library, `layoutThroughRoot` carries the old root's own centre
(its pivot, which a turn or a resize leaves where it is) into the face and
takes that asset's drawn offset back off at the face's scale: the anchor the
last fit aimed at. A part replaced ten times stays where the first one went,
and one the author moved stays moved. The author's turn and size ride on top
(`composeFit`), the old fit's size divided out first (`part.assetFit`), so a
small head does not shrink its nose a little more at every replacement.
Replacing the *head* -- the part the face's scale is measured from -- the
reference is the scale the old head was fitted at (`assetFit.scaleX`), not
its own skull's width: a narrow skull would otherwise narrow the next head
a little at every replacement.

**Fresh.** `replace(category, assetId, { fresh: true })` lands a part where
the library puts it in proportion to this head (`layoutFromBoxes({ head })`:
the template's anchors scaled to this head), whatever the author had moved,
turned or resized on the old one -- a first install's place. The head itself
stays where it is, since it is the face, at the size its fit gave it. A
preset applies this way, so the face is the preset as designed and *Reset*
puts a moved part back.

`TEMPLATE_ROLE_BOXES` is the template's parts as the canvas measures them,
written down so the template's layout can be derived without a browser;
the browser test holds the live face to them within a pixel, so a change to
the template artwork is a change here too.

## Custom parts

Two things are the author's own (roadmap phases 15 and 27; PR 14; the
reader's guide is `docs/CUSTOM_FACE_PARTS.md`).

**A part saved from the face.** In the Character Builder, *Save as a
library part* under the piece in hand (`createFacePartCommands(...).saveAsPart`)
reads the piece's artwork from the document -- the element and everything
inside it, without the root's own transform, which is where the author put
it on *this* face and which the fit will decide on the next -- and makes an
asset of it: the category chosen, the roles named among the shapes the piece
carries, the mount point, the movements of the part the piece belongs to as
its capabilities, and the palette tokens its paints play, read from the
face's colours (`paletteRolesFromPaints`), so it comes back in whatever
colours the next face has. The reference box is the piece's own box. It is
validated exactly as a built-in is, registered with `origin: 'custom'`, and
kept in the browser (`localStorage`, key `boop.faceParts`; `loadCustomParts`
reads them back into the library on the next session, skipping any the
validator refuses now). It is a style card like any other, marked *Mine*,
with *Forget* beside it; a face wearing a forgotten part keeps its drawing.

**A library instance reshaped by hand.** Every install leaves on the part
the word its shapes sign as (`part.assetShape`, from `shapeSignature`: the
`d`, the points, the radii and the sizes of every element the instance
draws, in order -- a move, a turn or a resize of the whole is not in it).
Edit Shape drags a point, and the word no longer matches: the instance is
**custom** (`instanceIsCustom`). It keeps its category, its roles and its
movements -- nothing about the part changes -- and the builder says so
(*Custom · from Round*), no card is current for it, and the card of the
asset it came from puts the library drawing back. Nothing is stored for
this beyond the word: the SVG is the truth, and the word is how the builder
reads it.

## Face packs

Roadmap phase 44 asks that a module outside the editor be able to add
faces. The unit is a **pack**: one JSON document of parts and presets
(`face-pack.js`).

```json
{ "format": "boop-face-pack", "version": 1, "id": "grins", "name": "Grins",
  "parts":   [ { "id": "mouth.grin", "category": "mouth", "name": "Grin", "artwork": "<g id=\"mouth-grin\">…</g>", "roles": { "mouth": "…" }, "capabilities": ["mouthOpen", "smile"], "referenceBox": { "x": 88, "y": 150, "width": 64, "height": 20 } } ],
  "presets": [ { "id": "grinning", "name": "Grinning", "parts": { "mouth": "mouth.grin" }, "palette": "warm" } ] }
```

A part is an asset as "An asset" describes it; a preset is a preset as
"Presets" describes it, and may name a part of the same pack.
`validateFacePack` checks that the file says what it is (`pack-format`,
`pack-version`), the pack's id and name (`pack-id-missing`,
`pack-id-format`, `pack-name-missing`, `pack-empty`), then every part and
every preset against the library *and the pack itself*, each issue naming
its entry (`parts[1].id`, `presets[0].parts.mouth`); an id a refused entry
asked for is still taken, so a duplicate is named as one. `installFacePack`
is all or nothing: a pack with one bad entry registers nothing. What goes
in is the author's own (`origin: 'custom'`) with the pack's id on it
(`pack`), so the cards say **Pack** (the pack named in the badge's title),
the parts and presets can be forgotten one by one as any of the author's,
and they are kept in the browser with them (`saveCustomParts`,
`saveCustomPresets`) and read back on the next open. The artwork goes
through the same validation as any asset and, on the face, through the
same sanitizer as every drawing the editor takes.

In the editor, **••• → Import face pack** takes the file
(`facePartCommands.installPack`); the status says what came in, or why the
pack was refused. From a module, `registerFacePack(pack)` does the same
into the editor's library without storage, beside `registerFacePart`,
`registerAccessory` and `registerFacePreset`. There is no marketplace and
no download: a pack is a file somebody hands over.

## Migration

A project saved before the library has semantic parts and no word about
where their drawings came from (roadmap phases 42 and 43; PR 15). Opening
it -- a project file, a recovered draft -- runs `identifyFaceParts`
(`core/face-library/face-part-migration.js`) on the state before it reaches
the store: for every part with no asset yet, the library's assets of its
category are tried, and the one whose artwork *signs as* the part's drawing
(`shapeSignature`: the shapes, not the ids, not the whole part's transform;
a back piece painted behind the face taken out of the asset's word, since
it stands outside the root once installed) is written on the part --
`assetId`, `assetRoot` (named after the asset's root, or the element a role
names, or a group above it), `assetMount`, `assetShape`, `assetDetached`.
The fit is not known again, so the next replacement measures the face as
for a first install. What matches nothing is left as it is: the builder
reads it as the author's own, a part with no card current, which is what
it is. Nothing about the artwork changes, nothing is deleted, and a
document this cannot read opens as it was: the whole pass is caught.

The status line says how many parts were recognised. A fresh template is
not an old project: its drawings are its own until a card replaces one.

## Animation compatibility

Every built-in asset has a row in `core/tests/face-part-animation-matrix.test.js`
(roadmap phase 25): the asset goes on the template face through the same
command a card runs, every movement it claims -- its own and those of the
parts it draws with it -- must be on, and driving each movement's parameter
through the runtime's own frame compiler (`compileRigFrame`, with the
keyforms, the pins, the shape keys and the hands the document carries) must
change what the part draws: the shape, its transform, its opacity, or the
group above it, since a head turns as the face. An asset that claims a
movement its drawing cannot carry fails there, before it reaches a face.

## The built-in assets

The V1 library of the roadmap (phase 45), forty-two assets: the basic face
library of PR 6 and the seven it asked for on top, drawn in the template
face's frame so the same reference boxes fit them onto any face. One file
per category in `core/face-library/builtin/`. A card's title lists every
movement of its category, `✓` carried or `–` not (phase 26), under *Fully
animated* or *Limited animation*.

| Category | Assets | Carries | Notes |
| --- | --- | --- | --- |
| head | `round`, `oval`, `square-soft`, `narrow` | headX, headY, headTilt; jaw: jawOpen | a skull each, a path with its jaw pose; on the template, the skull rule |
| eyes | `round-large`, `round-small`, `sleepy`, `cartoon`, `minimal` | eyeOpen; pupils: lookX, lookY, pupilScale; lids: eyeOpen | composite: sockets, whites, pupils, glints, lids, outlines |
| eyebrows | `thin`, `normal`, `thick`, `flat`, `expressive` | browRaise, browTilt | mirrored pairs |
| nose | `dot`, `hook`, `soft`, `cartoon` | noseScrunch | |
| mouth | `simple`, `wide`, `small`, `cartoon`, `expressive` | mouthOpen, smile, mouthWidth; teeth and tongue where drawn | `cartoon` carries all five |
| ears | `round`, `large`, `small` | earWiggle | painted behind the skull, as the template's |
| hair | `short`, `spiky`, `curly`, `long`, `balding`, `bald` | hairSway, hairLift | one part, up to three roles; `long` paints its back behind the face |
| facialHair | `moustache`, `large-moustache`, `goatee`, `beard`, `sideburns` | — | four mount points: any of them together |
| accessory | `glasses`, `square-glasses`, `hat`, `earring`, `bow-tie` | — | four mount points; the glasses and the hat carry a depth |

Every one installs on the template and leaves a rig the validator has
nothing to say about; the unit suite proves it for the whole list.

## Files

```text
project/editor/core/face-library/
  face-part-model.js        categories, mount points, palette tokens, normalize, the artwork scanner, capabilities
  face-part-validation.js   validateFacePart and its codes
  face-part-registry.js     createFacePartRegistry, FACE_PART_LIBRARY, registerFacePart, registerAccessory
  face-part-artwork.js      remapArtworkIds, documentIds, facePartThumbnail
  face-part-install.js      planFacePartReplacement, scrubRemovedArtwork, applyFacePartReplacement
  face-part-commands.js     createFacePartCommands: plan, layout and replace, one undo step
  face-layout.js            the layout context, the template's boxes, fitFacePart, layoutThroughRoot, composeFit
  palette-model.js          TOKEN_SEEDS, seedTokens, derivePalette, tokenWrites, tintArtwork
  face-presets.js           FACE_PALETTES, FACE_STYLE_PRESETS, the preset registry, presetOfFace, planFacePreset, presetThumbnail, the browser store
  face-pack.js              normalizeFacePack, validateFacePack, installFacePack, registerFacePack: a JSON file of parts and presets, all or nothing
  builtin/                  heads.js, eyes.js, brows.js, noses.js, mouths.js (+ mouth-simple.js, mouth-wide.js), ears.js, hair.js, facial-hair.js, accessories.js, nose-dot.js, index.js
project/editor/svg-editor/svg-canvas.js        replaceArtwork
project/editor/core/security/sanitize-svg.js   findUnsafeSvg
project/editor/core/tests/face-part-model.test.js
project/editor/core/tests/face-part-validation.test.js
project/editor/core/tests/face-part-registry.test.js
project/editor/core/tests/face-part-artwork.test.js
project/editor/core/tests/face-part-install.test.js
project/editor/core/tests/face-part-commands.test.js
project/editor/core/tests/face-layout.test.js
project/editor/core/tests/face-pack.test.js
project/editor/core/tests/helpers/fake-face-canvas.js   the swap over the template's markup, in Node
tests/e2e/ux46-face-layout.spec.js
```

## What is deliberately not here yet

- **Orientation.** A part inherits the turn of the group it is drawn into;
  a head that is a lone shape somebody turned does not turn what is fitted
  beside it. The head-pose rig, not the fit, is what turns a face.
- **A jaw on a face whose head is a lone shape**: the skull is the head
  that turns there, and a jaw part takes it only when the asset ships a
  pose; a head of the author's own with no pose leaves `jawOpen` off.
- **Switching a movement back on** after a replacement turned it off: Face
  Setup's, as it always was.
- **Overrides beyond the transform and the palette** (phase 15's spacing
  as a recorded override): what the author moves is on the artwork, not on
  the part.
