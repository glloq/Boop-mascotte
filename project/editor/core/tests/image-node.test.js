import test from 'node:test';
import assert from 'node:assert/strict';
import { imageElementPlugin } from '../plugins/builtin/image-plugin.js';
import { defaultElementPlugin } from '../plugins/builtin/default-plugin.js';
import { pathElementPlugin } from '../plugins/builtin/path-plugin.js';
import { createPluginRegistry } from '../plugins/plugin-registry.js';
import { CONVERTIBLE_SHAPES, canBecomeAPath, pathOnlyMessage } from '../../svg-editor/path-only.js';
import { assetRef } from '../../../runtime/asset-reference.js';

const ID = '7f3c9a1b2c3d4e5f';
/** The shape of node the plugins are handed: SVG.js wrappers, in miniature. */
const wrapper = (type, attributes = {}) => ({ type, node: { localName: type }, attr: (name) => attributes[name] });
const transform = { x: 4, y: 8, rotation: 15, scaleX: 1.5, scaleY: 1.5, pivotX: 0, pivotY: 0 };

test('a picture is rigged like anything else',()=>{
  const rig = imageElementPlugin.createRigData(wrapper('image', { href: assetRef(ID), width: '48', height: '32', opacity: '0.8' }), transform);
  // The rig never asked what a piece was drawn with: a picture moves, turns,
  // scales and fades exactly as a path does.
  assert.deepEqual(rig.baseTransform,transform);
  assert.equal(rig.baseOpacity,0.8);
  assert.deepEqual(rig.constraints,{ translate: true, rotate: true, scale: true });
  // And has no outline, so what reshapes artwork is declared and off.
  assert.equal(rig.morph.enabled,false);
  assert.deepEqual({ pathA: rig.morph.pathA, pathB: rig.morph.pathB },{ pathA: '', pathB: '' });
});

test('a picture carries the two things it knows that a path does not',()=>{
  const rig = imageElementPlugin.createRigData(wrapper('image', { href: assetRef(ID), width: '48', height: '32' }), transform);
  assert.deepEqual(rig.meta,{ nodeType: 'image', assetRef: assetRef(ID), width: 48, height: 32 });

  // A node already painted keeps its reference beside the object URL, and is
  // read from there -- otherwise a piece duplicated while on screen would
  // record a URL that dies with the tab.
  const painted = imageElementPlugin.createRigData(wrapper('image', { href: 'blob:fake/0', 'data-editor-asset': assetRef(ID), width: '48', height: '32' }), transform);
  assert.equal(painted.meta.assetRef,assetRef(ID));

  // Nothing that is not a reference becomes one.
  for (const href of ['http://evil.example/a.png', 'asset:../../etc/passwd', '#head', undefined])
    assert.equal(imageElementPlugin.createRigData(wrapper('image', { href }), transform).meta.assetRef,'',String(href));
  // A missing or nonsense size is zero rather than NaN.
  assert.deepEqual(['width','height'].map((key) => imageElementPlugin.createRigData(wrapper('image', { width: 'auto' }), transform).meta[key]),[0, 0]);
});

test('the registry hands an image to the image plugin and everything else where it went before',()=>{
  const registry = createPluginRegistry();
  for (const plugin of [defaultElementPlugin, pathElementPlugin, imageElementPlugin]) registry.register(plugin);
  assert.equal(registry.getByNode({ type: 'image' }),imageElementPlugin);
  assert.equal(registry.getByNode({ type: 'path' }),pathElementPlugin);
  assert.equal(registry.getByNode({ type: 'rect' }),defaultElementPlugin);
  assert.equal(registry.getByNode({ type: 'g' }),defaultElementPlugin);
});

test('being told why says what to do next, and never says the impossible',()=>{
  // A rectangle can become a path, and the message says how.
  assert.deepEqual(CONVERTIBLE_SHAPES,['rect','circle','ellipse','line','polygon','polyline']);
  for (const kind of CONVERTIBLE_SHAPES) {
    assert.ok(canBecomeAPath(kind));
    assert.match(pathOnlyMessage('body', kind),/convert this shape to one first/);
  }
  // A picture cannot, and the old message sent its author to a menu item that
  // would have told them no.
  assert.equal(canBecomeAPath('image'),false);
  const picture = pathOnlyMessage('head', 'image');
  assert.doesNotMatch(picture,/convert/);
  assert.match(picture,/head is a picture/);
  assert.match(picture,/move, turn and scale it instead/);
  // And anything else that has no outline gets the honest version.
  for (const kind of ['text', 'g', 'use']) {
    assert.doesNotMatch(pathOnlyMessage('thing', kind),/convert/);
    assert.match(pathOnlyMessage('thing', kind),/no outline to hold/);
  }
  // What wanted a path is said, not assumed.
  assert.match(pathOnlyMessage('head', 'image', 'a warp grid holds a path'),/a warp grid holds a path/);
});
