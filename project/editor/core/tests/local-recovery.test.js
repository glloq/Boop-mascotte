import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTOSAVE_KEY, discardLocalRecovery, readLocalRecovery, writeLocalRecovery } from '../state/local-recovery.js';

const snapshot = { version: 3, document: { svgMarkup: '<svg><circle/></svg>', rig: {} } };
const prepare = value => { if (![1,2,3].includes(value?.version) || !value?.document?.rig) throw new Error('invalid'); return structuredClone(value); };
const storage = initial => { let value=initial; return { getItem:()=>value, setItem:(_,next)=>{value=next;}, removeItem:()=>{value=null;}, value:()=>value }; };

test('local recovery normalizes absent, wrapped, and legacy records',()=>{
  assert.equal(readLocalRecovery(storage(null),prepare).status,'none');
  const wrapped=readLocalRecovery(storage(JSON.stringify({savedAt:'2025-01-02T03:04:05Z',projectSnapshot:snapshot})),prepare);
  assert.equal(wrapped.status,'available');assert.equal(wrapped.savedAt,'2025-01-02T03:04:05.000Z');
  assert.equal(readLocalRecovery(storage(JSON.stringify(snapshot)),prepare).status,'available');
});
test('timestamps are optional and invalid timestamps normalize to null',()=>{
  for(const savedAt of [undefined,'not-a-date']) assert.equal(readLocalRecovery(storage(JSON.stringify({savedAt,projectSnapshot:snapshot})),prepare).savedAt,null);
});
test('corrupt JSON, invalid shape, and unsupported versions stay invalid',()=>{
  for(const raw of ['{',JSON.stringify({hello:'world'}),JSON.stringify({...snapshot,version:99})]) assert.equal(readLocalRecovery(storage(raw),prepare).status,'invalid');
});
test('read exceptions are deterministic and explicit discard handles failures',()=>{
  assert.deepEqual(readLocalRecovery({getItem(){throw Error('blocked');}},prepare),{status:'invalid',savedAt:null,snapshot:null,reason:'storage-unavailable'});
  assert.equal(discardLocalRecovery({removeItem(){throw Error('blocked');}}),false);
});
test('write preserves the compatible wrapped format and discard removes it',()=>{
  const target=storage(null);writeLocalRecovery(target,snapshot,'2025-01-01T00:00:00.000Z');
  assert.equal(JSON.parse(target.value()).projectSnapshot.version,3);assert.equal(discardLocalRecovery(target),true);assert.equal(target.value(),null);assert.equal(AUTOSAVE_KEY,'boop-mascotte-autosave-v1');
});
