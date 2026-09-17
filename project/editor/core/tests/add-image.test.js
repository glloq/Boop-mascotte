import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProjectService } from '../../app/services/project-service.js';
import { createEditorStore } from '../state/editor-store.js';
import { createCleanProjectState } from '../state/store.js';
import { createHistory } from '../undo/history.js';
import { createAssetManager } from '../assets/asset-manager.js';
import { createMemoryAssetStore } from '../assets/asset-store.js';
import { parseAssetRef } from '../../../runtime/asset-reference.js';

const file = (name) => readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url));
/** A `File`, as the service reads one: a name, a type and some bytes. */
const fileOf = (name, bytes, type = '') => ({ name, type, arrayBuffer: async () => bytes });

function harness({ assets = true } = {}) {
  const store = createEditorStore(Object.assign(createCleanProjectState(), {
    svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><circle id="head" r="10"/></svg>',
    elements: { head: { baseTransform: { x: 0, y: 0 } } }, layers: [{ id: 'head', type: 'circle', name: 'head', children: [] }]
  }));
  const history = createHistory(store);
  const status = [], refreshed = [];
  const assetStore = createMemoryAssetStore();
  const service = createProjectService({
    store, history,
    assets: assets ? createAssetManager({ store: assetStore }) : null,
    canvas: {
      // The real one parses and re-reads the document; this returns what it
      // would have returned, with the node appended to the markup.
      appendArtwork: (markup) => {
        const document = store.getDocument();
        return {
          svgMarkup: document.svgMarkup.replace('</svg>', `${markup}</svg>`),
          layers: [...document.layers, { id: /id="([^"]+)"/.exec(markup)[1], type: 'image', name: 'picture', children: [] }],
          layerMetadata: {},
          elements: { ...document.elements, [/id="([^"]+)"/.exec(markup)[1]]: { baseTransform: { x: 0, y: 0 } } }
        };
      },
      refreshAssets: async () => { refreshed.push(true); return { painted: [], missing: [] }; }
    },
    preview: { apply() {} },
    setStatus: (message, tone) => status.push([message, tone])
  });
  return { service, store, history, status, refreshed, assetStore };
}

test('a picture lands on the canvas and in the table, in one step',async()=>{
  const { service, store, history, status, refreshed, assetStore } = harness();
  history.snapshot();
  assert.equal(await service.addImageFile(fileOf('Head Front.webp', file('alpha-24x17.webp'), 'image/webp')),true);

  const document = store.getDocument();
  const id = Object.keys(document.assets)[0];
  assert.match(document.svgMarkup,new RegExp(`<image id="head-front" href="asset:${id}"`));
  assert.equal(document.assets[id].name,'Head Front.webp');
  assert.deepEqual([document.assets[id].width, document.assets[id].height],[24, 17]);
  assert.deepEqual(await assetStore.keys(),[id],'the bytes went to the store, not the document');
  assert.doesNotMatch(document.svgMarkup,/blob:|data:/);
  assert.deepEqual(refreshed,[true],'and it was fetched so it could be drawn');
  assert.match(status[0][0],/Added Head Front\.webp/);

  // One step, because the node and the record it points at have to leave
  // together: an undo between them leaves artwork pointing at nothing.
  history.undo();
  const undone = store.getDocument();
  assert.deepEqual(undone.assets,{});
  assert.doesNotMatch(undone.svgMarkup,/<image/);
});

test('the same picture added twice is one asset, and says so',async()=>{
  const { service, store, status, assetStore } = harness();
  await service.addImageFile(fileOf('head.webp', file('alpha-24x17.webp'), 'image/webp'));
  await service.addImageFile(fileOf('head-again.webp', file('alpha-24x17.webp'), 'image/webp'));
  const document = store.getDocument();
  assert.equal(Object.keys(document.assets).length,1);
  assert.equal((await assetStore.keys()).length,1);
  // Two nodes, one picture: the second gets its own id rather than colliding.
  assert.match(document.svgMarkup,/id="head"/);
  assert.match(document.svgMarkup,/id="head-again"/);
  assert.match(status[1][0],/you already had this picture/);
});

test('a picture is placed where its author will find it',async()=>{
  const { service, store } = harness();
  await service.addImageFile(fileOf('big.png', file('alpha-16x16.png'), 'image/png'));
  const placed = /<image[^>]*x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(store.getDocument().svgMarkup);
  // Centred on the 240 artboard, at its own size, which is small.
  assert.deepEqual(placed.slice(1),['112','112','16','16']);
});

test('a file that cannot be a picture says why, and changes nothing',async()=>{
  const { service, store, status, assetStore } = harness();
  const before = store.getDocument().svgMarkup;
  assert.equal(await service.addImageFile(fileOf('notes.txt', new TextEncoder().encode('hello'), 'text/plain')),false);
  assert.match(status[0][0],/not a picture this editor can read/);
  assert.equal(status[0][1],'error');

  assert.equal(await service.addImageFile(fileOf('photo.jpg', new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0,0]), 'image/jpeg')),false);
  assert.match(status[1][0],/saved as PNG or WebP first/);

  assert.equal(await service.addImageFile(fileOf('trap.svg', new TextEncoder().encode('<svg viewBox="0 0 8 8"><script>x()</script></svg>'))),false);
  assert.match(status[2][0],/carries something executable/);

  assert.equal(store.getDocument().svgMarkup,before,'nothing reached the artwork');
  assert.deepEqual(await assetStore.keys(),[],'and nothing reached the store');
});

test('an editor wired without an asset manager refuses rather than throws',async()=>{
  const { service, status } = harness({ assets: false });
  assert.equal(await service.addImageFile(fileOf('head.webp', file('alpha-24x17.webp'))),false);
  assert.match(status[0][0],/cannot be added in this editor build/);
});

test('an unreadable file is the file being the problem, not the project',async()=>{
  const { service, store, status } = harness();
  const before = store.getDocument().svgMarkup;
  assert.equal(await service.addImageFile({ name: 'gone.png', type: 'image/png', arrayBuffer: async () => { throw new Error('disk'); } }),false);
  assert.match(status[0][0],/Could not read gone\.png/);
  assert.equal(store.getDocument().svgMarkup,before);
});

test('every reference the service writes is one the sanitizer keeps',async()=>{
  const { service, store } = harness();
  await service.addImageFile(fileOf('head.webp', file('alpha-24x17.webp'), 'image/webp'));
  const reference = /href="([^"]+)"/.exec(store.getDocument().svgMarkup)[1];
  assert.ok(parseAssetRef(reference),`${reference} must parse as a reference or the cleaner will remove it`);
});
