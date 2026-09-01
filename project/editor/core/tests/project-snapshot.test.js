import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProjectSnapshot, createProjectSnapshot, prepareProjectSnapshot } from '../state/project-snapshot.js';

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

for (const version of [1, 2, 3]) test(`snapshot v${version} migrates to the current project contract`,()=>{const source=baseState(),current=createProjectSnapshot(source),fixture={version,document:{...current.document}};if(version<3)delete fixture.document.editor;const target=baseState();applyProjectSnapshot(target,fixture);const saved=createProjectSnapshot(target);assert.equal(saved.version,3);assert.equal(saved.document.rig.schemaVersion,3);assert.deepEqual(saved.document.editor.semanticParts,{});assert.deepEqual(saved.document.editor.animationClips,[]);});
