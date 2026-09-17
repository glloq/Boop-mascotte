import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_ATTRIBUTE, assetReferenceOf, collectAssetReferences, paintAssetReferences, restoreAssetReferences } from '../../../runtime/asset-paint.js';
import { assetRef } from '../../../runtime/asset-reference.js';

/** What the paint pass needs of an element: four attribute methods. */
const node = (attributes = {}) => {
  const held = new Map(Object.entries(attributes));
  return {
    held,
    getAttribute: (name) => (held.has(name) ? held.get(name) : null),
    setAttribute: (name, value) => held.set(name, String(value)),
    removeAttribute: (name) => held.delete(name),
    toObject: () => Object.fromEntries(held)
  };
};
const resolverFor = (map) => ({ urlFor: (reference) => map[reference] ?? null });
const ID = '7f3c9a1b2c3d4e5f', OTHER = 'aabbccdd11223344';

test('a reference is found before it is painted and after',()=>{
  assert.equal(assetReferenceOf(node({ href: assetRef(ID) })),assetRef(ID));
  assert.equal(assetReferenceOf(node({ 'xlink:href': assetRef(ID) })),assetRef(ID));
  assert.equal(assetReferenceOf(node({ href: 'blob:fake/0', [ASSET_ATTRIBUTE]: assetRef(ID) })),assetRef(ID));
  // Nothing that is not a reference is mistaken for one.
  assert.equal(assetReferenceOf(node({ href: '#head' })),null);
  assert.equal(assetReferenceOf(node({ href: 'http://evil.example/a.png' })),null);
  assert.equal(assetReferenceOf(node({ href: 'asset:../../etc/passwd' })),null);
  assert.deepEqual(collectAssetReferences([node({ href: assetRef(ID) }), node({ href: assetRef(ID) }), node({ href: '#x' })]),[assetRef(ID)]);
});

test('painting moves the reference aside rather than away',()=>{
  const image = node({ href: assetRef(ID) });
  const { painted, missing } = paintAssetReferences([image], resolverFor({ [assetRef(ID)]: 'blob:fake/0' }));
  assert.deepEqual({ painted, missing },{ painted: [assetRef(ID)], missing: [] });
  assert.deepEqual(image.toObject(),{ href: 'blob:fake/0', [ASSET_ATTRIBUTE]: assetRef(ID) });
  // And putting it back is exactly what came in.
  assert.deepEqual(restoreAssetReferences([image]),[assetRef(ID)]);
  assert.deepEqual(image.toObject(),{ href: assetRef(ID) });
});

test('the attribute a node was written with is the attribute it gets back',()=>{
  const image = node({ 'xlink:href': assetRef(ID) });
  paintAssetReferences([image], resolverFor({ [assetRef(ID)]: 'blob:fake/1' }));
  assert.deepEqual(image.toObject(),{ 'xlink:href': 'blob:fake/1', [ASSET_ATTRIBUTE]: assetRef(ID) });
  restoreAssetReferences([image]);
  assert.deepEqual(image.toObject(),{ 'xlink:href': assetRef(ID) });
});

test('an asset the resolver cannot answer is shown as missing, never as whatever was there',()=>{
  // An author whose picture is gone needs to see that. Leaving a revoked URL
  // in place shows a browser's broken-image glyph and leaving the previous one
  // shows a lie.
  const image = node({ href: 'blob:fake/0', [ASSET_ATTRIBUTE]: assetRef(OTHER) });
  const { missing } = paintAssetReferences([image], resolverFor({}));
  assert.deepEqual(missing,[assetRef(OTHER)]);
  assert.deepEqual(image.toObject(),{ [ASSET_ATTRIBUTE]: assetRef(OTHER), 'data-editor-asset-missing': 'true' });
  // And when it comes back, the mark goes.
  paintAssetReferences([image], resolverFor({ [assetRef(OTHER)]: 'blob:fake/2' }));
  assert.deepEqual(image.toObject(),{ href: 'blob:fake/2', [ASSET_ATTRIBUTE]: assetRef(OTHER) });
});

test('repainting a node that is already painted keeps pointing at the reference, not the URL',()=>{
  const image = node({ href: assetRef(ID) });
  const resolver = resolverFor({ [assetRef(ID)]: 'blob:fake/0' });
  paintAssetReferences([image], resolver);
  // A second pass with a new URL for the same asset -- what happens when a
  // resolver is released and primed again.
  paintAssetReferences([image], resolverFor({ [assetRef(ID)]: 'blob:fake/9' }));
  assert.deepEqual(image.toObject(),{ href: 'blob:fake/9', [ASSET_ATTRIBUTE]: assetRef(ID) });
  assert.deepEqual(restoreAssetReferences([image]),[assetRef(ID)]);
  assert.deepEqual(image.toObject(),{ href: assetRef(ID) });
});

test('nothing without a reference is touched',()=>{
  const plain = node({ href: '#head', fill: 'red' });
  const missingMark = node({ [ASSET_ATTRIBUTE]: 'not-a-reference' });
  paintAssetReferences([plain, missingMark], resolverFor({}));
  assert.deepEqual(plain.toObject(),{ href: '#head', fill: 'red' });
  assert.deepEqual(restoreAssetReferences([plain, missingMark]),[]);
  assert.deepEqual(missingMark.toObject(),{ [ASSET_ATTRIBUTE]: 'not-a-reference' });
});

test('the document serializer puts references back before it does anything else',async()=>{
  // Node has no DOM, so this is asserted at the source the way this repo
  // already asserts render-loop properties (`runtime-performance.test.js`):
  // the ordering is what matters and the ordering is readable. Drawing it for
  // real is the browser test's job.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../svg-document/svg-document.js', import.meta.url), 'utf8');
  const serialize = source.slice(source.indexOf('  serialize() {'));
  assert.match(serialize,/restoreAssetReferences\(clean\)/,'serialization must restore references');
  assert.ok(serialize.indexOf('restoreAssetReferences') < serialize.indexOf('EDITOR_ATTRIBUTES.forEach'),
    'references go back before editor attributes are swept, or the reference is swept with them');
});

test('the canvas paints before it measures, and fetches separately',async()=>{
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../../svg-editor/svg-canvas.js', import.meta.url), 'utf8');
  const load = source.slice(source.indexOf('function loadSvgTextNow'), source.indexOf('/* ── Node tool'));
  assert.ok(load.indexOf('paintAssets(svgRoot)') < load.indexOf('documentModel.load(svgRoot'),
    'artwork is pointed at something paintable before anything measures it');
  // Loading is synchronous and reading bytes is not, so fetching cannot be
  // inside it. Comments are stripped first: the sentence explaining that this
  // pass does not await is not itself an await.
  const code = load.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code,/\bawait\b/,'loading must not become asynchronous');
});
