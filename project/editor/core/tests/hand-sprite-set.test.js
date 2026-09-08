import test from 'node:test';
import assert from 'node:assert/strict';
import { HAND_SIDES, handViewMirror } from '../../../runtime/hand-vocabulary.js';
import { createHandAssetLibrary, resolveHandAsset } from '../../../runtime/hand-assets.js';
import {
  GENERATED_SPRITE_POSES, HAND_SPRITE_VIEWS, SPRITE_PIVOT, SPRITE_SCALE, SPRITE_VIEW_BOX, SPRITE_VIEW_BOX_ATTRIBUTE,
  handSpriteAssets, handSpriteDocument, handSpriteElementId, handSpriteManifest, handSpriteMarkup, handSpriteParts,
  handSpritePath, handSpritePoseTable, handSpriteSetMarkup
} from '../hands/hand-sprite-set.js';
import { handSpriteTable } from '../sample/hand-artwork.js';
import { parsePath } from '../../../runtime/path-vector.js';

/**
 * The drawings a 2D hand swaps between (docs/HANDS_2D.md, PHASES 21-25).
 * What is pinned here is what makes a swap invisible: one box, one pivot, one
 * size, and five drawings that are actually five drawings.
 */
const bounds = (parts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of Object.values(parts.paths)) {
    const { values } = parsePath(d);
    for (let i = 0; i + 1 < values.length; i += 2) {
      x0 = Math.min(x0, values[i]); x1 = Math.max(x1, values[i]);
      y0 = Math.min(y0, values[i + 1]); y1 = Math.max(y1, values[i + 1]);
    }
  }
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
};
const at = { x: SPRITE_PIVOT[0], y: SPRITE_PIVOT[1] };
const drawn = (side, pose, view) => handSpriteParts(side, pose, view, { at, scale: SPRITE_SCALE });

test('every view of a pose is its own drawing, not a copy of another', () => {
  for (const pose of GENERATED_SPRITE_POSES) {
    const seen = new Map();
    for (const view of HAND_SPRITE_VIEWS) {
      const key = JSON.stringify(drawn('left', pose, view).paths);
      assert.equal(seen.has(key), false, `${pose}: ${view} draws the same as ${seen.get(key)}`);
      seen.set(key, view);
    }
  }
});

test('every drawing fits the shared box, clear of its own line', () => {
  for (const side of HAND_SIDES) {
    for (const pose of GENERATED_SPRITE_POSES) {
      for (const view of HAND_SPRITE_VIEWS) {
        const box = bounds(drawn(side, pose, view));
        const where = `${side}/${pose}/${view}`;
        assert.ok(box.x0 > 6 && box.y0 > 6, `${where} runs off the top or left: ${box.x0},${box.y0}`);
        assert.ok(box.x1 < SPRITE_VIEW_BOX.width - 6 && box.y1 < SPRITE_VIEW_BOX.height - 6, `${where} runs off the bottom or right: ${box.x1},${box.y1}`);
      }
    }
  }
});

test('the views of one pose keep one visual size: a swap never resizes the hand', () => {
  for (const pose of GENERATED_SPRITE_POSES) {
    const heights = HAND_SPRITE_VIEWS.map((view) => bounds(drawn('left', pose, view)).height);
    const spread = Math.max(...heights) - Math.min(...heights);
    assert.ok(spread < 0.2 * Math.max(...heights), `${pose}: heights range over ${spread.toFixed(1)} of ${Math.max(...heights).toFixed(1)}`);
    // A hand turning edge-on is narrower, and never wider, than its front.
    const front = bounds(drawn('left', pose, 'front')).width;
    for (const view of ['sideLeft', 'sideRight']) {
      assert.ok(bounds(drawn('left', pose, view)).width <= front, `${pose}: ${view} is wider than the front`);
    }
  }
});

test('a hand is the mirror of the other hand at the mirrored view', () => {
  // Two hands turning the same way do not show the same thing: they are
  // mirror-image objects, so a turn that brings the left hand's thumb round
  // takes the right hand's away. `right at V` is `left at mirror(V)`, flipped.
  for (const pose of GENERATED_SPRITE_POSES) {
    for (const view of HAND_SPRITE_VIEWS) {
      const left = bounds(drawn('left', pose, handViewMirror(view)));
      const right = bounds(drawn('right', pose, view));
      assert.ok(Math.abs((SPRITE_PIVOT[0] - left.x0) - (right.x1 - SPRITE_PIVOT[0])) < 0.2, `${pose}/${view} left edge`);
      assert.ok(Math.abs((left.x1 - SPRITE_PIVOT[0]) - (SPRITE_PIVOT[0] - right.x0)) < 0.2, `${pose}/${view} right edge`);
      assert.ok(Math.abs(left.height - right.height) < 0.2, `${pose}/${view} height`);
    }
  }
});

test('at the front the pair is a pair: two hands mirroring each other', () => {
  for (const pose of GENERATED_SPRITE_POSES) {
    const left = bounds(drawn('left', pose, 'front'));
    const right = bounds(drawn('right', pose, 'front'));
    assert.ok(Math.abs((SPRITE_PIVOT[0] - left.x0) - (right.x1 - SPRITE_PIVOT[0])) < 0.2, pose);
  }
});

test('a right hand is drawn from the mirrored view, so a pair reads as a pair', () => {
  assert.equal(handSpriteTable('left', 'threeQuarterRight'), 'threeQuarter');
  assert.equal(handSpriteTable('right', 'threeQuarterRight'), 'threeQuarterFar');
  assert.equal(handSpriteTable('left', 'front'), 'front');
  assert.equal(handSpriteTable('right', 'front'), 'front');
  assert.equal(handSpriteTable('left', 'rubbish'), 'front');
});

test('the view that turns away paints the thumb behind the palm', () => {
  assert.deepEqual(drawn('left', 'relaxed', 'threeQuarterLeft').order, ['thumb', 'palm', 'ring', 'middle', 'index', 'cuff']);
  assert.deepEqual(drawn('left', 'relaxed', 'front').order, ['palm', 'ring', 'middle', 'index', 'thumb', 'cuff']);
  assert.deepEqual(drawn('right', 'relaxed', 'threeQuarterRight').order, ['thumb', 'palm', 'ring', 'middle', 'index', 'cuff']);
});

test('a pose keeps only its shape where the view was not drawn for it', () => {
  // The front table places the thumb; the side view has no business with that.
  assert.equal(handSpritePoseTable('open', 'front').digits.thumb.angle, -76);
  assert.equal(handSpritePoseTable('open', 'sideRight').digits.thumb, undefined);
  // ...but a curl is a curl on every drawing.
  assert.equal(handSpritePoseTable('relaxed', 'sideRight').digits.index.curl, 0.3);
  assert.equal(handSpritePoseTable('relaxed', 'sideRight').digits.index.base, undefined);
  // A pose with a drawing of its own in profile uses it whole.
  assert.ok(handSpritePoseTable('fist', 'sideRight').digits.thumb.angle);
  assert.equal(handSpritePoseTable('rubbish', 'front').digits.index.curl, 0.3);
});

test('the starter set is one pose in five views', () => {
  const assets = handSpriteAssets('left', { pivot: [...SPRITE_PIVOT] });
  assert.equal(assets.length, 5);
  assert.deepEqual(assets.map((asset) => asset.view), [...HAND_SPRITE_VIEWS]);
  assert.deepEqual([...new Set(assets.map((asset) => asset.pose))], ['relaxed']);
  for (const asset of assets) assert.deepEqual(asset.pivot, [...SPRITE_PIVOT]);
});

test('an asymmetric pose ships drawings that refuse to be flipped', () => {
  const assets = handSpriteAssets('left', { poses: ['point', 'fist'] });
  assert.equal(assets.filter((asset) => asset.pose === 'point').every((asset) => asset.mirrorable === false), true);
  assert.equal(assets.filter((asset) => asset.pose === 'fist').every((asset) => asset.mirrorable === true), true);
});

test('every drawing has its own id, across poses, views and sides', () => {
  const ids = HAND_SIDES.flatMap((side) => handSpriteAssets(side, { poses: GENERATED_SPRITE_POSES }).map((asset) => asset.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(handSpriteElementId('left', 'relaxed', 'front'), 'handLeftDraw-relaxed-front');
  assert.equal(handSpriteElementId('right', 'wave', 'profile'), 'handRightDraw-open-sideRight');
});

test('a set is markup with one drawing showing and the rest transparent', () => {
  const markup = handSpriteSetMarkup('left', { at, scale: SPRITE_SCALE, showing: 'front' });
  const groups = markup.match(/<g id="handLeftDraw-[^"]+"/g) || [];
  assert.equal(groups.length, 5);
  assert.equal((markup.match(/opacity="0"/g) || []).length, 4);
  assert.ok(markup.includes('<g id="handLeftDraw-relaxed-front" data-name="Relaxed · Front">'));
  assert.equal(handSpriteSetMarkup('left', { poses: ['rubbish'] }), '');
});

test('a drawing on its own is a file with the shared box and the pivot on it', () => {
  const file = handSpriteDocument('left', 'relaxed', 'front');
  assert.ok(file.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(file.includes(`viewBox="${SPRITE_VIEW_BOX_ATTRIBUTE}"`));
  assert.ok(file.includes(`data-hand-pivot="${SPRITE_PIVOT.join(' ')}"`));
  assert.equal(handSpritePath('defaultCartoon', 'left', 'relaxed', 'front'), 'defaultCartoon/left/relaxed/front.svg');
});

test('a manifest is a hand set: everything it lists resolves to itself', () => {
  const manifest = handSpriteManifest({ poses: GENERATED_SPRITE_POSES });
  const library = createHandAssetLibrary(manifest.assets, manifest);
  assert.equal(library.size, GENERATED_SPRITE_POSES.length * HAND_SPRITE_VIEWS.length * 2);
  assert.deepEqual(library.pivot, [...SPRITE_PIVOT]);
  assert.equal(library.viewBox, SPRITE_VIEW_BOX_ATTRIBUTE);
  for (const side of HAND_SIDES) {
    for (const pose of GENERATED_SPRITE_POSES) {
      for (const view of HAND_SPRITE_VIEWS) {
        const found = resolveHandAsset(library, { side, pose, view });
        assert.equal(found.exact, true, `${side}/${pose}/${view} → ${found.fallback}`);
        assert.equal(found.asset.src, handSpritePath('defaultCartoon', side, pose, view));
      }
    }
  }
});

test('a starter manifest still answers for every pose, through the ladder', () => {
  const library = createHandAssetLibrary(handSpriteManifest({}).assets, handSpriteManifest({}));
  for (const pose of GENERATED_SPRITE_POSES) {
    for (const view of HAND_SPRITE_VIEWS) {
      const found = resolveHandAsset(library, { side: 'left', pose, view });
      assert.equal(found.missing, false, `${pose}/${view}`);
      assert.equal(found.asset.pose, 'relaxed');
    }
  }
});

test('the markup of a drawing names its parts and paints them in the table\'s order', () => {
  const markup = handSpriteMarkup('left', 'relaxed', 'threeQuarterLeft', { at, scale: SPRITE_SCALE });
  const parts = [...markup.matchAll(/id="handLeftDraw-relaxed-threeQuarterLeft(\w+)"/g)].map((match) => match[1].toLowerCase());
  assert.deepEqual(parts, ['thumb', 'palm', 'ring', 'middle', 'index', 'cuff']);
  assert.ok(markup.includes('stroke-linejoin="round"'));
});
