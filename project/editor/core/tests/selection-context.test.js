import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionController, resolveSelectionContext } from '../../ui/selection-context.js';
import { createEditorContext } from '../../ui/editor-context.js';
import { resolveInspectorPresentation } from '../../ui/context-inspector.js';

test('selection context is deterministic for every supported editor selection', () => {
  assert.deepEqual(resolveSelectionContext({},'artwork'),{kind:'none',task:'artwork'});
  assert.deepEqual(resolveSelectionContext({selectedId:'head'},'artwork'),{kind:'artwork',id:'head'});
  assert.deepEqual(resolveSelectionContext({activeSemanticPartId:'gaze'},'face-setup'),{kind:'semantic-part',id:'gaze'});
  assert.deepEqual(resolveSelectionContext({activeSemanticPartId:'gaze',activeControl:'lookX'},'face-setup'),{kind:'semantic-control',part:'gaze',control:'lookX'});
  assert.deepEqual(resolveSelectionContext({animationEditor:{activeClipId:'idle'}},'animate'),{kind:'clip',id:'idle'});
  assert.deepEqual(resolveSelectionContext({selectedTrackParameter:'lookX',animationEditor:{activeClipId:'idle'}},'animate'),{kind:'timeline-track',parameter:'lookX'});
  assert.deepEqual(resolveSelectionContext({selectedKey:{parameter:'lookX',time:.5},selectedTrackParameter:'lookX'},'animate'),{kind:'timeline-key',parameter:'lookX',time:.5});
  assert.deepEqual(resolveSelectionContext({activeStateId:'happy',animationEditor:{}},'animate'),{kind:'state',id:'happy'});
});

test('inspector presentation supports task-level Face Setup onboarding', () => {
  assert.deepEqual(resolveInspectorPresentation('artwork',{kind:'none'}),{hidden:false,heading:'Inspector',emptyCopy:'Select an element on the canvas to edit it.',artwork:false,semantic:false});
  assert.equal(resolveInspectorPresentation('artwork',{kind:'artwork'}).heading,'Artwork Inspector');
  assert.equal(resolveInspectorPresentation('face-setup',{kind:'none'}).semantic,true);
  assert.equal(resolveInspectorPresentation('face-setup',{kind:'semantic-part'}).heading,'Face Part Inspector');
  assert.equal(resolveInspectorPresentation('face-setup',{kind:'semantic-control'}).heading,'Movement Inspector');
  assert.equal(resolveInspectorPresentation('animate',{kind:'none'}).emptyCopy,'Select an animation item to edit it.');
  assert.equal(resolveInspectorPresentation('preview',{kind:'none'}).hidden,true);
});

test('task precedence prevents parallel selections from competing', () => {
  const conflict={selectedId:'head',activeSemanticPartId:'gaze',activeControl:'lookX',selectedKey:{parameter:'lookX',time:1}};
  assert.equal(resolveSelectionContext(conflict,'artwork').kind,'artwork');
  assert.equal(resolveSelectionContext(conflict,'face-setup').kind,'semantic-control');
  assert.equal(resolveSelectionContext(conflict,'animate').kind,'timeline-key');
});

test('selection intents only update editor context', () => {
  const context=createEditorContext('create'); const project={revision:3}; const history=[];
  const selection=createSelectionController(context);
  selection.selectArtworkElement('head'); selection.selectSemanticControl('gaze','lookX'); selection.selectTimelineKey({parameter:'lookX',time:.5});
  assert.equal(context.get().selectedId,'head'); assert.equal(context.get().activeControl,'lookX');
  assert.deepEqual({project,history},{project:{revision:3},history:[]});
  selection.clearSelection(); assert.equal(context.get().selectedId,null); assert.equal(context.get().selectedKey,null);
});
