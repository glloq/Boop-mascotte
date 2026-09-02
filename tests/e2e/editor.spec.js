import { test, expect } from '@playwright/test';
import { goToAnimate, goToPreview, goToRig, openArtwork, openExport, openFreshEditor, openProjectMenu, selectLayerById, startBasicFace } from './editor-helpers.js';

function monitorErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`${error.message}\n${error.stack || '(no stack)'}\nURL: ${page.url()}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test('@critical blank editor boots safely and diagnostics stay opt-in', async ({ page }) => {
  const errors = monitorErrors(page);
  await openFreshEditor(page);
  await expect(page.locator('#app')).toHaveAttribute('data-editor-ready', 'true');
  for (const name of ['Create', 'Rig', 'Animate', 'Preview']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Save Project' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Problems' })).toBeVisible();
  expect(await page.evaluate(() => window.__BOOP_E2E__)).toBeUndefined();

  await page.getByLabel('More project actions').click();
  await page.getByRole('button', { name: 'New Project' }).click();
  await expect(page.locator('#unsaved-dialog')).not.toBeVisible();
  await expect(page.locator('[data-editor-ready="true"]')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save Project' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});


test('@critical dirty New Project supports Cancel, Discard, and Save then replacement', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const dirtyProject = async () => {
    await startBasicFace(page);
    await page.locator('[data-design-tool="rect"]').click();
    const canvas = await page.locator('#canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .35, canvas.y + canvas.height * .35);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .45, canvas.y + canvas.height * .45);
    await page.mouse.up();
    await expect(page.locator('#save-state')).toContainText('Unsaved');
  };
  const requestNew = async () => {
    await openProjectMenu(page);
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible();
  };

  await dirtyProject();
  const before = await page.evaluate(() => ({ state: window.__BOOP_E2E__.state(), diagnostics: window.__BOOP_E2E__.diagnostics() }));
  await requestNew();
  await page.getByRole('button', { name: 'Cancel' }).click();
  const afterCancel = await page.evaluate(() => ({ state: window.__BOOP_E2E__.state(), diagnostics: window.__BOOP_E2E__.diagnostics() }));
  expect(afterCancel.state).toEqual(before.state);
  expect(afterCancel.diagnostics.history).toEqual(before.diagnostics.history);
  await expect(page.locator('#save-state')).toContainText('Unsaved');

  await requestNew();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('#canvas svg svg')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save Project' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(page.locator('[data-semantic-part-id]')).toHaveCount(0);

  await dirtyProject();
  await requestNew();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).last().click();
  expect((await download).suggestedFilename()).toBe('mascot-project.json');
  await expect(page.locator('#canvas svg svg')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save Project' })).toBeDisabled();
});

test('@critical rendered editor IDs and touched ARIA references are valid', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const audit = async (label) => {
    const result = await page.locator('body').evaluate((body) => {
      const ids = [...body.querySelectorAll('[id]')].map((node) => node.id);
      const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
      const missing = [];
      for (const node of body.querySelectorAll('label[for],[aria-controls],[aria-labelledby],[aria-describedby]')) {
        const attributes = node.matches('label[for]') ? ['for'] : ['aria-controls','aria-labelledby','aria-describedby'];
        for (const attribute of attributes) for (const id of (node.getAttribute(attribute) || '').split(/\\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) missing.push(`${attribute}=${id}`);
        }
      }
      return { duplicates, missing };
    });
    expect(result, label).toEqual({ duplicates: [], missing: [] });
  };
  await audit('blank editor');
  await startBasicFace(page); await audit('Basic Face');
  await goToRig(page); await audit('Rig');
  await goToAnimate(page); await audit('Animate populated clip');
  await page.getByRole('button', { name: '+ New Animation', exact: true }).click(); await audit('Animate empty clip');
  await page.getByRole('button', { name: 'States', exact: true }).click(); await audit('States');
  await page.getByRole('button', { name: 'Problems' }).click(); await audit('Problems');
  await openExport(page); await audit('Export');
  await goToPreview(page); await audit('Preview');
});

test('@critical E2E seam is ready on a blank editor', async ({ page }) => {
  const errors = monitorErrors(page);
  await openFreshEditor(page, { e2e: true });
  expect(await page.evaluate(() => typeof window.__BOOP_E2E__.diagnostics)).toBe('function');
  expect(errors).toEqual([]);
});

test('@critical @smoke editor loads from the Pages base and reloads cleanly', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Start with Basic Face' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start with Basic Face', exact: true })).toBeVisible();
  await page.getByLabel('More project actions').click();
  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Preview/ })).toBeVisible();
  await expect(page.locator('#layers-panel')).toHaveCount(1);
  await expect(page.locator('#state-editor')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('@critical @smoke sample, preview and project download work', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Start with Basic Face', exact: true }).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await openArtwork(page);
  await expect(page.getByText(/Layers \(\d+\)/)).toBeVisible();
  await page.getByRole('button', { name: /Preview/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mascot-project.json');
  expect(JSON.parse(await (await download.createReadStream()).toArray().then((parts) => Buffer.concat(parts).toString()))).toMatchObject({ version: 3, document: { svgMarkup: expect.stringContaining('<svg'), rig: { schemaVersion: 3 }, editor: { semanticParts: expect.any(Object), animationClips: expect.any(Array), animationEditor: expect.any(Object) } } });
  expect(errors).toEqual([]);
});

test('@critical SVG import sanitizes executable content and remains editable', async ({ page }) => {
  const errors = monitorErrors(page);
  const external = [];
  page.on('request', (request) => { if (request.url().startsWith('https://example.invalid')) external.push(request.url()); });
  await page.goto('./');
  await page.locator('#empty-svg').setInputFiles('tests/e2e/fixtures/unsafe.svg');
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await expect(page.locator('#canvas script, #canvas foreignObject')).toHaveCount(0);
  await expect(page.locator('#canvas [onload], #canvas [onclick], #canvas [href^="javascript:"]')).toHaveCount(0);
  await selectLayerById(page, 'unsafe');
  const advanced=page.locator('.advanced-inspector');if(!await advanced.getAttribute('open'))await advanced.getByText('Advanced',{exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Inspector' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('project strings cannot inject executable markup', async ({ page }) => {
  const payload = '\"><img src=x onerror=window.__xss=1>';
  await page.goto('./');
  await page.getByRole('button', { name: 'Start with Basic Face', exact: true }).click();
  const project = { version: 2, document: { svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="safe"/></svg>', layers: [],
    layerMetadata: { safe: { name: payload } }, rig: { schemaVersion: 3, params: { safe: { default: 0, value: 0 } }, states: { [payload]: { safe: 0 } }, activeState: payload, transitions: {}, transitionSettings: {}, elements: {}, behaviors: [] } } };
  await page.locator('#project-file').setInputFiles({ name: 'hostile-project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('#app img')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.__xss))).toBe(false);
});

test('@critical @smoke runtime demo uses the real engine', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./demo/');
  await expect(page.getByRole('heading', { name: 'Runtime demo' })).toBeVisible();
  await page.getByLabel('lookX').fill('0.8');
  await expect(page.locator('#demo-eye')).toHaveAttribute('transform', /translate/);
  expect(errors).toEqual([]);
});

test('runtime resolves CSS-significant SVG ids by exact id', async ({ page }) => {
  await page.goto('./');
  const transforms = await page.evaluate(async () => {
    const { createMascotEngine } = await import('../runtime/runtime.js');
    document.body.innerHTML = '<svg id="mascot"><g id="eye.left"/><g id="head:main"/><g id="mouth.open"/></svg>';
    const elements = Object.fromEntries(['eye.left', 'head:main', 'mouth.open'].map((id) => [id, {
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      bindings: { translateX: { enabled: true, mode: 'advanced', expression: 'move', curve: 'linear', amplitude: 1, offset: 0 } }, constraints: {}
    }]));
    const rig = { params: { move: { default: 0, value: 0 } }, states: { idle: { move: 0 } }, activeState: 'idle', elements };
    const engine = createMascotEngine({ svgRoot: document.querySelector('#mascot'), rig, fps: 60 });
    engine.setParam('move', 7); engine.start();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); engine.stop();
    return Object.keys(elements).map((id) => document.getElementById(id).getAttribute('transform'));
  });
  transforms.forEach((value) => expect(value).toContain('translate(7 0)'));
});

test('@critical @smoke exported mascot, rig and standalone runtime execute together', async ({ page }) => {
  const errors = monitorErrors(page), downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.goto('./');
  await page.getByRole('button', { name: 'Start with Basic Face', exact: true }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  for (const name of ['mascot.svg', 'rig.json', 'runtime.js']) {
    const next=page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${name}` }).click();
    await next;
  }
  const outputs = {};
  for (const download of downloads) outputs[download.suggestedFilename()] = await (await download.createReadStream()).toArray().then((parts) => Buffer.concat(parts).toString());
  expect(Object.keys(outputs).sort()).toEqual(['mascot.svg', 'rig.json', 'runtime.js']);
  expect(outputs['runtime.js']).not.toMatch(/(?:from\s*|import\s*)['"]\.\.?\//);
  const transformed = await page.evaluate(async ({ svg, rigSource, runtimeSource }) => {
    document.body.innerHTML = `<div id="fixture">${svg}</div>`;
    const url = URL.createObjectURL(new Blob([runtimeSource], { type: 'text/javascript' }));
    try {
      const { createMascotEngine } = await import(url), rig = JSON.parse(rigSource);
      const engine = createMascotEngine({ svgRoot: document.querySelector('#fixture svg'), rig, fps: 60 });
      engine.setParam('lookX', .8); engine.setState('happy'); engine.start();
      await new Promise((resolve) => setTimeout(resolve, 100)); engine.stop();
      return Object.keys(rig.elements).some((id) => document.getElementById(id)?.hasAttribute('transform'));
    } finally { URL.revokeObjectURL(url); }
  }, { svg: outputs['mascot.svg'], rigSource: outputs['rig.json'], runtimeSource: outputs['runtime.js'] });
  expect(transformed).toBe(true);
  expect(errors).toEqual([]);
});

test('essential editor controls remain available on phone and tablet', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport); await page.goto('./');
    await expect(page.getByRole('button', { name: 'Start with Basic Face', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start with Basic Face', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save Project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    for (const name of ['Create','Rig','Animate','Preview']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
});
