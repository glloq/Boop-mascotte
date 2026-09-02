# Responsive, touch and input strategy

## Principle

Responsive behavior changes the **job and composition**, not only widths. Breakpoints are starting ranges validated by content, zoom and device testing; CSS must not assume device identity.

| Mode | Starting range | Composition | Panel behavior | Canvas behavior | Primary jobs |
|---|---:|---|---|---|---|
| Desktop large | >=1280 px | 240 nav + flexible Canvas + 320 Inspector; optional bottom | both persistent/collapsible | dominant, minimum 520 px practical width | full authoring |
| Laptop | 900–1279 px | compact nav + Canvas; Inspector overlay or pinned by space | remember collapse in UI prefs; bottom resizable | zoom/fit remains reachable | full authoring with progressive panels |
| Tablet | 600–899 px | app bar + Canvas + nav drawer + one bottom sheet | sheet has collapsed/half/full detents; never nav and inspector overlays together | gestures plus explicit zoom/fit; mode banner | setup review, expressions/simple motion/reactions, preview |
| Mobile | <600 px | full-width Canvas/Preview + 4 primary destinations + modal sheet | exactly one sheet; safe-area aware | preview-first; editing handles only for supported small edits | preview, apply/edit simple items, readiness/export |

Orientation does not switch product capability automatically; landscape may offer more pinned space. At 200% browser zoom, desktop must gracefully enter a narrower composition without loss of controls.

## Panel and navigation contracts

- UI preference owns pinned/collapsed/detent state; `ProjectDocument` never does.
- Opening Inspector on tablet collapses navigation drawer. Back/Escape closes the topmost surface before changing workspace.
- Bottom sheet header states subject and provides Close; swipe is optional, never the only mechanism.
- Timeline bottom surface has a minimum usable height; if unavailable, open full-screen on tablet and declare unavailable on mobile.
- Popovers that would clip become sheets. Dialogs remain dialogs for destructive/replacement decisions.
- Deep links open the required destination and appropriate sheet, then focus/announce the issue.

## Canvas behavior

- Preserve center/zoom when opening panels where possible; `Fit selection` and `Fit mascot` remain explicit.
- Touch: one finger selects/manipulates in active mode; two fingers pan/zoom. Prevent page scroll only inside an active canvas gesture.
- Avoid gesture ambiguity during role assignment: tap selects candidate; a clear Confirm commits if candidate confidence/overlap is ambiguous.
- Selection handles meet 44 px hit area without visually scaling artwork handles excessively.
- Keyboard users can select from Layers/roles and edit numerically without Canvas dragging.
- Preview intercepts click/hover only while simulator capture is visibly armed; otherwise navigation controls remain operable.

## Mobile capability policy

| Capability | Mobile policy | Rationale/alternative |
|---|---|---|
| Preview/focus/reset/live controls | Full | Core consumption/test job |
| Expressions | List, apply, intensity, rename/duplicate; simple control edit | Touch-safe, common |
| Reactions | List, enable/test, simple When/Do/After edits | Compact form possible |
| Simple Motion | Apply preset and adjust coarse parameters | No precision keys |
| Idle & Automatic | Toggle and safe preset controls | Compact |
| Readiness/export/save | Full, including deep links where fix supported | Core completion job |
| Face role assignment | Limited to clear tap assignments; complex overlap review prompts larger screen | Precision/ambiguity |
| Layers/SVG transforms | select, visibility, coarse/numeric small edit only | Dense hierarchy/handles |
| Calibration | test existing; capture only with explicit supported role/control | Avoid accidental destructive precision edits |
| Morph node editing | Unavailable | Precision topology work; explain handoff |
| Advanced bindings/constraints | Read-only summary | Dense technical forms |
| Timeline/state graph | View/play only or unavailable | Precision and viewport requirements |
| Import complex SVG | Allowed, but detailed reconciliation can be deferred | Do not trap user after file selection |

No data becomes inaccessible: unavailable authoring shows why and recommends tablet/desktop; save/export/open remain available when otherwise valid.

## Touch targets and input

- Minimum interactive target: 44×44 CSS px touch; 32×32 only in dense mouse/keyboard desktop toolbars with adequate spacing.
- Space between destructive and primary touch targets: >=8 px; destructive actions never depend on long press.
- Hover content has focus/tap equivalents. Pointer type is capability-detected, not inferred only from viewport.
- Hardware keyboard on tablet gets desktop shortcuts where the surface supports them.
- Shortcut scopes: Global, Canvas, Inspector, Timeline. Text editing suppresses destructive/global character shortcuts.

## Keyboard baseline

`Tab/Shift+Tab` follows landmarks; arrow keys navigate trees/segmented controls; Enter/Space activates; Escape cancels mode/closes surface; Delete requires correct context; platform undo/redo works. `/` or platform shortcut may open Search/Command Palette only after the command registry exists. A shortcut overlay lists active scope.

## Accessibility/responsive test matrix

Each responsive PR tests 320×568, 390×844, 768×1024, 1024×768, 1280×720 and 1440×900; portrait/landscape where relevant; keyboard-only; touch emulation; 200% zoom; reduced motion; light forced-colors/high contrast where supported; long translated-like strings even before localization. Automated assertions cover no unreachable primary action, focus restoration, accessible names, and no horizontal page scroll. Visual regression complements—not replaces—task E2E.
