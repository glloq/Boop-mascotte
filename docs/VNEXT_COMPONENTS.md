# Panel lifecycle (VNX-03)

Every panel in the editor is whatever its factory chose to return. Most expose
`render()`, two studios also expose `enter()` / `leave()`, and none of them can
be taken down. Two costs follow, and both are paid on every keystroke:

1. **Every panel renders on every notification.** The render plan (VNX-05) calls
   `render()` on each panel a domain touches, including the workspaces nobody is
   looking at.
2. **A panel's listeners live as long as the page.** Nothing removes them, so
   nothing can *close* a workspace — the editor can only hide it. That is why
   VNX-56 ("heavy workspaces `destroy()`, not `display:none`") cannot be done
   before this.

## The contract

`project/editor/ui/component.js`:

```text
mount(model)    attach: register listeners, render once
update(model)   render again, but only if the model actually changed
hide()          stop rendering; models keep arriving, DOM work does not
show()          render the model that arrived while hidden, if any
destroy()       remove every listener, disconnect every observer, empty the host
```

`hide()` is the cheap half and the reason the contract exists: an update while
hidden is remembered and rendered once on the next `show()`. `destroy()` is the
strong half — afterwards the component holds nothing, and mounting it again
throws rather than half-working.

Listeners go through `listen(target, type, handler)` and observers through
`observe(observer)`; that is what makes teardown possible at all. `counters()`
reports `{renders, skipped}` so a test can prove a hidden panel did no work.

The default comparison is the selector layer's own `shallowEqual` (VNX-04),
imported rather than copied: a ViewModel is a flat bag of already-derived
values, so deep equality would cost more than the render it saves, and identity
alone would never skip anything.

## Where the editor stands today

24 stateful factories, audited one by one:

| | Count |
| --- | --- |
| Expose `render()` or a bespoke `open`/`close`, and nothing else | 20 |
| Expose `enter` / `leave` | 2 (expression studio has both, reaction studio only `leave`) |
| Expose `destroy()` | 2 — `createSelectionOverlay`, `createTransformGizmo` |
| …and are actually destroyed by anybody | **0** |
| Listener registrations at construction | ~156 |
| …ever removed | **0** |

Three of them register outside their own host, which is why they misbehave
across workspaces:

| Factory | Reaches | Consequence |
| --- | --- | --- |
| `createCanvasMenu` | capture-phase `pointerdown` on `document` | fires in every workspace |
| `createFaceSetupPanel` | `keydown` on `window` | shortcut is live outside Face Setup |
| `createRigPanel` | `keydown` on `window` | same |
| `createSvgCanvas` | 2 listeners on `window` (space-pan) | same |

There is no `MutationObserver` / `ResizeObserver` / `IntersectionObserver`
anywhere in the editor today; `observe()` exists for the virtualisation items
(VNX-57, VNX-58), not for existing code.

## Adoption order

Cheapest proof first, so each step is provable before the next:

| Step | Panels | Why here |
| --- | --- | --- |
| 1 ✅ | `artboard-panel` | Redrawn on every `layers` notification, almost never actually changes |
| 2 ✅ | `warp-panel`, `automatic-panel`, `guide-bar` | 2 host listeners each, pure `render()` |
| 3 | `context-inspector` | 0 listeners, but `render()` returns a value `main.js` reads — the contract has to absorb that |
| 4 | expression / motion / reaction studios | `enter` / `leave` become `show` / `hide`; `rememberOpen` moves behind `listen` |
| 5 | `face-setup-panel`, `rig-panel` | Their `window` keydown becomes `listen(window, …)` — where `destroy()` starts paying |
| 6 | `svg-canvas`, `timeline-panel` | The two heavy workspaces VNX-56 wants destroyable |

Step 1 is done: `createArtboardPanel` derives a flat model
(`{measured, width, height, cut}`) and lets the component decide whether that
model is worth any DOM. It also gained a `destroy()`, which nothing calls yet —
that is VNX-56's job, and it now has something to call.

Step 2 is done, and it is where the flat model stopped being trivial. A panel
that lists things cannot compare the list by identity — it is rebuilt on every
derivation — so each of the three folds what it shows into a signature string
and compares that. The trap the step exists to expose is the guide bar:
`expanded` is state the *panel* owns rather than state the model supplies, so
leaving it out means the bar folds itself up on the next unrelated keystroke.
It is in the model, and tested in both directions.

## Sharp edges the adoption found

None of these is a regression — the first two predate the conversion and the
third is deliberate — but each is a trap for VNX-56, so they are written down
before they are stepped in.

| Edge | Where | Why it matters |
| --- | --- | --- |
| `render()` after `destroy()` **throws** | all four adopters | `render()` mounts when the panel is not mounted, and the component refuses to mount a destroyed one on purpose. `main.js` calls `warpPanel.render()` / `automaticPanel.render()` on every context change and `guideBar.render()` in the debounced validation task, so whoever destroys a workspace must stop calling render in the same breath, or the whole notification pass throws |
| `guide-bar` sets `host.hidden = false` in its own render | `guide-bar.js` | The component treats `host.hidden` as lifecycle; the panel treats it as content. They do not collide today only because a hidden component never renders. Whichever way VNX-56 resolves it, both owners must not write the same attribute |
| `automatic-panel`'s `change` handler does not redraw | `automatic-panel.js` | It relies on the store notification coming back through the render plan. Correct today, but the notice it sets is only visible because something *else* redraws |

The skip behaviour is proved twice in `panel-lifecycle.test.js` — by the
counters, and by a sentinel written into the host that a skipped render must
leave untouched — and the tests were checked against deliberately broken copies
of the panels, so a test that cannot fail is not counted as coverage.
