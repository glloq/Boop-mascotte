# UX-12 — Motion Studio presets and Advanced Timeline bridge

## Baseline

UX-12 builds on UX-11 (`docs/ADR_MOTIONS.md`, `docs/UX11_SIMPLE_MOTION.md`) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

Offer the seven catalogue motions, make the simple → complex transition explicit and reversible, and keep the Motion Studio and the Timeline in agreement.

```text
Presets
  Nod · Shake · Bounce · Tilt · Look Around · Eye Dart · Head Pop
  Head Pop   The head jumps up while the mouth opens briefly.
             Uses Head · Move up / down, Mouth · Open / close        [Add]
Motions
  Head Pop  [Preset]   Head Pop · 0.6 s
  Look Around [Timeline]  2 tracks · 9 keys
Motion Inspector — Head Pop (after a key edit in the Timeline)
  ⚠ Edited in the Timeline: the Head Pop settings no longer drive this animation.
    [Reset to preset] [Keep as custom]   Or keep editing its keys below; Undo also brings the preset back.
```

## Delivered

- Presets: Bounce (head hop), Tilt (lean and hold), Look Around (gaze sweep over two tracks), Eye Dart (quick glance), Head Pop (head up + mouth open). Multi-slot presets stay usable with the movements the project has and list what they also need on the card.
- Explicit transition: editing a preset motion's keys in the Timeline shows a one-time warning toast and an inline notice in the Motion Inspector with **Reset to preset** (inline confirmation, rebuilds the tracks from the stored settings) and **Keep as custom** (drops the preset metadata; the keys stay). Both are single undoable commands (`motion/reset`, `motion/detach`). Simple motions show a hint about what opening the Timeline means.
- Badges: every motion in the list carries a Preset / Edited / Timeline badge; the summary line shows keys for edited and custom clips.
- Timeline parity: the Timeline navigator and the Motion list select the same clip (both drive `animationEditor.activeClipId`); the Motion Inspector stays visible while a Timeline track or key is selected (heading "Motion Inspector"), so the transition notice appears where the edit happens.

## Compatibility

No schema or runtime change; presets remain data and `motion` metadata stays optional.

## Tests

- Unit (`core/tests/motions.test.js`): seven preset ids, gaze presets need gaze movements, partial availability (Head Pop without a mouth), two-track compilation, 0..1 parameter scaling, reset and detach commands with undo.
- Browser (`tests/e2e/ux12-motion-studio.spec.js`): Basic Face offers seven usable presets, Head Pop compiles two tracks, Look Around gets a unique id next to the template clip, badges, Timeline navigator ↔ Motion list selection, key edit → warning toast + inline notice in the Timeline key context, Reset (cancel then confirm) rebuilds the keys, Keep as custom detaches, two undos bring the preset back.

## Deferred

Runtime playback of clips and Reactions (UX-13); Timeline-side "Open in Motion Studio" affordances beyond selection; per-preset icons.
