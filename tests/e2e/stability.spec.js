import { test, expect } from '@playwright/test';
import { createAnimation, goToAnimate, goToPreview, hitTestablePoint, openFreshEditor, startBasicFace } from './editor-helpers.js';

const errors=[];
const snapshot=page=>page.evaluate(()=>({diagnostics:window.__BOOP_E2E__.diagnostics(),history:window.__BOOP_E2E__.history(),dirty:document.querySelector('#save-state').classList.contains('dirty')}));
test.beforeEach(async({page})=>{errors.length=0;page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await openFreshEditor(page,{e2e:true});await startBasicFace(page);await createAnimation(page,'Stress');await page.evaluate(()=>window.__BOOP_E2E__.resetDiagnostics());});
test.afterEach(()=>expect(errors).toEqual([]));

// Two hundred clicks on a mascot that is always moving: the template ships its
// idle behaviors running, so every click waits for a stable frame first. What
// is asserted is that nothing grows, not how fast a shared runner gets there.
for(const [name,second] of [['Play/Pause','clip-pause'],['Play/Stop','clip-stop']])test(`@stability rapid ${name} remains single-loop`,async({page})=>{
  test.setTimeout(90000);
  for(let i=0;i<100;i++){await page.locator('#clip-play').click();await page.locator(`#${second}`).click();}
  const d=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());expect(d.preview.activeRaf).toBeLessThanOrEqual(1);expect(d.preview.starts-d.preview.stops).toBeLessThanOrEqual(1);expect(d.preview.playing).toBe(false);await expect(page.locator('#clip-play')).toBeEnabled();
});

test('@stability repeated Space remains responsive and transient',async({page})=>{
  const before=await snapshot(page);await page.locator('.timeline-shell').focus();for(let i=0;i<100;i++)await page.keyboard.press('Space');
  const after=await snapshot(page);expect(after.diagnostics.preview.activeRaf).toBeLessThanOrEqual(1);expect(after.history).toEqual(before.history);expect(after.dirty).toBe(before.dirty);await expect(page.locator('#clip-play')).toBeEnabled();
});

test('@stability Preview workspace switching remains transient',async({page})=>{
  // Two hundred workspace switches, each waiting on the DOM: what is asserted
  // is that nothing grows, not how long the loop takes on a shared runner.
  test.setTimeout(60000);
  const before=await snapshot(page);for(let i=0;i<100;i++){await goToPreview(page);await goToAnimate(page);}
  const after=await snapshot(page);expect(after.history).toEqual(before.history);expect(after.dirty).toBe(before.dirty);expect(after.diagnostics.preview.activeRaf).toBeLessThanOrEqual(1);
});

test('@stability Focus Preview enters and exits without lifecycle growth',async({page})=>{
  test.setTimeout(90000);
  await goToPreview(page);const before=await snapshot(page);
  for(let i=0;i<100;i++){await page.locator('#focus-preview').click();await expect(page.locator('#app')).toHaveClass(/focus-preview/);await page.locator('#exit-focus').click();await expect(page.locator('#app')).not.toHaveClass(/focus-preview/);}
  const after=await snapshot(page);expect(after.history).toEqual(before.history);expect(after.dirty).toBe(before.dirty);expect(after.diagnostics.preview.activeRaf).toBeLessThanOrEqual(1);
});

test('@stability repeated SVG selection attaches one handler set',async({page})=>{
  await page.locator('.workspace-tab[data-workspace="create"]').click();const targets=[page.locator('#head'),page.locator('#mouth')];const before=await snapshot(page);
  for(let i=0;i<100;i++){const point=await hitTestablePoint(targets[i%2]);await page.mouse.click(point.x,point.y);await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.state().selectedId)).toBe(i%2?'mouth':'head');await expect(page.locator('[data-editor-selected=true]')).toHaveCount(1);}
  const after=await snapshot(page);expect(after.diagnostics.canvas.interactionAttachments).toBe(before.diagnostics.canvas.interactionAttachments);expect(after.history).toEqual(before.history);expect(after.dirty).toBe(before.dirty);
});

test('@stress extended lifecycle operations stay bounded',async({page})=>{
  test.setTimeout(120000);await page.evaluate(()=>{const play=document.querySelector('#clip-play'),pause=document.querySelector('#clip-pause');for(let i=0;i<1000;i++){play.click();pause.click();}for(let i=0;i<10000;i++)window.__BOOP_E2E__.setLiveParam('headX',i/10000);});const d=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());expect(d.preview.activeRaf).toBeLessThanOrEqual(1);expect(d.preview.starts-d.preview.stops).toBeLessThanOrEqual(1);
});
