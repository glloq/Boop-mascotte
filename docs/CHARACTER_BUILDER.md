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

This page describes the editor after **PR 1 — Character Builder Shell**. The
part library, part replacement, auto-fit, linked left/right editing, palette
tokens and face-style presets are the PRs that follow; what each of them
builds on is written down at the end.

## Three levels

| Level | Where | What it shows |
| --- | --- | --- |
| **1 · Character Builder** | Create → **Character** | presets, the parts of the face, the hands, one inspector with position, size, turn, colours; the existing canvas |
| **2 · Edit Shape** | **Edit Shape** in the inspector | Artwork, with that piece selected and — when it is a path — the Node tool on its points |
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
  and left with Select, with the toolbar right there.
- **Hands** are a pair to pick, recolour and reshape — not a position to type.
  A hand is placed by its anchor and reach and moved by the rig every frame
  (docs/HAND_STYLES.md), so the inspector says so and offers Face Setup →
  Hands instead of a number the next frame would write over.
- **Presets** is the template face for now, loaded through the project
  service with its usual confirmation. Face-style presets arrive with the
  part library.
- **Facial Hair** is listed and says it has no part yet. Accessories read the
  `accessory` parts a mascot already has.
- The arrow keys nudge the part, and G · E · K · A pick the gizmo modes, as in
  Artwork. Delete, copy, paste, group and the drawing tools stay Artwork's.

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
| Edit Shape | `taskRouter.navigate({ task: 'artwork', target: { kind: 'artwork-element', id } })`, then the Node tool for a path |
| Advanced → Artwork | the same route without the tool |
| Advanced → Face Setup | `{ task: 'face-setup', target: { kind: 'semantic-part', id } }`, or the checklist when nothing is in hand |
| Presets → Use | `projectService.loadTemplate('basic')`, confirmation included |
| a style card | `createFacePartCommands(store, history, canvas).replace(category, assetId)` — one undo step, the part's roles and movements kept, the asset fitted to this face (`docs/FACE_PART_LIBRARY.md`, "Installing", "Layout and auto-fit") |
| X, Y, Scale, Rotation on a library part | the same artwork command, on the part's root and on the pieces it paints behind the face, one transaction: a library part moves as one, whichever shape of it was clicked |
| X, Y, Scale, Rotation on one side of a pair | the same command on both sides, in one history transaction: the move and the turn mirrored, the height and the size the same ("Linked editing" below) |
| Spacing | both sides moved half the difference each, apart or together, one transaction |
| Edit both … (untick) | the pair edited one side at a time; a session setting of the builder, never written to the project |
| Hands → Hand setup… | `{ task: 'face-setup', focus: 'hand-setup' }` |

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
  preset-browser.js          the presets, as cards (the template face, for now)
  hand-placement-panel.js    the hands as a pair, and the door to their setup
project/editor/core/tests/character-model.test.js
project/editor/core/tests/character-builder.test.js
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
  half each, a locked side left alone, Unlink one side alone.
- **Browser** (`@critical`) — the builder as a step of Create with the
  layer tree and the drawing tools put away; a category framing its pair on
  the canvas and writing nothing; a field writing one undo step; a click on
  the mascot landing the inspector on its part; Edit Shape opening Artwork
  with the Node tool on the mouth; the tab coming back to the same part;
  Advanced opening Artwork and Face Setup on it; a pair dragged together and
  a piece dragged alone, one undo step a gesture; the arrows nudging and
  Delete deleting nothing; a library mouth replacing the template's in one
  undo step, `smile` and `teeth` moving the new drawing, and Undo bringing
  the old mouth back, tongue and all.

## What the next PRs build on

| PR | Builds on |
| --- | --- |
| 2 · Face Part Registry | done: `FACE_PART_CATEGORIES` is the one table the builder and the library share (`docs/FACE_PART_LIBRARY.md`) |
| 3 · Replace Part | done: a style card is `createFacePartCommands(...).replace`; the category → part → roles mapping is the contract it keeps (`docs/FACE_PART_LIBRARY.md`, "Installing") |
| 4 · Layout / Auto-fit | done: the layout context reads the parts' boxes into anchors, the fit lands an asset on any face at its size, a library part is one piece — its root (`docs/FACE_PART_LIBRARY.md`, "Layout and auto-fit") |
| 5 · Eyes + Symmetry | done: a field write on one side mirrors onto the other as one undo step, Spacing moves the pair, Unlink edits one side ("Linked editing") |
| 6 · Basic Face Library | done: twenty-two assets, composite eyes that bring their pupils and lids, the skull rule for a head that is the whole face (`docs/FACE_PART_LIBRARY.md`) |
| 7 · Hair Composite | done: five hair styles, one part with up to three roles, the back painted behind the face and moving with the root (`docs/FACE_PART_LIBRARY.md`, "Pieces painted behind") |
| 8 · Palette tokens | `paletteOfPaints` becomes token-aware; the swatches are already one per colour |
| 10 · Presets | `preset-browser.js` swaps its cards for `FACE_STYLE_PRESETS`; the press keeps going through one confirmed command |
| 12 · Hand placement | `hand-placement-panel.js` gains position, rotation, scale and depth over the hand model, and the canvas handles |
| 16 · Edit Shape | already the existing tools; what remains is limiting the visible edit to the piece |

Known limits, on purpose: colours are values, not tokens; there is no drag
and drop; a library pair of eyes moves as one piece, so its spacing is set
before it is chosen, on the pupils, or in Artwork; library skulls carry no
jaw pose yet.
