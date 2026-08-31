# Boop Mascot Studio — User guide

## Create project
Use **Start from Sample** for a complete project, or **Build a Face** to create a mascot without design software. The top bar keeps New, Open, Save, Preview, Validate, and Export available.

## Import SVG
Choose **Open SVG**. Scripts and unsafe links are removed. After import, select a named layer and follow the inspector suggestions.

## Layers
Select, rename, reorder, hide, or lock parts in Layers. Layer changes affect the author SVG and survive project saves.

## Parameters
Open **Parameters**, choose a preset or **+ Parameter**, then configure its live value. Names must start with a letter or underscore and be unique. Rename updates states, bindings, morphs, and behaviors; delete reports and cleans references.

## Bindings
Select a part. In Inspector → Rig, choose a parameter, amplitude, offset, and curve for common transforms. Advanced expressions remain available for combinations such as `lookX * .8 + smile * .2`.

## States
Add a state from current values, duplicate it, rename it, then use sliders. Edits are live. At least one state is retained.

## Transitions
In Transitions, check the destinations allowed from the active state. Preview offers From, To, duration, easing, Play, and a scrubber.

## Behaviors
Add Blink or Oscillator in Behaviors. Pick a parameter and tune timing/amplitude. Behavior values are temporary and never overwrite a state.

## Preview
Use **Preview** to test the runtime result. Parameter sliders and transition controls update the SVG directly.

## Save
**Save Project** downloads a lossless project JSON. Ctrl/Cmd+S does the same. Browser autosave is debounced and can be used for recovery.

## Export
Run **Validate**, resolve highlighted errors, then **Export**. Export remains client-only and works on static hosting.
