import { test, expect } from '@playwright/test';

function monitorErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test('@smoke editor loads from the Pages base and reloads cleanly', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Create your mascot' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start from Sample' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('@smoke sample, preview and project download work', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Start from Sample' }).click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await expect(page.getByText(/Layers \(\d+\)/)).toBeVisible();
  await page.getByRole('button', { name: /Preview/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Project' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('mascot-project.json');
  expect(JSON.parse(await (await download.createReadStream()).toArray().then((parts) => Buffer.concat(parts).toString()))).toMatchObject({ schemaVersion: expect.any(Number), document: { svgMarkup: expect.stringContaining('<svg') } });
  expect(errors).toEqual([]);
});

test('SVG import sanitizes executable content and remains editable', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./');
  await page.locator('#empty-svg').setInputFiles('tests/e2e/fixtures/unsafe.svg');
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await expect(page.locator('#canvas script, #canvas foreignObject')).toHaveCount(0);
  await expect(page.locator('#canvas [onload], #canvas [onclick], #canvas [href^="javascript:"]')).toHaveCount(0);
  await page.getByRole('button', { name: /unsafe/ }).click();
  await expect(page.getByRole('heading', { name: 'Inspector' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('rig and project strings cannot inject executable markup', async ({ page }) => {
  const payload = '\"><img src=x onerror=window.__xss=1>';
  await page.goto('./');
  await page.getByRole('button', { name: 'Start from Sample' }).click();
  await page.locator('#rig-file').setInputFiles({ name: 'hostile-rig.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    schemaVersion: 3, params: { safe: { default: 0, value: 0 } }, states: { [payload]: { safe: 0 } }, activeState: payload,
    elements: {}, behaviors: [], transitions: { [payload]: [] }
  })) });
  await expect(page.locator('#state-editor img')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.__xss))).toBe(false);

  const project = { version: 2, document: { svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg"><g id="safe"/></svg>', layers: [],
    layerMetadata: { safe: { name: payload } }, rig: { schemaVersion: 3, params: { safe: { default: 0, value: 0 } }, states: { [payload]: { safe: 0 } }, activeState: payload, transitions: {}, transitionSettings: {}, elements: {}, behaviors: [] } } };
  await page.locator('#project-file').setInputFiles({ name: 'hostile-project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('#app img')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.__xss))).toBe(false);
});

test('@smoke runtime demo uses the real engine', async ({ page }) => {
  const errors = monitorErrors(page);
  await page.goto('./demo/');
  await expect(page.getByRole('heading', { name: 'Runtime demo' })).toBeVisible();
  await page.getByLabel('lookX').fill('0.8');
  await expect(page.locator('#demo-eye')).toHaveAttribute('transform', /translate/);
  expect(errors).toEqual([]);
});

test('@smoke exported mascot, rig and standalone runtime execute together', async ({ page }) => {
  const errors = monitorErrors(page), downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.goto('./');
  await page.getByRole('button', { name: 'Start from Sample' }).click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect.poll(() => downloads.length).toBe(3);
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
    await expect(page.getByRole('button', { name: 'Start from Sample' })).toBeVisible();
    await page.getByRole('button', { name: 'Start from Sample' }).click();
    await expect(page.getByRole('button', { name: 'Save Project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    await expect(page.locator('#state-editor')).toBeVisible();
    await expect(page.locator('#preview-panel')).toBeVisible();
  }
});
