# Behaviors

Behaviors are reusable, time-based parameter sources shared by editor preview and exported runtime.

## Composition
Each frame is evaluated in this order:

1. parameter defaults and active state values form the base;
2. external calls to `setParam()` update runtime values;
3. enabled behaviors create temporary overrides or additive modulation;
4. bindings compile the final SVG transform, opacity, and morph frame.

Blink is an override only while the eye is closed. If a state sets `eyeOpen` to `0.8`, blink temporarily produces its configured closed value and then returns to `0.8`. Oscillators are additive around the base value (`base + offset + sine × amplitude`). Behaviors never write their effective value into a state.

## Blink
Configure parameter, minimum/maximum interval, close duration, and closed value. The default target is `eyeOpen`.

## Oscillator, breathing, and idle sway
The generic oscillator uses a sine waveform, amplitude, frequency in Hz, and offset. “Breathing” and “Idle sway” are UI concepts that use this same generic engine.

## Runtime control
`setParam(name, value)` and `setState(name)` remain the external-control boundary. `setBehaviorEnabled(id, enabled)` toggles an exported behavior without mutating project data.
