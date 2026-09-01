import { test, expect } from '@playwright/test';

function monitorErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`${error.message}\n${error.stack || '(no stack)'}\nURL: ${page.url()}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test('@critical @smoke editor loads from the Pages base and reloads cleanly', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Start with Basic Face' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start with Basic Face', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: /unsafe/ }).click();
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
