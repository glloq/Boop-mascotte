# Deferred V2 architecture debt

PR 38 deliberately stabilizes, rather than canonizes, the current architecture. Follow-up work remains:

- replace whole-project `structuredClone` mutations with ProjectDocument/EditorSession/PreviewSession and command/patch history;
- replace broad JSON string domain detection with domain revisions and a dirty dependency graph;
- add a compiled runtime and bounded precomputed animation/morph data rather than evaluating/parsing static definitions per frame;
- define blend shapes/keyforms and their migration only in a future schema proposal;
- redesign Face Setup separately from lifecycle work;
- design Expressions and Reactions after the core ownership model is established.

Schema version 3 and existing `mascot-project.json`/`rig.json` loading remain unchanged. The expression parser cache is now FIFO-bounded at 512 entries; a fixed rig cannot otherwise grow it after warm-up, but imported expression diversity warranted a defensive ceiling.

## PR45 foundation
ProjectDocument, EditorSession and controller-owned PreviewSession now have explicit ownership and domain revisions. Remaining authoring panels on the instrumented `setState` compatibility facade should be migrated command-by-command; snapshot history remains intentionally snapshot-based.
