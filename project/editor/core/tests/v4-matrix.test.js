import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { referenceMascots, fixtureBytes } from './helpers/reference-mascots.js';
import { createProjectSnapshot, applyProjectSnapshot, prepareProjectSnapshot } from '../state/project-snapshot.js';
import { projectVersionFor, projectVersionOf, PROJECT_VERSION } from '../state/project-version.js';
import { createCleanProjectState } from '../state/store.js';
import { readBoopPackage, writeBoopPackage } from '../export/boop-package.js';
import { createExportArtifacts } from '../export/export-policy.js';
import { createExportRig } from '../export/export-rig.js';
import { findUnsafeSvg, sanitizeSvgMarkup } from '../security/sanitize-svg.js';
import { createAssetManager } from '../assets/asset-manager.js';
import { missingAssets, unusedAssets } from '../assets/asset-manager.js';
import { compileRigFrame, meshPointsAt, normalizeMeshes, resolveStateParams, rigRequirements } from '../../../runtime/runtime.js';
import { parseAssetRef } from '../../../runtime/asset-reference.js';

/**
 * The V4 validation matrix (V4-110, docs/V4_ROADMAP.md Phase 11).
 *
 * Five reference mascots — paths only, pictures only, both at once, a
 * photograph with features on it, and a picture that bends behind a mask — put
 * through everything the programme said would keep working. One `test` per
 * column of the matrix rather than one per mascot, because the interesting
 * failure is always "this one is different", and a loop says that in the
 * assertion message.
 *
 * It is a contract suite, not a benchmark. Where something is measured there is
 * one generous order-of-magnitude ceiling, and it exists to catch a change in
 * *kind* — a document that started carrying its own pixels — not a change of
 * twenty per cent.
 */

const MASCOTS = await referenceMascots();
const byName = Object.fromEntries(MASCOTS.map((item) => [item.name, item]));
const each = (run) => { for (const mascot of MASCOTS) run(mascot, `[${mascot.name}]`); };

const snapshotOf = (mascot) => createProjectSnapshot(mascot.state, () => mascot.state.svgMarkup);
/**
 * A store entry, a package entry or a `Blob`, as the bytes it stands for.
 *
 * The store hands out `Blob`s because that is what `createObjectURL` takes; the
 * package writer wants bytes. Getting this wrong is what made the first raster
 * import fail in a browser and pass in every test, so it is one helper here too.
 */
const asBytes = async (value) => {
  if (!value) return new Uint8Array();
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(await value.arrayBuffer());
};
const bytesOf = (mascot) => async (id) => asBytes(await mascot.store.get(id));

// ---------------------------------------------------------------------------
// Opening, versioning, and the oldest reader that can still do it
// ---------------------------------------------------------------------------

test('matrix · every reference mascot declares the oldest reader that can open it', () => {
  // A file says what an old editor would *lose*, never what a new one wrote:
  // a paths-only project stays openable by an editor that gained nothing.
  assert.equal(projectVersionFor(snapshotOf(byName.historic).document), 3);
  assert.equal(projectVersionFor(snapshotOf(byName.raster).document), 4, 'assets need a reader that knows about them');
  assert.equal(projectVersionFor(snapshotOf(byName.bent).document), 5, 'and a mesh needs one that knows about those');
  assert.equal(projectVersionFor(snapshotOf(byName.personal).document), 4);
  assert.ok(PROJECT_VERSION >= 5);

  each((mascot, where) => {
    const snapshot = snapshotOf(mascot);
    assert.ok(projectVersionOf(snapshot) <= PROJECT_VERSION, `${where} this editor can open what it just wrote`);
    // The boundary every file arrives through: one migration, one sanitise,
    // and the caller's own object is never the one that was migrated.
    const prepared = prepareProjectSnapshot(structuredClone(snapshot), sanitizeSvgMarkup);
    assert.ok(prepared.document.svgMarkup.includes('<svg'), `${where} survives it`);
    for (const id of Object.keys(mascot.assets)) assert.ok(prepared.document.svgMarkup.includes(`asset:${id}`), `${where} with ${id} intact`);
  });
});

test('matrix · a project round-trips through the store without losing anything', () => {
  each((mascot, where) => {
    const reopened = createCleanProjectState();
    applyProjectSnapshot(reopened, snapshotOf(mascot));
    assert.deepEqual(reopened.assets, mascot.state.assets, `${where} the asset table`);
    assert.deepEqual(reopened.elements, mascot.state.elements, `${where} the rig`);
    assert.deepEqual(reopened.states, mascot.state.states, `${where} the poses`);
    assert.deepEqual(normalizeMeshes(reopened), normalizeMeshes(mascot.state), `${where} the meshes`);
    assert.equal(reopened.svgMarkup, mascot.state.svgMarkup, `${where} the artwork`);
  });
});

// ---------------------------------------------------------------------------
// ASSET-REF: the decision the whole programme rests on
// ---------------------------------------------------------------------------

test('matrix · no document anywhere carries a byte of a picture', () => {
  each((mascot, where) => {
    const serialized = JSON.stringify(snapshotOf(mascot));
    assert.equal(/;base64,/.test(serialized), false, `${where} a data URI in a project is a project that cannot be undone cheaply`);
    // The artwork points at ids; the bytes are somewhere else entirely.
    for (const record of Object.values(mascot.state.assets)) {
      assert.ok(mascot.state.svgMarkup.includes(`asset:${record.id}`), `${where} ${record.id} is referenced`);
      // `bytes` is how many, never which: a record is a description with a
      // size on it, and the pixels live in the store.
      assert.equal(typeof record.bytes, 'number', `${where} an asset record is a description, not a payload`);
      assert.equal(Object.keys(record).some((key) => /data|content|payload|base64/i.test(key)), false, `${where} and carries nothing that could be one`);
    }
    // What undo copies costs a fixed amount per picture, not the picture's own
    // size. Measured as the difference the asset table actually makes, so the
    // claim is scale-free: a 4 MB photograph must cost the same as a 700-byte
    // fixture, and that is the whole of ASSET-REF.
    const count = Object.keys(mascot.assets).length;
    const withoutTable = JSON.stringify({ ...snapshotOf(mascot), document: { ...snapshotOf(mascot).document, assets: {} } });
    if (count) assert.ok(serialized.length - withoutTable.length < 300 * count,
      `${where} the asset table costs ${serialized.length - withoutTable.length} for ${count} pictures`);
    for (const record of Object.values(mascot.assets)) {
      assert.ok(JSON.stringify(record).length < 256, `${where} ${record.id} describes itself in ${JSON.stringify(record).length} characters`);
    }
  });
});

test('matrix · an asset is its own content, so the same picture is stored once', () => {
  const personal = byName.personal;
  // Both eyes were imported separately from the same file.
  assert.equal(personal.duplicateOf, personal.sharedAsset, 'content addressing deduplicates without being asked');
  assert.equal(Object.keys(personal.assets).length, 2);
  const references = [...personal.state.svgMarkup.matchAll(/asset:([0-9a-f]+)/g)].map((match) => match[1]);
  assert.equal(references.length, 3, 'three nodes');
  assert.equal(new Set(references).size, 2, 'two pictures');

  each((mascot, where) => {
    for (const [id, record] of Object.entries(mascot.assets)) {
      assert.equal(record.id, id, `${where} an asset's id is its key`);
      assert.match(id, /^[0-9a-f]{16}$/, `${where} and its id is the hash of its bytes`);
      assert.equal(parseAssetRef(`asset:${id}`), id);
    }
    assert.deepEqual(unusedAssets(mascot.state), [], `${where} nothing is stored that nothing points at`);
    assert.deepEqual(missingAssets(mascot.state), [], `${where} and nothing points at what is not stored`);
  });
});

// ---------------------------------------------------------------------------
// The file that survives being emailed
// ---------------------------------------------------------------------------

test('matrix · every reference mascot survives a .boop round trip', async () => {
  for (const mascot of MASCOTS) {
    const where = `[${mascot.name}]`;
    const { bytes, missing } = await writeBoopPackage({ snapshot: snapshotOf(mascot), bytesFor: bytesOf(mascot) });
    assert.deepEqual(missing, [], `${where} nothing was left out`);
    const read = await readBoopPackage(bytes);
    assert.deepEqual(read.missing, [], `${where} nothing is missing on the way back`);
    assert.deepEqual(read.damaged, [], `${where} and nothing arrived corrupt`);
    assert.equal(read.snapshot.document.svgMarkup, mascot.state.svgMarkup, `${where} the artwork came back`);
    assert.deepEqual(Object.keys(read.assets ? Object.fromEntries(read.assets) : {}).sort(), Object.keys(mascot.assets).sort(), `${where} and so did every picture`);
    for (const [id, payload] of read.assets) {
      assert.deepEqual(await asBytes(payload), await asBytes(await mascot.store.get(id)), `${where} ${id} byte for byte`);
    }

    const reopened = createCleanProjectState();
    applyProjectSnapshot(reopened, read.snapshot);
    assert.deepEqual(reopened.elements, mascot.state.elements, `${where} and the rig with it`);
  }
});

test('matrix · a damaged package is refused, never half-opened', async () => {
  const { bytes } = await writeBoopPackage({ snapshot: snapshotOf(byName.raster), bytesFor: bytesOf(byName.raster) });
  await assert.rejects(() => readBoopPackage(bytes.slice(0, Math.floor(bytes.length / 2))), /.+/, 'half a package is not a project');
  await assert.rejects(() => readBoopPackage(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0])), /.+/);
  assert.throws(() => prepareProjectSnapshot({ document: { rig: {}, svgMarkup: '' } }, sanitizeSvgMarkup), /no SVG document/);
  assert.throws(() => prepareProjectSnapshot({ version: PROJECT_VERSION + 9, document: { rig: {}, svgMarkup: '<svg/>' } }, sanitizeSvgMarkup), /Unsupported/);
});

// ---------------------------------------------------------------------------
// What leaves the editor
// ---------------------------------------------------------------------------

const exportOf = (mascot) => createExportArtifacts({
  state: mascot.state,
  serializeSvg: () => mascot.state.svgMarkup,
  createRig: createExportRig,
  runtimeSource: '// runtime',
  assetBytes: (id) => mascot.syncBytes?.get(id) || null
});

test('matrix · an exported mascot ships its pictures and points at the files', async () => {
  for (const mascot of MASCOTS) {
    const where = `[${mascot.name}]`;
    // The exporter is synchronous, so the bytes are read out of the store first.
    mascot.syncBytes = new Map();
    for (const id of Object.keys(mascot.assets)) mascot.syncBytes.set(id, await asBytes(await mascot.store.get(id)));
    const artifacts = exportOf(mascot);
    const names = artifacts.map((item) => item.name);
    assert.ok(names.includes('mascot.svg') && names.includes('rig.json') && names.includes('runtime.js'), `${where} the three that always ship`);
    assert.equal(names.length, 3 + Object.keys(mascot.assets).length, `${where} one file per picture and no more`);

    const svg = artifacts.find((item) => item.name === 'mascot.svg').content;
    assert.equal(/asset:/.test(svg), false, `${where} nothing in an exported mascot is an editor reference`);
    for (const name of names.filter((item) => !['mascot.svg', 'rig.json', 'runtime.js'].includes(item))) {
      assert.ok(svg.includes(name), `${where} the artwork points at ${name}`);
    }
    JSON.parse(artifacts.find((item) => item.name === 'rig.json').content);
  }
});

test('matrix · a rig asks by name for anything an older runtime would run wrong', () => {
  each((mascot, where) => {
    const rig = createExportRig(mascot.state);
    assert.deepEqual(rigRequirements(rig), rig.requires, `${where} what it needs and what it says it needs are the same list`);
    assert.equal(rig.graphLayout, undefined, `${where} the runtime runs a state machine without drawing one`);
  });
});

// ---------------------------------------------------------------------------
// Parity: the same mascot, whoever is driving it
// ---------------------------------------------------------------------------

const frameFor = (state, params) => compileRigFrame(state.elements, params, state.globalConstraints, state.stateConstraints?.[state.activeState],
  { keyforms: state.keyforms, shapeKeys: state.shapeKeys, warps: state.warps, meshes: state.meshes, rigPins: state.rigPins, parallax: state.parallax });

test('matrix · the editor and the exported rig compile the same frame', () => {
  each((mascot, where) => {
    const rig = createExportRig(mascot.state);
    for (const pose of ['idle', 'talking']) {
      const values = resolveStateParams(mascot.state.params, mascot.state.states[pose]);
      const here = frameFor(mascot.state, { ...mascot.state.params, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { ...mascot.state.params[key], value }])) });
      const there = compileRigFrame(rig.elements, { ...rig.params, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { ...rig.params[key], value }])) },
        rig.globalConstraints, rig.stateConstraints?.[rig.activeState], { keyforms: rig.keyforms, shapeKeys: rig.shapeKeys, warps: rig.warps, meshes: rig.meshes, rigPins: rig.rigPins, parallax: rig.parallax });
      for (const id of Object.keys(mascot.state.elements)) {
        assert.deepEqual(there[id]?.transform, here[id]?.transform, `${where} ${id} in ${pose}`);
      }
    }
  });
});

test('matrix · a rig made of pictures moves exactly as the same rig made of paths', () => {
  // The exit Phase 2 was written for: the artwork is not the mascot.
  const values = resolveStateParams(byName.historic.state.params, byName.historic.state.states.talking);
  const withValues = (state) => ({ ...state.params, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { ...state.params[key], value }])) });
  const paths = frameFor(byName.historic.state, withValues(byName.historic.state));
  const pictures = frameFor(byName.raster.state, withValues(byName.raster.state));
  for (const id of ['head', 'eyeLeft', 'eyeRight', 'mouth']) {
    assert.deepEqual(pictures[id].transform, paths[id].transform, `${id} moves the same either way`);
  }
});

// ---------------------------------------------------------------------------
// Bending, masking, and the things that only a picture does
// ---------------------------------------------------------------------------

test('matrix · a mesh is driven by its parameter, and a mask is an alpha mask', () => {
  const bent = byName.bent;
  const [mesh] = normalizeMeshes(bent.state);
  assert.equal(mesh.driver.parameter, 'mouthOpen');
  const shut = meshPointsAt(mesh, { mouthOpen: 0 }), open = meshPointsAt(mesh, { mouthOpen: 1 });
  assert.deepEqual(shut, mesh.points, 'at rest it is the shape that was drawn');
  assert.ok(open[7].y > shut[7].y, 'and it opens as the parameter goes up');
  // Past the edge of the drawing on purpose: pulling a mouth open is pulling
  // past the edge, so nothing clamps at 0 and 1.
  assert.ok(open[7].y > 1);

  // A clip-path would cut to the picture's rectangle; only a mask reads alpha.
  assert.match(bent.state.svgMarkup, /<mask id="mouth-cut" mask-type="alpha">/);
  assert.equal(/clip-path=/.test(bent.state.svgMarkup), false);
});

// ---------------------------------------------------------------------------
// The sanitizer, which has to let exactly one new thing through
// ---------------------------------------------------------------------------

test('matrix · the sanitizer keeps asset references and still refuses everything else', () => {
  each((mascot, where) => {
    const clean = sanitizeSvgMarkup(mascot.state.svgMarkup);
    for (const id of Object.keys(mascot.assets)) assert.ok(clean.includes(`asset:${id}`), `${where} ${id} survived`);
    // The same rules, listed rather than applied: a reference the cleaner keeps
    // must not be a reference the validator reports.
    assert.deepEqual(findUnsafeSvg(mascot.state.svgMarkup), [], `${where} and was not reported as a problem`);
  });
  const hostile = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test/x.png"/><image href="javascript:alert(1)"/><script>x()</script></svg>');
  assert.equal(/example\.test/.test(hostile), false, 'a mascot never fetches from somebody else’s server');
  assert.equal(/javascript:/.test(hostile), false);
  assert.equal(/<script/i.test(hostile), false);
});

// ---------------------------------------------------------------------------
// Replacing a picture, which is the one edit that changes an id
// ---------------------------------------------------------------------------

test('matrix · replacing a picture gives it a new id, and no undoable action deletes bytes', async () => {
  const mascot = byName.raster;
  const manager = createAssetManager({ store: mascot.store });
  const before = Object.keys(mascot.assets);
  const replaced = await manager.import(fixtureBytes('lossless-9x5.webp'), { name: 'mouth-v2.webp', type: 'image/webp' });
  assert.equal(replaced.ok, true);
  assert.equal(before.includes(replaced.asset.id), false, 'different bytes, different id');
  // The old picture is still in the store after the swap: undo restores the
  // document, and nothing restores a deleted file.
  for (const id of before) assert.ok(await mascot.store.get(id), `${id} is still there`);
});

// ---------------------------------------------------------------------------
// One ceiling, for a change of kind
// ---------------------------------------------------------------------------

test('matrix · a frame is compiled in the time a frame has', () => {
  const state = byName.hybrid.state;
  const params = { ...state.params, headX: { ...state.params.headX, value: .5 } };
  const started = performance.now();
  for (let pass = 0; pass < 500; pass += 1) frameFor(state, params);
  const each = (performance.now() - started) / 500;
  // A tenth of a 60 Hz frame, per compile, with an order of magnitude to spare.
  // This is here to catch a change in kind, not a change of twenty per cent.
  assert.ok(each < 1.6, `a frame took ${each.toFixed(3)} ms to compile`);
});
