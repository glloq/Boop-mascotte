# User-flow analysis and target journeys

## Counting method

An **action** is a meaningful click/tap, selection, drag/capture, text commit or file choice; passive validation is not counted. Counts are representative happy paths from the live baseline and can vary with SVG structure. A **surface** is a workspace/dialog/panel requiring context change. Current blockers distinguish “possible only through engine concepts” from genuinely missing product capability.

## Required flow measurements

| Flow | Current actions / surfaces | Technical concepts exposed | Hidden/duplicate actions and likely mistakes | Current blocker | Target workflow / actions / surfaces |
|---|---|---|---|---|---|
| 1 New → Basic Face → gaze → test → export | ~12 / 4 workspaces + export popover | Rig, semantic part, control, parameter/live value, Preview, validation | Template capability not explicit; live value vs saved pose unclear; preview action duplicated | Possible because template includes gaze | Home Basic Face → Face Setup checklist confirms pupils → Gaze test pad → Preview → Export; ~8 / 4 resumable destinations |
| 2 Import SVG → identify 8 roles → gaze → test | ~25–35 / Create + Rig + Preview | layers/IDs, semantic part types/roles, control method, calibration/binding | Must add correct part types; mascot-left ambiguity; role selection/local canvas selection compete | No confidence-ranked detection; manual assignment exists | Import → detection review → confirm/correct role cards by canvas → choose Gaze → capture left/center/right → Preview; ~18–24 / 3 |
| 3 Create Happy Expression | ~8–15 / Animate state editor (approximation) | State, parameters, snapshot, active state | “State” may include runtime meaning; intensity absent; capture semantics unclear | Expression product entity/presets missing | Expressions → Happy preset or New → pose via controls → Capture current face → intensity test → Save; ~5–8 / 1 |
| 4 Click → Surprised Reaction | Not achievable as product flow | states, transitions; external host event API | User could build unrelated state/clip pieces but cannot declare click orchestration | Reaction/trigger/return model and runtime support missing | Reactions → New → When Click → Expression Surprised → optional Head Pop → Fast → return previous → Test click; ~8 / 2 |
| 5 Head Nod Motion | ~10–16 / Animate + Timeline | clip, tracks, parameters, keys, playhead, auto-key | Must know control/track and create multiple keys; preset absent | Technically possible via `headTilt/headY` clip | Motion → Nod preset → amplitude/speed/duration/loop → Test; ~6 / 1; Timeline optional |
| 6 Edit existing mascot | ~6 to resume, then task-dependent / file + current workspace | project JSON, current engine workspace | No Home/recent/resume summary; transient UI reset can obscure intent | Open works; task/readiness resume absent | Home Open/Recent → project overview highlights last task and readiness → direct destination; ~3 + edit |
| 7 Export blocked → fix → export | ~6–12 / Problems + inferred workspace + Export | validator IDs, rig/artwork references | Problem may not own a route/selection; user manually searches; reopens export | Stable diagnostic deep links absent | Export readiness → issue explanation → Fix deep link opens correct task and selects subject → auto revalidate → return to Export; ~5–7 / 2 |

## Target diagrams

### New Basic Mascot

```text
Home → New Mascot → Basic Face [preview + included capabilities]
     → Create project (one replacement command)
     → Project overview: Artwork ✓, Face Setup suggested
     → Face Setup checklist → test Gaze → Preview → Export readiness
```

Cancellation never changes the current project. Template creation remains one atomic replacement/history baseline.

### Import SVG Mascot

```text
Home/Artwork → Import SVG → sanitize + parse
  → import warnings (actionable, non-technical summary)
  → Face-role suggestions [confidence + reason]
  → Confirm all | Review
  → Review: role card selected → candidate highlighted → accept OR click Canvas
  → completion summary → Configure movements
```

Never commit detection guesses before confirmation. Missing IDs may be generated deterministically as today.

### Face Setup

```text
Face Setup → Basic roles checklist
  → Head → Left/Right Eye → Left/Right Pupil → Left/Right Brow → Mouth
  → select role card → click Canvas → assigned → next missing role
  → duplicate-use warning / Replace / Cancel
  → optional More parts (lids, jaw, ears, nose, hair, accessories)
  → Movements readiness
```

Mascot-left/right is shown visually. Escape cancels pick without authored mutation.

### Configure Gaze

```text
Face Setup/Gaze → verify pupil assignments
  → Enable Look horizontal/vertical
  → keyform Left: manipulate Canvas → Capture
  → Center: Capture → Right: Capture
  → repeat Up/Center/Down (or accept safe template defaults)
  → live XY test → Save automatically via commands → Preview
```

Each capture is undoable; preview slider changes remain transient. Advanced shows generated `lookX/lookY` bindings/morphs.

### Create Expression

```text
Expressions → New / preset Happy
  → Expression inspector (name, intensity)
  → adjust Basic semantic controls OR pose Canvas
  → Capture current face → preview at 0/50/100%
  → Save → duplicate/rename/delete available
```

No State/transition vocabulary. Missing required controls show a Face Setup deep link.

### Create Reaction

```text
Reactions → New “Surprise”
  → When: Click
  → Expression: Surprised
  → Motion: Head Pop (optional)
  → Timing: Fast → After: Return to previous
  → Test → simulator fires Click → observe → reset
  → Advanced: priority, interrupt policy, custom event payload
```

Schema/runtime ADR must define interruption and return semantics before persistence.

### Create Motion

```text
Motion → Add Motion → preset Nod
  → amplitude + speed/duration + loop
  → Test beside Canvas → Save
  → [Open in Advanced Timeline] for keys/easing/tracks
```

Preset edits compile deterministically to existing clip primitives where possible; round-trip metadata must be decided before implementation.

### Advanced Timeline

```text
Motion → … → Open in Timeline
  → active clip selected → grouped semantic tracks
  → playhead / keys / Auto Key / clipboard / easing
  → transient playback → authored key command commits
  → Back to Motion summary (complex badge)
```

Opening Timeline is explicit and never required for preset-only Motion.

### Preview / Test

```text
Preview → Reset Mascot baseline
  ├ Expressions: apply + intensity
  ├ Motions: play/stop
  ├ Reactions: trigger
  ├ Automatic: toggles
  ├ Live: gaze XY, mouth, basic controls
  └ Trigger Event: Click | Hover | Timer | Reaction | Custom
        → event log + active result + errors
  → Focus Preview / Exit focus
```

All effects use `PreviewSession`; leaving/resetting clears overrides without document revision/history changes.

### Fix Problems / Readiness

```text
Export or project readiness → section → issue
  → plain-language cause + export impact + affected subject
  → Fix → route + inspector selection + suggested action
  → authored command → incremental validation
  → resolved announcement → Return to Export
```

Warnings do not block unless export policy says so. Stable diagnostic code, target route and payload are required.

### Export

```text
Export → readiness summary
  → blocking issues? Fix actions (downloads disabled)
  → ready → download mascot.svg / rig.json / runtime.js
  → confirmation + integration guidance
```

Formats, schema-v3 normalization and client-side Blob downloads remain unchanged.

### Edit Existing Project

```text
Home → Recent autosave OR Open Project file
  → validate/migrate/confirm replacement
  → Overview: project name, saved/autosaved time, readiness, last safe task
  → choose recommended next action or any task
```

Invalid files fail without replacing the current document. UI preferences restore separately and are normalized.

## Error and recovery invariants

- File/import/replacement cancellation has zero side effects.
- Every persistent action has a named command, affected domain and undo outcome.
- Destructive delete explains affected Expressions/Motions/Reactions once those exist.
- Direct links that cannot resolve fall back to the workspace and announce why.
- Autosave is not presented as cloud sync; recovery must disclose local-only storage.
