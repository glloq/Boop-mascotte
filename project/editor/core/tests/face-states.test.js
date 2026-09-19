import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createProjectSnapshot, applyProjectSnapshot } from '../state/project-snapshot.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import {
  EYE_POSE_PRESETS, VISEME_KEYS, VISEME_PRESETS, composeFaceState, eyePoseValues,
  resolveEyePose, resolveViseme, visemeExpressionId
} from '../face-library/face-states.js';
import {
  EYE_CORRECTIVE_SLOTS, MOUTH_CORRECTIVE_SLOTS, captureFaceCorrective, correctiveActivation,
  correctiveExpression, faceCorrectiveId, faceCorrectives, removeFaceCorrective, copyFaceCorrectives
} from '../face-library/face-correctives.js';
import { installVisemes, installedVisemes } from '../face-library/face-state-install.js';
import { createFaceStateCommands } from '../face-library/face-state-commands.js';
import { faceStateModel } from '../face-library/face-state-model.js';
import { compileRigFrame, composeExpressionParams, normalizeExpressions, parsePath, resolveStateParams, visemeBlendWeights } from '../../../runtime/runtime.js';
import { LID_PIVOTS, LID_RESTS, lidPath, mouthGeometry } from '../sample/templates/face-artwork.js';

/**
 * The states an eye and a mouth can be in, and the mouth speaking while it
 * wears one (docs/FACE_SVG_STATES.md, docs/VISEME_SYSTEM.md).
 *
 * The property every test in here defends is the same one: **there is one set
 * of artwork**. Eight eye states and nine visemes are values for movements the
 * face already has, plus an optional corrective; none of them is a second
 * drawing, and the numbered list below is the brief's own.
 */

const template = () => createTemplateProjectState();
const rest = (state) => resolveStateParams(state.params, state.states?.[state.activeState]);
const pose = (state, values = {}) => compileRigFrame(
  state.elements, { ...rest(state), ...values }, state.globalConstraints, state.stateConstraints?.[state.activeState],
  { keyforms: state.keyforms, shapeKeys: state.shapeKeys, rigPins: state.rigPins }
);
/** The four control points of the lip line: left, top, right, bottom. */
const lips = (state, values) => {
  const parsed = parsePath(pose(state, values).mouth.path);
  return Array.from({ length: parsed.values.length / 2 }, (_, index) => ({
    x: Number(parsed.values[index * 2].toFixed(2)), y: Number(parsed.values[index * 2 + 1].toFixed(2))
  }));
};
/** How wide and how tall the *drawn* aperture is: a quadratic reaches half way to its control point. */
const aperture = (state, values) => {
  const [left, top, right, bottom] = lips(state, values);
  const mid = (a, control, b) => 0.25 * a.y + 0.5 * control.y + 0.25 * b.y;
  const scaleX = Number(pose(state, values).mouth.transform.scaleX) || 1;
  return { width: Number(((right.x - left.x) * scaleX).toFixed(2)), height: Number((mid(left, bottom, right) - mid(left, top, right)).toFixed(2)) };
};
const lid = (state, values, role = 'lidUpperLeft') => pose(state, values)[role];
/**
 * Where a lid's leading edge actually sits: its own path, grown about the rim it
 * swings from (docs/EYE_BUILDS.md).
 *
 * A lid is four cubics round a squashed ellipse, and the half facing the pupil is
 * the one that matters — that is the edge the viewer reads as the eyelid, the one
 * `eyeSquint` deepens and `eyeCurve` bends:
 *
 * ```text
 *   M (cx-rx) cy  C .. .. (cx) rim  C .. .. (cx+rx) cy  C c1 c2 (cx) reach  C .. .. (cx-rx) cy Z
 *     0      1                6 7                12 13    14.17  18  19
 * ```
 *
 * `edge` is the middle of that leading half and `control` its own control points,
 * which is what a bend moves while the ends stay put. Both are read through the
 * scale, because a lid grows rather than slides now: a point's height is its
 * distance from the rim, multiplied.
 */
/**
 * A lid's leading edge, read off the drawing and grown by the blink.
 *
 * The path is `M · L · L · C · C · Z` (docs/EYE_BUILDS.md): a flat run along
 * the rim, a vertical side, and the leading edge back in two cubics. Only the
 * leading edge ever shows — the rest is outside the socket and cut away — so
 * these are the three numbers that describe what a viewer sees.
 *
 * ```text
 *   v0  v1   M   the far corner, on the rim
 *   v2  v3   L   across the rim
 *   v4  v5   L   down the side, to the edge's end
 *   v6…v11  C   in to the middle of the edge
 *   v12…v17 C   and back out to its other end
 * ```
 */
const lidEdge = (state, values, role = 'lidUpperLeft') => {
  const frame = lid(state, values, role);
  const parsed = parsePath(frame.path);
  const at = LID_PIVOTS[role], k = Number(frame.transform.scaleY ?? 1);
  const grown = (y) => Number((at.y + (y - at.y) * k + Number(frame.transform.y || 0)).toFixed(2));
  return {
    // The middle of the leading edge: what the viewer reads as the eyelid.
    edge: grown(parsed.values[11]),
    // The control points that carry the bend, which is what an arc moves.
    control: grown((parsed.values[9] + parsed.values[13]) / 2),
    // And the edge's two ends, which land on the eye's own widest points when
    // the blink is complete -- that is what closes the corners.
    ends: [grown(parsed.values[5]), grown(parsed.values[17])]
  };
};
/** How far a lid has grown: the one number a blink now moves. */
const lidScale = (frame) => Number(Number(frame.transform.scaleY ?? 1).toFixed(3));

/* ══ EYES ═══════════════════════════════════════════════════════════════════ */

test('1 · a neutral eye is the drawing, and every new control rests at nothing', () => {
  const state = template();
  for (const name of ['eyeSquint', 'eyeCurve', 'eyeSquintLeft', 'eyeSquintRight', 'eyeCurveLeft', 'eyeCurveRight', 'mouthRound']) {
    assert.equal(state.params[name].default, 0, `${name} rests at 0`);
  }
  // The lid's outline at rest *is* the authored outline: nothing the states
  // added moves it until something asks.
  assert.equal(lid(state, {}).path, LID_RESTS.lidUpperLeft);
  assert.deepEqual(resolveEyePose(state, 'neutral').controls, { eyeOpen: 1, eyeSquint: 0, eyeCurve: 0 });
});

test('2 · eyeOpen 1 → 0 travels the lid, monotonically and without a jump', () => {
  const state = template();
  const heights = [1, 0.75, 0.5, 0.25, 0].map((eyeOpen) => lidEdge(state, { eyeOpen }).edge);
  for (let i = 1; i < heights.length; i += 1) assert.ok(heights[i] > heights[i - 1], `the upper lid keeps coming down (${heights.join(' → ')})`);
  // And the lower one comes up to meet it, so the two make a seam.
  const lower = [1, 0.5, 0].map((eyeOpen) => lidEdge(state, { eyeOpen }, 'lidLowerLeft').edge);
  for (let i = 1; i < lower.length; i += 1) assert.ok(lower[i] < lower[i - 1], `the lower lid keeps coming up (${lower.join(' → ')})`);
});

test('3 · a blink closes both eyes', () => {
  const state = template();
  const shut = pose(state, { eyeOpen: 0 });
  assert.equal(lidScale(shut.lidUpperLeft), lidScale(shut.lidUpperRight));
  assert.notEqual(lidScale(shut.lidUpperLeft), 1, 'and it is not the open eye');
});

test('4 · a wink closes the left eye and leaves the right one open', () => {
  const state = template();
  const winked = pose(state, { eyeOpen: 1, eyeOpenLeft: -1 });
  const shut = pose(state, { eyeOpen: 0 });
  assert.equal(lidScale(winked.lidUpperLeft), lidScale(shut.lidUpperLeft), 'the left eye is as shut as a blink');
  assert.equal(lidScale(winked.lidUpperRight), lidScale(pose(state, {}).lidUpperRight), 'the right one has not moved at all');
  assert.equal(lidScale(winked.lidLowerLeft), lidScale(shut.lidLowerLeft), 'and the lower lid came with it');
});

test('5 · a wink the other way, and the eye states are written as one side’s own offset', () => {
  const state = template();
  const winked = pose(state, { eyeOpen: 1, eyeOpenRight: -1 });
  assert.equal(lidScale(winked.lidUpperRight), lidScale(pose(state, { eyeOpen: 0 }).lidUpperRight));
  assert.equal(lidScale(winked.lidUpperLeft), lidScale(pose(state, {}).lidUpperLeft));
  // Which is exactly what a per-side state resolves to: the shared control is
  // left alone and the offset carries the difference.
  assert.deepEqual(eyePoseValues(state, 'closed', 'left'), { eyeOpenLeft: -1, eyeSquintLeft: 0, eyeCurveLeft: 0 });
  assert.deepEqual(eyePoseValues(state, 'closed', 'right'), { eyeOpenRight: -1, eyeSquintRight: 0, eyeCurveRight: 0 });
  assert.deepEqual(eyePoseValues(state, 'closed'), { eyeOpen: 0, eyeSquint: 0, eyeCurve: 0 }, 'and for the pair it is the shared control');
});

test('6 · lookX moves the pupils and nothing else about the eye', () => {
  const state = template();
  const left = pose(state, { lookX: -1 }), right = pose(state, { lookX: 1 });
  assert.ok(left.pupilLeft.transform.x < 0 && right.pupilLeft.transform.x > 0);
  assert.equal(left.lidUpperLeft.path, right.lidUpperLeft.path, 'the lid is not a function of the gaze');
});

test('7 · lookY moves the pupils up and down', () => {
  const state = template();
  assert.ok(pose(state, { lookY: -1 }).pupilLeft.transform.y < pose(state, { lookY: 1 }).pupilLeft.transform.y);
});

test('8 · a look and a blink at the same time, with neither losing the other', () => {
  const state = template();
  const both = pose(state, { lookX: 1, lookY: -0.5, eyeOpen: 0 });
  assert.equal(both.pupilLeft.transform.x, pose(state, { lookX: 1, lookY: -0.5 }).pupilLeft.transform.x, 'the gaze is untouched by the blink');
  assert.equal(lidScale(both.lidUpperLeft), lidScale(pose(state, { eyeOpen: 0 }).lidUpperLeft), 'and the blink by the gaze');
});

test('9 · an expression and a look compose, and every state keeps the gaze', () => {
  const state = template();
  const happy = normalizeExpressions(state).find((item) => item.id === 'happy');
  const values = composeExpressionParams({ ...rest(state), lookX: -0.8, lookY: 0.4 }, [happy], { happy: 1 }, state.params);
  assert.equal(values.lookX, -0.8, 'the face does not straighten the gaze');
  assert.equal(values.smile, 1);
  // And the same for every one of the eight states: not one of them names a
  // gaze parameter, which is what makes "happy + look left" a composition.
  for (const preset of EYE_POSE_PRESETS) {
    assert.deepEqual(Object.keys(preset.controls).filter((name) => /^look|^gaze/.test(name)), [], `${preset.id} names no gaze`);
  }
});

test('10 · a closed-eye corrective changes the shut eye and nothing else', () => {
  const state = template();
  const target = 'lidUpperLeft';
  const base = state.elements[target].restPath;
  const arched = lidPath(target, { curve: 0.8 });
  const before = { open: lid(state, {}, target).path, shut: lid(state, { eyeOpen: 0 }, target).path };
  const result = captureFaceCorrective(state, { kind: 'eye', slot: 'closed', side: 'left', target, restPath: base, posePath: arched });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.shapeKey.driver.expression, '1 - eyeOpen - eyeOpenLeft');
  assert.equal(state.elements[target].restPath, base, 'the base outline is untouched');
  assert.equal(lid(state, {}, target).path, before.open, 'an open eye is exactly as it was: the sentence reads 0 there');
  assert.notEqual(lid(state, { eyeOpen: 0 }, target).path, before.shut, 'and a shut one is corrected');
  // Weight 0.5 is half of it, which is what makes the correction a correction.
  state.shapeKeys = state.shapeKeys.map((key) => (key.id === result.shapeKey.id ? { ...key, driver: { ...key.driver, amplitude: 0.5 } } : key));
  const half = parsePath(lid(state, { eyeOpen: 0 }, target).path).values;
  const full = parsePath(before.shut).values;
  const corrected = parsePath(lidPath(target, { curve: 0.8 })).values;
  for (let i = 0; i < half.length; i += 1) {
    assert.ok(Math.abs(half[i] - (full[i] + (corrected[i] - parsePath(base).values[i]) * 0.5)) < 1e-6, 'half the delta, exactly');
  }
});

test('11 · with no corrective at all the eye behaves as it did before they existed', () => {
  const state = template();
  const without = state.shapeKeys.filter((key) => !key.faceState);
  assert.deepEqual(state.shapeKeys, without, 'the template ships none: a corrective is authored, never generated');
  // And a project whose correctives are taken away draws what it drew: the
  // frame is rebuilt from the same rig minus the keys the states added.
  const withOne = template();
  captureFaceCorrective(withOne, { kind: 'eye', slot: 'closed', side: 'left', target: 'lidUpperLeft', posePath: lidPath('lidUpperLeft', { curve: 1 }) });
  withOne.shapeKeys = withOne.shapeKeys.filter((key) => !key.faceState);
  assert.equal(
    compileRigFrame(withOne.elements, { ...rest(withOne), eyeOpen: 0 }, withOne.globalConstraints, null, { keyforms: withOne.keyforms, shapeKeys: withOne.shapeKeys, rigPins: withOne.rigPins }).lidUpperLeft.path,
    lid(state, { eyeOpen: 0 }, 'lidUpperLeft').path);
});

test('the eight eye states are reachable from one set of artwork', () => {
  const state = template();
  const drawn = new Map();
  for (const preset of EYE_POSE_PRESETS) {
    const resolved = resolveEyePose(state, preset.id);
    assert.deepEqual(resolved.missing, [], `${preset.id} needs nothing this face has not got`);
    const frame = pose(state, resolved.controls);
    // Each state is a distinct *drawn* eye: the two lid outlines, where each
    // lid ended up, and the pupil's size -- `wide` is the one state the lids
    // do not carry, because what widens a cartoon eye is its pupil. Two states
    // that came out identical would be one state with two names.
    drawn.set(preset.id, [
      frame.lidUpperLeft.path, lidScale(frame.lidUpperLeft),
      frame.lidLowerLeft.path, lidScale(frame.lidLowerLeft),
      Number(frame.pupilLeft.transform.scaleY).toFixed(3)
    ].join('|'));
  }
  assert.equal(new Set(drawn.values()).size, EYE_POSE_PRESETS.length, `eight distinct eyes, got ${[...drawn].map(([id]) => id).join(', ')}`);
  // And the two that `eyeOpen` alone could never tell apart:
  assert.notEqual(drawn.get('halfOpen'), drawn.get('squint'), 'a narrowed eye is not a half-shut one');
  assert.notEqual(drawn.get('closed'), drawn.get('happyClosed'), 'a happy squeeze is not a flat seam');
  assert.notEqual(drawn.get('tired'), drawn.get('halfOpen'), 'and a tired eye is not either');
});

test('a happy closed eye arcs upwards and a tired one droops', () => {
  const state = template();
  const flat = lidEdge(state, { eyeOpen: 0 });
  const happy = lidEdge(state, { eyeOpen: 0, eyeCurve: 1 });
  const sad = lidEdge(state, { eyeOpen: 0, eyeCurve: -1 });
  assert.deepEqual(happy.ends, flat.ends, 'the seam’s ends stay where the blink put them');
  assert.deepEqual(sad.ends, flat.ends);
  assert.ok(happy.edge < flat.edge, 'and the middle of the upper lid rises');
  assert.ok(sad.edge > flat.edge, 'and drops the other way');
  assert.ok(happy.control < flat.control, 'which is the control points moving, ends fixed');
  assert.ok(sad.control > flat.control);
  // The lower lid arcs the *same* way, because what the viewer reads as the arc
  // is the two edges together.
  assert.ok(lidEdge(state, { eyeOpen: 0, eyeCurve: 1 }, 'lidLowerLeft').edge < lidEdge(state, { eyeOpen: 0 }, 'lidLowerLeft').edge);
});

test('a squint is the lower lid coming up much further than the upper comes down', () => {
  const state = template();
  const open = { upper: lidEdge(state, {}).edge, lower: lidEdge(state, {}, 'lidLowerLeft').edge };
  const narrow = { upper: lidEdge(state, { eyeSquint: 1 }).edge, lower: lidEdge(state, { eyeSquint: 1 }, 'lidLowerLeft').edge };
  assert.ok(narrow.upper > open.upper, 'the upper lid comes down a little');
  assert.ok(narrow.lower < open.lower, 'the lower lid comes up');
  assert.ok(open.lower - narrow.lower > (narrow.upper - open.upper) * 2, 'and much further, which is what a squint is');
});

test('the two eyes can narrow and arc apart, on the same side offsets the wink uses', () => {
  const state = template();
  const lopsided = pose(state, { eyeSquint: 0, eyeSquintLeft: 1, eyeCurve: 0, eyeCurveRight: -1 });
  assert.notEqual(lopsided.lidUpperLeft.path, lopsided.lidUpperRight.path, 'the two lids disagree');
  assert.equal(lopsided.lidUpperLeft.path, pose(state, { eyeSquint: 1 }).lidUpperLeft.path, 'the left one is narrowed');
  assert.equal(lopsided.lidUpperRight.path, pose(state, { eyeCurve: -1 }).lidUpperRight.path, 'the right one is drooping');
});

/* ══ MOUTH ══════════════════════════════════════════════════════════════════ */

test('12 · mouthOpen opens the mouth, and keeps opening', () => {
  const state = template();
  const heights = [0, 0.25, 0.5, 0.75, 1].map((mouthOpen) => aperture(state, { mouthOpen }).height);
  for (let i = 1; i < heights.length; i += 1) assert.ok(heights[i] > heights[i - 1], `monotonic (${heights.join(' → ')})`);
  assert.ok(heights[0] < 6, 'and a closed mouth is a line');
});

test('13 · smile lifts the corners, and a frown drops them', () => {
  const state = template();
  const neutral = lips(state, {}), grin = lips(state, { smile: 1 }), frown = lips(state, { smile: -1 });
  assert.ok(grin[0].y < neutral[0].y && grin[2].y < neutral[2].y, 'both corners rise');
  assert.ok(frown[0].y > neutral[0].y && frown[2].y > neutral[2].y, 'and fall');
});

test('14 · a mouth opens and smiles at the same time, exactly as the sum of the two', () => {
  const state = template();
  const both = lips(state, { mouthOpen: 0.65, smile: 0.5 });
  const neutral = lips(state, {}), open = lips(state, { mouthOpen: 0.65 }), smiling = lips(state, { smile: 0.5 });
  for (let i = 0; i < both.length; i += 1) {
    assert.ok(Math.abs(both[i].x - (neutral[i].x + (open[i].x - neutral[i].x) + (smiling[i].x - neutral[i].x))) < 0.02, `point ${i} x`);
    assert.ok(Math.abs(both[i].y - (neutral[i].y + (open[i].y - neutral[i].y) + (smiling[i].y - neutral[i].y))) < 0.02, `point ${i} y`);
  }
  assert.ok(lips(state, { mouthOpen: 0.65, smile: 0.5 })[0].y < neutral[0].y, 'and the corners are still up');
});

test('15 … 22 · every viseme is a distinct mouth, from one outline', () => {
  const state = template();
  const drawn = new Map();
  for (const preset of VISEME_PRESETS) {
    const resolved = resolveViseme(state, preset.id);
    assert.deepEqual(resolved.missing, [], `${preset.id} needs nothing this mouth has not got`);
    const frame = pose(state, resolved.controls);
    drawn.set(preset.id, `${frame.mouth.path}|${Number(frame.mouth.transform.scaleX).toFixed(3)}`);
  }
  assert.equal(new Set(drawn.values()).size, VISEME_PRESETS.length, 'nine distinct mouths');
  // The mouth is **one** path throughout: nine visemes and not one extra shape.
  assert.equal(new Set(state.shapeKeys.filter((key) => key.target === 'mouth').map((key) => key.id)).size, 5,
    'four movements and the skull bow — no shape key per viseme');
  assert.equal(Object.keys(state.elements).filter((id) => /^mouth-/.test(id)).length, 0, 'and no second mouth drawing');
});

test('AE is wide and open, OO is small and round, EE is wide and shallow', () => {
  const state = template();
  const at = (key) => aperture(state, resolveViseme(state, key).controls);
  const ae = at('AE'), oo = at('OO'), ee = at('EE'), rest_ = at('REST'), mbp = at('MBP');
  assert.ok(ae.width > oo.width * 2, `AE is much wider than OO (${ae.width} vs ${oo.width})`);
  assert.ok(Math.abs(oo.width - oo.height) < oo.width * 0.35, `OO is roughly as tall as it is wide (${oo.width} × ${oo.height})`);
  assert.ok(ae.width / ae.height > 1.8, `AE is a wide opening (${ae.width} × ${ae.height})`);
  assert.ok(ee.width > ae.width && ee.height < ae.height, `EE is wider and shallower than AE (${ee.width} × ${ee.height})`);
  assert.ok(rest_.height < 6 && mbp.height < 6, 'REST and MBP are closed');
});

test('FV shows the teeth on a nearly shut mouth, and L raises the tongue', () => {
  const state = template();
  const fv = resolveViseme(state, 'FV').controls, l = resolveViseme(state, 'L').controls;
  assert.ok(fv.teeth > 0.5 && fv.mouthOpen < 0.25, 'the lower lip meets the upper teeth');
  assert.ok(correctiveActivation('mouth', 'lipTeeth', fv) > correctiveActivation('mouth', 'lipTeeth', resolveViseme(state, 'AE').controls),
    'and it is the slot FV reaches for');
  assert.ok(l.tongue > 0.5 && l.tongueY < 0, 'the tongue is up, not merely out');
  assert.ok(correctiveActivation('mouth', 'tongueTeeth', l) > 0.3);
  // The tongue really does move: `tongueY` is a movement of the tongue part.
  assert.ok(pose(state, l).tongue.transform.y < pose(state, resolveViseme(state, 'AE').controls).tongue.transform.y);
});

test('mouthRound is the axis AE and OO differ on, and it is not narrowing', () => {
  const state = template();
  // Narrowing alone makes a *small* wide mouth; rounding makes a tall one.
  const narrowed = aperture(state, { mouthOpen: 0.32, mouthWidth: -0.7 });
  const rounded = aperture(state, { mouthOpen: 0.32, mouthWidth: -0.7, mouthRound: 1 });
  assert.ok(rounded.height > narrowed.height * 1.4, `rounding deepens the aperture (${narrowed.height} → ${rounded.height})`);
  assert.ok(rounded.width < narrowed.width, 'and draws the corners in');
  // And the geometry says so directly: the corners come in, the lips bow out.
  assert.ok(mouthGeometry({ round: 1 }).left.x > mouthGeometry({}).left.x);
  assert.ok(mouthGeometry({ round: 1 }).top.y < mouthGeometry({}).top.y);
  assert.ok(mouthGeometry({ round: 1 }).bottom.y > mouthGeometry({}).bottom.y);
});

test('what is behind the lips stays behind them, puckered or not', () => {
  const state = template();
  const inside = (values) => {
    const mouth = lips(state, values);
    const teeth = parsePath(pose(state, values).teeth.path).values;
    const xs = Array.from({ length: teeth.length / 2 }, (_, i) => teeth[i * 2]);
    return { widest: Math.max(...xs), narrowest: Math.min(...xs), corners: [mouth[0].x, mouth[2].x] };
  };
  for (const key of ['AE', 'OO', 'OH', 'EE']) {
    const report = inside(resolveViseme(state, key).controls);
    assert.ok(report.narrowest >= report.corners[0] - 0.5 && report.widest <= report.corners[1] + 0.5,
      `${key}: the teeth stay inside the lips (${report.narrowest} … ${report.widest} in ${report.corners.join(' … ')})`);
  }
  // Closed lips have nothing behind them to show, by construction: the band
  // encloses no area at all.
  const shut = parsePath(pose(state, { mouthOpen: 0, teeth: 1 }).teeth.path).values;
  assert.ok(Math.abs(shut[3] - shut[7]) < 1e-6, 'the two curves are the same curve traced twice');
});

/* ══ EXPRESSION + VISEME ════════════════════════════════════════════════════ */

const speaking = (state, expressionId, viseme, blend = 1) => {
  const expressions = normalizeExpressions(state);
  const weights = { ...(expressionId ? { [expressionId]: 1 } : {}), ...(viseme ? { [visemeExpressionId(viseme)]: blend } : {}) };
  return composeExpressionParams(rest(state), expressions, weights, state.params);
};

test('23 … 27 · a face and a speech shape compose, and neither is lost', () => {
  const state = template();
  for (const [face, viseme, keeps] of [
    ['happy', 'AE', { smile: 1 }], ['happy', 'OO', { smile: 1 }],
    ['sad', 'AE', { browInner: 0.8 }], ['angry', 'EE', { browInner: -1 }], ['surprised', 'OH', { browRaise: 1 }]
  ]) {
    const alone = speaking(state, face, null);
    const both = speaking(state, face, viseme);
    for (const [name, value] of Object.entries(keeps)) {
      assert.equal(both[name], value, `${face} + ${viseme} keeps ${name}`);
      assert.equal(both[name], alone[name], `and keeps it at exactly what ${face} said`);
    }
    const said = resolveViseme(state, viseme).controls;
    // The speech is *added*, then clamped to the movement's own range: a face
    // whose mouth is already fully open cannot open further, and the mixer
    // says so rather than wrapping round.
    const wanted = (name) => Math.min(state.params[name].max, alone[name] + said[name]);
    assert.ok(Math.abs(both.mouthOpen - wanted('mouthOpen')) < 1e-6, `${face} + ${viseme} adds the opening`);
    assert.ok(Math.abs(both.mouthRound - wanted('mouthRound')) < 1e-6, 'and the pucker');
    // The mouth really is drawn differently: speaking is not a no-op.
    assert.notEqual(pose(state, both).mouth.path, pose(state, alone).mouth.path);
  }
});

test('speech never returns the face to neutral', () => {
  const state = template();
  // `happy + OO` is not `OO`, and `happy` alone is not `happy + OO`.
  const happy = speaking(state, 'happy', null), oo = speaking(state, null, 'OO'), both = speaking(state, 'happy', 'OO');
  assert.equal(both.smile, happy.smile);
  assert.notEqual(both.smile, oo.smile);
  assert.equal(Number(both.mouthRound.toFixed(6)), Number(oo.mouthRound.toFixed(6)));
  // And a viseme says as little as it can: only `EE` touches `smile`, because
  // only `EE` really does pull the corners back.
  const touching = VISEME_PRESETS.filter((preset) => 'smile' in preset.controls).map((preset) => preset.id);
  assert.deepEqual(touching, ['EE'], 'anything else would fight the face it is spoken through');
});

test('the composed readout agrees with the runtime, down to the number', () => {
  const state = template();
  const happy = (state.expressions || []).find((item) => item.id === 'happy');
  const composed = composeFaceState(state, { base: rest(state), expression: happy.controls, viseme: 'AE', blend: 0.65 });
  const runtime = speaking(state, 'happy', 'AE', 0.65);
  for (const name of ['smile', 'mouthOpen', 'mouthWidth', 'mouthRound', 'teeth', 'eyeOpen', 'browRaise']) {
    assert.ok(Math.abs(composed[name] - runtime[name]) < 1e-6, `${name}: panel ${composed[name]} vs runtime ${runtime[name]}`);
  }
});

test('an eye state, a face and a gaze all compose at once', () => {
  const state = template();
  const happy = (state.expressions || []).find((item) => item.id === 'happy');
  const values = composeFaceState(state, { base: { ...rest(state), lookX: -0.7 }, expression: happy.controls, eyePose: 'squint', eyeSide: 'left', viseme: 'AE', blend: 1 });
  assert.equal(values.lookX, -0.7, 'the look survives');
  assert.equal(values.smile, 1, 'the face survives');
  assert.equal(values.eyeSquintLeft, 0.85, 'one eye is narrowed');
  assert.equal(values.eyeSquintRight, 0, 'and the other is not');
  assert.ok(values.mouthOpen > 0.7, 'and the mouth is saying AE');
});

/* ══ TRANSITIONS ════════════════════════════════════════════════════════════ */

const visemePath = (state, from, to, steps = 8) => Array.from({ length: steps + 1 }, (_, index) => {
  const blend = index / steps;
  const weights = visemeBlendWeights(from, to, blend);
  return composeExpressionParams(rest(state), normalizeExpressions(state), weights, state.params);
});

test('28 … 30 · a transition between two visemes passes through neither rest nor a jump', () => {
  const state = template();
  for (const [from, to] of [['AE', 'OO'], ['MBP', 'AE'], ['OH', 'EE']]) {
    const steps = visemePath(state, from, to);
    const start = resolveViseme(state, from).controls, end = resolveViseme(state, to).controls;
    for (const name of ['mouthOpen', 'mouthWidth', 'mouthRound']) {
      const track = steps.map((values) => values[name]);
      assert.ok(Math.abs(track[0] - (start[name] ?? 0)) < 1e-6, `${from}→${to}: ${name} starts at ${from}`);
      assert.ok(Math.abs(track.at(-1) - (end[name] ?? 0)) < 1e-6, `${from}→${to}: ${name} ends at ${to}`);
      // Monotonic, so it never doubles back through the resting value on its
      // way -- which is exactly what a pose-swapping speech layer does.
      const rising = track.at(-1) >= track[0];
      for (let i = 1; i < track.length; i += 1) {
        assert.ok(rising ? track[i] >= track[i - 1] - 1e-9 : track[i] <= track[i - 1] + 1e-9,
          `${from}→${to}: ${name} doubles back (${track.map((value) => value.toFixed(2)).join(' ')})`);
      }
      const low = Math.min(start[name] ?? 0, end[name] ?? 0), high = Math.max(start[name] ?? 0, end[name] ?? 0);
      for (const value of track) assert.ok(value >= low - 1e-9 && value <= high + 1e-9, `${from}→${to}: ${name} left the pair behind`);
    }
    // And no step is a jump: the biggest single change is a fraction of the whole.
    const span = Math.abs((end.mouthOpen ?? 0) - (start.mouthOpen ?? 0));
    const jumps = steps.slice(1).map((values, index) => Math.abs(values.mouthOpen - steps[index].mouthOpen));
    if (span > 0) assert.ok(Math.max(...jumps) <= span / 8 + 1e-9, `${from}→${to}: one step moved ${Math.max(...jumps)} of ${span}`);
    // The drawn mouth moves at every step, so the transition is visible.
    assert.equal(new Set(steps.map((values) => pose(state, values).mouth.path)).size, steps.length, `${from}→${to} draws nine different mouths`);
  }
});

test('a viseme sliding into itself is that viseme, not two halves of it', () => {
  assert.deepEqual(visemeBlendWeights('AE', 'AE', 0.5), { 'viseme-ae': 1 });
  assert.deepEqual(visemeBlendWeights('AE', 'OO', 0), { 'viseme-ae': 1 });
  assert.deepEqual(visemeBlendWeights('AE', 'OO', 1), { 'viseme-oo': 1 });
  assert.deepEqual(visemeBlendWeights(null, 'OO', 0.25), { 'viseme-oo': 0.25 }, 'starting from silence is a fade in');
  assert.deepEqual(visemeBlendWeights('nonsense', 'also-nonsense', 0.5), {}, 'and a track of names nobody knows asks for nothing');
});

test('a face is worn all the way through a sentence', () => {
  const state = template();
  const happy = normalizeExpressions(state).find((item) => item.id === 'happy');
  for (const blend of [0, 0.25, 0.5, 0.75, 1]) {
    const weights = { happy: 1, ...visemeBlendWeights('AE', 'OO', blend) };
    const values = composeExpressionParams(rest(state), [happy, ...normalizeExpressions(state)], weights, state.params);
    assert.equal(values.smile, 1, `the smile survives at ${blend}`);
  }
});

/* ══ SERIALIZATION ══════════════════════════════════════════════════════════ */

const roundtrip = (state) => {
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  const reopened = {};
  applyProjectSnapshot(reopened, snapshot);
  return { snapshot, reopened };
};

test('31 · an eye corrective survives save, reload and save', () => {
  const state = template();
  captureFaceCorrective(state, { kind: 'eye', slot: 'closedCurve', side: 'left', target: 'lidUpperLeft', posePath: lidPath('lidUpperLeft', { curve: 1 }) });
  const id = faceCorrectiveId({ kind: 'eye', slot: 'closedCurve', side: 'left', target: 'lidUpperLeft' });
  const first = roundtrip(state);
  const kept = first.reopened.shapeKeys.find((key) => key.id === id);
  assert.ok(kept, 'the corrective is in the file');
  assert.deepEqual(kept.faceState, { kind: 'eye', slot: 'closedCurve', side: 'left' }, 'and knows which state it belongs to');
  assert.equal(kept.driver.expression, '(eyeCurve + eyeCurveLeft) * (1 - eyeOpen - eyeOpenLeft)');
  const second = roundtrip(first.reopened);
  assert.deepEqual(second.snapshot.document.rig.shapeKeys, first.snapshot.document.rig.shapeKeys, 'save → reload → save loses nothing');
});

test('32 · a mouth corrective survives the same trip, weight and all', () => {
  const state = template();
  const store = createEditorStore(state), commands = createFaceStateCommands(store, createHistory(store));
  const captured = commands.capture({ kind: 'mouth', slot: 'round', target: 'mouth', posePath: parsePath(state.elements.mouth.restPath) && lidPath('lidUpperLeft') });
  assert.equal(captured.ok, false, 'a lid’s outline is not the mouth’s: refused');
  const ok = commands.capture({ kind: 'mouth', slot: 'round', target: 'mouth', posePath: state.elements.mouth.restPath.replace('176', '170') });
  assert.equal(ok.ok, true, ok.message);
  commands.setWeight({ kind: 'mouth', slot: 'round', target: 'mouth' }, 0.4);
  const { reopened, snapshot } = roundtrip(store.getDocument());
  const kept = reopened.shapeKeys.find((key) => key.faceState?.slot === 'round');
  assert.equal(kept.driver.amplitude, 0.4);
  assert.equal(kept.faceState.side, undefined, 'a mouth has no sides to take');
  assert.deepEqual(roundtrip(reopened).snapshot.document.rig.shapeKeys, snapshot.document.rig.shapeKeys);
});

test('33 · the viseme presets survive, and the exported rig carries them', () => {
  const state = template();
  const { reopened } = roundtrip(state);
  assert.deepEqual(installedVisemes(reopened), [...VISEME_KEYS]);
  const rig = createExportRig(reopened);
  assert.deepEqual(rig.expressions.filter((item) => item.viseme).map((item) => item.viseme), [...VISEME_KEYS]);
  assert.deepEqual(rig.expressions.find((item) => item.viseme === 'AE').controls, resolveViseme(state, 'AE').controls);
  // A viseme an author retuned stays retuned: the file is the truth.
  reopened.expressions.find((item) => item.viseme === 'OO').controls.mouthRound = 0.8;
  assert.equal(createExportRig(roundtrip(reopened).reopened).expressions.find((item) => item.viseme === 'OO').controls.mouthRound, 0.8);
});

test('34 · a project with none of this loads, saves and draws exactly as before', () => {
  // Every new field is optional, so a rig that predates them normalizes to a
  // rig without them rather than to one with defaults written in.
  const bare = {
    schemaVersion: 4, params: { eyeOpen: { type: 'number', min: 0, max: 1, default: 1, value: 1 } },
    states: { idle: { eyeOpen: 1 } }, activeState: 'idle',
    elements: { lid: { baseTransform: {}, bindings: {}, restPath: 'M0 0 L10 0 L10 10 Z' } },
    shapeKeys: [{ id: 'plain', target: 'lid', name: 'Plain', driver: { mode: 'range', parameter: 'eyeOpen', min: 0, max: 1 }, delta: [0, 0, 1, 0, 0, 0] }],
    expressions: [{ id: 'happy', name: 'Happy', controls: { eyeOpen: 0.9 } }]
  };
  const rig = normalizeRig(bare);
  assert.equal('faceState' in rig.shapeKeys[0], false, 'no corrective marker appears out of nowhere');
  assert.equal('viseme' in normalizeExpressions(rig)[0], false, 'and no face becomes a speech shape');
  assert.equal(rig.params.mouthRound, undefined, 'and no movement is added');
  assert.deepEqual(normalizeRig(rig).shapeKeys, rig.shapeKeys, 'normalizing twice is normalizing once');
  // And nothing unknown is thrown away: a field from a newer editor rides along.
  const future = normalizeRig({ ...bare, somethingNew: { kept: true } });
  assert.deepEqual(future.somethingNew, { kept: true });
});

test('a face state is authored, never generated: an untouched project carries none', () => {
  const state = template();
  assert.equal(faceCorrectives(state).length, 0);
  const blank = createCleanProjectState();
  assert.deepEqual(faceCorrectives(blank), []);
  assert.deepEqual(installedVisemes(blank), [], 'and an empty project has no speech shapes until asked');
});

/* ══ SVG TOPOLOGY ═══════════════════════════════════════════════════════════ */

test('35 · a compatible outline is accepted', () => {
  const state = template();
  const result = captureFaceCorrective(state, {
    kind: 'eye', slot: 'squint', side: 'right', target: 'lidLowerRight',
    posePath: lidPath('lidLowerRight', { squint: 1 })
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.shapeKey.delta.length, parsePath(LID_RESTS.lidLowerRight).values.length);
  assert.ok(result.shapeKey.delta.some((value) => value !== 0), 'and it is a real difference');
});

test('36 · an incompatible outline is refused, with the reason', () => {
  const state = template();
  const extra = `${LID_RESTS.lidUpperLeft.replace(/ Z$/, '')} L0 0 Z`;
  const refused = captureFaceCorrective(state, { kind: 'eye', slot: 'closed', side: 'left', target: 'lidUpperLeft', posePath: extra });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'topology-mismatch');
  assert.match(refused.message, /Corrective geometry is incompatible with the base path topology/);
  // And so is something that is not an outline at all.
  const nonsense = captureFaceCorrective(state, { kind: 'eye', slot: 'closed', side: 'left', target: 'lidUpperLeft', posePath: 'not a path' });
  assert.equal(nonsense.ok, false);
  assert.match(nonsense.message, /incompatible with the base path topology/);
  // A slot nobody has heard of is refused by name rather than half-written.
  assert.equal(captureFaceCorrective(state, { kind: 'eye', slot: 'invented', target: 'lidUpperLeft', posePath: LID_RESTS.lidUpperLeft }).reason, 'unknown-slot');
});

test('37 · a refused capture leaves the base outline and the project untouched', () => {
  const state = template();
  const before = { path: state.elements.lidUpperLeft.restPath, keys: structuredClone(state.shapeKeys) };
  captureFaceCorrective(state, { kind: 'eye', slot: 'closed', side: 'left', target: 'lidUpperLeft', posePath: `${LID_RESTS.lidUpperLeft} L5 5` });
  assert.equal(state.elements.lidUpperLeft.restPath, before.path, 'the drawing is as it was');
  assert.deepEqual(state.shapeKeys, before.keys, 'and nothing was written');
  // The same through the command layer, where it must also cost no undo step.
  const store = createEditorStore(template());
  const history = createHistory(store);
  const commands = createFaceStateCommands(store, history);
  const revision = store.getPersistentRevision();
  const refused = commands.capture({ kind: 'eye', slot: 'closed', side: 'left', target: 'lidUpperLeft', posePath: 'M0 0' });
  assert.equal(refused.ok, false);
  assert.equal(store.getPersistentRevision(), revision, 'no write');
  assert.equal(history.getState().canUndo, false, 'and no undo step claiming one happened');
});

/* ══ CORRECTIVES: THE VOCABULARY ════════════════════════════════════════════ */

test('a corrective slot is a sentence about the controls, and the sentences are independent', () => {
  // Each is a distinct monomial, which is what stops two correctives from
  // correcting the same shape twice.
  const sentences = [...EYE_CORRECTIVE_SLOTS, ...MOUTH_CORRECTIVE_SLOTS].map((slot) => correctiveExpression(slot.kind, slot.id));
  assert.equal(new Set(sentences).size, sentences.length, 'no two slots read the same sentence');
  // And every one of them is 0 at rest, which is what makes a corrective free.
  const state = template();
  for (const slot of [...EYE_CORRECTIVE_SLOTS, ...MOUTH_CORRECTIVE_SLOTS]) {
    assert.equal(correctiveActivation(slot.kind, slot.id, rest(state)), 0, `${slot.kind}.${slot.id} rests at 0`);
  }
});

test('a corrective corrects the mouth, however the mouth got there', () => {
  const state = template();
  captureFaceCorrective(state, { kind: 'mouth', slot: 'round', target: 'mouth', posePath: state.elements.mouth.restPath.replace('176', '168') });
  const viseme = pose(state, resolveViseme(state, 'OO').controls).mouth.path;
  const byHand = pose(state, { mouthOpen: 0.32, mouthWidth: -0.7, mouthRound: 1 }).mouth.path;
  assert.equal(viseme, byHand, 'a mouth puckered by OO and one puckered by hand are the same mouth');
});

test('an eye corrective copies to the other eye, on the other eye’s own sentence', () => {
  const state = template();
  captureFaceCorrective(state, { kind: 'eye', slot: 'closed', side: 'left', target: 'lidUpperLeft', posePath: lidPath('lidUpperLeft', { curve: 1 }) });
  const peer = (target) => target.replace('Left', 'Right');
  const report = copyFaceCorrectives(state, { kind: 'eye', from: 'left', to: 'right', peer });
  assert.equal(report.copied, 1);
  const twin = state.shapeKeys.find((key) => key.faceState?.side === 'right');
  assert.equal(twin.target, 'lidUpperRight');
  assert.equal(twin.driver.expression, '1 - eyeOpen - eyeOpenRight', 'and reads the right eye’s own offset');
  assert.deepEqual(twin.delta, state.shapeKeys.find((key) => key.faceState?.side === 'left').delta, 'two mirrored drawings take the same delta');
  // Mirrored instead, for artwork drawn from one shape slid across the face.
  removeFaceCorrective(state, { kind: 'eye', slot: 'closed', side: 'right', target: 'lidUpperRight' });
  const mirrored = copyFaceCorrectives(state, { kind: 'eye', from: 'left', to: 'right', peer, mirror: true });
  assert.equal(mirrored.copied, 1);
  const flipped = state.shapeKeys.find((key) => key.faceState?.side === 'right');
  const source = state.shapeKeys.find((key) => key.faceState?.side === 'left');
  assert.deepEqual(flipped.delta.filter((_, index) => index % 2 === 0), source.delta.filter((_, index) => index % 2 === 0).map((value) => -value));
  assert.deepEqual(flipped.delta.filter((_, index) => index % 2 === 1), source.delta.filter((_, index) => index % 2 === 1));
});

/* ══ THE PANEL'S MODEL ══════════════════════════════════════════════════════ */

test('the panel reads the states, the visemes and what each corrective is asking for', () => {
  const state = template();
  const values = { ...rest(state), eyeOpen: 0, eyeCurve: 1 };
  const model = faceStateModel(state, { side: 'left', values, expressionId: 'happy', viseme: 'AE', blend: 0.65 });
  assert.equal(model.eyes.ready, true);
  assert.equal(model.eyes.sided, true);
  assert.deepEqual(model.eyes.states.map((row) => row.id), EYE_POSE_PRESETS.map((preset) => preset.id));
  // The live face is a happy closed eye, so that is the state that reads back
  // as active -- for the pair, since the offsets are where the pair left them.
  assert.deepEqual(faceStateModel(state, { side: null, values }).eyes.states.filter((row) => row.active).map((row) => row.id), ['happyClosed']);
  // And the correctives the pose is asking for are lit, in order.
  const lit = model.eyes.correctives.filter((row) => Math.abs(row.activation) > 0.005).map((row) => row.id);
  assert.deepEqual([...lit].sort(), ['closed', 'closedCurve', 'curve']);
  assert.equal(model.mouth.visemes.every((row) => row.installed), true);
  assert.deepEqual(model.mouth.visemes.find((row) => row.id === 'OO').correctives.slice(0, 1).map((item) => item.id), ['round']);
  assert.deepEqual(model.mouth.combination, { expressionId: 'happy', expression: 'Happy', viseme: 'AE', blend: 0.65 });
  assert.equal(model.mouth.expressions.some((row) => row.id.startsWith('viseme-')), false, 'a speech shape is not a face to combine with');
  assert.equal(model.captured, 0);
});

test('the panel offers the speech shapes to a project that has none, and keeps a tuned one', () => {
  const state = template();
  state.expressions = state.expressions.filter((item) => !item.viseme);
  assert.deepEqual(installedVisemes(state), []);
  const report = installVisemes(state);
  assert.equal(report.ok, true);
  assert.deepEqual(report.added, ['REST', 'MBP', 'FV', 'AE', 'EE', 'OH', 'OO', 'L'], 'the eight a mouth needs; WQ is offered, not shipped');
  // Pressing it again adds nothing and changes nothing an author tuned.
  state.expressions.find((item) => item.viseme === 'AE').controls.mouthOpen = 0.9;
  const again = installVisemes(state);
  assert.deepEqual(again.added, []);
  assert.equal(state.expressions.find((item) => item.viseme === 'AE').controls.mouthOpen, 0.9, 'a viseme somebody adjusted is their work');
  assert.equal(installVisemes(state, { retune: true }).ok, true);
  assert.equal(state.expressions.find((item) => item.viseme === 'AE').controls.mouthOpen, 0.75, 'unless they ask for the catalogue back');
});

test('a mouth without the pucker still says the visemes, and says which movement is missing', () => {
  const state = template();
  delete state.params.mouthRound;
  state.expressions = state.expressions.filter((item) => !item.viseme);
  const oo = resolveViseme(state, 'OO');
  assert.deepEqual(oo.missing, ['mouthRound']);
  assert.equal(oo.usable, true, 'a little less roundly, rather than not at all');
  assert.deepEqual(Object.keys(oo.controls), ['mouthOpen', 'mouthWidth']);
  const report = installVisemes(state);
  assert.equal(report.ok, true);
  assert.deepEqual(report.added.length, 8);
});
