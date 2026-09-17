import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateProject, PROJECT_MIGRATIONS, projectMigrationLadderGaps, runProjectMigrations } from '../state/migrations/project-migrations.js';
import { PROJECT_VERSION } from '../state/project-version.js';

const file = (version) => ({ version, document: { svgMarkup: '<svg><g id="head"/></svg>', rig: { params: {} } } });

test('the ladder is complete: one step per rung, from the first format to the current one',()=>{
  assert.deepEqual(projectMigrationLadderGaps(),[]);
  assert.equal(PROJECT_MIGRATIONS.length,PROJECT_VERSION-1);
});

test('a broken ladder is named, not tolerated',()=>{
  const step=(from,name)=>({from,name,apply:(s)=>s});
  // A rung nobody wrote a step for is the failure this guard exists for: it
  // would otherwise load silently and half-right.
  assert.deepEqual(projectMigrationLadderGaps([step(1,'a')],3),['no step for version 2 to 3']);
  assert.deepEqual(projectMigrationLadderGaps([step(1,'a'),step(1,'b'),step(2,'c')],3),['two steps for version 1 to 2: a and b']);
  assert.deepEqual(projectMigrationLadderGaps([step(1,'a'),step(2,'b'),step(3,'c')],3),['step outside the ladder: c (version 3 to 4, current is 3)']);
  assert.deepEqual(projectMigrationLadderGaps([{from:1,name:'a'},step(2,'b')],3),['not a step: "a"','no step for version 1 to 2']);
});

test('a current file is returned untouched, and an older one is carried to the current version',()=>{
  const current=file(PROJECT_VERSION),result=migrateProject(current);
  // Nothing due: the same object back, not a copy of it.
  assert.equal(result.snapshot,current);
  assert.deepEqual(result.applied,[]);
  assert.equal(result.to,PROJECT_VERSION);

  const old=file(1),migrated=migrateProject(old);
  assert.equal(migrated.from,1);
  assert.equal(migrated.to,PROJECT_VERSION);
  assert.equal(migrated.snapshot.version,PROJECT_VERSION);
  assert.equal(migrated.applied.length,PROJECT_VERSION-1);
  // Non-destructive: what the caller handed in is still the file it handed in.
  assert.equal(old.version,1);
  assert.notEqual(migrated.snapshot,old);
});

test('a file that declares no version is the first format, and climbs from there',()=>{
  const { version, ...none }=file(1);
  const result=migrateProject(none);
  assert.equal(result.from,1);
  assert.equal(result.snapshot.version,PROJECT_VERSION);
});

test('a step that throws fails the whole load rather than leaving a file half-migrated',()=>{
  const seen=[];
  const steps=[
    { from:1,name:'first',apply:(s)=>{seen.push('first');s.document.touched=true;return s;} },
    { from:2,name:'second',apply:()=>{throw new Error('cannot read the old shape');} }
  ];
  const old=file(1);
  assert.throws(()=>runProjectMigrations(old,steps,3),/Project migration failed at "second"; the project was not opened\./);
  assert.deepEqual(seen,['first']);
  // The step that did run ran on a copy: the caller's file never changed.
  assert.equal(old.document.touched,undefined);
  assert.equal(old.version,1);
  // And the reason survives, so the failure can be reported as what it was.
  try { runProjectMigrations(old,steps,3); } catch (error) { assert.match(error.cause.message,/cannot read the old shape/); }
});

test('a file a newer editor wrote is declined before any step runs',()=>{
  assert.throws(()=>migrateProject(file(PROJECT_VERSION+1)),/Unsupported project snapshot version/);
});

test('steps run in ladder order however the registry is written',()=>{
  const order=[];
  const steps=[
    { from:2,name:'second',apply:(s)=>{order.push(2);return s;} },
    { from:1,name:'first',apply:(s)=>{order.push(1);return s;} }
  ];
  runProjectMigrations(file(1),steps,3);
  assert.deepEqual(order,[1,2]);
});
