import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

test('@critical task navigation and contextual selection remain session-only', async ({page}) => {
  await openFreshEditor(page,{e2e:true});
  await startBasicFace(page);
  const before=await page.evaluate(()=>({document:window.__BOOP_E2E__.document(),token:window.__BOOP_E2E__.documentVersionToken(),revisions:window.__BOOP_E2E__.documentRevisions(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  await page.evaluate(()=>window.__BOOP_E2E__.navigate({task:'artwork',target:{kind:'artwork-element',id:'head'}}));
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind','artwork');
  await page.evaluate(()=>window.__BOOP_E2E__.navigate({task:'face-setup',target:{kind:'semantic-part',id:'gaze'}}));
  await expect(page.locator('#app')).toHaveAttribute('data-workspace','rig');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind','semantic-part');
  await page.evaluate(()=>window.__BOOP_E2E__.navigate('preview'));
  await page.evaluate(()=>window.__BOOP_E2E__.navigate('face-setup'));
  const after=await page.evaluate(()=>({document:window.__BOOP_E2E__.document(),token:window.__BOOP_E2E__.documentVersionToken(),revisions:window.__BOOP_E2E__.documentRevisions(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  expect(after).toEqual(before);
});

test('diagnostic deep-link activates its canonical task', async ({page}) => {
  await openFreshEditor(page,{e2e:true});
  const route=await page.evaluate(()=>window.__BOOP_E2E__.navigate({task:'create',target:{kind:'diagnostic',diagnosticId:'artwork.missing'}}));
  expect(route.task).toBe('artwork');
  expect(await page.evaluate(()=>window.__BOOP_E2E__.task())).toBe('artwork');
});
