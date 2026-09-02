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
  // Home is the canonical first-run entry since UX-03; do not reach through it
  // to the legacy Canvas empty-state controls.
  await expect(page.locator('[data-home]')).toBeVisible();
  const basicFaceCard = page.locator('[data-home] [data-template-id="basic"]');
  await expect(basicFaceCard).toBeVisible();
  const before=await page.evaluate(()=>window.__BOOP_E2E__?.diagnostics?.().store||null);
  await basicFaceCard.click();
  const diagnostic = async () => page.evaluate(() => ({
    workspace: document.querySelector('#app')?.dataset.workspace,
    loaded: document.querySelector('#app')?.classList.contains('has-project'),
    semanticParts: Object.keys(window.__BOOP_E2E__?.state()?.semanticParts || {}),
    e2e: Boolean(window.__BOOP_E2E__),
    svgPresent: Boolean(document.querySelector('#canvas svg svg'))
  }));
  await expect.poll(async () => (await diagnostic()).loaded, { message: `Basic Face setup failed: ${JSON.stringify(await diagnostic())}`, timeout: 5000 }).toBe(true);
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();
  if ((await diagnostic()).e2e) {
    await expect.poll(async () => (await diagnostic()).semanticParts, { timeout: 5000 }).toEqual(expect.arrayContaining(['head', 'gaze', 'mouth', 'eyes']));
    const after=await page.evaluate(()=>window.__BOOP_E2E__.diagnostics().store);
    expect(after.legacySetState-before.legacySetState).toBe(0);
    expect(after.wholeDocumentMutationClones-before.wholeDocumentMutationClones).toBe(0);
  }
}
export async function openTemplate(page,name) {
  if (name === 'Basic Face') return startBasicFace(page);
  await openMoreTemplates(page);
  await page.getByRole('button',{name,exact:true}).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}
export async function openArtwork(page) {
  // Fresh apps belong to Home. Editor helpers only interact after a project is
  // established; they must never reach through the interaction-blocking Home.
  await expect(page.locator('[data-home]'), 'openArtwork requires an established project with Home closed').toBeHidden();
  await goToCreate(page);
  const panel=page.locator('.artwork-layers');
  if (!await panel.getAttribute('open')) await panel.getByText('Artwork',{exact:true}).click();
}
export async function openMoreTemplates(page) { await goToCreate(page); const panel=page.locator('.create-tools > details.more-examples'); if (!await panel.getAttribute('open')) await panel.getByText('More templates',{exact:true}).click(); }
export async function openProjectMenu(page) {
  const menu=page.locator('details.file-menu');
  if (!(await menu.evaluate((element)=>element.hasAttribute('open')))) await page.getByLabel('More project actions').click();
  await expect.poll(()=>menu.evaluate((element)=>element.hasAttribute('open'))).toBe(true);
}
export async function enterFaceBuilder(page) {
  if (await page.locator('[data-home]').isVisible()) await startBasicFace(page);
  await goToCreate(page);
  await expect(page.locator('[data-home]')).toBeHidden();
  const examples=page.locator('.create-tools > details.more-examples');
  if (!(await examples.evaluate((element)=>element.hasAttribute('open')))) await examples.locator('summary').click();
  await expect(examples).toHaveAttribute('open','');
  const builder=examples.locator('#face-builder');
  if (!(await builder.evaluate((element)=>element.hasAttribute('open')))) await builder.locator('summary').click();
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
  const input = page.locator(`[data-rig-control="${part}:${control}"]`);
  await expect(input, `Expected exactly one public Rig control "${control}" for semantic Part "${part}"`).toHaveCount(1);
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  return input;
}

export const openGazeControl = page => openSemanticControl(page, { part: 'gaze', control: 'lookX' });

export async function setRangeControl(locator, value) {
  await locator.fill(String(value));
  // fill() uses the native range-input contract and already emits input. A
  // genuine keyboard nudge proves that the control remains live/user-operable,
  // then restore the requested value and commit once.
  const step = Number(await locator.getAttribute('step')) || 1;
  await locator.press(value + step <= Number(await locator.getAttribute('max')) ? 'ArrowRight' : 'ArrowLeft');
  await locator.fill(String(value));
  await locator.blur();
}

export async function hitTestablePoint(locator) {
  const result = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style=getComputedStyle(node),sampled=[];
    const describe=element=>element?{tag:element.tagName,id:element.id||'',class:element.getAttribute?.('class')||'',pointerEvents:getComputedStyle(element).pointerEvents,owner:element.closest?.('[id]')?.id||''}:null;
    const probe=(x,y,source)=>{
      const stack=document.elementsFromPoint(x,y),top=stack[0];
      sampled.push({x,y,source,top:describe(top),stack:stack.slice(0,8).map(describe)});
      // A point is valid only when the artwork itself (or its own child) is
      // topmost. elementsFromPoint is retained for actionable obstruction data,
      // never as a click-through shortcut.
      return top===node||node.contains(top)?{x,y}:null;
    };
    if(typeof node.getTotalLength==='function'&&typeof node.getPointAtLength==='function'&&node.getScreenCTM){
      const length=node.getTotalLength(),matrix=node.getScreenCTM();
      if(matrix&&Number.isFinite(length))for(let index=0;index<=40;index++){
        const local=node.getPointAtLength(length*index/40),screen=new DOMPoint(local.x,local.y).matrixTransform(matrix);
        const scale=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d),.01);
        const radius=Math.max(.5,Math.min(3,(parseFloat(style.strokeWidth)||1)*scale/2));
        for(const [dx,dy] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
          const point=probe(screen.x+dx,screen.y+dy,'geometry');if(point)return {point};
        }
      }
    }
    for (let y = .05; y <= .95; y += .05) for (let x = .05; x <= .95; x += .05) {
      const point=probe(rect.left+rect.width*x,rect.top+rect.height*y,'bbox');
      if(point)return {point};
    }
    return {diagnostic:{target:{id:node.id||'',tag:node.tagName},rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},fill:style.fill,stroke:style.stroke,strokeWidth:style.strokeWidth,geometryLength:typeof node.getTotalLength==='function'?node.getTotalLength():null,selectedId:window.__BOOP_E2E__?.state?.().selectedId,selectionOverlayCount:document.querySelectorAll('.svg_select_boundingRect').length,resizeHandleCount:document.querySelectorAll('.svg_select_points').length,interactionAttachments:window.__BOOP_E2E__?.diagnostics?.()['canvas.interactionAttachments'],sampled}};
  });
  if (!result.point) throw new Error(`No painted, hit-testable point found: ${JSON.stringify(result.diagnostic)}`);
  return result.point;
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
  await expect(page.locator('[data-home]'), 'addSemanticPart requires an established project with Home closed').toBeHidden();
  const inspector=page.locator('#context-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector.locator('[data-inspector-adapter="semantic"]')).toBeVisible();
  await expect(inspector).toHaveAttribute('data-context-kind',/^(none|semantic-part|semantic-control)$/);
  await inspector.getByRole('button',{name:'+ Add Part',exact:true}).click();
  await inspector.getByRole('button',{name:`Add ${type}`,exact:true}).click();
}
export async function pickSemanticRole(page,role,selector) {
  await page.getByRole('button',{name:new RegExp(`Pick artwork.*${role}|${role}.*Pick artwork`,'i')}).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-role-picking/);
  await page.locator(selector).click();
}
export async function openAdvanced(page) {
  await openProjectMenu(page);
  const details=page.locator('details.file-menu .menu-popover > details');
  await expect(details).toHaveCount(1);
  if (!(await details.getAttribute('open'))) await details.locator(':scope > summary').click();
}
export async function openExport(page) {
  await page.locator('[data-action="open-export"]').click();
  const panel=page.locator('#export-panel');
  await expect(panel, `Export did not become ready: ${JSON.stringify(await page.evaluate(() => ({workspace:document.querySelector('#app')?.dataset.workspace,problemsVisible:!document.querySelector('#problems-panel')?.hidden,exportHidden:document.querySelector('#export-panel')?.hidden,exportState:document.querySelector('#export-panel')?.dataset.exportState,status:document.querySelector('#toast')?.textContent})))}`).toHaveAttribute('data-export-state','ready');
  await expect(panel).toBeVisible();
  return panel;
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
