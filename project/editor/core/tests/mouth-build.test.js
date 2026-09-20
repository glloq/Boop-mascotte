import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOUTH, MOUTH_BOX, MOUTH_REST, TEETH, TEETH_REST, TEETH_LOWER_REST, TONGUE, TONGUE_REST, TONGUE_TIP_REST,
  mouthGeometry, mouthPath, teethPath, teethLowerPath, tonguePath, tongueTipPath
} from '../face/mouth-build.js';

/**
 * The five shapes a mouth is made of (V6; docs/MOUTH_BUILD.md).
 *
 * ```text
 *   mouth       the lips, and the cavity: one closed path
 *   teeth       the upper row, its biting edge scalloped into crowns
 *   teethLower  the lower row, the same band from the lower lip
 *   tongue      the body: two lobes with a groove between them
 *   tongueTip   the lobe that laps over the lower lip
 * ```
 *
 * Three properties hold all of it together, and every test here is one of them:
 *
 * 1. **every inside is empty at rest**, so a shut mouth has nothing behind it
 *    to hide — by construction rather than by an opacity somebody remembered;
 * 2. **every point is affine in every pose number, separately**, so the rig's
 *    additive shape keys reproduce any combination exactly rather than
 *    approximately (docs/SHAPE_KEYS.md);
 * 3. **the topology never changes**, so one key can interpolate any two poses.
 */

/* ── Reading a path ──────────────────────────────────────────────────────── */

/** The numbers of a path, in order: what a shape key interpolates. */
const numbers = (d) => (String(d).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
/** And its commands, which are what must never move. */
const commands = (d) => (String(d).match(/[A-Za-z]/g) || []).join('');

/**
 * The polygon a path draws, flattened.
 *
 * Flattened rather than shoelaced over the `d` string, because the emptiness
 * is a property of the *curve*: a scalloped row's control polygon is not
 * degenerate even when the shape it draws encloses nothing.
 */
function outline(d, steps = 48) {
  const tokens = String(d).match(/[MQCZ]|-?\d+(?:\.\d+)?/g) || [];
  const points = [];
  let index = 0, at = null, first = null;
  const read = () => ({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === 'Z') { at = first; continue; }
    if (command === 'M') { at = first = read(); points.push(at); continue; }
    const between = Array.from({ length: command === 'Q' ? 1 : 2 }, read);
    const end = read();
    const all = [at, ...between, end];
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const run = all.map((point) => ({ ...point }));
      for (let order = all.length - 1; order > 0; order -= 1) {
        for (let k = 0; k < order; k += 1) { run[k].x += (run[k + 1].x - run[k].x) * t; run[k].y += (run[k + 1].y - run[k].y) * t; }
      }
      points.push(run[0]);
    }
    at = end;
  }
  return points;
}

/** How much ink a path paints. */
const area = (d) => {
  const points = outline(d);
  return Math.abs(points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
};
const box = (d) => {
  const points = outline(d);
  return { top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)), left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)) };
};

const SHAPES = [
  ['teeth', teethPath, TEETH_REST],
  ['teethLower', teethLowerPath, TEETH_LOWER_REST],
  ['tongue', tonguePath, TONGUE_REST],
  ['tongueTip', tongueTipPath, TONGUE_TIP_REST]
];
/**
 * No ink at all, in the units the mouth is drawn in.
 *
 * Not exactly zero: the coordinates are rounded to a hundredth of a unit and
 * each segment of a scalloped row rounds on its own, so the two edges that
 * retrace each other in arithmetic retrace each other to within a hundredth on
 * the page. Three tenths of a square unit across a row 47 units long is a band
 * a hundred and fiftieth of a unit thick, against the 340 a shown row paints:
 * a thousandth of the ink, which is no ink at all.
 */
const NOTHING = 0.3;

/* ── 1 · Empty at rest ───────────────────────────────────────────────────── */

test('everything inside the mouth is empty until it is asked for', () => {
  for (const [name, , rest] of SHAPES) assert.ok(area(rest) < NOTHING, `${name} paints nothing at rest: ${area(rest).toFixed(4)}`);
  // And at every pose of the *lips*, which is the property that matters: what
  // hides the teeth of a smiling, puckered, leaning, wide open mouth is that
  // there is nothing to hide, not that somebody faded it out.
  for (const [name, draw] of SHAPES) {
    for (const pose of [{ open: 1 }, { smile: 1 }, { smile: -1 }, { round: 1 }, { skew: 1 }, { arc: 1 }, { open: 1, smile: 1, round: 1, skew: -1 }]) {
      assert.ok(area(draw(pose)) < NOTHING, `${name} at ${JSON.stringify(pose)}: ${area(draw(pose)).toFixed(4)}`);
    }
  }
  // The lips are the one shape that is *not* empty: they are the mouth.
  assert.ok(area(MOUTH_REST) > 100);
});

test('and full when it is: a row of teeth, a tongue, and a tip over the lip', () => {
  assert.ok(area(teethPath({ open: 1, show: 1 })) > 250, 'the upper row');
  assert.ok(area(teethLowerPath({ open: 1, show: 1 })) > 100, 'the lower one, shallower');
  assert.ok(area(teethLowerPath({ open: 1, show: 1 })) < area(teethPath({ open: 1, show: 1 })), 'and never the deeper of the two');
  assert.ok(area(tonguePath({ open: 1, show: 1 })) > 250, 'the body');
  assert.ok(area(tongueTipPath({ out: 1 })) > 150, 'the tip');
});

/* ── 2 · Affine in every number, separately ──────────────────────────────── */

test('two poses add up to exactly the drawing of both, which is what shape keys need', () => {
  // A shape key is a delta and the rig adds them. So `rest + Δopen + Δshow` has
  // to *be* the mouth drawn open and shown, not an approximation of it -- and
  // it is, because no point of any of these shapes is a product of two pose
  // numbers. That is why `BAND_REACH` is a constant rather than this mouth's
  // own height (docs/MOUTH_BUILD.md).
  const combine = (draw, one, other) => {
    const rest = numbers(draw({}));
    const first = numbers(draw(one)), second = numbers(draw(other));
    const both = numbers(draw({ ...one, ...other }));
    return Math.max(...rest.map((value, index) => Math.abs(value + (first[index] - value) + (second[index] - value) - both[index])));
  };
  const ROUNDING = 0.011;
  for (const [name, draw] of [['mouth', mouthPath], ...SHAPES.map(([id, fn]) => [id, fn])]) {
    for (const [one, other] of [
      [{ open: 1 }, { smile: 1 }], [{ open: 1 }, { round: 1 }], [{ smile: -1 }, { skew: 1 }],
      [{ round: 1 }, { arc: 1 }], [{ open: 1 }, { show: 1 }], [{ show: 1 }, { skew: -1 }],
      [{ out: 1 }, { curl: 1 }], [{ open: 1 }, { out: 1 }]
    ]) {
      assert.ok(combine(draw, one, other) <= ROUNDING,
        `${name}: ${JSON.stringify(one)} + ${JSON.stringify(other)} is off by ${combine(draw, one, other)}`);
    }
  }
});

/* ── 3 · One topology ────────────────────────────────────────────────────── */

test('no pose changes a shape\'s topology, so one key interpolates any two', () => {
  const poses = [{}, { open: 1 }, { smile: 1 }, { smile: -1 }, { round: 1 }, { skew: 1 }, { skew: -1 }, { arc: 1 },
    { show: 1 }, { out: 1 }, { curl: 1 }, { curl: -1 }, { open: 1, smile: 1, round: 1, skew: 1, show: 1, out: 1, curl: 1 }];
  for (const [name, draw] of [['mouth', mouthPath], ...SHAPES.map(([id, fn]) => [id, fn])]) {
    const shapes = new Set(poses.map((pose) => commands(draw(pose))));
    assert.equal(shapes.size, 1, `${name}: ${[...shapes].join(' | ')}`);
    const lengths = new Set(poses.map((pose) => numbers(draw(pose)).length));
    assert.equal(lengths.size, 1, `${name}: ${[...lengths].join(' | ')} numbers`);
  }
  assert.equal(commands(MOUTH_REST), 'MQQZ', 'the lips are four points and one closed path');
  assert.equal(commands(TEETH_REST), `MQ${'Q'.repeat(TEETH.crowns)}Z`, 'a row is a gum edge and one quadratic per crown');
  assert.equal(commands(TONGUE_REST), 'MCCCCZ', 'the tongue is two lobes there and two back');
  assert.equal(commands(TONGUE_TIP_REST), 'MCCCCZ');
});

/* ── The drawing itself ──────────────────────────────────────────────────── */

test('the lips lean without lifting, which is what a smirk is and a smile is not', () => {
  const rest = mouthGeometry(), skewed = mouthGeometry({ skew: 1 });
  assert.ok(skewed.left.y > rest.left.y, 'one corner down');
  assert.ok(skewed.right.y < rest.right.y, 'the other up');
  assert.equal(Math.round((skewed.left.y - rest.left.y) + (skewed.right.y - rest.right.y)), 0, 'and by the same amount, so a lean is not half a smile');
  assert.ok(skewed.top.x > rest.top.x && skewed.bottom.x > rest.bottom.x, 'the lip line leans after them');
  // Signed, so one shape key serves both directions.
  const other = mouthGeometry({ skew: -1 });
  assert.equal(other.left.y - rest.left.y, -(skewed.left.y - rest.left.y));
  // And a smile still lifts both, which is what makes the two different.
  const smiling = mouthGeometry({ smile: 1 });
  assert.equal(smiling.left.y, smiling.right.y);
  assert.ok(smiling.left.y < rest.left.y);
});

test('a row of teeth is crowns rather than a slab, and hangs clear of the lip it grows from', () => {
  assert.ok(TEETH.crowns >= 3 && TEETH.crowns <= 5, 'enough to read as a row, few enough to survive being small');
  // The biting edge is scalloped: its depth below the gum edge rises and falls
  // across the row, which a single arc cannot do.
  const shown = outline(teethPath({ open: 1, show: 1 }));
  const bottom = shown.filter((point) => point.y > box(teethPath({ open: 1, show: 1 })).bottom - 6).map((point) => point.y);
  assert.ok(Math.max(...bottom) - Math.min(...bottom) > 1.5, 'the biting edge is not a single smooth arc');
  // Clear of the lip: the row's top starts below the lip line it hangs from,
  // so the upper lip is still drawn where the teeth are.
  const lip = mouthGeometry({ open: 1 });
  const middle = (lip.left.y + 2 * lip.top.y + lip.right.y) / 4;
  assert.ok(box(teethPath({ open: 1, show: 1 })).top > middle - 0.5, 'the row starts at the lip, not over it');
  // The lower row hangs the other way, off the lower lip.
  const floor = (lip.left.y + 2 * lip.bottom.y + lip.right.y) / 4;
  assert.ok(box(teethLowerPath({ open: 1, show: 1 })).bottom < floor + 0.5, 'and the lower row stops at the lower lip');
});

test('the tongue is two lobes with a groove between them, and its tip laps over the lip', () => {
  assert.ok(TONGUE.groove > 0 && TONGUE.groove < 0.5, 'the groove comes back off the peaks without splitting them');
  // The body's back is a peak, a dip and a peak -- which is a tongue, where one
  // arch is a hill and a single cubic with a node in the middle is a butterfly
  // (docs/MOUTH_BUILD.md).
  const body = outline(tonguePath({ open: 1, show: 1 }));
  const lip = mouthGeometry({ open: 1 });
  const middleX = lip.bottom.x;
  const near = (x, span) => body.filter((point) => Math.abs(point.x - x) < span).map((point) => point.y);
  const centre = Math.min(...near(middleX, 1.2));
  const left = Math.min(...near(middleX - 9, 1.2)), right = Math.min(...near(middleX + 9, 1.2));
  assert.ok(centre > left + 1 && centre > right + 1, `a groove between two lobes: ${left.toFixed(1)} … ${centre.toFixed(1)} … ${right.toFixed(1)}`);

  // The tip goes *past* the lower lip, which is the one thing the body must
  // never do and the whole reason they are two shapes (§8.4 of the brief).
  const floor = (lip.left.y + 2 * lip.bottom.y + lip.right.y) / 4;
  // The body rests **on** the lower lip: its underside hangs the width of a
  // dark line below it, which is what says the tongue is in a mouth rather
  // than being the floor of one, and nothing like the tip's reach.
  const seat = box(tonguePath({ open: 1, show: 1 })).bottom - floor;
  assert.ok(seat > 0 && seat < 2.5, `the body stays on the lip: ${seat.toFixed(2)} below it`);
  assert.ok(box(tongueTipPath({ open: 1, out: 1 })).bottom > floor + 5, 'and the tip hangs over the lip');
});

test('out is a reach and curl is a turn, and neither is a scale or a rotation', () => {
  // `tongueOut` was a `scaleY` about the tongue's middle and `tongueCurl` a
  // rotation of the whole drawing. A scale stretches the root as far as the
  // tip; a rotation swings the root out through a cheek. Neither is the word.
  const reach = (pose) => box(tongueTipPath(pose)).bottom - box(tongueTipPath(pose)).top;
  assert.ok(reach({ out: 1 }) > reach({ out: 0.5 }), 'further out is further out');
  // The root does not move: the tip is anchored on the lip whatever it does.
  const anchor = (pose) => numbers(tongueTipPath(pose)).slice(0, 2);
  assert.deepEqual(anchor({ out: 1 }), anchor({}), 'out moves the free edge and not the root');
  assert.deepEqual(anchor({ curl: 1 }), anchor({}), 'and so does a curl');
  // A curl turns the end up and holds the shoulders, which is what curling is:
  // lifting the whole free edge is the tongue going back in.
  const cleft = (pose) => numbers(tongueTipPath(pose))[9 * 2 + 1];
  assert.ok(cleft({ out: 1, curl: 1 }) < cleft({ out: 1 }) - 5, 'the end comes up');
  assert.ok(cleft({ out: 1, curl: -1 }) > cleft({ out: 1 }) + 5, 'and, signed, it droops');
  assert.ok(box(tongueTipPath({ out: 1, curl: 1 })).bottom > box(tongueTipPath({})).bottom + 3,
    'and a fully curled tongue is still out, not back in');
});

test('the pucker is still what makes a vowel, and everything inside follows it', () => {
  const rest = mouthGeometry(), round = mouthGeometry({ round: 1 });
  const width = (g) => g.right.x - g.left.x;
  assert.ok(width(round) < width(rest) * 0.75, 'the corners come in');
  assert.ok(round.top.y < rest.top.y && round.bottom.y > rest.bottom.y, 'and the lip line bows out above and below them');
  // Drawn from the lips, so each inside comes in with them rather than showing
  // outside an O.
  for (const [name, draw] of SHAPES) {
    const open = box(draw({ open: 0.5, show: 1, out: 1 })), puckered = box(draw({ open: 0.5, show: 1, out: 1, round: 1 }));
    assert.ok(puckered.right - puckered.left < open.right - open.left, `${name} narrows with the pucker`);
  }
});

test('the numbers the rig measures itself against are where they were', () => {
  // The lips' own box is what the mouth rig's three pins are placed from
  // (docs/FACE_CONTROL_RIG.md, CR-27 … CR-31): it is measured off the control
  // points, because the pin that lets the jaw pull the lower lip has to reach
  // the point that *draws* the lower lip.
  assert.deepEqual(MOUTH_BOX, { x: mouthGeometry().left.x, y: mouthGeometry().left.y - 3, width: MOUTH.half * 2, height: mouthGeometry().bottom.y - (mouthGeometry().left.y - 3) });
  assert.equal(MOUTH.cx, 120);
  assert.equal(mouthGeometry({ open: 1 }).bottom.y - mouthGeometry().bottom.y, MOUTH.openDrop);
});
