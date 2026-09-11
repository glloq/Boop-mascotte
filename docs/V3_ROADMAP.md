# V3 — the mascot you dress, and the mascot that moves

V2 delivered the parts: a library of faces, a rig that turns in 2.5D, a
timeline, reactions, hands. V3 is about the two things that survey after
survey shows are still missing from it — **everything on the head moving as
one head**, and **an author finding the control they want without being told
where it is**.

It is not a rewrite. Every item below is a seam that already exists being
opened, or a default being changed; the one genuinely new vocabulary is a
trigger type, and it is the one place this program touches the runtime
schema.

## Sequencing rules

Recalculated from a six-way survey of the live code, not from the V2 plan.

1. **Vocabulary before content.** A restyle of six presets behind a style
   axis is one PR; a restyle in front of it is forty-two assets and a parts
   column nobody can read. Same for the turn: the profile moves off the role
   table *before* anything new joins the turn.
2. **Test seams before UI removals.** Forty-four e2e specs reach a project by
   clicking a card on Home. Home cannot narrow until they stop.
3. **No new special case keyed by an id.** The survey found the current code
   has *none* — not one switch on a preset or asset id anywhere outside the
   data tables. V3 keeps that record; a feature that needs a per-id branch is
   a feature whose vocabulary is wrong.
4. **The 80–90 % test still applies** (`docs/FUTURE_OUT_OF_SCOPE.md`). No
   renderer, no skinning, no physics. Where this program adds a dimension it
   adds it as authored data, not as a solver.
5. **Additive-by-default, schema bump where it cannot be.** `docs/VNEXT_ROADMAP.md`
   (VNX-39) records that a new reaction trigger is *not* safely additive: an
   older runtime ignoring an unknown trigger mis-fires rather than declines.
   V3-09 carries a version bump and a `requires` marker; nothing else here
   touches the runtime contract.

**Cross-cutting invariant, unchanged from V2:** no UI preference in
`ProjectDocument`; authored mutations go through domain-scoped commands and
one history transaction; preview is session-only; the exported runtime stays
UI-independent.

## Final sequence

```text
V3-01 turn profiles on the asset                        (done)
  → V3-02 every head part in the turn                   (done)
  → V3-03 host-anchored accessories, the earring on the ear (done)
V3-04 per-accessory addressing in presets               (done)
  → V3-05 a style axis
    → V3-06 the restyle
V3-07 the test seam: a project without Home             (done)
  → V3-08 Home narrowed to presets and the default mascot (done)
V3-09 what runs when: idle and gaze-follow, schema bump (done)
  → V3-10 one "what runs when" surface                  (done)
V3-11 hands: somewhere to try them                      (done)
V3-12 the eyes carry the head                           (done)
V3-13 the timeline: play, pause, a frame at a time, posing (done)
V3-14 controls that do not collide, and read as what they move (done)
  → V3-15 the UX audit, against all of the above        (done)
```

Four chains, and they touch different files. V3-01→03 is the face library and
the head pose; V3-04→06 is presets; V3-07→08 is the shell and the test
helpers; V3-09→10, V3-13 and V3-14 are the animation and control surfaces.
V3-12 is three files. They can run in parallel.

## PR specifications

### V3-01 — Turn profiles on the asset, not the role table

- **Goal:** decide participation in the 2.5D turn from a profile the asset
  declares, with the current role table as the default, so a part joins the
  turn by describing itself rather than by being added to a frozen list.
- **Evidence:** `HEAD_TURN_LAYERS` (`core/head-pose/head-pose-turn.js:34`) is a
  frozen object of 21 keys, keyed by **role name**, and
  `headTurnElements:265-298` skips any role absent from it. All five
  accessories share the single role `element` (`part-registry.js:67`), so a
  hat and a pair of glasses cannot be given different depths through that
  table at all. This is the structural blocker behind three separate asks.
- **Dependencies:** none.
- **Likely files:** `core/head-pose/head-pose-turn.js` (`HEAD_TURN_LAYERS`,
  `headTurnElements`), `core/face-library/face-part-model.js` (asset schema,
  beside `depth` at `:156`), `core/face-library/face-part-validation.js`.
- **Schema/runtime:** the runtime is untouched — it evaluates keyforms and has
  no head-pose code at all. But this is *not* asset-level only: the resolved
  profiles are recorded on the document as `part.assetTurn`, because
  `headTurnElements` is a pure function of the document and never sees the
  library. Having the generator look an asset up by `part.assetId` instead
  would make a project's turn depend on which packs happen to be registered
  this session.
- **`face-part-install.js` is in scope**, and the slice is inert without it: an
  asset field nothing records is dead data.
- **Unit tests:** a profile on the asset wins over the role default; a role
  with neither is still skipped; the 21 existing roles resolve identically.
- **DoD:** `head-pose-turn.test.js:55` still passes unchanged — hands and jaw
  stay out — and no generated keyform set changes for any existing asset.
- **Risks:** the generator writes 7 channels per element; a profile that
  changes a sample changes a visual baseline. Assert byte-identical keyforms
  for the built-in library before allowing any new participant.

### V3-02 — Every part on the head is carried by the turn — **done**

- **Goal:** facial hair and accessories turn with the head instead of sliding
  rigidly with the face group.
- **Evidence:** neither `facialHair` nor `element` is in `HEAD_TURN_LAYERS`.
  Facial hair additionally declares no `depth` (`builtin/facial-hair.js`, zero
  occurrences), so a moustache today gets *nothing* — not the turn, not
  parallax, only the head group's own rigid transform. Glasses and hats get
  parallax only (0.6 / 0.8, `builtin/accessories.js:25,28,31`); the earring
  and the bow tie get neither.
- **Note on the two mechanisms:** they are mutually exclusive *by design*
  (`runtime.js:500-508`) — parallax drift uses the authored depth only,
  because a generated turn already rotated the element properly. A part joins
  one or the other, never both. This PR moves facial hair and accessories
  into the turn and drops their parallax depth in the same step.
- **Dependencies:** V3-01.
- **A decision V3-01 left here on purpose.** `identifyFaceParts` — the
  migration that recognises which asset an old project's part was drawn from —
  deliberately does not write turn profiles, so an existing project keeps the
  role table's answers. Giving the accessories real profiles is therefore the
  switch that decides whether an old project's hat starts turning when it is
  next opened. Make that call explicitly and write it down; do not let it
  happen as a side effect.
- **Likely files:** `builtin/facial-hair.js`, `builtin/accessories.js`,
  `core/head-pose/head-pose-turn.js` (pivots, `headTurnPivots:571`),
  `core/followers/follower-model.js` if a moustache should trail.
- **Unit tests:** every built-in asset, installed on the template, produces
  keyforms for its root; the animation matrix still drives every claimed
  movement.
- **DoD:** a turned head carries hat, glasses, moustache and earring with it;
  `face-part-animation-matrix.test.js` green; `@visual` baselines refreshed.
- **The migration call, made.** Recovering the profile on open
  (`face-part-migration.js`) rather than leaving an old project flat: the part
  *is* that asset, proven by the shape signature the migration already matches
  on, so its turn profile is recovered fact, not a guess. The grid is **not**
  regenerated — a captured cell is the author's, and rebuilding the turn to
  pick the profiles up is a press they make. So an existing project gets the
  right answer recorded on open and the right turn the next time its grid is
  generated.
- **Risks:** `poseCandidates()` (`rig-editor/head-pose/head-pose-panel.js:198`)
  offers only elements *already in the grid* once a turn exists, so a part
  that joins late is invisible to Capture until the grid is regenerated. The
  install path only regenerates when the project already had a turn
  (`face-part-install.js:245,351`). Both need a pass.

### V3-03 — An accessory belongs to a part: the earring on the ear — **done**

- **Goal:** an accessory declares a host part and role; the install parents
  its artwork into the host's group, so it inherits the host's every
  movement — `earWiggle`, the turn, a follower's lag — with no new mechanism.
- **Evidence:** `EARRING` is `mountPoint: 'ear.left'` with a hardcoded box
  `{x:21, y:138, w:12, h:12}` in template coordinates
  (`builtin/accessories.js:34`). A mount point is an *anchor resolved once at
  fit time* (`face-layout.js:268-281`), not a parent; the earring is then a
  plain sibling in the head group. Choose different ears and it floats.
- **Why parenting rather than a constraint:** the runtime writes a `transform`
  per node (`runtime.js:1135`), so SVG nesting composes for free — no solver,
  no per-frame cost, no new document array. `rigConstraints` type `parent`
  (`rig-constraints.js:37`) stays the fallback for a host that cannot be a
  group.
- **Prerequisite:** library ears draw a bare `<circle>`/`<ellipse>` per side
  (`builtin/ears.js:20-26`), so there is nothing to parent into. The ear
  assets grow a `<g>` per side first; the template's ear already is one.
- **Dependencies:** V3-01 (so the earring's turn comes from its host).
- **Likely files:** `face-part-model.js:158` (a `host` beside `mountPoint`),
  `face-part-validation.js:111`, `face-part-install.js` — the slot key at
  `:119-121`/`:368` becomes `(mountPoint, hostPartId)` so two earrings on two
  ears coexist; the insertion parent at `:163`; the re-home pass at
  `:269-298` gains a re-link when the host is replaced. `builtin/ears.js`,
  `builtin/accessories.js`, `svg-canvas.js:3415`.
- **Schema/runtime:** asset + document (a host reference on the part record);
  runtime unchanged.
- **Unit tests:** replacing the ears re-links the earring rather than severing
  it — note `scrubRemovedArtwork:211-215` already garbage-collects constraints
  by source *or* target, which is exactly why a silent severing is the current
  failure mode; a right earring and a left earring are two slots.
- **DoD:** swap ears three times, the earring stays on the ear each time and
  wiggles with it.
- **Risks:** `ear.left`/`ear.right` anchors resolve only when *both* ears
  measure (`face-layout.js:154,166`) — a one-ear face needs a fallback.
- **As built.** Three things the slice text did not have. The slot key is
  `(mountPoint, host)` rather than `(mountPoint, hostPartId)`: both earrings
  hang on the one `ears` part, so the part id alone is the same key for the two
  of them, and it is the *role* that tells one ear from the other. Nesting
  changes two measurements, and both had to be answered here or the feature
  would drift a face down the page: the layout has to be read in the host
  group's own space — the face's boxes carried *down* into it, `boxInMountSpace`
  — or the host's own fit scale is counted twice, and a role's box has to leave
  out what hangs on it, or the ear measures half an earring taller at every
  replacement. And a re-homed accessory has to be fitted again to the ear it
  has just been hung on, since its old numbers were in the old ear's frame;
  `applyFacePartReplacement` takes a `fitHosted` from the command, because the
  library is the builder's and never the document's.

### V3-04 — A preset can place one accessory of several

- **Goal:** make per-accessory adaptation possible at all.
- **Not tint.** A preset's `palette` is face-wide by construction — `retint` is
  defined as one token everywhere it is used — so tinting one accessory of two
  needs a per-instance colour field, and round-tripping it through
  *Save as a preset* would make every saved preset carry an override for any
  paint that is not exactly a token colour. An accessory's *look* comes from
  choosing a restyled variant under V3-05 and V3-06, which is where the style
  axis belongs. Addressing is this slice; looks are that chain.
- **Evidence:** two live defects, both confirmed by reading.
  `planFacePreset` gates placements on `item.parts[category]`
  (`face-presets.js:238`), but accessories live in `item.accessories` — so a
  preset that positions its glasses has that data **validated and then
  silently discarded**. And `place()` resolves a category to the *first*
  matching part (`face-part-commands.js:83`), so with a hat and glasses both
  on the face it cannot address either.
- **Dependencies:** none. This is the cheapest win in the program.
- **Likely files:** `face-presets.js` (`:238` plan, `:48-77` normalize,
  `:88-117` validate, `:180-204` save), `face-part-commands.js:80-98`
  (`place` by part instance), `:61-65` (dispatch).
- **Unit tests:** a preset naming a placement for one of two accessories moves
  that one; round-tripping through *Save as a preset* keeps it.
- **DoD:** no preset field is accepted and then dropped.

### V3-05 — A style axis, so variants are not a combinatorial library

- **Goal:** let a preset use its own restyled head without that head becoming
  a card every author sees in the parts column.
- **Evidence:** a preset names an asset *id*; style lives only inside that
  asset's SVG string. Assets have no `tags`, `hidden` or `styleFamily`
  (`face-part-model.js:137-163`) and the builder lists a category unfiltered
  (`character-builder.js:109-111`). Six presets × eight categories of variants
  is a library nobody can browse.
- **Dependencies:** V3-04.
- **Likely files:** `face-part-model.js`, `face-part-validation.js`,
  `face-part-registry.js`, `ui/character-builder/character-builder.js:109-111`,
  `ui/character-builder/part-browser.js`.
- **DoD:** a variant is reachable from its preset and from *Restore library
  drawing*, and does not appear as a loose card.
- **Risks:** `presetOfFace` (`face-presets.js:161-171`) identifies a worn
  preset by exact set match, first match wins. More near-identical presets
  means more aliasing — decide explicitly whether style participates in
  identity, and pin it with a test.

### V3-06 — The restyle

- **Goal:** the six presets get their intended looks.
- **Dependencies:** V3-05 (and V3-02 if a restyled part changes its silhouette
  enough to need a new turn profile).
- **Scope:** 42 assets in 13 files, 466 lines of inline SVG, with hex
  constants duplicated from the `warm` palette in every file. Each rewritten
  asset must keep its `referenceBox` truthful, its role and composite-part ids
  present, its `paletteRoles` ids present, its `behind` ids direct children of
  the root, and its drivers — including `posePath` shape keys — geometrically
  coherent. `face-part-validation.js:47-118` enforces the first four;
  `face-part-animation-matrix.test.js` installs every asset and drives every
  claimed movement through the real frame compiler, which catches the fifth.
- **DoD:** thumbnails regenerate from the same artwork (`face-presets.js:261-298`),
  so no picture files are added; `@visual` refreshed.

### V3-07 — The test seam: opening a project without Home — **done**

- **Goal:** give the e2e suite a way into a project that is not a Home card.
- **Evidence:** **44 spec files** reach a project through `startBasicFace`,
  which clicks `[data-home] [data-template-id="basic"]`; 13 use
  `#home-svg-file`; 5 start from Blank canvas; 5 drive the Face Builder.
  `ux23-legacy-removal.spec.js:11-24` asserts Home's entry-point *count*.
  Narrowing Home before this lands breaks most of the suite at once.
- **Dependencies:** none.
- **Files:** `app/e2e-hooks.js` (`openProject`), `tests/e2e/editor-helpers.js`
  (`enterProject` and the four starts over it), `tests/e2e/product-journey-helpers.js`.
  The helpers are in `tests/e2e/`, not a `helpers/` folder.
- **What shipped:** the seam gained `openProject.{template,face,svg,snapshot}`,
  the four calls Home's own controls make on `projectService`. Every spec that
  only *needed* a project now asks for one; the specs that are about Home
  (`ux03-home`, `ux23-legacy-removal`, the New Character card in
  `ux45-character-builder`) still press Home, and `pages.spec.js` keeps one
  Home-driven start because the deployed editor carries no seam.
- **DoD:** every spec reaches its starting document through a helper that does
  not depend on Home's markup; the suite is green with Home untouched.

### V3-08 — Home is presets, or the mascot as it comes — **done**

- **Goal:** Home offers building from a preset, or the default mascot.
  Everything else moves to where the work happens.
- **Dependencies:** V3-07.
- **What must survive** (each one verified): `closeHome`'s project gate — it
  refuses to close with no project loaded (`app-shell.js:84`) and is what
  stops interaction with an empty editor; the focus contract of
  `showHome({focus:'new'})`; Home's position in the Escape order
  (`editor-app.js:842`); the `.home-recovery` container, or a rewritten
  `setRecoveryState` — `mustQuery` **throws at shell construction** if it is
  absent, and the editor never boots; and a surface for each of
  `loadTemplate`, `loadSvgFile`, `loadProjectFile` and `generateFace`. Import
  SVG and Open Project already have duplicates in the ••• menu; the Face
  Builder has no other home and would become dead code with a passing unit
  test.
- **Files:** `ui/home-surface.js`, `ui/sidebar-sections.js`
  (`buildStartArtworkSection`, the new home of Blank canvas and the Face
  Builder), `ui/app-shell.js` (the markup and the binding block that
  `mustQuery`s each element), `index.html` (the styles), `docs/UX03_HOME_PROJECT_ENTRY.md`.
  `app/editor-app.js` needed no change: Home's position in the Escape order and
  the project gate are untouched.
- **What shipped:** Home is New Character, Mascot Face, Continue, and one line
  saying where the rest went. Open Project and Import SVG are the ••• menu's,
  which sits above Home (`z-index` 90 against 80) and is therefore usable on a
  first run; Blank canvas and the Face Builder joined *Start over with the
  Mascot Face* under Artwork → Add / Create artwork. That group had
  `.has-project .create-tools .template-cards{display:none}` on it, which meant
  it was only ever on screen behind Home; the rule is gone.
- **Risks:** the highest-coupling PR in the program. Do not start it before
  V3-07 is merged and green.

### V3-09 — What runs when: an idle trigger and a gaze-follow trigger

- **Goal:** say "with no interaction" and "following the eyes" in the
  vocabulary, instead of faking them.
- **Evidence:** `REACTION_TRIGGERS = ['click','hover','timer','custom']`
  (`runtime.js:819`). There is no `idle` — "with no interaction" is currently a
  periodic `timer`, which fires on a clock rather than on idleness, and no
  inactivity clock exists anywhere. There is no `gaze-follow`: the gaze solver
  is a rig feature over `gazeX`/`gazeY`, and **nothing drives it from the
  pointer** — `bindEvents` (`runtime.js:1180`) binds `click` and
  `pointerenter` only. `hover` has no exit event, so it fires once instead of
  holding.
- **Dependencies:** none, but it is the one schema change in the program.
- **Schema/runtime:** **a version bump.** VNX-39 records that an older runtime
  ignoring an unknown trigger mis-fires rather than declining; ship a
  `requires` marker with the new types.
- **Likely files:** `runtime.js:819,829,1180`, `core/reactions/reaction-model.js`,
  `core/reactions/reaction-presets.js`, `ui/reaction-studio.js:314`.
- **DoD:** a mascot that follows the pointer with its eyes, and one that acts
  only when left alone, are each three clicks and no page code.
- **Done.** `REACTION_TRIGGERS` is `['click','hover','gaze-follow','idle',
  'timer','custom']`. `idle` takes `after` seconds and is measured against one
  inactivity clock (`notifyActivity`), which `bindEvents` resets on every event
  the mascot sees; a `timer` is left alone, because a metronome does not care
  that you were there. `hover` and `gaze-follow` **hold** — `release(type)` runs
  the release ramp — and `bindEvents` binds `pointerleave` for the first time.
  The pointer drives `gazeX`/`gazeY` through a document-level `pointermove`,
  bound only when a `gaze-follow` reaction is enabled, so no existing mascot
  starts staring at the cursor. **Schema 5 shipped**: a `requires` list on the
  rig (`trigger:idle`, `trigger:gaze-follow`), `unsupportedRequirements()` and a
  `load()` that declines by name — and, the part that actually stops the
  mis-fire, `normalizeReaction` no longer turns an unknown trigger into a
  `click`: it becomes `unsupported`, which nothing fires. `docs/RIG_MODEL.md`
  § Schema version 5 and `docs/UX13_REACTIONS.md`.

### V3-10 — One place that says what runs when

- **Goal:** a single surface for choosing what the mascot does by itself, on
  hover, and when followed — instead of two panels that share only a comment.
- **Evidence:** reactions (`ui/reaction-studio.js`, document array `reactions`,
  command domain `reactions`) and automatic behaviours
  (`ui/automatic-panel.js`, array `behaviors`, domain `stateMachine`) are
  separate surfaces with separate vocabularies. The preset catalogue already
  buckets by *when* — `['When clicked','On hover','By itself','From your page']`
  (`reaction-presets.js:13`) — but it is add-only: there is no way to re-bucket
  an existing reaction. A motion clip cannot be selected to run at all; it must
  be wrapped in a `timer` reaction or placed in an arrangement, which is
  editor-only and never exported.
- **Dependencies:** V3-09.
- **Also fix here:** ~~`drift` is absent from the advanced behaviours catalogue
  and its command allow-list~~ — **already done** before this slice started, by
  "Drift can be added, and three docs describe the code as it is": the catalogue
  carries `drift` and `behavior-commands.js` derives its allow-list from the
  catalogue instead of keeping a second list by hand. And
  `docs/UX15_AUTOMATIC.md` still said "Animate → Automatic"; the panel moved to
  Reactions in VNX-09, and the doc now says so.
- **Done.** `core/reactions/runs-when.js` is the one answer to "when does this
  run?": `RUNS_WHEN` (click → hover → gaze → idle → page), `runsWhenOf`,
  `triggerForRunsWhen`, `motionsNotRunning` and `deriveRunsWhen`. The reaction
  list is drawn by bucket — every bucket, including the empty ones — and each
  row carries the `<select>` that moves it, so re-bucketing an existing reaction
  is one `reactions` command and one history step. A motion nothing runs is
  listed with a when beside it and one **Run it** button. `REACTION_PRESET_GROUPS`
  and the Preview bench's reaction groups are derived from the same table rather
  than kept by hand, which is what let three lists disagree about what a *when*
  was. The Automatic panel keeps its `stateMachine` commands and its own host —
  merging the two arrays would be a second schema change — and takes its heading
  and its per-card *when* from the same table, with the "By itself" bucket above
  naming the behaviours that run there.
- **The two dead presets are gone.** Breathing and Tiny body bounce were an
  `oscillator` on `bodyBounce`, a parameter *nothing in the editor defines*: no
  `BASIC_MOVEMENTS` entry, no semantic part owning a body, no template creating
  it. Both read *unavailable* to every project that has ever existed, and their
  Face Setup button led to a checklist with nothing on it. Retargeting was not
  available either — `matchBehavior` identifies a preset by type + parameter, so
  a second `oscillator` on `headY` would be the same behaviour as Idle head
  movement. What they wait for is a **body part**, which is Face Setup work and
  not an idle preset; `docs/BEHAVIORS.md` keeps the recipe, and a unit test now
  refuses any preset that asks for a movement the editor cannot make.

### V3-11 — Hands: somewhere to try them — **done**

- **Goal:** close the loop the hand panel already promises.
- **Evidence:** `handSetupSteps` ends with "Ready. Test it from Preview"
  (`hand-setup-panel.js:34`) — and Preview offers **nothing at all** for a
  hand. Not "raw range sliders for `handLX`, `handLRotation`, `handLDepth`",
  as this entry said: that panel's sliders come from `deriveMovementChecklist`,
  which walks `BASIC_MOVEMENTS` — twenty-three face movements with no hand
  among them — and `leftHand` / `rightHand` declare `controls: []`
  (`part-registry.js:71`). No hand parameter could reach it. Its two pads are
  look and head only. Worse, the "held to the face" holds are offered only to a
  hand with *no* drawings (`hand-handles.js:158`), so the modern, recommended
  hand loses that capability on the canvas; and styles are unreachable for a
  single-shape hand (`editor-app.js:400`).
- **Dependencies:** none.
- **A measured defect to settle here — found.** A drawn hand never came to
  rest. With the mascot idle and nothing touching it, `#handRight`'s client rect
  drifted ~0.5–0.8 px every 400 ms and kept drifting: polling its raw y for 20 s
  never produced five consecutive reads agreeing to 0.01 px, and its transform
  still carried `translate(0 -0.31…)` throughout. "Idle hands" does put an
  oscillator on `handRY` at 0.31 Hz (`core/behaviors/automatic-presets.js:35`),
  and pinning `handRY` and `handRRotation` did **not** stop it.

  **Nothing in the hand's carry integrates**, which is what this entry guessed
  at and what cost the hunt a day. `handOffset`, the soft reach limit and
  `anchorDrift` are pure functions of the frame they are given, and a hand whose
  parameters are held is exactly still: driven through the editor preview with
  jittery frame times for sixty simulated seconds, the compiled transform of
  `handRight` does not move by one bit, and left alone it is *exactly periodic*
  — identical to fourteen significant digits one oscillator period apart, which
  is an oscillation and not a drift.

  The cause is one line in the exported engine: `tick` composed the
  **behaviours after the live override layer** (`runtime.js:1114`), so a
  behaviour won the parameter it drives and no page could hold anything still —
  `mascot.setParameter('handRY', 0)` was answered by `getParams()` and then
  overwritten on the way to the artwork. `docs/PARAMETER_MIXER.md` declares
  `override` last and the editor preview always ran it that way, which is why
  pinning appeared to work in one place and not the other. Fixed, with the
  headline test driving the engine the way a page does and reading the
  transform attribute the browser measurement read.

  The **second door** is not a defect: a hand's anchor follows whatever it hangs
  from, so a mascot with Idle head movement on carries its hands with its head.
  Hold `headY` and the hands hold still with it.
- **Its cost:** any browser assertion about a hand's position was racy.
  `ux32-hands.spec.js` ("the two hands are chosen, placed and turned
  independently") read the right hand's box once, 200 ms after moving the left,
  and called it unchanged; it passed only because a single *rounded* read
  usually landed before the drift crossed a pixel. It now pins the hands that
  are not under test and asserts the box over four reads a frame apart, which
  is what a hand that actually rests can carry.
- **DoD:** the panel's last step is a control, not a sentence pointing
  elsewhere. `docs/DIRECT_CONTROLS.md` is corrected in the same PR — though
  **not** for the reason this entry gave: it has not documented fingers, grip or
  facing for some time, and already said the console has none of them. What was
  wrong in it was the holds paragraph (it described the gate this slice removes,
  and pointed at V3-11 to settle it) and the section asserting a hand has no
  poses at all, which conflated *where a hand goes* with *what it looks like*.

### V3-12 — The eyes carry the head — **done**

- **Goal:** moving the eyes turns the head, by default, with the head angle
  still independently authorable.
- **Evidence — the good news:** the decomposition already exists and is
  correct. `solveGaze` (`runtime/gaze-solver.js`) is merged by `applyControlRig`
  (`runtime/effective-params.js:110-128`), which **adds** the solved eye part
  to `lookX/lookY` and the head part to `headX/headY`. Manual head control
  survives by construction — exactly the independence asked for. The handle
  generation already swaps the gaze handle's parameters when the solver is on
  (`puppet-handles.js:276`).
- **What is actually missing:** it is off by default (`gaze-solver.js:62`,
  `store.js:28` seeds `gazeSolver: null`) and nothing turns it on. The only
  switch is a checkbox in Face Setup → Gaze (`gaze-panel.js:63`).
- **Dependencies:** none.
- **Likely files:** `core/rig/gaze-rig.js:45` (`enableGazeSolver` must create
  `gazeX`/`gazeY` and seed every state), `core/state/store.js:28`,
  `ui/preview-panel.js:12-15,195` (the look and head pads give no sign that
  one drives the other, and `syncPads` may not track a solver-fed head).
- **The call, made: new mascots only.** The template ships the solver on, so
  every mascot made from here looks with its whole head. An existing project is
  left exactly as it is — turning a solver on inside a document an author has
  already tuned would change how their saved mascot moves, and the gaze
  parameters do not exist there to key. `enableGazeSolver` creates them at rest
  and seeds every state at rest, so the shipped mascot is unchanged until the
  target moves.
- **Measured on the template**: a gaze of 0.1 moves the eyes and leaves the
  head alone (the dead zone); a gaze of 1 gives eyes 1.0 and head 0.63; the
  same gaze with `headX = -0.5` authored by hand gives head 0.13, which is the
  solved angle *plus* the author's — never instead of it.
- **Risks:** this is a **migration**, not a default flip. Every existing
  project would gain head motion from a parameter it does not have;
  `gazeSolverModel.missing` (`gaze-rig.js:103`) warns when `headX`/`lookX` are
  absent but nothing auto-enables them, so a default-on solver would silently
  do nothing on many projects. `ux26-direct-controls.spec.js` deliberately
  pins the opposite. Decide new-projects-only versus migrate-on-open, and
  write it down.

### V3-13 — Play, pause, a frame at a time — and posing on the canvas (done)

- **Goal:** the transport is play/pause and frame stepping; a pose is made by
  moving the mascot where you want it, on the work surface, at the playhead.
- **Evidence:** the transport is a single template literal
  (`timeline-panel.js:176`) with six handler lines (`:59-65`), so simplifying
  it is local. Play, pause, stop, frame step, key-to-key, Space, Home/End and
  scrub all already exist; **no speed control exists anywhere** and `fps` is
  hard-coded 30 (`timeline-state.js:1`).
- **The posing half is already built and switched off.** Every live posing
  surface ends a gesture with one `onCommit`, which reaches
  `timeline.autoKeyMany(values)` — canvas puppet handles included
  (`editor-app.js:614`). But `PUPPET_TASKS = new Set(['rig','expressions','preview'])`
  (`editor-app.js:586`) omits `animate`, so **the handles are switched off in
  the one workspace the timeline lives in.** You cannot drag the mascot while
  looking at the timeline. This is one Set.
- **Two hazards:** posing is gated on Auto Key — `autoKeyMany` returns false
  with it off (`timeline-panel.js:210`) and the pose is discarded — so this
  needs either Auto Key on or an explicit "capture this pose" that bypasses
  the flag. And removing Stop must keep the `preview.stopClip()` call
  somewhere: it is the only thing that clears the motion layer and the
  arrangement from the timeline's side (`preview-controller.js:205`).
- **Also fix here:** Space is a dead key whenever a motion is playing through
  the motion layer. `togglePlayback` asks `preview.isPlaying()`, which is
  `anyPlaying` (clip *or* arrangement *or* motion), then calls `pauseClip()`,
  which no-ops (`timeline-panel.js:219`, `preview-controller.js:85`).
- **Do not conflate:** rig *calibration* pose capture (`rig-panel.js:35`)
  writes to `semanticParts[].calibration`, not to clip keyframes.
- **Built.** The toggle asks the controller *which* transport is running
  (`isClipPlaying` / `isMotionPlaying`) rather than reading a total. An
  arrangement and a layered motion are schedules and not a playhead, so those
  two stop where a clip pauses. The Pause **button** carried the same bug as
  Space and is fixed with it.
- **Auto Key stays the switch; the gesture speaks.** Of the hazard's two
  answers, neither is right on its own: keying through a flag the author turned
  off is a flag that lies. `autoKeyMany` reports *why* it kept nothing
  (`auto-key-off`, `no-clip`, `nothing-moved`) and Animate says so when a drag
  finishes. Preview and Face Setup stay quiet — there the same drag is trying
  the mascot on, not authoring it — so the message is the caller's to raise.
  `POSING_WORKSPACES` now names the four tasks, beside the handles it governs.
- **Stop's one job moved rather than died.** `preview.stopClip()` runs on
  leaving Animate, which is the moment it was for: the transport is reachable
  nowhere else. It puts the authored playhead back afterwards, because a view
  switch is not a rewind. Key-to-key navigation stays — it is the only control
  that knows where the keys are — and one **Fit** replaces the zoom steppers,
  since ctrl+wheel already scales the sheet. `fps` is still 30, and the frame
  buttons say so in their tooltips instead of leaving it implied.
- **Pinned by** `core/tests/timeline-transport.test.js` and the posing table in
  `core/tests/puppet-handles.test.js`. Two browser specs pinned the opposite:
  `ux26-direct-controls.spec.js` asserted no handles in Animate (and reached
  the canvas through Expressions to test Auto Key), and `stability.spec.js`
  looped Play/Stop through a button that is gone.

### V3-14 — Controls that do not collide, and that read as what they move — **done**

- **Goal:** no two controls overlap, and a control for the tongue looks like
  the tongue.
- **Evidence — collisions:** there is **no runtime overlap avoidance at all**.
  Positions are static fractions of a measured box (`PUPPET_SPOTS`,
  `svg-canvas.js:1831`, placed at `:2280`), de-conflicted by hand per
  definition. The only guard is a unit test keyed on
  `elements + at + group` (`face-control-rig.test.js:217`), which catches
  identical anchor *and* identical spot and nothing else. Handle buttons are
  fixed pixel sizes (26/19/32 px) whose positions scale with zoom but whose
  hit areas do not, so overlap is zoom-dependent and unmodelled. A pin with a
  small radius puts its two reach squares inside its own dot
  (`svg-canvas.js:665-692`).
- **The hook already exists and is dead:** `offset` is on the handle record
  (`handle-record.js:80`) and is merged (`handle-model.js:155`) but **is never
  read by the canvas placer**. `placePuppetHandles` ignores it entirely. That
  is where a de-collision nudge belongs. The only real packing logic in the
  app — `fitCells`, `ringGap`, `rowGap` (`hand-console.js:57-113`) — is
  private to the hand console and wants promoting to a shared primitive.
- **Evidence — icons:** every face control is a CSS-shaped `<button>` with a
  `title` and an `aria-label` (`dressHandle`, `svg-canvas.js:2228`); the board
  draws a coloured dot and a text label. There is no glyph, thumbnail or
  animation for mouth, tongue, teeth, eyes, brows, pupils or jaw. **Teeth has
  no handle at all** — it is a mouth parameter with no entry in
  `PUPPET_HANDLES`. The precedent to copy is the hand-style picker, which
  renders live SVG cells from the same artwork as the hand, in-panel and
  on-canvas (`hand-picker.js`, `svg-canvas.js:2050-2164`).
- **Why this is not a rewrite:** the widget vocabulary and its derivation
  already exist (`handle-record.js:29,50`, `handleController` at
  `handle-model.js:76`), one renderer per shape under `ui/rig-controls/`.
  An iconic kind is a new file plus one branch at `handle-board.js:251-257`,
  and the record already stores `widget.shape/size/colour` and `at`/`offset`
  per handle with no schema change.
- **As built.** `core/puppet/control-packing.js` is the placement: `controlSpot`
  turns a measured box, an `at` and the author's `offset` into the point a
  control wants, and `packControls` hands back points where no two controls
  touch — a control that clashes with nothing never moves, one that does steps
  onto a ring of places around it, and the search is bounded because ring `k`
  offers `6k` places and one control can cover at most four of them. A control
  is taken as the **box** it really is, which is both what a reader means by
  one being on top of another and what the browser suite measures with
  `getBoundingClientRect`. The canvas measures,
  packs and only then writes (`placePuppetHandles`), which is also one layout
  pass instead of one per control, and a control's hit area is **measured**
  rather than assumed so it is right at any zoom and any stylesheet. The hand
  console's `fitCells` and its ring / row gaps moved into the same module as
  `fitCells` and `shareCells`. A pin's reach squares are pushed out of the pin's
  own dot along their own axis (`pushClear`), never sideways, because their
  distance from the pin is the number they report.
- **The picture.** `core/puppet/handle-glyph.js` reports what a control should
  be drawn as and how that drawing is posed; `ui/rig-controls/part-glyph.js`
  draws eleven of them. Which one comes from the **role** of the artwork the
  control sits on, so nothing is keyed on an id, and the pose is the control's
  own axes read screen-wards, so the drawing does what the drag does. The same
  drawing is on the mascot and in the board. Two controls were added with it:
  `teeth` and `tongueShow`, the last two movements with a slider and nothing on
  the mascot.
- **What this slice found that the brief did not say.** `mouthWidth` and
  `mouthCornerRight` are authored onto the *same* spot on the *same* element and
  differ only by group, which the `elements + at + group` test is built not to
  see; so are `browTiltLeft` and `browLeft` once the brows are opened. Both were
  real, both are gone. The `@visual` baselines change: every control on the face
  carries a drawing now.

### V3-15 — The UX audit — **done**, `docs/V3_UX_AUDIT.md`

- **Goal:** verify that SVG editing, rigging and animation authoring are each
  reachable and intuitive, against the program as built.
- **Dependencies:** everything above that lands.
- **Method:** the repo's own audit form — `docs/UX_UI_CURRENT_AUDIT.md`,
  `docs/V1_UX_AUDIT.md`, `docs/RIGGING_AUDIT_2026-09.md` are the precedents.
- **Note:** three docs are already known stale and should be corrected as they
  are encountered rather than in a sweep — `UX15_AUTOMATIC.md` (the panel
  moved to Reactions), `DIRECT_CONTROLS.md:110-150` (fingers and facing that
  no longer exist), and `DEPTH_PARALLAX.md` (documents example depths that
  exist in no asset).

## Program gates

Every slice: `npm test`, `npm run build`, the `@critical` browser suite
(130 tests), and `@visual` baselines refreshed where a surface changed.
V3-02 and V3-06 change artwork, so both need the animation matrix
(`face-part-animation-matrix.test.js`) explicitly checked, not merely green by
inheritance.

## What the survey found

Six parallel surveys of the live code, 2026-09. The defects below were each
reproduced before being written down.

| # | Finding | Where |
| --- | --- | --- |
| 1 | Turn participation is keyed by role name in a frozen table; all accessories share one role | `head-pose-turn.js:34`, `part-registry.js:67` |
| 2 | Facial hair is in neither the turn nor parallax — it gets nothing | `builtin/facial-hair.js` — fixed, V3-02 |
| 3 | The earring is pinned to template coordinates, not to the ear — fixed, V3-03 | `builtin/accessories.js:34` |
| 4 | A preset's accessory placement is validated and then silently dropped — as is any placement naming a part the preset does not put on | `face-presets.js:238` |
| 5 | `place()` can only address the first part of a category | `face-part-commands.js:83` |
| 6 | 44 e2e specs enter through a Home card | `tests/e2e/helpers/editor-helpers.js` |
| 7 | Canvas puppet handles are disabled in the `animate` workspace — fixed, V3-13 | `editor-app.js:586` |
| 8 | Space is a dead key while a motion plays — and so is the Pause button; fixed, V3-13 | `timeline-panel.js:219` |
| 9 | `drift` cannot be added from the behaviours panel | `behavior-catalog.js` |
| 10 | No `idle` or `gaze-follow` trigger; `hover` has no exit event | `runtime.js:819,1180` |
| 11 | The gaze solver decomposes correctly but is off by default | `gaze-solver.js:62` — fixed for new mascots, V3-12 |
| 12 | `offset` on the handle record is merged and never read | `handle-model.js:155` |
| 13 | No overlap avoidance anywhere; hit areas do not scale with zoom | `svg-canvas.js:2280` |
| 14 | Teeth has no control handle | `puppet-handles.js` |
| 15 | A drawn hand never comes to rest — it drifts indefinitely, which makes every positional browser assertion about a hand racy | measured against `ux32-hands.spec.js:203` |
