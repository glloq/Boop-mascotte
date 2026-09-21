import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { goToPreview, openFreshEditor, openPreviewSection, revealPreviewItem, startBasicFace } from './editor-helpers.js';

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
  await revealPreviewItem(page, 'animations', '[data-preview-section="animations"] [data-preview-clip="look-around"]');
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(true);
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(false);
  expect(await page.evaluate(() => window.__BOOP_E2E__.documentRevisions())).toEqual(before);
  await expectNoLegacy(page, 'in Preview');
});

// The fixture has been re-signed seven times, every time deliberately and
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
//
// Then the socket came back, on purpose (docs/EYE_BUILDS.md). Deleting it was
// a misreading of the ask -- *afficher* the circle that cuts, not remove it --
// and of the artwork: a lid scaled in `y` alone keeps its full width, so at a
// quarter shut it hung past the outline on both sides. In `rig.json`:
//
//   + lidsLeft, lidsRight        the group the cut goes on. It has to be a
//                                group: `clip-path` is resolved after an
//                                element's own transform, so a lid carrying it
//                                would scale its own socket out of the way
//   ~ lidUpper/Lower Left/Right  a flat run along the rim, two vertical sides
//   ~ creaseUpper/Lower * (8)    and the leading edge, whose ends now land on
//                                the eye's widest points -- which is what
//                                closes the corners a shut eye used to leave
//                                white
//   ~ their sixteen shape keys   the same two poses over the new rests
//
// In `mascot.svg`, the same, plus the socket itself: one `<clipPath>` per eye
// holding a `<use>` of that eye's own white, so the shape that cuts is the
// shape in the layer tree. The white is renamed *eye socket* to say so. Again
// no parameter, state, reaction or element outside the eyes moved.
//
// Then four more things an author could see, and three of them were the socket
// being left out of something:
//
//   ~ lidsLeft/Right → eyeInnerLeft/Right   the cut holds the *pupil* now too.
//                                A gaze carried it across the white and nothing
//                                stopped it at the rim; on the iris build the
//                                iris is nearly twice as wide and left the eye
//   ~ the lids and creases (8)   drawn as hairlines rather than a twentieth of
//                                the eye, so an open eye shows none of them.
//                                Whatever is drawn is what it shows: the factor
//                                they grow by takes up the difference
//   ~ their shape keys (12)      the same two poses over the new rests, and
//                                `eyeCurve` authored on the seam rather than on
//                                the sliver so thinning the lid cannot rescale it
//   ~ tongue, and its five keys  a rounded slab that fills the lower mouth and
//                                laps over the lip, where it was a hump that
//                                never left the floor of it
//   ~ teeth-show                 hung clear of the upper lip, which was drawn
//                                over by the row of teeth
//
// And the head's own cut, which is two lines and no `rig.json` at all:
//
//   - <defs><clipPath id="headShape"><path d="…"/></clipPath></defs>
//   + <clipPath id="headShape"><use href="#head"/></clipPath>   (in faceRoot)
//
// `headShape` was an anonymous copy of the head's outline in the definitions:
// in no layer, in no `elements` record, so the fringe arrived cut and nothing
// could say so or be pressed -- and a copy cannot follow `head-jaw`, so an open
// jaw left the shading cut to a chin the face no longer had
// (docs/VECTOR_EDITING.md, "A cut is a relationship between two drawings").
// `rig.json` is byte for byte what it was, because a `<clipPath>` is not an
// element and this changed no element: the whole of it is which shape does the
// cutting. The eye sockets keep `use-1` and `use-2`; the head's is `use-3`
// because it is written at the end of `faceRoot`, which is where the canvas's
// importer puts a `<clipPath>` whatever the template says.
//
// Then the mouth, which is V6 and is the largest of these moves. Everything it
// changed is the mouth's, and the list is exactly that (docs/MOUTH_BUILD.md):
//
//   + teethLower, tongueTip,     a lower row of teeth, the part of the tongue
//     tongueGroove               that laps over the lower lip, and the crease
//                                down the middle of it. The tip has to be its
//                                own shape, because one element cannot be both
//                                in front of the lower lip and behind it; and
//                                the groove has to be its own, because a
//                                crease is drawn on top of the tongue it is a
//                                crease in
//   + mouthInside                the group the teeth and the tongue's body are
//                                cut to the lips inside. A group, for the same
//                                reason the eyes' is: `clip-path` is resolved
//                                after an element's own transform, so a tongue
//                                carrying it would translate its own aperture
//                                away
//   + mouthAperture (`use-4`)    the cut itself, a `<use>` of `#mouth` -- the
//                                aperture *is* the shape of the hole, so the
//                                cut follows every pose of it with nothing to
//                                keep in step
//   + mouthSkew                  the lean, resting at 0 and adding nothing --
//                                the one new parameter, and the one new rest
//                                value in each of the three states
//   + 24 shape keys              the three new shapes' own, `mouth-skew`, and
//                                the lean and the reach the old three gained
//   ~ teeth, tongue and their    a scalloped row of crowns where the teeth were
//     ten keys                   a white band, and a tongue of two lobes with a
//                                groove between them where it was one arch
//   ~ 21 keyform channels        seven each for the three new elements, which
//                                is the 2.5D turn carrying them with the lip
//                                line. `mouthInside` gets none: a clipping
//                                group is not a drawing and has nothing to turn
//
// The tongue's tip and its groove rest at nothing -- the groove's rest path is
// a single point repeated, `M120 178 Q120 178 120 178 …` -- so a mouth that
// never puts its tongue out draws exactly what it drew before them. That is
// the point of them being additive rather than poses of the tongue itself.
//
// No parameter outside the mouth, no state, no reaction, no expression, no
// animation, no hand, no pin, no attachment and no hold moved: 21 reactions,
// 36 expressions, 45 clips, 4 behaviours, 7 pins, 7 attachments and 8 holds,
// before and after, and 78 parameters where there were 77. That is the check,
// not a footnote to it.
// And once more for the tongue, which is three changes and no new anything.
// Nothing was added or removed: 140 elements, 56 shape keys, 178 keyform
// channels and 78 parameters, before and after. What moved is exactly:
//
//   ~ teethLower ↔ tongue      the lower row is behind the tongue now. A
//     (in `mascot.svg`)        tongue on its way out of a mouth goes over the
//                              lower teeth, and it was drawing a white bar
//                              across itself at every pose that had one
//   ~ tongue, tongueTip        the tongue has a width of its own, mostly: it
//     (rest paths, 2 of them)  used to be the lip curve between two fractions
//                              of itself, so a mouth pursed into an OO drew a
//                              tongue 58 % narrower -- a spike out of a small
//                              round hole. And the fold between its lobes is
//                              shallower, because at 30 % of the peak the two
//                              of them drew a capital M
//   ~ 10 shape-key deltas      the same ten, re-measured over the new rests:
//                              `tongue-` skull, follow, round, skew, open,
//                              show, and `tongueTip-` follow, round, skew,
//                              curl. The five that did **not** move are the
//                              five whose offsets are vertical only, so their
//                              x deltas were 0 before and are 0 now --
//                              `tongueTip-out`, `-open`, and the groove's --
//                              which is the arithmetic agreeing with the
//                              change rather than a gap in it
//
// No parameter, state, reaction, expression, animation, clip, hand, pin,
// attachment or hold moved, and neither did a tooth: the two rows are byte for
// byte what they were, in `mascot.svg` and in every one of their keys.
// And once more for the tongue's finish and the uvula, which is one element and
// no new mechanism. 141 elements, 62 shape keys, 185 keyform channels, 79
// parameters; 21 reactions, 36 expressions and 45 clips, before and after.
//
//   + uvula, and its six keys     the drop at the back of a shouting mouth. It
//     (`uvula-` skull, follow,    is the only inside hung off the *upper* lip,
//     round, skew, open, show)    the only one that brought a control with it,
//                                 and it rests at 0 -- so a face that never
//                                 asks for one draws exactly what it drew
//                                 before it existed
//   ~ the lower row's depth       half what it was, and half as clear of the
//     (`teethLower-show`)         lip. With the row in front of the tongue,
//                                 whatever it stands in is tongue the author
//                                 cannot see, so a mouth showing its teeth had
//                                 a tongue with less travel than the same mouth
//                                 without them
//   ~ tongueTip, and its keys     the tip is drawn in the body's own seat now,
//     (skull, follow, round,      the same width, so there is no step in the
//     skew, open, out, curl)      silhouette where the tongue crosses the lip;
//                                 its root reaches ten units back instead of
//                                 three and a half, which is what stops the
//                                 tongue breaking in two over the lower teeth
//                                 or under `tongueY`; its end is rounder, and
//                                 its curl lifts the whole free edge rather
//                                 than forking it
//   ~ tongueGroove-out / -curl    the crease follows the tip it folds
//
// `tongueX` became a **rotation** about the mouth's own centre -- a tongue
// hanging out swings from its hinge -- and that changed no byte here: a driver's
// property lives on the element's bindings, which this fixture records, and the
// three tongue shapes' bindings are the one place it shows. The paths are
// untouched by it, because a transform is not a shape.
//
// No tooth moved that the row's own depth did not move, and nothing outside the
// mouth moved at all.
//
// One more, and it is **three deltas**: `teeth-show`, `teethLower-show` and
// `uvula-show`, with every other key, every element, every parameter and every
// keyform channel byte for byte what it was. Both rows now clear their lip by
// exactly the half of its 3.8-unit outline and not a unit and a half more --
// what that extra cleared was cavity, and a strip of dark between an upper lip
// and the teeth under it reads as a hole where a gum should be. And the uvula
// hangs from below the upper row instead of from the lip: hung at the lip it
// was painted over the inner half of it, and hung just inside, a full row of
// teeth swallowed it whole. It is drawn as a drop now -- narrow where it is
// attached, widest low (docs/MOUTH_BUILD.md, "The uvula").
//
// And once more for its width, which is **one delta**: `uvula-show`, four
// numbers, twice as wide. `mascot.svg` is byte for byte what it was, because
// the uvula rests at nothing and a shape that paints nothing is the same
// nothing at any width -- which is the emptiness rule paying for itself.
test('@critical Basic Face export artifacts are identical to the pre-removal fixtures', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const artifacts = await page.evaluate(() => Object.fromEntries(window.__BOOP_E2E__.exportArtifacts().map((item) => [item.name, item.content])));
  expect(Object.keys(artifacts).sort()).toEqual(['mascot.svg', 'rig.json', 'runtime.js']);
  expect(artifacts['rig.json']).toBe(fixture('rig.json'));
  expect(artifacts['mascot.svg']).toBe(fixture('mascot.svg'));
});
