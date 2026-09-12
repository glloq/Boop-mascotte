/**
 * The looks a face can be drawn in (MASC-01).
 *
 * This is a **catalogue, not a mechanism**. The mechanism has been in the
 * library since V3-05 and is complete: an asset says it restyles another
 * (`variant: { of, style }`), the registry resolves one (`registry.variant()`),
 * a preset asks for one (`preset.style`), and `styledAsset()` falls back to the
 * drawing the preset named when nobody has drawn the restyle. What was missing
 * is a list of which styles exist, so a person can be offered one.
 *
 * A style is therefore worth exactly as much as the variants drawn in it, and
 * not one drawing more. A catalogue entry with no variants behind it restyles
 * nothing — which is honest, and is why the four the plan names next
 * (`flat`, `retro`, `geometric`, `sketch`) are not listed here yet: a style
 * arrives with its drawings, or it lies to whoever picks it.
 *
 * Nothing here reaches a document. A face has parts, never a style: what a
 * style does is decide which drawings go on, once, and the face afterwards is
 * the drawings (`presetOfFace` reads it back that way, deliberately).
 */
import { FACE_STYLE_ID } from './face-part-model.js';

const STYLE_TABLE = [
  ['soft-cartoon', 'Soft Cartoon', 'Rounded shapes and soft outlines: the look the library is drawn in.']
];

export const FACE_STYLES = Object.freeze(Object.fromEntries(STYLE_TABLE.map(([id, label, description]) => {
  if (!FACE_STYLE_ID.test(id)) throw new Error(`Face style "${id}" is not a style name: lower-case letters, digits and dashes.`);
  return [id, Object.freeze({ id, label, description })];
})));

export const FACE_STYLE_IDS = Object.freeze(Object.keys(FACE_STYLES));

/** A style by id, or null. */
export const faceStyle = (id) => FACE_STYLES[String(id ?? '')] || null;

/**
 * The styles the library can actually draw a face in, with what each holds.
 *
 * Counted from the variants themselves rather than declared, so a style is
 * offered when somebody has drawn it and not before. A style in the catalogue
 * with nothing behind it comes back with `variants: 0`, which is what an
 * offer-it-or-not decision reads.
 *
 * @param {{ list: (category?: string|null) => object[] }} library
 * @returns {{ id: string, label: string, description: string, variants: number }[]}
 */
export function availableFaceStyles(library) {
  const drawn = new Map();
  for (const asset of library?.list?.() || []) {
    if (!asset?.variant?.style) continue;
    drawn.set(asset.variant.style, (drawn.get(asset.variant.style) || 0) + 1);
  }
  // A style somebody drew and nobody catalogued is still a style: it is listed
  // under its own id, so a pack bringing a look of its own is not invisible.
  const ids = [...new Set([...FACE_STYLE_IDS, ...drawn.keys()])];
  return ids.map((id) => ({ ...(FACE_STYLES[id] || { id, label: id, description: '' }), variants: drawn.get(id) || 0 }));
}
