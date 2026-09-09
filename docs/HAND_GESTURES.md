# Hand gestures

A **gesture** is a reaction raising a hand pose for as long as it runs.

```text
Reaction: Hello

Expression:  Happy
Motion:      SmallBounce
Right Hand:  Wave
```

That is the whole feature. A reaction does not animate a hand: it raises the
hand's own pose parameter, which reaches the same
[parameter mixer](PARAMETER_MIXER.md) as everything else.

## The record

```js
{
  id: 'hello',
  trigger: { type: 'click' },
  expression: { id: 'happy', weight: 1 },
  motion: { clipId: 'body-bounce' },
  gestures: [{ side: 'right', pose: 'wave', weight: 1 }],
  timing: { attack: 0.2, hold: 1, release: 0.4 },
  after: 'return'
}
```

## One naming rule

A hand pose is driven by one parameter, named the same way everywhere —
`handPoseParameterName(side, poseId)`:

```text
right + wave      → handRWave
left  + thumbsUp  → handLThumbsUp
```

## A hand that shows drawings

A hand with a library of drawings ([hand styles](HAND_STYLES.md)) has no per-pose parameter:
it has one `handRStyle`, and a hand is an **index** into the drawings its
library holds. Names resolve through the style registry, so a gesture asking for
a `wave` finds the open hand and one asking for a `grab` finds the fist. A
gesture reaches it all the same — the reaction names a pose, and what that name
writes is the one thing that differs:

```text
older hand       handRWave = 0.4 · envelope        eased, like everything else
a hand today     handRStyle = <index of 'open'>    struck once the envelope is half in
```

An index cannot be eased: halfway between two drawings is not a drawing. So it
is a threshold rather than a ramp — the discrete interpolation a choice is
keyframed with anyway. A gesture naming a drawing the hand does not hold writes
nothing at all, rather than putting the wrong one on screen.

`wave` is an open hand, so a Wave gesture strikes `open` and the waving is the
clip's rotation — which is what a wave always was here.

The Hands panel writes it, the hand commands create it, and reactions raise it.
There is one function, so the three cannot drift.

## Timing

A gesture follows exactly the envelope its reaction follows — attack, hold,
release — the same one the reaction's expression follows. A test asserts the
two weights are equal at every point, so a wave can never lag behind the smile
it belongs to.

`weight` caps a gesture below full, and `after: 'stay'` keeps it raised once the
reaction ends, exactly as a stayed expression stays. Firing a returning reaction
clears a previously stayed gesture, so a "stay" reaction followed by a "return"
one lets the hand go.

Both hands can gesture at once, independently.

## Composition

Because a gesture is a parameter, it composes with everything:

* the hand's own `handRX` / `handRY` / `handRRotation` still apply;
* the reach ellipse still bounds it;
* inertia still lags it;
* a hand pose driven by a shape key still blends additively with the others.

Nothing about a reaction is a special case in the renderer.

## Diagnostics

A reaction whose gesture names a pose the hand no longer has is reported as a
warning:

> Reaction "Hello" uses a hand pose that no longer exists: right hand, peace.

The reaction editor only offers poses that actually exist, so authoring one is
not possible in the first place; the warning is for a pose deleted afterwards.
A reaction with **only** a gesture is not empty, and the "does nothing yet"
message now names all three options: an expression, a motion, or a hand gesture.

## Tests

`hand-gestures.test.js` covers the shared naming rule, normalization and the
dropping of malformed entries, the attack/hold/release envelope, envelope parity
with the expression, partial weights, stay and return, both hands at once, the
"only a gesture is not empty" rule, the missing-pose diagnostic, and the command
guard that refuses a pose the hand does not have.
