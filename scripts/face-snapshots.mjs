#!/usr/bin/env node
/**
 * Reference views of the face template, rendered by the real runtime.
 *
 * A redesign of the artwork is a change nobody can review from a diff: what
 * matters is whether the mouth still reads as a mouth at `mouthOpen 1`, whether
 * a blink actually covers the eye, whether a full turn leaves anything behind.
 * So this poses the shipped template through the exported runtime — the same
 * `mascot.svg`, `rig.json` and `runtime.js` a page would serve — and writes one
 * PNG per pose, plus a contact sheet of the lot.
 *
 *     node scripts/face-snapshots.mjs out/face-v2
 *
 * Nothing here is checked in: the images are a review aid, and the invariants
 * worth defending in CI are asserted numerically in `face-geometry.test.js`,
 * which needs no browser.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTemplateExport } from '../project/editor/core/sample/templates/template-export.js';
import { createRuntimeSource } from './demo-assets.mjs';

const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/**
 * The poses worth looking at: every expression the brief names, the eyelid
 * range, the gaze extremes, the mouth, and the head turn.
 */
export const SNAPSHOT_POSES = Object.freeze([
  { name: 'neutral', params: {} },
  { name: 'happy', params: { smile: 1, browRaise: .35, eyeOpen: .92 } },
  { name: 'smile', params: { smile: .6 } },
  { name: 'laugh', params: { smile: 1, mouthOpen: .85, teeth: 1, tongue: .5, browRaise: .5, eyeOpen: .45 } },
  { name: 'sad', params: { smile: -.8, browInner: .9, browRaise: -.2, lookY: .35, eyeOpen: .8 } },
  { name: 'angry', params: { smile: -.55, browInner: -1, browRaise: -.3, eyeOpen: 1, mouthWidth: -.2 } },
  { name: 'surprised', params: { mouthOpen: 1, browRaise: 1, eyeOpen: 1 } },
  { name: 'worried', params: { browInner: .85, smile: -.35, browRaise: .15 } },
  { name: 'sceptical', params: { browRaiseLeft: .9, browRaiseRight: -.6, smile: .25, smileRight: .5 } },
  { name: 'blink', params: { eyeOpen: 0 } },
  { name: 'half-blink', params: { eyeOpen: .5 } },
  { name: 'wink', params: { eyeOpen: 1, eyeOpenLeft: -1 } },
  { name: 'look-left', params: { lookX: -1 } },
  { name: 'look-right', params: { lookX: 1 } },
  { name: 'look-up', params: { lookY: -1 } },
  { name: 'look-down', params: { lookY: 1 } },
  { name: 'mouth-open', params: { mouthOpen: 1 } },
  { name: 'mouth-open-teeth', params: { mouthOpen: 1, teeth: 1, tongue: .6 } },
  { name: 'jaw-open', params: { jawOpen: 1 } },
  { name: 'head-left', params: { headX: -1 } },
  { name: 'head-right', params: { headX: 1 } },
  { name: 'head-up', params: { headY: -1 } },
  { name: 'head-down', params: { headY: 1 } },
  { name: 'head-tilt', params: { headTilt: 1 } },
  { name: 'turn-and-smile', params: { headX: .7, smile: .8, lookX: -.4 } }
]);

const page = (svg, runtime) => `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#f4efe6}
  #stage{width:320px;height:320px;display:grid;place-items:center}
  #stage svg{width:300px;height:300px;overflow:visible}
</style>
<div id="stage">${svg}</div>
<script type="module">
${runtime}
let engine = null, pending = null, clock = 0;
window.__pose = (rig, params) => {
  if (!engine) {
    engine = createMascotEngine({
      svgRoot: document.querySelector('#stage svg'), rig,
      requestFrame: (callback) => { pending = callback; return 1; }, cancelFrame: () => {},
      now: () => clock, random: () => .5
    });
    engine.start();
    // A snapshot with the idle blink running is a coin toss.
    for (const behavior of rig.behaviors || []) engine.setBehaviorEnabled(behavior.id, false);
  }
  engine.clearParams();
  for (const [name, value] of Object.entries(params)) engine.setParam(name, value);
  // Repeatedly, because the followers are springs: one tick poses the head and
  // the hair is still on its way.
  for (let index = 0; index < 40; index += 1) {
    clock += 100;
    const run = pending; pending = null;
    if (run) run(clock);
  }
};
window.__ready = true;
</script>`;

export async function renderSnapshots(outDir, { poses = SNAPSHOT_POSES } = {}) {
  const { chromium } = await import('@playwright/test');
  const { svg, rig } = createTemplateExport();
  const runtime = await createRuntimeSource();
  const browser = await chromium.launch({ executablePath: CHROME });
  const view = await browser.newPage({ viewport: { width: 320, height: 320 }, deviceScaleFactor: 2 });
  await view.setContent(page(svg, runtime));
  await view.waitForFunction(() => window.__ready === true);
  await mkdir(outDir, { recursive: true });
  const written = [];
  for (const pose of poses) {
    await view.evaluate(([document_, values]) => window.__pose(document_, values), [rig, pose.params]);
    const file = resolve(outDir, `${pose.name}.png`);
    await view.locator('#stage').screenshot({ path: file });
    written.push({ name: pose.name, file });
  }
  await writeFile(resolve(outDir, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Face snapshots</title>`
    + `<style>body{font:13px system-ui;background:#20242b;color:#e8e4dc;margin:16px}`
    + `ul{list-style:none;display:flex;flex-wrap:wrap;gap:12px;padding:0}figcaption{text-align:center;padding-top:4px}`
    + `img{width:200px;height:200px;border-radius:8px}</style><ul>`
    + written.map(({ name }) => `<li><figure><img src="${name}.png" alt="${name}"><figcaption>${name}</figcaption></figure></li>`).join('')
    + '</ul>');
  await browser.close();
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] || 'out/face-snapshots');
  const files = await renderSnapshots(out);
  console.log(`Wrote ${files.length} views to ${out}`);
}
