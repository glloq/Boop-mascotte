# V4 audit — what changed, what it costs, what is still owed

> **HISTORICAL.** This audit describes the editor as it was when it was
> written. The navigation, the panels and several of the surfaces it
> discusses have been rebuilt since. It is kept for the reasoning it
> records, not as a description of the product. For what the editor does
> now, read `docs/CURRENT_STATE.md`.


*A review of the whole V4 programme, written after it shipped and after
re-reading the diff rather than the plan. `docs/V4_ROADMAP.md` is what was
intended; this is what is there.*

## 1. Shape of the change

| | |
| --- | --- |
| Commits | 48 |
| Files touched | 124 |
| Lines | +11 057 / −219 |
| New modules (non-test) | 23 |
| New test files | 41 |
| Unit tests | 2 143 → **2 336**, all passing |
| Browser tests | **194 `@critical`, all passing** against one build |

The ratio is the first thing worth noticing: **219 lines deleted against 11 057
added.** This programme almost never rewrote anything. Where a decision was
wrong it was replaced whole (the 43-line lane renderer, the `localStorage`
recovery path), and everything else was reached by adding a module beside what
was there. That is the right ratio for a programme whose first constraint was
"a project written last year still opens", but it also means the editor now
carries more surface than it did, and §6 says where.

Weight by area: 56 editor modules, 49 unit-test files, 6 runtime modules,
6 documents, 3 browser specs.

## 2. The four load-bearing decisions, re-checked

Each of these was frozen before any code was written. The question here is
whether the code actually keeps them.

### ASSET-REF — artwork never carries binaries

**Holds.** A raster node is `<image href="asset:<hash>">`; bytes live in a
store keyed by that hash and are resolved to an object URL at paint time.

Verified rather than assumed: `v4-matrix.test.js` serializes each of the five
reference mascots and asserts that the asset table's contribution to the
document is under 300 bytes per picture, and that no document anywhere contains
`;base64,`. That claim is scale-free — it is as true of a 4 MB photograph as of
a 700-byte fixture — which the first version of the test was not.

What it buys, each of which would otherwise have been separate work: the
sanitizer's "no external references" rule stays literally true; undo's
`structuredClone` does not copy pixels; the autosave snapshot stays JSON; and
`.boop` is a portable file rather than a folder somebody must not reorganise.

**The one sharp edge.** Markup entering the live DOM must never carry a
fetchable `asset:`, because a browser begins loading an `href` the moment the
markup is *parsed* — not when it is inserted. `deferAssetReferences` is applied
at all four DOM entry points, and `SvgDocument.serialize` had to be split into
`unpaintAssetNodes` (removes the href from nodes) and `restoreAssetReferences`
(renames the attribute in the serialized *string*), because a cloned SVG node is
still live and still fetches. This is genuinely easy to break: a fifth entry
point added later, without a browser test, fails silently in Node and loudly in
Chrome.

### Content addressing — an asset's id *is* its hash

**Holds, and earns its keep.** There is no separate hash field, so nothing can
disagree with anything. Deduplication is automatic and the matrix proves it: the
personal-head mascot imports the same eye file twice and stores it once, with
three nodes pointing at two pictures.

### Minimum-reader versioning

**Holds.** A file declares the oldest reader that can open it without losing
part of it, never what wrote it. The matrix pins all three rungs: paths-only
stays 3 after a save by this editor, assets make it 4, a mesh makes it 5.

The migration ladder declares one step per rung including the empty ones, with
`empty: true` marking rungs the reader already absorbs. That is a small amount
of ceremony for a real benefit — a gap in the ladder is a test failure rather
than a file that silently opens wrong.

### `requires` — decline rather than mis-fire

**Holds, and was extended correctly.** `reaction:condition` joined
`trigger:gaze-follow` and `trigger:idle`. The rule is stated the right way
round: a marker is needed when an older runtime would run the rig *wrong*, not
when it would run less of it. A runtime that ignores a condition does not skip
the reaction — it fires it unconditionally, which is the reaction behaving as
something else.

`rigRequirements` is derived from the rig rather than stored, and the matrix
asserts that what a rig needs and what it *says* it needs are the same list.

## 3. What this audit found and fixed

These are defects found by re-reading the diff after the programme was
"finished", not by the tests that were written alongside it.

1. **`context()` was called on every trigger, for every rig.** The condition
   dispatcher read the situation before filtering, so a mascot with no
   conditions still paid for them — and in the engine `context()` is
   `paramsAt(now())`, which *commits a finished transition on its way past*. A
   side effect in what reads as a getter, on every click, for a feature the rig
   does not use. Now the situation is read lazily, once per trigger, and only
   when a candidate actually carries conditions. Pinned by a test that counts
   the calls.
2. **The live graph highlight touched the DOM on every preview frame**, from
   every workspace, whether or not anybody was looking at the diagram. It now
   compares against what it last wrote and does nothing when neither answer has
   changed — which is almost always, because a state lasts as long as the author
   leaves it.
3. **Pressing a node re-rendered the whole panel** before every drag, including
   when the selection had not changed. Skipped when the set is identical.
4. **`MESH_PRESERVE_ASPECT_RATIO` documented a decision the code did not use.**
   The constant existed with a paragraph explaining why it matters, and the
   value was hardcoded in the template literal six lines above it — exactly the
   drift a named constant is supposed to prevent. The template uses it now.
5. **`BOOP_EXTENSION` likewise**: `project-service.js` wrote `'mascot.boop'`
   literally.
6. **`ASSET_IMPORT_MAX_BYTES` was enforced and never tested.** It is the *first*
   check in `validateAssetBytes`, so it is what stops 33 MB of something being
   parsed to discover it was not wanted; now covered.
7. **The export baseline had drifted without being re-read.**
   `ux23-legacy-removal.spec.js` pins the Basic Face's exported `rig.json`
   against a fixture, with a comment block recording every legitimate change
   since. Two additive blocks had arrived without being written into it —
   `meshes` at the top level and an empty `conditions` on every reaction — so
   the baseline was regenerated, after proving mechanically that the reactions
   gained exactly one key and lost nothing, and that `mascot.svg` is still byte
   for byte what it was. A pinned baseline whose deviations are not recorded is
   a pinned baseline nobody believes.

## 4. What was checked and found sound

- **Object URL lifetime.** `refreshAssets` primes, paints and then calls
  `retain(references)`, so a picture the artwork no longer points at has its URL
  revoked. The runtime deliberately does not: its asset set is fixed at load, so
  there is nothing to release.
- **Undo granularity.** One gesture, one step, everywhere new: a node drag
  writes once on release rather than per pointer move; a mesh drag does the
  same; a condition row edit is one step; auto-arrange is one step over the
  whole diagram.
- **Preflight before history.** Every new command family (`graph-commands`,
  the condition path through `reaction-commands`) runs its work against a clone
  first, so a refusal never leaves a history entry behind.
- **Unused imports.** None in any module this programme added.
- **Unreachable code.** None: every exported constant that nothing imports is
  used inside its own file (§6 has the note about the export keyword itself).
- **Sanitizer surface.** `isInternalReference` accepts `#`-fragments and
  `parseAssetRef(value)`, and nothing else. `parseAssetRef` is strict
  (`/^[0-9a-f]{8,64}$/`), so `asset:` cannot carry a path, a query or a second
  scheme. The matrix re-asserts that external `href`, `javascript:` and
  `<script>` are still removed, and that `findUnsafeSvg` — the same rules listed
  rather than applied — reports nothing about a reference the cleaner keeps.
- **Editor/runtime parity.** The matrix compiles every reference mascot's frame
  twice, once from the editor state and once from the exported rig, in two poses,
  and compares every element's transform.

## 5. Where the tests actually are

Every module this programme added is reached by at least one test file; most by
several. The distribution is worth reading as a risk map:

| Reached by | Modules |
| --- | --- |
| 6+ test files | `asset-reference`, `asset-store`, `asset-manager` |
| 3–4 | `asset-model`, `project-version`, `asset-paint`, `asset-resolver`, `boop-package`, `zip`, `graph-view`, `reaction-conditions` |
| 1–2 | `asset-optimise`, `asset-placement`, `mesh-handles`, `graph-commands`, `project-migrations`, `recovery-storage`, `path-only`, `picture-drop` |

The thin column is where a regression would be found late. Two of them are worth
naming: `recovery-storage` (the IndexedDB write-through cache behind autosave —
its failure path is a silent fallback, which is the correct behaviour and the
hardest kind to notice breaking) and `asset-optimise` (the resize path, which
only runs in a browser with a real codec).

**The lesson this programme learned the hard way is in `raster-import.spec.js`.**
Every piece of the first import was proved by unit tests and the feature was
still completely broken end to end, twice: the store was handed raw bytes where
`createObjectURL` takes a `Blob`, and `asset:` was reaching the live document
where a browser tries to fetch it. Neither is visible without a browser. The bug
survived six commits because *every test wrote `new Blob([...])` into the store
by hand while the code wrote raw bytes* — the fixtures were more correct than
the code they were testing. Anything that touches the paint path needs a browser
test, and a fixture that is more careful than the code is a warning.

## 6. Debt, honestly

- **Seventeen exported constants that nothing imports.** Each is used inside its
  own file, so none is dead code, but the `export` keyword on
  `ASSET_DB_NAME`, `RECOVERY_DB_VERSION`, `STORED`, `DEFLATED`, `GRAPH_GRID`,
  `GRAPH_GAP`, `CONDITION_KINDS` and the rest buys nothing today. They read as
  API. Two of them turned out to be genuinely stale and are fixed above; the
  rest are a small tidy nobody should do in the same change as anything else.
- **The state graph is in the wrong column.** It is drawn in the ~260 px left
  sidebar, where a four-state machine fits at 47 %. The geometry was shrunk to
  make that bearable and link labels are counter-scaled so they stay readable,
  but the honest answer is that a graph wants the canvas. That is a shell
  change.
- **A layout remembers deleted states forever.** `normalizeGraphLayout` keeps a
  position whose state no longer exists, deliberately — deleting a state is
  undoable, and a layout that forgot would put the node back in the corner on
  redo. Nothing ever prunes them, so a long-lived project accumulates dead
  entries. They are ~30 bytes each and invisible; it is still growth with no
  ceiling.
- **A note's uncommitted text does not survive a re-render.** A graph comment
  writes on `change` (blur), not on `input`, so text typed but not yet committed
  is lost if something else re-renders the panel in the meantime. Nothing does
  today. It is a trap for the next person who adds a render trigger.
- **V4-104 is not built.** MIDI, audio and timer trigger simulation would have
  been a panel for inputs the runtime does not have — the exact mistake
  `requires` exists to prevent. Recorded as a cut rather than as done.
- **JPEG is refused**, on purpose (a mascot piece needs alpha). This will be
  read as a bug by anybody who has a JPEG, and the refusal message is the only
  place that explains it.
- **`pw-local.config.js` is a local override**, already gitignored by the repo
  before this programme, that points Playwright at the installed Chromium. It is
  how the browser suite runs here. It is not in the repo, so a fresh checkout
  runs the browser suite only where the pinned browser is installed.

## 7. Verdict

The programme did what it set out to do: a mascot can be built, rigged,
animated and exported from personal pictures, and every project written before
it still opens. The four frozen decisions all held under implementation, which
is unusual and is mostly down to their being frozen *as constraints on the data*
rather than as designs for screens.

The two places it is weakest are both places where UI was fitted into a room
that was already the wrong size: the state graph in a sidebar column, and — the
subject of `docs/V4_UI_RESEARCH.md` — the path a person takes from three PNGs to
a moving mascot, which now exists end to end but is still assembled out of
controls designed for somebody who arrived with an SVG.
