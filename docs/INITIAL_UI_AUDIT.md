# Initial UI audit

Before this feature pass, the editor already had lossless SVG import/serialization, hierarchical layers, transform/binding inspection, state interpolation, validation, project snapshots, autosave, presets, Face Builder, plugins, and export.

The main file actions were mixed into the left sidebar as raw file inputs; the empty canvas exposed the full editor; parameter creation/renaming/removal and state lifecycle operations had no UI; transitions were comma-separated text; blink and idle motion were hardcoded `runtimeConfig` fields; preview controls were buried below state controls; validation was only a status sentence; and every store change rebuilt layers, inspector, states, preview, and export UI. Continuous controls also created one history snapshot per input event. This pass surfaces the workflow in the top bar and grouped managers, adds central mutation functions and behavior composition, debounces autosave, and groups continuous history edits.
