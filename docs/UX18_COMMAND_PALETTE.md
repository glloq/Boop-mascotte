# UX-18 — Search and command palette

## Baseline

UX-18 builds on the task router, the entity studios and the Advanced hub (UX-02 → UX-17) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`.

## Goal

One central action registry that powers search, routes and discoverable shortcuts: type a name or an action, run it through the same commands the UI uses, and never execute something that is unsafe right now.

```text
Ctrl/Cmd+K  or  🔍
  [ happy                                   ]
  Expressions  Happy                 Expression
  Go to        Face Setup
  Actions      Export files          Export is blocked: fix the problems first.
  ↑↓ to choose · Enter to run · Esc to close
```

## Delivered

- `ui/command-registry.js`: `register` for static commands (id, title, group, keywords, shortcut, `enabled(context)` → ok / reason, `run(context)`), `registerIndex` for entity adapters rebuilt on every search, ranked `search` (exact > prefix > word start > includes > keywords > subtitle, then group order), and `run` that refuses disabled or unknown commands with a reason.
- `ui/command-palette.js`: a modal `<dialog>` with a combobox input and a listbox; arrows move the selection, Enter runs, Escape closes, clicking a result runs it; disabled results show their reason and stay open; the palette refuses to open over another dialog. Query and selection exist only while it is open.
- Wiring (`main.js`): Go to every task; actions Export, Problems, Save Project, New Project, Undo, Redo, Advanced tools, Reset mascot, Focus Preview, Timeline; entity adapters for expressions, motions, reactions, face parts, states and artwork elements, each routing through the task router and selection targets. Ctrl/Cmd+K and a topbar 🔍 button open it. E2E seam `palette()`.

## Compatibility

No schema or runtime change; every palette action calls an existing command or handler.

## Tests

- Unit (`core/tests/command-registry.test.js`): validation, indexes per context, ranking and normalization, disabled reasons, execution guard.
- Browser (`tests/e2e/ux18-command-palette.spec.js`): Ctrl+K focuses the input, "happy" opens the expression, the query is not remembered, "nod" selects the motion, arrow keys move the selection, "preview" navigates, Export runs when ready and is refused with its reason when blocked (palette stays open, no panel), Escape closes, the 🔍 button opens it and Undo shows its shortcut.

## Deferred

Recent items and fuzzy matching; per-workspace scoped searches (UX-23 polish).
