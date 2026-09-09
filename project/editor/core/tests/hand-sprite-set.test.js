import test from 'node:test';
import assert from 'node:assert/strict';
import { HAND_DRAWINGS, HAND_SIDES } from '../../../runtime/hand-vocabulary.js';
import {
  GENERATED_HAND_DRAWINGS, SPRITE_PIVOT, SPRITE_SCALE, SPRITE_VIEW_BOX, SPRITE_VIEW_BOX_ATTRIBUTE,
  handDrawingRecipe, handSpriteAnimKeys, handSpriteAssets, handSpriteDocument, handSpriteElementId,
  handSpriteManifest, handSpriteMarkup, handSpriteParts, handSpritePartId, handSpritePath,
  handSpriteSetMarkup, handSpriteThumbnail
} from '../hands/hand-sprite-set.js';
import { HAND_PART_IDS } from '../sample/hand-artwork.js';
import { parsePath } from '../../../runtime/path-vector.js';

/**
 * The drawings a 2D hand swaps between (docs/HANDS_2D.md).
 *
 * What is pinned here is what makes a swap invisible: one box, one pivot, one
 * size, and drawings that are actually different drawings — plus the little
 * rig each of them carries of its own.
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
const drawn = (side, drawing, posed = false) => handSpriteParts(side, drawing, { at, scale: SPRITE_SCALE, posed });

test('the generator draws every picture the catalogue names', () => {
  assert.deepEqual([...GENERATED_HAND_DRAWINGS], HAND_DRAWINGS.map((drawing) => drawing.id));
  for (const id of GENERATED_HAND_DRAWINGS) {
    const recipe = handDrawingRecipe(id);
    assert.ok(recipe?.view, `${id} names a drawing to draw from`);
    assert.ok(recipe.animTable, `${id} names what it animates to`);
    assert.ok(recipe.anim, `${id} says what that animation is called`);
  }
});

test('every picture is its own drawing, not a copy of another', () => {
  const seen = new Map();
  for (const id of GENERATED_HAND_DRAWINGS) {
    const key = JSON.stringify(drawn('left', id).paths);
    assert.equal(seen.has(key), false, `${id} draws the same as ${seen.get(key)}`);
    seen.set(key, id);
  }
});

test('every picture fits the shared box, clear of its own line', () => {
  for (const side of HAND_SIDES) {
    for (const id of GENERATED_HAND_DRAWINGS) {
      for (const posed of [false, true]) {
        const box = bounds(drawn(side, id, posed));
        const where = `${side}/${id}${posed ? ' (animated)' : ''}`;
        assert.ok(box.x0 > 6 && box.y0 > 6, `${where} runs off the top or left: ${box.x0},${box.y0}`);
        assert.ok(box.x1 < SPRITE_VIEW_BOX.width - 6 && box.y1 < SPRITE_VIEW_BOX.height - 6, `${where} runs off the bottom or right: ${box.x1},${box.y1}`);
      }
    }
  }
});

test('the pictures hang from one wrist: a swap never moves the hand', () => {
  // A fist is genuinely shorter than an open hand -- that is the point of
  // having both. What must not move is where the hand *attaches*: the cuff
  // sits in the same place in every picture, and in its animation, so the
  // swap is a change of hand and never a jump.
  const cuff = (id, posed) => {
    const parts = drawn('left', id, posed);
    return bounds({ paths: { cuff: parts.paths.cuff } });
  };
  const first = cuff(GENERATED_HAND_DRAWINGS[0], false);
  for (const id of GENERATED_HAND_DRAWINGS) {
    for (const posed of [false, true]) {
      const box = cuff(id, posed);
      const where = `${id}${posed ? ' (animated)' : ''}`;
      assert.ok(Math.abs((box.x0 + box.x1) / 2 - (first.x0 + first.x1) / 2) <= 2, `${where} moves the wrist sideways`);
      assert.ok(Math.abs(box.y1 - first.y1) < 2, `${where} moves the wrist up or down`);
    }
  }
});

test('the right hand is the left one mirrored, around the shared pivot', () => {
  for (const id of GENERATED_HAND_DRAWINGS) {
    const left = bounds(drawn('left', id)), right = bounds(drawn('right', id));
    assert.ok(Math.abs(left.width - right.width) < 1, `${id} keeps its width`);
    assert.ok(Math.abs((SPRITE_PIVOT[0] - left.x0) - (right.x1 - SPRITE_PIVOT[0])) < 1, `${id} mirrors about the pivot`);
  }
});

test('a set is groups of six parts, one of them showing', () => {
  const markup = handSpriteSetMarkup('left', { at, scale: SPRITE_SCALE });
  const groups = markup.match(/<g id="handLeftDraw-[^"]+"/g) || [];
  assert.equal(groups.length, GENERATED_HAND_DRAWINGS.length);
  // Everything but the one it rests on ships transparent, so a page does not
  // flash the whole set before the first frame.
  assert.equal((markup.match(/opacity="0"/g) || []).length, GENERATED_HAND_DRAWINGS.length - 1);
  const showing = handSpriteSetMarkup('left', { at, scale: SPRITE_SCALE, showing: 'frontFist' });
  assert.match(showing, /<g id="handLeftDraw-frontFist" data-name="Front fist">/);
  assert.match(showing, /<g id="handLeftDraw-palmOpen"[^>]*opacity="0"/);
  const one = handSpriteMarkup('left', 'palmOpen', { at, scale: SPRITE_SCALE });
  for (const part of HAND_PART_IDS) assert.match(one, new RegExp(`id="${handSpritePartId('left', 'palmOpen', part)}"`));
});

test("a picture's animation is shape keys over its own parts, and nobody else's", () => {
  for (const side of HAND_SIDES) {
    for (const id of GENERATED_HAND_DRAWINGS) {
      const parameter = `hand${side === 'right' ? 'R' : 'L'}Anim`;
      const made = handSpriteAnimKeys(side, id, { at, scale: SPRITE_SCALE, parameter });
      assert.equal(made.ok, true, made.message);
      assert.ok(made.keys.length > 0, `${side}/${id} animates something`);
      const own = new Set(HAND_PART_IDS.map((part) => handSpritePartId(side, id, part)));
      for (const key of made.keys) {
        assert.ok(own.has(key.target), `${key.id} deforms a part of its own picture`);
        assert.equal(key.driver.parameter, parameter, `${key.id} is played by the hand's one animation parameter`);
        assert.ok(key.delta, `${key.id} measured a difference`);
      }
    }
  }
});

test('a picture with no animation of its own asks for no keys', () => {
  assert.deepEqual(handSpriteAnimKeys('left', 'palmOpen', { at, parameter: null }), { ok: true, keys: [] });
  assert.deepEqual(handSpriteAnimKeys('left', 'nonsense', { at, parameter: 'handLAnim' }), { ok: true, keys: [] });
});

test('a thumbnail is the same picture with no ids on it', () => {
  const thumb = handSpriteThumbnail('left', 'frontFist', { at, size: 40 });
  assert.doesNotMatch(thumb, /\bid=/, 'two nodes with one id is one node');
  assert.match(thumb, /<path d="/);
  const posed = handSpriteThumbnail('left', 'frontFist', { at, size: 40, posed: true });
  assert.notEqual(posed, thumb, 'and it can show what the picture does');
});

test('a descriptor says what the rig needs and nothing about angles', () => {
  const assets = handSpriteAssets('left', { pivot: [...SPRITE_PIVOT] });
  assert.deepEqual(assets.map((asset) => asset.id), [...GENERATED_HAND_DRAWINGS]);
  for (const asset of assets) {
    assert.equal(asset.element, handSpriteElementId('left', asset.id));
    assert.deepEqual(asset.pivot, [...SPRITE_PIVOT], 'one pivot for the set');
    assert.equal(asset.defaultScale, 1);
    assert.equal(typeof asset.anim, 'string');
    for (const gone of ['view', 'face', 'mirrorable', 'pose']) assert.equal(gone in asset, false, `${gone} is gone`);
  }
});

test('a set on disk is one file per picture, plus one per animation', () => {
  const file = handSpriteDocument('left', 'palmOpen');
  assert.match(file, new RegExp(`viewBox="${SPRITE_VIEW_BOX_ATTRIBUTE}"`));
  assert.match(file, new RegExp(`data-hand-pivot="${SPRITE_PIVOT[0]} ${SPRITE_PIVOT[1]}"`));
  assert.notEqual(handSpriteDocument('left', 'palmOpen', { posed: true }), file);
  assert.equal(handSpritePath('defaultCartoon', 'left', 'palmOpen'), 'defaultCartoon/left/palmOpen.svg');
  assert.equal(handSpritePath('defaultCartoon', 'right', 'frontFist', { posed: true }), 'defaultCartoon/right/frontFist-anim.svg');

  const manifest = handSpriteManifest();
  assert.equal(manifest.assets.length, 2 * GENERATED_HAND_DRAWINGS.length);
  assert.deepEqual(manifest.pivot, [...SPRITE_PIVOT]);
  for (const asset of manifest.assets) {
    assert.match(asset.src, /^defaultCartoon\/(left|right)\/[A-Za-z]+\.svg$/);
    assert.match(asset.animSrc, /-anim\.svg$/);
  }
});
