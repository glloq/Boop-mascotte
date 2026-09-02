# UX-06 — Face-role detection and review

## Baseline

UX-06 builds on UX-05 (`docs/UX05_FACE_SETUP.md`) on branch `claude/boop-mascotte-ux-ui-audit-50d5b3`; Verify and Browser E2E were green on that commit in hosted CI.

## Goal

When artwork is imported, propose the most likely element for each missing basic face role, show why and how confident the proposal is, and let the user accept one, accept all, or correct by clicking the Canvas. Suggestions are never committed automatically.

```text
Face parts                          0 / 8 assigned
○ Head        Suggested: Face · Likely        [Accept] [Assign]
○ Left eye    Suggested: Left eye · Likely    [Accept] [Assign]
○ Right eye   Maybe Eye? Click it on the canvas to confirm.   [Assign]
…
[ Accept 6 suggestions ]      ← primary when suggestions exist
[ Assign next: Right eye ]    ← secondary
```

## Detection

`rig-editor/semantic-parts/face-role-detection.js` is pure and stateless. Evidence is ranked in this order:

1. **Names.** SVG ids and layer names are tokenized (`journeyEyeL` → `journey eye l`, `pupil-left_2` → `pupil left 2`). Feature words (head/face, eye, pupil/iris, brow/eyebrow, mouth/lips/smile) and side words (left/l/1, right/r/2) give a candidate; exclusion words keep eyelids, lashes, highlights, moustaches and mouth bases out of the wrong role.
2. **Hierarchy.** Leaf shapes beat their wrapping groups for eyes, pupils, brows and mouth; for the head, a named group that contains the other face features is preferred so head movement carries the whole face, matching the templates.
3. **Position.** Two unsided candidates of the same feature are ordered by their Canvas x position (left of the other = left role). Geometry comes from the Canvas adapter (`getElementFrame`, canvas-pixel frames that are comparable across nested transforms) and is optional.
4. **Containment.** Unnamed artwork yields only a head-by-containment proposal (a shape whose frame holds the centers of most other shapes); backgrounds, frames and shadows are excluded by name.

Confidence: **high** (name + side, or a unique named head/mouth), **medium** (geometry ordering, several named candidates, containment), **low** (feature named but side unknown and no geometry). Only high and medium are acceptable; low is displayed as “Maybe … click to confirm” and pre-highlights the candidate when picking starts. Already-assigned roles and their artwork are excluded, and one element is proposed for at most one role.

## Review UI

- Suggested rows show `Suggested: <layer name> · Likely/Probable` and an **Accept** button whose tooltip lists the reasons; hovering a row highlights its candidate on the Canvas (transient attribute, no document change).
- **Accept N suggestions** applies all acceptable suggestions with `semantic-rig-commands.assignFaceRoles`: one atomic command that creates the owning parts as needed, all-or-nothing, one Undo. The Head part becomes the active selection so the Inspector opens on it for review.
- **Accept** on one row uses the UX-05 single-role command. **Assign** on a suggested row starts Canvas picking with the candidate pre-highlighted; Escape cancels without authoring.
- Suggestions are recomputed from `ProjectDocument` and Canvas geometry on every render; nothing about them is persisted.

## Ownership and compatibility

No schema, runtime, export, session-field or router change. Detection reads `layers`, `layerMetadata`, `elements` and `semanticParts` only. Templates and Face Builder projects already carry their roles, so they show no suggestions except for parts they do not include.

## Tests

- Unit (`core/tests/face-role-detection.test.js`): tokenization, high-confidence named detection without geometry, geometry-ordered pairs vs low confidence without geometry, containment-only head with background exclusion, assigned/hierarchy exclusions, and the atomic batch command with Undo and all-or-nothing rejection.
- Browser (`tests/e2e/ux06-face-detection.spec.js`): accept-all as one mutation with a single Undo, hover/pick highlighting and single accept without extra authoring, and the unnamed fixture producing only a head proposal.

## Deferred

Confidence display of second-best candidates, geometric pupil-inside-eye validation beyond ordering, and detection for optional parts (eyelids, jaw, nose, ears, hair) are left to a later detection iteration; UX-07 owns controls and calibration.
