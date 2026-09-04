import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, STAGE_ORDER, TASKS, createTaskRouter, normalizeRoute, normalizeTask, normalizeTarget, stageEntryTask, stageTasks, taskToStage, taskToWorkspace, workspaceToTask } from '../../ui/task-router.js';
import { readUiPreferences, UI_PREFERENCES_KEY } from '../../ui/workspace-state.js';

test('task routes normalize canonical ids, legacy aliases, fallback, and targets', () => {
  assert.equal(normalizeTask('artwork'), 'artwork');
  assert.equal(normalizeTask('create'), 'artwork');
  assert.equal(normalizeTask('rig'), 'face-setup');
  assert.equal(normalizeTask('unknown'), 'artwork');
  assert.equal(taskToWorkspace('face-setup'), 'rig');
  assert.equal(workspaceToTask('preview'), 'preview');
  // A route carries the stage the task belongs to (VNX-06): derived, never
  // authored, so every existing route keeps meaning what it meant.
  assert.deepEqual(normalizeRoute({ task:'rig', target:{kind:'semantic-control',part:'gaze',control:'lookX',ignored:true} }), { task:'face-setup',stage:'create',target:{kind:'semantic-control',part:'gaze',control:'lookX'},focus:null });
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

/**
 * The four stages (VNX-06, docs/VNEXT_ROADMAP.md). A stage is a layer over the
 * tasks, not a replacement for them: everything that could name a task before
 * still can, and still lands in the same place.
 */
test('every task belongs to exactly one stage, and every stage has at least one task', () => {
  const filed = STAGE_ORDER.flatMap((stage) => STAGES[stage].tasks);
  const navigable = Object.values(TASKS).filter((task) => task.navigable).map((task) => task.id);
  assert.deepEqual(navigable.filter((task) => !filed.includes(task)), [],
    'a task in no stage cannot be reached from the navigation at all');
  assert.deepEqual(filed.filter((task, index) => filed.indexOf(task) !== index), [], 'and none is filed twice');
  for (const stage of STAGE_ORDER) assert.ok(STAGES[stage].tasks.length, `${stage} has nothing in it`);
  assert.deepEqual(STAGE_ORDER, ['create', 'animate', 'behaviors', 'publish'], 'in journey order');
});

test('a stage resolves to a task, and a task resolves to its stage', () => {
  assert.equal(taskToStage('face-setup'), 'create');
  assert.equal(taskToStage('animate'), 'animate');
  assert.equal(taskToStage('preview'), 'publish');
  // Legacy names go through the same aliases as everywhere else.
  assert.equal(taskToStage('rig'), 'create');
  assert.equal(taskToStage('nonsense'), 'create', 'and an unknown task is filed rather than lost');
  assert.deepEqual([...stageTasks('create')], ['artwork', 'face-setup']);
  assert.deepEqual([...stageTasks('nonsense')], ['artwork', 'face-setup']);
});

test('entering a stage keeps the task already open in it', () => {
  // Clicking Create while Face Setup is showing must not throw the user back
  // to Artwork; clicking it from elsewhere lands on the first step.
  assert.equal(stageEntryTask('create', 'face-setup'), 'face-setup');
  assert.equal(stageEntryTask('create', 'preview'), 'artwork');
  assert.equal(stageEntryTask('animate', 'expressions'), 'expressions');
  assert.equal(stageEntryTask('behaviors', 'anything'), 'reactions');
});

test('a route may name a stage, and the task still wins when both are given', () => {
  assert.equal(normalizeRoute({ stage: 'publish' }).task, 'preview');
  assert.equal(normalizeRoute({ stage: 'animate' }).task, 'expressions');
  assert.equal(normalizeRoute({ stage: 'publish', task: 'artwork' }).task, 'artwork', 'the more specific one');
  assert.equal(normalizeRoute({ stage: 'publish', task: 'artwork' }).stage, 'create', 'and the stage follows it');
  assert.equal(normalizeRoute({ stage: 'nonsense' }).task, 'artwork');
});
