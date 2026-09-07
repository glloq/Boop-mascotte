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
| Motions (43) | `core/motion/motion-presets.js` | Head, Eyes, Face, Hands |
| Reactions (18) | `core/reactions/reaction-presets.js` | When clicked, On hover, By itself, From your page |

Both catalogues were written over the ten basic movement names only (`headX`,
`headY`, `headTilt`, `eyeOpen`, `lookX`, `lookY`, `browRaise`, `browTilt`,
`mouthOpen`, `smile`) — the movements a face had before the control rig
(`docs/FACE_CONTROL_RIG.md`) gave it any others. Everything the rig added
since was reachable only key by key in the Timeline, which is the timeline
these presets exist to avoid, so they use it now: the faces speak 24 controls
and the motions 34, per-side offsets and all. `instantiatePreset` and
`resolveMotionControls` still keep what a project has and report the rest by
name, and a motion is still one or more slots compiled deterministically by
`compileMotionTracks`. Reaction presets still reference expressions, motions
and hand poses by *candidate lists* and never create what they name.

**Hands** is the group a mascot with floating hands had nothing in: the pair
came with a Wave and a Hands up written out as clips, and everything else was
the Timeline. Eight of them now — Wave hello, Clap, Point, Thumbs up, and four
built on **holds** (`docs/HAND_RIGGING.md`, "Held to the face"): Hand on the
chin, Hand on the cheek, Hand over the mouth, Facepalm. Two things every one of
them has to do and no other group does: bring the hand out from behind the head
(`handLShow`), and turn it the right way up — a hand rests fingers *down*, so a
pose drawn fingers-up is upside down until `handLRotation` puts it back.

Some of it is depth on motions that already existed — a gasp dilates the pupils
and drops the jaw, a yawn is a jaw and a tongue rather than a wide `mouthOpen`,
a laugh shows teeth, a sigh lifts the inner brows, a tilt leans the brows with
the head. The rest are motions that could not be built at all before: a wink, a
smirk, a raised eyebrow, crossed eyes, dizziness, chewing with the mouth shut.

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
- `FULL_KIT` names everything, and is what the mascot template ships
  (`docs/MASCOT_TEMPLATE.md`): every expression, motion and reaction id in the
  three catalogues. Its `automatic` list is the one part that is *not*
  everything, and not for want of ambition — two behaviours writing the same
  parameter fight, so `eye-wander` cannot run beside `natural-gaze` nor
  `head-drift` beside `idle-head`. Those three are the set that runs together;
  the alternatives are one press away in Animate.
- `buildStarterKit(document, kit)` takes either. The Starter kit card offers
  `STARTER_KIT`; the template calls the same function with `FULL_KIT`, so a
  template item and an authored one are indistinguishable.
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
  It starts from `startEmptyBasicFace` — the template with its own catalogues
  cleared — because on the template as it ships there is nothing left for the
  kit to add, and it correctly offers nothing. Every other journey test that
  authors a face, a motion or a reaction starts the same way.
