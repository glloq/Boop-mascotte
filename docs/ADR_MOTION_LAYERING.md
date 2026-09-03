# ADR — how motions hand over to one another

**Status: open. This is the one item from `docs/ANIMATION_CONTROL_AUDIT.md` that
is a decision, not a patch.** Everything else in that audit is fixed.

---

## The situation

The runtime holds exactly one motion clip:

```js
let animation = null;
playAnimation(id) { animation = { clip, started: seconds(now()) }; }
stopAnimation()   { animation = null; }
```

The clip is mixed as `{ source: 'motion', mode: 'override' }` — its keys
*replace* the pose underneath for the parameters it touches. Three things follow,
and they are one problem, not three:

1. Playing B while A runs kills A on the frame it happens.
2. Stopping, or a clip reaching its end, drops the layer in one frame.
3. Two motions can never run together, even on disjoint parameters — a head nod
   and an eye dart are mutually exclusive because there is one slot, not because
   they conflict.

Everything needed to fix this already exists and is unit-tested:
`createWeightBlender` (used for expressions), `createParameterTransition`
(exported, called by nothing), and `mixParameters`' `weightedOverride` mode —
which is exactly what the reaction envelope now uses to fade a clip in and out.

## Why it is a decision and not a patch

Because "make motions blend" hides three independent questions, and answering
them differently gives genuinely different products.

### Q1 — What happens to a motion that is already playing?

| | Behaviour | Cost |
| --- | --- | --- |
| **A. Cross-fade replace** | `playMotion(b)` fades A out while B fades in. Still one motion at a time. | Cannot nod and glance at once. |
| **B. Layer by default** | Both run. The mixer composes them. | Two clips writing `headY` fight, with the later one winning by weight. Existing rigs change behaviour. |
| **C. Replace hard, but fade the edges** | Today's exclusivity; only stop/end/start stop snapping. | The cheapest. Leaves the expressive gap wide open. |

### Q2 — How does a clip combine with the pose under it?

| | Rule | What it means |
| --- | --- | --- |
| **A. `override` / `weightedOverride`** (today) | The clip's key *is* the value; a weight blends toward it. | A clip is an absolute pose. Two clips on one parameter cannot both be right — the later one wins. |
| **B. `additive`** | `current + (key − neutral)` | Motions compose naturally: a nod adds onto a tilt. But every existing clip changes meaning — a clip authored as "look at 1.0" becomes "look 1.0 *further*". A migration. |
| **C. Per clip** | The author picks. | Honest, and one more concept in a product whose whole point is fewer concepts. |

### Q3 — Who owns the fade time?

| | Where it lives |
| --- | --- |
| **A. The engine** | One built-in constant. Nothing to author, nothing to tune. |
| **B. The document** | `motionBlend: { duration, easing }`, exactly like the `expressionBlend` that this branch just made reachable. One place, applies everywhere. |
| **C. The call** | `playMotion(id, { fade: 150 })`. Maximum control, and every caller has to care. |

## Recommendation

**Q1 = A with an explicit opt-in to B. Q2 = A. Q3 = B, with C as an override.**

Concretely:

```js
// Default: hand over. The mascot never passes through neutral.
mascot.playMotion('shake');

// Opt in to layering, per call, when the motions are genuinely independent.
mascot.playMotion('eye-dart', { layer: true });

// Document-level default, authored next to the expression cross-fade.
motionBlend: { duration: 120, easing: 'easeInOut' }
```

The reasoning:

- **Q1 = A** because it is the answer that cannot be wrong. Every existing rig
  behaves identically except that it stops snapping — no rig has to be
  re-authored, and no reviewer has to think about which of two clips wins.
  Layering as an opt-in buys the expressive case without imposing it.
- **Q2 = A** because `additive` silently redefines every clip already authored,
  and the products this competes with treat a keyframed clip as a pose. It is
  also what the reaction envelope already does, so there is one rule for "a clip
  applied at a weight" rather than two.
- **Q3 = B** because the product just learned this shape for expressions. One
  `motionBlend` next to `expressionBlend`, one control next to the other, one
  thing to explain. A per-call `fade` costs nothing to add on top and keeps the
  runtime API honest for people driving it from code.

### The sub-decision worth taking deliberately

**Should a new project ship a non-zero blend, or zero?**

`normalizeExpressionBlend` (and a `normalizeMotionBlend` beside it) must default
to **0** so that a rig which does not declare a blend plays exactly as it does
today — that is backward compatibility and is not negotiable.

But `createCleanProjectState` is a different question. A new mascot made in this
editor could start at 120 ms and simply feel better, at the cost of regenerating
the Basic Face export fixture that `ux23-legacy-removal.spec.js` compares against.

**Recommended: yes, 120 ms for new projects**, and regenerate the fixture as part
of that change — a fixture exists to catch accidents, and this would be a
decision. That is deliberately left for whoever takes this ADR, because it is the
one part that changes what an existing test asserts.

## Sketch of the implementation

Roughly a day, mostly in `runtime.js`:

1. Replace `let animation` with `let motions = []` (cap 4, like the reaction
   controller's retiring list) and a `createWeightBlender` keyed by clip id.
2. `playMotion(id, { layer, fade })`: `blender.transitionTo(id)` by default,
   `blender.set(id, 1)` when layering.
3. In `composed()`, push one `{ source: 'motion', mode: 'weightedOverride',
   weight }` layer per clip, in start order, and drop a clip once its weight
   reaches 0 and it is past its duration.
4. `normalizeMotionBlend` + `motionBlend` on the document, in the `animation`
   domain, with a control beside the expression cross-fade.
5. The preview controller follows the same three lines it already follows for
   the reaction layer — it now composes through `mixParameters`, so this is
   additive rather than a rewrite.
6. `docs/KNOWN_LIMITATIONS.md` loses "there is still no clip blending or
   layering at runtime".

The exported runtime grows by roughly the size of the blender it already
imports for expressions, i.e. nothing.
