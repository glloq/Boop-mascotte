# The guided journey

The editor could always tell you what was **wrong** (`validateProject`) and how
ready each task was (`deriveTaskReadiness`). Nothing told you what to **do
next**. A new author landed on an empty canvas facing six workspace tabs, and
the two newest features — head pose and hands — lived at the bottom of a Face
Setup panel three screens tall, where nobody found them.

This pass adds the missing answer and the room to show it.

## One canonical next step

`project/editor/core/validation/guide.js` is the single source for "what do I do
next?". It is pure: it reads the document and a readiness model, and reports.

```js
const guide = deriveGuide(document, readiness);
guide.next    // the one thing to do now, with a route to get there
guide.steps   // the whole journey, each { done, current, required, route }
guide.done / guide.total
```

`GUIDE_STEPS` is the journey in roadmap order:

| Step | Required | Reached by |
| --- | --- | --- |
| Add artwork | yes | Artwork |
| Assign the face parts | yes | Face Setup |
| Turn on the movements | yes | Face Setup |
| Turn the head | no | Face Setup → head pose |
| Add floating hands | no | Face Setup → hands |
| Create an expression | no | Expressions |
| Add a motion | no | Animate |
| Bring it to life | no | Animate → automatic |
| React to a click | no | Reactions |
| Try it out | no | Preview |

Three steps are required; the rest count towards progress but never block. A
step is done from the document (`expressions.length > 0`) or from readiness
(`readiness.faceSetup.status === 'ready'`) — never from another step, so the
journey has no ordering rules of its own to get out of sync.

**A blocking export problem outranks the next step.** There is no point
suggesting an expression while the project cannot be exported at all, so when
`readiness.export.status === 'error'` the guide leads with that issue and its
deep link instead. The finished steps stay finished.

## The guide bar is gone

The model above used to be drawn as a permanent line under the tabs — a
progress bar, `3/10`, the step in bold and a button that went there. It cost a
row of the window in every task, above a working area that is the whole point
of the editor, and it answered a question a returning author has already
answered. The row is the artwork's now.

What tells an author where they are did not go with it: each task's own hint
sits in its panel, every tab carries its readiness tick, and Publish shows the
checklist with the blockers spelled out. `deriveGuide` stays as the model, on
`selectors.guide`, for a surface that asks for it.

## Routes may focus a panel

A route already carried a `task` and an optional `target`. It now also carries
`focus`: the id of a panel to scroll to and flash. `FOCUSABLE_PANELS` is an
allowlist — anything else is dropped rather than trusted into a selector — so
"Turn the head" can land on the head-pose panel inside Face Setup rather than
on the Face Setup tab and a long scroll.

## Face Setup is six sections, not one panel

The panel held six things stacked: face parts, movements, head pose, hands,
warp and the part tree. `project/editor/core/validation/setup-sections.js`
gives each one a heading that grades it without opening it — `6 / 8`,
`8 on · 0 set`, `optional`, `advanced` — marked `ready | partial | empty`.

Only *Face parts* is open by default; what the author opens is remembered per
section. Panels no longer print their own heading, because the section header
above already carries the name and the status.

Summaries are deliberately short (the sidebar is 300px). The panel body does
the teaching; the heading only says whether there is anything inside.

## Labelled pads

`project/editor/ui/pad-frame.js` frames an XY pad a panel already renders — the
pad's own class, dataset, aria and handle are untouched — with a caption and its
four directions. Preview, Face Setup and Head Pose all label their pads the same
way instead of each inventing a caption, and none of them is an unlabelled
rectangle with a dot in it any more.

## Reactions got presets

Expressions and Animate both open with a list of presets to click. Reactions
asked for a name and showed a blank form — the one step in the journey with
nothing to start from. It now offers the same kind of catalogue, built out of
the expressions, motions and hand poses the project already has, and says what
is missing (with a route to go and make it) rather than offering something that
would not work. See `docs/ADR_REACTIONS.md`.

## What this pass did not do

No new state, no new math, no per-frame work. The guide is derived on the
persistent revision that already invalidates the readiness model, and cached
with it. Everything here reads models the editor already had.
