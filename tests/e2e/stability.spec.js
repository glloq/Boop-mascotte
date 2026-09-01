import { test, expect } from '@playwright/test';
import { createAnimation, goToAnimate, openFreshEditor, startBasicFace } from './editor-helpers.js';

const errors=[];
test.beforeEach(async({page})=>{errors.length=0;page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await openFreshEditor(page,{e2e:true});await startBasicFace(page);await createAnimation(page,'Stress');await page.evaluate(()=>window.__BOOP_E2E__.resetDiagnostics());});
test.afterEach(()=>expect(errors).toEqual([]));

for(const [name,second] of [['Play/Pause','clip-pause'],['Play/Stop','clip-stop']])test(`@stability rapid ${name} remains single-loop`,async({page})=>{
  for(let i=0;i<100;i++){await page.locator('#clip-play').click();await page.locator(`#${second}`).click();}
  const d=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());expect(d.preview.activeRaf).toBe(0);expect(d.store.mutations).toBe(second==='clip-stop'?100:0);await expect(page.locator('#clip-play')).toBeEnabled();
});

test('@stability repeated Space and preview toggling remain responsive',async({page})=>{
  await page.locator('.timeline-shell').focus();for(let i=0;i<100;i++)await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Preview',exact:true}).click();await page.getByRole('button',{name:'Animate',exact:true}).click();await goToAnimate(page);
  const d=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());expect(d.preview.activeRaf).toBeLessThanOrEqual(1);
});

test('@stability repeated SVG selection attaches one handler set',async({page})=>{
  const before=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());for(let i=0;i<100;i++)await page.locator('#canvas svg svg [id]').first().click();const after=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());expect(after.canvas.interactionAttachments).toBe(before.canvas.interactionAttachments);expect(after.store.mutations-before.store.mutations).toBe(100);
});

test('@stress extended lifecycle operations stay bounded',async({page})=>{
  test.setTimeout(120000);await page.evaluate(()=>{const play=document.querySelector('#clip-play'),pause=document.querySelector('#clip-pause');for(let i=0;i<1000;i++){play.click();pause.click();}for(let i=0;i<10000;i++)window.__BOOP_E2E__.setLiveParam('headX',i/10000);});const d=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics());expect(d.preview.activeRaf).toBe(0);expect(d.store.mutations).toBe(0);
});
