#!/usr/bin/env node
/**
 * A **review sheet** of the face library's drawings, for looking at before
 * anybody commits to fifty of them (MASC-09; docs/FACE_ASSET_AUTHORING.md).
 *
 * ```sh
 * npm run face:assets                                  # out/face-assets/
 * node scripts/face-asset-sheet.mjs --slot muzzle
 * node scripts/face-asset-sheet.mjs --morphology beak
 * node scripts/face-asset-sheet.mjs --asset accessory.glasses
 * node scripts/face-asset-sheet.mjs --style flat  out/flat-review
 * ```
 *
 * Every drawing in this library is authored in one frame -- the template face's
 * own -- and placed on any other face by one similarity: its reference box's
 * centre lands where its mount point is, at the size of that head. That works,
 * and it is invisible. An author drawing the first muzzle nobody has ever drawn
 * has no way to see where the engine thinks the centre is, which anchor it
 * aimed at, or what happens to the piece on a narrow skull -- until it is
 * installed on a face and looks wrong.
 *
 * So each drawing gets three views:
 *
 * ```text
 * A  the drawing alone       its box, its pivot, the template anchor, the offset between them
 * B  on the reference face   auto-fitted, over the template it was drawn against
 * C  the fit matrix          the same fit on Round, Oval, Wide, Narrow and Square
 * ```
 *
 * Nothing is faked. The placement in B and C is `fitFacePart` over
 * `layoutFromBoxes`, through the same transform string the runtime writes, so a
 * piece that lands badly lands badly here — which is the finding.
 *
 * **This generates nothing an author owns.** The assets are the source, the
 * sheet is a view of them, and `out/` is ignored by git. It is the sibling of
 * `npm run face:snapshots`, which poses the whole mascot through the runtime;
 * this one is about the pieces and where they land.
 *
 * Node >= 22.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACE_PART_LIBRARY } from '../project/editor/core/face-library/face-part-registry.js';
import { HEAD_ROUND, HEAD_OVAL, HEAD_WIDE, HEAD_NARROW, HEAD_SQUARE_SOFT } from '../project/editor/core/face-library/builtin/heads.js';
import { TEMPLATE_FACE_LAYOUT } from '../project/editor/core/face-library/face-layout.js';
import { FACE_SLOTS, faceSlot } from '../project/editor/core/face-library/face-morphologies.js';
import { remapArtworkIds } from '../project/editor/core/face-library/face-part-artwork.js';
import { MASCOT_FACE_SVG } from '../project/editor/core/sample/templates/mascot-artwork.js';
import { SLOT_ANCHOR_ALTERNATIVES, SLOT_ANCHOR_CANDIDATES, fitOnHead, reviewAssets, reviewWarnings } from '../project/editor/core/face-library/face-asset-review.js';

/** The heads the fit matrix compares, in the order the picker lays them out. */
export const MATRIX_HEADS = Object.freeze([HEAD_ROUND, HEAD_OVAL, HEAD_WIDE, HEAD_NARROW, HEAD_SQUARE_SOFT]);

/** The window every face view is drawn through: a hat at y -42 and a chin at 210, with room. */
const FACE_VIEW = Object.freeze({ x: 0, y: -55, width: 240, height: 290 });

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (value) => Math.round(Number(value) * 100) / 100;
const slug = (value) => String(value).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const box = (value) => (value ? `${num(value.x)} ${num(value.y)} ${num(value.width)} × ${num(value.height)}` : '—');

/**
 * The transform a fit becomes, written exactly as the runtime writes it
 * (`runtime/runtime.js`): scale about the pivot, then translate. Re-deriving it
 * here would mean the sheet could agree with itself and disagree with the
 * editor, which is the one thing a QA sheet may not do.
 */
const fitTransform = (fit) => (fit
  ? `translate(${num(fit.x)} ${num(fit.y)}) translate(${num(fit.pivotX)} ${num(fit.pivotY)}) scale(${num(fit.scaleX)} ${num(fit.scaleY)}) translate(${-num(fit.pivotX)} ${-num(fit.pivotY)})`
  : '');

/** One drawing's artwork, its ids made unique for this page. */
const artwork = (asset, prefix) => remapArtworkIds(asset.artwork, { rename: (id) => `${prefix}-${slug(asset.id)}-${id}` }).markup;

/** The marks every view uses, so the conventions are declared once. */
const markBox = (b) => (b ? `<rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(b.height)}" fill="none" stroke="#e2534a" stroke-width="1" stroke-dasharray="4 3"/>` : '');
const markPivot = (at) => (at ? `<circle cx="${num(at.x)}" cy="${num(at.y)}" r="2.6" fill="#e2534a"/>` : '');
const markAnchor = (at, colour = '#2f7de1') => (at ? `<g stroke="${colour}" stroke-width="1.4"><line x1="${num(at.x - 6)}" y1="${num(at.y)}" x2="${num(at.x + 6)}" y2="${num(at.y)}"/><line x1="${num(at.x)}" y1="${num(at.y - 6)}" x2="${num(at.x)}" y2="${num(at.y + 6)}"/></g>` : '');
const markOffset = (from, to) => (from && to ? `<line x1="${num(from.x)}" y1="${num(from.y)}" x2="${num(to.x)}" y2="${num(to.y)}" stroke="#8a8f98" stroke-width="1" stroke-dasharray="2 2"/>` : '');

const svg = (view, body, { width = 220 } = {}) =>
  `<svg viewBox="${num(view.x)} ${num(view.y)} ${num(view.width)} ${num(view.height)}" width="${width}" height="${num(width * view.height / view.width)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

/**
 * View A — the drawing alone, in the frame it was authored in.
 *
 * The window is the drawing's box *and* the anchor it aims at, so a hat drawn
 * at the top of the head and anchored there shows both, and so does an earring
 * whose anchor is an ear it sits beside.
 */
export function assetAloneMarkup(review, asset) {
  const b = review.referenceBox, centre = review.referenceCentre;
  const anchor = TEMPLATE_FACE_LAYOUT.anchors[review.fittedMountPoint || review.mountPoint] || null;
  if (!b) return '<p class="warn">No reference box: nothing to draw.</p>';
  const xs = [b.x, b.x + b.width, anchor?.x ?? b.x], ys = [b.y, b.y + b.height, anchor?.y ?? b.y];
  const pad = Math.max(12, Math.max(b.width, b.height) * 0.18);
  const view = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  return svg(view, `<rect x="${num(view.x)}" y="${num(view.y)}" width="${num(view.width)}" height="${num(view.height)}" fill="#fbfaf8"/>`
    + artwork(asset, 'alone') + markBox(b) + markOffset(anchor, centre) + markAnchor(anchor) + markPivot(centre));
}

/** View B — the same drawing auto-fitted over the face it was drawn against. */
export function assetOnTemplateMarkup(review, asset, { face = '#template-face' } = {}) {
  if (!review.fit) return '<p class="warn">The layout engine could not place this drawing.</p>';
  const anchor = TEMPLATE_FACE_LAYOUT.anchors[review.fit.mountPoint];
  return svg(FACE_VIEW, `<g opacity="0.35"><use href="${face}"/></g>`
    + `<g transform="${fitTransform(review.fit)}">${artwork(asset, 'onface')}</g>`
    + markAnchor(anchor));
}

/**
 * View C — the same fit on five skulls.
 *
 * `fitOnHead` builds a layout from that head's box alone, which is exactly what
 * a face with a head and no nose yet gives the editor: every anchor it cannot
 * measure lands where the template keeps it, in proportion. Nothing is nudged.
 */
export function fitMatrixMarkup(review, asset, heads = MATRIX_HEADS) {
  return heads.map((head, index) => {
    const { fit } = fitOnHead(asset, head.referenceBox);
    const body = `<g opacity="0.5">${artwork(head, `matrix${index}`)}</g>`
      + (fit ? `<g transform="${fitTransform(fit)}">${artwork(asset, `matrix${index}`)}</g>` : '');
    return `<figure class="cell"><div class="art">${svg(FACE_VIEW, body, { width: 150 })}</div>`
      + `<figcaption>${esc(head.name)}<small>×${num(fit?.scaleX ?? 0)} · ${num(fit?.x ?? 0)},${num(fit?.y ?? 0)}</small></figcaption></figure>`;
  }).join('');
}

/** What a cell says in words: everything an author would otherwise read out of the source. */
export function metadataMarkup(review) {
  const rows = [
    ['slot → category', `${esc(review.slotLabel)} (<code>${esc(review.slot)}</code>) → <code>${esc(review.category)}</code>`],
    ['works with', review.declaredMorphologies.length ? esc(review.declaredMorphologies.join(', ')) : '<em>every kind</em>'],
    ['tags', review.tags.length ? esc(review.tags.join(', ')) : '<em>none</em>'],
    ['mount point', `<code>${esc(review.mountPoint)}</code>${review.fittedMountPoint && review.fittedMountPoint !== review.mountPoint ? ` <b class="warn">fitted at ${esc(review.fittedMountPoint)}</b>` : ''}`],
    ['host', review.host ? `<code>${esc(review.host.part)}.${esc(review.host.role)}</code>` : '<em>the face</em>'],
    ['reference box', `<code>${esc(box(review.referenceBox))}</code>`],
    ['centre / pivot', review.referenceCentre ? `<code>${num(review.referenceCentre.x)}, ${num(review.referenceCentre.y)}</code>` : '—'],
    ['style', review.style ? `<code>${esc(review.style)}</code> of <code>${esc(review.baseAssetId)}</code>` : '<em>the base the library is drawn in</em>'],
    ['origin', `${esc(review.origin)}${review.pack ? ` · pack ${esc(review.pack)}` : ''}`]
  ];
  return `<dl class="meta">${rows.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

const issuesMarkup = (review) => (review.geometryIssues.length
  ? `<ul class="issues">${review.geometryIssues.map((item) => `<li class="${esc(item.severity)}"><code>${esc(item.code)}</code> ${esc(item.message)}</li>`).join('')}</ul>`
  : '');

/** One drawing: the three views, what it says about itself, and what is wrong with it. */
export function assetSectionMarkup(review, library) {
  const asset = library.get(review.id);
  if (!asset) return '';
  return `<section class="asset${review.geometryIssues.length ? ' flagged' : ''}" id="asset-${esc(slug(review.id))}">
    <h3>${esc(review.name)} <code>${esc(review.id)}</code>${review.style ? ` <span class="badge">${esc(review.style)}</span>` : ''}</h3>
    <div class="views">
      <figure class="cell"><div class="art">${assetAloneMarkup(review, asset)}</div><figcaption>alone<small>box · pivot · anchor</small></figcaption></figure>
      <figure class="cell"><div class="art">${assetOnTemplateMarkup(review, asset)}</div><figcaption>auto-fitted<small>on the reference face</small></figcaption></figure>
    </div>
    ${metadataMarkup(review)}
    ${issuesMarkup(review)}
    <details class="matrix"><summary>Fit matrix — ${MATRIX_HEADS.length} skulls</summary><div class="views">${fitMatrixMarkup(review, asset)}</div></details>
  </section>`;
}

/**
 * The slot reference: where an artist has to draw each piece.
 *
 * No character is invented for it. It is the template, with the anchors marked
 * and named, and the seven slots nobody has drawn for yet shown against the
 * anchor each is *proposed* to use (`SLOT_ANCHOR_CANDIDATES`). Confirming or
 * contradicting those proposals is the whole reason this page exists, so the
 * text says which they are rather than presenting them as settled.
 */
export function slotReferenceMarkup() {
  const named = ['head.top', 'hair.top', 'head.center', 'eyes', 'brows', 'nose.center', 'mouth.center', 'head.bottom', 'ear.left', 'ear.right'];
  // A label to the inside of the frame, and lifted clear of the one above it:
  // `eyes` and `head.center` are three units apart on this face, and two names
  // printed on top of each other are no names at all.
  const used = [];
  const marks = named.map((name) => {
    const at = TEMPLATE_FACE_LAYOUT.anchors[name];
    if (!at) return '';
    const right = at.x > 140;
    let y = at.y + 3;
    while (used.some((taken) => Math.abs(taken - y) < 9)) y += 9;
    used.push(y);
    return `${markAnchor(at, '#2f7de1')}<text x="${num(at.x + (right ? -8 : 8))}" y="${num(y)}" text-anchor="${right ? 'end' : 'start'}" font-size="7" fill="#2f7de1">${esc(name)}</text>`;
  }).join('');
  const rows = Object.entries(SLOT_ANCHOR_CANDIDATES).map(([id, candidate]) => {
    const slot = faceSlot(id);
    const alternative = SLOT_ANCHOR_ALTERNATIVES[id];
    return `<tr><td>${esc(slot.label)}</td><td><code>${esc(id)}</code></td><td><code>${esc(slot.category)}</code></td>`
      + `<td><code>${esc(candidate)}</code>${alternative ? ` <em>or</em> <code>${esc(alternative)}</code>` : ''}</td>`
      + `<td>${esc(TEMPLATE_FACE_LAYOUT.anchors[candidate] ? `${num(TEMPLATE_FACE_LAYOUT.anchors[candidate].x)}, ${num(TEMPLATE_FACE_LAYOUT.anchors[candidate].y)}` : '—')}</td></tr>`;
  }).join('');
  return `<section class="slots" id="slot-reference">
    <h2>Where to draw it</h2>
    <p>The template face, with every anchor named. A drawing is authored <b>in this frame</b>: put it where it belongs on this face, write down the box it occupies, and name the anchor it belongs to. Everything else is the fit's job.</p>
    <div class="views"><figure class="cell"><div class="art">${svg(FACE_VIEW, `<g opacity="0.3"><use href="#template-face"/></g>${marks}`, { width: 420 })}</div><figcaption>the reference frame<small>head ${esc(box(TEMPLATE_FACE_LAYOUT.headBox))}, centre ${num(TEMPLATE_FACE_LAYOUT.anchors['head.center'].x)}, ${num(TEMPLATE_FACE_LAYOUT.anchors['head.center'].y)}</small></figcaption></figure></div>
    <h3>The seven slots nobody has drawn for yet</h3>
    <p class="note">These anchors are <b>candidates</b>, not rules: an asset names its own mount point, and confirming or correcting this table against real drawings is what this sheet is for.</p>
    <table><thead><tr><th>Slot</th><th>id</th><th>installs as</th><th>candidate anchor</th><th>at</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

const STYLE = `:root{color-scheme:light}
body{font:13px/1.5 system-ui,sans-serif;margin:0;padding:24px;background:#f4f2ee;color:#23262b}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px}h3{font-size:14px;margin:0 0 8px;font-weight:600}
code{font:11px ui-monospace,monospace;background:#e8e5df;padding:1px 4px;border-radius:3px}
.summary{background:#fff;border:1px solid #ddd9d2;border-radius:8px;padding:12px 16px;margin-bottom:16px}
.summary b{font-size:18px}
section.asset,section.slots{background:#fff;border:1px solid #ddd9d2;border-radius:8px;padding:16px;margin-bottom:16px}
section.asset.flagged{border-color:#e2a03a;box-shadow:inset 4px 0 0 #e2a03a}
.views{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin:0 0 12px}
.cell{margin:0;background:#fbfaf8;border:1px solid #e6e2db;border-radius:6px;padding:6px}
.cell .art{display:block;line-height:0}
.cell svg{display:block;background:#fff;border-radius:4px}
figcaption{font-size:11px;color:#6b7079;padding-top:4px;display:flex;justify-content:space-between;gap:8px}
figcaption small{color:#9aa0a8;font-family:ui-monospace,monospace}
dl.meta{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px 16px;margin:0 0 8px}
dl.meta>div{display:flex;gap:8px}dt{color:#6b7079;min-width:110px}dd{margin:0}
ul.issues{margin:8px 0 0;padding-left:18px}
ul.issues li.warning{color:#9a6b16}ul.issues li.error{color:#b3261e}
.warn{color:#9a6b16}.badge{background:#e7effa;color:#2f7de1;border-radius:3px;padding:1px 6px;font-size:11px}
.note{color:#6b7079}
table{border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:4px 12px 4px 0;border-bottom:1px solid #eceae5}
details.matrix summary{cursor:pointer;color:#6b7079;font-size:12px;margin-bottom:8px}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#6b7079;margin:0 0 12px}`;

/** The template's own drawing, once, for every face view to `<use>`. */
const templateDefs = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">`
  + `<defs><g id="template-face">${MASCOT_FACE_SVG.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g></defs></svg>`;

/**
 * The whole sheet, as one page.
 *
 * Pure: hand it reviews and a library and it returns a string, which is what
 * lets a test assert on the sheet without a browser or a file system.
 */
export function assetSheetMarkup(reviews, { library = FACE_PART_LIBRARY, title = 'Face assets', filters = {} } = {}) {
  const warnings = reviewWarnings(reviews);
  const named = Object.entries(filters).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`);
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style>
  ${templateDefs()}
  <h1>${esc(title)}</h1>
  <div class="summary"><b>${reviews.length}</b> drawing${reviews.length === 1 ? '' : 's'} reviewed${named.length ? ` · ${esc(named.join(' · '))}` : ''}
   · <b>${warnings.length}</b> geometry warning${warnings.length === 1 ? '' : 's'}
   ${warnings.length ? `<ul class="issues">${warnings.map((item) => `<li class="${esc(item.severity)}"><a href="#asset-${esc(slug(item.id))}"><code>${esc(item.id)}</code></a> ${esc(item.message)}</li>`).join('')}</ul>` : ''}</div>
  <p class="legend"><span>▭ reference box</span><span>● centre / pivot</span><span>✛ template mount anchor</span><span>┈ anchor → centre offset</span></p>
  ${slotReferenceMarkup()}
  <h2>Drawings</h2>
  ${reviews.map((review) => assetSectionMarkup(review, library)).join('')}`;
}

/** The same "alone" views as one standalone SVG, for dropping into a drawing program. */
export function assetContactSheet(reviews, { library = FACE_PART_LIBRARY, columns = 6 } = {}) {
  const cell = 120;
  const body = reviews.map((review, index) => {
    const asset = library.get(review.id);
    const b = review.referenceBox;
    if (!asset || !b) return '';
    const side = Math.max(b.width, b.height) * 1.4;
    const view = { x: b.x + b.width / 2 - side / 2, y: b.y + b.height / 2 - side / 2, width: side, height: side };
    const scale = cell / side;
    return `<g transform="translate(${(index % columns) * cell} ${Math.floor(index / columns) * (cell + 16)})">`
      + `<rect width="${cell}" height="${cell}" fill="#fff" stroke="#e3e3e3"/>`
      + `<g transform="scale(${num(scale)}) translate(${num(-view.x)} ${num(-view.y)})">${artwork(asset, `sheet${index}`)}${markBox(b)}${markPivot(review.referenceCentre)}</g>`
      + `<text x="2" y="${cell + 11}" font-family="ui-monospace, monospace" font-size="9" fill="#666">${esc(review.id)}</text></g>`;
  }).join('');
  const width = Math.min(reviews.length, columns) * cell, height = Math.ceil(reviews.length / columns) * (cell + 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>\n`;
}

/**
 * How far the drawing itself may disagree with the box that says where it is
 * (MASC-09 §19), when `--measure` asks a browser what the drawing really is.
 *
 * ```text
 * overflow   the ink may reach 10% of the box's longer side outside it
 * slack      the box may be 1.5× the ink's width or height
 * ```
 *
 * Both are warnings and neither is a rule. A box wider than the ink is often
 * *right*: a pair of whiskers whose box is the span they need on the face
 * places better than one hugging four hairlines, and a drawing with a soft
 * shadow reaches past its own shape on purpose. What these catch is the
 * accident — a box copied from a neighbour, or one written before the drawing
 * was finished — which no diff shows and which puts the piece in the wrong
 * place on every face but the template.
 */
export const MEASURED_GEOMETRY_TOLERANCE = Object.freeze({ overflow: 0.1, slack: 1.5 });

/**
 * What the drawings really occupy, measured by a browser.
 *
 * Optional on purpose: `npm run face:assets` never starts one, because a sheet
 * an author cannot generate without a working Chromium is a sheet they stop
 * generating. With `--measure` the same page is built and each fragment's
 * `getBBox()` compared with the box its author wrote down.
 *
 * @returns {Map<string, { measured: object|null, issues: object[] }>} by asset id
 */
export async function measureAssets(reviews, { library = FACE_PART_LIBRARY, executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' } = {}) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath });
  const out = new Map();
  try {
    const page = await browser.newPage();
    const fragments = reviews.map((review) => ({ id: review.id, markup: artwork(library.get(review.id), 'measure') })).filter((item) => item.markup);
    await page.setContent(`<svg id="stage" xmlns="http://www.w3.org/2000/svg" width="800" height="800">`
      + fragments.map((item, index) => `<g id="measure-${index}">${item.markup}</g>`).join('') + '</svg>');
    const boxes = await page.evaluate((count) => Array.from({ length: count }, (_, index) => {
      const node = document.getElementById(`measure-${index}`);
      try { const b = node.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; } catch { return null; }
    }), fragments.length);
    for (const [index, item] of fragments.entries()) {
      const measured = boxes[index] && boxes[index].width > 0 ? boxes[index] : null;
      const declared = reviews.find((review) => review.id === item.id)?.referenceBox || null;
      // `getBBox` is geometry and knows nothing of a clip: a pair of eyes whose
      // lids are parked outside the socket and clipped to it measures as the
      // lids, and reads as overflowing a box that is exactly right. So a
      // fragment that clips is measured for slack and not for overflow.
      const clipped = /clip-path\s*=/.test(library.get(item.id)?.artwork || '');
      out.set(item.id, { measured, clipped, issues: measured && declared ? measuredIssues(declared, measured, { clipped }) : [] });
    }
  } finally { await browser.close(); }
  return out;
}

/**
 * The two readings of a box against the ink it is supposed to describe.
 *
 * @param {{ clipped?: boolean, tolerance?: object }} [options] `clipped` skips the
 *   overflow reading, which a clipped fragment cannot answer: the browser
 *   measures the geometry, and a clip is not geometry.
 */
export function measuredIssues(declared, measured, { clipped = false, tolerance = MEASURED_GEOMETRY_TOLERANCE } = {}) {
  const issues = [];
  const slackOf = Math.max(declared.width, declared.height) * tolerance.overflow;
  const over = Math.max(declared.x - measured.x, declared.y - measured.y,
    (measured.x + measured.width) - (declared.x + declared.width), (measured.y + measured.height) - (declared.y + declared.height));
  if (!clipped && over > slackOf) {
    issues.push({ severity: 'warning', code: 'artwork-overflow', field: 'referenceBox', message: `The drawing reaches ${num(over)} outside its reference box, which is more than ${Math.round(tolerance.overflow * 100)}% of it: the box may be the wrong one.` });
  }
  for (const axis of ['width', 'height']) {
    if (measured[axis] > 0 && declared[axis] / measured[axis] > tolerance.slack) {
      issues.push({ severity: 'warning', code: 'box-slack', field: 'referenceBox', message: `The reference box is ${num(declared[axis] / measured[axis])}× the drawing's ${axis}. Deliberate for a piece that needs the room; an accident otherwise.` });
    }
  }
  return issues;
}

/** The flags, read the way `hand-sheet.mjs` reads its own: no framework. */
export const SHEET_FLAGS = Object.freeze(['--slot', '--morphology', '--asset', '--style']);

export function parseSheetArgs(argv = []) {
  const option = (name) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  // Only a flag that takes a value swallows the next word: `--measure out/mine`
  // is a switch and a directory, not a switch with a value.
  const positional = argv.filter((value, index) => !value.startsWith('--') && !(index > 0 && SHEET_FLAGS.includes(argv[index - 1])));
  return { slot: option('--slot'), morphology: option('--morphology'), asset: option('--asset'), style: option('--style'), measure: argv.includes('--measure'), out: positional[0] || 'out/face-assets' };
}

/** The sheet on disk. Returns what was written, for the command line to report. */
export function writeAssetSheet({ out = 'out/face-assets', library = FACE_PART_LIBRARY, slot = null, morphology = null, asset = null, style = null, measured = null } = {}) {
  const reviews = reviewAssets({ library, slot, morphology, asset, style })
    .map((review) => (measured?.get(review.id)?.issues.length ? { ...review, geometryIssues: [...review.geometryIssues, ...measured.get(review.id).issues] } : review));
  const directory = resolve(out);
  mkdirSync(directory, { recursive: true });
  const title = `Face assets${slot ? ` · ${slot}` : ''}${morphology ? ` · ${morphology}` : ''}${style ? ` · ${style}` : ''}`;
  writeFileSync(`${directory}/index.html`, assetSheetMarkup(reviews, { library, title, filters: { slot, morphology, asset, style } }));
  writeFileSync(`${directory}/assets.svg`, assetContactSheet(reviews, { library }));
  return { directory, reviews, warnings: reviewWarnings(reviews), files: [`${directory}/index.html`, `${directory}/assets.svg`] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, measure, ...filters } = parseSheetArgs(process.argv.slice(2));
  if (filters.slot && !FACE_SLOTS[filters.slot]) throw new Error(`There is no slot called "${filters.slot}": ${Object.keys(FACE_SLOTS).join(', ')}`);
  const measured = measure ? await measureAssets(reviewAssets(filters)) : null;
  const { directory, reviews, warnings, files } = writeAssetSheet({ out, ...filters, measured });
  console.log(`Reviewed ${reviews.length} drawing(s)${Object.entries(filters).filter(([, value]) => value).map(([key, value]) => ` · ${key} ${value}`).join('')}${measure ? ' · measured in a browser' : ''}`);
  for (const file of files) console.log(`  ${file}`);
  console.log(`  ${warnings.length} geometry warning(s)`);
  for (const item of warnings) console.log(`    ${item.severity}: ${item.id} — ${item.message}`);
  if (!reviews.length) console.log('  (nothing matched: no drawing is in that slot or kind of face yet)');
}
