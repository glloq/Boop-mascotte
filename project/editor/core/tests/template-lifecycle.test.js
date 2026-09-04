import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { inspectProjectDocument } from '../state/serializability.js';
import { loadProjectTemplate } from '../sample/template-loader.js';
import { PROJECT_TEMPLATES } from '../sample/templates/index.js';

const ids=['faceRoot','head','earLeft','earRight','shadeLeft','shadeRight','mouth','eyeLeft','eyeRight','pupilLeft','pupilRight','lidUpperLeft','lidUpperRight','lidLowerLeft','lidLowerRight','browLeft','browRight','nose','hair'];
const element=id=>({baseTransform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:0,pivotY:0},bindings:{},constraints:{},meta:{nodeType:id.includes('mouth')||id.includes('Lid')?'path':'g'}});
const canvas={loadSvgFromText:async(svg,metadata,options)=>{assert.equal(options.updateStore,false);return {svgMarkup:svg,elements:Object.fromEntries(ids.map(id=>[id,element(id)])),layers:[{id:'faceRoot',children:ids.filter(id=>id!=='faceRoot').map(id=>({id,children:[]}))}],layerMetadata:{},svgWarnings:[]};}};
const preview={resetCount:0,reset(){this.resetCount++;},setClip(id){this.clip=id;},seek(value){this.time=value;}};

for(const kind of Object.keys(PROJECT_TEMPLATES))test(`${kind} uses one V2 project replacement with plain authored data`,async()=>{
  const store=createEditorStore(),before=store.getDomainRevisions();
  const result=await loadProjectTemplate(PROJECT_TEMPLATES[kind],{store,canvas,preview,history:{},validate:()=>[]});
  assert.match(result.document.svgMarkup,/<svg\b/);assert.ok(Object.keys(result.document.elements).length);assert.ok(Object.keys(result.document.semanticParts).length);
  assert.deepEqual(inspectProjectDocument(result.document),[]);assert.equal(store.getPersistentRevision(),1);
  for(const domain of Object.keys(before))assert.equal(store.getDomainRevision(domain),before[domain]+1);
  assert.equal(store.getSession().selectedId,null);assert.equal(preview.time,0);
});

test('serializability invariant identifies a concrete non-plain nested path',()=>{
  class RuntimeWrapper {}
  const store=createEditorStore({elements:{head:{plugin:new RuntimeWrapper()}}});
  assert.deepEqual(inspectProjectDocument(store.getDocument()).map(issue=>issue.path),['elements.head.plugin']);
});
