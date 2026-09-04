# The inspector, and what it is looking at (VNX-11)

The rule: **the Properties column depends on the selection and nothing else.**
Click the mouth, get a Mouth inspector. Click a hand, get a Hand inspector.
Never a generic list of parameters with no context.

This is the audit of every selectable thing in the editor, what the session
records about it, which adapter the contextual inspector reveals, and whether
that is the right answer. It is kept because most of the remaining gaps need
files that belong to other roadmap items, and a gap nobody wrote down is a gap
nobody fixes.

| What the author clicks | Context kind | Adapter | Verdict |
| --- | --- | --- | --- |
| Artwork on the canvas | `artwork` | `#inspector` | ✅ fixed — it now names the piece and the part it plays, instead of heading a parameter list with a raw SVG id |
| Layer row in Structure | `artwork` | `#inspector` | ✅ same selection by design: two doors, one thing selected |
| Semantic part | `semantic-part` | `#rig-panel` | ✅ the part's own card |
| Semantic control | `semantic-control` | `#rig-panel` | ✅ the movement, its test control and its calibration |
| Expression | `expression` | expression inspector | ✅ |
| Motion clip | `clip` | motion inspector | ✅ |
| Reaction | `reaction` | reaction inspector | ✅ |
| Timeline **track** | `timeline-track` | motion inspector | ◐ lands on the clip that owns it; never names the track |
| Timeline **key** | falls back to `timeline-track` | motion inspector | ✗ nothing writes `selectedKey`, so the editor cannot tell a key from a track (VNX-36) |
| State | `state` | none | ✅ fixed — it was an empty column under a heading; it now says where the state machine is |
| Rig handle | — | unchanged | ✗ `selectedHandles` is a module variable, not session state (VNX-14) |
| Hand | `artwork` of the hand | `#rig-panel` | ✗ shows the last *face* part; a hand has no identity in the session (VNX-19) |
| Warp | — | unchanged | ✗ a warp has no identity in the session at all (VNX-84) |

## The rule that replaced the special cases

An adapter is revealed, **or** the empty line names what is selected. Never
neither. That invariant is asserted for every kind × task pair in
`core/tests/inspector-selection.test.js`, which is the audit above as data.

## Known precedence bug — fixed

In Animate, `selectedTrackParameter` outranked `activeStateId` and nothing ever
cleared it except the motion studio, so a track clicked earlier masked a state
selected later and the Properties column kept showing the clip. The state
machine panel now clears the track selection the way the motion studio clears
the active state, and a test drives the panel to prove it.

## What each remaining gap needs

| Gap | Needs |
| --- | --- |
| Timeline key | the timeline writes `selectedKey` on a key press, and clears it on Escape |
| Rig handle | `selectedHandleId` in the session, `rig-handle` in `TARGET_KINDS`, a branch in `selectionPatchForTarget` |
| Hand | Hand Setup writes which *hand*, not which artwork; a `data-inspector-adapter="hand"` container |
| Warp | an `activeWarpId` before the inspector can have an opinion |
