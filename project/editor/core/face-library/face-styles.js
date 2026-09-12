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

/**
 * `base` marks the art direction the library is **drawn in** (MASC-08A).
 *
 * Soft Cartoon is not a restyle of anything: it is what every shipped drawing
 * already looks like. Saying so in the catalogue is what lets the axis stay
 * one level deep and the library stay one copy of each drawing --
 *
 * ```text
 * head.round                 the drawing, in the base style
 *   ├─ head.round-flat         variant: { of: 'head.round', style: 'flat' }
 *   ├─ head.round-retro        variant: { of: 'head.round', style: 'retro' }
 *   └─ head.round-sketch       variant: { of: 'head.round', style: 'sketch' }
 * ```
 *
 * -- rather than the alternative, which is to draw 47 `-soft-cartoon` twins of
 * drawings that already exist purely so the base style has something to point
 * at. "Ask for the base style" resolves to the drawing itself; there is nothing
 * to draw and nothing to keep in step.
 */
const STYLE_TABLE = [
  ['soft-cartoon', 'Soft Cartoon', 'Rounded shapes and soft outlines: the look the library is drawn in.', true]
];

export const FACE_STYLES = Object.freeze(Object.fromEntries(STYLE_TABLE.map(([id, label, description, base = false]) => {
  if (!FACE_STYLE_ID.test(id)) throw new Error(`Face style "${id}" is not a style name: lower-case letters, digits and dashes.`);
  return [id, Object.freeze({ id, label, description, base })];
})));

export const FACE_STYLE_IDS = Object.freeze(Object.keys(FACE_STYLES));

/**
 * The one style the library is drawn in.
 *
 * Exactly one, and the module refuses to load otherwise: two base styles would
 * make "the drawing itself" ambiguous, and none would make every face
 * permanently half-restyled into a style with no drawings.
 */
export const FACE_BASE_STYLE_ID = (() => {
  const bases = Object.values(FACE_STYLES).filter((style) => style.base);
  if (bases.length !== 1) throw new Error(`The library is drawn in exactly one base style, and ${bases.length} are marked.`);
  return bases[0].id;
})();

/** A style by id, or null. */
export const faceStyle = (id) => FACE_STYLES[String(id ?? '')] || null;

/** Whether a style is the one the library is drawn in -- so asking for it is asking for the drawing itself. */
export const isBaseFaceStyle = (id) => String(id ?? '') === FACE_BASE_STYLE_ID;

/**
 * The styles the library can actually draw a face in, with what each holds.
 *
 * Counted from the variants themselves rather than declared, so a style is
 * offered when somebody has drawn it and not before. A style in the catalogue
 * with nothing behind it comes back with `variants: 0`, which is what an
 * offer-it-or-not decision reads.
 *
 * The base style is the exception that proves it, and the reason a caller must
 * not read `variants` as "can this be used": Soft Cartoon has no variants and
 * never will, because it *is* the drawings. What a face can do with a style is
 * `restylePlan`'s answer, not this one's.
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
  return ids.map((id) => ({ ...(FACE_STYLES[id] || { id, label: id, description: '', base: false }), variants: drawn.get(id) || 0 }));
}
