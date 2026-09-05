import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { HEAD_FAR_PULL, HEAD_REST, MOUTH_REST, NOSE_REST, SHADE_INSET, headPath, mouthGeometry, nosePath } from '../sample/templates/face-artwork.js';
import { HAND_DIGITS, HAND_PALM, handDigitTip, handShape } from '../sample/hand-artwork.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * The design brief, as assertions (docs/MASCOT_DESIGN.md).
 *
 * Its own acceptance criteria are visual — "la tête n'est plus lue comme un
 * simple cercle écrasé", "le yaw est lisible sans artifices" — and a screenshot
 * cannot be diffed usefully. What *can* be pinned is the geometry underneath
 * each of them, and that is what this file does: one test per criterion, each
 * measuring the property the criterion is about rather than the drawing that
 * happens to satisfy it today.
 */

/**
 * The knots of a path: the end point of every command.
 *
 * Not every number in it. A cubic carries two handles the curve never reaches
 * and an arc carries three flags that are not coordinates at all, so pairing up
 * the digits measures a shape nobody draws.
 */
const points = (d) => [...String(d).matchAll(/[MLQCAT]\s*([-\d.,\s]+)/gi)].map((match) => {
  const numbers = match[1].trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  return { x: numbers[numbers.length - 2], y: numbers[numbers.length - 1] };
}).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
const span = (d) => {
  const xs = points(d).map((p) => p.x), ys = points(d).map((p) => p.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};
const width = (d) => span(d).right - span(d).left;

/** The outline's half-width at a height, from the knots nearest to it. */
const halfWidthAt = (d, y, side) => {
  const near = points(d).filter((p) => Math.abs(p.y - y) < 12 && (side > 0 ? p.x > 120 : p.x < 120));
  assert.ok(near.length, `nothing drawn near y=${y}`);
  return side > 0 ? Math.max(...near.map((p) => p.x)) - 120 : 120 - Math.min(...near.map((p) => p.x));
};

const loaded = () => {
  const ids = ['faceRoot', 'hairBack', 'earLeft', 'earRight', 'head', 'shadeLeft', 'shadeRight', 'mouth', 'tongue', 'teeth',
    'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair',
    'eyeWhiteLeft', 'pupilLeft', 'glintLeft', 'lidUpperLeft', 'lidLowerLeft', 'rimLeft',
    'eyeWhiteRight', 'pupilRight', 'glintRight', 'lidUpperRight', 'lidLowerRight', 'rimRight',
    'earLeftShape', 'earLeftFold', 'earRightShape', 'earRightFold'];
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(ids.map((id) => [id, {
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 },
    baseOpacity: id.startsWith('shade') ? 0.22 : 1,
    constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: 'path' }
  }]));
  const leaf = (id) => ({ id, type: 'path', name: id, children: [] });
  const face = ['hairBack', 'earLeft', 'earRight', 'head', 'shadeLeft', 'shadeRight', 'mouth', 'tongue', 'teeth',
    'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: face.map((id) => (id === 'eyeLeft' || id === 'eyeRight'
    ? { id, type: 'g', name: id, children: ['eyeWhite', 'pupil', 'glint', 'lidUpper', 'lidLower', 'rim'].map((part) => leaf(`${part}${id === 'eyeLeft' ? 'Left' : 'Right'}`)) }
    : leaf(id))) }];
  applyTemplateProject(state);
  return state;
};

const at = (state, values) => compileRigFrame(state.elements,
  Object.fromEntries(Object.entries({ ...Object.fromEntries(Object.entries(state.params).map(([k, v]) => [k, v.value])), ...values })
    .map(([name, value]) => [name, { type: 'number', min: -1, max: 1, default: 0, value }])),
  {}, {}, { keyforms: state.keyforms, shapeKeys: state.shapeKeys });

test('the head is a head and not a circle', () => {
  // The criterion: "la tête n'est plus lue comme un simple cercle écrasé".
  // A circle has one radius; a head has a cranium wider than its jaw.
  const cranium = halfWidthAt(HEAD_REST, 86, 1);
  const jaw = halfWidthAt(HEAD_REST, 188, 1);
  const chin = halfWidthAt(HEAD_REST, 218, 1);
  assert.ok(cranium > 95, `the skull should be the widest part, got ${cranium}`);
  assert.ok(jaw < cranium * 0.8, `the jaw should draw in well inside the skull, got ${jaw} against ${cranium}`);
  assert.ok(chin < jaw * 0.7, `and the chin further still, got ${chin} against ${jaw}`);
  // And it is symmetric at rest, exactly: one half is written and the other is
  // its mirror, so this cannot drift.
  for (const p of points(HEAD_REST)) {
    const mirrored = points(HEAD_REST).some((q) => Math.abs(q.x - (240 - p.x)) < 0.11 && Math.abs(q.y - p.y) < 0.11);
    assert.ok(mirrored, `no mirror for (${p.x}, ${p.y})`);
  }
});

test('turning the head changes its shape, not its width', () => {
  // The failure this replaces: a squashed circle is still a circle. So the
  // turned outline must *not* be the rest outline scaled — the width is nearly
  // untouched while the profile moves a long way.
  const turned = headPath({ turn: 1 });
  assert.ok(Math.abs(width(turned) - width(HEAD_REST)) < 4, 'the silhouette should not simply get narrower');
  const rest = points(HEAD_REST), now = points(turned);
  const moved = Math.max(...now.map((p, index) => Math.hypot(p.x - rest[index].x, p.y - rest[index].y)));
  assert.ok(moved > 12, `the profile barely moved (${moved.toFixed(1)})`);

  // The far half comes in and the near half does not: that asymmetry *is* the
  // rotation, and it is the thing a uniform scale can never produce.
  const far = halfWidthAt(turned, 188, 1), near = halfWidthAt(turned, 188, -1);
  assert.ok(far < near * 0.85, `the far jaw should be well inside the near one, got ${far} against ${near}`);
  // And the chin follows the nose, towards the side the face now points at.
  assert.ok(span(turned).bottom > 0);
  const chinNow = points(turned).filter((p) => p.y > 214).map((p) => p.x);
  assert.ok(Math.min(...chinNow) > 120 - 30, 'the chin should have swung across, not stayed on the middle line');

  // Turning the other way is the mirror image, to the last decimal.
  const other = points(headPath({ turn: -1 }));
  now.forEach((p, index) => {
    const partner = other.find((q) => Math.abs(q.x - (240 - p.x)) < 0.11 && Math.abs(q.y - p.y) < 0.11);
    assert.ok(partner, `turning left is not the mirror of turning right at (${p.x}, ${p.y})`);
  });
});

test('the nose and the mouth carry the turn as shapes, not as slides', () => {
  // The nose was a single stroked curve that kept its shape however far the
  // head turned. It is a closed wedge now, and each part of it moves
  // differently: the bridge lags, the near wing flares, the far one tucks.
  const rest = points(NOSE_REST), turned = points(nosePath({ turn: 1 }));
  const shift = turned.map((p, index) => p.x - rest[index].x);
  assert.ok(Math.max(...shift) - Math.min(...shift) > 8,
    'every point of the nose moved by the same amount, which is a slide');
  assert.ok(Math.min(...shift) < 0 && shift[0] < 0, 'the bridge should lag behind the turn');

  // The mouth: the far corner draws in towards the middle while the near one
  // stays out, so the two halves of the lip line stop being equal.
  const straight = mouthGeometry();
  assert.equal(straight.top.x - straight.left.x, straight.right.x - straight.top.x, 'at rest the mouth is symmetric');
  const g = mouthGeometry({ turn: 1 });
  const nearHalf = g.top.x - g.left.x, farHalf = g.right.x - g.top.x;
  assert.ok(nearHalf > farHalf * 1.5, `the far half should be much the shorter, got ${farHalf} against ${nearHalf}`);
  // The corners move together, so the shape key carries the asymmetry and the
  // rig's own foreshortening is left to carry the width. Otherwise the mouth
  // travels against its own parallax and stops being the deepest feature.
  assert.equal(g.right.x - g.left.x, straight.right.x - straight.left.x);
  assert.ok(Math.abs((g.left.x + g.right.x) / 2 - 120) < 3, 'and it barely shifts as a whole');
});

test('the three views work with the light switched off', () => {
  // The founding rule of the brief: strip the shading and the turn must still
  // read. Here that is literal — the shading is set to nothing and the head's
  // own outline is asked what it looks like at each of the three positions.
  const state = loaded();
  for (const id of ['shadeLeft', 'shadeRight']) state.elements[id].baseOpacity = 0;

  const front = at(state, { headX: 0 }).head.path;
  const right = at(state, { headX: 1 }).head.path;
  const left = at(state, { headX: -1 }).head.path;
  assert.notEqual(front, right, 'headX does not reach the outline at all');
  assert.notEqual(left, right);

  // Each of the three is the same character: the same number of points, the
  // same height, the same width to within a few units.
  for (const view of [left, right]) {
    assert.equal(points(view).length, points(front).length, 'the topology has to survive, or nothing can interpolate');
    assert.ok(Math.abs(width(view) - width(front)) < 5);
  }
  // And each turned one is asymmetric where the front one is not.
  const lopsided = (d) => halfWidthAt(d, 188, 1) - halfWidthAt(d, 188, -1);
  assert.ok(Math.abs(lopsided(front)) < 0.2, 'the front view is symmetric');
  assert.ok(lopsided(right) < -8, 'turned right, the right jaw is the far one');
  assert.ok(lopsided(left) > 8, 'and turned left it is the near one');
});

test('the shading supports the volume and never carries it', () => {
  const state = loaded();
  // Faint to begin with, and all but gone at rest: at `headX = 0` the binding
  // leaves a tenth of an already low opacity, which is a hint and not a slab.
  assert.ok(state.elements.shadeLeft.baseOpacity <= 0.25);
  const rest = at(state, { headX: 0 });
  assert.ok(rest.shadeLeft.opacity < 0.03, `the resting face should be lit evenly, got ${rest.shadeLeft.opacity}`);
  const turned = at(state, { headX: 1 });
  assert.ok(turned.shadeRight.opacity > rest.shadeRight.opacity);
  assert.ok(turned.shadeRight.opacity < 0.2, 'and even at a full turn it stays a hint');
  assert.equal(turned.shadeLeft.opacity, 0, 'the side coming forward is lit');

  // It also has to stay *inside* the turned silhouette. The shading does not
  // follow the head's outline, and the far cheek comes a long way in — so the
  // inset it is drawn at has to cover the furthest that outline ever travels.
  assert.ok(SHADE_INSET > HEAD_FAR_PULL,
    `the shading sits ${SHADE_INSET} inside an outline that moves ${HEAD_FAR_PULL}`);
});

test('the outline is the strongest line in the drawing', () => {
  // "le regard se focalise trop sur les détails internes" — the old face put
  // the head at 4 and the eyebrows at 8. Nothing drawn *on* the face may now
  // be heavier than the face.
  const svg = PROJECT_TEMPLATES.basic.svg;
  const strokeOf = (id) => {
    const match = new RegExp(`id="${id}"[^>]*stroke-width="([\\d.]+)"`).exec(svg);
    return match ? Number(match[1]) : null;
  };
  const head = strokeOf('head');
  assert.ok(head >= 6, `the silhouette should be heavy, got ${head}`);
  for (const id of ['rimLeft', 'rimRight', 'nose', 'lidUpperLeft', 'lidLowerLeft', 'earLeftShape', 'mouth']) {
    assert.ok(strokeOf(id) < head, `${id} is drawn heavier than the head outline`);
  }
  const brows = /id="eyebrows"[^>]*stroke-width="([\d.]+)"/.exec(svg);
  assert.ok(Number(brows[1]) < head, 'and so were the eyebrows, which were the heaviest line of all');
  // The eyes are lighter than the mouth and the brows, which is the order the
  // brief asks for: outline, then mouth and brows, then eyes, then details.
  assert.ok(strokeOf('rimLeft') < Number(brows[1]) && strokeOf('rimLeft') < strokeOf('mouth'));
  assert.ok(strokeOf('nose') < strokeOf('rimLeft'));
});

test('the two eyes are one drawing and its mirror, and neither is an ellipse', () => {
  const svg = PROJECT_TEMPLATES.basic.svg;
  const shape = (id) => new RegExp(`id="${id}"[^>]*d="([^"]+)"`).exec(svg)[1];
  const left = points(shape('eyeWhiteLeft')), right = points(shape('eyeWhiteRight'));
  assert.equal(left.length, right.length);
  // Mirrored about the face, not copied: an eye has an inner corner and an
  // outer one, and they are not the same corner.
  left.forEach((p) => {
    assert.ok(right.some((q) => Math.abs((q.x - 158) + (p.x - 82)) < 0.11 && Math.abs(q.y - p.y) < 0.11),
      `the right eye is not the mirror of the left at (${p.x}, ${p.y})`);
  });
  // And not an ellipse: the two corners sit at different heights, which is what
  // makes foreshortening it visible at all.
  const corners = left.filter((p) => Math.abs(p.x - 82) > 20);
  assert.ok(Math.abs(corners[0].y - corners[1].y) > 3, 'the eye is level end to end, which reads as a disc');
});

test('a hand turns by its silhouette and its thumb, not by moving', () => {
  const box = { width: 240, height: 240 };
  const at = { x: 60, y: 60 };
  const open = handShape('left', 'open', { at, box });
  const away = handShape('left', 'open', { at, box, turn: 1 });
  const towards = handShape('left', 'open', { at, box, turn: -1 });
  assert.notEqual(open, away);

  // Same commands in the same order: a turn is a shape key like any pose.
  const commands = (d) => String(d).replace(/[-\d.\s]+/g, ' ').trim();
  assert.equal(commands(open), commands(away));
  assert.equal(commands(open), commands(towards));

  // The half going away compresses and the half coming forward eases out, so
  // the hand is not the same hand shifted sideways.
  const edge = (d, side) => (side > 0 ? Math.max(...points(d).map((p) => p.x)) : Math.min(...points(d).map((p) => p.x)));
  assert.ok(edge(away, 1) < edge(open, 1), 'the far edge of the palm should come in');
  assert.ok(width(towards) < width(open) * 0.85,
    'turned away from the thumb, the hand should fold up to a much narrower silhouette');
  // Not a translation, and not a scale either: the same edge moves in opposite
  // directions depending on which way the hand faces. That is the whole
  // difference between a hand that faces somewhere and one that merely moved.
  assert.equal(Math.sign(edge(away, -1) - edge(open, -1)), -1);
  assert.equal(Math.sign(edge(towards, -1) - edge(open, -1)), 1);

  // And the thumb — the one landmark that leaves the plane of the palm — moves
  // differently from the fingers, which is what says which way the hand faces.
  const tip = (turn, digit) => handDigitTip('left', digit, { at, box, turn });
  const thumbSwing = Math.hypot(tip(1, 'thumb').x - tip(-1, 'thumb').x, tip(1, 'thumb').y - tip(-1, 'thumb').y);
  const ringSwing = Math.hypot(tip(1, 'ring').x - tip(-1, 'ring').x, tip(1, 'ring').y - tip(-1, 'ring').y);
  assert.ok(thumbSwing > ringSwing, `the thumb should travel furthest of all, got ${thumbSwing.toFixed(1)} against ${ringSwing.toFixed(1)}`);
});

test('the hand is a hand: a wrist, a palm and a thumb that is not a finger', () => {
  assert.ok(HAND_PALM.wristHalf < HAND_PALM.halfWidth, 'the palm should widen from the wrist to the knuckles');
  const thumb = HAND_DIGITS.find((digit) => digit.id === 'thumb');
  const fingers = HAND_DIGITS.filter((digit) => digit.id !== 'thumb');
  assert.equal(fingers.length, 3, 'a thumb and three fingers is the cartoon standard');
  assert.ok(fingers.every((finger) => thumb.width > finger.width), 'the thumb has to be the thickest digit to read as one');
  assert.ok(fingers.every((finger) => thumb.length < finger.length), 'and the shortest');
  assert.ok(fingers.every((finger) => Math.abs(thumb.angle - finger.angle) > 40), 'and it must leave the palm at its own angle');
});
