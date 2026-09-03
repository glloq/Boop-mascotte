# UX-10 — Expression presets and guidance

## Baseline

UX-10 builds on UX-09 (`docs/UX09_EXPRESSIONS.md`, `docs/ADR_EXPRESSIONS.md`) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

Offer ready-made faces (Happy, Sad, Angry, Surprised, Sleepy, Confused, Excited) that use only the movements a project has, tell the user what a preset would additionally need, and make Preview switching between expressions and neutral obvious.

```text
Presets
  Happy      Wide smile, bright eyes.            2 movements · 1 missing   [Add]
  Surprised  Mouth open, eyes and brows up.      2 movements · 1 missing   [Add]
  Angry      Brows down and inward, tight mouth. No matching movement yet  [Add (disabled)]
  …
Expression Inspector — Surprised
  ⚠ This preset also uses Eyebrows · Raise — off in this project.   [Turn on in Face Setup]
```

## Delivered

- `core/expressions/expression-presets.js`: catalogue described over basic movement names only; `instantiatePreset` keeps the controls the project has (clamped) and lists the missing ones with human labels and the part that provides them; `presetAvailability` feeds the catalogue. Presets are data; nothing is authored until **Add**.
- Expression Studio: **Presets** disclosure with one card per preset (description, movements kept, missing count), **Add** creates the expression with `source: 'preset'` and a stable id; an existing preset shows **Select**. Adding with missing movements shows a notice and a **Face Setup** link; the inspector shows a guidance banner with **Turn on in Face Setup** whenever a preset-based expression lacks movements or an expression references movements that no longer exist.
- Preview: a **None** chip clears all active expressions.
- Returning to Expressions re-applies the active expression to Preview at the current test intensity (leaving the workspace still clears it), so the inspector and the canvas never disagree.
- Contract: `[data-expression-select]` stays the expression list; a preset card's **Select** uses `[data-expression-preset-select]`.

## Compatibility

No schema or runtime change; presets instantiate to ordinary expressions.

## Tests

- Unit (`core/tests/expression-presets.test.js`): presets use only basic movement names, degrade to available controls with labelled missing movements, unusable presets, availability listing.
- Browser (`tests/e2e/ux10-expression-presets.spec.js`): Basic Face offers seven presets, Surprised adds two movements with eyebrow guidance leading to Face Setup, Select replaces Add once it exists, Preview None/Surprised toggling; imported artwork without movements keeps presets disabled until movements are turned on, then Angry lands with all four controls and no guidance.

## Deferred

Per-expression stored intensity and Emote Pack import/export (later), Reactions that trigger expressions (UX-13).

## Later

The catalogue grew to 26 faces in five groups, and the Starter kit adds a curated set of them in one press: see `docs/READY_MADE_LIBRARY.md`.
