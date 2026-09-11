# UX-13 — Reaction contract and runtime vertical slice

## Baseline

UX-13 builds on Expressions (UX-09/10), Motions (UX-11/12) and Preview (UX-08) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`. Contract: `docs/ADR_REACTIONS.md`.

## Goal

Ship "Click → Surprised" end to end: author one reaction without runtime vocabulary, test it in the editor, click the mascot in Preview, and export a mascot that reacts on its own.

```text
Reactions
  New reaction [Surprise]  [Create]
  ▸ Surprise   When clicked → Surprised → Head Pop
Reaction Inspector — Surprise
  WHEN   Trigger: Clicked
  DO     Expression: Surprised  Intensity 100%   Motion: Head Pop
  TIMING Speed: Fast · 1 s      AFTER  Return to how it was
  ▸ Advanced (enabled, priority, interrupt policy, mascot.fire('surprise'))
  [⚡ Test] [Duplicate] [Delete]
Preview → Reactions: ⚡ Surprise · click the mascot
```

## Delivered

- Runtime (`project/runtime/runtime.js`): `evaluateAnimationClip` moves in (the editor re-exports it); `normalizeAnimations`, `normalizeReaction(s)`, `REACTION_TIMINGS` presets and `createReactionController`, the deterministic sequencer (attack → hold covering the motion → release, `after: return | stay`, priority and interrupt policy, timer triggers). `createMascotEngine` gains `trigger`, `fire`, `getActiveReaction`, `clearReactions`, `getReactions`, `playAnimation`, `stopAnimation`, `getAnimation`, `getAnimations` and `bindEvents` (click / hover on the SVG).
- Export: `rig.json.animations` (every clip, without editor metadata) and `rig.json.reactions`; schema version stays 3 and older runtimes ignore both blocks. The exporter note about clips being editor-only is gone.
- Editor: `ProjectDocument.reactions` domain with atomic commands (create, update, rename, duplicate, remove); snapshot `document.editor.reactions`; `EditorSession.activeReactionId`; new **Reactions** task (tab between Animate and Preview) with a list and the **Reaction Inspector** adapter (When / Do / Timing / After / Advanced, Test, Duplicate, Delete); guidance when an expression or motion no longer exists; validation warnings and a readiness section with deep links.
- Preview: the controller runs the same sequencer over the preview clock (`fireReaction`, `triggerReaction`, `getActiveReaction`, `clearReactions`, `PreviewSession.activeReaction`), keeps ticking while a reaction is active, and resets with the mascot. The Preview panel lists reactions as chips and clicking the mascot in Preview fires `click` reactions. Leaving the Reactions task clears any test in progress.
- E2E seam: `reactions()`, `activeReaction()`, `triggerReaction(event)`.

## Compatibility

Additive everywhere **until V3-09**: older snapshots load with no reactions; older runtimes ignore `animations` and `reactions`; existing clips, expressions, states and behaviors are untouched. V3-09 is the one exception in the programme and carries a schema bump and a `requires` marker — see below.

## Tests

- Unit (`core/tests/reactions.test.js`): tolerant normalization, shared evaluator identity, sequencer phases and determinism, stay, replace and restart, priority, interrupt policy, timers, custom events, engine event binding and parity of `getParams`, animation playback, commands (validation, atomicity, undo), snapshot round trip and legacy load, export blocks, validation warnings and readiness. `selection-context.test.js` and `task-readiness.test.js` cover the new task.
- Browser (`tests/e2e/ux13-reactions.spec.js`): Basic Face → Surprised preset → Head Pop motion → create Surprise (one mutation, exact entity, Reaction Inspector), choose the motion and Fast timing, Test plays and returns without touching the project, Preview chip and clicking the mascot fire it, `rig.json` carries `reactions` and `animations`, save/open keeps reactions; deleting the expression turns the reaction into a warning with guidance and Undo clears it.

## Deferred

Hover/timer UI and the event simulator with a log (UX-14); crossfading between reactions; per-reaction sounds.

## Later

The catalogue grew to 21 reactions across all six triggers, and a preset gesture may name several candidate hand poses: see `docs/READY_MADE_LIBRARY.md`.

## V3-09 — what runs when: `idle` and `gaze-follow`

The vocabulary could not say the two things people ask for first. "With no
interaction" was faked with a periodic `timer`, which fires on a clock whether
or not the page is being used, and no inactivity clock existed anywhere.
"Following you with its eyes" existed as a rig solver over `gazeX` / `gazeY`
(`docs/FACE_CONTROL_RIG.md`) that **nothing drove from the pointer** —
`bindEvents` bound `click` and `pointerenter`, and that was all. `hover` had no
exit event at all, so hovering played a reaction once and leaving did nothing.

`REACTION_TRIGGERS` is now `['click', 'hover', 'gaze-follow', 'idle', 'timer',
'custom']`, and three things follow from that.

- **`idle`** takes `after` seconds. The controller keeps one inactivity clock;
  `notifyActivity(at)` resets it and re-arms every idle reaction from `at`, and
  the timer path is untouched — a metronome does not care that you were there.
- **`gaze-follow`** and **`hover`** are `HELD_REACTION_TRIGGERS`: they hold
  their reaction open until `release(type)`, then run their own release ramp.
  The envelope gained one field (`holdUntil`) and no phase.
- **`bindEvents`** binds `pointerleave` on the mascot, and — only when a
  `gaze-follow` reaction is enabled — `pointermove` and `pointerleave` on the
  owning document, writing `gazeX` / `gazeY` from the pointer position. A
  mascot nobody asked to follow anyone does not suddenly start staring at the
  cursor. `followPointer` / `clearPointer` / `notifyActivity` / `releaseTrigger`
  are the same seams for a page doing its own event handling.

**This is the programme's one schema change**, and the reason is VNX-39's: a new
trigger is *not* safely additive, because `normalizeReaction` turned anything
unknown into a `click` — so a reaction meant for an idle page fired on the first
touch. `RIG_SCHEMA_VERSION` moves to **5**; the rig carries a `requires` list
naming what it needs (`trigger:idle`, `trigger:gaze-follow`, and nothing else
fills it); `load()` declines a rig this build cannot honour, by name; and an
unknown trigger normalizes to `{ type: 'unsupported', of }`, which neither
`trigger()` nor `fire()` will run and which the editor reports as a reaction
needing a newer runtime. Full contract: `docs/RIG_MODEL.md` § Schema version 5.

## V3-10 — one surface that says what runs when

Reactions and automatic behaviours were two panels sharing a comment, and the
preset catalogue bucketed by *when* only for **adding**: once a reaction
existed there was no way to move it to another bucket. A motion clip could not
be selected to run at all — it had to be wrapped in a `timer` reaction by hand,
or placed in an arrangement, which is editor-only and never exported.

`core/reactions/runs-when.js` is now the single answer to "when does this run?".

```text
RUNS_WHEN   click → hover → gaze → idle → page
            each one a label, a hint, and the trigger types that land in it
```

- `runsWhenOf(trigger)` files a trigger; `triggerForRunsWhen(id, current)`
  rewrites one, keeping what carries over (an event name survives a trip
  through another bucket; a `timer` moved to "By itself" stays a metronome).
- `deriveRunsWhen(document)` returns the buckets with their reactions **and**
  the automatic behaviours that share "By itself", the reactions this build
  cannot run, and `motionsNotRunning()` — the clips nothing plays.
- The reaction list is drawn by bucket, every bucket including the empty ones,
  and each row carries the `<select>` that moves it: re-bucketing is one
  `reactions` command and one history step, not a trip through the Inspector.
- A motion nothing runs is offered with a when beside it and one **Run it**
  button, which creates an ordinary reaction through the same command the form
  uses.
- `REACTION_PRESET_GROUPS` and the Preview bench's reaction groups are both
  derived from `RUNS_WHEN` rather than kept by hand, so a new when cannot
  arrive in one of the three and not the others — which is exactly what three
  hand-kept tables had allowed.

The automatic panel keeps its own host and its own `stateMachine` commands: an
automatic behaviour is a behaviour, a reaction is a reaction, and merging the
two arrays would be a second schema change. It takes its heading and its per
card *when* from `RUNS_WHEN`'s "By itself" entry, and the bucket above names
the behaviours that run there with a link down to the cards — one list, one
vocabulary, one order, two writers.

**Breathing and Tiny body bounce were removed here** — see
`docs/UX15_AUTOMATIC.md` and `docs/BEHAVIORS.md` for why, and for what would
bring them back.
