# UX-07 — Basic movements and visual calibration

## Baseline

UX-07 builds on UX-06 on branch `claude/boop-mascotte-ux-ui-audit-50d5b3` (Verify and Browser E2E green in hosted CI on `743fc25`).

## Goal

After the face parts are assigned, let a beginner turn on the movements they want, test them immediately, and calibrate them by posing the artwork on the Canvas, without parameters, bindings, amplitudes or formulas.

```text
Movements                           3 / 10 on
HEAD
  ☑ Move left / right   On · default range
  ☐ Move up / down      Off
GAZE
  ☑ Look left / right   On · calibrated (2 / 3 poses)
EYEBROWS
  ☐ Raise               Assign both eyebrows first
[ Turn on all 7 available movements ]

Movement Inspector — Look left / right          ✓ Calibrated
  Test        [XY pad]  Look left / right ━━●━━  Look up / down ━━●━━  [Center]
  Calibrate   ✓ LEFT  [Capture again]   ○ CENTER [Pose & capture]   ✓ RIGHT [Capture again]
              [Reset to default movement]
  Advanced ▸  How should it move?  generated bindings  [Turn off]
```

## Model

- `rig-editor/semantic-parts/face-movements.js` derives the **Basic** list (headX, headY, headTilt, eyeOpen, lookX, lookY, browRaise, browTilt, mouthOpen, smile) with a status per movement: `unassigned` / `incomplete` (its face part lacks artwork), `off`, `on` (default registry range), `calibrated` (two or more captured poses solved). It also provides the pose cards (registry poses for transform drivers, Closed/Open or Neutral/Open endpoints for morph drivers) and plain-language pose instructions.
- `disableSemanticControl` is the inverse of `enableSemanticControl`: it removes the owned driver, its calibration and the parameter when nothing else (another part, a manual binding, a morph, a clip, a behavior) still uses it. `resetSemanticCalibration` forgets captured poses and regenerates the registry default binding.
- Commands: `enableControls` (batch, one undo), `disableControl`, `resetCalibration`, and `captureAndCalibrate`, which records a pose and solves the movement in the same command as soon as two poses exist. Existing `captureCalibration` / `calculateCalibration` stay for the legacy Calibrate tab.

## Canvas pose capture

Pose sessions now show the Canvas mode banner with the instruction, **Capture** and **Cancel**, shared by the inspector buttons. Capture was fixed for plain shapes: `svg.draggable` moves circles/rects through their geometry attributes rather than a transform, so the previous flow captured a zero displacement and left the moved geometry behind. The Canvas adapter now snapshots all attributes of the posed elements, derives the pose from the element transform plus the bounding-box displacement and resize ratio, and restores the exact base attributes after Capture or Cancel. Base artwork therefore never changes; only the generated binding amplitude/offset does.

## UI

- **Movements** collection (left panel, under Face parts): one checkbox per basic movement, grouped by face part; unavailable rows explain which artwork to assign first. Toggling is one command each; **Turn on all available movements** is one batch command. Opening a row selects the control in `EditorSession` (`activeSemanticPartId` + `activeControl`) so the single Inspector shows the **Movement Inspector**.
- **Movement Inspector** (rig panel, `activeControl` set): back link to the part, status, Test (XY pad for paired controls such as gaze/head, sliders with keyboard support, Center), Calibrate (pose cards with Pose & capture / Capture again, morph endpoints with Edit shape, Reset to default movement), Advanced (method, generated bindings, Turn off). Test values are `PreviewSession` only and commit through the existing Auto Key hook.
- The legacy Setup / Controls / Calibrate / Advanced tabs remain for the part view and are the rollback path. A latent bug in their **Reset controls** button (valueless data attribute never matched) was fixed on the way.

## Compatibility

No schema, runtime, export or router change. Calibration records keep the control-scoped `{ samples: [{ key, value, pose }] }` shape; generated bindings keep `generatedBy` ownership. Templates expose their pre-enabled movements (Basic Face: 8 of 8 available on, eyebrows unassigned).

## Tests

- Unit (`core/tests/face-movements.test.js`): availability/status derivation and pose cards, capture-and-solve on the second pose as one undo step plus reset to defaults, disable semantics with reference protection and undo.
- Browser (`tests/e2e/ux07-face-movements.spec.js`): enabling gaze from an imported SVG, testing it without authoring, calibrating LEFT/RIGHT by dragging both pupils with the Canvas banner Capture, base artwork restored, slider reaching the captured poses, two undos back to the default movement; template movements, single-command off/on with parameter cleanup, XY pad driving two live controls, back navigation.

## Deferred

Keyform interpolation beyond the current low/neutral/high amplitude solve, per-side (left/right) controls, morph capture for eyes/mouth through the Movement Inspector beyond the existing shape editor, and the legacy Calibrate tab removal (UX-17).
