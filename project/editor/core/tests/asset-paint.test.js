import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_ATTRIBUTE, assetReferenceOf, collectAssetReferences, deferAssetReferences, paintAssetReferences, restoreAssetReferences, unpaintAssetNodes } from '../../../runtime/asset-paint.js';
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
  // And putting it back is exactly what came in -- in two steps, because the
  // second one may not touch a node. See the serializer test below.
  assert.deepEqual(unpaintAssetNodes([image]),[assetRef(ID)]);
  assert.deepEqual(image.toObject(),{ [ASSET_ATTRIBUTE]: assetRef(ID) });
  assert.equal(restoreAssetReferences(`<image ${ASSET_ATTRIBUTE}="${assetRef(ID)}"/>`),`<image href="${assetRef(ID)}"/>`);
});

test('a painted node loses every href it was painted through',()=>{
  // Whichever attribute carried the URL, the URL goes: a document is stored
  // pointing at a reference and never at a blob.
  const image = node({ 'xlink:href': assetRef(ID) });
  paintAssetReferences([image], resolverFor({ [assetRef(ID)]: 'blob:fake/1' }));
  assert.deepEqual(image.toObject(),{ 'xlink:href': 'blob:fake/1', [ASSET_ATTRIBUTE]: assetRef(ID) });
  unpaintAssetNodes([image]);
  assert.deepEqual(image.toObject(),{ [ASSET_ATTRIBUTE]: assetRef(ID) });
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
  assert.deepEqual(unpaintAssetNodes([image]),[assetRef(ID)]);
  assert.deepEqual(image.toObject(),{ [ASSET_ATTRIBUTE]: assetRef(ID) });
});

test('nothing without a reference is touched',()=>{
  const plain = node({ href: '#head', fill: 'red' });
  const missingMark = node({ [ASSET_ATTRIBUTE]: 'not-a-reference' });
  paintAssetReferences([plain, missingMark], resolverFor({}));
  assert.deepEqual(plain.toObject(),{ href: '#head', fill: 'red' });
  assert.deepEqual(unpaintAssetNodes([plain, missingMark]),[]);
  assert.deepEqual(missingMark.toObject(),{ [ASSET_ATTRIBUTE]: 'not-a-reference' });
  // And the string half leaves everything that is not a reference alone.
  for (const markup of ['<image href="#head"/>', '<image href="http://x/a.png"/>', `<image ${ASSET_ATTRIBUTE}="asset:nope"/>`])
    assert.equal(restoreAssetReferences(markup),markup);
  for (const markup of ['<image href="#head"/>', '<image href="blob:x"/>', '<image href="asset:nope"/>'])
    assert.equal(deferAssetReferences(markup),markup);
});

test('the serializer never writes a reference onto a node, only into text',async()=>{
  // This cost two failed requests on every commit before it was found.
  // `SvgDocument.serialize` works on `root.cloneNode(true)`, and a cloned SVG
  // node is still a node in a live document -- detached, but live. Setting
  // `href="asset:…"` on it makes the browser fetch a scheme it has never heard
  // of, exactly as if the node were on screen. The clone is never shown, so
  // nothing looks wrong; there is only a console error nobody can account for.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../svg-document/svg-document.js', import.meta.url), 'utf8');
  const serialize = source.slice(source.indexOf('  serialize() {'));
  assert.match(serialize,/unpaintAssetNodes\(clean\)/,'the painted href comes off the clone');
  assert.match(serialize,/return restoreAssetReferences\(this\.serializer\(clone\)\)/,'and the reference goes back into the text, not onto a node');
  assert.ok(serialize.indexOf('unpaintAssetNodes') < serialize.indexOf('return restoreAssetReferences'),
    'the node half runs before the string half, or there is no string to rewrite');
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
