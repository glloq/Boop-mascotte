import { readFileSync } from 'node:fs';
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
export async function goToArtwork(page) {
  await page.locator('[data-task="artwork"]').click();
  await expect(page.locator('#app'), 'Artwork keeps the legacy create workspace contract').toHaveAttribute('data-workspace', 'create');
}
export const goToRig = page => goToWorkspace(page, 'rig');
/**
 * Face Setup is a stack of collapsible sections since the guided-journey pass.
 * Everything below "Face parts" starts closed, so a test that reaches into one
 * opens it exactly as a user would.
 */
export async function openSetupSection(page, id) {
  await goToRig(page);
  const section = page.locator(`[data-setup-section="${id}"]`);
  await expect(section).toHaveCount(1);
  if (!(await section.evaluate((element) => element.hasAttribute('open')))) await section.locator(':scope > summary').click();
  await expect(section).toHaveAttribute('open', '');
}
export async function goToAnimate(page) { await goToWorkspace(page, 'animate'); await openTimeline(page); }
export const goToPreview = page => goToWorkspace(page, 'preview');
/**
 * A project, without going through Home (V3-07, docs/V3_ROADMAP.md).
 *
 * Forty-four specs used to reach their starting document by clicking a card on
 * Home, so Home's markup was a contract this whole suite depended on and Home
 * could not be narrowed without breaking most of it at once. The editor's own
 * opt-in seam (`project/editor/app/e2e-hooks.js`) calls the same project
 * service Home's controls call -- same replacement, same landing task, same
 * `closeHome` -- so a spec that only needs a mascot on the canvas asks for one.
 * The specs that are *about* Home still press Home.
 *
 * Requires the seam: `openFreshEditor(page, { e2e: true })`.
 *
 * Exported as well as used here: it is the whole seam, so a spec that wants an
 * entry with no sugar around it -- or the `false` a refused replacement
 * returns -- has one.
 *
 * @returns {Promise<boolean>} what the project service returned.
 */
export function enterProject(page, entry, ...args) {
  return page.evaluate(([name, values]) => {
    if (!window.__BOOP_E2E__?.openProject) throw new Error('The project-entry seam is missing: open the editor with openFreshEditor(page, { e2e: true }).');
    return window.__BOOP_E2E__.openProject[name](...values);
  }, [entry, args]);
}

/** `enterProject`, for the callers that would only assert this afterwards. */
async function enterProjectSuccessfully(page, entry, ...args) {
  expect(await enterProject(page, entry, ...args), `openProject.${entry} did not open a project`).toBe(true);
  await expect(page.locator('#app.has-project'), `openProject.${entry} opened nothing`).toHaveCount(1);
  await expect(page.locator('[data-home]'), `openProject.${entry} left Home open`).toBeHidden();
}

/** A `tests/e2e/fixtures` file, as the text the seam hands the service. */
const fixtureText = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** One of `PROJECT_TEMPLATES`, landing where the template loader lands it. */
export const startTemplate = (page, kind, options) => enterProjectSuccessfully(page, 'template', kind, options);

/** The empty working area the drawing tools are tested on. */
export const startBlankCanvas = (page) => startTemplate(page, 'blank');

/** Artwork on its own: no rig, no semantic parts, exactly as an import leaves it. */
export const importArtworkFixture = (page, name) => enterProjectSuccessfully(page, 'svg', name, fixtureText(name));

/**
 * Basic Face the way a visitor gets it: by pressing the card on Home.
 *
 * The deployed editor has no seam -- `?e2e=1` is a developer URL and the
 * published build must never carry the hooks -- so the Pages smoke test is the
 * one place that still starts a project through Home's markup, and it says so
 * here rather than by accident.
 */
export async function startBasicFaceFromHome(page) {
  await expect(page.locator('[data-home]')).toBeVisible();
  await page.locator('[data-home] [data-template-id="basic"]').click();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();
}

export async function startBasicFace(page) {
  const before = await page.evaluate(() => window.__BOOP_E2E__?.diagnostics?.().store || null);
  await startTemplate(page, 'basic');
  const diagnostic = async () => page.evaluate(() => ({
    workspace: document.querySelector('#app')?.dataset.workspace,
    loaded: document.querySelector('#app')?.classList.contains('has-project'),
    semanticParts: Object.keys(window.__BOOP_E2E__?.state()?.semanticParts || {}),
    svgPresent: Boolean(document.querySelector('#canvas svg svg'))
  }));
  await expect(page.locator('#canvas svg svg #head'), `Basic Face setup failed: ${JSON.stringify(await diagnostic())}`).toBeVisible();
  await expect.poll(async () => (await diagnostic()).semanticParts, { timeout: 5000 }).toEqual(expect.arrayContaining(['head', 'gaze', 'mouth', 'eyes']));
  // The template loader stays off the legacy whole-document paths, whichever
  // door the project came through.
  const after = await page.evaluate(() => window.__BOOP_E2E__.diagnostics().store);
  if (before) {
    expect(after.legacySetState - before.legacySetState).toBe(0);
    expect(after.wholeDocumentMutationClones - before.wholeDocumentMutationClones).toBe(0);
  }
}

/**
 * Basic Face with its authored lists emptied, for the journeys that are *about*
 * authoring one.
 *
 * The template ships every face, motion and reaction the catalogues can build
 * on it, so "add your first expression" has nothing left to add and "Add Happy
 * preset" is not a button any more. That is the template doing its job and the
 * wrong fixture for a test about adding one, so these tests start from the same
 * mascot with the three lists cleared: same artwork, same rig, same automatic
 * life, nothing authored on top of it.
 *
 * `clear` names which lists to empty, for the tests that need only some of them
 * gone -- the Reaction Studio will not let a reaction be created at all unless
 * the project has a face or a clip to react with, so a reaction test clears the
 * reactions and keeps the rest.
 *
 * Requires the E2E seam (`openFreshEditor(page, { e2e: true })`).
 */
export async function startEmptyBasicFace(page, { clear = ['expressions', 'animationClips', 'reactions'] } = {}) {
  await startBasicFace(page);
  await page.evaluate((lists) => window.__BOOP_E2E__.mutate((state) => {
    for (const list of lists) state[list] = [];
    if (lists.includes('animationClips')) state.animationEditor = { ...state.animationEditor, activeClipId: null };
  }), clear);
  await expect.poll(() => page.evaluate((lists) => {
    const document = window.__BOOP_E2E__.document();
    return lists.map((list) => document[list].length);
  }, clear)).toEqual(clear.map(() => 0));
}

/**
 * A mascot the Face Builder made: rigged, and with **no hands**.
 *
 * Basic Face ships a pair now, so "draw a pair of hands" has nothing to draw
 * there. A built face is the other mascot the editor can make on its own — a
 * head, eyes, brows and a mouth, rigged through the same
 * `applyTemplateProject` — and it is the one a pair of hands is still added to.
 */
export async function startBuiltFace(page) {
  // The Face Builder's own defaults, which is what its three selects start on.
  await enterProjectSuccessfully(page, 'face', { head: 'circle', eyes: 'oval', mouth: 'smile' });
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();
}

export async function openArtwork(page) {
  // Fresh apps belong to Home. Editor helpers only interact after a project is
  // established; they must never reach through the interaction-blocking Home.
  await expect(page.locator('[data-home]'), 'openArtwork requires an established project with Home closed').toBeHidden();
  await goToArtwork(page);
  // The task tab carries a readiness badge (e.g. "Artwork ✓"); only the label is a contract.
  await expect(page.locator('[data-task="artwork"]')).toContainText('Artwork');
  await expect(page.getByRole('tree', { name: 'Layers' })).toBeVisible();
}
// <details open> exposes an empty-string attribute; only the boolean property is a reliable disclosure state.
const isOpen = details => details.evaluate(element => element.hasAttribute('open'));
/** The Artwork panel's own disclosure: what can be added to the drawing there is. */
export async function openAddArtwork(page) {
  await goToArtwork(page);
  const create=page.locator('details.artwork-create');
  if (!(await isOpen(create))) await create.locator(':scope > summary').getByText('Add / Create artwork', { exact: true }).click();
  await expect(create).toHaveAttribute('open', '');
}
export async function openProjectMenu(page) {
  const menu=page.locator('details.file-menu');
  if (!(await menu.evaluate((element)=>element.hasAttribute('open')))) await page.getByLabel('More project actions').click();
  await expect.poll(()=>menu.evaluate((element)=>element.hasAttribute('open'))).toBe(true);
}
/**
 * Building a face is a way to start a mascot, so it is on Home beside the other
 * two -- not three disclosures deep in the panel for adding to artwork you
 * already have.
 */
export async function enterFaceBuilder(page) {
  if (!(await page.locator('[data-home]').isVisible())) await page.locator('#home-button').click();
  await expect(page.locator('[data-home]')).toBeVisible();
  const card=page.locator('[data-home-action="builder"]');
  await expect(card).toBeVisible();
  if (await page.locator('#face-builder').isHidden()) await card.click();
  await expect(card).toHaveAttribute('aria-expanded','true');
  for (const selector of ['#face-head', '#face-eyes', '#face-mouth', '#generate-face']) await expect(page.locator(selector)).toBeVisible();
}
export async function openTimeline(page) { const app=page.locator('#app'); if (await app.evaluate(el=>el.classList.contains('timeline-collapsed'))) await page.locator('#collapse-timeline').click(); }
export async function selectSemanticPartById(page,id) {
  await openSetupSection(page, 'all-parts');
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
    // Whole pixels only. The point this returns is handed to `mouse.click`,
    // and Chromium hit-tests a click at pixel resolution while
    // `elementsFromPoint` honours the fraction -- on the edge of a shape the
    // two disagree (399.91 is the cheek shading, 399 is the head behind it),
    // so a point that probed clean was clicked on its neighbour and the menu
    // opened for the wrong piece. Probe where the click will actually land.
    const probe=(rawX,rawY,source)=>{
      const x=Math.round(rawX),y=Math.round(rawY);
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
  await openSetupSection(page, 'all-parts');
  const navigator=page.locator('#rig-parts[data-rig-navigator-ready="true"]');
  await expect(navigator).toBeVisible();
  const parts=navigator.locator('[data-semantic-part-id]');
  await expect(parts, 'Rig is ready but has no semantic Parts').not.toHaveCount(0);
  await parts.first().locator(':scope > button').click();
}
export async function selectLayerById(page,id) { await openArtwork(page); await page.locator(`[data-layer-id="${id}"] [data-action="select"]`).click(); }
export async function openRigPart(page,name) { await openSetupSection(page, 'all-parts'); await page.getByRole('button',{name,exact:true}).click(); }
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
  if (!(await isOpen(details))) await details.locator(':scope > summary').click();
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
  await page.getByRole('button',{name:'+ New motion',exact:true}).click();
  // Exact: the Expressions inputs also carry "name" in their labels.
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Name', { exact: true }).dispatchEvent('change');
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
