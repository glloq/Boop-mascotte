import { expect } from '@playwright/test';

export async function openFreshEditor(page, { e2e = false } = {}) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(e2e ? './?e2e=1' : './');
  await expect(page.locator('[data-editor-ready="true"]')).toHaveCount(1);
  if (e2e) await expect.poll(() => page.evaluate(() => Boolean(window.__BOOP_E2E__))).toBe(true);
}
export const goToCreate = page => page.getByRole('button',{name:'Create',exact:true}).click();
export const goToRig = page => page.getByRole('button',{name:'Rig',exact:true}).click();
export async function goToAnimate(page) { await page.getByRole('button',{name:'Animate',exact:true}).click(); await openTimeline(page); }
export const goToPreview = page => page.getByRole('button',{name:'Preview',exact:true}).click();
export async function startBasicFace(page) { await page.getByRole('button',{name:'Start with Basic Face',exact:true}).click(); await expect(page.locator('#canvas svg svg')).toBeVisible(); }
export async function openTemplate(page,name) {
  if (name === 'Basic Face') return startBasicFace(page);
  await openMoreTemplates(page);
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}
export async function openArtwork(page) { await goToCreate(page); const panel=page.locator('.artwork-layers'); if (!await panel.getAttribute('open')) await panel.getByText('Artwork',{exact:true}).click(); }
export async function openMoreTemplates(page) { await goToCreate(page); const panel=page.locator('.create-tools > details.more-examples'); if (!await panel.getAttribute('open')) await panel.getByText('More templates',{exact:true}).click(); }
export async function openFaceBuilder(page) { await openMoreTemplates(page); const panel=page.locator('#face-builder'); if (!await panel.getAttribute('open')) await panel.getByText('Face Builder',{exact:true}).click(); }
export async function openTimeline(page) { const app=page.locator('#app'); if (await app.evaluate(el=>el.classList.contains('timeline-collapsed'))) await page.locator('#collapse-timeline').click(); }
export async function selectSemanticPartById(page,id) {
  await goToRig(page);
  const navigator=page.locator('#rig-parts[data-rig-navigator-ready="true"]');
  await expect(navigator).toBeVisible();
  const parts=navigator.locator('[data-semantic-part-id]');
  await expect(parts, 'Rig is ready but has no semantic Parts').not.toHaveCount(0);
  await expect(navigator.locator(`[data-semantic-part-id="${id}"]`), `Expected semantic Part "${id}"`).toHaveCount(1);
  await navigator.locator(`[data-semantic-part-id="${id}"] > button`).click();
}
export async function selectFirstSemanticPart(page) {
  await goToRig(page);
  const navigator=page.locator('#rig-parts[data-rig-navigator-ready="true"]');
  await expect(navigator).toBeVisible();
  const parts=navigator.locator('[data-semantic-part-id]');
  await expect(parts, 'Rig is ready but has no semantic Parts').not.toHaveCount(0);
  await parts.first().locator(':scope > button').click();
}
export async function selectLayerById(page,id) { await openArtwork(page); await page.locator(`[data-layer-id="${id}"] [data-action="select"]`).click(); }
export async function openRigPart(page,name) { await goToRig(page); await page.getByRole('button',{name,exact:true}).click(); }
export async function openRigTab(page,tab) { await page.getByRole('button',{name:tab,exact:true}).click(); }
export async function addSemanticPart(page,type) {
  await goToRig(page);
  await page.getByRole('button',{name:'+ Add Part',exact:true}).first().click();
  await page.getByRole('button',{name:new RegExp(`Add ${type}$`)}).click();
}
export async function pickSemanticRole(page,role,selector) {
  await page.getByRole('button',{name:new RegExp(`Pick artwork.*${role}|${role}.*Pick artwork`,'i')}).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-role-picking/);
  await page.locator(selector).click();
}
export async function openAdvanced(page) {
  await page.getByLabel('More project actions').click();
  const details=page.getByText('Advanced',{exact:true});
  if (!(await details.locator('..').getAttribute('open'))) await details.click();
}
export async function createAnimation(page,name) {
  await goToAnimate(page);
  await page.getByRole('button',{name:'+ New Animation',exact:true}).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Name').dispatchEvent('change');
}
export async function addTimelineControl(page,control) {
  await page.getByLabel('Control to add').selectOption(control);
  await page.getByRole('button',{name:'+ Add control',exact:true}).click();
}

export async function dragWithin(page,locator,{from={x:.5,y:.5},to}) {
  await locator.scrollIntoViewIfNeeded();
  const box=await locator.boundingBox();
  if (!box) throw new Error('Cannot drag an element without a bounding box.');
  const point=({x,y})=>({x:box.x+box.width*x,y:box.y+box.height*y});
  await page.mouse.move(...Object.values(point(from)));
  await page.mouse.down();
  await page.mouse.move(...Object.values(point(to)),{steps:6});
  await page.mouse.up();
}
