/**
 * What a drawing looks like to the layout engine, before anybody draws fifty
 * of them (MASC-09; docs/FACE_ASSET_AUTHORING.md).
 *
 * The library is about to grow a muzzle, a pair of whiskers, a beak, horns, a
 * crest, an antenna and a set of panels -- seven kinds of piece nobody has ever
 * drawn for this face. Every one of them will be authored the same way: draw it
 * in the template's own frame, write down the box it occupies, name the anchor
 * it belongs to, and let `fitFacePart` place it on whatever head it meets. That
 * contract has worked for the eleven human categories because the eleven were
 * drawn against the template that defines it. Nothing yet says out loud *what*
 * the contract is, and nothing lets an author look at one drawing and see where
 * the engine thinks its centre, its anchor and its size are.
 *
 * So this module answers, for one asset:
 *
 * ```text
 * referenceBox      the box the drawing occupies in the template's frame
 * referenceCentre   its centre, which is the pivot a fit scales about
 * mountPoint        the anchor it is fitted to
 * fit               what `fitFacePart` makes of it on the template
 * geometryIssues    what is wrong, or suspect, about the above
 * ```
 *
 * It **reads and never writes**, it adds no second validator -- the numeric
 * checks here are the ones `validateFacePart` does not make, and every answer
 * about placement comes from `face-layout.js` rather than being re-derived --
 * and nothing in it reaches a document, the runtime or an export. It is the
 * model `scripts/face-asset-sheet.mjs` draws, and the thing a test can assert
 * on without a browser.
 */
import { FACE_PART_LIBRARY, baseAssetId } from './face-part-registry.js';
import { FACE_MOUNT_POINTS, assetTags, facePartCategory } from './face-part-model.js';
import { assetSlot, assetSupportsMorphology, compatibleMorphologies, faceSlot } from './face-morphologies.js';
import { TEMPLATE_FACE_LAYOUT, fitFacePart, layoutFromBoxes } from './face-layout.js';

/**
 * Where each of the seven new visual slots is *proposed* to mount, and nothing
 * more (MASC-09 §4).
 *
 * These are candidates for the QA sheet to confirm or contradict, not a rule
 * the editor follows: an asset names its own `mountPoint`, and that is still
 * the only thing `fitFacePart` reads. Keeping the proposal in one place means
 * the sheet, the docs and the tests argue about the same table instead of three
 * copies of it drifting apart, and that changing a candidate is one edit.
 *
 * `crest` is the one genuinely open question -- `head.top` is the skull, and
 * `hair.top` is the top of whatever hair the face has, which on a bird is the
 * crest itself. The sheet draws both.
 */
export const SLOT_ANCHOR_CANDIDATES = Object.freeze({
  muzzle: 'nose.center',
  whiskers: 'nose.center',
  beak: 'mouth.center',
  horns: 'head.top',
  crest: 'head.top',
  antenna: 'head.top',
  panels: 'head.center'
});

/** The second anchor worth looking at, where the first is not obviously right. */
export const SLOT_ANCHOR_ALTERNATIVES = Object.freeze({ crest: 'hair.top' });

/**
 * How far a style of a drawing may drift from the drawing it restyles before
 * the sheet says so.
 *
 * A restyle is *the same object in another graphical language*: a flat muzzle
 * and a retro muzzle are the same muzzle. Outlines differ, so the boxes differ
 * a little, and demanding equality would be demanding that nobody ever draws a
 * thicker stroke. What must not happen is a restyle that **moves the piece**:
 * switching Flat to Retro should change how the muzzle looks and not where it
 * sits.
 *
 * ```text
 * centre   the centre may move by 6% of the base box's longer side
 * size     width and height may differ by 15% either way
 * ```
 *
 * Six percent of a 60-unit muzzle is under four units on a 240-unit face --
 * under the width of the outline. Fifteen percent is the difference between a
 * hairline and a heavy stroke on a small piece, and no more. Both are warnings
 * on a QA sheet, never validation errors: the library must keep accepting a
 * restyle whose author knew what they were doing.
 */
export const VARIANT_GEOMETRY_TOLERANCE = Object.freeze({ centre: 0.06, size: 0.15 });

const finite = (value) => Number.isFinite(Number(value));
const usable = (box) => Boolean(box && [box?.x, box?.y, box?.width, box?.height].every(finite) && box.width > 0 && box.height > 0);
const round = (value) => Math.round(Number(value) * 1000) / 1000;

/** The centre of a reference box, which is the pivot a fit scales about; null for a box that is not one. */
export const referenceCentre = (box) => (usable(box) ? { x: round(box.x + box.width / 2), y: round(box.y + box.height / 2) } : null);

const issue = (severity, code, message, field) => Object.freeze({ severity, code, message, field });

/**
 * What is wrong, or suspect, about one drawing's geometry.
 *
 * Deliberately **not** a second `validateFacePart`: an asset in a registry has
 * already been through that one, and repeating its rules here would mean two
 * places to fix a message. What is added is the part validation cannot reach --
 * whether the layout engine can actually place the thing:
 *
 * ```text
 * box-missing    no reference box, or one with no size: nothing to fit
 * mount-unknown  an anchor no face has, so the fit silently falls back
 * fit-failed     `fitFacePart` refused, or produced something not a number
 * fit-scale      a scale of zero or less: the drawing would vanish or invert
 * ```
 *
 * @returns {{severity, code, message, field}[]}
 */
export function assetGeometryIssues(asset, { template = TEMPLATE_FACE_LAYOUT } = {}) {
  const issues = [];
  const box = asset?.referenceBox;
  if (!usable(box)) {
    issues.push(issue('error', 'box-missing', 'This drawing has no reference box with a size, so nothing can place it.', 'referenceBox'));
    return issues;
  }
  const mount = asset?.mountPoint;
  if (mount && !FACE_MOUNT_POINTS.includes(mount)) {
    issues.push(issue('error', 'mount-unknown', `There is no mount point called "${mount}": the fit falls back to the centre of the head.`, 'mountPoint'));
  }
  const fit = fitFacePart(asset, template);
  if (!fit) issues.push(issue('error', 'fit-failed', 'The layout engine could not place this drawing on the template.', 'referenceBox'));
  else if (![fit.x, fit.y, fit.scaleX, fit.scaleY, fit.pivotX, fit.pivotY].every(finite)) {
    issues.push(issue('error', 'fit-failed', 'Placing this drawing produced something that is not a number.', 'referenceBox'));
  } else if (!(fit.scaleX > 0) || !(fit.scaleY > 0)) {
    issues.push(issue('error', 'fit-scale', 'Placing this drawing produced a scale of zero or less.', 'referenceBox'));
  }
  return issues;
}

/**
 * How far a style of a drawing has drifted from the drawing it restyles.
 *
 * A warning here is a question for an author, not a refusal: the library goes
 * on registering the variant, and `restylePlan` goes on offering it. What it
 * catches is the failure a restyle must never have -- coming out somewhere
 * else, or on something else -- which is invisible in a diff and obvious on a
 * sheet.
 *
 * A variant is **not** required to repeat `slot`, `morphologies` or `tags`: the
 * canonical base answers for all three (MASC-08B), so silence is right and only
 * a *contradiction* is worth saying anything about.
 *
 * @param {object} base the drawing being restyled
 * @param {object} variant the restyle
 * @returns {{severity, code, message, field}[]}
 */
export function variantGeometryIssues(base, variant, { tolerance = VARIANT_GEOMETRY_TOLERANCE } = {}) {
  const issues = [];
  if (!base || !variant) return issues;
  const mountOf = (asset) => asset.mountPoint || facePartCategory(asset.category)?.mountPoint || '';
  if (mountOf(base) !== mountOf(variant)) {
    issues.push(issue('warning', 'variant-mount', `A style should not move the piece: this one mounts at "${mountOf(variant)}" and ${base.id} at "${mountOf(base)}".`, 'mountPoint'));
  }
  const hostKey = (asset) => (asset.host ? `${asset.host.part}.${asset.host.role}` : '');
  if (hostKey(base) !== hostKey(variant)) {
    issues.push(issue('warning', 'variant-host', `A style should hang where its drawing hangs: this one hangs on "${hostKey(variant) || 'the face'}" and ${base.id} on "${hostKey(base) || 'the face'}".`, 'host'));
  }
  // Silence is inheritance; only a stated disagreement is a disagreement.
  if (variant.slot && faceSlot(variant.slot)?.id !== assetSlot(base)) {
    issues.push(issue('warning', 'variant-slot', `This style says it is a "${variant.slot}", and ${base.id} is offered under "${assetSlot(base)}".`, 'slot'));
  }
  const from = referenceCentre(base.referenceBox), to = referenceCentre(variant.referenceBox);
  if (usable(base.referenceBox) && usable(variant.referenceBox) && from && to) {
    const span = Math.max(base.referenceBox.width, base.referenceBox.height);
    const moved = Math.hypot(to.x - from.x, to.y - from.y);
    if (moved > span * tolerance.centre) {
      issues.push(issue('warning', 'variant-centre', `This style's centre is ${round(moved)} away from ${base.id}'s, which is more than ${Math.round(tolerance.centre * 100)}% of its size: changing style would move the piece.`, 'referenceBox'));
    }
    for (const axis of ['width', 'height']) {
      const ratio = variant.referenceBox[axis] / base.referenceBox[axis];
      if (Math.abs(ratio - 1) > tolerance.size) {
        issues.push(issue('warning', 'variant-size', `This style's ${axis} is ${round(ratio)}× ${base.id}'s, which is more than ${Math.round(tolerance.size * 100)}% away: changing style would resize the piece.`, 'referenceBox'));
      }
    }
  }
  return issues;
}

/**
 * One drawing, as the layout engine and the authoring layer see it.
 *
 * Everything here is read from the asset and from `face-layout.js`; nothing is
 * computed twice and nothing is stored. A variant carries the comparison with
 * the drawing it restyles among its issues.
 *
 * @param {object} asset a normalised asset
 * @param {{ library?: object, template?: object }} [options]
 * @returns {object} the record documented in docs/FACE_ASSET_AUTHORING.md
 */
export function assetReview(asset, { library = FACE_PART_LIBRARY, template = TEMPLATE_FACE_LAYOUT } = {}) {
  const base = asset?.variant?.of ? library?.get?.(asset.variant.of) || null : null;
  const category = facePartCategory(asset?.category);
  // A style is the same piece in another language, so it inherits what it does
  // not repeat: the slot it is offered in, the kinds of face it suits and the
  // words it is found by are the canonical drawing's (MASC-08B). Silence is
  // inheritance here and everywhere else the style axis is read.
  const inherited = (field, read) => (asset?.[field]?.length || !base ? read(asset) : read(base));
  const slot = faceSlot(asset?.slot)?.id || (base ? assetSlot(base) : null) || assetSlot(asset);
  const fit = fitFacePart(asset, template);
  return {
    id: asset?.id || '', name: asset?.name || '', description: asset?.description || '',
    category: asset?.category || '', categoryLabel: category?.label || asset?.category || '',
    slot, slotLabel: faceSlot(slot)?.label || slot || '',
    morphologies: inherited('morphologies', compatibleMorphologies), declaredMorphologies: [...(asset?.morphologies?.length ? asset.morphologies : base?.morphologies || [])],
    tags: inherited('tags', assetTags),
    // What the fit really used, which is not what the asset asked for when it
    // asked for an anchor no face has.
    mountPoint: asset?.mountPoint || category?.mountPoint || '',
    fittedMountPoint: fit?.mountPoint || null,
    host: asset?.host ? { ...asset.host } : null,
    referenceBox: usable(asset?.referenceBox) ? { ...asset.referenceBox } : null,
    referenceCentre: referenceCentre(asset?.referenceBox),
    baseAssetId: baseAssetId(asset?.id, library),
    style: asset?.variant?.style || '',
    origin: asset?.origin || 'custom', pack: asset?.pack || null,
    fit,
    geometryIssues: [...assetGeometryIssues(asset, { template }), ...variantGeometryIssues(base, asset)]
  };
}

/**
 * Where one drawing lands on one head, using the engine and nothing else.
 *
 * A head box is all a face needs to be placed against: `layoutFromBoxes` puts
 * every anchor it cannot measure where the template keeps it, in proportion to
 * that head, which is exactly what happens to a real face that has a head and
 * has not got a nose yet. So a muzzle fitted here is a muzzle fitted the way
 * the editor would fit it -- and if it lands badly, that is the finding.
 *
 * @param {object} asset
 * @param {{x,y,width,height}} headBox
 * @returns {{ layout: object, fit: object|null }}
 */
export function fitOnHead(asset, headBox, { template = TEMPLATE_FACE_LAYOUT } = {}) {
  const layout = layoutFromBoxes({ head: headBox }, { template });
  return { layout, fit: fitFacePart(asset, layout, { template }) };
}

/**
 * Every drawing worth reviewing, narrowed the way the sheet's flags narrow it.
 *
 * Cards *and* their styles: a variant is not a card, and a variant that has
 * drifted from its base is precisely what this exists to catch, so the list is
 * built from the cards and each one's styles follow it.
 *
 * @param {{ library?, slot?, morphology?, asset?, style?, template? }} [query]
 * @returns {object[]} reviews, in registration order, a card before its styles
 */
export function reviewAssets({ library = FACE_PART_LIBRARY, slot = null, morphology = null, asset = null, style = null, template = TEMPLATE_FACE_LAYOUT } = {}) {
  const wanted = slot ? faceSlot(slot) : null;
  if (slot && !wanted) throw new Error(`There is no slot called "${slot}".`);
  const cards = library.cards()
    .filter((card) => (!wanted || assetSlot(card) === wanted.id))
    .filter((card) => (!morphology || assetSupportsMorphology(card, morphology)))
    .filter((card) => (!asset || card.id === asset || baseAssetId(asset, library) === card.id));
  const out = [];
  for (const card of cards) {
    const styles = library.variantsOf(card.id).filter((item) => !style || item.variant?.style === style);
    // Asking for one style is asking about the restyles: the drawing they
    // restyle comes with them, because the comparison is the point.
    if (!style || styles.length) out.push(assetReview(card, { library, template }));
    for (const item of styles) out.push(assetReview(item, { library, template }));
  }
  return out;
}

/** The reviews that found something, and what they found: the sheet's summary, and a test's. */
export const reviewWarnings = (reviews) => reviews.flatMap((review) => review.geometryIssues.map((item) => ({ id: review.id, ...item })));
