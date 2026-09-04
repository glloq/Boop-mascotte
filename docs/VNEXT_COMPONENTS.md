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
| 2 | `warp-panel`, `automatic-panel`, `guide-bar` | 2 host listeners each, pure `render()` |
| 3 | `context-inspector` | 0 listeners, but `render()` returns a value `main.js` reads — the contract has to absorb that |
| 4 | expression / motion / reaction studios | `enter` / `leave` become `show` / `hide`; `rememberOpen` moves behind `listen` |
| 5 | `face-setup-panel`, `rig-panel` | Their `window` keydown becomes `listen(window, …)` — where `destroy()` starts paying |
| 6 | `svg-canvas`, `timeline-panel` | The two heavy workspaces VNX-56 wants destroyable |

Step 1 is done: `createArtboardPanel` derives a flat model
(`{measured, width, height, cut}`) and lets the component decide whether that
model is worth any DOM. It also gained a `destroy()`, which nothing calls yet —
that is VNX-56's job, and it now has something to call.
