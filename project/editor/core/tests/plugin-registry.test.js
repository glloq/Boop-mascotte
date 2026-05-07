import test from 'node:test';
import assert from 'node:assert/strict';
import { createPluginRegistry } from '../plugins/plugin-registry.js';

test('plugin registry toggles plugin activation', () => {
  const reg = createPluginRegistry();
  reg.register({ type: 'default', createRigData: () => ({ kind: 'default' }) });
  reg.register({ type: 'path', createRigData: () => ({ kind: 'path' }) });

  const node = { type: 'path' };
  assert.equal(reg.getByNode(node).type, 'path');
  reg.setEnabled('path', false);
  assert.equal(reg.getByNode(node).type, 'default');
});
