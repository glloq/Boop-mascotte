# ADR — Reactions as orchestration, with clips in the exported runtime

Status: accepted for UX-13. Scope: editor schema (additive `reactions` domain), project snapshot (additive, version stays 3), export `rig.json` (additive `reactions` and `animations` blocks, schema version stays 3), standalone runtime (shared reaction sequencer, clip playback, event binding). No destructive migration.

## Context

The product promise "Click → Surprised" needs an authored orchestration: a trigger, an Expression (UX-09), an optional Motion (UX-11), timing and a return policy. Today the runtime has States and transitions (a graph the host drives with `setState`), Expressions (`setExpression`) and automatic behaviors, but no event vocabulary, no clip playback and no way to sequence "apply this for a while, then come back". Reactions must be **testable in Preview and identical in the exported mascot**, deterministic under interruption, and safe for older runtimes.

## Decision

### Entity

```json
{
  "id": "surprise", "name": "Surprise", "enabled": true,
  "trigger": { "type": "click" },
  "expression": { "id": "surprised", "weight": 1 },
  "motion": { "clipId": "head-pop" },
  "timing": { "attack": 0.1, "hold": 0.6, "release": 0.3 },
  "after": "return", "priority": 0, "interrupt": "replace"
}
```

- **When** — `trigger.type` is `click`, `hover`, `timer` (`interval` seconds) or `custom` (`name`, fired by the host through `engine.trigger('custom', { name })`). UX-13 ships click and the custom contract; hover and timer are normalized and sequenced by the runtime already and get their UI in UX-14.
- **Do** — an Expression at a weight (0–1) and/or a Motion (an animation clip id). Both are references; a Reaction never creates or edits them. A Reaction with neither is reported as "does nothing" by validation.
- **Timing** — `attack` ramps the expression in (ease-out), `hold` keeps it, `release` ramps it out (ease-in). The active phase lasts `max(attack + hold, clip.duration)` so a Motion always finishes. Presets Fast / Normal / Slow map to fixed seconds; anything else is "custom".
- **After** — `return` (the default) brings the mascot back to what it was; `stay` leaves the Expression applied at its weight until another Reaction returns it or the host clears it.
- **Priority / interrupt** — a new Reaction replaces the active one only if its priority is not lower (equal priority restarts); `interrupt: 'ignore'` Reactions fire only when nothing is active. A Reaction already releasing can always be replaced.

### Runtime

- `createReactionController(source)` in `project/runtime/runtime.js` is the sequencer used by **both** the editor `PreviewController` and `createMascotEngine`. It is pure over time in seconds: `trigger(event, at)`, `fire(id, at)`, `evaluate(now, base)` → `{ expressions, params, active }`, plus `getActive`, `getStayed`, `clearStayed`, `cancel`, `reset`. Timer triggers are evaluated inside `evaluate`.
- The clip evaluator moves into the runtime (`evaluateAnimationClip`); the editor re-exports it, so Preview and exported mascots play identical keys.
- Composition order per frame: state/transition pose → manual animation (`playAnimation`) → reaction motion → expressions (`setExpression` weights and reaction weights merged by max) → host overrides (`setParam`) → automatic behaviors. Preview inserts its Timeline clip and live controls at the equivalent places.
- Engine API (additive): `trigger(type, detail)`, `fire(id)`, `getActiveReaction()`, `clearReactions()`, `getReactions()`, `playAnimation(id)`, `stopAnimation()`, `getAnimation()`, `getAnimations()`, `bindEvents(target = svgRoot)` (click → `click`, pointerenter → `hover`; returns an unbind function). Hosts stay free to wire their own events with `trigger`.

### Storage and export

- `ProjectDocument.reactions: Reaction[]` (new domain `reactions`, own revision counter, commands `reaction/create`, `update`, `rename`, `duplicate`, `remove`, all atomic and undoable). `EditorSession.activeReactionId` is transient.
- Snapshot: `document.editor.reactions` (optional; version stays 3; older snapshots load with `[]`).
- Export: `rig.json.reactions` (normalized) and `rig.json.animations` (every project clip, normalized: `id`, `name`, `duration`, `loop`, `tracks`; the editor-only `motion` metadata is not exported). This lifts the V1 limitation "Timeline animations are not exported": they now play through `playAnimation` and Reactions. Older runtimes ignore both blocks.
- Validation: warnings (never blocking) for Reactions whose Expression or Motion no longer exists, and for Reactions that do nothing; each carries a deep link to Reactions.

### What Reactions are not

They do not create States or transitions and do not change `activeState`; they do not persist anything at runtime; Preview firing never writes to the project.

## Consequences

- A new **Reactions** task (list + Reaction Inspector) between Animate and Preview; Preview gets Reaction chips and fires `click` reactions when the mascot is clicked, so the product journey is testable without leaving the editor.
- Determinism: everything is driven by the caller's clock; tests fix `now`.
- Rollback: hide the Reactions task; stored reactions and exported blocks are inert for older editors and runtimes.

## Alternatives rejected

- **Reactions as States + transitions**: no timing model, no return semantics, no stacking with Expressions; would drag graph vocabulary into a beginner concept.
- **Host-only orchestration (document `setExpression` + timers)**: breaks the "author once, export" promise and cannot be previewed.
- **Multiple simultaneous reactions**: a queue/blend model doubles the surface for little product value now; priority + replace is predictable and can grow later.
