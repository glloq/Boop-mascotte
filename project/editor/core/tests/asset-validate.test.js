import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSET_IMPORT_MAX_BYTES, ASSET_IMPORT_MAX_DIMENSION, ASSET_IMPORT_MAX_PIXELS, readImageHeader, readSvgSize, sniffFormat, validateAssetBytes } from '../assets/asset-validate.js';

/**
 * The picture fixtures are Chromium's own output, not bytes assembled from a
 * reading of the specification: `simple-lossless` and `simple-lossy` are the
 * real encoder's chunks re-framed as simple WebP, so all three WebP framings
 * are exercised by something an encoder actually produced.
 */
const file = (name) => readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url));
const svg = (body) => new TextEncoder().encode(body);

test('a file is what its bytes say, in every framing a real encoder writes',()=>{
  assert.deepEqual(readImageHeader(file('alpha-16x16.png')),{ format:'image/png', width:16, height:16, alpha:true });
  assert.deepEqual(readImageHeader(file('tiny-3x7.png')),{ format:'image/png', width:3, height:7, alpha:true });
  // VP8X, the extended framing a browser writes: size on the canvas header.
  assert.deepEqual(readImageHeader(file('alpha-24x17.webp')),{ format:'image/webp', width:24, height:17, alpha:true });
  assert.deepEqual(readImageHeader(file('opaque-48x32.webp')),{ format:'image/webp', width:48, height:32, alpha:false });
  // The two simple framings, whose sizes live somewhere else entirely.
  assert.deepEqual(readImageHeader(file('simple-lossless-9x5.webp')),{ format:'image/webp', width:9, height:5, alpha:true });
  assert.deepEqual(readImageHeader(file('simple-lossy-48x32.webp')),{ format:'image/webp', width:48, height:32, alpha:false });
});

test('an SVG is measured by what it is drawn in, not by how big someone wanted it',()=>{
  assert.deepEqual(readSvgSize('<svg viewBox="0 0 240 240" width="100%" height="100%"></svg>'),{ width:240, height:240, alpha:true });
  assert.deepEqual(readSvgSize('<svg width="48px" height="32"></svg>'),{ width:48, height:32, alpha:true });
  // A percentage is not a size, and neither is nothing.
  assert.equal(readSvgSize('<svg width="100%" height="100%"></svg>'),null);
  assert.equal(readSvgSize('<svg></svg>'),null);
});

test('the extension is never trusted, and neither is the declared type',()=>{
  // A WebP called `.png`, declared `image/png`: imported as what it is, and
  // both lies reported rather than silently accepted or silently refused.
  const result = validateAssetBytes(file('opaque-48x32.webp'), { name: 'head.png', declaredType: 'image/png' });
  assert.equal(result.ok,true);
  assert.equal(result.format,'image/webp');
  assert.deepEqual(result.issues.map((i) => i.code).sort(),['declared-type-mismatch','extension-mismatch']);
  // Told the truth: nothing to report.
  assert.deepEqual(validateAssetBytes(file('opaque-48x32.webp'), { name: 'head.webp', declaredType: 'image/webp' }).issues,[]);
});

test('what may not become an asset',()=>{
  const refused = (bytes, options = {}) => validateAssetBytes(bytes, options).issues[0]?.code;
  assert.equal(refused(new Uint8Array()),'empty');
  assert.equal(refused(svg('not a picture at all')),'unknown-format');
  assert.equal(refused(new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0,0])),'convert-first','JPEG is a conversion, not an import');
  assert.equal(refused(new Uint8Array([0x47,0x49,0x46,0x38,0x39,0x61,0,0])),'convert-first');
  // Truncated: still recognised as a PNG, and its header unreadable. A
  // damaged file is reported as damaged, not as "not an image" -- that would
  // send its author looking for the wrong problem.
  assert.equal(refused(file('alpha-16x16.png').subarray(0, 14)),'no-dimensions');
  assert.equal(readImageHeader(file('alpha-16x16.png').subarray(0, 14)).format,'image/png');
  assert.equal(refused(new Uint8Array([0x52,0x49,0x46,0x46,1,2,3,4,0x57,0x45,0x42,0x50,0x58,0x58,0x58,0x58,0,0,0,0])),'no-dimensions');
  // An SVG that carries anything executable is refused, not quietly stripped:
  // nobody should wonder later where half their file went.
  assert.equal(refused(svg('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>')),'unsafe-svg');
  assert.equal(refused(svg('<svg viewBox="0 0 10 10"><image href="http://evil.example/a.png"/></svg>')),'unsafe-svg');
  assert.deepEqual(validateAssetBytes(svg('<svg viewBox="0 0 10 10"><circle r="4"/></svg>')).issues,[]);
});

test('an absurd image is declined while it is still a header',()=>{
  // The whole reason sizes are read rather than decoded: nothing should
  // allocate three billion pixels to discover it did not want them.
  const png = Buffer.from(file('alpha-16x16.png'));
  const huge = Buffer.from(png); huge.writeUInt32BE(60000, 16); huge.writeUInt32BE(60000, 20);
  assert.equal(validateAssetBytes(huge).issues[0].code,'too-large');

  // Inside the per-side limit and still far too many pixels together.
  const wide = Buffer.from(png); wide.writeUInt32BE(ASSET_IMPORT_MAX_DIMENSION, 16); wide.writeUInt32BE(ASSET_IMPORT_MAX_DIMENSION, 20);
  assert.ok(ASSET_IMPORT_MAX_DIMENSION ** 2 > ASSET_IMPORT_MAX_PIXELS, 'the square of the side limit is over the pixel limit, which is what makes this case reachable');
  assert.equal(validateAssetBytes(wide).issues[0].code,'too-many-pixels');

  // And a file too big to be one at all is refused before its header is read:
  // this is the first check in the function, so nothing parses 33 MB of
  // whatever it turns out to be.
  const enormous = new Uint8Array(ASSET_IMPORT_MAX_BYTES + 1);
  enormous.set(png.subarray(0, 32));
  assert.equal(validateAssetBytes(enormous, { name: 'enormous.png' }).issues[0].code,'too-many-bytes');
});

test('over the budget is something to say, not something to refuse',()=>{
  const png = Buffer.from(file('alpha-16x16.png'));
  png.writeUInt32BE(1024, 16); png.writeUInt32BE(768, 20);
  const result = validateAssetBytes(png, { name: 'big.png' });
  assert.equal(result.ok,true,'a big import is resized, not rejected');
  assert.deepEqual(result.issues.map((i) => i.code),['over-budget']);
  assert.match(result.issues[0].detail,/1024x768 will be resized to fit 512/);
});

test('sniffing answers for text as well as for binary',()=>{
  assert.equal(sniffFormat(svg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')),'image/svg+xml');
  assert.equal(sniffFormat(svg('<!-- a comment -->\n<svg></svg>')),'image/svg+xml');
  assert.equal(sniffFormat(svg('<html><svg></svg></html>')),'image/svg+xml','a fragment still holds an svg');
  assert.equal(sniffFormat(svg('plain text')),null);
  assert.equal(sniffFormat(new Uint8Array([0x52,0x49,0x46,0x46,1,2,3,4,0x41,0x56,0x49,0x20])),null,'RIFF is not WebP by itself');
});
