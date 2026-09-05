# System audit — September 2026

**Scope.** The whole editor as shipped on `main` (PR #85): every workspace at
1440 × 900, 820 × 1100 and 390 × 844, every popover, the button inventory of
each view, the code behind every action, and the three questions the author
of the project asked: *duplicate buttons*, *parts that cannot be reached*, and
*no proper interface for editing the SVG*.

**Method.** Screenshots and a DOM inventory of every visible control per
workspace (a Playwright script against the production build), then a
code-led pass over `project/editor` — the shell, every panel, the canvas, the
inspector and the routes — cross-checked against the unit and browser suites.
Everything below was reproduced before it was fixed. Numbers in the tables are
from the inventory: 165 visible controls in Artwork, 342 in Face Setup (521
with every section open), 131 in Motions.

The rest of this document is the finding list. **Fixed** means it landed in
this pass with tests; **Kept** means it was examined and is deliberate;
**Open** means it is real and documented in `docs/KNOWN_LIMITATIONS.md`.

## 1. Duplicate controls

| # | Finding | Evidence | Resolution |
|---|---|---|---|
| D1 | Two navigation rows in the top bar. The stage row (Create / Animate / Behaviors / Publish) and the task row (Artwork … Preview) were both shown; **Animate** appeared twice side by side, and the task row scrolled the other stages' tabs half off-screen (`Exp`, `ate ✓`, `Reactic`). | `ui/app-shell.js` markup, `index.html` `.workspace-tabs{overflow-x:auto}` | **Fixed.** One grouped navigation: each stage is a small label over its own steps, every step is one click away, nothing scrolls. The Motions step is called *Motions* so no word appears twice. |
| D2 | The Animate stage stacked the Expressions and the Motions panels in one column, in both steps: two **Starter kit · Add all** cards, two cross-fade settings, a three-screen column. | `index.html` `#app[data-stage=animate] .expressions-tools,.animate-tools{display:block}` | **Fixed.** Each step shows its own catalogue; the other is one click away. `ux37` rewritten to the new contract. |
| D3 | The States / Behaviors editor (4 300 px tall) was always spread under the motions list. | `#state-editor` had no base `display:none` in Animate | **Fixed.** Folded in a *States & behaviors (advanced)* disclosure inside Motions; Problems, the Advanced hub, the palette and *Behaviors (advanced)* all open it. Hidden in every other task, including the tablet drawer in Preview. |
| D4 | **Duplicate** and **Delete** for a motion in the Motion Inspector *and* in the Timeline clip header; **Name**, **Duration** and **Loop** in both. | `timeline-panel.js`, `motion-studio.js` | **Fixed** (buttons): the Timeline header keeps name, duration and loop (the dope sheet's own settings) and drops Duplicate / Delete. **Kept** (fields): the two name fields are one clip and stay in sync. |
| D5 | **Open in Timeline** shown in the inspector while the Timeline was already open beside it. | `motion-studio.js` | **Fixed.** The button is offered only while the footer is collapsed, as *Show in Timeline*. |
| D6 | Readiness listed four times: Problems, Publish, Preview **Ready?**, Export. Publish and Ready? were on screen together in one 300 px column. | `preview-panel.js`, `publish-panel.js` | **Fixed.** The Preview panel no longer repeats the seven rows; Publish owns them in that column. Problems (global) and Export (the gate's explanation) keep theirs. `ux08` follows the Publish rows. |
| D7 | **Reset mascot** and **Center** one above the other in Preview. | `preview-panel.js` | **Fixed.** Center removed; Reset mascot covers it. |
| D8 | Two **Export** buttons visible in Preview (top bar and Publish card). | `publish-panel.js` | **Fixed.** The Publish call to action reads *Export files…* (it opens the export panel); the top bar keeps the global button and its blocked / warnings count. |
| D9 | **+ Add Part** twice in Face Setup: over the selected part's card and in the parts navigator. | `rig-panel.js` | **Fixed.** The navigator's button, beside the list it adds to, is the one. |
| D10 | **Capture current face as expression** (left) and **Capture current face** (right) — different actions, the same words. | `expression-studio.js` | **Fixed.** The inspector button is *Update from current face*. |
| D11 | Layers panel **↑ Up / ↓ Down** and the canvas menu **Bring forward / Send backward** did the *opposite* of each other for the same job; a no-op move still recorded an undo step. | `layers-panel.js`, `editor-app.js` | **Fixed.** Same words and same direction everywhere, plus **To front / To back** in both; a move with no room is refused. |
| D12 | *Import SVG* in the ••• menu and *Import / Replace SVG* in Artwork. | `app-shell.js` | **Kept.** A file menu with New / Open / Import is the convention; the Artwork copy is the one on the documented path. |
| D13 | Hands offered in Artwork (**+ Add**) and in Face Setup (**Draw a pair of hands**). | `app-shell.js`, `hand-setup-panel.js` | **Kept.** Not visible together; same function, both places make sense. |
| D14 | *Start with the Mascot Face* inside Artwork replaced the project while the Home card offers the same. | `app-shell.js` | **Fixed** (wording): *Start over with the Mascot Face* says what it does. |
| D15 | **Problems** button vs Publish checklist; **Continue to Face Setup** vs guide bar vs tab. | shell | **Kept.** Different moments of the same journey. |
| D16 | Zoom `− / + / Fit` on the canvas and in the Timeline. | canvas toolbar, timeline toolbar | **Kept.** They zoom different things; the canvas readout now follows the wheel too. |

## 2. Parts that could not be reached

| # | Finding | Resolution |
|---|---|---|
| R1 | The left column kept its scroll position across tasks: Expressions opened scrolled to the middle of its preset groups (*Strong 4* cut in half at the top). | **Fixed.** Both columns return to the top when the task changes. |
| R2 | The guide bar's *Bring it to life* step routed to Motions and focused `#automatic-panel`, which lives in Reactions — the author landed on a column that did not hold it. | **Fixed.** Route corrected. |
| R3 | **Behaviors (advanced)** in Reactions set a mode nobody could see (the editor it opens is in Motions). | **Fixed.** It navigates, sets the mode and unfolds the editor. |
| R4 | A deep link that set an author mode never redrew the States editor. | **Fixed.** `states` is in the context render plan; the editor unfolds when the mode changes from a route. |
| R5 | `authorMode: 'animations'` was emitted by validation and drawn by nobody (a dead-end sentence). | **Fixed.** Animation problems open the Timeline. |
| R6 | Validation named a Face Setup section (`rigTask`) and nothing opened it: *Fix* on a head-pose issue landed on Face Setup with Head pose folded. | **Fixed.** `RIG_TASK_PANELS` maps the task to the section and the fix focuses it. |
| R7 | The Artwork Inspector's **Advanced** disclosure (constraints, bindings, morph, presets, symmetry) was hidden by CSS in every task but Artwork, although artwork can be selected from Face Setup. | **Fixed.** It follows the selection, not the workspace. |
| R8 | On phones the whole action cluster was hidden: Undo, Redo, Problems, Search *and* the ••• menu — the only door to New / Open / Import and Advanced tools. | **Fixed.** The menu stays; Undo, Redo, Problems and Search are inside it on phones. |
| R9 | Importing an exported `rig.json` was documented and implemented (`core/state/import-rig.js`) with no button anywhere. | **Fixed.** ••• → **Import rig.json** applies it onto the current artwork as one undo step, with a unit test. |
| R10 | The Timeline resize separator was a focus stop with no keyboard handler. | **Fixed.** Arrow keys resize it, Shift for larger steps, Home resets. |
| R11 | The Reactions Inspector was an empty column under a heading. | **Fixed.** It says what to do. |
| R12 | Face Builder, All parts, Gaze, Pins & holding and the States editor could not be deep-linked (`FOCUSABLE_PANELS`). | **Fixed.** Added. |
| R13 | The warp confirmation did not say its handles only show in Face Setup with the shape selected. | **Fixed.** It does. |
| R14 | Shape keys, deformers and depth/parallax have no authoring panel (read-only listing under Advanced → Deformation). | **Open.** Documented; the warp panel is the model for a future shape-key section. |
| R15 | The pivot handle and the morph-pose node handles are pointer-only. | **Open.** Documented; the transform gizmo, path nodes and puppet handles all have arrow keys. |
| R16 | The mascot presets module (`core/sample/mascot-presets.js`) has no UI. | **Open.** Listed for a Home gallery. |

## 3. Editing the SVG

The mechanics were solid — a real gizmo, path-topology migration, one undo
step per gesture — but the editing *surface* was thin, and one bug made the
Inspector nearly unusable for typing.

| # | Finding | Resolution |
|---|---|---|
| S1 | Every Inspector field wrote the document on **`input`**, and every document write rebuilt the Inspector: the field being typed in was destroyed after the first character (`none` became `fill="n"`), focus was lost, and a slider drag pushed one full undo snapshot per frame — enough to evict the whole undo stack. | **Fixed.** Text and number fields commit on `change`; colour pickers and sliders preview live inside one history transaction; the panel does not rebuild while it has focus and catches up when focus leaves. |
| S2 | Appearance was four fields: fill, stroke, stroke width, opacity — with a duplicated *Appearance* heading, a blue swatch shown for `none`, and values read from svg.js defaults (`#000000` for a shape styled by CSS). | **Fixed.** Fill and stroke each with a colour, a free value (`url(#gradient)` works) and a **None** switch; fill opacity; stroke width, opacity, line ends, corners and dashes when there is a stroke; opacity with a readout. Values come from the element or its computed style. Setting a value removes a conflicting inline `style` property, so imported Illustrator / Figma shapes respond. |
| S3 | A rectangle, circle, ellipse or text could only be resized through the transform's scale (which distorts the stroke). | **Fixed.** Width / height / corner radius, radius, radius X / Y, and for text: the words, the font size and the anchor. |
| S4 | The Presets tab was in French inside an English interface. | **Fixed.** |
| S5 | No arrow-key nudge of the selected artwork, no copy / paste, no bring-to-front / send-to-back, no flip. | **Fixed.** Arrow keys (Shift ×10), Ctrl/Cmd + C / V, **Bring to front / Send to back** and **Flip horizontally / vertically** in the canvas menu and the Layers panel. |
| S6 | The wheel did nothing on the canvas; zoom was buttons only, always about the viewport centre. | **Fixed.** Wheel pans, Ctrl/Cmd + wheel (and a trackpad pinch) zooms about the pointer; the readout follows. |
| S7 | Double-clicking anywhere in Node mode added a point on the nearest segment however far away. | **Fixed.** A point is added only within 14 screen pixels of the outline. |
| S8 | **Duplicate** stripped only the root id: every child id was renamed with a warning, and the copy arrived nameless and unlocked-or-not at random. | **Fixed.** Fresh `-copy` ids for the copy and its children, the name carried over as *Name copy*. |
| S9 | Unlocking a piece switched the legacy `svg.draggable` plugin back on for it, giving that one piece a second, uncoordinated drag path beside the gizmo. | **Fixed.** Removed. |
| S10 | **Mirror selected to peer** mirrored about x = 120 whatever the artboard size. | **Fixed.** The middle of the working area. |
| S11 | The shortcut help omitted Delete, Ctrl/Cmd + D, Enter to close a pen run, Shift + F10 and the wheel. | **Fixed.** Listed, and the tool-key note corrected (only P and R are shadowed while something is selected). |
| S12 | No multi-selection, marquee, alignment / distribution, gradient editor, grid, guides or boolean operations; the Pen draws straight segments and curves are made afterwards with the Node tool. | **Open.** Documented in `docs/KNOWN_LIMITATIONS.md`. Multi-selection is the one that unlocks the others. |

## 4. Smaller things fixed on the way

- The status toast sat on top of the canvas toolbar in Preview; it now sits above the toolbars.
- The Layers row's action buttons clipped (*Delet*) in a 300 px column; they wrap.
- *Import SVG* / *Artwork only* ran together in the ••• menu; sub-labels take their own line.
- *Nose · Nose* / *Jaw · Jaw*: the Inspector badge no longer repeats a role that is the part's name.
- One vocabulary: *Motions* (tab, section, readiness row, timeline list, palette), *Timeline* (not *Dope Sheet*), *Update from current face*.

## 5. Verification

- `npm test`: 1 069 unit tests, including new ones for the rig import and the export-service focus routing.
- `npm run build`: production build.
- Browser suites: the critical Chromium gate (`npm run test:e2e:critical`) with `ux08`, `ux35`, `ux37` and the helpers updated to the new contracts; the extended suite is the next scheduled run.
