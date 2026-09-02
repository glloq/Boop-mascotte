import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED_TOOLS, advancedToolRoute, describeAdvancedTools, flattenDiagnostics } from '../../ui/advanced-tools.js';

test('advanced tools declare availability with reasons and route to existing surfaces', () => {
  assert.deepEqual(ADVANCED_TOOLS.map((tool) => tool.id), ['parameters', 'bindings', 'timeline', 'state-machine', 'behaviors', 'diagnostics', 'plugins']);
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
  assert.deepEqual(advancedToolRoute('bindings', project, { selectedId: 'mouth' }), { route: { task: 'artwork', target: { kind: 'artwork-element', id: 'mouth' } } });
  assert.deepEqual(advancedToolRoute('timeline', project), { route: { task: 'animate' }, authorMode: 'animations', timeline: true });
  assert.deepEqual(advancedToolRoute('state-machine', project), { route: { task: 'animate' }, authorMode: 'states' });
  assert.deepEqual(advancedToolRoute('behaviors', project), { route: { task: 'animate' }, authorMode: 'behaviors' });
  assert.deepEqual(advancedToolRoute('parameters', project), { detail: 'parameters' });
  assert.deepEqual(advancedToolRoute('diagnostics', {}), { detail: 'diagnostics' });
  assert.deepEqual(advancedToolRoute('plugins', {}), { menu: 'advanced' });
  assert.equal(advancedToolRoute('nope', project), null);
  assert.deepEqual(flattenDiagnostics({ store: { documentMutations: 3, nested: { deep: 1 } }, preview: { playing: false }, list: [1] }), [['store.documentMutations', 3], ['store.nested.deep', 1], ['preview.playing', false], ['list', [1]]]);
});
