import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProjectService } from '../../app/services/project-service.js';
import { createEditorStore } from '../state/editor-store.js';
import { createCleanProjectState } from '../state/store.js';
import { createHistory } from '../undo/history.js';
import { createAssetManager } from '../assets/asset-manager.js';
import { createMemoryAssetStore } from '../assets/asset-store.js';
import { readBoopPackage, writeBoopPackage } from '../export/boop-package.js';
import { hashAssetBytes } from '../assets/asset-manager.js';
import { assetRef } from '../../../runtime/asset-reference.js';

const file = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url)));
const fileOf = (name, bytes, type = '') => ({ name, type, arrayBuffer: async () => bytes, slice: (from, to) => ({ arrayBuffer: async () => bytes.slice(from, to) }), text: async () => new TextDecoder().decode(bytes) });

async function harness({ withPicture = true } = {}) {
  const picture = file('alpha-24x17.webp');
  const id = await hashAssetBytes(picture);
  const assetStore = createMemoryAssetStore();
  if (withPicture) await assetStore.put(id, picture);
  const store = createEditorStore(Object.assign(createCleanProjectState(), {
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${withPicture ? `<image id="mouth" href="${assetRef(id)}" x="0" y="0" width="24" height="17"/>` : '<circle id="head" r="10"/>'}</svg>`,
    assets: withPicture ? { [id]: { id, format: 'image/webp', width: 24, height: 17, alpha: true, bytes: picture.length, name: 'mouth.webp', importedAt: '' } } : {},
    elements: withPicture ? { mouth: { baseTransform: { x: 0, y: 0 }, meta: { nodeType: 'image', assetRef: assetRef(id) } } } : { head: { baseTransform: { x: 0, y: 0 } } },
    params: {}, states: { idle: {} }, activeState: 'idle'
  }));
  const downloads = [], status = [], calls = [];
  const service = createProjectService({
    store, history: createHistory(store),
    assets: createAssetManager({ store: assetStore }),
    canvas: {
      serializeCurrentSvg: () => store.getDocument().svgMarkup,
      prepareSvgImport: (svg) => svg,
      loadSvgFromText: async () => {},
      refreshAssets: async () => { calls.push('refresh'); return { painted: [], missing: [] }; },
      fitToCanvas: () => {}
    },
    preview: { apply() {}, setClip() {}, seek() {}, stop() {}, reset() {} },
    timeline: { reset() {} },
    autosave: { isDirty: () => false, markSaved: () => calls.push('saved'), markDirty: () => {} },
    createDownload: (name, data, type) => downloads.push({ name, data, type }),
    setStatus: (message, tone) => status.push([message, tone]),
    requestAnimationFrame: (callback) => callback()
  });
  return { service, store, downloads, status, calls, assetStore, id, picture };
}

test('a project with pictures saves as a package, and one without saves as it always did',async()=>{
  // Handing an author a JSON snapshot that references pictures it does not
  // carry is handing them a file that silently drops their drawings.
  const withPictures = await harness();
  assert.equal(await withPictures.service.saveProject(),true);
  assert.equal(withPictures.downloads[0].name,'mascot.boop');
  assert.equal(withPictures.downloads[0].type,'application/zip');

  const plain = await harness({ withPicture: false });
  assert.equal(await plain.service.saveProject(),true);
  assert.equal(plain.downloads[0].name,'mascot-project.json');
  assert.match(plain.status[0][0],/Project snapshot exported/);
});

test('the package it writes is a package that opens on another machine',async()=>{
  const { service, downloads, id, picture } = await harness();
  await service.saveBoopPackage();
  // Read back with nothing from this session: no store, no editor, no
  // original files -- which is the whole promise of a package.
  const back = await readBoopPackage(downloads[0].data);
  assert.deepEqual(back.missing,[]);
  assert.deepEqual(back.damaged,[]);
  assert.deepEqual(back.assets.get(id),picture);
  assert.match(back.snapshot.document.svgMarkup,new RegExp(`href="asset:${id}"`));
  // And a runtime's copy of the rig rode along beside the project's own.
  assert.ok(back.snapshot.document.rig.schemaVersion);
});

test('a picture the store has lost is said at the save, not discovered at the reopen',async()=>{
  const { service, assetStore, status, downloads, id } = await harness();
  await assetStore.remove(id);
  assert.equal(await service.saveBoopPackage(),true);
  assert.match(status.at(-1)[0],/1 picture could not be included/);
  assert.equal(status.at(-1)[1],'warn');
  assert.equal(downloads.length,1,'and the file is still written: a package short a picture still opens');
});

test('opening a package puts its pictures where the canvas will find them',async()=>{
  const source = await harness();
  await source.service.saveBoopPackage();
  const packed = source.downloads[0].data;

  // A different editor: empty store, empty project.
  const target = await harness({ withPicture: false });
  assert.equal(await target.service.loadProjectFile(fileOf('mascot.boop', packed)),true);
  assert.ok(await target.assetStore.has(source.id),'the bytes landed before the canvas painted');
  assert.ok(target.calls.includes('refresh'));
  assert.match(target.store.getDocument().svgMarkup,new RegExp(`asset:${source.id}`));
  assert.deepEqual(Object.keys(target.store.getDocument().assets),[source.id]);
});

test('a package and a snapshot arrive through the same door',async()=>{
  // `PK` is a ZIP. The name is not asked, because a name can be anything.
  const target = await harness({ withPicture: false });
  const snapshot = { version: 3, document: { svgMarkup: '<svg><circle id="head" r="4"/></svg>', layers: [], layerMetadata: {}, rig: { params: {}, states: {}, elements: {} }, editor: {} } };
  assert.equal(await target.service.loadProjectFile(fileOf('project.json', new TextEncoder().encode(JSON.stringify(snapshot)))),true);
  assert.match(target.store.getDocument().svgMarkup,/<circle/);
});

test('a package whose picture is not the picture it claims opens with the piece blank, and says so',async()=>{
  const source = await harness();
  const snapshot = { version: 4, document: { ...source.store.getDocument(), rig: { params: {}, states: { idle: {} }, elements: {} }, editor: {} } };
  // Written with the wrong bytes under the right name.
  const { bytes } = await writeBoopPackage({ snapshot, bytesFor: async () => file('alpha-16x16.png') });
  const target = await harness({ withPicture: false });
  assert.equal(await target.service.loadProjectFile(fileOf('tampered.boop', bytes)),true);
  assert.match(target.status.at(-1)[0],/1 picture could not be read/);
  assert.equal(target.status.at(-1)[1],'warn');
  assert.equal(await target.assetStore.has(source.id),false,'and nothing that failed the check was kept');
});

test('something that is not a project says which file was the problem',async()=>{
  const { service, status, store } = await harness({ withPicture: false });
  const before = store.getDocument().svgMarkup;
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
  assert.equal(await service.loadProjectFile(fileOf('broken.boop', zip)),false);
  assert.match(status.at(-1)[0],/broken\.boop/);
  assert.equal(status.at(-1)[1],'error');
  assert.equal(store.getDocument().svgMarkup,before);
});
