# Character Builder

> *Character Builder simple en surface + éditeur SVG avancé existant en
> profondeur.* — the roadmap's one-line brief.

The Character Builder is the simple surface over the mascot: the parts a
person names — head, eyes, brows, nose, mouth, ears, hair, hands — picked from
a list or on the canvas, then moved, resized and recoloured from one inspector.
It is the first step of **Create**, beside Artwork and Face Setup, and it
creates nothing of its own: the same document, the same canvas, the same
commands, the same undo. That is the whole design, and it is why an old
project opens in the builder with nothing migrated.

This page describes the editor with the whole Character Builder roadmap
delivered -- the shell, the part library, part replacement, auto-fit, linked
left/right editing, palette tokens, face-style presets, Edit Shape limited to
the piece, the hands placed and dressed, parts of the author's own, and old
projects read through the library. What each PR built on is written down at
the end.

## Three levels

| Level | Where | What it shows |
| --- | --- | --- |
| **1 · Character Builder** | Create → **Character** | presets, the parts of the face, the hands, one inspector with position, size, turn, colours; the existing canvas |
| **2 · Edit Shape** | **Edit Shape** in the inspector | Artwork, with that piece selected, the visible edit limited to it, and — when it is a path — the Node tool on its points; **Back to Character** returns with it in hand |
| **3 · Advanced** | **Advanced** at the foot of the parts column, or the inspector's *Advanced* | the interface that was there before: Layers, Face Setup, semantic parts, movements, calibration, bindings, animation |

Nothing is taken away at any level. The builder hides the layer tree, the
drawing tools and the rig; every one of them is one press away, on the same
selection.

## What is on screen

```text
┌ Character ────────────┬────────────────────────┬ Part Inspector ───────────┐
│ ★ Presets             │                        │ Eyes              [Eyes]  │
│ ◯ Head       Face     │                        │ [Left eye] [Right eye]    │
│ ◉ Eyes  ◄  Left · Right                        │ Position   X [ ]  Y [ ]   │
│    [Left eye][Right eye]     the canvas        │ Size/turn  Scale  Rotation│
│ • Pupils              │   (the existing one)   │ Colours    ■ ■ ■          │
│ ◠ Eyelids   …         │                        │ Shape      [✎ Edit Shape] │
│ ✋ Hands               │                        │ ▸ Advanced                │
│ ── ADVANCED ──────────│                        │                           │
│ [Artwork] [Face Setup]│                        │                           │
└───────────────────────┴────────────────────────┴───────────────────────────┘
```

- **A press on a category selects every piece that plays it** — both eyes,
  the fringe, the crown and the back of the hair — on the canvas and in the
  inspector at once. It is a selection and never a write: the document, the
  history and the autosave do not move.
- **A click on the mascot** lands the browser and the inspector on the part
  that owns what was clicked: the white of an eye is the eyes, the shading
  of the face is the head. The nearest owning part wins, never the first
  part that happens to contain the click.
- **The inspector edits the piece in hand.** With a pair selected, chips say
  which one the fields edit; a drag on the canvas moves the pair together.
- **Position, Scale and Rotation** write the artwork command the Artwork
  inspector writes (`artwork/set-transform`), one undo step per field. Scale
  is one number: both axes by the same factor, a mirrored piece staying
  mirrored.
- **Colours** are one swatch per colour, whatever number of shapes draw it.
  A swatch opens the colour dialog, and the pick changes that colour
  everywhere the piece uses it, as one undo step (a history transaction
  around `setAppearance`).
- **Edit Shape** routes to Artwork with the piece selected, and turns the
  Node tool on when the piece is a path. A rectangle or a group is selected
  and left with Select, with the toolbar right there. The visible edit is
  limited to the piece (`canvas.setEditScope(id)`, roadmap phase 16): the
  rest of the drawing is dimmed and inert, a marquee and Ctrl/Cmd+A pass it
  by, a shape drawn with Pen or Shape goes inside the piece when it is a
  group (next to it otherwise, and the scope ends there), and the existing
  path editing -- node moves, topology migration, shape keys -- runs as it
  always did. **↩ Back to Character** returns to the builder with the piece
  in hand; so does the Character tab. Selecting a piece outside the scope,
  from the layers, lifts it. The scope is session chrome: its marks are
  editor attributes the serializer strips, never in the project.
- **Hands** are placed like any piece: X, Y, Scale and Rotation are the
  artwork's base transform, and the rig adds its own movement -- reach,
  anchor drift, turn, size -- on top of it every frame (`carry` in
  `runtime/hands.js`), so the hand rests where it is put and the gizmo on the
  canvas drags, turns and resizes it (roadmap phases 17 and 19). What is the
  hand's alone sits under them: **Depth** (`hands[side].depth`, -1 behind
  the head to 1 in front) and **Mirror placement**, which makes the other
  hand the mirror image of this one as one undo step -- its artwork's place,
  turn and size mirrored across the face, its anchor, rest, reach and depth
  mirrored by `mirrorHand` -- keeping its own drawings. The anchor, the reach,
  the softness and the inertia stay in Face Setup → Hands, one press away;
  the reach guide drawn there follows the artwork's own move
  (`handReachEllipse` adds the hand's base translation), so a hand placed
  here is where hand mode shows it. Under the pair, **the drawings of each
  hand are cards** (roadmap phase 18): the six the registry knows
  (`handStylePresets`), each with the picker's own id-free thumbnail
  (`handStyleThumbnail`), the one the hand rests on marked. A press on a
  drawing the hand has makes it the resting style (`setStyles({ showing })`);
  a press on one it has not draws it first -- the same press as the picker
  beside the face, handed in by the app as `drawHandStyle` -- and rests on
  it, as one undo step. The runtime hand model is untouched.
- **Drag & drop** (roadmap phase 22). Every card that can be pressed can be
  dragged onto the mascot instead: a style card, a hand's drawing. The card
  writes what it is on the drag (`part-drag.js`: `face-part:<id>` or
  `hand-style:<side>:<style>`, under a type of its own), the canvas takes
  the drop (the builder's `dropHost` is the existing `#canvas`, which says
  `data-character-drop` while a card is over it, for the stylesheet), and
  the builder runs the card's press: `useStyle`, which opens the asset's
  own category first when another is showing, or `useHandStyle`. The same
  command, so the same one undo step. A file or text dropped on the canvas
  is left alone, a card the face refuses is not draggable, and the press
  stays: a keyboard or a touch screen has no drag.
- **A part of the author's own.** Under the piece in hand, *Save as a
  library part* names a category, the roles among the piece's shapes and a
  mount point, and saves the drawing into the library as a style card
  marked *Mine*, kept in the browser, with *Forget* beside it
  (`docs/FACE_PART_LIBRARY.md`, "Custom parts"). A library instance whose
  points were dragged in Edit Shape is **custom**: the inspector says so,
  the piece reads *Custom · from Round*, no card is current for it, and the
  card it came from puts the library drawing back; its category, roles and
  movements are kept.
- **Reset** (roadmap phase 29), under *Shape*: **Reset position** puts a
  library instance back where its fit put it, at the size it gave it,
  unturned (`part.assetFit`), and the template's own piece back where it was
  drawn; **Reset colours** paints a library instance again in the face's
  tokens (`createFacePartCommands(...).repaint(partId)`, the asset's palette
  roles matched to the instance's ids); **Restore library drawing** puts the
  asset back on a reshaped instance where it is; **Reset all** is the three
  as one undo step, the place first, since a drawing restored afterwards is
  fitted through the root as it stands and would carry a move the reset meant
  to take off. A hand has its own placement and none of these. The inspector
  redraws under a pressed button at once (only a field being typed in holds
  a redraw back), so what a press did is shown as it happens.
- **Presets** is the template face, loaded through the project service with
  its usual confirmation, and the six face style presets as cards with
  pictures: one press dresses the face as one undo step; Reset, Save the
  face as a preset, Forget (`docs/FACE_PART_LIBRARY.md`, "Presets").
- **Facial Hair** and **Accessories** take several at once, one per mount
  point, each with Remove (`docs/FACE_PART_LIBRARY.md`, "Several at once").
- The arrow keys nudge the part, and G · E · K · A pick the gizmo modes, as in
  Artwork. Delete, copy, paste, group and the drawing tools stay Artwork's.

## The one-minute path

Roadmap phase 47 asks that a character take under a minute, with no rig
setting on the way. The entry is Home's **New Character** card, the
recommended one (and *New Character* in the command palette): the same
rigged template the Mascot Face card loads, landing in the Character
Builder instead of Artwork (`loadTemplate('basic', { task: 'character' })`),
with the presets open and the status saying what to do. From there the
path is the roadmap's:

```text
New Character → a preset → Head → Eyes → Hair → Mouth → Glasses → a hand style → Preview
```

Every step is one card and every card one undo step, and the rig follows:
a style keeps the part's movements (`docs/FACE_PART_LIBRARY.md`,
"Installing"), a preset applies as one step, a hand drawing rests the
hand. Nothing in Face Setup has to be opened. The browser test walks the
whole path and holds it under a minute, its own waits included.

## Vocabulary

| Word | Meaning here |
| --- | --- |
| **Category** | A row of the parts column: what a person calls a part of the face. It *reads* the semantic parts; it is not stored. |
| **Piece** | One element of artwork playing one role of a category: the left eye, the fringe, the tongue. |
| **Part in hand** | The piece the inspector edits: the session's `selectedId`, always a member of `selectedIds`. |
| **Semantic part / role** | The authored truth, unchanged (docs/SEMANTIC_RIGGING.md). A category names a part type and the roles it counts as pieces. |
| **Asset, instance, override, mount point** | Not yet. They belong to the part registry (PR 2) and the instance model (PR 15). |

## How a category reads the document

The face categories are the library's (`docs/FACE_PART_LIBRARY.md`): the
builder lists `FACE_PART_CATEGORIES` in the library's order, with the part and
the roles each one reads from the semantic part registry, and adds Presets and
Hands around them.

| Category | Semantic part | Roles that count as pieces |
| --- | --- | --- |
| Head | `head` | `head` — the face that turns, which on the template is the `faceRoot` group |
| Eyes | `eyes` | `leftEye`, `rightEye` |
| Pupils | `gaze` | `leftPupil`, `rightPupil` |
| Eyelids | `eyelids` | `leftUpper`, `rightUpper`, `leftLower`, `rightLower` |
| Brows (`eyebrows`) | `eyebrows` | `leftBrow`, `rightBrow` |
| Nose | `nose` | `nose` |
| Mouth | `mouth` | `mouth`, `cavity`, `teeth`, `tongue` |
| Ears | `ears` | `leftEar`, `rightEar` |
| Hair | `hair` | `hair`, `hairTop`, `hairBack` |
| Facial Hair | — | none yet (PR 9 / roadmap phase 11) |
| Accessories (`accessory`) | every `accessory` part | `element` |
| Hands | the `hands` block | the left and right hand artwork; a `leftHand` / `rightHand` part on a mascot rigged before the block existed |

A role whose artwork is gone is not a piece. A category with no pieces says
so — *No eyes on this mascot yet* — and offers Face Setup, where a part is
given its artwork.

## One truth, no second state

The roadmap's constraint (phase 41) is met by construction: the builder holds
no `faceDesign` beside the SVG. Its only state of its own is which category
was last pressed, kept in the panel for the session and dropped the moment
the canvas selects a piece of another part.

| Builder gesture | What actually happens |
| --- | --- |
| press a category | `mutateSession` with `selectMany(pieces)` (`core/state/selection.js`) |
| pick a chip | the same, with that piece as the one in hand |
| X, Y, Rotation | `createArtworkCommands(store, history).setTransform(id, patch)` then `canvas.applyElementTransform` |
| Scale | the same command with `scaleX` and `scaleY`, signs kept |
| a swatch | `history.beginTransaction()`, `canvas.setAppearance()` per use, `history.commitTransaction()` |
| Colours → a token | `createFacePartCommands(...).retint(token, colour)`: the same, over every use of the colour on the face |
| Remove (an accessory, facial hair) | `createFacePartCommands(...).remove(partId)`: the artwork off the canvas, references scrubbed, the part dropped, one undo step |
| Edit Shape | `taskRouter.navigate({ task: 'artwork', target: { kind: 'artwork-element', id } })`, `canvas.setEditScope(id)`, then the Node tool for a path; `#return-character` navigates back with the piece as the target |
| Advanced → Artwork | the same route without the tool |
| Advanced → Face Setup | `{ task: 'face-setup', target: { kind: 'semantic-part', id } }`, or the checklist when nothing is in hand |
| Presets → Mascot Face → Use | `projectService.loadTemplate('basic')`, confirmation included |
| Presets → a face style | `createFacePartCommands(...).applyPreset(id)`: every replacement, removal and retint the preset needs, one history transaction |
| Reset preset · Save · Forget | `applyPreset` of the worn preset · `saveAsPreset({ name })` into the browser's storage · `removePreset(id)` |
| a style card | `createFacePartCommands(store, history, canvas).replace(category, assetId)` — one undo step, the part's roles and movements kept, the asset fitted to this face (`docs/FACE_PART_LIBRARY.md`, "Installing", "Layout and auto-fit") |
| X, Y, Scale, Rotation on a library part | the same artwork command, on the part's root and on the pieces it paints behind the face, one transaction: a library part moves as one, whichever shape of it was clicked |
| X, Y, Scale, Rotation on one side of a pair | the same command on both sides, in one history transaction: the move and the turn mirrored, the height and the size the same ("Linked editing" below) |
| Spacing | both sides moved half the difference each, apart or together, one transaction |
| Edit both … (untick) | the pair edited one side at a time; a session setting of the builder, never written to the project |
| Depth (a hand) | `createHandCommands(store, history).setDepth(side, value)`, clamped to -1…1 |
| Mirror placement | `handCommands.mirror(side, { mirrorX, element })` and `setTransform` of the other hand's artwork (x and rotation negated), one history transaction |
| a drawing card (a hand) | `handCommands.setStyles(side, { showing })`; for a drawing not yet on the hand, the app's `addHandStyleDrawing` first, in one history transaction |
| Hands → Hand setup… | `{ task: 'face-setup', focus: 'hand-setup' }` |
| Reset position · colours · library drawing · all | `setTransform` to the fit or identity · `createFacePartCommands(...).repaint(partId)` · `replace(category, assetId)` · the three in one history transaction |
| Save as a library part | `createFacePartCommands(...).saveAsPart({ rootId, category, name, roles, mountPoint })`: the artwork read from the document, validated, registered as the author's, written to storage; no document write |
| Forget (a part of yours) | `removeCustomPart(id)`; the face keeps its drawing |

## Linked editing

The eyes, the pupils, the brows, the ears and the lids come in twos, and a
face is edited as a face: with **Edit both eyes** ticked — it is, until it is
unticked — a write on one side is written on the other too, as one undo
step. The move and the turn mirror (`x` and `rotation` change sign: an eye
moved a little out is the other eye moved a little out the other way), the
height and the size are the same (`y`, `scale`). **Spacing** is the distance
between the two centres as the canvas measures them, through their
transforms; setting it moves each side half the difference. Unticking the
box edits the side in hand alone; the setting is the category's and lives in
the builder for the session, never in the project.

A pair is read from the roles — `leftEye` and `rightEye` are the two sides of
one thing, `leftUpper` pairs with `rightUpper` — or from a symmetry peer the
author named in Artwork, when it is a piece of the same category. A locked
side is left alone. A part that came from the library as one root has no
pair to link: it moves as one already.

## What the canvas needed

Three things, and nothing else moved into `svg-canvas.js` (roadmap phase 39):

- **`EDIT_WORKSPACES`** — selection, the gizmo, Shift+click and the
  multi-piece drag work in `create` and in `character`. Drawing a shape stays
  `create` only, and leaving Artwork still puts the tool back to Select.
- **`describePaints(id)`** — the fill and stroke of a piece and of every piece
  inside it, read from the artwork rather than from svg.js's defaults, so the
  panels never touch the SVG DOM themselves (roadmap phase 40).
- **`replaceArtwork(removeIds, markup, { mountPoint, before })`** (PR 3) —
  the old nodes out, the sanitized fragment in at the same place in the
  paint order, the document read back once; the store untouched, like
  `appendArtwork` with `updateStore: false`.

The shell learned one workspace (`character`) and one task, filed first in
the Create stage. Artwork stays where a template, an import and every existing
route land, so nothing that named it moves.

## Files

```text
project/editor/ui/character-builder/
  character-model.js         the categories, and every rule: pure over a ProjectDocument
  character-builder.js       the wiring between the two panels and the editor
  part-browser.js            the parts column, the library's style cards, the Advanced footer
  part-inspector.js          the part in hand: position, size, turn, colours, Edit Shape
  preset-browser.js          the presets, as cards: the template face, the face styles with pictures, Reset, Save, Forget
  hand-placement-panel.js    the hands as a pair, and the door to their setup
  part-drag.js               what a card writes on a drag and the canvas reads on the drop
project/editor/core/tests/character-model.test.js
project/editor/core/tests/character-builder.test.js
project/editor/core/tests/part-drag.test.js
tests/e2e/ux45-character-builder.spec.js
```

Both panels are behind the component lifecycle (docs/VNEXT_COMPONENTS.md):
the list is folded into a signature so an edit that changes no part costs a
comparison, and the inspector waits to redraw while a field inside it has
focus, exactly as the Artwork inspector does.

## Tests

- **Unit** — the categories the template face fills; a piece belonging to the
  nearest owning part; the chosen category giving way to the canvas; one
  size with a kept flip; the palette; a press being a selection and never a
  write; a field being one undo step; a colour being one undo step across
  every use; Edit Shape and Advanced as routes; presets, facial hair and hands
  saying what they are; the lifecycle skipping an unchanged mascot and letting
  go on destroy; the style cards saying what they are, a card replacing the
  part as one undo step with the new pieces in hand, and a refused style
  writing nothing; a pair edited as one, mirrored, one undo step, Spacing
  half each, a locked side left alone, Unlink one side alone; a card picked
  up carrying what it is and a refused card carrying nothing; a drop on the
  canvas being the card's press, its own category opened, one undo step, a
  file drop left alone, the listeners gone with the builder.
- **Browser** (`@critical`) — the builder as a step of Create with the
  layer tree and the drawing tools put away; a category framing its pair on
  the canvas and writing nothing; a field writing one undo step; a click on
  the mascot landing the inspector on its part; Edit Shape opening Artwork
  with the Node tool on the mouth; the tab coming back to the same part;
  Advanced opening Artwork and Face Setup on it; a pair dragged together and
  a piece dragged alone, one undo step a gesture; the arrows nudging and
  Delete deleting nothing; a library mouth replacing the template's in one
  undo step, `smile` and `teeth` moving the new drawing, and Undo bringing
  the old mouth back, tongue and all; a style card dragged onto the mascot
  going on as one undo step, and a hand drawing dragged resting the hand.

## What the next PRs build on

| PR | Builds on |
| --- | --- |
| 2 · Face Part Registry | done: `FACE_PART_CATEGORIES` is the one table the builder and the library share (`docs/FACE_PART_LIBRARY.md`) |
| 3 · Replace Part | done: a style card is `createFacePartCommands(...).replace`; the category → part → roles mapping is the contract it keeps (`docs/FACE_PART_LIBRARY.md`, "Installing") |
| 4 · Layout / Auto-fit | done: the layout context reads the parts' boxes into anchors, the fit lands an asset on any face at its size, a library part is one piece — its root (`docs/FACE_PART_LIBRARY.md`, "Layout and auto-fit") |
| 5 · Eyes + Symmetry | done: a field write on one side mirrors onto the other as one undo step, Spacing moves the pair, Unlink edits one side ("Linked editing") |
| 6 · Basic Face Library | done: twenty-two assets, composite eyes that bring their pupils and lids, the skull rule for a head that is the whole face (`docs/FACE_PART_LIBRARY.md`) |
| 7 · Hair Composite | done: five hair styles, one part with up to three roles, the back painted behind the face and moving with the root (`docs/FACE_PART_LIBRARY.md`, "Pieces painted behind") |
| 8 · Palette tokens | done: *Colours* is a row of the parts list, one swatch per token the face has, one undo step across every use; a library part is painted in the face's colours as it goes on (`docs/FACE_PART_LIBRARY.md`, "Palette tokens") |
| 9 · Facial Hair & Accessories | done: a `facialHair` part, one part per mount point for the categories a face wears several of, Add and Remove (`docs/FACE_PART_LIBRARY.md`, "Several at once") |
| 10 · Presets | done: six face style presets as cards with pictures, applied as one undo step, the worn one marked, Reset, Save the face as a preset (`docs/FACE_PART_LIBRARY.md`, "Presets") |
| 11 · Edit Shape | done: the existing tools, the visible edit limited to the piece, Back to Character ("Edit Shape" above) |
| 12 · Hand placement | done: a hand placed like any piece with the gizmo, Depth and Mirror placement over the hand model ("Hands" above) |
| 13 · Hand style browser | done: the six drawings as cards under each hand, the resting one marked, a press to rest on one or draw it first ("Hands" above) |
| 14 · Custom components | done: Save as a library part from the piece in hand, and a reshaped library instance read as custom ("A part of the author's own" above) |
| 15 · Migration | done: an old project's parts that are a library asset drawn exactly are identified on open, the rest read as the author's own (`docs/FACE_PART_LIBRARY.md`, "Migration") |
| 16 · Polish | done: focus survives a panel's redraw (`setPanelHtml`), a piece chosen from the phone's drawer raises the inspector, the builder in the visual baselines (`ux22-visual`), the docs closed out |
| 17 · Animation matrix, round trip | done: every built-in asset's movements driven through the runtime's frame compiler (`face-part-animation-matrix.test.js`, phase 25); a face dressed end to end, saved, reloaded and found identical (`ux45`, phase 35) |
| 18 · Reset part | done: Reset position, Reset colours, Restore library drawing, Reset all under the piece in hand, each one undo step ("Reset" above; phase 29) |
| 19 · Library V1, the badge | done: the seven assets phase 45 still asked for (forty-two in all), and every card's title listing the category's movements ✓ carried or – not (phase 26) |
| 20 · A jaw for library heads | done: every skull a path with its jaw pose, a shape key on it driven as the template's, `jawOpen` kept through a head replacement (`docs/FACE_PART_LIBRARY.md`, "The skull rule") |
| 21 · Presets with hands and placements | done: a preset carries what each hand rests on and where each part sits over its fit, saved from the face and applied with it (`docs/FACE_PART_LIBRARY.md`, "Presets"; phase 28) |
| 22 · Drag & drop | done: a style card or a hand's drawing dragged onto the mascot is the card's press, the same command and the same one undo step; the press stays for keyboards and touch ("Drag & drop" above; phase 22) |
| 23 · New Character | done: Home's recommended card lands the template in the builder with the presets open, and the browser test walks preset → head → eyes → hair → mouth → glasses → hand style → Preview under a minute ("The one-minute path" above; phase 47) |

Known limits, on purpose: a drag needs a pointer, so the press does the same from a keyboard or a touch screen; a library pair of eyes moves as one piece, so its spacing is set
before it is chosen, on the pupils, or in Artwork; the reach guide of hand
mode, the pins and the warps stay in Face Setup, where they are measured.

**Keyboard and small screens.** Every card, chip and row of the builder is a
button with its state in `aria-pressed` and its meaning in `title` or
`aria-label`; the lists are groups with a label. A press that redraws the
panel -- a style, a preset, a drawing -- leaves focus on the same control,
since `setPanelHtml` finds the element with the same data attribute in the
new markup (`ui/panel-render.js`). On a phone the parts list is the drawer
and the inspector the sheet: a piece chosen from the drawer raises the
sheet, as a Face Setup part does (`responsive.revealInspector`).
