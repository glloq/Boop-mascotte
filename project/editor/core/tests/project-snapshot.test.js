import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProjectSnapshot, createProjectSnapshot, prepareProjectSnapshot } from '../state/project-snapshot.js';
import { canOpenProjectVersion, PROJECT_VERSION, projectVersionFor, projectVersionOf } from '../state/project-version.js';
import { RIG_SCHEMA_VERSION } from '../../../runtime/runtime.js';

function baseState() {
  return {
    svgMarkup: '<svg><g id="artwork"/></svg>',
    params: { headX: 0, headY: 0, eyeOpen: 1, mouthOpen: 0 },
    states: { idle: {}, happy: {}, sad: {} },
    elements: { stale: { id: 'stale', transform: { x: 0 } } },
    activeState: 'idle',
    transitions: { idle: ['happy'] },
    globalConstraints: { translate: 1, rotate: 1, scale: 1 },
    stateConstraints: { idle: { translate: 1, rotate: 1, scale: 1 } },
    runtimeConfig: { blink: true, idleMotion: 0.15 }
  };
}

test('project snapshot round-trip keeps rig and svg data', () => {
  const source = baseState();
  source.svgMarkup = '<svg><g id="head"/></svg>';
  source.params.headX = 0.6;
  source.activeState = 'happy';
  source.runtimeConfig.idleMotion = 0.2;
  source.elements = { head: { id: 'head', transform: { x: 12 } } };

  const snapshot = createProjectSnapshot(source);
  const target = baseState();
  applyProjectSnapshot(target, snapshot);

  assert.equal(target.svgMarkup, '<svg><g id="head"/></svg>');
  assert.equal(target.params.headX.value, 0.6);
  assert.equal(target.activeState, 'happy');
  assert.equal(target.runtimeConfig.idleMotion, 0.2);
  assert.equal(target.elements.head.baseTransform.x, 12);
});

test('saved snapshots prepare successfully and blank projects cannot be saved', () => {
  const snapshot=createProjectSnapshot(baseState());
  assert.equal(prepareProjectSnapshot(snapshot,value=>value).document.svgMarkup,baseState().svgMarkup);
  assert.throws(()=>createProjectSnapshot({...baseState(),svgMarkup:''}),/valid SVG document/);
});

test('project serialization round-trip preserves authored semantic ownership and canonical constraints', () => {
  const source=baseState();
  source.semanticParts={head:{id:'head',type:'head',roles:{head:'head'},controls:['headX']}};
  source.elements={head:{id:'head',bindings:{translateX:{enabled:true,mode:'simple',expression:'headX',curve:'linear',amplitude:8,offset:0,generatedBy:{semanticPart:'head',control:'headX'}}}}};
  source.stateConstraints={idle:{translate:.75}};
  source.layers=[{id:'head'}];source.layerMetadata={head:{name:'Authored Head'}};
  source.animationClips=[{id:'move',duration:1,tracks:{headX:[{time:0,value:0},{time:1,value:1}]}}];
  const snapshot=createProjectSnapshot(source),target=baseState();applyProjectSnapshot(target,snapshot);
  assert.deepEqual(snapshot.document.rig.elements.head.bindings.translateX.generatedBy,{semanticPart:'head',control:'headX'});
  assert.deepEqual(target.elements.head.bindings.translateX.generatedBy,{semanticPart:'head',control:'headX'});
  assert.deepEqual(target.stateConstraints.idle,{translate:.75,rotate:1,scale:1});
  assert.deepEqual(target.semanticParts,source.semanticParts);assert.deepEqual(target.animationClips,source.animationClips);
  assert.deepEqual(target.layerMetadata,source.layerMetadata);
});

for (const version of [1, 2, 3]) test(`snapshot v${version} migrates to the current project contract`,()=>{const source=baseState(),current=createProjectSnapshot(source),fixture={version,document:{...current.document}};if(version<3)delete fixture.document.editor;const target=baseState();applyProjectSnapshot(target,fixture);const saved=createProjectSnapshot(target);assert.equal(saved.version,3);assert.equal(saved.document.rig.schemaVersion,RIG_SCHEMA_VERSION);assert.deepEqual(saved.document.editor.semanticParts,{});assert.deepEqual(saved.document.editor.animationClips,[]);});

test('snapshot restore preserves a valid active clip and falls back deterministically',()=>{
  const source=baseState();source.animationClips=[{id:'gaze',duration:1,tracks:{headX:[{time:0,value:-1},{time:1,value:1}]}}];source.animationEditor={activeClipId:'gaze',playhead:.25,panel:'preview'};
  const snapshot=createProjectSnapshot(source),target=baseState();applyProjectSnapshot(target,snapshot);assert.equal(target.animationEditor.activeClipId,'gaze');assert.equal(target.animationEditor.playhead,.25);
  snapshot.document.editor.animationEditor.activeClipId='missing';snapshot.document.editor.animationEditor.playhead=4;applyProjectSnapshot(target,snapshot);assert.equal(target.animationEditor.activeClipId,'gaze');assert.equal(target.animationEditor.playhead,1);
});

test('the project file version is its own axis, and one predicate gates every way in',()=>{
  const current=createProjectSnapshot(baseState());
  // Two versions, two reasons to move: the file's, and the rig's inside it.
  // Neither is stamped from the other.
  // The file declares the oldest reader that can read it, not the newest
  // editor that wrote it: this project uses nothing past version 3.
  assert.equal(current.version,3);
  assert.equal(current.version,projectVersionFor(current.document));
  assert.equal(current.document.rig.schemaVersion,RIG_SCHEMA_VERSION);
  // A file that declares none is the first format, which never wrote one.
  for(const absent of [undefined,null]){
    const fixture={...structuredClone(current),version:absent};
    assert.equal(projectVersionOf(fixture),1);
    const target=baseState();applyProjectSnapshot(target,fixture);
    assert.equal(createProjectSnapshot(target).version,3);
  }
});

test('an asset in the project raises the version the file declares',()=>{
  const source=baseState();
  source.assets={ '7f3c9a1b': { id:'7f3c9a1b', format:'image/webp', width:512, height:512, alpha:true, name:'head' } };
  const snapshot=createProjectSnapshot(source);
  assert.equal(snapshot.version,4);
  assert.deepEqual(Object.keys(snapshot.document.assets),['7f3c9a1b']);
  // And it survives the way round the round trip that matters.
  const target=baseState();applyProjectSnapshot(target,snapshot);
  assert.equal(target.assets['7f3c9a1b'].name,'head');
  assert.equal(createProjectSnapshot(target).version,4);
  // An entry that is not an asset never reaches a document.
  const broken=createProjectSnapshot({ ...baseState(), assets: { nope: { id: 'nope', format: 'image/gif' } } });
  assert.deepEqual(broken.document.assets,{});
  assert.equal(broken.version,3);
});

test('a file a newer editor wrote is declined, and declined the same way at every door',()=>{
  const current=createProjectSnapshot(baseState());
  for(const version of [PROJECT_VERSION+1,0,-1,2.5,'3']){
    assert.equal(canOpenProjectVersion(version),false,`v${version} opens`);
    const fixture={...structuredClone(current),version};
    assert.throws(()=>applyProjectSnapshot(baseState(),fixture),/Unsupported project snapshot version/,`apply v${version}`);
    assert.throws(()=>prepareProjectSnapshot(fixture,value=>value),/Unsupported project snapshot version/,`prepare v${version}`);
  }
  // Every version this editor wrote, it can still open.
  for(let version=1;version<=PROJECT_VERSION;version++) assert.ok(canOpenProjectVersion(version),`v${version} declined`);
});

test('the file boundary migrates once, and says what it did',()=>{
  const current=createProjectSnapshot(baseState());
  // Already current: nothing to report.
  assert.equal(prepareProjectSnapshot(current,value=>value).migratedFrom,undefined);
  // An older file arrives at the current version, and carries the record of
  // how it got there -- session information, never written back to a file.
  const old={...structuredClone(current),version:1};
  const prepared=prepareProjectSnapshot(old,value=>value);
  assert.equal(prepared.version,3);
  assert.equal(prepared.migratedFrom.version,1);
  assert.deepEqual(prepared.migratedFrom.applied,[]);
  assert.equal(old.version,1);
  const target=baseState();applyProjectSnapshot(target,prepared);
  assert.equal(createProjectSnapshot(target).migratedFrom,undefined);
});
