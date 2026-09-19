/**
 * Which pieces are cut, and by what (docs/VECTOR_EDITING.md, "A cut is a
 * relationship between two drawings").
 *
 * ```text
 *   Hair front    ✂ cut to Head shape
 *   Face shading  ✂ cut to Head shape
 *   Head shape    ✂ cuts Hair front, Face shading
 * ```
 *
 * A clip is the one thing in the artwork an author could not see. It is an
 * attribute pointing at a `<clipPath>` in the markup, and a `<clipPath>` is in
 * no layer and no `elements` record — so the fringe arrived cut to the head and
 * there was nothing anywhere that said so, let alone anything to press.
 *
 * What makes it *showable* is that the cut names a drawing. A `<clipPath>`
 * holding `<use href="#head">` cuts to the head an author can see, select and
 * reshape; one holding its own copy of a path cuts to a shape that exists only
 * to cut, and that shape needs an id and a name of its own or there is nothing
 * to put in a row. Both are read here, and both come back as *the drawing that
 * cuts* — a pair of ids the editor can show, and the second one is the answer
 * to "where is the geometry".
 *
 * Read from the markup rather than the DOM, because both the Layers panel and
 * the menu on the canvas need the same answer and only one of them has a DOM.
 */

/** The two ways a piece is cut: to an outline, or to a picture's transparency. */
export const CUT_ATTRIBUTES = Object.freeze(['clip-path', 'mask']);

const TAG = /<\s*(\/)?([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/)?>/g;
const attribute = (attributes, name) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attributes)?.slice(1).find((value) => value !== undefined) ?? null;
const reference = (value) => /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/.exec(value || '')?.[1] || null;
const fragment = (value) => (typeof value === 'string' && value.startsWith('#') ? value.slice(1) : null);

/**
 * Every cutting shape in the markup, by the id its `url(#…)` names.
 *
 * `shapeId` is the drawing that does the cutting: what a `<use>` points at, or
 * the shape's own id when the `<clipPath>` owns it. `named` is false for a
 * shape that owns itself and carries no id — the case an author cannot reach,
 * and the one the editor offers to fix.
 */
function cutters(markup) {
  const found = {};
  let open = null;
  for (const [, closing, tag, attributes] of String(markup ?? '').matchAll(TAG)) {
    if (tag !== 'clipPath' && tag !== 'mask') {
      if (!open || closing || open.shapeId) continue;
      // The first thing inside it is the shape that cuts.
      const href = fragment(attribute(attributes, 'href') ?? attribute(attributes, 'xlink:href'));
      open.shapeId = tag === 'use' ? href : attribute(attributes, 'id');
      open.name = tag === 'use' ? null : attribute(attributes, 'data-name');
      open.owns = tag !== 'use';
      continue;
    }
    if (closing) { if (open?.id) found[open.id] = open; open = null; continue; }
    const id = attribute(attributes, 'id');
    open = { id, kind: tag, shapeId: null, name: null, owns: true };
  }
  if (open?.id) found[open.id] = open;
  return found;
}

/**
 * Every drawing's own name and whether it is hidden, so a cut can be said in
 * words rather than in ids.
 *
 * Hidden matters because a cut that points at a drawing follows that drawing
 * *completely*: hide the head and the `<use>` in the clip renders nothing, so
 * the clip keeps nothing and the fringe goes with it. Measured in a browser, on
 * `display:none` and on `visibility:hidden` alike. That is the price of a cut
 * that tracks -- and the row is where an author can be told, instead of
 * watching the fringe vanish for no reason they can see.
 */
function names(markup) {
  const found = {};
  for (const [, closing, , attributes] of String(markup ?? '').matchAll(TAG)) {
    if (closing) continue;
    const id = attribute(attributes, 'id');
    if (!id || id in found) continue;
    found[id] = { name: attribute(attributes, 'data-name') || null, hidden: attribute(attributes, 'display') === 'none' };
  }
  return found;
}

/**
 * The cuts in a document, both ways round.
 *
 * @param {string} svgMarkup
 * @returns {{ byPiece: Record<string, object>, byCutter: Record<string, string[]> }}
 *   `byPiece[id]` is the cut on that piece: `{ clipId, kind, shapeId, shapeName, named }`.
 *   `byCutter[shapeId]` is every piece that shape cuts.
 */
export function readCuts(svgMarkup) {
  const shapes = cutters(svgMarkup), label = names(svgMarkup);
  const byPiece = {}, byCutter = {};
  for (const [, closing, , attributes] of String(svgMarkup ?? '').matchAll(TAG)) {
    if (closing) continue;
    const id = attribute(attributes, 'id');
    if (!id) continue;
    for (const key of CUT_ATTRIBUTES) {
      const clipId = reference(attribute(attributes, key));
      const cutter = clipId ? shapes[clipId] : null;
      if (!clipId || !cutter) continue;
      byPiece[id] = {
        clipId, kind: cutter.kind, shapeId: cutter.shapeId || null,
        shapeName: cutter.shapeId ? (cutter.name || label[cutter.shapeId]?.name || cutter.shapeId) : null,
        // A shape with no id of its own is the one an author cannot reach.
        named: Boolean(cutter.shapeId),
        // True only for a cut that points at a drawing, which is the case that
        // tracks -- and therefore the case that goes blank when it is hidden.
        drawn: Boolean(cutter.shapeId) && !cutter.owns,
        hidden: Boolean(cutter.shapeId && !cutter.owns && label[cutter.shapeId]?.hidden)
      };
      if (cutter.shapeId) (byCutter[cutter.shapeId] ||= []).push(id);
      break;
    }
  }
  return { byPiece, byCutter };
}

/**
 * How a cut reads in a row or a menu: *cut to Head shape*, or *cuts the fringe
 * and the shading*.
 *
 * Both are said from the piece's point of view, because that is the question
 * an author asks of the row they are looking at.
 */
export function describeCut(cuts, id, layerName = () => null) {
  const cut = cuts?.byPiece?.[id] || null;
  const makes = cuts?.byCutter?.[id] || [];
  return {
    cutBy: cut && { ...cut, shapeName: cut.shapeName || cut.shapeId },
    cutting: makes.length ? makes.map((piece) => layerName(piece) || piece) : null
  };
}
