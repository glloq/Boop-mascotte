import { findUnsafeSvg } from '../security/sanitize-svg.js';
import { ASSET_FORMATS, ASSET_MAX_DIMENSION } from './asset-model.js';

/**
 * What a file actually is, read from the file.
 *
 * **The extension is never trusted, and neither is the browser's `type`.**
 * Both are supplied by whoever produced the file; a `.png` that is really
 * something else is the ordinary case of an upload, not an attack, and either
 * way the only honest answer comes from the bytes. So a name or a declared
 * type is compared against what was found and reported when they disagree --
 * and the bytes win.
 *
 * Dimensions come from the container headers rather than from decoding. That
 * is deliberate twice over: it is testable in Node, with no DOM, and it means
 * an absurd image is refused *before* anything tries to allocate its pixels.
 * A 60000 x 60000 PNG is a header saying 3.6 billion pixels, and the moment to
 * decline it is while it is still a header.
 *
 * Every reader here was checked against real encoder output, not against a
 * reading of the specification: the fixtures in `tests/fixtures/assets` are
 * Chromium's own PNG and WebP, in all three WebP framings.
 */

/** Beyond this an import is refused rather than resized: it is not a picture of a mascot. */
export const ASSET_IMPORT_MAX_DIMENSION = 8192;
export const ASSET_IMPORT_MAX_PIXELS = 32_000_000;
export const ASSET_IMPORT_MAX_BYTES = 32 * 1024 * 1024;

const view = (input) => (input instanceof Uint8Array ? input : new Uint8Array(input ?? []));
const starts = (bytes, signature, at = 0) => signature.every((byte, index) => bytes[at + index] === byte);
const be32 = (bytes, at) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const le24 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
const le16 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8);

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];

const tag = (bytes, at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

/** The format, or null. `image/jpeg` and `image/gif` are recognised so they can be named, not stored. */
export function sniffFormat(input) {
  const bytes = view(input);
  if (bytes.length >= 8 && starts(bytes, PNG)) return 'image/png';
  if (bytes.length >= 12 && starts(bytes, RIFF) && starts(bytes, WEBP, 8)) return 'image/webp';
  if (bytes.length >= 3 && starts(bytes, JPEG)) return 'image/jpeg';
  if (bytes.length >= 4 && starts(bytes, GIF)) return 'image/gif';
  // SVG last: it is the only text format here, and anything binary has already
  // answered. A leading BOM, declaration or comment is ordinary.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024));
  if (/<svg[\s>]/i.test(head) || (/<\?xml[\s\S]*?\?>/.test(head) && /<svg/i.test(head))) return 'image/svg+xml';
  return null;
}

/** IHDR is always the first chunk, at a fixed offset; colour type 4 and 6 carry alpha, and `tRNS` gives it to the rest. */
function readPng(bytes) {
  if (bytes.length < 26 || tag(bytes, 12) !== 'IHDR') return null;
  const width = be32(bytes, 16), height = be32(bytes, 20), colour = bytes[25];
  if (!width || !height) return null;
  let alpha = colour === 4 || colour === 6;
  if (!alpha) {
    // Walk the chunk list for `tRNS`, which makes one colour or one palette
    // entry transparent. Bounded by the file, and it stops at `IDAT` because
    // `tRNS` may not follow the pixels.
    for (let at = 8; at + 8 <= bytes.length;) {
      const size = be32(bytes, at), name = tag(bytes, at + 4);
      if (name === 'tRNS') { alpha = true; break; }
      if (name === 'IDAT' || name === 'IEND' || !Number.isFinite(size)) break;
      at += 12 + size;
    }
  }
  return { width, height, alpha };
}

/**
 * WebP comes in three framings and they are not interchangeable.
 *
 * `VP8X` is the extended one, which is what a browser writes: a canvas header
 * carrying the real size and an alpha flag, with the picture in a later chunk.
 * `VP8L` is simple lossless, whose size and alpha live in a packed 32-bit
 * field. `VP8 ` is simple lossy, whose size follows a three-byte start code
 * and which never carries alpha on its own.
 */
function readWebp(bytes) {
  if (bytes.length < 20) return null;
  const kind = tag(bytes, 12);
  if (kind === 'VP8X') {
    if (bytes.length < 30) return null;
    return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1, alpha: Boolean(bytes[20] & 0x10) };
  }
  if (kind === 'VP8L') {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const packed = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1, alpha: Boolean((packed >>> 28) & 1) };
  }
  if (kind === 'VP8 ') {
    if (bytes.length < 30 || !starts(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff, alpha: false };
  }
  return null;
}

const length = (value) => {
  const match = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(String(value ?? ''));
  return match ? Number(match[1]) : 0;
};

/**
 * An SVG's size is its `viewBox`, and only its `width`/`height` when it has
 * none: the viewBox is what the artwork is drawn in, and the attributes are
 * how big someone wanted it on a page. A percentage is neither, so it counts
 * as no answer at all.
 */
export function readSvgSize(text) {
  const box = /<svg[^>]*\sviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(text);
  if (box) { const width = Math.round(Number(box[1])), height = Math.round(Number(box[2])); if (width > 0 && height > 0) return { width, height, alpha: true }; }
  const open = /<svg[^>]*>/i.exec(text)?.[0] ?? '';
  const width = Math.round(length(/\swidth\s*=\s*["']([^"']*)["']/i.exec(open)?.[1]));
  const height = Math.round(length(/\sheight\s*=\s*["']([^"']*)["']/i.exec(open)?.[1]));
  // Vector artwork is transparent wherever it does not draw, always.
  return width > 0 && height > 0 ? { width, height, alpha: true } : null;
}

/**
 * The format and intrinsic size of a file, or null when it is not one this
 * editor knows at all.
 *
 * A known format whose header cannot be read comes back *named*, with a size
 * of zero, rather than as null. The difference matters to whoever is told
 * about it: a truncated PNG is a damaged PNG, and calling it "not an image"
 * sends its author looking for the wrong problem.
 */
export function readImageHeader(input) {
  const bytes = view(input);
  const format = sniffFormat(bytes);
  if (!format) return null;
  const unreadable = { format, width: 0, height: 0, alpha: false };
  if (format === 'image/png') { const size = readPng(bytes); return size ? { format, ...size } : unreadable; }
  if (format === 'image/webp') { const size = readWebp(bytes); return size ? { format, ...size } : unreadable; }
  if (format === 'image/svg+xml') { const size = readSvgSize(new TextDecoder().decode(bytes)); return size ? { format, ...size } : unreadable; }
  return unreadable;
}

const issue = (code, detail = '') => ({ code, detail });

/**
 * Whether a file may become an asset, and everything worth saying about it.
 *
 * `ok` means it may be imported. An issue that does not block is still
 * reported, because "this is bigger than the budget and will be resized" and
 * "this file is not what it is called" are both things an author should be
 * told rather than have done to them silently.
 *
 * @returns {{ ok: boolean, format: string|null, width: number, height: number, alpha: boolean, issues: {code: string, detail: string}[] }}
 */
export function validateAssetBytes(input, { name = '', declaredType = '', maxDimension = ASSET_MAX_DIMENSION } = {}) {
  const bytes = view(input);
  const issues = [], refuse = (code, detail) => { issues.push(issue(code, detail)); return { ok: false, format: null, width: 0, height: 0, alpha: false, issues }; };

  if (!bytes.length) return refuse('empty', name);
  if (bytes.length > ASSET_IMPORT_MAX_BYTES) return refuse('too-many-bytes', `${bytes.length} bytes`);

  const header = readImageHeader(bytes);
  if (!header) return refuse('unknown-format', name);
  // Recognised, and still not something to keep: a mascot's artwork is kept in
  // a format that carries transparency, so these are conversions rather than
  // imports (docs/V4_ROADMAP.md).
  if (!ASSET_FORMATS.includes(header.format)) return refuse('convert-first', header.format);
  if (!header.width || !header.height) return refuse('no-dimensions', header.format);

  if (header.width > ASSET_IMPORT_MAX_DIMENSION || header.height > ASSET_IMPORT_MAX_DIMENSION) return refuse('too-large', `${header.width}x${header.height}`);
  if (header.width * header.height > ASSET_IMPORT_MAX_PIXELS) return refuse('too-many-pixels', `${header.width}x${header.height}`);

  if (header.format === 'image/svg+xml') {
    // The same rules that clean an import, asked rather than applied: an SVG
    // carrying anything executable is refused here rather than quietly
    // stripped, so nobody wonders later where half their file went.
    const unsafe = findUnsafeSvg(new TextDecoder().decode(bytes));
    if (unsafe.length) return refuse('unsafe-svg', unsafe.map((found) => found.kind).join(', '));
  }

  // Advisory from here: the file is importable, and these are things to say.
  const declared = String(declaredType || '').toLowerCase().split(';')[0].trim();
  if (declared && declared !== header.format) issues.push(issue('declared-type-mismatch', `${declared} is really ${header.format}`));
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const byExtension = { png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' }[extension];
  if (byExtension && byExtension !== header.format) issues.push(issue('extension-mismatch', `${name} is really ${header.format}`));
  if (Math.max(header.width, header.height) > maxDimension) issues.push(issue('over-budget', `${header.width}x${header.height} will be resized to fit ${maxDimension}`));

  return { ok: true, format: header.format, width: header.width, height: header.height, alpha: header.alpha, issues };
}
