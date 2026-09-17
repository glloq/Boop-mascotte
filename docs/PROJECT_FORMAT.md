# The project format, as it actually is

Written for V4-005 (`docs/V4_ROADMAP.md`): the starting point the raster
program moves from, read off the code rather than remembered. Nothing here is
a proposal. Where the format is awkward, this says so rather than tidying it.

## Three different things called "the project"

| | What it is | Written by | Read by |
|---|---|---|---|
| **Project file** | `mascot-project.json`, and the autosave record | `createProjectSnapshot` | `prepareProjectSnapshot` |
| **Live document** | `ProjectDocument` in the store | `createProjectDocument` | every panel, through domain subscriptions |
| **Exported rig** | `rig.json`, beside the artwork | `createExportRig` | the runtime, `createMascotEngine` |

They are *not* the same shape, and the differences are load-bearing. The
largest one is at the bottom of this page.

## The project file

```text
{
  version: 3,                  ← PROJECT_VERSION, the file's own format
  capturedAt: "…",             ← an ISO timestamp, informational
  document: {
    svgMarkup: "<svg…>",       ← the artwork, serialized from the canvas
    layers: [ … ],             ← the layer tree
    layerMetadata: { … },      ← per-layer names and flags
    rig: { schemaVersion: 5, … },
    editor: { … }
  }
}
```

### Two versions, two axes

`version` is the *file's* format (`state/project-version.js`). `schemaVersion`
inside `rig` is `RIG_SCHEMA_VERSION`, the *runtime rig* schema. They move for
different reasons: adding a domain to the document is a project change, adding
a runtime concept is a rig change. A file that declares no `version` is the
first format, which never wrote one.

`canOpenProjectVersion` decides whether a file can be opened at all: at or
below the current version yes, above it no — a newer editor wrote it and this
one declines rather than guesses.

### `document.rig` — what the runtime schema covers

```text
schemaVersion  params  states  elements  activeState  transitions
transitionSettings  globalConstraints  stateConstraints  runtimeConfig
behaviors  keyforms  shapeKeys  warps  rigPins  rigConstraints
rigAttachments  rigHolds  hands  deformers  parallax  followers
expressionBlend  motionBlend  gazeSolver
```

### `document.editor` — authored, but not part of the rig schema

```text
semanticParts  animationClips  expressions  reactions
animationEditor  rigHandles  rigLinks  arrangement
```

`animationEditor` is the odd one: active clip, playhead and panel are editor
context rather than authored data, and they ride in the file so a project
reopens where it was left.

## The live document

`PROJECT_DOMAINS` (`state/project-document.js`) is the notification unit: a
change is announced per domain, and `render-plan.js` maps each domain to the
panels that must redraw. The document is flat — the file's `rig` / `editor`
split does not exist in it.

| Domain | Fields |
|---|---|
| `artwork` | `svgMarkup`, `elements` |
| `layers` | `layers`, `layerMetadata` |
| `rig` | `params`, `globalConstraints`, `stateConstraints`, `runtimeConfig`, `gazeSolver` |
| `stateMachine` | `states`, `transitions`, `transitionSettings`, `activeState`, `behaviors` |
| `semanticRig` | `semanticParts` |
| `rigHandles` | `rigHandles`, `rigLinks` |
| `animation` | `animationClips`, `motionBlend` |
| `arrangement` | `arrangement` |
| `keyforms` | `keyforms`, `shapeKeys`, `warps`, `rigPins` |
| `constraints` | `rigConstraints`, `rigAttachments`, `rigHolds` |
| `hands` | `hands` |
| `hierarchy` | `deformers`, `parallax`, `followers` |
| `expressions` | `expressions`, `expressionBlend` |
| `reactions` | `reactions` |

The document holds nothing that is not authored: no UI preference, no
selection, and no record of which format it was stored in.

## Opening a file

```text
JSON.parse
   ↓
prepareProjectSnapshot          ← validate, migrate, sanitize, normalize
   ↓  (throws before the live editor is touched at all)
restoreSnapshot
   ├── canvas.loadSvgFromText(document.svgMarkup, …)   ← reads the markup FIRST
   ├── applyProjectSnapshot(cleanState, snapshot)
   ├── identifyFaceParts(state)                        ← library parts recognised
   └── store.replaceProject(createProjectDocument(state), createEditorSession(state))
```

Two consequences worth keeping:

- **Migration happens in `prepareProjectSnapshot` and only there.** The canvas
  is loaded from `document.svgMarkup` *before* `applyProjectSnapshot` runs, so
  a migration step that rewrote the markup anywhere later would rewrite it
  after the canvas had already read the old one.
- **Nothing partial reaches the store.** Preparation works on a copy and
  throws before anything live is touched; `replaceProject` is a single commit.

`PROJECT_MIGRATIONS` (`state/migrations/project-migrations.js`) declares one
step per version rung, including the rungs with nothing to do — because "no
entry" has to mean someone forgot. Both current rungs are empty: every field a
newer format added is defaulted when absent by `applyProjectSnapshot`, which
is why old files have opened correctly by accident so far.

## Autosave

One `localStorage` key, `boop-mascotte-autosave-v1`, holding
`{ savedAt, projectSnapshot }` as JSON — the same snapshot shape as the file.
It is read back through the same `prepareSnapshot`, so a draft is validated
and migrated exactly like an imported file.

This is the part V4 cannot keep: `localStorage` is a string store of a few
megabytes, and one base64 image exhausts it (`docs/V4_ROADMAP.md`, V4-042).

## The exported rig is a different shape

`createExportRig` does **not** write `document.rig`. It writes what the
runtime reads, which reorganises the file's split:

| | Project file | Exported `rig.json` |
|---|---|---|
| `requires` | absent | present — what this mascot cannot run without |
| `expressions` | in `document.editor` | in the rig, normalized |
| `reactions` | in `document.editor` | in the rig, normalized |
| clips | `document.editor.animationClips` | `animations`, renamed and normalized |
| `semanticParts`, `rigHandles`, `rigLinks`, `arrangement`, `animationEditor` | in `document.editor` | **dropped** — authoring only |
| `hands[side].legacyPseudo3D` | kept, marks a hand awaiting conversion | stripped |

So "the rig" means two different objects depending on which file is open, and
the exported one is lossy on purpose: it is what a runtime needs, not what an
author was working with.

**This is a decision V4-040 has to make rather than inherit.** The `.boop`
package the roadmap sketches carries `project.json`, `scene.svg`, `rig.json`
and `assets/`. A `rig.json` inside a package that is meant to reopen as a
project cannot be the lossy exported one, and a `rig.json` that is the file's
`rig` block is not what the runtime reads. Either the package carries both, or
it carries the project shape and export stays a separate action.

## What has no place in the format yet

Assets. Artwork is `svgMarkup`, a single string, and every reference inside it
must be internal — `sanitize-svg.js` removes any `href`, `xlink:href` or `src`
that does not begin with `#`. That rule is what V4-020 extends, and the shape
of the extension is the `asset:` scheme (`docs/V4_ROADMAP.md`, ASSET-REF):
internal by construction, so the rule stays literally true and the document
stays free of binaries.
