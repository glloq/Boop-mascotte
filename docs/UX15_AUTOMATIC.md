# UX-15 — Idle & Automatic vertical slice

## Baseline

UX-15 builds on UX-08 (Preview automatic toggles) and the existing runtime behaviors (blink, randomIdle, oscillator; `docs/BEHAVIORS.md`) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

Present always-on life as outcomes a beginner recognizes (Blink, Natural gaze, Idle head movement), mapped exactly onto the behavior types the runtime already has, with no new runtime semantics.

```text
Animate → Automatic
  Blink                The eyes close briefly every few seconds.     On      [✓] [Test]
  Natural gaze         The eyes glance around now and then.          Off     [ ]
  Idle head movement   A slow, gentle sway, like breathing.          Needs Head · Move up / down  [Face Setup]
  1 advanced behavior (Idle) · Behaviors (advanced)
```

## Delivered

- `core/behaviors/automatic-presets.js`: three presets, each a list of ordinary behaviors with stable ids and values (Blink → `blink` on `eyeOpen`; Natural gaze → `randomIdle` on `lookX` and, when available, `lookY`; Idle head movement → `oscillator` on `headY`). `deriveAutomaticStatus` detects presets by type + parameter, so hand authored behaviors count (the Expressive Face's blink is Blink); behaviors that map to no preset are listed as advanced. Statuses: unavailable (missing movement, with labels), off, on, disabled (kept).
- `core/behaviors/automatic-commands.js`: `enable` adds the missing behaviors with the preset values or re-enables kept ones (never duplicates, keeps hand tweaks); `disable` turns the matching behaviors off. Atomic, preflighted, undoable on the `stateMachine` domain like the advanced Behaviors panel.
- Automatic panel in the Animate sidebar (`ui/automatic-panel.js`): one card per preset with a switch, Test (preview's transient behavior test), Face Setup guidance when a movement is off, and a link to the advanced Behaviors panel with the count of unmapped behaviors. Preview's Automatic section and readiness summary pick the behaviors up unchanged.
- E2E seams: `automatic()`, `previewSession()`.

## Compatibility

No schema or runtime change; presets author plain behaviors that older editors and runtimes read as before.

## Tests

- Unit (`core/tests/automatic.test.js`): presets use runtime types only, status derivation (off, unavailable with optional movements, hand authored detection, advanced list), commands (add once, keep tweaks across off/on, optional behaviors skipped, failures change nothing, undo).
- Browser (`tests/e2e/ux15-automatic.spec.js`): Basic Face turns Blink on (one mutation, exact behavior), Test, Preview toggle and readiness summary, off keeps the behavior, Natural gaze adds two, export carries them, undo; Expressive Face shows Blink on and one advanced behavior with a route to the advanced panel; imported artwork keeps presets unavailable with Face Setup guidance until movements are on.

## Deferred

More outcomes (breathing scale, ear twitch) only if the runtime gains types through an ADR; per-card fine tuning stays in Behaviors (advanced).
