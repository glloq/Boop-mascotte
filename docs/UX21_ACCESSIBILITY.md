# UX-21 — Accessibility and keyboard release gate

## Baseline

UX-21 closes the gaps left across the completed IA (UX-02 → UX-20) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`. Every slice already carried names, roles, focus and Escape rules; this slice audits them together against WCAG 2.2 AA and adds the missing structure.

## Delivered

- Landmarks and skip link: `header` (Project bar), `main` (Workspace), `aside` (Tasks and tools; Inspector and preview) and `footer` (Timeline) are labelled; a visually hidden **Skip to canvas** link is the first tab stop and moves focus to the canvas (`tabindex="-1"`).
- Shortcut registry and help (`ui/shortcuts.js`): one list drives the global key handler and the **?** help dialog (`#shortcut-help`), grouped by scope (Global, Artwork, Animate, Timeline, Preview). Character shortcuts never fire while typing; Escape always does.
- Escape order: menu → command palette → shortcut help → popovers (Problems, Export, Advanced tools, capabilities) → drawer → sheet → Home → Focus Preview → canvas mode; closing a popover returns focus to the control that opened it.
- Reduced motion: `prefers-reduced-motion: reduce` removes every UI transition and animation (drawer, sheet, toast, chips); the mascot preview itself stays under the user's control (Reset mascot, Preview toggles).
- Status: the toast is `role="status" aria-live="polite"`; errors keep the same live region with an error tone.

## WCAG 2.2 AA audit (editor UI)

| Criterion | Status | Evidence |
|---|---|---|
| 1.1.1 Non-text content | Pass | Icon buttons carry `aria-label`; the mascot SVG keeps its `aria-label`; readiness symbols are `aria-hidden` with text beside them. |
| 1.3.1 Info and relationships | Pass | Landmarks, headings per panel, lists for checklists/results, `<dl>` for counters and shortcuts, labelled form fields. |
| 1.4.3 Contrast | Pass | Body text #e5e7eb, secondary #c7d5e9 / #b8c6dc on #101a2d–#121c30 (≥ 7:1); warning #fde68a on #3a2f16 (≥ 9:1); links #9fd4ff on #101a2d (≥ 8:1). |
| 1.4.10 Reflow | Pass | Tablet and phone compositions (UX-19/20); no horizontal page scroll at 320 px. |
| 1.4.11 Non-text contrast | Pass | Focus ring #79adff and control borders #3b4c68+ on dark surfaces. |
| 2.1.1 Keyboard | Pass | Every action is a button, link, input or dialog; canvas work has Layers, checklists and numeric fields as alternatives. |
| 2.1.2 No keyboard trap | Pass | Dialogs are native `<dialog>`; popovers close on Escape and return focus. |
| 2.1.4 Character key shortcuts | Pass | Single-character shortcuts (?, tools) are suppressed in text fields; modifier shortcuts elsewhere. |
| 2.4.1 Bypass blocks | Pass | Skip to canvas link; landmarks. |
| 2.4.3 Focus order | Pass | DOM order follows the visual order; opening a surface moves focus into it, closing returns it. |
| 2.4.7 Focus visible | Pass | `:focus-visible` outline on all controls. |
| 2.4.11 Focus not obscured | Pass | Popovers and sheets sit above content and receive focus themselves. |
| 2.5.3 Label in name | Pass | Visible text matches accessible names (exact labels used by the browser tests). |
| 2.5.7 Dragging movements | Pass | Every drag (pads, sliders, canvas posing) has arrow keys or numeric input. |
| 2.5.8 Target size | Pass | 44 px targets below 900 px; 24 px minimum on desktop toolbars with spacing. |
| 3.2.1 / 3.2.2 On focus / on input | Pass | Changes commit on explicit change events; no navigation on focus. |
| 3.3.1 / 3.3.3 Error identification and suggestion | Pass | Readiness and Export explain each problem with a Fix or an explicit handoff. |
| 4.1.2 Name, role, value | Pass | Native controls, `aria-pressed` on toggles, `aria-selected` in listboxes, `aria-expanded` on the drawer toggle; the ID/ARIA reference audit runs in CI. |
| 4.1.3 Status messages | Pass | Toast live region; panels use `role="status"` for notices. |

Manual screen reader matrix (NVDA + Firefox, VoiceOver + Safari, TalkBack + Chrome) is scheduled per release; the automated gates cover names, roles, references, keyboard journeys and reduced motion.

## Canvas alternatives

Assigning parts: checklist **Select** and the manual element picker. Calibration: numeric ranges in the Movement Inspector. Transforms: numeric fields in the Artwork inspector. Testing: Preview sliders and pads with arrow keys; reactions through the simulator buttons.

## Tests

- Unit (`core/tests/shortcuts.test.js`): every registered shortcut matches, character keys stay quiet while typing, Escape always works, help markup lists every shortcut in scope order.
- Browser (`tests/e2e/ux21-accessibility.spec.js`): landmark labels, skip link focus, `?` help, Escape closing Problems and Export with focus return, typing `?` in a field, reduced motion transitions at 0 s with the drawer still functional, toast live region. The existing ID/ARIA audit keeps running in the critical suite.

## Deferred

Automated axe scanning (tooling not adopted in this repository), high-contrast forced-colors tuning (UX-22 visual pass).
