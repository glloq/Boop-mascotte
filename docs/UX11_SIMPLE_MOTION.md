# UX-11 — Simple Motion contract and preset vertical slice

## Baseline

UX-11 builds on UX-07 (movements), UX-08 (Preview) and the V2 animation clips on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`. Contract: `docs/ADR_MOTIONS.md`.

## Goal

Create and test a Nod without the Timeline, tune it with amplitude, duration and repeats, keep complex clips untouched, and make the relationship between a preset and its clip lossless.

```text
Animate
  Presets
    Nod     The head dips and comes back.        Uses Head · Move up / down   [Add]
    Shake   The head turns left, right and back. Uses Head · Move left / right [Add]
  Motions
    ▸ Nod        Nod · 0.8 s
      Look Around  Custom · 2 tracks · 5 keys
Motion Inspector — Nod
  Nod preset · Head · Move up / down
  Amplitude ▬▬●▬ 50%   Duration 0.8 s   Repeats ×1   ☐ Loop
  [▶ Test] [■ Stop] [Open in Timeline] [Duplicate] [Delete]
```

## Delivered

- `core/motion/motion-presets.js`: preset catalogue (Nod, Shake) described over basic movements with fallbacks, setting limits, `normalizeMotionSettings`, `resolveMotionControls`, deterministic `compileMotionTracks`, `motionAvailability`.
- `core/motion/motion-model.js` and `motion-commands.js`: create from preset (unique slug ids, `motion` metadata), update settings (regenerates tracks), loop, rename, duplicate, remove; `classifyClip` (simple / edited / custom) and `motionSummary`. Commands are atomic, preflighted and undoable on the `animation` domain.
- Motion Studio (`ui/motion-studio.js`) in the Animate sidebar: preset cards (usable only when the project has a matching movement, otherwise "Needs …" with a Face Setup link), the motions list with a one-line summary per clip, and the **Motion Inspector** adapter in the single Inspector (name, settings for simple motions, an "edited in the Timeline" notice, custom summary, Loop, Test/Stop, Open in Timeline, Duplicate, Delete). Adding a preset selects it and plays it once in the preview.
- Selection: an active clip in Animate resolves to the `clip` context (heading "Motion Inspector"); selecting a motion clears state/track/key selection. Task hint and author intro updated.
- E2E seam: `motions()`.
- Small fixes met on the way: the Timeline's numeric key value editor no longer records a history entry when the value is unchanged (a blur after an edit created a no-op undo step), and Preview **Reset mascot** now reports `preview.playing = false` in diagnostics.

## Compatibility

No schema version or runtime change. Clips without `motion` behave exactly as before; the Timeline, Preview chips, readiness and export are untouched.

## Tests

- Unit (`core/tests/motions.test.js`): presets use basic movements, deterministic compilation (repeats, negative shapes, boundary easing, clamped settings, fallbacks, pinned mapping), commands and classification (simple → edited → simple under key edits, custom clips, failures change nothing, duplicate/rename/loop/remove, full undo), snapshot round trip and export unchanged. `selection-context.test.js` covers the Motion Inspector presentation.
- Browser (`tests/e2e/ux11-motions.spec.js`): Basic Face → Add Nod (one mutation, exact clip, playing, Motion Inspector), Stop, amplitude/duration/repeats regenerate keys, undo, Test, Open in Timeline expands the Timeline on the clip, a key edit turns the motion into "edited" and undo restores it, save/open keeps the metadata and `rig.json` stays clip-free; imported artwork keeps presets disabled with a Face Setup link until movements are on, then Shake compiles over two cycles, plays from Preview, resets, and deletes.

## Deferred

Remaining presets (Bounce, Tilt, Look Around, Eye Dart, Head Pop), the explicit simple→complex conversion dialog and "Reset to preset" (UX-12); runtime playback of clips and Reactions (UX-13).
