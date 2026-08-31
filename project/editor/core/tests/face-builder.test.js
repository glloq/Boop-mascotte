import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFaceProjectTemplate, buildFaceSvg } from '../assets/face-builder.js';
import { createCleanProjectState } from '../state/store.js';
import { applyTemplateProject } from '../sample/templates/template-project.js';
import { validateRig } from '../validation/rig-validator.js';

test('face builder generates svg with expected ids', () => {
  const svg = buildFaceSvg({ head: 'square', eyes: 'dot', mouth: 'flat' });
  assert.ok(svg.includes('id="head"'));
  assert.ok(svg.includes('id="eyeLeft"'));
  assert.ok(svg.includes('id="mouth"'));
});

test('every exposed face builder combination has an exact, valid semantic project', () => {
  for (const head of ['circle','square']) for (const eyes of ['oval','dot']) for (const mouth of ['smile','flat','sad']) {
    const template=buildFaceProjectTemplate({head,eyes,mouth}),state=createCleanProjectState();
    state.svgMarkup=template.svg;
    state.elements=Object.fromEntries(['head','eyeLeft','eyeRight','mouth'].map((id)=>[id,{baseTransform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:0,pivotY:0},bindings:{},constraints:{},meta:{nodeType:id==='mouth'?'path':eyes==='oval'&&id.startsWith('eye')?'ellipse':'circle'}}]));
    applyTemplateProject(state,template.kind);
    assert.deepEqual(validateRig(state),[],`${head}/${eyes}/${mouth}`);
    assert.deepEqual(Object.values(state.semanticParts).flatMap((part)=>Object.values(part.roles)).sort(),['eyeLeft','eyeRight','head','mouth']);
  }
});
