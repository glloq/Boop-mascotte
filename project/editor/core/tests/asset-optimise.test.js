import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_MAX_DIMENSION } from '../assets/asset-model.js';
import { THUMBNAIL_MAX_DIMENSION, createAssetOptimiser, createBrowserCodec, fitWithin, planAssetOptimisation, planThumbnail } from '../assets/asset-optimise.js';
import { readImageHeader } from '../assets/asset-validate.js';

const file = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url)));

test('fitting keeps the shape, never invents size, and never rounds to nothing',()=>{
  assert.deepEqual(fitWithin({ width: 1024, height: 768 }, 512),{ width: 512, height: 384, scale: 0.5 });
  assert.deepEqual(fitWithin({ width: 768, height: 1024 }, 512),{ width: 384, height: 512, scale: 0.5 });
  // Already inside the budget: untouched, and not scaled up to fill it.
  assert.deepEqual(fitWithin({ width: 40, height: 30 }, 512),{ width: 40, height: 30, scale: 1 });
  assert.deepEqual(fitWithin({ width: 512, height: 512 }, 512),{ width: 512, height: 512, scale: 1 });
  // A shape extreme enough that the short side rounds away is still
  // two-dimensional afterwards.
  assert.deepEqual(fitWithin({ width: 4000, height: 3 }, 512).height,1);
  assert.deepEqual(fitWithin({ width: 0, height: 100 }, 512),{ width: 0, height: 0, scale: 1 });
});

test('vector artwork is never resized, and a format is never swapped underneath its author',()=>{
  // An SVG has no pixels to lose, and a viewBox is a coordinate system rather
  // than a size.
  assert.deepEqual(planAssetOptimisation({ format: 'image/svg+xml', width: 4000, height: 4000 }),
    { action: 'keep', format: 'image/svg+xml', width: 4000, height: 4000, scale: 1 });
  // PNG stays PNG even though WebP would be smaller: that choice is the
  // author's, not ours.
  assert.equal(planAssetOptimisation({ format: 'image/png', width: 2000, height: 1000 }).format,'image/png');
  assert.equal(planAssetOptimisation({ format: 'image/png', width: 2000, height: 1000 }).action,'resize');
  assert.equal(planAssetOptimisation({ format: 'image/webp', width: 300, height: 200 }).action,'keep');
  assert.equal(ASSET_MAX_DIMENSION,512);
});

test('a real import is measured and planned from its own header',()=>{
  const header = readImageHeader(file('opaque-48x32.webp'));
  assert.deepEqual(planAssetOptimisation(header),{ action: 'keep', format: 'image/webp', width: 48, height: 32, scale: 1 });
  assert.deepEqual(planThumbnail(header),{ width: 48, height: 32, scale: 1 });
  assert.deepEqual(planThumbnail({ width: 1024, height: 512 }),{ width: THUMBNAIL_MAX_DIMENSION, height: 48, scale: 0.09375 });
});

test('with no codec, a picture goes through unchanged rather than failing',async()=>{
  // An import bigger than we would like is still an import that works.
  const optimiser = createAssetOptimiser();
  const bytes = file('alpha-16x16.png');
  const kept = await optimiser.optimise(bytes, { format: 'image/png', width: 2000, height: 2000 });
  assert.equal(kept.bytes,bytes);
  assert.equal(kept.resized,false);
  assert.equal(kept.reason,'no-codec');
  assert.equal(await optimiser.thumbnail(bytes, readImageHeader(bytes)),null);
  assert.equal(createBrowserCodec({ createImageBitmap: null, OffscreenCanvas: null }),null);
});

test('a re-encode that came out bigger is thrown away',async()=>{
  // The point of resizing was to cost less; a smaller picture in more bytes
  // is a worse picture.
  const bytes = file('alpha-16x16.png');
  const bigger = createAssetOptimiser({ codec: { draw: async () => new Uint8Array(bytes.length + 10) } });
  const kept = await bigger.optimise(bytes, { format: 'image/png', width: 2000, height: 2000 });
  assert.equal(kept.resized,false);
  assert.equal(kept.reason,'no-smaller');
  assert.equal(kept.width,2000,'and it still reports the size it actually is');
});

test('a codec that works resizes, and one that throws is survived',async()=>{
  const bytes = file('alpha-16x16.png');
  const asked = [];
  const working = createAssetOptimiser({ codec: { draw: async (source, format, width, height) => { asked.push({ format, width, height }); return new Uint8Array(4); } } });
  const resized = await working.optimise(bytes, { format: 'image/webp', width: 1024, height: 768 });
  assert.deepEqual(asked[0],{ format: 'image/webp', width: 512, height: 384 });
  assert.deepEqual({ width: resized.width, height: resized.height, resized: resized.resized },{ width: 512, height: 384, resized: true });

  const thumb = await working.thumbnail(bytes, { format: 'image/webp', width: 1024, height: 768 });
  assert.equal(thumb.length,4);
  assert.deepEqual(asked[1],{ format: 'image/png', width: 96, height: 72 },'a thumbnail is a PNG whatever the asset is');

  const broken = createAssetOptimiser({ codec: { draw: async () => { throw new Error('decode failed'); } } });
  const survived = await broken.optimise(bytes, { format: 'image/png', width: 1024, height: 768 });
  assert.equal(survived.reason,'codec-failed');
  assert.equal(survived.bytes,bytes);
  assert.equal(await broken.thumbnail(bytes, { format: 'image/png', width: 1024, height: 768 }),null);
});
