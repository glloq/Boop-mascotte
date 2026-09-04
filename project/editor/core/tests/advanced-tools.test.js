import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED_TOOLS, advancedToolRoute, describeAdvancedTools, describeDeformation, flattenDiagnostics } from '../../ui/advanced-tools.js';

test('advanced tools declare availability with reasons and route to existing surfaces', () => {
  assert.deepEqual(ADVANCED_TOOLS.map((tool) => tool.id), ['parameters', 'bindings', 'timeline', 'state-machine', 'behaviors', 'diagnostics', 'plugins', 'deformation']);
  const blank = describeAdvancedTools({}, {});
  assert.deepEqual(blank.filter((tool) => tool.available).map((tool) => tool.id), ['diagnostics', 'plugins']);
  assert.equal(blank.find((tool) => tool.id === 'timeline').reason, 'Add artwork first.');
  assert.equal(advancedToolRoute('timeline', {}, {}), null, 'unavailable tools have no route');

  const project = { svgMarkup: '<svg/>', elements: { head: {}, mouth: {} }, params: { lookX: { min: -1, max: 1, default: 0 } } };
  const ready = describeAdvancedTools(project, {});
  assert.ok(ready.every((tool) => tool.available));
  const bindings = ready.find((tool) => tool.id === 'bindings');
  assert.deepEqual([bindings.elementId, bindings.reason], ['head', 'Opens the first element; select another on the canvas.']);
  assert.deepEqual(describeAdvancedTools(project, { selectedId: 'mouth' }).find((tool) => tool.id === 'bindings'), { ...bindings, elementId: 'mouth', reason: null });
  // Selecting the element is not the whole job: the bindings editor lives in
  // the Inspector's Advanced disclosure, so the route says which tab to open.
  assert.deepEqual(advancedToolRoute('bindings', project, { selectedId: 'mouth' }), { route: { task: 'artwork', target: { kind: 'artwork-element', id: 'mouth' } }, inspectorTab: 'bindings' });
  assert.deepEqual(advancedToolRoute('timeline', project), { route: { task: 'animate' }, timeline: true });
  assert.deepEqual(advancedToolRoute('state-machine', project), { route: { task: 'animate' }, authorMode: 'states' });
  assert.deepEqual(advancedToolRoute('behaviors', project), { route: { task: 'animate' }, authorMode: 'behaviors' });
  assert.deepEqual(advancedToolRoute('parameters', project), { detail: 'parameters' });
  assert.deepEqual(advancedToolRoute('diagnostics', {}), { detail: 'diagnostics' });
  assert.deepEqual(advancedToolRoute('plugins', {}), { menu: 'advanced' });
  assert.deepEqual(advancedToolRoute('deformation', project), { detail: 'deformation' });
  assert.equal(advancedToolRoute('nope', project), null);
  const phone = describeAdvancedTools(project, {}, 'mobile');
  assert.deepEqual([phone.find((tool) => tool.id === 'timeline').available, phone.find((tool) => tool.id === 'timeline').reason], [false, 'Needs a tablet or desktop.']);
  assert.equal(phone.find((tool) => tool.id === 'parameters').available, true);
  assert.equal(advancedToolRoute('timeline', project, {}, 'mobile'), null);
  assert.deepEqual(flattenDiagnostics({ store: { documentMutations: 3, nested: { deep: 1 } }, preview: { playing: false }, list: [1] }), [['store.documentMutations', 3], ['store.nested.deep', 1], ['preview.playing', false], ['list', [1]]]);
});

test('the deformation listing reports what a project carries and where it can be edited', () => {
  // The runtime plays all five; only two have an editor. Before this listing a
  // user could not tell that an imported rig carried any of them.
  const empty = describeDeformation({});
  assert.deepEqual(empty.map((row) => row.id), ['shapeKeys', 'warps', 'deformers', 'keyforms', 'parallax']);
  assert.deepEqual(empty.map((row) => row.count), [0, 0, 0, 0, 0]);
  assert.deepEqual(empty.filter((row) => row.editor).map((row) => row.id), ['warps', 'keyforms'], 'the rest say so rather than pretending');

  const imported = describeDeformation({ shapeKeys: [{ id: 'smile', name: 'Smile' }, { id: 'open' }], keyforms: [{ targetId: 'head' }], parallax: { strength: .2 }, warps: [], deformers: [] });
  assert.deepEqual(imported.find((row) => row.id === 'shapeKeys'), { id: 'shapeKeys', label: 'Shape keys', count: 2, doc: 'docs/SHAPE_KEYS.md', names: ['Smile', 'open'] });
  assert.equal(imported.find((row) => row.id === 'parallax').count, 1, 'parallax is a block, not a list');
  assert.equal(imported.find((row) => row.id === 'keyforms').count, 1);
});
