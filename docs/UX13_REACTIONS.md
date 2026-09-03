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

Additive everywhere: older snapshots load with no reactions; older runtimes ignore `animations` and `reactions`; existing clips, expressions, states and behaviors are untouched.

## Tests

- Unit (`core/tests/reactions.test.js`): tolerant normalization, shared evaluator identity, sequencer phases and determinism, stay, replace and restart, priority, interrupt policy, timers, custom events, engine event binding and parity of `getParams`, animation playback, commands (validation, atomicity, undo), snapshot round trip and legacy load, export blocks, validation warnings and readiness. `selection-context.test.js` and `task-readiness.test.js` cover the new task.
- Browser (`tests/e2e/ux13-reactions.spec.js`): Basic Face → Surprised preset → Head Pop motion → create Surprise (one mutation, exact entity, Reaction Inspector), choose the motion and Fast timing, Test plays and returns without touching the project, Preview chip and clicking the mascot fire it, `rig.json` carries `reactions` and `animations`, save/open keeps reactions; deleting the expression turns the reaction into a warning with guidance and Undo clears it.

## Deferred

Hover/timer UI and the event simulator with a log (UX-14); crossfading between reactions; per-reaction sounds.

## Later

The catalogue grew to 18 reactions across all four triggers, and a preset gesture may name several candidate hand poses: see `docs/READY_MADE_LIBRARY.md`.
