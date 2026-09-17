# V4 — pixels as first-class artwork

V3 finished the vector mascot: a part library, a head that turns in 2.5D, a
timeline, reactions, hands. V4 answers the one thing an author cannot do
today — **bring their own drawing**. A PNG or a WebP exported from any paint
program becomes artwork the rig moves, the same rig, on the same canvas.

It is not a renderer rewrite. SVG stays. The raster path enters through
`<image>` in the scene we already have, and the deformable raster arrives
last, behind an interface, only once the rigid one is proven.

## What the survey found

Five facts from the live code shape every decision below. Each one is a
constraint the plan has to route around, not a detail.

1. **There is no `rigVersion`.** `project/runtime/runtime.js:12` defines
   `RIG_SCHEMA_VERSION = 5`, stored on the document as `schemaVersion`. A
   *project* version distinct from the *rig schema* version is net-new, not an
   alignment.
2. **There is no migration framework.** `import-rig.js:5` copies the incoming
   `schemaVersion` verbatim; the forward-fixing that exists
   (`markLegacyPseudo3DHands`, `dropRetiredHandValues` in
   `core/state/project-document.js`) is implicit, unversioned and unordered.
   "Automatic, non-destructive migration" is machinery to build.
3. **The sanitizer removes every reference that is not internal.**
   `core/security/sanitize-svg.js:10` drops any `href`/`xlink:href`/`src`
   whose value is not `#…`. An `<image>` pointing at a `blob:` or a `data:`
   URL is stripped on the way in. This is a hard gate in front of Phase 2 and
   it gets its own PR and its own review.
4. **Autosave is `localStorage`.** `core/state/local-recovery.js:20` writes
   `JSON.stringify` of the whole snapshot under one key. One base64 WebP
   exhausts the quota.
5. **Undo deep-clones the document, up to a hundred times.**
   `core/undo/history.js:17` pushes `structuredClone(document())` per step. A
   binary inside the document is a binary copied a hundred times.

Facts 3–5 all say the same thing, and the plan takes it as its central rule.

## ASSET-REF — the decision the rest of the plan rests on

**Artwork never carries a binary.** A raster node is:

```xml
<image id="head" href="asset:7f3c9a…" x="…" y="…" width="…" height="…"/>
```

The id is resolved to an object URL at paint time, by one resolver, and
nowhere else. The bytes live in the asset store, keyed by content hash.

One choice, four risks closed:

| Risk | Why it closes |
| --- | --- |
| Sanitizer (fact 3) | `asset:` is internal by construction — the rule "no reference leaves the document" stays literally true, and the allowance is one scheme, not a hole |
| Undo (fact 5) | The document stays text; `structuredClone` stays cheap |
| Autosave (fact 4) | The snapshot stays JSON; blobs go to IndexedDB under their hash |
| Portability | The reference is not a path, so a `.boop` opened on another machine resolves it from its own bundle |

Anything that would put bytes in `svgMarkup` — base64, a data URL, an inline
blob — is out of scope for every PR below, permanently.

## Two corrections to the frozen values

- **The logical canvas is 240 × 240, not 200 × 200.**
  `core/artwork/artboard.js:17` is the default, and 240 is not only a default:
  `core/sample/hand-feature.js:59` divides by it (`handScale`), every template
  and the default mascot declare it, and 57 e2e spec files exercise it — one of
  them, `tests/e2e/ux22-visual.spec.js`, against twelve pixel snapshots.
  Moving to 200 is a churn of the whole fixture corpus for no gain. **Keep
  240 × 240.** The value worth freezing is the *asset* budget — 512 px normal
  maximum, ~2× density — which is independent of it.
- **"Align `rigVersion`" is "introduce `projectVersion`."** See fact 1. The
  rig schema is already coherent at 5 and V4 must not bump it for anything
  the raster path does; the raster path is a *project* concern.

Everything else in the frozen list stands: SVG + PNG + WebP, `assetId` as the
only reference, `<image>` for rigid raster, mesh as a separate node type,
`.boop` as the package, the existing Behavior workspace improved rather than
replaced, animation distinct from behavior, SVG compatibility mandatory.

## Sequencing rules

1. **Model before pixels, pixels before UX.** An asset record that no UI can
   reach is still a PR worth merging; an import button over a model that
   cannot dedupe is not.
2. **One PR does not cross canvas, storage, runtime and UI.** Where a feature
   would, it splits at the seam — and the seam is named in the PR entry.
3. **The sanitizer allowance is never bundled.** It ships alone, reviewed as
   a security change (V4-020).
4. **No new special case keyed by an id** — V3's rule, unchanged. A renderer
   is chosen by the node's `renderer` field, never by what the asset is
   called.
5. **Every phase ends on a test a human could have run.** Exit criteria below
   are written as that test.
6. **Additive to `rig.json` or it does not ship.** V4 raises
   `projectVersion`; `RIG_SCHEMA_VERSION` moves only in Phase 7, and only if
   `mesh-image` proves it must.

## Phase 0 — Stabilise (5 PRs) — **done**

No user-visible change. The point is a baseline that later phases can be
measured against.

| PR | What | Files | Size |
| --- | --- | --- | --- |
| **V4-001** — done | One truth about which version a project file is: `PROJECT_VERSION`, `projectVersionOf`, `canOpenProjectVersion` | new `state/project-version.js`, `state/project-snapshot.js` | S |
| **V4-002** — done | An ordered, named migration ladder, run once at the boundary a file arrives through; a step that throws fails the load rather than half-applying | new `state/migrations/project-migrations.js`, `state/project-snapshot.js` | M |
| **V4-003** — done | Two real projects frozen as fixtures: open → edit → save → reload → the same compiled frame, anchored to a frozen digest | `core/tests/fixtures/projects/`, new `project-roundtrip.test.js` | M |
| **V4-004** — done | Three reference scenes with counted budgets and one generous ceiling each | new `fixtures/reference-scenes.js`, new `v4-reference-scenes.test.js`, `docs/PERFORMANCE_BUDGETS.md` | S |
| **V4-005** — done | The current project format documented as it actually is | new `docs/PROJECT_FORMAT.md` | S |

**Exit:** a project saved before V4-001 opens, edits, saves and reloads to an
identical compiled frame, and the suite says so without a human looking.

### What building it corrected

- **There was no new field to add.** The separation V4 asks for already
  existed: the file carries `version` (the private `SNAPSHOT_VERSION`, 3) and
  the rig inside it carries `schemaVersion`. What was missing is that the
  file's version was unnamed and its accepted range written out twice. So
  V4-001 named it and unified the predicate rather than adding a third number,
  and it stays on the file rather than moving onto `ProjectDocument`: which
  format a document was stored in is not something the document means.
- **The ladder declares every rung, including the empty ones.** Opening an old
  project works today by accident -- every field a newer format added is
  defaulted when absent -- and that holds exactly as long as changes stay
  additive. So a rung with nothing to do still gets an entry, because "no
  entry" has to mean someone forgot; `projectMigrationLadderGaps` makes that a
  failing test rather than a comment.
- **Migration runs at `prepareProjectSnapshot`, and only there.** Not in
  `applyProjectSnapshot`: its callers load the canvas from
  `document.svgMarkup` *before* they apply, so a step that rewrote the markup
  there would rewrite it after the canvas had read the old one. This matters
  from V4-020 on, when a step will rewrite exactly that markup.
- **A round trip alone proves less than it looks.** Comparing a reloaded
  project against the same project in memory is symmetric: a reader that
  drops a domain drops it on both sides and the test still passes. Emptying
  `keyforms` on the way in passed every relative check. The fixtures are
  therefore anchored to a frozen frame digest and frozen domain counts.
- **`render-plan.js` is not the render.** It is the table of which panel
  redraws for which domain. The testable visual invariant is the compiled
  frame (`preview-runtime/frame-compiler.js`), which is what the fixtures use.
- **A known hole:** warps, deformers and hands are empty in both fixtures, so
  no *project* in the corpus carries one. Closing it belongs to V4-060 and
  V4-070, where those domains change.
- **Node count is the cost, not deformation.** Two hundred nodes that only
  move cost about what a hundred and thirty that deform do: ~7 µs a node
  against ~11 µs. So the scene to guard through Phase 2 is the rigid one and
  V4-022 must not add per-node compile work; Phase 7 starts with more headroom
  than it appears to. There is a test for that ratio.
- **`.boop` inherits a decision, not a format.** `createExportRig` does not
  write the file's `rig` block: it moves expressions and reactions in, renames
  clips to `animations`, adds `requires`, and drops every authoring-only
  domain. The export is lossy on purpose, so V4-040 has to choose whether the
  package carries both shapes or keeps export a separate action
  (`docs/PROJECT_FORMAT.md`).

## Phase 1 — The asset model (6 PRs) — **done**

Still no raster on the canvas. This is the model, the store and the rules.

| PR | What | Files | Size |
| --- | --- | --- | --- |
| **V4-010** — done | The `Asset` record (`id`, `kind`, `format`, `width`, `height`, `hash`, `ref`, `alpha`, `metadata`) and an `assets` entry in `PROJECT_DOMAINS`; normalizer and validation, no UI | new `core/assets/asset-model.js`, `state/project-document.js` | M |
| **V4-011** — done | Binary store: blobs by hash in IndexedDB, with an in-memory implementation so Node tests exercise the same interface | new `core/assets/asset-store.js`, `core/assets/asset-store-memory.js` | M |
| **V4-012** — done | Import validation as a pure function: real MIME by magic bytes, decode, dimensions, limits — the extension is never trusted | new `core/assets/asset-validate.js` | M |
| **V4-013** — done | `AssetManager`: `import` / `resolve` / `replace` / `retain` / `release` / `findDuplicates` / `removeUnused`, refcounted from document references | new `core/assets/asset-manager.js` | L |
| **V4-014** — done | Resize on import to the 512 px budget, and thumbnails | new `core/assets/asset-optimise.js` | M |
| **V4-015** — done | The single `AssetResolver` (`asset:` → object URL, cached, revoked) that editor, preview and runtime all import | new `core/assets/asset-resolver.js` | M |

**Exit:** a PNG and a WebP can be imported in a test, produce an `assetId`,
report their true dimensions, dedupe against a re-import of the same bytes,
and be collected when nothing references them — with no editor change at all.

V4-013 carries the lifecycle the survey flagged: deletion removes the *node*,
and the file only when the last reference goes. Shared assets are the normal
case, not the exception.

### What building it corrected

- **No `retain`/`release`, and no `findDuplicates`.** An editor with undo
  cannot hand-count references: undo restores a whole document in one step, so
  the count has to be a *function* of the document rather than a tally kept
  beside it. And with the id being the content hash there is never a second
  record to find — what survives is telling the author their import was
  already here.
- **`replace` is a node command, not an asset one.** Swapping a picture
  changes which id a node points at; the old asset is untouched and may still
  be in use. It belongs to V4-032.
- **The id is the hash, with no second `hash` field.** Two fields holding one
  answer is the drift V4-001 was about.
- **`missingIn` was missing from the plan.** Ids the artwork points at that
  the table has no record of: the shape a hand-assembled file or a damaged
  package takes, and Phase 11's "corrupt project" case starts here.
- **The reference lives in the runtime.** `runtime/asset-reference.js`, because
  the runtime must read one and must never import the editor.
- **Persistence is reported.** A browser without IndexedDB still gets a working
  store, one that says `persistent: false`, because silently falling back to
  memory means autosave stopping at the images while claiming to have saved.

## Phase 2 — Rigid raster nodes (6 PRs) — **done**

The change becomes visible here.

| PR | What | Files | Size |
| --- | --- | --- | --- |
| **V4-020** — done | **Security, alone.** The sanitizer accepts `asset:<id>` on `href`/`xlink:href` as an internal reference and keeps rejecting everything else; `findUnsafeSvg` reports by the same rule | `core/security/sanitize-svg.js` | S |
| **V4-021** — done | The canvas resolves `asset:` at paint time and revokes on unload | `svg-editor/svg-canvas.js` (render pass only) | M |
| **V4-022** — done | `<image>` as a selectable node: selection, move, scale, rotate. Path-only operations already guard on `element.type !== 'path'` — this PR audits every such guard and makes the message right | `svg-editor/svg-canvas.js`, `svg-editor/selection-overlay.js` | L |
| **V4-023** — done | Parity for pivot, layer, depth, opacity, lock, visibility, duplication | `inspector/`, `svg-editor/layers-panel.js`, `core/commands/artwork-commands.js` | M |
| **V4-024** — done | Preview and the exported runtime resolve through the *same* resolver | `runtime/runtime.js`, `core/preview-runtime/`, `core/export/runtime-bundle.js` | M |
| **V4-025** — done | A fully raster mascot as an e2e fixture: head, eyes, mouth, hair, with the current rig and head pose | `tests/e2e/`, fixtures | M |

**Exit:** `head.webp` + `eye_L/R.webp` + `mouth.webp` + `hair.webp` rig, animate
and turn exactly as their SVG equivalents do, in the editor and in the export.

**What V4-020 corrected.** Restricting `asset:` to `<image>` was the first
attempt and was dropped: it buys no safety (the scheme has no handler, so it
is inert wherever it lands) and can only be enforced on the DOMParser branch,
which would leave the cleaner and its scan answering one question two ways.
The rule is the *value* — a strict hex id — applied identically in both
branches.

### What building it corrected

- **V4-022 was not the largest PR; it was mostly an audit.** Every path-only
  guard in the canvas was already correct, because the rig never asked what a
  piece was drawn with. What was wrong was the *message*: it told a picture's
  author to convert the shape to a path, an action that would have declined.
- **The document must never hold what paints it.** An object URL lives as long
  as the tab; `svgMarkup` outlives it. So the reference moves aside into
  `data-editor-asset` and `SvgDocument.serialize` puts it back — the DOM
  carries its own answer, so any path that serializes gets it right.
- **Loading stays synchronous.** Reading bytes is not, so fetching is a
  separate `refreshAssets`, in the canvas and in the engine alike. A mascot
  made of paths never waits for a picture.
- **The preview needed nothing.** It draws through `canvas.applyFrame` onto the
  DOM the canvas already painted, so it has resolved assets since V4-021.
- **The inspector was wrong in both directions**: it offered a picture paint
  that does nothing, and not the box an author actually drags.
- **Parity is proved as numbers, not screenshots.** A raster mascot and its
  vector twin are built from one rig and their compiled frames compared. The
  browser-level spec is still owed: the Chromium build available in this
  environment does not match the one Playwright expects.

## Phase 3 — Import that a person can use (3 PRs)

| PR | What | Size |
| --- | --- | --- |
| **V4-030** | **+ Add image**: drop or browse, validate, optimise, place, transform | M |
| **V4-031** | **Import Head / Base**: auto-fit to the artboard, centre, propose pivot, depth and layer | M |
| **V4-032** | **Replace artwork**: new bytes, same node — rig, animations, pivot and depth untouched | M |

**Exit:** someone who has never read `docs/PROJECT_FORMAT.md` builds a head
from their own images and it moves.

V4-032 is the one authors will actually live in, and it is cheap because of
ASSET-REF: replacing artwork is writing one `assetId`.

## Phase 4 — `.boop`, and an autosave that survives pixels (4 PRs)

| PR | What | Size |
| --- | --- | --- |
| **V4-040** | The package reader/writer: `project.json`, `scene.svg`, `rig.json`, `assets/` | L |
| **V4-041** | Export and import `.boop` from the UI, with hash verification on read | M |
| **V4-042** | Autosave to IndexedDB: JSON snapshot referencing `assetId`s, blobs beside it — never base64 in the snapshot | M |
| **V4-043** | Atomic save and recovery from a partial write | M |

**Exit:** export on one machine, open on another with none of the original
files present, identical render.

V4-042 retires `localStorage` for the snapshot (fact 4). The recovery record
gains a version so a pre-V4 autosave still restores.

## Phase 5 — A library that is not SVG-shaped (3 PRs)

`core/assets/face-builder.js:24` returns an SVG document string. That is the
shape to break.

| PR | What | Size |
| --- | --- | --- |
| **V4-050** | `Part` gains `artwork: { assetId, renderer }` beside `semanticRole`, `defaultPivot`, `defaultDepth` | M |
| **V4-051** | The face builder and the part presets emit a `Part`, not markup | L |
| **V4-052** | Four test characters — human, robot, mammal, bird — through one engine, no per-kind branch | M |

**Exit:** any standard part swaps SVG ↔ PNG ↔ WebP with nothing else changing.

## Phase 6 — Pseudo-3D parity, and masks (4 PRs)

| PR | What | Size |
| --- | --- | --- |
| **V4-060** | `headYaw` / `headPitch` / `headRoll`, depth, parallax, scale and draw order verified on raster nodes | M |
| **V4-061** | Far-side compression, scale by yaw, dynamic order | M |
| **V4-062** | `MaskNode` and clipping in the model and the canvas | L |
| **V4-063** | The library's parts that need one use it: iris in eye, mouth, hair, muzzle, visor | M |

**Exit:** a rigid raster face reads at least as well through a full turn as
the SVG one does.

## Phase 7 — `mesh-image` (4 PRs)

Only now.

| PR | What | Size |
| --- | --- | --- |
| **V4-070** | `MeshImageNode` in the model: vertices, UV, mask, depth, deformers. 3×3 and 4×4 presets only | M |
| **V4-071** | The `MeshImageRenderer` interface — `loadTexture` / `updateVertices` / `updateUV` / `applyMask` / `render` — with no implementation chosen | S |
| **V4-072** | The first implementation behind it, measured against V4-004 | L |
| **V4-073** | The three cases: bird's lower beak, human cheek and mouth, animal muzzle | M |

**Exit:** all three deform through one mechanism. If they do not, the model is
wrong and Phase 8 does not start.

`core/keyforms/` and `core/warp/` already carry the interpolation maths; what
is missing is textured rendering, which is why V4-071 defers the choice.

## Phase 8 — The mesh editor (3 PRs)

| PR | What | Size |
| --- | --- | --- |
| **V4-080** | Enable deformation on an image node; drag control points; reset | L |
| **V4-081** | Presets, symmetry, mirroring, preview, undo per gesture | M |
| **V4-082** | Mesh bound to drivers, so `mouthOpen` 0 → 1 interpolates between two meshes | M |

## Phases 9–10 — Behavior (parallel branch)

This branch depends only on Phase 0 and can run beside the raster work. The
workspace exists (`app/workspaces/behavior.js`, `animation-editor/behaviors/`,
`animation-editor/state-machine/`) and is improved, never replaced.

| PR | What | Size |
| --- | --- | --- |
| **V4-090** | One vocabulary behind both surfaces: simple and graph edit the same objects | M |
| **V4-091** | The simple surface: `WHEN → IF → DO` | L |
| **V4-092** | The four labels made true in the UI: Design / Rig / Animation / Behavior | S |
| **V4-100** | Nodes carry a saved position. `state-machine/transition-graph.js` computes positions itself today (43 lines, one row, lanes above it) — this replaces that with stored layout | M |
| **V4-101** | Pan, zoom, drag | M |
| **V4-102** | Links drawn and edited on the canvas | L |
| **V4-103** | Live highlight: active state and firing transition | M |
| **V4-104** | Trigger simulation — MIDI, audio, timers | M |
| **V4-105** | Multi-selection, groups, auto-layout | M |
| **V4-106** | Comments | S |

## Phase 11 — Validation and release (2 PRs)

| PR | What | Size |
| --- | --- | --- |
| **V4-110** | Four reference mascots plus one hybrid, through the whole matrix: historic SVG, raster, mixed, replaced asset, shared asset, personal head, `.boop`, autosave, mesh, masks, pseudo-3D, behavior, runtime parity, memory, FPS, corrupt project | L |
| **V4-111** | Release notes, `docs/IMPLEMENTATION_STATUS.md`, `docs/KNOWN_LIMITATIONS.md` | S |

## Dependencies

```text
V4-001 ─ V4-002 ─ V4-003 ─┬─ V4-010 ─ V4-011 ─ V4-012 ─ V4-013 ─ V4-014 ─ V4-015
        (V4-004, V4-005)  │                                          │
                          │                            V4-020 ───────┘
                          │                               │
                          │                            V4-021 ─ V4-022 ─ V4-023 ─ V4-024 ─ V4-025
                          │                               │
                          │                            V4-03x ─ V4-04x ─ V4-05x ─ V4-06x ─ V4-07x ─ V4-08x
                          │
                          └─ V4-09x ─ V4-10x        (parallel, Phase 0 only)

                          V4-11x  ← both branches
```

## What is deliberately not here

- No Pixi, WebGL or renderer migration decided in advance — V4-071 defers it
  behind an interface and V4-072 picks one against measurements.
- No arbitrary URL as an asset source.
- No JPG on the authoring path; import and convert, if at all.
- No hardcoded character kind. Human, robot, mammal and bird are test
  material (V4-052), never branches.
- No `RIG_SCHEMA_VERSION` bump before Phase 7, and only if `mesh-image`
  forces one.
