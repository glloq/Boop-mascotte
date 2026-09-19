# UX-50 — finishing the editor

A slice programme against the gaps in `docs/CURRENT_STATE.md` §5. It adds no
workspace, no store, no second undo stack and no second canvas. Every slice
either finishes a surface that already exists or wires an existing model to a
surface that was ignoring it.

**The rule every slice serves:** the screen says the *task*; the selection says
*what to show*. A control does not appear because the project has one.

---

## PR 0 — Current reality audit ✅

`docs/CURRENT_STATE.md`: capability matrix, verified limitations, the
contradiction table, the regression baseline. Stale documents marked historical
rather than deleted; `KNOWN_LIMITATIONS.md` corrected where the code had moved
past it.

---

## PR 1 — One answer to "what is in hand" ✅

**Gap:** the artwork half of the selection (`selectedId`) and the semantic half
(`activeSemanticPartId`) meet in exactly one place — a side effect inside
`rig-panel.js`'s `render()`. Every other panel is blind to it.

- `core/selectors/selection-subject.js`: one pure derivation,
  `selectionSubject(document, session)` → `{ kind, partId, partType, band,
  elementId, controls, label }`. Reads both halves, prefers whichever the
  surface is about, and answers `null` cleanly when nothing is picked.
- Consumed by Rig ▸ Controls (PR 2) and Design ▸ Assemble (PR 7).
- `Enter` descends into the selection (`canvas.enterSelection()`); `Escape`
  already climbs back out, in `closeTopSurface`.
- **Select inside…** in the right-click menu: `canvas.stackAt()` reads the
  layers under the pointer and `canvas.selectInside()` picks one, stepping into
  whatever piece holds it so the next click does not resolve straight back up.
- `SESSION_RENDER_PLAN` gains `activeSemanticPartId` and `activeControl`, and
  the contextual panels join `selectedId` — a panel that is never told the
  selection changed has no choice but to show everything.

Tests: unit on the derivation (every kind, empty, stale ids); E2E on
canvas→panel agreement; no document write.

---

## PR 2 — Rig ▸ Controls stops being an inventory ✅ **(major)**

**Gap:** 26 movements in 5 bands, always on screen, whatever is selected.

- A `quick` / `more` rank per movement, as a field on the one movement table in
  `face-movements.js` beside the existing `band` and `group` — not a second
  table, because two lists of twenty-six ids drift and the one that drifts is
  the one nobody is looking at. Pure data, no schema change.
- `contextualMovements()` and `movementFamilies()`: pure derivations the panel
  renders, so what is on screen is testable without a browser.
- With a part in hand, the panel shows **that part's band** — Quick first, More
  folded, Advanced folded — and nothing else.
- With nothing in hand, the five **families** with their readiness, each one a
  way in.
- **`Show all controls`** restores the full inventory, and is remembered for the
  session only.
- Canvas handles named as the way to pose; sliders described as the precise and
  keyboard-accessible alternative rather than the first offer.
- The families stay visible while narrowed, as a compact strip: without them the
  only way to another part of the face would be to put the whole inventory back,
  which is a filter that punishes you for using it.

Tests: unit on the tier table and the filter; E2E on selection→filter, on
`Show all`, and on the empty state; no document write.

---

## PR 3 — Calibration as a guided capture

**Gap:** `calibrationSteps()` already returns rest-first, titled, hinted steps.
The Inspector renders them as a flat row of `Edit pose` buttons.

One step at a time, in place, never a screen change: current step, what is
already captured, the movement tested live, `Cancel` / `Reset` / `Undo`.

---

## PR 4 — Deform: attachment and pin handles

**Gap:** attachment points are X/Y number fields and are not drawn at all; pins
have no multi-selection.

- Attachment points on the canvas, draggable, with `Pick on canvas` and `Delete`
  in the Inspector.
- Holds drawn as a source → target relation.
- Pins: Shift-select, marquee, multi-drag, mirror selection, one movement for
  the selection — one undo step per gesture.

---

## PR 5 — Shape key authoring

**Gap:** the runtime plays them, the rig writes them, `Advanced → Deformation`
lists them read-only. There is no editor.

List per element, `New` / `Capture` / `Rename` / `Duplicate` / `Reset` /
`Delete` / `Test value`; selecting one shows its nodes on the canvas. An
existing key is re-editable without changing a movement's method to force it.

---

## PR 6 — Depth / parallax bands

Visual FRONT→BACK bands, pieces moved between the planes the runtime allows,
previewed against Head 2.5D. No claim of a Z-buffer; the runtime's rules stand.

---

## PR 7 — Design polish ✅ *(contextual replace only)*

**Gap:** the library opens on `eyes` and stays there.

- The library category follows the selection; compatible replacements first;
  variants gated on what this mascot can currently animate, with limited
  animation flagged **before** the press; `Show all` ignores the filter.
- `Replace` joins `ui/piece-actions.js` so the action is the same from canvas,
  menu, floating bar and keyboard.

Remaining for a later slice: multi-selection rotate/scale, Hands ↔ Draw context
continuity, drag-to-reparent in the layer tree.

---

## PR 8 — Head 2.5D polish

Grid as the primary control; captured / missing / current / interpolating shown
on the matrix itself; `Capture current`, `Generate missing`, `Reset`. Simple /
Standard / Custom, with free axes staying Advanced.

## PR 9 — Animation vocabulary and context

CONTROL / POSE / EXPRESSION / VISEME / MOTION / STATE settled in the UI wording.
*Face States* renamed **Part poses** in user-facing copy only — no schema
migration. Timeline filters tracks by selection; `Reveal keys for selection`.

## PR 10 — Behavior stabilisation

Selection parity across board, list, table and Inspector at scale; 25 states,
50 reactions; localized updates rather than full rebuilds.

## PR 11 — Preview and guidance

Preview reduced to background, size, quick tests and `Reset`; everything else
under **Advanced testing**. Contextual empty states instead of a permanent guide.

## PR 12 — Global shell

Topbar overflow into `•••`, canvas focus, responsive and keyboard polish.

## PR 13 — Architecture cleanup

Continue reducing `editor-app.js` (1273 lines) into `app/controllers/`. No
rewrite.

## PR 14 — Release UX gate

Canonical journeys A–F, visual regression, cross-browser, performance,
accessibility, documentation.

---

## What stays out

Bones, physics, true 3D, audio timeline, a multi-clip mixer, F-curves,
scripting, marketplace, cloud, collaboration, a full vector suite. The goal is
to finish what is here.
