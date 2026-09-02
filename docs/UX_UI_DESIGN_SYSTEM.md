# Lightweight UX/UI design system contract

This document defines implementation-neutral tokens and behavior, not a visual redesign. Use CSS custom properties and modular Vanilla JS; introduce no CSS framework.

## Foundations

### Spacing and size tokens

| Token | Value | Use |
|---|---:|---|
| `--space-0` | 0 | reset |
| `--space-1` | 4px | icon/text micro-gap |
| `--space-2` | 8px | compact controls |
| `--space-3` | 12px | card padding |
| `--space-4` | 16px | standard panel rhythm |
| `--space-5` | 24px | section separation |
| `--space-6` | 32px | major grouping |
| `--space-8` | 48px | empty-state rhythm |
| `--target-pointer` | 44px | minimum touch target |
| `--target-dense` | 32px | desktop dense control only |

Avoid arbitrary spacing. Insets respect safe-area environment variables on mobile.

### Type scale

| Token | Size/line-height | Role |
|---|---|---|
| `--text-xs` | 11/16px | metadata only |
| `--text-sm` | 13/18px | controls/body compact |
| `--text-md` | 15/22px | body/default |
| `--text-lg` | 18/24px | section title |
| `--text-xl` | 24/30px | workspace title |
| `--text-2xl` | 32/38px | Home hero only |

System font stack stays acceptable. Use 400 body, 600 labels/actions, 700 titles; do not encode status with weight alone.

### Surface hierarchy

`canvas` (visual stage), `app` (global chrome), `panel` (navigation/inspector), `raised` (popover/card), `modal` (dialog), and `scrim`. Each level needs a border as well as tonal separation. Canvas content must not inherit application status colors.

## Components

- **Buttons:** Primary = one recommended commit per region; Secondary = normal action; Ghost = toolbar/navigation; Destructive = delete after impact is known; Icon-only requires accessible name and tooltip. Disabled controls explain why nearby.
- **Inputs:** visible persistent label, help/error slot, never placeholder-only. Commit on deliberate change/blur as specified; continuous transforms use one history transaction.
- **Sliders:** label, numeric value, min/max semantic endpoints, keyboard arrows, reset affordance. Drag is transient or one coalesced authored command—never dozens of undo entries.
- **Segmented controls:** 2–5 mutually exclusive views or modes, arrow-key navigation, selected state exposed; not a substitute for global navigation.
- **Cards:** use for templates/presets/readiness summaries, not every field. Whole-card click and nested actions must not conflict.
- **Lists/trees:** selected, hover and keyboard focus are distinct. Preserve focus across rerender. Trees expose level/expanded state and have a flat mobile alternative.
- **Selection:** Canvas highlight, collection highlight and Inspector heading describe the same central selection. A mode selection (e.g. role to assign) uses a different visual treatment.
- **Status:** info, success, warning and error use icon + label + color. “Blocking” is explicit and reserved for inability to continue/export.
- **Dialogs:** named, focus trapped, Escape closes unless destructive commit is running, initial focus safe, trigger focus restored. Use for blocking decisions only.
- **Tooltips:** delayed on hover, immediate on keyboard focus, never contain essential-only instructions, dismissible, viewport-safe.
- **Empty states:** state what is absent, why it matters and one primary next action; optional example/learn link.

## Feedback and readiness

| State | Meaning | Required content |
|---|---|---|
| Neutral | not started/optional | label and next action |
| In progress | incomplete but usable | completed/remaining items |
| Success | requirements satisfied | concise confirmation/count |
| Warning | quality/optional gap | consequence; non-blocking label |
| Error | failed operation/invalid item | cause + recovery |
| Blocking | cannot export/continue safely | affected artifact + `Fix` deep link |

Toasts announce completed transient operations; they never carry the only error recovery. Long operations show inline progress and remain cancelable when safe.

## Focus, accessibility and motion

- Visible focus ring has >=3:1 contrast and is never removed.
- Logical order follows task nav → Canvas tools → Inspector → contextual bottom surface.
- Route/sheet/dialog changes move focus to a meaningful heading/control and announce it.
- Canvas-only operations need list/button alternatives. Drag has keyboard/numeric alternatives.
- Text and UI contrast target WCAG 2.2 AA; status never relies on color alone.
- Default UI transitions: 120 ms micro, 180 ms panel, 240 ms modal; only opacity/transform when possible.
- `prefers-reduced-motion: reduce` removes spatial movement and nonessential mascot UI animation; authored mascot preview remains user-controllable with pause/reset.
