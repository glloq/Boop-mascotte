import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportArtifacts, createExportUiModel } from '../export/export-policy.js';
import { createCleanProjectState } from '../state/store.js';

test('blank project export UI is safe and unavailable', () => {
  const model = createExportUiModel(createCleanProjectState());
  assert.equal(model.available, false);
  assert.match(model.message, /Create or open a project/);
  assert.ok(model.artifacts.every((artifact) => artifact.enabled === false));
});

test('blank project artifact creation remains strict', () => {
  assert.throws(() => createExportArtifacts({
    state: createCleanProjectState(), serializeSvg: () => '', createRig: () => ({}), runtimeSource: ''
  }), /Cannot export a project without a valid SVG document/);
});

test('valid project artifact creation produces all standalone files', () => {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="face" r="10"/></svg>';
  const artifacts = createExportArtifacts({
    state,
    serializeSvg: () => state.svgMarkup,
    createRig: () => ({ schemaVersion: 3 }),
    runtimeSource: 'export const runtime = true;'
  });
  assert.deepEqual(artifacts.map(({ name }) => name), ['mascot.svg', 'rig.json', 'runtime.js']);
  assert.equal(JSON.parse(artifacts[1].content).schemaVersion, 3);
});

test('valid project export UI advertises three enabled artifacts', () => {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="face" r="10"/></svg>';
  const model = createExportUiModel(state);
  assert.equal(model.available, true);
  assert.deepEqual(model.artifacts.map(({ name, enabled }) => ({ name, enabled })), [
    { name: 'mascot.svg', enabled: true },
    { name: 'rig.json', enabled: true },
    { name: 'runtime.js', enabled: true }
  ]);
});
