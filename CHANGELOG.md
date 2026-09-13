# Changelog

## Unreleased — The animals are drawn

The forty-five drawings MASC-10A asked for, in
`core/face-library/builtin/animals/`, registered in `BUILTIN_FACE_PARTS`
alongside the six recipes as presets (MASC-10B). The library is **92 assets and
12 presets**; `npm run face:assets` reviews all of them with **0 geometry
warnings**.

Cat, Dog, Fox, Bear, Wolf and Rabbit each wear exactly what their recipe named
— a test asserts it, recipe against preset, id for id and name for name.

**This is the sentence MASC-01 to MASC-09 exist to make true: adding six species
cost drawings, a palette table and a preset table.** No new category, no new
slot, no new morphology, no new runtime control, nothing touched in `runtime/`,
`rig.json` or the hand system, and no migration. The 47 human drawings and the
six human presets are untouched, and still answer every question exactly as they
did — the animal pack is the only thing in the library that narrows itself with
`morphologies`, so every other kind of face is offered the same forty-seven it
always was.

**The Type row turned itself on.** `availableMorphologies()` reports `muzzle:
AVAILABLE` because the muzzles and the whiskers now exist, not because anything
was added to a list. `beak`, `robot` and `monster` still report what they are
waiting for.

**Three of the pilot's open questions closed by not needing the mechanism.**

* *Muzzle draw order.* Each muzzle is two pads with the centre left open, and
  the three pieces occupy bands that do not overlap — the nose ends at y 151, the
  pads run 150–171, the mouth starts at y 172. `behind` was never written.
* *The happy eyes.* A bare pair of arcs cannot be an eye set: an eye set is the
  part that holds the gaze and the eyelids, so one bringing neither is refused
  by the install — swapping it in would take the pupils off the face.
  `eyes.animal-happy` is an ordinary composite with both lids parked at the seam
  and arched rather than hanging, declaring no `eyeOpen` and no gaze, because an
  eye already closed has no blink left.
* *A thirteenth palette token.* Not needed: `skinShadow` carries the muzzle pad
  and the inner ear against all seven coats.

The fourth held — the ears do sit on top of the skull, carried there by the
fit's offset-from-anchor rule, and the rabbit's reach y −36 with no overflow.

**The turn signs as itself.** All forty-five are in the head-turn baseline and
carry six words between them, five of which the human library already had: a new
drawing in an old category signs as that category, because a turn is generated
from roles and profiles and never from path data. Only the three rows that had
to declare a profile produce anything new — the ears, which sit on top of the
skull and so sweep round, and the muzzles and whiskers, which are accessories
and would not turn at all if they said nothing.

The manifest stays data and stays hand-written, so what was asked for can still
be compared against what was built; `docs/MUZZLE_SOFT_CARTOON_PILOT.md` records
which questions the drawings answered and how.

## Unreleased — Six animals, forty-five drawings

The brief for the first real content of the new face library (MASC-10A),
following the delivered **Soft Cartoon — Face Parts V1** sheet: eight sections,
forty-five drawings, six species. Nothing is drawn and nothing is registered —
`docs/MUZZLE_SOFT_CARTOON_PILOT.md` and the data-only manifest beside it say
what has to be made, what must not be made twice, and which of the 47 shipped
drawings an animal face may still wear.

**Six recipes, not six libraries.** A fox and a wolf share their eyes and their
brows; a cat and a fox share a nose; a dog and a wolf share a muzzle. Thirty-
eight of the forty-five are claimed by a recipe, where six species over eight
slots would be forty-eight if each owned its own. Cat, Dog, Fox and Bear were
the brief; the sheet also draws a rabbit's ears, a rodent's muzzle, a button
nose and a wolf's ears, so Rabbit and Wolf are recipes too rather than pieces
drawn for nobody. Seven more are the catalogue — expressions and species an
author picks themselves.

**The sheet settled two questions.** *"6 styles d'yeux (pupilles intégrées)"*
confirms that an eye set draws its own pupils, so the pupil families are
properties of the eye drawings and a recipe reaches them through the eyes.
*"6 museaux modulaires (sans nez ni bouche)"* answers the pilot's biggest
graphical risk: a muzzle is a pad with the nose and mouth area left open, and
the semantic nose and mouth sit on top of it keeping every control. What is left
is the draw order.

**All 47 shipped drawings were audited**, each with a verdict and a reason. The
sheet draws its own brow, noses and mouths, so no recipe leans on a shipped
drawing; the four that were going to stand in are fallbacks if a planned one is
cut. Glasses, a hat and a bow tie stay universal.

**Colours are palettes.** Seven of them following the sheet's own head colours,
no new token, and no drawing named for a colour: a ginger cat and a grey cat are
one drawing.

**No new runtime control.** Six species run on the parameters a person runs on.
What is new is the 2.5D turn — the muzzles, the whiskers and the ears each need
a profile, and none will be written until the drawings exist.

## Unreleased — Look at a drawing before drawing fifty

Seven visual slots exist and nothing is drawn for any of them (MASC-09). Two
things were missing before the first muzzle: the geometry contract an author
draws against was never written down, and there was no way to look at one
drawing and see what the layout engine makes of it.

**The contract is written down.** `docs/FACE_ASSET_AUTHORING.md` states the
reference frame, every anchor's coordinates, what a reference box must be and
what it may be, and the one similarity `fitFacePart` performs. No new anchoring
system and no new mount point: the fifteen that exist are enough until a sheet of
real drawings proves otherwise. The seven new slots get *candidate* anchors, in
one table that the sheet, the docs and the tests share — and that nothing in the
editor reads, because what the engine fits to is still the asset's own.

**`npm run face:assets` draws it.** Three views per drawing: alone with its
reference box, its pivot and the anchor it aims at; auto-fitted over the face it
was drawn against; and a fit matrix across five skulls. Plus a slot reference
page answering the only question an artist has — where does this piece go? The
placement is the real engine through the runtime's own transform, so a piece
that lands badly lands badly on the sheet. Nothing is committed: the assets are
the source and `out/` is ignored.

**A style may not move the piece.** A restyle is the same object in another
graphical language, so a variant whose mount point, host, slot or box has
drifted is flagged — as a warning on a sheet, never as a validation error.

**A mount point survives an edit.** The last of the MASC-08C round trip: Save as
a library part offered the semantic category's default anchor, so a muzzle
anchored at the nose came back anchored at the centre of the head. It now offers
the anchor the drawing already uses.

All 47 shipped drawings place cleanly. No Cat, Dog or Fox yet — that is MASC-10,
and the sheet is what each of its drawings goes through first.

## Unreleased — A muzzle saved from Muzzle comes back to Muzzle

The authoring loop closes (MASC-08C). Boop could already carry a drawing's
visual slot, the kinds of face it suits and the words it is tagged with; a part
created *in the editor* lost all three. So an author could take a muzzle from a
pack, reshape it, save it — and get an accessory, listed beside the glasses.

**Save as a library part asks for the row.** *Part* is a visual slot now —
Muzzle, Whiskers, Beak, Horns, Accessories — and the semantic category is
derived from it rather than asked for as a second answer in another vocabulary.
Somebody who picks Muzzle is never then asked why they must also pick Accessory;
the category it goes on as is stated once, under the field. Only the slots whose
semantic part the piece's shapes could fill are offered, by the library's own
required roles.

**It says what it suits and what to find it by.** *Works with* is the five kinds
of face, and nothing ticked means every kind — which is the library's contract
for a drawing that says nothing, and is why a drawing that said nothing cannot
acquire a restriction by being edited. *Tags* is free vocabulary, typed as
words. Both survive storage and the next session, and both go through the same
validator an imported asset does: a kind of face nobody has heard of, or a word
that is not a tag, is refused by name rather than quietly dropped.

**A preset saved from a face knows what kind of face it is.** Reading the
recipe's own drawings, a face wearing a cat's muzzle and its whiskers saves as a
`muzzle` preset. A face that does not say claims nothing rather than a guess:
writing `human` into somebody's saved preset would be a fact they never stated.
The Type row is never consulted — it is a session preference about what Design
is offering, and a preset is made of what the mascot is really wearing.

**A row that holds one thing says Use.** Only the catch-all rows accumulate, so
only they say *Add*. Vocabulary only; where a card lands is unchanged.

Still no drawing for any of the seven new rows: Cat, Dog and Fox are MASC-09.

## Unreleased — Muzzle, Whiskers and Accessories are three rows

Design ▸ Face is built out of the **visual slots** now, not out of the eleven
semantic categories (MASC-08B, docs/CHARACTER_BUILDER.md). A muzzle, a pair of
whiskers and a pair of glasses are three rows of one category, and a beak is a
row of the mouth — with no new semantic part anywhere: nothing named `muzzle`,
`whiskers` or `beak` reaches a project, `rig.json` or an export. A row is
authoring, in the same sense a category is.

**Each piece is in the row it belongs to.** Which row is read from the asset a
part was installed from, so a click on a whisker opens Whiskers rather than
Accessories, and the inspector says *Muzzle · Short muzzle* rather than
*Accessories · Short muzzle*. A part whose asset the library does not know —
one drawn by hand, one from a pack that has gone, one from a project older than
all of this — falls back to its category, which is where it has always been
shown. Nothing is migrated.

**A press acts on its own row.** A row of its own replaces the piece it holds,
by name, and adds a new part when it is empty; the catch-all rows sort by mount
point among their own parts, as they always did. So a muzzle going on does not
take the glasses off, though both are accessories at the centre of the head with
no host — the case the mount-point rule could not tell apart — and taking the
whiskers off takes only the whiskers off. A preset naming two such drawings puts
both on, where before the second would have gone on over the first.

**Presets follow the Type at last.** Type promised "parts and presets" from
MASC-05 on, and only the parts followed it. A preset that claims no kind of face
is now read from the visual slots of its own drawings rather than offered
everywhere, so the six the editor ships stay under Human. The shipped Robot
preset stays there too: it is a square head, small eyes and a bow tie, with
neither an antenna nor a panel on it, and declaring it `robot` would tell the
system something untrue about what it is made of.

No drawing was added. Every one of the seven new rows is proved against test
fixtures and a test face pack; Cat, Dog and Fox are MASC-09.

## Unreleased — A face can be restyled twice

MASC-08A hardens two identities before the first real muzzle, cat or fox is
drawn (docs/MASC_LIBRARY_BASELINE.md). No asset was added, no slot row was
built; this is the layer MASC-08B stands on.

**Which drawing.** A style used to be resolved from whatever the face was
wearing, which works exactly once: ask a flat face for retro and the library is
asked for "the retro style of `head.round-flat`", which nobody has drawn and
nobody may draw, because a style of a style has always been refused. Every
restyle now comes home to the canonical base first, so
`base → flat → retro → base` is four ordinary restyles rather than a chain that
dies at the second.

**Soft Cartoon is the style the library is drawn in.** Saying so in the
catalogue is what lets the axis stay one level deep and the library stay one
copy of each drawing: asking for the base style resolves to the drawing itself,
so there are no 47 `-soft-cartoon` twins of drawings that already look exactly
like that. Exactly one style may be marked as the base, and the module refuses
to load otherwise.

**Already is not missing.** A restyle now sorts every part into *replaced*,
*already in this style* or *kept*. Before, a face entirely in Soft Cartoon,
asked for Soft Cartoon, was told "nothing is drawn in this style yet" — the
opposite of what was true. The Style card reads the same three numbers as four
states, because *Current* and *Unavailable* both redraw nothing and mean
opposite things.

**Which part.** A replacement can name the part it means, and a restyle names
one for every step. Without a name nothing changes; with one, a muzzle and a
pair of whiskers — two accessories at the same mount on the same host — can be
restyled independently, which the slot search cannot do. A name that is not a
part of that category is refused rather than falling back to the search: a
silent fallback would replace the wrong accessory and look like it had worked.

Old presets are untouched: one asking for no style still wears exactly the
drawings it names, which is what every preset saved from a face does.

## Unreleased — What kind of face, and what look

MASC-01 to MASC-07: the morphology and style layers, and the two rows in
Design ▸ Face they are for (docs/MASC_LIBRARY_BASELINE.md).

**A slot is what an author picks; a category is what the rig understands.** A
beak installs as a `mouth` because it opens, and `mouthOpen` means on a duck
exactly what it means on a person; a muzzle, whiskers, horns, a crest, an
antenna and a robot's panels install as accessories, because that is what they
are to the runtime. Giving each its own semantic part would make the exported
mascot depend on the graphics library — which is the one thing this whole layer
exists to prevent. Five kinds of face are lists of slots, and a **species is
never one of them**: cat, dog and fox are presets inside `muzzle`, so adding one
costs drawings rather than a release.

**Everything new is optional, and an asset that says nothing is universal.**
That is what let three fields arrive on assets and two on presets with no
migration: 47 shipped drawings, every pack anyone has exported and every part
saved in somebody's browser say none of them, and behave exactly as they did.

**Type** says what kind of face this is, and changes nothing on the mascot — it
decides what Design offers. Which kinds can be pressed is derived from the
drawings, so drawing a muzzle and a pair of whiskers is what turns `muzzle` on;
today exactly one card is pressable and the other four say what they are waiting
for. Shown, not hidden: a missing option an author can see is a promise, and one
they cannot see is a feature that does not exist.

**Style** redraws the face in another look, as one undo step, and keeps every
part nobody has drawn in that style yet. The card says "1 of 2 library parts can
be redrawn" before the press and the row says "1 part restyled, 1 kept as it is"
after it, because an author told only what moved would read what stayed as
something lost.

And the parts on offer now follow the kind of face — while never hiding a row
the mascot is already wearing something in, because hiding the only door to a
part somebody has put on is precisely the failure this layer is meant to
prevent.

## Unreleased — The style axis is finished, and nothing has ever used it

MASC-00 is a baseline, not a feature: the face library written down before
morphologies and styles are added to it (docs/MASC_LIBRARY_BASELINE.md).

The audit's finding is worth repeating here, because it decides the shape of
everything after it. **The style axis is complete and unexercised.**
`asset.variant`, `registry.variant()`, `preset.style`, `styledAsset()` and the
fallback to the drawing a preset named are all built and all tested — and the
library ships 47 assets with **zero** variants and six presets with `style: ''`.
So the work ahead is not a second theming system. It is filling in the one that
is already here.

The categories are the other half of the picture: head, eyes, pupils, eyelids,
brows, nose, mouth, ears, hair, facial hair, accessories. That is a human face
read literally. It carries a cat by bending `accessory`, and it cannot carry a
beak or a muzzle honestly — which is what the morphology and slot layers are
for, above the categories rather than as new semantic parts underneath them.

Four invariants are now tests, against the models rather than the panels: a
restyle is reached through the drawing it restyles and never listed beside it; a
preset in a style nobody drew wears the drawings it named; a pack is all or
nothing across its parts and the presets naming them; and an asset carrying none
of tomorrow's metadata normalises, validates, saves and loads. Nothing else
changed.

## Unreleased — A route names a screen, and a gesture names a drawing

M8 is the removal the whole refactor was for: the old vocabulary out of the
product code, and the deprecated hand model out of the choices an author is
offered (docs/UIR_REFACTOR_BASELINE.md, UIR-17). Every deletion is recorded
there as **old capability → new route → the test that proves it still works**,
because a refactor that loses a capability quietly is the one failure mode this
whole plan exists to avoid.

**Not one module navigates by task any more.** Thirty call sites — panels,
commands, guides, presets, the readiness model — named a screen of the
navigation UIR-01 replaced, and the alias table translated for them. A
translation layer everything can reach is not a bridge, it is a second
vocabulary; while both worked, every new panel could pick either. They name
modes now, `{ stage: … }` is gone entirely, and a test walks
`project/editor/` to keep the old words out. The table stays, smaller, for the
two things outside the product code that still speak them: a UI preference saved
before UIR-01, and validation's own `fix.workspace`.

**A reaction sets a hand to a drawing it actually has.** It used to fall back to
the hand's `poses` — the model from before drawings, where a hand was deformed
into a shape by a number. The runtime has resolved a gesture against the hand's
**library** for as long as hands have had one, and applies it stepped, so a pose
offered in the editor named a drawing that was not on the hand: it validated
here and did nothing on the page. A hand with no library makes no gesture now,
and the panel says so where the choice used to be.

And `#hand-workshop` became `#hand-states`, with its render target: "workshop"
was the name of a panel that did something else, and a screen whose subject is a
hand's states should be findable by that word wherever it is named.

**What was not deleted, and why.** `reach`, `inertia` and `softness` are live
runtime mechanics rather than deprecated ones — they bound a hand's travel, give
it lag, and say how far past its reach it may drift, on every frame of every
exported mascot. So is `retireHandDeformation`, which is the way *off* the old
model rather than part of it. Removing either would change what a published
mascot does, which is the one thing this refactor is not allowed to touch.

## Unreleased — A module per question, and the arrow keys to reach it

M7 is the two things the four workspaces still owed: a way through them that is
not nine presses of Tab, and a file each (docs/UIR_REFACTOR_BASELINE.md, UIR-15
and UIR-16).

**The navigation is walked with the arrow keys.** Left and right along a row,
Home and End to its ends, down into the screens of the workspace that is open
and up back out of it. Tab still reaches every button exactly as it did: this is
the faster way through the nav, never the only one. Moving the focus is not
going anywhere — a screen opens when it is pressed, as it always did.

**What a phone can do is filed under the four questions.** The capability sheet
listed thirteen areas in the order they had been written, named "Face Setup"
(a screen UIR-01 replaced with four) and was silent about Hands, Head 2.5D and
Deform — so an author who could not find one could not tell whether it was gated
or whether they were looking in the wrong place. It reads as the navigation
reads now, with `Everywhere` last for what is true wherever you are. And a gate
is on the screen it gates: the one for Deform used to sit inside a folded
`<details>`, saying nothing until somebody opened it.

**`editor-app.js` is 849 lines instead of 1161.** Each workspace is a module
that says what it builds, what it draws, and what it does on the way in and out:

```text
app/workspaces/design.js    the face, the hand states, the vector tools' screens
app/workspaces/rig.js       the nine sections, the handle board, applyPoseValues
app/workspaces/animate.js   expressions, motions, the timeline
app/workspaces/behavior.js  reactions, automatic, the state machine
app/hand-artwork.js         putting hand artwork on the canvas — nobody's screen
```

The lifecycle came with them. `WORKSPACE_OCCUPANTS` was a table naming which
panel of which workspace had a method called `cancelTransient`, kept in step by
hand with four other files; each workspace answers for its own panels now, and
is handed the **surface** rather than a yes or no — because Expressions has to
let go of the face it is shaping even on the way to Motions, which is the same
workspace.

The canvas, its tools, the Inspector, the services and the command surfaces
stayed. The canvas is central to every screen and the Inspector answers for all
four; filing either under a workspace would be the lie the refactor removes.

## Unreleased — The bar answers the question it used to ask

M6 is the two things that are true on every screen rather than on one: what the
project is, and what it looks like when it runs (docs/UIR_REFACTOR_BASELINE.md,
UIR-13 and UIR-14).

**Preview is a state of the canvas, not a fifth place.** It sat beside the four
workspaces as though testing a mascot were a step of building one, and leaving
it meant choosing somewhere to go. The tab is a toggle now: it reads
`▶ Preview` on the way in and `◼ Stop preview` on the way out, and pressing it
a second time puts the author back on the screen they were authoring on. Where
somebody was standing is not a project fact, so the memory is session-only and
never reaches `ProjectDocument` (Règle D).

What Preview offers is the whole of §11's test surface — expressions, motions,
hand states, events, reactions, automatic behaviours on and off, and the reset
in the project bar that clears every preview-only change at once. The hands were
already there; what they were called was not. A hand offers a **Place** and a
**Hand state**, the two words Design ▸ Hands and Behavior ▸ Reactions use, so a
hand is named the same thing wherever it is met.

**"Problems" was a word that was true whether or not there were any.** It never
told anybody whether it was worth pressing. The button reads the project now:

```text
✓ Ready            ● 2 issues            ⚠ 1 issue
```

and what it opens is grouped by the workspace the work is in — Design, Rig,
Animate, Behavior, then Export, which belongs to none of them because it is the
reading of all four. A count is somewhere to go; seven flat rows were a list to
read. Neither `todo` nor `optional` is counted as an issue: work not started is
not a problem, and a bar that said otherwise would never read Ready on a young
project.

## Unreleased — A hand is set to a state, not animated into one

UIR-11 and UIR-12 are mostly already true: the six screens of Animate and
Behavior arrived with the route model, one view active at a time, sharing the
canvas, the transport and the inspector. Two things were still saying the old
thing.

**Show in Timeline** opened the dock without moving the navigation, so the tab
saying where you were disagreed with the surface that had just opened. The
Timeline is a screen — the detailed editor of the motion in hand — so opening it
is a navigation.

**A reaction sets a hand state.** It said `Right hand Wave`, and offered the
hand's *poses*: the pre-drawing model, where a hand was deformed into a shape by
a number. The runtime has resolved a reaction's gesture against the hand's
library of drawings for as long as hands have had one, and applied it
**stepped** — one drawing or another, nothing interpolating between two
pictures. The words follow the model now:

```text
DO   Set left hand state → Point
```

and the states offered are the ones that hand actually holds, so a reaction can
never name a drawing that is not on it. A project written before the drawings
existed still shows its poses, because it still has them until UIR-17.

## Unreleased — The rig, read as four questions instead of nine panels

M3 is the other half of what UIR-01 routed: Rig's four screens now *look* like
four screens (docs/UIR_REFACTOR_BASELINE.md, UIR-07 … UIR-10).

**Assign** says how far through it you are. The progress was already derived and
already rendered — into a `hidden` span, for a test to read. On a screen whose
whole subject is naming the parts of a face, how many are named is the first
thing worth showing.

**Controls** files movements under what they make the face do, not under which
part of the rig carries them:

```text
HEAD    move, tilt
EYES    open/close, look, pupil size      ← eyes and gaze, one question
BROWS   raise, tilt
MOUTH   open, smile, width, teeth, tongue
EXTRA   nose, jaw, tongue, hair, ears
```

Ten part-shaped groups became five bands. `group` stays the part underneath,
because the pose chips and the live sliders are per part and always were; a band
is how they are *shown*.

**Head 2.5D** already had Simple · 5 and Standard · 9 and a capture per cell.
What it lacked was an account of the third axis: the screen is the head
*turning*, and a tilt is one movement with one slider, so it says so and points
at Controls rather than implying the grid has no answer.

**Deform** is the expert bench. The six systems that bend artwork rather than
moving it whole — pins and holds, warp grids, keyforms, shape keys, deformers,
depth and parallax — are listed with what this project carries in each and the
screen that edits it. Three have an authoring surface and it is one press away.
Three do not: the runtime plays them and an imported rig can carry them, and
saying so is the difference between "not editable here" and "invisible". The
five canvas editors §10 asks for are the follow-up that listing exists to frame.

## Unreleased — Two hands, two libraries, and a canvas that says what it is open on

**Design ▸ Hands** was three doors to one subject: the *set* had a screen of its
own, the drawings a hand actually holds were cards in the Character Builder, and
editing one was a row in the builder's inspector. None of the three was the one
an author would look for. They are one screen now
(docs/UIR_REFACTOR_BASELINE.md, UIR-05), and it is about the hands rather than
about the library they came from:

```text
LEFT    [Relaxed*] [Open] [Point] …   + Add a state
RIGHT   [Relaxed*] [Fist] …

Left hand / Point
Use · Edit SVG · Duplicate · Rename · Mirror copy · Delete
```

Four of those six could not be done at all. A hand's states were a *view* of the
shipped set — every id had to be one the set knew, every name came off it, and
there was no way to copy one, rename one or take one away. `hand-state-model.js`
closes that: rename writes this hand's own name for a state, duplicate and
mirror copy make a drawing of their own, delete takes the drawing with it, and
the last state never goes because a hand with nothing to draw is a broken
mascot. Every one is one undo step, and every one leaves the other hand exactly
as it was — which is the separation the whole hand model rests on.

The bug that hunt turned up is worth naming: `handStyleElementId` resolves its
argument through the shipped set and **falls back to the default drawing** for
anything the set does not know. A state an author made would have been given the
*relaxed* hand's id and written a second copy of that drawing over it. States of
an author's own are exactly what this pass is for, so they get an id helper that
does not ask the set's permission.

**UIR-06**: the vector tools say what they are open on. The canvas has always
been able to limit an edit to one element and has never been able to name it, so
pressing Edit SVG on a hand's Point drawing landed in a workspace called Artwork
with something selected and nothing saying which of sixteen states you were
inside. There is a breadcrumb over the canvas now — `Design / Hands / Left hand /
Point` — and it is the way back out. A scope is derived from the element the
canvas is scoped to and the document it belongs to, never stored: no third place
to come apart from the other two. The old "↩ Back to Character" chip, which said
Character whatever was being edited, is gone.

**UIR-04**: a part card warns, it does not inventory. Every card read out every
movement of its category with a ✓ or a – against it — nine facts on a card whose
job is to say what the part looks like. A drawing that carries everything now
says nothing about movement; one that does not says how many, and Rig is where
which ones lives.

## Unreleased — The shell composes, and two tables replace two chains

`app-shell.js` built every panel in the editor and then wired all of them: one
function, 42 kB, that decided where a column goes *and* knew that a thing called
`#face-movements` exists and what its heading says. It composes now
(docs/UIR_REFACTOR_BASELINE.md, UIR-02):

```text
editor/shell/
  app-shell.js      the layout, and what is true of all of it
  topbar.js         the project bar
  workspace-nav.js  the four questions, and the screens of the open one
  side-nav.js       the contextual column
  canvas-column.js  the one surface every screen shares
  inspector-host.js one inspector, an adapter per kind of selection
  bottom-dock.js    the surface a screen opens under the canvas
  overlays.js       Home, the status line, Problems, the dialogs
```

Every id lives with the markup that declares it, and each region hands back the
part of the shell's API it owns. The API is unchanged on purpose — `editor-app.js`
and the e2e seam both read it, and a decomposition that also changes its shape
is two changes nobody can review apart — and the page it renders is
byte-identical, which is the point of doing it as a move rather than a rewrite.

UIR-03 turns the two remaining chains into tables. The inspector was six
booleans, one per adapter, each repeating the same shape with a different pair
of names; a seventh adapter meant a seventh boolean, a seventh clause and a
seventh branch in the renderer's ternary. `ui/inspector-registry.js` is the rule
of §5 Règle B written down — **panels on screen + selection = inspector** — and
the renderer is one line for every adapter there will ever be. A test walks the
whole cross-product of columns and selections against the six conditions it
replaces, so the table is provably the same editor.

The dock is the same idea for the surface under the canvas: `DOCKS` registers
what can open there, `data-dock` on the root says which one has, and a screen
names the dock it arrives with. The Timeline is the only entry so far; the event
log and the diagnostics panel join it as rows rather than as another footer. The
States editor stopped claiming to be a dock at all — it is a disclosure in
Behavior's column, so its screen now names it as a `panel` to reveal, which is
what it always was.

## Unreleased — Four questions, and a screen for each answer

The navigation asked the author to know the editor's filing system. **Create**
held four things that are not one job — building a face, drawing hands, editing
SVG, and rigging — and **Face Setup** held nine panels in one column, 342 visible
controls and 521 with every section open. Automatic had no route at all: it was
found by scrolling past Reactions. The state machine's door was in another
building entirely, an accordion inside *Motions*.

The navigation names the four questions instead:

```text
DESIGN     What does my character look like?    Face · Hands · Artwork
RIG        How can its face move?               Assign · Controls · Head 2.5D · Deform
ANIMATE    What can its face do?                Expressions · Motions · Timeline
BEHAVIOR   When does it do it?                  Reactions · Automatic · States
```

Preview sits beside the four rather than after them. Testing the mascot is
something an author does from wherever they are, not a fifth step after the
fourth, and `Publish` stops being a place.

Three words, where two were sharing a name. A **workspace** is one of the four
questions. A **mode** is a screen inside one, and it is what everything else
names — a deep link, a validation fix, a command in the palette. A **surface** is
the column of panels a mode mounts, which is what `data-workspace` and a hundred
CSS selectors have always meant; the attribute keeps its name until UIR-02
rebuilds the shell, because renaming a hundred selectors to make a comment
shorter is not a refactor.

Four screens over one column is what turns nine sections into four pages without
a panel moving: each section is filed under the screen that shows it, and the
route model is where that is written down. **Assign** is the assignment and
nothing else. **Controls** is everything that moves, hand placement included.
**Head 2.5D** is the turn. **Deform** is the expert bench: pins, holds, warp,
the part tree.

Nothing that ever named a route has stopped working. `MODE_ALIASES` holds every
id that was ever navigable — the task ids, the surface ids the session stores,
and the stage ids before them — and a test walks the whole table asserting each
one still lands on a real screen. A focus now outranks the screen that came with
it: `{ task: 'face-setup', focus: 'head-pose' }` was written when Face Setup was
one page and meant "the Head pose section", so it opens the screen that section
is on rather than the one it used to sit in.

Nothing in the project document changed, no command changed, and the runtime is
untouched.

## Unreleased — The baseline the interface refactor is measured against

The UI refactor (docs/UIR_REFACTOR_BASELINE.md) moves panels and moves nothing
else. The failure it can produce quietly is not a screen that breaks loudly: it
is a capability whose door goes missing — a panel moved to a workspace nothing
navigates to, a deep link that used to open a section and now opens the page it
sat on. Nobody notices until somebody needs it.

So before anything moves, `docs/UIR_REFACTOR_BASELINE.md` writes down every
capability, the route that reaches it today, the module that writes it, the
`PROJECT_DOMAINS` key that write declares, what the exported mascot needs for it
to mean anything, the suite that already fails when it breaks, and the workspace
it is going to. A pull request that leaves a row of that table with no route is
not finished, whatever it looks like.

Two rows say why the refactor exists at all. **Automatic** has no route: it is
reached by scrolling past Reactions in the same column. **State machine** is
filed under *Motions*, inside an accordion in the step above the one whose
subject it is.

`core/tests/uir00-baseline.test.js` turns the four separations the refactor must
not blur into assertions — a hand state is added and reshaped and no other state
moves; the two hands hold separate libraries with no mirror link; installing a
face part does not so much as bump the `hands` domain revision; showing a
different hand drawing rigs, poses and deforms nothing. They are written against
the models rather than the panels on purpose: a safety net rewritten by the
change it is watching is not one.

No panel moves, no route is renamed, and no preference shape changes. That is
the point of a baseline.

## Unreleased — The face stops drawing the hands

`face-artwork.js` imported `styleHandsMarkup` and grew its own page to make room
for a pair, so the module that knows what a cheek looks like also knew what a
thumb looks like. That was defensible while a hand was one of six drawings
nobody could change. It is not defensible now that a hand is a piece out of a
set an author owns.

The face draws a face. `buildMascotFaceSvg` has two seams, and **neither
mentions a hand**:

- `box` — the page. A face fills its own square; a mascot with something hanging
  below it needs a bigger one, and the thing hanging below it is the only thing
  that knows how much bigger.
- `before` — markup painted behind the face, whatever it is. That is how a pair
  of hands hides behind the head.

`templates/mascot-artwork.js` is the composer, and it holds the three facts that
belong to the *mascot* rather than to either half of it: the page a pair needs
(`handsArtboard`), the paint they are dressed in (the face's own palette and
line weight), and the paint order that puts them behind the head.
`face-artwork.js` now imports **nothing at all**.

The mascot it composes is byte-for-byte the one that shipped before, which is
the point: no fixture was re-signed, `project/assets/mascot-sample.svg` is
unchanged, and the two signed e2e artifacts were not touched. A separation that
needs the snapshots moved is a separation that changed something.

## Unreleased — A hand workshop, and a ninth gesture with no code at all

**Create ▸ Hands** is a step of its own now: the set an author draws hands from,
its gestures as cards, and three doors — **add a gesture** from a file, **import
a hand set**, **save the set out**. It is deliberately not a hand rig panel:
where a hand *is*, how far it reaches and what it is anchored to stay in Hand
setup; what a hand is *drawn from* is here. That is the same line between
placement and appearance the whole hand model is built on, and it is the other
half of separating the design of the hands from the design of the face.

Adding a gesture is picking an SVG. The file says where its pivot is and at what
scale it was drawn; when it does not, the set in use is assumed, so a drawing
saved out of a mascot and dropped back in works with nothing filled in. The
names come off the drawing (`data-name` on the group and on each layer) and the
id off the file's name — `Thumbs Up.svg` is `thumbsUp`. It is then a card here
**and in the Character Builder**, at once, because both read the same library,
and it is kept under `boop.handSets` beside `boop.faceParts`, so a reload still
has it.

`core/hands/hand-set-install.js` is the face pack's door transposed: the same
validation, the same all-or-nothing install with rollback, the same
`localStorage` key for an author's own. A set travels as one JSON file with its
drawings inside it, installs whole or not at all, and **replaces** the one in
use — a hand's drawings all have to share a pivot and a radius, so two sets at
once would be two sizes of hand on one mascot. A mascot already wearing drawings
keeps them, and the gestures an author added come back with the new set. Saving
out is the exact round trip: what comes back is what went out, drawing for
drawing.

Three refusals, each with the reason:

- a drawing that breaks the artwork rules, named by the rule it broke;
- a drawing at **another size**, rather than quietly rescaling somebody's work —
  a hand that changed gesture would change size;
- a gesture named one of the runtime's **older names**. `wave` is an alias for
  `open` and `grab` for `fist`, and the standalone runtime migrates those names
  when it opens a project: a mascot published with a gesture called `wave` would
  show `open` on the page, and beside a library that already had `open` the
  drawing would be dropped entirely. Found by writing the acceptance test with a
  fixture called `wave`, which is exactly the trap an author would fall into.

Two places still read the runtime's frozen eight and now read the live set: the
offers under a hand (`handStylePresets`) and the preset validator. That is what
makes "a ninth gesture is a ninth file" true rather than nearly true — a gesture
an author adds is offered on a hand, can be drawn on one, and is carried by a
face preset, with no code change anywhere.

## Unreleased — Editing a hand, drawing by drawing

The layers were the hard half; this is what they were for. Each drawing of each
hand is a row under the hand in the Character Builder, with **Edit** beside it.

Nothing new was needed to reshape one. `setEditScope` walks the parent chain,
so scoping a `<g>` works unchanged; `startNodeEdit` drags the points of
whatever is selected; **Edit Shape** already worked on a hand. What the layers
added is something inside a drawing to select — a palm, three fingers, a thumb,
each its own path with its own name.

**The drawing being edited is revealed.** Seven of a hand's eight carry
`opacity="0"`, so the one an author opens would otherwise be a selectable layer
nobody can see. While a drawing is the edit scope it is painted and its hidden
siblings stay hidden — a CSS rule over the presentation attribute, so it is
session chrome and the document is not touched. Leave, and it goes back behind
the drawing the hand rests on.

A drawing is compared with **what the set would draw in the same place**, by
`shapeSignature` — the word the face part library already uses to tell a library
instance from an edit of one. Moving, turning and resizing the whole hand leave
that word alone, which is the point of using it: the rig does all three every
frame. Once a drawing has really been reshaped its row says **Reshaped** and
offers **Restore the set's drawing**, which replaces the **layers only**: the
group keeps its id, its name, its opacity and the transform the canvas has
applied, so a restore cannot move the hand, change which drawing is showing, or
reorder the pair. A shape drawn into the drawing goes with it, rig record and
all, so the restore never leaves an element nothing draws. One undo brings the
author's edit back.

One real bug came out of it. `installedHandLook` matched a pair's look on its
**fill alone**, so the template's hands — dressed in the face's palette *and*
the face's heavier line — read back as the named "skin" look and the weight was
thrown away. Anything drawn afterwards arrived beside the pair with a thinner
line. A named look is now a name only when the pair is drawn in all of it;
otherwise the look comes back whole, exactly as the document has it.

## Unreleased — A hand is a piece of layers, and it lives on disk

Two redraws in, the drawings were still wrong, and the constraint was the
reason: **one path per hand**. Everything a hand says had to fit one
silhouette, so a thumb folded *in front of* the fingers had no outline of its
own and was faked — first as a bite out of the side of the hand, then as a
hairline sliver turned into a hole by `fill-rule="evenodd"`. Both are
workarounds for a shape the format cannot hold. It could not be edited either
(`VNX-22` was marked superseded because "there is nothing inside one to edit"),
and a ninth drawing was a code change.

**A gesture is a file now**, and the file is a group of named layers:

```text
project/assets/hands/defaultCartoon/
  manifest.json      what the set is: pivot, scale, radius, its gestures
  open.svg           <g id="hand-open"> of <path id="palm">, <path id="thumb">, …
  …
```

Those files are the source of truth. The editor reads them, an author edits
them, and **adding a gesture is adding a file** — `npm run hands:sets` re-reads
the directory into the module the bundle and the unit suite both import, and a
test re-reads it again and fails if the two have parted company.

The order of the layers is the thing one path could never say: a finger goes
down before the palm it grows out of, a thumb goes down after the palm it lies
*on*. `open` paints index, middle, ring, thumb, palm; `fist` paints palm first
and folds the fingers onto it. No union gymnastics, no evenodd slivers — the
thumbs-up thumb is a thumb, and the closed side reads as a fist seen edge on.

`core/hands/hand-set.js` is the model and the registry: the face part library
transposed, deliberately — the same artwork rules (one root, root has an id,
nothing a sanitizer would strip, no id drawn twice, plus every layer named and
`M`/`C`/`L`/`Z` only), the same all-or-nothing install with rollback. A drawing
an author brings is a drawing a stranger wrote.

`hand-style-art.js` has **no geometry left in it**. What stays is placement:
where a drawing goes on a particular mascot, how big, which way round and in
what colours. The geometry that seeded the shipped eight is
`scripts/hand-set-seed.mjs`, which nothing imports and no npm script runs.

The rig did not change, because it never needed a drawing to be one element:
`installHandStyles`, `showHandStyle`, the validator, `attachment-model.js`,
`hand-handles.js` and `hand-picker.js` all treat a library entry's `element` as
an opaque node id, and a `<g>` carries `baseTransform`, `baseOpacity` and
`opacity` exactly as a `<path>` does. Hiding a drawing is still **one opacity
write**, now on its group, however many layers it has. The pair's export grew
from 16 shapes to 16 groups of 70 layers; nothing outside the pair of hands
moved, in either signed fixture.

`npm run hands:sheet` draws every gesture, both hands, one pivot, one radius.
That is the art review, and it is the thing to look at before anything else.

## Unreleased — The hands are a mitten before they are a hand

The first cut of the eight drawings was right about the *structure* — one
outline, one layer — and wrong about the **proportions**, which is the half a
reader sees. The fingers were 4.2 units wide on a palm 38 across: a ninth of
it, where the reference sheet draws a quarter. Four spikes on a stub reads as a
rake, however correct the anatomy is.

They are drawn as a cartoon hand now: a palm 51 across, four fingers 12.4 wide
that together span exactly the palm's width and touch each other down their
length, a thumb fatter again, webs that are rounded rather than cut, and a line
weight of 3.8 instead of 3.1 — because a floating hand with nothing inside it
has to read at thumbnail size on its silhouette alone.

The two that were more than a resize: the thumbs-up thumb stood 20 units over a
dome that started beside it, so the pair read as one mitten with a lump — it
is 30 now, with a web between it and the fist; and the OK ring grew from 14.5
to 17 with a bigger hole, because at the old size it read as a bead stuck on
the side rather than as a thumb meeting a finger.

Every drawing still fits the same radius around the same pivot (46.3, against a
budget of 47.5), still sits on the same wrist, and is still one path.

## Unreleased — A pass over the eyelids, the tongue and the teeth

An audit of every face sub-part through all seven layers it has to exist in —
category, semantic role, artwork, movement, palette token, panel, runtime. Most
of it holds up: the lids blink, the teeth show, the tongue has four movements
of its own and a template that drives them, and the runtime is role-agnostic so
every one of them is applied by the same binding and shape-key compiler. Five
things did not.

- **Switching a movement off left the face still doing it.** The lids are a
  semantic part of their own carrying the same `eyeOpen` as the eyes, and the
  Movements panel had one row, on the eyes. Unticking *Eyes · Open / close*
  took the eyes' own squash off and left all four lid bindings live: the mascot
  went on blinking with its movement switched off and nothing in the panel left
  to stop it. A row may now name the other parts sharing its control (`also`),
  and enabling or disabling it reaches all of them in one undo step. The jaw's
  *Drop* does the same for facial hair, which is carried by `jawOpen` and had
  no row at all. A test now walks the registry and fails if any control a part
  declares has no row that can switch it off.
- **Two of the four lids belonged to nothing.** The lower lids close *upwards*,
  so the template writes their bindings by hand — and wrote them without the
  `generatedBy` stamp that says which movement owns them. So even reaching the
  eyelids part did not switch them off: the upper lids came down and these two
  went on rising, half a blink with no control over it. They carry the stamp
  now. Nothing about how they move changed, and `mascot.svg` is byte for byte
  what it was.
- **The registry and the installer disagreed about teeth and a tongue.** The
  registry said both are shape keys; the installer writes an *opacity* for a
  library mouth that draws its own teeth, because there the movement is whether
  they show. Both are true, and only one was listed — so the Movement Inspector
  refused the very method the installer had just written: *Method "opacity" is
  not supported by teeth*. `opacity` is a strategy for both now.
- **A shaped movement said "ready" when it had nothing behind it.** The row
  asked the *method* rather than the keys, which coincided on the template
  because the template authors its own. Turn Teeth on by hand on a face with
  none and it read *On · ready* over a movement that moved nothing.
  `movementMoves` knows about shape keys now, so the row says *On · ready* when
  the keys exist and *On · not set up yet* when they do not.
- **Ten assets claimed colours they never paint**, and **five rows would not say
  which artwork to assign.** `palette` is documented as the tokens the artwork
  uses and is derived from `paletteRoles` when left out; three factories
  hard-coded their whole category's list instead, so a pair of glasses drawn in
  one colour claimed two and a bald head claimed hair. They derive it now, and
  a test holds every asset to painting what it claims. The Movements panel
  likewise kept a second copy of the table naming a part, which knew five of
  ten — so Nose, Jaw, Tongue, Hair and Ears all read "Assign the artwork first"
  without saying which artwork. One table, in `face-movements.js`.

Reported and **not** changed, because each is a feature rather than a fault: the
`eyelids` and `pupils` categories ship no assets of their own (they come with
the eyes) and Face Setup has no row to assign lids through; `tongueX/Y/Out/Curl`
and the `cavity` role are reachable only on the shipped template, since no
library asset names them and there is no `tongue` category; `smile`,
`mouthWidth`, `teeth` and `tongue` have no calibration poses, so a library
mouth cannot be range-tuned visually; face-role detection knows only
pupil/brow/eye/mouth/head, so an import with layers named "nose" or "ears" gets
no suggestion; and four of the six shipped face presets use a mouth that draws
neither teeth nor tongue, which quietly degrades the expressions needing them.

## Unreleased — A hand is one layer, and a face is one of eight shapes

- **A hand is one drawing, and a drawing is one layer.** A hand used to be a
  palm, a cuff and four capsules stacked on each other, six paths a drawing and
  six drawings a hand: thirty-six nodes per hand in the layer tree, of which
  thirty-five were things an author could select, move or cut by mistake and
  none of which meant anything on its own. The silhouette is walked once now —
  up the thumb side, left to right over the knuckles, down the far side and
  back along the wrist — and comes out as a single `<path>`. A finger is not
  drawn *on* the hand; it **is** part of the hand's edge, so the shape closes
  with no seam inside it, and a folded finger is the same node with a short tip,
  which is what makes a fist read as knuckles over the top rather than as stubs
  hidden behind a palm. The layer tree shows eight leaves a hand instead of
  eight folders of six; the template's export carries 60 elements where it
  carried 128; and what is painted per hand per frame is one path.
- **Two more drawings, and four fingers on all of them.** The library is eight:
  the six it had, plus `ok` — thumb and index in a ring, which is the one
  drawing with a hole in it (a second subpath in the same path, `evenodd`, so it
  is still one layer) — and `sideFist`, a closed hand seen side on, which is the
  shape a hand makes resting against something. Every drawing has four fingers
  and a thumb now rather than three and a thumb. `handLStyle` and `handRStyle`
  run 0–7, and the picker beside the face, the Character Builder's cards and the
  Hand Setup chips all grew two rows without being told about them: they list
  the registry.
- **A face is one of eight shapes.** Four of them are a radius — `round`,
  `oval`, the new `wide`, and `narrow` are one ellipse with different radii, and
  `square-soft` is a rounded rectangle. The four the library was missing are not
  a bigger or smaller ellipse: what makes a `pear`, a `chin` and a `heart` is
  *where* the face is widest and how it closes at each end, so those are drawn
  from a width rule instead — a superellipse whose exponent slides from the
  crown to the jaw, tilted by where the weight sits. It is smooth by
  construction, which is the point: a face outline is the one line on a mascot
  that nothing else hides, and a ripple in it reads as a dent in the skull.
  Every one of the eight carries the same `jawOpen` pose as the original four.

## Unreleased — A closed eye is a seam, a page has room over the head, and a clip follows the head it was cut from

- **A closed eye's lids came down too far**, and the reason was arithmetic.
  `LID_TRAVEL` was the half-socket *plus the lid's own curved edge* plus a
  margin — but the drawing had already placed that curve, so the travel carried
  it twice. Measured at a full close: the upper lid's edge landed 8 units below
  the seam and the lower one 6 above it, fourteen units of lid through lid
  across the middle of an eye 45 tall. The travel is the distance from the
  point of the lid's edge that arrives *first* to the line the two meet on, so
  47.5 and 41.5 became 31.5 and 29.5: each lid comes onto the seam and stops
  there, they touch over the middle of the socket, and neither crosses the
  other. Half a blink covers exactly what it always did — only the last of the
  close changed. The built-in eyes had the same reasoning and the same fault
  (thirty units of overlap on the round eyes), and the same correction: a lid
  drawn touching the top of the eye travels the half-socket to the middle.
  `face-artwork.test.js` asserts the *shut* geometry now — the two edges
  sampled across the socket, meeting once and crossing nowhere — rather than
  "past the middle", which the overlap satisfied.
- **The page has room over the head.** The head fills its square, with its
  crown at y 22, so a page ending at the origin left twenty-two units above it:
  the top hat's crown was flattened from 78 units to 36 to fit, and the spiky
  hair had its spikes trimmed to the border. That is the page being wrong about
  hats. The artboard grows **upwards** instead — `0 -60 240 384`, sixty units of
  `FACE_HEADROOM` — which leaves every coordinate in the artwork, every
  `referenceBox` in the library, every measured anchor and every keyform exactly
  what it was, and moves only the edge of the page. The hat is a top hat again
  and the spikes are spikes. One place had to learn the difference: a pair of
  hands with nothing measured hangs in the lower corners of the page, and "the
  page" for that is the page *from the origin down* — nothing hangs from
  headroom — so the pair rests exactly where it did.
- **The shading and the fringe followed the head that had gone.** They are cut
  to a copy of the head's own outline kept in the definitions, and nothing ever
  wrote to that copy: installing any library skull left both clipped to the
  template's round silhouette, spilling over the new outline on one side and
  stopping short of it on the other. The install rewrites it now
  (`followHeadClips`), recognising the clip by **the drawing it holds** and not
  by an id — the clip that was the old outline is the one that becomes the new
  one — and carrying the fit onto it as a transform, because a clip is read in
  the space of the piece it cuts.
- **The template's measured eye box moved with its lids** (`TEMPLATE_ROLE_BOXES`,
  and the browser check that holds the live face to it): an eye is the whole
  group, the lids parked outside the socket included, since a box is geometry
  and knows nothing of the clip that hides them. The eye line it gives is 112.
- Not one head-turn baseline word moved for any of it. The turn is samples over
  measured centres and declared depths, and none of this is either.

## Unreleased — Facial hair is carried by the face it grows on

- **A beard follows the jaw and a moustache follows the mouth.** Reported as
  *"barbe et moustache ne suivent pas les mouvements de la bouche ni de la
  mâchoire"*: open the mouth on a bearded face and the chin lengthened
  seventeen units while the beard stayed exactly where it was drawn, which
  reads as hair floating in front of a face. `facialHair` was a semantic part
  with **no movements at all**, and all five drawings claimed none, so nothing
  drove them.
- **One movement, and it is not the hair's own.** Hair growing on a face is
  moved by the face under it, so the part's movement — `jawOpen`, because the
  jaw dropping is what moves it — is driven by `mouthOpen + jawOpen`: the very
  sentence the template's chin is stretched by, so the mouth takes the jaw with
  it, an author can still drop the jaw alone, and the hair tracks the chin at
  every combination of the two rather than only at the ends.
- **Not all alike, and not by asking what they are.** Each drawing says how far
  the stretch reaches its own hair and which way, because what decides that is
  where the hair is rooted and the drawing is the only thing that knows:
  the beard travels 15 with the chin, the goatee 18 (it is caught between a lip
  that drops with the mouth and a chin that lengthens with the jaw), and the
  two moustaches lift 3 and 4 — they sit on the *upper* lip, which this mouth
  does not move when it opens, so carrying them down would slide them into the
  opening underneath. **Sideburns claim the movement not at all**: they are on
  the temples, above the line the lower face stretches from, and a card that
  reads *Limited animation* is the honest thing for them to read.
- **Why a binding rather than a host or a constraint.** A host parents artwork
  inside a shape and SVG composes that shape's *transform* onto it for nothing
  — the right answer for an earring on an ear, and no answer here: this mouth
  and this jaw move by *deforming*, a shape key on the lip and a shape key on
  the silhouette, and a deformation does not travel down a transform. Nor is
  there anything to be drawn inside, both being a `<path>`, so the fallback a
  hostless host falls to — `rigConstraints` type `parent` — would copy a
  transform that never changes.
- **A movement driven by other words brings those words with it.** The
  validator refuses a binding naming a parameter the rig has not got, so
  enabling one now creates every parameter the registry describes and the
  expression names, and disabling or removing the part offers each of them
  back. A beard goes onto a face with neither a mouth nor a jaw and brings the
  two controls that move it.
- **The 2.5D turn is untouched.** A binding is not a keyform: every built-in
  asset signs the same head-turn word it signed before, `head-turn-baseline.js`
  unchanged.

## Unreleased — Controls that cannot cover each other, and that look like what they move

- **Two controls on one point is one control** (V3-14). There was no overlap
  avoidance at all: each control was placed on a fraction of the box its
  artwork measured, de-conflicted by hand, one definition at a time. A control
  is a button of a **fixed size in pixels** while its position scales with the
  zoom, so "beside the mouth" and "the middle of the mouth" are the same place
  on a small enough mascot — and a mouth fourteen units tall has nine controls
  inside it. The one painted on top took every drag and the other could not be
  reached. The handles are measured, packed and only then written now: every
  control is taken as the box its hit area really is, a control that clashes
  with nothing never moves, and one that does steps onto a ring of places
  around it and takes the nearest free one. The search cannot fail — ring `k`
  offers `6k` places, a pitch is wider than the widest control, and one control
  can cover at most four places on a ring.
- **Two of them were authored onto exactly the same spot.** `mouthWidth` and
  the right mouth corner are both *right of the mouth*, on the same element,
  and the eyebrow's tilt sits on the eyebrow's own control once the brows are
  opened. The guard in place could not see either: it compared
  `elements + at + group`, and a different group is not a different place on
  screen.
- **`offset` is read.** It has been on the handle record, normalized and merged
  since handles became records, and nothing had ever looked at it. It is the
  author's nudge, in screen pixels, applied before the packing.
- **A pin's reach squares are no longer inside the pin's own dot.** A shallow
  reach is a handful of artwork units, which at most zooms is a handful of
  pixels. They are pushed out along their own axis — never sideways, because
  the distance from the pin is the number they report.
- **Every control carries a drawing of the sub-part it moves**, posed by the
  very axes that control drives: the mouth's bends into a smile as it is
  dragged sideways, the eyelid's shuts, the teeth's shows teeth, the pupil's
  dilates. Eleven drawings — mouth, teeth, tongue, eye, pupil, brow, jaw, nose,
  hair, ear, head — drawn as strokes rather than shipped as icon files, so they
  move, keep the control's own colour, and are the same picture on the mascot
  and in the board's list. Which one a control gets comes from the **role** of
  the artwork it sits on, so nothing recognizes a control by its id.
- **The teeth and the tongue have controls at all.** Both were movements of the
  mouth with a slider in a panel and nothing on the mascot, which is the one
  thing a direct control is for. They sit inside the mouth's own cage, on the
  artwork they show, and both are dragged down — the way a row of upper teeth
  and a tongue come into view.
- **One answer to "how do several controls share a space."** The hand console's
  private cell-fitting and its ring and row gaps moved to
  `core/puppet/control-packing.js` beside the packing, rather than the app
  growing a second one.

## Unreleased — A hand that can be put down, and somewhere to put it

- **A behaviour beat live control in the exported mascot, so nothing could be
  held still** (V3-11). The engine composed the behaviours *after* the override
  layer, and a behaviour is additive: `mascot.setParameter('handRY', 0)` was
  answered by `getParams()` and then had Idle hands added straight back on top
  on the way to the artwork, every frame, for ever. That is why a drawn hand
  "never came to rest" — half a pixel of `translate(0 -0.31…)` that no pin
  could stop, and no way to see why. `docs/PARAMETER_MIXER.md` has always
  declared live control the last layer and the editor preview has always run
  it that way; the engine does now too. Nothing in a hand's own carry
  integrates: held still, its compiled transform does not move by one bit.
- **Preview had nothing for a hand at all.** Its live controls come from the
  face movement checklist, and `leftHand` declares no controls, so no hand
  parameter ever reached the panel it was sending authors to. Each hand now
  gets a section of its own, from the `hands` block: an XY pad on its own
  reach, the named places it can be put, the drawings it holds, and the turn,
  the way out from behind the head and the draw order as sliders.
- **Hand Setup ends in a control, not a signpost.** "Ready. Test it from
  Preview" is now **Where it goes** — the same named places, on the card — and
  **Hand style** sits beside it in the basic tier, showing the drawings this
  hand holds or the offer to give it some. A hand with no drawings used to be
  offered them under *Advanced*.
- **The holds reach every hand.** "Held to the face" was offered only to a hand
  with *no* drawings, which left the modern, recommended pair as the only hand
  that could not be put on its own chin. A hold is one number for a place that
  takes three to find by dragging; the drawn hand wants it most.
- **A hand drawn as one shape is given a group,** and then its drawings, in one
  undo step — instead of being turned away with "group this artwork first".

## Unreleased — What runs when: with no interaction, and following you

- **"With no interaction" is a thing the mascot can be told** (V3-09). It was
  faked with a periodic `timer`, which fires on a clock whether or not anybody
  is using the page, and no inactivity clock existed anywhere. `idle` takes
  `after` seconds and fires once the page has been left alone that long; any
  event at all sends the clock back to zero and the wait starts over in full. A
  `timer` is untouched — a metronome does not care that you were there.
- **The eyes follow the pointer, with no page code.** The gaze solver could
  split a look into eyes and head since V2, and **nothing drove it from the
  pointer**: `bindEvents` bound `click` and `pointerenter`, and that was all.
  A `gaze-follow` reaction now makes `bindEvents` watch the document for the
  pointer and write `gazeX` / `gazeY`; the solver decides the rest. Bound only
  when such a reaction is enabled, so no existing mascot starts staring at the
  cursor.
- **A hover has an end.** There was no `pointerleave` anywhere, so hovering
  played a reaction once and leaving did nothing. `hover` and `gaze-follow`
  **hold**: they stay in their hold phase while the pointer is there and run
  their release ramp when it goes.
- **Schema 5, and the one change in V3 that is not additive.** An older runtime
  meeting a trigger it does not know cannot tell it from a typo, and
  `normalizeReaction` turned anything unknown into a `click` — so a reaction
  meant for an idle page fired the moment someone touched the mascot. That is
  fixed at the root: an unknown trigger becomes `unsupported` and nothing fires
  it, not even `fire(id)`. Alongside it the rig now names what it needs in
  `requires` (`trigger:idle`, `trigger:gaze-follow`, and nothing else fills it),
  and `load()` declines a rig it cannot honour by name rather than by version
  number. `docs/RIG_MODEL.md` § Schema version 5.
- **One surface that says what runs when** (V3-10). Reactions and automatic
  behaviours were two panels sharing a comment, and the preset catalogue
  bucketed by *when* only for adding: once a reaction existed there was no way
  to move it. The list is drawn by when now — every when, including the empty
  ones — and each row carries the select that moves it, as one command and one
  undo step. One table (`core/reactions/runs-when.js`) feeds the list, the
  preset catalogue, the Preview bench and the Automatic panel's heading, so a
  new when cannot arrive in one of them and not the others.
- **A motion can be selected to run.** A clip had nowhere to go: an arrangement
  is editor-only and never exported, so the only way to make one play in a
  published mascot was to know a reaction could wrap it and write one by hand.
  Motions nothing runs are listed with a when beside them and one button.
- **Breathing and Tiny body bounce are gone.** Both were an `oscillator` on
  `bodyBounce`, a parameter *nothing in the editor defines* — no movement
  entry, no semantic part owning a body, no template creating it — so both
  cards read *unavailable* to every project that has ever existed and their
  Face Setup button led to a checklist with nothing on it. What they wait for
  is a body part, which is Face Setup work; `docs/BEHAVIORS.md` keeps the
  recipe, and a test now refuses any preset that asks for a movement the editor
  cannot make.

## Unreleased — The earring is on the ear

- **An accessory can belong to a part** (V3-03). An asset declares a `host` —
  a semantic part and one of its roles, `{ part: 'ears', role: 'leftEar' }` —
  and the install draws its artwork **inside** the shape that plays that role
  rather than beside it. The earring was `mountPoint: 'ear.left'` with a box in
  template coordinates, and a mount point is an anchor resolved once at fit
  time: choosing a different pair of ears left the earring where the template's
  ear had been, hanging in the air.
- **Nothing new runs to keep it there.** The runtime writes a `transform` per
  node, so SVG composes the nesting: the earring inherits `earWiggle`, the head
  turn and any follower's lag with no solver, no new document array and no
  per-frame cost. In the generated turn it now writes nothing of its own — a
  sample is what a part *adds* to what it is drawn inside, and an earring adds
  nothing to its ear. Its baseline word is re-signed for exactly that.
- **Replacing the ears re-homes the earring instead of severing it.** The
  drawing is lifted out before the old ears go, put inside the new shape that
  plays the same role, and fitted to it. Taking a host off takes what hangs on
  it off too. A `rigConstraints` entry of type `parent` stays the fallback for a
  host that is a lone shape and has no inside, and goes the moment a host that
  can hold the drawing arrives.
- **Library ears draw a group per side**, as the template's own ears do, since
  a bare `<circle>` is nothing to hang an earring in. **And there is a right
  earring**: a slot is a mount point *and* a host, so the two of them are two
  accessories and a face can wear both.
- **Two measurements that nesting changes**, both answered here: the layout is
  read in the host group's own space, or the host's fit scale is counted twice
  and the earring lands at four times its size; and a role's box leaves out
  what hangs on it, or the ear measures half an earring taller and everything
  fitted to it creeps down the page at every replacement.

## Unreleased — The eyes carry the head

- **A new mascot looks with its whole head** (V3-12). The template ships the
  gaze solver on, so moving the gaze turns the eyes and then, a beat later, the
  head. A small glance stays the eyes' own — that is the dead zone — and the
  overflow goes to the head.
- **The independent head angle is untouched**, which is what makes the default
  safe: the solved angle is *added* to `headX`/`headY`, never substituted. On
  the template, a gaze of 1 gives eyes 1.0 and head 0.63; the same gaze with
  `headX = -0.5` written by hand gives head 0.13.
- **Existing projects are left alone.** Switching a solver on inside a document
  an author has already tuned would change how their saved mascot moves, and
  the gaze parameters are not there to key. A blank project still stores no
  solver at all — `enableGazeSolver` is what puts one there.

## Unreleased — A lid that shuts downwards, and a hat that fits on the page

- **Reset on a lid gave back a lid that opened as the eye closed.** `eyeOpen`
  is the one movement in the registry that rests at its *maximum* — it sits at
  1 and closing counts down to 0 — so its amplitude has to be **negative**.
  `eyelids` had no driver entry, so Reset fell to the generic translate default
  (`amplitude +8`, `offset 0`) and produced a lid hanging 8px over the open eye
  that retracted to nothing as it shut: a blink played backwards, next to a
  lower lid that still closed properly. The registry now states the lid's
  driver, and a test pins the direction, not only the rest position.
- **One rule for the rest offset, not two.** `rebuildGeneratedBindings` still
  carried the old `scale ? 1 : 0` fallback while `enableSemanticControl` had
  moved to `restingOffset`; the two could disagree, and on a lid they did.
- **The top hat was drawn half off the artboard.** Its crown wanted 78 units of
  headroom above a head whose top sits at `y=22` on a 240 x 240 page, so the
  canvas cut it in the middle. Redrawn to fit, along with the two other
  drawings that overhung it — spiky hair by 2 above, the bow tie by 2 below.
  A test now refuses any built-in drawing whose box leaves the artboard.

## Unreleased — Everything worn on a head turns with it

- **Beards and glasses follow the 2.5D turn** (V3-02). The five accessories
  and the five facial hairs each declare how they sit when the head turns, so
  the turn carries them: a moustache rides the mouth's plane, a beard wraps the
  chin, sideburns lie back with the hair, a hat narrows with the skull it sits
  on, glasses sit just in front of the eyes, and the earring takes the left
  ear's own profile so it sweeps, tucks and fades with it. Each went from
  contributing nothing to the grid to carrying its own seven channels — the
  glasses now travel ±5.6px across a full turn where before they travelled none.
- **They could not have been added to the role table**, which is why this
  needed V3-01 first: the table is keyed by role name and all five accessories
  play the single role `element`, so a hat and a pair of glasses were one row
  and could never differ; facial hair had no row at all.
- **A part that turns gives up its parallax depth.** Parallax is the cheap
  stand-in for a rotation the turn has now done properly, and letting both fire
  displaces the piece twice. Glasses (`0.6`) and the hat (`0.8`) were the only
  two depths in the library; there are none left, and a test refuses an asset
  that declares both.
- **A project drawn before this gets the answer back on open.** The migration
  already proves a part is a given asset by its shape signature, so it now
  recovers that asset's turn profile too. The grid is not rebuilt behind the
  author: cells they captured are theirs.

## Unreleased — Drift can be added, and three docs say what the code does

- **`drift` is in the advanced Behaviors catalogue** (V3-10). It is the idle
  the mascot actually wants — it eases to a new place and rests there, where
  `randomIdle` jumps — and the runtime has scheduled it, the validator has
  checked it and the inspector has edited it since V2. What no surface could
  do was *add* one: the catalogue and the command allow-list were two tables
  kept by hand, both listing three types, so the only drift a project could
  own was one the Eye wander or Head drift preset had put there. The catalogue
  carries the fourth card now, the allow-list is **derived from it** rather
  than written out again, `travelMin` / `travelMax` are editable fields like
  every other type's settings, and one title table serves the card, the list
  row and the inspector heading — so a fifth type cannot land in one table and
  be missing from the other three. A travel pair typed the wrong way round is
  put back in order, as a rest pair already was.
- **And it runs once it is there.** The preview loop stayed awake for
  `['oscillator','blink','randomIdle']` and no more, so a mascot whose only
  behaviour was a drift — Eye wander with everything else off — slept after one
  frame and never moved. The list is `BEHAVIOR_TYPES`, because every behaviour
  type is driven by the clock.
- **`UX15_AUTOMATIC.md` routed to "Animate → Automatic".** The panel has sat
  under the reactions, in the Behaviors stage, since VNX-09; `USER_GUIDE.md`
  and `GUIDED_JOURNEY.md` repeated the old route, and `guide.js` has been
  routing to `reactions` all along. The doc also counted three presets where
  there are eight, and deferred Breathing to an ADR it never needed — it is an
  oscillator on `bodyBounce`, a movement nothing in the editor defines, so it
  and Tiny body bounce show as unavailable to every project. Said so.
- **`DIRECT_CONTROLS.md` still documented a hand with fingers.** Per-finger
  sliders on the rim, a grip, palm-or-side and palm-or-back, and a row of pose
  chips backed by `handPosePresets` — none of which exists: a hand is one whole
  drawing chosen by name (`docs/HAND_STYLES.md`), and its console is the turn
  round the ring, the draw order under it, the way out beside the face and a
  column of drawings outside that. The holds are described as the code offers
  them, which is only to a hand with no drawings of its own — V3-11's to settle.
- **`DEPTH_PARALLAX.md` listed example depths as if some asset held them.** Two
  do: the glasses at `0.6` and the hat at `0.8`, and they are accessories
  precisely because `headTurnElements` leaves accessories out of the turn. A
  part the turn carries declares no depth on purpose — the turn has already
  projected it, and parallax is the cheap stand-in for the same rotation, so
  firing both displaces it twice. The doc now says which two, why the other
  depth in the system is the hands', and why the two halves never overlap.

## Unreleased — The V3 roadmap

- **`docs/V3_ROADMAP.md`**: fifteen slices over the head that moves as one
  head and the controls an author can find, written from a six-way survey of
  the live code rather than from the V2 plan. Fourteen findings are recorded
  at the foot of it, each reproduced before being written down -- among them
  a preset's accessory placement validated and then silently dropped
  (`face-presets.js:238`), the canvas puppet handles switched off in the one
  workspace the timeline lives in (`editor-app.js:586`), Space dead while a
  motion plays (`timeline-panel.js:219`), and a handle `offset` that is
  merged and never read (`handle-model.js:155`).
- Linked as a program from `docs/UX_UI_IMPLEMENTATION_ROADMAP.md`.

## Unreleased — One escaper, in the last twelve panels that had their own

- **Twelve more panels import `esc`** from `ui/escape-html.js` instead of
  declaring it: the app shell (whose copy differed only in the spaces inside
  the object literal, which is why the sweep had skipped it), the mobile
  capability gate, the layers panel, the artwork inspector, the rig panel,
  the four state-machine panels, the two behaviour panels and the timeline.
  Two of them spelled it `escapeHtml`; they say `esc` now, like the other
  thirty.
- `core/export/exporter.js` and `core/hands/hand-style-art.js` **keep** their
  copies on purpose, and now say why: nothing in `core` imports from `ui`,
  and one shared escaper is not worth inverting the layering for.

## Unreleased — The Character Builder in the user guide

- **The ten-minute guide describes the builder**, which it had only named in
  step 1: the presets and the style cards, Colours, the hands (depth, mirror,
  each hand's drawings), Reset, Edit Shape and ↩ Back to Character, dragging a
  card onto the mascot, the arrow keys and the finger-sized rows, *Save as a
  library part*, *Save the face as a preset*, and ••• → Import face pack —
  pointing at `docs/CHARACTER_BUILDER.md`, `docs/FACE_PRESETS.md` and
  `docs/CUSTOM_FACE_PARTS.md` for the rest.

## Unreleased — The fifth pass

- **Every lid rests where it is drawn, whichever way the asset says so.**
  A driver hint's rest offset is now computed from *the amplitude that
  binding ends up with*: a side that gives its own amplitude and leaves the
  offset out was keeping the shared amplitude's offset, so a lower lid
  travelling +40 under a shared -38 sat 78px down the face with the eye
  wide open. And a part that claims a movement without saying how its
  drawing carries it gets the same rule instead of a bare 0 (`restingOffset`,
  now one function over `bindingNeutral` that the registry's defaults, a
  hinted install and a hintless one all agree on) — `eyelids.eyeOpen` is
  the one registry control that rests at 1 with no driver of its own, and
  it was sitting 8px down.
- **A character reference outside Unicode is answered, not thrown over.**
  `&#x110000;` in any paint made `String.fromCodePoint` raise a
  `RangeError` out of `findUnsafeSvg`, `validateFacePart` and
  `sanitizeSvgMarkup` — turning a face part's graceful refusal, whose whole
  contract is a list of issues for *any* input, into an uncaught exception.
- **The `<style>` cleaner reads the body the scan reads.** `@import` spelled
  `&#64;import`, or a `url(` spelled `&#x75;rl(`, was named by the scan and
  left in place by the fallback cleaner — the opposite of what this module
  promises. The paint attributes are one list now, with both regexes built
  from it, and `marker` (the SVG 2 shorthand for the three `marker-*`) is
  on it.
- **The parser branch stops decoding twice.** `&amp;#117;rl(…)` is markup
  that *spells out* `&#117;rl(`; a browser draws it as text and never
  fetches it, and the scan and the fallback cleaner both call it clean. The
  `DOMParser` branch was decoding the value the parser had already decoded
  and stripping the paint — three answers to one question in a module whose
  doc comment promises the three cannot drift.
- **A colour the hex field cannot spell survives *Use this colour*.** The
  palette holds `oklch(…)`, `rgb(…)` and named colours; the dialog showed
  "this piece is not painted", emptied the field, and repainted the piece
  black when an author opened a swatch to look and pressed the primary
  button. It now shows the colour, holds it, and keeps it (`shownColour`,
  `chosenColour`).
- An orphaned doc comment moved onto `applyHint`, which had none, and the
  run of blank lines the fourth pass claimed to have cleared is cleared.

## Unreleased — The fourth pass

- **An offset a driver hint leaves out rests the drawing as drawn**: the
  property's neutral value (1 for a scale or an opacity, 0 otherwise) less
  the amplitude times the movement's default (`restOffset`, over the
  runtime's `bindingNeutral`). The previous rule gave a scale 1 outright,
  so an eye opened by a scale of amplitude 1 rested twice as tall, and an
  opacity rested at 0.
- **The sanitiser's paint rule covers `cursor`**, the other presentation
  attribute that fetches a `url(`, and reads attribute values as the
  parser would: a character reference spelling `url(` or `@import` hides
  nothing from the scan or the fallback cleaner.
- **`isColour` accepts the colours a face is painted with** -- angle
  units in `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`,
  `color()` -- and refuses a 5- or 7-digit hex.
- The escaper's import sits below each file's doc comment, the doubled
  blank lines are gone, a stale doc comment and an orphaned one are gone,
  the validation test imports the sanitiser once.

## Unreleased — Security: a colour is a colour

A security review of the branch found one thing: the Character Builder's
swatches wrote a face's paint into a `style` attribute after HTML
escaping only, and a paint from a hostile pack or project such as
`#fff;background:url(https://…)` -- accepted by the scan, kept by the
sanitiser, read back as the skin's colour -- became a live declaration
that fetched the attacker's URL whenever the Colours row was shown.

- **`isColour` is a colour by its syntax** -- `#hex`, a named colour,
  `rgb()`/`rgba()`/`hsl()`/`hsla()` with numbers in it -- and nothing
  else; the builder's model shares it. A paint that is not one seeds no
  token and shows no swatch; the two swatch sinks fall back to
  `transparent` for anything else.
- **The sanitiser and its scan cover paint attributes**: a `fill`,
  `stroke`, `filter`, `mask`, `clip-path` or marker whose `url(` is not
  a `#` reference is an external reference -- reported at registration,
  stripped on install -- as the pack module always promised.
- **A preset's own colours are validated** (`palette-colour-invalid`).
- Docs: FACE_PART_LIBRARY (validation table), FACE_PRESETS (palette),
  KNOWN_LIMITATIONS (the sanitiser's rules; no CSP of its own).

## Unreleased — The third pass

- **A driver hint's missing offset is the hinted property's own rest**, not
  the registry's: a hint that turns a translation into a scale rests at 1,
  a hint that turns a scale into a translation rests at 0 (the registry's
  default offset belongs to the registry's own property). The test uses a
  hint that changes the property, so it bites.
- **A removal's preview warning reaches the status**, as a replacement's
  does.
- **The one HTML escaper is the one**: twenty-five more panels import it
  from `ui/escape-html.js` (the app shell's own copy differs and stays).
- The commands module's slug rule sits below its imports.

## Unreleased — The review of the review fixes

- **A removal's preview failure is reported, never rolled back**, as a
  replacement's already was; the result carries `warning`.
- **One way to turn a movement off by an install** (`turnOff`): a jaw pose
  that cannot become a shape key now keeps a `jawOpen` an expression still
  names, as every other movement an install turns off does.
- **A preset with two facial hairs is recognised whichever went on first**:
  a category a face wears several of is matched as a set.
- **Reset all is one fresh install**: the drawing comes back where the
  library puts it in one command, so a refusal leaves nothing half done;
  Restore library drawing alone keeps the author's place.
- The inspector describes the other hand without its pictures too; the
  HTML escaper lives in `ui/escape-html.js`, re-exported where it was; the
  commands module's imports are one block.

## Unreleased — One of each: the duplicates the reviews listed

- The four HTML escapers of the builder's panels are the one
  `ui/rig-controls/control-geometry.js` exports; the three layer-parent
  walkers are `face-layout.js`'s, which the builder's model re-exports;
  the two open-tag patterns and regex escapers are `openTagPattern` and
  `escapeRegExp` in `face-part-artwork.js`, with `matchesInstalledId` for
  the two installed-id matchers (repaint, migration); a replacement and a
  removal take the canvas's artwork through one `takeArtwork`, and a
  removal deletes the part through the registry's `removeSemanticPart`;
  a saved part and a saved preset share one slug rule; the focus marker's
  loop reads as the first-entry lookup it was.

## Unreleased — Character Builder: review fixes

- **A new project starts with no edit scope**: the scope Edit Shape set on
  one drawing no longer lands on an element of the same id in the next
  project or template.
- **Reset checks before it writes**: a library drawing that cannot come
  back (the asset forgotten, the plan refused) leaves the place as it was
  and says why, instead of a half-done reset recorded as one step; the
  piece in hand afterwards is the drawing that came back, whatever id it
  came back under.
- **Cheaper redraws**: the hands are described without their pictures for
  the inspector, the snapshot and the commands (`describeHands(document,
  { pictures: false })`); an instance's shape signature is computed once
  per part per derivation, with the attribute matchers built once.

## Unreleased — Face part library: review fixes, presets and colours

- **Every token its own colour.** The built-in accessories were painted in
  the pupils' colour, and a colour belongs to the first token seeded with
  it: an accessory never had a swatch of its own, and a preset's accessory
  colour was skipped while the pupils' recoloured the glasses. The
  accessories' primary is its own colour now, and every named palette
  gives `accessoryPrimary` a colour no other token has.
- **A saved preset reapplies**: a second facial hair a face wears is saved
  under `accessories` and put back on as facial hair, not refused as "not
  an accessory" (`planFacePreset` takes the library).
- **`parts` names only what the plan puts on**: an accessory named under
  `parts` is refused (`parts-category-accessory`, "name it under
  accessories"), and so is a part that comes with another; before, such a
  preset applied "ok" without the accessory ever going on.
- **Saving a preset validates once**, through the registry, and says why
  when refused.
- Tests: the robot's skull and bow tie asserted in their colours (the old
  assertion compared a value with itself); the facial-hair round trip; the
  refusals. The presets harness reads paints from the markup.

## Unreleased — Face part library: review fixes, installation and safety

A review of the library's first twenty commits; what it found in
installing a part and in what reaches the page, fixed with a test each.

- **The artwork scan reads every tag or refuses the artwork**: a tag it
  cannot read in full (an attribute with no quotes, two glued together) is
  `artwork-malformed` rather than skipped, so a handler glued onto a value
  (`src=""onerror=`) cannot slip past registration; the unsafe-markup scan
  and the fallback cleaner see such a handler too. Comments and CDATA are
  not tags.
- **Every picture goes through the cleaner** (`safePicture`): a part's or
  a preset's thumbnail is sanitised as any drawing the editor takes before
  it is put on the page, and carries the SVG namespace.
- **Ids are remapped in one pass**: a rename whose target is another id's
  source is never renamed twice, and a free name is never one the fragment
  already uses -- no duplicate id after an install.
- **A driver hint without an offset leaves the binding at the property's
  own rest** (1 for a scale, 0 otherwise; it was NaN); `driver-offset-invalid`
  refuses one that is not a number.
- **A role pointing at artwork the new asset does not draw stays with that
  artwork** (a tongue drawn by hand beside a library mouth) instead of
  being orphaned; a piece painted behind the face goes with the root on the
  next replacement whether or not it plays a role; several pieces painted
  behind keep the order the asset declared.
- **A jaw pose that cannot become a shape key** (a skull that is not a
  path) leaves `jawOpen` off rather than promised.
- **The preview failing after an install is reported, never rolled back**:
  the document keeps the new part as one undo step, and the status says
  what the preview said (`warning`).

## Unreleased — Docs: the reader's guides to presets and custom parts

- **`docs/FACE_PRESETS.md` and `docs/CUSTOM_FACE_PARTS.md`** (roadmap
  phase 38): what a preset holds and how it is used, saved and written by
  hand; the three ways a part is the author's own -- a reshaped instance,
  a piece saved as a library part, a part from a pack -- and how to write
  one. The Character Builder's vocabulary now defines asset, instance,
  mount point, preset, override and detached/custom. The README's index
  links both.
- **The program recorded**: the Character Builder's slices in the delivery
  log (`docs/UX_UI_IMPLEMENTATION_ROADMAP.md`), a "Character Builder
  complete" section in `docs/IMPLEMENTATION_STATUS.md`, and its limits in
  `docs/KNOWN_LIMITATIONS.md`.
- **Review fixes.** A preset's placement keeps a size per axis (`scaleX`,
  `scaleY`, with `scale` as the shorthand), so a flipped or stretched part
  is saved and applied as it was. A pack whose `version` is not a number
  is refused as such rather than read as version 1. A card of an asset the
  library has not got is refused with the reason whichever category is
  open. A drop on the canvas lands only while Character is the surface
  showing. New Project puts the focus on the recommended card.

## Unreleased — Character Builder: pictures drawn once, names not ids

- **A card's picture is drawn once** (`docs/PERFORMANCE_BUDGETS.md`,
  "Character Builder"; roadmap phase 32): `facePartThumbnail` and
  `presetThumbnail` keep the picture of a registered asset or preset by its
  identity and read it back on every redraw -- the six presets cost about
  0.01 ms a redraw instead of about 4 ms -- and draw it again only when a
  part it is made of is another object. `thumbnailStats` and
  `presetThumbnailStats` are the budget's evidence.
- **No id in the simple surface** (roadmap phase 49): the one-minute
  browser test checks that no chip, card, summary or piece name looks like
  an id or carries raw data.

## Unreleased — Character Builder: without a mouse

- **The arrow keys walk the builder** (`docs/CHARACTER_BUILDER.md`,
  "Keyboard and small screens"; roadmap phase 50): Right and Down to the
  next card, chip, colour row or category row, Left and Up to the previous,
  wrapping, Home and End to the ends (`ring-keys.js`); Tab reaches
  everything as before. On a phone or under a coarse pointer every chip,
  card and row of the two panels is at least 40 px tall. The browser test
  walks the rows without a mouse and checks every control has a name.

## Unreleased — Face part library: face packs

- **Face packs** (`docs/FACE_PART_LIBRARY.md`, "Face packs"; roadmap phase
  44): one JSON file of parts and presets, imported from *••• → Import
  face pack*, validated as a whole against the library and against itself
  (a preset may name a part of its pack), installed all or nothing as the
  author's own with the pack's id on each entry, kept in the browser and
  read back on the next open. The cards say **Pack**. `registerFacePack`
  does the same from a module, beside `registerFacePart` and
  `registerFacePreset`. Parts and presets carry a `pack` field (null for
  the built-ins and the author's own).
- **New Project closes the ••• menu** before opening Home, as the menu's
  other actions do: the taller menu was left open over the home cards.

## Unreleased — Character Builder: New Character, the one-minute path

- **New Character on Home** (`docs/CHARACTER_BUILDER.md`, "The one-minute
  path"; roadmap phase 47): the recommended card loads the rigged template
  and lands in the Character Builder with the presets open, the status
  saying what to do; *New Character* is in the command palette too. The
  template loader takes the landing task (`loadTemplate(kind, { task })`).
  A browser test walks preset → head → eyes → hair → mouth → glasses →
  hand style → Preview and holds it under a minute, with no rig step.

## Unreleased — Character Builder: drag & drop

- **A card dragged onto the mascot goes on the face** (`docs/CHARACTER_BUILDER.md`,
  "Drag & drop"; roadmap phase 22): every style card and every hand
  drawing that can be pressed can be dragged onto the canvas instead, and
  the drop runs the card's press -- the same command, the same one undo
  step, the asset's own category opened first. The canvas says so while a
  card is over it; a file or text dropped there is left alone; a card the
  face refuses is not draggable; the press stays for keyboards and touch.
  `part-drag.js` is both ends of the drag data.

## Unreleased — Face part library: presets with hands and placements

- **A preset carries the hands and the placements** (`docs/FACE_PART_LIBRARY.md`,
  "Presets"; roadmap phase 28): what each hand rests on (`hands`) and where
  each part sits over its fit (`placements`), both optional, validated,
  read from the face by *Save the face as a preset* and applied with the
  rest as one undo step (`place`, `restHand`). The Robot makes fists.

## Unreleased — Face part library: a jaw for library heads

- **Every built-in skull ships its jaw pose** (`docs/FACE_PART_LIBRARY.md`,
  "The skull rule"): a path drawn twice from the same points, at rest and
  with its chin dropped, given as a shape driver on the jaw part
  (`{ property: 'shapeKey', posePath }`, new to the asset model and its
  validator). The install makes a shape key of it on the skull, driven as
  the template's (`mouthOpen + jawOpen`), so `jawOpen` stays on through a
  head replacement and the animation matrix holds it to moving.

## Unreleased — Face part library: V1, and the compatibility badge

- **Seven more assets** (`docs/FACE_PART_LIBRARY.md`, "The built-in assets";
  roadmap phase 45): cartoon and minimal eyes, normal and expressive brows,
  balding hair, a large moustache, square glasses -- forty-two in all, each
  through the validator, the animation matrix and the thumbnails.
- **The compatibility badge says which movements** (phase 26): a card's
  title lists every movement of its category, ✓ carried or – not, under
  *Fully animated* or *Limited animation*.

## Unreleased — Character Builder: Reset

- **Reset** under the piece in hand (`docs/CHARACTER_BUILDER.md`, "Reset";
  roadmap phase 29): position (the fit's place and size for a library
  instance, where it was drawn for the template's own), colours (a library
  instance painted again in the face's tokens, `repaint(partId)`), the
  library drawing back on a reshaped instance, and all three as one undo step.

## Unreleased — Character Builder: the animation matrix and the round trip

- **Animation compatibility** (`docs/FACE_PART_LIBRARY.md`, "Animation
  compatibility"; roadmap phase 25): one test per built-in asset drives
  every movement it claims through the runtime's frame compiler and holds
  the drawing to moving.
- **The round trip** (roadmap phase 35): an e2e dresses a face end to end --
  eyes, mouth, hair, glasses, a colour, a hand's drawing and place -- saves
  it, opens the file again and finds the document identical.

## Unreleased — Character Builder: polish

- **The roadmap delivered** (`docs/CHARACTER_BUILDER.md`, the table at the
  end): PRs 1 to 16, from the shell to old projects read through the library.
- Focus survives a panel's redraw: `setPanelHtml` puts focus back on the
  control with the same data attribute, so a style, a preset or a drawing
  pressed with Enter leaves the keyboard where it was; the part browser
  redraws through it.
- On a phone, a piece chosen from the parts drawer raises the inspector
  sheet. The Character Builder is in the visual baselines (`ux22-visual`).
- README: the canonical path starts at Character or Artwork.

## Unreleased — Character Builder: old projects

- **An old project through the library** (`docs/FACE_PART_LIBRARY.md`,
  "Migration"; PR 15 of the roadmap): opening a project file or a recovered
  draft, every part with no asset yet is tried against the library's assets
  of its category, and the one whose artwork signs as the part's drawing is
  written on the part (`identifyFaceParts`), so the Character Builder marks
  its card current and the next replacement fits through its root. The
  rest are the author's own. Nothing about the artwork changes, and a
  document this cannot read opens as it was.

## Unreleased — Character Builder: custom components

- **Save as a library part** (`docs/FACE_PART_LIBRARY.md`, "Custom parts";
  PR 14 of the roadmap): the piece in hand into the library as a part of
  the author's own -- category, roles among its shapes, mount point; the
  artwork read from the document, the palette tokens its paints play read
  from the face's colours -- validated as any asset, kept in the browser
  (`boop.faceParts`), a style card marked *Mine* with *Forget* beside it.
- **A reshaped library instance is custom**: every install leaves the word
  its shapes sign as on the part (`assetShape`); a point dragged in Edit
  Shape breaks it, the builder reads the instance as *Custom · from …*,
  keeps its category, roles and movements, and the asset's card puts the
  library drawing back.

## Unreleased — Character Builder: hand style browser

- **The drawings of each hand are cards** under the pair in the Character
  Builder (`docs/CHARACTER_BUILDER.md`, "Hands"; PR 13 of the roadmap): the
  six the registry knows, with the picker's own thumbnails, the one the hand
  rests on marked. A press rests the hand on a drawing it has, or draws one
  it has not and rests on it, as one undo step. The runtime hand model is
  untouched.

## Unreleased — Character Builder: hand placement

- **Hands are placed like any piece** in the Character Builder
  (`docs/CHARACTER_BUILDER.md`, "Hands"; PR 12 of the roadmap): X, Y, Scale
  and Rotation are the artwork's base transform, which the rig adds its
  movement to, and the gizmo on the canvas drags, turns and resizes a hand.
  **Depth** and **Mirror placement** are the hand's own: the latter makes the
  other hand the mirror image, artwork and hand model both, as one undo
  step. Anchor, reach, softness and inertia stay in Face Setup → Hands.
- The reach guide of hand mode follows the artwork's own move
  (`handReachEllipse`), and a drag of the anchor maps back through it.

## Unreleased — Character Builder: Edit Shape limited to the piece

- **Edit Shape** from the Character Builder (`docs/CHARACTER_BUILDER.md`,
  "Edit Shape"; PR 11 of the roadmap) limits the visible edit to the piece:
  the rest of the drawing is dimmed and inert, a marquee and Ctrl/Cmd+A pass
  it by, a shape drawn with Pen or Shape goes inside the piece when it is a
  group. **↩ Back to Character** returns to the builder with the piece in
  hand; the Character tab does too; picking a piece outside the scope lifts
  it. `svg-canvas.js` gains `setEditScope`, `getEditScope` and
  `onEditScopeChange`; the marks are editor attributes the serializer
  strips, so nothing of it reaches the project.

## Unreleased — Character Builder: face style presets

- **Six presets** (`docs/FACE_PART_LIBRARY.md`, "Presets"; PR 10 of the
  Character Builder roadmap): Classic Cartoon, Professor, Young, Old,
  Robot, Minimal — each a recipe over the library with a named palette,
  offered as a card with a picture drawn from its parts. A press applies
  it to the face that is there as one undo step: extras off, every part
  replaced, accessories on, the palette painted. The browser reads which
  preset the face wears from its parts and marks it; **Reset** puts every
  part back where the preset puts it. A preset places every part *fresh*
  (`replace(..., { fresh: true })`): where the library puts it in proportion
  to this head, whatever the author had moved, turned or resized.
- Replacing the head with a head keeps the face's scale: the reference is
  the scale the old head was fitted at, not its own skull's width, which
  narrowed the next head a little each time. A transaction opened inside
  another is the outer one: `beginTransaction` says whether it opened, so a
  command made of commands is still one undo step.
- A flat brow from the library, a straight stroke whose box is as tall as
  nothing, takes the brow rig's ends: replacing the brows with
  `eyebrows.flat` used to refuse.
- **Save the face as a preset** of the author's own, kept in the browser
  and read back next time; **Forget** drops it. `MASCOT_PRESETS` and the
  template card are untouched.

## Unreleased — Face part library: facial hair, and several accessories at once

- **Facial hair is a part** (`docs/FACE_PART_LIBRARY.md`, "Several at
  once"; PR 9 of the Character Builder roadmap): a `facialHair` semantic
  part with one role and no control yet, and four styles — moustache,
  goatee, beard, sideburns — each at a mount point of its own.
- **Several accessories at once.** Glasses, a hat, an earring and a bow
  tie, one part per mount point: an asset whose mount point is already
  worn replaces the part there, any other joins. Each worn part is a piece
  of its own in the builder, and **Remove** takes it off as one undo step.
- An asset may declare a `depth`, written to its root on install for a
  face with parallax on. Thirty-five built-in assets.

## Unreleased — Character Builder: the face's colours as tokens

- **Colours** (`docs/FACE_PART_LIBRARY.md`, "Palette tokens"; PR 8 of the
  Character Builder roadmap): a row of the parts list with one swatch per
  token the face has — skin, outline, hair, eye white, pupil, mouth… — read
  from the part that plays each token's role; a pick changes every fill
  and stroke painted that colour, as one undo step. Nothing is stored: the
  SVG stays the only truth.
- **A library part comes in the face's colours.** Assets declare which
  token each paint plays (`paletteRoles`), and the fragment is painted in
  the face's colours before it goes on: a round head on a green face is a
  green head. All twenty-seven built-in assets declare theirs.
- `canvas.describePaints()` with no id reads every element's paints.

## Unreleased — Face part library: hair as one part

- **Five hair styles** (`docs/FACE_PART_LIBRARY.md`, "Pieces painted
  behind"; PR 7 of the Character Builder roadmap): short, spiky, curly,
  long and bald. Hair is one part in the builder and up to three roles in
  the rig; the long style paints its back behind the face.
- **Pieces painted behind.** An asset lists under `behind` the pieces the
  canvas lifts out of its fragment to the front of the group — where the
  old part's back was, behind the template's ears — and the part remembers
  them, so the next replacement takes them out with the root and the
  builder moves them with it: root and back share one pivot and one
  transform, one undo step. A group left empty by what went (the
  template's clipped fringe group) goes with it.

## Unreleased — Face part library: the basic face library

- **Twenty-two built-in assets** (`docs/FACE_PART_LIBRARY.md`, "The
  built-in assets"; PR 6 of the Character Builder roadmap): four heads,
  three pairs of eyes, three pairs of brows, four noses, five mouths, three
  pairs of ears, all drawn in the template's frame, every one installing on
  the template with a rig the validator passes.
- **Composite assets.** An asset may draw the *other* parts a feature holds
  — a pair of eyes with its pupils and its lids — under `parts`, and then
  it may replace a feature drawn around them: each of those parts takes its
  roles on the new shapes and keeps its movements, side movements included.
  `drivers` say how a drawing carries a movement the registry knows only as
  a shape (a lid drawn open comes down as the eye shuts).
- **The skull rule.** On the template the head is the whole face; a head
  asset replaces the skull inside it, the jaw takes the new shape and the
  face keeps turning. On a face whose head is a lone shape, the asset is the
  head. Library skulls carry no jaw pose yet, so `jawOpen` goes off on them.
- A library part is one piece in the builder, but a pupil inside a library
  pair of eyes is the pupils', not the eyes': its fields move the pupil.

## Unreleased — Character Builder: pairs edited as one

- **Edit both eyes** (`docs/CHARACTER_BUILDER.md`, "Linked editing"; PR 5 of
  the Character Builder roadmap). The eyes, the pupils, the brows, the ears
  and the lids are pairs: with the box ticked — it is, until it is unticked —
  a Position, Scale or Rotation write on one side is written on the other
  too, as one undo step, the move and the turn mirrored, the height and the
  size the same. **Spacing** is the distance between the two, measured on
  the canvas; setting it moves each side half the difference. Unticking
  edits one side alone; the setting is the builder's for the session and
  never touches the project. A pair is read from the roles, or from a
  symmetry peer named in Artwork; a locked side is left alone.

## Unreleased — Face part library: layout and auto-fit

- **A library part lands on any face** (`docs/FACE_PART_LIBRARY.md`, "Layout
  and auto-fit"; PR 4 of the Character Builder roadmap). The face is read as
  a layout context — the skull's box, the eye line, one anchor per mount
  point, measured from the part that plays the role or placed by the
  template's proportions in this head — and an asset is fitted with one
  similarity: at this head's size, its reference box centred on its mount
  point. A nose added to a face somebody drew lands on that face's nose,
  the right size, with no hand from the author; on the template, fitting
  moves nothing.
- **Replacing again does not drift.** A part that came from the library
  carries its anchor through its root, so a part replaced ten times stays
  where the first one went; the author's turn and size ride on top, the old
  fit's size divided out first.
- **A library part is one piece in the builder: its root.** Position, Scale
  and Rotation move the whole part whichever shape inside it was clicked,
  and the inspector says so; the shapes inside are reached through Edit
  Shape and Advanced.
- The template's parts as the canvas measures them are written down
  (`TEMPLATE_ROLE_BOXES`) and held to the live face by a browser test.

## Unreleased — Face part library: replacing a part

- **A style card replaces a part** (`docs/FACE_PART_LIBRARY.md`,
  "Installing"; PR 3 of the Character Builder roadmap). The open category in
  the Character Builder lists the library's assets for it, with a thumbnail
  generated from each asset's artwork; a press is one command and one undo
  step: the old pieces leave the canvas, the new fragment lands where they
  were, the semantic part keeps its identity, its roles move onto the new
  shapes, and the movements the new drawing carries stay enabled on fresh
  drivers. **Changing a mouth never takes `smile` away**; a parameter an
  expression or a clip still names is kept even when the drawing has nothing
  to move for it. The mouth's corner pins, the brow pins and the head-turn
  cells are regenerated for the new shapes; every reference to the old ones
  — shape keys, poses, pins, holds, followers — goes with them.
- **One primitive on the canvas**: `replaceArtwork(removeIds, markup,
  { mountPoint, before })` swaps nodes and reads the document back without
  touching the store, so the rig that follows is one write over it. The
  fragment goes through the same sanitizer as every import.
- **Ids are made unique on the way in**: an asset's `mouth` becomes `mouth-2`
  when the mascot still draws one, references inside the fragment rewritten
  with it. An asset's root must now carry an id (`artwork-root-id`).
- **What is refused, in words**: a head or a pair of eyes on the template
  (drawn around the other parts), facial hair (no part yet), an asset of
  another category. The card is disabled with the reason in its title, and a
  refused swap puts the canvas back with nothing in the history.

## Unreleased — Face part library: the registry

- **A face part is an asset** (`docs/FACE_PART_LIBRARY.md`, PR 2 of the
  Character Builder roadmap): one SVG fragment, which of its shapes plays
  which role of a semantic part, the movements it carries, the box it was
  drawn against, where it mounts and the colour tokens it uses. The runtime
  never sees one; it sees the part the asset becomes, so `smile` means the
  same thing on every mouth the library will hold.
- **The categories read the rig.** `FACE_PART_CATEGORIES` names the eleven
  categories of the roadmap and takes each one's roles, required roles and
  movements from the semantic part registry, so a control added to the rig is
  a control an asset may claim with nothing to update. The Character Builder
  lists the same table (its `brows` and `accessories` rows are now `eyebrows`
  and `accessory`, the library's ids).
- **Validation with a code per refusal** (`validateFacePart`): id, category,
  name, one well-formed fragment with distinct ids, roles the part has that
  name shapes the artwork draws and cover what the part needs, movements the
  part has, a known mount point, a box with area, known palette tokens.
  Warnings let an asset in and feed the compatibility badge: *Limited
  animation* names the movements a drawing does not carry.
- **One sanitizer.** `findUnsafeSvg` names what `sanitizeSvgMarkup` would
  remove — a script, a foreignObject, an event handler, an external
  reference, external CSS, a `javascript:` URL — sharing its predicates and
  cleaning nothing; installing still runs the cleaner.
- **A registry** (`createFacePartRegistry`, `FACE_PART_LIBRARY`,
  `registerFacePart`, `registerAccessory`): validated, frozen assets by id,
  listed by category, a pack registering all of its assets or none. Three
  built-in assets prove it — `mouth.simple`, `mouth.wide`, `nose.dot` —
  drawn in the template face's frame. Installing them is the next PR.

## Unreleased — Character Builder shell

- **A simple surface over the same mascot** (`docs/CHARACTER_BUILDER.md`,
  PR 1 of the Character Builder roadmap). **Character** is the first step of
  Create: the parts a person names on the left — Presets, Head, Eyes, Pupils,
  Eyelids, Brows, Nose, Mouth, Ears, Hair, Facial Hair, Accessories, Hands —
  the existing canvas in the middle, and one Part Inspector on the right with
  Position, Scale, Rotation, Colours and **Edit Shape**. The layer tree, the
  drawing tools and the rig are put away there and one press away.
- **A category is a reading of the semantic parts**, never a second record of
  them: a press selects every piece that plays the part, on the canvas and in
  the inspector at once, and writes nothing. A click on the mascot lands on
  the part that owns what was clicked, the nearest one, so the white of an eye
  is the eyes and not the head.
- **Every edit is the command Artwork already runs**: a field is
  `artwork/set-transform` (one undo step), a colour swatch changes that colour
  everywhere the piece uses it as one undo step, and dragging, nudging and the
  gizmo modes work on a part exactly as in Artwork. Scale is one number that
  keeps a mirrored piece mirrored.
- **Edit Shape** opens Artwork on the piece with the Node tool on its points
  when it is a path; **Advanced** opens Artwork or Face Setup on the same
  part. The hands are a pair to pick and recolour, with the door to their
  anchor, reach and drawings; Presets is the template face until the part
  library arrives; Facial Hair says it has no part yet.
- The canvas learned two things and nothing else: which workspaces select and
  drag (`create` and `character`), and `describePaints(id)`. The stage
  navigation is a touch denser so the third step of Create fits at 1280 px.
- Unit suite 1253 passing; `tests/e2e/ux45-character-builder.spec.js` covers
  the shell in the browser.

## Unreleased — Hands are static drawings, chosen by name

- **A hand's shape is a *style*, and nothing else.** A style is a whole drawing
  that never deforms: no finger is rigged, no shape key touches a hand, no
  angle chooses anything, and there is no view, no facing axis, no threshold,
  no hysteresis and no morphing. What is left of a hand is where it is, how far
  it is turned, how big it is, whether it is on screen, and which of six
  drawings it shows (`docs/HAND_STYLES.md`).
- **Six drawings, and that is the library**: `relaxed`, `open`, `fist`,
  `point`, `thumbsUp`, `peace` — every one the same palm and the same cuff with
  different fingers on it, inside the same 200-unit box around the same pivot
  (the middle of the palm), at the same apparent size. They are literal
  geometry in `core/hands/hand-style-art.js` — `M`, `C`, `L` and `Z`, every
  number a coordinate — with no pose table, no curl, no bend and no view
  anywhere in them, and a test that greps for all of those.
- **One file per style, not one per side.** Every shipped style is mirrorable,
  so the right hand is the left one with its x negated, and
  `project/assets/hands/defaultCartoon/` is six files and a manifest where it
  used to be twenty. The registry allows `mirrorable: false` with a drawing per
  side for a style whose mirror would read wrong; none of the six needs it.
  `npm run hands:styles` writes the set and a contact sheet.
- **`resolveHandStyle(style, side)` is the whole resolver**: a name and a side
  in, an asset and a flip out. An unknown name never stops a render — it falls
  back to `relaxed` and says so on the console once per name, not once a frame.
- **`step` joins the easing catalogue.** A style is an index into the hand's own
  library, and halfway between two drawings is not a drawing: a style track
  holds its value until the next key and then takes it. The two clips a pair
  ships with use it, and swap **while the hand is behind the head** — the Wave
  opens its hand as it comes out and closes it back on the way in, so the change
  is never seen.
- **Gone from a hand**: the procedural glove generator and its three view
  tables, the `handLFacing` pseudo-3D turn, the per-digit curls, `handLGrip`,
  `handLFlip`, the pose editor, the built-in and imported drawing *sets*, the
  cross-fade between two drawings, and the little rig each drawing carried of
  its own (`handLAnim` / `handRAnim`). Basic Face's pair exports **0** shape
  keys where it exported 30 (and 202 before that), and the rig carries 68
  parameters where it carried 70 — with the eleven that decided a hand's shape
  replaced by one.
- **The editor lost the controls for all of it.** The Hands card is where the
  hand is, which drawing it shows, its reach, its feel and its draw order; the
  canvas console is a turn round the ring, a draw order under it and the way
  out beside the face; the picker beside the face is one cell per drawing. No
  finger slider, no view row, no facing chips, no pose editor, no Capture.
- **Old projects still open.** Nothing is converted behind anybody's back: a
  hand that still carries the pseudo-3D turn is marked, and the conversion is
  an action its author takes. It renames what asked for a pose — clips,
  expressions and stored states rewritten as stepped style tracks, so a mascot
  that waved still waves — takes the drawings' own animation off, hides the six
  parts rather than deleting them, and drops only the parameters nothing else
  names. `handLAnim` values a file still stores are dropped on the way in.
  `sprites`/`drawings`, `handLDrawing`, `pose.shapeKey`, `pose.variant` and
  `swap: 'crossfade'` are read and never written.
- Unit suite 1231 passing; critical e2e 115 passing. `docs/HAND_STYLES.md`
  replaces `docs/HANDS_2D.md`, `docs/HANDS_2D_AUDIT.md` and
  `docs/HAND_REPRESENTATIONS_STUDY.md`; `docs/HAND_RIGGING.md` is now about
  anchors, reach, inertia, holds and hiding, and nothing about deformation.

## Unreleased — The mascot has hands

- **A finger's root reaches into the palm instead of stopping at its edge.**
  Seen from the side, the index met the palm in a line straight across its
  base: its root sat past the palm's own edge, so there was no outline to cut
  it against and it was finished with a line of its own. A tube now grows
  backwards along its own curve under the palm (`ROOT_DIP`) and the crossing
  search reaches with it, so the cut lands somewhere the palm is wide enough to
  hide it; the side view's index moved a unit inwards so there is palm under it
  to reach. None of the extra length is ever drawn, and the palm view's resting
  hand is unchanged byte for byte.
- **Every finger's root is finished.** A digit's edges are cut on the palm's
  outline so nothing of their ends shows — but only while there *is* an outline
  under them. A finger folded onto the palm is nowhere near one, and a finger
  growing off the side of a palm too narrow to meet it has none either, so both
  ended in two loose lines in the middle of nothing: a fist drawn as a bundle
  of sticks, an edge-on hand with stubs beside it, and a hand turned away with
  a little lozenge of a thumb marooned on its palm. The fold sub-path each
  digit already carries now does double duty — the crease across the knuckle
  where the digit grows out of the palm, the line that **closes the root**
  where it does not — and which one a digit gets is read off the drawing
  (`rootSink`, `BASE_SIT`, `BASE_MEET`) rather than off its curl, so a hook, a
  tucked thumb and a hand-posed finger are all covered. The far view parks its
  thumb under the cuff, which is painted over it. `hand-feature.test.js` walks
  every pose in every view and asserts that no free stroke end is left in the
  open.
- **A finger creases on the inside of its bend, and nowhere else.** Fold a
  finger and the skin creases on the side it closes towards; the far side
  stretches smooth. The fold ran edge to edge from a hard-coded side of the
  tube instead — across the back of a hooked finger as well as its palm side,
  and on the far view, whose hook bends the other way, on the wrong side
  altogether. It is now anchored on the inner silhouette and reaches across
  only as far as the bend leaves it. A bend past 30° also brings the fold out
  on its own, so a hand closing edge-on has knuckles rather than smooth hooks.
- **A hand closes onto its palm, in profile too.** Turning a hand to show its
  thumb and then closing it bent every finger backwards, over the back of the
  hand: the profile `hook` had the wrong sign, so a curl carried the fingertips
  *away* from the thumb instead of towards it. `hand-feature.test.js` now
  measures the one thing about a hand nobody has to be told — a curled
  fingertip ends up nearer the thumb, in all three views and on both hands.
- **A closing hand folds its fingers in front of the palm.** They folded
  *behind* it: a curl only shortened the digit, so the fingers retreated past
  the palm's edge and out of sight, and the fist pose placed its folded fingers
  on a lowered knuckle line — which is what a fist looks like from the back of
  the hand, not from the palm the mascot shows us. A curl now also slides the
  digit back onto the palm (`CURL_OVER`) and stops cutting its root at the
  palm's outline as it goes; the digits are painted after the palm, so a folded
  one shows over it. The fist, point, peace and pinch poses let the same slide
  place their folded fingers instead of hand-placing them.

- **A cut lands on the shape that cut it, and can be taken off from the bar.**
  Cutting a piece that sits inside a turned group put the cut wherever that
  group's turn sent it: only the piece's *own* transform was divided out, so a
  hand — which rests rotated two hundred degrees — sent the cut clean off the
  mascot, drawn as an orange dashed outline beside a face it had nothing to do
  with. The whole chain is divided out now, on the way in and on the way out;
  the outline composes the cutting shape's own transform with that chain
  instead of writing over it; and both multiply the chain out of the elements'
  own transforms rather than reading a nested `<svg>`'s CTM, the one
  measurement this canvas never trusts. Reading a transform no longer rewrites
  it either — `SVGTransformList.consolidate()` replaces the list it reports —
  so selecting a piece stops turning `translate(10 20)` into a matrix in the
  saved file. Releasing a cut whose shape carried a transform used to throw:
  `DOMMatrix` parses the CSS spelling and every SVG here is written with the
  space-separated one. And a cut piece now says so in the bar above the canvas,
  beside a **Stop cutting** button — it said so only in the right-click menu,
  which is a thing an author can see, cannot name, and can only act on by
  guessing.

- **The hidden pair is really hidden.** A hand large enough to read beside the
  face is larger than the gap between its hiding place and the outline, so a
  mascot at rest showed the fingertips of both gloves poking past the
  silhouette — on the very first look at the template. The hiding place is a
  *point*, and no point is right for every head, so the glove **shrinks as it
  goes back** instead: two more keyforms on the `handShow` axis that already
  slides and re-orders it. `templates.test.js` flattens the head outline and
  asserts every point of both gloves is inside the polygon.
- **A finger's slider is on that finger.** The rim's sliders were spread evenly
  over a sweep the console picked for itself, which put the thumb's slider over
  the middle finger and left two of them on empty rim -- and mirrored the
  closing direction, so the same gesture closed one hand and opened the other.
  Each one now sits on the stretch of rim its own finger points along, from
  `handDigitTip` (the function that draws the outline) turned by the rest tilt
  and mapped onto the ellipse the ring really is; the grip sits just past the
  thumb, clear of the fan it closes; the holds take whatever arc is left, which
  is the one facing the mascot. And **closing turns the ring clockwise on both
  hands**: the artwork's handedness decides where a slider is, never which way
  an author has to turn it.
- **A hand is posed on a console now, not on a scatter of dots.** Ten movements
  on a part the size of an eye — five fingers, a grip, a turn, a facing, a flip,
  and how far out from behind the head it is — were ten handles on the hand's
  bounding box, folded behind an opener because ten dots is a minefield. Which
  only hid the problem: once open, nobody could tell which dot was which. They
  are laid out on a dial around the hand instead, from the reach it already has
  (`core/puppet/hand-console.js`): the **ring** is the reach and the hand is
  dragged inside it, the **rim** carries one slider per finger on the arc facing
  away from the mascot, and the **row** under it carries the turn and the
  facing, side by side on one line. Each is an ordinary handle with a *track*,
  so the knob is drawn where the value puts it and a drag is projected onto the
  track — sliding along a slider moves it, sliding across it does not, on an arc
  as much as on a straight one. Arrow keys follow the track too.
- **How far out the hand is has a slider beside the face.** `handLShow` was a
  parameter with no control on the mascot at all: the pair rested behind the
  head and the only ways out were an expression, a motion or the page. It is now
  an upright slider beside the face on the hand's own side, running downwards —
  slide it down and the hand comes down from under the head with its console
  around it. And while a hand is hidden it is the **only** hand control drawn:
  every slider on the console carries the condition `handShow > 0.05`, because a
  ring with ten sliders around a hand nobody can see is clutter around nothing.

- **Basic Face ships a pair.** The template's artwork carries the two glove
  groups and `applyTemplateProject` calls the same `installHands` the **Draw a
  pair of hands** button calls, with the same (absent) measurement — so what it
  ships *is* that press rather than an imitation of it, and there is no second
  set of coordinates to keep in step. The artboard grows to 240 × 324 because
  `handsArtboard` says a floating pair needs that much room below the mascot;
  the face keeps every coordinate it had. The hands rest **behind the head**, as
  a drawn pair does, so the mascot still arrives as a face and `handLShow`
  brings one out — which the faces, motions and reactions now do.
- **The hands are half again as big, and the mascot's own colour.** At `0.72`
  the glove came out a third of the head's width, which reads as a child's hand
  on an adult's head: a floating cartoon hand is *large*, because it has no arm
  to give it scale and nothing but its size says how near it is. `HAND_SCALE` is
  `1` now — a little under half the head, where the sheets this hand is drawn
  from put it. And `handStyle` takes a look whole rather than only by name, so
  the template dresses its pair in `FACE_PALETTE` instead of standing a white
  glove beside a warm face: recolouring the mascot recolours its hands.
- **A hand is *held* to a place on the face, angle included, by one number.**
  Placing one was `handLX`, `handLY` and `handLRotation`, and getting all three
  right for "a hand on the chin" is something an author does by nudging sliders
  and looking. The rig has had holds since CR-38 — a named point put on a named
  point, `orient` taking the anchor's rotation too — and what it could not do is
  decide *where* the places are. The template says: it drew this face, so it
  knows where its chin is. Five places (chin, both cheeks, mouth, forehead) and
  eight holds, `handLOnChin` … `handROnForehead`. Three things make them work:
  the palm is the hand's pivot, so `orient` turns it about the very point it is
  held by; each hold carries a `depth` keyform past the band edge, or a hand on
  a forehead would be *behind* the head it is resting on; and a hold does not
  show the hand, so every motion that uses one raises `handLShow` beside it.
- **Eight hand motions**, the group a mascot with hands had nothing in — Wave
  hello, Clap, Point, Thumbs up, and the four the holds made possible: Hand on
  the chin, Hand on the cheek, Hand over the mouth, Facepalm. Each turns the
  hand the right way up first: a hand rests fingers *down*, so every pose drawn
  fingers-up arrives upside down — a thumbs up was a thumbs down until something
  turned the hand back, which is what the Wave clip had always quietly been
  doing. The catalogue is 43 presets over four groups.
- **Three faces reach for a place instead of a pair of numbers.** Thinking puts
  a hand under the chin, Shy up to the cheek, Annoyed over the forehead — one
  hold each, so the hand is at the right angle and follows the head there. A
  project whose hands are not held to anything keeps the face and is not told
  anything is missing, exactly as it is not told it has no hands.
- **Two things a pair of hands on the canvas found.** The opener that unfolds a
  group's own controls was positioned only for handles measured from a *box*, so
  a handle that names a **point** — a hand held by its cuff — left both openers
  where the browser put them, one on top of the other in the corner. And the
  reach ellipse drawn while a hand is dragged is one node for all of them, so
  the hand that was *not* being dragged removed the one that was. Neither had
  ever been seen, because no template shipped a hand made of parts.
- **"Show on canvas" shows the hand**, not only its anchor and its reach: a pair
  that rests behind the head is a pair an author would otherwise be setting up
  blind.
- **`handLOnChin` reads as "On the chin".** The control catalogue derives a
  hand's parameters from their suffix rather than from a table; an `On…` suffix
  is a hold, and it gets a **Held to** section of its own so a panel does not
  offer "On chin" beside "Thumbs up".
- The browser tests for *drawing* a pair start from a **built face** now — the
  Face Builder's head, eyes, brows and mouth — because the one mascot the editor
  ships with hands already has them.

## Unreleased — The teeth and the tongue

- **Two slabs became two curves.** Each band behind the lips was four points: a
  span of the lip, an end of its own a fraction of the way out, and a straight
  `L` between them. What that draws is a vertical cut a few units tall at each
  end with a visible step where it meets the lip — a white block with square
  corners for the teeth and, under it, a pink block with square corners for the
  tongue, which was as wide as the mouth and half as deep, so an open mouth was
  two coloured slabs. A band is now **two quadratics sharing their ends on the
  lip**, with one control point pushed in: nothing to line up, and the shape
  tapers to nothing before the corners the way a row of upper teeth does. At
  `show 0` the two curves are the same curve traced twice, so closed lips still
  have nothing behind them — by construction rather than by arithmetic.
- **The tongue is a narrow dome that floats off the lip.** It spans 29–71 % of
  the lower lip against the teeth's 14–86 %, because a tongue is a shape *in*
  the cavity and one that reaches the corners is the cavity's floor; and it
  rests just above the lip rather than on it, because the dark line under it is
  what makes it a tongue in a mouth. Both bands also tuck their near edge inside
  the lip's own stroke, which is 3.8 units wide and centred on the path: a band
  whose edge lay exactly on it painted over the inner half and the lip went thin
  where the teeth were.
- **A half-shown tongue sits on the lip instead of floating up the mouth.** How
  far a band reaches was half of *this* mouth's cavity, which made every point a
  product of `open` and `show` — and the rig drives those separately, so a
  laugh at `tongue .5` came out half-sized *and halfway up the cavity*, clear of
  the lip it grows from. The reach is a constant now (half a fully open mouth)
  and each band has two keys instead of one: `-open` on `mouthOpen` travels down
  with the lip, `-show` on `mouthOpen * teeth` brings it out. Being affine in
  each, the two add up to exactly the drawing.

## Unreleased — The mascot arrives able to do everything

- **The template ships the catalogues instead of six clips and two empty lists.**
  `applyTemplateProject` calls `buildStarterKit(state, FULL_KIT)`: thirty-five
  motions, twenty-six faces and eighteen reactions, built the way an author
  would build them, under the presets' own ids. A clip that arrives with Basic
  Face and one added by pressing its card are now the same clip — tunable,
  resettable, detachable, deletable — where the six hand-written ones were
  custom Timeline clips that no Motion Inspector setting could touch. The kit
  skips what a project cannot do, so a face the Face Builder generated gets the
  subset its own movements support rather than a shorter hand-written list. The
  automatic behaviours are the one part that is deliberately not everything:
  two behaviours writing the same parameter fight, so `eye-wander` cannot run
  beside `natural-gaze` nor `head-drift` beside `idle-head`.
- **The motion catalogue reaches the whole control rig**: 20 presets over 9
  movements became 35 over 34. The rig has had a jaw that drops on its own, a
  brow whose two ends disagree, one eye that closes without the other, pupils
  that dilate, a tongue and a lip lock since `docs/FACE_CONTROL_RIG.md` went in,
  and every one of them was reachable only key by key in the Timeline — which is
  the timeline these presets exist to avoid. Some of the change is depth on
  motions that existed (a gasp dilates the pupils, a yawn is a jaw and a tongue
  rather than a wide `mouthOpen`, a laugh shows teeth, a sigh lifts the inner
  brows, a tilt leans the brows with the head, worry drops the outer ends, a
  tongue that comes out now wags). The rest could not be built at all before:
  Wink, Smirk, Raised Eyebrow, Cross Eyes, Dizzy, Chew, Glower, Sniff, Shiver,
  Peek, Double Take, Hair Toss, Ears Perk.
- **And so does the face catalogue**: the same twenty-six faces, described over
  24 controls instead of 9. "Brows up and inward" was `browTilt`, which leans
  both brows the same way; it is `browInner` now, which is what the sentence
  meant. Surprise dilates its pupils and drops its jaw, a smirk pulls one
  corner, a raised eyebrow raises one.
- **The Preview bench is grouped and foldable, because it got long.**
  Thirty-five motions, twenty-six faces and eighteen reactions as three flat
  columns of full-width buttons is seven thousand pixels of scroll, which is not
  a test bench. Each list is split into the groups its own catalogue declares —
  Head / Eyes / Face, Everyday / Playful / Thinking / Quiet / Strong, and the
  four triggers — under a heading that says how many are in it, and the buttons
  pack two to a row instead of one. Each *section* is a disclosure too, so the
  author who came to press a motion can put the twenty-three live movements away
  and keep them away; what they fold is remembered across the panel's rebuilds.
  The live controls themselves are one row per movement rather than three. The
  groups open by default and nothing is hidden: this is the panel for *trying*
  things, and a group you have to open first is a click between the author and
  the thing they came to press. Five thousand pixels, two and a half with the
  sliders folded.
- **Only one reaction answers a click, and the bench says which.** The runtime
  sorts the reactions listening for an event by priority and fires the first
  that takes, so six reactions on `click` are not six things a click does — five
  of them never run. That was invisible in a flat row of chips and bit the
  moment somebody clicked the mascot. The one that answers is marked, the rest
  are dimmed and named their winner, and the group says how many are shadowed.
  Timers are the exception, and each still runs on its own interval.
- **`startEmptyBasicFace`** for the journey tests. "Add your first expression"
  needs a mascot without one, and the template now has all twenty-six; the
  fixture is the same mascot — same artwork, same rig, same automatic life —
  with the three authored lists cleared. The hands test that watches a hand
  travel out from behind the head records the paint order frame by frame
  instead of reading it once after the click, which was measuring Playwright's
  latency against a 450 ms animation.

## Unreleased — Basic Face V2

- **Raise the brows and the brows go up.** `browRaise 1` is calibrated *RAISED* and lowered them; `hairLift 1` is calibrated *HIGH* and pulled the hair down over the forehead; `hairSway 1` is calibrated *RIGHT* and swung it left. None of the three had a driver of its own, so each fell back to the registry's `+8` for a translate — and screen `y` grows downwards. Every expression preset in the catalogue was written against the label rather than the behaviour (*"angry: brows down and inward"* is `browRaise: -.8`, *"surprised: eyes and brows up"* is `browRaise: 1`), so all sixteen of them, and the template's own **surprised** state, had been drawing brows the wrong way since they were written. `noseScrunch` had always carried its own `-5` for exactly this reason; the rest of the family has one now, in the registry, so it is fixed for the Face Builder and for any face an author rigs as well as for the template. `movement-calibration.test.js` reads every calibrated movement back off the registry and checks it against the words its own poses offer.

- **The features follow the curve of the head.** A brow and a mouth stayed dead level on a head that was unmistakably pitched: the generated turn said where every feature *lands* and nothing about which way it then faces, so a face looking down was a set of horizontal bars sliding about on a tilted skull. `featureTilt` is the missing half of the projection — a feature's own horizontal, yawed and pitched exactly as `projectPoint` turns its centre. Two things turn it, and it is both at once: the surface under a feature away from the middle line has already turned away, so pitching it lifts its far end (which is what makes the two halves of a *pair* rotate opposite ways and read as one arc across the face); and a flat card yawed and then pitched comes out rotated in the image plane by `−tan(yaw)·sin(pitch)`, which is why a three-quarter view looking down tilts a mouth that a straight-on view only bows. Pure yaw turns nothing, because a horizontal line on a head turned sideways is still horizontal.
- **And the mouth bows, because it cannot tilt.** On the middle line the surface tilt is zero by symmetry — a mouth does not lean when a head looks down, it *bends*, and a rigid element cannot. So `mouthGeometry` gained an `arc`: the corners lift as the head drops and fall as it rises, driven by `headY` through a shape key like every other change to this mouth, with the teeth and the tongue following the lip they hang from. Five units at a full pitch, which is a third of a smile — the head moving, not a change of mood.

- **The mascot is redrawn.** Same rig, same ids, same shape keys, same 2.5D turn; a different face (`docs/MASCOT_TEMPLATE.md`). V1's was assembled feature by feature and it showed: the head was a perfect circle, the eyes were a quarter wider than tall, the nose was a half circle a third of the width of the mouth in the same weight as the eye rims — a `U` above a `U`, in matching ink, which reads as a second mouth — the mouth at rest was a dead flat bar, the hair was a symmetric helmet with four triangular notches cut out of it, and the "shading" was two slabs the height of the face at 50 % in a brown darker than the hair. V2 has a cranium wider than its jaw with the cheeks drawing in to a small soft chin, eyes within 7 % of round, brows that are drawn shapes rather than strokes so they can be blunt at the nose and taper at the temple, a small lopsided hook for a nose at a third of the mouth's weight, a lip line that curves at rest, and hair with a parting well off the middle line, one long sweep across the forehead and a tuft lifting off the crown — which is the silhouette that identifies the mascot at 32 px, where none of the features are legible.
- **The rig reads the artwork instead of keeping a second copy of it.** Where the eyes are, how far a lid travels, the box a brow's two pins hang on, the box the mouth's lower lip is pulled by — `template-project.js` had all of it written out again as literals, so every one of them had to be found and edited twice. They come from `face-artwork.js` now (`FACE_CENTRES`, `LID_TRAVEL`, `BROW_BOXES`, `MOUTH_BOX`), which is the only reason a redraw of this size was tractable: a pivot that disagrees with the shape it turns is a part rotating about a point outside itself, and the way to be sure they agree is to have one list.
- **The clip path is the silhouette, not a circle that approximates it.** The hair and the shading were clipped to `<circle r="100">` while the head was drawn as something else — an arrangement whose whole future is a sliver of hair outside the outline. `headShape` is `headPath()` now, the same geometry the head element draws, and the shading is a `faceShading` folder carrying that clip rather than four loose shapes between the face and its features.
- **The eyelids are drawn open.** They rested shut and the rig lifted them, so the artwork on its own — the file an author opens, the thumbnail, the `mascot.svg` Export writes — was a mascot asleep. The drawing is the neutral pose now and closing the eye is what the rig does to it (the binding carries an offset, so `eyeOpen 1` is the identity). How far a lid travels is derived from the eye it covers rather than tuned by hand, so resizing the eye keeps a full blink covering it.
- **Teeth stopped being a white rectangle.** The band hung off the upper lip by dropping every point of it the same distance, which draws a strip of constant height across an open mouth. The ends come out less than the middle now, so the row follows the arch of the lip; the tongue does the reverse and domes. Both still enclose exactly nothing when the lips are closed, which is what `mouthOpen * teeth` being a product buys.
- **A wink closes an eye.** The eyelids grew a side offset (`eyeOpen + eyeOpenLeft`) when the face control rig went in, but the lower lid's binding and the eye rim's fade were both written by hand against the shared `eyeOpen` alone — so winking brought one lid down over an eye whose lower lid stayed put and whose outline was still drawn, and what you got was a crescent of white inside a circle with a crease through it. Both read the side offset now, and both directions of a wink close.
- **The eyes stay round through a turn** (`foreshorten` in `head-pose-turn.js`). The far half of every sided pair was compressed by 35 %, and on a pair of round eyes that is the difference between an eye seen at an angle and an oval. The eyes take under half of it; the outline still narrows underneath them, they still travel, and the far one still compresses — just not out of its own shape.
- **The soft shapes are point lists.** The hair, the shadows and the highlight are authored as silhouettes and turned into cubics by `spline()`, a Catmull-Rom curve whose tangents match on both sides of every point. V1's hair was hand-written cubics, and every join where two segments met without their control points lining up was a notch — which is what the saw teeth were.
- **`mascot-sample.svg` is the mascot.** It was a yellow circle with two black ovals and a smile, from before there was a template at all. Nothing loaded it, so nothing noticed that the sample mascot in the repository had not looked like the mascot for a long time. It is written from the template's own artwork now (`npm run assets:sample`), and a test fails if the two part company.
- **A cancelled warp drag puts the shape back.** Pressing Escape mid-drag abandoned the gesture correctly — the document was never written to — and left the bent outline on the canvas, because the restore wrote the *artwork's own markup*, where a warp is never baked. Nothing had noticed, because the face this editor shipped was a circle inscribed in its own bounding box: every point of it sat on the edge of a 3 × 3 lattice, where the middle handle has no weight at all, so moving that handle bent exactly nothing and there was nothing to put back. Basic Face V2 has control points inside its box, and `ux42-warp.spec.js` started failing on a test that had never had anything to test.
- **Two new ways to check the drawing.** `face-artwork.test.js` asserts the *properties* a redraw has to keep rather than its coordinates — a blink that covers the eye, a pupil that stays in its socket at a full gaze, a fringe that never touches a brow at any head pose, a jaw that lengthens the face without widening it, a transition that passes through drawings rather than through folded paths, no colour that is not in the palette, nothing that costs a filter. `scripts/face-snapshots.mjs` renders twenty-five poses through the exported runtime, so the half of a redesign no assertion covers can be looked at.

## Unreleased — The tools you build a mascot with are all reachable

- **"+ Add" on a part the mascot already has says so, instead of failing on the press.** Eyelids offered themselves on the template's own face and then threw *"Semantic part id collision: eyelids already exists"*, because installation was decided by comparing the part's roles against the ids of this module's own snippet (`upperLidLeft`…) — and the template draws lids of its own, called `lidUpperLeft`. The question is whether the **mascot** has the feature, so artwork drawn differently and named differently counts (`isFaceFeatureInstalled`). Every other reason a press would fail is now checked before it is offered rather than thrown afterwards — a half-assigned part of the same kind, artwork already drawing one of the ids, a motion already using one of the example clip ids — and the card carries the reason (`describeFaceFeature`). The list is *Add a part* now, built from one table with Hands beside Eyebrows and Eyelids, and on artwork that is not a starter face it says what to do instead of greying out silently.
- **A clip can be made, not only released** (`docs/VECTOR_EDITING.md`). Select two pieces and **Cut to top**: the one in front stops being drawn and becomes the shape that cuts the other. **Stop cutting it** gives that shape *back* to the drawing rather than leaving it in `<defs>` where nothing can reach it — which is what made a cut unchangeable, and is why the fringe's clip could only ever be taken off. A clip is read in the user space of the piece carrying it, after that piece's own transform (measured in a browser, not assumed), so the cutter is copied once per piece with that piece's matrix divided out and the cut lands on the shape the author is looking at.
- **Colour is a dialog that starts with the mascot's own palette** (`docs/VECTOR_EDITING.md`). Fill and stroke were an `<input type="color">` — the operating system's picker, which knows nothing about the drawing — so matching the skin or the line colour meant copying a hex between two fields, and every shape drawn from the toolbar arrived in the same blue. The swatch in the Inspector and in the tool options opens a dialog that leads with the colours the artwork already uses (read from the markup, each once, in the order it uses them), then a standard set, then hex with the system picker beside it. **None** is a button there.
- **The Node tool turns a shape into a path instead of refusing it** (`docs/UX44_TOOL_ACCESS.md`). "That is not a path. Click a path to edit its nodes" was a dead end: rounding the corner of a rectangle you have just drawn is exactly what the tool is for, and the way to it — *Convert to a path* — was in a menu you had to know about. Clicking a shape with the Node tool, or picking the tool with one selected, converts it and opens its points, in one undo step.
- **Generating the 2.5D turn turns its own axes on.** The template has `headX` and `headY` before anyone presses **Generate turn**, so nothing noticed that generating did not create them — and on a face drawn from the blank canvas the press wrote a full nine-cell grid driven by parameters that did not exist: a turn nothing could play, in the panel that had just said "headX and headY now drive the turn". The head's own movements are turned on as part of generating, in the same command and the same undo step.
- **A preset part is fitted to the face it joins, and drawn where that face is.** Eyebrows and Eyelids are drawn against the template's own face, and adding them anywhere else was refused ("Preset artwork is only added to compatible starter faces") because they mounted into a `faceRoot` group that a drawn mascot does not have and would have landed wherever that face was not. The reference box — the template's eye pair, or its head while the eyes are unassigned — is mapped onto the measured one, so the brows sit above the eyes of any face at its own size, and the artwork is added to whatever group holds the head.
- **The Morph method stopped blaming authors for a morph they never made.** Every path the editor creates carries `morph: { enabled: false }` with the same outline in both slots — the legacy field, waiting to be filled in — and the ownership guard read that as *a manual morph*, so choosing **Morph** for a movement on a drawn path answered "already used by a manual morph. Switch it to another method first". It was also what made *Add Eyelids* fail on lids the editor had just drawn itself. A morph counts as authored when it is enabled, generated, or holds two different outlines.
- **The drawing tools are in the command palette**, with the operations whose only home was a selection on the canvas (Group, Ungroup, Cut to top). They were a row of glyphs on a bar that exists only in Artwork, so an author who had not found that bar had nowhere to ask; searching "curve" or "corner" lands on the Pen and the Node tool now. The Polygon tool also has a key of its own at last (`S`).
- **Building a face starts a mascot, so it starts one on Home.** *Face Builder* and a two-drawing "preset library" lived at the end of Artwork → Add / Create artwork → **More templates and tools** — three disclosures deep, inside the panel for adding to the artwork you already have, and both replaced the whole project when pressed. Building a face is a Home card beside Mascot Face and Blank canvas now, and it opens its project the way a template does. The preset library is gone: two rig-less SVGs that Import SVG already covers.

## Unreleased — The turn stops hiding the face, and the tools stop covering the artwork

- **The nose is a half circle, and the turn rotates it** (`docs/MASCOT_TEMPLATE.md`). It is the one feature a flat drawing cannot carry by sliding — the part that sticks out — and it kept its front-view hook whatever the head did. It is one arc now (radius 9 about `120, 136`), drawn the way the rest of this face is drawn, and `headX` **turns** it: a `rotation` binding of −80° about the centre of the circle the arc is cut from, so the curve that reads as the underside of the nose from the front comes round to read as its ridge from the side. Rotating it is the one thing a shape key could not do, which is why the first attempt drew a whole profile per side: a shape key is a linear morph between two drawings, so the way from a curve to its mirror passes through the straight line halfway and the nose flattens into a bar in the middle of every turn (the wall the hands hit as "a mirror whose midpoint is a hand folded onto its axis"). A rotation has no such midpoint — every angle of it is the same curve seen from further round — and `+θ` and `−θ` are each other's mirror, so the nose travels exactly as far one way as the other with nothing to offset by hand; `ux41-pseudo-3d.spec.js` holds that under two pixels and had caught the hand-drawn pair moving it five pixels further right than left. Two shape keys, two profiles and a path builder go with it.
- **A turn no longer makes an eye or the mouth disappear.** A generated head turn writes a `depth` on every part it moves, and `depthBand` → `draw-order.js` reads that to repaint an element among its siblings. The number was the projector's full recession, so at a full turn the far eye, its lid and its brow crossed the band, and looking down took the mouth, the teeth and the tongue with them — and on this artwork "the front of the group" is *behind the head*, so they vanished under the face they are drawn on. Only the ears change places with the head now (`sweeps: true`, which is what the band was added for: the far one goes round the back). Everything painted on the face keeps its recession, held inside the middle band — `surfaceDepthLimit`, derived from the rig's own `parallax.bands` less its hysteresis, so it cannot reach an edge from either side. `head-pose-turn.test.js` walks all nine cells of the grid and holds every face part in the `normal` band.
- **The ear is outlined on its outer half only** (`docs/MASCOT_TEMPLATE.md`). A stroked ellipse is fine behind the head — the outline only shows where the ear leaves the silhouette — but the turn brings the near ear in front of the cheek, and there the whole ring was drawn, its inner half reading as a seam across the face. `earLeftShape` is now skin with no stroke (skin on skin draws nothing) and `earLeftEdge` is the arc from the top of the ear round the outside to the bottom, its ends landing on the head's own outline. The silhouette detours around the ear instead of crossing it.
- **The hair stops showing the border of the top of the head, and it turns like the rest of the face.** Three things met along one curve: the back of the hair ended where the crown began, and the crown's lower edge sat exactly on the head's outline. One drawing while nothing moves — and a few pixels of turn or of secondary motion opened the page and the head's own border across the top of the hair. `hairBack` is one solid cap whose middle is simply hidden, `hairTop` reaches about twelve units inside the head where the fringe covers it, and the crown is written **no depth at all**, so the turn gives it no travel of its own and it rides the head group exactly. Welding it to the skull with a depth equal to the outline's did the opposite of that: `screenDepth` already adds the outline's depth for anything drawn inside the head, so a crown asked to travel *with* the head travelled twice as far as it and slid off the far side. The other two are the front and the back of a volume and keep a depth: the fringe swings furthest of the three (`0.42`) and is clipped to the head, and `hairBack` swings the **other** way (`-0.2`) — turn the head to the right and more of the back of the hair shows on the left, which is the one cue that says the hair is a volume rather than paint on the front.
- **The step bar is gone** (`docs/GUIDED_JOURNEY.md`). "6/10 · Add floating hands · Take me there" cost a row of the window in every task, above the working area that is the point of the editor. `deriveGuide` stays as a model on `selectors.guide`; what tells an author where they are is still there — each task's hint in its own panel, the readiness tick on every tab, and the Publish checklist with the blockers spelled out.
- **The tools are docked above the working area, not floating over it** (`docs/VECTOR_EDITING.md`). The toolbar, its options bar and the zoom pill hung inside the canvas element as overlays on top of the artwork being edited. They are the canvas column's own bar now (`.canvas-column`): the vector tools on one line, the tool's options and the view controls (Handles, Fit, zoom) on the next, and outside Artwork one thin line holding the view controls alone. The working area starts under the bar with nothing on top of it. The bar's height is fixed on purpose — docked, a row that grew with the tool or with the selection would resize the canvas under the pointer — so the options line is one line that scrolls sideways rather than wrapping, and the tool's hint rides on it and gives way to an ellipsis first. Found by the move: `hitTestablePoint`, the e2e helper that picks somewhere to click on a piece of artwork, probed fractional coordinates, and a real click is hit-tested at whole pixels — on the edge of a shape the two disagree, so once the docked bar had shifted the artwork by a fraction of a pixel, right-clicking the cheek shading opened the head's menu. It probes where the click will actually land now.

## Unreleased — Hands in parts: a cartoon glove, a facing axis, a pose editor, sets of drawings (docs/HAND_RIGGING.md)

- **A drawing standing in for the hand follows it** (`runtime/hands.js`). Method B — a pose that cross-fades to another piece of artwork — gave that artwork an opacity and no transform, so it stayed put while the hand reached and turned. A variant now takes the hand's offset, anchor drift, rotation and scale around the hand's pivot and its depth band; several drawings raised at once share the one hand instead of piling up past it. A pose counts as ready when its parameter drives anything — a shape key on a part, a pose grid, a binding — not only when the record carries a key (`handPoseDrive`).
- **Draw a pair of hands draws a glove made of six parts**: a soft palm with the heel of the thumb, four bezier digit tubes with a round tip and the fold across their knuckle, a cuff at the wrist — the classic four-fingered cartoon glove, with a skin look one select away. Every part is one path with one fixed layout (Catmull-Rom curves through a fixed number of points; the fold and the heel are second sub-paths folded onto the outline until a pose draws them out), so a pose can never mismatch the hand it deforms. **A pose is a parameter** driving a key on every part it moves; nine ship (Fist, Point, Peace, Thumbs Up, Spread, Relax, OK, Pinch, Stop — OK and Pinch aim the index at the thumb's tip numerically), plus a curl per digit and a grip. The `hands` record still names one element, the group; placement measures the parts; selecting any part opens hand mode for its hand; the hand is grabbed by its cuff so the anchor at the middle of the palm stays free. No Flip is generated any more.
- **A facing axis turns the hand** — `handLFacing`, from −1 (far side, thumb away) through 0 (palm) to 1 (side, thumb towards the viewer) — stored as ordinary pose grids the way the head turns: a `pathShape` keyform per part weights that part's view key at each stop, so the turn is a continuous morph and never the collapse a mirror key passed through. A pose with a drawing of its own in profile (fist, point, thumbs up, grip, curls) carries a key per part per stop, gated by a `pose × facing` grid. On the far side the thumb is behind the palm — in the draw order, on the canvas as in the exported runtime — and faded out early in the turn as well, unless the thumb is up. Hand Setup gets a **View** row, the hand a facing handle, the catalogue the word for it.
- **A pose editor** in Hand Setup: pick a pose or start a new one, choose a digit or the palm, move its sliders (curl, bend, angle, length, width; the palm's width and heel) and watch a preview drawn from the same generator; **Touch the thumb** aims the digit's tip at the thumb's; **Capture** writes a key on every part the pose moves, its parameter and its record in one command and one undo step, then strikes it on the mascot; capturing again replaces what the earlier capture wrote; **Remove pose** takes the keys and grids with it. The table is kept on the pose record (optional `table` / `profileTable` on `handPose`; the runtime passes them through), so a generated pose reopens with its own numbers and a side view edited here becomes the pose's profile drawing.
- **Sets of drawings** (`core/sample/hand-set.js`): **Use a set of drawings** gives a hand whose artwork the generator did not draw every gesture of the built-in set as a whole drawing, placed where the hand is and no bigger than it, each a pose the hand swaps to; **Import drawings…** takes an SVG for any hand — its top-level drawings are measured by the browser, wrapped so they are centred on the hand and no bigger than it, and named after the pose their id or name points at. One command, one undo step, like a pair of hands.
- **A hand comes out by travelling, and the faces and reactions use the hands.** Whatever sets the show parameter — a page's `setParameter`, a pose chip, a state change, an expression with no blend span — the drawn value now eases from wherever the hand is to where it is asked over 0.45 s (`createHandReveal`, `HAND_REVEAL_SECONDS`), in the exported engine and in the editor preview alike, so a hand never appears at its rest place without having come out from behind the head. Every expression preset carries what its face does with its hands (`hands` in `expression-presets.js`: Surprised throws them up and spread, Angry makes fists, Thinking puts one to the chin, Proud gives thumbs up…), taken in when the project has the controls and never reported missing when it does not. A reaction's gesture raises the hand's show parameter with the pose over the reaction's envelope, so a thumbs up brings the hand out and sends it back; the reaction presets name a drawn pair's own poses first and reach for the pair's new **Hands up** clip (both hands out, up and spread, with a head bounce where the mascot has a head) for Cheer and Celebrate, and for the Wave for Greet; a project with no hands is no longer told to draw some for a reaction's sake. `ux32-hands.spec.js` checks the hand is still on its way right after a pose chip.
- **A drawn pair rests behind the head, and comes out only when asked** (`docs/HAND_RIGGING.md`, "Behind the head"). One parameter per hand, `handLShow` / `handRShow` (0 tucked, 1 out), and three ordinary keyforms on the group slide it from the lower half of the head to its rest place and keep it in the `behind` band until it is nearly clear of the head; `evaluateHands` adds the artwork's depth to the hand's own, and the canvas paints the same order as the exported mascot. A **"Hands out"** expression (`hands-out`) is written with the pair for reactions and for `mascot.showHands({ duration, easing, side })` / `mascot.hideHands()`, the Wave's new `handLShow` track brings its hand out and sends it back, and Hand Setup brings a tucked hand out while it is posed there. Every card has a **Rests behind the head, out on request** tick; unticking it puts the hand in the open as before, one undo step. Unit tests cover the runtime's additive depth, the install and its reversal, the panel and the API; `ux32-hands.spec.js` draws the pair behind the face and brings it out.
- **Clean finger bases.** Each digit's two edges now end on the palm's outline — found against the palm of *that* pose — and are cut flat there (`stroke-linecap: butt` on the digits, `handPartCaps`), so the stroke's end lies inside the palm's own line and nothing of it shows, whatever the angle; the edge's points are spread from that root to the tip, so a folded finger, mostly inside the palm, no longer dips back under the outline. The knuckle fold is drawn out and back as one closed loop (`M C×4 Z`) so it keeps round ends on a path whose caps are flat, and on a folded finger it climbs onto the dome that shows rather than the root that does not. A slight flare at the root makes two neighbours meet the palm in a rounded valley; a profile hook is gentler (100°) so the tube never crosses itself; the profile's stacked fingers step back far enough to read as three; the thumb barring a palm-view fist covers the knuckles' roots, and the pointing profile's thumb rests on the curled fingers. `taper` is gone from the tables.
- **The glove looks the part in every view.** Fatter, shorter fingers with a domed tip and straight sides, a mitten palm, a thumb that is a lobe; a palm-view fist is three wide knuckle bumps with the thumb barring them; in profile the index stands in front with the other two fingers stepping back behind it, the thumb points up and away, and a curl is a hook in the plane (`hook`, per view) rather than a shortening, so a profile fist is one curled finger with the others peeking out behind it instead of a stack of bumps. The far side used to be the near profile *mirrored*, which lists its points the other way round: the turn towards it morphed through a line -- the very collapse the facing axis exists to avoid -- and `mirrorTable` now builds it in the same traversal as the near profile, so palm → far side is a morph like palm → side. `npm run figures:hands` redraws the figures from the shipped tables; the facing unit test now checks the far turn never folds the palm or the cuff.
- **The canvas paints in the same order as the exported mascot** (`core/preview-runtime/preview-order.js`, `docs/DEPTH_PARALLAX.md`). Depth reached the paint order of the exported runtime since 3D-03 and never the editor's canvas — the canvas DOM is the document, and a reorder left in place would have been saved as the author's layer order — so a hand pushed behind the body, hair behind the head or the far thumb behind the palm previewed one way and shipped another. The canvas now borrows the runtime's own draw order every frame and gives it back, piece by piece, before anything reads or edits the document (a save, an export, the layers tree, a reorder, a group, a delete, a duplicate, an import); `restore()` on the shared draw order skips a piece the edit removed or moved, and the preview carries last frame's bands into the compiler so the hysteresis is the runtime's too. A rig with `parallax.drawOrder: false` stays as drawn on both sides. The exported artwork and the layer order are unchanged by what the canvas shows; `ux32-hands.spec.js` checks the far thumb on the canvas, in the export and in the layers.
- `scripts/hand-figures.mjs` paints the study's figures from the shipped tables. Unit (1121) and critical e2e suites pass; `ux32-hands.spec.js` draws the pair, turns it, captures a pose and swaps drawings in a browser.

## Unreleased — Hand representations study (docs/HAND_REPRESENTATIONS_STUDY.md)

- **How the hands can get a side view, the rest of a cartoon hand set, and a look worth having** — a study, no editor code shipped. Measured against the real generator: every candidate view (profile open, pointing, thumbs up, fist, pinch, stop) *can* be stored as a shape key on the current single outline, and none of them is drawable on it — stacked fingers cross the outline's own stroke, a thumb over the palm draws through it, and `handLFlip` is a mirror whose midpoint is a hand folded onto its axis (`docs/figures/hand-views-single-outline.svg`). The same hand as **parts** — a soft palm, four bezier tubes with round tips, a cuff, fold lines that fade in as a knuckle bends — drawn to the classic four-fingered glove sheets, renders fourteen gestures including the profiles, an OK whose index is aimed at the thumb, and a hand holding a rod, with every part keeping a fixed layout in every pose (`docs/figures/hand-glove.svg`, ramps and the skin-coloured variant beside it). `scripts/hand-figures.mjs` regenerates the figures and is the reference implementation stage 1 ports. The proposal: parts (elements, driven shape keys, opacity bindings, depth bands — all existing), a `handLFacing` axis stored as ordinary keyforms the way the head turns, method B made to follow the hand for sets of drawings, and the pose editor VNX-22 wanted built on the parametric pose table. Staged so the `hands` record, the schema, the runtime, reactions, the catalogue and every existing project stay as they are.

## Unreleased — Full audit and the runtime demo (docs/FULL_AUDIT_2026-09.md)

- **The demo is the default face, integrated the way a site does it.** `/demo/` showed a blue disc with one eye and a two-parameter rig written by hand. It now loads the Mascot Face — `mascot.svg`, `rig.json` and `runtime.js` fetched from its own folder, through `load({ mount, svg, rig })` — and offers every state (with the guarded transitions shown as such), every motion, one slider per parameter (the per-side offsets under a disclosure), the automatic behaviours, pointer following, and the API call it just made printed under the mascot. `window.boopMascot` is the engine, for the console.
- **The demo's files are Export's files.** `core/sample/templates/template-export.js` builds the template's project without a canvas and `scripts/demo-assets.mjs` (`npm run demo:assets`) writes the three files; Vite emits them at build time and serves them in `npm run dev`. The Node build was checked byte for byte against the editor's own download of the same template in Chromium, and `demo-assets.test.js` holds it to that reference and runs the face on the bundled runtime standalone.
- **Dead fixture removed**: `project/demo/index.html` pointed at a `mascot.svg` that was never built.
- **Docs caught up with the code**: the rig schema is version 4 (the README said 3, `RIG_MODEL.md` said Export wrote 2); the runtime is 216.8 kB / 62.8 kB gzip, not 46.7 kB, and the editor 1.16 MB / 353 kB.

## Unreleased — Rigging audit (docs/RIGGING_AUDIT_2026-09.md)

- **Pins are authored** (`docs/FACE_CONTROL_RIG.md`, "Authoring pins"): the only pins used to be the seven the face template generates, and the panel's empty state promised a drag that did not exist. A pin is now placed on any path — the selected piece first, a sub-part such as an eyelid included — by a click where it goes, at the middle of the piece, or from the canvas menu (**Add a pin here**); a drawn or imported path gets its rest outline in the same undo step. **Mirror** puts the same pin on the other side, on the symmetric piece; the template's mouth and brow sets can be put back.
- **The reach is dragged on the canvas**: two small handles on the ellipse set how far a pin holds across and down, live, one undo step per drag. A directional or sliding pin has an **Along** angle and draws its axis.
- **Several pins move together**: tick them and give them one movement — an existing one, or a new one created resting at 0 with a control of its own on the canvas and in Controls — with an amount sideways and up / down.
- **One side at a time**: eyes, pupils, eyelids and eyebrows can split a movement into a control per side (a wink, one raised brow) from the movement's Advanced section; this existed only for the template.
- **Convert to a path** (Inspector → Shape, and the canvas menu): a rectangle, circle, ellipse, line or polygon becomes the path it draws, keeping its id, paint and transform, so it can be reshaped, pinned, warped and given shape keys.
- **Honest statuses**: a movement that already moves the artwork reads "ready · default range" (or "from the head pose") rather than "not set up yet"; the calibrate tab says the positions only tune it. The Tongue is in the Add a Part catalogue; Face Setup's sections have palette commands; advanced sections say so; the holding panel follows the selection, its refusals are said, its defaults do not hold a point to itself; a refused pin costs no undo step; the Advanced hub lists pins.

## Unreleased — Drawing and editing rework (docs/VECTOR_EDITING.md)

- **The preview lands where the shape does.** The line and pen previews were drawn in a layer whose transform was measured once at the first press, so a pan or zoom mid-drawing left them offset from the committed shape, and they reached past the working area where the shape is cut. The draw layer now follows the artwork matrix (view × viewBox rule, `core/artwork/viewport.js`) on every gesture and view change, and is clipped to the artboard; a shape that reaches past it says so.
- **A complete tool set** (`svg-editor/draw-tools.js`): the Pen places corners with a click and pulls curves with a drag, closes on its first point, takes a point back with Backspace and finishes on Enter or a double-click; Line, Rectangle, Ellipse, Polygon or Star and Text join it; Shift constrains (45°, square, circle, 15° rotation) and Alt draws from the centre. Tool keys: V N P L R O T H.
- **An options bar** under the toolbar (`ui/tool-options.js`): fill, stroke and width for new shapes (either can be None), corner radius, sides and star inner radius, text and size, and a grid with snapping — remembered in the browser, never in the project. For the Node tool it holds Curve, Straight, Smooth, Corner and Delete point.
- **Bezier handles** on the Node tool (`core/path/path-controls.js`): the point in hand shows its two control points, mirrored while it is smooth; Alt breaks the pair for a drag, Corner for good; Curve and Straight migrate shape keys, morphs and captured poses like adding a point does. Delete under the Node tool removes the point in hand, not the shape.
- **Several pieces at once** (`core/state/selection.js`, `core/artwork/arrange.js`): Shift+click adds to the selection, a drag on empty canvas selects what it surrounds, Ctrl/Cmd+A selects every top-level piece; dragging any selected piece moves them all in one undo step; Align (six ways; one piece aligns to the working area), Spread with equal gaps, Group (Ctrl/Cmd+G, Shift+G ungroups); arrow keys and Delete act on the set; the Layers highlight it and the Inspector counts it.
- **Blank canvas** on Home: the working area with nothing on it and the least rig that validates, so a mascot drawn from nothing saves and exports from the first minute. The working area is painted white under the artwork, so a dark stroke reads as drawn.
- **Keys that never collide**: the gizmo's modes are G (Move), E (Rotate), K (Scale) and A (Pivot); R and P always mean Rectangle and Pen, even with the shape just drawn selected. The toolbar, the options bar and the mode banner stack in one column so a wrapped toolbar never hides under the bar; labels give way to icons on a narrow canvas.
- **Cleaner files**: the identity transform and the full opacity the canvas writes on every piece it touches stay out of the saved and exported SVG; the mode banner's notes ("Point curved") are transient, without Capture or Cancel; a disabled morph copy is no longer announced as "its morph".

## Unreleased — System audit (docs/SYSTEM_AUDIT_2026-09.md)

- **One navigation, no word twice.** The top bar showed a stage row *and* a task row, printed **Animate** on both, and scrolled the other stages' tabs half off-screen. It is one grouped navigation now: each stage is a label over its own steps, every step is one click away, and the motions step is called **Motions**.
- **One panel per step.** The Animate stage stacked Expressions and Motions in a single three-screen column with two starter kits; each step shows its own catalogue. The States / Behaviors editor is folded in a *States & behaviors (advanced)* disclosure inside Motions, and every route that leads to it unfolds it. Columns return to the top when the task changes.
- **Duplicates removed**: Duplicate / Delete in the Timeline header (the Motion Inspector has them), *Open in Timeline* while the Timeline is open, the Preview panel's readiness list and *Center* (Publish and *Reset mascot* cover them), the second *+ Add Part*; *Export files…* in Publish, *Update from current face* in Expressions; Layers **Bring forward / Send backward / To front / To back** with the same direction as the canvas menu, which gained **To front / To back** and **Flip**.
- **Reachable again**: the guide's *Bring it to life*, *Behaviors (advanced)*, Problems fixes that named a Face Setup section or an author mode, the Inspector's Advanced disclosure outside Artwork, Undo / Redo / Problems / Search on phones (inside the ••• menu), the Timeline resize from the keyboard, and **Import rig.json** (••• menu) for the importer that existed without a button.
- **Editing the SVG** (`docs/VECTOR_EDITING.md`): the Inspector no longer destroys the field being typed in nor floods undo from a slider; fill and stroke with a **None** switch and free values, fill and stroke opacity, line ends, corners, dashes; width / height / corner radius, radius, text, font size and anchor; arrow-key nudge, Ctrl/Cmd + C / V, wheel pan and Ctrl/Cmd + wheel zoom about the pointer; a Node-mode double-click adds a point only near the outline; Duplicate keeps names and gives fresh ids; unlocking no longer re-enables the legacy drag plugin; mirroring uses the artboard's middle; the Presets tab is in English.

## Unreleased — UX refonte (UX-01 → UX-23.1)

- Task-based shell: Home, Artwork, Face Setup, Expressions, Animate, Reactions and Preview with a contextual Inspector, progressive disclosure and an Advanced hub for expert tools.
- Face Setup checklist with role suggestions, Basic movements with visual pose calibration, and a Preview test bench with readiness and an event simulator.
- New product entities exported for the runtime: Expressions (`rig.json.expressions`, `mascot.setExpression`), Motions compiled to editable clips (`rig.json.animations`, `mascot.playAnimation`) and Reactions (`rig.json.reactions`, `mascot.trigger`, `mascot.bindEvents`); schema version stays 3.
- Readiness-driven Export with deep links, command palette (Ctrl/Cmd+K), Save Project shortcut (Ctrl/Cmd+S), tablet drawer and bottom sheet, mobile priority mode, and an accessibility and keyboard gate (landmarks, skip link, shortcut help, Escape order, reduced motion).
- Visual, layout, stability and stress gates; legacy Canvas empty state and demo bar removed with fixture parity; extended suite realigned onto the new shell.
- The 2.5D head turn now reads as a turn (`docs/HEAD_POSE_2_5D.md`): generating it hands `headX` / `headY` to the pose grid instead of leaving the head's own translate binding to slide the whole face underneath the parallax, the effect constants were raised out of the imperceptible range, centre features are foreshortened rather than displaced rigidly, and pupils track their sockets. Measured on the canvas, the features now travel five times the outline and the far side loses 41 % of its width, against 2× and 15 % before.
- Motions hand over instead of cutting (`docs/ADR_MOTION_LAYERING.md`): a shared `createMotionLayer` in the runtime cross-fades `playMotion(id)` from whatever is playing, runs motions side by side with `playMotion(id, { layer: true })`, fades on stop and at a clip's end, and takes its span from `motionBlend` on the document with a per-call `fade` override. The editor preview uses the same layer, so what an author tests is what the exported mascot does.
- Animation and fine-control audit fixed (`docs/ANIMATION_CONTROL_AUDIT.md`): a reaction's timing envelope now shapes its motion as well as its expression, a replaced reaction cross-fades instead of passing through neutral, a stayed hand gesture survives a reaction carrying a motion, the expression cross-fade (`expressionBlend`) is authorable, Preview stops a clip the way the exported runtime does, canvas handles gained an **Alt** precision modifier, live controls can be typed, the Timeline snaps the playhead and no longer overwrites a key when duplicating, and transition-graph edges take separate lanes. Motion-to-motion blending remains open by design: `docs/ADR_MOTION_LAYERING.md`.
- Ready-made library (`docs/READY_MADE_LIBRARY.md`): 26 expression presets, 20 motion presets and 18 reaction presets, grouped so each panel shows one group at a time, plus a **Starter kit** that builds 8 faces, 6 motions, 4 reactions and 3 automatic behaviours as a single undoable command.
- One template, complete and alive (`docs/MASCOT_TEMPLATE.md`): **Mascot Face** replaces Basic / Expressive / Talking with a single cartoon face that ships eyebrows, a nose, ears, hair, a chin, cheek shading and blush, every part assigned, every movement calibrated, the automatic life running and **the 2.5D turn already generated** — `headX` turns the head from the first frame with no button to press. **Reset all** in the Head pose panel is its exact inverse, handing `headX` back to the head's own translate binding.
- The 2.5D turn learned about nesting (`docs/HEAD_POSE_2_5D.md`): a part drawn inside another part now writes only the difference between their depths, so a pupil inside its eye adds the little it is deeper instead of stacking the two and crossing the face on its own, and an eyelid simply rides its eye. A part inside a part that foreshortens the same way no longer foreshortens twice. The far ear tucks behind the head as it fades, instead of hanging past the cheek as a half-transparent smudge over whatever the page is.
- A scale of `0` is a scale of `0` on the canvas, not a missing value: `|| 1` in the canvas and runtime renderers kept a part the rig had collapsed at full size in the editor while the exported mascot collapsed it. That is what left the mouth cavity showing on a closed mouth.
- The face itself got a lot better at being a face: each eye is a clipped group — socket, white, pupil, glint, lids and outline turning as one assembly — so a pupil sits **behind** the eyelid as the eye closes instead of fading out, and a turned head no longer slides the eyes out of their sockets; opening the mouth grows a cavity *and* drops the chin, so the lower face lengthens like a jaw rather than a hole appearing in a rigid head; the side of the head turning away darkens with `headX`; and the eye rim fades only at the very end of a blink, because a closed cartoon eye is a crease rather than a circle with a line through it.
- The shape tools work (`docs/VECTOR_EDITING.md`): a rectangle, ellipse or line now lands exactly where it is drawn instead of off the artboard and three times too big (it was measured in the outer group's coordinates and appended inside the artwork's own viewBox), pressing a tool or a zoom button no longer leaves a 2 x 2 pixel shape behind (the toolbar is inside the canvas element, so those presses were also presses on the drawing surface), the shape is previewed while it is drawn, and the canvas hands itself back to Select with the new shape selected. The Pen draws a run of points — press to add one, press the first to close it, Enter or a double-click to finish, Escape to drop it. Drawing no longer re-frames the canvas either: a rebuild keeps the zoom and pan it had, so undo and other panels stop moving the camera.
- Right-click a piece of the mascot to edit it where it is drawn (`ui/canvas-menu.js`): its name, the face part that owns it, and Edit points, Duplicate, Bring forward, Send backward, Hide, Lock and Delete. Every action already existed in the Layers panel; what was missing was reaching them from the artwork instead of from a tree of thirty rows. Shift+F10 opens the same menu from the keyboard.
- Hands without an import (`docs/HAND_RIGGING.md`): **Draw a pair of hands** generates a cartoon hand with four digits — a thumb and three fingers — on both sides, rigged to the head with a reach, three poses (Fist, Point, Peace) each carrying its own shape key, and a Wave clip. One function draws the hand and every pose, so a pose can never have a different outline structure from the hand it deforms — the morph-compatibility failure the Shape Keys panel otherwise has to explain after the fact.
- The mouth is one shape (`docs/MASCOT_TEMPLATE.md`). It was two — a stroked lip line that morphed for the smile, and a filled cavity that scaled for the opening — and two shapes deforming under two different systems cannot agree: a smile put the lip corners outside the cavity, and half-open the lip lay across the hole like a stick. One closed path now carries both: the fill is the inside of the mouth, the stroke is the lips, and `mouthOpen` and `smile` are additive shape keys drawn by the same function as the rest outline. Every control point is affine in the two, so a laughing mouth is exactly the drawn shape rather than an approximation of it.
- Semantic controls gained a `shapeKey` method (`docs/SEMANTIC_RIGGING.md`): the movement writes no binding and owns V2 shape keys instead, which is the only way a mouth opens *and* smiles (a scale that closes the mouth flattens the smile with it; the legacy morph is one shape per element). Generated shapes carry the same `generatedBy` ownership a generated binding does, so switching a control's method takes its shapes with it, and a shaped movement reports itself calibrated rather than asking for two captures it has no use for.
- The fringe is clipped to the head and drawn wider than it, so it can neither stick out past the outline on a turn nor uncover the hairline on the other side; the blush is gone; and the ears gained a fold.
- More hands (`docs/HAND_RIGGING.md`): six poses each — Fist, Point, Peace, Thumbs Up, Spread, Relax — and **one curl parameter per digit**, with live sliders in Hand Setup next to the pose chips. Poses are the quick way, the curls are the complete one, and because shape keys add they compose. A pose can now also turn, lift or stretch a digit rather than only folding it, which is what makes a thumbs-up a thumb rather than a stub.
- A right-click no longer starts a gizmo drag, and a press on the canvas menu is no longer a press on the artwork behind it: the first swallowed the next click anywhere on the canvas (the pointer stayed captured), the second let the mascot be dragged by the menu that edits it.
- Every position of the face is controllable (`docs/DIRECT_CONTROLS.md`). The movements were the ten a beginner starts with, and a mascot has more: the nose scrunches, the jaw drops on its own, the hair moves, the ears wiggle. Eighteen movements now, in nine groups, each with its own row of pose chips in Face Setup and in Preview — Nose *Twitch*, Jaw *Dropped*, Hair *Blown left*, Ears *Perked*, and richer rows for the parts that already had one.
- An open mouth has **teeth and a tongue** (`docs/MASCOT_TEMPLATE.md`), with `teeth` and `tongue` as ordinary movements. Both are drawn from the mouth's own curves, so they are inside it by construction rather than by luck, and both are driven by an **expression** shape key — `mouthOpen * teeth` is a product, so closed lips have nothing behind them to show however far the control is turned up. They are roles of the Mouth part, so the 2.5D turn carries them with the lip line.
- **No more double chin** (`docs/MASCOT_TEMPLATE.md`): the lower face was a second shape — a wide ellipse behind the head, slid down by `mouthOpen + jawOpen` — and sliding it exposed its own top edge against the head it was meant to extend, so an open mouth drew two outlines where a face has one. The head is one path now and the jaw *is* that path getting longer: `headPath({ jaw })` pins the sides and takes the bottom sixteen units lower, and the `head-jaw` shape key drives it from `mouthOpen + jawOpen`. The chin still drops when the mouth opens, an author can still drop it on its own, and the silhouette stays a single closed curve at every value.
- `browShade` is gone. A static band under the hairline read as a smudge across the forehead rather than as modelling.
- Five more handles, and every one of them on the right piece of artwork (`docs/DIRECT_CONTROLS.md`): mouth width, jaw, nose, hair and ears join the six that existed, so all eighteen movements are reachable on the mascot instead of only in a panel. Placement now intersects an element's measured box with every clip on the way up — an eye is a group clipped to its socket with eyelids drawn far wider than the eye, so its box measured 375px tall and its handle floated up onto the forehead, on top of the head's own, where it also covered the **Make it 3D** offer.
- **The hair has a top** (`docs/MASCOT_TEMPLATE.md`). The mascot was bald above the hairline: `hairBack` sat entirely behind the head outline and the fringe is clipped to the head on purpose, so everything above the skull was skin — artwork that is drawn and then hidden is artwork nobody can control. Three pieces now, all of them the Hair part and all of them moved by `hairSway` / `hairLift`: `hairTop` (the volume above the skull), `hairBack` (what shows around the crown and behind the ears) and the fringe. The 2.5D turn carries the new pieces too.
- **Hands that hang the right way, with room to move** (`docs/HAND_RIGGING.md`): the outline is drawn fingers-up, which is the one orientation a hanging hand never has, so a generated pair arrived pointing up with both thumbs outwards, sitting on the cheeks. They now hang at 180° ± 20 — fingers down, thumbs towards the middle — and **adding hands adds the artboard to hang them from** (240 × 240 → 240 × 324) in the same undo step, because a face drawn to fill its artboard leaves a floating hand nowhere to reach. The reach went from a tenth of the artboard and 34° to a sixth and a **full half-turn**: a rotation that cannot pass a right angle cannot point at anything.
- Two more hand movements: **`handLGrip`** closes every finger at once (the four digit curls are the individual control, this is the group one) and **`handLFlip`** turns the hand over — a flat cartoon hand seen from the back is the same outline mirrored about the palm, so it is a shape key rather than a second drawing.
- **Handles have groups** (`docs/DIRECT_CONTROLS.md`): a hand carries seven controls of its own and a mascot has two hands, so a group handle folds its members behind a small **+** beside it and reveals them on the artwork when opened. Members are ordinary handles, drawn smaller; the finger handles sit on the **fingertips themselves**, from the same function that draws the outline, so they are on the finger at every pose and rotation. Any handle may now name a point in the artwork's own coordinates instead of a corner of a box.
- **A vector tool no longer follows you out of Artwork**: picking the Node tool and leaving the task kept its point handles on screen — rebuilt on the way into Face Setup, left behind in Preview — and they still rewrote the path they were dragged on, from a task that cannot draw. Leaving Artwork now puts the canvas back to Select, the way finishing a shape does; the same leak took the Hand tool's pan and grab cursor into every task, and an unfinished pen run with it. The Node tool also refuses a **locked** path now, which the gizmo already did.
- **Selecting something no longer closes the list it is in.** The studios rebuild by `innerHTML` on every edit, which destroyed the `<details>` the author had opened (the panel snapped back to "first group open") and moved the view with it, since a shorter list makes the browser clamp the scroll. `ui/panel-render.js` remembers what is open and keeps the scroll: it covers the three preset catalogues, the Artwork and Reaction inspectors, the Face Part movement Advanced, the head-pose parts list and the state Parameters. Restoring focus after a rebuild no longer scrolls either.
- **The right-click menu does what it says** (`ui/canvas-menu.js`): **Bring forward** and **Send backward** were wired to the Layers panel's up/down, which is list order and the opposite of depth, so both did the reverse of their label; a typed name was thrown away when you pressed anywhere else (the dialog closed before the field's `change` fired) and eaten when you pressed another button in the menu (the rebuild destroyed the button mid-press); **Show** was unreachable, because a hidden piece cannot be right-clicked again; **Open <part>** bypassed the door the checklist uses, so the Inspector arrived on the wrong tab and never revealed itself on a narrow screen; and **Assign to a face part** dropped the element and wrote a field that was overwritten in the same tick. A move that cannot happen now says so instead of leaving a phantom undo step.
- Controls that did nothing are gone or wired (audit of every interactive hook in the editor): the Artwork Inspector's **Transform** and **Appearance** chips (both sections are rendered above the tab strip, and the tab body had no case for them — so opening Advanced always landed on a placeholder), Advanced tools → **Bindings · Constraints · Morphs** (it selected the element and stopped, leaving the editor it names closed — it opens it now), the **Preview Behaviors** checkbox (nothing has ever read it; the switch that works is Preview → Automatic), the AUTHOR → **Animations** mode (it replaced the pane with one sentence), the Preview task hint (in a panel that is hidden in Preview) and *"Start with the Mascot Face"* still offered with a project open, which replaced it.
- **The working area is a thing you can see and change** (`docs/VECTOR_EDITING.md`). "Si j'utilise des cheveux plus hauts ils sont coupés sans raison apparente": two edges were doing the cutting and neither was drawn — the artboard (the artwork is a nested `<svg>`, and a nested `<svg>` clips to its own `viewBox`) and a `clip-path` on the artwork (the fringe is deliberately clipped to the head). The canvas draws the artboard's edge, selecting a clipped piece draws the shape it is cut against, the Artwork panel carries the size, a **Fit to artwork** that grows the box around everything, and a notice that says *"the drawing reaches 30 past the top, and is cut there"*. The canvas menu names the clip and offers **Stop cutting it**.
- **Points can be added to a shape, and removed** (`docs/VECTOR_EDITING.md`): double-click the outline (or `Insert`), `Delete` takes one away. A split is de Casteljau, so the curve does not move — the shape simply gains a point.
- That fixed two things that were already broken. **A node edit on a face shape was silently reverted**: the commit wrote the drawn path and never touched `restPath`, and the runtime redraws a shape target from `restPath + Σ deltas` on the next frame, so every drag on the mouth, the head, the teeth, the tongue or a hand was undone by the frame after it. And **dragging an `h`/`v` node off its axis promotes it to `l`**, which is a silent change of topology that left every shape-key delta one value short. Both go through one command now: every one of these edits is a **linear map on the value vector**, so the same map carries the rest outline, each shape-key delta, a legacy morph's two paths and every captured calibration pose — exactly, to the last decimal, which the tests assert on the real mouth. Where it cannot be exact (an arc, or a rest outline that already disagrees with what is drawn) the edit is refused rather than half-applied.
- **One eye can close on its own.** A symmetric part drove every role from one parameter, so a wink was impossible; each such movement can now carry a **side offset** added inside its own binding expression (`eyeOpen + eyeOpenLeft`). The offsets default to 0, so the shared movement keeps its meaning, its calibration and every clip that drives it, and a rig that predates them behaves identically — the safe evaluator reads an unknown name as 0, so this fails open rather than shut. The template ships it for the eyes and the eyebrows, and on the canvas the two sides are members of the pair's own handle: open the group, drag one eye down. `docs/KNOWN_LIMITATIONS.md` is two bullets shorter.
- **Posing the mascot is animating it**: with Auto Key on, a drag on the canvas writes a key on every control it moved, at the playhead, in one undo step. Before this the only thing in the editor that could key was a slider in the rig panel.
- Regenerating a part's bindings keeps **how far** each one moves. A rebuild is about what drives a binding — a role reassigned, a side offset switched on — and it used to rewrite the amplitude from the registry defaults, throwing away a calibration and the template's own numbers with it (the eyelids travel 42 units; the default is 8). Only **Reset to default movement** puts the numbers back now.
- **The controls on the mascot are authorable** (`docs/DIRECT_CONTROLS.md`). They were a hard-coded list — good defaults and nothing an author could change. A handle is a record now, and the **Controls** section of Face Setup is a board of every one of them: rename it, narrow how far it may go, lock an axis, snap it to a step, give it a colour, hide it, reset it, or add one of your own on any artwork driving any movement. A **limit** is the thing a rig has and a poser does not: this mouth never opens past 0.7, and no gesture can take it there.
- `document.rigHandles` is **sparse** — it stores only what was changed. A project that has authored nothing stores nothing and gets exactly the generated set, which is what has kept every release's better defaults reaching files that were saved before them (five handles to fifteen, without anyone reopening a project). So **Reset** deletes the override rather than restoring values, and **Hide** is an override rather than a deletion. Nothing reaches the runtime: `rig.json` is byte-identical for a project that has authored no controls.
- **VNext starts by freezing what works, not by rewriting it** (`docs/VNEXT_ROADMAP.md`). The engine, the editor/runtime split and the document/session store are kept; the work ahead is the editing experience, reorganised behind four workspaces — Create, Animate, Behaviors, Publish — so that a new capability joins a workflow instead of adding a panel. The 92 items are grouped into eight milestones with the critical path named.
- **The baseline and the public contracts are executable** (`docs/VNEXT_BASELINE.md`). Each of the fourteen capabilities of the journey names the tests that hold it up, so a workspace merge that quietly drops one fails and says which. Alongside it, the four things a refactor may not break are asserted rather than promised: the runtime API on the *exported* bundle (26 methods and 8 pre-V2 aliases), the 22 fields of `rig.json`, the rule that every document key belongs to exactly one domain, and a save/load round trip that keeps every domain and normalises exactly once. Adding stays free; losing is what fails.
- **The editor's own state starts leaving `main.js`** (`docs/VNEXT_ROADMAP.md`, M1). Autosave and local recovery are a service with every collaborator injected — store, storage, snapshot helpers, shell callbacks, even the timers — so the whole debounce runs in Node without a DOM. The browser-test seam moved out too: sixty lines that read the editor rather than wire it. Module-level mutable state in `main.js` goes from 12 to 8.
- **A selector layer, and the render fan-out as data.** `core/selectors/` memoises a ViewModel on a revision token and hands back the *same object* until the document moves, which is the precondition for a panel skipping its render; three hand-rolled memos disappear into it, and one derivation that was not memoised at all now is. `core/state/render-plan.js` replaces twelve hand-written subscription closures with a table checked against `PROJECT_DOMAINS`: a domain with no plan, or a plan naming a panel that is gone, fails at wiring time. It also separated two jobs that had been quietly conflated — rebuilding the handle set and moving the handles already drawn.
- **Panels get a lifecycle** (`docs/VNEXT_COMPONENTS.md`): `mount / update / show / hide / destroy`, with listeners and observers registered through the component so teardown is possible at all. An audit of all 24 factories is in that file, and it is blunt: ~156 listener registrations, none ever removed, and the two `destroy()` methods that exist are called by nobody. The artboard panel is the first adopter; the warp, automatic and guide panels follow, then the contextual inspector and the three studios — eight of twenty-four. Listing panels is where the flat model stops being trivial — a list is rebuilt on every derivation, so each folds what it shows into a signature and compares that — and the guide bar is the trap the step exists to expose: `expanded` is state the panel owns rather than state the model supplies, so leaving it out would fold the bar up on the next unrelated keystroke.
- **`main.js` is eight lines** (`docs/VNEXT_ROADMAP.md`, VNX-02). It used to be six hundred that executed on import, which is precisely what made lazy workspaces impossible: a module cannot be loaded on demand when importing it *is* the application starting. The wiring lives in `app/editor-app.js` behind `createEditorApp()`, and everything with logic of its own is a module that runs in Node without a DOM — autosave and local recovery, project load/save/replace, preview mode, the readiness/Problems/Export flows, the context fan-out, and the browser-test seam. Module-level mutable state went from twelve variables to four before the wiring moved out at all.
- **A restored workspace and the session agree again.** The shell reopens on the workspace an author left in, while a fresh session starts on the default, and `createEditorContext` silently dropped the one it was handed — so the two disagreed until the author happened to switch workspace. Harmless while nothing read `session.workspace` for visibility, and no longer harmless now that a panel hides itself on the way out of a workspace: one told to leave a workspace it never knew it had entered would stay hidden while on screen.
- **Setting up a movement is a sequence, and never mentions a binding** (`docs/VNEXT_ROADMAP.md`, VNX-15). Calibration already existed and worked; what it lacked was an order and plain words. Test came *first* and the two captures second — "here is a control, now go configure it" — so it now reads *resting position → each end → try it*, one step at a time, folding away once the movement is ready. The resting position is derived from the parameter's own default rather than assumed to be the middle of the list, so an eye rests **open** and a mouth rests **closed**. The raw parameter value beside every test slider is gone, progress reads `1 of 2 set` instead of `default ranges`, and a shape-key movement stopped being a dead end that asked for captures it has no cards for. A test asserts the negative directly: no parameter id, no decimal, and no occurrence of the word *binding* anywhere an author looks.
- **Inspectors read `Basic → More → Advanced`** (`docs/VNEXT_ROADMAP.md`, VNX-12). Basic is deliberately *not* a collapsed section — it is what an author sees with no click — and a section with nothing in it renders nothing rather than opening onto an empty box. The hand inspector is the first adopter: artwork, anchor and poses are Basic; fingers, reach and the cartoon lag are More; draw order and the shape-key wiring are Advanced. A guard test pins every one of the panel's 44 control hooks, so a tier can move a control but never quietly lose one.
- **The inspector says what it is looking at** (`docs/VNEXT_INSPECTOR.md`, VNX-11). Selecting artwork used to head a generic parameter list with a raw SVG id; it now names the piece and the part it plays. Selecting a state gave a heading over an empty column; it now says where the state machine is. Behind both, one rule replaced the special cases — an adapter is revealed **or** the empty line names what is selected, never neither — asserted for every selection kind in every task. The audit table is kept, including the four selections that still have no identity in the session at all, because a gap nobody wrote down is a gap nobody fixes.
- **What happens when two clips fight over one movement is now written down** (`docs/VNEXT_ROADMAP.md`, VNX-32). Establishing it changed the item: the clip started *last* wins the movement outright and the other's keys are dropped with nothing said — deterministic, but invisible, since nothing in the editor shows start order. So the warning is worth building, and the roadmap's four buttons are three-quarters aspirational: **override** is what the engine already does, while **add**, **blend** and **priority** each need a runtime change, and each is now named with what it would take rather than shipped as a button that does nothing. Two smaller truths came with it: a cross-fade's overlap is a hand-over the author asked for and must never be warned about, and an *empty* track still writes — it pins the movement and overrides an earlier clip exactly as hard as a keyed one.
- **Several clips can be arranged in time** (`docs/VNEXT_ROADMAP.md`, VNX-29). The runtime has layered motions since V2 — `playMotion(id, {layer:true})` runs a clip alongside whatever is playing — but the Timeline showed one clip's keys, so the only way to put a wave over a nod was to call the runtime from a page. An **arrangement** is editor-side authoring state and nothing more: it adds no runtime concept, no `rig.json` field and no schema bump, and playing one starts each clip through the layer that already exists, at the second the author put it. Rows are subjects *derived from what the placed clips actually write*, so a wave and a nod sit apart because they move different parts of the mascot, not because anyone filed them there. The conflict model built alongside it finally has a consumer: two clips fighting over one movement are named in the author's words, over the span they really overlap.
- **A hand's controls have names again** (`docs/VNEXT_ROADMAP.md`, VNX-34). They are *generated* rather than declared — `handLX`, `handRGrip`, `handLIndex`, `handRFist` — so no static table could list them, and every one of them fell through to the fallback: fifteen raw parameter ids under **Other**, in the timeline, the command palette, the control board and every message that names a movement. The catalogue reads the naming convention back rather than repeating it, so `handRThumbsUp` reads as *Thumbs up* under **Right hand · Poses**, and a pose an author invents tomorrow lands there too.
- **The timeline can show only what you are working on** (VNX-33). The filter follows the semantic part being edited and falls back to the selected artwork, resolved through the *same catalogue the tracks are grouped by* — so the filter can never disagree with the grouping. When it would hide everything it says how many controls it hid and offers the way back, instead of showing an empty sheet.
- **A pair of hands is placed by measuring the mascot** (`docs/VNEXT_ROADMAP.md`, VNX-20). Four of the five steps already happened, and all four measured the **drawing area** rather than the mascot: anchors 20 % in from each artboard edge, reach at 16 % of it, and the artboard grown to a blind 4:3. A mascot half the size of its canvas therefore got hands in the corners with nothing to reach. Placement now comes from the body's own bounds, the artboard grows by exactly the room the pair needs, the hands scale with the mascot, and mirroring is about the mascot's centre line rather than the canvas's. Two latent bugs went with it: the anchor was stored in the wrong coordinate space, so an imported body group with a transform had its reach ellipse drawn away from its hand; and a project whose only artwork was the pair could anchor a hand to itself. A project with nothing measurable falls back to the old numbers exactly — asserted, not hoped.
- **A hand's anchor and reach are edited by looking at them** (`docs/VNEXT_ROADMAP.md`, VNX-19). They were four number fields; they are geometry. The canvas now draws the reach ellipse, the leash and the anchor for the hand being set up, and both are draggable and reachable from the keyboard. The distinction that shapes the whole feature: the puppet handles drive *parameters*, live and non-destructive, while the anchor and the reach are *document* fields — so a complete drag is **one command and one undo step**, never one per frame, and Escape abandons it having written nothing. No new command was needed; `setAnchor` and `setReach` already existed and the drag simply had to call one of them once.
- **The head turn opens on five directions instead of nine chores** (`docs/VNEXT_ROADMAP.md`, VNX-17). A head turned left *and* up is a refinement; offering it beside "left" made the grid read as a list of tasks rather than four directions. **Standard · 9** is one choice away, and a corner an author actually captured is always offered whatever the level — hiding a pose someone made would be a lie, not a simplification. Switching back never leaves the author standing on a cell that just disappeared.
- **A control now looks like the movement it drives** (`docs/VNEXT_ROADMAP.md`, VNX-14). Every rig handle was three number fields, whatever it did. The control board draws an **XY pad** for a handle with two free directions, a **slider** for one, an **arc** for a rotation, **chips** for a movement stepped into a handful of stops, and says so plainly when an author has locked everything. The kind is *derived from the handle's own axes* rather than from a second table of part types — so locking the mouth sideways turns its pad into a slider, and giving an eye a step of 0.5 turns its slider into three chips. An author can override it through the same sparse record as the colour, and `rig.json` stays byte-identical for a project that authored nothing.
- **Publishing happens where the author is already standing** (`docs/VNEXT_ROADMAP.md`, VNX-10). Export and Problems were buttons in the app bar — always there, and therefore never *about* anything: testing the mascot meant leaving it, hunting a toolbar, and only then discovering what blocked the export. The Publish stage now carries the project's readiness beside the mascot being tested: every step with its status, every blocker named with the way out of it, one button that ships, and — on request — what the export actually weighs. It is a second view of the memoised readiness model the badges already share, never a second computation. Weighing is the one thing it does not do for free: serializing the whole project for a number nobody asked for, on every validation pass, is the cost the runtime rules forbid per frame and the editor should not pay per keystroke either. So it is asked for, and the answer is forgotten the moment the project moves — a weight from three edits ago is worse than no weight, because it looks current.
- **A behaviour is one sentence**: `When clicked → Surprised → Head Pop → then return to idle` (`docs/VNEXT_ROADMAP.md`, VNX-09). *Timing* and *After* stopped being separate boxes — how long the doing lasts belongs to **Do**, and what happens afterwards *is* **Then** — and the list row and the inspector print the same string from the same function, so they cannot drift into describing one behaviour two ways. Missing pieces shorten the sentence instead of showing empty slots, a target that vanished is named rather than silently dropped, and a `<select>` whose only option would be "nothing" is replaced by the way to make one. The automatic behaviours read as the same sentence with a different *When*. **IF is deliberately not there**: conditions need a value to test and the runtime has no inputs at all, so what it would take is written down rather than stubbed.
- **The expression and motion catalogues are one library** (`docs/VNEXT_ROADMAP.md`, VNX-08). They answer one question — what can this mascot do? — and which of them an author is shaping right now is what the step decides, not what they are allowed to see. Both are on screen throughout Animate. The **automatic behaviours** left Animate for Behaviors at the same time (VNX-09): they are made of motions, but nobody reaches for them while building a clip — they answer *when the mascot moves on its own*, which is the question a reaction answers.
- Wiring a panel's `leave()` to the lifecycle's `hide()` looked obvious and was wrong: the expression studio hid itself in the step next door, where the merged library was supposed to show it. **Visibility is the shell's job** — CSS, by stage — while `enter()`/`leave()` stay about Preview: arming and disarming the live expression. Arming it across the whole stage would let a drag in the Timeline land in an expression. `hide()` remains for parking a whole workspace.
- **The structure of the mascot is one column** (`docs/VNEXT_ROADMAP.md`, VNX-07). Artwork and Face Setup are two steps of one job, and they had nothing in common on screen: moving between them replaced the whole left column, so the tree of what you are building disappeared exactly when you started assigning parts of it. The tree is shared by every step of Create now — and gone outside it, because it is not what an author is thinking about while shaping an expression or wiring a reaction.
- **The editor has four stages instead of six sibling tabs** (`docs/VNEXT_ROADMAP.md`, VNX-06): **Create · Animate · Behaviors · Publish**, naming the journey rather than the editor's vocabulary. The tabs are not replaced, they are grouped: a stage is a shortcut into a group and never a gate in front of one, so every task stays one click away from anywhere, and each stage remembers the step last open in it. The stage is derived from the task and never stored beside it — two places holding one truth is how they come apart — and a stage carries the readiness of its least ready step, on its own button rather than inside a tab whose text is rewritten on every validation pass.
- Fixes surfaced along the way: SVG.js 2 transform parsing for group calibration and import, idempotent Timeline key edits, overflow-free layouts at 320–1440 px, a guard that refuses to replace a shape owned by another control, and a canvas handle that kept saying where it used to be after the rig changed under it.
- **A motion can add to what is playing instead of replacing it** (VNX-31). Two clips on the same movement used to mean the one started last won it outright — a nod during a look-around threw the look away. A motion now says which it wants, *Replaces it* or *Adds to it*, and the arrangement's overlap warning offers the second as a button on the later clip. The mixer has had an additive mode all along; what was missing was a clip saying it wanted one. Written only when it is not the default, so a project that never touches it exports the file it exported before.
- **Auto Key works everywhere the mascot can be posed** (VNX-35). Dragging a handle on the canvas wrote keys; the head-pose pad, the Preview test bench and the handle board did not — which is a strange thing to have to know, because from the author's side all of them are *move the mascot* and only some of them were also *animate it*. Every live surface now ends a gesture the same way: one key per control it moved, at the playhead, in one undo step. Shaping an expression deliberately stays out of it — that gesture writes into the expression, not into a clip.
- **A message you were just told is no longer wiped a sixth of a second later.** The readiness pass ran 150 ms after every edit and ended by writing `Project ready • N layers`, so every warning a panel had just posted — *this motion is now edited by hand*, *the clip is off*, *copy added in front* — disappeared before it could be read. A routine status now waits while a deliberate one is on screen; a routine *warning* still lands immediately, because a problem outranks a note about what just happened.
- **Any movement can be given a shape, with no timeline at all** (`docs/ADR_MOTIONS.md`, VNX-27). The ready-made catalogue is Head, Eyes and Face — a mascot that wiggles its ears, sways its hair, or has a hand pose its author invented found nothing in it, and its only way to animate that movement was the Timeline, key by key. The shapes those presets are built from are a vocabulary now: **Dip · Rise · Sweep · Hold · Pulse · Settle · Tremble**, each one already proven in a shipped preset. *Make your own* pairs one with any movement the project has, and what comes out is an ordinary preset motion — same amplitude, duration and repeats, same reset, same "edit a key and it becomes custom". Fixed on the way: seven movements the registry declares (ears, hair, jaw, nose, teeth, tongue) had no name anywhere in the editor and read as `Other · earWiggle` in the timeline, the arrangement rows and the movement palette alike.
- **Hair and ears arrive a beat after the head** (`docs/SECONDARY_MOTION.md`, 3D-10). The turn placed every feature exactly where the projection said, every frame, which is correct and slightly dead: a head that snaps to a pose carried everything drawn on it with the same infinite stiffness. A **follower** is one element lagging one parameter through the spring already tuned for hands, and what it writes is how far behind it is — so a head that is not moving displaces nothing at all, and a rig with followers renders identically to one without whenever it holds still. Generate turn writes them, the checkbox beside it takes them away, and the template ships with them. Not a physics system: no mass, no collisions, no chains, and a follower cannot be attached to another follower.
- A head position can hold an **outline**, not only a movement (`docs/HEAD_POSE_2_5D.md`, 3D-06). Until now a cell could translate, rotate, scale and fade artwork, so a turn pushed boxes around and the silhouette — the one thing a viewer reads a turn from — was the one thing it could not change. Select a path, open **Shape this position** in the Head pose panel, drag its nodes on the canvas and Capture: what is stored is an additive shape key plus the `pathShape` keyform that weights it, so an exported mascot deforms the outline with no head-pose code in the runtime at all. The session is topology-locked (adding a point is an artwork edit and belongs to the Node tool), the shape is pinned to zero where the head rests so the mascot still rests as it was drawn, and regenerating the turn rewrites the movement without touching the outline.

## 1.0.0

- Browser-only SVG editor with nested layers, transforms, rig parameters and bindings.
- States, transitions, blink and idle behaviors with live preview.
- Local project persistence plus SVG, rig and standalone runtime exports.
- Sanitized SVG imports, safe expression evaluation and schema migrations.
- GitHub Pages production build, runtime demo and cross-browser Playwright checks.

## v1 release closure
- Added atomic Basic, Expressive, and Talking Face project templates.
- Added Semantic Rig method/morph authoring and dedicated Rig/Timeline browser coverage.
- Scoped editor rendering by data domain and debounced cached background validation.
- Corrected Face Builder semantic compatibility, registry-driven calibration, exposed method validation, built-in blink geometry, real state-chip transitions, numeric key collision handling, and scrub override cleanup.
- Added release browser contracts and bounded workflow timeouts with retained Playwright reports, screenshots, traces, and test results.
