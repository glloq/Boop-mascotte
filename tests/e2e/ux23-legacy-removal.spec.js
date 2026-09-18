import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openFreshEditor, startBasicFace, goToPreview } from './editor-helpers.js';

// UX-23: the pre-UX-03 Canvas empty state and the "Try your mascot" demo bar are gone.
// Their capabilities live on Home (UX-03), Artwork and the Preview animations chips (UX-08).
const LEGACY_SELECTORS = ['#empty-state', '#empty-svg', '#empty-project', '#empty-face', '[data-use-template]', '.empty-actions', '.primary-start', '.try-animations', '#example-buttons', '[data-demo-clip]'];
const fixture = (name) => readFileSync(new URL(`./fixtures/basic-face.${name}`, import.meta.url), 'utf8');
const expectNoLegacy = async (page, stage) => { for (const selector of LEGACY_SELECTORS) await expect(page.locator(selector), `${selector} must not exist ${stage}`).toHaveCount(0); };

test('@critical legacy empty state and demo bar are removed; Home, Artwork and Preview carry their capabilities', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await expectNoLegacy(page, 'on Home');
  // First-run capabilities of the old empty state, after V3-08 narrowed Home to
  // a preset and the mascot as it comes: the two starters are on Home, and open
  // project and import SVG are in the ••• menu, which sits above Home.
  await expect(page.locator('[data-home] [data-home-action="picture"]')).toBeVisible();
  await expect(page.locator('[data-home] [data-template-id="basic"]')).toBeVisible();
  await expect(page.locator('[data-home] [data-template-id]')).toHaveCount(1, 'the mascot as it comes; the preset is the other card');
  await expect(page.locator('.file-menu #project-file')).toHaveCount(1);
  await expect(page.locator('.file-menu #svg-file')).toHaveCount(1);

  await startBasicFace(page);
  await expectNoLegacy(page, 'after starting Basic Face');
  // Artwork keeps what belongs to artwork: the three ways to replace the mascot
  // on the canvas, importing a drawing over it, and adding a picture to it.
  await expect(page.locator('.create-tools #empty-basic')).toHaveCount(1);
  await expect(page.locator('.create-tools [data-template-id="blank"]')).toHaveCount(1);
  await expect(page.locator('.create-tools #artwork-svg-file')).toHaveCount(1);
  await expect(page.locator('.create-tools #artwork-image-file')).toHaveCount(1);
  await expect(page.locator('.create-tools [data-face-builder]')).toHaveCount(1);
  await expect(page.locator('.create-tools #generate-face')).toHaveCount(1);
  // The canvas no longer carries an overlay besides its own toolbars.
  expect(await page.locator('#canvas > div').evaluateAll((nodes) => nodes.map((node) => node.className || node.id))).not.toContain('try-animations');

  // Demo bar replacement: Preview animations chips play and stop clips without touching the document.
  await goToPreview(page);
  const before = await page.evaluate(() => window.__BOOP_E2E__.documentRevisions());
  const clip = page.locator('[data-preview-section="animations"] [data-preview-clip="look-around"]');
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(true);
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(false);
  expect(await page.evaluate(() => window.__BOOP_E2E__.documentRevisions())).toEqual(before);
  await expectNoLegacy(page, 'in Preview');
});

// The fixture has been re-signed six times, every time deliberately and
// every time after checking that *only* the intended keys moved -- which is
// what makes re-signing a guard against drift rather than a way of hiding it.
//
// The lower lids belong to the eyelids: their two bindings gained the
// `generatedBy` stamp that says which semantic movement wrote them. Nothing
// about how they move changed -- same expression, same amplitude, same offset,
// and `mascot.svg` is byte-for-byte what it was. What changed is that
// switching Eyes · Open / close off now reaches them, instead of taking the
// upper lids down and leaving these two still rising.
//
// Hands, one outline each: a drawing is a single path rather than a group of
// six shapes (docs/HAND_STYLES.md, "One outline"), and the library grew the OK
// sign and the closed side. So `elements` lost the 72 shapes inside the twelve
// old drawings and gained the four new ones, `hands.*.styles.library` lists
// eight drawings a side, and `handLStyle`/`handRStyle` run 0-7 instead of 0-5.
// Nothing outside the pair of hands moved: no face element, no other
// parameter, no expression, clip or reaction.
//
// V3-12: the template ships the gaze solver on, so the rig gained `gazeX`,
// `gazeY`, their rest values in each state and the solver's settings block. No
// parameter was removed and no other top-level key changed.
//
// V3-09: schema 4 became 5 and the rig gained `requires`, which names the two
// new triggers it uses so an older runtime declines by name instead of guessing
// at them. The four "by itself" reactions moved from `timer` to `idle` -- they
// wait for you to stop, they do not run on a clock -- and three `gaze-follow`
// reactions joined them.
//
// V4-07x and V4-090: two additive blocks, both empty on this template. `meshes`
// is the top-level list of pictures that bend, and every reaction gained
// `conditions` -- the IF of `WHEN -> IF -> DO`. Nothing was removed, nothing
// else changed, and `mascot.svg` is byte for byte what it was: a rig with no
// meshes and no conditions says so rather than leaving the reader to guess
// whether the writer knew about them. `requires` is unchanged, because a rig
// that uses no conditions asks for nothing (`runtime/reaction-conditions.js`).
//
// V5-01 and V5-02: 131 lines added, none removed, none reordered, and
// `mascot.svg` byte for byte what it was. One is `partStates: []` -- the block
// that lets a piece be several drawings with one showing, empty on a template
// whose mouth is still a morph. The other 130 are one `rigging: "rigid"` per
// element: how a piece is allowed to move became a property of the piece, and
// every element written before the question existed answers it the way they
// all behaved. `requires` is unchanged for the same reason as above -- a rig
// with no part states asks for nothing.
//
// The eyes came off the socket (docs/EYE_BUILDS.md). This is the first re-sign
// that touched `mascot.svg`, and it touched it on purpose: the two
// `clipPath`s that hid the lids are gone, along with the four ellipses inside
// them, and the eye groups are no longer clipped to anything. A lid is now the
// eye's own ellipse squashed to a sliver on the rim it swings from and scaled
// about that rim, so it cannot leave the eye and has nothing to be clipped by
// -- which is what let the eye's own box be the eye, and the gizmo land on it.
//
// In `rig.json`, exactly four groups of keys moved and nothing else:
//
//   + creaseUpper/Lower Left/Right    four new elements, and eight shape keys
//   ~ lidUpper/Lower Left/Right       `translateY` became `scaleY`, new paths
//   ~ lidUpper/Lower * shape keys     the same two curves over the new rests
//   + glint/spark Left/Right          the pupil's own `lookX`/`lookY`
//
// The creases are the crease a closed cartoon eye reads as: the lids are
// fill-only now, because a closed shape stroked all the way round draws its
// own rim as well, which read as two rings over the eye. The catchlights
// gained the pupil's bindings because they never had any -- a glint nailed to
// the socket while the pupil looked away is a highlight on the white.
//
// No parameter, state, clip, reaction, expression, hand or face element
// outside the eyes changed, and neither did the mouth: moving its geometry out
// to `core/face/mouth-build.js` so a card and the template are the same mouth
// (docs/MOUTH_BUILD.md) left every byte of the template's own mouth alone,
// which is the check that says it was a move and not a rewrite.
test('@critical Basic Face export artifacts are identical to the pre-removal fixtures', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const artifacts = await page.evaluate(() => Object.fromEntries(window.__BOOP_E2E__.exportArtifacts().map((item) => [item.name, item.content])));
  expect(Object.keys(artifacts).sort()).toEqual(['mascot.svg', 'rig.json', 'runtime.js']);
  expect(artifacts['rig.json']).toBe(fixture('rig.json'));
  expect(artifacts['mascot.svg']).toBe(fixture('mascot.svg'));
});
