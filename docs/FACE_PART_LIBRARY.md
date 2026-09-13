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
  host: { part: 'ears', role: 'leftEar' },   // optional: the part it belongs to, and is drawn inside
  variant: { of: 'mouth.wide', style: 'workshop' },  // optional: the drawing it restyles, and into which style
  slot: 'beak',                      // optional: where Design offers it, when that is not its category
  morphologies: ['beak', 'monster'], // optional: the kinds of face it suits; none means every kind
  tags: ['duck', 'pointed'],         // optional: words an author finds it by
  palette: ['mouth', 'teeth'],       // the colour tokens it uses
  origin: 'builtin'                  // or 'custom'
}
```

| Field | Meaning |
| --- | --- |
| **id** | `category.name`. The category first, so a listing sorts by it and a mismatch is visible. |
| **category** | What a person calls the part. Decides the semantic part, the roles it may name and the movements it may claim. |
| **artwork** | An SVG fragment drawn in the template face's frame (`FACE_ARTBOARD`: the 240 × 240 square the face fills, and sixty units of headroom above it for what a head wears). One root element, usually a `<g>`; ids unique within it. |
| **roles** | Which shape plays which role of the semantic part. Every required role of the part must be named; one shape plays one role. |
| **capabilities** | The movements this drawing carries. A subset of the part's controls; what is left out is *Limited animation* (roadmap phase 26), reported as a warning and shown on the badge. |
| **referenceBox** | The box the artwork was drawn against. Auto-fit (PR 4) maps it onto the measured box of the face it joins, the way `fitFeatureArtwork` already does for the eyebrows. |
| **mountPoint** | One of `FACE_MOUNT_POINTS` (roadmap phase 5): `head.top`, `head.center`, `head.bottom`, `eyes`, `eye.left`, `eye.right`, `brows`, `brow.left`, `brow.right`, `nose.center`, `mouth.center`, `ears`, `ear.left`, `ear.right`, `hair.top`. The layout context resolves it to a point on the face the asset joins ("Layout and auto-fit" below). |
| **host** | Optional. The part this drawing *belongs to*, as a semantic part and one of its roles: `{ part: 'ears', role: 'leftEar' }`. A mount point is an anchor, resolved once at fit time; a host is a parent, and the install draws the artwork inside the shape that plays the role, so everything that moves the host moves this too ("Hosted on a part" below). |
| **variant** | Optional. The drawing this one *restyles* and the style it restyles it into: `{ of: 'mouth.wide', style: 'workshop' }`. Same category, same roles, same movements, another drawing. It is reached through the drawing it restyles and is no card of its own ("The style axis" below). The chain is one link long: a style of a style is refused, and `baseAssetId` is how any drawing finds the one it is a style of. |
| | **Soft Cartoon is the style the library is drawn in** (`FACE_BASE_STYLE_ID`, MASC-08A), so no asset is ever a `soft-cartoon` variant — asking for the base style resolves to the drawing itself. A base drawing has variants; variants do not have variants. |
| **slot** | Optional. Where Design offers the drawing, when that is not simply its category (`docs/MASC_LIBRARY_BASELINE.md`; MASC-01). A slot is what an author picks and a category is what the rig understands, and several slots may name one category: `beak` installs as a `mouth` because it opens, and `muzzle`, `whiskers`, `horns`, `crest`, `antenna` and `panels` install as accessories, because that is what they are to the runtime. Left out, the slot *is* the category. |
| **morphologies** | Optional. The kinds of face the drawing suits, from `FACE_MORPHOLOGY_IDS`: `human`, `muzzle`, `beak`, `robot`, `monster`. **An asset that says nothing is universal** — which is why every drawing written before the field existed keeps working with no migration. `['*']` says the same thing out loud; saying both is refused. |
| **tags** | Optional. Words an author searches by: `cat`, `wolf`, `pointed`. Free vocabulary on purpose — a tag nobody has used yet is how the next species starts. Lower case, digits and dashes. |
| **palette** | The colour tokens the artwork uses, from `PALETTE_TOKENS` (roadmap phase 9): `skin`, `skinShadow`, `outline`, `hair`, `hairShadow`, `eyeWhite`, `pupil`, `mouth`, `tongue`, `teeth`, `accessoryPrimary`, `accessorySecondary`. Derived from `paletteRoles` when left out. |
| **paletteRoles** | Which token each paint plays, by element id: `{ skull: { fill: 'skin', stroke: 'outline' } }`. On install every such paint takes the face's colour for its token ("Palette tokens" below). |
| **depth** | Optional, `-1` to `1`: where the part sits in the stack (`docs/DEPTH_PARALLAX.md`), written to the root on install for a face with parallax on. Glasses sit at `0.6`, a hat at `0.8`. |
| **turn** | Optional. How each role the drawing plays behaves in the 2.5D head turn, where the role table's own answer would not do: `{ element: { depth: 0.7, side: null, narrow: true } }`, the flags being `depth`, `side`, `squash`, `narrow`, `ear`, `sweeps`, `foreshorten` and `tilt` (`docs/HEAD_POSE_2_5D.md`, "Which parts turn"). A role left out keeps the table's answer; a profile written is read whole rather than merged over one. |
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
face wears a moustache and a beard, glasses and a hat, at once. A category is
not a row of the builder, either: several **visual slots** may name one category
— `Muzzle`, `Whiskers` and `Accessories` all install as `accessory`, and `Beak`
installs as `mouth` — and the slot an asset is offered in is its own `slot`
field, its category by default (`face-morphologies.js`, MASC-02 and MASC-08B). The
`facialHair` semantic part has one role and one movement, and the movement
is not its own: it is being carried by the face under it ("Carried by the
face under it" below). A sway of its own still waits (roadmap phase 11).

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
| `artwork-unsafe` | error | a script, a `foreignObject`, an event handler, an external reference (an `href`, a `src`, or a paint -- `fill`, `stroke`, `filter`, `mask`, `clip-path`, a marker, a `cursor` -- whose `url(` is not a `#` reference, a declaration smuggled after a colour or a character reference spelling `url(` included), external CSS or a `javascript:` URL — one issue each |
| `artwork-duplicate-id` | error | an id drawn twice inside the fragment |
| `role-unknown`, `role-artwork-missing`, `role-required-missing`, `role-shared` | error | a role the part has not got; a role naming no shape; a required role left out; one shape playing two roles |
| `capability-unsupported` | error | a movement the part has not got |
| `driver-unknown`, `driver-property-unknown`, `driver-amplitude-invalid`, `driver-offset-invalid`, `driver-pose-missing`, `driver-role-unknown` | error | a driver hint for a movement the asset does not claim, writing an unknown property, with an amplitude or an offset that is not a number (an offset left out is the one that puts the drawing at rest as drawn when the movement sits at its default: the property's neutral value -- 1 for a scale or an opacity, 0 otherwise -- less the amplitude times that default), a shape driver without its pose, or naming a role the asset does not draw |
| `turn-role-unknown`, `turn-empty`, `turn-value-invalid`, `turn-side-unknown` | error | a turn profile for a role the asset does not draw; one that says none of the flags (a flag nobody knows is dropped on the way in, so a profile left saying nothing meant to say something); a depth, a foreshorten or a tilt that is not a number; a side that is neither of a face's two |
| `capabilities-incomplete` | warning | *Limited animation*: movements the part has that this drawing does not claim |
| `mount-point-unknown`, `reference-box-invalid`, `palette-token-unknown` | error | outside the known vocabularies, or a box with no area |
| `host-unknown`, `host-role-unknown`, `host-own` | error | the drawing hangs on a part the rig has not got, on a role that part has not got (half a host being no host), or on its own category, which would be a drawing hanging on itself |
| `variant-asset-missing`, `variant-style-missing`, `variant-style-format` | error | half a variant is no variant: a drawing restyled with no style named, a style restyling nothing, or a style name that is not lower-case letters, digits and dashes |
| `slot-unknown`, `slot-category` | error | a slot nobody has heard of, or one that holds another category's drawings: a `beak` drawn as a pair of ears would be offered where it cannot install |
| `morphology-unknown`, `morphology-mixed` | error | a kind of face nobody has heard of (a typo would quietly hide the drawing in every kind there is), or an asset claiming both `*` and a list, which is two different claims |
| `tag-format` | error | a tag that is not lower-case letters, digits and dashes |
| `variant-unknown`, `variant-category`, `variant-own`, `variant-chained`, `variant-taken` | error | the drawing restyled is not in the library, is of another category, is the asset itself, is itself a restyle (the chain is one link long), or already has a drawing answering for that style |

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

FACE_PART_LIBRARY.list('mouth');          // every asset of one category, in registration order
FACE_PART_LIBRARY.cards('mouth');         // the ones the category offers on their own: what the builder lists
FACE_PART_LIBRARY.variant('mouth.wide', 'workshop');   // the drawing that restyles it into that style, or null
FACE_PART_LIBRARY.variantsOf('mouth.wide');            // every style of one drawing
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
| **swap** | `canvas.replaceArtwork(removeIds, markup, { mountPoint, before, behind, rehome })` | The one primitive added to `svg-canvas.js`: the old nodes out, the sanitized fragment in at the same place, the document read back once. The store is not touched. |
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
is **one part per slot**: each installed asset is its own semantic part,
recorded with the mount point it was fitted to (`part.assetMount`) and what
it hangs on (`part.assetHost`); an asset whose slot is already worn replaces
the part there (a second pair of glasses replaces the first), any other
joins. The host is half of the slot because two accessories can be fitted to
one anchor and still be two things — an earring on each ear — and without it
putting on the second would take the first off. The built-in facial hair
mounts at the nose (moustache), the mouth (goatee), the chin (beard) and the
ears (sideburns); the accessories at the eyes (glasses), the top of the head
(hat), each ear (the two earrings) and the chin (bow tie), so any of them go
together.

In the builder such a category's **cards are toggles**, so taking a part off
is where putting it on is: press the card of something the face is not
wearing and it goes on — joining a free slot, replacing whatever is at the
same one — and press the card of something it *is* wearing and that comes
off. Whether a category toggles is the category's `multiple`, read from the
one table; there is no list of names anywhere.

A card says which way it will go before it is pressed. A worn one is marked
*On ×* rather than *Current*, its title reads "Glasses: on the face now.
Press to take it off", and its name for a screen reader is *Take Glasses
off*; any other card still reads *Add*. The keyboard and a touch screen
reach both presses exactly as they reached the one press, since it is the
same button (`aria-pressed` says whether it is worn, and the arrow keys walk
the row). A drag puts a drawing *on* the mascot, so a card whose press takes
its part off is not draggable — there is nothing to drop.

The card the face wears may be wearing a *restyle* of that card (the style
axis, below): the toggle takes off the part that is really there, never the
drawing named on the card. A library instance somebody has reshaped is no
card's, so it is taken off from the inspector, where it is in hand.

### One slot is not always enough (MASC-08B)

The mount point and the host are enough to sort *accessories* — glasses on the
eyes, a hat on top, an earring on each ear. They stop being enough the moment
two things a person would call different parts land in the same place. A cat's
muzzle and its whiskers are both `accessory` at `head.center` with no host, and
so is a badge: by the slot rule alone, putting the muzzle on would take the
badge off.

The answer is that Design lists **visual rows**, not categories
(`docs/CHARACTER_BUILDER.md`, "Rows are not categories"), and a row says which
parts the slot rule may look at:

```text
commands.replace(category, assetId, { targetPartId })   this exact part goes
commands.replace(category, assetId, { within: [...] })  the slot rule, among these
commands.replace(category, assetId, { within: [] })     none of them: a new part
commands.replace(category, assetId)                     every part of the category, as before
```

The last line is the historic behaviour, unchanged, and it is what a preset
still applies through. A row of its own — Muzzle, Whiskers, Beak, Horns, Crest,
Antenna, Panels — names the part it holds and adds a new one when it is empty; a
catch-all row — Accessories, Facial Hair — sorts by mount point among its own
parts. A category a face wears one of is untouched: there is one mouth, and a
beak replaces it.

Either way it is one command and one undo step:
`createFacePartCommands(...).remove(partId)` takes the part's artwork off the
canvas, scrubs every reference, and drops the part — and takes what hangs
inside it with it, because a part whose drawing has gone is not a part
("Hosted on a part"). Each worn part is still a piece of its own, the one
that just went on is in hand, and the inspector offers **Remove** for it as
before. Remove is only for a part that came from the library in a multiple
category; anything else is edited in Face Setup or Artwork, as before.

## Hosted on a part

An accessory usually belongs to the *face*: glasses sit on it, a hat sits on
top of it. An earring belongs to the **ear**. The difference is not where it
lands — a mount point answers that — but what happens to it afterwards: a
mount point is an anchor resolved once, at fit time, and nothing remembers it,
so an earring fitted to `ear.left` and dropped beside the ear stayed exactly
where the template's ear had been the moment a different pair of ears went on.

An asset says what it belongs to with `host`, a semantic part and one of its
roles, and the install **draws it inside** the shape that plays that role:

- the insertion parent is the host's element rather than the group the part
  would otherwise join (`planFacePartReplacement` decides it, `replaceArtwork`
  honours it), so the fragment lands in the ear;
- the fit is read in that group's own space — the face's boxes are carried
  *down* into it (`boxInMountSpace`), or the host's scale would be counted
  twice — and anchored on the host's own box, which is also the answer for a
  face with one ear, where `ear.left` has no pair to be measured from;
- what hangs on a part is not measured as part of it (`faceRoleBoxes`), or the
  ear would read half an earring taller and everything fitted to it would
  creep down the page at every replacement.

Nothing else is needed. The runtime writes a `transform` per node, so SVG
composes the nesting: the earring inherits `earWiggle`, the head turn, a
follower's lag and anything else that ever moves an ear, with no solver, no
new document array and nothing to run per frame. In the generated turn it
therefore writes *nothing of its own* — a sample is what a part adds to the
parts it is drawn inside, and what an earring adds to its ear is nothing.

**Replacing the host re-homes what hangs on it.** The ears going would take
the earring's drawing with them, and every reference to it — a constraint is
scrubbed with its source as readily as with its target, which is why this
severed things silently before it was a feature. So the plan lifts a hosted
part out of the removal, the swap takes its node across into the new shape
that plays the same role, and the same pass that re-homes roles re-homes it:
its part, its movements and its own drawing are untouched, and it is fitted to
the ear it has just been hung on, because the new ear is a different shape and
the numbers that put it on the old one were in the old one's frame. Taking the
host off takes what hangs on it off too: a part whose drawing has gone is not a
part.

**A host that cannot hold a drawing** — a pair of ears drawn as two bare
shapes, as the library's own were before this — is followed instead, with a
`rigConstraints` entry of type `parent` (`docs/FACE_CONTROL_RIG.md`) offset by
the distance the two rest at. That copies where the host goes, which is all a
constraint can honestly copy of a shape that carries no children; the moment a
host that *is* a group arrives, the constraint goes and the nesting takes over,
because two links would move the part twice. It is the reason library ears draw
a group per side: an ear is something things hang on.

## Carried by the face under it

The complaint, in the words it arrived in: *"barbe et moustache ne suivent
pas les mouvements de la bouche ni de la mâchoire"*. Open the mouth on a
bearded face and the chin lengthened seventeen units while the beard stayed
exactly where it was drawn, which reads as hair floating in front of a face.

`facialHair` was a part with **no movements at all**, and every drawing
claimed none, so nothing drove them. What it has now is one movement, and the
honest description of it is that *hair growing on a face does not move on its
own — it is moved by the face under it*:

```text
  mouthOpen + jawOpen ──┬──▶ the head's own outline    (the chin, +17)
                        ├──▶ goatee   translateY +18
                        ├──▶ beard    translateY +15
                        ├──▶ moustache translateY −3
                        └──▶ sideburns  —  claims nothing
```

The movement is called **`jawOpen`**, because the jaw dropping is what moves
the hair, and it is driven by `mouthOpen + jawOpen` — the very sentence the
template's chin is stretched by (`templates/template-project.js`), so the
mouth takes the jaw with it and an author can still drop the jaw alone. The
hair therefore reads exactly what the chin reads, and the two stay together at
every combination of the two controls rather than only at the ends.

**Why a binding and not a host.** A host is a parent, and SVG composes a
parent's **transform** onto what is drawn inside it ("Hosted on a part"
above) — the right answer for an earring on an ear, and no answer at all
here. This face's mouth and jaw move by *deforming*: a shape key on the lip,
a shape key on the silhouette. A deformation does not travel down a
transform. Nor is there anything to be drawn inside: the mouth and the head
are both a `<path>`, and a path has no inside, so the fallback a host without
a group falls to — a `rigConstraints` entry of type `parent` — would copy a
transform that never changes. The moment a mouth *is* a group whose lips move
rigidly, a host is still the better answer for something stuck to it; for a
face that deforms, the sentence is.

**Each drawing says how much of it reaches its own hair**, signed
(`builtin/facial-hair.js`, `carriedBy`), because what decides the amount is
where the hair is rooted and the drawing is the only thing that knows that.
A beard hangs from the jaw all round the chin and travels with it; a goatee is
caught between a lower lip that drops with the mouth and a chin that lengthens
with the jaw, and travels furthest; a moustache is on the *upper* lip, which
this mouth does not move at all when it opens, so carrying it down would slide
it into the opening beneath it and it lifts a little instead. **Sideburns
claim the movement not at all** — they are on the temples, above the line the
lower face stretches from — which is a card that reads *Limited animation*,
and is the honest thing for it to read.

A movement driven by words other than its own needs those words to be
parameters of the rig, or the validator refuses the binding for naming
something that is not there. Enabling one therefore creates every parameter
the registry describes and the sentence names, and disabling or removing the
part offers them all back; a word anything else still says stays, as ever.
So a beard goes onto a face that has no mouth and no jaw, and brings the two
controls that move it.

## The style axis

A preset names an asset id, and until V3-05 the *look* of that asset lived
only inside its SVG. So a preset that wanted its own version of the glasses
— thicker frames, a different sheen, a shape that goes with its head — had
only one way to ask: ship a second pair of glasses. Six presets over eight
categories is forty-eight more cards in a column that offers five mouths,
and nobody could browse that.

The axis is one field on an asset and one on a preset:

```js
// the drawing: the same part, another look
{ id: 'accessory.glasses-workshop', category: 'accessory', name: 'Glasses, workshop',
  variant: { of: 'accessory.glasses', style: 'workshop' }, artwork: '…', roles: { element: 'accessory' },
  paletteRoles: { accessory: { stroke: 'accessorySecondary' } }, referenceBox: { … } }

// the preset: the parts it names, in the look it wants them in
{ id: 'workshop-professor', name: 'Workshop professor', style: 'workshop',
  parts: { head: 'head.oval', mouth: 'mouth.small', … }, accessories: ['accessory.glasses'], palette: 'warm' }
```

**Resolving is one function**, `styledAsset(assetId, style, library)`: the
drawing that restyles `assetId` into `style` if the library holds one, and
`assetId` itself otherwise. Every reading of a preset goes through it —
what a press puts on (`planFacePreset`), what the card's picture is drawn
from (`presetThumbnail`), and which preset a face is read as wearing
(`presetOfFace`) — so a style cannot be honoured in one of them and
forgotten in another. There is nothing keyed on an id anywhere: a style is
a name, the library answers or does not, and a preset asking for a style
nobody has drawn yet wears exactly the drawings it names. That is what makes
the restyle of V3-06 additive: a preset gets its own head the moment
somebody draws one, with no code and no second preset.

**A variant is an asset like any other.** It is validated the same way,
installed by the same command, fitted by the same layout, painted from the
same tokens, and driven by the same animation matrix (`library.list()` is
still everything the library holds, which is what that test walks). Three
rules keep it a lookup rather than a maze: it restyles a drawing of its own
category; it does not restyle another restyle (`variant-chained`, so the
chain is one link long); and no two drawings answer for the same style of
the same part (`variant-taken`).

**What it is not is a card.** `library.cards(category)` is what the builder
lists — every asset that restyles nothing — and `library.list(category)` is
still everything. So six looks of the glasses are six drawings and one card.
The column stays readable, and the variant is still reachable two ways: the
preset that asks for its style puts it on, and the part remembers the drawing
it came from, so *Restore library drawing* (`Reset → shape`) puts that
drawing back, restyle and all. A face wearing a restyle marks the card of
the drawing it restyles as *Current*, and pressing that card puts that
drawing on — a change of look the author asked for.

**One accessory of two, in its own colour.** A preset's `palette` is
face-wide by construction: `retint` is one token everywhere it is used. The
per-instance colour V3-04 deferred is this axis and nothing else — a restyle
carries its own `paletteRoles`, so the workshop glasses can play
`accessorySecondary` where the bow tie beside them plays `accessoryPrimary`,
and a paint with no token at all stays the colour it was drawn in. There is
no per-instance colour field on a preset, so there is nothing for *Save as a
preset* to lose: what a face wears is drawings, and the drawings are saved
by id.

**A preset that wants one part differently** names that part by its own id:
a variant id resolves to itself, so `accessories: ['accessory.glasses-workshop']`
on a preset with no style, or with another, is a sentence the vocabulary
already says.

**A pack is the vehicle for a whole look** ("Face packs" below): parts and
presets in one file, the parts checked against the library *and the pack*,
so a pack may write a style down before the drawing it restyles and is taken
in all or nothing. The author's own parts are read back from the browser the
same way: a drawing before the styles of it.

## Presets

`core/face-library/face-presets.js` (roadmap phases 13 and 14; the
reader's guide is `docs/FACE_PRESETS.md`). A face style preset is a
**recipe over the library**, never a project:

```js
{ id: 'professor', name: 'Professor',
  parts: { head: 'head.oval', ears: 'ears.round', eyes: 'eyes.round-small', eyebrows: 'eyebrows.thick', nose: 'nose.hook', mouth: 'mouth.small', hair: 'hair.bald', facialHair: 'facialhair.moustache' },
  accessories: ['accessory.glasses'],
  style: 'workshop',                                           // optional: the look it wants those drawings in ("The style axis" above)
  palette: 'warm',
  hands: { left: 'fist', right: 'fist' },                      // optional: what each hand rests on
  placements: { mouth: { x: 5, y: -3, rotation: 4, scale: 1.2 },      // optional: a part over its fit; `scale` is both axes, or `scaleX` and `scaleY` (a flip is negative)
                'accessory.glasses': { x: 7, y: -2 } } }              // a category names the one part a face wears of it; an asset id names one instance of several
```

`FACE_STYLE_PRESETS` ships six — Classic Cartoon, Professor, Young, Old,
Robot, Minimal — and `FACE_PALETTES` four named palettes (warm, cool,
pale, robot), every token a colour. `MASCOT_PRESETS` is untouched: a face
style preset is applied *to the face that is there*.

**Applying** (`createFacePartCommands(...).applyPreset(id)`) is the steps the
builder already runs, in order, inside one history transaction. Every asset
the preset names is resolved through its style first (`styledAsset`), so
each step below is about the drawing that will really be there: the
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

**The style is part of that identity**, because what is compared is the
drawings the preset puts on, not the ids it writes down: two presets over
the same parts in two styles are two faces, and the one whose drawings are
on is the one the face reads as. Reading through the style instead would
make every restyle an alias of every other, which is the failure the axis
exists to prevent. The price is that putting one part back to the drawing
the preset restyled is no longer that preset — which is true: the face is
wearing another drawing.

**Reset** applies the worn preset again — every part back where it puts
it. **Save the face as a preset** (`saveAsPreset({ name })`) reads the face
into a preset of the author's own (`facePresetFromDocument`: the parts it
wears — a restyled drawing under its own id, since a face has parts and not
a style — the colours it is painted in, where each part sits over its fit when
anywhere but on it (`placementOf`), and what each hand rests on) and keeps it in the browser
(`localStorage`, key `boop.facePresets`); the next session reads them back,
skipping any the library no longer honours. Built-in presets stay.

Since MASC-08C it also writes down **what kind of face it makes**, when the face
says so. `presetMorphologyClaim` reads the recipe's own drawings -- the visual
slots they sit in that a person's face has not got -- and a face wearing a cat's
muzzle and its whiskers is saved as a `muzzle` preset, offered under Muzzle
afterwards. A face of nothing but universal drawings claims **nothing**:

```text
presetMorphology(preset)        the reading   — a claimless preset is a person
presetMorphologyClaim(recipe)   the writing   — silence stays silence
```

The two differ by exactly that case, and deliberately. Reading a claimless
preset as human is a classification anybody can revisit; writing `human` into
the author's saved preset is a fact they never stated and could never tell from
a choice afterwards. The **Type row is never consulted**: it is a session
preference about what Design is *offering*, and a preset is made of what the
mascot is really wearing. Tags are the caller's (`saveAsPreset({ name, tags })`)
and default to none: a species — `cat`, `fox` — is editorial, and is never
invented from a kind of face.

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
next skull with a pose brings it back.

**The clip follows the skull.** The fringe and the face shading are cut to a
copy of the head's own outline kept in the definitions (`headShape` on the
template), and nothing used to write to that copy: installing any skull left
both cut to the head that had gone, so the shading spilled over the new
outline on one side and stopped short of it on the other, and the fringe hung
off it. The install rewrites it (`followHeadClips`), and what it recognises is
the **drawing** rather than an id -- the clip that was the old outline is the
one that becomes the new one, so a clip the author renamed still follows and a
clip cut from anything else is left alone. The outline carries the fit as a
`transform`, because a clip is read in the space of the piece it cuts: the
same drawing, in the same place, as the skull the viewer is looking at.

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
asset of it: the **visual slot** chosen, the roles named among the shapes the
piece carries, the mount point, the movements of the part the piece belongs to
as its capabilities, and the palette tokens its paints play, read from the
face's colours (`paletteRolesFromPaints`), so it comes back in whatever
colours the next face has. The reference box is the piece's own box. It is
validated exactly as a built-in is, registered with `origin: 'custom'`, and
kept in the browser (`localStorage`, key `boop.faceParts`; `loadCustomParts`
reads them back into the library on the next session, skipping any the
validator refuses now). It is a style card like any other, marked *Mine*,
with *Forget* beside it; a face wearing a forgotten part keeps its drawing.

### The round trip (MASC-08C)

```text
Muzzle row → Save as a library part → slot 'muzzle' → the library → Muzzle row
```

That is the invariant, and until MASC-08C it was broken at the third arrow: the
form asked for a *semantic category*, so a pack's muzzle reshaped and saved came
back an accessory and Design listed it beside the glasses. The form asks for the
slot now, and the category is **derived** from it:

```text
slot 'muzzle'  →  FACE_SLOTS.muzzle.category  →  category 'accessory'
slot 'beak'    →  FACE_SLOTS.beak.category    →  category 'mouth'
```

The two are never asked for as competing truths. An author picks *Muzzle*;
nobody then has to explain why they must also pick *Accessory*. The derived
category is said once, in a line under the field, so nothing is hidden either.

```js
saveAsPart({ rootId, slot, name, roles, mountPoint, morphologies, tags, description })
```

`category` on its own is still read, and means the slot of the same name, so
every call written before this keeps working. The id is still `category.slug`
(`accessory.my-muzzle`), because that is what the rig gets and a listing sorts by
it. A slot that does not exist is refused before anything is built, and
everything else goes through `validateFacePart` exactly as an imported asset
does: a slot that does not hold this kind of part, a kind of face nobody has
heard of, a word that is not a tag.

The form offers only the slots whose semantic part could be filled from the
shapes the piece carries -- one shape is not a pair of eyes -- and the test is
the library's own required roles, not a second reading of them.

**What it suits.** *Works with* is the five kinds of face, and **nothing ticked
means every kind**: that is the library's contract for a drawing that says
nothing, which is why the field cannot be required. The defaults are:

```text
from a drawing the library knows   what that drawing says, `[]` included
a new drawing saved as a row a     the kind being browsed, as a suggestion
  person has not got, while
  Design is offering that kind
anything else                      universal
```

The first line matters most: a drawing that said nothing about the kinds of face
it suits must not acquire a restriction by being edited. The second is a
suggestion and nothing more -- it is ticked, and an author who disagrees unticks
it before saving.

**What to find it by.** *Tags* is free vocabulary, typed as words:
`Cat, fox pointed` becomes `['cat', 'fox', 'pointed']` (`parseFaceTags`). There
is no taxonomy and no search engine yet; `assetTags` and `assetHasTag` are the
two readers, and a word that is not a tag is refused by name rather than quietly
dropped.

**One way to say universal.** Everything the form writes uses `morphologies: []`.
`'*'` is still read (`compatibleMorphologies`), because assets written before
this say it, and nothing in the editor writes one any more.

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
"Presets" describes it, and may name a part of the same pack -- and ask for
a style whose drawings are in that pack ("The style axis" above), in
whichever order the two are written down.
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

The V1 library of the roadmap (phase 45), forty-seven assets: the basic face
library of PR 6, the seven it asked for on top, and the four face shapes the
brief added later — drawn in the template face's frame so the same reference
boxes fit them onto any face. One file
per category in `core/face-library/builtin/`. A card's title lists every
movement of its category, `✓` carried or `–` not (phase 26), under *Fully
animated* or *Limited animation*.

| Category | Assets | Carries | Notes |
| --- | --- | --- | --- |
| head | `round`, `oval`, `wide`, `narrow`, `square-soft`, `pear`, `chin`, `heart` | headX, headY, headTilt; jaw: jawOpen | a skull each, a path with its jaw pose; on the template, the skull rule |
| eyes | `round-large`, `round-small`, `sleepy`, `cartoon`, `minimal` | eyeOpen; pupils: lookX, lookY, pupilScale; lids: eyeOpen | composite: sockets, whites, pupils, glints, lids, outlines |
| eyebrows | `thin`, `normal`, `thick`, `flat`, `expressive` | browRaise, browTilt | mirrored pairs |
| nose | `dot`, `hook`, `soft`, `cartoon` | noseScrunch | |
| mouth | `simple`, `wide`, `small`, `cartoon`, `expressive` | mouthOpen, smile, mouthWidth; teeth and tongue where drawn | `cartoon` carries all five |
| ears | `round`, `large`, `small` | earWiggle | a group per side, painted behind the skull, as the template's |
| hair | `short`, `spiky`, `curly`, `long`, `balding`, `bald` | hairSway, hairLift | one part, up to three roles; `long` paints its back behind the face, `spiky` stands above the origin into the headroom |
| facialHair | `moustache`, `large-moustache`, `goatee`, `beard`, `sideburns` | — | four mount points: any of them together |
| accessory | `glasses`, `square-glasses`, `hat`, `earring`, `earring-right`, `bow-tie` | — | five mount points; the two earrings hang on an ear each, and the hat's crown stands 78 units into the headroom |

| hair | `short`, `spiky`, `curly`, `long`, `balding`, `bald` | hairSway, hairLift | one part, up to three roles; `long` paints its back behind the face |
| facialHair | `moustache`, `large-moustache`, `goatee`, `beard`, `sideburns` | jawOpen, except the sideburns | four mount points: any of them together; each says how far the face opening carries it |
| accessory | `glasses`, `square-glasses`, `hat`, `earring`, `earring-right`, `bow-tie` | — | five mount points; the two earrings hang on an ear each |

Every one installs on the template and leaves a rig the validator has
nothing to say about; the unit suite proves it for the whole list.

### The eight face shapes

A skull is drawn one of two ways, because two kinds of shape are being said.

**Four are a radius.** `round`, `oval`, `wide` and `narrow` are the same
ellipse with different radii, and `square-soft` is a rounded rectangle. They
differ only in how tall and how wide they are — nothing about the *outline*
changes between them.

**Four are a width rule.** A pear, a marked chin and a heart are not a bigger
or smaller ellipse: what makes them is *where* the face is widest and how it
closes at each end. So they are drawn from three numbers instead of two radii:

```text
lean    where the width sits: + is heavy below (a pear), - heavy above
crown   how square the top is: 2 is a circle's shoulder, 3 is a brow
jaw     how square the bottom is: 2 is a round chin, 4 is a jaw with a
        corner in it and a chin with an edge
```

The rule is a superellipse whose exponent slides from `crown` at the top to
`jaw` at the bottom, tilted by `lean`, sampled by angle so the samples crowd
where the outline turns, and closed with one Catmull-Rom curve. It is smooth by
construction, which is the point: a face outline is the one line on a mascot
that nothing else hides, and a ripple in it reads as a dent in the skull.

Every shape carries the same `jawOpen` pose as the other four — the same path,
drawn again with everything below the eye line stretched down by `JAW_DROP` —
so a face keeps its jaw whichever shape it is given.

## Files

```text
project/editor/core/face-library/
  face-part-model.js        categories, mount points, palette tokens, normalize, the artwork scanner, capabilities
  face-part-validation.js   validateFacePart and its codes
  face-part-registry.js     createFacePartRegistry, FACE_PART_LIBRARY, registerFacePart, registerAccessory; list, cards, variant, variantsOf
  face-part-artwork.js      remapArtworkIds, documentIds, facePartThumbnail
  face-part-install.js      planFacePartReplacement, scrubRemovedArtwork, applyFacePartReplacement, followHeadClips
  face-part-commands.js     createFacePartCommands: plan, layout and replace, one undo step
  face-layout.js            the layout context, the template's boxes, fitFacePart, layoutThroughRoot, composeFit
  palette-model.js          TOKEN_SEEDS, seedTokens, derivePalette, tokenWrites, tintArtwork
  face-presets.js           FACE_PALETTES, FACE_STYLE_PRESETS, the preset registry, styledAsset and presetDrawings (the style axis), presetOfFace, planFacePreset, presetThumbnail, the browser store
  face-pack.js              normalizeFacePack, validateFacePack, installFacePack, registerFacePack: a JSON file of parts and presets, all or nothing
  builtin/                  heads.js (four radii and four width rules), eyes.js, brows.js, noses.js, mouths.js (+ mouth-simple.js, mouth-wide.js), ears.js, hair.js, facial-hair.js, accessories.js, nose-dot.js, index.js
project/editor/svg-editor/svg-canvas.js        replaceArtwork
project/editor/core/security/sanitize-svg.js   findUnsafeSvg
project/editor/core/tests/face-part-model.test.js
project/editor/core/tests/face-part-validation.test.js
project/editor/core/tests/face-part-registry.test.js
project/editor/core/tests/face-part-artwork.test.js
project/editor/core/tests/face-part-install.test.js
project/editor/core/tests/face-part-host.test.js
project/editor/core/tests/facial-hair-follow.test.js
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
