# UX-14 — Reaction Builder and event simulator

## Baseline

UX-14 completes UX-13 (`docs/ADR_REACTIONS.md`, `docs/UX13_REACTIONS.md`) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

Let the user fire any trigger locally, see what happened and why, and finish the Reaction list (enable switch), with hover and timer triggers working in Preview like in the exported mascot.

```text
Preview → Reactions
  ⚡ Surprise
  Trigger an event   [Click] [Hover] [custom event ▸ Fire]
  Event log
    2.3 s · click → Surprise fired
    2.4 s · click → blocked by surprise
    0.8 s · hover → no reaction listens
  [Clear log]
Reactions
  ▸ Surprise   Every 0.5 s → Surprised          [✓ enabled]
```

## Delivered

- Preview simulator (`ui/preview-panel.js`): Click and Hover buttons, a custom event name + Fire, and a session-only event log (newest first, bounded) with outcomes **fired**, **blocked by …** (priority or interrupt policy), **no reaction listens** and **disabled**. Test (chip) and timer firings are logged too. Clear log; Reset mascot clears everything.
- PreviewController: `triggerReaction` / `fireReaction` record log entries with the outcome, `getEventLog` / `clearEventLog`, `PreviewSession.eventLog`; the loop keeps ticking while an enabled timer reaction exists so timers fire in Preview; entering the canvas in Preview fires `hover` reactions when one listens; the panel refreshes when a reaction starts or ends.
- Reactions list: an enable switch per reaction (`reaction/update`), "off" in the summary; disabled reactions never fire and their Preview chip is disabled.
- Export panel: usage note for `mascot.bindEvents()` and `mascot.trigger('custom', { name })` when the project has reactions.

## Compatibility

No schema or runtime change; the simulator and log live in PreviewSession only.

## Tests

- Unit (`core/tests/reactions.test.js`): preview event log outcomes (no listener, fired, blocked, disabled, custom), timers keep the preview continuous and are logged, reset clears the log, the document never changes.
- Browser (`tests/e2e/ux14-event-simulator.spec.js`): hover with no listener, click fires, second click blocked under `interrupt: ignore`, custom event, log text and count, document and mutation count unchanged, clear and reset; hover trigger fired from the canvas, timer trigger fires by itself and is logged, the enable switch disables the reaction (one mutation) and the simulator reports no listener.

## Deferred

Event log export, per-reaction cooldowns, sounds.
