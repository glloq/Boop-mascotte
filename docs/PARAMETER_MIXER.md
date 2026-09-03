# Parameter mixer

```text
Base State
      +
Expression
      +
Motion
      +
Behavior
      +
Reaction
      +
Live Override
      ↓
Parameter Mixer
      ↓
Final Parameters
```

Before V2, composition was a chain of `{ ...a, ...b }` spreads inside the
engine: the order worked, but nothing declared it and nothing tested it. The
mixer makes the order explicit, gives every layer a named combination mode, and
puts the result under test.

Implementation: `project/runtime/mixer.js`, used by both `createMascotEngine`
and the editor's preview controller.

## Order

```js
MIXER_ORDER = ['base', 'motion', 'reaction', 'expression', 'behavior', 'override']
```

Later layers see the result of earlier ones. `orderLayers()` sorts a list into
this order so a caller cannot get it wrong by accident.

| Layer | What it is | Mode |
| --- | --- | --- |
| `base` | the current state vector, mid-transition included | starting point |
| `motion` | a playing animation clip | `override` |
| `reaction` | the clip a reaction is sequencing | `override` |
| `expression` | named parameter presets at a weight | additive from neutral |
| `behavior` | blink, oscillator, random idle | per behaviour type |
| `override` | live control (`setParameter`) | `override` |

## Modes

| Mode | Rule | Use |
| --- | --- | --- |
| `additive` | `current + (value − neutral) × weight` | translation, corrective rotation |
| `multiplicative` | `current × (1 + (value − 1) × weight)` | scale, opacity factors |
| `override` | `value`, or blended towards it when `weight < 1` | live control, a playing clip |
| `weightedOverride` | `current + (value − current) × weight` | a partially applied pose |

"Neutral" is the parameter's declared default, which is why an additive layer
setting `eyeOpen` (neutral `1`) to `0` contributes `−1` rather than `0`.

## Expressions

Expressions keep their own rule — additive relative to each parameter's neutral,
weighted, then clamped to the parameter's bounds — because that is what makes
`Happy` and `Wide` stack instead of fighting:

```js
Happy = { smile: 0.8, eyeOpen: 0.9, browRaise: 0.2 }
```

An expression is a **preset of parameters**, nothing more. There is deliberately
no second geometry engine behind them: they feed the same mixer as everything
else, and geometry happens once, downstream.

## Reactions

A reaction orchestrates an expression, a motion and — through ordinary
parameters — a hand gesture:

```text
Reaction: Hello
  Expression: Happy
  Motion:     SmallBounce
  Right Hand: Wave
```

Internally it contributes to exactly the same mixer layers. No reaction
introduces an animation engine of its own.

## Clamping

`mixParameters` does not clamp by default; `clampToBounds: true` clamps only the
parameters a layer actually wrote. The engine clamps at the expression stage,
as it always has, so a value driven deliberately past its range by a binding
still gets through.

## Tests

`mixer-transitions.test.js` covers each mode, partial weights, layer order, zero
weights, non-numeric values, neutrals for declared and undeclared parameters,
opt-in clamping, and engine/preview parity.
