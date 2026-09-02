# UX-20 — Mobile priority mode

## Baseline

UX-20 builds on the responsive shell (UX-19) and the capability policy in `docs/UX_UI_RESPONSIVE_STRATEGY.md` on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

On phones, deliver Preview, Expressions, Reactions, small edits, Save and Export in full, gate precision tools explicitly with a handoff, keep exactly one sheet, and offer a desktop-layout escape hatch.

```text
📱  Artwork · Face Setup · Expressions · Animate · Reactions · Preview      Save  Export  ☰
    Limited on phones: Import, select, rename, show or hide layers. Drawing tools, node editing
    and transform handles are off on phones. Edit shapes and transforms on a tablet or desktop.
    Not on phones: Key-by-key animation needs room for the dope sheet. Open the Timeline on a
    tablet or desktop; motion presets still work here.
  What works on this phone  ▸ Preview full · Expressions full · Reactions full · Motions limited · Timeline not on phones …
  [Use the desktop layout on this device]
```

## Delivered

- `ui/mobile-capabilities.js`: the policy per area (full / limited / unavailable) with a note and a handoff; `describeCapability(area, layout)` never gates tablet or desktop; `gateMarkup` renders the inline gate.
- Shell on `data-layout="mobile"`: drawing toolbar, transform handles, Timeline and the transition graph are hidden and replaced by inline gates (Artwork, Face Setup, Animate → Timeline, State Machine, Bindings); Motion **Open in Timeline** is disabled with the handoff; Save, Export, readiness deep links and the six tasks stay reachable; only one sheet at a time (UX-19).
- Capability sheet (`#capability-panel`, opened from the 📱 button): every area with its level and handoff, plus **Use the desktop layout on this device** / **Automatic layout** (`responsive.forceLayout`, stored as a UI preference, never in the project).
- Advanced hub: tools that need a larger screen report it on phones.

## Compatibility

No schema or runtime change; nothing is hidden without a visible explanation, and no data becomes inaccessible.

## Tests

- Unit (`core/tests/mobile-capabilities.test.js`): levels and handoffs, full areas on phones, unavailable and limited areas, larger screens never gated, gate markup.
- Browser (`tests/e2e/ux20-mobile.spec.js`): at 390 × 844 and 320 × 568 — artwork gate with layers still usable, Happy preset applied at 50 % from the sheet, a reaction created and tested, the Timeline gate and disabled Open in Timeline while Nod still plays, Preview full with expression and reaction chips, Save visible, Export ready, the capability sheet; the desktop escape hatch survives a reload and can be switched back.

## Deferred

Touch gestures on the canvas (pinch zoom, two-finger pan) beyond browser defaults; per-device memory of the last sheet detent.
