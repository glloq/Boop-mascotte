import { expect } from '@playwright/test';

export async function openFreshEditor(page, { e2e = false } = {}) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(e2e ? './?e2e=1' : './');
  await expect(page.locator('[data-editor-ready="true"]')).toHaveCount(1);
  if (e2e) await expect.poll(() => page.evaluate(() => Boolean(window.__BOOP_E2E__))).toBe(true);
}
export async function goToWorkspace(page, workspace) {
  await page.locator(`.workspace-tab[data-workspace="${workspace}"]`).click();
  await expect(page.locator(`#app[data-workspace="${workspace}"]`), `Workspace did not change to "${workspace}"`).toHaveCount(1);
}
export const goToCreate = page => goToWorkspace(page, 'create');
export const goToRig = page => goToWorkspace(page, 'rig');
export async function goToAnimate(page) { await goToWorkspace(page, 'animate'); await openTimeline(page); }
export const goToPreview = page => goToWorkspace(page, 'preview');
export async function startBasicFace(page) {
  await expect(page.locator('#app:not(.has-project)[data-workspace="create"]'), 'startBasicFace requires a blank project in Create').toHaveCount(1);
  await page.locator('#empty-state [data-use-template="basic"]').click();
  const diagnostic = async () => page.evaluate(() => ({
    workspace: document.querySelector('#app')?.dataset.workspace,
    loaded: document.querySelector('#app')?.classList.contains('has-project'),
    semanticParts: Object.keys(window.__BOOP_E2E__?.state()?.semanticParts || {}),
    e2e: Boolean(window.__BOOP_E2E__),
    svgPresent: Boolean(document.querySelector('#canvas svg svg'))
  }));
  await expect.poll(async () => (await diagnostic()).loaded, { message: `Basic Face setup failed: ${JSON.stringify(await diagnostic())}`, timeout: 5000 }).toBe(true);
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();
  if ((await diagnostic()).e2e) await expect.poll(async () => (await diagnostic()).semanticParts, { timeout: 5000 }).toEqual(expect.arrayContaining(['head', 'gaze', 'mouth', 'eyes']));
}
export async function openTemplate(page,name) {
  if (name === 'Basic Face') return startBasicFace(page);
  await openMoreTemplates(page);
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}
export async function openArtwork(page) { await goToCreate(page); const panel=page.locator('.artwork-layers'); if (!await panel.getAttribute('open')) await panel.getByText('Artwork',{exact:true}).click(); }
export async function openMoreTemplates(page) { await goToCreate(page); const panel=page.locator('.create-tools > details.more-examples'); if (!await panel.getAttribute('open')) await panel.getByText('More templates',{exact:true}).click(); }
export async function openProjectMenu(page) {
  const menu=page.locator('details.file-menu');
  if (!(await menu.evaluate((element)=>element.hasAttribute('open')))) await page.getByLabel('More project actions').click();
  await expect.poll(()=>menu.evaluate((element)=>element.hasAttribute('open'))).toBe(true);
}
export async function enterFaceBuilder(page) {
  await goToCreate(page);
  const examples=page.locator('#empty-state details.more-examples');
  if (!(await examples.evaluate((element)=>element.hasAttribute('open')))) await examples.locator('summary').click();
  await expect(examples).toHaveAttribute('open','');
  await page.locator('#empty-face').click();
  await expect(page.locator('#face-builder[open]')).toHaveCount(1);
  for (const selector of ['#face-head', '#face-eyes', '#face-mouth', '#generate-face']) await expect(page.locator(selector)).toBeVisible();
}
export async function openTimeline(page) { const app=page.locator('#app'); if (await app.evaluate(el=>el.classList.contains('timeline-collapsed'))) await page.locator('#collapse-timeline').click(); }
export async function selectSemanticPartById(page,id) {
  await goToRig(page);
  const navigator=page.locator('#rig-parts[data-rig-navigator-ready="true"]');
  await expect(navigator).toBeVisible();
  const parts=navigator.locator('[data-semantic-part-id]');
  await expect(parts, 'Rig is ready but has no semantic Parts').not.toHaveCount(0);
  await expect(navigator.locator(`[data-semantic-part-id="${id}"]`), `Expected semantic Part "${id}"`).toHaveCount(1);
  await navigator.locator(`[data-semantic-part-id="${id}"] > button`).click();
  await expect(navigator.locator(`[data-semantic-part-id="${id}"]`)).toHaveAttribute('aria-selected', 'true');
}

export async function openSemanticControl(page, { part, control }) {
  await selectSemanticPartById(page, part);
  await page.locator('[data-rig-tab="controls"]').click();
  await expect(page.locator('[data-rig-tab="controls"]')).toHaveAttribute('aria-selected', 'true');
  const input = page.locator(`[data-control="${control}"]`);
  await expect(input, `Expected public Rig control "${control}" for semantic Part "${part}"`).toBeVisible();
  return input;
}

export const openGazeControl = page => openSemanticControl(page, { part: 'gaze', control: 'lookX' });

export async function setRangeControl(locator, value) {
  await locator.fill(String(value));
  await locator.dispatchEvent('input');
  await locator.dispatchEvent('change');
}

export async function hitTestablePoint(locator) {
  const point = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    for (let y = .1; y <= .9; y += .1) for (let x = .1; x <= .9; x += .1) {
      const clientX = rect.left + rect.width * x, clientY = rect.top + rect.height * y;
      const hit = document.elementFromPoint(clientX, clientY);
      if (hit === node || node.contains(hit)) return { x: clientX, y: clientY };
    }
    return null;
  });
  if (!point) throw new Error(`No painted, hit-testable point found for ${await locator.getAttribute('id') || 'SVG target'}`);
  return point;
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
  await openProjectMenu(page);
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

export async function readSvgTranslation(locator) {
  return locator.evaluate((node)=>{
    const value=node.getAttribute('transform')||'';
    const matrix=value.match(/matrix\(\s*[^, ]+[ ,]+[^, ]+[ ,]+[^, ]+[ ,]+[^, ]+[ ,]+([^, ]+)[ ,]+([^\) ]+)/i);
    if(matrix)return {x:Number(matrix[1]),y:Number(matrix[2])};
    const translate=value.match(/translate\(\s*([^, )]+)(?:[ ,]+([^\) ]+))?/i);
    return translate?{x:Number(translate[1]),y:Number(translate[2]||0)}:{x:0,y:0};
  });
}
