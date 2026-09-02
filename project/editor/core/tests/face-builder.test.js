import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFaceProjectTemplate, buildFaceSvg } from '../assets/face-builder.js';
import { createCleanProjectState } from '../state/store.js';
import { applyTemplateProject } from '../sample/templates/template-project.js';
import { validateRig } from '../validation/rig-validator.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

test('face builder generates svg with expected ids', () => {
  const svg = buildFaceSvg({ head: 'square', eyes: 'dot', mouth: 'flat' });
  assert.ok(svg.includes('id="head"'));
  assert.ok(svg.includes('id="eyeLeft"'));
  assert.ok(svg.includes('id="eyeRight"'));
  assert.ok(svg.includes('id="pupilLeft"'));
  assert.ok(svg.includes('id="pupilRight"'));
  assert.ok(svg.includes('id="browLeft"'));
  assert.ok(svg.includes('id="mouth"'));
  assert.doesNotMatch(svg,/<rect[^>]+fill="(?:#000(?:000)?|black)"/i);
});

test('every exposed face builder combination has an exact, valid semantic project', () => {
  for (const head of ['circle','square']) for (const eyes of ['oval','dot']) for (const mouth of ['smile','flat','sad']) {
    const template=buildFaceProjectTemplate({head,eyes,mouth}),state=createCleanProjectState();
    state.svgMarkup=template.svg;
    state.elements=Object.fromEntries(['head','eyeLeft','eyeRight','pupilLeft','pupilRight','browLeft','browRight','mouth'].map((id)=>[id,{baseTransform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:0,pivotY:0},bindings:{},constraints:{},meta:{nodeType:id==='mouth'||id.startsWith('brow')?'path':eyes==='oval'&&id.startsWith('eye')?'ellipse':'circle'}}]));
    applyTemplateProject(state,template.kind);
    assert.deepEqual(validateRig(state),[],`${head}/${eyes}/${mouth}`);
    assert.deepEqual(Object.values(state.semanticParts).flatMap((part)=>Object.values(part.roles)).sort(),['browLeft','browRight','eyeLeft','eyeRight','head','mouth','pupilLeft','pupilRight']);
  }
});

test('generated face gaze bindings move both pupils in opposite directions', () => {
  const template=buildFaceProjectTemplate({head:'square',eyes:'dot',mouth:'sad'}),state=createCleanProjectState();
  state.svgMarkup=template.svg;
  state.elements=Object.fromEntries(['head','eyeLeft','eyeRight','pupilLeft','pupilRight','browLeft','browRight','mouth'].map(id=>[id,{baseTransform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:0,pivotY:0},bindings:{},constraints:{},meta:{nodeType:'circle'}}]));
  applyTemplateProject(state,template.kind);
  const right=compileRigFrame(state.elements,{lookX:.8}),left=compileRigFrame(state.elements,{lookX:-.8});
  for(const id of ['pupilLeft','pupilRight']){
    assert.notEqual(right[id].transform.x,0);
    assert.equal(Math.sign(right[id].transform.x),-Math.sign(left[id].transform.x));
  }
});
