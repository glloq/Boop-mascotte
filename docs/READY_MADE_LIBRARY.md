# Ready-made library — emotions, motions, reactions and the Starter kit

## Goal

Reduce the work an author has to do before their mascot is alive. Before this
change the three catalogues offered 7 faces, 7 motions and 5 reactions, and an
empty project needed roughly twenty separate presses (each one its own undo
step) to reach something that looked finished. Now the catalogues hold 26 faces,
20 motions and 18 reactions, and one press builds a working mascot.

Nothing new is invented: every item is an ordinary preset resolved against the
movements the project actually has, and it goes through the same model
operations an author's own clicks go through.

## The catalogues

All three preset catalogues carry a `group`, and each exposes a
`…AvailabilityGroups(document)` helper that buckets the resolved presets in
catalogue order and drops empty groups. The panels render one `<details>` per
group with the first one open, because twenty-six cards do not fit a 300 px
sidebar as a flat list.

| Catalogue | Module | Groups |
| --- | --- | --- |
| Expressions (26) | `core/expressions/expression-presets.js` | Everyday, Playful, Thinking, Quiet, Strong |
| Motions (20) | `core/motion/motion-presets.js` | Head, Eyes, Face |
| Reactions (18) | `core/reactions/reaction-presets.js` | When clicked, On hover, By itself, From your page |

Every expression is still described over the ten basic movement names only
(`headX`, `headY`, `headTilt`, `eyeOpen`, `lookX`, `lookY`, `browRaise`,
`browTilt`, `mouthOpen`, `smile`), so `instantiatePreset` keeps what a project
has and reports the rest. Every motion is still one or more slots over those
names, compiled deterministically by `compileMotionTracks`. Reaction presets
still reference expressions, motions and hand poses by *candidate lists* and
never create what they name.

Two behaviour changes fell out of the growth:

- A reaction preset's `gesture` may now be a list of candidates
  (`['thumbsUp', 'wave', 'open']`), so Celebrate uses a thumbs-up when the hand
  has one and a wave otherwise. A single string still works.
- Reaction presets cover all four trigger types. The `From your page` group is
  authored around `mascot.trigger('custom', { name: … })`, so a page can answer
  `yes`, `no`, `success`, `error` and `thinking` without the author writing a
  reaction by hand.

## The Starter kit

`core/starter/starter-kit.js` is one atomic command over four domains
(`expressions`, `animation`, `reactions`, `stateMachine`):

```text
Starter kit
  One press: 8 faces, 6 motions, 4 reactions and 3 automatic behaviours,
  ready to use and easy to change.                                    [Add all]
```

- `STARTER_KIT` names the curated set — deliberately short, because the whole
  catalogue stays one click away in each panel.
- `buildStarterKit(document)` builds it *in place* and reports every item as
  `add`, `have` (already there, left alone) or `skip` with the reason. Order
  matters: expressions and motions are created first, so the reactions that
  reference them resolve against what the same pass just built. That is why the
  kit never leaves a dangling reference (`reactionIssues` stays empty).
- `starterKitDraft(document)` is the throwaway copy the plan runs against. It
  copies only the four lists the kit appends to, which keeps the panels off
  `structuredClone` on every render of a long project.
- `createStarterKitCommands(store, history)` exposes `plan()` (cached per
  document revision, since three studios ask for it on every render) and
  `add()`. `add()` on a project that already has the kit returns the plan
  without touching history, so a no-op press never becomes an undo step.

The card is rendered by `ui/preset-catalogue.js` at the top of the Expressions,
Motion and Reaction lists — the same offer wherever an author lands first — and
takes itself off the panels once there is nothing left to add.

## Compatibility

No schema or runtime change. Presets instantiate to ordinary expressions,
ordinary preset clips and ordinary reactions, and the kit is exactly what the
author would have built by hand. `automatic-model.js` was extracted so the
Automatic panel and the kit turn "life" on through the same code rather than two
copies of it.

## Tests

- Unit (`core/tests/starter-kit.test.js`): the kit fills an empty mascot, is
  idempotent, skips what the project cannot do with a reason for each skip, is
  one command and one undo across four domains, never authors while planning,
  and the reaction catalogue covers all four triggers with candidate gestures.
- Unit (`core/tests/expression-presets.test.js`, `core/tests/motions.test.js`):
  the enlarged catalogues keep unique ids, keep every original preset, and every
  entry sits in a declared group; the grouped availability helpers bucket every
  preset exactly once.
- Browser (`tests/e2e/ux28-starter-kit.spec.js`): one press is one document
  mutation and one undo, the offer appears in all three studios and disappears
  when spent, and a closed group opens to reveal and add the rest of a catalogue.
