# The four workspaces, as modules (UIR-16)

`editor-app.js` was 1161 lines of wiring in one function, and the only way to
find out which panels belonged to *Rig* was to read all of it. A module per
question is the answer the roadmap asks for (§13, UIR-16): each one builds the
panels of one workspace, hands back the render targets they answer to, and says
what it does when the author arrives at one of its screens or leaves for
somebody else's.

## The contract

```text
createXWorkspace(context) -> {
  id        'design' | 'rig' | 'animate' | 'behavior'
  surfaces  the panel compositions its screens mount (SURFACES, ui/task-router.js)
  panels    the panel objects, by the name the render plan knows them by
  targets   the render jobs, by the same names (core/state/render-plan.js)
  enter(surface)  the author arrived on one of this workspace's screens
  leave(surface)  the author is somewhere else now
  render()  draw every panel of this workspace, for the initial paint
  destroy() let every panel of this workspace go
}
```

`enter` and `leave` replace `WORKSPACE_OCCUPANTS`, a table in
`app/workspace-manager.js` that knew which panel of which workspace had a
method called `cancelTransient`. The manager asks the workspaces now, and each
one answers for its own panels — which is the difference between a lifecycle and
a lookup table that has to be kept in step with four files.

They are handed a **context**, never the editor: the store, the history, the
shell's hosts, the preview controller, the editor context and the router. A
workspace that needed something not in it would be reaching across a boundary,
and that is the review conversation this split exists to have.

## What deliberately did not move

The canvas, its tools, its menu, the Inspector, the services and the command
surfaces stay in `editor-app.js`. The canvas is central to every screen
(§5, Règle A) and the Inspector answers for all four (Règle B); filing either
under a workspace would be exactly the lie this refactor removes.
