import { test, expect } from '@playwright/test';
import { dragWithin, enterFaceBuilder, openSetupSection, goToAnimate, goToPreview, openAdvanced, openExport, openFreshEditor, openGazeControl, openProjectMenu, readSvgTranslation, selectSemanticPartById, setRangeControl, startBasicFace } from './editor-helpers.js';

function monitor(page) {
  const errors=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('console',(message)=>message.type()==='error'&&errors.push(message.text()));
  return errors;
}
async function openEditor(page) { await openFreshEditor(page,{e2e:true}); }
async function load(page, name) {
  if (name === 'basic') return startBasicFace(page);
  const before=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics().store);
  await page.locator(`[data-home] [data-template-id="${name}"]`).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  const after=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics().store);
  expect(after.legacySetState-before.legacySetState).toBe(0);
  expect(after.wholeDocumentMutationClones-before.wholeDocumentMutationClones).toBe(0);
}
const PART_IDS={Head:'head',Eyes:'eyes',Eyelids:'eyelids',Mouth:'mouth','Pupils / Gaze':'gaze'};
// Face Setup selects a part by id (its button also carries a status text) and exposes Setup / Controls / Calibrate / Advanced tabs.
async function part(page, name, tab) {
  await selectSemanticPartById(page, PART_IDS[name] || name);
  const back=page.locator('[data-movement-back]'); if (await back.isVisible()) await back.click();
  if (tab) { await page.locator(`[data-rig-tab="${tab}"]`).click(); await expect(page.locator(`[data-rig-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true'); }
}
// Morph endpoints are captured through a canvas shape session: edit the shape, then Capture restores the base artwork.
async function captureMorph(page, control, pose, id, d) {
  await page.locator(`[data-edit-morph="${control}:${pose}"]`).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-morph-pose/);
  if (d) await page.evaluate(([i, path]) => window.__BOOP_E2E__.setAuthoredPath(i, path), [id, d]);
  await page.locator('#capture-morph-pose').click();
  await expect(page.locator('#canvas')).not.toHaveClass(/rig-morph-pose/);
}
// Keys sit at time × pixels-per-second inside their lane; derive the scale from two existing keys so the drag lands on an exact time.
async function dragKey(page, lane, key, toTime) {
  const keys=lane.locator('[data-key]'); const timeOf=async (k)=>Number((await k.getAttribute('data-key')).split('|')[1]); const centerOf=async (k)=>{const b=await k.boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
  const [a,b]=[keys.nth(0),keys.nth(1)], ta=await timeOf(a), tb=await timeOf(b), ca=await centerOf(a), cb=await centerOf(b), pps=(cb.x-ca.x)/(tb-ta);
  const from=await centerOf(key), dx=(toTime-await timeOf(key))*pps;
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x+dx/2, from.y, { steps: 4 }); await page.mouse.move(from.x+dx, from.y, { steps: 4 }); await page.mouse.up();
}
async function moveGaze(page, value=.8) { await setRangeControl(await openGazeControl(page), value); }
const state=(page)=>page.evaluate(()=>window.__BOOP_E2E__.state());
const setLive=(page,name,value)=>page.evaluate(([n,v])=>window.__BOOP_E2E__.setLiveParam(n,v),[name,value]);

test.beforeEach(async({page})=>openEditor(page));

test('Head calibration and controls update the real SVG transform',async({page})=>{
  const errors=monitor(page);await load(page,'basic');await part(page,'Head');const head=page.locator(`#${(await state(page)).semanticParts.head.roles.head}`);
  await openSetupSection(page,'movements');
  const enable=page.getByLabel('Enable Move left / right (Head)');if(!(await enable.isChecked()))await enable.check();
  await page.locator('[data-movement-open="headX"]').click();await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind','semantic-control');
  await page.getByRole('button',{name:'Pose and capture CENTER'}).click();await expect(page.locator('#canvas')).toHaveClass(/rig-transform-pose/);await page.locator('[data-canvas-mode-capture]').click();await expect(page.locator('.pose-card[data-pose="center"]')).toHaveAttribute('data-pose-captured','true');
  await page.getByRole('button',{name:'Pose and capture RIGHT'}).click();await expect(page.locator('#canvas')).toHaveClass(/rig-transform-pose/);await dragWithin(page,head,{to:{x:.9,y:.5}});await page.locator('[data-canvas-mode-capture]').click();await expect(page.locator('small[data-movement-status]')).toHaveAttribute('data-movement-status','calibrated');
  const center=await head.getAttribute('transform');await setRangeControl(page.locator('[data-rig-control="head:headX"]'), .9);await expect.poll(()=>head.getAttribute('transform')).not.toBe(center);
  await page.locator('[data-movement-open="headTilt"]').click();const tilt=page.locator('[data-rig-control="head:headTilt"]');await tilt.fill('1');await tilt.dispatchEvent('change');await expect(head).toHaveAttribute('transform',/rotate/);await page.getByRole('button',{name:'Center',exact:true}).click();expect(errors).toEqual([]);
});

test('Eye Open morph preserves closed-zero/open-one orientation on real paths',async({page})=>{
  const errors=monitor(page);await load(page,'basic');await part(page,'Eyelids','controls');await page.locator('[data-method="eyeOpen"]').selectOption('morph');await page.locator('[data-rig-tab="calibrate"]').click();
  const closed='M 61 100 Q 85 100 109 100',open='M 61 100 Q 85 78 109 100',eye=page.locator('#lidUpperLeft');
  await captureMorph(page,'eyeOpen','closed','lidUpperLeft',closed);
  await captureMorph(page,'eyeOpen','open','lidUpperLeft',open);
  await setLive(page,'eyeOpen',0);await expect(eye).toHaveAttribute('d',closed);await setLive(page,'eyeOpen',.5);const middle=await eye.getAttribute('d');expect(middle).not.toBe(closed);expect(middle).not.toBe(open);await setLive(page,'eyeOpen',1);await expect(eye).toHaveAttribute('d',open);expect(errors).toEqual([]);
});

test('method switching preserves manual bindings and cleans only owned metadata',async({page})=>{
  await load(page,'basic');await part(page,'Mouth','controls');await page.evaluate(()=>window.__BOOP_E2E__.mutate(s=>{s.elements.mouth.bindings.opacity={enabled:true,mode:'advanced',expression:'.5'};}));
  // The mouth opens and smiles through shape keys: one closed path, two
  // additive shapes, which is the only way to do both at once.
  let model=await state(page);
  expect(model.semanticParts.mouth.controlDrivers.mouthOpen.method).toBe('shapeKey');
  expect(model.shapeKeys.map(key=>key.id)).toEqual(['mouth-open','mouth-smile','mouth-frown','teeth-show','teeth-follow','tongue-show','tongue-follow','head-jaw']);
  expect(model.elements.mouth.bindings.scaleY).toBeUndefined();

  // Switching a control's method takes its shapes with it, and leaves the
  // other control's alone.
  await page.locator('[data-method="smile"]').selectOption('translateY');model=await state(page);
  expect(model.shapeKeys.map(key=>key.id)).toEqual(['mouth-open','teeth-show','teeth-follow','tongue-show','tongue-follow','head-jaw']);
  expect(model.elements.mouth.bindings.translateY.generatedBy.control).toBe('smile');

  // One legacy morph per element, still: once Smile owns the element's shape,
  // the second control to ask for it is refused rather than replacing it.
  await page.locator('[data-method="smile"]').selectOption('morph');
  await page.locator('[data-rig-tab="calibrate"]').click();
  await captureMorph(page,'smile','neutral','mouth',null);
  await captureMorph(page,'smile','open','mouth','M86 170 Q120 190 154 170 Q120 200 86 170 Z');
  await page.locator('[data-rig-tab="controls"]').click();
  await page.locator('[data-method="mouthOpen"]').selectOption('morph');
  await expect(page.locator('.rig-instruction')).toContainText('already used by Smile');
  await expect(page.locator('[data-method="mouthOpen"]')).toHaveValue('shapeKey');

  await page.locator('[data-method="mouthOpen"]').selectOption('scaleY');model=await state(page);
  expect(model.shapeKeys.map(key=>key.id)).toEqual(['teeth-show','teeth-follow','tongue-show','tongue-follow','head-jaw'],'the teeth, the tongue and the jaw belong to their own controls');
  expect(model.elements.mouth.bindings.scaleY.generatedBy.control).toBe('mouthOpen');
  expect(model.elements.mouth.bindings.opacity.expression).toBe('.5','a manual binding is nobody else\'s to clean up');
  expect(model.elements.mouth.morph.generatedBy.control).toBe('smile');
});

test('binding conflicts warn and preserve the existing owner',async({page})=>{
  const errors=monitor(page);await load(page,'basic');await part(page,'Mouth','controls');await page.locator('[data-method="smile"]').selectOption('translateY');await page.locator('[data-method="mouthOpen"]').selectOption('morph');await expect.poll(()=>state(page).then(s=>s.semanticParts.mouth.controlDrivers.mouthOpen.method)).toBe('morph');await page.evaluate(()=>window.__BOOP_E2E__.mutate(s=>{s.elements.mouth.bindings.scaleY={enabled:true,expression:'manual'};}));
  await page.locator('[data-method="mouthOpen"]').selectOption('scaleY');await expect(page.locator('.rig-instruction')).toContainText('already controlled');const model=await state(page);expect(model.elements.mouth.bindings.scaleY.expression).toBe('manual');expect(model.semanticParts.mouth.controlDrivers.mouthOpen.method).toBe('morph');expect(errors).toEqual([]);
});

test('semantic methods, roles, shapes and controls survive Save/Open',async({page})=>{
  await load(page,'basic');
  await setLive(page,'smile',1);
  const smiling=await page.locator('#mouth').getAttribute('d');
  await setLive(page,'smile',0);
  const before=await state(page);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();const file=await download,path=await file.path();
  await openProjectMenu(page);await page.getByRole('button',{name:'New Project',exact:true}).click();await page.locator('[data-home] [data-template-id="basic"]').click();await page.locator('#project-file').setInputFiles(path);
  await expect.poll(()=>state(page).then(s=>s.semanticParts.mouth.controlDrivers.smile.method)).toBe('shapeKey');
  const after=await state(page);
  expect(after.semanticParts.mouth.roles).toEqual(before.semanticParts.mouth.roles);
  expect(after.shapeKeys).toEqual(before.shapeKeys);
  const lookX=await openGazeControl(page);const old=await page.locator('#pupilLeft').getAttribute('transform');await setRangeControl(lookX, .85);await expect.poll(()=>page.locator('#pupilLeft').getAttribute('transform')).not.toBe(old);
  // And the shapes still reach the artwork: the same smile, after a round trip.
  await setLive(page,'smile',1);
  await expect(page.locator('#mouth')).toHaveAttribute('d',smiling);
});

async function newLookClip(page){await load(page,'basic');await goToAnimate(page);await page.locator('[data-action="new-clip"]').click();await page.locator('#clip-name').fill('Gaze Test');await page.locator('#clip-name').dispatchEvent('change');await page.locator('#clip-duration').fill('1');await page.locator('#clip-duration').dispatchEvent('change');await page.locator('#track-param').selectOption('lookX');await page.locator('[data-action="add-track"]:visible').first().click();}
async function addKey(page,time,value){await page.locator('#playhead').fill(String(time));await page.locator('#playhead').dispatchEvent('change');await setLive(page,'lookX',value);await page.locator('[data-add-key="lookX"]').click();await page.evaluate(()=>window.__BOOP_E2E__.clearLiveParam('lookX'));}

test('track CRUD, scrub interpolation, pointer drag, collision and one-step undo/redo',async({page})=>{
  await newLookClip(page);await page.locator('#track-param').selectOption('mouthOpen');await page.locator('[data-action="add-track"]:visible').first().click();await page.locator('[data-remove-track="mouthOpen"]').click();await expect(page.locator('.track').filter({hasText:'mouthOpen'})).toHaveCount(0);await page.locator('#undo').click();await expect(page.locator('.track').filter({hasText:'mouthOpen'})).toHaveCount(1);await page.locator('[data-remove-track="mouthOpen"]').click();
  await addKey(page,0,-1);await addKey(page,.5,0);await addKey(page,1,1);const pupil=page.locator('#pupilLeft');await page.locator('#playhead').fill('.25');const at25=await pupil.getAttribute('transform');await page.locator('#playhead').fill('.75');await expect.poll(()=>pupil.getAttribute('transform')).not.toBe(at25);
  const lane=page.locator('.track').filter({hasText:'lookX'}).locator('.key-lane'),key=lane.locator('[data-key="lookX|1"]');await dragKey(page,lane,key,.8);await expect(lane.locator('[data-key="lookX|0.8"]')).toHaveCount(1);await page.locator('#undo').click();await expect(lane.locator('[data-key="lookX|1"]')).toHaveCount(1);await page.locator('#redo').click();await expect(lane.locator('[data-key="lookX|0.8"]')).toHaveCount(1);
  const moved=lane.locator('[data-key="lookX|0.8"]');await dragKey(page,lane,moved,.5);await expect(lane.locator('[data-key="lookX|0.5"]')).toHaveCount(1);expect((await state(page)).animationClips.find(c=>c.name==='Gaze Test').tracks.lookX.filter(k=>k.time===.5)).toHaveLength(1);
});

test('loop playback wraps while the real SVG keeps moving',async({page})=>{
  await newLookClip(page);await addKey(page,0,-1);await addKey(page,.4,1);await page.locator('#clip-duration').fill('.4');await page.locator('#clip-duration').dispatchEvent('change');await page.locator('#clip-loop').check();await page.locator('#clip-play').click();const samples=[];let previous=-1,wrapped=false;await expect.poll(async()=>{const time=Number(await page.locator('#current-time').textContent());samples.push(await page.locator('#pupilLeft').getAttribute('transform'));if(previous>.25&&time<.15)wrapped=true;previous=time;return wrapped;},{timeout:4000,intervals:[40]}).toBe(true);expect(new Set(samples).size).toBeGreaterThan(1);await page.locator('#clip-stop').click();
});



test('paused clip freezes its pose while deterministic Blink continues',async({page})=>{
  await load(page,'basic');await page.evaluate(()=>window.__BOOP_E2E__.mutate(s=>{const blink=s.behaviors.find(b=>b.type==='blink');blink.intervalMin=.15;blink.intervalMax=.15;blink.duration=.08;}));await goToAnimate(page);await page.locator('#clip-play').click();await expect.poll(async()=>Number(await page.locator('#current-time').textContent())).toBeGreaterThan(.05);await page.locator('#clip-pause').click();const frozen=await page.evaluate(()=>window.__BOOP_E2E__.previewSession()),eyes=[],looks=[];await expect.poll(async()=>{const params=await page.evaluate(()=>window.__BOOP_E2E__.effectiveParams());eyes.push(params.eyeOpen);looks.push(params.lookX);return new Set(eyes).size;},{timeout:2000,intervals:[40]}).toBeGreaterThan(1);expect(new Set(looks).size).toBe(1);expect(looks[0]).toBe(frozen.effectiveParams.lookX);expect((await page.evaluate(()=>window.__BOOP_E2E__.previewSession())).clipTime).toBe(frozen.clipTime);
});

test('state transition renders an intermediate and final visual pose',async({page})=>{
  await load(page,'basic');await goToPreview(page);const mouth=page.locator('#mouth'),initial=await mouth.getAttribute('d');await page.locator('[data-preview-state="happy"]').click();await expect.poll(()=>mouth.getAttribute('d')).not.toBe(initial);const intermediate=await mouth.getAttribute('d');await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().smile),{timeout:1000}).toBe(1);expect(await mouth.getAttribute('d')).not.toBe(intermediate);
});

test('numeric key time uses collision replacement and one undo restores both keys',async({page})=>{await newLookClip(page);await addKey(page,.5,-1);await addKey(page,1,1);await page.locator('[data-key="lookX|1"]').click();await page.locator('[data-key-edit="time"]').fill('.5');await page.locator('[data-key-edit="time"]').dispatchEvent('change');let frames=(await state(page)).animationClips.find(c=>c.name==='Gaze Test').tracks.lookX;expect(frames.filter(k=>k.time===.5)).toHaveLength(1);await page.locator('#undo').click();frames=(await state(page)).animationClips.find(c=>c.name==='Gaze Test').tracks.lookX;expect(frames.map(k=>k.time)).toEqual([.5,1]);});

test('@critical Build a Face generates an honest valid project that previews and saves',async({page})=>{const errors=monitor(page);await enterFaceBuilder(page);await page.locator('#face-head').selectOption('square');await page.locator('#face-eyes').selectOption('dot');await page.locator('#face-mouth').selectOption('sad');const counters=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics().store);await page.locator('#generate-face').click();for(const id of ['head','eyeLeft','eyeRight','pupilLeft','pupilRight','browLeft','browRight','mouth'])await expect(page.locator(`#canvas svg svg #${id}`)).toBeVisible();const after=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics().store);expect(after.legacySetState-counters.legacySetState).toBe(0);expect(after.wholeDocumentMutationClones-counters.wholeDocumentMutationClones).toBe(0);const model=await state(page);expect(Object.keys(model.semanticParts)).toEqual(['head','eyes','gaze','eyebrows','mouth']);const pupil=page.locator('#pupilLeft'),before=await pupil.getAttribute('transform');await moveGaze(page,.8);await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().lookX)).toBeCloseTo(.8);await expect.poll(()=>pupil.getAttribute('transform')).not.toBe(before);const right=await readSvgTranslation(pupil);expect(Math.abs(right.x)).toBeGreaterThan(0);await moveGaze(page,-.8);await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().lookX)).toBeCloseTo(-.8);const left=await readSvgTranslation(pupil);expect(Math.sign(left.x)).toBe(-Math.sign(right.x));await openAdvanced(page);await page.getByRole('button',{name:'Problems'}).click();await expect(page.locator('#problems-panel')).toHaveAttribute('data-project-check-status','ready');await expect(page.locator('#problems-panel .manager-card')).toHaveCount(0);await goToPreview(page);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();await download;expect(errors).toEqual([]);});
test('@critical timeline project metadata persists and remains playable after reload',async({page})=>{
  await newLookClip(page);await addKey(page,0,-1);await addKey(page,1,1);await page.locator('[data-key="lookX|1"]').click();await page.locator('[data-key-edit="easing"]').selectOption('easeInOut');const before=(await state(page)).animationEditor.activeClipId;const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();const path=await (await download).path();await page.locator('#project-file').setInputFiles(path);const restored=await state(page),clip=restored.animationClips.find(c=>c.name==='Gaze Test');expect(clip.tracks.lookX[1]).toMatchObject({time:1,value:1,easing:'easeInOut'});expect(restored.animationEditor.activeClipId).toBe(before);const navigationCheckpoint=()=>page.evaluate(()=>({document:window.__BOOP_E2E__.document(),token:window.__BOOP_E2E__.documentVersionToken(),revisions:window.__BOOP_E2E__.documentRevisions(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));const beforeNavigation=await navigationCheckpoint();await goToAnimate(page);expect(await navigationCheckpoint()).toEqual(beforeNavigation);await page.locator('#playhead').fill('.25');await page.locator('#playhead').dispatchEvent('input');await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().lookX)).toBeCloseTo(-.75);await expect.poll(()=>readSvgTranslation(page.locator('#pupilLeft'))).not.toEqual({x:0,y:0});
});

test('@critical @smoke cross-browser template, Rig, Timeline, Save and Export',async({page})=>{
  const errors=monitor(page);await load(page,'basic');const pupils=[page.locator('#pupilLeft'),page.locator('#pupilRight')];await moveGaze(page,.8);await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().lookX)).toBeGreaterThan(0);const right=await Promise.all(pupils.map(readSvgTranslation));right.forEach(point=>expect(Math.abs(point.x)).toBeGreaterThan(0));await moveGaze(page,-.8);await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().lookX)).toBeLessThan(0);const left=await Promise.all(pupils.map(readSvgTranslation));left.forEach((point,index)=>expect(Math.sign(point.x)).toBe(-Math.sign(right[index].x)));await goToAnimate(page);await page.locator('#clip-play').click();await expect.poll(async()=>Number(await page.locator('#current-time').textContent())).toBeGreaterThan(0);await page.locator('#clip-pause').click();const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();await saved;await openExport(page);for(const name of ['mascot.svg','rig.json','runtime.js']){const download=page.waitForEvent('download');await page.getByRole('button',{name:`Download ${name}`}).click();expect((await download).suggestedFilename()).toBe(name);}expect(errors).toEqual([]);
});

test('Auto Key authors, drags, saves, reloads and plays a real mouth clip',async({page})=>{
  await load(page,'basic');await goToAnimate(page);await page.locator('[data-action="new-clip"]').click();await page.locator('#clip-name').fill('Hello');await page.locator('#clip-name').dispatchEvent('change');await page.locator('#clip-duration').fill('1');await page.locator('#clip-duration').dispatchEvent('change');await page.locator('#auto-key').check();
  // Auto Key records the Face Setup movement control at the Animate playhead.
  for(const [time,value] of [[0,0],[.2,1],[.4,0],[.7,1],[1,0]]){await goToAnimate(page);await page.locator('#playhead').fill(String(time));await page.locator('#playhead').dispatchEvent('change');await page.locator('[data-task="face-setup"]').click();await openSetupSection(page,'movements');await page.locator('[data-movement-open="mouthOpen"]').click();const control=page.locator('[data-rig-control="mouth:mouthOpen"]');await control.fill(String(value));await control.dispatchEvent('change');await page.evaluate(()=>window.__BOOP_E2E__.clearLiveParam('mouthOpen'));}
  await goToAnimate(page);const lane=page.locator('.track').filter({hasText:'mouthOpen'}).locator('.key-lane');await expect(lane.locator('[data-key]')).toHaveCount(5);await dragKey(page,lane,lane.locator('[data-key="mouthOpen|0.7"]'),.6);await expect(lane.locator('[data-key="mouthOpen|0.6"]')).toHaveCount(1);
  const rewind=async()=>{await page.locator('#playhead').fill('0');await page.locator('#playhead').dispatchEvent('change');};await rewind();const cavity=page.locator('#mouth'),shut=await cavity.getAttribute('d');await page.locator('#clip-play').click();await expect.poll(()=>cavity.getAttribute('d')).not.toBe(shut);await page.locator('#clip-pause').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();const path=await (await download).path();await page.locator('#project-file').setInputFiles(path);await goToAnimate(page);await expect(page.locator('#clip-name')).toHaveValue('Hello');await rewind();await page.locator('#clip-play').click();await expect.poll(()=>cavity.getAttribute('d')).not.toBe(shut);
});

/**
 * VNX-28: the dope sheet is bucketed by what part of the mascot a movement
 * belongs to, not by parameter id. A sheet of fifteen rows called `lookX`,
 * `handRGrip`, `earWiggle` is a sheet an author has to decode.
 */
test('@critical tracks are grouped by the part they move, and a group folds away',async({page})=>{
  await newLookClip(page);
  // One movement from four different parts of the mascot, added the way an
  // author adds them.
  for (const control of ['mouthOpen','earWiggle','headY']) {
    await page.locator('#track-param').selectOption(control);
    await page.locator('[data-action="add-track"]:visible').first().click();
  }
  const groups=page.locator('.track-group');
  await expect(groups).toHaveCount(4);
  // Each one names a part, and none of them is the bucket a movement lands in
  // when nothing knows what it is.
  const labels=await groups.allInnerTexts();
  // Upper-cased by the stylesheet, so compare what was written rather than what is painted.
  expect(labels.map(text=>text.replace(/^[▶▼]\s*/,'').toLowerCase()).sort()).toEqual(['ears','gaze','head','mouth']);
  // The rows read as words too: an ear track says what it does, not `earWiggle`.
  await expect(page.locator('.property-row[data-track="earWiggle"]')).toContainText('Wiggle');
  await expect(page.locator('.property-row[data-track="lookX"]')).toContainText('Look left / right');

  // Folding a group hides its rows and nothing else, and says which way it is.
  const ears=groups.filter({hasText:'Ears'});
  await expect(ears).toHaveAttribute('aria-expanded','true');
  await ears.click();
  await expect(ears).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.property-row[data-track="earWiggle"]')).toHaveCount(0);
  await expect(page.locator('.property-row[data-track="lookX"]')).toHaveCount(1);
  await ears.click();
  await expect(page.locator('.property-row[data-track="earWiggle"]')).toHaveCount(1);
});
