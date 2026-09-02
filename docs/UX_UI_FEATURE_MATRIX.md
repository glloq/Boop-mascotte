# UX/UI feature matrix

## Legend

- Existence columns use **Y**, **P** (partial) and **—**.
- Delivery class: **usable**; **UI** (new UI only); **editor data**; **runtime**; **schema**; **future**. Multiple classes mean staged work.
- Priorities: P0 core journey, P1 strongly useful, P2 advanced, P3 future.
- No schema/runtime change is authorized by UX-00.

| Feature | Current location | Exists | Partial | Missing | Current UX | Target UX | Target workspace | Decision | Pri. | Dependencies / delivery class | Schema/runtime impact |
|---|---|:---:|:---:|:---:|---|---|---|---|:---:|---|---|
| Artwork import | File menu, sanitizer, SVG document | Y |  |  | file-first | guided import + warnings | Artwork/Home | IMPROVE/MOVE | P0 | usable + UI | none |
| Face Builder | Create templates/features | Y | P |  | starters split across cards/features | template-first New Mascot | Home/Artwork | MOVE/IMPROVE | P0 | usable + UI | none |
| SVG editing | Canvas + Inspector | Y | P |  | direct transform/morph | focused artwork tools | Artwork | KEEP/IMPROVE | P1 | usable + UI | none |
| Layers | left panel | Y | P |  | nested tree/filter/actions | stable collection + role badges | Artwork | KEEP | P1 | usable + UI | none |
| Inspector | right panel(s) | Y | P |  | competing contexts | one selection/one inspector | all | MERGE | P0 | UI + session selection | none |
| Semantic Parts | Rig panel/model | Y | P |  | part catalog/roles | required roles checklist | Face Setup | MOVE/IMPROVE | P0 | usable + UI | none |
| Semantic Rig | Rig model/commands | Y | P |  | generated controls and internals | invisible bridge + Advanced details | Face Setup/Advanced | KEEP/HIDE ADVANCED | P0 | usable + UI | none |
| Face Controls | Rig controls/catalog | Y | P |  | broad per-part controls | Basic shortlist + More | Face Setup/Preview | IMPROVE | P0 | UI; availability mapping | none |
| Calibration | Rig Calibrate | Y | P |  | low-level per part/method | visual guided capture | Face Setup | IMPROVE | P0 | usable + UI | none initially |
| Keyforms | calibration poses |  | P |  | implementation concept | low/neutral/high Capture cards | Face Setup | MERGE | P0 | UI; editor metadata later | maybe schema if metadata persists |
| Bindings | Inspector/core | Y |  |  | formula/property authoring | generated normally, editable expert | Advanced | HIDE ADVANCED | P2 | usable | none |
| Morphs | Inspector/Rig/Canvas | Y | P |  | topology-constrained editor | selected visual endpoint capture | Face Setup/Advanced | IMPROVE/HIDE | P2 | usable + UI | none |
| Constraints | Inspector/runtime | Y |  |  | engine scale controls | expert guardrails | Advanced | HIDE ADVANCED | P2 | usable | none |
| States | Animate state editor/runtime | Y |  |  | runtime pose snapshots | explicit Advanced State Machine | Advanced | MOVE/HIDE | P2 | usable | none |
| Transitions | graph/inspectors/runtime | Y | P |  | directed state graph | Reaction summary; graph expert | Advanced | HIDE ADVANCED | P2 | usable; Reaction mapping later | likely runtime/schema for Reaction |
| Behaviors | Animate catalog/runtime | Y | P |  | blink/oscillator objects | friendly Automatic cards | Idle & Automatic | REPLACE UI | P1 | UI for existing types; runtime additions | additions require runtime/schema |
| Expressions | none; States approximate |  |  | Y | no distinct entity | reusable semantic pose | Expressions | REPLACE/ADD | P0 | editor data → schema ADR | schema; runtime mapping TBD |
| Expression presets | examples/templates only |  | P |  | not a reusable catalog | Neutral/Happy/Sad/Angry/Surprised/Sleepy/Confused/Excited | Expressions | ADD | P1 | Expression model | editor/schema data |
| Expression intensity | none |  |  | Y | unavailable | 0–100% preview/application | Expressions/Preview | ADD | P1 | Expression semantics | runtime/schema possibly |
| Expression CRUD/capture | State CRUD only |  | P |  | state semantics | duplicate/rename/delete/capture current face | Expressions | ADD | P0 | Expression commands | schema |
| Motions | animation clips |  | P |  | clip/time model | named simple or complex Motion | Motion | REPLACE UI | P1 | clip adapter + editor data | schema metadata maybe |
| Motion presets | sample clips only |  | P |  | examples, not authoring presets | Nod/Shake/Bounce/Tilt/Look Around/Eye Dart/Head Pop | Motion | ADD | P1 | preset compiler | editor data/schema metadata |
| Motion parameters | Timeline keys |  | P |  | manual keys | amplitude/speed/duration/loop | Motion | ADD | P1 | preset compiler | none if compiled; metadata issue |
| Timeline | Animate bottom panel | Y |  |  | capable dope sheet | complex Motion editor | Advanced | MOVE/KEEP | P2 | usable + routing | none |
| Reactions | none |  |  | Y | no orchestration | When/Expression/Motion/Timing/After | Reactions | ADD | P0 | Expression + Motion + ADR | schema + runtime |
| Triggers | external runtime calls/transition graph |  | P |  | no authored click/hover model | Click/Hover/Timer/custom | Reactions | ADD | P0 | Reaction model/event contract | runtime/schema |
| Priority/interrupt/return | transitions partly |  | P |  | no coherent policy | Advanced Reaction options | Reactions | ADD | P1 | Reaction ADR | runtime/schema |
| Preview | PreviewController/workspace | Y | P |  | examples/live state tests | integrated test environment | Preview | IMPROVE | P0 | usable + UI | none initially |
| Event simulator | none |  |  | Y | host integration required | local trigger toolbar/log | Preview | ADD | P0 | Reaction/event contract | runtime adapter; simulator session-only |
| Validation | validator/cache/export policy | Y | P |  | technical problem list | continuous plain guidance | global | IMPROVE | P0 | usable + diagnostic metadata | none |
| Readiness | Problems/export |  | P |  | count/popover | task completion + blockers | Project/Export | REPLACE | P0 | validation routes/session nav | none |
| Export | top popover/exporter | Y | P |  | 3 direct downloads | dedicated readiness workspace | Export | IMPROVE/MOVE | P0 | usable + UI | formats unchanged |
| Save/Open | top file actions/snapshot | Y | P |  | local file lifecycle | Home/recent/resume clarity | Home/global | IMPROVE | P0 | usable + UI | format unchanged |
| Templates | preset library/template loader | Y | P |  | Create cards | preview capabilities/readiness | Home | MOVE/IMPROVE | P0 | usable + UI | none |
| Autosave | main/local storage | Y | P |  | local background persistence | recovery card, privacy/quota status | Home/global | IMPROVE | P1 | usable + UI | none |
| Undo/Redo | history/top/keyboard | Y | P |  | global buttons/shortcuts | named action feedback, context safe | global | KEEP/IMPROVE | P0 | usable; command labels | none |
| Responsive | CSS breakpoints |  | P |  | rearranged desktop | adaptive layouts/jobs | all | REPLACE | P1 | shell primitives | none |
| Accessibility | native/ARIA/focus fragments |  | P |  | uneven | WCAG-oriented acceptance gates | all | IMPROVE | P0 | every slice + audit | none |
| Keyboard | history/timeline/Escape |  | P |  | undocumented/local | discoverable scoped map | global | IMPROVE | P1 | command registry | none |
| Touch | pointer Canvas, mobile CSS |  | P |  | small/dense targets | >=44 px, sheets, explicit gestures | tablet/mobile | IMPROVE | P1 | responsive shell | none |
| Search | Layers filter only |  | P |  | local layer filtering | project/task/entity search | global | ADD | P2 | entity index/session query | none |
| Command palette | none |  |  | Y | unavailable | searchable actions/routes/shortcuts | global | ADD | P2 | command registry | none |
| Home/recent projects | none |  |  | Y | starts in editor empty state | New/Open/Recover/templates | Home | ADD | P0 | local metadata/session nav | none |
| Onboarding/checklist | hints/details |  | P |  | scattered hints | resumable recommended steps | Project | REPLACE | P0 | readiness model | none |
| Direct problem links | none |  |  | Y | manual search | Fix route + selection payload | Readiness | ADD | P0 | diagnostic codes/router | none |
| Focus Preview/reset | Preview | Y | P |  | focus/reset fragments | clear persistent test controls | Preview | KEEP/IMPROVE | P0 | PreviewSession | none |
| Gaze/mouth live controls | Rig/preview | Y | P |  | parameter-centric | semantic pads/sliders | Preview | IMPROVE | P0 | control availability | none |
| Debug/diagnostics | lifecycle/e2e snapshots | Y | P |  | developer/internal | Advanced diagnostics | Advanced | MOVE | P2 | usable + UI | none |
| Plugins | plugin registry/settings | Y | P |  | technical settings | Advanced only, future policy | Advanced | HIDE | P3 | future | extension contract TBD |
| Collaboration/cloud/backend | none |  |  | Y | deliberately local | not planned | — | REMOVE/FUTURE | P3 | future only | violates current constraints |

## Capability summary

- **Already usable foundations:** import/sanitize, templates, layers, direct Canvas editing, semantic roles/controls/calibration, generated bindings/morphs, state machine, behaviors, clips/Timeline, non-destructive Preview, validation, save/open/export, history.
- **Requires only new UI/session routing initially:** task shell, Face Setup label/checklist, Basic control filtering, unified Inspector, Preview organization, existing Automatic presentation, readiness summaries (before deep links), responsive panels.
- **Requires editor data addition:** detection suggestions/confidence (transient), onboarding progress derived rather than persisted, simple-motion preset editing metadata, recent-project metadata.
- **Requires schema evolution:** first-class Expressions, Reactions, and possibly lossless simple-Motion preset metadata. These require ADR/migration/versioning before code.
- **Requires runtime evolution:** authored triggers, Reaction interruption/return, any new automatic behavior semantics, potentially Expression intensity application.
- **Future only:** collaboration/backend/cloud sync and plugin productization.
