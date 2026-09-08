import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_HAND_LIBRARY, createHandAssetCache, createHandAssetLibrary, handAssetCandidates, handAssetWarning,
  handAssetsToPreload, normalizeHandAsset, resolveHandAsset
} from '../../../runtime/hand-assets.js';

/**
 * One place decides what a hand is showing (docs/HANDS_2D.md, PHASES 6-9).
 * A set may be shipped incomplete; the ladder is what keeps that from
 * mattering, so every rung of it is pinned here.
 */
const asset = (pose, view, over = {}) => ({ pose, view, element: `${pose}-${view}`, ...over });
const full = () => createHandAssetLibrary(
  ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight'].map((view) => asset('relaxed', view)),
  { pivot: [100, 100] }
);

test('a library indexes what it was given and reports what it draws', () => {
  const library = full();
  assert.equal(library.size, 5);
  assert.deepEqual(library.poses(), ['relaxed']);
  assert.deepEqual(library.views('relaxed'), ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight']);
  assert.equal(library.at('left', 'relaxed', 'front', 'palm').element, 'relaxed-front');
});

test('a drawing inherits the set\'s pivot and default scale, and may override them', () => {
  const library = createHandAssetLibrary([asset('relaxed', 'front'), asset('open', 'front', { pivot: [0, 0], defaultScale: 2 })], { pivot: [100, 125], defaultScale: 1 });
  assert.deepEqual(library.at(null, 'relaxed', 'front', 'palm').pivot, [100, 125]);
  assert.deepEqual(library.at(null, 'open', 'front', 'palm').pivot, [0, 0]);
  assert.equal(library.at(null, 'open', 'front', 'palm').defaultScale, 2);
});

test('a drawing carries the preferred rotation of its view unless it says otherwise', () => {
  assert.deepEqual(normalizeHandAsset({ pose: 'relaxed', view: 'front' }).preferredRotation, [-180, 180]);
  assert.deepEqual(normalizeHandAsset({ pose: 'relaxed', view: 'sideLeft' }).preferredRotation, [-70, 70]);
  assert.deepEqual(normalizeHandAsset({ view: 'sideLeft', preferredRotation: [-20, 20] }).preferredRotation, [-20, 20]);
});

test('an exact drawing is used as it is', () => {
  const found = resolveHandAsset(full(), { side: 'left', pose: 'relaxed', view: 'threeQuarterRight' });
  assert.equal(found.asset.element, 'relaxed-threeQuarterRight');
  assert.equal(found.fallback, 'exact');
  assert.equal(found.exact, true);
  assert.equal(found.flipX, false);
  assert.equal(found.missing, false);
});

test('a missing view is taken from its mirror, flipped, when the pose allows it', () => {
  const library = createHandAssetLibrary([asset('relaxed', 'front'), asset('relaxed', 'threeQuarterLeft')]);
  const found = resolveHandAsset(library, { side: 'left', pose: 'relaxed', view: 'threeQuarterRight' });
  assert.equal(found.asset.element, 'relaxed-threeQuarterLeft');
  assert.equal(found.fallback, 'mirror');
  assert.equal(found.flipX, true);
});

test('an asymmetric pose is never mirrored: it falls back to the front instead', () => {
  const library = createHandAssetLibrary([asset('point', 'front'), asset('point', 'threeQuarterLeft')]);
  const found = resolveHandAsset(library, { side: 'left', pose: 'point', view: 'threeQuarterRight' });
  assert.equal(found.asset.element, 'point-front');
  assert.equal(found.fallback, 'view');
  assert.equal(found.flipX, false);
});

test('a drawing may refuse to be flipped even where its pose allows it', () => {
  const library = createHandAssetLibrary([asset('relaxed', 'front'), asset('relaxed', 'threeQuarterLeft', { mirrorable: false })]);
  const found = resolveHandAsset(library, { side: 'left', pose: 'relaxed', view: 'threeQuarterRight' });
  assert.equal(found.asset.element, 'relaxed-front');
  assert.equal(found.flipX, false);
});

test('a hand drawn for one side serves the other by flipping the mirrored view', () => {
  const library = createHandAssetLibrary([
    asset('relaxed', 'threeQuarterLeft', { side: 'left' }),
    asset('relaxed', 'front', { side: 'left' })
  ]);
  const found = resolveHandAsset(library, { side: 'right', pose: 'relaxed', view: 'threeQuarterRight' });
  assert.equal(found.asset.element, 'relaxed-threeQuarterLeft');
  assert.equal(found.flipX, true);
  // ...and the right hand's own front view is the left one's, flipped.
  assert.equal(resolveHandAsset(library, { side: 'right', pose: 'relaxed', view: 'front' }).asset.element, 'relaxed-front');
});

test('the face falls back to the other one rather than to another view', () => {
  const library = createHandAssetLibrary([asset('relaxed', 'threeQuarterRight', { face: 'palm' }), asset('relaxed', 'front', { face: 'back' })]);
  const found = resolveHandAsset(library, { side: 'left', pose: 'relaxed', view: 'threeQuarterRight', face: 'back' });
  assert.equal(found.asset.element, 'relaxed-threeQuarterRight');
  assert.equal(found.face, 'palm');
  assert.equal(found.fallback, 'face');
});

test('a partial pose falls back to its own front before it falls back to another pose', () => {
  const library = createHandAssetLibrary([...['front', 'threeQuarterLeft'].map((view) => asset('relaxed', view)), asset('point', 'front')]);
  const found = resolveHandAsset(library, { side: 'left', pose: 'point', view: 'sideRight' });
  assert.equal(found.asset.element, 'point-front');
  assert.equal(found.pose, 'point');
  assert.equal(found.fallback, 'view');
});

test('a pose with no drawing at all falls back to relaxed', () => {
  const found = resolveHandAsset(full(), { side: 'left', pose: 'fist', view: 'front' });
  assert.equal(found.asset.element, 'relaxed-front');
  assert.equal(found.pose, 'relaxed');
  assert.equal(found.fallback, 'pose');
});

test('a pose drawn only in three quarter serves a side from the nearest view, not the front', () => {
  const library = createHandAssetLibrary([asset('relaxed', 'front'), asset('fist', 'threeQuarterRight')]);
  const found = resolveHandAsset(library, { side: 'left', pose: 'fist', view: 'sideRight' });
  assert.equal(found.asset.element, 'fist-threeQuarterRight');
  assert.equal(found.fallback, 'nearest');
});

test('an empty set resolves to nothing and never throws', () => {
  const found = resolveHandAsset(EMPTY_HAND_LIBRARY, { side: 'left', pose: 'fist', view: 'sideRight' });
  assert.equal(found.asset, null);
  assert.equal(found.missing, true);
  assert.equal(found.fallback, 'missing');
  assert.doesNotThrow(() => resolveHandAsset(null, {}));
  assert.doesNotThrow(() => resolveHandAsset(undefined, undefined));
});

test('an unknown pose or view resolves rather than failing', () => {
  const found = resolveHandAsset(full(), { side: 'nonsense', pose: 'wiggle', view: 'sideways' });
  assert.equal(found.asset.element, 'relaxed-front');
  assert.equal(found.wanted.pose, 'relaxed');
  assert.equal(found.wanted.view, 'front');
  assert.equal(found.wanted.side, 'left');
});

test('the candidate ladder is ordered, deduplicated and exhaustive', () => {
  const candidates = handAssetCandidates({ side: 'left', pose: 'fist', view: 'sideRight' });
  assert.equal(candidates[0].fallback, 'exact');
  assert.deepEqual([candidates[0].view, candidates[0].flipX], ['sideRight', false]);
  const keys = candidates.map((item) => `${item.side}/${item.pose}/${item.view}/${item.face}/${item.flipX}`);
  assert.equal(new Set(keys).size, keys.length);
  // Every view of the asked-for pose is reached before the fallback pose is.
  const firstDefaultPose = candidates.findIndex((item) => item.fallback === 'pose');
  assert.ok(firstDefaultPose > 0);
  for (const view of ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight']) {
    assert.ok(candidates.findIndex((item) => item.pose === 'fist' && item.view === view) < firstDefaultPose, view);
  }
  // ...and the fallback pose is walked the same way round.
  assert.ok(candidates.slice(firstDefaultPose).every((item) => item.pose === 'relaxed' && item.fallback === 'pose'));
});

test('the ladder of a pose that is already the fallback does not walk it twice', () => {
  const candidates = handAssetCandidates({ side: 'left', pose: 'relaxed', view: 'front' });
  assert.equal(candidates.some((item) => item.fallback === 'pose'), false);
});

test('an inexact resolution is reported once per distinct request, with a readable line', () => {
  const seen = [];
  const cache = createHandAssetCache(createHandAssetLibrary([asset('relaxed', 'front')]), { warn: (report) => seen.push(report) });
  for (let i = 0; i < 5; i += 1) cache.resolve({ side: 'left', pose: 'point', view: 'sideRight' });
  assert.equal(seen.length, 1);
  assert.match(handAssetWarning(seen[0]), /Missing hand asset: pose=point view=sideRight side=left/);
  assert.match(handAssetWarning({ missing: true, wanted: { pose: 'point', view: 'sideRight', side: 'left', face: 'palm' } }), /pose=point\nview=sideRight\nside=left/);
});

test('an exact resolution is not a warning', () => {
  const seen = [];
  createHandAssetCache(full(), { warn: (report) => seen.push(report) }).resolve({ side: 'left', pose: 'relaxed', view: 'front' });
  assert.equal(seen.length, 0);
});

test('the cache answers the same question once, and can be cleared', () => {
  const cache = createHandAssetCache(full());
  const first = cache.resolve({ side: 'left', pose: 'relaxed', view: 'front' });
  assert.equal(cache.resolve({ side: 'left', pose: 'relaxed', view: 'front' }), first);
  assert.equal(cache.size, 1);
  cache.resolve({ side: 'left', pose: 'relaxed', view: 'sideLeft' });
  assert.equal(cache.size, 2);
  cache.clear();
  assert.equal(cache.size, 0);
});

test('preloading takes the drawing shown and the views either side of it', () => {
  const ready = handAssetsToPreload(full(), [{ side: 'left', pose: 'relaxed', view: 'front', face: 'palm' }]);
  assert.deepEqual(ready.map((item) => item.view).sort(), ['front', 'threeQuarterLeft', 'threeQuarterRight']);
  assert.equal(handAssetsToPreload(EMPTY_HAND_LIBRARY, [{ side: 'left' }]).length, 0);
});
