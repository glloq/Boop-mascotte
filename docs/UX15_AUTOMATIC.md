# UX-15 — Idle & Automatic vertical slice

## Baseline

UX-15 builds on UX-08 (Preview automatic toggles) and the existing runtime behaviors (blink, randomIdle, oscillator; `docs/BEHAVIORS.md`) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

Present always-on life as outcomes a beginner recognizes (Blink, Natural gaze, Idle head movement), mapped exactly onto the behavior types the runtime already has, with no new runtime semantics.

```text
Behaviors → Reactions → Automatic
  Blink                The eyes close briefly every few seconds.     On      [✓] [Test]
  Natural gaze         The eyes glance around now and then.          Off     [ ]
  Idle head movement   A slow, gentle sway, like breathing.          Needs Head · Move up / down  [Face Setup]
  1 advanced behavior (Idle) · Behaviors (advanced)
```

**Since VNX-09 the panel is in Reactions, not in Animate.** An automatic
behaviour is a reaction whose *when* is not an event, so it belongs beside the
ones that wait for a click rather than beside the motions it never plays:
`#automatic-panel` sits under `#reactions-panel` in the Reactions column
(`ui/app-shell.js`), and `ui/task-router.js` puts the `reactions` task in the
`behaviors` stage. Everything that reaches the panel names the task — the
guided journey's *Bring it to life* routes to `{ task: 'reactions', focus:
'automatic-panel' }` (`core/validation/guide.js`) — so nothing depends on which
column it is drawn in.

The **Behaviors** *stage* and the **Behaviors (advanced)** *panel* are two
different places, and the panel is not in the stage: the advanced editor stays
folded under **States & behaviors** at the bottom of Animate → Motions, which
is where the panel's own link routes (`{ task: 'animate' }`, `authorMode:
'behaviors'`).

## Delivered

- `core/behaviors/automatic-presets.js`: three presets, each a list of ordinary behaviors with stable ids and values (Blink → `blink` on `eyeOpen`; Natural gaze → `randomIdle` on `lookX` and, when available, `lookY`; Idle head movement → `oscillator` on `headY`). `deriveAutomaticStatus` detects presets by type + parameter, so hand authored behaviors count and the four the template ships map onto three presets with nothing falling through; behaviors that map to no preset are listed as advanced. Statuses: unavailable (missing movement, with labels), off, on, disabled (kept). **V2 added five more from the cartoon idles** (`docs/BEHAVIORS.md`) — Eye wander and Head drift on the `drift` primitive, Breathing, Tiny body bounce and Idle hands on `oscillator` — so the catalogue is eight; the shape of a preset and every status above are unchanged.
- `core/behaviors/automatic-commands.js`: `enable` adds the missing behaviors with the preset values or re-enables kept ones (never duplicates, keeps hand tweaks); `disable` turns the matching behaviors off. Atomic, preflighted, undoable on the `stateMachine` domain like the advanced Behaviors panel.
- Automatic panel (`ui/automatic-panel.js`), under the reactions since VNX-09: one card per preset with a switch, Test (preview's transient behavior test), Face Setup guidance when a movement is off, and a link to the advanced Behaviors panel with the count of unmapped behaviors. Each card also opens with its own *when* — a timer for the presets that rest between moves, all the time for the oscillators — read off the runtime types the preset is built from, so the column reads as one sentence with the reactions above it. Preview's Automatic section and readiness summary pick the behaviors up unchanged.
- E2E seams: `automatic()`, `previewSession()`.

## Compatibility

No schema or runtime change; presets author plain behaviors that older editors and runtimes read as before.

## Tests

- Unit (`core/tests/automatic.test.js`): presets use runtime types only, status derivation (off, unavailable with optional movements, hand authored detection, advanced list), commands (add once, keep tweaks across off/on, optional behaviors skipped, failures change nothing, undo).
- Browser (`tests/e2e/ux15-automatic.spec.js`): the template arrives with Blink, Natural gaze and Idle head movement on (a mascot that arrives frozen reads as broken), turning one off keeps it for later (one mutation, exact behavior), Test, Preview toggle, readiness summary, export and undo; a hand-written behavior that matches no preset shows up as advanced with a route to that panel; imported artwork keeps presets unavailable with Face Setup guidance until movements are on.

## Deferred

More outcomes (breathing scale, ear twitch) only if the runtime gains types through an ADR; per-card fine tuning stays in Behaviors (advanced).

V2 took the deferral at its word. The one type it added, `drift`, went through `docs/BEHAVIORS.md` first — and reached the advanced catalogue only in V3-10, until which the presets here were the sole way a project could own one. Everything else it added is built from the types that were already here.

**Breathing and Tiny body bounce are the exception, and they read as unavailable to everyone.** Both are an `oscillator` on `bodyBounce`, and no part of the editor defines that movement: it is in no `BASIC_MOVEMENTS` entry and no template creates the parameter, so `deriveAutomaticStatus` reports the preset as *unavailable* and `movementLabel` has no label to offer but the raw id. The cards are honest about being off; what they are waiting for is a movement, not a type, and nothing yet makes one.
