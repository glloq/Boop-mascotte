# UX-19 — Tablet adaptation

## Baseline

UX-19 applies `docs/UX_UI_RESPONSIVE_STRATEGY.md` to the task-first shell (UX-02 → UX-18) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

On tablet (600–899 px) and phone (< 600 px), keep the Canvas dominant with a navigation drawer and one contextual bottom sheet, touch-safe targets, and no stacked sidebars; desktop is unchanged.

```text
┌ ☰  BOOP  Artwork Face Setup Expressions Animate Reactions Preview  🔍 ↶ ↷ Problems Save Export ••• ┐
│                                                                                                  │
│                                   Canvas (full width)                                            │
│                                                                                                  │
├──────────────── Face Part Inspector           ▴ half  ▲ full  ▾ collapse ────────────────────────┤
│  (bottom sheet: half / full / collapsed)                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Delivered

- `ui/responsive-shell.js`: layout from the viewport (`desktop` / `tablet` / `mobile`), drawer and sheet state as session-only UI preference, invariants (raising the sheet closes the drawer; opening the drawer collapses the sheet; Escape closes the topmost surface first), `revealInspector` for selections and deep links, `matchMedia` relayout. Exposed on `#app` as `data-layout`, `data-sheet` and `.drawer-open`; E2E seam `layout()`.
- Shell: **☰** drawer toggle (aria-expanded) and scrim in the app bar; the left panel slides in as a drawer; the right panel becomes a bottom sheet with a header that names the subject (the Inspector heading or Preview) and detent buttons. Entering Preview or selecting an item on a compact layout reveals the sheet; the drawer closes.
- Timeline: on tablet it opens full-screen above the canvas; on phone it is declared unavailable (Motions and presets keep working).
- Touch: buttons, tabs, chips, checkboxes and range inputs get 44 px minimum targets below 900 px; destructive actions keep their spacing.

## Compatibility

No schema or runtime change; desktop layout and every existing contract stay as they were.

## Tests

- Unit (`core/tests/responsive-shell.test.js`): layout thresholds, drawer/sheet invariants, Escape order, reveal, relayout to desktop and mobile.
- Browser (`tests/e2e/ux19-tablet.spec.js`): 768×1024 — canvas ≥ 90 % width with the drawer off-canvas, 44 px toggle and tabs, drawer opens/closes with the scrim, sheet half/full detents, drawer and sheet never overlap, Escape order, selecting a face part reveals the Inspector sheet; 390×844 — every task reachable, Preview opens its sheet with a 44 px Reset button, collapsing the sheet returns the canvas.

## Deferred

Swipe gestures on the sheet and drawer (buttons remain the guaranteed mechanism), tablet-specific canvas gestures beyond browser defaults, and the mobile priority mode (UX-20).
