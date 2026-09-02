import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_ORDER, createCommandRegistry } from '../../ui/command-registry.js';

const registry = () => {
  const reg = createCommandRegistry(), calls = [];
  reg.register({ id: 'go:preview', title: 'Go to Preview', group: 'Go to', keywords: ['test', 'play'], shortcut: null, run: () => calls.push('preview') });
  reg.register({ id: 'action:export', title: 'Export files', group: 'Actions', keywords: ['download', 'rig.json'], enabled: (context) => (context.blocked ? { ok: false, reason: 'Export is blocked: fix the problems first.' } : { ok: true }), run: () => calls.push('export') });
  reg.register({ id: 'action:undo', title: 'Undo', group: 'Actions', shortcut: 'Ctrl+Z', enabled: (context) => (context.canUndo ? { ok: true } : { ok: false, reason: 'Nothing to undo.' }), run: () => calls.push('undo') });
  reg.registerIndex((context) => (context.expressions || []).map((item) => ({ id: `expression:${item.id}`, title: item.name, group: 'Expressions', subtitle: 'Expression', keywords: ['expression', 'face'], run: () => calls.push(`expression:${item.id}`) })));
  return { reg, calls };
};

test('registry validates commands, indexes entities per context and ranks search results', () => {
  const { reg } = registry();
  assert.throws(() => reg.register({ id: 'x' }), /needs an id, a title and a run/);
  assert.throws(() => reg.register({ id: 'action:undo', title: 'Undo', run() {} }), /already registered/);
  assert.throws(() => reg.registerIndex('nope'), /build function/);
  const context = { expressions: [{ id: 'happy', name: 'Happy' }, { id: 'sad', name: 'Sad' }], canUndo: false };
  assert.deepEqual(reg.search('', context).map((item) => item.id), ['go:preview', 'action:export', 'action:undo', 'expression:happy', 'expression:sad'], 'empty query lists everything in group order');
  assert.deepEqual(reg.search('hap', context).map((item) => item.id), ['expression:happy']);
  assert.deepEqual(reg.search('ex', context).map((item) => item.id), ['action:export', 'expression:happy', 'expression:sad'], 'title prefix beats keyword matches');
  assert.deepEqual(reg.search('face', context).map((item) => item.id), ['expression:happy', 'expression:sad']);
  assert.deepEqual(reg.search('rig.json', context).map((item) => item.id), ['action:export']);
  assert.deepEqual(reg.search('HÁPPY', context).map((item) => item.id), ['expression:happy'], 'accents and case are ignored');
  assert.deepEqual(reg.search('zzz', context), []);
  assert.deepEqual(reg.search('', { expressions: [] }).map((item) => item.id), ['go:preview', 'action:export', 'action:undo'], 'indexes follow the context');
  assert.ok(GROUP_ORDER.includes('Advanced'));
});

test('scope rules surface disabled reasons and block execution', () => {
  const { reg, calls } = registry();
  const blocked = reg.search('export', { blocked: true })[0];
  assert.deepEqual([blocked.enabled, blocked.reason], [false, 'Export is blocked: fix the problems first.']);
  assert.deepEqual(reg.run('action:export', { blocked: true }), { ok: false, reason: 'Export is blocked: fix the problems first.' });
  assert.deepEqual(reg.run('action:undo', { canUndo: false }), { ok: false, reason: 'Nothing to undo.' });
  assert.deepEqual(calls, [], 'disabled commands never run');
  assert.deepEqual(reg.run('action:export', { blocked: false }), { ok: true });
  assert.deepEqual(reg.run('expression:happy', { expressions: [{ id: 'happy', name: 'Happy' }] }), { ok: true });
  assert.deepEqual(reg.run('expression:happy', { expressions: [] }), { ok: false, reason: 'Unknown command "expression:happy".' });
  assert.deepEqual(calls, ['export', 'expression:happy']);
  const undo = reg.search('undo', { canUndo: true })[0];
  assert.deepEqual([undo.enabled, undo.shortcut], [true, 'Ctrl+Z']);
});
