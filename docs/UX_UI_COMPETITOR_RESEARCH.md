# Competitor and pattern research

**Research date:** 2026-09-02. Sources are first-party product documentation/help pages. This is pattern research, not a proposal to copy any complete interface. Product details should be rechecked when implementing the relevant slice.

| Software | Pattern | Strength | Weakness / transfer risk | Applicable to Boop | Proposed adaptation | Source |
|---|---|---|---|---|---|---|
| Rive | Design/Animate separation; state machines, listeners and events | Clear distinction between authored animation and interactive orchestration | State-machine vocabulary is still expert-heavy | Separate pose/time/reaction and provide event testing | Expression/Motion authoring feeds a simplified Reaction builder; retain graph in Advanced | [Rive editor fundamentals](https://rive.app/docs/editor/fundamentals), [state machines](https://rive.app/docs/editor/state-machine), [listeners](https://rive.app/docs/editor/state-machine/listeners) |
| Live2D Cubism | Parameter palette, keyforms, automatic mesh/deformer workflows | Visual extremes tied to semantic parameters are learnable | Dense modeling UI and specialist terminology | Directly relevant to gaze/mouth calibration | Low/neutral/high “Capture” cards and Basic control shortlist | [Cubism parameter palette](https://docs.live2d.com/en/cubism-editor-manual/parameter-palette/), [keyforms](https://docs.live2d.com/en/cubism-editor-manual/edit-keyform/) |
| Spine | Tree + viewport + dopesheet; constraint tooling | Strong hierarchy and expert time editing | High learning curve; rig structure dominates | Layers and advanced motion | Keep Timeline and hierarchy capable, but place behind simple Motion presets | [Spine user guide](https://esotericsoftware.com/spine-user-guide), [dopesheet](https://esotericsoftware.com/spine-dopesheet) |
| Adobe Character Animator | Rig/Record modes; triggers and behaviors | Performer-oriented triggers make runtime actions tangible | Adobe-specific capture/performance model; crowded properties | Event simulator and friendly Automatic controls | “When / Do / After” Reaction cards and test buttons | [Triggers and controls](https://helpx.adobe.com/adobe-character-animator/using/triggers.html), [behaviors](https://helpx.adobe.com/adobe-character-animator/using/behaviors.html) |
| Figma | Selection-driven right properties; contextual toolbars; multiplayer-independent canvas model | Predictable “select then edit,” canvas stays primary | Generic design inspector can become very long | One selection → one Inspector | Stable inspector location, sections ordered basic before advanced | [Figma design basics](https://help.figma.com/hc/en-us/categories/360002051613-Design) |
| Canva | Template-first onboarding and progressive controls | Fast first success; presets communicate outcomes | Can hide precision and create “magic” ambiguity | Home/templates and Expression/Motion presets | Previewable templates with included features/readiness; always allow manual correction | [Canva Design School](https://www.canva.com/designschool/) |
| Spline | Web-first scene editor, events/actions and preview | Interaction authoring is immediate and browser-native | 3D concepts and event complexity exceed Boop needs | Reaction event testing | Compact action sequence with explicit trigger and result | [Spline events](https://docs.spline.design/events) |
| Blender | Workspaces, properties context, search/operator discoverability | Scales from novice task areas to deep expert tools | Density, modes and shortcut burden are dangerous | Advanced area and command palette | Task navigation plus searchable commands; never emulate Blender density | [Blender interface](https://docs.blender.org/manual/en/latest/interface/index.html), [workspaces](https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html) |
| After Effects | Layer timeline, presets, graph/editor separation | Precise temporal authoring and reusable presets | Timeline-first workflow is intimidating | Advanced Motion and presets | Preset first, “Open in Timeline” escape hatch | [Animation presets](https://helpx.adobe.com/after-effects/using/animation-presets-effects.html), [animation basics](https://helpx.adobe.com/after-effects/using/animation-basics.html) |
| Godot | Node/Inspector model, AnimationPlayer, signals | Selection context and explicit event connections are debuggable | Engine/node terminology leaks readily | Diagnostic deep links and Reaction internals | Human Reaction summary with Advanced mapping details | [Godot editor introduction](https://docs.godotengine.org/en/stable/getting_started/introduction/first_look_at_the_editor.html), [signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html) |
| Unity Animator | Parameters, states, transitions and live debug | Mature visual debugging for runtime state | Graphs encourage technical state-machine thinking | Existing States/Transitions in Advanced | Preserve state graph for experts; never make it prerequisite for an Expression | [Animator Controller](https://docs.unity3d.com/Manual/class-AnimatorController.html) |
| Procreate Dreams | Touch-first stage/timeline, gestures, focused performance | Treats touch as a distinct interaction model | Gesture discoverability and platform specificity | Tablet motion preview and sheets | Large direct controls and explicit alternatives to hidden gestures | [Procreate Dreams handbook](https://help.procreate.com/dreams/handbook/introduction) |

## Cross-product findings

- **Selection:** Figma/Godot/Blender reinforce a stable context region; Boop should centralize selection and avoid multiple active inspectors.
- **Rigging/calibration:** Cubism demonstrates the value of parameter keyforms; Character Animator demonstrates semantic, outcome-oriented behaviors. Boop can generate V2 bindings from captured visual endpoints.
- **Timeline:** Spine/After Effects show that a capable timeline is valuable but dense. It is an expert expansion of Motion, not the entry point.
- **States/events:** Rive/Unity/Godot prove graph power and debugging value. Their complexity supports keeping Boop State Machine in Advanced while providing Reaction summaries.
- **Presets:** Canva/After Effects provide rapid success, but presets must remain inspectable and reversible.
- **Preview:** Rive, Spline and Character Animator place interaction testing near authoring. Boop needs a simulator that requires no host integration.
- **Responsive:** Dreams demonstrates designing for touch rather than shrinking desktop. Mobile should intentionally omit precision-heavy authoring.

## 10 UX Principles for Boop Mascotte

1. **Start with the intended outcome, not the engine object.**
2. **Keep the mascot Canvas visually and interactively dominant.**
3. **One selection owns one contextual Inspector.**
4. **Make the next safe action obvious, but never trap users in a wizard.**
5. **Use progressive disclosure: Basic, More, Advanced.**
6. **Capture visual keyforms; generate mathematical bindings behind the scenes.**
7. **Keep Expression (pose), Motion (time), Reaction (orchestration) and State (runtime) distinct.**
8. **Make every readiness issue explainable, actionable and deep-linkable.**
9. **Treat preview changes as transient and authored changes as explicit, undoable commands.**
10. **Design touch/mobile jobs independently; do not stack desktop sidebars.**
