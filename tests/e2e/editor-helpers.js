import { expect } from '@playwright/test';

export async function openFreshEditor(page, { e2e = false } = {}) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(e2e ? './?e2e=1' : './');
  if (e2e) await expect.poll(() => page.evaluate(() => Boolean(window.__BOOP_E2E__))).toBe(true);
}
export const goToCreate = page => page.getByRole('button',{name:'Create',exact:true}).click();
export const goToRig = page => page.getByRole('button',{name:'Rig',exact:true}).click();
export async function goToAnimate(page) { await page.getByRole('button',{name:'Animate',exact:true}).click(); await openTimeline(page); }
export const goToPreview = page => page.getByRole('button',{name:'Preview',exact:true}).click();
export async function startBasicFace(page) { await page.getByRole('button',{name:'Start with Basic Face',exact:true}).click(); await expect(page.locator('#canvas svg svg')).toBeVisible(); }
export async function openArtwork(page) { await goToCreate(page); const panel=page.locator('.artwork-layers'); if (!await panel.getAttribute('open')) await panel.getByText('Artwork',{exact:true}).click(); }
export async function openMoreTemplates(page) { await goToCreate(page); const panel=page.locator('.create-tools > details.more-examples'); if (!await panel.getAttribute('open')) await panel.getByText('More templates',{exact:true}).click(); }
export async function openFaceBuilder(page) { await openMoreTemplates(page); const panel=page.locator('#face-builder'); if (!await panel.getAttribute('open')) await panel.getByText('Face Builder',{exact:true}).click(); }
export async function openTimeline(page) { const app=page.locator('#app'); if (await app.evaluate(el=>el.classList.contains('timeline-collapsed'))) await page.locator('#collapse-timeline').click(); }
export async function selectSemanticPartById(page,id) { await goToRig(page); await page.locator(`[data-semantic-part-id="${id}"]`).click(); }
export async function selectFirstSemanticPart(page) { await goToRig(page); await page.locator('[data-semantic-part-id]').first().click(); }
export async function selectLayerById(page,id) { await openArtwork(page); await page.locator(`[data-layer-id="${id}"] [data-action="select"]`).click(); }
