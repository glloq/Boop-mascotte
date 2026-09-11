# V3 UX audit — is the work reachable?

The question this programme closes on (V3-15): are **SVG editing**, **rigging**
and **animation authoring** each reachable, and reachable the way someone would
guess? Audited against the editor as V3 leaves it, not as the roadmap describes
it — every step below was traced in the code, and the counts are clicks from a
cold start with no project.

Precedents for the form: `docs/UX_UI_CURRENT_AUDIT.md`, `docs/V1_UX_AUDIT.md`,
`docs/RIGGING_AUDIT_2026-09.md`.

## The three journeys

A cold start lands on Home, which will not close until a project exists
(`closeHome` refuses while `projectLoaded` is false). So every journey begins
by making a mascot, and the question is what it costs from there.

| Journey | From a cold start | Verdict |
| --- | --- | --- |
| **Draw / edit SVG** | Home → *New Character* → **Artwork** tab | 2 · good |
| | or, on a part in hand: *Edit Shape* in the inspector | 2 · good |
| **Rig the face** | Home → *New Character* → **Face Setup** tab | 2 · good |
| | or *Advanced* at the foot of the Character inspector | 2 · good |
| **Author animation** | Home → *New Character* → **Motions** tab | 2 · good |
| | Expressions, Reactions, Preview | 2 each · good |

The task bar is the reason all of these are two: every navigable task
(`TASKS` in `ui/task-router.js`) is one press from every other, and the stage
grouping — Create · Animate · Behaviors · Publish — is derived rather than
stored, so nothing can be in a state the tabs cannot leave.

**Nothing that was reachable before this programme has become unreachable.**

## What V3 made reachable that was not

- **Posing on the canvas while the timeline is on screen.** `PUPPET_TASKS`
  omitted `animate`, so the handles were switched off in the one workspace the
  timeline lives in: you could not drag the mascot and see the key you were
  making. (V3-13)
- **Trying a hand.** Hand Setup's last step said "Ready. Test it from Preview",
  and Preview had no hand control of any kind — its live controls are built
  from `BASIC_MOVEMENTS`, which is 23 face movements and no hand. The
  instruction pointed at a room with nothing in it. (V3-11)
- **Holds on the recommended hand.** Offered only to a hand with *no* drawings,
  i.e. withheld from exactly the kind the editor tells you to make. (V3-11)
- **Choosing when something runs.** "With no interaction" had to be faked as a
  periodic timer, and "follow the eyes" could only be written as page code
  against `setParameter`. Both are now triggers, and reactions are listed by
  *when* with a control that moves one between buckets. (V3-09, V3-10)
- **Styles on a single-shape hand.** Refused outright; now the hand is grouped
  and given its drawings in one undoable step. (V3-11)

## What V3 cost, and should be paid back

### 1. Starting from nothing costs four steps and a mascot you did not want

Home used to offer *Blank canvas* directly. It now lives in **Artwork → Add /
Create artwork**, which is a `<details>` with no `open` attribute — collapsed
by default — and Artwork cannot be reached until a project exists. So the path
for "I want to draw my own mascot" is:

```
Home → Mascot Face  (load a template you are about to throw away)
     → Artwork tab
     → open "Add / Create artwork"
     → "Start over with a blank canvas"
```

Four steps, the first of which is loading something you intend to discard. The
card's own wording — *Start over with* — is honest about it, which is the
tell: the label had to apologise for the flow.

**This is a trade the narrowing asked for, not an accident.** The brief was
that Home should design a mascot "with the presets or the default mascot", and
that *"any other modification can be made from elements that already have
modifications ready for animations"* — that is, start from something rigged,
then change it. Starting from an empty canvas is the one flow that premise
rules out, and the cost of ruling it out is these four steps.

It is written down because it is the sharpest edge the programme left, not
because it is a defect. Home's *elsewhere* line names where everything went, so
nothing is lost or hidden. If drawing from nothing should be a first-class
start again, the cheapest way back is a blank-canvas card on Home beside the
two mascot cards — which is precisely the third card the narrowing removed, so
it should be added back on purpose or not at all.

### 2. A deep link that has never worked

`FOCUSABLE_PANELS` (`ui/task-router.js`) lists `'face-builder'`, but the
element is `hidden` until its card is pressed, so routing to it focuses
nothing. It was already dead before V3 moved the builder; moving it did not
make it worse, and did not fix it either.

### 3. The visual gate was not guarding anything, and now is

The baselines were stale after V3-08 and V3-14, which was expected. What was
not expected: **regenerating them changed four files out of twelve, and the
eight it left alone included a Home that no longer existed.** The stale
`home-1280` — four cards, an Open Project section, none of which the editor
still renders — passed the comparison.

The cause is `toHaveScreenshot`'s per-pixel `threshold`, which defaults to
`0.2`. In this palette a card's fill (`#111d32`) and the page's own gradient
are both dark navy and read as *the same pixel*, so a whole panel appearing or
leaving costs almost nothing; only the thin text and borders counted, and they
fitted inside the 3 % `maxDiffPixelRatio`. Deleting the file and recapturing
produced a visibly different image, which is the proof the comparison was not
doing its job.

Now `threshold: .08` and `maxDiffPixelRatio: .015`. Against the stale Home that
is 23 145 differing pixels, ratio 0.03 — caught. All twelve baselines were
deleted and recaptured rather than updated in place, and the suite passes twice
running, so the tighter tolerance still absorbs the font antialiasing it exists
to tolerate.

The suite stays outside the CI gates, as before. A gate that passes a redesign
is worse than no gate, because it is read as evidence.

## Still true, and still deliberate

- The gaze solver is on for **new** mascots only. An existing project keeps
  what it has, because turning a solver on inside a document someone has tuned
  changes how their saved mascot moves (V3-12).
- An existing project picks up the new turn profiles when its parts are
  identified on open, but its **grid is not rebuilt**: cells an author captured
  are theirs, and regenerating the turn stays a press they make (V3-02).
- Preview remains session-only. Every hand control added in V3-11 writes live
  parameters, never the document.

## What this audit does not cover

Per-preset restyling (V3-05, V3-06) is not built, so the parts column still
lists every asset in a category unfiltered. That is the open half of the
programme and the reason the audit stops here: a style axis changes what the
browser shows, and auditing a surface before its content model lands would
have to be redone.
