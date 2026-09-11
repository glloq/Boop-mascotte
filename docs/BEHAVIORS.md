# Behaviors

A **Behavior** adds automatic, procedural motion over the current State and Animation result. The catalog exposes every runtime-supported type:

- **Automatic Blink** temporarily overrides its target with the closed value, then restores the underlying animated pose.
- **Random Idle** adds an occasional value in the configured range.
- **Oscillation** continuously adds a sine-wave offset. Sine is the only supported waveform.

Targets use the shared semantic control catalog while retaining the raw parameter id in secondary text. Missing targets remain visible and editable. Behavior ids are stable across render and save; duplication alone creates a new id.

Composition follows the existing runtime pipeline: State interpolation, Animation track values, Behaviors, then live editor overrides. Oscillator and Random Idle values are additive; an active Blink overrides its target temporarily. Behavior array order is not user-significant for the supported types except that multiple operations on the same target naturally compose in array order, so this release does not add reordering UI.

## V2 — cartoon idle behaviours

V2 adds one runtime primitive, `drift`, and a set of presets built from it and
the existing types. The rule for all of them: a mascot should look **alive**,
never look like it is shivering.

### `drift`

A smooth random walk with rests:

```text
pick a target inside ±amplitude
 ↓
ease to it over travelMin…travelMax seconds
 ↓
rest for intervalMin…intervalMax seconds
 ↓
repeat, starting from where it is
```

| Setting | Meaning |
| --- | --- |
| `amplitude` | how far from rest it may go, in parameter units |
| `travelMin` / `travelMax` | how long one move takes |
| `intervalMin` / `intervalMax` | how long it rests between moves |

Easing is `easeInOut`, so there are no visible steps — which is exactly what
`randomIdle` lacked. Each drift keeps its own state, so two of them on
different parameters never share a value.

### Presets

| Preset | Built from | Parameters |
| --- | --- | --- |
| Blink | `blink` | `eyeOpen` |
| Natural gaze | `randomIdle` | `lookX`, `lookY` |
| Eye wander | `drift` | `lookX` (±0.25), `lookY` (±0.15) |
| Idle head movement | `oscillator` | `headY` |
| Head drift | `drift` | `headX` (±0.08), `headY` (±0.06) |
| Idle hands | `oscillator` | `handLY`, `handLRotation`, `handRY`, `handRRotation` |

A preset whose movement the project does not have is reported **unavailable**,
not broken. No preset is mandatory.

### The two that left, and what would bring them back

**Breathing** (`oscillator` on `bodyBounce`, 0.22 Hz) and **Tiny body bounce**
(the same parameter at 0.8 Hz) shipped with V2 and were removed in V3-10. They
were never switchable on: `bodyBounce` is a parameter *nothing in the editor
defines* — it is in no `BASIC_MOVEMENTS` entry, no semantic part owns a body,
and no template creates it — so both cards read **unavailable** to every
project that has ever existed, and the Face Setup button they offered led to a
checklist with nothing on it to turn on.

Retargeting them was not an option either. `deriveAutomaticStatus` and
`matchBehavior` recognise a preset by **type + parameter**, so a second
`oscillator` on `headY` would be indistinguishable from Idle head movement:
two cards, one switch.

What they are waiting for is a **body** — a semantic part, a role to assign, a
calibration and a turn profile — which is a Face Setup feature and not an idle
preset. When one exists the recipe above is all they need, unchanged. A card
that can never be switched on is the one thing a surface that says *what runs
when* must not contain (V3-10).

### Blink details

* `doubleChance` gives an occasional double blink — a *short second close*,
  never a longer one.
* A blink never fights an expression that is already closing the eyes: it takes
  the smaller of the two, so "angry, eyes narrowed" does not pop open when a
  blink ends.

### Per-behaviour state

The controller now reports `contributions` and `closed` keyed by behaviour id.
Two random idles or two drifts no longer share a value, which they did before
V2. The older shared fields (`blinkActive`, `randomValue`) remain as the
fallback, so existing rigs behave exactly as they did.
