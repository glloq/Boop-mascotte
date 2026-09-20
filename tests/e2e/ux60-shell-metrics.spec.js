/**
 * What the shell actually does with a window (UX-60 PR 0).
 *
 * The brief for the Shell V2 redesign is a list of claims about the current
 * interface: the mascot takes about half the width, the zoom sits well above
 * 100 %, capabilities are found by scrolling, `<details>` is doing the job of
 * navigation. Every one of those is measurable, and none of them should be
 * taken from an older document — so this measures them, per screen and per
 * viewport, and writes the numbers the redesign will be judged against.
 *
 * It asserts almost nothing on purpose. It is a **ruler**, not a gate: the
 * gates arrive with the layouts (§34), and a ruler that fails the build every
 * time a panel moves by a pixel is a ruler nobody keeps. What it does assert is
 * that it measured something at all, because a silent zero here would quietly
 * become a "before" column of zeroes in the report.
 *
 * Run it with `--grep @metrics`; it prints one JSON blob per viewport, which
 * `scripts/shell-metrics.mjs` turns into the table in
 * `docs/SHELL_V2_AUDIT.md`.
 */
import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/** The three windows the brief names (§33, PR 0). */
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 }
];

/** Every screen the four workspaces hold, plus Preview. */
const SCREENS = [
  'design.assemble', 'design.artwork', 'design.hands',
  'rig.assign', 'rig.controls', 'rig.head2d', 'rig.deform',
  'animate.expressions', 'animate.motions', 'animate.timeline',
  'behavior.reactions', 'behavior.automatic', 'behavior.stateMachine',
  'preview'
];

/**
 * One screen's geometry, read from the live DOM.
 *
 * Everything here is measured rather than derived from a stylesheet: the
 * question is what an author's window actually looks like, and a computed
 * width is the only honest answer to that.
 */
const measure = (page) => page.evaluate(() => {
  const visible = (node) => {
    if (!node) return false;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  /** Wholly inside the window, which is what "without scrolling" means. */
  const aboveFold = (node) => {
    const box = node.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth;
  };
  const width = window.innerWidth, height = window.innerHeight;
  const canvas = document.querySelector('#canvas');
  const canvasBox = canvas?.getBoundingClientRect();
  const stage = visible(canvas) && canvasBox?.width ? canvasBox.width : 0;

  // Anything that scrolls, and how far past its own bottom it goes. A panel
  // 1341px tall in an 836px column is the shape the audit is about.
  const scrollers = [...document.querySelectorAll('*')].filter((node) => {
    if (!visible(node)) return false;
    const style = getComputedStyle(node);
    const scrolls = /(auto|scroll)/.test(style.overflowY);
    return scrolls && node.scrollHeight - node.clientHeight > 8;
  }).map((node) => ({
    id: node.id || node.className?.toString().split(/\s+/)[0] || node.tagName.toLowerCase(),
    client: Math.round(node.clientHeight),
    scroll: Math.round(node.scrollHeight),
    hidden: Math.round(node.scrollHeight - node.clientHeight)
  }));

  // `<details>` standing in for navigation, which §7 says must stop.
  const disclosures = [...document.querySelectorAll('details')].filter(visible);

  const controls = [...document.querySelectorAll('input[type=range], [data-movement], [data-face-library-card], [data-pose-chip], [data-rig-control], [data-expression-item], [data-motion-select], [data-capability]')].filter(visible);

  const zoomText = document.querySelector('#zoom-value')?.textContent || '';
  return {
    width,
    height,
    stage: Math.round(stage),
    stagePct: width ? Math.round((stage / width) * 1000) / 10 : 0,
    taskPct: width ? Math.round(((width - stage) / width) * 1000) / 10 : 0,
    scrollers: scrollers.length,
    scrollHidden: scrollers.reduce((most, item) => Math.max(most, item.hidden), 0),
    worstScroller: scrollers.sort((a, b) => b.hidden - a.hidden)[0]?.id || null,
    disclosures: disclosures.length,
    disclosuresShut: disclosures.filter((node) => !node.open).length,
    controls: controls.length,
    controlsAboveFold: controls.filter(aboveFold).length,
    zoom: Number(String(zoomText).replace('%', '')) || null
  };
});

for (const viewport of VIEWPORTS) {
  test(`@metrics the shell, measured at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshEditor(page, { e2e: true });
    await startBasicFace(page);

    const rows = [];
    for (const screen of SCREENS) {
      await goToMode(page, screen);
      // The layout settles over a frame or two: a width read mid-transition is
      // a width no author ever saw.
      await page.waitForTimeout(250);
      rows.push({ screen, ...(await measure(page)) });
    }
    console.log(`\n@@METRICS ${viewport.name} ${JSON.stringify(rows)}\n`);

    // The ruler works: every screen reported a window and at least one of them
    // put something on screen. A run of zeroes would become a "before" column
    // of zeroes in the report, which is worse than no report.
    for (const row of rows) expect(row.width, `${row.screen} measured a window`).toBe(viewport.width);
    expect(rows.some((row) => row.controls > 0), 'some screen showed a control').toBe(true);
    expect(rows.filter((row) => row.stage > 0).length, 'the canvas is mounted on most screens').toBeGreaterThan(5);
  });
}
