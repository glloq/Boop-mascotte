import test from 'node:test';
import assert from 'node:assert/strict';
import { createE2EHooks, installE2EHooks } from '../../app/e2e-hooks.js';

/**
 * The project-entry seam (V3-07, docs/V3_ROADMAP.md).
 *
 * What is proved here is that the seam calls the project service and nothing
 * else -- no markup, no Home. Whether the service then replaces the project
 * correctly is `project-service.test.js`'s subject, and whether the browser
 * lands where it should is the browser suite's.
 */
const recorder = () => {
  const calls = [];
  const record = (name) => async (...args) => { calls.push([name, ...args]); return true; };
  return { calls, project: { loadTemplate: record('loadTemplate'), generateFace: record('generateFace'), loadSvgFile: record('loadSvgFile'), loadProjectFile: record('loadProjectFile') } };
};

/** Everything else the seam reads at construction time, which is one token. */
const hooksOf = (project) => createE2EHooks({ store: { getDocumentVersionToken: () => 'token' }, project });

test('the project-entry seam is opt-in with the rest of the seam', () => {
  const target = {};
  assert.equal(installE2EHooks({ store: { getDocumentVersionToken: () => 'token' }, project: recorder().project }, { search: '', target }), null);
  assert.equal(target.__BOOP_E2E__, undefined);
  const installed = installE2EHooks({ store: { getDocumentVersionToken: () => 'token' }, project: recorder().project }, { search: '?e2e=1', target });
  assert.deepEqual(Object.keys(installed.openProject).sort(), ['face', 'snapshot', 'svg', 'template']);
  assert.equal(target.__BOOP_E2E__, installed);
});

test('a template opens through the service, with the landing task it was given', async () => {
  const { calls, project } = recorder();
  const hooks = hooksOf(project);
  assert.equal(await hooks.openProject.template('basic'), true);
  assert.equal(await hooks.openProject.template('basic', { mode: 'design.face' }), true);
  assert.deepEqual(calls, [['loadTemplate', 'basic', undefined], ['loadTemplate', 'basic', { mode: 'design.face' }]]);
});

test('a built face opens through the same generator the Face Builder calls', async () => {
  const { calls, project } = recorder();
  assert.equal(await hooksOf(project).openProject.face({ head: 'square', eyes: 'dot', mouth: 'sad' }), true);
  assert.deepEqual(calls, [['generateFace', { head: 'square', eyes: 'dot', mouth: 'sad' }]]);
});

test('imported artwork and a project file arrive as the file the service reads', async () => {
  const { calls, project } = recorder();
  const hooks = hooksOf(project);
  await hooks.openProject.svg('product-head.svg', '<svg/>');
  await hooks.openProject.snapshot('mascot-project.json', '{"version":3}');
  assert.deepEqual(calls.map(([name, file]) => [name, file.name]), [['loadSvgFile', 'product-head.svg'], ['loadProjectFile', 'mascot-project.json']]);
  assert.equal(await calls[0][1].text(), '<svg/>');
  assert.equal(await calls[1][1].text(), '{"version":3}');
});

test('a refused replacement is reported as the service reports it', async () => {
  const hooks = hooksOf({ loadTemplate: async () => false, loadSvgFile: async () => false, generateFace: async () => false, loadProjectFile: async () => false });
  assert.equal(await hooks.openProject.template('basic'), false);
  assert.equal(await hooks.openProject.svg('broken.svg', 'not an svg'), false);
});
