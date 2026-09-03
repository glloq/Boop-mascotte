# Continuous transitions

The failure this exists to prevent:

```text
Animation A
     ↓
RESET NEUTRAL      ← never
     ↓
Animation B
```

Every change must start from **the pose currently on screen**:

```text
current evaluated pose
       ↓
capture the current parameter vector
       ↓
new target
       ↓
interpolate
```

So `Happy → Angry` cross-fades the two. It does not detour through `Neutral`,
and it does not snap.

Implementation: `project/runtime/transitions.js`.

## Weight blender

`createWeightBlender({ duration, easing })` ramps expression weights instead of
switching them.

* `set(id, weight, { duration, easing })` captures the weight **currently
  showing** as the start of the ramp, so retargeting mid-transition continues
  from where the eye is rather than restarting from zero.
* `transitionTo(id)` raises one weight while lowering every other over the same
  span. The two overlap, so something is always showing.
* `values()` is what the renderer should use — what is showing.
* `targets()` is what a caller asked for — what `getExpressions()` reports.
* `settled()` says whether anything is still moving, which is how the preview
  and the engine know to keep animating.

```text
happy 1.0 ──╮
             ╳     ← both non-zero throughout
angry 0.0 ──╯
```

A duration of `0` reproduces the pre-V2 instant switch exactly, and that is the
default: a rig that configures no blend behaves as it always did.

## Configuring a blend

```js
rig.expressionBlend = { duration: 200, easing: 'easeInOut' }
```

Per call: `engine.setExpression('happy', 1, { duration: 300 })`, or
`engine.transitionToExpression('angry')` for a cross-fade to a single
expression. The preview controller reads the same setting and exposes the same
methods, so the editor and an exported mascot behave identically.

## Parameter transitions

`createParameterTransition(from, to, { duration, easing, at })` interpolates
between two parameter vectors. The important part is not the interpolation but
where `from` comes from: the caller captures **the vector on screen at the
moment of the change**. `engine.setState()` has always done this, which is why
state changes were already continuous; expressions now do it too.

## Expression routes

Deliberately not built. A route graph would only add value over continuous
parameter interpolation if it encoded something interpolation cannot express,
and so far nothing does. Continuous interpolation first; a route system only if
a concrete mascot needs one — and never a general graph solver
(`docs/FUTURE_OUT_OF_SCOPE.md`).

## What must never happen

During `Happy → Angry → Surprised → Happy`, while `headX` is changing, a blink
is running and a hand is waving, there must be no visible reset, no forced
neutral frame, no position jump, no scale jump, and no abrupt hand change.

`mixer-transitions.test.js` walks that exact sequence and asserts that the total
expression weight never falls to zero between poses.
