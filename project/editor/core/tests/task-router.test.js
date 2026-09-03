import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, createTaskRouter, normalizeRoute, normalizeTask, normalizeTarget, taskToWorkspace, workspaceToTask } from '../../ui/task-router.js';
import { readUiPreferences, UI_PREFERENCES_KEY } from '../../ui/workspace-state.js';

test('task routes normalize canonical ids, legacy aliases, fallback, and targets', () => {
  assert.equal(normalizeTask('artwork'), 'artwork');
  assert.equal(normalizeTask('create'), 'artwork');
  assert.equal(normalizeTask('rig'), 'face-setup');
  assert.equal(normalizeTask('unknown'), 'artwork');
  assert.equal(taskToWorkspace('face-setup'), 'rig');
  assert.equal(workspaceToTask('preview'), 'preview');
  assert.deepEqual(normalizeRoute({ task:'rig', target:{kind:'semantic-control',part:'gaze',control:'lookX',ignored:true} }), { task:'face-setup',target:{kind:'semantic-control',part:'gaze',control:'lookX'},focus:null });
  assert.equal(normalizeTarget({kind:'future-entity',id:'x'}), null);
});

test('router navigation is idempotent and deep links remain session-only', () => {
  let workspace='create', writes=0; const targets=[];
  const project={title:'unchanged'}, history=[], revision=7, dirty=false;
  const router=createTaskRouter({getWorkspace:()=>workspace,setWorkspace:value=>{workspace=value;writes++;},applyTarget:value=>targets.push(value)});
  assert.equal(router.navigate('artwork').changed,false);
  assert.equal(writes,0);
  assert.equal(router.navigate({task:'face-setup',target:{kind:'semantic-part',id:'gaze'}}).changed,true);
  assert.equal(workspace,'rig'); assert.equal(writes,1); assert.deepEqual(targets,[{kind:'semantic-part',id:'gaze'}]);
  assert.deepEqual({project,history,revision,dirty},{project:{title:'unchanged'},history:[],revision:7,dirty:false});
});

test('UI preference migration accepts legacy and canonical task ids', () => {
  const storage=value=>({getItem:key=>key===UI_PREFERENCES_KEY?JSON.stringify({workspace:value,leftCollapsed:true}):null});
  assert.equal(readUiPreferences(storage('rig')).workspace,'rig');
  assert.equal(readUiPreferences(storage('face-setup')).workspace,'rig');
  assert.equal(readUiPreferences(storage('nonsense')).workspace,'create');
});

test('Artwork label retains the legacy create workspace adapter', () => {
  assert.equal(TASKS.artwork.label, 'Artwork');
  assert.equal(TASKS.artwork.workspace, 'create');
  assert.equal(workspaceToTask('create'), 'artwork');
});

test('a route may focus a known panel, and only a known one', () => {
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'head-pose' }).focus, 'head-pose');
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'hand-setup' }).focus, 'hand-setup');
  // Anything else is dropped rather than trusted into a selector.
  assert.equal(normalizeRoute({ task: 'face-setup', focus: 'body' }).focus, null);
  assert.equal(normalizeRoute({ task: 'face-setup', focus: '#left script' }).focus, null);
  assert.equal(normalizeRoute({ task: 'face-setup' }).focus, null);
});

test('navigating with a focus asks the shell to reveal that panel', () => {
  const focused = [];
  let workspace = 'create';
  const router = createTaskRouter({
    getWorkspace: () => workspace, setWorkspace: (next) => { workspace = next; },
    focusPanel: (id) => focused.push(id)
  });
  router.navigate({ task: 'face-setup', focus: 'hand-setup' });
  assert.deepEqual(focused, ['hand-setup']);
  router.navigate({ task: 'face-setup' });
  assert.deepEqual(focused, ['hand-setup'], 'a route without a focus reveals nothing');
});
