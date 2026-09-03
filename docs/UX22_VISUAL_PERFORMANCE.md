# UX-22 — Visual regression, performance and UX polish

## Baseline

UX-22 locks the responsive compositions delivered by UX-19 → UX-21 on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`, once behavior stabilized.

## Delivered

- Layout gate (`tests/e2e/ux22-layout.spec.js`, critical): at 320 × 568, 390 × 844, 768 × 1024, 1024 × 768, 1280 × 720 and 1440 × 900, Home and every task render without horizontal overflow (no element wider than the viewport in the app bar or panels, `scrollWidth ≤ innerWidth`) and Save stays visible; reduced motion keeps three viewports stable.
- Long-project stress (`tests/e2e/ux22-stress.spec.js`, stability): a project with 60 expressions, 33 motions, 40 reactions and 23 states — switching every task ten times causes no document writes, no validation runs and no history; readiness is derived once per document revision; export stays complete and fast; firing a reaction keeps one preview loop and the loop sleeps afterwards; the palette answers over the long project promptly. Budgets recorded in `docs/PERFORMANCE_BUDGETS.md`.
- Visual baselines (`tests/e2e/ux22-visual.spec.js`, `@visual`): reviewed screenshots of Home, Artwork, Face Setup, Expressions and Preview at 1280 × 720 and 390 × 844 with animations disabled and reduced motion. They run on demand (`npm run test:e2e:visual`) and are excluded from the CI gates so font rendering differences between machines never block a slice; refresh with `--update-snapshots` and review the PNGs when a composition changes on purpose.
- CSS token pass: the colors repeated across the UX slices (text, muted text, surfaces, borders, focus, warning, success) are `:root` custom properties used by the new style blocks; values are unchanged, so nothing shifts visually.

## Compatibility

No schema or runtime change; no functional assertion was weakened.

## Tests

Listed above; the layout gate joins the critical suite and the stress test the stability suite.

## Deferred

Cross-browser screenshot baselines (Firefox/WebKit smoke stays functional), 200 % zoom baselines, and forced-colors tuning.
