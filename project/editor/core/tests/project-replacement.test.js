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

test('Save Project completes before a requested replacement',async()=>{
  const calls=[];const result=await commitProjectReplacement({hasUnsavedChanges:()=>true,confirmReplacement:async()=>{calls.push('dialog');return 'save';},saveProject:async()=>calls.push('save'),stop:()=>calls.push('stop'),resetContext:()=>calls.push('reset'),commit:()=>calls.push('commit'),clearHistory:()=>calls.push('history'),establishBaseline:()=>calls.push('baseline')});
  assert.equal(result,true);assert.deepEqual(calls,['dialog','save','stop','reset','commit','history','baseline']);
});

test('commit failure rolls back without establishing a new baseline', async () => {
  const project={name:'old',dirty:true},calls=[];
  await assert.rejects(commitProjectReplacement({hasUnsavedChanges:()=>false,confirmReplacement:()=>true,
    captureRollback:()=>structuredClone(project),stop:()=>calls.push('stop'),resetContext:()=>calls.push('reset'),
    commit:()=>{project.name='partial';throw new Error('Injected failure');},rollback:(old)=>{Object.assign(project,old);calls.push('rollback');},
    clearHistory:()=>calls.push('history'),establishBaseline:()=>calls.push('baseline')}),/Injected failure/);
  assert.deepEqual(project,{name:'old',dirty:true});assert.deepEqual(calls,['stop','reset','rollback']);
});

test('rollback failure is surfaced with the commit failure', async () => {
  await assert.rejects(commitProjectReplacement({hasUnsavedChanges:()=>false,confirmReplacement:()=>true,stop:()=>{},resetContext:()=>{},
    commit:()=>{throw new Error('commit failed');},rollback:()=>{throw new Error('rollback failed');},clearHistory:()=>{},establishBaseline:()=>{}}),
  error=>error instanceof AggregateError&&error.errors.some(item=>/commit failed/.test(item.message))&&error.errors.some(item=>/rollback failed/.test(item.message)));
});
