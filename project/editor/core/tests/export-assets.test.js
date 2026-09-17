import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPORT_ARTIFACTS, EXPORT_BUNDLE, createExportArtifacts, createExportUiModel, exportedAssetName, rewriteAssetReferences } from '../export/export-policy.js';
import { assetRef } from '../../../runtime/asset-reference.js';

const ID = '7f3c9a1b2c3d4e5f', OTHER = 'aabbccdd11223344';
const picture = () => new Uint8Array(readFileSync(new URL('./fixtures/assets/alpha-24x17.webp', import.meta.url)));
const asset = (id, format = 'image/webp') => ({ id, format, width: 24, height: 17, alpha: true, bytes: 8, name: 'm', importedAt: '' });
const stateWith = (...ids) => ({
  svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg">${ids.map((id, index) => `<image id="p${index}" href="${assetRef(id)}"/>`).join('')}</svg>`,
  assets: Object.fromEntries(ids.map((id) => [id, asset(id)]))
});
const exported = (state, bytesFor = () => picture()) => createExportArtifacts({
  state, serializeSvg: () => state.svgMarkup, createRig: () => ({ schemaVersion: 5 }), runtimeSource: '// runtime', assetBytes: bytesFor
});

test('an exported mascot points at files, not at a scheme no browser knows',()=>{
  // Inside the editor `asset:` is a reference into a store, because that is
  // where undo and autosave need the bytes. On a web page there is no store:
  // there is a folder, and a relative URL is what a browser already fetches.
  const files = exported(stateWith(ID));
  const svg = files.find((file) => file.name === 'mascot.svg').content;
  assert.doesNotMatch(svg,/asset:/,'nothing left pointing at the editor');
  assert.ok(svg.includes(`href="assets/${ID}.webp"`),svg);
  assert.ok(svg.includes(`href="assets/${ID}.webp"`),svg);
  assert.ok(files.some((file) => file.name === `assets/${ID}.webp`),'and the picture is shipped beside it');
  assert.equal(exportedAssetName(asset(ID, 'image/png')),`assets/${ID}.png`);
});

test('the three files a vector mascot always had are unchanged',()=>{
  const plain = { svgMarkup: '<svg><circle id="head" r="4"/></svg>', assets: {} };
  assert.deepEqual(exported(plain).map((file) => file.name),EXPORT_ARTIFACTS.map((item) => item.name));
  assert.deepEqual(createExportUiModel(plain).artifacts.map((item) => item.name),EXPORT_ARTIFACTS.map((item) => item.name));
});

test('a mascot of pictures is offered as one download, because a folder of them is not optional',()=>{
  // A dozen files that each have to land in `assets/` or nothing draws is a
  // way of handing someone a broken mascot and calling it their fault.
  const model = createExportUiModel(stateWith(ID, OTHER));
  assert.equal(model.artifacts[0].name,EXPORT_BUNDLE.name);
  assert.match(model.message,/pictures have to stay in assets\//);
  assert.deepEqual(model.artifacts.map((item) => item.name),[EXPORT_BUNDLE.name, ...EXPORT_ARTIFACTS.map((item) => item.name)]);
});

test('a picture the store cannot give is left visible, not silently emptied',()=>{
  // An author opening the SVG sees which picture did not come; an empty href
  // would have told them nothing.
  const files = exported(stateWith(ID, OTHER), (id) => (id === ID ? picture() : null));
  const svg = files.find((file) => file.name === 'mascot.svg').content;
  assert.ok(svg.includes(`href="assets/${ID}.webp"`),svg);
  assert.ok(svg.includes(`href="${assetRef(OTHER)}"`),'the one that did not come still says which it was');
  assert.equal(files.filter((file) => file.name.startsWith('assets/')).length,1);
});

test('rewriting touches references and nothing else',()=>{
  const shipped = new Map([[ID, `assets/${ID}.webp`]]);
  assert.equal(rewriteAssetReferences(`<image href="${assetRef(ID)}"/>`, shipped),`<image href="assets/${ID}.webp"/>`);
  assert.equal(rewriteAssetReferences(`<image xlink:href="${assetRef(ID)}"/>`, shipped),`<image xlink:href="assets/${ID}.webp"/>`);
  for (const markup of ['<image href="#head"/>', '<use href="#a"/>', '<image href="http://x/a.png"/>', '<image href="asset:nope"/>'])
    assert.equal(rewriteAssetReferences(markup, shipped),markup);
});
