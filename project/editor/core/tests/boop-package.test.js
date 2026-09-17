import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROJECT_ENTRY, RIG_ENTRY, SCENE_ENTRY, assetEntryName, readBoopPackage, writeBoopPackage } from '../export/boop-package.js';
import { crc32, readZip, writeZip } from '../export/zip.js';
import { hashAssetBytes } from '../assets/asset-manager.js';
import { assetRef } from '../../../runtime/asset-reference.js';

const file = (name) => new Uint8Array(readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url)));
const bytes = (text) => new TextEncoder().encode(text);

const projectWith = async (...pictures) => {
  const assets = {}, held = new Map();
  for (const [name, asset] of pictures.entries ? [] : []) void name, asset;
  for (const picture of pictures) {
    const data = file(picture);
    const id = await hashAssetBytes(data);
    assets[id] = { id, format: picture.endsWith('.png') ? 'image/png' : 'image/webp', width: 24, height: 17, alpha: true, bytes: data.length, name: picture, importedAt: '' };
    held.set(id, data);
  }
  const ids = Object.keys(assets);
  return {
    held, ids,
    snapshot: {
      version: 4,
      document: {
        svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg">${ids.map((id, index) => `<image id="p${index}" href="${assetRef(id)}"/>`).join('')}</svg>`,
        layers: [], layerMetadata: {}, assets, rig: { schemaVersion: 5, params: {} }, editor: { animationClips: [] }
      }
    }
  };
};

test('a zip this writes is a zip anything can read, and one byte wrong is refused',async()=>{
  const text = bytes('{"hello":"world"}'.repeat(40)), picture = file('alpha-24x17.webp');
  const zip = await writeZip([{ name: 'project.json', bytes: text }, { name: 'assets/a.webp', bytes: picture, compress: false }]);
  // Compression is real where it helps: JSON that repeats gets much smaller.
  assert.ok(zip.length < text.length + picture.length);
  const back = await readZip(zip);
  assert.deepEqual([...back.keys()],['project.json','assets/a.webp']);
  assert.deepEqual(back.get('project.json'),text);
  assert.deepEqual(back.get('assets/a.webp'),picture);

  // A file that arrived over a network with one byte changed is a mascot that
  // draws wrong in a way nobody traces back to the file.
  const damaged = zip.slice(); damaged[zip.length - 60] ^= 0xff;
  await assert.rejects(() => readZip(damaged),/damaged|not where the package says|not a readable package/);
  await assert.rejects(() => readZip(bytes('not a zip at all')),/not a readable package/);
  assert.equal(crc32(bytes('123456789')),0xcbf43926,'the standard check value');
});

test('a package carries the project, the artwork and the pictures',async()=>{
  const { snapshot, held, ids } = await projectWith('alpha-24x17.webp', 'alpha-16x16.png');
  const { bytes: packed, missing } = await writeBoopPackage({ snapshot, bytesFor: async (id) => held.get(id), rig: { schemaVersion: 5, params: {} } });
  assert.deepEqual(missing,[]);

  const entries = await readZip(packed);
  assert.ok(entries.has(PROJECT_ENTRY) && entries.has(SCENE_ENTRY) && entries.has(RIG_ENTRY));
  for (const id of ids) assert.ok(entries.has(assetEntryName(snapshot.document.assets[id])),id);
  // The artwork lives in its own file, so a person unpacking the archive can
  // open the drawing in anything.
  assert.match(new TextDecoder().decode(entries.get(SCENE_ENTRY)),/^<svg/);
  assert.equal(JSON.parse(new TextDecoder().decode(entries.get(PROJECT_ENTRY))).document.svgMarkup,undefined,'and not twice');

  const back = await readBoopPackage(packed);
  assert.equal(back.snapshot.document.svgMarkup,snapshot.document.svgMarkup);
  assert.deepEqual(back.snapshot.document.assets,snapshot.document.assets);
  assert.deepEqual([...back.assets.keys()].sort(),[...ids].sort());
  assert.deepEqual({ damaged: back.damaged, missing: back.missing },{ damaged: [], missing: [] });
});

test('what opens is the project, never the rig beside it',async()=>{
  // The exported rig is lossy on purpose (docs/PROJECT_FORMAT.md), so a
  // package that carries a stale or hostile one cannot corrupt anything: the
  // reader does not believe it.
  const { snapshot, held } = await projectWith('alpha-24x17.webp');
  const { bytes: packed } = await writeBoopPackage({ snapshot, bytesFor: async (id) => held.get(id), rig: { schemaVersion: 99, params: { invented: true }, states: { nowhere: {} } } });
  const back = await readBoopPackage(packed);
  assert.deepEqual(back.snapshot.document.rig,snapshot.document.rig);
  assert.equal(back.snapshot.document.rig.schemaVersion,5);
  assert.equal(back.snapshot.document.rig.params.invented,undefined);
});

test('a package is asked whether it is telling the truth about its own pictures',async()=>{
  const { snapshot, held, ids } = await projectWith('alpha-24x17.webp');
  // A package assembled by hand, or by something that did not know that an id
  // is the hash of the bytes it addresses.
  const wrong = new Map(held); wrong.set(ids[0], file('alpha-16x16.png'));
  const { bytes: packed } = await writeBoopPackage({ snapshot, bytesFor: async (id) => wrong.get(id) });
  const back = await readBoopPackage(packed);
  assert.deepEqual(back.damaged,ids);
  assert.equal(back.assets.size,0,'nothing that failed the check is handed on');
  // One problem, one report: the two lists are disjoint, and together they are
  // everything that will not draw.
  assert.deepEqual(back.missing,[]);
  assert.deepEqual([...back.damaged, ...back.missing].sort(),ids.sort());
});

test('a picture the package does not carry is named rather than drawn as a hole',async()=>{
  const { snapshot } = await projectWith('alpha-24x17.webp');
  const { bytes: packed, missing } = await writeBoopPackage({ snapshot, bytesFor: async () => null });
  assert.equal(missing.length,1);
  const back = await readBoopPackage(packed);
  assert.deepEqual(back.missing,missing);
  assert.equal(back.assets.size,0);
});

test('a picture kept only for undo still travels',async()=>{
  // Listed but not drawn: leaving it out means reopening the file and pressing
  // undo finds a hole.
  const { snapshot, held, ids } = await projectWith('alpha-24x17.webp', 'alpha-16x16.png');
  snapshot.document.svgMarkup = `<svg><image id="p0" href="${assetRef(ids[0])}"/></svg>`;
  const { bytes: packed } = await writeBoopPackage({ snapshot, bytesFor: async (id) => held.get(id) });
  const back = await readBoopPackage(packed);
  assert.equal(back.assets.size,2);
  assert.deepEqual(back.missing,[]);
});

test('something that is not a package says so',async()=>{
  await assert.rejects(() => readBoopPackage(bytes('hello')),/not a readable package/);
  const empty = await writeZip([{ name: 'readme.txt', bytes: bytes('nothing here') }]);
  await assert.rejects(() => readBoopPackage(empty),/no project in it/);
  const nonsense = await writeZip([{ name: PROJECT_ENTRY, bytes: bytes('{not json') }]);
  await assert.rejects(() => readBoopPackage(nonsense),/could not be read/);
});
