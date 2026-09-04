import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

/**
 * VNX-00 — the VNext baseline (docs/VNEXT_ROADMAP.md, docs/VNEXT_BASELINE.md).
 *
 * VNext rebuilds the editing experience on top of an engine that works. The
 * danger of that shape of work is silent loss: a workspace is merged, a panel
 * is replaced by a better one, and a capability that used to be reachable is
 * quietly no longer covered by anything. Prose cannot catch that. This can.
 *
 * Each essential capability names the tests that hold it up, and the gate that
 * runs them. Move a capability to a new workspace and you must move its
 * coverage with it — otherwise the baseline fails and says which capability
 * lost its floor. It is also the seed of the parity matrix (VNX-87).
 */

const repo = (path) => new URL(`../../../../${path}`, import.meta.url);
const exists = async (path) => stat(repo(path)).then(() => true, () => false);
const read = (path) => readFile(repo(path), 'utf8');

/**
 * The fourteen capabilities the VNext journey is made of, in the order a user
 * meets them. `critical` marks an e2e spec that carries at least one
 * `@critical` test, which is what `npm run verify:e2e` actually runs.
 */
export const VNEXT_CAPABILITIES = Object.freeze([
  { id: 'import-svg', label: 'Import an SVG', unit: ['svg-document.test.js'], e2e: [{ file: 'ux04-artwork.spec.js', critical: true }] },
  { id: 'template', label: 'Start from a mascot template', unit: ['templates.test.js', 'template-lifecycle.test.js'], e2e: [{ file: 'ux03-home.spec.js', critical: true }] },
  { id: 'svg-editing', label: 'Edit the artwork', unit: ['path-edit.test.js', 'path-nodes.test.js', 'artboard.test.js'], e2e: [{ file: 'ux25-canvas-editing.spec.js', critical: true }, { file: 'ux30-drawing-tools.spec.js', critical: true }] },
  { id: 'semantic-rig', label: 'Assign the face parts', unit: ['face-setup.test.js', 'face-role-detection.test.js'], e2e: [{ file: 'ux05-face-setup.spec.js', critical: true }, { file: 'ux06-face-detection.spec.js', critical: true }] },
  { id: 'movements', label: 'Configure the movements', unit: ['face-movements.test.js', 'semantic-animation.test.js'], e2e: [{ file: 'ux07-face-movements.spec.js', critical: true }] },
  { id: 'head-2-5d', label: 'Turn the head in 2.5D', unit: ['head-pose.test.js', 'keyforms-2d.test.js'], e2e: [{ file: 'ux24-head-turn.spec.js', critical: true }] },
  { id: 'hands', label: 'Rig and pose the hands', unit: ['hands.test.js', 'hand-feature.test.js'], e2e: [{ file: 'ux32-hands.spec.js', critical: true }] },
  { id: 'expressions', label: 'Author expressions', unit: ['expressions.test.js'], e2e: [{ file: 'ux09-expressions.spec.js', critical: true }] },
  { id: 'motions', label: 'Author motions', unit: ['motions.test.js', 'motion-layering.test.js'], e2e: [{ file: 'ux11-motions.spec.js', critical: true }, { file: 'ux12-motion-studio.spec.js', critical: true }] },
  { id: 'reactions', label: 'Author reactions', unit: ['reactions.test.js'], e2e: [{ file: 'ux13-reactions.spec.js', critical: true }] },
  { id: 'timeline', label: 'Key and edit on a timeline', unit: ['timeline-dope-sheet.test.js', 'preview-timeline.test.js'], e2e: [{ file: 'rig-timeline.spec.js', critical: true }] },
  { id: 'behaviors', label: 'Idle and automatic behaviours', unit: ['behaviors.test.js', 'idle-behaviors.test.js'], e2e: [{ file: 'ux15-automatic.spec.js', critical: true }] },
  { id: 'preview', label: 'Preview what the runtime will do', unit: ['preview-runtime-parity.test.js'], e2e: [{ file: 'ux08-preview-readiness.spec.js', critical: true }] },
  { id: 'export', label: 'Export and load the runtime', unit: ['export-readiness.test.js', 'runtime-api.test.js'], e2e: [{ file: 'ux16-export-readiness.spec.js', critical: true }, { file: 'pages.spec.js', critical: false }] }
]);

test('every essential capability names tests that exist', async () => {
  for (const capability of VNEXT_CAPABILITIES) {
    for (const file of capability.unit) {
      assert.ok(await exists(`project/editor/core/tests/${file}`), `${capability.id} names a unit test that is gone: ${file}`);
    }
    for (const spec of capability.e2e) {
      assert.ok(await exists(`tests/e2e/${spec.file}`), `${capability.id} names an e2e spec that is gone: ${spec.file}`);
    }
  }
});

test('every essential capability has a floor in a gate that actually runs', async () => {
  // `npm test` runs every unit test; `npm run verify:e2e` runs only `@critical`.
  // A capability whose whole e2e coverage is untagged is not gated by the
  // browser suite, so it must be named here deliberately rather than by
  // accident.
  for (const capability of VNEXT_CAPABILITIES) {
    assert.ok(capability.unit.length, `${capability.id} has no unit coverage at all`);
    for (const spec of capability.e2e.filter((item) => item.critical)) {
      const source = await read(`tests/e2e/${spec.file}`);
      assert.match(source, /@critical/, `${spec.file} is declared critical for ${capability.id} but carries no @critical test`);
    }
  }
});

test('the journey is covered end to end, in order', () => {
  // The roadmap's journey, and the reason the list is ordered: a capability
  // missing from the middle of it is a hole a user falls into.
  assert.deepEqual(VNEXT_CAPABILITIES.map((item) => item.id), [
    'import-svg', 'template', 'svg-editing', 'semantic-rig', 'movements', 'head-2-5d', 'hands',
    'expressions', 'motions', 'reactions', 'timeline', 'behaviors', 'preview', 'export'
  ]);
});

test('the gates the baseline is declared against are the ones package.json defines', async () => {
  const scripts = JSON.parse(await read('package.json')).scripts;
  assert.equal(scripts.test, 'node --test project/editor/core/tests/*.test.js');
  assert.equal(scripts.verify, 'npm run check:conflicts && npm test && npm run build');
  assert.equal(scripts['verify:e2e'], 'npm run test:e2e:critical && npm run test:e2e:smoke');
  assert.match(scripts['test:e2e:critical'], /--grep @critical/);
});
