import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACEMENT_FRACTION, imageNodeId, imageNodeMarkup, placeImageInArtboard } from '../assets/asset-placement.js';

const board = { x: 0, y: 0, width: 240, height: 240 };

test('a picture lands in the middle, at a size its author can see all of',()=>{
  // 144 is 60% of 240: a picture arriving edge to edge cannot be seen in
  // relation to anything, and the first thing anyone does is shrink it.
  assert.deepEqual(placeImageInArtboard({ width: 1024, height: 1024 }, board),{ x: 48, y: 48, width: 144, height: 144 });
  assert.deepEqual(placeImageInArtboard({ width: 288, height: 144 }, board),{ x: 48, y: 84, width: 144, height: 72 });
  assert.equal(PLACEMENT_FRACTION,0.6);
});

test('a small picture arrives at its own size, never blown up to fill the frame',()=>{
  // Enlarging is an author's detail thrown away.
  assert.deepEqual(placeImageInArtboard({ width: 48, height: 32 }, board),{ x: 96, y: 104, width: 48, height: 32 });
  assert.deepEqual(placeImageInArtboard({ width: 3, height: 7 }, board),{ x: 118.5, y: 116.5, width: 3, height: 7 });
});

test('an artboard that is not square, or not at the origin, still centres it',()=>{
  // 120 is the room on a 400x200 board, and 100 is already inside it, so the
  // picture keeps its size and only the centring changes.
  assert.deepEqual(placeImageInArtboard({ width: 100, height: 100 }, { x: 0, y: 0, width: 400, height: 200 }),{ x: 150, y: 50, width: 100, height: 100 });
  assert.deepEqual(placeImageInArtboard({ width: 400, height: 400 }, { x: 0, y: 0, width: 400, height: 200 }),{ x: 140, y: 40, width: 120, height: 120 });
  assert.deepEqual(placeImageInArtboard({ width: 40, height: 40 }, { x: -50, y: 20, width: 100, height: 100 }),{ x: -20, y: 50, width: 40, height: 40 });
  // A nonsense artboard falls back to the one this editor draws in.
  assert.deepEqual(placeImageInArtboard({ width: 48, height: 48 }, null),placeImageInArtboard({ width: 48, height: 48 }, board));
  assert.equal(placeImageInArtboard({ width: 0, height: 0 }, board),null);
});

test('a picture is called what its author called the file',()=>{
  // They read this in the layer list and in the rig, and `image-3` tells them
  // nothing about which picture it is.
  assert.equal(imageNodeId('Head Front.webp'),'head-front');
  assert.equal(imageNodeId('eye_L.png'),'eye-l');
  assert.equal(imageNodeId(''),'picture');
  // An id has to start with a letter to be a usable selector.
  assert.equal(imageNodeId('2024-mouth.png'),'picture-2024-mouth');
  // And it has to be free.
  const taken = new Set(['head', 'head-2']);
  assert.equal(imageNodeId('head.webp', taken),'head-3');
});

test('the node points at the asset and never at the bytes',()=>{
  const markup = imageNodeMarkup({ id: 'head', assetId: '7f3c9a1b2c3d4e5f', box: { x: 48, y: 48, width: 144, height: 144 } });
  assert.match(markup,/href="asset:7f3c9a1b2c3d4e5f"/);
  assert.doesNotMatch(markup,/data:|blob:/);
  assert.match(markup,/preserveAspectRatio="xMidYMid meet"/,'a box that does not match the picture letterboxes rather than distorts');
  // An id is escaped where it lands in an attribute.
  assert.match(imageNodeMarkup({ id: 'a"b&c', assetId: 'aabbccdd', box: { x: 0, y: 0, width: 1, height: 1 } }),/id="a&quot;b&amp;c"/);
});

test('a base takes most of the frame, and brings a pivot with it',async()=>{
  const { BASE_PLACEMENT_FRACTION, placeBaseInArtboard } = await import('../assets/asset-placement.js');
  // It *is* the frame: everything else is placed on top of it, and a base
  // arriving at six tenths would be resized before anything else happened.
  assert.equal(BASE_PLACEMENT_FRACTION,0.9);
  assert.deepEqual(placeBaseInArtboard({ width: 1024, height: 1024 }, board),
    { x: 12, y: 12, width: 216, height: 216, pivot: { x: 120, y: 120 } });
  // Not the whole artboard: a mascot touching every edge has nowhere to lean.
  assert.ok(placeBaseInArtboard({ width: 1024, height: 1024 }, board).width < board.width);
  // The pivot is the picture's own centre, which is where a head turns from
  // far more often than the origin it would otherwise get.
  const off = placeBaseInArtboard({ width: 200, height: 100 }, { x: 40, y: 0, width: 240, height: 240 });
  assert.deepEqual(off.pivot,{ x: off.x + off.width / 2, y: off.y + off.height / 2 });
  assert.equal(placeBaseInArtboard({ width: 0, height: 0 }, board),null);
});
