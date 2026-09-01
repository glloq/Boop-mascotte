import test from 'node:test';
import assert from 'node:assert/strict';
import { commitProjectReplacement } from '../state/project-replacement.js';

test('replacement cancellation has zero side effects', async () => {
  const calls = [];
  const result = await commitProjectReplacement({
    hasUnsavedChanges: () => true, confirmReplacement: () => false,
    stop: () => calls.push('stop'), resetContext: () => calls.push('reset'),
    commit: () => calls.push('commit'), clearHistory: () => calls.push('history'), establishBaseline: () => calls.push('baseline')
  });
  assert.equal(result, false);
  assert.deepEqual(calls, []);
});

test('replacement lifecycle commits in one deterministic order', async () => {
  const calls = [];
  const result = await commitProjectReplacement({
    hasUnsavedChanges: () => false, confirmReplacement: () => false,
    stop: () => calls.push('stop'), resetContext: () => calls.push('reset'),
    commit: async () => calls.push('commit'), clearHistory: () => calls.push('history'), establishBaseline: () => calls.push('baseline')
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ['stop', 'reset', 'commit', 'history', 'baseline']);
});
