# UX-17 — Advanced tools consolidation

## Baseline

UX-17 builds on the task-first shell (UX-02 → UX-16) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`. The expert surfaces already exist (artwork inspector bindings / constraints / morphs, Timeline, State Machine, Behaviors, plugin manager, lifecycle diagnostics); they had no single, collapsed home.

## Goal

House Parameters, Bindings · Constraints · Morphs, Timeline, State Machine, Behaviors, Diagnostics and Plugins coherently behind one collapsed-by-default entry, losing no capability.

```text
••• → Advanced → [Advanced tools…]
  Parameters               Every control the runtime knows…                  [Open]
  Bindings · Constraints · Morphs   Opens the first element; select another…  [Open]
  Timeline                 Key-by-key animation editing under Animate.        [Open]
  State Machine            Runtime States and transitions.                    [Open]
  Behaviors                Every automatic behavior with all of its values.   [Open]
  Diagnostics              Validation counts and lifecycle counters…          [Open]
  Plugin manager           Enable or disable editor plugins.                  [Open]
  Parameters: lookX  -1 → 1  default 0 …
```

## Delivered

- `ui/advanced-tools.js`: registry with availability rules (artwork required, element required with the selection or the first element) and routes (`advancedToolRoute`) that reuse the task router, author modes and the Timeline disclosure; `flattenDiagnostics` for stable counter keys.
- `ui/advanced-hub.js`: a popover opened from ••• → Advanced → **Advanced tools…** (collapsed by default). Tools show why they are unavailable; **Parameters** and **Diagnostics** render read-only inside the hub (Diagnostics offers **Copy diagnostics** for bug reports); the other tools navigate and close the hub. The plugin manager stays where it was and the hub routes to it.
- Shell: `#advanced-panel` popover, `openProjectMenuAdvanced`, E2E seam `advancedTools()`.

## Compatibility

No schema or runtime change; the existing Artwork inspector, Timeline, State Machine, Behaviors panels, Problems and plugin manager keep their contracts.

## Tests

- Unit (`core/tests/advanced-tools.test.js`): tool ids, availability with reasons on a blank editor and a project, element selection, every route payload, diagnostics flattening.
- Browser (`tests/e2e/ux17-advanced.spec.js`): the hub is hidden and the menu collapsed by default; on a blank editor only Diagnostics and Plugins open (Diagnostics shows the blocking error and counters); with Basic Face every tool opens: Parameters table, Timeline expanded under Animate, State Machine and Behaviors author modes, Bindings on the Artwork inspector, and Plugins back in the menu.

## Deferred

A persistent "show Advanced in the sidebar" preference and the command palette entry points (UX-18).
