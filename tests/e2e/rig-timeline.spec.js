import { test, expect } from '@playwright/test';

function monitor(page) {
  const errors=[];
  page.on('pageerror',(error)=>errors.push(error.message));
  page.on('console',(message)=>message.type()==='error'&&errors.push(message.text()));
  return errors;
}
async function openEditor(page) { await page.goto('./?e2e=1'); await expect.poll(()=>page.evaluate(()=>Boolean(window.__BOOP_E2E__))).toBe(true); }
async function load(page, name) { await page.locator('#project-template').selectOption(name); await expect(page.locator('#canvas svg svg')).toBeVisible(); }
async function part(page, name) { await page.getByRole('button',{name,exact:true}).click(); }
async function dragPad(page, x, y) { const pad=page.locator('[data-xy]'),box=await pad.boundingBox();await page.mouse.move(box.x+box.width*x,box.y+box.height*y);await page.mouse.down();await page.mouse.move(box.x+box.width*x,box.y+box.height*y);await page.mouse.up(); }
const state=(page)=>page.evaluate(()=>window.__BOOP_E2E__.state());
const setLive=(page,name,value)=>page.evaluate(([n,v])=>window.__BOOP_E2E__.setLiveParam(n,v),[name,value]);

test.beforeEach(async({page})=>openEditor(page));

test('Head calibration and controls update the real SVG transform',async({page})=>{
  const errors=monitor(page);await load(page,'basic');await part(page,'Head');const head=page.locator('#head');
  await page.getByRole('button',{name:/Capture Head X CENTER/}).click();
  await page.evaluate(()=>window.__BOOP_E2E__.setAuthoredTransform('head',{x:20}));await page.getByRole('button',{name:/Capture Head X RIGHT/}).click();
  await page.evaluate(()=>window.__BOOP_E2E__.setAuthoredTransform('head',{rotation:15}));await page.getByRole('button',{name:/Capture Head Tilt TILT RIGHT/}).click();
  await page.getByRole('button',{name:'Calculate'}).click();const center=await head.getAttribute('transform');await dragPad(page,.9,.5);await expect.poll(()=>head.getAttribute('transform')).not.toBe(center);
  await page.locator('[data-control="headTilt"]').fill('1');await page.locator('[data-control="headTilt"]').dispatchEvent('change');await expect(head).toHaveAttribute('transform',/rotate/);await page.getByRole('button',{name:'Center'}).click();expect(errors).toEqual([]);
});

test('Eye Open morph preserves closed-zero/open-one orientation on real paths',async({page})=>{
  const errors=monitor(page);await load(page,'expressive');await part(page,'Eyelids');await page.locator('[data-method="eyeOpen"]').selectOption('morph');
  const closed='M 61 100 Q 85 100 109 100',open='M 61 100 Q 85 78 109 100',eye=page.locator('#upperLidLeft');
  await page.evaluate((d)=>window.__BOOP_E2E__.setAuthoredPath('upperLidLeft',d),closed);await page.getByRole('button',{name:'Capture CLOSED'}).click();
  await page.evaluate((d)=>window.__BOOP_E2E__.setAuthoredPath('upperLidLeft',d),open);await page.getByRole('button',{name:'Capture OPEN'}).click();
  await setLive(page,'eyeOpen',0);await expect(eye).toHaveAttribute('d',closed);await setLive(page,'eyeOpen',.5);const middle=await eye.getAttribute('d');expect(middle).not.toBe(closed);expect(middle).not.toBe(open);await setLive(page,'eyeOpen',1);await expect(eye).toHaveAttribute('d',open);expect(errors).toEqual([]);
});

test('method switching preserves manual bindings and cleans only owned metadata',async({page})=>{
  await load(page,'basic');await part(page,'Mouth');await page.evaluate(()=>window.__BOOP_E2E__.mutate(s=>{s.elements.mouth.bindings.opacity={enabled:true,mode:'advanced',expression:'.5'};}));
  let model=await state(page);expect(model.elements.mouth.bindings.scaleY.generatedBy.control).toBe('mouthOpen');expect(model.elements.mouth.morph).toBeUndefined();
  await page.locator('[data-method="mouthOpen"]').selectOption('morph');model=await state(page);expect(model.elements.mouth.bindings.scaleY).toBeUndefined();expect(model.elements.mouth.bindings.opacity.expression).toBe('.5');
  await page.getByRole('button',{name:'Capture NEUTRAL'}).click();await page.evaluate(()=>window.__BOOP_E2E__.setAuthoredPath('mouth','M 80 155 Q 120 205 160 155'));await page.getByRole('button',{name:'Capture OPEN'}).click();expect((await state(page)).elements.mouth.morph.generatedBy.control).toBe('mouthOpen');
  await page.locator('[data-method="mouthOpen"]').selectOption('scaleY');model=await state(page);expect(model.elements.mouth.morph).toBeUndefined();expect(model.elements.mouth.bindings.scaleY.generatedBy.control).toBe('mouthOpen');expect(model.elements.mouth.bindings.opacity.expression).toBe('.5');
});

test('binding conflicts warn and preserve the existing owner',async({page})=>{
  const errors=monitor(page);await load(page,'basic');await part(page,'Mouth');await page.locator('[data-method="mouthOpen"]').selectOption('morph');await page.evaluate(()=>window.__BOOP_E2E__.mutate(s=>{s.elements.mouth.bindings.scaleY={enabled:true,expression:'manual'};}));
  page.once('dialog',async dialog=>{expect(dialog.message()).toContain('already controlled');await dialog.accept();});await page.locator('[data-method="mouthOpen"]').selectOption('scaleY');const model=await state(page);expect(model.elements.mouth.bindings.scaleY.expression).toBe('manual');expect(model.semanticParts.mouth.controlDrivers.mouthOpen.method).toBe('morph');expect(errors).toEqual([]);
});

test('semantic methods, roles, calibration, morph ownership and controls survive Save/Open',async({page})=>{
  await load(page,'talking');const before=await state(page);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();const file=await download,path=await file.path();await page.locator('#project-template').selectOption('basic');await page.locator('#project-file').setInputFiles(path);await expect.poll(()=>state(page).then(s=>s.semanticParts.mouth.controlDrivers.mouthOpen.method)).toBe('morph');const after=await state(page);expect(after.semanticParts.mouth.roles).toEqual(before.semanticParts.mouth.roles);expect(after.elements.mouth.morph).toEqual(before.elements.mouth.morph);await part(page,'Pupils / Gaze');const old=await page.locator('#pupilLeft').getAttribute('transform');await dragPad(page,.85,.3);await expect.poll(()=>page.locator('#pupilLeft').getAttribute('transform')).not.toBe(old);await setLive(page,'mouthOpen',1);await expect(page.locator('#mouth')).toHaveAttribute('d',after.elements.mouth.morph.pathB);
});

async function newLookClip(page){await load(page,'basic');await page.locator('#new-clip').click();await page.locator('#clip-name').fill('Gaze Test');await page.locator('#clip-name').dispatchEvent('change');await page.locator('#clip-duration').fill('1');await page.locator('#clip-duration').dispatchEvent('change');await page.locator('#track-param').selectOption('lookX');await page.locator('#add-track').click();}
async function addKey(page,time,value){await page.locator('#playhead').fill(String(time));await page.locator('#playhead').dispatchEvent('change');await setLive(page,'lookX',value);await page.locator('[data-add-key="lookX"]').click();await page.evaluate(()=>window.__BOOP_E2E__.clearLiveParam('lookX'));}

test('track CRUD, scrub interpolation, pointer drag, collision and one-step undo/redo',async({page})=>{
  await newLookClip(page);await page.locator('#track-param').selectOption('mouthOpen');await page.locator('#add-track').click();await page.locator('[data-remove-track="mouthOpen"]').click();await expect(page.locator('.track').filter({hasText:'mouthOpen'})).toHaveCount(0);await page.locator('#undo').click();await expect(page.locator('.track').filter({hasText:'mouthOpen'})).toHaveCount(1);await page.locator('[data-remove-track="mouthOpen"]').click();
  await addKey(page,0,-1);await addKey(page,.5,0);await addKey(page,1,1);const pupil=page.locator('#pupilLeft');await page.locator('#playhead').fill('.25');const at25=await pupil.getAttribute('transform');await page.locator('#playhead').fill('.75');await expect.poll(()=>pupil.getAttribute('transform')).not.toBe(at25);
  const lane=page.locator('.track').filter({hasText:'lookX'}).locator('.key-lane'),key=lane.locator('[data-key="lookX|1"]'),box=await lane.boundingBox();await key.dragTo(lane,{targetPosition:{x:box.width*.8,y:box.height/2}});await expect(lane.locator('[data-key="lookX|0.8"]')).toHaveCount(1);await page.locator('#undo').click();await expect(lane.locator('[data-key="lookX|1"]')).toHaveCount(1);await page.locator('#redo').click();await expect(lane.locator('[data-key="lookX|0.8"]')).toHaveCount(1);
  const moved=lane.locator('[data-key="lookX|0.8"]');await moved.dragTo(lane,{targetPosition:{x:box.width*.5,y:box.height/2}});await expect(lane.locator('[data-key="lookX|0.5"]')).toHaveCount(1);expect((await state(page)).animationClips.find(c=>c.name==='Gaze Test').tracks.lookX.filter(k=>k.time===.5)).toHaveLength(1);
});

test('loop playback wraps while the real SVG keeps moving',async({page})=>{
  await newLookClip(page);await addKey(page,0,-1);await addKey(page,.4,1);await page.locator('#clip-duration').fill('.4');await page.locator('#clip-duration').dispatchEvent('change');await page.locator('#clip-loop').check();await page.locator('#clip-play').click();const samples=[];let previous=-1,wrapped=false;await expect.poll(async()=>{const time=Number(await page.locator('#current-time').textContent());samples.push(await page.locator('#pupilLeft').getAttribute('transform'));if(previous>.25&&time<.15)wrapped=true;previous=time;return wrapped;},{timeout:1500}).toBe(true);expect(new Set(samples).size).toBeGreaterThan(1);await page.locator('#clip-stop').click();
});



test('paused clip freezes its pose while deterministic Blink continues',async({page})=>{
  await load(page,'expressive');await page.evaluate(()=>window.__BOOP_E2E__.mutate(s=>{const blink=s.behaviors.find(b=>b.type==='blink');blink.intervalMin=0;blink.intervalMax=0;blink.duration=.08;}));await page.getByRole('button',{name:/Preview/}).click();await page.locator('#clip-play').click();await expect.poll(async()=>Number(await page.locator('#current-time').textContent())).toBeGreaterThan(.05);await page.locator('#clip-pause').click();const pupil=await page.locator('#pupilLeft').getAttribute('transform'),eyes=[];await expect.poll(async()=>{eyes.push(await page.locator('#eyeLeft').getAttribute('transform'));return new Set(eyes).size;},{timeout:800}).toBeGreaterThan(1);expect(await page.locator('#pupilLeft').getAttribute('transform')).toBe(pupil);
});

test('state transition renders an intermediate and final visual pose',async({page})=>{
  await load(page,'basic');await page.getByRole('button',{name:/Preview/}).click();const mouth=page.locator('#mouth'),initial=await mouth.getAttribute('transform');await page.locator('[data-quick-state="happy"]').click();await expect.poll(()=>mouth.getAttribute('transform')).not.toBe(initial);const intermediate=await mouth.getAttribute('transform');await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.effectiveParams().smile),{timeout:1000}).toBe(1);expect(await mouth.getAttribute('transform')).not.toBe(intermediate);
});

test('numeric key time uses collision replacement and one undo restores both keys',async({page})=>{await newLookClip(page);await addKey(page,.5,-1);await addKey(page,1,1);await page.locator('[data-key="lookX|1"]').click();await page.locator('[data-key-edit="time"]').fill('.5');await page.locator('[data-key-edit="time"]').dispatchEvent('change');let frames=(await state(page)).animationClips.find(c=>c.name==='Gaze Test').tracks.lookX;expect(frames.filter(k=>k.time===.5)).toHaveLength(1);await page.locator('#undo').click();frames=(await state(page)).animationClips.find(c=>c.name==='Gaze Test').tracks.lookX;expect(frames.map(k=>k.time)).toEqual([.5,1]);});

test('@critical Build a Face generates an honest valid project that previews and saves',async({page})=>{const errors=monitor(page);await page.locator('#face-head').selectOption('square');await page.locator('#face-eyes').selectOption('dot');await page.locator('#face-mouth').selectOption('sad');await page.locator('#generate-face').click();await expect(page.locator('#canvas svg svg #head')).toBeVisible();const model=await state(page);expect(Object.keys(model.semanticParts)).toEqual(['head','eyes','mouth']);page.once('dialog',async d=>{expect(d.message()).toContain('Valid');await d.accept();});await page.getByRole('button',{name:'Validate'}).click();await page.getByRole('button',{name:/Preview/}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();await download;expect(errors).toEqual([]);});
test('@critical timeline project metadata persists and remains playable after reload',async({page})=>{
  await newLookClip(page);await addKey(page,0,-1);await addKey(page,1,1);await page.locator('[data-key="lookX|1"]').click();await page.locator('[data-key-edit="easing"]').selectOption('easeInOut');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();const path=await (await download).path();await page.locator('#project-file').setInputFiles(path);const clip=(await state(page)).animationClips.find(c=>c.name==='Gaze Test');expect(clip.tracks.lookX[1]).toMatchObject({time:1,value:1,easing:'easeInOut'});await page.locator('#playhead').fill('.5');await expect(page.locator('#pupilLeft')).toHaveAttribute('transform',/translate/);
});

test('@critical @smoke cross-browser template, Rig, Timeline, Save and Export',async({page})=>{
  const errors=monitor(page);await load(page,'expressive');await part(page,'Pupils / Gaze');await dragPad(page,.8,.2);await expect(page.locator('#pupilLeft')).toHaveAttribute('transform',/translate/);await page.locator('#clip-play').click();await expect.poll(async()=>Number(await page.locator('#current-time').textContent())).toBeGreaterThan(0);await page.locator('#clip-pause').click();const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();await saved;const downloads=[];page.on('download',d=>downloads.push(d));await page.getByRole('button',{name:'Export',exact:true}).click();await expect.poll(()=>downloads.length).toBe(3);expect(errors).toEqual([]);
});

test('Talking Face authors, drags, saves, reloads and plays a real morph clip',async({page})=>{
  await load(page,'talking');await part(page,'Mouth');await page.locator('#new-clip').click();await page.locator('#clip-name').fill('Hello');await page.locator('#clip-name').dispatchEvent('change');await page.locator('#clip-duration').fill('1');await page.locator('#clip-duration').dispatchEvent('change');await page.locator('#auto-key').check();
  for(const [time,value] of [[0,0],[.2,1],[.4,0],[.7,1],[1,0]]){await page.locator('#playhead').fill(String(time));await page.locator('#playhead').dispatchEvent('change');await page.locator('[data-control="mouthOpen"]').fill(String(value));await page.locator('[data-control="mouthOpen"]').dispatchEvent('change');}
  const lane=page.locator('.track').filter({hasText:'mouthOpen'}).locator('.key-lane'),box=await lane.boundingBox();await lane.locator('[data-key="mouthOpen|0.7"]').dragTo(lane,{targetPosition:{x:box.width*.6,y:box.height/2}});await expect(lane.locator('[data-key="mouthOpen|0.6"]')).toHaveCount(1);
  const mouth=page.locator('#mouth'),closed=await mouth.getAttribute('d');await page.locator('#clip-play').click();await expect.poll(()=>mouth.getAttribute('d')).not.toBe(closed);await page.locator('#clip-pause').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project'}).click();const path=await (await download).path();await page.locator('#project-file').setInputFiles(path);await expect(page.locator('#clip-name')).toHaveValue('Hello');await page.locator('#clip-play').click();await expect.poll(()=>mouth.getAttribute('d')).not.toBe(closed);
});
