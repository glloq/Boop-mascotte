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

test('@critical empty Face Setup creation is accessible and preserves ownership until Add Head', async ({page}) => {
  await openFreshEditor(page,{e2e:true});
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-head.svg');
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__BOOP_E2E__.task())).toBe('artwork');
  const imported=await page.evaluate(()=>window.__BOOP_E2E__.document());
  expect(imported.svgMarkup).toContain('<svg');
  expect(Object.keys(imported.elements)).not.toHaveLength(0);
  expect(imported.semanticParts).toEqual({});
  await page.evaluate(()=>window.__BOOP_E2E__.navigate('face-setup'));
  const inspector=page.locator('#context-inspector');
  await expect(inspector).toHaveAttribute('data-context-kind','none');
  await expect(inspector.getByText('No face parts yet',{exact:true})).toBeVisible();
  const checkpoint=()=>page.evaluate(()=>({document:window.__BOOP_E2E__.document(),token:window.__BOOP_E2E__.documentVersionToken(),revisions:window.__BOOP_E2E__.documentRevisions(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty(),mutations:window.__BOOP_E2E__.diagnostics().store.documentMutations}));
  const before=await checkpoint();
  await inspector.getByRole('button',{name:'+ Add Part',exact:true}).click();
  const catalog=inspector.getByRole('dialog',{name:'Add a Part'});
  await expect(catalog).toBeVisible();
  await expect(catalog.getByRole('button',{name:'Add Head',exact:true})).toBeVisible();
  await catalog.getByRole('button',{name:'Close part catalog'}).click();
  expect(await checkpoint()).toEqual(before);
  await inspector.getByRole('button',{name:'+ Add Part',exact:true}).click();
  expect(await checkpoint()).toEqual(before);
  await inspector.getByRole('button',{name:'Add Head',exact:true}).click();
  await expect(inspector).toHaveAttribute('data-context-kind','semantic-part');
  await expect(inspector.getByRole('heading',{name:'Face Part Inspector',exact:true})).toBeVisible();
  const after=await checkpoint();
  expect(after.document.semanticParts.head?.id).toBe('head');
  expect(after.history.canUndo).toBe(true);
  expect(after.mutations-before.mutations).toBe(1);
  expect(await page.evaluate(()=>window.__BOOP_E2E__.session().activeSemanticPartId)).toBe('head');
});
